<!--
[INPUT]: 依赖本会话对官方 Harness `0.2.0-rc.2` 引擎安装目录的只读取证（`dsh-client-ui-layout` 的 `sidebar`/`main` 槽位契约、`dsh-client-ui-sidebar` 的 `sidebar.panellist` 契约、`dsh-client-ui-plugin-manager` 与 `dsh-client-ui-schedule` 的实注册范例、`dsh-client-ui-primitives` 的 `SegmentedTabs`/`SegmentedControl`、web-frontend dist 的静态模块注册表 `rM()`），依赖企业仓库既有实现事实（`plugin/packages/ui/src/marketplace-entry.tsx` 只占官方 `plugins.item`、`skill-market.tsx`/`plugin-market.tsx` 的行投影、服务端 `RuntimeSkillController`/`SkillRuntimeService`/`JdbcSkillStore.findVisiblePublished` 与 `V35__enterprise_skill_catalog.sql`），以及既有调研 `docs/research/iflytek-skillhub-integration.md` §方案 A。
[OUTPUT]: 给出企业扩展市场二期的承载形态取证结论（四问逐条带包名/文件/行号）、侧栏「应用商店」一级菜单 + 主内容区多页签的目标形态与每页签实现能力、内置/精选/商店三场景的重叠定位、三层可见性与「浏览自由·安装受控」的判定点与稳定错误码、服务端需补能力清单、P0/P1/P2 人日与前置依赖、SkillHub 的期次归位、不建议做的事与待用户拍板的开放问题。
[POS]: 二期实施前的唯一规划真源；把「商城从设置弹窗迁到主内容区」这一架构方向变更固化为可验收的能力清单，不宣称任何尚未实现的代码已完成。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 企业应用商店 · 二期规划（侧栏一级菜单 + 主内容区多页签）

状态：`planning`（未实现）
规划日期：2026-10-02（Asia/Shanghai）
取证基线：官方 DeepSeek Harness 引擎 `0.2.0-rc.2`（`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh`），只读取证，未改动。

---

## 0. 本规划要吸收的三个用户决定

| # | 决定 | 原文/口径 | 对本规划的影响 |
|---|---|---|---|
| D1 | **商店的安装权限：浏览自由 · 安装受控** | 商店里能看/能搜/能看详情；「安装」仍要求该技能对你是【内置】或【已分配】，否则只给「申请」入口（走审批），**不在商店里直接放开安装** | 目录查询必须与授权查询**解耦**（§4）；未分配行渲染「申请」而非 Switch；授权成为服务端显式判定 + 稳定错误码（§5） |
| D2 | **架构方向变更：不要放在设置页** | 「设置页是弹窗，面积有限，我希望是**主界面**，使用**主内容区**……**侧边栏增加一个菜单叫「应用商店」**，里面分几个页签，把官方的插件页面内嵌到「官方插件」页签，并行增加「企业技能」页签。」 | 承载形态从「官方 `plugins.item` 卡片」升级为「侧栏一级菜单 + 独立主内容区整页 + 多页签」（§2） |

| D3 | **两条入口并存（用户裁定 A）** | 新建「应用商店」侧栏一级菜单后，官方插件页里那张既有的企业市场卡片**保留**（先并存，观察后再收），语义改为「官方插件页里的企业快捷入口」→ `ctx.layout.selectPanel('enterprise-store')` 跳到整页并选中「企业技能」页签。**两条入口指向同一份 store，没有第二份数据。** | §2.2 的取舍从「二选一」改为「并存」；官方页里不会出现『企业入口消失』的观感；迁移期两条路径都要可用 |

### 0.1 本会话已确立、**不得推翻**的既有实现事实

1. 企业扩展市场当前**只占官方 `plugins.item` 槽位**（卡片一句话走 `summary`、详情正文走 `page`），**刻意不注册侧栏入口、也没有独立市场弹层**——见 `plugin/packages/ui/src/marketplace-entry.tsx` 第 3 行 `[POS]`。
2. `marketplace-entry.tsx` 是**纯函数组件 + hook 入口分离**风格；已实现：企业插件节、企业技能节（官方两行卡片）、技能行右侧 = `[辅助标签按钮(仅有更新)] [Switch]`、三节默认展开、失败行内反馈（`role="alert"` + 稳定错误码）。
3. 账号面板（设置弹窗内）有页签：`plugin/packages/ui/src/account-view.tsx`（`SettingsTab = 'account' | 'plugins' | 'presets' | 'skills' | 'sessions'`，`role="tablist"`）。
4. 员工端技能能力已打通：一键安装（实测 167ms）、卸载、幂等、落盘到 `~/.dsh/skills`、官方 watcher 免重启发现、「有更新」判定（已装 `versionId` ↔ 中心**详情**投影 `versionId`）。
5. 二期三场景：内置（列表默认可见）/ 精选（推荐区）/ 商店（独立浏览区）。

---

## 1. 任务一：承载形态可行性取证（四问逐条结论 + 证据）

> 取证方法：先 `cordis_inspect_list`（列出 9 个 Provider：host `Service`/`Event`/`Config`/`Tool`，client `Service`/`Event`/`Builtin`/`Slots`/`Theme`），再读引擎安装目录的 `.d.ts` 契约与实注册代码。**client `Slots.listSubTree` 两次调用均 10s 超时**（`Error: Slots.listSubTree: Client inspect query timed out after 10000ms. Open or reconnect the Harness page, then retry.`）——本机 Web 页面当前未连上 Inspect 通道，故槽位事实改为从引擎 `lib/types/**/*.d.ts` 契约声明与 `lib/client.js` 实注册代码取证，证据等级不低于 Slot 树的运行时快照（契约即官方发布的注册面）。

### 1.1 问一：Harness 有没有让插件注册**侧栏一级菜单项**的槽位？——**能**

**结论：能，且这正是官方自己用的座位。** 侧栏整列是一个单占位槽，插件不能往里塞东西；但侧栏内部由官方 `ui-sidebar` 声明了一个**全局面板列表座位**，插件注册进去就会成为「新会话」下方的一级菜单行。

**座位契约**（包 `@deepseek-ai/dsh-client-ui-sidebar`）：
文件 `node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts`

- L1–9 头部注释：「the shell owns column geometry, the brand row, New Session, **and global panel rows**」。
- L42–50 **`sidebar.panellist`**：`kind: 'list'`，`scope: 'root'`，`owner: SidebarPanelIconOwnerProps`。
  > 「Global panel icons. **Each list id addresses the matching main panel**; the sidebar owns the button and resolves its label from list metadata.」
- L93–108 `SidebarPanelIconOwnerProps = { size: number; active: boolean }`；`SidebarPanelMetadata = { id: MainPanelId; order: number; label: string }`（`order` 升序，`label` 为行标题与可访问名）。

**为什么不能直接占 `sidebar`**：包 `@deepseek-ai/dsh-client-ui-layout`，文件 `lib/types/client/index.d.ts` 的 `SlotMap['sidebar']` 注释明确写：
> 「The whole left column. **OCCUPIED by ui-sidebar's SidebarRoot**, which declares the workspace and settings seats inside it — **registering here replaces the navigation column outright rather than adding to it**, and the seats it declares disappear with it. **To add something to the sidebar, register into one of those inner seats instead.**」

**入参形状（实注册范例，官方自己）**：

| 范例 | 包 | 文件:行 | 注册形状 |
|---|---|---|---|
| 官方「插件」面板 | `@deepseek-ai/dsh-client-ui-plugin-manager` | `lib/client.js:3534–3542`（`PANEL_ID='plugins'` 在 `:3427`） | `ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name:"sidebar.panellist", id: PANEL_ID, order: 0, label: () => t("panel"), locale: NS }, PluginsPanelIcon))` |
| 官方「定时任务」面板 | `@deepseek-ai/dsh-client-ui-schedule` | `lib/client.js:5437–5444` | `{ name:"sidebar.panellist", id: PANEL_ID, order: 10, locale: MANAGER_NS, label: () => t("panel") }, TaskManagerIcon` |

**当前侧栏行的来源**（同一次渲染里三类行）：
文件 `node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js`
- `:126–150` `PanelRow`：`usePanelInfo(info => info.activePanelId === id)` → `aria-current="page"`，`onClick: () => selectPanel(id)`；折叠态只渲染 `renderSlot("sidebar.panellist", { size: wide ? 16 : 18, active }, { only: id })`，展开态额外渲染 `label`。
- `:239–246`（layout）`renderSlot("sidebar", { collapsed, width })` → 委托给 `SidebarRoot`。
- `:322–345` 渲染顺序：`New Session` 按钮 → `panels.length > 0 && <nav className={panelList} aria-label={t("panels.label")}>`（**这就是一级菜单区**，面板行在内）→ `sidebar.workspaces` 区 → 底部 `sidebar.footer.action` + `sidebar.settings`。
- `:390–396` `syncPanels()`：从 `ctx.slots.entriesOfSlot("sidebar.panellist")` 取 `{ id, order: options.order ?? 0, label: resolveSlotLabel(options.label) ?? id }`，按 `order` 升序排序。

**排序实测占用**：`plugins` = `order 0`，`schedules` = `order 10`。→ 我们的「应用商店」取 `order 20` 即可排在两者之后（`label` 也支持函数 `() => t(...)`，`resolveSlotLabel` 在 slots 包 `lib/index.js:27–29`：`typeof label === "function" ? label() : label`）。

### 1.2 问二：有没有让插件在主内容区渲染**整页视图**的槽位/路由？——**能**

**结论：能。** 主内容区是一个 **keyed 槽 `main`**：一个 key = 一页 = 一个占位者；当前选中键存在 layout 根 store 的 `panelInfo.activePanelId`，`null` 表示显示会话。

**座位契约**：包 `@deepseek-ai/dsh-client-ui-layout`，文件 `lib/types/client/index.d.ts` 的 `SlotMap['main']`：
> 「Central panel selected by sidebar entry id. The reserved **`conversation`** key hosts the Conversation; **other keys receive no Session binding**.」

**派发与选中**：
- 派发：`lib/client.js:65–67` `MainPanel` → `renderSlot("main", {}, { entryKey: usePanelInfo(info => info.activePanelId) ?? "conversation" })`。
- 选中：`lib/types/client/service.d.ts` `ILayout.selectPanel(panelId: MainPanelId | null): void` / `beginNavigation()`；实现见 `lib/client.js:384`（未注册的 key 抛错：`layout.selectPanel: main panel "…" is not registered`）。
- 持久性：`lib/client.js:312` layout store `init: () => ({ panelInfo: { activePanelId: null } })` —— **纯内存，不落盘**；刷新/重启回到 `null`（会话页）。`retainMainPanels`（`:328–331`）在占位者卸载时把失效 key 归零。
- 与「打开会话」共存方式：**是路由切换，不是标签页并存**。选中 `activePanelId` 非 `null` 时整块主内容区换成该面板，会话被移出可见区（`DocumentTitle` 在 `:26–28` 用 `activePanelId === null` 决定是否显示会话标题）；回到会话靠 `selectPanel(null)` 或侧栏「新会话」。

**实注册范例（两个，均官方出货）**：

| 范例 | 文件:行 | 关键形状 |
|---|---|---|
| 官方「插件」整页 | `dsh-client-ui-plugin-manager/lib/client.js:3477–3526` | `ctx.slots.inject("main", function* () { … yield ctx.slots.register({ name:"main", key: PANEL_ID, locale: NS, store, inject: () => face, children: { "plugins.item": {kind:"list",scope:"root"}, "plugins.bundle.activation": {kind:"keyed",scope:"root"}, … } }, PluginManagerPage); … })` |
| 官方「定时任务」整页 | `dsh-client-ui-schedule/lib/client.js:5426–5436` | `ctx.slots.inject("main", () => ctx.slots.register({ name:"main", key: PANEL_ID, locale: MANAGER_NS, inject: () => ({...detail, onNewTask}) }, TaskManagerPage))` |

**入参形状汇总**（`dsh-client-ui-slots/lib/types/index.d.ts`）：`register(options, component)`，options 支持 `name`（必填槽名）、`id`（list 槽行键）、`key`（keyed 槽键）、`order`（list 排序）、`label`（string 或 `() => string`）、`locale`（locale 命名空间）、`store`（`handle.create()` 的导航 store）、`inject`（自有注入面）、`children`（`ChildrenDecl`）。`label` 解析见 `dsh-client-ui-slots/lib/index.js:27–29`。

### 1.3 问三：官方插件页面**是不是可复用组件**？能不能被我们的页签**内嵌**？——**不能内嵌**

**明确结论：不能内嵌。三条独立证据互相印证，任一条单独即可否证。**

1. **页面组件未被导出。** 包 `@deepseek-ai/dsh-client-ui-plugin-manager`，`lib/client.js:3542–3545` 只导出四个符号：
   `exports.NS`、`exports.PANEL_ID`（`= "plugins"`，`:3427`）、`exports.apply`、`exports.inject`。
   渲染整页的 `PluginManagerPage` 是模块私有符号，**没有任何公开入口能拿到它**（`package.json` 的 `exports` 只暴露 `.`、`./client`、`./typert`、`./remote`、`./src/*`、`./package.json`，其中 `./src/*` 亦不含 `PluginManagerPage` 的对外契约声明）。

2. **`main` 是 keyed 单占位槽，`'plugins'` 已被官方占满。** `renderSlot("main", {}, { entryKey })`（`dsh-client-ui-layout/lib/client.js:66`）一次只渲染一个 key 的占位者；官方已用 `key: PANEL_ID = 'plugins'` 注册（`plugin-manager/lib/client.js:3477` + `:3427`）。我们无法为同一 key 再注册一个渲染者。

3. **它声明的子槽只有它自己能渲染。** 官方在同一个 register 调用的 `children` 里声明了 `plugins.item`、`plugins.bundle.activation`、`plugins.bundle.config`、`plugins.row.config`、`plugins.detail.actions`、`plugins.detail.badge`、`plugins.detail.section`（`plugin-manager/lib/client.js:3488–3512`）。契约写死：`dsh-client-ui-slots/lib/types/index.d.ts` 的 `ChildrenDecl`（L153–159）注释：
   > 「Child-slot declaration table for register(): keys are the declared (**and thereby render-authorized**) slot names … **Declaring is claiming: the registering entry becomes the only entry allowed to render these keys.**」
   同一语义在 `dsh-client-ui-layout/lib/types/client/index.d.ts` 的 `sidebar` 注释里也复述为「declaration = exclusive render authority」。**因此我们的页签即使用 `ctx.slots.entries('plugins.item')` 读到条目，也无权渲染 `plugins.item`。**

> 旁注（对现状的影响）：我们的企业市场入口**正挂在 `plugins.item`**（`plugin/packages/ui/src/client.tsx:129–137`）。这意味着**只有官方 `plugins` 面板打开时它才可见**。二期一旦把主战场迁到自建页签，官方页面里的这张卡片要么保留为「第二入口」，要么改为跳转卡——**不能不处理**（否则用户会以为入口消失了）。

**替代方案（三选一，代价已标注）：**

| 方案 | 做法 | 用到的能力 | 代价 | 缺点 |
|---|---|---|---|---|
| **A（推荐）导览 + 跳转** | 「官方插件」页签渲染一张**导览页**：官方插件能力摘要 + 主按钮「打开官方插件页」→ `ctx.layout.selectPanel('plugins')`；企业相关条目可深链 → `ctx.pluginNavigation.openBundle(pkg)` | `ctx.layout.selectPanel`（`lib/types/client/service.d.ts`）+ `pluginNavigation.openBundle`（`plugin-manager/lib/client.js:3523–3531` 经 `ctx.reflect.provide("pluginNavigation", …)` 提供；消费者范例见 `dsh-experimental-client-ui-voice-input/lib/client.js:5688` `ctx.pluginNavigation.openBundle("…")`，其 inject 声明在 `:5673`） | **0.5–1 人日** | 页签语义是「导览 + 跳走」，不是真内嵌；回来要再点侧栏 |
| **B 自绘官方插件清单** | 用官方 primitives 在自己页签里**重画**一份官方插件目录（数据走 Host 插件清单），详情按钮跳官方 | primitives `Switch`/`Tag`/`StateDot`/`DisclosureRow` + Host 插件清单 | **3–5 人日** + 长期漂移成本 | 与上游官方页**必然分叉**（排序/分组/状态语义会漂），违背仓库「官方 UI 零分叉」宪法 |
| **C 页签即跳转** | 点「官方插件」页签直接 `selectPanel('plugins')`，页签不承载内容 | 同 A 的第一半 | **0.2 人日** | 页签选中态与实际内容错位（本面板立刻失焦），体验最差 |

**唯一受支持的「深链进官方插件页」通道**是 `pluginNavigation.openBundle(packageName)`：它内部做的正是 `ctx.layout.selectPanel(PANEL_ID)` + `instance.actions.setView({ kind: "package", name: packageName })`（`plugin-manager/lib/client.js:3523–3530`）。**没有**「打开官方插件页到列表视图」的等价服务——要回列表只能 `selectPanel('plugins')`（官方自己在 `:3513–3515` 订阅 `panelInfo` 变化把 view 重置为 `list`）。

### 1.4 问四：主内容区做多页签，有没有官方原语/样式口径？——**有，但有一个版本陷阱**

**结论：有官方原语，两个：`SegmentedTabs` 与 `SegmentedControl`**，均由 `@deepseek-ai/dsh-client-ui-primitives` 导出（types 见 `lib/types/SegmentedTabs.d.ts`、`lib/types/SegmentedControl.d.ts`；实现在 `lib/index.js:3250–3310` 与 `:3425–3495`）。

| 原语 | 形状 | 无障碍语义 | 适用 |
|---|---|---|---|
| **`SegmentedTabs<Value>`**（建议） | `{ items: readonly [SegmentedTab<Value>, …]; value; onChange; label; className? }`，`SegmentedTab = { value; label: ReactNode; id; panelId }` | 容器 `role="tablist"` + `aria-label`；等宽 + 滑动指示条（`gridTemplateColumns: repeat(n, minmax(0,1fr))`）；←/→/Home/End 走焦并选中；**只渲染 tab 列表，面板由调用方持有** | 主内容区顶部页签条 |
| `SegmentedControl<Value>` | `{ id; value; options: {value,label,disabled?,title?}[]; onChange; label; disabled?; className? }` | 容器 `role="tablist"`；每段 `id={`${id}-${value}`}`、`aria-controls={`${id}-${value}-panel`}`、`role="tab"`；`--dsh-segment-count/-index` 驱动指示条 | 需要 `aria-controls` 面板配对与整体 `disabled` 锁定的场景 |

**官方自己的用法（可作口径对齐）：** `dsh-client-ui-settings-models/lib/client.js:1853` 使用 `SegmentedControl`；`dsh-client-ui-agent-preset/lib/client.js` 亦用二者之一。

**⚠ 版本陷阱（本规划最需要用户拍板的技术项之一）：**

- 客户端 bundle 用 esbuild 构建、把共享单例**外置**：`plugin/packages/bundle/scripts/build.mjs` 的 client 构建写死
  `external: ['react', '@deepseek-ai/dsh-client-ui-primitives']`。
- 运行时裸模块名由页面静态模块注册表解析。web frontend 产物（`dsh-web-frontend/dist/assets/index-5SrrfWpU.js`）里：
  ```js
  function rM() {
    return { react: Ef, "react/jsx-runtime": If, "react-dom": Rf, "react-dom/client": Df,
             "@deepseek-ai/cordis": sf, "@deepseek-ai/dsh-client-store": lh,
             "@deepseek-ai/dsh-client-ui-slots": hh,
             "@deepseek-ai/dsh-client-ui-primitives": sE,
             "@deepseek-ai/dsh-client-ui-dockkit": XS };
  }
  ```
  → **运行时拿到的 primitives 就是正在跑的 Harness 那一份（本机 `0.2.0-rc.2`），确有 `SegmentedTabs`/`SegmentedControl`。**
- 但**编译期**用的是工程内 pin：`plugin/packages/ui/package.json` `devDependencies."@deepseek-ai/dsh-client-ui-primitives": "0.1.5-rc.2"`，而实测该版本 `lib/types/index.d.ts` + `lib/index.js` **不含 `SegmentedTabs`/`SegmentedControl`**（grep 为空；`Switch`/`Tag`/`StateDot` 在，故现有代码可用）。
  → 直接 `import { SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'` **会报 TS 类型错**（运行时却能跑）。
  **两条出路**：(a) 把该 devDependency pin 从 `0.1.5-rc.2` 对齐到 `0.2.0-rc.2`（与运行引擎一致，一次 pin 变更 + 一次回归，**推荐**）；(b) 不用官方原语、照 `account-view.tsx` 现有手写 `role="tablist"` 风格自绘（零 pin 变更，但多一份样式分叉，且要自己复刻 ←/→/Home/End 走焦）。

**另一条被否掉的路**：`@deepseek-ai/dsh-client-ui-dockkit`（也在 `rM()` 注册表里）是**可停靠分屏布局套件**（`lib/types/index.d.ts` 头部：「A docking layout kit: a split tree of tabbed panes …」），用于分屏/浮动/拖拽停靠，语义与成本都远超「主内容区一条页签」，**不建议为一排页签引入**。

**官方设置弹窗并不是页签口径**：`dsh-client-ui-settings-general/lib/client.js:251` 用 `<nav className={SettingsRoot_module_css_default.nav}>` + `navCell` 渲染 `settings.section`（左侧**竖向导航列表**，`panel` 宽度写死 `800px`）；`dsh-client-ui-settings-plugins/lib/client.js:100–124` 的 `settings.plugins.tab` 才是**手写** `role="tablist"`/`role="tabpanel"` + 自己的 CSS Module + 懒挂载。→ **不要拿设置弹窗当页签样式源**；主内容区页签应使用 `SegmentedTabs`。

---

## 2. 目标形态：侧栏「应用商店」一级菜单 + 主内容区多页签

### 2.0 承载形态的最终选择（用户裁定：**方案甲**）

用户在读完 §1.3「内嵌不可能」与甲乙对比后裁定采用**方案甲**：

> **把页签做进现有 `plugins.item` 条目的 `page` 视图**，而不是新建侧栏「应用商店」菜单。

**为什么甲成立（关键事实）**：我们的条目**本来就占着 `plugins.item`**，并且带 `view: 'summary' | 'page'` 两种视图——
`summary` 是官方分组里的一张卡片，**`page` 是主内容区里的一个整页**（`plugin/packages/ui/src/marketplace-entry.tsx` 的 `[POS]` 已记录该形态）。
也就是说：**我们早就在官方面板内部渲染整页了**，只需要把那个 page 从「单页详情」改造成「多页签商店」。

```text
侧栏「插件」 → 官方插件面板（main panel，key='plugins'）
                 ├─ 官方 bundles 卡片
                 └─ 【插件市场】卡片            ← 我们的条目（plugins.item）
                        ↓ 点击
                   我们的 page 视图（主内容区整页）
                        ├ 企业技能    ← 技能商店（复用 marketplace-entry 技能节 + skill-market）
                        ├ 企业插件    ← 复用 plugin-market.tsx
                        ├ 精选/推荐   ← 二期（依赖服务端 featured）
                        └ 官方插件    ← 跳回官方列表（ctx.layout.selectPanel('plugins')）
```

**甲相对乙的三点收益**：① 不需要新建侧栏菜单（入口就在用户预期的「插件」下）；② **不需要内嵌官方页**——我们本就在官方面板内部渲染页面，官方列表 ↔ 我们的页各占一次主内容区切换，这是官方自己的机制；③ 改动全在我们自己的组件里，**不碰任何官方 UI**（符合本仓库「官方 UI 零分叉」宪法）。

**甲的三点代价（如实）**：① 比新建菜单多一次点击（侧栏「插件」→ 我们的卡片 → 页签）；② 我们的条目与官方插件卡片混在同一列表（官方分组下）；③ `activePanelId` 纯内存不落盘，刷新回会话页（官方行为，甲乙同）。

**乙的去向**：**不取消，降级为可选「直达入口」**——若日后觉得"多一次点击"不可接受，可再补一个 `sidebar.panellist` 入口（order=20）直接 `selectPanel('enterprise-store')`，**但它指向的仍是甲那套 page 内容**，不存在第二份数据、也不存在两套页签实现。

**对 §2.2 与 §7 的连带修改**：
- §2.2 的「官方插件」页签由「官方 key 不可内嵌 → 只能导览+跳转」**放宽为**「我们已在官方面板内，该页签只需 `selectPanel('plugins')` 跳回列表」（工作量从 0.5–1 人日降到 ≈0.2 人日）。
- §2.2 里关于 `plugins.item` 卡片语义的那段**不再需要**"改跳转到自建面板"，因为甲的分页签就在该卡片点进去的 page 里；卡片语义保持不变（仍叫「插件市场」）。
- §7 的 P0 **减去**新建 `main` 面板、`sidebar.panellist` 入口、order 冲突协商这三项（乙独有），**P0 由 10–17 人日降为 7–12 人日**；`ui/src/client.tsx` 的 `inject` 仍需加 `layout`（官方插件页签要 `selectPanel('plugins')`）。
- 开放问题 5（侧栏 order=20 与入口文案）**随乙降级而暂不阻塞**；页面内的页签文案与顺序仍需拍板。

### 2.1 结构

```
侧栏（sidebar，官方 ui-sidebar 单占位）
├─ 品牌行（sidebar.brand.mark / .name）
├─ 新会话
├─ 全局面板区  nav[aria-label="全局面板"]      ← 这里是「一级菜单」
│   ├─ [图标] 插件        （官方，order 0）
│   ├─ [图标] 定时任务    （官方，order 10）
│   └─ [图标] 应用商店    （本规划，order 20）★新增
├─ 工作区/会话区（sidebar.workspaces）
└─ 底部（sidebar.footer.action + sidebar.settings）

主内容区（main，keyed 单占位；panelInfo.activePanelId 决定）
├─ key 'conversation'（保留键）= 对话
├─ key 'plugins'      （官方）= 官方插件页
├─ key 'schedules'    （官方）= 定时任务
└─ key 'enterprise-store' ★新增 = 应用商店整页
    └─ SegmentedTabs 页签条：官方插件 │ 企业技能 │ 企业插件 │ 精选推荐 │ (配方·预留)
```

**注册形状（照官方范例，本规划只定契约不写实现）：**

```js
// 一级菜单：sidebar.panellist（list 槽）—— id 必须等于 main 的 key
ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
  { name: 'sidebar.panellist', id: 'enterprise-store', order: 20, label: '应用商店' },
  EnterpriseStoreIcon,          // props: { size: number, active: boolean }
))

// 整页：main（keyed 槽）—— key 即 sidebar 行 id
ctx.slots.inject('main', () => ctx.slots.register(
  { name: 'main', key: 'enterprise-store', inject: () => ({ store }) },
  EnterpriseStorePage,          // 内部持有 SegmentedTabs 的 activeTab
))
```

**约束与注意：**

1. **`sidebar.panellist.id` 必须与 `main.key` 同值**，否则点击一级菜单会命中 `selectPanel` 的「未注册」抛错（`dsh-client-ui-layout/lib/client.js:384`），或选中一个不存在的主面板。
2. **必须新增 `layout` 注入**。`plugin/packages/ui/src/client.tsx:78` 现为 `export const inject = ['slots', 'remote']`；要用 `ctx.layout.selectPanel(...)`（跳官方插件页）须把 `layout` 加进去。bundle 侧 manifest 已声明 `dsh.client.inject` 含 `@deepseek-ai/dsh-client-ui-layout` 与 `@deepseek-ai/dsh-client-ui-sidebar`（`plugin/packages/bundle/package.json` 的 `dsh.client.inject`），依赖顺序已满足；`pluginNavigation` 走 `ctx.get('pluginNavigation')` 结构读取（缺席即不给跳转按钮，不硬注入，沿用仓库既有的「服务缺席降级」风格，见 `client.tsx:52` `get(name)`）。
3. **页签状态自持**。`SegmentedTabs` 只渲染 tab 条、面板由调用方持有（其 JSDoc：「returns the tab list, without its panels」），故 activeTab 放在我们页面内的 store/state，不写回 `pendingSkill` 之类既有投影。
4. **`activePanelId` 不落盘**（§1.2）：刷新后回到会话页。若产品要求「记住上次页签」，需我们自己在本地存储记 activeTab，且不要试图改官方 layout store。

### 2.2 页签清单与「用哪种能力实现」

| 页签 | 实现能力（槽位/服务/原语） | 是否可内嵌官方页 | 说明 |
|---|---|---|---|
| **官方插件** | 官方 `main` key `'plugins'`（**不可内嵌**，§1.3）→ 用 `ctx.layout.selectPanel('plugins')` 跳转；条目级深链用 `ctx.pluginNavigation.openBundle(pkg)`；页签本体为我们自绘导览卡 | ❌ | 采用 §1.3 **方案 A**：0.5–1 人日。必须显式告知用户「官方插件页在官方自己的面板里，本页签是入口」 |
| **企业技能** | 自建页签（无官方槽位）：复用 `marketplace-entry.tsx` 的技能节 + `skill-market.tsx` 行投影；数据走 `store.api.skills()` / `skillDetail(id)` / `installedSkills()`，安装走本地路由 `GET/POST {local}/skills/{install,uninstall,installed}` | — | 技能商店主场。**已有地基最厚**，1–2 人日迁移 |
| **企业插件** | 自建页签：复用 `plugin-market.tsx` 的插件行与 `Switch` 一键安装/卸载 | — | 0.5–1 人日 |
| **精选 / 推荐** | 自建页签：复用同一批技能数据，按服务端 `featured` + `featured_weight` 排序露出（不需新槽位） | — | P1，依赖服务端标记 |
| **配方（预留）** | 自建页签，排期外 | — | 与 `ENTERPRISE_MARKET_COMPONENTS` 的 `presets.reserved` 一致，二期只留位 |

**与现有 `plugins.item` 入口的关系（必须处理）：** 保留 `plugin/packages/ui/src/client.tsx:129–137` 的 `plugins.item` 注册，但把它的语义从「唯一的市场入口」改为「**官方插件页里的企业快捷入口**」——点击时 `ctx.layout.selectPanel('enterprise-store')` 跳到我们的整页并选中「企业技能」页签。这样两条入口指向同一份 store，**没有第二份数据**；同时官方页里也不会出现「企业入口消失」的观感，避免用户困惑。（`plugins.detail.badge` 的注册 `client.tsx:138–143` 保持不变。）

---

## 3. 三个场景的定位与重叠关系

### 3.1 定位

| 场景 | 定位 | 露出位置 | 数据约束 | 能否安装 |
|---|---|---|---|---|
| **内置** | 该技能对本租户**默认全员可见**（后台已配 `ALL` 分配），属于「装好就能用」的基本盘 | 主内容区「企业技能」页签的**默认列表**（现状口径：列表列后台分配的**全部**技能，不按已装过滤） | `ent_skill_assignment.subject_type='ALL' AND status='ACTIVE'` | 能（`entitled=true`） |
| **精选** | 运营从在售/内置技能里**策展推荐**，解决"技能多了找不到" | 独立「精选 / 推荐」页签 + 可选置顶位 | 同一批 package 行 + `featured` 标记与权重 | 沿用该技能自身的授权（内置/已分配 → 能；仅商店可见 → 先申请） |
| **商店** | **独立浏览区**：未分配也能看见、能搜、能看详情，安装受控 | 「企业技能」页签的**全部目录**（含未分配）或独立「商店」子区 | `p.status='ACTIVE' AND v.status='PUBLISHED' AND shop_visible=true`（**不看 assignment**） | 未分配 → 只给「申请」 |

### 3.2 重叠关系（核心口径，必须写进产品文案与接口注释）

> **三者是同一批 `ent_skill_package` 行的不同露出方式，不是三套数据、不是三张表、不是三份目录。**

- 一个技能**可以同时**是「内置 + 精选 + 商店在售」：内置决定**默认可见与默认可装**，精选决定**在推荐位露出**，商店决定**未分配用户也能看见**。
- 因此：**不存在"把这个技能从商店搬到精选"这种操作**；运营动作只有三类——配置分配（内置/定向）、切换商店可见（`shop_visible`）、调整精选标记与权重（`featured`/`featured_weight`）。
- 前端**只有一个技能目录数据源**（服务端目录查询），三个场景是同一份结果上的**三个投影**（默认列表 / 精选排序 / 全量含未分配），因此**已装态、有更新判定、安装/卸载动作只实现一次**，三处共用（这正是复用 `marketplace-entry.tsx` 与 `skill-market.tsx` 的理由）。
- 重叠的可见性合成规则（单一真源，写在服务端投影里）：`内置(ALL) ∨ 已分配(USER) ∨ shop_visible` → 该用户**可见**；`内置(ALL) ∨ 已分配(USER)` → 该用户**可安装**（`entitled`）。

---

## 4. 可见性与权限

### 4.1 三层

| 层 | 判定真源（现状） | 可见性 | 可安装性 | 现状 |
|---|---|---|---|---|
| **L1 内置**（默认全员） | `ent_skill_assignment`，`subject_type='ALL'`（`subject_id IS NULL`），`status='ACTIVE'` | 可见，且是**默认列表** | 可 | **已实现**：`JdbcSkillStore.findVisiblePublished` 的 assignment `EXISTS` 子查询（`server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/skill/persistence/JdbcSkillStore.java:236–247`） |
| **L2 分配定向** | 同表，`subject_type='USER'`，`subject_id=当前 userId` | 可见 | 可 | **已实现**（同上 SQL 的第二分支）。注意：`SubjectType` 枚举当前仅 `ALL, USER`（`skill/domain/SkillAssignment.java:20`；DDL 约束 `V35__enterprise_skill_catalog.sql:64` `check (subject_type in ('ALL','USER'))`），**没有 GROUP/DEPT** |
| **L3 商店可浏览未安装**（新增） | **新查询**：只按 `p.status='ACTIVE'` + 最新 `v.status='PUBLISHED'` + `p.shop_visible=true`，**不带 assignment 过滤**；投影 `entitled` 布尔 | 可见（仅商店语境） | **不可** → 只给「申请」入口 | **未实现**：现有 `findVisiblePublished` 与 `findVisiblePublishedById` 都被 assignment 过滤，未分配技能根本查不到 |

### 4.2 「浏览自由 · 安装受控」的落地判定

**浏览自由**：只作用于 L3 查询——目录列表/搜索/详情**不**读 assignment，最多读 `shop_visible`。因此"能不能看到"与"能不能装"是**两次独立判定**，不能复用同一条 SQL（现状复用同一条，这正是必须拆的原因）。

**安装受控**（判定点、判什么、错误码）：

| 判定点 | 位置 | 判什么 | 未通过时 | 错误码 |
|---|---|---|---|---|
| ① 行渲染（体验层，非授权层） | 客户端，`enterpriseMarketSkillState`/行投影 | 服务端下发的 `entitled: boolean` **布尔真值**（客户端**不自行推理**） | `entitled=false` → 右侧不渲染 `Switch`，改渲染官方 `Button` 变体「申请」；已申请且待审 → 渲染 `Tag`「审批中」+ 禁用 | —（纯展示） |
| ② 下载授权（真正的门） | 服务端 `SkillRuntimeService.authorizeDownload` → `JdbcSkillStore.findPublishedVersionForUser`，对应 `GET /enterprise/api/v1/skills/versions/{versionId}/download` | `EXISTS(assignment ACTIVE: ALL 或 USER=当前用户)` | **现状返回"查不到"** → 客户端只能看到 404/`ENT_RESOURCE_NOT_FOUND`，**无法区分"不存在"与"无权"**。二期必须改为 **403 + `ENT_SKILL_NOT_ASSIGNED`** | `ENT_SKILL_NOT_ASSIGNED`（**新增**） |
| ③ 申请提交 | 客户端 → 服务端新增 `POST /enterprise/api/v1/skills/{packageId}/access-requests` | 会话可用 + 技能存在 + `shop_visible` + 尚无同用户同技能的 PENDING 申请 | 重复提交 → 409 + `ENT_SKILL_REQUEST_PENDING`（**新增**） | `ENT_SKILL_REQUEST_PENDING` |
| ④ 审批落权 | 管理面新增审批接口 → 批准即写 `ent_skill_assignment(subject_type='USER')` | 审批人权限 | 权限不足 | 复用 `ENT_PERMISSION_DENIED` |

**错误码口径**：一律沿用仓库现有的稳定码唯一投影 `enterpriseLocalErrorCode`（`plugin/packages/ui/src/local-api-decode.ts`），界面只显示不自造文案；行内反馈沿用 `role="alert"` + 前缀「安装失败」（`enterpriseMarketActionErrorLabel`，`marketplace-entry.tsx:64–66`）。新增码需同时进 `local-api-decode.ts` 的唯一投影表，并让 `ENT_SKILL_*` 前缀族保持一致（现有族见 §11 证据表）。

---

## 5. 服务端需要补的能力

> 现状基线：`GET /enterprise/api/v1/skills`（列表）与 `/{packageId}`（详情）在 `skill/web/RuntimeSkillController.java:44–60`；管理员侧 `skill/web/AdminSkillController.java`（列表 `:57–80` 用 `CursorPageData`，上传/发布/退役/批量分配）；可见性 SQL 全在 `skill/persistence/JdbcSkillStore.java`；建表 `db/migration/V35__enterprise_skill_catalog.sql`。

| # | 能力 | 现状（带证据） | 需补 | 期次 |
|---|---|---|---|---|
| **S1** | **标记：builtin / featured / 分类 / 标签** | `ent_skill_package` 只有 `id, tenant_id, skill_id, display_name, description, status, revision`（`V35…sql:6–18`），**无任何策展字段**；`builtin` 目前只能用「是否配了 ALL 分配」隐式表达 | 新迁移 `V36`：`shop_visible boolean not null default false`、`featured boolean not null default false`、`featured_weight integer not null default 0`、`category varchar(64)`、`tags jsonb not null default '[]'`；`AdminSkillController` 增加标记读写（含 `revision` 乐观锁）；投影把 `builtin` 显式算出来（`EXISTS(ALL 分配)` → `builtin:true`），**不再让前端猜** | **P0**（`shop_visible`/`builtin`）/ P1（`featured`/`category`/`tags`） |
| **S2** | **目录检索：搜索/筛选/排序/真分页带 total** | 用户侧列表**无任何查询参数、无分页、无 total**（`RuntimeSkillController.java:44–47` 返回 `EnterpriseResponse<List<RuntimeSummaryView>>`）；管理员侧只有游标分页（`AdminSkillController.java:57–80`，`CursorPageData`） | 新 `GET /enterprise/api/v1/store/skills?q=&category=&tag=&sort=&page=&size=` → `{ items, total, page, size }`；`q` 命中 `display_name/description/skill_id`；`sort ∈ {updated_desc, name_asc, featured_desc}`；`size` 上限（建议 50）；**total 必须是真 count**（页签要显示"共 N 个"与翻页） | **P0** |
| **S3** | **可见性分层** | 只有一条 assignment 过滤的可见 SQL（`JdbcSkillStore.java:236–247`、`:259–270`、`:282–293`），浏览与授权**复用同一条** | 拆成两条：`findBrowseable`（不看 assignment，看 `shop_visible`）与 `findEntitled`（看 assignment）；目录投影每行带 `entitled: boolean` 与 `builtin: boolean` | **P0** |
| **S4** | **安装授权显式码** | 未分配 → `findPublishedVersionForUser` 直接查不到 → 下载端点表现为"资源不存在"（`SkillRuntimeController.java:62–105` 的 download 走 `authorizeDownload`） | 未分配但 `shop_visible` → **403 + `ENT_SKILL_NOT_ASSIGNED`**；保留"真不存在 → 404"的区分 | **P0** |
| **S5** | **申请 / 审批** | **完全不存在**（全仓 grep `审批`/`access request` 无技能相关命中；`SubjectType` 只有 `ALL,USER`） | 新表 `ent_skill_access_request(package_id, user_id, reason, status, decided_by, decided_at, revision)`；用户侧 `POST /enterprise/api/v1/skills/{packageId}/access-requests` + `GET …/access-requests/mine`；管理面 `GET/POST /enterprise/admin/v1/skills/access-requests{/id/actions/approve|reject}`；批准 → 写 `ent_skill_assignment(USER)`；全程审计 | **P1** |
| **S6** | **更新落盘语义 / 列表投影补 `versionId`** | `RuntimeSummaryView` **不含 `versionId`**（`skill/web/SkillViews.java:128–138`），只有 `RuntimeDetailView` 有（`:140–152`）。这就是 `marketplace-entry.tsx` 第 3 行 `[POS]` 记录「中心列表投影的 `versionId` 恒为空串、只有详情才是真值，故 hook 只对**已装行**逐个取详情」的根因 | 在 `RuntimeSummaryView` 增加 `versionId`（当前 PUBLISHED 版本 id）并同步客户端 DTO 解码；「有更新」判定从 **O(已装行) 次详情请求** 降为 **0 次** | **P0**（低成本、去掉 N+1） |
| **S7** | **精选排序权重落地** | 无 | 复用 S1 的 `featured`/`featured_weight`，在 S2 的 `sort=featured_desc` 里生效；精选页签只发一个排序参数 | **P1** |

**兼容性注意**：S6 给 `RuntimeSummaryView` 加字段是**向后兼容**的（客户端 DTO 解码需同步，否则新字段被忽略）；S1 的 `V36` 迁移必须给存量行默认值（`shop_visible=false`），避免"升级即全量进商店"。

---

## 6. 客户端需要补的能力（概览）

| # | 能力 | 复用/新增 | 期次 |
|---|---|---|---|
| C1 | 侧栏一级菜单注册（`sidebar.panellist`，`order 20`）+ 图标组件（`{size, active}`） | 新增（契约见 §1.1） | P0 |
| C2 | `main` keyed 整页注册（`key='enterprise-store'`）+ `layout` 注入 | 新增（契约见 §1.2） | P0 |
| C3 | 页签条（`SegmentedTabs`）+ activeTab 本地状态 | 新增；**依赖 §1.4 的 pin 决策** | P0 |
| C4 | 技能行/插件行/已装态/有更新/失败反馈 | **复用** `marketplace-entry.tsx`（技能节两行卡片 + 辅助标签按钮 + `Switch` + `role="alert"`）与 `skill-market.tsx`/`plugin-market.tsx` | P0 |
| C5 | 一键安装/卸载/幂等/落盘/官方 watcher | **复用**（本会话已实测：安装 167ms、幂等、落盘 `~/.dsh/skills`、官方 watcher 免重启发现） | 已有 |
| C6 | `entitled=false` → 「申请」按钮 + 「审批中」Tag | 新增 | P1 |
| C7 | 官方插件页导览卡 + 跳转（`selectPanel('plugins')` / `openBundle`） | 新增 | P0 |
| C8 | `plugins.item` 卡片语义改为跳转到本页签 | **改**（`client.tsx:129–137`） | P0 |
| C9 | 精选页签（复用技能行，换排序来源） | 复用 | P1 |

---

## 7. 排期建议（人日区间 + 前置依赖）

> 人日口径沿用仓库既有调研：1 人日 = 1 名熟悉本仓库的工程师有效工作 6 小时，**含实现 + 测试 + 文档**，不含排期等待与跨团队协调（`docs/research/iflytek-skillhub-integration.md:368`）。

### P0 — 承载形态落地 + 商店可见（**10–17 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P0-1 | 侧栏「应用商店」一级菜单 + 主内容区整页骨架（`sidebar.panellist` + `main` keyed + `layout` 注入） | 0.5–1 | 无（契约已取证） |
| P0-2 | 页签原语接入：**拍板 pin** 后接 `SegmentedTabs`（含一次 primitives 回归）；不拍板则手写 tablist | 0.5–1（或 0.3） | P0-1；**开放问题 Q4** |
| P0-3 | 「企业技能」页签：迁移并复用技能节（两行卡片 / 辅助标签按钮 / `Switch` / 行内失败反馈） | 1–2 | P0-1 |
| P0-4 | 「企业插件」页签：复用插件节 | 0.5–1 | P0-1 |
| P0-5 | 「官方插件」页签（§1.3 方案 A：导览 + 跳转 + `openBundle` 深链） | 0.5–1 | P0-1；`layout` 注入 |
| P0-6 | `plugins.item` 卡片改跳转语义（避免双入口观感割裂） | 0.5 | P0-1 |
| P0-7 | 服务端 **S1(部分) + S2 + S3 + S4 + S6**：`shop_visible`/`builtin` 列与迁移、目录检索（搜索/筛选/排序/真分页带 total）、浏览与授权两条 SQL 拆分、403 + `ENT_SKILL_NOT_ASSIGNED`、列表投影补 `versionId` | 4–6 | 无（服务端独立可并行） |
| P0-8 | 客户端 DTO 解码与错误码投影同步（`local-api-decode.ts` 唯一投影 + 空 `versionId` 逻辑退场） | 1–1.5 | P0-7 |
| P0-9 | 联调 + 验收（含未分配技能的浏览/申请前拦截、分页 total、小屏折叠态侧栏图标） | 1.5–3 | P0-1…P0-8 |

**P0 合计：10–17 人日**（逐项区间相加：min 0.5+0.5+1+0.5+0.5+0.5+4+1+1.5 = 10.0；max 1+1+2+1+1+0.5+6+1.5+3 = 17.0）。

### P1 — 精选 + 申请审批（**7–12 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P1-1 | 服务端 S1 剩余（`featured`/`featured_weight`/`category`/`tags`）+ S7 精选排序 | 1–2 | P0-7 |
| P1-2 | 「精选 / 推荐」页签（复用技能行，换排序来源 + 置顶位） | 1–2 | P1-1 |
| P1-3 | 服务端 S5：申请/审批表 + 用户接口 + 管理面审批接口 + 审计 | 3–5 | P0-7 |
| P1-4 | 客户端「申请」入口 + 「审批中」Tag + 申请理由表单 | 1 | P1-3 |
| P1-5 | 管理后台：标记编辑 + 审批列表页 | 1–2 | P1-3 |

### P2 — 策展与生态（**11–17 人日**，含既有调研结论）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P2-1 | 「配方」页签转正（预留位 → 实体） | 3–5 | P0 |
| P2-2 | **SkillHub 离线双向转换器**（见 §8） | **5–7** | P0-7（分类/标签落在 S1）；与商店页签**解耦** |
| P2-3 | 多租户/多组织可见性扩展（`subject_type` 增 `GROUP`/`DEPT`） | 3–5 | 开放问题 Q2 拍板 |

### 已可直接引用的地基（**不重复计价**）

一键安装（实测 167ms）、卸载、幂等、落盘 `~/.dsh/skills`、官方 watcher 免重启发现、「有更新」判定、官方两行卡片、行内失败反馈（`role="alert"` + 稳定码）、企业插件/技能两节默认展开、纯函数组件 + hook 入口分离的测试形状。这些是 **C4/C5**，P0 只做「搬到新页签 + 换数据源」，**不重写**。

---

## 8. 与 SkillHub 的关系

**引用**：`docs/research/iflytek-skillhub-integration.md`（2026-10-02，102 KB）。

- 该调研在 §方案对比中把 **方案 A「格式互操作 —— 离线双向转换器」列为唯一推荐**（文档 L389），**工作量 5–7 人日**（L417–422 拆解：规则映射 + 双向结构转换 2、前置校验器 1.5、CLI 包装 + 错误报告 1、真实样本回归测试 1.5、文档 1）；其 §0.1 ①②两条不确定性已实测关闭（`skills/` 子树深度不受限 → 重定位策略成立，**不需 +2 人日**；根级非 `manifest.json` 条目会被整包拒绝 → **必须迁移**而非可以迁移）。
- **期次归位：P2**（P2-2）。理由是它与商店**页签形态无关**：转换器产出的是**标准 dsh 技能包**，进商店走既有 `POST /enterprise/admin/v1/skills/versions`（上传）→ `publish` → `assignments` 的路径（`AdminSkillController.java:82–135`），**商店侧零改动**；转换器只是"把 SkillHub 技能变成能上传的包"的工具。
- **唯一耦合点**：转换器可选写入的 `namespace`/`tags[]`/`license` 三个字段（该文档 L375 的实测结论：`validateManifest` 只按名取 5 个字段，未知顶层键**既不报错也不保存**）。若要 `tags` 在商店里真的可检索，必须在 **S1** 里把分类/标签落到 `ent_skill_package`（服务端），因此 P2-2 的前置是 **P0-7**。
- **不落在本规划内**的 SkillHub 方案 B/C/D（内嵌导入服务 14–20 人日、CLI 运行时 15–25 人日、仅对齐字段 1–2 人日）见该文档 §方案 B/§其他，本规划不重复决策。

---

## 9. 明确不建议做的事

1. **不要用 iframe / `document.querySelector` 把官方插件页塞进我们的页签。** 依据：①官方页面组件未导出（§1.3 证据 1）；②跨 entry 渲染他人声明子槽被契约禁止（`ChildrenDecl`："Declaring is claiming"）；③运行时共享单例只有 8 个（web-frontend dist `rM()`），官方不允许越过模块边界取组件；④与仓库宪法「官方 UI 零分叉」直接冲突，且 iframe 会破坏主题 token 与快捷键作用域。
2. **不要为 `main` 注册第二个 `key='plugins'`，也不要注册第二个 `sidebar.panellist` `id='plugins'`。** keyed 槽一位一占；`sidebar` 的 `panels.map` 以 `id` 作 React key（`dsh-client-ui-sidebar/lib/client.js:330–339`），重复 id 会产生两行同 id + key 冲突，并抢官方选中态。
3. **不要在客户端用本地数据自行推理「能不能装」。** assignment 是服务端真值；客户端只认投影的 `entitled` 布尔。本地推理会与审批/停用产生长期不一致，并制造"看到开关、一点 403"的体验（现状未分配是 404，更难解释）。
4. **不要长期依赖"对每个已装行逐个取详情"来判定「有更新」。** 那是 S6 缺失（`RuntimeSummaryView` 无 `versionId`）时的临时解（`marketplace-entry.tsx` 第 3 行 `[POS]` 有记录）；商店页签一开、已装行变多就是 N+1。
5. **不要把「应用商店」做进设置弹窗**（再加一个 `settings.section` 或页签）。官方设置弹窗是宽度写死 `800px`、高度 `min(800px, 100vh - …)` 的模态（`dsh-client-ui-settings-general/lib/client.js:50` 的 `VOzbGW_panel` CSS），面积与滚动都是弹窗语义；用户 D2 已明确要主内容区。
6. **不要移除 `plugins.item` 上的企业卡片却不给替代路径。** 官方插件页里的企业入口必须保留（或改为跳转卡），否则会在官方页造成"企业入口消失"的观感（§2.2 末尾）。
7. **不要为了一排页签引入 `@deepseek-ai/dsh-client-ui-dockkit`。** 它是可停靠分屏套件（`lib/types/index.d.ts` 头部），语义与成本远超需求。

---

## 10. 需要用户拍板的开放问题

1. **「官方插件」页签用哪种替代方案**：导览 + 跳转（0.5–1 人日，§1.3 方案 A，推荐）／自绘官方插件清单（3–5 人日 + 与上游漂移）／点页签即跳转（0.2 人日，选中态错位）？
2. **商店对"未分配"技能是全网可见还是按组织可见**（若是后者，`subject_type` 需从 `ALL|USER` 扩到含 `GROUP`/`DEPT`，DDL 约束 `V35…sql:64` 与枚举 `SkillAssignment.java:20` 都要改）？
3. **「申请」走哪条审批链**：企业后台既有审批流还是新建独立审批单？审批人是管理员／技能所有者／部门主管（决定 S5 的接口与权限码形状）？
4. **是否同意把 `plugin/packages/ui/package.json` 的 primitives devDependency 从 `0.1.5-rc.2` 对齐到运行时的 `0.2.0-rc.2`**（换取官方 `SegmentedTabs`；代价是一次 pin 变更 + 一次 primitives 回归）？
5. **侧栏入口细节**：`order=20`（排在「插件」0、「定时任务」10 之后）是否可接受？入口文案定「应用商店」还是「企业市场」？页签顺序是否按「官方插件 → 企业技能 → 企业插件 → 精选推荐」？

---

## 11. 证据索引（包 · 文件 · 行号 / 结构）

| # | 事实 | 包 | 文件 | 位置/结构 |
|---|---|---|---|---|
| E1 | 侧栏整列是 `single` 槽，被 `ui-sidebar` 独占；要加东西必须进它声明的内座 | `@deepseek-ai/dsh-client-ui-layout` | `lib/types/client/index.d.ts` | `SlotMap['sidebar']` 注释块 |
| E2 | 侧栏一级菜单座位 = `sidebar.panellist`（`list`/root，owner `{size, active}`） | `@deepseek-ai/dsh-client-ui-sidebar` | `lib/types/client/contract/slots.d.ts` | `:42–50`、`:93–108` |
| E3 | 侧栏渲染顺序：品牌 → 新会话 → **面板 nav** → 工作区 → 底栏 | `@deepseek-ai/dsh-client-ui-sidebar` | `lib/client.js` | `:322–359`（nav 在 `:322–345`） |
| E4 | 面板行点击 = `selectPanel(id)`；折叠态只渲染 `sidebar.panellist` 图标 | 同上 | `lib/client.js` | `:126–150` |
| E5 | 面板列表按 `order` 升序、`label` 支持函数 | 同上 | `lib/client.js` | `syncPanels` `:390–404`；`resolveSlotLabel` 在 `dsh-client-ui-slots/lib/index.js:27–29` |
| E6 | 侧栏座位实注册范例（order 0 / order 10） | `dsh-client-ui-plugin-manager` / `dsh-client-ui-schedule` | `lib/client.js` | `:3534–3542` / `:5437–5444` |
| E7 | 主内容区是 `keyed` 槽 `main`，保留键 `conversation`，非保留键无 Session 绑定 | `@deepseek-ai/dsh-client-ui-layout` | `lib/types/client/index.d.ts` | `SlotMap['main']` 注释 |
| E8 | `main` 派发与选中实现 | 同上 | `lib/client.js`；`lib/types/client/service.d.ts` | `MainPanel` `:65–67`；`ILayout.selectPanel` / `beginNavigation` |
| E9 | `activePanelId` 纯内存不落盘；占位者卸载即归零 | 同上 | `lib/client.js` | `:312`（init）、`:326`（select）、`:328–331`（retain）、`:486–489`、`:557` |
| E10 | 整页实注册范例（含 `children` 声明） | `dsh-client-ui-plugin-manager` | `lib/client.js` | `:3477–3526` |
| E11 | 官方插件页 key = `'plugins'`；只导出 4 个符号（页面组件未导出） | 同上 | `lib/client.js` | `PANEL_ID` `:3427`；`exports.*` `:3542–3545` |
| E12 | 子槽声明即独占渲染权 | `@deepseek-ai/dsh-client-ui-slots` | `lib/types/index.d.ts` | `ChildrenDecl` `:153–159` |
| E13 | `pluginNavigation.openBundle` 唯一深链通道 + 消费者范例 | `dsh-client-ui-plugin-manager` / `dsh-experimental-client-ui-voice-input` | `lib/client.js` | 提供 `:3523–3531`；消费 `:5688`（inject 声明 `:5673`） |
| E14 | 官方页签原语 `SegmentedTabs` / `SegmentedControl` | `@deepseek-ai/dsh-client-ui-primitives` | `lib/index.js`；`lib/types/SegmentedTabs.d.ts`、`SegmentedControl.d.ts` | 实现 `:3250–3310` / `:3425–3495` |
| E15 | 运行时共享单例注册表（8 个裸名） | `@deepseek-ai/dsh-web-frontend` | `dist/assets/index-5SrrfWpU.js` | `function rM()` |
| E16 | 客户端 bundle 把 primitives 外置（运行时解析） | 本仓库 | `plugin/packages/bundle/scripts/build.mjs` | client 构建 `external: ['react', '@deepseek-ai/dsh-client-ui-primitives']` |
| E17 | 工程内 primitives 编译期 pin = `0.1.5-rc.2`，**无** `SegmentedTabs` | 本仓库 | `plugin/packages/ui/package.json`；`plugin/packages/ui/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/{index.js,types/index.d.ts}` | pin 字段；grep `SegmentedTabs` 为空（`Switch`/`Tag`/`StateDot` 存在） |
| E18 | 设置弹窗是 800px 模态、`settings.section` 用左侧**竖向导航**而非页签 | `dsh-client-ui-settings-general` | `lib/client.js` | CSS `VOzbGW_panel` `:50`；`<nav>` `:251` |
| E19 | 设置内子页签是**手写** tablist（非官方原语） | `dsh-client-ui-settings-plugins` | `lib/client.js` | `:100–124`（`role="tablist"` + `role="tabpanel"` + 自有 CSS Module）；声明 `settings.plugins.tab` 于 `:188–194` |
| E20 | 现有企业侧注册面（4 个座位，无侧栏/无主面板） | 本仓库 | `plugin/packages/ui/src/client.tsx` | `inject` `:78`；`settings.section` `:116–121`、`settings.launcher` `:123–127`、`plugins.item` `:129–137`、`plugins.detail.badge` `:138–143` |
| E21 | 现有可见性 SQL（浏览与授权复用同一条 assignment 过滤） | 本仓库 | `server/.../skill/persistence/JdbcSkillStore.java` | `findVisiblePublished` `:236–247`、`findVisiblePublishedById` `:259–270`、`findPublishedVersionForUser` `:282–293` |
| E22 | `SubjectType` 只有 `ALL, USER`（无 GROUP/DEPT） | 本仓库 | `server/.../skill/domain/SkillAssignment.java`；`db/migration/V35__enterprise_skill_catalog.sql` | `:20`；DDL `:64`、唯一索引 `:73–77` |
| E23 | `ent_skill_package` 无 builtin/featured/category/tags 字段 | 本仓库 | `db/migration/V35__enterprise_skill_catalog.sql` | `:6–18` |
| E24 | 用户侧列表无查询参数/无分页/无 total | 本仓库 | `server/.../skill/web/RuntimeSkillController.java` | `:32` `@RequestMapping`、`:44–47` `list` 返回 `List<RuntimeSummaryView>` |
| E25 | 列表投影**不含** `versionId`（「有更新」需逐行详情请求的根因） | 本仓库 | `server/.../skill/web/SkillViews.java` | `RuntimeSummaryView` `:128–138` vs `RuntimeDetailView` `:140–152` |
| E26 | 管理员侧有游标分页但**无搜索/筛选** | 本仓库 | `server/.../skill/web/AdminSkillController.java` | `:57–80`（`CursorPageData`）；上传/发布/退役/批量分配 `:82–135` |
| E27 | 企业技能本机路由与错误码族 | 本仓库 | `plugin/packages/bundle/src/skill-route.ts`；`plugin/packages/ui/src/local-api.ts`；`plugin/packages/ui/src/local-api-decode.ts` | 本地路径 `/skills`、`/skills/{id}`、`/skills/{install,uninstall,installed}`；`ENT_SKILL_*` 族（`ENT_SKILL_ARCHIVE_INVALID`、`ENT_SKILL_DOWNLOAD_FAILED`、`ENT_SKILL_HASH_MISMATCH`、`ENT_SKILL_INSTALL_FAILED`、`ENT_SKILL_NAME_CONFLICT`、`ENT_SKILL_PACKAGE_MISMATCH`、`ENT_SKILL_SIZE_MISMATCH`） |
| E28 | SkillHub 方案 A「离线双向转换器 5–7 人日」及其工作量拆解 | 本仓库 | `docs/research/iflytek-skillhub-integration.md` | 推荐结论 `:389`；工作量 `:417–422`；不确定性关闭 `:47`、`:335`、`:375`；人日口径 `:368` |
| E29 | client `Slots` Inspect Provider 在本机不可用（两次 10s 超时），改为契约 + 实注册取证 | Harness Inspect | `cordis_inspect_query` 调用记录 | `Error: Slots.listSubTree: Client inspect query timed out after 10000ms` |

---

## 12. 一句话结论

**侧栏一级菜单与主内容区整页都有官方受支持座位（`sidebar.panellist` + `main` keyed），官方自己就是这么做的，二期形态可行；但"把官方插件页内嵌进我们的页签"做不到**——官方页面组件未导出、`main` 的 `'plugins'` 键已被独占、它声明的子槽只有它自己能渲染。因此「官方插件」页签改为**导览 + 跳转**（`ctx.layout.selectPanel('plugins')` + `ctx.pluginNavigation.openBundle(pkg)`，0.5–1 人日），主战场落在自建的「企业技能 / 企业插件 / 精选推荐」三个页签上，三场景共用同一份技能目录数据。
