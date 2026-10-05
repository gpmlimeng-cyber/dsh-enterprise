# 技能/插件「分类」端到端链路取证报告

> **日期**：2026-10-05
> **作者**：analyst（研究分析）
> **分支/HEAD**：`feat/personalization` @ `8698f42`
> **写作用域**：`docs/research/**`（本轮未改任何代码）
> **方法**：全部结论标注证据来源。`[已证实]` = 有文件:行号或真实命令输出；`[推测]` = 写明依据与不确定度；`[未找到证据]` = 查过了、没有，这本身是结论。

---

## 0. 摘要：三句话

1. **技能侧（`.dshskill`）链路是通的** —— 造 7 个不同 `category` 的包上传即可让员工端分出 7 组，**零后端改动**。
2. **插件侧做不到** —— 服务端 `plugin` 模块 `category` **零命中**、数据库无该列、契约无该字段。插件真实分组**必须后端另开一刀**。
3. **`featured` 是死代码** —— 全客户端源码 grep 零命中，「精选 = featured」这条裁决的 featured 分支**今天根本没生效**。

**最重要的意外发现**：`SkillArtifactInspectorTest.java:199` 有一个**已入库的活测试**断言 `"办公效率"`（枚举外的旧值）必须被原样接受。契约收紧到七类枚举后，这个测试**与新契约直接矛盾**。详见 §3.1。

---

## ① 端到端链路取证表

| 环 | 现状 | 证据 | 造真实数据还差什么 |
|---|---|---|---|
| **写包** `manifest.json` | ✅ 可用 | `SkillArtifactInspector.java:158` `String category = optionalCategory(root.get("category"));` | 无。键在**根层**，与 `format`/`version`/`id`/`name`/`sourceDshVersion` 平级 |
| **验包** | ✅ 可用（但**不校验枚举**） | `SkillArtifactInspector.java:273-282` `optionalCategory` | ⚠️ **接受任意 ≤32 的非空白字符串**，不拒枚举外值。详见 §3.1 |
| **落库** | ✅ 可用 | `SkillCatalogService.java:121`（建包）/ `:140`（每次上传 `updatePackageCategory`）；`JdbcSkillStore.java:147-161` | 无。V37 已建 `category varchar(32)` |
| **管理端读** | ⚠️ 有数据无入口 | `SkillViews.java:24` `PackageView` **带** `category`；`console/src/features/skills/skill-editors.tsx:468-473` 详情面板 6 个 `Fact` **没有** category | console 不显示分类。管理端看不到就难以核对 |
| **管理端改** | ❌ 无 category 写入口 | `skill-editors.tsx:193-208` 上传表单 state 只有 `displayName`/`description` | 符合裁决（manifest 是唯一真源）。**但也没有 featured 勾选** |
| **本机 API 透传** | ✅ 可用 | `bundle/src/skill-route.ts:221` `body = { data: projectSkillEnvelope(await upstream.json()) }` —— 整包透传，不逐字段重建 | 无 |
| **员工端投影** | ✅ category 有 / ❌ featured 无 | `SkillViews.java:71-79` `RuntimeSummaryView`（有 `category`）与 `:81-96` `RuntimeDetailView`（有 `category`）——**两个 record 都无 `featured`** | featured 需补投影 |
| **前端解码** | ✅ 可用（宽松） | `plugin/packages/ui/src/skill-api-decode.ts:57` `SKILL_SUMMARY_OPTIONAL_KEYS = ['category']`；`:84-85` 允许 `undefined`/`null`/非空串 ≤64 | ⚠️ 上限 64 ≠ 契约 32，比服务端宽（无害，见 §3.3） |
| **分组** | ✅ 可用 | `marketplace-entry.tsx:266-273` `enterpriseMarketCategory`；`:286-298` `enterpriseMarketCategoryGroups` | 无。七类已写死 |
| **插件侧投影** | ❌ **完全没有** | 见 §1.a | **必须后端另开一刀** |
| **featured 流到员工端** | ❌ **完全没有** | 见 §1.b | **必须补五处** |

### 1.a 插件 `category` —— 【已证实】服务端零落库、零投影

三条独立证据链，全部零命中：

```
$ grep -rn "category" server/.../enterprise/plugin/
(无输出)

$ grep -rn "category" server/.../resources/db/migration/
V37__enterprise_skill_category.sql:1,2,9,13,14   ← 只有 skill
CLAUDE.md:44                                      ← 只有 skill
V0__host_baseline.sql:81,103,201,221,912,929,933,959,984  ← 全是 sys_dept/sys_post/sys_message/gen_table（上游遗产，与插件无关）

$ grep -c "category" contracts/components/plugin.yaml
0
```

插件的员工端投影 `PluginViews.java:143-158` `RuntimeAssignmentView` 字段逐字为：`pluginVersionId, packageName, version, displayName, description, readme, operatingSystems, sizeBytes, sha256, signatureBase64, downloadUrl, required, desiredState` —— **无 `category`**。

> **结论：插件的真实分组数据这一刀做不到。** 前端 `EnterprisePluginCatalogItem.category`（`local-api-decode.ts:178`）与 `marketplace-entry.tsx:828` 的插件行 `category` 都已经写好，但**上游永远不下发这个键**，所以插件页签**恒定全部落「其他」**。这不是 bug，是「数据面字段先到位、管线后到位」的半程状态。

**要补的完整一刀（4 处）**：

| # | 层 | 文件 | 动作 |
|---|---|---|---|
| 1 | DB | 新增 `V44__enterprise_plugin_category.sql` | `alter table ent_plugin_package add column category varchar(32)` + 非空白 check |
| 2 | 验包 | `plugin/artifact/PluginArtifactInspector.java` | 从制品 `package.json` 读 `category`（**需要先定分类真源**，见 §3.4） |
| 3 | 契约 | `contracts/components/plugin.yaml` `RuntimePluginAssignment` | 加可选 `category` |
| 4 | 服务端投影 | `PluginViews.java:143` `RuntimeAssignmentView` + 取值 SQL | 加字段 |

前端**零改动**（`local-api-decode.ts:855-858` 已经会接）。

### 1.b `featured` 是否流到员工端 —— 【已证实】**没有**

```
$ grep -rn "featured" plugin/packages/ui/src/*.ts plugin/packages/ui/src/*.tsx \
    plugin/packages/platform-client/src/*.ts plugin/packages/bundle/src/*.ts
(无输出)
```

契约侧：`skill.yaml` 里 `featured` 只出现在三处，**全在管理端**——
- `:175` `SkillMarksRequest.required: [builtin, featured]`（写体）
- `:184` `SkillPackage.required: [... featured ...]`（管理端读投影）
- `:188` `SkillPackage.properties.featured`

`RuntimeSkillSummary`（`:242-274`）**没有** `featured`。

SQL 侧：`JdbcSkillStore.java:267`（`findVisiblePublished`）与 `:298`（`findVisiblePublishedById`）两条员工端查询 select 了 `p.category`，**没有 `p.featured`**。

> **结论：「精选 = `category: 精选` 或包级 `featured`」这条裁决，featured 分支今天是死代码。** 不改五处就只有一个入口能用。

**最小改动面（五处，均已定位到确切行）**：

| # | 层 | 文件:行 | 动作 | 锁/测试影响 |
|---|---|---|---|---|
| 1 | 契约 | `contracts/components/skill.yaml:242-274` | `RuntimeSkillSummary` 加 `featured: boolean` | 需重跑 codegen；`console/src/api/generated/**` 与 `plugin/packages/contracts/src/generated/**` 都会变 |
| 2 | 服务端投影 | `SkillViews.java:71`/`:81` | 两个 record 各加一字段 | `SkillViews` 无测试断言 record 形状，低风险 |
| 3 | SQL | `JdbcSkillStore.java:267`/`:298` | 两条查询 select 加 `p.featured` | **注意**：`runtimeMapper` 也要跟着改，否则多出的列不映射 |
| 4 | 本机 decode | `skill-api-decode.ts:57` | `SKILL_SUMMARY_OPTIONAL_KEYS` 加 `featured` + 解码 | 该文件有白名单键集测试，**必须同步加键**，否则测试红 |
| 5 | 行模型 + 分组 | `marketplace-entry.tsx:1674`/`:1694` | 技能行加 `featured`；分组函数改成 featured 优先 | 见下方语义坑 |

> **第 5 处的语义坑（必须先于 category 判定）**：当前 `enterpriseMarketCategoryGroups(visibleSkills, row => row.category)` 只认 category 一条路。若 `featured:true` 但 `category` 是「其他」的包，**会被 category 抢走归进「其他」**，featured 形同虚设。正确写法是让 featured **先于** category 短路：`row.featured ? '精选' : enterpriseMarketCategory(row.category)`。同样的短路也要加到 `:1674` 的筛选判定，否则「筛选『精选』」与「分组『精选』」会给出两套结果。

**我的建议**：这一刀**先不做** featured 通路。理由是它要动 5 处跨端 + 契约门禁，与「造真实分组数据」正交；混在一起会让验收不可判定（分不清组头出现是因为 category 通了还是 featured 通了）。用 `category: 精选` 单独把七组造出来验收，featured 作为**下一刀**。

### 1.c console 技能列表/编辑 —— 【已证实】**两者都没有**

```
$ grep -rn "category" console/src/features/skills/
(无输出)

$ grep -rn "featured" console/src/
console/src/features/skills/skill-management-page.test.ts:45:  featured: false,   ← 仅测试 fixture
console/src/features/skills/skill-editors.test.tsx:54:        featured: false,   ← 仅测试 fixture
console/src/api/generated/types.gen.ts:2757 / :2762 / :7288     ← 仅类型
```

- **上传表单**：`skill-editors.tsx:193-194` state 只有 `displayName` / `description`；`:207-208` 只提交这两个。无 category 输入框。
- **详情面板**：`skill-editors.tsx:468-473` 六个 `Fact`（显示名称 / skillId / 描述 / 最新基线 / 技能数 / revision）——**无 category、无 builtin、无 featured**。
- **HTTP 入口存在**：`AdminSkillController.java:152` `@PostMapping("/{packageId}/marks")`，`SkillMarksRequest.java:11-16` 紧凑构造器 `requireNonNull` 两个布尔。

> **结论**：管理端**看不到也改不了** featured。`featured` 只能靠直接打 HTTP 接口（`POST /skills/{packageId}/marks`，需 `Idempotency-Key` v4 + `If-Match` revision）。这对「造精选数据」是硬约束 —— 手册 §2.4 已按此写。

---

## ② 「造出真实七类数据」可执行操作手册

### 2.1 `manifest.json` 里 `category` 写在哪

**根层**，与 `format` / `version` / `id` / `name` / `sourceDshVersion` **平级**（不在 `skills` 下、不在某个 skill 条目里）。

证据 `SkillArtifactInspector.java:143-158`：
```java
String skillId = requiredText(root.get("id"), "id", 128);
String displayName = requiredText(root.get("name"), "name", 120);
String sourceDshVersion = requiredText(root.get("sourceDshVersion"), "sourceDshVersion", 64);
String description = optionalText(root.get("description"), 2000);
String category = optionalCategory(root.get("category"));   // ← 根层
```

**七个允许值**（逐字，繁体/简字体按契约）：`精选` `效率` `研究` `编程` `商业` `创意` `其他`

**长度上限 32**（`SkillArtifactInspector.java:43` `MAX_CATEGORY_LENGTH = 32`）

### 2.2 完整的真实规则（引 `optionalCategory`，`SkillArtifactInspector.java:273-282`）

```java
private static String optionalCategory(JsonNode node) {
    if (node == null || node.isNull()) return null;                    // 缺席 / JSON null → null
    if (!node.isString()) throw invalid("manifest 字段 category 必须是字符串");  // 数字/对象/数组 → 拒
    String value = node.stringValue();
    if (value.length() > MAX_CATEGORY_LENGTH) {
        throw invalid("manifest 字段 category 超过 " + MAX_CATEGORY_LENGTH + " 字符");  // >32 → 拒
    }
    if (value.isEmpty()) return null;                                  // "" → null（不是拒！）
    if (value.isBlank()) throw invalid("manifest 字段 category 不接受纯空白");  // "   " → 拒
    return value;                                                      // 原样透传，不 trim、不改写
}
```

**四条规则，逐条对应测试证据**（`SkillArtifactInspectorTest.java`）：

| 写法 | 结果 | 测试 |
|---|---|---|
| 键**缺席** | `null`（→ 归「其他」） | `:205` `assertNull(... "cat-absent")` |
| `"category": null` | `null` | `:206` |
| `"category": ""` | `null`（**空串不拒**） | `:207` |
| `"category": "   "` | **整包拒绝** `ENT_SKILL_INVALID_PACKAGE` | `:237-239` `assertTrue(msg.contains("纯空白"))` |
| `"category": 123` | **整包拒绝** | `:243-251` |
| 33 字符 | **整包拒绝** | `:210-219` |
| 恰好 32 字符 | **接受** | `:222-229` |

> ⚠️ **空串与纯空白的区别极易踩坑**：`""` 静默归 null（→ 落「其他」），`"   "` 直接拒整包。前者你看不到任何报错，只会发现包进了「其他」组。

### 2.3 造 7 个不同 category 的最小示例包

`.dshskill` 就是 **zip**，内含根 `manifest.json` + `skills/<name>/SKILL.md`。

**目录结构**（`SkillArtifactInspector.java:135-137` 强约束）：
```
demo-xingxuan.dshskill
├── manifest.json
└── skills/
    └── xingxuan-demo/
        └── SKILL.md
```
- `validateEntry` 要求：路径只允许根 `manifest.json` 与 `skills/` 子树，**任何旁路目录都拒**（`:135-137` `归档路径必须位于根或 skills/ 下`）
- 必须至少一个 `skills/<name>/SKILL.md`（`:117`）
- `<name>` 必须 **kebab-case**：`^[a-z0-9]+(?:-[a-z0-9]+)*$`（`:206`）

**`manifest.json` 模板**：
```json
{
  "format": "dsh-skill",
  "version": "1",
  "id": "xingxuan-demo",
  "name": "精选演示技能",
  "description": "演示用：分类为「精选」",
  "sourceDshVersion": "0.1.7-rc.2",
  "category": "精选"
}
```

**`skills/xingxuan-demo/SKILL.md` 模板**：
```markdown
---
name: xingxuan-demo
description: 演示用技能条目，描述必填且 ≤1024 字符。
---

正文任意。frontmatter 缺失、name 非 kebab-case、缺 description 都会整包拒绝。
```

**七个包只需改 `id` / `name` / `category` 三处**（`id` 必须互不相同，否则撞 `uq_ent_skill_package_skill` 唯一约束）：

| # | `id` | `category` |
|---|---|---|
| 1 | `xingxuan-demo` | `精选` |
| 2 | `xiaolv-demo` | `效率` |
| 3 | `yanjiu-demo` | `研究` |
| 4 | `biancheng-demo` | `编程` |
| 5 | `shangye-demo` | `商业` |
| 6 | `chuangyi-demo` | `创意` |
| 7 | `qita-demo` | `其他` |

**一键生成脚本**（写到本地任意位置，不入仓）：
```bash
mkdir -p /tmp/skillgen && cd /tmp/skillgen
gen() {  # $1=id  $2=分类中文  $3=描述
  rm -rf "$1" && mkdir -p "$1/skills/$1"
  cat > "$1/manifest.json" <<EOF
{
  "format": "dsh-skill",
  "version": "1",
  "id": "$1",
  "name": "$3",
  "description": "演示用技能包，分类：$2",
  "sourceDshVersion": "0.1.7-rc.2",
  "category": "$2"
}
EOF
  cat > "$1/skills/$1/SKILL.md" <<EOF
---
name: $1
description: 演示用技能条目，用于验证分类分组。
---
EOF
  (cd "$1" && zip -qr "../$1.dshskill" .)
}
gen xingxuan-demo  精选 精选演示技能
gen xiaolv-demo    效率 效率演示技能
gen yanjiu-demo    研究 研究演示技能
gen biancheng-demo 编程 编程演示技能
gen shangye-demo   商业 商业演示技能
gen chuangyi-demo  创意 创意演示技能
gen qita-demo      其他 其他演示技能
ls -la *.dshskill
```

### 2.4 勾「精选」的两条路径

| 路径 | 怎么做 | 现状可行性 |
|---|---|---|
| **A. `category: 精选`** | manifest 写死，如上 | ✅ **今天就能用，零后端改动** |
| **B. `featured` 标记** | `POST /enterprise/api/v1/admin/skills/{packageId}/marks`，body `{"builtin":false,"featured":true}` | ⚠️ 接口存在（`AdminSkillController.java:152`），但 **① console 无 UI ② featured 不进员工端投影**（§1.b）→ **打进去也不会改变员工端分组** |

B 路径的完整调用（注意两个必需头，`AdminSkillController.java:159-160`）：
```bash
curl -X POST "https://<server>/enterprise/api/v1/admin/skills/<packageId>/marks" \
  -H "Authorization: Bearer <consoleAccessToken>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \      # 必须 v4
  -H "If-Match: <当前包 revision>" \        # 必须匹配，否则 409
  -d '{"builtin":false,"featured":true}'
```
> 两个布尔**都必填**，`SkillMarksRequest.java:12-15` 紧凑构造器 `Objects.requireNonNull` —— 漏一个直接 NPE 失败，不会静默落 false。

### 2.5 上传后怎么验证真到了数据库

**字段与表**（`V35` 建表 + `V37` 加列）：

```sql
-- 表 ent_skill_package（V35:6）
-- 列 category varchar(32)（V37:9），无默认值，既有行为 NULL
-- 约束 ck_ent_skill_package_category: category is null or btrim(category) <> ''（V37:13-14）
-- 列 builtin / featured boolean not null default false（V36）

-- ★★★ 最关键的一条：员工端可见性要求版本 status = 'PUBLISHED'
-- 见 JdbcSkillStore.java:275-276
--   where p.tenant_id = ? and p.status = 'ACTIVE' and v.status = 'PUBLISHED'
```

**四步核对 SQL**（按顺序执行，缺一步会误判）：

```sql
-- ① 包级分类是否落库
select id, skill_id, display_name, category, builtin, featured, status, revision
from ent_skill_package
where tenant_id = '<你的tenantId>'
order by id desc;

-- ② 版本是否已 PUBLISHED（没发布 = 员工端根本看不到！）
select v.id, v.package_id, v.status, v.source_dsh_version, v.skill_count
from ent_skill_version v
join ent_skill_package p on p.id = v.package_id
where p.tenant_id = '<tenantId>'
order by v.id desc;

-- ③ 直接复刻员工端查询（这是唯一权威判据）
select p.skill_id, p.display_name, p.category
from ent_skill_package p
join ent_skill_version v on v.id = (
    select v2.id from ent_skill_version v2
    where v2.package_id = p.id and v2.status = 'PUBLISHED'
    order by v2.created_at desc, v2.id desc limit 1
)
where p.tenant_id = '<tenantId>' and p.status = 'ACTIVE' and v.status = 'PUBLISHED'
  and ( p.builtin
     or exists (select 1 from ent_skill_assignment a
                where a.package_id = p.id and a.status = 'ACTIVE'
                  and ((a.subject_type='ALL' and a.subject_id is null)
                    or (a.subject_type='USER' and a.subject_id = <userId>))) )
order by v.created_at desc, p.id desc;

-- ④ 枚举外脏值自查（见 §3.1）
select category, count(*) from ent_skill_package
where category is not null and category not in ('精选','效率','研究','编程','商业','创意','其他')
group by category;
```

> **⚠️ 第 ③ 条的三个 AND 条件是真实数据最常见的三个坑**：
> 1. `v.status = 'PUBLISHED'` —— **上传后默认是 `VALIDATED`**，必须再走一次「发布」才可见。这是「数据库有数据但员工端不显示」的头号原因。
> 2. `p.status = 'ACTIVE'`
> 3. 可见范围 = `builtin` **并集** `assignment`（`JdbcSkillStore.java:277-287`），**不是 assignment 单独**。`builtin=true` 的包不需要任何 assignment 就对全员可见。

### 2.6 常见失败原因与报错对照

| 现象 | 根因 | 报错文案（逐字） | 证据 |
|---|---|---|---|
| 整包被拒 | category 是数字/对象/数组 | `manifest 字段 category 必须是字符串` | `:275` |
| 整包被拒 | category > 32 字符 | `manifest 字段 category 超过 32 字符` | `:278` |
| 整包被拒 | category 是纯空白 `"   "` | `manifest 字段 category 不接受纯空白` | `:281` |
| **静默**落「其他」 | 键**缺席** | 无报错 | `:274` |
| **静默**落「其他」 | `"category": ""` 空串 | 无报错 | `:280` |
| **静默**落「其他」 | 写了枚举外旧值（如 `办公效率`） | **无报错**（服务端不拒） | §3.1 |
| 上传成功但员工端不显示 | 版本未 `PUBLISHED` | 无报错 | `JdbcSkillStore.java:275` |
| 上传成功但员工端不显示 | 无 assignment 且 `builtin=false` | 无报错 | `JdbcSkillStore.java:277-287` |
| 整包被拒 | zip 里有 `skills/` 以外的目录 | `归档路径必须位于根或 skills/ 下` | `:136` |
| 整包被拒 | 没有 `skills/<name>/SKILL.md` | `归档至少需要一个 skills/<name>/SKILL.md` | `:117` |
| 整包被拒 | SKILL.md 缺 frontmatter | `SKILL.md 缺少 YAML frontmatter` | `:218` |
| 整包被拒 | SKILL.md name 非 kebab-case | `SKILL.md name 必须是 kebab-case：<name>` | `:206` |
| 整包被拒 | zip 含重复路径 | `归档包含重复路径` | `:80` |
| 上传被拒 | 同 tenant 下 id 已存在 | 撞 `uq_ent_skill_package_skill` | `V35:18` |

> 前端侧**不会**报错：`enterpriseMarketCategory`（`marketplace-entry.tsx:266-273`）对任何未命中值一律静默归「其他」。

---

## ③ 风险与开放项

### 3.1 【已证实·高危】枚举外旧值：服务端不拒，前端静默归「其他」

**契约侧**（工作树 `skill.yaml:74-78`，已改未提交）：
```yaml
SkillCategory:
  type: string
  enum: [精选, 效率, 研究, 编程, 商业, 创意, 其他]
  maxLength: 32
```
`SkillPackage.category`（`:201-204`）与 `RuntimeSkillSummary.category`（`:258-261`）都改成 `oneOf: [$ref SkillCategory, null]`。

**服务端侧**：`optionalCategory`（`SkillArtifactInspector.java:273-282`）**完全不查枚举** —— 它只拒「非字符串 / >32 / 纯空白」。写 `"category": "办公效率"` 会**顺利入库**。

**三个已证实的现实问题**：

1. **入库的值可以违反契约**。契约说只允许七类，服务端照收。这是一处**契约与服务端的口径裂缝**。
2. **前端静默归「其他」**。`enterpriseMarketCategory`（`:266-273`）`known.includes(value) && value !== '其他'` 不命中即归「其他」，**无任何提示**。用户看到的是「我的包明明写了分类却进了其他」。
3. **★已入库的活测试会与新契约矛盾**。`SkillArtifactInspectorTest.java:196-199`：
   ```java
   /** manifest 声明 category 时必须原样透传到已验包结果（不 trim、不改写）。 */
   @Test
   void projectsDeclaredCategoryFromManifest() throws Exception {
       assertEquals("办公效率", inspector.inspect(archiveWithCategory("\"办公效率\"", "cat-declared")).category());
   }
   ```
   该文件**已入库且未被修改**（`git status --short server/` 空，最后提交 `30a2dab`）。它断言的 `"办公效率"` **不在七类里**。这个测试**当前仍然通过**（因为服务端不校验枚举），但它**与新契约直接冲突** —— 一旦将来服务端收紧枚举，这个测试立刻红。

**建议（三选一，按代价排序）**：

| 方案 | 动作 | 代价 | 评价 |
|---|---|---|---|
| **R1 推荐** | **先查库，再决定**。跑 §2.5 的 ④ 号 SQL | 1 条 SQL | 见下方推测 |
| R2 | 服务端 `optionalCategory` 加枚举校验 | 改 1 处 + **必须同步改 `SkillArtifactInspectorTest.java:199` 的期望值**（把 `办公效率` 换成 `效率`） | 契约与服务端口径合一，长期正确。但会破一个既有测试 |
| R3 | 不改服务端，只做一次数据清洗 | 1 条 `UPDATE` | 见下方 |

**【推测·中】是否需要数据清洗**：取决于线上是否已有枚举外数据。我**没有数据库访问权**，无法确认。判据是 §2.5 的 ④ 号 SQL：

- 返回 **0 行** → 线上无脏值，**不需要清洗**，直接进 R2 即可。
- 返回 **N 行** → 需要清洗。代价估算：一条 `UPDATE ent_skill_package SET category = '其他' WHERE category NOT IN (...七类...)`，**但这会让包 revision 不变**，而 `updatePackageCategory`（`:147-161`）的既有语义是「与 revision CAS 合并执行、递增 revision」。绕过 API 直接改库会**留下 revision 漂移**，影响后续 If-Match。更干净的做法是**重新上传一次这批包**（`SkillCatalogService.java:140` 每次上传都会用新 manifest 覆盖 category），代价 = 重打包 + 重传 N 次。

### 3.2 【已证实】契约收紧**不会**让 CI 契约门禁炸

**实测**：
```
$ cd plugin/packages/contracts && node scripts/generate.mjs --check
... ✓ .../typescript · 4 files · 10s
$ echo $?
0
```

**为什么安全 —— 一个反直觉的事实**：`generate.mjs:108` 走 `SwaggerParser.dereference()`，`$ref` 被**内联展开**。所以 `contracts/generated/enterprise-openapi.json` 里**根本不存在 `SkillCategory` 这个键名**，只有内联的 `enum`：

```json
SkillPackage.category = {
  "oneOf": [
    {"type":"string","enum":["精选","效率","研究","编程","商业","创意","其他"],"maxLength":32, ...},
    {"type":"null"}
  ]
}
```
（我用 `python3` 读 `contracts/generated/enterprise-openapi.json` 实测得出；`'SkillCategory' in schemas` 返回 `False`，但 enum 内容已在。）

TS 侧则**保留了具名类型**（`plugin/packages/contracts/src/generated/types.gen.ts:2760`）：
```ts
export type SkillCategory = '精选' | '效率' | '研究' | '编程' | '商业' | '创意' | '其他';
```
以及 Zod（`zod.gen.ts:2938` `export const zSkillCategory = z.enum([...])`）。

> **★ 方法论教训（对 Lead 上一轮 asar 误判的镜像）**：`grep "SkillCategory" contracts/generated/*.json` 返回 **0 命中**，但这**不代表它不存在** —— 它被 dereference 内联了。**「grep 0 命中」在生成物和 asar 上都是不可靠的证据**。

**fixture 门禁**：`contracts/fixtures/*.json` 中 **零个文件含 `category`**（`grep -ln "category" contracts/fixtures/*.json` 无输出）。所以**没有 fixture 会因枚举收紧而失效**。

**结论：契约收紧在 CI 侧是安全的**，`check:generated` 已通过。

### 3.3 【已证实·低危】前后端长度上限不一致

| 侧 | 上限 | 位置 |
|---|---|---|
| 服务端验包 | 32 | `SkillArtifactInspector.java:43` |
| 契约 | 32 | `skill.yaml:77` `SkillCategory.maxLength` |
| **前端 decode** | **64** | `skill-api-decode.ts:85` `row['category'].length <= 64` |
| **前端 decode（插件）** | **64** | `local-api-decode.ts:858` |

> 前端比服务端宽，**方向是安全的**（服务端永远先拒），不会出现「服务端放行但前端判畸形」。但这违反「同一口径逐字一致」的既有规约（文件头注释多处强调），属**规约漂移**。建议统一为 32。**低优先级**，不影响本刀验收。

### 3.4 【推测·中】插件侧的分类真源未定

插件没有 `.dshskill` 那样的 manifest。分类若要上，落哪还没裁决。三个候选：

| 候选 | 依据 | 代价 |
|---|---|---|
| 制品 `package.json` 的 `category` | 与 `displayName`/`description` 同源（`plugin.yaml:305-312` 注释确认这两个都取自 `package.json`） | 最低，验包器已有 `package.json` 解析 |
| 独立的 `V44` 列 + 管理端写入 | 复用技能侧的 marks 模式 | 需要新的管理端 UI |
| 复用 `featured`/`builtin` 标记 | 已有列 | 只有「精选」一类，表达不了七类 |

**[推测·中]** 我倾向第一个：插件的 `displayName`/`description`/`readme` **全部**来自制品（`plugin.yaml:305-312` 逐条注释），插件没有 manifest 概念，`package.json` 是唯一既有的元数据载体。但这**未与用户确认**，不应默认执行。

### 3.5 【已证实】Lead 上一轮的 `data-plugin-item-detail` 结论被证伪

**这不是我这一轮的重点，但它是本报告里唯一推翻既有结论的部分，单独列出。**

Lead 上一轮结论：「`data-plugin-item-detail` 在官方 `app.asar` 里不存在（逐个候选属性名 grep 全为 0 命中）」，并据此删掉了两条 CSS 规则。

**阳性对照** —— 先证明这台机器上 `grep -a` 在这个 121MB asar 上不慢、不超时：
```
$ grep -ac "sidebar.panellist" app.asar
12          # exit=0，秒回
```

**同一命令、同一调用，四个候选串**：
```
data-plugin-item-detail    1     ← Lead 说 0
data-plugin-item           2
plugin-item-detail         1
data-enterprise            0     ← 这个 0 是真的
```

注意最后一行：同一次调用里 `data-enterprise` **真的**是 0。**`grep -a` 能分辨「不存在」** —— Lead 那次的 0 命中不是工具限制。

**字节级定位**（python，避开 `grep -o` 在大二进制上退化）：
```python
data = open('app.asar','rb').read()
i = data.find(b'data-plugin-item-detail')   # offset 21714566
```

抽出的官方 `PluginManagerPage` JSX：
```js
return (0, react_jsx_runtime.jsxs)("div", {
    className: PluginManagerPage_module_css_default.detail,
    "data-plugin-item-detail": item.id,
    children: [ (0, react_jsx_runtime.jsx)(DetailTop, { crumbLabel: t("bac ...
```

> **修正后的结论**：属性**确实存在**。但它的值是**动态的 `item.id`**（插件包 id），而那两条被删的规则写死 `[data-plugin-item-detail="plugin-market"]` —— 除非存在一个 id 恰为 `plugin-market` 的插件包，否则**选择器仍然匹配不到**。
>
> 所以 task-1 删规则的决定**结果正确、理由错误**。理由应改为「属性存在但值为动态 `item.id`，写死字面量匹配不到」。若要真正锁到官方图标，选择器应写成属性**存在式**（如 `[data-plugin-item-detail] span[aria-hidden]`）。**具体去留由 Lead 定夺 —— 我不碰 `plugin/**`。**

---

## ④ 验收清单

前置：7 个包已上传、**已发布（PUBLISHED）**、可见范围已覆盖当前测试用户。

### 技能页签（核心验收，也是唯一今天可完整跑通的链路）

- [ ] **A1** 员工端插件市场「技能」页签出现 **7 个组头**，逐字为 `精选`/`效率`/`研究`/`编程`/`商业`/`创意`/`其他`，且**顺序与契约枚举一致**（分组顺序恒为 `ENTERPRISE_MARKET_CATEGORIES` 顺序，`marketplace-entry.tsx:297-299`）
- [ ] **A2** 每组行数 = 1（7 包各一组）；组内**无空组头**（`enterpriseMarketCategoryGroups` 只保留非空组，`:297` `filter(category => (buckets.get(category)?.length ?? 0) > 0)`）
- [ ] **A3** 筛选「类型」下拉有 **8 项**：`全部类型` + 七类（`ENTERPRISE_MARKET_FILTER_GROUPS` 由 `ENTERPRISE_MARKET_CATEGORIES.map` 派生，`:339`，**不可能与分组漂成两套**）
- [ ] **A4** 逐项筛七类，每次**恰好**筛出 1 行，且组头随之变为 1 个
- [ ] **A5** 选 `全部类型` 恢复 7 组
- [ ] **A6** 上传一个**不声明 category** 的包 → 落 `其他` 组（`optionalCategory` 键缺席 → null → `enterpriseMarketCategory` 归「其他」）
- [ ] **A7** 上传一个 `"category": ""` 的包 → **不报错**，落 `其他`（空串归 null，`:280`）
- [ ] **A8** 上传一个 `"category": "   "` 的包 → **上传被拒**，报 `manifest 字段 category 不接受纯空白`
- [ ] **A9** 上传一个 `"category": 123` 的包 → **上传被拒**，报 `manifest 字段 category 必须是字符串`
- [ ] **A10** 上传一个 33 字符 category 的包 → **上传被拒**，报 `manifest 字段 category 超过 32 字符`
- [ ] **A11** §2.5 的 ③ 号 SQL 返回 **7 行**，且 `category` 逐字等于七类
- [ ] **A12** §2.5 的 ④ 号 SQL 返回 **0 行**（无枚举外脏值）

### 负向验收（证明分组是真的由数据驱动）

- [ ] **A13** 全部 7 个包**不发布**（保持 `VALIDATED`）→ 员工端**全部消失**，证明可见性门禁确实生效
- [ ] **A14** 清空全部 assignment 且 `builtin=false` → 全部消失；把其中一个 `builtin=true` → **只有它**回来

### 本轮**不**在验收范围（明确排除，避免误判）

- [ ] **X1** 插件页签分组 —— **做不到**（§1.a：服务端零落库零投影）。今天插件页签恒定全落「其他」，**这是预期状态，不是失败**。
- [ ] **X2** `featured` 驱动的「精选」—— **做不到**（§1.b：五处全缺）。打 featured 标记后员工端分组不变，**这是预期状态**。
- [ ] **X3** console 显示/编辑分类 —— 无入口（§1.c）。

---

## ⑤ 未找到证据（查过了、没有）

按要求明确列出，避免「沉默」被误读为「没问题」。

1. **console 是否有任何 category 的展示或编辑入口** —— `grep -rn "category" console/src/features/skills/` 零命中。已确认无。
2. **服务端 plugin 模块是否有任何 category 字样** —— 零命中。已确认无。
3. **契约 `plugin.yaml` 是否有 category** —— `grep -c` = 0。已确认无。
4. **契约 `preset.yaml` 是否有 category** —— `grep -c` = 0；服务端 `preset/` 模块同样零命中。**配方页签今天也恒定全落「其他」**，与插件同病。（本轮未在任务书内，但同样属实，一并报告。）
5. **contracts fixtures 是否有含 category 的样例** —— 零命中。故 fixture 门禁不受影响（§3.2）。
6. **官方 `dsh-skill-hub` 是否有分类概念** —— `grep -rn "category" ~/.dsh/profiles/desktop/node_modules/dsh-skill-hub/lib/*.js` 仅 1 命中，且是**无关的自然语言注释**（`index.js:601`：`* but upstream repos may nest skills under category directories`），讲的是上游仓库目录结构，**不是分类字段**。故七类枚举**完全是企业自定口径**，官方无对应概念可对齐。
7. **线上是否已有枚举外脏数据** —— **[推测·未验证]** 我无数据库访问权。必须跑 §2.5 的 ④ 号 SQL 才能定论。

---

## ⑥ 本轮明确推翻的既有结论

| 原结论 | 出处 | 复核结果 | 证据 |
|---|---|---|---|
| `data-plugin-item-detail` 在官方 asar 里不存在（grep 0 命中），故那两条 CSS 规则从未生效 | Lead 上一轮 | **属性确实存在**。但值是动态 `item.id`，写死 `"plugin-market"` 仍匹配不到 —— 结果对，理由错 | 阳性对照 `sidebar.panellist`→12；`data-plugin-item-detail`→1；python 定位 offset 21714566 + JSX 片段（§3.5） |

## 附：复核者自身的误判记录（供后人避坑）

我本轮也栽了同一类坑，**主动记录**：

- 我一度 `grep "SkillCategory" contracts/generated/*.json` 得到 0 命中，差点断言「契约枚举没进生成物、CI 会炸」。**错的** —— `generate.mjs:108` 的 `dereference()` 把 `$ref` 内联了，键名根本不出现。`check:generated` 实测 exit=0。（§3.2）

> **共同教训**：「grep 0 命中」在 **asar** 和 **dereference 后的 JSON** 上都不可靠。判据必须是**阳性对照**（先证明这个工具在这个目标上能命中已知存在的串），再下「不存在」的结论。Lead 那次和这次我这次，是同一个错的两个方向。
