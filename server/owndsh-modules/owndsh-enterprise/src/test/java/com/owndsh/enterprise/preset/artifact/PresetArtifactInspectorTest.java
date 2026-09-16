/**
 * [INPUT]: 依赖 Jackson JsonMapper 与不可信 .dshpreset ZIP 字节流。
 * [OUTPUT]: 锁定 manifest 必填字段、路径逃逸拒绝与 agent.cordis.yml 存在性校验。
 * [POS]: preset/artifact 的单元验收，不依赖 PostgreSQL。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.artifact;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
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
