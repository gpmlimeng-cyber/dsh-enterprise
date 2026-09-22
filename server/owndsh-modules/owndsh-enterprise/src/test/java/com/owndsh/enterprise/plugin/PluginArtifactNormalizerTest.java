/**
 * [INPUT]: 依赖 Commons Compress 归档构造、临时目录与真实 PluginArtifactNormalizer/Inspector。
 * [OUTPUT]: 验证 zip/GitHub 包装目录折叠为规范 npm tgz、规范 tgz 字节透传、重写字节可复现，以及路径逃逸/特殊 entry/上限的 fail-closed 拒绝。
 * [POS]: plugin artifact 归一化前置层的门禁，锁定"员工端 npm/pnpm 装得上"这一唯一目标与确定性重写契约。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import com.owndsh.enterprise.plugin.artifact.PluginArtifactException;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactNormalizer;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.archivers.tar.TarConstants;
import org.apache.commons.compress.archivers.zip.UnixStat;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveOutputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class PluginArtifactNormalizerTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final long MAX_EXPANDED_BYTES = 8_000_000L;
    private static final int MAX_ENTRIES = 100;
    /** 与 PluginArtifactSecurityTest 同口径：这里只覆盖受保护包判定回路，权威清单由 PluginCorePackageContractTest 守护。 */
    private static final Set<String> PROTECTED_PACKAGE_FOR_TEST = Set.of("dshent-plugin");

    @TempDir
    Path temporary;

    private final PluginArtifactNormalizer normalizer =
        new PluginArtifactNormalizer(MAX_EXPANDED_BYTES, MAX_ENTRIES);

    @Test
    void passesCanonicalNpmTgzThroughUntouched() throws Exception {
        byte[] original = PluginTestArtifacts.validArchive("@example/acme-tools", "1.2.3");
        Path source = write("canonical.tgz", original);

        // 透传的判据是"inspector 会直接接受这份原始字节"，所以两条断言必须同时成立：
        // 归一化器认得它，且真正的内容闸门也确实放行原字节——只看其中一条都可能放过一次无谓重写。
        assertThat(normalizer.isCanonicalNpmTgz(source)).isTrue();
        assertThat(inspector().inspect(source).packageName()).isEqualTo("@example/acme-tools");

        // 服务端在 isCanonicalNpmTgz 为真时根本不调用重写，故 hash 与上游字节一致；
        // 这里额外锁住"重写自身也是幂等稳定的"，防止将来把透传判据改坏后无人察觉。
        byte[] rewritten = canonicalOf(source);
        assertThat(sha256(canonicalOf(write("canonical-again.tgz", rewritten)))).isEqualTo(sha256(rewritten));
    }

    @Test
    void foldsZipIntoNpmTgzThatTheRealInspectorAccepts() throws Exception {
        Path source = write("plugin.zip", PluginTestArtifacts.validZipArchive("@example/acme-tools", "1.2.3"));

        assertThat(normalizer.isCanonicalNpmTgz(source)).isFalse();
        byte[] canonical = canonicalOf(source);

        assertThat(entryNames(canonical)).containsExactly(
            "package/package.json", "package/cordis.patch.yml", "package/lib/index.js"
        );
        // 归一化的唯一验收标准：产物必须被真正的内容安全闸门接受，而不只是"看起来像 tgz"。
        PluginArtifactInspector.InspectedPlugin inspected =
            inspector().inspect(write("canonical-form.tgz", canonical));
        assertThat(inspected.packageName()).isEqualTo("@example/acme-tools");
        assertThat(inspected.version()).isEqualTo("1.2.3");
        assertThat(inspected.patchPath()).isEqualTo("cordis.patch.yml");
    }

    @Test
    void stripsGitHubWrapperDirectoryFromZipAndTgz() throws Exception {
        byte[] fromZip = canonicalOf(write(
            "github.zip", PluginTestArtifacts.wrappedZipArchive("acme-tools-1.2.3", "@example/acme-tools", "1.2.3")
        ));
        byte[] fromTgz = canonicalOf(write(
            "github.tgz", PluginTestArtifacts.wrappedTgzArchive("acme-tools-1.2.3", "@example/acme-tools", "1.2.3")
        ));

        assertThat(entryNames(fromZip)).containsExactly(
            "package/package.json", "package/cordis.patch.yml", "package/lib/index.js"
        );
        assertThat(entryNames(fromTgz)).isEqualTo(entryNames(fromZip));
    }

    @Test
    void rewritesReproduciblySoIdempotentReuploadKeepsOneHash() throws Exception {
        Path source = write("repeat.zip", PluginTestArtifacts.validZipArchive("@example/acme-tools", "1.2.3"));

        byte[] first = canonicalOf(source);
        byte[] second = canonicalOf(source);
        byte[] third = canonicalOf(source);

        // 同一份上传两次必须落到同一个 SHA-256：否则 CAS 会出现两行"同版本不同 hash"的重复制品。
        assertThat(sha256(second)).isEqualTo(sha256(first));
        assertThat(sha256(third)).isEqualTo(sha256(first));
        assertThat(second).isEqualTo(first);
    }

    @Test
    void convertsFlatZipByPrefixingNpmRoot() throws Exception {
        byte[] flat = zipOf(Map.of("package.json", "{}".getBytes(StandardCharsets.UTF_8)));

        assertThat(entryNames(canonicalOf(write("flat.zip", flat))))
            .containsExactly("package/package.json");
    }

    @Test
    void preservesZipSymlinkAsTarSymlinkInsteadOfSilentlyInliningIt() throws Exception {
        byte[] link = zipWithSymlink("package/link", "/etc/passwd");

        byte[] canonical = canonicalOf(write("link.zip", link));

        // 链接不是"内容问题"而是"类型问题"：归一化器不替 inspector 做裁决，只保证不把它降级成普通文件。
        try (TarArchiveInputStream tar = tarOf(canonical)) {
            TarArchiveEntry entry = tar.getNextEntry();
            assertThat(entry.getName()).isEqualTo("package/link");
            assertThat(entry.isSymbolicLink()).isTrue();
            assertThat(entry.getLinkName()).isEqualTo("/etc/passwd");
        }
    }

    @Test
    void rejectsEscapingAndMalformedNames() throws Exception {
        assertThatThrownBy(() -> canonicalOf(
            write("slip.zip", zipOf(Map.of("../evil.js", "x".getBytes(StandardCharsets.UTF_8))))
        )).isInstanceOf(PluginArtifactException.class).hasMessage("归档路径包含逃逸段");

        assertThatThrownBy(() -> canonicalOf(
            write("absolute.zip", zipOf(Map.of("/etc/passwd", "x".getBytes(StandardCharsets.UTF_8))))
        )).isInstanceOf(PluginArtifactException.class).hasMessage("归档路径非法");

        // 反斜杠只能用 tar 表达：ZipArchiveOutputStream 写盘时会把 '\\' 规整成 '/'，zip 夹具无法承载这个用例。
        assertThatThrownBy(() -> canonicalOf(
            write("backslash.tgz", tgzOf(Map.of("package\\evil.js", "x".getBytes(StandardCharsets.UTF_8))))
        )).isInstanceOf(PluginArtifactException.class).hasMessage("归档路径非法");

        assertThatThrownBy(() -> canonicalOf(
            write("dot-segment.tgz", tgzOf(Map.of("package/./evil.js", "x".getBytes(StandardCharsets.UTF_8))))
        )).isInstanceOf(PluginArtifactException.class).hasMessage("归档路径包含逃逸段");
    }

    @Test
    void rejectsArchivesThatAreNeitherGzipTarNorZip() throws Exception {
        Path junk = write("junk.bin", "definitely not an archive".getBytes(StandardCharsets.UTF_8));

        // 预扫描与重写都必须给出同一个稳定失败，不能一个静默放行、一个才报错。
        assertThatThrownBy(() -> normalizer.isCanonicalNpmTgz(junk))
            .isInstanceOf(PluginArtifactException.class)
            .hasMessage("归档既不是 gzip tar 也不是 zip");
        assertThatThrownBy(() -> canonicalOf(junk))
            .isInstanceOf(PluginArtifactException.class)
            .hasMessage("归档既不是 gzip tar 也不是 zip");
    }

    @Test
    void rejectsSpecialEntriesThatCannotBeLosslesslyReshaped() throws Exception {
        // TarArchiveEntry.isFile() 对 FIFO/设备/CONTIG 也返回 true，归一化器必须自己收紧，
        // 否则这些 entry 会被静默降级成普通文件，绕过 inspector 的类型裁决。
        assertThatThrownBy(() -> canonicalOf(write("fifo.tgz", tgzWithType("package/pipe", TarConstants.LF_FIFO))))
            .isInstanceOf(PluginArtifactException.class).hasMessage("归档包含无法重写的特殊 entry");
        assertThatThrownBy(() -> canonicalOf(write("chr.tgz", tgzWithType("package/dev", TarConstants.LF_CHR))))
            .isInstanceOf(PluginArtifactException.class).hasMessage("归档包含无法重写的特殊 entry");
        assertThatThrownBy(() -> canonicalOf(write("blk.tgz", tgzWithType("package/dev", TarConstants.LF_BLK))))
            .isInstanceOf(PluginArtifactException.class).hasMessage("归档包含无法重写的特殊 entry");
        assertThatThrownBy(() -> canonicalOf(write("contig.tgz", tgzWithType("package/c", TarConstants.LF_CONTIG))))
            .isInstanceOf(PluginArtifactException.class).hasMessage("归档包含无法重写的特殊 entry");
    }

    @Test
    void enforcesEntryCountAndExpandedSizeLimits() throws Exception {
        Map<String, byte[]> many = new LinkedHashMap<>();
        for (int index = 0; index < 10; index++) {
            many.put("file-" + index + ".txt", "x".getBytes(StandardCharsets.UTF_8));
        }
        Path manyZip = write("many.zip", zipOf(many));
        assertThatThrownBy(() -> canonicalWith(manyZip, MAX_EXPANDED_BYTES, 3))
            .isInstanceOf(PluginArtifactException.class).hasMessage("归档 entry 数超过上限");

        String payload = "x".repeat(4096);
        Path bigZip = write("big.zip", zipOf(Map.of("package/a.txt", payload.getBytes(StandardCharsets.UTF_8))));
        assertThatThrownBy(() -> canonicalWith(bigZip, 1024, MAX_ENTRIES))
            .isInstanceOf(PluginArtifactException.class).hasMessage("归档解压大小超过上限");
    }

    @Test
    void rejectsOversizedDeclaredSizeDuringCanonicalPreScan() throws Exception {
        // 预扫描若不设上限，一次 50MB 的 gzip 炸弹就能在验包之前把 CPU 烧在"只读 entry 头"上。
        Path source = write("bomb.tgz", PluginTestArtifacts.validArchive("@example/acme-tools", "1.2.3"));
        PluginArtifactNormalizer tiny = new PluginArtifactNormalizer(8, MAX_ENTRIES);

        assertThatThrownBy(() -> tiny.isCanonicalNpmTgz(source))
            .isInstanceOf(PluginArtifactException.class).hasMessage("归档解压大小超过上限");
    }

    @Test
    void exposesItsOwnExpandedLimitSoTheWriterCanReuseItAsAHardBound() {
        assertThat(normalizer.maxExpandedBytes()).isEqualTo(MAX_EXPANDED_BYTES);
        assertThatThrownBy(() -> new PluginArtifactNormalizer(0, 1))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("归档上限必须为正数");
        assertThatThrownBy(() -> new PluginArtifactNormalizer(1, 0))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("归档上限必须为正数");
    }

    // ============================ 测试夹具 ============================

    private static PluginArtifactInspector inspector() {
        return new PluginArtifactInspector(JSON, MAX_EXPANDED_BYTES, MAX_ENTRIES, PROTECTED_PACKAGE_FOR_TEST);
    }

    /** 归一化写到内存流：本测试只关心容器重排结果，落盘边界由 PluginArtifactStore 的测试覆盖。 */
    private byte[] canonicalOf(Path source) {
        return canonicalWith(source, MAX_EXPANDED_BYTES, MAX_ENTRIES);
    }

    private static byte[] canonicalWith(Path source, long maxExpandedBytes, int maxEntries) {
        ByteArrayOutputStream target = new ByteArrayOutputStream();
        new PluginArtifactNormalizer(maxExpandedBytes, maxEntries).writeCanonicalTgz(source, target);
        return target.toByteArray();
    }

    private Path write(String name, byte[] content) throws IOException {
        Path path = temporary.resolve(name);
        Files.write(path, content);
        return path;
    }

    private static byte[] zipOf(Map<String, byte[]> entries) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipArchiveOutputStream zip = new ZipArchiveOutputStream(output)) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                ZipArchiveEntry archiveEntry = new ZipArchiveEntry(entry.getKey());
                archiveEntry.setUnixMode(UnixStat.FILE_FLAG | 0644);
                archiveEntry.setSize(entry.getValue().length);
                zip.putArchiveEntry(archiveEntry);
                zip.write(entry.getValue());
                zip.closeArchiveEntry();
            }
        }
        return output.toByteArray();
    }

    private static byte[] zipWithSymlink(String name, String target) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipArchiveOutputStream zip = new ZipArchiveOutputStream(output)) {
            ZipArchiveEntry entry = new ZipArchiveEntry(name);
            entry.setUnixMode(UnixStat.LINK_FLAG | 0777);
            byte[] linkTarget = target.getBytes(StandardCharsets.UTF_8);
            entry.setSize(linkTarget.length);
            zip.putArchiveEntry(entry);
            zip.write(linkTarget);
            zip.closeArchiveEntry();
        }
        return output.toByteArray();
    }

    /** tar 夹具：zip 写盘会规整名字与类型位，只有 tar 能精确表达反斜杠与 FIFO 这类边角 entry。 */
    private static byte[] tgzOf(Map<String, byte[]> entries) throws IOException {
        return tgzOfType(entries, TarConstants.LF_NORMAL);
    }

    private static byte[] tgzWithType(String name, byte type) throws IOException {
        return tgzOfType(Map.of(name, new byte[0]), type);
    }

    private static byte[] tgzOfType(Map<String, byte[]> entries, byte type) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (GzipCompressorOutputStream gzip = new GzipCompressorOutputStream(output);
             TarArchiveOutputStream tar = new TarArchiveOutputStream(gzip)) {
            tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                TarArchiveEntry archiveEntry = new TarArchiveEntry(entry.getKey(), type);
                archiveEntry.setSize(entry.getValue().length);
                archiveEntry.setModTime(0L);
                tar.putArchiveEntry(archiveEntry);
                tar.write(entry.getValue());
                tar.closeArchiveEntry();
            }
        }
        return output.toByteArray();
    }

    private static List<String> entryNames(byte[] tgz) throws IOException {
        List<String> names = new ArrayList<>();
        try (TarArchiveInputStream tar = tarOf(tgz)) {
            TarArchiveEntry entry;
            while ((entry = tar.getNextEntry()) != null) names.add(entry.getName());
        }
        return names;
    }

    private static TarArchiveInputStream tarOf(byte[] tgz) throws IOException {
        return new TarArchiveInputStream(
            new GzipCompressorInputStream(new ByteArrayInputStream(tgz))
        );
    }

    private static String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }
}
