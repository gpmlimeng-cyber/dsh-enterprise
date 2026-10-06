<!--
[INPUT]: 依赖用户口径（连接器 = 插件市场页的第五枚页签，与技能/插件/配方/组件同一套体系）、`docs/plan/connector-architecture.md`（能力模型 §3 / 员工侧呈现 P0-5 / 分期 §7 / 开放问题 §8）、`docs/plan/mcp-conformance.md`（合规边界 §2 / 配置型 bundle 交付形态 §3 / 字段契约 §4）、`plugin/packages/ui/src/marketplace-entry.tsx`（页签真源、共享控制器、行子块、四态、座位）、`plugin/packages/platform-client/src/local-api.ts`（同源路由与唯一码表）、`docs/notes/direction-decisions.md`（口径 2/17/18/26）。
[OUTPUT]: 「连接器（MCP）」作为插件市场页第五枚页签的**市场面落地方案**——页签真源的逐处同步点、组件台账行、行模型与行 facts、行版式、内容区四态、详情面形态裁决与逐段内容、添加下拉两条写入口、市场面→官方安装面那条链的实现约束、Host 路由与码表增量、权限与凭据的界面落法、市场面增量人日、明确不做与不确定项。**本文只钉落点与形状，不新增能力元数据**：能力声明字段与 L1/L2/L3 判据以 `connector-architecture.md` §3 为准，官方合规边界以 `mcp-conformance.md` §2 为准，两者冲突时以那两份为准。
[POS]: docs/plan 下连接器线的**第三份、也是最后一份**——`connector-architecture.md` 给「能力与分期」，`mcp-conformance.md` 给「实现约束」，本文给「员工侧界面落在哪、长什么样」。它把 P0-5 那句「员工侧最小呈现：连接列表」从一句话展开成一套与既有页签同构的界面，因此**会使 P0-5 的人日上升**（§13 如实算差额）。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 连接器（MCP）页签 · 市场面方案

## 0. 一句话结论

用户口径：**连接器 = 插件市场页（官方插件页里的「插件市场」入口卡片）的第五枚页签**，与
**技能 / 插件 / 配方 / 组件** 四枚**同一套体系**（同一棵外壳、同一份控制器、同一枚行子块、同一套四态、同一个详情形态）。

```text
本页签 = connector-architecture.md §7 的 P0-5「员工侧最小呈现」的那个落点。
本文【不新增能力】：能力声明字段（§3.1）、L1/L2/L3 判据（§3.2）、六类连接适配规格（§4）、
中国开箱即用清单（§5）、部署形态（§6.4）一律不改，仍以 connector-architecture.md 为准。
本文只回答四件事：
  ① 页签真源要动哪几处（逐处 file:line，一处不漏，否则会出现「页签在、面板不在」）
  ② 每一行长什么样、事实从哪来、开关管什么
  ③ 详情面放什么（含形态裁决：整页切换还是内容区替换）
  ④ 市场面那两条写入口，最终怎么落到官方唯一安装面（`install_bundle`）上
```

**可见文案的用词**：页签显示 **「连接器」**，**不含** `MCP` 字样——照 `connector-architecture.md:519-520` 的术语降维纪律
（三步里不出现 MCP/OpenAPI/webhook/OAuth/证书/YAML），`MCP` 只允许出现在**后台管理端**与
**客户端详情里的「技术信息」折叠区**。

---

## 1. 这条口径落进既有文档的哪一格（以及它不碰什么）

### 1.1 它命中的就是 P0-5，不是新增项

`connector-architecture.md:592-593` 原文：

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P0-5 | 员工侧最小呈现：连接列表（三态：可用/需确认/不支持）+ 首次同意 + 可撤回；术语降维 | 2–3 | P0-3、P0-4 |

本文的工作＝把「连接列表」从一句话**展开成与既有四枚页签同构的界面**。
⇒ 所以它**不是**新一期，而是 **P0-5 的细化**；代价是 P0-5 的 2–3 人日不再成立（§13 算差额，不悄悄吃掉）。

### 1.2 先例：配方入页签是同一条处置（可直接照抄形状）

`docs/notes/direction-decisions.md` 第 2 条（2026-10-02）：

> 「配方也要放到**插件商店**，作为**企业配方页签**与企业技能、企业插件**并排**」
> ⇒ 处置：市场页新增「企业配方」页签（**位次在企业插件之后、包含内容之前**），复用共享行渲染、子页面详情。

⇒ 本文**逐字沿用这条口径的三个要素**：① 位次规则（**台账页恒居末**）；② 复用共享行渲染；③ 子页面详情而不是弹窗。

### 1.3 它不碰什么

| 不碰 | 理由 |
|---|---|
| `capability-center-ia.md`（侧边栏「能力中心」四页签方案） | `direction-decisions.md` 第 3/4 条已判**未来规划（用户明确搁置）**。本文是**市场页内**的页签，两者不冲突：能力中心将来若启动，本页签原样搬过去即可 |
| 技能 / 配方 详情的**整页切换**形态与其反向锁 | 口径 17/18② 明确：不改、也不放宽。本文只**登记**它与插件详情形态的既有差异（§8.1），不趁机统一 |
| `ENTERPRISE_MARKET_PLAN`（:379-384） | 它是**历史排期元数据、不驱动渲染**（:377-378 自述）。不加连接器行 |
| face A（`plugin-market.tsx`，「企业设置 → 插件」） | 口径 17：未点名不动 |

---

## 2. 页签真源：六处必须同步（漏一处就是「页签在、面板不在」）

全部在 `plugin/packages/ui/src/marketplace-entry.tsx`。**逐处给现值与目标值**：

| # | 符号 | 现值（行号） | 目标 | 漏了会怎样 |
|---|---|---|---|---|
| 1 | `EnterpriseMarketTabId` | `:386` `'skills' \| 'plugins' \| 'presets' \| 'components'` | 加 `\| 'connectors'` | 类型层挡住后面五处，编译即红（**这一处是安全网，先改它**） |
| 2 | `ENTERPRISE_MARKET_TABS` | `:396-402` 四项 | 在 `presets` 与 `components` **之间**插 `{ id: 'connectors', label: '连接器' }` | 页签条不出现 |
| 3 | `ENTERPRISE_MARKET_TAB_IDS` | `:534-539` 四组 `{tab,panel}` | 加 `connectors: { tab: 'market-tab-connectors', panel: 'market-panel-connectors' }` | `id`/`aria-controls`/`aria-labelledby` 三处不同源 ⇒ 读屏报「控件不存在」 |
| 4 | `EnterpriseMarketDirectoryTabId` | `:557` `'skills' \| 'plugins' \| 'presets'` | 加 `\| 'connectors'` | 行键投影 `enterpriseMarketRowKey`（`:563`）与 `EnterperpriseMarketInlineRows` 的 `tab` 形参接不上 |
| 5 | `ENTERPRISE_MARKET_COMPONENTS` | `:368-373` 四行 | 加第五行（见 §3） | 「组件」台账里没有连接器 ⇒ 台账说「共 4 个」，与实际五枚页签矛盾 |
| 6 | `ENTERPRISE_MARKET_SUMMARY` | `:354` `'企业插件 · 技能 · 配方'` | 追加 ` · 连接器` | 官方把 `summary` 渲染**两次**（列表卡描述 + 详情页正文，`:344-346`）⇒ 卡片会漏说连接器 |
| **7** | **测试锚点**（不是源符号——漏了要么「页签在、门禁红」，要么更糟「页签在、门禁照样绿」） | `plugin/packages/ui/tests/marketplace-entry.spec.ts`：八条 `toHaveLength(4)`（`:722`/`:830`/`:978`/`:1233`/`:3038`/`:3927`/`:4100`/`:4453`）、四条 `'共 4 个 …'`（`:939-945`）、两份 DOM 大纲（`:297` `LEGACY_SHELL_OUTLINE` / `:367` `LEGACY_PLUGINS_OUTLINE`）、窄屏算术锁（`:3671` `expect(tabsTotal).toBe(212)`） | 八条计数 4→5、四条摘要 4→5、两份大纲按既有先例再基线化（`direction-decisions.md` 第 16 条同款）、算术锁按**逐枚**文案重算 | 前八条与四条摘要**会红**（安全网，好事）；两份大纲**不重基线化必红**；★算术锁**加了第五枚页签也照样绿**（见 §2.1） |

**位次**：`presets` 之后、`components` 之前。依据是口径 2 那句「**包含内容之前**」——
`components` 是**台账页**（恒 `ENTERPRISE_MARKET_COMPONENTS.length` 行、不是目录），它必须恒居末。
默认页签 `ENTERPRISE_MARKET_DEFAULT_TAB`（`:406` = `'skills'`）与 `ENTERPRISE_MARKET_TABLIST_LABEL`（`:409` `'企业市场'`）**不动**。

（上述 §2 六处的行号已在 2026-10-05 的 task-14/15 落地后**逐条复核过**，`386 / 396 / 557 / 368 / 354 / 519 / 409` 全部未漂——那一刀改的是 `:2900` 之后的样式区，没动这些符号。）

### 2.1 ★ 第 7 处里藏着一条**假锁**：它保护的正是它测不到的那件事

窄屏算术用例的 `TAB_LABELS = ['技能','插件','配方','组件']`（`spec:3588`）与
`TAB_LABEL_CHARS = 2`（`spec:3665`）都是**测试内的局部字面量**，`tabsTotal` 由它派生（`spec:3669`）
⇒ 源里加第五枚「连接器」时这条锁**不会红**：它会继续拿旧的四枚清单算出 212，并「证明」窄屏放得下。
而「**连接器**」是**三个全角字**（不是 2）——标量 `TAB_LABEL_CHARS` 在模型上根本表达不了它。

**实测反证**（本机截图硬测量；DPR 由搜索框 `max-width:320px` 反推 = 890/320 = 2.781）：
页签轨真实宽度 ≈ **270 CSS px**，而不是注释与用例里写的 212——差 27%。原因是模型只算了
「两个全角字 + 24px 内衬」，**漏了页签文案里那截计数文本**（`enterpriseMarketTabLabel`（`src:550`）
把 `label` 与 `count` 拼成 `技能 11`，计数就在页签**里面**）。且 212 被注释成
「**上界**（数字计数是半角，真实更窄）」——方向说反了：**多几个字符只会更宽**，212 是**下界**。

⇒ **C0 的落地要求**（写进那一刀的任务书，别只写「加第五枚页签」）：

1. 这条锁改成**从源真源 `ENTERPRISE_MARKET_TABS` 派生**枚数与逐枚文案，禁止在测试里另养一份清单；
2. 文案宽按**逐枚**长度算并**含计数文本**（`enterpriseMarketTabLabel(label, count)`）——CJK 取 1em、
   数字与空格取 0.5em 上界，并把该假设写进注释（**不许再出现「上界」与实际方向相反的表述**）；
3. 断言不再拿 `≤ viewport` 当判据（可用宽 ≠ 视口宽）；
4. 「第五枚加进来会不会在 360px 溢出」必须变成**会红的用例**。按上述模型，加「连接器 3」后页签轨
   ≈ **345–350 CSS px**，360px 视口下**已经要靠 `overflow-x:auto` 横向滚动兜底**——
   「212 < 360 ⇒ 连滚动都用不上」这句话届时必须改写，且**这是可接受的降级**（窄屏横向滚动是既有设计），
   但**不许**继续拿一个漏项的模型声称它放得下。

---

## 3. 组件台账加第五行

`ENTERPRISE_MARKET_COMPONENTS`（`:368-373`）每行是 `{ gate, id, label, module, note, reserved }`。建议：

```ts
{ gate: 'session', id: 'connectors', label: '连接器',
  module: 'mcp-client · cordis-plugin-development',
  note: '企业统一接好的系统，点一下就能用', reserved: false },
```

**`gate` 取 `'session'` 而不是 `'local'` 的理由**：企业下发是主路径（管理员配好、员工只读），
目录本身要登录才取得到——这与技能/插件/配方三行同一条口径。
★ 但「用户自定义」那条（用户口径里的「也支持用户自定义配置」）是**本机行为**，与 `gate` 表达的
「这枚开关归谁管」是两件事：本机自定义走 §9 的「手动添加」写入口，**不**因此把门控改成 `'local'`。
（若产品最终要求「未登录也能配本机连接器」，那是把门控从 `session` 降成 `session || local` 的**第七处改动**，
需显式裁决——本文按现状取 `session`，并把这条列进 §15。）

**五件门控投影不用改**：`enterpriseMarketComponentEnabled`（`:1649`）、`…State`（`:1657`）、
`…Dot`（`:1669`）、`…SwitchDisabled`（`:1680`）、`…SwitchTitle`（`:1699`）**五件都按 `id` 查表**
（`ENTERPRISE_MARKET_COMPONENTS.find(...)`）⇒ 加一行即自动生效；计数摘要
`enterpriseMarketComponentSummary`（`:1719`）与 `…SummaryText`（`:1731`）同样自动跟随。

---

## 4. 行模型：一个类型 + 一份行投影 + 一份行 facts

### 4.1 `EnterpriseMarketConnectorRow`（字段草案，逐字段给真源）

照 `EnterpriseMarketPluginRow`（`:1026-1090`）的**两源归并**形状（企业目录 × 本机受管态）：

| 字段 | 类型 | 真源 | 缺席时 |
|---|---|---|---|
| `id` | `string` | 企业侧连接条目的稳定 id | — |
| `displayName` | `string` | 企业目录的显示名（**员工侧看到的只有这个**，不是 `serverName`） | — |
| `description?` | `string` | 企业目录的描述 | 第二行如实说「暂无描述」 |
| `category?` | `string` | 企业目录的分类（进七类归一 `enterpriseMarketCategory`，`:431`） | 归「其他」 |
| `state` | 见 4.3 | 本机受管态（未启用/连接中/已启用/停用/失败） | — |
| `inCatalog` | `boolean` | 企业目录是否仍提供（`false` = 已下架但本机仍配着） | — |
| `availability` | `'ready' \| 'needs-confirm' \| 'unsupported'` | **P0-5 的三态**（`connector-architecture.md:592`）；由「本平台能力面 × 凭据是否可写 × 是否被分配」求值 | 恒 `'ready'` 须有证据，否则不许默认 |
| `credential` | 见 §12.2 | 官方 `ctx.credentials.describe()` 的 `{configured, source?, writable}` | — |
| `permissionCeiling` | `'L1' \| 'L2' \| 'L3'` | 企业策略的上限（§3.2/§6.3） | 不许缺席即当 L1 |
| `toolCount?` | `number` | 连上后注册的工具数 | 全段不进 DOM |
| `errorCode?` | `string` | 该行最近一次失败的稳定码 | 不产出该键 |

### 4.2 `enterpriseMarketConnectorRows(…)`（纯函数投影）

照 `enterpriseMarketPluginRows`（`:1092`）的形状：按 `id` 归并企业目录与本机记录，**目录顺序优先**。
★ 纪律：**不做任何过滤**（过滤在 `enterpriseMarketShellModel` 那一处统一做，`:1831`），
空值一律**归一成「没有这个键」**而不是空串。

### 4.3 `EnterpriseMarketConnectorRowFacts`（行 facts，唯一口径）

照 `enterpriseMarketSkillRowFacts`（`:2013`）/`enterpriseMarketPluginRowFacts`（`:2103`）的形状，至少含：

| 事实 | 口径 |
|---|---|
| `enabled` | **本机启用位**（≠「装没装」）。开关 `checked` 的唯一真源 |
| `busy` | 请求在途（开关禁用，**失败后不禁用**——再拨一次就是重试，`:588-590` 既有口径） |
| `statusLabel` | 可见中文状态词（**术语降维**，见 §12.1） |
| `dot` | `StateDotState`（`done` / `idle`），照 `enterprisePluginDot`（`:1609`） |
| `lockReason` / `lockNotice` / `switchTitle` | 禁用原因的**唯一判定**（照 `plugin-install-gate.ts` 的 `enterprisePluginLockReason` 手法）+ **可见说明**（产品宪法：禁用即须有可见说明，不许只挂 `title`，`:3380-3389` 已记这条硬约束） |
| `availabilityLabel` | 三态的可见词（§12.1） |
| `versionTag` / `categoryTag` | 两枚签，照技能行的短号口径（`:1416` 只显示最后一个 `@` 之后那段，完整坐标进 `title`） |

---

## 5. 行版式：`EnterpriseMarketInlineRows` 加 `connectors` 分支

`EnterpriseMarketInlineRows`（`:5692`）是**唯一**的行实现点（`:3092` 自述其唯一性）。加一档与 `plugins` 同款：

```text
图标 + 两行文案（标题 / 描述）+ 状态点 + 官方状态词 + Switch + 行下失败提示
```

三条**有意**的取舍：

1. **行上不给卸载**——破坏性操作只在详情里（口径 18① 对插件行定的同一条规则，`onUninstallPlugin` 注释 `:829-834`）。
2. **行上不给工具数 / 权限等级 / 传输方式**——两行 clamp 的卡片放不下，且它们是**技术面**信息，归详情（§8.3）。
3. **行本体是真 `<button class="own-market-rowOpen">`**（进详情），动作是它的**同级兄弟**——
   与技能/配方/插件行同款（`:9599` 那套 notes：「不靠 `stopPropagation`，结构性保证」）。
   ★ 官方 `ItemCard` 的标题行 DOM 装饰那套（`market-entry-badge.ts`）**只管市场入口卡片那一行**，与目录行无关，不要混。

---

## 6. 内容区四态：直接复用 `enterpriseMarketPanelState`

`enterpriseMarketPanelState`（`:1198`）是四态的唯一投影（`hidden` / `loading` / `empty` / `failed` / `ready`），
四个目录页签共用。连接器加第五档**不需要新写投影**，只需三句文案常量（照 `:1216-1226`）：

```ts
export const ENTERPRISE_MARKET_CONNECTORS_LOADING = '正在加载连接器…'
export const ENTERPRISE_MARKET_CONNECTORS_EMPTY =
  '企业还没有发布任何连接器。请联系企业管理员接入，或稍后刷新再看。'
export const ENTERPRISE_MARKET_CONNECTORS_FAILED = '连接器目录加载失败'
```

**空态文案必须与技能/插件同口径**（`:1218` / `:1224` 的句式「企业还没有发布任何…请联系企业管理员…或稍后刷新」）——
三个目录页签说同一件事时说同一句话，不许各写一套。

失败态渲染**唯一提示组件** `EnterpriseErrorNotice` + 稳定码 + **真重发**的重试
（`EnterpriseMarketListHint`，`:4411`；「失败 ≠ 空」这条口径见 `:1213-1215`）。

---

## 7. 外壳装配：`EnterpriseMarketLegacyShell` 加一个 `<EnterpriseMarketPanel>`

`EnterpriseMarketLegacyShell`（`:6439`）的列表支里，四枚页签各是一个
`<EnterpriseMarketPanel tab=… activeTab={model.activeTab}>`（`:6540-6605`）。加第五个完全同形：

```tsx
<EnterpriseMarketPanel tab="connectors" activeTab={model.activeTab}>
  {model.activeTab === 'connectors' && model.connectorsPanel.kind !== 'hidden' ? (
    <section className="own-market-section" data-market-section="enterprise-connectors">
      {model.connectorsPanel.kind === 'ready' ? (
        model.visibleConnectors.length === 0 && model.filtering
          ? <EnterpriseMarketFilteredHint onClear={props.onClearFilters} />
          : <EnterpriseMarketInlineRows tab="connectors" model={model} props={props} />
      ) : (
        <EnterpriseMarketListHint state={model.connectorsPanel} onRetry={props.onRetryConnectors} />
      )}
    </section>
  ) : null}
</EnterpriseMarketPanel>
```

**搜索 / 筛选 / 分组自动生效**：三道过滤与七类分组都写在 `enterpriseMarketShellModel` 一处
（`:1885-1930`），加 `visibleConnectors` + `connectorGroups` 即接上。
`ENTERPRISE_MARKET_SEARCH_PLACEHOLDER`（`:519` `'搜索技能、插件、配方'`）需补成
`'搜索技能、插件、配方、连接器'`。

**`EnterpriseMarketShellModel`（`:1777`）需加**：`connectorsVisible` / `connectorsPanel` /
`visibleConnectors` / `connectorGroups`，并在 `tabCounts`（`:1932`）里加 `connectors: connectorsVisible ? rows.length : 0`
（口径：**门控不过即如实记 0，绝不在面板空白时还喊有 N 条**，`:1931`）。

---

## 8. 详情面

### 8.1 ★ 形态裁决（本方案唯一的真分叉）

本页同一页里**已存在两种详情形态**：

| 面 | 形态 | 依据 |
|---|---|---|
| 技能详情 / 配方详情 / 系统搜索 / 在线搜索 | **整页切换**（列表 + 页签条一起不挂载） | `:6486-6503` 四个 return 分支 |
| 插件详情 | **内容区替换**（页头和四枚页签保持可见、一字不改） | 口径 18② + `EnterprisePluginContentRegion` 的 `detail ?? list` 互斥 |

**建议连接器取「内容区替换」（= 插件那一套）**，理由三条：

1. 用户本轮原话是「**整体和这个页面插件的体系差不多**」；
2. 连接器详情要**长期停留**（看能力清单、权限等级、凭据状态），页签还在就还能横切；
3. 插件详情是本页**最新**一刀的形态，且已由 `EnterprisePluginContentRegion` 提供了现成的互斥容器
   （同一个 `data-enterprise-plugin-region` 判据那一族）。

**代价与纪律**：这样第五枚页签与技能/配方**不同形**——但那是**已存在的不一致**，本文
**不趁机去统一它们**（照口径 17/18②：不动、也不放宽它们的锁），只在本文与
`docs/notes/direction-decisions.md` 里**如实登记**。若要统一，另开一刀、由用户裁决。

### 8.2 详情的输入形状

照 `EnterprisePluginPageProps`（`:2197`）/`EnterpriseSkillPageProps`（`:5220`）/`EnterprisePresetPageProps`（`:5434`）：
新增 `EnterpriseConnectorPageProps` 与纯函数 `EnterpriseConnectorDetailPage`（**无 hook**，可直接函数调用测试——
本文件的既有形状，`:6437` 自述「纯函数、无 hook（`useState` 在共享控制器里）」）。
`EnterpriseMarketShellProps` 新增 `connectorPage?: EnterpriseConnectorPageProps`（`:628` 那一大块的末尾）。

**同源纪律**（这是本文件的硬规矩，`:926-932` / 口径 15 逐字）：详情里的每一件事实都由共享控制器
用**行上同一份**真值构造——同一个 `EnterpriseMarketConnectorRow`、同一份
`enterpriseMarketConnectorRowFacts`、同一批回调 ⇒ **详情里不存在第二套状态或第二个动作实现**。

### 8.3 详情逐段（每段给真源 + 拿不到时说什么）

| 段 | 内容 | 真源 | 拿不到时 |
|---|---|---|---|
| ① 标题行 | 面包屑「返回连接器列表」（`aria-label` 给完整动作语义）+ `h3` + **「企业」徽章** | 徽章复用 `EnterpriseMarketBadgeTag`（`:250` 一族的出口） | — |
| ② 事实表 | 「由企业统一管理」/ 本机状态 / 最后连通时间 | 行 + 本机记录 | 整格不出，**不编造** |
| ③ 能力清单 | 逐条工具一行：**人话名** + 权限等级可见词（§12.1） + 是否需每次确认 | 连接器能力声明（`connector-architecture.md` §3.1） | 整段进折叠「技术信息」，正文说「暂时读不到能力清单」+ **真重发**的重试 |
| ④ 凭据 | 「已配置 / 未配置 / 只读 / 由企业统一管理」 | 官方 `describe()` 的 `{configured, source?, writable}`（`connector-architecture.md:520-534`） | 整段说「暂时读不到凭据状态」。★**永不说值** |
| ⑤ 动作区 | 启用/停用开关（**与行同源同一枚**）、`重新连接` | 同一份 facts + 同一个 `onToggleConnector` | 写入口缺席 ⇒ 开关禁用 + **可见原因**（不许死控件） |
| ⑥ 技术信息 | `<details>` 折叠：`serverName` / 传输方式 / 地址 / 稳定码 | 企业目录 + 本机 | 缺席即整段不出 |

★ **③④⑤ 与 §12 是同一件事的两面**：能力清单（权限等级）与凭据状态是连接器详情**区别于**
技能/插件/配方详情的两段，也是这份方案里唯一**真正新增**的界面内容。

---

## 9. 「添加」下拉：给连接器页签一档

现状 `enterpriseAddMenuEntries(tab)`（`:3435-3438`）：`skills` 一档，**其余页签返回 `[]` ⇒ 整段不渲染**
（`:3429-3431` 自述这就是本仓「预留」的正确表达——不是渲染一枚空的）。

给 `connectors` 一档，两项：

```ts
const ENTERPRISE_CONNECTOR_ADD_MENU_ENTRIES = [
  { id: 'from-catalog', label: '从企业目录添加', conditional: false },  // 企业预置（员工侧只读）
  { id: 'manual',       label: '手动添加',       conditional: false },  // 用户自定义配置
]
```

**术语**：不许出现 MCP / stdio / URL / 地址 / 协议等词（`:519-520` 纪律）⇒ 文案就这四个字与六个字两枚。

**写入口必须走座位、不能走 props**：触发这两项的「添加」下拉住在**官方标题行槽树**里，而它们要打开的
面住在**页面树**里——**两棵 React 树**，props 传不过去。这是 `EnterpriseMarketTabSeatState`
（`:4046`）存在的唯一理由（`:31-32` 自述）。故给座位加两枚可选回调（照 `onImportSkill :4066` 的形状）：

```ts
readonly onAddConnectorFromCatalog?: (() => void) | undefined
readonly onAddConnectorManual?: (() => void) | undefined
```

**缺席口径**照既有：那一项 `disabled` + **可见原因**（不许「可点但 no-op」，`:4087`/`:4092`）。

---

## 10. 市场面 → 官方安装面：那条链的实现约束

两项写入口**最终落成同一个动作**，区别只在**谁来填那份 config**（`mcp-conformance.md:31-34` 逐字）：

```text
员工点「从企业目录添加」          员工点「手动添加」
        │                                  │
   企业目录已有：端点/认证/能力清单      用户填：显示名 + 地址或命令 + 凭据引用
        └──────────────┬───────────────────┘
                       ▼
        ① 生成一个「配置型 bundle」目录（**恰好两个文件**）
             package.json      → name / version / dsh.bundle.patch          （官方模板 7 行）
             cordis.patch.yml  → - insert: [{ id, name: '@deepseek-ai/dsh-mcp-client', config }]
           config: serverName（企业冻结）/ transport / url|command / failOnStartupError: true
        ② 直调我们自己的插件服务面：plugin_manager 的 install_bundle，target = 绝对包目录
        ③ 官方安装面负责写 profile 的 package.json / cordis.patch.yml，并让 mcp-client 加载
        ④ 如实上报 application：failed / overridden / restart-required（三态都要上屏）
        ⑤ 验收动作：调 mcp__<serverName>__<tool>（mcp-conformance.md:260-276）
```

### 10.1 三条**绝不做**（`mcp-conformance.md:70-91` 的硬边界，逐条对应）

| 不做 | 依据 |
|---|---|
| **不写 profile 的** `package.json` / `cordis.patch.yml` | `SKILL.md:10` 逐字禁止；**判据：路径是否落在 `<DSH_HOME>/profiles/<name>/` 之下**——在 bundle 目录里写 = 合规，在 profile 里写 = 违规 |
| **不建第二个安装器 / 第二套运行时** | `connector-architecture.md:679-681` §8.2 第 1 条 |
| **不复刻 shell 安装步骤** | `references/host-plugin.md:58`（经 `connector-architecture.md:204-205` 转引） |

### 10.2 三条配套纪律（都要落进界面）

| 纪律 | 界面后果 |
|---|---|
| 失败要「**修同一个 bundle**」，不重复建（`mcp-bundle.md:5`） | 同一行的重试**不产生第二条条目**（幂等：同一 `serverName` 只对应一个 bundle 目录） |
| 官方安装结果要**如实上报**三态（`host-plugin.md:60`） | `restart-required` 时行下出 `role="status"` 交代「已接入，需要重新打开客户端」——**不得把「未生效」说成「已连上」**（照 `:2593-2597` 三句常量那一族手法） |
| **一条条目 = 一个服务器**（`index.d.ts:4-5`） | 开关的粒度就是**一条连接器**；N 条 = N 个 insert 条目。★「一个 bundle 里放 N 个 insert 行不行」**未验证**（§15） |

---

## 11. Host 面增量（同源路由 + 唯一码表）

照 `local-api.ts` 既有形状（固定路径、严格解码、`LOCAL_API_PREFIX = '/enterprise/api/v1/local'`，`:56`）：

| 路由 | 形状 | 最接近的既有先例 |
|---|---|---|
| `GET  <local>/connectors` | 目录 × 本机态归并后的行清单 | `GET <local>/plugins`（`:976`） |
| `GET  <local>/connectors/<id>/status` | 本机三态 + 披露内容 | **`GET <local>/presets/<id>/status`**（`:1457` prefix 按后缀分派，`:1478`） |
| `POST <local>/connectors/<id>/{enable,disable}` | 方向由 path 决定 | **`POST <local>/plugins/{enable,disable}`**（`:948`/`:209` 两条 exact） |
| `POST <local>/connectors` | 手动添加：正文**关闭键集** | `POST <local>/skills/adopt`（`:1204` 关闭键集恰好 `{path}` 的先例） |

四条注册纪律（都是本仓踩过的坑，逐条引用）：

1. **exact 表整路径优先于 prefix**，且 prefix 只认 `pathname === prefix || startsWith(prefix + '/')`
   （引擎 `match()`；`:30` [POS] 逐字）。若有 `/connectors` prefix，子路径动作必须靠 exact 抢在它之前——
   与 `/skills/install` 抢在 `/skills` prefix 之前**同一条**（`:30`、`:133`）。
2. **注册 path 一律不带尾斜杠**——带尾斜杠的 prefix 会在引擎层空体 404 而根本不进 handler（`:30`）。
3. **关闭键集**：每个 body 只读固定键集，越界键 / 非字符串 / 空串 / 超长一律拒（`:1204` 那把尺）。
4. **失败码 → HTTP 状态的唯一映射** `enterpriseLocalErrorStatus`（`:502` 一族）加新码；
   bundle 侧路由与 platform-client 侧**必须共用同一张表**（`:3` 自述）。

---

## 12. 权限与凭据在界面上的落法

### 12.1 权限等级的词（**本文新造，需用户确认**）

`connector-architecture.md` §3.2 的 `L1/L2/L3` 是**内部判据**，不上屏。界面用词给三个候选：

| 候选 | L1 | L2 | L3 |
|---|---|---|---|
| **甲（推荐）** | 随时可用 | 会改动数据，先确认一次 | 每次都要你确认 |
| 乙 | 只读，放心用 | 写入前问你一次 | 每次写入都问你 |
| 丙 | 安全 | 需确认 | 高风险，逐次确认 |

推荐**甲**：它只说**会发生什么 + 你要做什么**，不评价服务好坏（产品宪法：不评价、不吓人）。
落点：详情 ③ 能力清单每条一行；行上**不上屏**（§5 取舍 2）。

### 12.2 凭据四态（**永不说值**）

`connector-architecture.md:520-534` 的四条口径 + 一条官方补充（环境已注入的键**不可覆盖**、会报只读）。
界面上只允许出这四种词：

```text
已配置 · 未配置 · 只读（由运行环境提供，改不了）· 由企业统一管理
```

★ **管理员改凭据的界面在后台（console），不在本页签**——本页签是员工侧，
员工看到的凭据区**只有状态、没有输入框**（除非走 §9「手动添加」那条本机自定义路径）。

### 12.3 管理员上限 vs 员工收紧

员工侧**不显示上限数值**，只显示**当前这条连接器能不能改**（`writable`）。
上限是策略输入（`§6.3`），显示它等于把管理面搬进员工面。

---

## 13. 分期与人日（**市场面增量**，逐项是我方估计、非既有文档的数）

> 口径沿用仓库既有调研（`connector-architecture.md:581-583`）：1 人日 = 1 名熟悉本仓库的工程师
> 有效工作 6 小时，含实现 + 测试 + 文档。

| 项 | 内容 | 人日 | 前置 |
|---|---|---|---|
| C0 | 页签骨架：真源**七处**（§2；第 7 处＝测试锚点，含 §2.1 那条**假锁**的改造 + 两份大纲再基线化）+ 组件行（§3）+ 行模型三件（§4）+ 四态（§6）+ 外壳装配（§7） | **2–3**（原 1.5–2.5；第 7 处是实打实的工作量，不悄悄吃掉） | — |
| C1 | 详情面（§8）：形态裁决落地 + 六段版面 + 同源接线 | 1.5–2.5 | C0 |
| C2 | 添加下拉两条写入口 + 座位两枚回调 + 缺席口径（§9） | 1–1.5 | C0 |
| C3 | Host 四条路由 + 码表增量 + 关闭键集（§11） | 1.5–2.5 | C0 |
| C4 | 权限等级词表 + 凭据四态上屏（§12） | 1–1.5 | C1 |
| C5 | 联调 + 反向锁（页签真源一致性 / 无死控件 / 术语不出现 MCP / 详情无 dialog 语义） | 1–1.5 | C0–C4 |

```text
市场面增量合计 ≈ 8–12 人日
```

### 13.1 ★ 与 `connector-architecture.md` §7 的关系（必须如实记，不许悄悄吃掉）

```text
connector-architecture.md:592-593  P0-5「员工侧最小呈现」= 2–3 人日（只算了"最小列表"）
本文把它展开成一套与既有四枚页签同构的体系 ⇒ 实际 ≈ 7.5–11.5 人日
⇒ 差额 ≈ 5–9 人日，是【新增】的
⇒ 修正后的 P0 = 12–20 → 约 17–29 人日（逐项区间相加：(12..20) − 3（P0-5 原区间上沿）+ (8..12)）
```

★ **这一条要回写进 `connector-architecture.md` §7 的 P0-5 行与本文件的 §13**，否则下一轮会按 12–20 排期。
另：§7 标题（`:587`）写 **11–18**、明细合计（`:599`）写 **12–20**——**既有不一致**，本方案的差额计算以明细为准。

---

## 14. 明确不做（本文范围）

1. **不做侧边栏「连接器」一级入口**——那是 `capability-center-ia.md` 的方案，`direction-decisions.md` 第 4 条已判
   **未来规划（用户明确搁置）**。本文只在市场页内加页签。
2. **不做入站（让人从飞书/企微发消息进来）**——用户已裁决「入站我们也不做」。
   ★ 连带后果（登记）：`connector-architecture.md` §4.7 整节（入站链路拓扑）、§8.1 开放问题 1、
   §8.2 第 4 条、§8.3 的第 4/5/8 条、§5 表第 6 行（微信公众号/服务号的「服务器配置指向我方 URL」= 纯入站形态）
   都随之作废或实质出局；P1-1/P1-2/P1-3 三项的 9.5–15 人日应删。**这些是 `connector-architecture.md` 的待修正项，
   本文只登记，不改它**。
3. **不写 profile 的 `package.json` / `cordis.patch.yml`**（§10.1 第 1 条）。
4. **不做第二个安装器 / 第二套运行时**（§10.1 第 2 条）。
5. **不改技能/配方详情的整页切换形态，也不放宽它们的锁**（口径 17/18②）。
6. **不改 face A**（口径 17）。
7. **不做内容安全扫描、也不声称做了**（`connector-architecture.md:683-685` §8.2 第 2 条）。
8. **不给「装一次永久放行」的 L3 快捷通道**（同上 §8.2 第 5 条）。
9. **不把连接器做成能改沙箱/权限/审批栈的东西**（同上 §8.2 第 6 条）。
10. **不在员工侧上屏任何技术词**：MCP / stdio / streamable-http / webhook / OAuth / token / YAML / `serverName`
    一律只在「技术信息」折叠区与后台出现（`:519-520` 纪律 + `:1229-1235` 已有的「上游名称带技术缩写时旁边补一句人话」先例）。

---

## 15. 不确定项（本文**没验**的，逐条写「为什么不确定」+「怎么验」）

1. **官方 `install_bundle` 是否支持「启用/停用」而不重装。**
   不确定的原因：`direction-decisions.md` 口径 11 把「查实官方 `installBundle(spec,{enabled})`」列为**待查**，
   本文未复验。**怎么验**：读 `dsh-plugin-manager` 的 `installBundle` 签名与 `plugin_manager` 工具的
   `action` 取值表，并真机走一次「停用→启用」看是否产生第二个 bundle。
   **它决定**：行上那枚开关是「装/卸」语义还是「启用/停用」语义（`:829-834` 对插件行定的口径是后者）。
2. **一个配置型 bundle 里能否放多条 `insert`（N 个 MCP 服务器）。**
   不确定的原因：`index.d.ts:4-5` 只说「一个插件实例连一个服务器，多个服务器要在 `cordis.yml` 里加载多个实例」，
   **没说**一个 bundle 的 patch 能否一次 insert 多条。**怎么验**：写一个含两条 insert 的 bundle，装一次看是否两条都生效。
   **它决定**：N 条连接器 = N 个 bundle（开关粒度干净）还是 1 个 bundle（开关粒度坏掉）。本文**按 N 个 bundle 设计**。
3. **装完是否**不需要重启**就生效。**
   不确定的原因：`connector-architecture.md` §8.3 第 1 条自述「本会话没有真机执行过一次」，但同文
   `:644-654` 的交叉引用说该条**已被配方线 spike 解决**——**同一份文档自相矛盾**（`:695` 说未验证、`:644` 说已验证）。
   本文按「已验证」采信（CLI/服务面不在授权闸门内、普通 Host 插件可达 `ctx.pluginManager`），但**残留一个真问题**：
   经 `install_bundle` 装上的 mcp-client 配置，**工具是否无需重启即出现在 `ctx.tools`**、重启后是否仍在。
   **怎么验**：临时 profile + 独立进程，装一条后立即查工具注册面，再重启复看（照 `.notes/preset-bundle-spike.md` 的方法，不动当前会话）。
4. **企业后台下发「服务器清单」时，凭据（认证头/密钥）怎么进到宿主进程。**
   不确定的原因：`mcp-conformance.md` §4.7 给的唯一合规写法是 Loader `!!js` **引用**（`process.env`），
   即要求那份 secret **已经在宿主进程环境里**；而「企业后台配好的服务器」意味着 secret 在企业侧。
   **谁把它放进宿主 env、以什么形式（登录时下发？宿主侧代理？服务端换取短期 token？）本文没有答案。**
   **怎么验 / 要谁拍**：需要一次设计裁决 + 一次真机走通（后台配一条 → 员工侧能用）。
   ★ **这是本文发现的最大真前置**：它不通，「使用企业配置好的服务器」这句就只能落到「员工侧也要填一次凭据」。
5. **`serverName` 由企业冻结的强约束，和「用户自定义」那条路径怎么共存。**
   不确定的原因：`mcp-conformance.md:183-197` §4.3 逐字——工具名 `mcp__<serverName>__<tool>` 是**不可逆契约**、
   `serverName` 是**本地命名空间**（不取远端 `serverInfo.name`）、改名 = 改工具名 = 作废会话历史与权限规则。
   企业预置可以冻结，**用户自定义时谁保证不自造冲突/易变的名字**？**怎么验**：定一条命名与去重规则（建议：企业条目用
   企业侧 id 派生、自定义条目要求用户给一个稳定短名并做正则与唯一性闸门），并写进 `mcp-conformance.md` 的生成器契约。
6. **连接器页签的门控要不要纳入本机（未登录可见本机自定义条目）。**
   不确定的原因：§3 取 `gate: 'session'`（企业下发为主），但用户口径里「也支持用户自定义配置」是**本机行为**。
   两者同时成立时，**未登录到底该不该看到连接器页签**？本文按现状取 `session`。
   **要谁拍**：产品裁决（一句话即可定）。
7. **`EnterpriseMarketShellProps` 目前已在 `:628-1007` 有约 70 枚字段**，再加连接器的 6–8 枚是否会到可维护性拐点。
   不确定的原因：没有量化的阈值，纯工程判断。**怎么验**：在 C0 那一刀实现后量一次
   `EnterpriseMarketShellProps` 的字段数与 `enterpriseMarketShellModel` 的分支数，若明显劣化则提议拆成
   「目录 props / 详情 props / chrome props」三块（**这是重构提案，不在本文范围**）。

---

## 16. 落盘登记（本文要改哪些文档）

| 文件 | 改什么 |
|---|---|
| `docs/plan/mcp-marketplace-tab.md` | **本文（新建）** |
| `docs/plan/CLAUDE.md` | 成员清单加本文一行（照 `:18` 那一行的密度与格式）+ 更新 `:20` 的阅读顺序（连接器线顺序：`mcp-conformance` → `connector-architecture` → 本文） |
| `docs/plan/connector-architecture.md` | **只登记、不改本文范围外的东西**：§7 的 P0-5 行注明「细化方案见 `mcp-marketplace-tab.md`，人日以那边 §13 为准」；`:587` 的 11–18 与 `:599` 的 12–20 对齐；入站相关条目按用户裁决标作废（§14 第 2 条） |
| `docs/notes/direction-decisions.md` | 加一条口径行：连接器 = 插件市场第五枚页签（位次、体系、术语降维、与 P0-5 的关系） |

**本文不改任何源文件**——只写方案。实现另开刀，每刀带自己的门禁读数。
