<!--
[INPUT]: 依赖服务器上已解包的 jingyunstudio/jingyun-dsh 源码树（/opt/work/jingyun，HEAD = v0.1.21，与该仓库 pushed_at 2026-09-30T10:00:59Z 同一快照）的一手逐文件只读证据——packages/jingyun-dsh/src/client/pages/MarketplaceSection.tsx（1332 行全文）、client/index.tsx（319 行）、client/components/NavigationRows.tsx（316 行）、client/styles.ts（2163 行）、client/pages/OnlineWorkspaceMainView.tsx、src/routes/skills.ts、src/routes/plugins.ts、src/plugins/service.ts、src/index.ts、packages/jingyun-dsh/resources/registry-snapshot.json、cordis.patch.yml、tsdown.config.ts、src-tauri/tauri.conf.json、AGENTS.md/README.md；并依赖本机 DSH 检出（@deepseek-ai/dsh 0.2.0-rc.2）的官方对照物——@deepseek-ai/dsh-client-ui-settings-plugin-inventory 内联 CSS（class 前缀 qSYn7G_）、@deepseek-ai/dsh-client-ui-settings-plugins 的内联 CSS（前缀 pbvGtq_）、@deepseek-ai/dsh-client-ui-primitives 的 Tag/StateDot/SegmentedTabs/SegmentedControl/Switch/Pill module.css、dsh-client-ui-settings 的 slots 契约 .d.ts；以及本仓 plugin/packages/ui/src/marketplace-entry.tsx（1174 行）与 plugin/packages/ui/src/client.tsx 的现状事实（只读，用于对照）。
[OUTPUT]: 给出 jingyun-dsh「应用商店」UI 的逐条事实（承载形态 / 行解剖 / 状态表达 / 展开折叠 / 动作 / 数据与刷新 / 与官方槽位的关系，每条附文件+行号+片段）、它自绘样式与官方原语样式的排版对照总表（值 + 出处 + 可比性判定）、它与我们现状的 UI 点对点对照表（含建议与人日）、按性价比排序的采纳清单（改哪个文件的哪一块、人日、风险、与方案甲是否冲突）、不建议照搬项与不确定项清单。
[POS]: 外部同类形态（第三方 DSH 客户端商店）的 UI 取值参考真源；只服务于「取值是否照抄」的决策，不构成实现承诺；凡本文件与 jingyun 源码原文冲突处，以源码行号为准。本文件**只调研、不写业务代码、不改任何源文件**。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# jingyun-dsh「应用商店」UI 深读与取值采纳清单

调研日期：2026-10-02（Asia/Shanghai）
调研对象：`https://github.com/jingyunstudio/jingyun-dsh`，服务器解包源码树 `/opt/work/jingyun`（HEAD = `v0.1.21`）
文档状态：调研结论，未进入实施
对照基线：本机 DSH `@deepseek-ai/dsh@0.2.0-rc.2` 官方原语与官方插件设置页源码

---

## 0. 调研方法与三条必须先说的更正

本轮**不重新克隆**（本机 `git clone` 到 GitHub 会 `Failure when receiving data from the peer`），全程走已验证通路：

```bash
cd /data/user/0/com.deepcode.shell/files/home/.sshwork
node remote.mjs 'cat /opt/work/jingyun/...'    # 只读读取远端已解包源码
node remote.mjs 'curl -s https://api.github.com/...'   # 只读拉仓库元数据
```

证据抓取全部落盘在 `.../home/.sshwork/jy/`（本机 `/tmp` 不可写），供复核；**未写、未改 jingyun 仓库任何文件，未改本仓任何源文件**。

**更正 1（影响「承载形态」结论）**：`MarketplaceSection.tsx` 里不是两个导出页签，而是**三个**：`MarketplaceAgentsTab`（L16）、`MarketplaceSkillsTab`（L216）、`MarketplaceCommunityPluginsTab`（L589）。任务书里说的「已知 Agents/Skills 两个」少了一个「开源社区」。

**更正 2（影响「页签条用官方原语还是自绘」结论）**：这三个页签**不是它们自绘的页签条**，而是注册进官方槽位 `settings.plugins.tab`（`client/index.tsx` L208–242），页签条由官方 `@deepseek-ai/dsh-client-ui-settings-plugins` 的宿主渲染。它们**另有一份自绘页签条 CSS**（`.jy-tabs` / `.jy-tab`，`styles.ts` L179–216）留在样式表里，但全仓无任何 JSX 引用 → **死样式**（详见 §2.1）。

**更正 3（影响「数据与刷新」结论）**：任务书里说的「那个 `clearTimeout` 的定时刷新」**不存在**。该文件里只有两处 `setTimeout` + `clearTimeout`（L269/273、L852/856），都是**搜索输入防抖**（350ms / 300ms），全文件**没有 `setInterval`、没有轮询**。

**如实标注约定**：凡我未能实机验证、只靠源码静态推断的结论，一律写「（静态推断）」，并在 §7 不确定项里登记。

---

## 1. 它是什么

**一句话**：`jingyun-dsh` 是「井云 Studio（商业平台后端）× DeepSeek Harness」的**品牌化桌面客户端 + 企业插件分发**产品；它的「应用商店」是**两层**的——**线上**一层是嵌在 `main` 面板里的 `iframe`（远端 jingyun.studio 商城），**本地**一层才是注入官方「设置 → 插件」页签条的两个到三个本地条目管理页（智能体 / 技能 / 开源社区）。我们关心的 `.catalog` / `.cards` / `.card` 行解剖，全部属于**第二层**。

### 1.1 仓库形态（实测）

| 项 | 事实 | 证据 |
|---|---|---|
| 形态 | pnpm monorepo（`workspaces: ["packages/*"]`），单业务包 `@jingyun-ai/jingyun-dsh@0.1.21`，根包同名同版本 | `package.json`（根）与 `packages/jingyun-dsh/package.json` |
| 底座依赖 | `"@deepseek-ai/dsh": "0.2.0-rc.2"`、`@deepseek-ai/cordis >=4.0.0`（peer） | 根 `package.json` dependencies；插件包 peerDependencies |
| 桌面壳 | **Tauri v2**（`src-tauri/`）：`productName: "Jingyun.Studio"`、`identifier: com.jingyun.dstudio`、`devUrl http://localhost:3080`、`decorations: false`、`beforeDevCommand: pnpm run dev` | `src-tauri/tauri.conf.json` |
| 前端加载方式 | 客户端半边用 tsdown 打成 **CJS 包裹**，banner/footer 把工厂塞进 `window.__ModuleLoader__.load({ id:'@jingyun-ai/jingyun-dsh', factory })` | `packages/jingyun-dsh/tsdown.config.ts`（outputOptions.banner/footer） |
| 发布形态 | 两条路：npm 包接入（装 UI 品牌插件）/ 整仓拉取自打包 NSIS 桌面客户端 | `README.md`「两种使用方式」 |
| 自述定位 | AGENTS.md：*"a desktop application and enterprise plugin distribution for the DeepSeek Harness (DSH) AI Agent orchestration platform"* | `AGENTS.md` Project Overview |

### 1.2 最近活跃度（GitHub REST API 实测，抓取时点 2026-10-02）

| 指标 | 数值 |
|---|---|
| 创建 / 最近 push | `2026-08-27T11:28:30Z` / `2026-09-30T10:00:59Z`（抓取前 2 天） |
| Stars / Forks / watchers | 818 / 35 / 818 |
| Open issues | 1 |
| 主语言 / 默认分支 | TypeScript / `main` |
| 仓库体积 | 2443 KB |
| 最新标签 | `v0.1.21`（连续 v0.1.17 → v0.1.21） |
| 最近提交 | `chore: release v0.1.21`（2026-09-30T10:00:47Z）、`refactor: use uiWorkspace to open assistant session`、`feat: implement OnlineWorkspaceMainView and update NavigationRows for panel management`、`chore: upgrade @deepseek-ai/dsh to 0.2.0-rc.2 and adapt client icons` |
| 许可证 | **仓库根无 `LICENSE*` 文件**（`ls LICENSE*` → No such file），GitHub license API → **404 `Not Found`**；但 `README.md` 挂了 Apache-2.0 徽章 → **代码无实际授权文本，法务风险** |

来源：`node remote.mjs 'curl -s https://api.github.com/repos/jingyunstudio/jingyun-dsh'`（含 `/license`、`/commits?per_page=5`、`/tags?per_page=5`）。

**快照一致性核对**：解包树内文件 mtime 均为 `Sep 30 18:00`（+08:00）= `2026-09-30T10:00Z`，与 `pushed_at` 精确吻合 → 我们读的就是 `v0.1.21` 的 HEAD。

**一句话结论**：**活跃度很高（月余 818 star、连续发版），但仍是 0.1.x、且已绑到 DSH 0.2.0-rc.2（我们自己也在 rc 线上）**；它的 UI 值得抄取的是**取值**，不是架构（见 §5/§6）。

---

## 2. UI 事实逐条（每条附证据）

### 2.1 承载形态

**它挂在官方「设置 → 插件」页签条上，不是独立整页、也不是侧栏一级项。**

```tsx
// packages/jingyun-dsh/src/client/index.tsx L208-242
ctx.slots.inject('settings.plugins.tab', () =>
  ctx.slots.register(
    { name: 'settings.plugins.tab', id: 'agents',             order: 30, label: '智能体列表' },
    () => React.createElement(MarketplaceAgentsTab)
  )
);
ctx.slots.inject('settings.plugins.tab', () =>
  ctx.slots.register(
    { name: 'settings.plugins.tab', id: 'skills',             order: 40, label: '技能列表' },
    () => React.createElement(MarketplaceSkillsTab)
  )
);
ctx.slots.inject('settings.plugins.tab', () =>
  ctx.slots.register(
    { name: 'settings.plugins.tab', id: 'community-plugins',  order: 50, label: '开源社区' },
    () => React.createElement(MarketplaceCommunityPluginsTab)
  )
);
```

**官方页签占位**（本机 DSH 0.2.0-rc.2 实测）：`settings.plugins.tab` 当前有两个官方注册者——`plugin-inventory` 用 `id: 'all'`、`order: 10`；`settings-plugins` 用 `id: 'plugins'`、`order: 15`。故 jingyun 的 30/40/50 是**追加在官方两个页签之后**，且**顺序稳定**（order 升序）。

**页签条本身由官方宿主渲染**：`@deepseek-ai/dsh-client-ui-settings-plugins/lib/client.js` 里 `renderSlot("settings.plugins.tab", ...)` 旁就是一段 `role="tablist"` 的 `rows.map(...)` 按钮渲染；只有一个注册者时走 `renderSlot(..., { only: single.id })` **直接进单面板、不画页签条**。

**它自己那份「自绘页签条」是死样式**（这是任务书问「用官方原语还是自绘」的直接答案）：

```css
/* packages/jingyun-dsh/src/client/styles.ts L179-216 —— 全仓无引用 */
.jy-marketplace-wrapper .jy-tabs { display:flex; align-items:flex-end; gap:22px;
  border-bottom:1px solid var(--dsw-alias-border-l2,#e4e4e7); margin-top:4px; margin-bottom:4px; }
.jy-marketplace-wrapper .jy-tab { position:relative; border:0; padding:7px 1px 9px; background:transparent;
  color:var(--dsw-alias-label-tertiary,#a1a1aa); font:inherit; font-size:13px; line-height:20px; ... }
.jy-marketplace-wrapper .jy-tab[data-active='true']::after { position:absolute; right:0; bottom:-1px; left:0;
  height:2px; border-radius:2px 2px 0 0; background:var(--dsw-alias-label-primary,#09090b); content:''; }
```

验证：`grep -rn "jy-tabs" /opt/work/jingyun` 只命中 `styles.ts:179` 一处；`.jy-tab-name` / `.jy-tab-close-btn`（`styles.ts` L1086/L1090）属于产物面板，与商店无关。**结论：定义但未使用（孤儿样式）**——这份取值反而**逐值复刻了官方页签条**（见 §3 表末行），是我们「手写页签条」的现成参照物。

**每个页签的容器结构**（三层固定壳，三个页签完全同构）：

```tsx
// MarketplaceSection.tsx L63-64 / L336-337 / L892-893
<div className="jy-marketplace-wrapper" style={{ width: '100%' }}>
  <div className="catalog">
```

**搜索 / 分类 / 排序 / 分页 四件套的实测结论**：

| 能力 | Agents 页签 | Skills 页签 | 开源社区页签 |
|---|---|---|---|
| 搜索 | ✅ 有（L66-92），客户端过滤 | ✅ 有（L347-373），服务端 keyword + 客户端**再次**过滤 | ✅ 有（L903-929），同上双重过滤 |
| 分类 | ❌ 无 | ✅ 官方 `Menu` 原语，选项 `全部/已启用`（L311-314、L375-397） | ✅ 官方 `Menu` 原语，选项 `全部/已安装`（L867-870、L931-952） |
| 排序 | ❌ 无 | ❌ 无 | ❌ **无控件**：`const [sortBy] = useState<'stars' \| 'updated'>('stars')`（L595）只有初始值、无 setter、无 UI |
| 分页 | ❌ 无 | ✅「加载更多」按钮（marker 游标，L284-287、L530-580） | ✅「加载更多」按钮（页码，L859-863、L1276-1326） |
| 计数 | ✅ `catalogHeading` 里 `<h3>智能体列表</h3><span>{count}</span>`（L95-98） | ✅ 标题随筛选切换 + 计数（L401-406） | ⚠️ 只有 `<h3>开源社区</h3>`，**无计数**（L956-958） |

**它唯一的官方原语依赖**（全文 import 仅两枚）：

```tsx
// MarketplaceSection.tsx L1-5
import { Menu, IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import React, { useState, useEffect } from 'react';
```

→ **搜索框、卡片、标签、状态点、按钮、下拉触发器全部自绘**；只有「下拉菜单弹层」和「chevron 图标」用了官方原语。

**布局容器是「2 列卡片网格 + 固定高度内滚」**（官方两个参照物都不是这样，见 §6）：

```css
/* styles.ts L305-321 */
.jy-marketplace-wrapper .cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
  align-items:start; gap:10px; margin:0; padding:0; list-style:none;
  max-height:380px; overflow-y:auto; }
@media (max-width:768px) { .jy-marketplace-wrapper .cards { grid-template-columns:1fr; } }
```

容器级 token（`styles.ts` L155-164，注意代码里那句自述注释）：

```css
/* ---------------------------------------------------- */
/* 像素级对齐官方插件列表的 CSS 规则 */          ← L156，作者自述这是复刻
/* ---------------------------------------------------- */
.jy-marketplace-wrapper { width:100%; color:var(--dsw-alias-label-primary);
  display:flex; flex-direction:column; gap:12px; }
```

---

### 2.2 行的解剖（完整 DOM + 类名 + 取值）

**它的一行（Skills 页签版，最完整），逐层 DOM：**

```tsx
// MarketplaceSection.tsx L448-523（结构与 L128-205 Agents、L1000-1269 社区同构）
<li className="card" data-open={open ? 'true' : undefined}>
  <button className="cardContent" type="button" onClick={toggle}>   {/* 整行可点 = 展开 */}
    <strong className="cardTitle">{item.name}</strong>              {/* 行主标题 */}
    <span className="cardTrailing">                                 {/* 右侧簇，固定顺序 */}
      <span className="statusDot" data-phase={isInstalled ? 'active' : 'unobserved'} />
      <span className="configTag" data-enabled={isInstalled ? 'true' : 'false'}>{configuration}</span>
      <svg className="chevron" width="12" height="12" ... strokeWidth="2.5"
           style={{ transition:'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  </button>
  {open && (
    <div className="cardDetails">
      <div className="descriptionText">{item.description}</div>
      <div className="actionContainer">
        {/* 未装 → 主按钮；已装 → 一行绿色 infoText */}
      </div>
    </div>
  )}
</li>
```

**行内元素顺序（4 个 + 展开区）**：`cardTitle` →（`cardTrailing` 内）`statusDot` → `configTag` → `chevron` →（展开时）`cardDetails` → `descriptionText` → `actionContainer`。

**三个页签的差异只在 `cardTrailing` 的长度和 `cardDetails` 的内容**：

| 页签 | `cardTrailing` 内容与顺序 | `cardDetails` 内容与顺序 | 证据 |
|---|---|---|---|
| Agents | `statusDot`(恒 `active`) → `configTag`(恒 `已启用`) → `chevron` | `descriptionText` → 「包含技能:」+ 若干个灰底小签（内联 `padding:2px 7px; background:rgba(0,0,0,0.05); borderRadius:4px; fontSize:11px`） | L143-204 |
| Skills | `statusDot` → `configTag`(`已启用`/`待同步`) → `chevron` | `descriptionText` → `actionContainer`(`actionBtn primary` 或 `infoText`) | L463-521 |
| 社区 | **先 20px 头像/占位圆**（`borderRadius:50%`，无头像时灰底 + `🔌`）再 `cardTitle`；`cardTrailing` = `⭐ {stars}`（11px tertiary） → `statusDot` → `configTag`(`已安装`/`社区`) → `chevron` | `descriptionText` → **仓库元信息行**（作者/更新时间/Forks，11px tertiary，gap 10px）→ **topics 签**（`#{topic}`，`padding:1px 6px; background:rgba(0,0,0,0.04); borderRadius:3px; fontSize:10px`，最多 6 枚）→ `actionContainer`（左「在 NPM / 仓库查看」外链 + 右 安装/卸载） | L1014-1266 |

**每一处的取值与出处（jingyun 侧）**：

| 元素 | 类名 / 属性 | 取值 | 出处 |
|---|---|---|---|
| 卡片外壳 | `.card` | `min-width:0; overflow:hidden; border:1px solid var(--dsw-alias-border-l2,#e4e4e7); border-radius:10px; background:var(--dsw-alias-bg-layer-3,#fff); box-shadow:0 1px 2px rgba(0,0,0,0.02)` | `styles.ts` L323-330 |
| 展开态卡片 | `.card[data-open='true']` | `border-color:var(--dsw-alias-border-l1,#d4d4d8); box-shadow:var(--dsw-shadow-lv1)` | `styles.ts` L332-335 |
| 行按钮 | `.cardContent` | `display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:52px; border:0; padding:12px 14px; font:inherit; text-align:left; cursor:pointer` | `styles.ts` L337-353 |
| 行悬停/展开 | `.cardContent:hover, .card[data-open='true']>.cardContent` | `background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,0.02))` | `styles.ts` L355-358 |
| 标题 | `.cardTitle` | `min-width:0; overflow:hidden; font-size:13px; line-height:20px; font-weight:600; text-overflow:ellipsis; white-space:nowrap` | `styles.ts` L360-368 |
| 右侧簇 | `.cardTrailing` | `display:inline-flex; flex:none; align-items:center; gap:7px; color:var(--dsw-alias-label-tertiary)` | `styles.ts` L370-376 |
| 状态点 | `.statusDot` | `7px×7px; border-radius:999px; background:var(--dsw-alias-label-tertiary,#a1a1aa)` | `styles.ts` L378-385 |
| 状态点·启用 | `.statusDot[data-phase='active']` | `background:var(--dsw-alias-state-success-primary,#10b981)` | `styles.ts` L387-389 |
| 标签 | `.configTag` | `display:inline-flex; align-items:center; min-height:20px; border-radius:5px; padding:1px 6px; background:var(--dsw-alias-bg-layer-1,#f4f4f5); color:var(--dsw-alias-label-secondary,#71717a); font-size:11px; line-height:16px; white-space:nowrap` | `styles.ts` L391-402 |
| 标签·已启用 | `.configTag[data-enabled='true']` | `background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#10b981) 10%, transparent); color:var(--dsw-alias-state-success-primary,#10b981)` | `styles.ts` L404-407 |
| chevron | `.chevron` | `flex:none; color:var(--dsw-alias-label-tertiary)`；展开态 `transform:rotate(180deg)`；内联 12×12、`strokeWidth 2.5`、`transition transform .2s` | `styles.ts` L409-416；JSX L148-166 |
| 展开区 | `.cardDetails` | `border-top:1px solid var(--dsw-alias-border-l2,#e4e4e7); padding:12px 14px 14px; background:var(--dsw-alias-bg-module-platform,#fafafa)` | `styles.ts` L418-422 |
| 描述 | `.descriptionText` | `font-size:12px; line-height:1.6; color:var(--dsw-alias-label-secondary,#71717a); margin-bottom:12px` | `styles.ts` L424-429 |
| 动作区 | `.actionContainer` | `display:flex; justify-content:flex-end; align-items:center; gap:8px` | `styles.ts` L431-436 |
| 动作按钮 | `.actionBtn` | `height:28px; padding:0 14px; border-radius:6px; font-size:12px; font-weight:500; border:1px solid transparent; transition:all .15s ease`；disabled `opacity:.5` | `styles.ts` L438-457 |
| 主按钮 | `.actionBtn.primary` | `background:var(--dsw-alias-label-primary,#09090b); color:var(--dsw-alias-bg-layer-2,#fff); border-color:var(--dsw-alias-label-primary); box-shadow:0 1px 2px rgba(0,0,0,.06)`；hover `opacity:.85` | `styles.ts` L459-468 |
| 次按钮 | `.actionBtn.secondary` | `background:var(--dsw-alias-bg-layer-2,#fff); color:var(--dsw-alias-label-primary,#09090b); border-color:var(--dsw-alias-border-l2,rgba(0,0,0,.12))` | `styles.ts` L470-478 |
| 卸载按钮（内联覆盖） | `.actionBtn.secondary` + style | `color:#ef4444; borderColor:rgba(239,68,68,0.3); padding:4px 12px; fontSize:12px` | JSX L1251-1256 |
| 已装提示 | `.infoText` | `font-size:12px; color:var(--dsw-alias-state-success-primary,#10b981); font-weight:500` | `styles.ts` L485-489 |
| 搜索框 | `.search input` | `height:36px; border:1px solid var(--dsw-alias-border-l2,#e4e4e7); border-radius:8px; padding:0 34px 0 36px; background:var(--dsw-alias-bg-layer-1,transparent); font-size:13px`；focus `border-color:var(--dsw-alias-state-business-primary,#3b82f6)` | `styles.ts` L232-249；JSX 里 svg 14×14 / `strokeWidth 2.8` / `left:12px`，L66-92 |
| 下拉触发器 | `.jy-select-trigger` | `height:36px; min-width:92px; padding:0 14px; border:none; border-radius:18px; background:var(--dsw-alias-bg-module-platform,rgba(0,0,0,.04)); font-size:13px; line-height:22px`；hover `background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.08))` | `styles.ts` L252-276 |
| 小节标题 | `.catalogHeading h3` / `span` | `13px/20px/600` / `12px/18px` + `color:var(--dsw-alias-label-tertiary)` + `font-variant-numeric:tabular-nums` | `styles.ts` L283-303 |
| 加载/空态（内联） | — | 加载 `padding:24px 0; textAlign:center; fontSize:13px; color:var(--dsw-alias-label-tertiary)`；空态 `padding:24px 0`(社区) 或 `32px 0`(Agents)、`fontSize:12px`；空态在社区页签带 `gridColumn:'span 2'` | L100-121、L409-439、L960-989 |

---

### 2.3 状态表达

它的状态词表**只有「装没装」这一个维度**，而且**没有「可更新/有更新」这一类**。

| 状态 | 视觉表现 | 颜色值 | 证据 |
|---|---|---|---|
| 已装/已启用 | `statusDot[data-phase='active']` 绿点 + `configTag[data-enabled='true']` 绿签 | 点 `--dsw-alias-state-success-primary` `#10b981`；签 `color-mix(success 10%, transparent)` 底 + success 字 | `styles.ts` L387-389、L404-407；JSX L464-473 |
| 未装 | `data-phase='unobserved'` + `data-enabled='false'` → 落到**基础规则**：灰点 7px + 灰签（`--dsw-alias-label-tertiary` `#a1a1aa` / `--dsw-alias-bg-layer-1` `#f4f4f5` + `--dsw-alias-label-secondary` `#71717a`） | 灰 | JSX L465-473、L1077-1085；CSS L378-385、L391-402 |
| 文案 | Skills：`已启用` / `待同步`（L444）；社区：`已安装` / `社区`（L1084）；Agents：**硬编码** `已启用`（L144-147） | — | 同左 |
| 在途（安装/卸载中） | **没有任何行级状态变化**：只在展开区里把动作按钮文案换成 `同步中...`（L510-512）/ `正在安装到底座...`（L1232-1234）/ `正在卸载...`（L1258-1262）并 `disabled`；行折叠时用户**完全看不到在途** | — | 同左 |
| 失败 | **`alert()` 弹出**（L300/302/305/794/796/799/830/834/838），无行内错误、无错误码 | — | 同左 |
| 可更新/有更新 | **不存在**。`grep -rn "有更新\|可更新\|updateAvailable\|hasUpdate\|upgradable\|latestVersion"` 全 `src/` → **0 命中** | — | 实测 |

**注意 `data-phase='unobserved'` 在 CSS 里没有对应规则**（`grep unobserved styles.ts` → 0 命中），是**故意靠基础规则兜底**还是漏写，代码里无从判断——但效果上是灰点。这属于「取值可抄、命名不要抄」（见 §6）。

**幂等语义也没做**：`data-enabled` 是布尔字符串，不是三态；装/卸没有「正在同步」的服务端真值回执，只有按钮文案。

---

### 2.4 展开 / 折叠

**行内手风琴（accordion），单开，无详情页。**

```tsx
// MarketplaceSection.tsx L18 / L218 / L591 —— 三个页签各一份
const [expanded, setExpanded] = useState<string | null>(null);
// L456-460 —— 点击整行 = 切换
onClick={() => setExpanded((current) => (current === item.id ? null : item.id))}
```

- **单开**：`expanded` 是 `string | null`，点第二行会关掉第一行。
- **状态全在 DOM 上**：`li.card[data-open='true']`，配 CSS 的三处联动（卡片描边/阴影 L332-335、行底 L356、chevron 旋转 L414-416）。
- **展开后有什么**：`div.cardDetails` = 描述 + 页签各自的附加块（技能小签 / 动作区 / 仓库元信息 + topics + 外链与动作）。
- **折叠时看不到描述**：`descriptionText` 只存在于 `cardDetails` 内（L171、L499、L1112）→ **收起的一行只有标题 + 点 + 签 + 箭头，没有任何副文本**。这与官方「描述始终可见、2 行截断」是**相反**的设计（见 §3/§6）。
- **可见性切换用条件渲染**（`{open && (...)}`），不是 `hidden`；官方用 `{open ? <div className="cardDetails">...}` 同理，但官方把 `aria-expanded`/`aria-controls`/`id` 三处配好了，**jingyun 一个都没写**（三处 `cardContent` 按钮都没有 `aria-expanded`）。
- **无键盘交互**：没有 `←/→/Home/End` 走焦、没有 `keydown` 处理（全文 grep `onKeyDown` → 0 命中）。

---

### 2.5 动作（安装 / 卸载 / 启停分别是什么控件）

**全部是普通 `<button>`，没有 `Switch`，也没有「启用/停用」这个动作。**（`grep -n "Switch" MarketplaceSection.tsx` → 0 命中。）

| 动作 | 控件 | 触发 | 后端 | 证据 |
|---|---|---|---|---|
| 安装技能 | `<button class="actionBtn primary">同步到本地环境</button>`，在展开区，disabled 时文案 `同步中...` | `handleInstallItem(id)` → `POST /api/jingyun/skills/install` body `{slug}` | 从 `https://cn.clawhub-mirror.com/api/v1/download?slug=` 下载 zip，`extractZipSafe` 解到 `~/.dsh/skills/<slug>`（**先 `rmSync` 再 `mkdir`，非原子**） | JSX L292-309、L503-514；`routes/skills.ts` L144-204 |
| 卸载技能 | **不存在**。没有任何技能卸载入口/接口 | — | — | 全文无 |
| 已装技能的「状态」 | 不是控件，是一行 `<span class="infoText">✓ 该技能已加载到本地环境运行时中。</span>` | — | — | JSX L515-519 |
| 安装社区插件 | `<button class="actionBtn primary">一键安装到底座</button>`，在途文案 `正在安装到底座...` | `handleInstallPlugin` → `POST /api/jingyun/plugins/install-community` body `{repo,name,npm}` | `installCommunityPlugin`（含全局并发锁 `isCommunityInstalling`，冲突时 429） | JSX L805-842、L1220-1235；`plugins/service.ts` L463-469 |
| 卸载社区插件 | `<button class="actionBtn secondary">卸载</button>` 内联染红 `#ef4444`；**先 `confirm()` 弹原生确认** | `handleUninstallPlugin` → `POST /api/jingyun/plugins/uninstall-community` | 成功后本地 `Set` 剔除 + 重新拉已装清单 + `alert()` | JSX L755-803、L1237-1263 |
| 启停 | **不存在**。「已启用」是安装状态的**派生文案**，不是独立开关 | — | — | `routes/skills.ts` L75 的 `status` 由 `~/.dsh/skills` 目录命中决定 |
| Agents 页签 | **纯只读**，无任何动作 | — | — | L62-213 无按钮除 `cardContent` |
| 外链 | 社区页签展开区左下 `<a target="_blank" rel="noopener noreferrer">在 NPM / 仓库查看</a>`，`onClick` 里 `e.stopPropagation()` 防止触发行展开 | — | — | JSX L1177-1208 |

**并发/幂等**：只有 `installingSlug` / `installingRepo` / `uninstallingRepo` 三个本地 `string|null` 做**单飞**（同一行禁用），没有全局锁（社区插件安装有全局锁 429）、没有失败重试 UI、**卸载后不刷新已装清单纯靠本地 Set 增删 + 一次 `checkInstalledPlugins()`**。

---

### 2.6 数据与刷新

**`.catalog` 的数据来源三个页签各不相同，其中一个恒空。**

| 页签 | 取数 | 真源 | 证据 |
|---|---|---|---|
| Agents | `GET /api/jingyun/installed-assets` → `json.data.agentsDetail \|\| json.data.expertsDetail` | **本机扫描**（`getInstalledAssets`） | JSX L33-46；`assets/service.ts` L12+ |
| Skills | `GET /api/jingyun/skills?limit=30[&keyword][&marker]` → `data.data` + `hasMore` + `nextMarker` | **远端** `https://cn.clawhub-mirror.com/api/v1/search`，再**并入本机** `~/.dsh/skills` 目录里远端没返回的 slug（读 `SKILL.md` 的 `title:`/`description:` 当友好名） | JSX L228-264；`routes/skills.ts` L13-141 |
| 社区 | `GET /api/jingyun/plugins/community?page&limit[&keyword]` → `data.data` + `total` + `hasMore` | **内置快照** `resources/registry-snapshot.json` —— **不是** UI 文案说的 GitHub 检索 | JSX L685-753；`plugins/service.ts` L412-461 |

**内置快照的数据模型（650 259 字节，v0.1.21）**：

```json
{ "_source": "来自 GitHub DSH 社区开源项目 (https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)",
  "_disclaimer": "【免责声明】本列表插件数据完全来自第三方社区搜集整理……",
  "name": "awesome-dsh-plugin", "url": "…", "source": "…",
  "updated": "2026-08-16", "count": 839,
  "categories": { "ui": { "en": "UI Enhancements", "zh": "UI 增强" }, … 共 12 类 },
  "plugins": [ { "name": "DSH-Right-Sidebar", "owner": "Limitinfinitude", "url": "…", "page": "…",
                 "category": "ui", "description": { "en": "…", "zh": "…" }, "npm": null, "stars": 0,
                 "install": "dsh plugin --profile web add github:Limitinfinitude/DSH-Right-Sidebar",
                 "added": "2026-08-16" }, … ] }
```

**⚠️ 读到的两个硬缺陷（静态推断，见 §7-①）**：

1. **形状不匹配**：读取器只认两种形状——顶层是数组，或 `parsed.objects`（npm registry 格式）。而快照顶层键是 `_source/_disclaimer/name/url/source/updated/count/categories/plugins`，**既不是数组也没有 `objects`**（`grep -c '"objects"' registry-snapshot.json` → `0`）→ `pluginsList` 恒为 `[]`。
2. **路径不可达**：`const snapshotPath = path.resolve(__dirname, 'registry-snapshot.json')`（`plugins/service.ts` L418）是**单路径、无候选**。而 `tsdown.config.ts` 只产 `lib/index.mjs` + `lib/client.js` 两个文件，`package.json` 的 `files` 里的 `resources/` **不会被拷进 lib/**；全仓 `grep -rn "registry-snapshot"` 只命中这一处读取点，**没有任何拷贝步骤**。对照它自己在 `src/index.ts` L113-124 给 builtin-skills 写了 **5 个候选路径**（`process.cwd()/packages/...`、`__dirname/../resources/...`、`__dirname/builtin-skills`、`process.cwd()/resources/...`、`process.cwd()/src-tauri/resources/...`）——同一仓库两种写法，读快照这处是**退化写法**。

→ 两条任一成立，社区页签都会稳定渲染空态文案「未检索到匹配该关键字的开源社区插件。」（L988）
→ 顺带：即使快照被读到，UI 的映射（L706-720 取 `item.npm || item.name` / `item.title` / `item.description` / `item.topics`）也与快照字段（`name/owner/category/description.{zh,en}/stars/install`）**对不上**：`description` 是对象，直接塞进 React 子节点会抛错。

**那个 `clearTimeout` 到底是什么**（任务书问的）：

```tsx
// MarketplaceSection.tsx L266-274（Skills 页签）
useEffect(() => {
  if (filterType !== 'all') return;
  const timer = setTimeout(() => { loadSkills(query, '', false); }, 350);
  return () => clearTimeout(timer);
}, [query, filterType]);
```

```tsx
// MarketplaceSection.tsx L851-857（社区页签）
useEffect(() => {
  const timer = setTimeout(() => { loadCommunityNpmPlugins(1, query, false); }, 300);
  return () => clearTimeout(timer);
}, [query, sortBy]);
```

→ **搜索输入防抖**：350ms（技能）/ 300ms（社区），依赖数组变化时取消上一发。
→ **不是定时刷新**：全文 `grep setInterval` → 0 命中；`setTimeout` 只有这两处。
→ 另有**首次装载**用 `queueMicrotask` 触发（L49-52 / L276-282 / L845-848 三处），避开 effect 同步阶段。
→ **Skills 页签还有一条「空则自拉」的兜底 effect**（L276-282）：`skills.length === 0` 就再 `loadSkills('','',false)` —— 与 `useEffect([query])` 的首次触发**叠加**，首屏会打两次请求（静态推断）。

**空 / 加载 / 失败三态表现**：

| 态 | 表现 | 证据 |
|---|---|---|
| 加载 | 居中一行文字，`padding:24px 0; font-size:13px; color:var(--dsw-alias-label-tertiary)`；文案 `正在扫描已安装智能体列表...` / `正在拉取 ClawHub 镜像站最新数据，请稍候...` / `正在检索 GitHub 社区 (topic:dsh-plugin) 最新开源插件，请稍候...`；**无骨架屏、无 spinner**；`catalogHeading` 里的计数位置显示 `加载中...` | L100-110、L409-420、L960-972；计数 L97/L405 |
| 空 | 居中一行，12px tertiary，`padding:24px 0`（Agents 为 `32px 0`）；社区页签额外带 `gridColumn:'span 2'`；**三种文案**：`暂无已安装的智能体模块。` / `暂无本地已下载启用的技能模块。` 与 `未检索到匹配该关键字的技能。` / `未检索到匹配该关键字的开源社区插件。` | L111-121、L426-439、L978-989 |
| 失败 | **没有失败态 UI**：`loadSkills` 只 `console.error`（L259），列表保持原值；`loadCommunityNpmPlugins` 只 `console.warn`（L743），并把 `plugins` 清空、`hasMore=false`（L746-750）；`checkInstalledPlugins` 是**空 catch**（L682）；动作失败走 `alert()` | 同左 |

---

### 2.7 与官方槽位的关系

**它用的是官方槽位，不是自建 Tauri 界面；但侧栏一级入口那处用了 DOM 硬塞（比我们退步）。**

**① 用了哪些官方槽位**（`client/index.tsx` 全文）：

| 槽位 | 用途 | 证据 |
|---|---|---|
| `settings.plugins.tab` ×3 | 三个商店页签（本报告主体） | L208-242 |
| `conversation.input.left` | 输入框左侧智能体下拉按钮 | L247-256 |
| `sidebar.brand.mark` / `sidebar.brand.name` / `conversation.hero.brand.mark` | 品牌位（4 处 `slots.register`） | L132-166 |
| `sidebar.footer.action` | 侧栏底部按钮 | L168-192 |
| `settings.trigger` | 设置入口旁按钮 | L194-203 |
| `main` ×5（keyed） | 五个主内容区面板：`marketplace` / `connectors` / `automation` / `assets` / `more` | L266-317 |

**② 它没有用 `plugins.item`**，也没有用 `sidebar.panellist`、`plugins.detail.badge`。（对比：我们用的是 `plugins.item` + `main` + `sidebar.panellist` + `plugins.detail.badge` —— 见 §4。）

**③ 侧栏一级入口是「找官方按钮 + portal 插入」的 DOM 技巧，不是槽位**：

```tsx
// components/NavigationRows.tsx L85-95, L131-148
const newChatBtn =
  document.querySelector('button[class*="newSession"]') ||
  Array.from(document.querySelectorAll('button')).find((btn) => {
    const text = btn.textContent || '';
    return text.includes('新会话') || text.includes('新建会话') || text.includes('New Chat') || text.includes('新建任务');
  });
…
portalDiv = document.createElement('div');
portalDiv.id = 'jy-nav-top-portal';
newChatBtn.insertAdjacentElement('afterend', portalDiv);
…
return createPortal(navContent, topPortalTarget);
```

→ **靠中文文案 `textContent.includes('新会话')` 定位敌方按钮**，再 `insertAdjacentElement` 插一个自己的 DOM 容器托管滚动条式入口；还配了 `MutationObserver` 反复把官方「新会话」按钮文字**改写**为「新建任务」（L105-121）。这套做法对官方改文案/改结构**零免疫**。切换面板靠 `globalClientContext?.layout?.selectPanel?.(panelKey)`（L77-81）。

**④ 侧栏「应用市场」≠ 那三个商店页签，而是 iframe 嵌远端网页**：

```tsx
// client/index.tsx L266-277
ctx.slots.inject('main', () => {
  ctx.slots.register({ name: 'main', key: 'marketplace' },
    () => React.createElement(OnlineWorkspaceMainView, { subPath: '/zh/marketplace' }));
  …
});
```

```tsx
// client/pages/OnlineWorkspaceMainView.tsx L276-332
if (!appHost) { /* 未配置域名 → 提示态 */ }
…
<iframe className="jy-online-workspace-iframe" … />
```

→ `appHost` 来自 `brandingManager.fetch()` 的配置（L22-26），默认空 → 未配置时是提示态；配好后是 `appHost + /zh/marketplace` 的跨域 iframe，并用 `postMessage` 与父页通信（L60+、L164-198、L227-262）。

**这是一条很值得注意的结构对照**：**它把「商业商店」这一层留给了线上 webview，「本地条目管理」这一层才交给官方页签** —— 与我们二期「内置 / 精选 / 商店」的分层意图是同构的，但它**没有**在 DSH 侧实现「商店」本体。

**⑤ Tauri 壳存在，但商店 UI 不在壳里**：`src-tauri/` 只做窗口/托盘/sidecar 生命周期（`tauri.conf.json`、`AGENTS.md` 架构图），前端仍是注入官方 Web 客户端的模块（`tsdown.config.ts` 的 `__ModuleLoader__.load`）。`cordis.patch.yml` 只 insert 后端插件 + 两个 MCP（mobile-mcp、desktop-control-mcp），**与商店 UI 无关**。

---

## 3. 排版总表（值 + 出处 + 可比性）

**可比性说明（必读）**：jingyun 的商店样式是**手绘 CSS**，我们（DSH Enterprise）用的是**官方原语组件**（`Switch` / `Tag` / `StateDot`）+ 一小段自己的 `own-market-*` CSS。因此：

- 与「官方原语」对比行 → **可以直接照抄数值**（我们用同一个组件，抄的是它的 CSS 取值）；
- 与「jingyun 自绘」对比行 → **只能作旁证**（它也是复刻官方，但复刻过程中已经漂移，见下表的 ❌ 行）。

官方参照物的出处（本机 `@deepseek-ai/dsh@0.2.0-rc.2`，全部为内联 CSS，class 前缀是构建期哈希）：
- **官方插件清单**（2 列卡片网格）：`node_modules/@deepseek-ai/dsh-client-ui-settings-plugin-inventory/lib/client.js`，前缀 `qSYn7G_`
- **官方插件设置页签条**（宿主）：`node_modules/@deepseek-ai/dsh-client-ui-settings-plugins/lib/client.js`，前缀 `pbvGtq_`
- **官方原语**：`node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/{Tag,StateDot,Switch,SegmentedTabs,SegmentedControl,Pill}.module.css`

### 3.1 容器与网格

| 元素 | jingyun 取值（出处） | 官方取值（出处） | 可比性 |
|---|---|---|---|
| 商店根容器 | `display:flex; flex-direction:column; gap:12px; width:100%`（`styles.ts` L158-164） | `.qSYn7G_section{gap:14px; max-width:760px}`（plugin-inventory） | ⚠️ 官方有 `max-width:760px` 内容宽上限；它没有 |
| `.catalog` | `flex column; gap:12px`（`styles.ts` L218-222） | `.qSYn7G_catalog{gap:12px}`（plugin-inventory） | ✅ **同值，可照抄** |
| 卡片网格 | `grid; repeat(2,minmax(0,1fr)); gap:10px; align-items:start;` **+ `max-height:380px; overflow-y:auto`**（`styles.ts` L305-315） | `.qSYn7G_cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none;display:grid}` | ✅ 网格部分同值；❌ **`max-height:380px` 内滚是它自加**（官方无），见 §6 |
| 窄屏断点 | `@media (max-width:768px){ grid-template-columns:1fr }`（`styles.ts` L317-321） | `@container qSYn7G_plugin-inventory (width<=520px){ .qSYn7G_cards{grid-template-columns:minmax(0,1fr)} }` | ❌ 官方用**容器查询 520px**，它用**视口查询 768px**（面板内嵌时视口不准） |
| 小节标题行 | `.catalogHeading{gap:7px; padding:0 2px; margin-top:4px}`（L283-289） | 官方用 `groupTitleRow{min-height:36px;gap:8px}` + `groupSub`（plugin-inventory） | ⚠️ 官方是「节头 + 副行」，它是「标题 + 同行计数」 |

### 3.2 行（卡片）本体

| 元素 | jingyun 取值（出处） | 官方取值（出处） | 可比性 |
|---|---|---|---|
| 卡片 | `border:1px solid var(--dsw-alias-border-l2,#e4e4e7); border-radius:10px; background:var(--dsw-alias-bg-layer-3,#fff); box-shadow:0 1px 2px rgba(0,0,0,.02)`（L323-330） | `.qSYn7G_card{border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill)}` | ❌ **漂移**：`1px`≠`.5px`；`10px`≠`radius-xl`；用了 `bg-layer-3` 而非语义化的 `settings-card-fill`；多了一层 `box-shadow` |
| 展开态卡片 | `border-color:var(--dsw-alias-border-l1); box-shadow:var(--dsw-shadow-lv1)`（L332-335） | `.qSYn7G_card[data-open=true]{border-color:var(--dsw-alias-border-l3)}`（**只换描边色，不加阴影**） | ❌ 漂移（多阴影 + 用 l1 而非 l3） |
| 行按钮 | `flex; align-items:center; justify-content:space-between; gap:12px; min-height:52px; padding:12px 14px`（L337-353） | `.qSYn7G_cardContent{flex-direction:column; align-items:stretch; gap:2px; min-height:52px; padding:12px 14px}`（行内用 `.qSYn7G_cardMainRow{justify-content:space-between; gap:12px}`） | ⚠️ **关键结构差异**：官方 `cardContent` 是**纵向 2 行**（标题行 + 描述行，gap 2px），它把官方结构**拍平成单行**、把描述挪进展开区 |
| 行悬停/展开底 | `background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.02))`（L355-358） | `.qSYn7G_cardContent:hover,.qSYn7G_card[data-open=true]>.qSYn7G_cardContent{background:var(--dsw-alias-interactive-bg-hover)}`（**无 fallback**） | ✅ 同 token（它的 rgba fallback 值偏小，仅兜底） |
| 标题 | `font-size:13px; line-height:20px; font-weight:600`（L360-368） | `.qSYn7G_cardTitle{flex:1;min-width:0;font-size:14px;font-weight:500;line-height:20px}` | ❌ **漂移**：13px≠14px；600≠500 |
| 描述（官方常显） | 收起时不显示；展开后 `.descriptionText{font-size:12px;line-height:1.6}`（L424-429） | `.qSYn7G_cardDescription{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;-webkit-line-clamp:2;display:-webkit-box}`（**始终可见**） | ❌ 语义相反（它隐藏、官方常显） |
| 右侧簇 | `.cardTrailing{gap:7px}`（L370-376） | `.qSYn7G_cardTrailing{gap:8px}` | ❌ 7px≠8px |
| chevron | 自绘 `<svg 12×12 strokeWidth=2.5>`，展开 `transform:rotate(180deg)`（JSX L148-166；CSS L409-416） | `IconChevronDownOutlineRegular size={12}` + `.qSYn7G_chevron{color:var(--dsw-alias-label-tertiary);flex:none}` + `[data-open=true] .chevron{transform:rotate(180deg)}` + `transition:transform .14s var(--ds-ease-in-out)` | ⚠️ 尺寸同（12）；它**没用官方图标原语**；过渡时长 `.2s`≠`.14s` |
| 展开区 | `border-top:1px solid var(--dsw-alias-border-l2); padding:12px 14px 14px; background:var(--dsw-alias-bg-module-platform,#fafafa)`（L418-422） | `.qSYn7G_cardDetails{border-top:.5px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-module-platform); padding:10px 14px 12px}` | ❌ `1px`≠`.5px`；`12px 14px 14px`≠`10px 14px 12px` |
| 徽标/身份签（官方有） | **无** | `.qSYn7G_cardIdentity{font-family:var(--ds-font-family-code); font-size:12px; line-height:18px; border-radius:var(--dsw-radius-xs); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); padding:1px 6px}` | ❌ 它没有「包名/模块名 mono 签」这一层 |

### 3.3 状态点与标签

| 元素 | jingyun 取值（出处） | 官方取值（出处） | 可比性 |
|---|---|---|---|
| 状态点 | `.statusDot{width:7px;height:7px;border-radius:999px;background:var(--dsw-alias-label-tertiary,#a1a1aa)}`（L378-385） | `StateDot`：10px 布局槽 + `::after{inset:20%}` → **6px 实心核**；`data-state='idle'` 用 `--dsw-alias-state-idle-primary`（`StateDot.module.css`） | ❌ 7px≠6px；灰色 token 取错（官方 idle 用 `state-idle-primary` 而非 `label-tertiary`） |
| 状态点·启用 | `background:var(--dsw-alias-state-success-primary,#10b981)`（L387-389） | `StateDot[data-state='done']{color:var(--dsw-alias-state-success-primary)}` | ✅ **同 token，可照抄** |
| 在途态 | **无点**（只有按钮文案） | `StateDot` 的 `ongoing` 是**唯一非圆点态**：全环轨道 + 呼吸弧 + `1.5s` 匀速旋转（`@keyframes dsh-state-dot-spin` / `-dash`），并 `role="img"` + `aria-label`/`title`；`PHASE_DOT_STATES={pending:'idle',loading:'ongoing',unloading:'ongoing'}`（plugin-inventory） | ❌ 它没有在途点；**官方这套在途表达是我们可以直接拿来补的** |
| 标签 | `.configTag{border-radius:5px; padding:1px 6px; font-size:11px; line-height:16px; background:var(--dsw-alias-bg-layer-1,#f4f4f5); color:var(--dsw-alias-label-secondary,#71717a)}`（L391-402） | `Tag`：`border-radius:999px; padding:1px 8px; font-size:11px; line-height:17px; font-weight:500` + tone 体系（`Tag.module.css`）：`neutral` = `bg-module-platform` + `label-secondary`；`info` = `business` 10%；`warning` = `warn` 12%；`danger` = `error` 10%；`success` = `success` 10% | ❌ **漂移明显**：`radius 5px`≠`999px`；`padding 1px 6px`≠`1px 8px`；`16px`≠`17px`；缺 `font-weight:500` |
| 标签·已启用 | `background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#10b981) 10%, transparent); color:var(--dsw-alias-state-success-primary)`（L404-407） | `Tag[data-tone='success']{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent); color:var(--dsw-alias-state-success-primary)}` | ✅ **逐值相同**（官方 Tag 注释自述「matching it is what makes this a pure consolidation」，即它就是从这类手绘签合并来的） |
| 标签·中性 | `bg-layer-1` + `label-secondary` | `Tag[data-tone='neutral']` = `bg-module-platform` + `label-secondary` | ❌ 底色 token 不同（`bg-layer-1` vs `bg-module-platform`） |
| 标签·语义色映射 | 只有「绿=已启用」一档 | 官方 `TAG_TONES={disabled:'neutral', conditional:'warning', preset:'info', failed:'danger'}`，且 **`enabled` 不出签**（`StateTag` 里 `kind==='enabled'` 直接 `return null`） | ⚠️ 官方「已启用」**不出签**（用点表达）；它给「已启用」配了签 —— 语义分歧 |

### 3.4 搜索、筛选、按钮、页签条

| 元素 | jingyun 取值（出处） | 官方取值（出处） | 可比性 |
|---|---|---|---|
| 搜索框 | `height:36px; border:1px solid var(--dsw-alias-border-l2,#e4e4e7); border-radius:8px; padding:0 34px 0 36px; font-size:13px; background:var(--dsw-alias-bg-layer-1,transparent)`；focus 只换 `border-color`（L232-249） | `.qSYn7G_search input{border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-layer-1); width:100%; height:36px; font-size:13px; padding:0 34px 0 36px}`；`input:focus-visible{border-color:var(--dsw-focus-ring-color,…); box-shadow:0 0 0 2px color-mix(… 18%, transparent)}`；`input::placeholder{color:var(--dsw-alias-label-tertiary)}` | ⚠️ 高度/内距/字号**同值**；❌ 描边 `.5px border-l4`≠`1px border-l2`；`radius-md`≠`8px`；**缺 focus 环与占位色** |
| 搜索图标 | 内联 svg `14×14`、`strokeWidth 2.8`、`position:absolute; left:12px` | `.qSYn7G_search>svg{pointer-events:none; position:absolute; left:12px}` | ✅ 位置同值（尺寸由各自的 svg 决定） |
| 筛选触发器 | `.jy-select-trigger{height:36px; min-width:92px; padding:0 14px; border-radius:18px; font-size:13px; line-height:22px; background:var(--dsw-alias-bg-module-platform,rgba(0,0,0,.04))}`（L252-272） | 官方同类是 `.qSYn7G_switcher{height:36px; border-radius:var(--dsw-radius-md); padding:0 14px; gap:12px; font-size:14px; line-height:22px; background:var(--dsw-alias-bg-module-platform)}` | ⚠️ 高/内距同值；❌ `radius 18px`（胶囊）≠`radius-md`；`13px`≠`14px`；缺 `gap:12px` |
| 动作按钮 | `.actionBtn{height:28px; padding:0 14px; border-radius:6px; font-size:12px; font-weight:500; border:1px solid transparent}`；`primary` = 黑底白字（L438-478） | 官方 `Button` 原语（本机 `Button.module.css` 未在本轮逐值展开——**未读到**） | ⚠️ 官方原语存在（`lib/Button.module.css`），本轮**未读其取值**，故不作逐值比较（§7-⑧） |
| 页签条（它自己那份死样式） | `.jy-tabs{gap:22px; border-bottom:1px solid var(--dsw-alias-border-l2); margin-top:4px; margin-bottom:4px}`；`.jy-tab{padding:7px 1px 9px; font-size:13px; line-height:20px; color:var(--dsw-alias-label-tertiary)}`；选中 `::after{height:2px; border-radius:2px 2px 0 0; bottom:-1px; background:var(--dsw-alias-label-primary)}`（L179-216） | `.pbvGtq_tabs{border-bottom:.5px solid var(--dsw-alias-border-l2); gap:22px; margin-top:2px; align-items:flex-end; display:flex}`；`.pbvGtq_tab{padding:7px 1px 9px; font-size:13px; line-height:20px; color:var(--dsw-alias-label-tertiary); position:relative}`；`:hover,[data-active=true]{color:var(--dsw-alias-label-primary)}`；选中/Focus `::after{height:2px; border-radius:2px 2px 0 0; bottom:-1px; left:0; right:0; background:var(--dsw-alias-label-primary)}`；`:focus-visible{outline:var(--dsw-focus-ring-width) solid …; outline-offset:2px; border-radius:2px}`（settings-plugins） | ✅ **几乎逐值相同**（`gap 22px`、`padding 7px 1px 9px`、`13px/20px`、`::after 2px / 2px 2px 0 0 / bottom:-1px`）→ 它这份是**官方页签条的复刻**；❌ 仅差 `border-bottom 1px`≠`.5px`、多了 `margin-bottom:4px`、`margin-top 4px`≠`2px`、**缺 `:focus-visible` 焦点环** |

### 3.5 我们自己的页签条 vs 官方页签条（我们「手写页签条」的逐值差）

我们的取值在 `plugin/packages/ui/src/marketplace-entry.tsx` L626-630：

```css
.own-market-tabs{display:flex;flex-wrap:nowrap;align-items:flex-end;gap:22px;min-width:0;
  margin-top:0;border-bottom:1px solid var(--dsw-alias-border-l2,#e4e7ec)}
.own-market-tab{background:transparent;border:0;border-bottom:2px solid transparent;
  color:var(--dsw-alias-label-tertiary,#667085);cursor:pointer;font:inherit;
  font-size:13px;line-height:20px;margin-bottom:-1px;padding:7px 1px 8px;white-space:nowrap}
.own-market-tab[aria-selected='true']{border-bottom-color:var(--dsw-alias-label-primary,#101828);
  color:var(--dsw-alias-label-primary,#101828);font-weight:500}
```

对照官方 `.pbvGtq_tabs` / `.pbvGtq_tab`，**逐值差只有 5 处**：

| # | 我们 | 官方 | 影响 |
|---|---|---|---|
| 1 | `border-bottom:1px` | `.5px` | 分隔线视觉偏重（官方全线用半像素描边） |
| 2 | `margin-top:0` | `2px` | 页签条与上方内容的呼吸差 2px |
| 3 | `.own-market-tab` `padding:7px 1px 8px` | `padding:7px 1px 9px` | 选中态位置差 1px |
| 4 | 下划线用 `border-bottom:2px` + `margin-bottom:-1px` | 用 `::after` 绝对定位（`height:2px; bottom:-1px; border-radius:2px 2px 0 0`） | 视觉等价；官方的写法在**未选中**时不占位、且能同时用于 `:focus-visible` |
| 5 | 选中 `font-weight:500` | 官方**不加粗**（只有 `color` 变化；加粗是 `SegmentedTabs` 的行为，不是 tablist 的） | 我们的选中态比官方重一档 |

**外加一处缺失**：官方 `.pbvGtq_tab:focus-visible` 有 `outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,…); outline-offset:2px; border-radius:2px`，我们**有** `:focus-visible`（L629）——这一条我们做对了。

---

## 4. 对照表（它的每个 UI 点 ↔ 我们的做法 ↔ 建议 ↔ 人日）

我们的现状出处：`plugin/packages/ui/src/marketplace-entry.tsx`（下称 **ME**，1174 行）与 `plugin/packages/ui/src/client.tsx`（下称 **CX**，173 行）。

| # | 它的 UI 点 | 我们的做法（出处） | 建议 | 人日 |
|---|---|---|---|---|
| 1 | 三个页签挂官方 `settings.plugins.tab`，order 30/40/50 | 一条 `plugins.item` 条目（ME 常量，`CX` L138-146，order 50）+ 一条 `main` keyed 面板（`CX` L155-162）+ 一条 `sidebar.panellist`（`CX` L166-172）；page 视图自己出三页签 | **方案甲胜出，不采纳它的挂点**。它的挂点把商店埋在「设置 → 插件」里；我们是侧栏一级 + 整页，曝光更好。但它「order 排在官方之后」的做法与我们一致 | 0 |
| 2 | 页签条由官方宿主渲染 | 手写 `role="tablist"`（ME L795-812）+ 自绘 CSS（ME L626-630） | **保留手写**（我们的 primitives pin 无 `SegmentedTabs`），但**逐值对齐官方 `.pbvGtq_tab`**（§3.5 的 5 处差） | 0.2 |
| 3 | 它另有死样式 `.jy-tabs/.jy-tab`，是官方页签条的复刻 | — | **列为旁证**：和我们同一处境（都手写过），但我们的取值已经比它更接近官方（我们缺的比它少） | 0 |
| 4 | 卡片网格 `repeat(2,1fr) gap 10px` | 单列分隔行 `.own-market-rows{flex column}` + `.own-market-row{padding:12px 2px; border-bottom:.5px solid border-l2}`（ME L589-591） | **不改成 2 列网格**（§6-①）。网格值本身同官方，记下备用 | 0 |
| 5 | 卡片 `border-radius:10px` + shadow + `border-l2` | 行无外框（只有下分隔线） | 保持行形态；**若将来要卡片化，用官方 `.5px settings-card-stroke + radius-xl + settings-card-fill`，不要用它漂移后的 10px/bg-layer-3** | 0 |
| 6 | 行主标题 `13px/20px/600` | `14px/20px/500`（ME L600 `.own-market-cardId`） | **我们已对齐官方，保持**（官方 `cardTitle` 也是 14/20/500）——它的 13px/600 是漂移值 | 0 |
| 7 | 收起时不显示描述；展开才显示 `12px/1.6` | 描述**常显**、`13px/18px`、`-webkit-line-clamp:1`（ME L602） | 字号对齐官方 `12px/18px`；行数 1 vs 官方 2 → **建议保持 1 行**（我们的行已是 40px 高、密度优先），只改字号与 tier | 0.2 |
| 8 | 状态点 7px，两态（绿/灰） | 官方 `StateDot`（ME 已 import，L9-10）；受管态映射 `enterprisePluginDot`（ME L497） | **保留官方 StateDot**；值上它 7px 是错的（官方 6px 核 + 10px 槽） | 0 |
| 9 | 「已启用」配一枚绿签 | 官方 `Tag`，版本签 `neutral` + 分类签 `info`（ME L869-873），且**不给「已启用」配签**（官方 `StateTag` 对 enabled 返回 null） | **我们已对齐官方语义，保持**；它的做法（enabled 出签）是分歧方向，不采纳 | 0 |
| 10 | 标签 `radius 5px / padding 1px 6px / 11px·16px` | 官方 `Tag`（`999px / 1px 8px / 11px·17px·500`） | **保留官方 Tag**，不要照它的手绘签 | 0 |
| 11 | 「有更新」这一类**完全没有** | 有：`[有更新]` 辅助 `<button>`（ME L882-894，`ENTERPRISE_MARKET_SKILL_UPDATE_LABEL`，testid `data-enterprise-skill-tag='UPDATE_AVAILABLE'`）+ 行状态纯投影 `enterpriseMarketSkillState` 含 `UPDATE_AVAILABLE` | **不采纳（我们领先）**：这是我们的差异化能力，jingyun 与官方**都没有**。保持 | 0 |
| 12 | 在途只有按钮文案，行级无感 | `Switch disabled`（ME L899-907）+ 行状态 `INSTALLING`/`REMOVING`；**状态点不变** | **可抄它的缺口反衬**：把在途行的 `StateDot` 切成官方 `state="ongoing"`（旋转弧），让折叠态也看得见在途。官方已有现成动画（`StateDot.module.css` 的 `.spinnerMotion/.spinnerArc`，1.5s） | 0.5 |
| 13 | 失败用 `alert()`；无行内错误 | 行内 `role="alert"` + 稳定错误码（ME L909-912、`.own-market-inlineError` L640） | **不采纳它的 alert**；可选对齐官方 `.brokenNote` 视觉（error 8% 底 + `radius-lg` + `12px/18px` + `padding:8px 10px`），替换我们现在的纯文字 error 色 | 0.3 |
| 14 | 加载态 = 一行 13px 灰字，无骨架 | 我们有 loading/空/错误三态（ME 的 `EnterpriseSection` + 内联提示） | **可抄官方骨架卡**：`.qSYn7G_skeletonCard{border:.5px settings-card-stroke; radius-xl; settings-card-fill; gap:8px; padding:15px 14px}` + `.skeletonBar{radius-xs; bg-skeleton; height:14px / 12px}` + 2s `cubic-bezier(.36,0,.64,1)` opacity 呼吸。**需先核对 pinned primitives 是否提供 `--dsw-alias-bg-skeleton`**（§7-⑥） | 0.7 |
| 15 | 搜索框 `1px border-l2 / radius 8px`，无 focus 环、无占位色 | 我们**没有商店级搜索**（列表来自后台分配，规模可控） | **暂不采纳**；若二期「商店」场景要搜索，直接照官方 `.qSYn7G_search input`（`.5px border-l4` + `radius-md` + `focus-visible` 环 + `::placeholder` 色） | 0 |
| 16 | 筛选下拉：官方 `Menu` + 自绘胶囊触发器（`radius 18px`） | 我们没有筛选器 | 若要加：照官方 `.qSYn7G_switcher`（`radius-md` / `14px·22px` / `padding 0 14px` / `gap 12px`），**不要照它的 18px 胶囊 + 13px** | 0 |
| 17 | 「加载更多」按钮（两种分页：marker / page） | 我们没有分页 | **暂不采纳**；二期商店若分页，优先游标式（与官方 `CursorPageData` 口径一致），不要页码 | 0 |
| 18 | 搜索输入防抖 300/350ms + **客户端二次过滤** | 无 | 若要加搜索：**只在一侧过滤**（§6-②） | 0 |
| 19 | 展开/折叠：单开手风琴、`data-open`、无 aria | 我们的「组件」页签节头有 `groupToggle`（ME L581-587）+ `aria-expanded`（官方口径 `?? false`）；技能/插件两节**已无折叠**（页签承担显隐） | **不采纳折叠**：我们的页签化已经把「折叠」这件事消掉了，比它更进一步 | 0 |
| 20 | 行按钮无 `aria-expanded`/`aria-controls`；无键盘交互 | 页签条有完整 aria 契约 + roving tabIndex + ←/→/Home/End（ME L760-812） | **不采纳**：我们已超越 | 0 |
| 21 | 侧栏一级入口用 DOM portal 硬塞 + 改官方按钮文案 | 官方 `sidebar.panellist` 槽位（`CX` L166-172，`id`=`main` key，order 20） | **不采纳**：我们正规，绝不可回退 | 0 |
| 22 | 「应用市场」面板 = 远端 iframe（`OnlineWorkspaceMainView`） | 我们的 `main` 面板 = 本地三页签商店 | **结构上可借鉴的分层**：二期「商店」场景若要走线上，可照它「线上层用 iframe + postMessage，本地层用官方槽位」的分法；但**不要**把我们的本地条目管理也搬进 iframe | 0 |

---

## 5. 采纳清单（按性价比排序）

> 「与方案甲是否冲突」一栏：方案甲 = 条目占官方 `plugins.item`、其 `page` 视图即主内容区整页、三页签商店、页签条手写。下列**全部不冲突**，除非单独标注。

### P1 — 页签条逐值对齐官方 `.pbvGtq_tab`（性价比最高）

- **改哪里**：`plugin/packages/ui/src/marketplace-entry.tsx` 的 `styles` 字符串 **L626–L630**（`.own-market-tabs` / `.own-market-tab` / `:hover` / `:focus-visible` / `[aria-selected='true']`）。
- **改什么**（5 处，纯数值）：
  1. `.own-market-tabs` `border-bottom:1px` → **`.5px`**；`margin-top:0` → **`2px`**；
  2. `.own-market-tab` `padding:7px 1px 8px` → **`7px 1px 9px`**；
  3. 下划线由 `border-bottom:2px solid transparent` + `margin-bottom:-1px` → 官方 `::after{height:2px; bottom:-1px; left:0; right:0; border-radius:2px 2px 0 0; background:var(--dsw-alias-label-primary)}`（视觉等价、写法对齐、可与 focus 共用）；
  4. `[aria-selected='true']` 去掉 `font-weight:500`（官方 tablist **不加粗**）；
  5. 补 `::after` 到 `:focus-visible`（官方同款）。
- **人日**：**0.2**（含改后跑一次现有 UI 门禁/快照）。
- **风险**：低。唯一实质视觉变化是「选中页签不再加粗」与 1px 分隔线变半像素；若测试里有图快照需同步更新。**注意**：改前先确认 `--dsw-alias-border-l2` 在暗色主题下的半像素渲染（本机未验证，§7-④）。
- **依据**：§3.4 页签条行 + §3.5 五处差值表；官方出处 `dsh-client-ui-settings-plugins/lib/client.js` 的 `pbvGtq_*`。

### P2 — 行描述字号与语义 tier 对齐官方 `cardDescription`

- **改哪里**：`marketplace-entry.tsx` **L602** `.own-market-cardDesc`。
- **改什么**：`font-size:13px` → **`12px`**；保留 `line-height:18px`、`-webkit-line-clamp:1`；`color` 已经是 tertiary（保持一致）。
- **人日**：**0.2**。
- **风险**：低。行高不变（`18px` 锁死）→ 行总高 40px 不变，**不动布局**。仅字号小 1px。
- **依据**：官方 `.qSYn7G_cardDescription{font-size:12px; line-height:18px}`；我们 L602 当前为 13px。

### P3 — 在途行让状态点可见（补上它和官方都缺的折叠态反馈）

- **改哪里**：`marketplace-entry.tsx` 的**技能行**（L855–L908 的 `own-market-rowLine`）与**插件行**同构处；状态点渲染点 + `enterprisePluginDot`/`enterpriseMarketSkillState` 的映射函数（L497、L460 附近）。
- **改什么**：在途（`INSTALLING`/`REMOVING`）时用官方 `StateDot state="ongoing"`（旋转弧）；非在途维持 `done`/`idle`。官方 `StateDot.module.css` 已含 `.spinnerMotion`/`.spinnerArc` 与 `@keyframes dsh-state-dot-spin/-dash`（1.5s，`prefers-reduced-motion` 已降级）。
- **人日**：**0.5**（改映射 + 补一个 `data-state` 分支 + 测试断言）。
- **风险**：中低。`StateDot` 是已 import 的官方原语（ME L9-10），**无需新增依赖**；风险在「当前技能行没有状态点」——需要在行里新增一枚点（宽度变化可能触发快照；若不想动布局，可复用现有 `.own-market-rowState` 文案位）。
- **依据**：官方 `PHASE_DOT_STATES={pending:'idle',loading:'ongoing',unloading:'ongoing'}` + `StateDot.module.css`；它的缺口见 §2.3「在途」行。

### P4 — 骨架屏替换纯文字加载态

- **改哪里**：`marketplace-entry.tsx` 里 `EnterpriseSection` 的加载分支（loader 态渲染处）+ `styles` 新增 `.own-market-skeleton*`。
- **改什么**：照官方 `.qSYn7G_skeletonCard` / `.skeletonBar` 逐值：`border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); gap:8px; padding:15px 14px`；bar：`border-radius:var(--dsw-radius-xs); background:var(--dsw-alias-bg-skeleton); height:14px / 12px; width:40% / 80%`；动画 `2s cubic-bezier(.36,0,.64,1) infinite`，`0%{opacity:1} 40%{opacity:.6} 80%,to{opacity:1}`，并挂 `@media (prefers-reduced-motion:no-preference)`。
- **人日**：**0.7**。
- **风险**：中。**前置校验**：`--dsw-alias-bg-skeleton`、`--dsw-alias-settings-card-stroke/fill`、`--dsw-radius-xl/xs` 这四个 token 在**我们 pinned 的 primitives 版本**里是否定义（本机只有 0.2.0-rc.2 的取值，§7-⑥）。若缺，用现有 token 近似并记录偏差。
- **依据**：官方 plugin-inventory CSS L51-53、L65-71。

### P5 — 行内失败提示对齐官方 `brokenNote` 视觉（保留我们的 `role="alert"` 语义）

- **改哪里**：`marketplace-entry.tsx` **L640** `.own-market-inlineError`。
- **改什么**：由「纯 error 色文字」→ 官方 `.qSYn7G_brokenNote{border-radius:var(--dsw-radius-lg); background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent); color:var(--dsw-alias-state-error-primary); overflow-wrap:anywhere; padding:8px 10px; font-size:12px; line-height:18px}`。
- **人日**：**0.3**。
- **风险**：低。会改变行高（加了 padding），可能触发布局快照。
- **依据**：官方 CSS L48；我们 L640。

### P6 — 窄屏断点从「视口媒体查询」升为「容器查询」（准备项，不必现在做）

- **改哪里**：若将来商店改成网格布局，才需要。当前我们是单列行列表，**不适用**。
- **人日**：0（记录备查）。
- **风险**：无。
- **依据**：官方用 `@container … (width<=520px)`，jingyun 用 `@media (max-width:768px)`（§3.1）。

### P7 — 不给「已启用」出标签（我们已符合，登记为「勿改」）

- **改哪里**：无。
- **人日**：0。**风险**：无。**依据**：官方 `StateTag` 对 `kind==='enabled'` 返回 `null`；我们已经不给 enabled 出签，状态由 `Switch` + `StateDot` 表达。**登记此条是为了防止将来有人「照 jingyun 给已启用加绿签」**。

---

## 6. 不建议照搬的（≥2 条 + 理由）

### ① 「2 列卡片网格 + `.cards{max-height:380px; overflow-y:auto}`」

**不采纳。** 理由三条：

1. **与承载形态冲突**：我们的商店是 `main` 面板 / `plugins.item` 的 `page` 视图 = **主内容区整页**；在整页里再嵌一个 380px 高的内滚滚动区，会造出「页面里的第二个滚动条」，与官方 `main` 面板的页级滚动基线打架。
2. **官方参照物本身不是内滚**：`plugin-inventory` 的 `.qSYn7G_cards` 只有网格与 gap，**没有 `max-height`/`overflow`**；`max-height:380px` 是 jingyun 自加（`styles.ts` L313-314）。
3. **我们当前形态是「单列分隔行」**（`.own-market-row{padding:12px 2px; border-bottom:.5px solid border-l2}`，ME L590），信息密度与可扫读性都更适合「后台分配清单」这种**有限条目**场景；改成 2 列卡片会让长包名/长描述互相挤压（它自己就被迫给社区行标题加 `maxWidth:160px` 省略，JSX L1053-1057）。

### ② 「搜索：服务端 keyword 分页 + 客户端再次 filter」

**不采纳。** 理由：

1. **逻辑自相矛盾**：`loadSkills` 把 `keyword` 交给服务端（L237-238），回来后又用 `filteredItems` 在客户端**按同一 keyword 再过滤一遍**（L319-333）；社区页签同样（L697-700 vs L877-889）。服务端已按 keyword 分页返回 30 条，客户端再过滤只会**减少**当页命中数，而 `hasMore` 仍按服务端口径为真 → 用户会看到「只有 4 条，但还有『加载更多』」。
2. **Skills 页签还有一条重复拉取**：`useEffect([query])` 首屏已拉一次（L266-274），`useEffect([skills.length])` 在 `skills.length===0` 时**再拉一次**（L276-282）。首屏两发请求。
3. 正确做法：**过滤只在一侧**。若二期商店要搜索，按我们的取数形态（后台分配列表，本地已有全量）应**纯客户端过滤**；若接远端目录，则**纯服务端过滤 + 客户端不再过滤**。

### ③ 「用 `alert()` / `confirm()` 做动作反馈与卸载确认」

**不采纳。** `alert()` 出现在 L300/302/305/794/796/799/830/834/838，`confirm()` 在 L761。理由：阻断式原生弹窗、不可测（无法在快照/单测里断言）、与官方 `Modal`/`RiskConfirmation` 原语体系冲突、且**在 Tauri WebView 里会阻塞渲染进程**。我们已有行内 `role="alert"` 反馈（ME L909-912）+ 官方 `Switch` 的 `title` 提示，方向正确。

### ④ 「侧栏一级入口用 DOM portal 硬塞 + 改写官方按钮文案」

**不采纳。** 见 §2.7-③：它靠 `textContent.includes('新会话')` 找官方按钮、`insertAdjacentElement` 插容器、`MutationObserver` 反复改写「新会话」→「新建任务」（`NavigationRows.tsx` L85-148）。对官方改文案/改结构零免疫。我们走官方 `sidebar.panellist`（`client.tsx` L166-172），**这是我们的相对优势，不可回退**。

### ⑤ 「手绘 `configTag` / `statusDot`」

**不采纳。** 官方在 0.2.0-rc.2 已经把这类手绘签收敛成 `Tag`（tone 体系）与 `StateDot`（6px 核 / idle 用 `state-idle-primary` / ongoing 用旋转弧），`Tag.module.css` 的注释自述 *"matching it is what makes this a pure consolidation"*。我们已经用官方原语（ME L9-10、L869-873），照它回退到 `radius:5px` 的手绘签是**倒退**。

### ⑥ 「`data-phase='unobserved'` 这种无 CSS 规则的状态命名」

**不采纳。** `unobserved` 在 JSX 里出现两次（L466、L1078）但 `styles.ts` 里没有任何 `[data-phase='unobserved']` 规则（实测 0 命中），全靠基础规则兜底。抄它的**取值**可以，抄它的**命名**会带进「状态词表存在但无实现」的隐性技术债。我们应该用官方的 `data-state` 词表（`idle`/`done`/`warning`/`error`/`ongoing`）。

---

## 7. 不确定项（读不懂 / 没读到的，如实写）

① **「社区页签恒空」是静态推断，未实机验证。** 我核了：快照顶层键（无 `objects`、非数组）、读取器只认两种形状、`__dirname` 单路径无候选、`tsdown.config.ts` 只产两个文件、全仓无拷贝步骤。但**没有实机跑过** `GET /api/jingyun/plugins/community`，也没有逐行读完 `scripts/build_deps.js` / `scripts/prepare_dev.js` / `scripts/run_dsh.js`（只 grep 了 `registry-snapshot` 关键字）——若其中某个脚本把 `resources/` 拷到 `lib/`，则「路径不可达」这一半不成立（「形状不匹配」那一半仍成立）。

② **jingyun 发布在 npm 上的实体包未验证。** 我只读了源码树；`@jingyun-ai/jingyun-dsh@0.1.21` 实际 npm tarball 里 `lib/` 与 `resources/` 的落位未核（本机没有它的 node_modules，也没有从 npm 拉包）。

③ **`.jy-tabs` / `.jy-tab` 是否曾在运行时被动态注入使用**：我只做了**文本 grep**（全仓仅 `styles.ts:179` 一处），未做运行时 DOM 观察；理论上可能存在「构建产物里另有一份引用」的情况（未核 `lib/`，因为源码树里没有 `lib/`）。

④ **暗色主题下的实际观感未验证**：半像素描边（`.5px`）与 `color-mix()` 在暗色/高 DPI 下的表现，以及我们页签条改 `.5px` 后的视觉，**未实机看过**。jingyun 的 `styles.ts` 全靠 `var(--dsw-alias-*, fallback)` 双保险，我未逐条核每个 token 是否真的在官方主题里定义（尤其 `--dsw-alias-bg-skeleton`、`--dsw-alias-settings-card-stroke/fill`、`--dsw-radius-xl/xs` 在我们的 pin 版本里——见 ⑥）。

⑤ **`settings.plugins.tab` 的完整注册者清单未穷举**：我只在本机检出里读到两个官方注册者（order 10 / 15）与 `dsh-cordis-client-runner` 的文档示例（order 100）。第三方/其他官方包是否也注册该槽位（影响 jingyun 的 30/40/50 实际落位）**未穷举**。

⑥ **pinned primitives 版本与我们实际运行版本的 token 差异未核**。本机 DSH 检出是 `@deepseek-ai/dsh@0.2.0-rc.2`，其 `@deepseek-ai/dsh-client-ui-primitives` 也是 `0.2.0-rc.2`，并且**导出 `SegmentedTabs` 与 `SegmentedControl`**（`lib/index.js` 里两者都在，`lib/SegmentedTabs.module.css` 存在）。但我们的工程**编译期 pin 的是 `primitives@0.1.5-rc.2`**（`marketplace-entry.tsx` L2 的注释自述「该 pin 不含 `SegmentedTabs`」）。**这两者的 `Tag` / `StateDot` CSS 取值是否逐值相同，本轮没有拿到 0.1.5-rc.2 的包做比对**——§3.3 与 P1/P3/P4 的逐值对齐结论，严格来说需以 **pin 版**的 CSS 复核一遍再落地。

⑦ **`Button` 原语的取值未读**：本机有 `lib/Button.module.css`，但我没有展开它，故 §3.4 的「动作按钮」一行**只作旁证、不作逐值比较**。

⑧ **jingyun 的主题/品牌覆盖层未读**：`BrandBranding.tsx`（及 `dom-helper.ts`）我**没有读**，它们可能对 `--dsw-alias-*` 做了全局覆盖（`initClientBrandingDOM()`、`MutationObserver` 改 title/favicon 等），若如此，则 §3 里引用的所有 token 实际渲染色可能被它改写。本报告的所有颜色结论**仅代表 token 名与 fallback 值**，不代表 jingyun 运行时的最终渲染色。

⑨ **`MarketplaceAgentsTab` 的「已启用」是硬编码**（L144-147，恒 `active` + `已启用`）；我从代码看它**没有任何 disabled/未启用分支**，但未验证服务端 `installed-assets` 是否可能返回带状态字段的 agent 而 UI 忽略了它。

⑩ **它是否还有第四处商店入口**：我只 grep 了 `MarketplaceSection` / 三个导出组件的引用（仅 `client/index.tsx`），未穷举全部 `pages/*.tsx`（例如 `ArtifactInspectorPanel.tsx` 带 `jy-tab-*` 类名，与商店无关但未逐行确认）。

---

## 附：本轮证据落盘清单（可复核）

| 本机文件（`.../home/.sshwork/jy/`） | 内容 | 行数/字节 |
|---|---|---|
| `MarketplaceSection.tsx` | jingyun 商店三个页签全文 | 1332 行 |
| `client-index.tsx` | jingyun 客户端槽位注册全文 | 319 行 |
| `NavigationRows.tsx` | 侧栏 portal 硬塞全文 | 316 行 |
| `styles.ts` | jingyun 样式真源 | 2163 行 |
| `OnlineWorkspaceMainView.tsx` | 线上商城 iframe 面板 | 345 行 |
| `routes-skills.ts` / `routes-plugins.ts` | 技能 / 插件取数与动作路由 | 205 / 79 行 |
| `plugins-service.ts` / `service.ts` | 快照读取与资产服务 | 736 / 524 行 |
| `official-plugin-inventory.css`（+ `.pretty.css`） | **官方插件清单内联 CSS 抽取**（前缀 `qSYn7G_`） | 7 988 字节 / 73 行 |

官方对照物的引用路径（本机 DSH 检出，只读）：

```
/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/
  dsh-client-ui-settings-plugin-inventory/lib/client.js          # qSYn7G_* 官方插件清单 CSS + PluginCard JSX
  dsh-client-ui-settings-plugins/lib/client.js                   # pbvGtq_* 官方页签条 CSS + tablist JSX
  dsh-client-ui-primitives/lib/{Tag,StateDot,Switch,SegmentedTabs,SegmentedControl,Pill}.module.css
  dsh-client-ui-settings/lib/types/client/contract/slots.d.ts    # settings.plugins.tab 契约
```

**结论一句话**：它最值得抄的不是它的界面（它的取值已经漂移、且社区页签大概率恒空），而是三条**结构判断**——(a) 页签条手写要逐值对齐官方 `.pbvGtq_tab`（差 5 处数值，0.2 人日）；(b) 官方 `Tag`/`StateDot` 已经把它的手绘签收敛掉，别回退到 `radius:5px`；(c) 「线上商店用 iframe、本地条目用官方槽位」的两层切分，正是我们二期三场景该走的分法。
