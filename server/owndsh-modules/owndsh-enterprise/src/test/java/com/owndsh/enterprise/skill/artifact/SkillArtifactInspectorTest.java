/**
 * [INPUT]: 依赖 Jackson JsonMapper、SnakeYAML frontmatter 解析与不可信 .dshskill ZIP 字节流。
 * [OUTPUT]: 锁定 manifest 必填字段与可选 category 口径（缺失/null/空串归一为 null、超长与纯空白拒绝）、路径逃逸拒绝、SKILL.md frontmatter 必填与调用策略、旧字段拒收与包内重名拒绝；另锁定 skills/<name>/ 下资源文件的接受边界（接受但**不解析**、不占技能条目上限、不适用 manifest/SKILL.md 的逐条目字节上限、只计入解压总量与 entry 数）。
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

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
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

    /** 最近一次 {@link #writeZip} 写入的条目（按写入顺序），供断言归档里确实原样带上了资源文件。 */
    private Map<String, byte[]> lastEntries = Map.of();

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

    /** manifest 声明 category 时必须原样透传到已验包结果（不 trim、不改写）。 */
    @Test
    void projectsDeclaredCategoryFromManifest() throws Exception {
        assertEquals("办公效率", inspector.inspect(archiveWithCategory("\"办公效率\"", "cat-declared")).category());
    }

    /** 缺席、JSON null 与空串都表示"没有分类"：统一归一为 null，服务端绝不透出空串。 */
    @Test
    void treatsAbsentNullAndEmptyCategoryAsNoCategory() throws Exception {
        assertNull(inspector.inspect(archiveWithCategory(null, "cat-absent")).category());
        assertNull(inspector.inspect(archiveWithCategory("null", "cat-null")).category());
        assertNull(inspector.inspect(archiveWithCategory("\"\"", "cat-empty")).category());
    }

    /** 超过 32 字符是无效声明，整包拒绝而不是静默截断（契约 maxLength 32）。 */
    @Test
    void rejectsCategoryLongerThanThirtyTwoCharacters() throws Exception {
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(archiveWithCategory("\"" + "x".repeat(33) + "\"", "cat-too-long"))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("category"));
    }

    /** 32 字符是闭区间上界，必须仍然接受。 */
    @Test
    void acceptsCategoryOfExactlyThirtyTwoCharacters() throws Exception {
        String value = "x".repeat(32);
        assertEquals(
            value,
            inspector.inspect(archiveWithCategory("\"" + value + "\"", "cat-boundary")).category()
        );
    }

    /** 非空纯空白是非法声明：拒绝而不是静默归一为 null，避免"提交了分类却看不到标签"的静默分歧。 */
    @Test
    void rejectsBlankCategoryInsteadOfSilentlyNormalizingIt() throws Exception {
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(archiveWithCategory("\"   \"", "cat-blank"))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("纯空白"));
    }

    /** category 与其余 manifest 字段同口径：必须是 JSON 字符串，数字/对象一律拒绝。 */
    @Test
    void rejectsNonStringCategory() throws Exception {
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(archiveWithCategory("123", "cat-number"))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("category"));
    }

    /**
     * `skills/<name>/` 下的资源文件被**接受**，但**只有恰好 3 段且末段为 `SKILL.md` 的条目**才被解析。
     *
     * <p>判据：`SkillArtifactInspector.java:118-120`（`isSkillFile` 要求 `segments.length == 3`）
     * 与 `:84`（只有 manifest 与 SKILL.md 才建捕获缓冲）；资源文件在 `:90` 处 `capture == null`，
     * 既不做字节上限比较也不进 `skillFiles`。技能条目数 = 1（`skills/<name>/SKILL.md`）。</p>
     */
    @Test
    void acceptsResourceFilesUnderSkillDirectoryWithoutParsingThem() throws Exception {
        SkillArtifactInspector.InspectedSkillPackage inspected = inspector.inspect(writeZip(Map.of(
            "manifest.json", manifest("res", "资源包", "0.1.7-rc.2"),
            "skills/res/SKILL.md", skill("res", "Use when testing.").getBytes(StandardCharsets.UTF_8),
            "skills/res/references/notes.md", "# 资源正文\n".getBytes(StandardCharsets.UTF_8),
            "skills/res/scripts/run.py", "print('hi')\n".getBytes(StandardCharsets.UTF_8),
            "skills/res/LICENSE.txt", "MIT\n".getBytes(StandardCharsets.UTF_8)
        )));

        assertEquals(1, inspected.skills().size());
        assertEquals("res", inspected.skills().getFirst().name());
    }

    /**
     * 资源文件**不是**技能条目：没有 `SKILL.md` 时整包仍被拒，把资源当成技能条目会在这里露馅。
     *
     * <p>判据：`SkillArtifactInspector.java:118-120` + `:114`（`skillFiles.isEmpty()` ⇒ 拒绝）。</p>
     */
    @Test
    void rejectsPackageWithOnlyResourceFilesAndNoSkillMarkdown() throws Exception {
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of(
                "manifest.json", manifest("res-only", "只有资源", "0.1.7-rc.2"),
                "skills/res-only/references/notes.md", "# 资源正文\n".getBytes(StandardCharsets.UTF_8)
            )))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("SKILL.md"));
    }

    /**
     * 资源文件**不**受 `SKILL.md` 的 256 KiB 逐条目上限约束：300 KiB 的 `references/` 被接受，
     * 且写进归档的字节数与输入**逐字节等长**（307 200，既没被截断也没被改写）。
     *
     * <p>判据：`SkillArtifactInspector.java:44`（常量）、`:85`（`limit` 按 isManifest 二选一）、
     * `:91-92`（比较只在 `capture != null` 分支内）；资源文件在 `:84`/`:90` 处不建捕获。</p>
     */
    @Test
    void acceptsResourceFileLargerThanSkillMarkdownLimitAndKeepsItVerbatim() throws Exception {
        byte[] oversized = new byte[307_200];
        for (int index = 0; index < oversized.length; index++) oversized[index] = (byte) (index & 0x7f);

        SkillArtifactInspector.InspectedSkillPackage inspected = inspector.inspect(writeZip(Map.of(
            "manifest.json", manifest("big-res", "大资源", "0.1.7-rc.2"),
            "skills/big-res/SKILL.md", skill("big-res", "Use when testing.").getBytes(StandardCharsets.UTF_8),
            "skills/big-res/references/big.md", oversized
        )));

        assertEquals(1, inspected.skills().size());
        assertArrayEquals(oversized, lastEntries.get("skills/big-res/references/big.md"));
    }

    /**
     * 资源文件**本身**不做任何格式解析：`references/*.md` 里那份会被 `SKILL.md` 拒绝的无 frontmatter 正文出现在包里也照样接受。
     *
     * <p>判据：`SkillArtifactInspector.java:162-163` 只遍历 `skillFiles`，其内容由 `:118-120` 决定。</p>
     */
    @Test
    void doesNotParseResourceFileContentAsSkillMarkdown() throws Exception {
        SkillArtifactInspector.InspectedSkillPackage inspected = inspector.inspect(writeZip(Map.of(
            "manifest.json", manifest("raw-res", "裸资源", "0.1.7-rc.2"),
            "skills/raw-res/SKILL.md", skill("raw-res", "Use when testing.").getBytes(StandardCharsets.UTF_8),
            "skills/raw-res/references/raw.md", "# no frontmatter\n".getBytes(StandardCharsets.UTF_8),
            "skills/raw-res/references/binary.bin", new byte[]{0, 1, 2, 3, 0x7f}
        )));

        assertEquals(1, inspected.skills().size());
        assertEquals("raw-res", inspected.skills().getFirst().name());
    }

    /**
     * 深度 ≤ 3 的 `skills/<name>/LICENSE.txt` 被接受（只按 `skills/` 前缀裁决），与**包根**的 `LICENSE.txt` 相反。
     *
     * <p>判据：`SkillArtifactInspector.java:134`（只放行根 `manifest.json`、`skills/` 前缀与裸 `skills`）；
     * 根级反例见 {@link #rejectsRootLevelLicenseAndReadme()}。</p>
     */
    @Test
    void acceptsSkillsScopedLicenseAndReadme() throws Exception {
        SkillArtifactInspector.InspectedSkillPackage inspected = inspector.inspect(writeZip(Map.of(
            "manifest.json", manifest("lic", "授权包", "0.1.7-rc.2"),
            "skills/lic/SKILL.md", skill("lic", "Use when testing.").getBytes(StandardCharsets.UTF_8),
            "skills/lic/LICENSE.txt", "MIT\n".getBytes(StandardCharsets.UTF_8),
            "skills/lic/README.md", "# 说明\n".getBytes(StandardCharsets.UTF_8)
        )));

        assertEquals(1, inspected.skills().size());
    }

    /**
     * 反例：**包根**的 `LICENSE.txt` / `README.md` 被拒 —— 根位置只认 `manifest.json`。
     *
     * <p>判据：`SkillArtifactInspector.java:134-135`（`!"manifest.json".equals(name) && !name.startsWith("skills/")
     * && !"skills".equals(name)` ⇒ `归档路径必须位于根或 skills/ 下`）。</p>
     */
    @Test
    void rejectsRootLevelLicenseAndReadme() throws Exception {
        SkillArtifactException license = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of(
                "manifest.json", manifest("root-lic", "根授权", "0.1.7-rc.2"),
                "skills/root-lic/SKILL.md", skill("root-lic", "Use when testing.").getBytes(StandardCharsets.UTF_8),
                "LICENSE.txt", "MIT\n".getBytes(StandardCharsets.UTF_8)
            )))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", license.errorCode());
        assertTrue(license.getMessage().contains("根或 skills/"));

        SkillArtifactException readme = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of(
                "manifest.json", manifest("root-readme", "根说明", "0.1.7-rc.2"),
                "skills/root-readme/SKILL.md", skill("root-readme", "Use when testing.").getBytes(StandardCharsets.UTF_8),
                "README.md", "# 说明\n".getBytes(StandardCharsets.UTF_8)
            )))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", readme.errorCode());
        assertTrue(readme.getMessage().contains("根或 skills/"));
    }

    /**
     * 裸 `skills` 条目不是路径走私：非空包接受它、零技能包仍以 `SKILL.md` 缺失被拒。
     *
     * <p>判据：`SkillArtifactInspector.java:134` 的 `!"skills".equals(name)` 放行分支；`isSkillFile`
     * 对 1 段名返回 false（`:119-120`）。</p>
     */
    @Test
    void toleratesBareSkillsDirectoryEntry() throws Exception {
        SkillArtifactInspector.InspectedSkillPackage inspected = inspector.inspect(writeZip(Map.of(
            "manifest.json", manifest("bare", "裸目录", "0.1.7-rc.2"),
            "skills", new byte[0],
            "skills/bare/SKILL.md", skill("bare", "Use when testing.").getBytes(StandardCharsets.UTF_8)
        )));
        assertEquals(1, inspected.skills().size());
        assertEquals("bare", inspected.skills().getFirst().name());

        SkillArtifactException empty = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of(
                "manifest.json", manifest("bare-empty", "裸目录空包", "0.1.7-rc.2"),
                "skills", new byte[0]
            )))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", empty.errorCode());
        assertTrue(empty.getMessage().contains("SKILL.md"));
    }

    /**
     * `skills/<name>/references/` 这类**显式目录条目**被接受且不产生任何解析：技能条目仍只有 1 个。
     *
     * <p>判据：`SkillArtifactInspector.java:118-120`（3 段判定只命中 `SKILL.md`）+ `:84`（目录条目 `capture == null`）。</p>
     */
    @Test
    void acceptsExplicitResourceDirectoryEntries() throws Exception {
        SkillArtifactInspector.InspectedSkillPackage inspected = inspector.inspect(writeZip(Map.of(
            "manifest.json", manifest("dirs", "目录项", "0.1.7-rc.2"),
            "skills/", new byte[0],
            "skills/dirs/", new byte[0],
            "skills/dirs/references/", new byte[0],
            "skills/dirs/SKILL.md", skill("dirs", "Use when testing.").getBytes(StandardCharsets.UTF_8),
            "skills/dirs/references/notes.md", "# 说明\n".getBytes(StandardCharsets.UTF_8)
        )));

        assertEquals(1, inspected.skills().size());
        assertEquals("dirs", inspected.skills().getFirst().name());
    }

    /** 256 KiB 是闭区间上界：恰好 262 144 字节的 SKILL.md 必须仍然接受。 */
    @Test
    void acceptsSkillMarkdownOfExactlyTheByteLimit() throws Exception {
        SkillArtifactInspector.InspectedSkillPackage inspected = inspector.inspect(writeZip(Map.of(
            "manifest.json", manifest("bound", "边界", "0.1.7-rc.2"),
            "skills/bound/SKILL.md", skillMarkdownOfSize(262_144)
        )));

        assertEquals("bound", inspected.skills().getFirst().name());
    }

    /** 越界一个字节即拒：256 KiB 逐条目上限只压在 `SKILL.md` 上（资源文件对照见超大资源用例）。 */
    @Test
    void rejectsSkillMarkdownOneByteOverTheLimit() throws Exception {
        SkillArtifactException exception = assertThrows(
            SkillArtifactException.class,
            () -> inspector.inspect(writeZip(Map.of(
                "manifest.json", manifest("over", "越界", "0.1.7-rc.2"),
                "skills/over/SKILL.md", skillMarkdownOfSize(262_145)
            )))
        );
        assertEquals("ENT_SKILL_INVALID_PACKAGE", exception.errorCode());
        assertTrue(exception.getMessage().contains("SKILL.md 过大"));
    }

    private Path archiveWithCategory(String categoryJson, String skillId) throws IOException {
        return writeZip(Map.of(
            "manifest.json", manifest(skillId, "分类测试", "0.1.7-rc.2", categoryJson),
            "skills/" + skillId + "/SKILL.md", skill(skillId, "Use when testing.").getBytes(StandardCharsets.UTF_8)
        ));
    }

    /**
     * 构造**恰好** totalBytes 字节的合法 SKILL.md（frontmatter 有效，正文用 62 字节的注释行补齐，
     * 余数落在最后一行），不做"近似"断言。
     *
     * <p>行宽必须与正文行**实际**字节数（`"# "` + 59 个 `a` + `\n` = 62）一致：早先按 63 计算，
     * 每行少 1 字节，使本方法静默少造 `fullLines` 字节（`262_144` 只造出 `257_984`），
     * 导致"恰好上界/越界 1 字节"两条用例根本没压到边界。末尾的 `assertEquals` 是不变量断言，
     * 任何宽度与实际不符都会立刻失败，而不是静默造出偏小的包。
     *
     * <p>`tail` 可能落在 1..2（小于短行的最小 3 字节），此时不能再套 `"# " + repeat(tail - 3)`
     * （会得到负的重复次数），故对 `tail ∈ {0,1,2}` 显式补齐。
     */
    private static byte[] skillMarkdownOfSize(int totalBytes) {
        String frontmatter = """
            ---
            name: bound
            description: Use when testing.
            ---
            """;
        int remaining = totalBytes - frontmatter.length();
        int fullLines = remaining / 62;
        int tail = remaining % 62;
        String body = ("# " + "a".repeat(59) + "\n").repeat(fullLines);
        String padding = switch (tail) {
            case 0 -> "";
            case 1 -> "\n";
            case 2 -> "b\n";
            default -> "# " + "b".repeat(tail - 3) + "\n";
        };
        byte[] bytes = (frontmatter + body + padding).getBytes(StandardCharsets.UTF_8);
        assertEquals(totalBytes, bytes.length);
        return bytes;
    }

    private static SkillEntry entry(List<SkillEntry> skills, String name) {
        return skills.stream().filter(value -> value.name().equals(name)).findFirst().orElseThrow();
    }

    private static byte[] manifest(String id, String name, String sourceDshVersion) {
        return manifest(id, name, sourceDshVersion, null);
    }

    /** categoryJson 为 null 表示 manifest 完全不声明 category，否则原样插入 JSON 值（便于构造 null/数字/空白等负例）。 */
    private static byte[] manifest(String id, String name, String sourceDshVersion, String categoryJson) {
        String category = categoryJson == null ? "" : ",\"category\":" + categoryJson;
        return ("""
            {"format":"dsh-skill","version":"1","id":"%s","name":"%s","description":"demo","sourceDshVersion":"%s"%s}
            """.formatted(id, name, sourceDshVersion, category)).getBytes(StandardCharsets.UTF_8);
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
        lastEntries = new LinkedHashMap<>(entries);
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(archive))) {
            for (Map.Entry<String, byte[]> entry : lastEntries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue());
                zip.closeEntry();
            }
        }
        return archive;
    }
}
