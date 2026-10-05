# 造出「插件市场」七类真实分组数据 · 操作手册

> 目标：让员工端「插件市场 → 技能」页签出现 **7 个分组组头**（精选/效率/研究/编程/商业/创意/其他），
> 而不是现在这种「所有条目都落进『其他』」的单组形态。
>
> 文档版本：2026-10-05 ｜ 对应契约提交 `aa19889`（`SkillCategory` 七类枚举）
> 全部结论均带 `文件:行号` 出处，**可逐条复核**。凡是我方推测（未取证）的地方都标了「推测」。

---

## 0. 一句话结论：代码已就绪，缺的是「包里写了 category」

| 环节 | 状态 | 出处 |
|---|---|---|
| 前端七类归一（严格七类，未命中归「其他」） | ✅ 已就绪 | `plugin/packages/ui/src/marketplace-entry.tsx:252` `ENTERPRISE_MARKET_CATEGORIES` |
| 契约七类枚举 | ✅ 已就绪 | `contracts/components/skill.yaml:92` `enum: [精选, 效率, 研究, 编程, 商业, 创意, 其他]` |
| 客户端解码 `category` | ✅ 已就绪 | `plugin/packages/ui/src/skill-api-decode.ts:39` |
| 服务端验包层读 manifest 的 `category` | ✅ 已就绪 | `SkillArtifactInspector.java:158` |
| 上传时把 `category` 落库 | ✅ 已就绪 | `SkillCatalogService.java:121/140` |
| **写包人往 `manifest.json` 里写 `category`** | ❌ **没人写** | ← **这就是只出现一个组的原因** |
| 包版本发布（`VALIDATED` → `PUBLISHED`） | ⚠️ **必须做，否则员工端看不到** | `JdbcSkillStore.java:276` |

**所以不需要改任何代码**，只需要造包 + 上传 + 发布。

---

## 1. 分类的七个合法值（写进 manifest 的字面量）

**逐字照抄这七个，不要改字、不要加空格**（`contracts/components/skill.yaml:92`）：

```
精选
效率
研究
编程
商业
创意
其他
```

### 三条硬规则（踩了就传不上去）

| 规则 | 出处 | 踩了会怎样 |
|---|---|---|
| 长度 ≤ **32** 字符 | `SkillArtifactInspector.java:277`（`MAX_CATEGORY_LENGTH`） | 上传报「manifest 字段 category 超过 32 字符」 |
| **不能是纯空白**（空格/全角空格/制表） | `SkillArtifactInspector.java:281` | 上传报「manifest 字段 category 不接受纯空白」 |
| 必须是**字符串**（加引号） | `SkillArtifactInspector.java:275` | 上传报「manifest 字段 category 必须是字符串」 |

> ⚠️ **注意一个已知的口径不一致**（不是 bug，是当前设计）：
> 契约说只允许七类，但**服务端验包层并不校验枚举** —— 它只校验上面那三条形状。
> 已入库的活测试 `SkillArtifactInspectorTest.java:199` 明确断言 `办公效率` 这类**枚举外旧值**必须被原样接受。
> 后果：**写枚举外的值也能上传成功**，但员工端会**静默归到「其他」**。
> 若线上已有枚举外脏值，用第 6 节的 SQL 检查；清理时**建议重新上传**而不是直接改库（直接改库会留下 revision 漂移）。

---

## 2. `manifest.json` 该怎么写

验包层逐字读取的键（`SkillArtifactInspector.java:140-158`）：

| 键 | 必填 | 约束 |
|---|---|---|
| `format` | ✅ | **必须逐字等于 `dsh-skill`**（`:144`） |
| `version` | ✅ | **必须逐字等于 `"1"`**（`:147-148`） |
| `id` | ✅ | 技能包引用，`[A-Za-z0-9][A-Za-z0-9._-]*`，≤128（`:149-150`） |
| `name` | ✅ | 显示名，≤120（`:152`） |
| `sourceDshVersion` | ✅ | ≤64（`:153`） |
| `description` | ⭕ 可选 | ≤2000（`:156`） |
| **`category`** | ⭕ **可选** | **七类之一**（`:158`） |

### 最小可用示例（以 category=效率 为例）

```json
{
  "format": "dsh-skill",
  "version": "1",
  "id": "meeting-notes",
  "name": "会议纪要技能组",
  "description": "把会议录音与转写整理成结构化纪要。",
  "sourceDshVersion": "0.1.7-rc.2",
  "category": "效率"
}
```

**不带 `category` 的对照包**（用来验证「没声明 → 落『其他』」这条兜底）：

```json
{
  "format": "dsh-skill",
  "version": "1",
  "id": "legacy-tool",
  "name": "历史遗留技能",
  "description": "没有任何分类声明的旧包。",
  "sourceDshVersion": "0.1.7-rc.2"
}
```

### 包内结构（`format: dsh-skill` / `version: 1`）

```
<包名>.dshskill            （ZIP）
├── manifest.json          ← 上面那个文件
└── skills/
    └── <name>/             ← 目录名 = 技能名
        └── SKILL.md        ← frontmatter 必须含 name（kebab-case，≤64）
```

`SKILL.md` 的 frontmatter 要求（`SkillArtifactInspector.java` `parseSkillFile`）：
- 必须是**合法 YAML 映射**（SnakeYAML `SafeConstructor` 解析失败即拒）
- `name` 必填、**必须 kebab-case**、≤64
- 不接受任何**遗留字段**（命中即拒，并提示改用新名）

---

## 3. 造 7 个包（最小成本方案）

不用造 7 个全新包 —— **改现有包的 `manifest.json` 再重新上传**即可（同一个 `id` + 同一个 `sourceDshVersion` + 同一份内容会被判为「已存在」而跳过，**所以要改 `sourceDshVersion` 或内容哈希**才能触发覆盖）。

> ⚠️ **这一步请先看 `SkillCatalogService.java:111-113`**：若命中 `findExistingVersion`（同 tenant + 同 id + 同 sourceDshVersion + 同 sha256），
> **直接返回旧版本、不会覆盖**。要覆盖就得让 `sourceDshVersion` 或内容哈希变化。

最小工作量方案（推荐）：

| # | 目的 | 做法 |
|---|---|---|
| 1 | 验证链路 | 拿 **1 个现有包**，把 `manifest.json` 的 `category` 加上（如 `"效率"`），并把 `sourceDshVersion` 改一档（如 `0.1.7-rc.3`），重打包重传 |
| 2 | 看到多个组 | 上面那步成功后再做 4~5 个不同 `category` 的包 |
| 3 | 验证兜底 | 留 1 个**不带** `category` 的包，确认它落「其他」 |

七个 `category` 各造一个包即可覆盖全部组头。

---

## 4. 上传

走管理端**「上传技能包」**（`console` 的技能页），选中 `.dshskill` 即可。
上传接口的写入侧白名单（`contracts/components/skill.yaml` `SkillUploadMetadata`）**只有 `displayName` 与 `description`，没有 `category`** —— 这是**正常的**：
`category` 走包内 manifest（唯一真源），管理端表单**不提供**分类输入框（当前缺失入口，属已知缺口）。

上传后包状态是 **`VALIDATED`**，此时员工端**看不到**（下一步）。

---

## 5. 发布（不做这步，前端永远只显示旧数据）

员工端可见性真源（`JdbcSkillStore.java:276`）：

```sql
where p.tenant_id = ? and p.status = 'ACTIVE' and v.status = 'PUBLISHED'
```

⇒ **包要 ACTIVE、版本要 PUBLISHED**。上传只到 `VALIDATED`，必须再走一次「发布」。

- 管理端：技能详情页的「发布」动作
- 或 CLI（`dsh-ent-admin`）

**发布后请让客户端重新取一次目录**（员工端目录有取数源，退避重试；必要时重启客户端最稳）。

---

## 6. 怎么验证真的落库了

### 6.1 查库（两处都要看：包级 + 版本级）

```sql
-- 包级分类（这是分组直接依据的那一列）
select id, skill_id, display_name, category, status, revision
from ent_skill_package
order by id;

-- 版本级状态（决定员工端可见性）
select v.id, p.skill_id, v.source_dsh_version, v.status
from ent_skill_version v
join ent_skill_package p on p.id = v.package_id
order by v.id;
```

期望：`category` 列出现「效率 / 研究 / …」七个值，版本 `status = 'PUBLISHED'`。

### 6.2 检查有没有枚举外的脏值

```sql
select category, count(*) from ent_skill_package
where category is not null
  and category not in ('精选','效率','研究','编程','商业','创意','其他')
group by category;
```

- **0 行** → 无脏值，不用清洗
- **N 行** → 这些包在员工端会显示为「其他」；建议**重新上传**（改 `category` + 覆盖）而不是直接 `update` 表（避免 revision 漂移）

### 6.3 员工端验收

进「插件市场 → 技能」，逐项确认：

- [ ] 出现 7 个组头，顺序 = 精选 → 效率 → 研究 → 编程 → 商业 → 创意 → 其他
- [ ] 每组只含该分类的条目
- [ ] 未声明 `category` 的包落在「其他」组
- [ ] 筛选钮 →「类型」组 → 逐个选七类，分别只筛出对应组的条目
- [ ] 搜索框能搜到组内条目
- [ ] 页签计数 = 当前目录下可见行数

---

## 7. 已知会踩的坑（都验过源码）

| 坑 | 出处 | 现象 | 处理 |
|---|---|---|---|
| **枚举外旧值** | `SkillArtifactInspectorTest.java:199` | 传得上去但前端归「其他」 | 6.2 查脏值 → 重新上传 |
| **纯空白 category** | `SkillArtifactInspector.java:281` | 上传被拒 | 去掉空格 |
| **超 32 字符** | `SkillArtifactInspector.java:277` | 上传被拒 | 七个值都很短，不会触发 |
| **传完看不到** | `JdbcSkillStore.java:276` 要求 `PUBLISHED` | 前端还是旧数据 | 做第 5 步的发布 |
| **重新上传没生效** | `SkillCatalogService.java:111-113` | 静默跳过 | 改 `sourceDshVersion` 或内容 |
| **勾「精选」标记不生效** | 契约里 `featured` 只在 `SkillMarks` 写体与 `SkillPackage` 管理端投影，`RuntimeSkillSummary` 无此字段、两条 runtime SQL 未 select、客户端零命中 | 点了标记前端分组不变 | **本轮请用 `category: 精选`**，featured 通路需另开一刀（改 5 处跨端） |
| **插件/配方分组不出现** | 服务端 `plugin/`、`preset/` 模块零 category 落库与投影 | 插件页签恒定全落「其他」 | **属预期状态，不是失败**；需后端另开一刀（加列 + 投影 + 契约） |

---

## 8. 相关文件速查

| 用途 | 路径 |
|---|---|
| 契约（七类枚举 + 口径说明） | `contracts/components/skill.yaml` |
| 前端分组逻辑 | `plugin/packages/ui/src/marketplace-entry.tsx`（`ENTERPRISE_MARKET_CATEGORIES` / `enterpriseMarketCategory` / `enterpriseMarketCategoryGroups`） |
| 客户端解码 | `plugin/packages/ui/src/skill-api-decode.ts` |
| 服务端验包层 | `server/.../skill/artifact/SkillArtifactInspector.java` |
| 服务端上传落库 | `server/.../skill/application/SkillCatalogService.java` |
| 存储层 | `server/.../skill/persistence/JdbcSkillStore.java` |
| 端到端取证报告（含插件/featured 两条缺口） | `docs/research/market-category-data-2026-10-05.md` |
