/**
 * [INPUT]: 依赖 preset/skill/plugin 的 runtime views、**model/web 的 BootstrapView（bootstrap 那一套独立投影）**、
 *           common 的 EnterpriseResponse、audit 的 AuditAction 枚举，
 *           以及 contracts/generated 的机器可读真源（自包含 enterprise-openapi.json 的 components.schemas）。
 * [OUTPUT]: 断言每个 runtime 投影（**含 BootstrapResponse 整壳，故 bootstrap 的插件分配投影也在内**）
 *           **实际序列化发出的键集 ⊆ 契约声明键集**（多发一个未声明键即红）、
 *           两条插件分配投影（PluginViews.RuntimeAssignmentView 与 BootstrapView.PluginAssignment）键集逐字相同、
 *           DependencyView 在 versionId 为空时不得序列化出 null 键，并锁死审计 AuditAction 枚举与契约 enum 逐字一致。
 *           **新增：摊平后详情/摘要的键集漂移门禁**（详情键集 ⊇ 摘要键集且差集恰为约定扩展键）——
 *           契约那几处 detail 曾用 allOf 继承摘要，而 allOf + 各分支 additionalProperties:false 在严格语义下
 *           永不可满足、unevaluatedProperties 在 networknt 3.0.6 上实测也不跨分支传播，故已摊平；
 *           摊平废掉结构继承、换来「摘要键要人工同步两份」的代价，**本门禁就是那个代价的机器接管**。
 * [POS]: owndsh-enterprise 的 runtime 投影契约漂移门禁。三起已实证事故里这一类（服务端多发未声明字段
 *        downloadPath ⇒ 员工端关闭键集整条判 ENT_LOCAL_RESPONSE_INVALID、用户侧静默炸）今后在 CI 就被抓住，
 *        不再依赖"客户端手写假体恰好同形"的偶然。77cbb6c 那起"漏键无声"（description 只改了 PluginViews、
 *        bootstrap 那套逐字段投影漏了）的根因正是 BootstrapView 不在检查表里——故它现在是这张表的第一等公民。
 *        配套的员工端白名单门禁在 plugin/packages/ui/tests/preset-decode.spec.ts；两者共用同一份契约真源。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.contract;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.model.web.BootstrapView;
import com.owndsh.enterprise.plugin.domain.PluginCompatibility;
import com.owndsh.enterprise.plugin.web.PluginViews;
import com.owndsh.enterprise.preset.web.PresetViews;
import com.owndsh.enterprise.skill.web.SkillViews;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("T-runtime 投影契约漂移门禁")
@Tag("dev")
class RuntimeProjectionContractDriftTest {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();
    private static final Path CONTRACT_ROOT = findContractRoot();
    private static final JsonNode SCHEMAS = loadSchemas();

    /**
     * runtime 投影 view 实例 → 契约 schema 名。
     *
     * <p>这里刻意直接构造 **view record**（HTTP 序列化边界）而不是走 domain → view 的映射函数：
     * 决定"实际发出哪些键"的正是 view record 的组件名与 Jackson 注解，映射函数只是填值。
     * 新增一个 runtime 投影时在这里加一行，否则它不会被这道门禁覆盖。
     */
    private static Map<String, Object> runtimeProjections() {
        Map<String, Object> projections = new LinkedHashMap<>();
        projections.put("RuntimePresetSummary", presetSummaryView());
        projections.put("RuntimePresetDetail", presetDetailView());
        projections.put("RuntimeSkillSummary", skillSummaryView());
        projections.put("RuntimeSkillDetail", skillDetailView());
        projections.put("RuntimePluginAssignments", pluginAssignmentsView());
        // envelope 也一并钉住：契约把它声明成 {data, requestId}，多一个顶层键同样是漂移。
        projections.put(
            "RuntimePluginAssignmentsResponse",
            new EnterpriseResponse<>(pluginAssignmentsView(), "req_01ARZ3NDEKTSV4RRFFQ69G5FAV")
        );
        // ★ bootstrap 那一套**独立于 PluginViews 的**逐字段投影也进这张检查表（77cbb6c 事故：它不在表里
        // ⇒ description 漏键无声）。按**真实响应外壳**（{data, requestId}）交给门禁，于是递归会比较
        // BootstrapSnapshot → plugins → assignments → PluginAssignment 的每一层键，新增键漏改这里即红。
        projections.put(
            "BootstrapResponse",
            new EnterpriseResponse<>(bootstrapView(), "req_01ARZ3NDEKTSV4RRFFQ69G5FAV")
        );
        return projections;
    }

    /**
     * 门禁本体：递归断言每个 runtime 投影序列化出来的每个对象键都在契约同名 schema 的声明里。
     *
     * <p>只做 ⊆（"不能多"）—— 契约未声明的键一旦出现在响应里，员工端关闭键集就会把整条响应判
     * `ENT_LOCAL_RESPONSE_INVALID`（downloadPath 事故）。反向（契约声明了但没发出）由契约 fixture
     * 与员工端解码器自己的正例测试负责，这里重复会互相打架。
     *
     * <p>allOf 按**各分支声明键的并集**判定：契约里 `RuntimePresetDetail` 经 allOf 继承摘要字段，
     * 而两个分支各自写了 `additionalProperties: false`（严格 JSON Schema 语义下两分支互斥），
     * 两端生成物（Zod intersection / 员工端白名单）实际就是按并集消费的，门禁与它们保持同一口径。
     *
     * <p>★ 历史注记（该口径已随摊平失效，仅留作背景）：上面这条「并集口径」曾只在**门禁侧**成立——
     * 契约那几处 detail 的 allOf 在 Java 侧根本不可满足（详见
     * {@code flattenedDetailKeepsSummaryKeySetPlusFixedExtension}）。契约现已摊平为单一对象，
     * 所以 {@link #collectProperties} 的 allOf 分支对这几个 schema 已不再命中，但**保留**以兼容
     * 今后仍需按并集判定的 schema。
     */
    @Test
    @DisplayName("每个 runtime 投影实际发出的键集 ⊆ 契约声明键集（多发一个未声明键即失败）")
    void runtimeProjectionsEmitOnlyContractDeclaredKeys() {
        List<String> violations = new ArrayList<>();
        runtimeProjections().forEach((schemaName, view) -> {
            JsonNode emitted = JSON_MAPPER.valueToTree(view);
            collectUndeclaredKeys(emitted, schema(schemaName), schemaName, violations);
        });
        assertTrue(violations.isEmpty(), () -> "runtime 投影出现契约未声明的键：" + violations);
    }

    /**
     * 具体锁住上一次真实事故的相邻形态：`mode=latest` 的引用没有 versionId，
     * 而契约把它声明为**可选** string（fixture 里是"缺席"而不是 `null`）。
     */
    @Test
    @DisplayName("latest 引用不得序列化出 versionId:null（必须是缺席）")
    void latestDependencyOmitsNullVersionId() {
        JsonNode emitted = JSON_MAPPER.valueToTree(
            new PresetViews.DependencyView("skill", "code-review", "latest", null, true)
        );
        assertTrue(
            emitted.get("versionId") == null,
            () -> "latest 引用的 versionId 必须缺席而不是 null：" + emitted
        );
    }

    /**
     * 审计 action 枚举对齐门禁。
     *
     * <p><b>本刀只写测试、不修数据</b>：已知契约 `AuditAction` 是 35 项、服务端枚举是 46 项，
     * 服务端多 11 个 preset/skill action（PRESET_VERSION_UPLOADED / PRESET_VERSION_PUBLISHED /
     * PRESET_VERSION_RETIRED / PRESET_ASSIGNMENTS_REPLACED / PRESET_DOWNLOAD_AUTHORIZED /
     * SKILL_VERSION_UPLOADED / SKILL_VERSION_PUBLISHED / SKILL_VERSION_RETIRED /
     * SKILL_ASSIGNMENTS_REPLACED / SKILL_DOWNLOAD_AUTHORIZED / SKILL_MARKS_CHANGED）。
     *
     * <p>所以这条断言**现在应当红**，等审计枚举那一刀把契约补齐（或把服务端裁到契约子集）后自动转绿；
     * 失败信息里会逐字列出两侧差异，便于直接照抄补齐。若 CI 不接受一条预期红灯，
     * 给它加 `@Disabled` 并把上面这段理由与解除条件抄进注解即可。
     */
    @Test
    @DisplayName("审计 AuditAction 枚举 == 契约 AuditAction enum（预期红：契约 35 vs 服务端 46）")
    void auditActionEnumEqualsContract() {
        Set<String> contract = new LinkedHashSet<>();
        for (JsonNode value : schema("AuditAction").get("enum")) {
            contract.add(value.asString());
        }
        Set<String> server = new LinkedHashSet<>();
        for (AuditAction action : AuditAction.values()) {
            server.add(action.name());
        }

        Set<String> serverOnly = new LinkedHashSet<>(server);
        serverOnly.removeAll(contract);
        Set<String> contractOnly = new LinkedHashSet<>(contract);
        contractOnly.removeAll(server);

        assertEquals(
            contract,
            server,
            () -> "契约 AuditAction 与服务端枚举不一致：服务端多 " + serverOnly + "，契约多 " + contractOnly
        );
    }

    /**
     * 两条插件分配投影的**键集必须逐字相同**——这是 77cbb6c 那个坑的反向锁。
     *
     * <p>根因不是"契约没写"，而是**同一批事实被投影了两次**：`/plugins/assignments` 走
     * {@code PluginViews.RuntimeAssignmentView}，bootstrap 走 {@code BootstrapView.PluginAssignment}；
     * 只改一边 ⇒ 服务端有值、员工端那个表面永远拿不到（描述那次就是"界面永远暂无描述"无声）。
     * 上面那张 ⊆ 表现在两侧都在，但 ⊆ 只保证"不多发"；**漏发**要由这条等集断言抓。
     * 本刀（卡片标题 = displayName）正是往两条投影里各加同一个键，这条用例保证今后也必须成对加。
     */
    @Test
    @DisplayName("bootstrap 与 /plugins/assignments 的插件分配投影键集逐字相同（漏发即红）")
    void bothPluginAssignmentProjectionsEmitTheSameKeys() {
        Set<String> viaPluginViews = emittedKeys(pluginAssignmentsView().assignments().get(0));
        Set<String> viaBootstrap = emittedKeys(bootstrapPluginAssignment());
        assertEquals(
            viaPluginViews,
            viaBootstrap,
            () -> "两条插件分配投影漂开了：/plugins/assignments=" + viaPluginViews + "，bootstrap=" + viaBootstrap
        );
        // 具体锁本刀那一枚键：两条都得发（displayName 是必填，不是"有就发"）。
        assertTrue(viaPluginViews.contains("displayName"), () -> "PluginViews 缺 displayName：" + viaPluginViews);
        assertTrue(viaBootstrap.contains("displayName"), () -> "BootstrapView 缺 displayName：" + viaBootstrap);
        // 口径 20 的 readme 同样两条都得发（都是"有值才发"，故这里取的是**有值**那份样例）。
        assertTrue(viaPluginViews.contains("readme"), () -> "PluginViews 缺 readme：" + viaPluginViews);
        assertTrue(viaBootstrap.contains("readme"), () -> "BootstrapView 缺 readme：" + viaBootstrap);
    }

    /**
     * 详情/摘要键集漂移门禁——**摊平换来的机器保证**。
     *
     * <p>背景：`RuntimeSkillDetail` / `RuntimePresetDetail` / 四个 `UsageAnalytics*` 原本是
     * `allOf: [摘要, {...}]`。但 `allOf` + 各分支 `additionalProperties: false` 在严格 JSON Schema
     * 语义下**两分支互斥**（`additionalProperties` 只看本分支，看不见兄弟分支声明的键），
     * 于是**任何** detail 都不可能通过 schema；networknt 3.0.6 实测 `unevaluatedProperties`
     * 同样**不跨 allOf 分支传播**（错误数 12 → 12），换关键字是自欺。
     * 故契约把这几处**摊平成单一对象**——封闭性由此恢复且变严（多发一个未声明键必红）。
     *
     * <p>摊平废掉的是「详情继承摘要」这个**结构保证**，代价是两份 schema 的摘要键要人工同步。
     * 本条就是把那件事从纪律变成门禁：
     * <ol>
     *   <li>详情声明的键集 ⊇ 摘要声明的键集（摘要新增一个键而详情没跟上 ⇒ 这里即红，
     *       失败消息逐字点名缺哪个键，不让人自己去比对）；</li>
     *   <li>详情键集 − 摘要键集 === 约定的扩展键集（防止详情悄悄多出/少掉一个键）。</li>
     * </ol>
     * 用量分析那四个 schema 的扩展键各不相同、且共享一份 `UsageAnalyticsTokens` 基座，
     * 故按每组各写一份期望，而不是一条泛化规则。
     */
    @Test
    @DisplayName("摊平后的详情键集 ⊇ 摘要键集，且差集恰为约定扩展键（摘要新增键而详情没跟上即红）")
    void flattenedDetailKeepsSummaryKeySetPlusFixedExtension() {
        assertDetailExtends("RuntimeSkillSummary", "RuntimeSkillDetail",
            Set.of("versionId", "sha256", "skills"));
        assertDetailExtends("RuntimePresetSummary", "RuntimePresetDetail",
            Set.of("versionId", "sha256"));
        // 用量分析四行：各自把 UsageAnalyticsTokens 那一组键摊平进来，扩展键各不相同。
        assertDetailExtends("UsageAnalyticsTokens", "UsageAnalyticsSummary",
            Set.of("settled", "chargedMax", "unmeasured", "cacheHitRatio"));
        assertDetailExtends("UsageAnalyticsTokens", "UsageAnalyticsDayPoint",
            Set.of("date"));
        assertDetailExtends("UsageAnalyticsTokens", "UsageAnalyticsModelRow",
            Set.of("modelId", "alias", "displayName", "cacheHitRatio"));
        assertDetailExtends("UsageAnalyticsTokens", "UsageAnalyticsMemberRow",
            Set.of("userId", "username", "displayName"));
    }

    private static void assertDetailExtends(String summaryName, String detailName, Set<String> expectedExtension) {
        Set<String> summary = declaredProperties(schema(summaryName));
        Set<String> detail = declaredProperties(schema(detailName));

        Set<String> missing = new LinkedHashSet<>(summary);
        missing.removeAll(detail);
        assertTrue(missing.isEmpty(),
            () -> detailName + " 漏了 " + summaryName + " 的键 " + missing + "（摘要新增了键，详情没跟上）");

        Set<String> actualExtension = new LinkedHashSet<>(detail);
        actualExtension.removeAll(summary);
        assertEquals(expectedExtension, actualExtension,
            () -> detailName + " 相对 " + summaryName + " 的扩展键集应为 " + expectedExtension
                + "，实际 " + actualExtension);
    }

    /** 一个 view 序列化后**实际发出的**顶层键集（与门禁本体同一口径：Jackson 注解说了算）。 */
    private static Set<String> emittedKeys(Object view) {
        JsonNode emitted = JSON_MAPPER.valueToTree(view);
        Set<String> names = new LinkedHashSet<>();
        for (String name : emitted.propertyNames()) {
            names.add(name);
        }
        return names;
    }

    /** 契约真源自检：门禁覆盖的每个 schema 都必须真的存在，否则"没报错"只是没可比。 */
    @Test
    @DisplayName("契约真源包含门禁覆盖的全部 runtime schema")
    void contractDeclaresEveryCoveredSchema() {
        for (String name : runtimeProjections().keySet()) {
            JsonNode declared = schema(name);
            assertTrue(
                declared.get("properties") != null || declared.get("allOf") != null,
                () -> "契约 schema " + name + " 没有可比的 properties/allOf"
            );
        }
    }

    private static void collectUndeclaredKeys(JsonNode emitted, JsonNode schema, String path, List<String> violations) {
        if (emitted == null || emitted.isNull() || schema == null) {
            return;
        }
        if (emitted.isArray()) {
            JsonNode items = schema.get("items");
            for (JsonNode element : emitted) {
                collectUndeclaredKeys(element, items, path + "[]", violations);
            }
            return;
        }
        if (!emitted.isObject()) {
            return;
        }
        Set<String> declared = declaredProperties(schema);
        for (String name : emitted.propertyNames()) {
            if (!declared.contains(name)) {
                violations.add(path + "." + name);
                continue;
            }
            collectUndeclaredKeys(emitted.get(name), declaredSchema(schema, name), path + "." + name, violations);
        }
    }

    /** 一个 schema（含 allOf 各分支）声明的全部属性名。 */
    private static Set<String> declaredProperties(JsonNode schema) {
        Set<String> names = new LinkedHashSet<>();
        collectProperties(schema, names);
        return names;
    }

    private static void collectProperties(JsonNode schema, Set<String> names) {
        if (schema == null) {
            return;
        }
        JsonNode allOf = schema.get("allOf");
        if (allOf != null && allOf.isArray()) {
            for (JsonNode branch : allOf) {
                collectProperties(branch, names);
            }
        }
        JsonNode properties = schema.get("properties");
        if (properties != null && properties.isObject()) {
            for (String propertyName : properties.propertyNames()) {
                names.add(propertyName);
            }
        }
    }

    /** 某个属性名对应的子 schema（allOf 逐分支找，返回第一个声明它的）。 */
    private static JsonNode declaredSchema(JsonNode schema, String name) {
        if (schema == null) {
            return null;
        }
        JsonNode properties = schema.get("properties");
        if (properties != null && properties.has(name)) {
            return properties.get(name);
        }
        JsonNode allOf = schema.get("allOf");
        if (allOf != null && allOf.isArray()) {
            for (JsonNode branch : allOf) {
                JsonNode found = declaredSchema(branch, name);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private static JsonNode schema(String name) {
        JsonNode found = SCHEMAS.get(name);
        if (found == null) {
            throw new AssertionError("契约 components.schemas 里没有 " + name + "，门禁无法比对");
        }
        return found;
    }

    private static JsonNode loadSchemas() {
        try {
            JsonNode root = JSON_MAPPER.readTree(
                Files.readString(CONTRACT_ROOT.resolve("generated/enterprise-openapi.json"))
            );
            JsonNode schemas = root.get("components").get("schemas");
            if (schemas == null) {
                throw new IllegalStateException("generated/enterprise-openapi.json 缺少 components.schemas");
            }
            return schemas;
        } catch (IOException error) {
            throw new IllegalStateException("读取 contracts/generated/enterprise-openapi.json 失败", error);
        }
    }

    /**
     * 向上搜索仓库契约真源：单模块跑（basedir = server）与整仓跑（maven.multiModuleProjectDirectory = 仓库根）
     * 都从各自起点逐级向上找 `contracts/enterprise-openapi.yaml`（照 EnterpriseContractSchemaTest 的既有风格）。
     */
    private static Path findContractRoot() {
        String multiModuleRoot = System.getProperty("maven.multiModuleProjectDirectory");
        Path start = multiModuleRoot == null
            ? Path.of(System.getProperty("basedir", System.getProperty("user.dir"))).toAbsolutePath().normalize()
            : Path.of(multiModuleRoot).toAbsolutePath().normalize();
        for (Path current = start; current != null; current = current.getParent()) {
            Path candidate = current.resolve("contracts");
            if (Files.isRegularFile(candidate.resolve("enterprise-openapi.yaml"))) {
                return candidate;
            }
        }
        throw new IllegalStateException("cannot locate contracts/enterprise-openapi.yaml from " + start);
    }

    // ---- runtime 投影样例：值只需能过各 record 自身的形状约束，键集才是被测对象。 ----

    private static PresetViews.DependencyView dependency() {
        return new PresetViews.DependencyView("skill", "code-review", "latest", null, true);
    }

    private static PresetViews.RuntimeSummaryView presetSummaryView() {
        return new PresetViews.RuntimeSummaryView(
            "1901500000000000002", "code-review-assistant", "代码评审助手",
            "按团队清单评审改动并给出可执行的修改建议。", "0.2.0-rc.2", 16384L,
            Instant.parse("2026-10-01T02:00:00Z"), List.of(dependency())
        );
    }

    private static PresetViews.RuntimeDetailView presetDetailView() {
        return new PresetViews.RuntimeDetailView(
            "1901500000000000001", "weekly-digest", "周报整理",
            "把会议纪要与待办整理成企业周报草稿。", "1901500000000000101", "0.1.0-rc.7", 20480L,
            "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
            Instant.parse("2026-09-16T09:00:00Z"), List.of(dependency())
        );
    }

    private static SkillViews.RuntimeSummaryView skillSummaryView() {
        return new SkillViews.RuntimeSummaryView(
            "1902500000000000001", "meeting-notes", "会议纪要技能组",
            "把会议录音与转写整理成结构化纪要。", null, false, "0.1.7-rc.2", 40960L, 2,
            Instant.parse("2026-09-30T08:00:00Z")
        );
    }

    private static SkillViews.RuntimeDetailView skillDetailView() {
        return new SkillViews.RuntimeDetailView(
            "1902500000000000001", "meeting-notes", "会议纪要技能组",
            "把会议录音与转写整理成结构化纪要。", null, false, "1902500000000000101", "0.1.7-rc.2", 40960L,
            "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", 2,
            List.of(new SkillViews.EntryView(
                "meeting-notes",
                "Use when asked to summarize meeting recordings or transcripts into structured notes.",
                "Use for meeting minutes, transcript summarization, or action-item extraction.",
                true, true
            )),
            Instant.parse("2026-09-30T08:00:00Z")
        );
    }

    private static PluginViews.RuntimeAssignmentsView pluginAssignmentsView() {
        return new PluginViews.RuntimeAssignmentsView(9, List.of(new PluginViews.RuntimeAssignmentView(
            "1901300000000000101", "@example/t13-tools", "1.0.0",
            // 契约 RuntimePluginAssignment 的 displayName 是**必填**（验包器缺省回退包名）：门禁这里给真值。
            "T13 门禁工具箱",
            // 契约 RuntimePluginAssignment 声明了可选的 description；这里给**非空真值**，门禁才真正
            // 覆盖到这个键。若传 null，@JsonInclude(NON_NULL) 会让它整个缺席，门禁就永远看不到它、
            // 等于新字段没被这道防线覆盖（断言仍只做 ⊆，语义未变）。
            "T13 契约漂移门禁示例插件：仅用于 runtime 视图投影的键集比对。",
            // 口径 20 新增的可选 readme 同理：给真值才能覆盖到它（README 当纯文本，逐字带出）。
            "# T13 工具\n\n契约漂移门禁的 README 样例。\n",
            2048L,
            "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", "",
            new PluginCompatibility(
                List.of("0123456789abcdef0123456789abcdef01234567"),
                ">=0.1.0 <0.2.0",
                List.of("darwin", "linux")
            ),
            "/enterprise/api/v1/plugins/versions/1901300000000000101/download", true, "INSTALLED"
        )));
    }

    /**
     * 整壳 bootstrap 投影样例（**直接构造 view record**，与上面同一口径）。
     *
     * <p>`models`/`quotas` 给空列表：门禁只做 ⊆，空数组不递归进元素，本处要覆盖的是
     * `plugins.assignments[]` 那一层的键集；`sessionPolicy`/`user`/`device` 给形状合法的真值，
     * 使整壳逐层都能与 `BootstrapResponse` 对齐（这样将来在 bootstrap 上多发任何一个键都会被抓住）。
     */
    private static BootstrapView bootstrapView() {
        return new BootstrapView(
            9,
            new BootstrapView.User("10031", "zhangsan", "Zhang San", null),
            new BootstrapView.Device("90018", "2f1a0c1e-3b4d-4e5f-8a9b-0c1d2e3f4a5b", "ACTIVE"),
            List.of(),
            List.of(),
            new BootstrapView.Plugins(9, List.of(bootstrapPluginAssignment())),
            new BootstrapView.SessionPolicy(false, 90, 1_048_576)
        );
    }

    /** bootstrap 那套投影里的一条插件分配（值与 {@link #pluginAssignmentsView()} 同形，键集才是被测对象）。 */
    private static BootstrapView.PluginAssignment bootstrapPluginAssignment() {
        return new BootstrapView.PluginAssignment(
            "1901300000000000101", "@example/t13-tools", "1.0.0", "T13 门禁工具箱",
            "T13 契约漂移门禁示例插件：仅用于 runtime 视图投影的键集比对。",
            "# T13 工具\n\n契约漂移门禁的 README 样例。\n", 2048L,
            "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", "",
            new PluginCompatibility(
                List.of("0123456789abcdef0123456789abcdef01234567"),
                ">=0.1.0 <0.2.0",
                List.of("darwin", "linux")
            ),
            "/enterprise/api/v1/plugins/versions/1901300000000000101/download", true, "INSTALLED"
        );
    }
}
