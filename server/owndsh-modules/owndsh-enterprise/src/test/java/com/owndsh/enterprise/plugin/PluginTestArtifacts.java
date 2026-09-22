/**
 * [INPUT]: 依赖 Commons Compress 的 tar/gzip 与 zip 写入能力，以及冻结的 Harness rc.7 peer 版本。
 * [OUTPUT]: 为插件服务测试提供确定性的合法预构建 pnpm tgz/zip 字节（含 GitHub 风格包装目录变体），以及形态合法且非产品锁定的 Harness commit 常量。
 * [POS]: plugin 测试夹具边界，集中表达可被真实 inspector 接受的最小制品格式，也是 tgz 与 zip 两种上传形态的唯一构造点。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.archivers.zip.UnixStat;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveOutputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

final class PluginTestArtifacts {
    private PluginTestArtifacts() {
    }

    /**
     * 测试用 Harness commit：取客户端 plugin bundle 在 Harness 0.1.5-rc.2 上真实声明的 gitlink。
     * 刻意不复用生产常量——生产已不再锁定单一 commit，这里只需要一个形态合法且非空的值。
     */
    static final String HARNESS_COMMIT = "fb2c4b9e698e30edb738bca4cf0618587db7d203";

    static byte[] validArchive(String packageName, String version) throws Exception {
        return tgz("", packageName, version);
    }

    /** 带顶层包装目录的 tgz，对应 npm pack 之外的"先解出一层目录"的归档形态。 */
    static byte[] wrappedTgzArchive(String wrapper, String packageName, String version) throws Exception {
        return tgz(wrapper, packageName, version);
    }

    /** npm 布局（package/ 前缀）的 zip：GitHub 发布包最常见的直接可用形态。 */
    static byte[] validZipArchive(String packageName, String version) throws Exception {
        return zip("", packageName, version);
    }

    /** 带顶层包装目录的 zip，对应 GitHub "Source code" 自动生成的 `<repo>-<tag>/` 布局。 */
    static byte[] wrappedZipArchive(String wrapper, String packageName, String version) throws Exception {
        return zip(wrapper, packageName, version);
    }

    private static byte[] tgz(String wrapper, String packageName, String version) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (GzipCompressorOutputStream gzip = new GzipCompressorOutputStream(output);
             TarArchiveOutputStream tar = new TarArchiveOutputStream(gzip)) {
            tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);
            for (Map.Entry<String, byte[]> entry : payload(wrapper, packageName, version).entrySet()) {
                TarArchiveEntry archiveEntry = new TarArchiveEntry(entry.getKey());
                archiveEntry.setSize(entry.getValue().length);
                archiveEntry.setModTime(0L);
                tar.putArchiveEntry(archiveEntry);
                tar.write(entry.getValue());
                tar.closeArchiveEntry();
            }
        }
        return output.toByteArray();
    }

    private static byte[] zip(String wrapper, String packageName, String version) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipArchiveOutputStream zip = new ZipArchiveOutputStream(output)) {
            for (Map.Entry<String, byte[]> entry : payload(wrapper, packageName, version).entrySet()) {
                ZipArchiveEntry archiveEntry = new ZipArchiveEntry(entry.getKey());
                // 显式写 Unix 权限位：DOS 风格中央目录会让归一化器走"无类型信息"分支，覆盖不到常规路径。
                archiveEntry.setUnixMode(UnixStat.FILE_FLAG | 0644);
                archiveEntry.setSize(entry.getValue().length);
                zip.putArchiveEntry(archiveEntry);
                zip.write(entry.getValue());
                zip.closeArchiveEntry();
            }
        }
        return output.toByteArray();
    }

    /**
     * 同一份内容同时服务 tgz 与 zip 构造：两条路径若各写一份 payload，格式差异就会掩盖内容差异。
     *
     * @param wrapper 顶层包装目录名；空串表示直接落在 npm 要求的 `package/` 根下
     */
    private static Map<String, byte[]> payload(String wrapper, String packageName, String version) {
        String prefix = wrapper.isEmpty() ? "package/" : wrapper + "/";
        Map<String, byte[]> entries = new LinkedHashMap<>();
        entries.put(prefix + "package.json", packageJson(packageName, version).getBytes(StandardCharsets.UTF_8));
        entries.put(prefix + "cordis.patch.yml", "- id: test\n".getBytes(StandardCharsets.UTF_8));
        entries.put(prefix + "lib/index.js", "export const value = 1\n".getBytes(StandardCharsets.UTF_8));
        return entries;
    }

    private static String packageJson(String packageName, String version) {
        return """
            {
              "name":"%s",
              "displayName":"T13 Test Plugin",
              "version":"%s",
              "type":"module",
              "dsh":{"bundle":{"patch":"./cordis.patch.yml"}},
              "scripts":{},
              "dependencies":{},
              "peerDependencies":{"@deepseek-ai/dsh-llm":"0.1.0-rc.7"}
            }
            """.formatted(packageName, version);
    }
}
