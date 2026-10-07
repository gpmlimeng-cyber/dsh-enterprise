/**
 * [INPUT]: 无（纯 CSS 字符串 + 一个组件）
 * [OUTPUT]: 对外提供 `EnterpriseEscStyle`（把 esc 页面全部样式注入一次的内联 `<style>` 组件）
 * [POS]: esc 页面的**样式层**——从 NUWAX 那五个 LESS module 逐条搬过来（`index.less` + `CategorySidebar` +
 *   `ResourceToolbar` + `ResourceAggregation` + `ResourceCard` + `CardWrapper` 的容器样式）。
 *   ★两处按 DSH 体系改写：
 *   ① 颜色：原文件的 `@GRAY09`/`@BLANK04`/`#828894`/`#e4e6eb`/`#5147ff` 等私有变量 → 本仓在用的 `--dsw-*` token
 *      （`label-primary`/`-secondary`/`-tertiary`、`background-primary`/`-secondary`、`interactive-bg-hover`、
 *      `stroke-border-2`、`border-l1`/`l2`、`accent-primary`、`state-success-primary`、`radius-md`/`lg`、`shadow-lv2`）；
 *   ② 形态：LESS 的嵌套与 module 作用域 → 扁平 CSS + `esc-` 前缀单层命名空间；原页面依赖的 NUWAX 全局工具类
 *      （`flex`/`items-center`/`text-ellipsis`/`scroll-container-hide`…）在本作用域内补齐用到的那几个，
 *      不去污染全局。
 *   ★**新增**三类原页面没有的样式：加载/空/失败三态行、筛选行的降级提示、置灰动作按钮的说明。
 *   ★**用户裁决的版式改动**（都与原文不同，逐条写在对应规则上方，便于日后回溯）：
 *   ① 左栏整块撤掉 → 三个菜单改到内容页左上角作药丸页签（`.esc-resource-tabs`，`.esc-root` 随之从横排改竖排）；
 *   ② 药丸不要描边（官方 `Pill` 选中态自带 1px inset 环，`.esc-root .esc-pill` 压掉）；
 *   ③ 卡片紧凑（两轮）：栅格 300→220px、间距 16→10px、卡片高 170→118px（无统计行 130→96）、
 *      内衬 16→10px、卡内间距 16→6px、图标 48→36px、标题 16→14px、页脚 24→18px；
 *   ④ 卡片要**看得见的边框**：原值的 `.5px` 发丝线（`stroke-border-2`）→ `1px`（`border-l2`），
 *      hover 只换描边颜色（不换宽度，故没有 1px 的布局抖动）；
 *   ⑤ **移动端**：药丸标签**永不压缩/不折行**（`.esc-source-tabs { flex: none }` + `.esc-pill { white-space: nowrap }`），
 *      搜索框改为**自适应宽度**（窄屏先缩到 120px，再整行换行占满；`@media (max-width: 560px)` 直接整行占满）。
 *   ⑥ **一比一还原官方**（**撤回**③那一档的紧凑几何与"底部不留白 / 收藏上移"两轮裁决；
 *      ④的 1px 可见边框与⑤的移动端自适应**保留**——那两条用户明确要过）：
 *      卡片 170/130px、内衬 16px、卡内与头行间距 16/12px、图标 48px、标题 16px/20px、描述 16px×2 行、
 *      页脚 24px、统计间距 16px、栅格 300px/16px；收藏回右下角绝对定位（right 16/bottom 12、
 *      命中区 32px）；动作位回右上角绝对定位（top 12/right 16）+ hover 浮现（按钮由外层 `<span>` 承载，
 *      因为 dsh 的 `Button` 自带 `:disabled { opacity: .4 }` 会压过单类，官方那枚 `.hover-reveal-btn` 挂不上）。
 *   ⑦ **原子级对齐官方**（用户原话「原子对比官方的差异，根据差异优化」；逐条与官方源码对过一遍，见
 *      `docs/notes/direction-decisions.md` 第 35 条的差异表）：
 *      ① **box-sizing**——官方跑在 antd/umi 的 `* { box-sizing: border-box }` 全局重置下，dsh 壳**没有**这条
 *         （官方那几枚原语也各自显式写着 `box-sizing: border-box`，正是"壳里没有"的旁证）⇒ 本页原先按
 *         **content-box** 渲染：卡片实高 204/164 而非 170/130（实测 449/559px ÷ 2.74 = 163.6/203.6），
 *         紧凑卡片内容 48+32+24+32=136 超出内容盒 130 ⇒ **把描述挤掉半行**（实测缺口 9px ≈ 3.3px×2.74）。
 *         故在 esc 子树内补上同一条重置（作用域内、不外溢）。
 *      ② 逐值补齐官方：内容区内衬 10/16 → **16/24**、工具栏下边距 10 → **16**、分类行上边距 8 → **14**、
 *         头像 14 → **16**（官方 `AuthorInfo .avatar`）、作者名 height/line-height **16**、`min-width: 30px`、
 *         描述补上官方 `text-ellipsis-2` 那三条（`text-overflow: ellipsis` / `word-break: break-all` /
 *         `white-space: normal`）、卡片 **hover 补上官方那层抬升阴影**（`.esc-card:hover` 原只换描边色）。
 *      ③ **紧凑卡片不再渲染页脚**——官方 `{showStats && <footer/>}`：页脚元素只在专家卡片上存在。这是
 *         描述被挤掉的另一半原因（多出 24px 页脚 + 16px 间隙）。卡片几何里同时给三行都钉上 `flex: none`，
 *         从此**任何**超出都不会再压扁描述（改版前它正是被 flex-shrink 压扁的）。
 *      ④ 加载态换成官方那枚 `<Loading/>`（转圈 + 「加载中...」）——原先是本页自造的六张骨架卡。
 *      ⑤ **修掉三条在 dsh 主题里根本不存在的 token**（`dsh-client-ui-theme` 的 403 枚 token 里查无此名）：
 *         `--dsw-alias-accent-primary` → `--dsw-alias-brand-primary`（hover 描边）；`--dsw-alias-background-primary`
 *         → `--dsw-alias-bg-layer-1`（卡片底色）；`--dsw-alias-background-secondary` → `--dsw-alias-bg-skeleton`（图标兜底底）。
 *         失效 token 会让声明"计算期无效"：hover 边框回退成 `currentColor`（用户截图里那张**黑边卡片**就是
 *         这一条，不是设计），卡片底色/图标底色则回退成透明。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, type ReactNode } from 'react'

const CSS = `
/* ★口径 35①：官方页面跑在 antd/umi 的全局 * { box-sizing: border-box } 下（官方那几枚原语也各自显式写着
   border-box，正是"壳里没有这条"的旁证），而 dsh 壳**没有**这条重置。本页所有几何都是照官方 border-box 口径
   抄的（卡片 170/130 = 内容 136/96 + 内衬 32 + 描边 2）⇒ 少了它整块长胖 34px，紧凑卡片还会因内容超出而
   把描述挤掉半行。故在 esc 子树内补上同一条（作用域内，不外溢到壳）。 */
.esc-root, .esc-root *, .esc-root *::before, .esc-root *::after { box-sizing: border-box; }
.esc-root { min-height: 0; background: var(--dsw-alias-bg-base); display: flex; flex-direction: column; height: 100%; }
/* 内容区内衬照官方 index.less:12 的 .content-wrapper { padding: 16px 24px }（原为 10px 16px，是"紧凑"那一刀
   遗留的缩水值，官方从来不是这个数）。 */
.esc-content { flex: 1; min-width: 0; min-height: 0; padding: 16px 24px; display: flex; flex-direction: column; overflow: hidden; }

/* —— 资源类型页签（原左栏 CategorySidebar 的三项，用户裁决改到内容页左上角作药丸）—— */
.esc-resource-tabs { flex-shrink: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 16px 0; }
.esc-resource-tab { height: 26px; padding: 0 10px; }

/* 用户裁决：药丸不要描边——官方 Pill 的选中态自带 1px inset 环（box-shadow），这里逐条压掉。
   ★两条选择器（0,2,0）压得过官方那条单类（0,1,0），故不需要 !important，也不靠加载顺序。
   用户裁决（移动端）：药丸里的字**不许折行**——原来窄屏会把「系统广场」压成两行。 */
.esc-root .esc-pill { box-shadow: none; }
.esc-pill { white-space: nowrap; }

/* —— 工具栏（原 ResourceToolbar/index.less）——
   ★用户裁决（移动端）：左侧药丸组不参与压缩（flex: none），压缩预算全给搜索框。
   ★口径 38 用户裁决（真机截图：「4 不在一行」）：主行**不换行**——窄屏下 药丸组 + 右块 的
     flex 基准宽度之和会超过容器（药丸 ~140 + 更多 24 + 搜索框基准 ~240 ≈ 404 > 手机上 ~393），
     flex-wrap: wrap 于是把右块整块顶到第二行、搜索框与主 tab 分了行。改成 nowrap：搜索框自己
     缩到下限（120px / 窄屏 96px）留在同一行，药丸组仍 flex: none 不被压。 */
/* 官方 ResourceToolbar/index.less:6 是 margin-bottom: 16px（原 10px 同样是"紧凑"那一刀遗留）。 */
.esc-toolbar { flex-shrink: 0; margin-bottom: 16px; }
.esc-toolbar-main { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: nowrap; }
.esc-source-tabs { display: flex; align-items: center; gap: 8px; flex: none; flex-wrap: nowrap; }
.esc-toolbar-right { display: flex; align-items: center; gap: 12px; flex: 1 1 auto; min-width: 0; justify-content: flex-end; }
/* ★口径 37 用户裁决：「搜索栏动态自适应宽度，和系统广场和空间放一行」。
   原先是固定宽（214px，官方那格的值）+ 右块 flex: 0 1 auto ⇒ 一点都不"自适应"；窄屏那一档又把右块
   整行占满（flex: 1 1 100%）⇒ 必然换行、与主 tab 分成两行。现在：右块、搜索框**都参与伸缩**
   （flex: 1 1 auto），搜索框吃掉主 tab 与右边之间的**全部剩余宽度**并留在同一行（口径 38 再把
   主行的 flex-wrap 关掉，min-width: 0 让它在基准宽度不够时能真的缩下去）；
   药丸组仍是 flex: none（标签永不被压缩），搜索框自己也留一个下限（窄屏档再收到 96px）。
   注意 .esc-search 落在官方 Input 的**外层 span** 上（铺 icon + input 两格，原语是 inline-flex、
   基准宽 ≈ 输入框默认 20 字符 ≈ 240px），它内部的 .input 本来就是 flex: 1 / min-width: 0
   ⇒ 宽度跟着外层走。 */
.esc-search { width: auto; flex: 1 1 auto; min-width: 120px; max-width: none; }
/* 「更多」现在是一枚**真超链接**（用户裁决指向 https://skillhub.cn/）⇒ 补 text-decoration: none 保持原观感；
   原来那条 .esc-more:disabled 随"置灰"写法一起撤掉（它不再是按钮）。 */
.esc-more { flex-shrink: 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; background: none; border: 0; padding: 0; font-family: inherit; cursor: pointer; text-decoration: none; }
/* ★口径 35⑤：accent-primary 这个名字 **在 dsh 主题里不存在**（403 枚 token 里查无此名，带上 --dsw-alias-
   前缀写出来就是计算期无效）⇒ 这条 hover 色一直没生效，官方那枚是 @colorPrimary。改用真名 brand-primary。 */
.esc-more:hover { color: var(--dsw-alias-brand-primary); }
.esc-more-hidden { visibility: hidden; pointer-events: none; }
/* 官方 ResourceToolbar/index.less:41 是 margin-top: 14px（原 8px）。 */
.esc-category-tabs { display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
/* ★口径 35：官方那一行的 .category-tab/.category-tab-active 两条**已删**——本页的分类页签用的是官方
   Pill 原语（视觉由原语自带），这两条从来没被任何元素挂上；其中 -active 那格还挂着同一枚失效 token
   （background-secondary）。容器 .esc-category-tabs 仍照官方 :41 的 margin-top: 14px。 */
.esc-toolbar-note { margin-top: 6px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }

/* —— 列表区（原 ResourceAggregation/index.less）——
   ★口径 34/35：栅格回官方值（最小列宽 300px、间距 16px；"紧凑档"的 220/10 已撤回）。 */
.esc-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.esc-scroll-hidden::-webkit-scrollbar { display: none; }
.esc-list-section { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding-bottom: 16px; align-content: start; }

/* —— 卡片（原 CardWrapper/index.less + ResourceCard/index.less）——
   ★★用户裁决「参考官方的，除了侧边栏其他参考官方一比一还原布局和元素，使用 dsh 的 ui 体系」（最新一刀，
   **撤回**此前"紧凑些 / 底部不留白 / 收藏上移"三轮的尺寸改动）：几何**逐值回到官方**——
   卡片高 170px（无统计行 130px）、内衬 16px、卡内间距 16px、头行间距 12px、图标 48px（圆角 8）、
   标题 16px/20px、描述 16px 行高 + 32px 两行、页脚 24px、统计项间距 16px、额外信息行 120px/12px、
   栅格列宽 300px、卡间距 16px、骨架高 170px；收藏 .esc-corner-box 回到**右下角绝对定位**
   （right 16 / bottom 12，命中区 32px）；动作位 .esc-action-box 回到**右上角绝对定位**（top 12 / right 16）。
   本页只保留两处**用户明确要过**的差异：① 左栏（官方是侧边栏 ⇒ 用户裁决改成本页顶部药丸）；
   ② 边框 1px 可见（官方 .5px 发丝线 ⇒ 用户先前明确要"看得见的边框"）。 */
.esc-card { position: relative; display: flex; flex-direction: column; gap: 16px; padding: 16px; border-radius: var(--dsw-radius-lg, 12px); border: 1px solid var(--dsw-alias-border-l2); background-color: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-shadow-lv2); transition: all .3s ease-in-out; cursor: pointer; height: 170px; }
/* ★口径 35②/⑤：官方 hover 是【换描边色 + 抬升一层阴影】（CardWrapper/index.less:17-22 那三行 shadow）。
   原实现只换描边色，且那个色名（accent-primary 那名）在 dsh 主题里不存在 ⇒ hover 时边框回退成
   currentColor（截图里的"黑边卡片"）。这里改成真 token + 补上抬升阴影（用 dsh 的 lv3 表达官方那一层）。 */
.esc-card:hover { border-color: var(--dsw-alias-brand-primary); box-shadow: var(--dsw-shadow-lv3); }
.esc-card-compact { height: 130px; }
/* 三行都 flex: none：官方紧凑卡片的 96px 内容盒恰好容纳「头 48 + 间隙 16 + 描述 32」，本页一旦因任何原因
   超出（例如宿主的长字号设置/文本放大），被压扁的必然是描述 ⇒ 那正是"第二行被切掉半截"的形态。钉死它。 */
.esc-card-header { display: flex; gap: 12px; flex: none; }
.esc-card-image { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: var(--dsw-alias-bg-skeleton); }
.esc-card-image-circle { border-radius: 50%; }
.esc-card-headmain { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
.esc-card-title { margin: 0; color: var(--dsw-alias-label-primary); font-size: 16px; font-weight: 600; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.esc-card-author-row { display: flex; align-items: center; gap: 12px; }
/* 官方 AuthorInfo/index.less：容器 min-width: 30px; gap: 4px; flex: 0 1 auto，
   头像 **16×16**（原实现写的是 14×14，比官方小一圈），名字 height: 16px; line-height: 16px。 */
.esc-author { display: flex; align-items: center; gap: 4px; overflow: hidden; min-width: 30px; flex: 0 1 auto; }
.esc-author-avatar { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
.esc-author-name { font-size: 12px; height: 16px; line-height: 16px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.esc-extra-box { min-width: 120px; flex: 1 1 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--dsw-alias-label-tertiary); font-size: 12px; overflow: hidden; }
/* 描述：官方那一格是 EllipsisTooltip 渲染的 <div class="text-ellipsis-2 {module}.content">——
   text-ellipsis-2（styles/custom.less:11-23）给 display:-webkit-box / -webkit-line-clamp:2 /
   -webkit-box-orient:vertical / overflow:hidden / **text-overflow:ellipsis / word-break:break-all /
   white-space:normal**，.content（CardWrapper/index.less:61-67）给 line-height:16px; height:32px;
   color:font-tertiary; font-size:12px; font-weight:strong。本页原先漏了 text-ellipsis-2 里那三条，
   现补齐；再加 flex: none（见上，描述不许被压扁）。 */
.esc-card-content { line-height: 16px; height: 32px; color: var(--dsw-alias-label-tertiary); font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-all; white-space: normal; flex: none; }
/* 页脚：官方只有【有统计行】的专家卡片才渲染这个元素（{showStats && <footer/>}，height: 24px）——
   技能/连接器卡片没有它（否则多出 24px + 16px 间隙，正是把描述挤出内容盒的那 40px）。渲染与否由卡片的
   showStats 决定（见 esc-card.tsx），这里只保证它的几何。 */
.esc-card-footer { height: 24px; display: flex; align-items: center; flex: none; }
.esc-count-box { display: flex; align-items: center; gap: 16px; flex: 1; }
.esc-count-text { display: flex; align-items: center; font-size: 12px; color: var(--dsw-alias-label-tertiary); gap: 4px; }
.esc-action-box { position: absolute; top: 12px; right: 16px; display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity .3s ease-in-out; z-index: -1; }
.esc-card:hover .esc-action-box { opacity: 1; z-index: 1; }
.esc-action-box-pinned { opacity: 1; z-index: 1; }
/* ★用户裁决：「卡片选中显示的操作按钮的灰色，换成全黑按钮」——
   那层灰不是我们画的：原语 .primary 本来就是**实底**（background: var(--dsw-alias-button-primary-fill)，
   而 button-primary-fill = brand-primary，浅色主题里就是近黑 #0f1115、深色主题里反相成近白，
   文字 label-primary-foreground 正好反过来 = #fff/#0f1115），是原语那条
   .button:disabled { opacity: .4 } 把它冲淡成了灰。
   A 档动作**仍然 disabled**（点了不会有动作：title 里写着原因，页首也挂着"动作尚未在 DSH 侧接入"），
   这里只把那口冲淡按回去、让它露出主题自己的实底 —— 不写死黑/白，跟着主题走。
   选择器取 (0,3,0)，压过原语的 .button:disabled (0,2,0)。 */
.esc-root .esc-action-solid:disabled { opacity: 1; }
/* hover 浮现：官方那枚 .hover-reveal-btn 挂在 antd 的 Button 上（antd 的 disabled 不设 opacity），
   而 dsh 的 Button 自带 :disabled { opacity: .4 }（0,2,0）会压过单类（0,1,0）⇒ 本页改由**外层
   <span>** 承载这一幕（span 上没有竞争规则，稳），语义与官方一致：容器常驻、按钮单独浮现。 */
.esc-hover-reveal { opacity: 0; pointer-events: none; transition: opacity .3s ease-in-out; }
.esc-card:hover .esc-hover-reveal { opacity: 1; pointer-events: auto; }
/* 收藏：回到官方口径（右下角绝对定位 right 16 / bottom 12，命中区 32px）。
   官方 .corner-box 没有 gap（付费 Tag 自己带 marginRight: 0）⇒ 本页也去掉那枚 4px。 */
.esc-corner-box { position: absolute; right: 16px; bottom: 12px; display: flex; align-items: center; }
.esc-star-box { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; cursor: pointer; background: none; border: 0; padding: 0; }
.esc-connect-info { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.esc-connect-category { color: var(--dsw-alias-label-tertiary); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.esc-connect-status { display: flex; align-items: center; flex-shrink: 0; gap: 4px; font-size: 12px; white-space: nowrap; }
.esc-status-dot { width: 6px; height: 6px; border-radius: 50%; background-color: currentcolor; }
.esc-status-connected { color: var(--dsw-alias-state-success-primary); }
.esc-status-disconnected { color: var(--dsw-alias-label-tertiary); }

/* —— 三态与提示（本页新增：原页面读不到数据时是"静默空态"）—— */
.esc-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--dsw-alias-label-tertiary); font-size: 13px; text-align: center; padding: 20px; }
.esc-state-title { color: var(--dsw-alias-label-secondary); font-size: 14px; }
.esc-state-error { color: var(--dsw-alias-state-error-primary); }
.esc-state-code { font-size: 12px; color: var(--dsw-alias-label-tertiary); word-break: break-all; }
/* 空态插图（官方是 antd <Empty> 的默认插图；dsh 无 Empty 原语 ⇒ 用 token 画一张等价物，见 esc-aggregation.tsx）。 */
.esc-empty-art { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--dsw-radius-lg, 12px); background: var(--dsw-alias-bg-skeleton); color: var(--dsw-alias-label-tertiary); }

/* —— 首屏加载（官方那一态画的是 components/custom/Loading：居中的一枚转圈图标 + 「加载中...」，
   色走主色、字号 12、间距 8px）——原先是本页自造的六张骨架卡，口径 35 按官方换成这一枚。 */
.esc-loading { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--dsw-alias-brand-primary); font-size: 12px; }
.esc-loading-icon { animation: esc-spin 1s linear infinite; }
@keyframes esc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .esc-loading-icon { animation: none; } }

/* —— 未登录门（未登录那态：原页面不存在，因为那时它总在平台内）—— */
.esc-gate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px; text-align: center; }
.esc-gate-title { font-size: 15px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.esc-gate-body { font-size: 13px; color: var(--dsw-alias-label-secondary); max-width: 420px; line-height: 20px; }

/* —— 窄屏 ——
   ★口径 37：这一档原本是「药丸组保持自然宽度，搜索框整行占满（flex: 1 1 100%）」，那必然换行、把搜索框
   赶到第二行；用户裁决要它**和主 tab 同一行**且宽度自适应 ⇒ 那条整行占满已撤。自适应交给上面的默认值。
   ★口径 38：主行已 nowrap ⇒ 这一档只负责把搜索框的**下限**从 120px 收到 96px（缩得下去但不塌成一条缝）。
   下限以下宁可让搜索框轻微溢出，也不许回到"换行"那一态。 */
@media (max-width: 560px) {
  .esc-search { min-width: 96px; }
}
`

/**
 * 把 esc 页面样式注入一次。
 *
 * 内联 `<style>` 是本包既有的样式手法（官方原语只给结构，视觉由消费方自持），故这里与
 * `login-page.tsx`/`library-panel.tsx` 同一路子：一个纯字符串 + 一个只渲染 `<style>` 的组件。
 */
export function EnterpriseEscStyle(): ReactNode {
  return createElement('style', { 'data-dshent-esc': 'true' }, CSS)
}
