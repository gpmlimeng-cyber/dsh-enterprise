/**
 * [INPUT]: 依赖 Commons Compress 的 gzip/tar/zip 读取与 tar 写入、解压/entry 上限与已落地的不可信上传文件。
 * [OUTPUT]: 对外提供容器格式嗅探、规范 npm 布局判定与字节可复现的 tgz 重写；失败复用 PluginArtifactException 的 INVALID/TOO_LARGE 类别。
 * [POS]: plugin/artifact 的容器归一化前置层，位于 PluginArtifactStore 与 PluginArtifactInspector 之间；只重排容器与路径，内容安全裁决仍由 inspector 独占，绝不重复其策略。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.artifact;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.archivers.tar.TarConstants;
import org.apache.commons.compress.archivers.zip.UnixStat;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipFile;
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream;
import org.apache.commons.compress.compressors.gzip.GzipParameters;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * 为什么需要归一化：员工端用 `dsh plugin add <file>` 安装，走的是 npm/pnpm 语义，
 * 而 npm 与 pnpm 都只接受 gzip tar，zip 会被判成 ENOTDIR / ERR_PNPM_NOT_PACKAGE_DIRECTORY。
 * 因此服务端必须在制品进入 CAS 之前把 zip（以及 GitHub 风格的外层目录包装）折叠成规范 tgz，
 * 否则就会造出"上传能成功、员工永远装不上"的假功能。
 *
 * 两条不可动摇的边界：
 * 1. 已符合 npm 布局的 gzip tar 一律原样透传，不重写字节——既保留上游 npm 的 hash 与既有行的幂等语义，也让老数据零迁移。
 * 2. 只有需要改动容器或路径时才重写，且重写产物必须字节可复现（固定 mtime/uid/gid/mode/OS），
 *    否则同一份内容两次上传会得到两个 SHA-256，幂等会被破坏。
 */
public final class PluginArtifactNormalizer {
    /** npm/pnpm 只认这个根目录，同时也是 inspector 的硬性要求。 */
    private static final String ROOT = "package/";
    private static final byte[] GZIP_MAGIC = {0x1f, (byte) 0x8b};
    private static final int BUFFER_SIZE = 8192;
    /** 符号链接目标只是路径文本，超出即为畸形输入。 */
    private static final int LINK_TARGET_LIMIT = 4096;
    /** zip 中央目录恒有大小；缺失大小只可能是畸形输入，给出显式上界而非无限缓冲。 */
    private static final int UNKNOWN_SIZE_LIMIT = 8 * 1024 * 1024;
    /** 1970-01-01T00:00:00Z：冻结时间戳是字节可复现的前提。 */
    private static final long FIXED_MOD_TIME_MILLIS = 0L;
    private static final int FILE_MODE = 420;
    private static final int DIR_MODE = 493;
    private static final int LINK_MODE = 511;

    private final long maxExpandedBytes;
    private final int maxEntries;

    public PluginArtifactNormalizer(long maxExpandedBytes, int maxEntries) {
        if (maxExpandedBytes <= 0 || maxEntries <= 0) throw new IllegalArgumentException("归档上限必须为正数");
        this.maxExpandedBytes = maxExpandedBytes;
        this.maxEntries = maxEntries;
    }

    /**
     * 暴露本归一化器实际执行的内容上限，供写盘方复用同一数值设置输出硬上限。
     * 让"上限"只存在于配置 → 归一化器这一条链上，避免写盘方再读一次配置造成两份真源漂移。
     */
    public long maxExpandedBytes() {
        return maxExpandedBytes;
    }

    /**
     * 判定上传内容是否已经是 inspector 能直接接受的规范 npm tgz。
     * 返回 true 表示调用方应把已落地的原始字节原样送入 CAS，不做任何重写。
     *
     * 跳过 entry 内容同样会解压 gzip，所以预扫描也必须执行与 inspector 相同的 entry/解压上限，
     * 否则一个 50MB 的 gzip 炸弹可以在验包之前先把这里炸成无界 CPU 消耗。
     */
    public boolean isCanonicalNpmTgz(Path source) {
        Objects.requireNonNull(source, "source");
        if (sniff(source) != Format.GZIP_TAR) return false;
        WriteBudget budget = new WriteBudget();
        try (InputStream file = Files.newInputStream(source);
             GzipCompressorInputStream gzip = GzipCompressorInputStream.builder().setInputStream(file).get();
             TarArchiveInputStream tar = new TarArchiveInputStream(gzip)) {
            TarArchiveEntry entry;
            while ((entry = tar.getNextEntry()) != null) {
                budget.claimEntry(this);
                budget.claimDeclared(this, entry.getSize());
                String name = entry.getName();
                if (name == null || !name.startsWith(ROOT)) return false;
            }
            return true;
        } catch (PluginArtifactException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw invalid("归档无法解析", exception);
        }
    }

    /**
     * 把 source 归一化为规范 npm tgz 并写入 target。
     * 只重排容器与路径，不改写任何 entry 内容，也不做内容安全裁决——那是 inspector 的职责。
     */
    public void writeCanonicalTgz(Path source, OutputStream target) {
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(target, "target");
        switch (sniff(source)) {
            case GZIP_TAR -> rewriteGzipTar(source, target);
            case ZIP -> rewriteZip(source, target);
        }
    }

    // ============================ gzip tar 重写 ============================

    private void rewriteGzipTar(Path source, OutputStream target) {
        Layout layout = layoutOf(tarNames(source));
        WriteBudget budget = new WriteBudget();
        try (InputStream file = Files.newInputStream(source);
             GzipCompressorInputStream gzip = GzipCompressorInputStream.builder().setInputStream(file).get();
             TarArchiveInputStream tar = new TarArchiveInputStream(gzip);
             TarArchiveOutputStream out = tarOutput(target)) {
            TarArchiveEntry entry;
            while ((entry = tar.getNextEntry()) != null) {
                budget.claimEntry(this);
                String mapped = mapName(layout, validateName(entry.getName()));
                if (mapped == null) continue;
                if (entry.isDirectory()) {
                    writeDirectory(out, mapped);
                } else if (entry.isSymbolicLink()) {
                    writeLink(out, mapped, TarConstants.LF_SYMLINK, entry.getLinkName());
                } else if (entry.isLink()) {
                    writeLink(out, mapped, TarConstants.LF_LINK, entry.getLinkName());
                } else if (isRegularFile(entry)) {
                    writeFile(out, mapped, entry.getSize(), tar, budget);
                } else {
                    // 设备/FIFO/socket 无法在 tar 与 zip 之间无损重排，拒绝比静默降级为普通文件安全。
                    throw invalid("归档包含无法重写的特殊 entry");
                }
            }
        } catch (PluginArtifactException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw invalid("归档无法解析", exception);
        }
    }

    /**
     * 严格的普通文件判定。
     *
     * 刻意不用 TarArchiveEntry.isFile()：它的实现是"非目录且不以 / 结尾"，于是 FIFO(54)、字符设备(51)、
     * 块设备(52) 与 CONTIG(55) 全部会被判成普通文件，重写时被静默降级成普通文件，正好绕过 inspector 的类型裁决。
     * 这里只认真正的普通文件 flag，其余一律 fail-closed。
     */
    private static boolean isRegularFile(TarArchiveEntry entry) {
        byte linkFlag = entry.getLinkFlag();
        return linkFlag == TarConstants.LF_NORMAL || linkFlag == TarConstants.LF_OLDNORM;
    }

    private List<String> tarNames(Path source) {
        List<String> names = new ArrayList<>();
        try (InputStream file = Files.newInputStream(source);
             GzipCompressorInputStream gzip = GzipCompressorInputStream.builder().setInputStream(file).get();
             TarArchiveInputStream tar = new TarArchiveInputStream(gzip)) {
            TarArchiveEntry entry;
            while ((entry = tar.getNextEntry()) != null) {
                if (names.size() >= maxEntries) throw tooLarge("归档 entry 数超过上限");
                names.add(validateName(entry.getName()));
            }
        } catch (PluginArtifactException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw invalid("归档无法解析", exception);
        }
        return names;
    }

    // ============================ zip 重写 ============================

    private void rewriteZip(Path source, OutputStream target) {
        Layout layout = layoutOf(zipNames(source));
        WriteBudget budget = new WriteBudget();
        try (ZipFile zip = openZip(source);
             TarArchiveOutputStream out = tarOutput(target)) {
            // getEntries() 只提供 Enumeration；物化为 List 后按中央目录顺序遍历，顺序稳定即输出稳定。
            for (ZipArchiveEntry entry : Collections.list(zip.getEntries())) {
                budget.claimEntry(this);
                String mapped = mapName(layout, validateName(entry.getName()));
                if (mapped == null) continue;
                if (!zip.canReadEntryData(entry)) throw invalid("归档包含不支持的 entry");
                if (entry.isDirectory()) {
                    writeDirectory(out, mapped);
                } else if (entry.isUnixSymlink()) {
                    writeLink(out, mapped, TarConstants.LF_SYMLINK, readLinkTarget(zip, entry));
                } else if (hasUnsupportedUnixType(entry)) {
                    throw invalid("归档包含无法重写的特殊 entry");
                } else {
                    long size = entry.getSize();
                    if (size < 0) {
                        writeUnknownSizeFile(out, mapped, zip, entry, budget);
                    } else {
                        writeFile(out, mapped, size, zip.getInputStream(entry), budget);
                    }
                }
            }
        } catch (PluginArtifactException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw invalid("归档无法解析", exception);
        }
    }

    private List<String> zipNames(Path source) {
        List<String> names = new ArrayList<>();
        try (ZipFile zip = openZip(source)) {
            for (ZipArchiveEntry entry : Collections.list(zip.getEntries())) {
                if (names.size() >= maxEntries) throw tooLarge("归档 entry 数超过上限");
                names.add(validateName(entry.getName()));
            }
        } catch (PluginArtifactException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            throw invalid("归档无法解析", exception);
        }
        return names;
    }

    private static ZipFile openZip(Path source) {
        try {
            return ZipFile.builder().setPath(source).get();
        } catch (IOException exception) {
            throw invalid("归档无法解析", exception);
        }
    }

    private static String readLinkTarget(ZipFile zip, ZipArchiveEntry entry) {
        try (InputStream content = zip.getInputStream(entry)) {
            byte[] target = content.readNBytes(LINK_TARGET_LIMIT + 1);
            if (target.length > LINK_TARGET_LIMIT) throw invalid("符号链接目标非法");
            return new String(target, StandardCharsets.UTF_8);
        } catch (PluginArtifactException exception) {
            throw exception;
        } catch (IOException exception) {
            throw invalid("归档无法解析", exception);
        }
    }

    /**
     * 只把 Unix 属性里明确非普通文件的类型挡掉；DOS 生成的 zip 没有 unix mode（低 16 位为 0），须按普通文件放行。
     */
    private static boolean hasUnsupportedUnixType(ZipArchiveEntry entry) {
        int type = entry.getUnixMode() & UnixStat.FILE_TYPE_FLAG;
        return type != 0 && type != UnixStat.FILE_FLAG && type != UnixStat.DIR_FLAG;
    }

    // ============================ 布局判定与路径映射 ============================

    private static Layout layoutOf(List<String> names) {
        if (!names.isEmpty() && names.stream().allMatch(name -> name.startsWith(ROOT))) {
            // 已是 npm 布局；理论上 isCanonicalNpmTgz 已放行，这里覆盖 zip 携带 package/ 布局的情况。
            return new Layout(true, null);
        }
        if (names.isEmpty()) return new Layout(false, null);
        String first = names.get(0);
        int separator = first.indexOf('/');
        if (separator < 0) return new Layout(false, null);
        String candidate = first.substring(0, separator);
        boolean wrapped = names.stream().allMatch(
            name -> name.equals(candidate) || name.startsWith(candidate + "/")
        );
        return new Layout(false, wrapped ? candidate : null);
    }

    /**
     * @return 目标 entry 名；返回 null 表示该 entry 是包装目录自身，应丢弃。
     */
    private static String mapName(Layout layout, String name) {
        if (layout.identity()) {
            if (!name.startsWith(ROOT)) throw invalid("归档路径不在 package/ 下");
            return name;
        }
        String relative = name;
        if (layout.wrapper() != null) {
            if (relative.equals(layout.wrapper()) || relative.equals(layout.wrapper() + "/")) return null;
            if (!relative.startsWith(layout.wrapper() + "/")) throw invalid("归档包含多个顶层目录");
            relative = relative.substring(layout.wrapper().length() + 1);
        }
        if (relative.isEmpty()) return null;
        return ROOT + relative;
    }

    /**
     * 拒绝一切无法安全重排的名字：绝对路径、反斜杠、NUL、`.`/`..` 段与内部空段。
     * 这是"能否重写"的判定，不是"内容是否危险"的判定，故不与 inspector 重复。
     */
    private static String validateName(String raw) {
        if (raw == null || raw.isEmpty() || raw.indexOf('\0') >= 0 || raw.indexOf('\\') >= 0) {
            throw invalid("归档路径非法");
        }
        String name = raw.startsWith("./") ? raw.substring(2) : raw;
        if (name.isEmpty() || name.startsWith("/")) throw invalid("归档路径非法");
        String[] segments = name.split("/", -1);
        for (int index = 0; index < segments.length; index++) {
            String segment = segments[index];
            if (segment.isEmpty()) {
                if (index != segments.length - 1) throw invalid("归档路径包含逃逸段");
                continue;
            }
            if (".".equals(segment) || "..".equals(segment)) throw invalid("归档路径包含逃逸段");
        }
        return name;
    }

    // ============================ tar 输出 ============================

    private static TarArchiveOutputStream tarOutput(OutputStream target) throws IOException {
        GzipParameters parameters = new GzipParameters();
        parameters.setModificationTime(FIXED_MOD_TIME_MILLIS);
        parameters.setOS(GzipParameters.OS.UNKNOWN);
        TarArchiveOutputStream out = new TarArchiveOutputStream(
            new GzipCompressorOutputStream(target, parameters)
        );
        out.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);
        return out;
    }

    private static void writeDirectory(TarArchiveOutputStream out, String name) throws IOException {
        String directory = name.endsWith("/") ? name : name + "/";
        TarArchiveEntry entry = new TarArchiveEntry(directory, TarConstants.LF_DIR);
        entry.setSize(0);
        fixMetadata(entry, DIR_MODE);
        out.putArchiveEntry(entry);
        out.closeArchiveEntry();
    }

    private static void writeLink(TarArchiveOutputStream out, String name, byte linkFlag, String linkName)
        throws IOException {
        TarArchiveEntry entry = new TarArchiveEntry(name, linkFlag);
        entry.setLinkName(linkName == null ? "" : linkName);
        entry.setSize(0);
        fixMetadata(entry, LINK_MODE);
        out.putArchiveEntry(entry);
        out.closeArchiveEntry();
    }

    private void writeFile(
        TarArchiveOutputStream out,
        String name,
        long declaredSize,
        InputStream content,
        WriteBudget budget
    ) throws IOException {
        TarArchiveEntry entry = new TarArchiveEntry(name, TarConstants.LF_NORMAL);
        entry.setSize(declaredSize);
        fixMetadata(entry, FILE_MODE);
        out.putArchiveEntry(entry);
        long written = copy(out, content, declaredSize, budget);
        if (written != declaredSize) throw invalid("归档 entry 大小与声明不一致");
        out.closeArchiveEntry();
    }

    private void writeUnknownSizeFile(
        TarArchiveOutputStream out,
        String name,
        ZipFile zip,
        ZipArchiveEntry entry,
        WriteBudget budget
    ) throws IOException {
        byte[] content;
        try (InputStream source = zip.getInputStream(entry)) {
            ByteArrayOutputStream capture = new ByteArrayOutputStream();
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = source.read(buffer)) != -1) {
                if (capture.size() + read > UNKNOWN_SIZE_LIMIT) throw invalid("归档 entry 缺少大小声明");
                capture.write(buffer, 0, read);
            }
            content = capture.toByteArray();
        } catch (PluginArtifactException exception) {
            throw exception;
        } catch (IOException exception) {
            throw invalid("归档无法解析", exception);
        }
        writeFile(out, name, content.length, new java.io.ByteArrayInputStream(content), budget);
    }

    /**
     * 逐字节搬运并同时执行两级预算：单 entry 不得超出声明大小，全归档不得超出解压上限。
     * 只把 source.read 的 IOException 判为坏归档；out.write 的 IOException 属于基础设施故障，必须原样上抛。
     */
    private long copy(TarArchiveOutputStream out, InputStream content, long declaredSize, WriteBudget budget)
        throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        long written = 0;
        while (true) {
            int read;
            try {
                read = content.read(buffer);
            } catch (IOException exception) {
                throw invalid("归档无法解析", exception);
            }
            if (read == -1) return written;
            if (read > declaredSize - written) throw invalid("归档 entry 大小与声明不一致");
            budget.claimBytes(this, read);
            out.write(buffer, 0, read);
            written += read;
        }
    }

    private static void fixMetadata(TarArchiveEntry entry, int mode) {
        entry.setMode(mode);
        entry.setUserId(0);
        entry.setGroupId(0);
        entry.setUserName("");
        entry.setGroupName("");
        entry.setModTime(FIXED_MOD_TIME_MILLIS);
    }

    // ============================ 格式嗅探 ============================

    private static Format sniff(Path source) {
        byte[] head = new byte[4];
        int read;
        try (InputStream input = Files.newInputStream(source)) {
            read = input.readNBytes(head, 0, head.length);
        } catch (IOException exception) {
            throw invalid("归档无法读取", exception);
        }
        if (read >= GZIP_MAGIC.length && head[0] == GZIP_MAGIC[0] && head[1] == GZIP_MAGIC[1]) {
            return Format.GZIP_TAR;
        }
        if (read == head.length && head[0] == 'P' && head[1] == 'K'
            && (head[2] == 3 || head[2] == 5 || head[2] == 7)
            && (head[3] == 4 || head[3] == 6 || head[3] == 8)) {
            return Format.ZIP;
        }
        throw invalid("归档既不是 gzip tar 也不是 zip");
    }

    private static PluginArtifactException invalid(String message) {
        return new PluginArtifactException(PluginArtifactException.Kind.INVALID, message);
    }

    private static PluginArtifactException invalid(String message, Throwable cause) {
        return new PluginArtifactException(PluginArtifactException.Kind.INVALID, message, cause);
    }

    private static PluginArtifactException tooLarge(String message) {
        return new PluginArtifactException(PluginArtifactException.Kind.TOO_LARGE, message);
    }

    private enum Format { GZIP_TAR, ZIP }

    /**
     * @param identity true 表示保持 entry 原名（源已是 package/ 布局）
     * @param wrapper  非 identity 时待剥离的顶层包装目录，可为 null（平坦布局）
     */
    private record Layout(boolean identity, String wrapper) {
    }

    /**
     * 归一化阶段的两级预算。写出的 tgz 展开量与源内容等量，故这里与 inspector 共用同一组上限，
     * 不会在"归一化 → 验包"之间形成二次放大。
     */
    private static final class WriteBudget {
        private int entries;
        private long expanded;

        private void claimEntry(PluginArtifactNormalizer owner) {
            if (++entries > owner.maxEntries) throw tooLarge("归档 entry 数超过上限");
        }

        /** 预扫描用：只按声明的 entry 大小累计，不读内容也仍然受解压上限约束。 */
        private void claimDeclared(PluginArtifactNormalizer owner, long declaredSize) {
            long size = declaredSize < 0 ? 0 : declaredSize;
            if (size > owner.maxExpandedBytes - expanded) throw tooLarge("归档解压大小超过上限");
            expanded += size;
        }

        private void claimBytes(PluginArtifactNormalizer owner, int read) {
            if (read > owner.maxExpandedBytes - expanded) throw tooLarge("归档解压大小超过上限");
            expanded += read;
        }
    }
}
