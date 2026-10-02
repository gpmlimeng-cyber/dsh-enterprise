<!--
[INPUT]: 只读研读官方引擎 /data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh
         （0.2.0-rc.2）的 @deepseek-ai/dsh-client-ui-plugin-manager 与 @deepseek-ai/dsh-plugin-manager
         真实代码，以及 @deepseek-ai/dsh-skill / dsh-skill-filesystem 的能力面；另只读本仓
         docs/plan/borrow-from-skillhub.md、docs/plan/enterprise-marketplace-phase2.md、
         docs/compose/spec/skill-catalog.md 的口径。
[OUTPUT]: 冻结官方「+ 添加插件」整套流程规格（入口 / 弹层逐元素 / spec 语法真实支持范围 / 前端反馈节奏 /
          宿主语义 / 官方有无技能安装能力面的核实结论），并给出技能版「从地址安装」的照搬与不照搬清单、
          一个输入框的判定顺序与冲突处理、与既有两份规划文档的并入位置。
[POS]: docs/plan 下的参照规格文档（reference spec），不描述本仓已实现代码；是技能版安装 UX 的唯一设计依据，
       实现细节仍以 skill-catalog 与二期规划为准。
[PROTOCOL]: 变更时更新此头部，然后检查 docs/CLAUDE.md。
-->

# 官方「添加插件」流程规格 —— 技能版「从地址安装」的照做范式

> **用户要求原话**：「从地址安装可以参考官方的**创建插件按钮**逻辑」
> 即：DSH 官方插件页右上角「**+ 添加插件**」按钮背后的整套流程，就是我们要照做的范式。
> 我们做的是**技能（skill）**版：本地上传压缩包 + 粘贴 skillhub / GitHub / npm 地址。

## 0. 取证基线与只读声明

| 项 | 值 |
|---|---|
| 引擎基线 | 官方 DeepSeek Harness `0.2.0-rc.2`（`<ENGINE>/package.json:4` `"version": "0.2.0-rc.2"`） |
| 引擎根 | `/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh` |
| 官方包根 | `<ENGINE>/node_modules/@deepseek-ai/` |
| 本仓 | `/data/user/0/com.deepcode.shell/files/dsh-enterprise` |

下文简写：

- `<PM>` = `@deepseek-ai/dsh-client-ui-plugin-manager`（插件页整页 + 添加插件弹层，`lib/client.js` 共 **3548 行**）
- `<HOST>` = `@deepseek-ai/dsh-plugin-manager`（宿主侧 `ctx.pluginManager`）
- `<PRIM>` = `@deepseek-ai/dsh-client-ui-primitives`（弹层/按钮/状态点/终端块原语）

**只读事实**：本次研读未修改任何文件；引用的每一处都给「包 · 文件 · 行号 · 片段」。**凡未在本机代码中找到的，一律写进 §H 不确定项，不臆造。**
`<PM>/lib/client.js` 是打包后的 `window.__ModuleLoader__.load({...})` 单文件 bundle（`client.js:1–3`），行号即文件行号，可直接复读。

---

## A. 入口与触发

### A.1 入口长什么样

| 维度 | 事实 | 出处 |
|---|---|---|
| 页面 | 侧栏一级面板「**插件**」，`sidebar.panellist` slot，`id = "plugins"`，`order: 0` | `<PM>/lib/client.js:3534–3540`（`ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: PANEL_ID, order: 0, label: () => t("panel"), locale: NS }, PluginsPanelIcon))`）；`PANEL_ID = "plugins"` 在 `:3427`；`NS = "pluginManager"` 在 `:3426` |
| 面板文案 | `panel: "插件"` / `title: "插件"` | `client.js:58–59`（`const zh = {` 起）；英文 `:249–250` |
| 按钮位置 | 页面 `<header class=pageHead>` 右侧 `.toolbar` 内，**紧挨「刷新」图标按钮之后**（`justify-content: flex-end`） | 结构 `client.js:3212–3272`；样式 `client.js:1569` 的 `.X_2TxG_toolbar{justify-content:flex-end;align-items:center;gap:16px}` |
| 按钮形态 | 主色实心按钮 + 前置「加号」线性图标（13px）：`variant: "primary"`、`size: "sm"`、`icon: <IconPlusOutlineRegular size={13}/>` | `client.js:3263–3267` |
| 按钮文案 | `t("addPlugin")` → 中文 **「添加插件」**（原文 `addPlugin: "\u6DFB\u52A0\u63D2\u4EF6"` = 添加插件） | `client.js:3263–3270`；`zh` 字典 `client.js:70`；英文 `:261` "Add plugin" |
| 按钮文案会变 | 若已有一个安装任务在跑（`state.install.requestId !== undefined`），同一按钮文案变为 `t("installViewTask")` = **「查看安装任务」**，点击是重新打开同一任务 | `client.js:3270`；字典 `client.js:163` |
| 尺寸/圆角 | `.addButton{border-radius:var(--dsw-radius-md);height:32px;padding:0 12px;font-size:13px;line-height:20px}` | 内联 CSS `client.js:1569` |

### A.2 禁用态与前置条件

| 状态 | 判定 | 出处 |
|---|---|---|
| 按钮 `disabled` | `disabled: !loaded`；`loaded = state.status === "ready" \|\| state.status === "error"` | `client.js:3268`（禁用）、`client.js:3139`（`const loaded = ...`） |
| 整个 header（含按钮）不渲染的条件 | `showsCards`，即「没有打开 bundle 详情页 / item 详情页」；`showsCards = openPkg === undefined && openItem === undefined` | `client.js:3212`（`showsCards ? <header …> : null`）、`:3144` |
| 列表读取中 | 显示骨架屏（`ListSkeleton`），`status === "loading"` 时不渲染卡片区 | `client.js:3274`、`:3139` |
| **没有可管理 profile** | `status === "unavailable"` → 页面显示一句状态文案（带 idle 状态点）：**「本部署没有可管理的 profile，无法安装或启停插件。」**；此时 `loaded` 为 false，**「+ 添加插件」按钮仍在，但禁用** | 文案 `client.js:65`（`unavailable: "..."`）；渲染 `client.js:3275–3279`；禁用 `client.js:3268` |
| 列表读取失败且无缓存 | 原位显示错误行 + 错误状态点 + **「重试」**按钮；此态下 `loaded === true`（`status === "error"`），因此「+ 添加插件」**可用** | `client.js:3286–3298`（`failure` 区块）、`:3139` |
| 「官方」信息按钮 | 紧随副标题的 11px info 图标按钮，`aria-label: "插件说明"`，点击保持展开（`openOnClick: true`，`delayMs: 300`） | `client.js:3220–3237`；文案 `client.js:61–62` |

### A.3 点击后是什么

**是弹层（Modal），不是页面切换。**
`props.openInstall` 打开弹层（`client.js:3269` → 用户态 `openInstall` 在 `client.js:804–820`），弹层由 `<PRIM>.Modal` 渲染：

```js
// <PM>/lib/client.js:2578–2585
react_jsx_runtime.jsx(_deepseek_ai_dsh_client_ui_primitives.Modal, {
  open: install.open,
  onClose,
  title: t("installTitle"),
  closeLabel: t("close"),
  ...install.mirrorRecovery ? {} : { description: t("installDescription") },
  className: PluginManagerPage_module_css_default.installDialog,
  contentClassName: PluginManagerPage_module_css_default.installContent,
  footer: ...
```

`Modal` 的契约（居中的、body 级 portal 弹层，遮罩带模糊，Escape / 点遮罩关闭）：

```ts
// <PRIM>/lib/types/Modal.d.ts:23–24
 * @param props.onClose - application close command, Escape, or mask click; while a menu is open inside the
 * dialog, Escape belongs to that menu first.
```

弹层宽度：`.X_2TxG_installDialog{width:min(560px,100%);max-height:min(800px,100%)}`（`client.js:1569`）。

`openInstall` 同时做两件事（`client.js:804–820`）：① 埋点 `plugin_analytics.track("plugin_add_button_click", {})`；② 若没有在跑的安装任务，重置安装态并**异步预读安装源列表**（`this.readRegistries(read)`）。

### A.4 权限/环境限制（本会话所见的全部）

- 官方**客户端代码里没有任何登录/鉴权判定**参与「添加插件」的可点性；唯一的闸门是「本部署有没有可管理的 profile」（`unavailable` 态）。
- 面板注册本身依赖 4 个 client 注入：`@deepseek-ai/dsh-api-remotes`、`dsh-client-locale`、`dsh-client-ui-layout`、`dsh-client-ui-sidebar`（`<PM>/package.json` 的 `dsh.client.inject`）。缺任一，页面不出现。
- 服务端/宿主是否另有权限层：**未找到**（不确定项 §H-1）。

---

## B. 弹层内部结构（逐元素）

弹层有两个完全不同的「屏」：**spec 输入屏（phase = idle | checking）** 与 **安装向导屏（phase = starting/running/cancelling/applying/done/failed/unconfirmed/unknown）**，另有一个 **GitHub 镜像救援屏**。下面先写输入屏。

### B.1 spec 输入屏 —— 逐元素

源：`<PM>/lib/client.js:2568–2721`。

| # | 元素 | 事实与原文 | 出处 |
|---|---|---|---|
| 1 | **标题** | `installTitle` = **「添加插件」** | `client.js:2581`；字典 `:104` |
| 2 | **说明文字** | `installDescription` = **「输入插件的包名、GitHub 仓库地址或本地目录路径。」** | `client.js:2583`；字典 `:105` |
| 3 | 说明文字会消失 | 镜像救援态（`install.mirrorRecovery`）下不渲染 `description`（`...install.mirrorRecovery ? {} : { description: … }`） | `client.js:2583` |
| 4 | **输入框（只有 1 个）** | `<input type="text">`，`value = install.spec`；**无多字段** | `client.js:2610–2631` |
| 5 | 输入框 aria-label | 常态 `installSpecLabel` = **「包名或地址」**；镜像救援态 `installPackageLabel` = **「插件包名」** | `client.js:2618`；字典 `:106`、`:150` |
| 6 | **placeholder** | `installSpecPlaceholder` = **「例如 dsh-plugin-whale-pet」**（无「例如」以外的帮助语） | `client.js:2616`；字典 `:107` |
| 7 | 自动聚焦 | 只有镜像救援态 `autoFocus: install.mirrorRecovery === true`；常态不自动聚焦 | `client.js:2614` |
| 8 | 输入框样式 | `.installField input[type=text]{border:.5px solid var(--dsw-alias-border-l4);height:40px;…}`；聚焦变业务蓝边框+内嵌 0.5px 环；`[aria-invalid=true]` 变错误红边框 | 内联 CSS `client.js:1569` |
| 9 | **校验提示的呈现** | 在输入框**正下方**一行内联 `<p role="alert" class=inputError>`（红色，12px/18px），同时输入框 `aria-invalid=true`；两者用 `aria-describedby` 关联 | `client.js:2619–2620`（aria）、`:2633–2638`（提示渲染）、`inputError` 样式在 `:1569` |
| 10 | 提示文案模板 | `installProblemInvalid` = **「无法识别这个包名或地址：{reason}」**（其余见 §C.2 表） | 字典 `client.js:133` |
| 11 | 模板文本提醒（仅状态提示，非错误） | 若输入框内容**原样等于**两个模板之一，则在输入框下方以 `role="status"` 显示一句提醒：<br>· `spec === "https://github.com/author/dsh-plugin"` → **「请替换为实际的 Git 仓库地址」**<br>· `spec === "/Users/name/my-plugin"` → **「请替换为本地插件目录的实际路径」** | 判定 `client.js:2577`（两串硬编码）；渲染 `client.js:2639–2644`；字典 `:114–115` |
| 12 | **帮助文案折叠项** | 一行 `<button>` 带 chevron：`installGuideToggle` = **「插件安装引导和示例」** / 展开后变 `installGuideHide` = **「收起引导」** | `client.js:2645–2658`；字典 `:108–109` |
| 13 | 引导内容（**全文抄录**） | 只有一个 `<li>`（`GUIDE_EXAMPLES` 只有 `id` 一项）：<br>· 标题 `installGuideIdTitle` = **「填入插件 npm 包名」**<br>· 说明 `installGuideIdHint` = **「插件包名即 npm 包名（如 dsh-xxx 或 @作者/插件名），社区插件的 README 安装命令中 dsh plugin add 或 pnpm add 之后的部分。」**<br>· 示例行 `installGuideExampleLabel` = **「示例：」** + `<code>dsh-plugin-whale-pet</code>`<br>· 右侧按钮 `installGuideFill` = **「填入示例」**（aria-label `填入示例 {example}`） | `GUIDE_EXAMPLES` 定义 `client.js:2378–2383`（**只有一项**）；渲染 `:2682–2720`；字典 `:110–117` |
| 14 | **安装源选择器**（右对齐，与引导按钮同一行） | 触发器按钮 `installGuide…` 同排：文案 `registryToggle` = **「安装源」** + 当前所选源名 + chevron | `client.js:2659–2680`；字典 `:120` |
| 15 | 安装源面板 | portal 出来的 `<fieldset>`，`aria-label = registryLegend` = **「从哪个 npm 源下载插件」**；选项：默认安装源 / npm 官方源 / 中国大陆镜像源 / 自定义地址（`registryCustomPlaceholder` = `https://npm.example.com/`，`registryCustomHint` = **「填写内网或私有 npm 源地址，以 http:// 或 https:// 开头。若为需要登录的源，请把凭据放在本机的 ~/.npmrc 里。」**，非法时 `registryCustomInvalid` = **「请输入以 http:// 或 https:// 开头的地址」**） | 渲染 `client.js:2722–2790+`；文案 `:121–128` |
| 16 | **底部警示框（常驻 footer，收起引导后仍可见）** | `role="note"`，警告图标 + 两段原文：<br>· `installGuideSafety` = **「请确认插件来源可信。插件在本机以你的权限运行，来源不明的插件可能损坏 DeepSeek Harness，或读取和泄露你的数据。」**<br>· `installUpgradeNotice` = **「插件安装后，暂不支持自动更新。如需升级，请先卸载再安装新版，后续版本将持续改善升级体验。」** | `client.js:2586–2598`；字典 `:118–119` |
| 17 | **主按钮** | 全宽（`.wide{width:100%;height:40px}`）主色按钮：常态 `installRun` = **「安装」**；检查中 `installChecking` = **「正在检查…」** 并带一个 ongoing `StateDot` | `client.js:2598–2605`；字典 `:131–132` |
| 18 | **主按钮禁用规则** | `disabled: checking \|\| empty`，其中 `checking = phase === "checking"`、`empty = install.spec.trim() === ""`；同时 `aria-busy: checking` | `client.js:2601–2602`；`empty` 定义 `:2570` |
| 19 | **取消按钮** | **输入屏没有独立的「取消」按钮**——关闭由 Modal 右上角关闭按钮（`closeLabel: t("close")` = 「关闭」）+ Escape + 点遮罩承担 | `client.js:2582`；字典 `:222` |
| 20 | **回车提交** | 输入框 `onKeyDown`：`Enter && !empty && !checking` 即 `onRun()`；**输入法组合态（IME 候选词回车）不触发**（`specComposition.isComposing(event.nativeEvent)` 提前 return） | `client.js:2627–2630` |

> **B.1 的关键结论（我们最容易抄错的一点）**：官方**只给了一个输入框、一个示例（npm 包名）**。
> 输入框实际能收 Git 地址 / 本地绝对路径 / tarball（见 §C），但**引导里没有它们的示例**，
> 只有「模板串 → 提醒替换」这一条弱提示（B.1 #11）。这正好是我们技能版要补强的地方（§C.3）。

### B.2 安装向导屏（逐元素，供 §D 对照）

源：`<PM>/lib/client.js:2867–3077`。它是 `headless: true` 的 Modal（自绘头部，`client.js:2867–2871`）。

| 元素 | 事实 | 出处 |
|---|---|---|
| 左上返回 | 按钮文案：进行中为 `installCancelAndEdit` = 「取消安装并返回编辑」；否则 `installEdit` = **「编辑」**；`disabled: !stoppable`（applying 不可停） | `client.js:2878–2884`；字典 `:151–153` |
| 右上关闭 | `aria-label`：可取消时 `installCloseCancels` = **「取消安装并关闭」**，否则 `close` = 「关闭」 | `client.js:2885–2890`；字典 `:161–162` |
| 主视觉图标 | 28px `StateDot state="ongoing"`（进行中）/ `IconCheckCircleFillRegular`（done）/ `IconWarningOutlineRegular`（failed） | `client.js:2898–2906` |
| 标题 | 由 `SCREEN_TITLE_KEYS` 映射：`starting`→「正在准备安装…」、`running`→**「插件安装中…」**、`cancelling`→「正在停止安装…」、`applying`→**「正在应用配置，请稍候…」**、`unconfirmed`→「安装状态尚未确认」、`unknown`→「未能获取安装结果」、`done`→**「已安装」**、`failed`→**「插件安装失败」** | `SCREEN_TITLE_KEYS` 定义 `client.js:2396–2405`；字典 `:142–157`, `:164`, `:169–171` |
| 标题语义 | `role: phase === "failed" ? "alert" : "status"` | `client.js:2909` |
| 失败原因行 | 一行 `wizardSub`，由 `failureText()` 按宿主归因选择模板（见 §D.4） | `client.js:2912–2915`；`failureText` 定义 `:2426–2448` |
| 换源进度行 | `installAttempt` = **「{previous} 不可用，正在改用 {registry} 重试（第 {index} 个源，共 {total} 个）」** | `client.js:2860–2865`, `:2916–2919`；字典 `:185` |
| 主体卡片 | `SubjectCard`：包名/描述/`installVersion` = 「版本 {version}」；本地路径/Git/压缩包无描述时回退 `installSubjectPath`「本地目录」/`installSubjectGit`「Git 仓库」/`installSubjectTarball`「压缩包」 | `client.js:2449–2471`；字典 `:178–181` |
| 构建脚本授权块 | `installApprovalTitle` = **「需要允许安装脚本」** + `installApprovalDescription` = **「以下包声明了安装脚本，pnpm 默认不运行。」** + 待批准包名 `<code>` 列表 + `installApprovalConsequence` = **「允许后，脚本会以你的权限在本机运行，授权保存在当前 profile，之后不再询问。」** + `installApprovalCaution` = **「只在信任这些包时允许。」** + 按钮 `installApproveAndRetry` = **「允许这些脚本并重试」** | `client.js:2935–2969`；字典 `:216–220` |
| 结果行 | `installDoneNothing` = 「安装完成，没有新增依赖。」；`installDoneRestart` = **「已安装，下次启动后加载。」**；`installDoneApproved` = 「已允许运行安装脚本：{names}」 | `client.js:2970–2984`；字典 `:213–215` |
| 详情折叠 | 按钮 `installDetailsShow` = **「查看安装详情」** / `installDetailsHide` = 「收起安装详情」；展开后：`installLocation` = 「安装位置：{dir}」+ 每次 pnpm 运行一个产物块（`installAttemptBadge` = 「第 {index} 次 · {registry}」+ `TerminalBlock`） | `client.js:2985–2997`, `:3031–3060`；字典 `:176–177`, `:182`, `:186` |
| 进行中操作 | 取消按钮 `installCancel` = **「取消安装」** / `installCancelling` = 「正在停止安装…」，`disabled: !cancellable` | `client.js:3005–3012`；字典 `:161`, `:170` |
| 失败操作 | `installRetry` = **「重试」**；仅当宿主把失败归因到 registry 时额外给 `installChangeRegistry` = **「更换安装源」** | `client.js:3013–3028`；字典 `:183–184`；判定 `client.js:2866` |
| 不确定态操作 | `installReconcile` = **「核对安装状态」** | `client.js:2998–3004`；字典 `:155` |
| 成功操作 | 有 bundle 时：全宽主按钮 `installEnableNow` = **「立即启用」**（`aria-busy: install.enabling`）；无新增时：`installClose` = **「完成」** 直接关闭 | `client.js:3061–3073`；字典 `:175`, `:221` |

---

## C. spec 语法（最重要）

### C.1 真实支持范围（逐条 + 证据）

**唯一真源**是宿主侧的 `parseInstallSpec()`，客户端**不做任何本地语法判定**——它把原始字符串原样交给 `pluginManager.inspect()`：

```js
// <PM>/lib/client.js:1203
const inspected = await this.ctx.remote.pluginManager.inspect(spec, { registry }, controller.signal);
```

`inspect` 的第一件事就是 `parseInstallSpec(spec)`：

```js
// <HOST>/lib/index.js:1541–1549
async inspect(spec, options, signal) {
  let parsed;
  try {
    parsed = parseInstallSpec(spec);
  } catch (error) {
    if (!(error instanceof InvalidInstallSpecError)) throw error;
    return refused("invalid-spec", error.reason);
  }
```

#### 判定顺序（`<HOST>/lib/types/install-spec.js:57–86`，原码）

```js
export function parseInstallSpec(raw) {
    const spec = raw.trim();                                             // :58
    if (spec === '') throw invalid(spec, 'the package spec must not be empty');   // :59–60
    const path = spec.replace(/^(?:file|link):/, '');                    // :61
    if (path !== spec || isAbsolute(path)) {                             // :62
        if (!isAbsolute(path)) throw invalid(spec, 'a local path must be absolute');  // :63–64
        return TARBALL_SPEC.test(path) ? { kind: 'tarball', spec, path } : { kind: 'path', spec, path };  // :65
    }
    if (/^\.{1,2}(?:[\\/]|$)/.test(spec)) throw invalid(spec, 'a local path must be absolute');  // :67–68
    const git = GIT_SHORTHAND.test(spec) || GIT_URL.test(spec) || HOSTED_REPOSITORY_URL.test(spec);  // :69
    if (git && !TARBALL_SPEC.test(spec)) return { kind: 'git', spec, host: gitHost(spec) };  // :70–71
    if (/^https?:\/\//i.test(spec)) {                                    // :72
        if (TARBALL_SPEC.test(spec)) return { kind: 'tarball', spec, host: new URL(spec).host };  // :73–74
        throw invalid(spec, 'a URL must point at a git repository or a tarball');  // :75
    }
    const at = spec.indexOf('@', 1);                                     // :77
    const name = at === -1 ? spec : spec.slice(0, at);                   // :78
    const range = at === -1 ? undefined : spec.slice(at + 1);            // :79
    if (name.length > PACKAGE_NAME_MAX_LENGTH || !PACKAGE_NAME.test(name))  // :80
        throw invalid(spec, 'not a package name the registry accepts');  // :81
    if (range === '') throw invalid(spec, 'a version after @ must not be empty');  // :83–84
    return range === undefined ? { kind: 'registry', spec, name } : { kind: 'registry', spec, name, range };  // :85
}
```

四个正则与常量（`<HOST>/lib/types/install-spec.js:7–19`，原码）：

```js
const GIT_SHORTHAND = /^(?:github|gitlab|bitbucket|gist):/i;                 // :8
const GIT_URL = /^git(?:\+[a-z]+)?:\/\/|^git@[^:]+:/i;                      // :9
const HOSTED_REPOSITORY_URL = /^https?:\/\/[^/]+\/[^/]+\/[^/#]+(?:\.git)?(?:#.*)?$/i;  // :10
const GIT_SHORTHAND_HOSTS = { github:'github.com', gitlab:'gitlab.com', bitbucket:'bitbucket.org', gist:'gist.github.com' };  // :12–14
const TARBALL_SPEC = /\.(?:tgz|tar\.gz)(?:#.*)?$/i;                          // :16
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;  // :18
const PACKAGE_NAME_MAX_LENGTH = 214;                                          // :19
```

#### 逐条结论表

| 形态 | 支持？ | 证据（行号 + 片段） | 备注 |
|---|---|---|---|
| **npm 包名** | ✅ | `install-spec.js:18` `PACKAGE_NAME`；`:85` `{kind:'registry', spec, name}` | 只收**小写** URL-safe 段；不接受大写、前导 `.`/`_` |
| **带版本** `name@1.2.3` / `@scope/name@^2` | ✅ | `:77–79` 以**第二个 `@`**（`indexOf('@', 1)`）切分 name/range；`:85` 返回 `range` | `range` 为空串 → 报错（`:83–84`） |
| **`@scope/pkg`** | ✅ | `:18` 正则可选 `@scope/` 前缀；`:18` 前导必须是 `@[a-z0-9]` | 长度上限 214（`:19`, `:80`） |
| **本地路径** | ✅ 仅**绝对路径** | `:62` `if (path !== spec \|\| isAbsolute(path))`；`:63–64` 相对路径 → `'a local path must be absolute'`；`:67–68` `./` `../` 开头的也按相对路径拒绝 | 契约注释（`install-spec.d.ts:24–30`）：**「A path must be absolute: the Host's working directory means nothing to the person typing into a browser, and a relative path resolved against the profile would point inside it.」** |
| **本地 `.tgz`** | ✅ | `:65` 绝对路径且命中 `TARBALL_SPEC` → `{kind:'tarball', path}` | `.tgz` / `.tar.gz`，可带 `#...` |
| **tarball URL** | ✅ | `:72–74` `http(s)://` 且命中 `TARBALL_SPEC` → `{kind:'tarball', host}` | |
| **`file:` / `link:` 前缀** | ✅（会被剥掉） | `:61` `spec.replace(/^(?:file\|link):/, '')` | **剥掉后仍必须绝对**，否则同相对路径报错 |
| **git shorthand** `github:owner/repo` 等 | ✅ | `:8` `GIT_SHORTHAND`；`:12–14` 四个 host 映射；`:41–42` host 解析 | 仅 `github`/`gitlab`/`bitbucket`/`gist` 四个 |
| **git URL** `git://` / `git+https://` / `git+ssh://` | ✅ | `:9` `GIT_URL`；`:46` `new URL(spec.replace(/^git\+/i,''))` 取 host | |
| **scp 风格** `git@github.com:owner/repo.git` | ✅ | `:9` `^git@[^:]+:`；`:43–45` 取 `git@` 后的 host | |
| **托管仓库 URL** `https://github.com/owner/repo` | ✅ | `:10` `HOSTED_REPOSITORY_URL`；`:69–71` | 形状是 `https?://host/seg1/seg2[.git][#ref]` —— **正好两段路径**；`https://host/a/b/c`（三段）**不匹配** |
| **git 子目录** | ❌ | 全套正则与 `parseInstallSpec` 里**没有任何 subdirectory / `#path:` 解析**；`:71` 只产出 `{kind:'git', spec, host}` | 见 §H-2 |
| **来源前缀** `npm:` | ❌ | 只有 `file:`/`link:` 会被剥离（`:61`）、`github:` 等四家 git shorthand（`:8`）；**无 `npm:`、无 `skillhub:`、无 `git+file:`** | |
| **其它 `http(s)://`**（既非 git 仓库形、也非 tarball） | ❌ | `:75` `'a URL must point at a git repository or a tarball'` | 例如一个普通网页 URL |
| **空串** | ❌ | `:59–60` `'the package spec must not be empty'`（客户端也会先禁用按钮，`client.js:2601`） | |
| **以 `-` 开头** | ❌（宿主层二次拦截） | `<HOST>/lib/index.js:1708` `if (spec.trim() === "" \|\| spec.startsWith("-")) throw new ManagementFailure("invalid-spec");` | 防 pnpm 选项注入 |

`ParsedInstallSpec` 的类型契约（`<HOST>/lib/types/install-spec.d.ts:9–28`）：

```ts
export type ParsedInstallSpec = {
    readonly kind: 'registry'; readonly spec: string; readonly name: string; readonly range?: string;
} | { readonly kind: 'path';    readonly spec: string; readonly path: string; }
  | { readonly kind: 'tarball'; readonly spec: string; readonly path?: string; readonly host?: string; }
  | { readonly kind: 'git';     readonly spec: string; readonly host: string; };
```

`inspect` 对每种 kind 的取数方式（`<HOST>/lib/index.js:1564–1650`）：

- `git` → 直接 `accepted`，**不取包名/版本**（`:1565–1571`，`bundle: null`）
- `tarball`（本地路径）→ 先 `existsSync`，不存在则 `refused("not-a-package", "the tarball does not exist")`（`:1572–1580`）
- `path` → 读该目录的 `package.json`；不存在 → `"the path does not exist"`；读不出 → `"no readable package.json at the path: …"`；无 `name` → `"the package.json names no package"`；已装 → `already-installed`；**无 `dsh.bundle` → `refused("not-a-bundle", "<name> declares no dsh.bundle")`**（`:1581–1596`）
- `registry` → 逐个源跑 `pnpm view`；`not-found`/`no-matching-version` → `refused("not-found", …)`；`network`/`timeout` → `refused("network", …)`；**无 `dsh.bundle` → `refused("not-a-bundle", …)`**（`:1597–1637`）

### C.2 解析/检查失败时给什么提示（原文抄录）

宿主只回一个**英文 `reason` 句子**；中文句子由客户端按 `problem` 映射，**`reason` 原样拼进去**：

```js
// <PM>/lib/client.js:2368–2377
const INPUT_PROBLEM_KEYS = {
  "invalid-spec": "installProblemInvalid",
  "already-installed": "installProblemInstalled",
  "shipped": "installProblemShipped",
  "not-found": "installProblemNotFound",
  "not-a-package": "installProblemNotPackage",
  "not-a-bundle": "installProblemNotBundle",
  "network": "installProblemNetwork",
  "unknown": "installProblemUnknown"
};
```

```js
// <PM>/lib/client.js:2576（拼装那一句）
const inputSentence = inputProblem === null ? null
  : inputProblem.problem === "network" && askedByCheck.length > 1
    ? t("installProblemNetworkAll", { registries: registryList(askedByCheck, t, resolved2) })
    : t(INPUT_PROBLEM_KEYS[inputProblem.problem], { reason: inputProblem.reason });
```

| problem | 界面原文（中文，已解码） | 字典行 |
|---|---|---|
| `invalid-spec` | **「无法识别这个包名或地址：{reason}」** | `client.js:133` |
| `already-installed` | 「该插件已安装。如需升级，请卸载后重新安装」 | `:134` |
| `shipped` | 「该插件随 DSH 提供，升级 DSH 即可获得新版本」 | `:135` |
| `not-found` | 「未找到相关插件」 | `:136` |
| `not-a-package` | 「该路径不存在或不是有效的插件包」 | `:137` |
| `not-a-bundle` | 「这个包没有声明组合包，无法作为插件安装：{reason}」 | `:138` |
| `network`（单源） | 「无法连接插件源，请检查网络后重试」 | `:139` |
| `network`（多源） | 「所有安装源都无法连接（已尝试：{registries}），请检查网络或代理设置，或更换安装源」 | `:140` |
| `unknown` | 「无法获取插件信息：{reason}」 | `:141` |
| RPC 本身失败 | 走 `problem: "unknown"` + `error.message` | `client.js:1206–1215` |
| 输入框层面的兜底 | 本地校验类错误 code `reasonInvalidSpec` = 「请输入有效的包名或地址」 | `:235` |

### C.3 我们技能版「一个框」的对应设计

> 前提：官方**没有文件选择器**（全 bundle grep `type: "file"`、`directory-picker`、`FileUpload` 零命中），
> 因为它的 spec 全是「字符串能表达的东西」。我们的技能版必须**增加本地上传压缩包**，
> 而这正是「一个框 + 一个上传按钮」的设计分歧点。

#### C.3.1 一个框 + 一个上传按钮（不引入第二个文本框）

> **与并行方案的最终对账（2026-10-02，两份文档均已存在）**：`docs/plan/skill-install-sources.md:801–803`（§G.1）
> 已明确把本文定为权威——原话：「**逐元素布局、弹层结构与 spec 输入语法以 `docs/plan/add-skill-flow-reference.md` 为准**
> （那是官方「添加插件」流程的参照规格）」。同时它在同节规定**入口是两枚按钮**（工具栏「从文件安装」+「从地址安装」）。
> **所以最终形态是**：入口两枚按钮（它定），
> 「从地址安装」点开后的**弹层内部逐元素与语法**按本文（我定），
> 「从文件安装」**不经过地址输入框**，直接开文件选择器再走确认弹层（它定，见其 §G.2 通路一）。
> 本节的「一个框 + 一个上传按钮」因此读作**「从地址安装」这一个弹层内部**的设计；不要据此把两个入口合成一个。

- **一个文本输入框**（粘贴地址或包名）→ 对齐官方 B.1 #4。
- **一个「选择文件」按钮**放在输入框同一行的右侧（或输入框正下方），选中后：
  - 输入框**只读地显示文件名**（不回填绝对路径，避免用户误以为要手打路径）；
  - 内部持有本地文件句柄（浏览器 `File` 对象 / 本机路由上传）；
  - 输入框的 placeholder/说明随之切换为「已选择本地技能包：<name>.dshskill」。
- **二选一互斥**：一旦选定本地文件，文本输入框内容清空并置灰（或反之）。理由：官方一个框只表达一个 spec（`parseInstallSpec` 单串输入），我们不要造出「两个来源同时给」的歧义。
- 本地文件形态默认 `.dshskill`（与仓内 `docs/compose/spec/skill-catalog.md:28` 冻结的包格式一致）；同时接受 `.zip`（内容按同一契约探包）。

#### C.3.2 判定顺序（文本来源，自上而下，命中即停）

> **这一段跑在哪一侧（与 `skill-install-sources.md` 对齐）**：它 §G.2 通路二写明「**[前端] 只做「非空 + 长度」收窄，
> **不做**来源识别（识别在 Host，避免前端与后端两套判定）**」，其 §B.2 步骤 2 又把「来源识别 + 解析」定为
> 「**适配器（新）**，本地纯函数，不发网络」。因此**下表是实现口径、运行在 Host 侧的适配器里**，
> 前端只负责「非空 + 长度」与把字面量原样送出（对齐官方：客户端零语法判定，`client.js:1203`）。
> 若前端也做一份，就正好违反它那句「避免前端与后端两套判定」。

| 序 | 判定 | 动作 | 依据/映射 |
|---|---|---|---|
| 0 | 用户已通过文件选择器选了文件 | 走**本地包**通道，**不解析文本** | 显式动作优先，对齐官方「模板串不自动替换」（`client.js:2577`） |
| 1 | `trim() === ""` | 主按钮 `disabled`（对齐官方 `empty` 判定 `client.js:2570`+`:2601`） | |
| 2 | 显式前缀 `skillhub:` / `npm:` / `github:` | 直接定源，跳过域判定 | 官方只有 git shorthand 前缀（`install-spec.js:8`），我们**扩一条**并写进引导 |
| 3 | 域名含 `skillhub.cn`（含子域） | **技能中心**源 | 我们新造，官方无此形态 |
| 4 | `github.com/<owner>/<repo>`（两段路径，可带 `.git` / `#ref`） | **歧义** → 走 §C.3.3 | 形如官方 `HOSTED_REPOSITORY_URL`（`install-spec.js:10`） |
| 5 | `http(s)://…/x.tgz` 或 `.tar.gz`（含 `#…`） | **压缩包**源（远端拉取） | 对齐官方 `TARBALL_SPEC`（`:16`） |
| 6 | 其它 `http(s)://` | **拒绝**，提示「地址必须指向技能包、Git 仓库或 .tgz 压缩包」 | 对齐官方 `:75` 的口径与语气 |
| 7 | 匹配 npm 包名（含 `@scope/` 与 `@version`） | 先按**技能源**解析（我们的制品/目录）；无命中再回退 npm 语义 | 对齐官方 `PACKAGE_NAME`（`:18`）与 `@`切分（`:77–79`） |
| 8 | 其它 | 拒绝：「无法识别这个包名或地址：{reason}」（沿用官方句式 `client.js:133`） | |

**与官方的关键差异（必须写进规格）**：官方在 4/5/7 之间**没有歧义判定**——`github:`/git URL 一律当 git；
我们的 4 要先「探包」。因此我们**多一个网络/IO 前置步骤**，交互上必须复用官方的 `phase = "checking"`
（「正在检查…」，`client.js:132`）来盖住这段等待。

**⚠️ 枚举名必须与中心侧对齐（2026-10-02 对账）**：`docs/plan/skill-ingest-center.md:178`（要求 R1）已经把
来源枚举冻结为两端口径 `LOCAL_FILE / URL_ARCHIVE / SKILLHUB_CN / SKILLHUB_XFYUN / GITHUB_REPO / NPM_PACKAGE`，
并明确「**不允许各自起名**」（理由：provenance 要写进 `ent_skill_import`/`ent_skill_version`，命名漂移会污染审计与检索）。
因此上表 0–7 的判定结果**必须直接产出这六个 `sourceType` 之一**，不得另起 `SKILL_PACKAGE` 之类的新名：

| 判定序 | 产出 `sourceType` |
|---|---|
| 0 本地文件选择器 | `LOCAL_FILE` |
| 2 前缀 `skillhub:` 且域名为 `skillhub.cn` | `SKILLHUB_CN` |
| 2 前缀 `skillhub:` 且域名为讯飞侧 | `SKILLHUB_XFYUN` |
| 3 `skillhub.cn` 链接 | `SKILLHUB_CN` |
| 4 GitHub 仓库链接 | `GITHUB_REPO` |
| 5 `.tgz` / `.tar.gz` 链接 | `URL_ARCHIVE` |
| 7 npm 包名 | `NPM_PACKAGE` |

> 注：`docs/plan/skill-ingest-center.md:94–104`（§1.4「两个『外部站』必须分清（不许混用端点）」）明确
> `skillhub.cn` 与讯飞 SkillHub 是**两个不同的站**，因此 `SKILLHUB_CN` 与 `SKILLHUB_XFYUN` 必须在判定顺序里
> **分两条**，不能合成一条「skillhub」。
>
> 🔴 **但两份并行文档的枚举目前不一致（真实冲突，需人工裁定）**：
> · 中心侧 `docs/plan/skill-ingest-center.md:178` → `LOCAL_FILE / URL_ARCHIVE / SKILLHUB_CN / SKILLHUB_XFYUN / GITHUB_REPO / NPM_PACKAGE`（6 值，UPPER_SNAKE）
> · 客户端侧 `docs/plan/skill-install-sources.md:770` → `sourceType = 'upload' | 'skillhub' | 'github' | 'npm'`（4 值，小写；其适配器 id 见 `:497` 为 `'skillhub' | 'github' | 'npm'`）
>
> 差异点有二：**① 大小写/命名风格**；**② 客户端侧没有 `URL_ARCHIVE`，也**没有**区分 `SKILLHUB_CN` 与 `SKILLHUB_XFYUN`**
> ——而客户端那份自己的 §0.5（`:104–122`）又明确「两个站必须分清」。
> 中心侧 R1 的理由是「provenance 要写进 `ent_skill_import`/`ent_skill_version`，命名漂移会污染审计与检索」，
> 但两端 provenance 落在**不同记录**里（客户端自装记录 vs 中心导入表），所以「必须同名」这条约束的**适用范围本身也需要裁定**。
> **本文不替它们裁定**；把选定结果回填到本表即可（本表是纯映射，与取值无关）。
> 已记入 §H-12。

#### C.3.3 冲突处理：GitHub 链接既可能是技能包也可能是插件仓库

**判定算法（先轻后重，一次探包定源）**：

```text
1) 取 <owner>/<repo>（去除 .git 与 #ref），不做任何本地猜测。
2) 轻探测（HEAD/GET 元数据，命中即定源，不下载整包）：
     a. 仓库根存在 skills/**/SKILL.md 或根 SKILL.md  → 技能包
     b. 仓库根 package.json 的 dsh.bundle 字段存在   → 插件仓库
3) 两者命中其一 → 定源并给出「来源已识别为 <技能包/插件仓库>」一行文案（对齐官方 SubjectCard 的
   installSubjectGit「Git 仓库」那种「先告诉用户我认成了什么」的呈现，client.js:180）。
4) 两者都命中（monorepo 常见）或两者都不命中：
     → 不猜。弹层内出现一次「来源选择」二选一（技能包 / 插件仓库），默认选中【技能包】
       （因为我们是技能版，且默认值收窄失败面）。
     → 若用户选了「插件仓库」，本框不处理，改为引导用户去官方插件页
       （ctx.layout.selectPanel('plugins')，见二期规划 §1.3 方案 A）。
5) 探测失败（网络/超时）：沿用官方的归因口径——不是「无法识别」，而是
   installFailureNetworkHost 的语气「无法连接 {host}。GitHub 地址和 .tgz 直链不经过安装源，
   需要本机能直接访问它或配置代理；如果这个插件也发布到了 npm，请改填包名。」
   （client.js:189，把「插件」换成「技能」）。
```

**为什么默认给技能包**：官方那个框的默认语义就是「安装一个插件包」；我们的框默认语义是「安装一个技能包」。
默认值与页面语义一致，可减少一次点击，也让「两者都命中」这个最常见的 monorepo 情况走最短路径。

**不允许的做法**：不要把「猜测」做成静默行为——官方每个决定都会回吐到 UI（`SubjectCard`、`installAttempt`、
`installAttemptBadge`）。探测结论必须显式回显一行。

**⚠️ 与 `skill-install-sources.md` 错误码口径的对齐（它已先冻结，需服从）**：
该文 §B.2（`:207–231`）已把通路二的失败**逐步骤**绑定了稳定错误码，其中两条正好落在这个冲突上：

| 它的码 | 它的触发步骤 | 与本节的对应 |
|---|---|---|
| `ENT_SKILL_SOURCE_NO_SKILL`(400) | 步骤 6「定位技能」（`:220`） | 「两者都不命中」/「命中插件仓库」应**优先落到这个码**，而不是我先写的「二选一」——二选一没有码可给 |
| `ENT_SKILL_SOURCE_AMBIGUOUS`(409) | 步骤 6（`:220`） | 它的语义是**一个仓库里有多个技能**，与本节的「技能包 vs 插件仓库」**是两个不同的歧义**，不要复用同一个码 |

**因此修订本节算法**（保留探测逻辑，改掉第 4 步的呈现）：

```text
4) 两者都不命中（既无 SKILL.md，也无 dsh.bundle）→ 直接失败：
     UI 行内 role="alert" + 稳定错误码 ENT_SKILL_SOURCE_NO_SKILL，
     并在旁边给一个动作「去官方插件页看看」（ctx.layout.selectPanel('plugins')）。
     —— 不给「二选一」，因为这种情况下我们两边都不能证明。
   两者都命中（monorepo）→ 保持二选一，默认【技能包】；选插件仓库则同上跳官方插件页。
   仓库里技能多于 1 个 → 这不是类型歧义，交给它步骤 6 的 ENT_SKILL_SOURCE_AMBIGUOUS(409)
     + 它的 §G.2 通路二「多技能时给候选选择」处理，本节不重复设计。
```

**理由**：`skill-install-sources.md:855–860`（§G.4/§G.3）与二期规划 `:294` 已立下「只显示稳定错误码 + 固定文案，
不自造长句解释」的纪律；「二选一」是一个**没有码可归属**的中间态，会破坏这条纪律。
本节据此让位。

#### C.3.4 引导（我们要比官方多给的东西）

官方引导只有 1 条（npm 包名，`client.js:2378–2383`），Git/路径只有「模板提醒」（`:2577`）。
技能版建议 3–4 条（同一个 `<ol class=guideList>` 结构，`client.js:2686–2720`）：

| 条目 | 示例（填入示例按钮回填的串） |
|---|---|
| 本地上传技能包 | （不是文本，按钮直接开文件选择器） |
| 粘贴 skillhub 地址 | `https://skillhub.cn/skills/<slug>` |
| 粘贴 GitHub 地址 | `https://github.com/<owner>/<repo>` |
| 填入技能包名 | `@作者/技能名` 或 `dsh-skill-xxx` |

语气沿用官方：标题祈使句、说明句尾句号、示例前置「示例：」+ `<code>`（`client.js:2703–2707`）。

---

## D. 安装过程的前端行为

### D.1 阶段模型（客户端）

`phase` 取值与判定（`<PM>/lib/client.js:590–592`）：

```js
function isInstallPending(phase) {
  return phase === "starting" || phase === "running" || phase === "cancelling"
      || phase === "applying" || phase === "unconfirmed";
}
```

| phase | 界面 | 触发点 |
|---|---|---|
| `idle` | spec 输入屏 | 打开弹层 / 取消后回到编辑 |
| `checking` | spec 输入屏；主按钮变「正在检查…」+ ongoing 点，输入框 `disabled`，安装源按钮 `disabled`，引导里的「填入示例」按钮 `disabled` | 点「安装」→ `pluginManager.inspect()` 期间（`client.js:1203`） |
| `starting` | 向导屏「正在准备安装…」 | `startInstall()` 调 `installBundle` 之前（`client.js:1250–1259`） |
| `running` | 向导屏「插件安装中…」 | 收到宿主 `installing` 进度后映射而来（`client.js:953–975`；`:971` `phase: progress.phase === "installing" ? "running" : progress.phase`） |
| `cancelling` | 「正在停止安装…」；产物块标签变「已取消」 | `sendCancellation()`（`client.js:1384–1388`） |
| `applying` | **「正在应用配置，请稍候…」**（**不可取消**） | 宿主 `applying` 进度（`client.js:1406`） |
| `failed` | 「插件安装失败」+ 一句归因 + 重试/更换安装源 | `settleInstall()`（`client.js:1314–1321`） |
| `done` | 「已安装」+ 结果行 + 「立即启用」/「完成」 | `settleInstall()`（`client.js:1322–1329`） |
| `unconfirmed` / `unknown` | 「安装状态尚未确认」/「未能获取安装结果」+「核对安装状态」 | `installUncertain()`（`client.js:1335–1344`） |

### D.2 进行中态：按钮/输入框怎么变

- **主按钮**：文案换为「正在检查…」，前置 ongoing `StateDot`，`aria-busy: true`，`disabled`（`client.js:2598–2604`）。
- **输入框**：`disabled: checking`（`client.js:2617`）。
- **安装源触发器**：`disabled: checking`（`client.js:2666`）。
- **引导「填入示例」按钮**：`disabled: checking`（`client.js:2713`）。
- **页面上的入口按钮**：文案变「查看安装任务」（`client.js:3270`）——**安装任务可以在关闭弹层后继续**。
- **关闭弹层**：`onClose` 若在 pending 态，**先关弹层再请求取消**（`client.js:821–826`），并通过 toast 通知结果（`notifyHiddenInstall`，`:1423–1429`）。

### D.3 进度 / 阶段提示

- **阶段文案**见 §D.1（全部原文在 `SCREEN_TITLE_KEYS`，`client.js:2396–2405`）。
- **逐源换源提示**：`installAttempt` 一句 + 详情里每次 pnpm 运行带 `installAttemptBadge`（`client.js:2860–2865`、`:3040–3045`）。
- **pnpm 产物**：折叠在「查看安装详情」之后，用 `TerminalBlock` 渲染 `command`/`output`/`exitCode`/`running`，
  行数上限 `INSTALL_TERMINAL_LINES`，标签「运行中/失败/已完成/无输出/退出码 {code}/信号 {signal}/未正常退出」（字典 `:200–212`）；运行中 `run.exitCode === undefined`（`client.js:3046–3057`）。

### D.4 能不能取消

- 输入屏 `checking`：可停（`cancelInstall()` → `abortInspect()`，`client.js:1367–1371`）。
- `starting` / `running` / `unconfirmed`：可请求取消，但**要等宿主确认**（`cancelInstall` → `cancelInstall` RPC，`:1374–1378`、`:1388`）。
- **`applying` 不可取消**：`stoppable = false`，取消按钮 `disabled`（`:2882`、`:3009`）；页面返回按钮文案仍为「取消安装并返回编辑」，但置灰。
- 宿主回 `too-late` → 客户端切 `applying` 并提示「安装已进入收尾阶段，无法取消，可查看安装进度」（字典 `:168`）。
- 取消**确认后**：回到 spec 输入屏并显示 toast「已取消安装，插件未启用，下载的文件可能保留」（字典 `:173`；`offerSpecAgain` 在 `:1434–1440`）。
- 取消失败/未确认：`installCancelUnconfirmed` = 「尚未确认安装已停止，请重试取消或等待安装结果。{reason}」（字典 `:174`）。

### D.5 失败时错误显示在哪

**两层，都在同一个弹层里，不回落到页面：**

1. **检查期（inspect 拒绝）→ 回到输入屏，错误显示在输入框正下方**（内联 `<p role="alert">`，输入框红框），spec 保留可继续编辑（`client.js:1206–1229` + `:2633–2638`）。
2. **安装期（pnpm/宿主失败）→ 停在向导屏的 `failed` 态**：标题「插件安装失败」+ 一行归因（`wizardTitle role="alert"` + `wizardSub`，`client.js:2907–2915`），
   详情折叠里是 pnpm 原始输出，操作区是「重试」/「更换安装源」。

失败归因的**文案选择逻辑**（`failureText`，`client.js:2426–2448`），决定「用哪句话」：

| 条件 | 文案 key | 中文原文 |
|---|---|---|
| `failure.kind === "build-blocked"` 且无 pendingBuilds | `installFailureBuildBlockedManual` | **「有依赖的安装脚本被 pnpm 拦下，请在 profile 的 pnpm-workspace.yaml 的 allowBuilds 中放行后重试」** |
| `failure.failedAt === "spec-host"`（有 host） | `installFailureNetworkHost` | **「无法连接 {host}。GitHub 地址和 .tgz 直链不经过安装源，需要本机能直接访问它或配置代理；如果这个插件也发布到了 npm，请改填包名。」** |
| `failedAt === "registry"` 且 network/timeout 且问过 >1 个源 | `installFailureNetworkAll` | 「所有安装源都无法连接（已尝试：{registries}）。请检查网络或代理设置，或更换安装源后重试。」 |
| 其它有 `kind` | `FAILURE_KIND_KEYS` | `pnpm-missing`「没有找到 pnpm，无法安装」/`timeout`「安装超时」/`not-found`「未找到相关插件」/`no-matching-version`「没有匹配的版本」/`network`「网络连接失败」/`disk-full`「磁盘空间不足，安装已停止」/`permission`「没有写入权限，无法安装」/`build-blocked`「有依赖的安装脚本需要你允许后才能继续」/`integrity`「下载的安装包校验失败」/`unknown`「安装过程中出错，原因见安装详情」 |
| 有 `code`（管理类） | `managementText` | 见 `reason*` 串（`client.js:232–246`） |
| 兜底 | `installFailureGeneric` | 「安装过程中出错，原因见安装详情」 |

（`FAILURE_KIND_KEYS` 定义 `client.js:2384–2395`；`kind` 全集 `client.js:78`；字典 `:187–199`；`client.js:191`「没有匹配的版本」对应 `installFailureNoMatchingVersion`。）

**还有一个专门的救援屏**：当失败被归因到 spec host 且 host 是 `github.com`（或 `*.github.com`）且网络/超时时，
弹层**整体换成**一个更短的 Modal（`client.js:2545–2566`）：标题 `installGithubFailedTitle` = **「无法访问 GitHub」** 或
超时 `installGithubTimeoutTitle` = **「连接 GitHub 超时」**，说明 `installGithubFailedDescription` = **「请尝试其他安装来源。」**，
按钮 = 「取消」+ `installUseGithubMirror` = **「改用国内镜像」**（若已在用镜像则改为 `installTryAnotherWay` = 「试试其他方式」）。
选择镜像后**回到空的包名输入框**、记住所选安装源、**不自动开始**下一次安装（README.zh.md 同段有同口径描述）。

### D.6 成功后的去向

```js
// <PM>/lib/client.js:1446–1469（enableInstalled）
async enableInstalled() {
  const install = this.getSnapshot().install;
  if (install.phase !== "done" || install.enabling) return;
  const name = install.installed;
  this.patchInstall({ enabling: true });
  if (name !== null) {
    const result = await this.ctx.remote.pluginManager.setBundleEnabled(name, true);
    ...
  }
  this.patch({ install: IDLE_INSTALL, highlight: name });   // 关弹层 + 记住要高亮的包
  await this.load();                                        // 重新读列表
}
```

- **不自动跳详情页**：成功后停在弹层的 `done` 屏，等用户点「**立即启用**」或直接关。
- 「立即启用」= 启用新组合包 → **关闭弹层** → 重新读列表 → 把该卡片 `data-plugin-highlight` 高亮
  （CSS：`animation: 2.4s ease-out X_2TxG_dsh-plugin-highlight`，且在 `prefers-reduced-motion` 下退化为静态描边，`client.js:1569`）。
- 直接关闭 = **保持「已安装但未启用」**（README.zh.md 原文：「直接关闭则让它保持已安装但关闭」）。
- 「立即启用」被拒时：toast 一句失败，**弹层仍关闭**，列表显示没打开的东西（`client.js:1454–1462` 的注释与实现）。
- 若安装结果是 `restart-required`：`done` 屏额外一行 `installDoneRestart` = 「已安装，下次启动后加载。」（`client.js:2975–2979`）。

### D.7 我们照搬的是「节奏」，不是实现

照搬清单见 §F。**一句话**：`idle → checking → starting → running →(cancelling)→ applying → done|failed`，
每个阶段都有**确定文案 + 确定可做的动作**，失败**回到最近的编辑点**而不是丢到页面 toast，成功**留在弹层等你决定**。

---

## E. 宿主侧语义

### E.1 能力面（`ctx.pluginManager`，`<HOST>/lib/types/index.d.ts`）

| 方法 | 行 | 签名 |
|---|---|---|
| `listPlugins()` | `:79` | `Promise<PluginInfo[]>` |
| `listBundles()` | `:83` | `Promise<BundleInfo[]>` |
| `registries()` | `:87` | `Promise<PluginRegistries>` |
| `inspect(spec, options?, signal?)` | `:94` | `Promise<PluginSpecInspection>` |
| `setPluginEnabled(id, enabled)` | `:100` | `Promise<ChangeResult>` |
| `setBundleEnabled(name, enabled)` | `:106` | `Promise<ChangeResult>` |
| **`installBundle(spec, options?)`** | `:118` | `Promise<ChangeResult>` |
| `waitForInstall(requestId)` | `:124` | `Promise<ChangeResult \| null>` |
| `cancelInstall(requestId)` | `:130` | `Promise<PluginInstallCancellation>` |
| `removeBundle(name)` | `:135` | `Promise<ChangeResult>` |

### E.2 `installBundle` 入参形状

```ts
// <HOST>/lib/types/types.d.ts:120–129
export type PluginInstallRequestId = Branded<'PluginInstallRequestId'>;
/** Bundle installation defaults to activation; callers that offer cancellation supply their request id. */
export interface InstallBundleOptions {
    enabled?: boolean;
    requestId?: PluginInstallRequestId;
    /** Explicitly allow these pending packages' scripts for this profile, then install; a name no longer pending refuses the call. */
    approvedBuilds?: string[];
    /** The registry asked first; absent, the configured one. The configured fallbacks follow while a registry is unreachable or stale. */
    registry?: Registry;   // Registry = string | null  (:69)
}
```

官方 UI 的实际调用（`enabled: false` —— 先装、后由用户决定启用）：

```js
// <PM>/lib/client.js:1260–1265
const result = await this.ctx.remote.pluginManager.installBundle(spec, {
  enabled: false,
  requestId,
  registry,
  ...approvedBuilds === undefined ? {} : { approvedBuilds: [...approvedBuilds] }
});
```

### E.3 返回值 / 错误语义

```ts
// <HOST>/lib/types/types.d.ts:92–118
export interface ChangeResult {
    changed: boolean;
    application: 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled';
    stage: 'install' | 'enable' | 'remove';
    target: string;
    enabled?: boolean;
    error?: ManagementError;
    warnings?: string[];
    packageResult?: PackageResult;
    bundle?: string;              // 装成功后新增的组合包名
    pendingBuilds?: string[];
    approvedBuilds?: string[];
    registries?: Registry[];      // 依次问过的源
    failedAt?: 'registry' | 'spec-host';
}
```

- `ManagementError.code` 集合（`types.d.ts:16–22`）：`management-required | unaddressable | unknown-plugin | invalid-spec | ambiguous-install | not-bundle | not-removable | stop-profile | bundle-in-use | stale-approval | incompatible-version | operation-error`（另有 `diagnostic` / `incompatible`）。
- `PackageResult.kind`（`:78`）：`pnpm-missing | timeout | not-found | no-matching-version | network | disk-full | permission | build-blocked | integrity | unknown`，由 `classifyInstallFailure()` 从 pnpm 的 `ERR_PNPM_*` 与 Node errno 读出来（`install-failure.d.ts` 模块注释）。
- `PluginSpecInspection`（`:139–164`）：`accepted{kind,name?,version?,description?,bundle:boolean|null,registry,host?}` 或 `refused{problem,reason,registries?}`，`problem ∈ invalid-spec|already-installed|not-found|not-a-package|not-a-bundle|network|unknown`（`:138`）。
- `PluginInstallCancellation.status ∈ 'cancelled' | 'too-late' | 'not-running'`（`:176–179`）。

### E.4 失败时会做什么（回滚）

```js
// <HOST>/lib/index.js:1096
const RESTORED_FILES = ["package.json", "pnpm-lock.yaml"];
```

```js
// <HOST>/lib/index.js:1714（安装前快照） → :1790–1793（失败即还原）
const files = await this.readRestoredFiles();
...
} catch (error) {
  await this.restoreFiles(files);
  throw error;
}
```

```js
// <HOST>/lib/index.js:1974–1978
/** Put the profile files back; pnpm has exited by the time this runs. */
async restoreFiles(files) {
  for (const [path, content] of files) if (content === void 0) await rm(path, { force: true });
  else await writeFileAtomic(path, content, { mode: 384 });
}
```

另外，**逐源重试前**也会先还原上一次尝试的文件（`:1741` `if (index > 0) await this.restoreFiles(files);`）。
契约原话（`<HOST>/lib/types/index.d.ts:110–117`）：

> 「Install a package using the same pnpm implementation as dsh plugin. … A run that fails, is cancelled, or adds a package without a bundle patch restores `package.json` and `pnpm-lock.yaml` as they were; downloaded files can stay.」

### E.5 网络拉取由谁负责

**全部由宿主负责**，浏览器端一步网络都不做：

- 宿主跑 `pnpm add <spec> [--registry=...]`（`<HOST>/lib/index.js:1749–1753`）。
- GitHub 连接检查也在宿主（`:1719–1737` 的 `checkGithubConnection`，超时由 `githubConnectionTimeoutMs` 约束；只有 network/timeout 才拦，其余交给 pnpm）。
- 包名查存在性也是宿主 `pnpm view`（`inspect` 的 registry 分支，`:1597–1637`）。
- **唯一的浏览器直连**是一个**额外的、可关的**注册表探测服务 `pluginRegistryProbe.fastest()`，它在宿主侧用 fetch 打 `registry.npmjs.org/-/ping` 与 `registry.npmmirror.com/-/ping` 比谁先 2xx（`<PM>/lib/index.js` 的 `PluginRegistryProbe`，配置项 `registryProbeEnabled`/`registryProbeTimeoutMs`/`registryProbeCacheTtlMs`）。**它不是安装路径**，只用于挑默认源。

### E.6 ⭐ 官方有没有「技能安装」能力面 —— 核实结论

**结论：官方没有任何技能安装 / 上传 / 落盘的能力面。技能侧只有「发现契约」。我们的技能版只能借它的 UX 与错误呈现范式，不能借它的安装实现。**

**证据一（能力面只有读）**：`ctx.skills` 是 `SkillRegistry`（`@deepseek-ai/dsh-skill`），
公开方法只有 `registerProvider` / `register` / `list` / `snapshot` / `get`，**没有任何 install/upload/write**：

```ts
// <ENGINE>/node_modules/@deepseek-ai/dsh-skill/lib/types/index.d.ts
159: export interface SkillProviderObservation { ... }
166: export interface SkillProvider { readonly list: ...; readonly get: ... }   // 只有 list + get
201:         skills: SkillRegistry;
247:     registerProvider(create: (control: SkillProviderControl) => SkillProvider): () => void;
257:     register(skill: SkillRegistration): () => void;
266:     list(options?: SkillViewOptions): Promise<SkillSummary[]>;
274:     snapshot(options?: SkillViewOptions): Promise<SkillCatalogSnapshot>;
284:     get(name: string, options?: SkillViewOptions): Promise<SkillDefinition | undefined>;
```

包自述也把它定成「服务定义缝」：「This package owns the Service Definition role of the skill capability seam.
Concrete providers such as `@deepseek-ai/dsh-skill-filesystem` decide where skills come from; this service only merges
provider catalogs, resolves the winning skill for a name, and exposes the winning summaries and definitions to consumers.」
（`dsh-skill/lib/types/index.d.ts:1–10` 模块注释）

**证据二（本地 provider 只扫目录）**：`@deepseek-ai/dsh-skill-filesystem` 的配置项全是**扫描根**，
没有写入路径：`dshHome`、`agentsHome`、`customSkillDirs`、`bundledSkillDir`、`watch*`
（`dsh-skill-filesystem/lib/types/index.d.ts` 的 `Config`）；其类注释：「discovers … from project, custom, and user roots,
parses YAML frontmatter, and loads bodies through `ctx.fs` when a filesystem service is present.」
落盘即被 watcher 发现——**官方只承诺「发现」，不承诺「安装」**。

**证据三（全量 grep 零命中）**：在 `<ENGINE>/node_modules/@deepseek-ai/*/**` 上 grep
`installSkill|skillInstall|uploadSkill`（`*.js` + `*.d.ts`）**零命中**。

**证据四（本仓既有核对结论，与此独立印证）**：`docs/compose/spec/skill-catalog.md:35` 原话：

> 「官方无 `skills/install` RPC（已全量核对 0.2.0-rc.2 asar）」

同文 `:118` 的二期重核结论：

> 「官方没有技能安装 RPC——`@deepseek-ai/dsh-plugin-manager` 只提供 `installBundle`/`removeBundle`（pnpm 装 npm 包，不是技能），技能的唯一官方能力面是 `dsh-skill-filesystem` 的「发现契约」。」

**因此**：技能版**可以照搬**的是 §A（入口形态）、§B（弹层结构）、§C（一个框的语法风格与拒绝语气）、
§D（checking/进行中/失败/成功的节奏与文案语气）；**不能照搬**的是 §E.1–E.5 的 `installBundle`/pnpm/回滚实现
（我们走自己的原子落盘，见 §F）。

---

## F. 照搬清单 + 不照搬清单

### F.1 照搬（逐条，附官方出处）

1. **入口形态**：页头右侧 toolbar 内、「刷新」之后的**主色小按钮 + 13px 加号图标 + 两个字「添加」**；
   有在跑的任务时同一按钮变「查看安装任务」。→ `<PM>/lib/client.js:3263–3270`。
2. **禁用规则**：列表没读出来（`!loaded`）就禁用；「没有可管理 profile」时按钮**仍在但禁用**，页面给一句解释
   「本部署没有可管理的 profile，无法安装或启停插件。」→ `:3268`、`:65`、`:3275–3279`。
3. **弹层而非页面跳转**，宽度 `min(560px,100%)`，右上角关闭 + Escape + 点遮罩 → `<PRIM>/lib/types/Modal.d.ts:23–24`、`client.js:1569`、`:2578–2585`。
4. **弹层顶部三段**：标题（「添加插件」）+ 一句说明（「输入插件的包名、GitHub 仓库地址或本地目录路径。」）+ 一个输入框。→ `:2581–2583`、`:2610–2631`。
5. **placeholder 用「例如 <真包名>」** 这种可照抄的具体示例，而不是「请输入…」。→ `:2616`、字典 `:107`。
6. **内联校验**：错误在输入框正下方 `<p role="alert">`，输入框红框 + `aria-invalid` + `aria-describedby`；文案模板「无法识别这个包名或地址：{reason}」把宿主原话拼进去。→ `:2619–2620`、`:2633–2638`、字典 `:133`。
7. **帮助区折叠**：一行可展开的「插件安装引导和示例」/「收起引导」，内含示例 + 一个「填入示例」按钮。→ `:2645–2658`、`:2682–2720`。
8. **常驻底部警示**：来源可信警示 + 「暂不支持自动更新」提示，`role="note"`，收起引导后仍可见。→ `:2586–2598`、字典 `:118–119`。
9. **主按钮全宽、给出进行中文案**（「安装」→「正在检查…」+ ongoing 状态点 + `aria-busy`）。→ `:2598–2605`。
10. **回车提交 + IME 保护**：`Enter && !empty && !checking` 才提交，组合态回车不提交。→ `:2627–2630`、`:2484–2488`。
11. **阶段文案与阶段动作一一对应**（idle/checking/starting/running/cancelling/applying/done/failed/unconfirmed/unknown），失败回到最近的编辑点，成功留在弹层等用户决定。→ `:2396–2405`、`:1301–1334`、`:1446–1469`。
12. **成功后的高亮**：关闭弹层 → 刷新列表 → 目标行做一次性高亮（2.4s 动画，减少动态效果下退化为静态描边）。→ `:1464–1468`、`:1569`。
13. **长任务的产物折叠**：默认收起（「查看安装详情」），展开给 命令 + 输出 + 退出码 + 运行中状态。→ `:2985–2997`、`:3031–3060`。
14. **换源/重试显式化**：失败给「重试」，只有归因到 registry 时才额外给「更换安装源」；换源过程在屏幕上说一句「{previous} 不可用，正在改用 {registry} 重试（第 i 个源，共 n 个）」。→ `:2866`、`:3013–3028`、字典 `:185`。
15. **文案语气**：短句、句号结尾、祈使句给动作（「请确认插件来源可信。」）、不吓唬人但把风险说清。→ 字典 `:104–146`, `:161–199`。

### F.2 不照搬（逐条 + 理由）

| # | 不照搬 | 理由 |
|---|---|---|
| 1 | **`installBundle` / pnpm 安装实现**（`pnpm add` in profile、`--registry` 逐源重试） | 技能不是 npm 包，官方无技能安装能力面（§E.6）。我们走自己的 `.dshskill` 制品通道 |
| 2 | **它的回滚机制**（`RESTORED_FILES = ["package.json","pnpm-lock.yaml"]` + `restoreFiles`） | 我们有自己的**原子落盘**纪律：`.part` + SHA-256 校验 + staging 目录 + 逐个原子改名 + 失败回滚本次改名（`docs/compose/spec/skill-catalog.md` §S2.7）。照搬会引入一份多余的、语义不同的回滚 |
| 3 | **它的权限模型**（无客户端鉴权，只有「有没有可管理 profile」） | 技能侧另有信任模型：**企业分发**（设备 `ACTIVE` + assignments 判定）vs **本机自装**。照搬会把「浏览自由·安装受控」的口径搞乱（二期规划 §4） |
| 4 | **「安装源 / registry」这整块 UI**（安装源按钮、自定义源、npmmirror 镜像救援屏、注册表 ping 探测） | 技能来源不是 npm registry；镜像救援概念对 skillhub/GitHub 直链无对应物（GitHub 直链本就不经过 registry，官方自己也说 `installFailureNetworkHost`） |
| 5 | **它的「已安装/已装就要卸载重装」升级语义**（「插件安装后，暂不支持自动更新」） | 技能是文件树、可原子替换，我们已有版本签与原子升级；照抄这句会在技能页写出**错误**的产品承诺 |
| 6 | **它的组合包（bundle）/行（row）/patch 模型**（`setBundleEnabled`、`plugins.row.*` 子槽、`cordis.patch.yml` 改写） | 技能没有「组合包 + 行 + patch」这一层；技能是 `skills/<name>/SKILL.md` 树 |
| 7 | **它的构建脚本授权流程**（`pendingBuilds` / `allowBuilds` / 「允许这些脚本并重试」） | 我们明确「安装＝落盘，绝不执行包内任何内容」（`docs/compose/spec/skill-catalog.md` §S2.7 四条边界）。保留这块会暗示我们会跑用户的脚本 |
| 8 | **它的安全文案原句**（「插件在本机以你的权限运行，来源不明的插件可能损坏 DeepSeek Harness…」） | 语义要改：技能是**模型会加载的指令**，风险面是「指令注入 / 数据外泄」而非「本机代码执行」。文案要重写（照搬语气，不照搬句子） |
| 9 | **「手打绝对路径」这一条** | 官方要求绝对路径（`install-spec.js:63–64`），因为浏览器不知道 cwd。我们**改成文件选择器**（用户明确要求本地上传压缩包），从根上避免这个坑 |
| 10 | **它只有 1 个示例的引导** | 我们四个来源，引导要 4 条（§C.3.4） |

---

## G. 与既有规划文档的关系

> ⚠️ **口径纠正（含并行提交的时效说明）**
> 任务点名两份文档，实际状态是：
> - `docs/plan/skill-ingest-center.md` —— **已存在**（871 行，本次研读期间由并行代理创建；本文档写完后已重新对账过一次）。
> - `docs/plan/skill-install-sources.md` —— **本次结束时仍不存在**（`ls docs/plan/` 与全盘 `find / -name "skill-install-sources*"` 均零命中）；
>   但 `skill-ingest-center.md:21` 的 `[POS]` 明确写着「客户端侧方案由 `docs/plan/skill-install-sources.md` 负责」，
>   即它**正在被另一个代理写**。因此本规格与它的对账**留到它落地后补**（见 §H-10）。
>
> 下面按**已存在的四份**文档对账。**本次未修改它们中的任何一份**（`git status` 只多出本文件一个未跟踪项）。

### G.1 对账表

| 既有文档 | 它与本规格的关系 | 本规格该并入哪一节 |
|---|---|---|
| `docs/plan/enterprise-marketplace-phase2.md`（企业应用商店二期，`status: planning`） | **最直接**：它已冻结「侧栏一级菜单 + 主内容区多页签」的承载形态、三层可见性、「浏览自由·安装受控」的判定点与错误码。本规格是它的 **UX 细化层**，填掉「一个框怎么收四个来源」这一块空白 | §2.2 页签清单的「**企业技能**」行；§6 客户端需补能力表新增一行 **C10「技能添加弹层（规格见 docs/plan/add-skill-flow-reference.md）」**；其 §4.2 的 ① 行渲染判定（`entitled=false` → 「申请」）应成为本弹层失败态的第 3 类归因 |
| `docs/plan/skill-ingest-center.md`（企业中心多渠道导入，871 行） | **架构互补、枚举强耦合**：它管**服务端/控制台**怎么把外部渠道导进企业目录（离线适配器路线），并明确「**客户端（员工个人设备）的用户自发安装与「粘贴地址安装」交互不在本文范围**」（`:22–24`）——**那正是本规格**。两者共享同一个「一个来源 = 一个适配器」抽象（它 §B.1） | 它 **§B.1 要求 R1（`:178`）**冻结的 `sourceType` 枚举是本规格 §C.3.2 的**上游约束**（已在该节写入映射表）；它 **§F.3 进度与失败反馈（`:611`）** 的「不做乐观 UI」「失败必须带稳定错误码」与本规格 §D 的官方节奏**必须合流**，建议在它 §F.3 补一句「客户端侧对照 `docs/plan/add-skill-flow-reference.md` §D」 |
| `docs/plan/borrow-from-skillhub.md`（SkillHub 借鉴取舍） | **互补**：它管「内容与治理概念怎么吸收」（格式转换器、审核状态机、namespace、不要直连 API）。本规格**不含**任何服务端/来源治理主张，只管客户端 UX | 其 §2「设计上值得抄的」不改；建议在其 §6 关系表加一行指向本文件，标注「**UX 层参照**（技能添加弹层）」，与它的「证据层/执行层」并列 |
| `docs/compose/spec/skill-catalog.md`（技能目录，`status: delivered`） | **实现层真源**：`.dshskill` 包契约、`/skills/{installed,install,uninstall}` 三条本机路由、原子落盘顺序、四条边界、「官方无 `skills/install` RPC」的核对结论 | 本规格 §C.3.1 的「默认 `.dshskill`」与 §F.2 #2/#7 均引自它；§E.6 与它 §S2.7 的结论一致 |

**额外交叉印证（四处独立得出同一结论）**：本规格 §E.6 的「官方无技能安装能力面」，
与 `docs/compose/spec/skill-catalog.md:120`、`docs/plan/skill-ingest-center.md:138–152`（§A.3）
**三份文档、同一结论**，且三者引用的官方证据是同一批（`dsh-plugin-manager` 只有 `installBundle`/`removeBundle`；
技能唯一能力面是 `dsh-skill-filesystem` 的发现契约）。此结论可视为**已冻结**。

### G.2 有无冲突口径

**没有发现实质冲突**，但有 **4 处需要显式对齐**（第 1 条是与 `skill-ingest-center.md` 新出现的**硬耦合**）：

1. **⭐ `sourceType` 枚举必须两端同名（新增，硬约束）。** `skill-ingest-center.md:178` 的 R1 已冻结
   `LOCAL_FILE / URL_ARCHIVE / SKILLHUB_CN / SKILLHUB_XFYUN / GITHUB_REPO / NPM_PACKAGE`，理由是
   「provenance 要写进 `ent_skill_import`/`ent_skill_version`，命名漂移会污染审计与检索」。
   本规格的判定顺序**必须直接产出这六个值**（映射表已写进 §C.3.2）。**这是本规格唯一被外部文档强制的部分。**
2. **「谁能装」的位置不同，且不矛盾。** 二期规划把「可安装性」放在**服务端下发的 `entitled` 布尔**（§4.2 ①/②）；
   本规格（照官方）把「能不能点安装」放在**客户端输入合法性 + 宿主检查结果**。结论：二者是**串联的两道门**——
   `entitled=false` 时**行上就没有安装入口**（改「申请」），因此本弹层在 `entitled=true` 的行上才被打开。
   **本规格不覆盖授权，授权仍由二期规划 §4.2 唯一裁定。**
3. **「失败归因的措辞权」不同，需要统一。** 二期口径是「界面只显示不自造文案」「一律沿用 `enterpriseLocalErrorCode`」（§4.2 错误码口径），
   `skill-ingest-center.md:611–618`（§F.3）也重申「失败必须带 `error_code`」「**不要**做乐观 UI」；
   而官方范式是「客户端按 problem/kind 选中文模板、把宿主英文 reason 拼进去」。建议：**技能侧沿用二期口径**（稳定错误码投影），
   只在**纯输入识别失败**（尚未发出服务端请求）时用官方那种内联句式「无法识别这个地址：{reason}」。
4. **「是否保留复制装配指令」**。`skill-catalog.md` §S2.6/§S2.7：一期唯一主动作是复制装配指令，二期增量加了「安装」按钮，
   **复制装配指令作为第二条路保留**。本规格的弹层是**第三条路（从地址安装）**，不要把它做成唯一入口。

### G.3 建议的落地位置（不改本文档外的任何文件，供后续实施参考）

- 「从地址安装」的入口按钮 → 放在 **「企业技能」页签的页头 toolbar**，形态照搬 §A.2（主色小按钮 + 加号 + 「添加技能」），
  与二期规划的「官方插件」页签导览卡并列。**中心控制台侧不做同样入口**——`skill-ingest-center.md:578–584`（§F.1）
  已裁定控制台入口是「技能管理页工具栏的『从地址导入』」，与本规格的**员工端弹层是两件不同的事**，不要合并。
- 弹层本体 → 复用二期规划的 `main` keyed 面板内自绘（官方 `plugins` 面板不可内嵌，二期 §1.3 已否决）。
- 渠道适配器（解析/取包/转换/预检）→ **不要在本弹层里重写**；按 `skill-ingest-center.md` §B.1 的
  「一个来源 = 一个适配器」抽象，客户端只负责**判定来源 + 传 locator + 显示结果**。

---

## H. 不确定项

1. **宿主/服务端是否有额外权限层**：`<PM>` 客户端代码里只找到「有没有可管理 profile」这一个闸门
   （`client.js:65`、`:3268`）。**未排查**服务端 RPC 网关、会话鉴权、企业侧 `dshent` 插件是否对
   `pluginManager.*` 另加门禁。若有，本规格 §A.4 需要补一行。
2. **git 子目录 / monorepo 支持**：`parseInstallSpec` 与四个正则里**没有任何子目录语义**
   （`install-spec.js:8–19`, `:57–86`）。pnpm 本身支持 `#path:` 之类的 fragment，但**官方代码没有把它显式解析或呈现**；
   我无法从客户端代码判定「用户手打 `#path:sub` 会被 pnpm 接受还是被 `HOSTED_REPOSITORY_URL`/tarball 正则吃掉」——
   需要一次实机实验才能下结论。
3. **`HOSTED_REPOSITORY_URL` 的精确边界**：`/^https?:\/\/[^/]+\/[^/]+\/[^/#]+(?:\.git)?(?:#.*)?$/i`（`:10`）
   要求**恰好两段路径**。像 `https://github.com/owner/repo/`（尾斜杠）或 GitLab 子组 `group/sub/repo` 的归属，
   我按正则推断为「不匹配 → 落到 `:75` 的 URL 拒绝」，但**未实机验证**。
4. **`installDescription` 与真实支持范围不一致**：文案只说「包名、GitHub 仓库地址或本地目录路径」（`:105`），
   **没提 tarball**，而解析器支持 tarball（`:16`, `:65`, `:73–74`）。这是官方文案的一个漏写（不是我的解读）——如实记录。
5. **`shipped` 这个 problem 的来源**：客户端字典有 `installProblemShipped`（「该插件随 DSH 提供…」，`:135`），
   但宿主的 `PluginInspectProblem` 联合类型（`types.d.ts:138`）**不含 `shipped`**。可能由别处（如 `dsh-app-boot` 或更早版本）
   产出；**未追到**产生点。
6. **`registryProbe` 之外的网络直连**：我只核查了 `<PM>/lib/index.js` 里的 `PluginRegistryProbe`
   （npm/npmmirror `/-/ping`）。**未核查** client 侧是否还有其它 `fetch`（本规格的结论「安装网络全在宿主」基于
   `client.js` 的 `ctx.remote.pluginManager.*` 调用点，共 6 处：`:979, :1203, :1260, :1280, :1388, :1452`）。
7. **`$R` 的路径歧义**：本次会话的工作目录是 `/storage/emulated/0/DSH/DSH-ENT`（该目录下**没有** `docs/plan`），
   而带 `.git`、`plugin/`、`console/`、`docs/plan/` 的仓库实际在
   `/data/user/0/com.deepcode.shell/files/dsh-enterprise`。本文件写在**后者**。
   若期望落在前者，需要把路径口径统一后再搬一次（本文档内容与位置无关）。
8. **官方是否提供「文件上传」原语可复用**：引擎里有 `@deepseek-ai/dsh-client-file-upload` 与
   `dsh-client-ui-attachment`，但**官方添加插件弹层完全没用它们**（本 bundle 内 grep `type: "file"` /
   `directory-picker` / `FileUpload` 零命中）。我们技能版的「选择文件」应该用哪一套原语，**未定**——建议单独做一次原语取证。
9. **压缩包上限**：官方对 tarball 的大小/条目数上限**未在客户端或 `installBundle` 里看到**（由 pnpm 自己决定）；
   我们技能侧的上限应由 `skill-catalog.md` §S2.7 的 50MiB/200MiB/1万条目/256KiB 那套承接，**不在本规格内**。
10. **`docs/plan/skill-install-sources.md` 尚不存在（并行代理正在写）**：`skill-ingest-center.md:21` 的 `[POS]`
    明确「客户端侧方案由 `docs/plan/skill-install-sources.md` 负责」。**本规格与它的对账未完成**：
    若它落地后对「一个框 / 判定顺序 / 来源枚举 / 失败文案」有不同口径，**以它为准或以本文为准需要一次人工裁定**。
    建议落地者做一次三方对齐（本文 + `skill-install-sources.md` + `skill-ingest-center.md:178` 的 R1）。
11. **员工端「一站式的来源适配器」跑在哪一侧**：`skill-ingest-center.md` §B.3 只裁定了**中心侧**适配器放离线工具；
    员工端（本弹层）的 resolve/fetch/convert 究竟在**本机 Host 路由**、**企业中心服务端**、还是**浏览器直连**，
    本文**未裁定**（本文只规定 UX 与判定顺序）。这是一个必须在 `skill-install-sources.md` 里定的问题。

---

## 附：本规格引用到的官方文件清单（便于复核）

| 短名 | 绝对路径 |
|---|---|
| `<ENGINE>` | `/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh` |
| `<PM>` client | `<ENGINE>/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js`（3548 行） |
| `<PM>` host probe | `<ENGINE>/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/index.js` |
| `<PM>` types | `<ENGINE>/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/types/client/*.d.ts` |
| `<HOST>` impl | `<ENGINE>/node_modules/@deepseek-ai/dsh-plugin-manager/lib/index.js`（2076 行） |
| `<HOST>` spec | `<ENGINE>/node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/install-spec.js`（87 行） |
| `<HOST>` types | `<ENGINE>/node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/{index,types,install-spec,install-failure,failure}.d.ts` |
| `<PRIM>` | `<ENGINE>/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/types/Modal.d.ts` |
| skill 面 | `<ENGINE>/node_modules/@deepseek-ai/dsh-skill/lib/types/index.d.ts`、`…/dsh-skill-filesystem/lib/types/index.d.ts` |
| 中文产品说明 | `<PM>/README.zh.md`（「安装一个组合包」一节，与代码逐条对得上） |
