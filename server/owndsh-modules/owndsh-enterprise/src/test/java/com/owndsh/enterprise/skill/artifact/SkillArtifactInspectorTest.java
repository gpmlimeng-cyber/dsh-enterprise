/**
 * [INPUT]: 依赖 Jackson JsonMapper、SnakeYAML frontmatter 解析与不可信 .dshskill ZIP 字节流。
 * [OUTPUT]: 锁定 manifest 必填字段、路径逃逸拒绝、SKILL.md frontmatter 必填与调用策略、旧字段拒收与包内重名拒绝。
 * [POS]: skill/artifact 的单元验收，不依赖 PostgreSQL 与容器。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.artifact;

import com.owndsh.enterprise.skill.domain.SkillEntry;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class SkillArtifactInspectorTest {
    private final SkillArtifactInspector inspector =
        new SkillArtifactInspector(JsonMapper.builder().build(), 1_048_576L, 64);

    @TempDir
    Path temp;

    @Test
    void acceptsMultiSkillPackageAndProjectsInvocationPolicy() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", manifest("meeting-notes", "会议纪要", "0.1.7-rc.2"),
            "skills/meeting-notes/SKILL.md", """
                ---
                name: meeting-notes
                description: Use when summarizing meeting transcripts into structured notes.
                whenToUse: Use for meeting minutes.
                ---

                # Meeting notes
                """.getBytes(StandardCharsets.UTF_8),
            "skills/meeting-actions/SKILL.md", """
                ---
                name: meeting-actions
                description: Use when turning decisions into tracked action items.
                disable-model-invocation: true
                user-invocable: false
                ---

                # Actions
                """.getBytes(StandardCharsets.UTF_8)
        ));

        SkillArtifactInspector.InspectedSkillPackage inspected = inspector.inspect(archive);

        assertEquals("meeting-notes", inspected.skillId());
        assertEquals("会议纪要", inspected.displayName());
        assertEquals("0.1.7-rc.2", inspected.sourceDshVersion());
        assertEquals(2, inspected.skills().size());

        // Map.of 不保证迭代顺序，故按名字取值断言，不依赖包内条目顺序。
        SkillEntry first = entry(inspected.skills(), "meeting-notes");
        assertEquals("Use for meeting minutes.", first.whenToUse());
        assertTrue(first.modelInvocable());
        assertTrue(first.userInvocable());

        SkillEntry second = entry(inspected.skills(), "meeting-actions");
        assertNull(second.whenToUse());
        assertFalse(second.modelInvocable());
        assertFalse(second.userInvocable());
    }

    @Test
    void rejectsPackageWithoutSkillMarkdown() throws Exception {
        Path archive = writeZip(Map.of("manifest.json", manifest("empty", "空包", "0.1.7-rc.2")));
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class, () -> inspector.inspect(archive)
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("SKILL.md"));
    }

    @Test
    void rejectsUnsupportedManifestFormat() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", """
                {"format":"dsh-preset","version":"1","id":"a","name":"A","sourceDshVersion":"0.1.7-rc.2"}
                """.getBytes(StandardCharsets.UTF_8),
            "skills/a/SKILL.md", skill("a", "Use when testing.").getBytes(StandardCharsets.UTF_8)
        ));
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class, () -> inspector.inspect(archive)
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("dsh-skill"));
    }

    @Test
    void rejectsParentTraversalAndEntriesOutsideSkillsSubtree() throws Exception {
        SkillArtifactException traversal = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of("../escape.txt", new byte[]{1})))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", traversal.errorCode());

        // 包内旁路目录（例如可执行落点）必须整包拒绝，而不是静默忽略。
        SkillArtifactException outside = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of(
                "manifest.json", manifest("a", "A", "0.1.7-rc.2"),
                "scripts/run.sh", "rm -rf /\n".getBytes(StandardCharsets.UTF_8)
            )))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", outside.errorCode());
    }

    @Test
    void rejectsNonKebabCaseSkillName() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", manifest("a", "A", "0.1.7-rc.2"),
            "skills/Bad_Name/SKILL.md", skill("Bad_Name", "Use when testing.").getBytes(StandardCharsets.UTF_8)
        ));
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class, () -> inspector.inspect(archive)
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("kebab-case"));
    }

    @Test
    void rejectsLegacyInvocationFieldsInsteadOfIgnoringThem() throws Exception {
        Path archive = writeZip(Map.of(
            "manifest.json", manifest("a", "A", "0.1.7-rc.2"),
            "skills/a/SKILL.md", """
                ---
                name: a
                description: Use when testing.
                modelInvocable: false
                ---
                """.getBytes(StandardCharsets.UTF_8)
        ));
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class, () -> inspector.inspect(archive)
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("disable-model-invocation"));
    }

    @Test
    void rejectsMissingFrontmatterAndDuplicateSkillNames() throws Exception {
        SkillArtifactException noFrontmatter = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of(
                "manifest.json", manifest("a", "A", "0.1.7-rc.2"),
                "skills/a/SKILL.md", "# no frontmatter\n".getBytes(StandardCharsets.UTF_8)
            )))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", noFrontmatter.errorCode());

        // 不同目录但 frontmatter 同名：注册表按名裁决，企业包必须在入库前就拒绝歧义。
        SkillArtifactException duplicate = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of(
                "manifest.json", manifest("a", "A", "0.1.7-rc.2"),
                "skills/a/SKILL.md", skill("same-name", "Use when testing.").getBytes(StandardCharsets.UTF_8),
                "skills/b/SKILL.md", skill("same-name", "Use when testing again.").getBytes(StandardCharsets.UTF_8)
            )))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", duplicate.errorCode());
        assertTrue(duplicate.getMessage().contains("重复"));
    }

    @Test
    void reportsTooLargeWhenEntryBudgetIsExceeded() throws Exception {
        SkillArtifactInspector tiny = new SkillArtifactInspector(JsonMapper.builder().build(), 1_048_576L, 1);
        Path archive = writeZip(Map.of(
            "manifest.json", manifest("a", "A", "0.1.7-rc.2"),
            "skills/a/SKILL.md", skill("a", "Use when testing.").getBytes(StandardCharsets.UTF_8)
        ));
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class, () -> tiny.inspect(archive)
        );
        assertEquals("ENT_SKILL_TOO_LARGE", exception.errorCode());
    }

    private static SkillEntry entry(List<SkillEntry> skills, String name) {
        return skills.stream().filter(value -> value.name().equals(name)).findFirst().orElseThrow();
    }

    private static byte[] manifest(String id, String name, String sourceDshVersion) {
        return ("""
            {"format":"dsh-skill","version":"1","id":"%s","name":"%s","description":"demo","sourceDshVersion":"%s"}
            """.formatted(id, name, sourceDshVersion)).getBytes(StandardCharsets.UTF_8);
    }

    private static String skill(String name, String description) {
        return """
            ---
            name: %s
            description: %s
            ---

            # Body
            """.formatted(name, description);
    }

    private Path writeZip(Map<String, byte[]> entries) throws IOException {
        Path archive = temp.resolve("package-" + System.nanoTime() + ".dshskill");
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
