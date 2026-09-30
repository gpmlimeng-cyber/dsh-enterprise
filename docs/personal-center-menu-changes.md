# 个人中心菜单 · 变更队列（`plugin/packages/ui/**` 串行）

> 状态：**待执行**｜日期：2026-09-30｜原因：同包不并行——`ui/**` 当前由「我的用量」占用，以下变更由 Lead 在其停手后**一次性**完成并统一装机

## 设计语义：末行是「会话动作位」

`查看登录进度` / `登录` / `退出登录` **三态共用最后一行**（原 `session` 分组位置），未登录与已登录视觉相呼应；`account` 分组在未登录时**不再**放登录行。

## 队列（按执行顺序）

| # | 变更 | 要点 | 验收 |
|---|---|---|---|
| 1 | **LOGO 形状兼容（UI 半边）** | 若 Host 产出的本地副本地址与 `ui/src/branding.ts` 的 `BRANDING_ASSET_SOURCE` 不匹配 → 放宽为同源本地副本路径（Host 侧已在修） | 单测：字符串形 / 本地副本形 / 非法形 |
| 2 | **「重新载入页面」「重新启动应用」** | 官方 `dshDesktopActions.invoke('reload'\|'restart')` → 同源 `POST /api/desktop/developer/reload`\|`/api/desktop/restart` → `location.reload()`；**非桌面隐藏重启项**；不加二次确认（官方重启自带原生确认）；补**可见失败反馈 + 超时提示** | 不变量测试：非桌面隐藏、行点击与右侧按钮互不误触 |
| 3 | **「检查更新」+ 右侧「更新」按钮** | 右侧状态随态变化：空闲=当前版本 / 检查中 / 已是最新 / **有更新=「更新」按钮** / 下载中=% / 已下载=「重启安装」 / 失败=「重试」+可见原因；行点击=检查，按钮=更新（`stopPropagation`） | 同上；API 以官方受支持面为准（取证中，若不可用则改为引导官方入口） |
| 4 | **「帮助与反馈」** | 表单与字段见 `feedback-feature-spec.md`（含 `occurredAt` 随 `type` 显隐、描述 510 计数、最多 3 图可粘贴、同意必填、需登录） | 表单契约测试 + 不变量（弹窗必被渲染） |
| 5 | **登录/退出登录位置相呼应**（本条） | 未登录时「登录」行移到**最后一行**（`session` 组位置），与已登录「退出登录」同位；未登录时 `account` 组不再含登录行；登录中「查看登录进度」同样占该末行位 | 决策层测试：未登录 → 末组=登录行且 account 组为空；已登录 → 末组=退出登录；登录中 → 末组=查看登录进度 |
| 6 | **菜单视觉微调**（本条） | ①**移除头部品牌行**（`own-menu-brand` 的 LOGO + 简称，个人中心不再显示品牌元素）；②**用户信息下方增加分割线**；③**全部分割线调浅**（头部下方与各分组间）；⚠️ 若某条分割线由官方 `Menu` **内部绘制**、无法受支持地调浅 → **只报告、不覆盖官方 CSS**（零分叉红线） | 源码级不变量：`account-menu.tsx` 不再含 `own-menu-brand`；头部后存在 separator；separator 取更浅 token/透明度；并列出「哪些分割线是我们自己的、哪些是官方的」 |
| 7 | **「快捷键」入口**（本条） | 菜单新增「快捷键」行 → 弹窗展示客户端快捷键一览；数据源**必须是官方快捷键注册表**（若官方提供读取面），**不自造第二套按键表**；若官方无读取面 → 只展示官方可从 launcher props 拿到的 `settingsShortcut`（如 `Ctrl+,`）并明确标注范围，不猜其它按键。**待确认**：是否需要给该入口本身绑定按键（accelerator）——取决于官方是否有第三方可注册带按键动作的受支持面（取证中，无则不做，绝不自造全局监听） | 不变量测试：入口存在且弹窗必被渲染；按键文案来自官方数据源；非官方支持的按键不出现 |
| 8 | **设置页标题改名**（本条） | 官方设置页里我们的分区标题由「DSH Enterprise 设置」改为「**企业设置**」：①`settings.section` 注册的 label；②页内标题（`account-view.tsx` 的 `EnterpriseSettingsSection` 标题）；若两处文案不一致则**统一为「企业设置」**。**不动**账号菜单触发按钮的 aria-label（「DSH Enterprise 账号菜单」）与登录弹窗里取自品牌的标题 | 不变量测试：源码内不再出现「DSH Enterprise 设置」，且 section label 与页内标题一致 |
| 9 | **「帮助与文档」超链接**（本条） | 菜单加一行 → 打开**已有的** `enterprise/help/` 站点（部署在后台 nginx 的 `/help/`，与 API 文档共用会话门禁）。URL 由平台地址派生：`${platformOrigin}/help/`（不写死域名）；**优先复用 Host 侧"系统浏览器打开"通道**（PKCE 登录用的同一条 openInBrowser 能力），失败再退 `window.open(url, '_blank', 'noopener')`；平台地址未配置时**不静默**：该行禁用并提示「请先配置企业 Server 地址」。⚠️ 该站点**需登录**：系统浏览器若未登录会先落地登录页（既有权重门禁，非缺陷），文案要写明 | 不变量测试：URL 由 platformOrigin 派生且不含硬编码域名；未配置时禁用并有提示；打开优先走 Host 能力、其次 window.open |
| 10 | **分割线收敛为"分组边界"**（本条） | 现每 section 边界都画线（6 条）→ 改为 **一条线 = 一个语义分组**，共 **3 条**：①头部下；②偏好组之后；③维护组之后（会话组前）。分组：【偏好】外观 · 我的用量 · 设置 · 快捷键 ／【企业服务】帮助与反馈 · 检查更新 · 重新载入页面 · 重新启动应用（按能力）／【会话】登录·退出登录。**组内一律不画线**；分割线样式沿用已调浅的 `border-l1` | 不变量测试：分割线数量 === 分组数−1（断言常量，防止再退化为"每块一条线"）；顺序与分组成员一致 |
| 11 | **「我的用量」改为行内折叠快捷块**（本条） | 照参考图：个人中心菜单内**默认折叠**的一行（图标＋「我的用量」＋展开箭头）；**点击展开**后在行内显示**每行三列：周期 ｜ 额度百分比 ｜ 详情**。周期条目按后台配置的四窗口（5 小时/每日/每周/每月，`fiveHours/daily/weekly/monthly`，null 窗口不产出）。**详情**：本期**预留**——按钮存在但为不可用态，点击给「Token 统计详情页即将上线」提示；留一个 `onOpenUsageDetails?()` 接缝，未来在设置页另起一页时一行接上。**数据**：首次展开时懒加载（不随菜单打开就请求），展开区内显示加载/失败态（失败走既有错误码映射）。**取代关系**：原「我的用量」弹窗（`usage-dialog.tsx`）随之退场，避免两条入口并存（删除时应同步删除其不变量测试并更新队列第 4 项的配对断言） | 不变量测试：默认折叠（首次渲染无数据行）；展开后四行三列结构；详情为不可用态且点击不跳转；懒加载（折叠状态不发请求） |

## 统一收口动作（队列清空后）

1. 逐项实现 + 补/改测试（**不删断言换绿**）
2. `pnpm --filter @dshent/ui run typecheck && run test && run build`
3. 同步 pristine → `dshent-plugin` build + pack → 清 pnpm store 条目 → 装进 `~/.dsh/profiles/desktop`（**不动三个受保护字段**）
4. **哈希校验**（tar ↔ profile 的 `lib/index.js`、`lib/client.js`）
5. 交给用户**重启一次**统一验证

## 队列 2/3 的实现矩阵（2026-09-30 二次取证后修订，覆盖上表口径）

| 动作 | Harness.app（0.2.0-rc.2） | DSH Desktop.app（2.0.15） | 纯 Web |
|---|---|---|---|
| 重载页面 | `location.reload()` | `dshDesktopActions.invoke('reload')` | `location.reload()` |
| 重启应用 | **不可用 → 隐藏该项** | `dshDesktopActions.invoke('restart')` | 隐藏 |
| 检查更新 / 更新 | `dshDesktop.updates.open()` + `status()` / `subscribe()` | `dshDesktopActions.invoke('check-for-updates')` | 隐藏 |

**更新交互是 phase 驱动的**（官方**没有**独立的 check/download/install 渲染方法）：`open()` 按当前 phase 自动推进——`idle→check`、`available→download`、`ready→install(quitAndInstall)`。

- 状态：`presentation = { phase, version?, percent?, failure? }`；`phase ∈ idle | available | downloading | verifying | installing | ready | error`
- 右侧状态映射：`idle`=「检查更新」／`available`=**「更新」按钮**／`downloading·verifying·installing`=百分比（禁用）／`ready`=「重启安装」／`error`=「重试」+ 把 `failure` 映射成人话
- **无** `currentVersion` / `releaseNotes`（官方「当前版本」是编译期字面量，不要自造）；订阅用 `subscribe(cb)` 并**在卸载时取消**
- `restart`：Harness 下**不可用** → 按"能就显示、不能就隐藏"处理，**绝不**自造 IPC

## 进展（2026-09-30）

- **第 1 项（LOGO 形状兼容）已关闭**：Host 侧 `platform-client/src/branding.ts` 已改为接受 `string | { url }`（多余字段忽略，门禁一字未放宽）；且**同 revision 的自愈逻辑**改为按"本次远端声明"补齐副本 → 用户机器上已写坏的 `logo:{null,null,null}` **无需清缓存、无需抬 revision** 即自愈。
- **UI 半边确认无需改动**：Host 产出 `/enterprise/api/v1/local/branding/asset/light?v=12`，与 `ui/src/branding.ts:46` 的正则实测匹配（三槽位 true、绝对地址 false）→ 队列第 1 项删除。
- **教训（值得进流程）**：契约真源 `contracts/components/branding.yaml#/BrandingAssetRef` **本来就是对象**，错的是我方 Host 解析没照真源写 ⇒ 消费方 shape 门禁应**直读契约真源**生成断言，而不是各自手写形状假设。
- `dshent-plugin` 门禁现 **5 红 / 22 绿**，经交付方举证与本 diff 无关：`account-origin.spec`(2) 对 `cordis.patch.yml` 旧期望、`bundle.spec` 对 slot 注册数（并行线新增 `plugins.item` 第 3 槽位）、`bundle.spec:118` 的 pi-ai import 断言（改动前后同样失败）。⇒ 属既有债，等 **A/B 裁决**与市场入口线更新期望后一并清。

## 第 7 项（快捷键）取证结论 — 2026-09-30

| 能力 | 结论 | 依据（asar 内路径） |
|---|---|---|
| 读取注册表自渲染一览 | ✅ 可注入服务 `shortcuts`；`ctx.shortcuts.catalog = {getSnapshot, subscribe}`；行含 `{id,label,keys,aria,issue,conflicts,aliases}`；按键已平台化 | `@deepseek-ai/dsh-client-shortcuts/lib/client.js:1861,526-529,620-632`；`presentBinding` 见其 `protocol.js:66-96` |
| 打开官方「编辑快捷键」对话框 | ❌ **无受支持 API**（官方为 General 分区 `settings.general.item` id `shortcuts` + `shell.overlay` id `shortcuts`；launcher ownerProps 无 `openSection`） | `dsh-client-ui-shortcuts/lib/client.js:1084-1091,1143-1149`；`ui-settings-general/lib/client.js:435-442` |
| 注册我们自己的带键动作 | ✅ `ctx.shortcuts.register({id,label,defaults:{"<runtime>:<platform>":{code,modifiers,secondCode?}},regions,modals,resolve})`，官方做冲突/保留键校验 | 同上 `client.js:588-612` |
| 隐藏策略 | **不要按 runtime 隐藏整个入口**；逐行用 `row.keys.length===0`（显示「暂无快捷键」）与 `row.issue`（`reserved`/`unsupported-browser`） | `client.js:930`；`ui-settings-general:1082-1089` |

**实现口径**：作为 `settings.launcher` occupant，注册时 `inject: () => ({ platform: ctx.shortcuts.platform, runtime: ctx.shortcuts.runtime, hooks: { shortcuts: ctx.shortcuts.catalog } })` → 组件得 `useShortcuts` 自渲染列表；**合规替代官方对话框**：调用 ownerProps 的 `openSettings()` 让用户去 General 点「编辑快捷键」，或仅显示 `settingsShortcut`。
**可选（待产品决定）**：用 `ctx.shortcuts.register` 给我们的动作绑键（如"打开个人中心菜单/我的用量"）——这是受支持能力，但**新增全局按键属于产品决策**，未确认前不做。

### 第 7 项 · 需求追加（2026-09-30，产品确认）

**目标**：点击个人中心「快捷键」**直接打开官方「编辑快捷键」对话框**。
**已知**：无受支持 API（`settings.launcher` props 无 `openSection`；对话框在官方 `shell.overlay`）；但**该对话框有官方快捷键**。
**拟定手段（待取证确认）**：从 `ctx.shortcuts.catalog` 取该动作的绑定 → 点击时**合成一次对应 `keydown`** 交给官方分发（不覆盖官方 UI、不自造全局监听）。
**前置三问**（取证中）：①动作 id 与各平台真实默认绑定（macOS 是否有）；②官方监听器的绑定目标与是否拒绝合成事件（`isTrusted`）；③是否存在更正当的通道（受支持 invoke / 事件）。
**降级**：若合成不可靠或该动作无默认绑定 → 退化为「引导到 设置 → 通用 → 编辑快捷键」并调 `openSettings()`。

### 第 7 项 · 源码取证终局（2026-09-30，上游 `deepseek-ai/deepseek-harness` @ `639ed015`）

| 结论 | 源码依据 |
|---|---|
| **无受支持 API 打开官方编辑快捷键对话框** | 服务公开面 13 项无 `invoke/run/dispatch/open`（`shortcuts/src/client/types.ts:83-138`）；`ShortcutRegistry.invoke/dispatch`（`registry.ts:140,154`）所在类为 `client/index.ts:40` **private 字段** |
| 对话框 store **外部不可获** | `ui-shortcuts/src/client/index.ts:32-33,47-65`（`create: () => instance`）；包 exports 仅 `.`/`./client` |
| `settings.general.item` **不回调注册项** | `ui-settings/src/client/contract/slots.ts:92,96-99`；`GeneralSection.tsx:14-19` |
| `openSection` 只给 `settings.onboarding`，无生产调用方 | `slots.ts:138-141`；`SettingsRoot.tsx:258-262` |
| 合成按键**仅 Web/Linux 有效** | `shortcuts/src/client/dom.ts:84,91,100` + `client/index.ts:70-71`（macOS/Win `native=true` → return） |
| 唯一 reach-in 路径（**非受支持**） | `ctx.slots.entries('shell.overlay').find(e=>e.options.id==='shortcuts')?.store.create().actions.open()`（`ui-slots/src/index.ts:851,1273`；无先例、未运行时验证） |

**待拍板（Lead 推荐 A）**

| 方案 | 桌面(macOS) | Web | 合规性 |
|---|---|---|---|
| **A（推荐）** | 打开**我们自渲染**的快捷键一览（数据源＝官方 `catalog`，受支持）+ 提供「去官方设置修改」引导（`openSettings()`） | 同左（可选：额外合成 `⌘/` 打开官方对话框） | ✅ 全受支持 |
| **B** | 走 reach-in 私有 store，**真打开官方编辑对话框** | 同左 | ⚠️ **unsupported workaround**（官方升级可能失效），需代码+文档显式标注并做失败可见反馈 |

### 第 7 项 · 产品裁决（2026-09-30）：采用 **B**

**点击「快捷键」→ 打开官方「编辑快捷键」对话框**，手段为 reach-in 私有 slot store（**unsupported workaround**）。

实现要求（照此做，不得省略）：
1. **调用**：`const e = ctx.slots.entries('shell.overlay').find(x => x.options?.id === 'shortcuts'); e?.store?.create?.().actions?.open?.()`
   —— 逐级可选链 + `try/catch`；**任一层缺失即视为不可用**，不得抛错冒泡到 UI。
2. **时序**：先关我们自己的菜单（行选中已关），**下一 tick 再开对话框**，避免官方 modal 判定与菜单冲突。
3. **失败可见**：调用后做一次存在性校验（例如轮询/观察官方对话框是否出现，限时数百毫秒）；未出现 → 明确提示「请到 **设置 → 通用 → 编辑快捷键**」并调官方 `openSettings()`，**绝不静默**。
4. **版本探测**：把路径与官方包版本/`protocolVersion` 一起记入一次 warn 日志（便于升级后定位失效），但**不因版本号拒绝执行**（shape 检查为准）。
5. **显式标注**：代码注释与本文件均标注 `unsupported workaround — 依赖官方 slot 内部 store，官方升级可能失效`；断言测试覆盖"entry 存在→调用 open"与"entry 缺失/store 形状变化→走降级、不抛错"。
6. **不采用**：DOM 合成按键（macOS Desktop `native=true` 已被官方丢弃）与任何全局键盘监听。
7. 升级版一览（数据源＝官方 `ctx.shortcuts.catalog`）**仍要保留**为降级路径的一部分：B 失败时展示一览 + 引导，而不是只给一句话。

## 第一轮执行记录（2026-09-30 13:2x）

- **第 2/3/5/6/7 项已完成**（`20cd29c9`）：`ui` 门禁 14 文件 / **139 测试全绿**，build 退出 0；`dshent-plugin` 复跑仍 **5 红/22 绿**（与本轮 diff 无关，同名同因）。
- 交付要点：`desktop-runtime.ts`（能力检测 + 相位映射 + 9 码中文失败文案）· `maintenance-view.tsx`（右侧控件先 `stopPropagation` 再 `open()`，菜单不关、进度就地可见）· 末行会话位（account 组退场，session 恒为 登录/查看登录进度/退出登录）· 品牌行删除 + 分隔线调浅到 `border-l1`（**官方一份未渲染、零 CSS 分叉**）· `shortcuts-view.tsx`（数据源＝官方 `shortcuts` 服务 catalog/fixedCatalog，不可读才退 `settingsShortcut`）。
- **待裁决三项**：①fork 的 `check-for-updates` 与同源 POST 回落本期未做（建议**不做**，我们跑在 Harness）；②`idle` 时右侧「检查更新」与行文案重复 → 改为 **idle 右侧留空**；③右侧控件为 `span[role=button] tabIndex=-1`（键盘由行承担）→ 接受。
- **官方分割线归属结论**：菜单里全部分割线均为我们自绘同一 class；官方 `.separator/.footer` 用 l2 但**从未渲染**（不传 `separatorBefore`、不用 items 行）⇒ 无需也不可调浅官方 CSS，**零分叉**成立。

### 第 3 项 · 右侧控件修订（2026-09-30，产品确认）

**问题**：`idle` 相位的右侧标签写成了「检查更新」，与行标签**重复**。
**规则**：**行标签 = 动作名**（恒定「检查更新」）；**右侧 = 状态标签 + 快捷按钮**（两者都不得重复动作名）。

| 相位 | 右侧状态标签 | 右侧快捷按钮 |
|---|---|---|
| `idle` | 最近状态（如「已是最新」/「未检查」） | 「**检查**」 |
| `checking` | 「检查中…」 | —（禁用） |
| `available` | 「有可用更新 <版本>」 | 「**更新**」 |
| `downloading`/`verifying`/`installing` | 「下载中 N%」/「校验中」/「安装中」 | —（禁用） |
| `ready` | 「已下载，待重启」 | 「重启安装」 |
| `error` | 失败原因（9 码中文文案） | 「重试」 |

约束：状态标签使用弱化文字（次要色），快捷按钮为小尺寸主/次按钮；**行点击仍=检查/推进**，按钮点击 `stopPropagation` 后执行同一动作；无 `currentVersion`/`releaseNotes` 不显示（官方当前版本是编译期字面量）。
验收：不变量测试断言 **`idle` 相位右侧文案 ≠ 行标签**，且各相位「状态标签 + 按钮」组合与上表一致。

## 最终轮执行记录（2026-09-30 13:58 装机）

- **第 3 项修订 / 第 9 项 / 第 10 项 / 第 11 项 / 第 7-B 项 全部完成**（`15717a29`）：ui 门禁 **177 全绿 / 17 文件**，bundle build 0；`dshent-plugin` 仍 **5 红 / 48 绿**（既有债同名同因，期望未改）。
- 第 9 项实现取向：`bundle/src/help-route.ts` 新增 `POST /enterprise/api/v1/local/help/open`，**严格 allowlist = 没有客户端输入**（地址由 Host 自持平台地址派生 + 固定 `/help/`），复用 PKCE 同一条 `openSystemBrowser` 通道。
- 第 11 项：`usage-dialog.tsx` 与其 spec 已删除（原弹窗退场），新增 `usage-panel.tsx`（懒加载唯一判断点 + 三列投影 + 详情预留接缝）。
- 第 7-B：刻意标注 `unsupported workaround`，带版本 warn、有界探针与**可见降级**（自渲染一览 + 引导 + `openSettings()`）。
- **装机**：tar 715,117 B（13:58）· `index.js 39c2dc0f1a00` · `client.js 2718ff34492d` · profile 三字段未动 · 标记核对：`CALLBACK_DEFAULT_LOCALE`/`help-route`/`feedback-route` 在 Host，`usage-panel`/`own-usage` 在 Client。
- **待办**：①**后台尚未部署**（V34 + 反馈接口 + console `/feedback` 页仍在源码）→ 反馈提交在部署前会失败；②既有 5 红待 A/B 裁决与期望更新。
