/**
 * [INPUT]: 依赖 Jackson JsonMapper、不可信 .dshpreset ZIP 字节流与 domain 引用值对象。
 * [OUTPUT]: 锁定 manifest 必填字段、顶层未知键的忽略、dependencies 形状/未知键拒绝、路径逃逸与 agent.cordis.yml 存在性。
 * [POS]: preset/artifact 的单元验收，不依赖 PostgreSQL。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.artifact;

import com.owndsh.enterprise.preset.domain.PresetDependency;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class PresetArtifactInspectorTest {
    private final PresetArtifactInspector inspector =
        new PresetArtifactInspector(JsonMapper.builder().build(), 1_048_576L, 64);

    @TempDir
    Path temp;

    @Test
    void acceptsMinimalValidPackage() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", """
                {"format":"dsh-preset","version":"1","id":"weekly-digest","name":"周报","description":"demo","sourceDshVersion":"0.1.0-rc.7"}
                """.getBytes(StandardCharsets.UTF_8),
            "preset/agent.cordis.yml", "name: weekly\n".getBytes(StandardCharsets.UTF_8)
        ));
        PresetArtifactInspector.InspectedPreset inspected = inspector.inspect(archive);
        assertEquals("weekly-digest", inspected.presetId());
        assertEquals("周报", inspected.displayName());
        assertEquals("0.1.0-rc.7", inspected.sourceDshVersion());
        assertEquals("demo", inspected.description());
    }

    @Test
    void rejectsMissingAgentComposition() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", """
                {"format":"dsh-preset","version":"1","id":"a","name":"A","sourceDshVersion":"0.1.0"}
                """.getBytes(StandardCharsets.UTF_8)
        ));
        PresetArtifactException exception = assertThrows(
            PresetArtifactException.class, () -> inspector.inspect(archive)
        );
        assertEquals("ENT_PRESET_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("agent.cordis"));
    }

    @Test
    void rejectsParentTraversal() throws Exception {
        Path archive = writeZip(Map.of("../escape.txt", new byte[]{1}));
        PresetArtifactException exception = assertThrows(
            PresetArtifactException.class, () -> inspector.inspect(archive)
        );
        assertEquals("ENT_PRESET_INVALID_PACKAGE", exception.errorCode());
    }

    @Test
    void rejectsUnsupportedFormat() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", """
                {"format":"other","version":"1","id":"a","name":"A","sourceDshVersion":"0.1.0"}
                """.getBytes(StandardCharsets.UTF_8),
            "preset/agent.cordis.yml", "x: 1\n".getBytes(StandardCharsets.UTF_8)
        ));
        PresetArtifactException exception = assertThrows(
            PresetArtifactException.class, () -> inspector.inspect(archive)
        );
        assertEquals("ENT_PRESET_INVALID_PACKAGE", exception.errorCode());
    }

    @Test
    void readsDependenciesFromManifest() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", """
                {"format":"dsh-preset","version":"1","id":"weekly-digest","name":"周报","sourceDshVersion":"0.1.0",
                 "dependencies":[
                   {"kind":"skill","id":"expense-reimbursement","mode":"pinned","versionId":"1901500000000000902","required":true},
                   {"kind":"plugin","id":"@deepseek-ai/dsh-agent-preset","mode":"latest","required":false}
                 ]}
                """.getBytes(StandardCharsets.UTF_8),
            "preset/agent.cordis.yml", "name: weekly\n".getBytes(StandardCharsets.UTF_8)
        ));
        List<PresetDependency> dependencies = inspector.inspect(archive).dependencies();
        assertEquals(2, dependencies.size());
        assertEquals(new PresetDependency(
            "skill", "expense-reimbursement", "pinned", "1901500000000000902", true
        ), dependencies.getFirst());
        assertEquals(new PresetDependency(
            "plugin", "@deepseek-ai/dsh-agent-preset", "latest", null, false
        ), dependencies.getLast());
    }

    /** 没有 dependencies 键 = 没有引用（既有包一律如此）。 */
    @Test
    void treatsMissingDependenciesAsEmpty() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", """
                {"format":"dsh-preset","version":"1","id":"a","name":"A","sourceDshVersion":"0.1.0"}
                """.getBytes(StandardCharsets.UTF_8),
            "preset/agent.cordis.yml", "x: 1\n".getBytes(StandardCharsets.UTF_8)
        ));
        assertTrue(inspector.inspect(archive).dependencies().isEmpty());
    }

    /**
     * 顶层未知键必须继续被忽略（向后兼容：manifest 会有别的工具写的扩展键）。
     * 这是 §H S2 要求的"只读已知键、不 reject 未知键"行为锁。
     */
    @Test
    void ignoresUnknownTopLevelManifestKeys() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", """
                {"format":"dsh-preset","version":"1","id":"a","name":"A","sourceDshVersion":"0.1.0",
                 "vendor":{"owner":"platform"},"dependencies":[]}
                """.getBytes(StandardCharsets.UTF_8),
            "preset/agent.cordis.yml", "x: 1\n".getBytes(StandardCharsets.UTF_8)
        ));
        PresetArtifactInspector.InspectedPreset inspected = inspector.inspect(archive);
        assertEquals("a", inspected.presetId());
        assertTrue(inspected.dependencies().isEmpty());
    }

    /** 元素级未知键必须拒包：`requierd` 这类拼错静默降级会把必填引用变成可选引用。 */
    @Test
    void rejectsUnknownDependencyKeys() throws Exception {
        assertRejectsDependencies("""
            [{"kind":"skill","id":"a","mode":"latest","requierd":true}]
            """, "未知键");
    }

    /** resolvedVersionId 是服务端字段，manifest 不得声明（显式拒绝，不静默丢弃）。 */
    @Test
    void rejectsServerOwnedResolvedVersionId() throws Exception {
        assertRejectsDependencies("""
            [{"kind":"skill","id":"a","mode":"pinned","versionId":"1901","required":true,"resolvedVersionId":"1902"}]
            """, "resolvedVersionId");
    }

    @Test
    void rejectsPinnedDependencyWithoutVersionId() throws Exception {
        assertRejectsDependencies("""
            [{"kind":"skill","id":"a","mode":"pinned","required":true}]
            """, "versionId");
    }

    @Test
    void rejectsLatestDependencyCarryingVersionId() throws Exception {
        assertRejectsDependencies("""
            [{"kind":"skill","id":"a","mode":"latest","versionId":"1901","required":false}]
            """, "versionId");
    }

    @Test
    void rejectsUnknownDependencyKind() throws Exception {
        assertRejectsDependencies("""
            [{"kind":"connector","id":"a","mode":"latest","required":true}]
            """, "类型不支持");
    }

    @Test
    void rejectsNonBooleanRequired() throws Exception {
        assertRejectsDependencies("""
            [{"kind":"skill","id":"a","mode":"latest","required":"true"}]
            """, "布尔");
    }

    @Test
    void rejectsDuplicateDependency() throws Exception {
        assertRejectsDependencies("""
            [{"kind":"skill","id":"a","mode":"latest","required":false},
             {"kind":"skill","id":"a","mode":"pinned","versionId":"1901","required":true}]
            """, "重复");
    }

    @Test
    void rejectsDependenciesThatAreNotAnArray() throws Exception {
        assertRejectsDependencies("""
            {"kind":"skill"}
            """, "数组");
    }

    private void assertRejectsDependencies(String dependencies, String expectedFragment) throws IOException {
        Path archive = writeZip(Map.of(
            "manifest.json", ("""
                {"format":"dsh-preset","version":"1","id":"a","name":"A","sourceDshVersion":"0.1.0",
                 "dependencies":%s}
                """.formatted(dependencies)).getBytes(StandardCharsets.UTF_8),
            "preset/agent.cordis.yml", "x: 1\n".getBytes(StandardCharsets.UTF_8)
        ));
        PresetArtifactException exception = assertThrows(
            PresetArtifactException.class, () -> inspector.inspect(archive)
        );
        assertEquals("ENT_PRESET_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains(expectedFragment), exception.getMessage());
    }

    private Path writeZip(Map<String, byte[]> entries) throws IOException {
        Path archive = temp.resolve("package-" + System.nanoTime() + ".dshpreset");
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(archive))) {
            for (Map.Entry<String, byte[]> entry : new LinkedHashMap<>(entries).entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue());
                zip.closeEntry();
            }
        }
        return archive;
    }
}
