<!-- 状态:未来规划（2026-10-02 用户明确搁置）——本文件只作未来参考，不进当前实施队列。
     用户原话：「能力中心未来再说作为未来规划功能」。
     当前信息架构不动：市场页 = 企业技能 / 企业插件 / [企业配方（用户已要求）] / 包含内容；
     侧边栏 = 资料库（独立一级入口）+ 插件（官方 plugins.item）。
     其中【不依赖能力中心】的通用纪律已抽出并生效（见文末「抽取出的通用纪律」）。-->

<!--
[INPUT]: 依赖用户给出的 workdsh 截图读图结论（侧栏条目顺序、「专家·技能·连接器」页四页签、右上动作条、技能市场标题、分类筛选行、
         「可安装 33 —— 来自本地技能目录，点击 ＋ 直接安装」、4 列卡片网格）；依赖 workdsh 只读检出的源码取证
         （workbench `src/harness/client.ts:19-28` 的 pending 纪律、`src/client/components/BusinessPanel.tsx:12-22` 的面板清单、
         skills `src/client.tsx:95-98` 与 `src/client/SkillsPanel.tsx:220,249-281`、experts `src/client.tsx:29-31,171-175`、
         connectors `src/client.tsx:20-27`、三份 CHANGELOG 的「删除行业应用标签」记录、`skills/CHANGELOG.md:14`、
         `applications/README.md:1-7`）；依赖本仓库既有口径（`docs/notes/product-charter.md` 三支柱与术语降维表、
         `docs/plan/library-port.md:762-781` 的资料库入口形态硬要求、`docs/plan/enterprise-presets.md` 的配方线现状、
         `docs/plan/connector-architecture.md` 的三层与七公理、`docs/plan/enterprise-marketplace-phase2.md` 的承载形态取证、
         `docs/plan/skill-ingest-center.md` 的 V36/V37 现状、`docs/research/workdsh-other-features.md` 的可借鉴清单、
         `docs/research/jingyun-dsh-appstore.md` 的市场 UI 取值）；依赖运行中宿主 0.2.0-rc.2 的官方契约
         （`dsh-client-ui-layout` 的 `main` 槽与 `ILayout.selectPanel`、`dsh-client-ui-sidebar` 的 `sidebar.panellist`）。
[OUTPUT]: 给出把侧边栏改造成「能力中心」一个入口（内含 专家/技能/连接器/行业应用 四页签）+「资料库」独立入口的信息架构方案：
          目标侧边栏条目清单与官方 occupant 边界、能力中心页面五个区块的现状复用/新做判定、四个页签各自的数据来源与
          「专家 ≡ 配方/Agent 预设？」的正面裁定、移植/复用/已有三判定的迁移清单与人日、从截图与源码提炼的硬纪律、
          P0–P2 分期与前置依赖、对既有 314 条 ui 测试的迁移策略、开放问题/明确不做/不确定项。
[POS]: docs/plan 下的**信息架构方案**（IA only）：只回答「侧栏长什么样、一个入口还是两个、四个页签装什么、代价多少」，
       不代替 `library-port.md`（资料库实现）、`enterprise-presets.md`（配方实现）、`connector-architecture.md`（连接器实现）
       与 `enterprise-marketplace-phase2.md`（市场服务端缺口）。**本文只写文档，不改任何代码/其它文档、不提交、不部署。**
[PROTOCOL]: 变更时更新此头部；落地时由实施者在本目录与 `docs/CLAUDE.md` 成员清单补行（本文不代改）。
-->

# 侧边栏「能力中心 + 资料库」信息架构方案

> **只出方案，不写代码、不改任何源文件、不提交、不部署、不重启。**
> 取证纪律：workdsh 事实给 `文件:行号`（相对 workdsh 检出）；官方能力给 **包名 + 文件 + 行号**（本机安装目录，只读）；
> 本仓库事实给 `路径:行号`；**拿不到的一律写「未取到」**，不编造模块名/字段名/接口名。

**取证基线（读一次说清）**

| 项 | 值 |
|---|---|
| 本机宿主 | `@deepseek-ai/dsh` **0.2.0-rc.2**（`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/package.json:4`） |
| workdsh 只读检出（下称 `W/`） | `/data/data/com.deepcode.shell/files/home/.sshwork/workdsh`（`W/workdsh-web/packages/` = 插件 workspace） |
| 本仓库（下称 `R/`） | `/data/data/com.deepcode.shell/files/dsh-enterprise` |
| 截图 | **我无法访问图片**；截图内容一律以本任务书的读图结论为准（见 §0 与 §8 不确定项第 1 条） |
| ⚠️ 并发编辑 | `R/plugin/packages/ui/` 正被另一会话同时修改：`src/client.tsx` mtime `2026-10-02 18:06:16`、`src/marketplace-entry.tsx` mtime `18:06:04`、`src/library-entry.tsx` `18:04:33`、`src/library-panel.tsx` `18:04:39`、`src/library-gate.ts` `18:03:58`。**本文所有本仓库行号以该时刻读到的内容为准**，你读到时可能已变 |

---

## 0 一句话结论

**要改，但改成「一个入口 + 四页签」不是照抄 workdsh，而是"入口搬迁 + 一条新骨架 + 三个页签等各自的域先长出来"。**

| 维度 | 结论 |
|---|---|
| **要不要改** | **要**。侧栏现在是「官方插件(0) / 官方定时任务(10)」+ 我们刚落地的「资料库(现 order 20)」；能力（技能/配方/连接）**一个一级入口都没有**，全挤在官方插件页里的一张卡片 + 设置弹窗的两个页签里（`R/plugin/packages/ui/src/client.tsx:167-183`、`R/plugin/packages/ui/src/account-view.tsx:383-389`）。这正是产品宪法 §二「一步即达」的反面 |
| **改成什么样** | 侧栏新增**一个**一级入口（`sidebar.panellist` id = `capability`）承载「能力中心」主面板，面板内四个页签：**智能体（专家）· 技能 · 连接（连接器）· 行业应用**；同时**保留**「资料库」独立一级入口。**三个页签这一期只有「技能」是活的**，另外三个按 pending 纪律**连占位页都不注册**（§5 纪律 1） |
| **代价（只算 IA 与入口，不算各域自身建设）** | **4–7 人日**：入口与骨架 2–3、技能页签搬迁 0.5–1、术语与失败态一致化 0.5–1、测试迁移 0.5–1、资料库 order 让位 0.1。**不含**：专家/智能体页签（依赖配方二期的"真启用"面，其自身 4–6 人日）、连接器页签（依赖连接器 P0 12–20 人日）、行业应用（建议不做） |
| **最大的一处"不要抄"** | workdsh 的「页签」不是同一面板内的 tabpanel，而是**跨 `main` 面板的导航**（`openCapability → ctx.layout.selectPanel(key)` + `hasCapability()` 守卫），代价是**同一份页签数组在三个插件里各写一遍**（`W/.../skills/src/client/SkillsPanel.tsx:220`、`W/.../experts/src/client/ExpertsPanel.tsx:184`、`W/.../connectors/src/client/ConnectorsPanel.tsx:35` 三份 `capabilityTabs` 逐字重复）。我们**不抄这个结构**，用同一面板内页签（§1.3、§2.0） |
| **最大的一处"必须纠正"** | 「专家」这个词**不能直接上员工侧界面**：产品宪法 §三（`R/docs/notes/product-charter.md:36-46`）把 `preset / Cordis composition / bundle patch` 强制映射为**智能体**、把 `MCP / connector` 强制映射为**连接**。照抄「专家 · 技能 · 连接器」= 新增两个与宪法冲突的同义词 |

---

## 1 目标信息架构

### 1.1 侧边栏最终条目清单

**与官方 occupant 的关系：只做 `sidebar.panellist` 增量，不替换整块。**
官方 `sidebar` 整列是一个 `single`/root 槽，被 `ui-sidebar` 的 `SidebarRoot` 独占，注册它等于**整列替换**而不是追加
（`@deepseek-ai/dsh-client-ui-layout/lib/types/client/index.d.ts:33-48` 原文：「registering here replaces the navigation column outright rather than adding to it… To add something to the sidebar, register into one of those inner seats instead.」）。
我们只能往它声明的内座 `sidebar.panellist`（`kind:'list'`, `scope:'root'`，
`@deepseek-ai/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:42-50`）里注册一行。

| 侧栏顺序 | 行 | 谁注册 | 本次动作 | 证据 |
|---:|---|---|---|---|
| 顶部 | 品牌行（mark + name） | 官方 `sidebar.brand.*`，已由企业品牌以 priority **-10** 遮蔽 | **不动** | `R/plugin/packages/ui/src/client.tsx:184-199` |
| — | 新会话 · 工作区 · 最近会话 | 官方 `sidebar.workspaces` 区 | **不动** | `R/docs/plan/enterprise-marketplace-phase2.md:67`（渲染顺序：品牌 → 新会话 → 面板 nav → 工作区 → 底栏） |
| **0** | 插件 | 官方 `dsh-client-ui-plugin-manager`（zh label 「插件」，`lib/client.js:58`；`PANEL_ID='plugins'` 在 `:3427`；注册在 `:3534-3540`） | **不动**（不重复注册同 id） | 同上 |
| **10** | 定时任务 | 官方 `dsh-client-ui-schedule`（`PANEL_ID='schedules'` 在 `lib/client.js:5330`；注册 `:5437-5443`） | **不动** | 同上 |
| **20** | **能力中心** | **我们（新增）** `sidebar.panellist` id=`capability` + `main` key=`capability` | **新增**：一个入口，四个页签 | §2、§3 |
| **30** | **资料库** | **我们（已落地）** `R/plugin/packages/ui/src/library-entry.tsx:43-59,125-143` | **已落地**；只把 `ENTERPRISE_LIBRARY_ENTRY_ORDER` 从 **20 → 30**（`library-entry.tsx:23`）给能力中心让位 | `R/docs/plan/library-port.md:762-781`（资料库必须是独立一级入口的硬要求） |
| (不注册) | 助理 / 项目 / 更多 | workdsh 有（`W/.../workbench/src/client/components/BusinessPanel.tsx:17-23`），我们**没有对应域** | **不注册**（pending 纪律） | §5 纪律 1 |
| 底部 | 设置 | 官方 `sidebar.settings` 座（我们占它的 `settings.launcher`，`R/plugin/packages/ui/src/client.tsx:157-160`） | **不动** | — |

**与截图的三处必然差异（如实写，不装作一致）：**

1. 截图的相对顺序是「能力中心 → 定时任务 → 资料库」（对应 workdsh 的 order 30/40/50）；我们的官方 `schedules` 已被占用 `order 10`，**排在能力中心之前**。除非遮蔽/改写官方行（禁止，见 §8 明确不做 1），否则**无法**复现截图的绝对顺序，只能复现"能力中心在资料库之前"这一相对关系。
2. 截图里的「助理 / 项目 / 更多」三个条目在我们这里**不会出现**：workdsh 的 `BusinessPanel.tsx:17-23` 把助理、定时任务、更多标为 `pending:true`，而它的 `client.ts:19-28` 明确 `if (panel.pending) continue`（连侧栏入口都不注册）；我们既没有这三个域，也不打算造占位。
3. 截图是**四页签含「行业应用」**；workdsh 自己在 `0.1.0-alpha.31` 就把它删了（`W/.../skills/CHANGELOG.md:14`：「按用户决定删除能力中心「行业应用」标签入口…能力页工具栏保留专家/技能/连接器三个标签」，同一句同时出现在 `experts/CHANGELOG.md:14` 与 `connectors/CHANGELOG.md:14`）。即截图对应的是**比当前 workdsh HEAD 更早的版本**（§3.4、§8 不确定项 1）。

### 1.2 「资料库独立入口」vs「能力中心一个入口」的边界

**判据（三条，按顺序问，先命中者裁决）：**

1. **它是"能召唤 / 能装载 / 能连上的东西"，还是"能被引用的材料"？**
   —— 前者进**能力中心**，后者进**资料库**。资料库的读物是"我的材料"（文档、产物、可被 `@` 引用的正文），不是"我能调用的能力"。
2. **它有没有自己的安装 / 启用 / 停用生命周期？**
   —— 有（装、卸、启、停、有更新）→ 能力中心；只有读写与引用 → 资料库。
3. **官方是否已经给了它一级入口？**
   —— 给了（`插件` order 0、`定时任务` order 10）→ **不重复注册**，最多在能力中心里做一张导览卡 + `ctx.layout.selectPanel('plugins')` 跳转（`selectPanel` 会**抛错**如果目标 key 未注册，故必须先守卫，见 §2.1）。

| 对象 | 落点 | 理由 |
|---|---|---|
| 技能（`.dshskill`） | **能力中心 · 技能** | 有安装/卸载/启停/有更新（`R/plugin/packages/bundle/src/skill-install.ts`）；宪法把 skill 映射为「技能」 |
| 智能体 / 配方（`.dshpreset`） | **能力中心 · 智能体（专家）** | 有装载与选择生效（装 bundle → 官方 picker）；宪法把 preset 映射为「智能体」 |
| 连接（连接器） | **能力中心 · 连接** | 有连接/断开/授权生命周期；宪法把 connector 映射为「连接」 |
| 插件 | **不注册**，只做导览跳转 | 官方已占 order 0 的 `plugins` 行；phase2 §9.2 明确禁止重复注册 `sidebar.panellist` 的 `id='plugins'` |
| 定时任务 | **不注册**，不出现 | 官方已占 order 10；我们无对应域 |
| **资料库** | **资料库（独立一级入口）** | 判据 1+2：它是材料不是能力；没有"启用"语义（它现在的开关是"入口可见性开关"，不是能力启停，见 §5 纪律 1） |
| 会话 / 工作区 | 官方区域 | 官方 occupant，宪法「官方 UI 零分叉」 |

**一句话边界**：**「能召唤、能装载、能连上的」进能力中心；「能存、能查、能引用的」进资料库。**

### 1.3 「能力中心」这个名字与四个页签是否合适

**结论一：`能力中心` 这个名字 —— 不建议照用，建议收敛。**

三条理由：

1. **名字比内容大。** 宪法 §三把 `plugin` 强制映射为「**能力**」（`R/docs/notes/product-charter.md:39`），而本入口的四个页签**不含插件**——插件是旁边那行官方「插件」。一个叫「能力中心」的入口却装着非全部能力，比不装更让人困惑。
2. **「中心」是内部/运营词。** 员工侧没有"中心"这个心智；同族官方行的文案是「插件」「定时任务」，都是**对象名**而不是"某某中心"。
3. **与相邻官方行打架。** 侧栏里「插件」（官方）与「能力中心」（我们）并列，员工无法判断"插件是不是能力、技能是不是插件"。

**建议名（择一，按推荐度）：**

| 方案 | 侧栏 label | 面板 h1 | 优劣 |
|---|---|---|---|
| **A（推荐）** | **`能力`**（2 字，与「插件」同为对象名） | `能力中心` | 侧栏短、面板内可展开解释；"能力"就是宪法给 plugin 的那个词，语义承接得住 |
| B | `智能体 · 技能 · 连接` | 同 | 完全自描述、零歧义；但 8 字 + 两个分隔符在折叠态/窄屏下必被截断 |
| C（用户给定名） | `能力中心` | `能力中心` | 可用，但需接受上面三条代价；若采用，**必须**在面板首帧给一句边界说明（"这里是企业给你配好的技能与连接；插件在左侧「插件」里"） |

> 无论选哪个，**页内四个页签的文案**必须过术语降维表：`专家 → 智能体`、`连接器 → 连接`、`preset/YAML/manifest → 不出现`。

**结论二：四个页签——三个合适、一个必须改、一个建议不做。**

| 页签 | 合适？ | 理由 |
|---|---|---|
| 专家 | **词不合适，位置合适** | 位置对（它是"能被选中生效的智能体"）；词必须按宪法改成**智能体**。workdsh 的「专家」在我们的术语表里**没有授权词位** |
| 技能 | **合适** | 宪法原词，且我们已有完整技能线（§3.2） |
| 连接器 | **词不合适，位置合适** | 位置对；词改成**连接**（宪法 `MCP / connector → 连接`） |
| 行业应用 | **都不合适** | workdsh 自己已删；我们的 `applications` 域连骨架都不在本仓；它与我们的"配方/智能体"语义重叠（§3.4） |

---

## 2 能力中心页面结构（逐区块）

> 逐区块回答三问：**我们现状是什么（能复用哪些）· 目标形态 · 改造成本**。
> 现状落点全部在 `R/plugin/packages/ui/src/marketplace-entry.tsx`（2541 行，官方 `plugins.item` 卡片进入的唯一市场入口，
> `R/plugin/packages/ui/src/client.tsx:167-175`）。

### 2.0 一处必须先裁决的结构分歧

| 方案 | 做法 | 证据 | 优劣 |
|---|---|---|---|
| **甲：同面板内页签（推荐）** | 一个 `main` key=`capability`，四个页签是它的 `tabpanel`；只有不可内嵌的（官方插件）用 `selectPanel` 跳转 | 我们既有 `EnterpriseMarketTabStrip`（`marketplace-entry.tsx:1425-1460`，手写 `role="tablist"` + roving tabIndex + ←/→/Home/End + `id`/`aria-controls`/`aria-labelledby` 三处同源） | 页签真源只有一份、状态只有一份、测试面只有一份 |
| 乙：跨 `main` 面板导航（workdsh 做法） | 一个侧栏入口 + 三个独立 `main` key，每个面板顶部渲染同一份页签条，点页签走 `openCapability(key) → ctx.layout.selectPanel(key)` | `W/.../skills/src/client.tsx:93-95`、`SkillsPanel.tsx:249-258`；`experts/src/client.tsx:168,171-174`；`connectors/src/client.tsx:18,22-25`；守卫 `hasCapability = ctx.slots.entriesOfSlot('main').some(e => e.options.key === key)` 在 skills `:94` | 每个域可独立装卸（专家插件卸掉，技能页签自动禁用）；**代价是页签数组在三个包各写一遍**（三份 `capabilityTabs` 逐字重复），且"当前页签"状态分散在 layout store |

**裁决建议：甲为主、乙仅用于"不可内嵌的官方页"**（如官方插件页）。理由：①我们有现成实现与 69 例锁（`tests/marketplace-entry.spec.ts`）；②乙的三份重复一旦漂移就是三套行为；③乙的 `selectPanel` 会**抛错**（`dsh-client-ui-layout/lib/types/client/service.d.ts:26-32`：「@throws if the selected main key is not registered」），必须配 `hasCapability` 守卫，否则"点页签即崩"。
**若采纳乙**，则 §7 的测试迁移要按"三处注册面 + 三份页签数组"重估（+1.5–2 人日）。

### 2.1 顶部页签条

- **现状**：`ENTERPRISE_MARKET_TABS`（`marketplace-entry.tsx:70-77`，3 项：企业技能 / 企业插件 / 包含内容）+ `EnterpriseMarketTabStrip`（`:1425`）。官方 primitives 我们钉的是 `0.1.5-rc.2`，**不含** `SegmentedTabs`，故页签条是手写的（`marketplace-entry.tsx` 头部 `[INPUT]` 第 3 行；`R/docs/plan/enterprise-marketplace-phase2.md:404,429`）。
- **能复用**：整个页签条实现 + `ENTERPRISE_MARKET_TAB_IDS` 的三处同源配对（`:87-92`）+ `enterpriseMarketTabLabel` 的"文案+计数"口径（`:101-104`）。
- **要新做**：页签数组从 3 项扩到 4 项且**改名**（专家→智能体、连接器→连接）；`ENTERPRISE_MARKET_DEFAULT_TAB`（现 `'skills'`，`:77`）保持不变（技能是唯一活页签）。
- **成本**：**0.3–0.5 人日**（改真源 + 改名 + 更新锁页签真源的用例）。

### 2.2 右上动作条

截图读图结论：`搜索 · 我安装的 161 · 批量管理 · 最近卸载 · ＋ 添加技能`。
workdsh 对应实现在 `W/.../skills/src/client/SkillsPanel.tsx:249-264`（`cap-header`：页签 ×3 → 搜索 → `我安装的 {skills.length}`(:260) → `批量管理`(:261) → `最近卸载`(:262) → `＋ 添加技能` 三菜单项(:263)）。

| 控件 | 我们现状 | 判定 | 成本 |
|---|---|---|---|
| 搜索 | **有**（企业技能/插件目录取数 + 客户端筛选在既有市场页里已存在；`EnterpriseMarketListHint` 四态 `:1525`） | 搬迁 | 0.2 |
| `我安装的 N` | **半有**：已装清单接口在（`GET {local}/skills/installed`，`R/plugin/packages/bundle/src/skill-install.ts:52`），但它现在是"行上开关"的真值，不是一张独立列表 | 新做"已装视图"分区 | 0.5–1 |
| `批量管理` | **无**（企业技能只有逐行装/卸） | **不做（P2）** | — |
| `最近卸载` | **无**：我们的卸载是**直接删目录**（`skill-install.ts:451-465`），没有回收站；workdsh 有 `.workdsh-trash/skills` + `trash-receipts`（`W/.../skills/src/services/manager.ts:168,172`） | **不做（P2）**，要做就是新增落盘 + 凭据 + 恢复动作 | — |
| `＋ 添加技能` | **无**（我们的导入在管理端：控制台上传 → 发布 → 分配） | **不做**：员工侧"添加技能"= 走企业发放或「申请」（§3.2） | — |

- **成本**：**0.7–1.2 人日**（只做搜索 + 我安装的 N）。

### 2.3 分类筛选行

- **现状**：我们**有分类签**（`enterpriseMarketSkillCategoryTag`），但**分类数据取不到**：服务端列已落（`V37__enterprise_skill_category.sql` 给 `ent_skill_package` 加 `category varchar(32)`，可空 = 没有分类），而**代码零消费**（`R/docs/plan/skill-ingest-center.md:50,73-79,729`：`server/.../skill/**` 与 `contracts/**` 对 `builtin/featured/category` 三列零命中）。
- **workdsh 怎么做的**：分类行是**数据驱动**的——`categories` 从目录条目里求并集去重（`W/.../skills/src/services/catalog.ts:95`，`SkillsPanel.tsx:214,268`）。截图里的 `数据分析/效率工具/知识与学习/…` 在 workdsh **源码里零命中**（`grep -rn "效率工具\|知识与学习\|投资理财" W/` = 0 命中）⇒ 它们是运行期 `catalog.json` 数据（`W/.../skills/src/services/catalog.ts:174` 的目录文件），**不是代码常量**；该文件我**未取到**（§8 不确定项 2）。
- **目标形态**：`全部 + 服务端分类`，选中态与 `全部` 互斥（照 `SkillsPanel.tsx:268` 的 toggle 语义）。
- **成本**：**页签内 0.3 人日**（渲染 + 筛选），但**前置依赖**：`skill-ingest-center` 的 P1-6（分类读写路径 + revision 乐观锁），**没有它这一行没有数据**。

### 2.4 分区标题

- **现状**：我们是「企业技能」/「企业插件」两节 + 页签计数（`enterpriseMarketTabLabel`）；四态投影 `enterpriseMarketPanelState` 与共享三态落点 `EnterpriseMarketListHint` 都在（`:340-375`、`:1525`），空态文案还写清了"为什么空 + 下一步"（`:379,385`）。
- **目标形态**：`可安装 N` + 一句来源说明，形如 `来自企业技能库，点 ＋ 直接安装`（照 `SkillsPanel.tsx:272` 的 `market-head`：`<h2>可安装 <span>{n}</span></h2>` + `<span class="muted">来自本地技能目录，点击 ＋ 直接安装</span>`）。
- **要新做**：一层分区模型（可安装 / 已安装），因为我们要按授权分两态（§2.5）。
- **成本**：**0.3 人日**（复用四态与计数，只加分区）。

### 2.5 卡片网格（含"卡片上直接 + 安装"的取舍）

- **现状**：我们**不是**卡片网格，是**行**：技能行 = 图标 + 两行文案 + `[有更新]` + 官方 `Switch` + 行内失败提示；插件行 = 图标 + 两行文案 + 状态点 + 官方状态词 + `Switch`（`EnterpriseMarketInlineRows`，`marketplace-entry.tsx:2143`）。卡片网格是 workdsh 的 `.grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}`（`W/.../skills/src/client/styles.ts:7`，**实测 4 列**，与截图一致；窄屏 1400/900/560 三档降到 3/2/1 列）。
- **"卡片上直接 ＋ 安装"的取舍 —— 我们与 workdsh 的关键差异：**

| 维度 | workdsh | 我们 |
|---|---|---|
| 安装权限 | 卡片上 `＋` 直接装（`SkillsPanel.tsx:273-276`，`disabled = !entry.installable`） | **浏览自由 · 安装受控**：未分配只能「申请」，`entitled` 是**服务端真值**、客户端不得自行推理（`R/docs/plan/enterprise-marketplace-phase2.md:20,289,391`） |
| 结论 | 可抄"一键即达"的按钮形状与 disabled 口径 | **但必须按 `entitled` 分两态**：`entitled=true → 安装`；`false → 申请`（+ 已申请待审给「审批中」Tag 且禁用） |

- **目标形态（推荐：混合，不整体改网格）**：
  - **可安装 / 浏览语义** → **卡片网格 4 列**（图标 + 名称 + 分类签 + 描述两行 + 右下动作）；
  - **已装 / 受管语义** → **保留现有行**（状态签 + `Switch` + `[有更新]` + 行内失败提示）。
  理由：①行语义里"启用态 + 有更新 + 失败提示"是**管理**语义，塞进卡片会与我们的详情子页面重复；②`R/docs/research/jingyun-dsh-appstore.md:610-616` 已经否掉过"2 列卡片网格 + `max-height:380px` 内滚"这条路；③`tests/marketplace-entry.spec.ts`（69 例）大量锁行结构，整体改网格要连带重写。
- **成本**：卡片分区 **0.8–1.5 人日**（新组件 + 4 列 CSS + 窄屏 + 新用例），**不含**把已装行改成卡片（建议不做）。

### 2.6 五个区块的"复用 / 新做"总账

| 区块 | 可复用（来自哪） | 要新做 | 成本 |
|---|---|---|---|
| 顶部页签条 | 页签条实现 + 三处同源 id + 计数口径（`marketplace-entry.tsx:70-104,1425`） | 3→4 项、两个改名 | 0.3–0.5 |
| 右上动作条 | 搜索与四态提示 | `我安装的 N` 分区 | 0.7–1.2 |
| 分类筛选行 | 分类签（已有） | 分类筛选交互 | 0.3 + **依赖 V37 消费路径** |
| 分区标题 | 四态投影 + 计数 + 空态文案 | 可安装/已安装两层分区 | 0.3 |
| 卡片网格 | 无（我们是行） | 卡片组件 + 4 列 CSS + 授权双态动作 | 0.8–1.5 |
| **合计** | 约 **60% 可复用** | 约 **40% 新做** | **2.4–3.8 人日** |

---

## 3 四个页签各自的内容与数据来源

### 3.1 专家 ⇄ 我们的「配方 / Agent 预设」是不是同一个东西？

**正面回答：不是同一个东西；它们是同一目标层的"两个面"，而且我们只做了其中一面的一半。**

**先摆事实（两边各自是什么）：**

| | workdsh「专家」 | 我们「配方 / Agent 预设」 |
|---|---|---|
| 是什么 | **资产 + 编译 + 运行准入** 三层：把"专家"当资产管理（作者身份、不可变修订、依赖锁、可移植包、专家团成员），再**编译**成一份官方 agent preset，最后在 Agent 生命周期钩子上做**资产准入与角色装配** | 一份 **官方 agent preset（Cordis composition）** + 一份**企业管理元数据**（可见范围、发布/退休、审计、上传/下载） |
| 规模 | 6646 行（`W/.../experts`，`docs/research/workdsh-other-features.md:42,166`） | 服务端纵向完整、控制台完整、员工端只读（`R/docs/plan/enterprise-presets.md:27-33,95-116`） |
| 数据模型 | 6 张表：`experts`/`drafts`/`revisions`(不可变)/`bindings`/`preferences`/`operations`（`W/.../experts/src/storage/domain.ts:127-139`，逐表字段见 other-features `:171-182`） | 3 张表：`ent_preset_package`/`ent_preset_version`/`ent_preset_assignment`（`R/docs/plan/enterprise-presets.md:65`） |
| 产物 | `presetId = wd-exp-<kebab(expertId)>-<digest>`，由**内容派生** ⇒ 同内容同 id、天然幂等（`W/.../experts/src/runtime/preset-compiler.ts:63-72`） | 一个 `.dshpreset` ZIP 制品；**服务端不解析、不校验、不消费** `agent.cordis.yml`（`enterprise-presets.md:78-80`） |
| 有不可变修订吗 | **有**（`revisions` 表冻结 definition/digest/dependencyLock/compositionDigest） | **无**（状态机只有 `VALIDATED→PUBLISHED→RETIRED`，版本不可"修订"） |
| 有"人批准发布"的凭证吗 | **有**：challenge（绑定内容摘要、TTL 5 分钟）→ 可信 UI 换一次性 proof → 提交点复验并消费，明说"模型给的 `confirmed:true` 不是授权"（`W/.../experts/src/runtime/confirmation.ts:5-14,16,64-74,80-98`） | **无** |
| 能把会话绑到某个修订吗 | **有**（`bindings` 表 + `agent/created`/`agent/pre-step` 双钩子做准入，`W/.../experts/src/runtime/execution-guard.ts:17-59`） | **无**（官方语义：只有空会话能切 preset；已存在会话钉住启动时的修订，`enterprise-presets.md:206-208`） |
| 有员工侧"一键启用"吗 | 有（`summon` / `createExpertTask`） | **没有**——官方 0.2.0-rc.2 **不存在**任何 preset 导入端点，员工端只能复制一段给 Agent 读的导入指令（`enterprise-presets.md:29-31,214-230`） |

**因此三句话定论：**

1. **`专家 ⊃ 官方 preset`，不是同义词。** 专家是"资产的作者面 + 编译面 + 准入面"，官方 preset 是它的**编译产物**（`preset-compiler.ts` 的产物类型就是 `@deepseek-ai/dsh-agent-preset` 声明）。
2. **我们的「配方」只覆盖了 workdsh 专家的"编译产物 + 打包分发"那一段**（`enterprise-presets.md:45-55` 把配方定义为「官方 composition + 企业管理元数据」）；我们**没有**作者的头部（无草稿/无不可变修订/无依赖锁/无确认凭证）也**没有**准入的尾部（无会话绑定/无 Team 装配）。
3. **同时，我们的配方那一面 workdsh 也没有**：workdsh 的专家数据是**本机 Storage Domain**（单机），没有企业可见范围、没有配额、没有多租户发布/退休（`other-features:228` 自述"企业远程多用户…未验收"）。

**合并 / 并存建议 —— 建议「合并为一条线，两个词各管一层」：**

| 层 | 谁负责 | 员工侧词 | 管理侧词 |
|---|---|---|---|
| 资产 / 作者面（谁做的、哪一版、依赖什么） | **新增**（借 workdsh 的 `revisions` + 依赖锁 + 确认凭证） | 不出现 | 智能体（资产） |
| 编译面（→ 官方 preset 声明） | **新增**（借 `preset-compiler.ts` 的内容派生 id + 原子发布） | 不出现 | 智能体（版本） |
| 分发 / 治理面（可见范围、发布、退休、审计） | **我们已有**（`enterprise-presets.md` 的服务端 + 控制台） | 「智能体」 | 配方 / 预设 |
| 准入 / 绑定面（会话钉住哪一版） | **新增**（借 `execution-guard.ts` 双钩子；**不建**团队执行器） | 不出现 | 智能体（绑定） |

- **合并方式（不动既有交付）**：把现有 `ent_preset_*` 三张表当作"智能体版本的发布与分配账本"，在它**下面**补一张 `revisions` 语义的不可变修订表，在它**上面**补作者编辑面；**不推倒重来**（服务端与 314 条前端链路的既有口径全部保留）。
- **明确不做**：**不**恢复/新建专家团执行器（workdsh 自己在 `workdsh-web/AGENTS.md`「2026-09-15 官方 Team 替换决定」里**禁止恢复** `TeamRunsManager`、`workdsh_expert_team_*`、`workdsh-expert` provider 或等价运行表；`experts/README.md:47-51` 复述——`other-features:225,593-594`）。
- **词的建议（结论）**：**员工侧统一叫「智能体」，不引入「专家」**。理由：①宪法 §三已强制 `preset → 智能体`；②「专家」在员工语境里会与"人"混淆（我们已有成员/身份概念）；③管理侧可以叫"配方/预设"，因为管理侧本来就是技术语境。

### 3.2 技能页签

**判定：这是"入口搬迁"，不是"功能移植"。**

| 我们已经有（能直接搬入口） | 证据 |
|---|---|
| 真实导入过 **8 个** skillhub.cn 技能（下载→转换→上传→发布→分配→回读全绿，真机服务端验证） | `R/docs/plan/skill-install-sources.md:94`（证据归档 `~/.sshwork/sh-import/EVIDENCE.md`） |
| 落盘门禁：唯一相对路径门禁 `requireRelativeSkillPath` + 落点解析 `resolveInstalledSkillTarget`（记录归属 + `lstat` + `realpath` 三重等式 + 256 KiB 上限）+ 名称锁 + sha256 + 原子发布 | `R/plugin/packages/bundle/src/skill-install.ts:3`（文件头 `[OUTPUT]`）、`:24`（`installed.json`） |
| 一键安装（实测 167ms）/卸载/幂等/「有更新」判定 | `R/docs/plan/enterprise-marketplace-phase2.md:32` |
| 分类 / 标记列已落地（`builtin`/`featured`/`category`），**代码零消费** | `V36__enterprise_skill_marks.sql`、`V37__enterprise_skill_category.sql`；`R/docs/plan/skill-ingest-center.md:50,73-79,729` |
| 「并集可见」的既有口径（两处安装/卸载共用一份"谁拥有这个名字"的查询） | `R/docs/plan/skill-install-sources.md:711` |
| 目录 + 已装真值 + 详情子页面（含文件树 / 文件正文预览） | `R/plugin/packages/ui/src/marketplace-entry.tsx:2143`（行）、`:2705`（页面宿主） |

**迁移清单（入口搬迁）：** ① 把 `plugins.item` 卡片里的技能节**原样**在能力中心面板里再挂一份（同一份 store、同一份取数源，`R/plugin/packages/ui/src/client.tsx:174` 的 `inject`）。
② 页签计数与默认页签改为 `skills`（已默认）。③ **不新增**第二份技能目录取数逻辑。
**成本：0.5–1 人日**；**风险**：低；若为了卡片网格重写行渲染，风险升到中（§2.5）。

### 3.3 连接器页签

**判定：只取 workdsh 的"薄封装 / 不自建传输"结论；我们的规划宽得多，页签只是它的一个出口。**

| | workdsh `connectors` | 我们 `connector-architecture.md` |
|---|---|---|
| 规模 | **715 行**（12 个模块里最小的业务模块之一），核心逻辑 `src/manager.ts` **231 行** | 三期 **44.5–71.5 人日**；三层架构（跨平台内核 / 主机能力面 / 企业侧）、7 条公理、6 类连接（MCP · HTTP/OpenAPI · A2A · ACP · IM · 邮件）、L1/L2/L3 权限、跨平台两层 |
| 传输 | **不自建**：直接 `ctx.plugin(McpClient, {...})`，全部生命周期交给官方 `@deepseek-ai/dsh-mcp-client`（`W/.../connectors/src/manager.ts:151-152`；官方包导入 `:6`） | 同样结论（公理 3「传输是可替换细节」；约束 C3「出站能力优先生成官方 MCP 配置而不是新造一个运行时」，`R/docs/plan/connector-architecture.md:65-74,129`） |
| 凭据 | 只存**引用名** `authorizationCredentialRef`，值写官方 `ctx.credentials.set`，读回只说"设没设/能不能改"（`manager.ts:65-70,209` 命名 `WORKDSH_CONNECTOR_<SERVER>_AUTHORIZATION`） | 已定同口径（`connector-architecture.md:519-534`） |
| 按会话收敛 | `agent/created` 时 `agent.ctx.tools.restrict({deny: 未选中连接器的 mcp__<server>__*})`（`manager.ts:214-222`） | 可采纳的硬手法（比读时过滤更硬） |
| 健康检查 | 真调 `list_mcp_resources` / `list_mcp_resource_templates`（`manager.ts:170-195`），不是只看配置 | 可采纳 |
| 未完成 | 交互式 OAuth、多账号、公共授权、安装目录、完整审计、写操作确认（`connectors/README.md:9,32`） | 我们的 P1/P2 正是这些（公网入站桥接、邮件、OpenAPI 适配器、平台能力面） |

**采纳/丢弃：**

- **采纳（复用其结论）**：①不自建 MCP 传输；②`definitions` / `selections` 分表 + 按会话 `tools.restrict(deny)`；③凭据只存引用名 + 只回「已配置」；④真健康检查。
- **丢弃**：把"连接器"做成本机 Storage Domain 的独立小世界——我们的连接条目必须进**企业侧账本**（可见范围 + 策略 + 审计），这是 workdsh 没有的一层（`connector-architecture.md:536-543`）。
- **页签落点**：能力中心 · 连接（员工侧词），只呈现"已接好的系统 / 需要配置 1 项凭据 / 这台设备暂不支持"三态（`connector-architecture.md:564-575`）。
- **成本**：页签本身 **0.5–1 人日**；**硬前置**：连接器 P0（12–20 人日，其中 MCP 出站 1.5–2.5、凭据 1.5–2.5、企业账本 2.5–4、员工侧呈现 2–3）。

### 3.4 行业应用页签

**判定：建议这一期不做，并且不做就不能注册占位页；若一定要做，内容来源不是新模块而是"配方包的分类"。**

**先摆三个事实：**

1. **workdsh 自己把它删了。** `W/.../skills/CHANGELOG.md:14`（`0.1.0-alpha.31`，2026-09-20）：「按用户决定删除能力中心「行业应用」标签入口（行业应用暂时用不到，暂无领域实现）；能力页工具栏保留专家/技能/连接器三个标签。」同一句在 `experts/CHANGELOG.md:14`、`connectors/CHANGELOG.md:14` 各出现一次 ⇒ 四页签版本（截图）**早于** alpha.31。
2. **workdsh 的 applications 域是 0 行骨架。** `W/.../plugins/applications/README.md:1-7`：「状态：**规划中，尚未实现**。目录已建立，不代表功能完成。」`find W/.../plugins/applications -type f` 只有 1 份 README + 8 个 `.gitkeep`（`docs/research/workdsh-other-features.md:60,590-591`），职责被写成「创建多应用与场景、**组合专家技能连接器**」。
3. **我们的 applications 域连骨架都不在本仓。** `R/` 全仓对「行业应用」零命中（`grep -rn "行业应用" R/` 只命中 workdsh 的调研文档自身）。

**判据（要不要做）：**

- **不要做**，如果"一个行业的做法"能用**一份智能体（配方）+ 一份分配**表达 —— **这是我们的现状**：服务端 `ent_preset_package` 已有"包 + 版本 + 分配"，只是还没有分类维度。
- **才要做**，如果出现这三种需求之一：①一个行业场景需要**多个智能体 + 固定协作顺序**（此时才需要"应用"这一层）；②行业做法需要**跨智能体共享的状态**（不是一份 composition 能表达的）；③行业应用要**独立计费/独立上架**。

**若一定要做，内容从哪来（建议）：** 落在**控制台已有的配方广场**上，给 `ent_preset_package` 加一个**行业/场景分类**（与 V37 的技能分类同族做法），员工侧只是同一批配方按行业分组的一个**投影**——**不新建领域模型、不新建表、不做新的发布流程**（与 phase2 §3.2 的"同一批行的不同露出方式，不是三套数据"同一条纪律，`R/docs/plan/enterprise-marketplace-phase2.md:260-267`）。
**成本**：若只做投影 **1.5–2.5 人日**（依赖配方线的分类维度）；若真做"组合多智能体"的运行时，**≥20 人日且与官方 Team 实验态耦合**——建议不做。
**这一期的动作**：**不注册页签**（pending 纪律），在 `docs/plan` 里留一行排期，等判据命中再说。

---

## 4 迁移清单（逐功能，三种判定）

**判定口径：**
· **移植** = 可抄代码/结构的（照它的形状写，含取值/守卫/边界）；
· **复用** = 只取结论/纪律/口径，不搬实现；
· **已有** = 我们已实现，本次只搬入口。

| # | 项 | workdsh 侧规模与位置 | 我们的落点 | 判定 | 人日 | 风险 |
|---:|---|---|---|---|---:|---|
| 1 | **能力中心侧栏入口 + 同一面板内的页签骨架**（页签条、默认页签、计数） | `workbench/src/harness/client.ts:19-28`（只注册 non-pending）+ `skills/src/client.tsx:95-98`（`main` key `workdsh-skills` + `sidebar.panellist` id 同名、order 30、label「专家 · 技能 · 连接器」）+ `SkillsPanel.tsx:220,249-258` | `ui/src/capability-center-entry.tsx`（新）：`sidebar.panellist` id `capability` + `main` key `capability`；页签条复用 `marketplace-entry.tsx:1425` 的 `EnterpriseMarketTabStrip` | **移植** | 1–1.5 | 低。风险：`main` key 与 list id **必须同名**（`dsh-client-ui-sidebar/.../slots.d.ts:43-44`「Each list id addresses the matching main panel」），不同名就是点不开的死入口 |
| 2 | **「卡片上直接 ＋ 安装」的动作形状与禁用口径** | `SkillsPanel.tsx:273-276`（`.market-card` + `＋`，`disabled = !entry.installable || installBusy`，`title` 给不可装原因） | `marketplace-entry.tsx` 的新卡片分区；**按 `entitled` 分两态**（安装 / 申请） | **移植（须改语义）** | 0.8–1.5 | 中。风险：直接照抄会做出"未分配也能装"的假按钮——违反 phase2 D1（`enterprise-marketplace-phase2.md:20`） |
| 3 | **分区标题 + 4 列网格 + 窄屏三档 CSS 取值** | `SkillsPanel.tsx:272,280`（`market-head`）+ `skills/src/client/styles.ts:7`（`.grid{repeat(4,minmax(0,1fr));gap:22px}`，1400/900/560 → 3/2/1 列） | `ui/src/marketplace-entry.tsx` 卡片分区样式 | **移植** | 0.5–0.8 | 低。风险：类名必须与本包其它源文件零交集（`marketplace-entry.tsx` 头部 `[POS]` 已立该纪律） |
| 4 | **pending 纪律**（未实现的功能连占位页都不注册） | `workbench/src/harness/client.ts:19-28`（`if (panel.pending) continue`）+ `BusinessPanel.tsx:12-22`（`pending` 字段与注释） | `ui/src/capability-center-entry.tsx` 的页签注册面 + `plugin/packages/ui/CLAUDE.md` | **复用** | 0.25–0.5 | 低 |
| 5 | **薄连接器内核**（不自建传输） | `connectors/src/manager.ts`（231 行）：分表 + `McpClient` 插件化 + 凭据引用 + 真健康检查 + `tools.restrict` | `connector-architecture.md` P0 的实现 | **复用** | 2–3 | 中。风险：与既有 66 KB 方案重复实现的风险（`other-features:568` 已记该风险） |
| 6 | **凭据只存引用名 + 观测面只说"设没设/能不能改"** | `connectors/src/manager.ts:65-70,209` | 连接器线 / 治理线 | **复用** | 0.5 | 低。风险：官方已注入的环境变量键不可覆盖（`connector-architecture.md:534`） |
| 7 | **按会话 `tools.restrict(deny)` 收敛工具命名空间** | `connectors/src/manager.ts:214-222`（`agent/created` → `applyRestriction`） | 连接器线 | **复用** | 0.5–1 | 低 |
| 8 | **发布确认凭证三段式**（challenge 绑定内容摘要 → 可信 UI 换一次性 proof → 提交点复验并消费） | `experts/src/runtime/confirmation.ts`（116 行；`:5-14` 顶部结论、`:16` TTL、`:64-74` confirm、`:80-98` consume、`:112-116` `timingSafeEqual`） | 配方线 / 控制台 / 治理线 | **复用** | 0.5–1 | 低（纯逻辑、无外部依赖）。风险：「谁算可信 UI」要在我们侧定义清楚 |
| 9 | **不可变修订 + 内容摘要幂等产物 id + `rename` 原子发布 + `EEXIST` 复验不覆盖** | `experts/src/runtime/preset-compiler.ts`（220 行；`:63-72` id 派生、`:94-107` 防漂移、`:143-168` 原子发布） | 配方线的智能体修订 | **复用** | 2–3 | 中。风险：依赖官方 `agentPresets.register()` 与我们装载方式的兼容性 |
| 10 | **技能目录 / 安装 / 卸载 / 有更新 / 详情 / 文件树** | —— | 已有：`R/plugin/packages/ui/src/marketplace-entry.tsx`、`skill-market.tsx`、`R/plugin/packages/bundle/src/skill-install.ts` | **已有（搬入口）** | 0.5–1 | 低 |
| 11 | **企业插件行 + `Switch` 一键装/卸** | —— | 已有：`ui/src/plugin-market.tsx` + `EnterpriseAccountStore` | **已有（搬入口）** | 0.5 | 低 |
| 12 | **配方员工端列表 / 详情 / 复制导入指令** | —— | 已有：`ui/src/preset-market.tsx`（`account-view.tsx:386` 的 `presets` 页签） | **已有（搬入口）** | 0.5 | 中。风险：它只是"复制一段指令"，没有一键启用（`enterprise-presets.md:29-31`），页签要如实说 |
| 13 | **资料库侧栏入口 + `main` 面板 + 管理门** | —— | 已有：`ui/src/library-entry.tsx`、`library-panel.tsx`、`library-gate.ts`，已在 `client.tsx:113-116` 接线 | **已有** | **0**（另：order 20→30 一行） | 中。风险：宿主侧资料库面**还没接线**（`ui/src/client.tsx:110-111` 自述"取数端口这一刀还是缺席的"），页面现在如实出「接入中」 |
| 14 | **四态投影 / 错误码唯一表 / 术语降维的失败自愈提示** | —— | 已有：`ui/src/list-state.ts`、`error-messages.ts`、`error-notice.tsx` | **已有** | 0 | 低 |

**统计：移植 3 项 · 复用 6 项 · 已有 5 项，合计 14 项。**

**前三项（性价比最高）——落点与人日：**

| 排序 | 项 | 落点 | 人日 |
|---:|---|---|---:|
| 1 | 能力中心入口 + 页签骨架 | `ui/src/capability-center-entry.tsx`（新）+ `ui/src/client.tsx` 追加一注册 | **1–1.5** |
| 2 | 「卡片上 ＋ 安装」双态动作 | `ui/src/marketplace-entry.tsx` 卡片分区（`entitled` 分安装/申请） | **0.8–1.5** |
| 3 | 分区标题 + 4 列网格 CSS | `ui/src/marketplace-entry.tsx` 样式段 | **0.5–0.8** |

---

## 5 纪律（从截图与源码提炼，落成我们的硬约束）

1. **pending 纪律：未实现的功能，连占位页都不注册。**
   证据：`W/.../workbench/src/harness/client.ts:19-28`（`for (const panel of businessPanels) { if (panel.pending) continue; … }`，且注释原文「Panels marked pending (助理、定时任务、更多) have no domain implementation yet: they register neither a sidebar entry nor a placeholder page until they actually ship」）+ `BusinessPanel.tsx:12-22`（`pending` 字段定义：「规划中、尚无领域实现的功能：不注册侧栏入口与占位页，实现完成后置 false」）。
   **与资料库那把"管理开关"的关系（必须说清）——两者是同一纪律的两个执行器，不是重复：**

   | | pending（编译/发版期硬开关） | 管理门（运行期软开关） |
   |---|---|---|
   | 判据 | 该**领域**根本不存在（行业应用、连接器、专家） | 领域**已实现、但宿主面还没接好**（资料库这一刀） |
   | 表现 | 代码里连座位都**没有**——不注册入口、不注册占位页 | 代码在、座位**按快照注册/真撤**：门关 → `dispose()` 一个占用者都不留；门开 → 两处座位一起注册 |
   | 默认 | 无（不存在） | **关**（`ENTERPRISE_LIBRARY_GATE_DEFAULT = false`，`ui/src/library-gate.ts:27-32`，理由原文：「资料库这一刀还没有可接入的宿主面，默认开着只会给每位员工多一个进不去的入口」） |
   | 用户可见 | 什么都看不到 | 组件行显示「未开启」+ 一句人话（`ui/src/marketplace-entry.tsx:874`：「打开后左侧会出现「资料库」入口」）；写失败留稳定码 + 重试（`ENT_LIBRARY_SETTING_READ_FAILED`/`_SAVE_FAILED`） |
   | 证据 | `client.ts:19-28`、`BusinessPanel.tsx:12-22` | `library-entry.tsx:81-112`（`if (!gate.getSnapshot().enabled) { dispose?.(); … }`）、`library-gate.ts` 全文件 |

   **纪律条款**：能力中心的**专家 / 连接 / 行业应用三个页签，这一期连 `main` 面板都不注册**（不是"注册一个写着敬请期待的页面"）。技能页签是唯一注册项。以后某个域真的可用了，它要么整体开（pending→false），要么走管理门（默认关）——不许出现第三种"半开"形态。
2. **不替换官方 sidebar，只做 `sidebar.panellist` 增量。**
   证据：官方 `sidebar` 是 `single`/root 槽、被 `ui-sidebar` 独占（`dsh-client-ui-layout/lib/types/client/index.d.ts:33-48`）；workdsh 自己的纪律也写死了这一点（`W/.../workbench/README.md:5`：「工作区、会话、新会话、搜索、筛选、创建工作区、工作区菜单、会话菜单和设置全部保留 Harness 官方 Sidebar occupant。WorkDSH **不替换整块 sidebar**，也不复制这些行为；通过公开 Slot 增量加入…」）。
   配套：**不复用任何已撤销/已占用的 id**——`enterprise-store` 已被用户撤销（`ui/src/client.tsx:164-166`），`library` 已被资料库占用（`library-entry.tsx:14`），官方占 `plugins`(0)/`schedules`(10)。能力中心取 `capability`(20)，资料库让位到 30。
3. **一键即达：卡片上直接动作——但有权限才给"安装"，没权限给"申请"。**
   证据（正面）：workdsh 卡片上 `＋`（`SkillsPanel.tsx:273-276`）+ 分区标题明写"点击 ＋ 直接安装"（`:272`），符合宪法 §二「一步即达」（`R/docs/notes/product-charter.md:29`）。
   证据（约束）：我们**浏览自由 · 安装受控**（`R/docs/plan/enterprise-marketplace-phase2.md:20`）；`entitled` 是服务端真值，客户端**不得自行推理**（同文 `:391`）。
   **禁止**：给未分配技能画一个点不动的"安装"按钮（零死按钮），或给一个能点但一点就 403/404 的按钮。
4. **管理动作收右上，行/卡上只留状态与一键。**
   证据：workdsh 把搜索、我安装的、批量管理、最近卸载、＋ 添加技能全部收在 `cap-header`（`SkillsPanel.tsx:249-264`），行上只留 `Switch` 与 `•••` 菜单（`:229-232`）。我们现状相反（动作全在行上），本次只搬"搜索 + 我安装的 N"，其余（批量/回收站/添加）按 §4 判定不做。
5. **术语降维（员工侧文案，宪法 §三强制）。**
   强制映射：`专家 → 智能体`（我们自己加的裁定，理由见 §3.1）、`连接器 → 连接`、`MCP/OpenAPI/OAuth/stdio/webhook → 不出现`、`preset/YAML/manifest/.dshpreset → 不出现`、`assignment/分配 → 可见范围`、`凭据/API Key → 需要配置 1 项凭据`、`未分配 → 需要申请`。
   证据：`R/docs/notes/product-charter.md:36-46`；落地先例：本轮把「组件」页签改叫「包含内容」、把内部模块路径（含 `dsh-preset` 字样）从树上撤掉（`marketplace-entry.tsx` 头部 `[OUTPUT]` 的"术语降维"段）。
6. **三态齐备 + 零白屏 + 零死按钮（含失败自愈）。**
   加载给轻提示、空说清"为什么空 + 下一步"、失败给人话 + 下一步 + **真的重发**的重试；未接线的控件**禁用并把原因写在页面上**（不是只挂 `title`）。
   证据：`library-panel.tsx` 头部 `[POS]`（「三态齐备、零白屏、零死按钮…上传／查找这些还没接上的控件一律禁用并把原因写在页面上」）+ 宪法 §二第 3 条（`product-charter.md:31-32`）。
7. **页签不得是死页签。**
   - 同面板方案（推荐）：页签恒可交互，未实现的**不出现**（pending 纪律），而不是出现一个禁用的空页签。
   - 若要跨面板（workdsh 方案）：必须 `hasCapability(key)` 守卫（`W/.../skills/src/client.tsx:94`），因为 `selectPanel` 对未注册 key **会抛错**（`dsh-client-ui-layout/lib/types/client/service.d.ts:26-32`）；禁用态要给原因文案，不能只 `disabled`。
   证据（我们既有口径）：页签条恒可交互、不做禁用项——`marketplace-entry.tsx:253-254` 注释原文：「页签条**恒可交互**（roving `tabIndex` + ←/→/Home/End 走焦并选中）：选中态与键盘可达是 tablist 自身的语义，把当前页签做成禁用项会让人以为它坏了」。
8. **样式与类名纪律：本包内类名零交集、只用 `--dsw-*` token、不新造颜色。**
   证据：`marketplace-entry.tsx` 头部 `[POS]`「本文件的类名与同包其他源文件**零交集**（两处 `<style>` 都是全局单类选择器，同名会互相覆盖）；主题只用 `--dsw-*` token，不新造颜色」；历史事故先例：`.own-market-tabs` 与 `plugin-market.tsx` 撞名（`:1232,1419-1420`）。

---

## 6 分期与人日

> 人日口径沿用仓库既有调研：**1 人日 = 1 名熟悉本仓库的工程师有效工作 6 小时，含实现 + 测试 + 文档**，不含排期等待与跨团队协调（`R/docs/plan/connector-architecture.md:581-582`）。
> 本节只计**信息架构与入口**的工作量；各域自身建设按各自方案另计。

### P0 — 「一个入口 + 一个活页签 + 一条纪律」（**4–7 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---:|---|
| P0-1 | 能力中心侧栏入口（`sidebar.panellist` id `capability`，order 20）+ `main` key `capability` 面板骨架 + 四页签条（同面板 tabpanel） | 1–1.5 | — |
| P0-2 | **技能页签入口搬迁**（复用既有目录/已装/详情/文件树/有更新，不新增取数逻辑） | 0.5–1 | P0-1 |
| P0-3 | **（不注册）** 专家 / 连接 / 行业应用三页签按 pending 纪律处理：页签文案保留在真源里但**不渲染**、不注册面板、不留占位页 | 0.25–0.5 | P0-1 |
| P0-4 | 资料库 `ENTERPRISE_LIBRARY_ENTRY_ORDER` 20 → 30（给能力中心让位；一行 + 一处断言） | 0.1 | P0-1 |
| P0-5 | 术语降维与失败态一致化（页签改名 + 面板首帧边界说明 + 卡片/行失败提示统一走 `EnterpriseErrorNotice`） | 0.5–1 | P0-1 |
| P0-6 | 测试迁移（新增能力中心 spec + 更新被精确数组断言锁住的三处旧断言，见 §7） | 0.5–1 | P0-1…P0-5 |
| P0-7 | 卡片网格分区（可安装/浏览语义）+「卡片上 ＋ 安装 / 未分配给申请」双态 | 0.8–1.5 | ⚠️ **依赖"申请"入口**（见下）；若申请链未就绪，本期先只做"安装"一态并把未分配行**不渲染动作**（不画死按钮） |

**P0 合计 = 4.15–7.1 人日**（逐项下限 1+0.5+0.25+0.1+0.5+0.5+0.8 = 3.65；上限 1.5+1+0.5+0.1+1+1+1.5 = 6.6；区间取 **4–7**）。

**P0 的"尚不存在的能力"（必须显式标注）：**
① **「申请」入口与审批链不存在**（`enterprise-marketplace-phase2.md:308` S5「完全不存在」）；
② **技能分类的读写路径不存在**（列已在 `V37`，但代码零消费，`skill-ingest-center.md:729`）⇒ P0 **不做分类筛选行**；
③ **宿主侧资料库面还没接线**（`ui/src/client.tsx:110-111`）⇒ 资料库入口现在能出现、能进、但页面出「接入中」。

### P1 — 「页签真的开始有内容」（**3–5 人日，不含各域自身**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---:|---|
| P1-1 | 智能体（专家）页签接入配方线（列表/详情/复制导入指令先上；**一键启用**等配方二期） | 1–1.5 | ⚠️ 配方二期 P0（真启用面）`enterprise-presets.md:726-741` |
| P1-2 | 连接（连接器）页签接入连接器 P0（一条 MCP 出站 + 凭据 + 三态呈现） | 1–1.5 | ⚠️ 连接器 P0 12–20 人日（`connector-architecture.md:587-601`） |
| P1-3 | 分类筛选行（依赖 `V37` 的 `category` 读写路径 + 一个目录查询参数） | 0.5–1 | ⚠️ `skill-ingest-center` P1-6（标记读写路径）`skill-ingest-center.md:713` |
| P1-4 | 右上动作条补「我安装的 N」独立分区 + 搜索贯通四个页签 | 0.5–1 | P0-7 |
| P1-5 | 「申请」入口 + 审批（员工侧申请、管理侧批准→写 assignment） | 0.5–1（页签侧） | ⚠️ phase2 S5（服务端不存在） |

**P1 合计 = 3.5–6 人日**（页签侧）。

### P2 — 「生态与长尾」（**4.5–8 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---:|---|
| P2-1 | 批量管理（多选 + 批量启用/停用/卸载 + 确认弹窗） | 1.5–2.5 | P0-7 |
| P2-2 | 最近卸载（回收站 + 凭据 + 恢复；需新增落盘与状态文件） | 1.5–2.5 | ⚠️ `skill-install.ts` 现在是直接删目录，无回收站 |
| P2-3 | 行业应用页签（只在 §3.4 判据命中时立项；建议先做"配方按行业分组"的投影） | 1.5–2.5 | ⚠️ 配方线分类维度 |
| P2-4 | 智能体资产头部（不可变修订 + 依赖锁 + 发布确认凭证）+ 官方 Team 双钩子准入 | 与配方线合并计价（`other-features:627-631` 建议 8–12 人日立项） | ⚠️ 官方 Team 仍是实验能力（`experts/README.md:74`） |
| P2-5 | 卡片网格细节（窄屏容器查询、骨架屏替换纯文字加载态） | 0.5–1 | P0-7 |
| P2-6 | 管理动作权限收敛（谁能批量、谁看得到回收站）+ 审计事件扩枚举 | 1–2 | ⚠️ 迁移号须与 `V38`/`V39`/`V40` 对齐（`skill-ingest-center.md:865`、`connector-architecture.md:583-585`） |

**P2 合计 = 7.5–13 人日**（含 P2-4 的配方线合并部分则更高）。

**三期相加（IA 部分，不含各域自身）：≈ 12–18 人日；其中 P0（4–7）是唯一可以立刻开工的部分。**

---

## 7 对既有测试与已上线 UI 的迁移成本

### 7.1 已经发生过的断言迁移（**先例在眼前，照它办**）

**这一节不是推演，是复核到的事实。** `R/plugin/packages/ui/src/client.tsx:113-116` 现在无条件调用 `bindEnterpriseLibrarySeats(...)`，而 `bindEnterpriseLibrarySeat` **无论门开关都会走一次 `ports.inject(seatName, …)`**（`library-entry.tsx:88`）⇒ `slots.inject` 的调用面里出现了 `sidebar.panellist` 与 `main`（占位者仍然一个都没有，因为管理门默认关）。这**恰好触达**了三处把调用面/座位面逐项精确锁死的断言。

**我读到的两次状态（同一批文件，相隔约 2 分钟，mtime 可复核）：**

| 文件:行 | 改动前（`15:23` / `16:13` 版，我第一轮读到） | 改动后（`18:08` 版，现文件） |
|---|---|---|
| `ui/tests/client.spec.ts:61-72` | `expect(slotsInject.mock.calls.map(c => c[0])).toEqual([…7 项…])` | **追加两项**：数组末尾加 `'sidebar.panellist'`, `'main'`（并在上方注释里写明"本刀新增的最后两处是资料库的两处座位…管理门默认关，故这里同样一个占用者都不注册"） |
| `ui/tests/client.spec.ts:133-139` | 注释「那两处座位…不再注册」+ 对 **inject 面** `not.toContain('sidebar.panellist')` | 注释改写成「**注意**：本刀之后这两个槽名会被资料库的两处座位 inject 到…但管理门默认关，所以**注册表里仍然一行都没有**；这里锁的就是「没有占用者」而不是「没有 inject」」——断言对象从 **inject 面**改成 **registrations（占用者）**，语义更准且仍然锁死"默认关时不占座" |
| `ui/tests/account-gate.spec.ts:66-81` | `expect(injected).not.toContain('main')` / `not.toContain('sidebar.panellist')` | inject 面**追加** `'sidebar.panellist'`, `'main'`；`not.toContain` 的对象改为 `registrations.map(options => options['name'])`，并新增一条 `expect(...).not.toContain('library')`（连"已撤的商店 id 不许回来"的兄弟锁一起补） |
| `R/plugin/packages/bundle/tests/bundle.spec.ts:100` | 注释以"六处→四处"为座位数口径 | **需同步**（本次未复核是否已改；它是注释级口径，不影响通过） |

**这三处（`client.spec.ts` 两处 + `account-gate.spec.ts` 一处）的做法与本方案 §7.3 的策略完全一致**（追加期望、把"撤销锁"从"没有 inject"改成"没有占用者"）⇒ 结论：**能力中心那一刀照这份先例办即可，不需要发明新的测试迁移方式**；同时它也证明"**314 条一条未删**"这条纪律在资料库那刀被严格遵守了。

### 7.2 若采纳改动会进一步触达的断言

| 文件 | 规模 | 触达原因 |
|---|---|---|
| `R/plugin/packages/ui/tests/marketplace-entry.spec.ts` | **66 例**（本包最大） | 页签真源（`ENTERPRISE_MARKET_TABS`/`ENTERPRISE_MARKET_TABLIST_LABEL`/`enterpriseMarketTabLabel`）、`ENTERPRISE_MARKET_COMPONENTS` 四行、`EnterpriseMarketInlineRows` 行结构、`.own-market-storeTabs` 类名、版本签/分类签取值——**只要改页签数组或行→卡片，就会批量命中** |
| `R/plugin/packages/ui/tests/account-view.spec.ts`（6 例）/ `skill-market.spec.ts`（13 例） | 19 例 | 设置弹窗里的页签与技能行投影；若把设置里的市场页保留不动，则**零触达** |
| `R/plugin/packages/ui/tests/client.spec.ts`（4 例）/ `account-gate.spec.ts`（13 例） | 17 例 | 注册面精确数组（见 7.1） |
| `R/plugin/packages/ui/tests/brand-occupants.spec.ts`（13 例）/ `library-entry.spec.ts`（12 例）/ `library-gate.spec.ts`（6 例） | 31 例 | 与资料库共用"有内容才占座/视图驱动注册"手法；能力中心若同样走视图驱动注册，可**直接复用**这套断言范式（`library-entry.spec.ts` 就是模板） |

### 7.3 必须给出的策略：**"不破坏既有 314 条 ui 测试"**

> 口径说明（三句话，必须一起读）：
> ① **`314 条`是用户给定值**，与 `R/docs/notes/ux-debt-audit.md:484`「ui 包：**281 → 314 条**（22 → 24 个 spec）」同源；
> ② **它是"这一刀之前的基线"，不是"今天的实测值"**：资料库那一刀在我取证期间又新增了 2 个 spec 文件（`tests/library-entry.spec.ts` 12 例、`tests/library-gate.spec.ts` 6 例）并给 `account-store.spec.ts` 加了 1 例；
> ③ 同一口径下**实测（18:10）**：`R/plugin/packages/ui/tests/` 共 **26 个 `*.spec.ts`**、**329 处**以 `it(` / `it.each(` / `test(` 起始的用例行（计数方法：按行首 `^[[:space:]]*(it|test)(\.each)?\(` 匹配；其中 `account-store.spec.ts:44` 的 `it.each(['server','account','sign-out','old failure'])` 展开 4 例 ⇒ 有效用例约 **332**）。**我未运行 vitest**（并发编辑期间不制造额外构建动作），故不宣称精确值；且并发会话仍在加用例，这个数会继续变。
> **策略不受这个数影响**：下面五条对"314"与"今天的 329/332"同样成立。

**五条策略（按优先级）：**

1. **一条都不删。** 改动只允许两种形态：**新增用例**、**在既有精确数组断言上追加期望项**。沿用本仓库已有先例：`ux-debt-audit.md:484` 记录上一刀「既有 281 条**一条未删**」。
2. **新增座位/新页面用自己的新 spec 文件锁**（如 `tests/capability-center.spec.ts`），**不把新期望塞进 `marketplace-entry.spec.ts`**——那份文件已经 66 例，再塞会让"行结构"与"入口结构"的失败原因混在一起。（先例：资料库那刀新开了 `library-entry.spec.ts` / `library-gate.spec.ts` 两个文件，而不是往既有文件里塞。）
3. **被精确数组锁住的那几处，照 §7.1 已发生的先例改**：
   - `client.spec.ts:63-72`：数组**追加** `'sidebar.panellist'`、`'main'`，并在数组上方注释写明"新增哪两处、原来七项未动、门关时不产生占用者"；
   - `client.spec.ts:133-139`、`account-gate.spec.ts:76-81`：把锁定对象从 **inject 面** 改成 **registrations（占用者）**，并把注释里的"不再注册"改写成"**只 inject、默认关、一个占用者都不注册**"——这样既保留"已撤的商店入口没回来"这层保护，又给资料库/能力中心的座位留出空间；
   - `bundle.spec.ts:100`：只改注释口径，不改断言逻辑。
   **判据**：凡是"某个槽名不该出现"的断言，都要先问清是**inject 面**还是**占用者面**——我们的座位面是视图驱动（有内容才占座），所以"不该出现"的正确含义几乎总是**占用者面**。
4. **页签真源只保留一份。** 四个页签只能来自 `ENTERPRISE_MARKET_TABS`（或它的改名版）**同一个导出**；**不要**为能力中心新建第二份页签数组——两份真源会立刻让锁定用例互相漂移（这正是 workdsh 三份 `capabilityTabs` 的病）。
5. **先基线后改动，逐个文件对 pass 数。** 改动前先跑 `pnpm --filter @dshent/ui test` 建立基线（资料库那刀已在 `18:08` 同步过 §7.1 那三处断言，**预期基线是绿的**；若实测有红，先判断是不是并发会话的中间态，再动手），改完逐文件比对导出数与通过数；**禁止**用"删用例/放宽断言"换绿。

**一句话策略**：**只追加、不删减；精确数组断言用"追加期望"更新（并补上"门关不注册"的正向锁）；新座位新文件；页签真源只留一份。**

---

## 8 开放问题 · 明确不做 · 不确定项

### 8.1 开放问题（≤5）

1. **入口名定哪个？** §1.3 给了 A/B/C 三案（`能力` / `智能体 · 技能 · 连接` / `能力中心`）。这决定侧栏 label 与面板 h1，也决定 §7 里"文案级"断言要动几处。
2. **第四枚页签放什么？** 用户给定是「行业应用」，我建议**不做**（§3.4）。若要补第四枚，候选是**官方插件导览**（`selectPanel('plugins')` 跳转，0.5–1 人日）或**已安装**（与"我安装的 N"合并）。
3. **页签结构选甲（同面板 tabpanel）还是乙（跨 `main` 面板导航）？** 甲省事、乙可独立装卸。**建议甲**；若选乙，测试与工作量重估（§2.0）。
4. **未分配技能的动作是"申请"还是"不渲染动作"？** 依赖审批链（现在不存在）。P0 若申请链未就绪，我建议**不渲染动作**（宁可不给，也不给死按钮）；但这会削弱"浏览自由"的体验。
5. **资料库的 order 20 是否让给能力中心？** 我建议让（改一行 `library-entry.tsx:23` 为 30）；若坚持"资料库在前"，则能力中心取 30——但那就与截图"能力中心在资料库之前"相反。

### 8.2 明确不做（≥4 + 理由）

1. **不替换官方 sidebar 整列、不注册官方已占的 `id`（`plugins`/`schedules`）、不复用已撤销的 `enterprise-store`。**
   *理由*：官方 `sidebar` 是 `single` 槽、注册即整列替换（`dsh-client-ui-layout/.../index.d.ts:33-48`）；重复 `id` 会让 `panels.map` 出现两行同 id + React key 冲突（`enterprise-marketplace-phase2.md:390`）；`enterprise-store` 是用户明确撤销的 id（`ui/src/client.tsx:164-166`）。
2. **不把已装/受管行改成 4 列卡片网格。**
   *理由*：行语义（启用态 + 有更新 + 行内失败）是管理语义，卡片化会与详情子页面重复；`jingyun-dsh-appstore.md:610-616` 已否掉网格+内滚这条路；`marketplace-entry.spec.ts` 69 例会大面积重写。卡片只用于"可安装/浏览"分区。
3. **不给 pending 的三页签注册占位页/空面板。**
   *理由*：pending 纪律本身（`workbench/src/client.ts:19-28`）；宪法「零死按钮」。
4. **P0/P1 不做「最近卸载」（回收站）。**
   *理由*：需要新增落盘（trash + receipts）+ 恢复动作 + 权限口径，而我们的卸载现在是直接删目录（`skill-install.ts:451-465`）；收益低、破坏面大（涉及既有 `installed.json` 状态形状与 8 个真实导入的回归）。
5. **不搬 workdsh 的样式实现与 Office 全家桶。**
   *理由*：workdsh 每个插件各维护几百行 CSS 与自绘图标（`experts/styles.ts` 394 + `skills/styles.ts` 199 + `projects/styles.ts` 131），抄来等于继承 4 套并行样式（`other-features:587-588`）；Office 是 199 项打包依赖、自身未验收完（`other-features:584-585`）。
6. **不复制错误码→人话表。**
   *理由*：`R/plugin/packages/ui/src/error-messages.ts:53` 是**唯一一份**映射（文件头明确"界面只消费本模块，不再各写一份码表"）；workdsh 那张 19 条表只覆盖 35 个抛出码里的 19 个（`R/docs/plan/library-port.md:320`）。
7. **不自建 MCP 传输、不自建专家团执行器。**
   *理由*：前者是 workdsh 231 行拿到全部能力的核心结论（`connectors/src/manager.ts:151-152`）；后者被 workdsh 自己在 `AGENTS.md`（2026-09-15 决定）**禁止恢复**（`experts/README.md:47-51`、`other-features:593-594`）。
8. **不改任何代码/其它文档（本轮的硬约束）。** 本文是文档产出。

### 8.3 不确定项（逐条写为什么）

1. **截图版本 vs 本地检出相互矛盾，我无法判定截图对应哪个版本。**
   截图显示①四页签含「行业应用」②侧栏有「助理 / 定时任务 / 更多」。但本地检出：`skills/CHANGELOG.md:14` 记录 alpha.31（2026-09-20）**已删除**行业应用页签；`workbench/src/client/components/BusinessPanel.tsx:17-23` 把助理/定时任务/更多标 `pending:true`，而 `client.ts:19-28` 对 pending 项**连侧栏入口都不注册**。两者不可能同时为真 ⇒ 截图要么早于 alpha.31，要么来自另一分支/另一版本。**我的处理**：截图作为"目标形态"（按任务书读图结论），源码作为"纪律与实现手法"，冲突处如实并列（§1.1 的三处差异）。
2. **分类名清单（数据分析/效率工具/知识与学习/…）的出处未取到。**
   `grep -rn "效率工具\|知识与学习\|投资理财" W/` = **0 命中** ⇒ 它们不在 workdsh 源码里，而是运行期目录数据（`W/.../skills/src/services/catalog.ts:174` 指向 `WORKDSH_SKILL_CATALOG` 或 `agentsHome/.workdsh-catalog`）。**该 catalog.json 我未取到**，故**不能**宣称我们的分类体系要与它一致；我们的分类来源应是 `V37` 的 `category` 列（且该列代码零消费）。
3. **本仓库 `plugin/packages/ui/` 正被另一会话并发修改，本文行号是快照。**
   `client.tsx` mtime `18:06:16`、`marketplace-entry.tsx` `18:06:04`、`library-entry.tsx` `18:04:33`、`library-panel.tsx` `18:04:39`、`library-gate.ts` `18:03:58`（读取时刻 `18:06:41`）；随后 `tests/client.spec.ts` mtime **`18:08:33`**、`tests/account-gate.spec.ts` **`18:08:38`** 又被改过一次（§7.1 记录的就是这次）。我在本轮中**亲眼看到** `client.tsx` 从 180 行长到 200 行并新增资料库接线 ⇒ 行号随时可能变。复核时请以 `git diff` / 文件 mtime 为准。
4. **"314 条"是用户给定的基线，我无法把它当成"今天的实测值"。**
   按 `^[[:space:]]*(it|test)(\.each)?\(` 这一口径实测：第一轮读到 **24 个 spec / 310 处**，取证末尾（18:10）已是 **26 个 spec / 329 处**（资料库那刀新开了 `library-entry.spec.ts` / `library-gate.spec.ts`）⇒ **并发编辑使这个数字在移动**。我**没有运行** `vitest`（避免在并发编辑期间制造构建/依赖动作），故所有数字都是**静态计数**，不代表运行结果；§7.3 的策略不依赖精确数。
5. **官方 `main` 槽的 key 域"开放"这一条我只信本仓既有调研，未在 0.2.0-rc.2 契约里逐字核实。**
   我核到的是官方原文注释：「Central panel selected by sidebar entry id. The reserved `conversation` key hosts the Conversation; other keys receive no Session binding.」（`dsh-client-ui-layout/lib/types/client/index.d.ts:49-56`）——它说 `conversation` 是**保留**键，但**没有**一句说"其它 key 随便用"。phase2 §1.2 把它读作"key 域开放"（`enterprise-marketplace-phase2.md:77`）。我采信但标注为"经调研转述"，`capability` 这个 key 的合法性是**推断**而非取证。
6. **workdsh 的 `docs/` 不可读**（被 `.gitignore` 排除，`ls workdsh-web/docs` → No such file），故 `PLAN/STATUS/modules.json/UI-DESIGN/ADR` 全部未取到。影响：本文引用的 workdsh"页面结构/纪律"全部来自**源码与 README**，其"计划阶段/验收证据"我无法核对（与 `other-features:641` 记录同一限制）。
7. **资料库宿主面（bundle 侧）的完成度不确定。**
   `R/plugin/packages/bundle/src/library/` 已有 7 个文件（`errors/keys/records/domain/objects/manager/index`），且有 7 个 `library-*.spec.ts`；但 `bundle/src/library/index.ts` 头部自述「**本刀刻意不接线**：`bundle/src/index.ts` 里没有一行 import 它」——而 bundle 的 tests 目录里已有 `library-e2e.spec.ts` 等。**这两者是否已被后续刀更新，我未复核**；故 §7.1 只说"UI 侧已接线"、§6 P0 前置只说"宿主侧资料库面还没接线（以 `ui/src/client.tsx:110-111` 自述为据）"。
8. **官方 Team 的实验态与上游缺陷**：workdsh 记录了一个上游可复现缺陷「seeded session constructor seed must equal its inherited prefix」（fork 历史查询），默认改用 fresh 成员（`experts/README.md:74`）。我**未在本机复现**，故 §3.1 的"Team 准入"路径保留"实验能力"标注而不承诺可用。

---

## 附录 A · 本次只读取证索引（供复核）

| # | 事实 | 位置 |
|---|---|---|
| E1 | workdsh 只注册 non-pending 面板；pending 项连侧栏入口都不注册 | `W/workdsh-web/packages/plugins/workbench/src/harness/client.ts:19-28` |
| E2 | `pending` 字段语义与五个面板清单（助理/项目/定时任务/资料库/更多） | `W/.../workbench/src/client/components/BusinessPanel.tsx:12-22` |
| E3 | 「不替换整块 sidebar」+「能力中心保持单入口，内部再分专家/技能/连接器」 | `W/.../workbench/README.md:5` |
| E4 | 「技能页面和侧栏能力中心入口归 Skill Client 所有」 | `W/.../bundle/README.md:26` |
| E5 | 能力中心侧栏入口（id `workdsh-skills`、label「专家 · 技能 · 连接器」、order 30） | `W/.../plugins/skills/src/client.tsx:95-98` |
| E6 | 三页签真源（专家/技能/连接器）+ 每页签在自身面板里再渲染一遍 | `W/.../skills/src/client/SkillsPanel.tsx:220,251-257`；`experts/.../ExpertsPanel.tsx:184,200-206`；`connectors/.../ConnectorsPanel.tsx:35,39` |
| E7 | 右上动作条（搜索/我安装的 N/批量管理/最近卸载/＋添加技能） | `W/.../skills/src/client/SkillsPanel.tsx:249-264` |
| E8 | 「技能市场」标题 + 刷新 + 来源切换（本地技能/SkillHub） | `W/.../skills/src/client/SkillsPanel.tsx:265-266` |
| E9 | 分类筛选行（数据驱动，全部 + 求并集去重） | `W/.../skills/src/client/SkillsPanel.tsx:214,268`；`skills/src/services/catalog.ts:95` |
| E10 | 分区标题「可安装 N —— 来自本地技能目录，点击 ＋ 直接安装」 | `W/.../skills/src/client/SkillsPanel.tsx:272` |
| E11 | 卡片网格 4 列 + 窄屏 3/2/1 档 | `W/.../skills/src/client/styles.ts:7` |
| E12 | 卡片上直接 `＋` 安装（含 disabled 与 title 原因） | `W/.../skills/src/client/SkillsPanel.tsx:273-276` |
| E13 | 专家**不注册** sidebar 的显式自述 | `W/.../plugins/experts/src/client.tsx:29-31`（英文注释：deliberately does NOT register a `sidebar.panellist`） |
| E14 | 专家只注册 `main` key `workdsh-experts` + 输入框 overlay | `W/.../plugins/experts/src/client.tsx:171-175` |
| E15 | 连接器只注册 `main` key `workdsh-connectors` + `conversation.input.left` | `W/.../plugins/connectors/src/client.tsx:20-27` |
| E16 | **行业应用页签已被用户决定删除**（alpha.31，2026-09-20；三个包各记一次） | `W/.../skills/CHANGELOG.md:14`、`experts/CHANGELOG.md:14`、`connectors/CHANGELOG.md:14` |
| E17 | 行业应用域是 0 行骨架（仅 README + 8 个 `.gitkeep`，职责=组合专家技能连接器） | `W/.../plugins/applications/README.md:1-7` |
| E18 | 薄连接器内核：官方 MCP 客户端插件化 + 显式空 env + 重连参数 | `W/.../plugins/connectors/src/manager.ts:148-155`（231 行文件） |
| E19 | 按会话 `tools.restrict({deny})` 收敛命名空间 | `W/.../plugins/connectors/src/manager.ts:214-222` |
| E20 | 发布确认凭证三段式（challenge/proof/consume + `timingSafeEqual`） | `W/.../plugins/experts/src/runtime/confirmation.ts`（116 行；`:5-14,16,64-74,80-98,112-116`） |
| E21 | 内容派生 id + 原子发布 + `EEXIST` 复验不覆盖 | `W/.../plugins/experts/src/runtime/preset-compiler.ts:63-72,94-107,143-168`（220 行） |
| E22 | 官方 `main` 槽契约（保留键 `conversation`；其它键无 Session 绑定） | `@deepseek-ai/dsh-client-ui-layout/lib/types/client/index.d.ts:49-56` |
| E23 | `ctx.layout.selectPanel` 与"未注册 key 会抛错" | `@deepseek-ai/dsh-client-ui-layout/lib/types/client/service.d.ts:24-32` |
| E24 | `sidebar.panellist` 契约（list/root；list id 指向同名 main 面板） | `@deepseek-ai/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts:42-50` |
| E25 | 官方两处 panel row 实注册（`plugins` order 0 / `schedules` order 10）与 zh label「插件」 | `dsh-client-ui-plugin-manager/lib/client.js:58,3427,3534-3540`；`dsh-client-ui-schedule/lib/client.js:5330,5437-5443` |
| E26 | 面板列表按 `order` 升序（`Array.sort` 稳定，同 order 保持注册序） | `dsh-client-ui-sidebar/lib/client.js:390-397`（`syncPanels`） |
| E27 | 我们现有注册面（4 处 + 品牌 3 处）+ 资料库两处新座位接线 | `R/plugin/packages/ui/src/client.tsx:100,113-116,150-183,184-199` |
| E28 | 页签条实现与"恒可交互、不做禁用项"口径 | `R/plugin/packages/ui/src/marketplace-entry.tsx:1425-1460`、`:253-254` |
| E29 | 页签真源 / 组件四行 / 资料库管理门那一行 | `R/plugin/packages/ui/src/marketplace-entry.tsx:70-104`、`:44-59`、`:872-876` |
| E30 | 资料库侧栏入口 + main 面板 + 管理门（默认关、真撤、失败可重试） | `R/plugin/packages/ui/src/library-entry.tsx:14,23,42-59,81-143`；`library-gate.ts:27-32,126+` |
| E31 | 资料库页面三态与"未接线控件禁用并写原因" | `R/plugin/packages/ui/src/library-panel.tsx` 头部 `[POS]` |
| E32 | 设置弹窗里的市场页签（account/plugins/presets/skills/sessions） | `R/plugin/packages/ui/src/account-view.tsx:79,383-389` |
| E33 | 被精确数组锁死的断言，以及它们在资料库那刀的**已发生**迁移方式（inject 面追加 / 锁改指占用者面） | `R/plugin/packages/ui/tests/client.spec.ts:61-72,133-139`（18:08 版）；`tests/account-gate.spec.ts:66-81`；`R/plugin/packages/bundle/tests/bundle.spec.ts:100` |
| E34 | ui 包测试规模口径「281 → 314 条、22 → 24 个 spec、一条未删」；**今天实测（18:10）26 个 spec / 329 处用例行**（并发会话仍在加） | `R/docs/notes/ux-debt-audit.md:484`；`R/plugin/packages/ui/tests/`（含新增 `library-entry.spec.ts` 12 例、`library-gate.spec.ts` 6 例） |
| E35 | 技能列已落地但代码零消费（`builtin`/`featured`/`category`；最新迁移 `V37`） | `R/docs/plan/skill-ingest-center.md:50,73-79,486-490,713,729` |
| E36 | 真实导入 8 个技能 + 门禁/幂等/落盘证据归档 | `R/docs/plan/skill-install-sources.md:94`（`~/.sshwork/sh-import/EVIDENCE.md`） |
| E37 | 「并集可见」的既有口径（两处安装/卸载共用一份归属查询） | `R/docs/plan/skill-install-sources.md:711` |
| E38 | 配方线现状：服务端/控制台完整、员工端只读、官方无 preset 导入面 | `R/docs/plan/enterprise-presets.md:25-33,65-80,95-116,214-230` |
| E39 | 资料库必须是独立一级入口（含官方 slot 落点与验收） | `R/docs/plan/library-port.md:762-781` |
| E40 | 承载形态与槽位取证（`sidebar.panellist`/`main`/禁止重复 id/不可内嵌官方页） | `R/docs/plan/enterprise-marketplace-phase2.md:20,41-77,236-247,387-395` |
| E41 | 连接器三层架构、七公理、人日与"不自建传输" | `R/docs/plan/connector-architecture.md:25-36,44-133,564-575,587-641` |
| E42 | workdsh 可借鉴清单/不建议抄/专家模块建议（含人日） | `R/docs/research/workdsh-other-features.md:562-580,582-597,617-635` |
| E43 | 市场卡片网格的既有否证（2 列 + 内滚、`alert`/`confirm` 等） | `R/docs/research/jingyun-dsh-appstore.md:610-643` |
| E44 | 术语降维表与三支柱（宪法） | `R/docs/notes/product-charter.md:16-46` |

## 附录 B · 本轮的只读操作与硬约束自查

- **新建文件**：仅 `R/docs/plan/capability-center-ia.md`（本文件）。
- **未修改**：任何 `.ts` / `.tsx` / `.json` / `.yml` / 其它 `.md`（含 `docs/CLAUDE.md` 成员清单——留给实施者按 `[PROTOCOL]` 补行）。
- **未执行**：`git commit` / 任何部署 / 任何服务重启 / `pnpm install` / `vitest`；未写入 `/tmp`。
- **读取范围**：`R/`（只读）、`W/`（只读）、官方安装目录 `@deepseek-ai/dsh`（只读）。全程未改一字。
- **未取到（遵守"不编造"）**：workdsh 的 `workdsh-web/docs/**`（被 `.gitignore` 排除）、运行期 `catalog.json`、workdsh 的 `deepseek-harness` 子模块本体、ui 包测试的精确运行结果。

---

## 抽取出的通用纪律（不依赖能力中心，已转为通用规则）

以下几条与「是否做能力中心」无关，已作为通用规则用于后续所有 UI 工作：

1. **pending 纪律**：未实现的功能**连占位页都不注册**（域不存在 ⇒ 连座位都没有）。
   与"运行期软开关"（如资料库的管理开关：域已实现但宿主面未接 ⇒ 门关则一个占用者都不留）区分开。
2. **不替换官方 sidebar，只做 `sidebar.panellist` 增量**；不复用已撤销/已占用的 id。
3. **一键即达**：有权限才给"安装"，未分配给"申请"；**禁止给未分配画点不动的按钮**。
4. **管理动作收右上，行上只留状态与一键**。
5. **术语降维**：员工侧 preset→智能体、connector→连接；MCP/YAML/preset 等词不出现；"未分配"→"需要申请"。
6. **三态齐备 · 零白屏 · 零死按钮 · 失败自愈**。
7. **页签不得是死页签**（同面板 tabpanel 方案下，未实现的不出现）。
8. **样式纪律**：类名零交集、只用 `--dsw-*` token。

另记一条与本文件无关但很有价值的产品结论（供配方线命名决策用，不在本次实施范围）：
「**专家 ⊃ 官方 preset**」——workdsh 的专家 = 资产作者面（不可变修订/依赖锁/确认凭证）+ 编译面
（presetId 内容派生幂等）+ 准入面（agent/created + agent/pre-step 双钩子）；官方 preset 只是其编译产物。
我们的配方目前只覆盖"编译产物 + 企业分发"这一段。建议未来**合并为一条线、两个词各管一层**
（员工侧叫「智能体」、管理侧叫配方/预设），把现有 ent_preset_* 三表当"版本发布与分配账本"，
下面补不可变修订表、上面补作者编辑面，**不推倒重来**；明确**不恢复**专家团执行器。

