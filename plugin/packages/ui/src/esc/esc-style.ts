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
/* ★本刀（用户裁决①②⑤，三行标签同一套语言）：**不要底色**——那层胶囊底是官方 Pill 的
   自带底 + 我们之前压描边时留下的观感；workbuddy 那三行标签都是**纯文字**。
   字号/字重各加一档（官方 Pill 的 13px/400 ⇒ 这里 15px/600），非选中走三级文字色、
   选中走主文字色。.esc-root .esc-pill 那条把原语底色一起压掉（见下方）。 */
/* ★用户裁决④：页签行现在**排进工具栏那一行**（与右块同排），故不再自带一整行的高度与内衬——
   否则「三页签」与「搜索/已安装/添加」之间会多出一条空白带。左右内衬交给 .esc-content 那 24px。 */
/* ★用户裁决：三页签改**凹槽型**（SPEC §3.7 那种「整条容器有底槽、选中项凸起白块」的形态）。
   容器：底色 + 一圈更淡的描边 + 圆角 6px + 内衬 2px；项与项之间 gap 2px（凹槽是一体的，
   项之间要留缝就散了形）。容器 gap **20px**；字号/字重沿革与当前值见下方 ★（当前 **18px / 600**）。 */
.esc-resource-tabs { flex: none; display: inline-flex; align-items: center; gap: 20px; flex-wrap: nowrap; }
/* 字号沿革（逐条用户裁决，每次都只改"字号"这一档）：官方 Pill 原值 13px/400 → 15px（① 三行标签
   统一那一刀）→ 17px（⑦"三页签再大一号"）→ **20px**（真图对齐那一刀）→ **18px**（本刀，用户原话
   「专家技能连接器和系统广场，工作空间小一号」）。
   ★本刀**只收字号**：height 32 / font-weight 600 / line-height 1 / 图标 gap 6 / 容器 gap 20 一个都不动；
   并且本行与维度行（「.esc-source-tabs .esc-pill」）**必须继续逐值相等**——它们是同一套视觉语言
   （判据：两处 font-size/weight/line-height 提取后直接比对，见 spec）。 */
.esc-resource-tab { height: 32px; padding: 0; display: inline-flex; align-items: center; gap: 6px; background: none !important; box-shadow: none !important; border: 0; border-radius: 0; font-size: 18px; font-weight: 600; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s; }
/* ★用户裁决（本轮）：「非选中的页签颜色深一点」。
   ★先把上一版注释里那句**假话**改掉：它写着「label-dimmed 是主题里最接近 50% 黑的一枚」——不是。
     主题浅色阶梯的真值（dsh-client-ui-theme 真源）：dimmed #e1e5ee（≈12% 黑，几乎是白）
     → secondary #cfd3d6 → tertiary #adb2b8 → 要真 50% 黑得用静态 --dsw-static-neutral-bluish-600 #81858c。
     上一版取了最浅的那一枚，所以真机上「专家/连接器」淡到几乎看不见（截图即证据）。
   本档取 **label-tertiary**：浅色主题下深一档（#e1e5ee → #adb2b8）；深色主题下**更亮**
   （dimmed #43454a → tertiary #81858c）⇒ 两套主题里的方向都是「对比更强」，深色主题不会反向变糊。 */
.esc-resource-tab:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }
.esc-resource-tab:hover { color: var(--dsw-alias-label-primary); }
/* 图标继承 currentColor（原 SVG 就是这个设计）⇒ 选中/非选中的灰黑自动跟随文字。 */
.esc-tab-icon { flex-shrink: 0; fill: currentColor; }
/* 选中态：官方 Pill 用 aria/active 两条属性表达，这里两条都盖（不靠 class，避免原语换实现就失效）。 */
/* 同上：选中变黑靠我们自己的标记（官方 active 是它那份哈希类名，外部选不中）。 */
/* ★选中：**纯黑字 + 一枚白块**（凹槽里"凸起"的那一格）。白块走 bg-layer-1（= neutral-bluish-00）。 */
.esc-resource-tab[data-esc-selected='true'] { background: none !important; box-shadow: none !important; color: var(--dsw-alias-label-primary); }

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
/* ★用户裁决④：工具栏紧跟在页签行下面，故上边距收成 0（原 16px 是给「工具栏自己就是第一行」时的间距），
   那一档的分隔由分类行自己的 margin-top 承担。 */
.esc-toolbar { flex-shrink: 0; margin-bottom: 16px; }
.esc-toolbar-main { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: nowrap; }
/* ★第一栏：三页签在左、右块在右（用户裁决「精选应在第2栏」顺带定的行序）。 */
.esc-toolbar-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: nowrap; }
/* 第二栏：「精选」那一行 —— 撑满整宽，卡片网格自己铺。 */
.esc-toolbar-second { flex-shrink: 0; width: 100%; }
/* 主行左侧插槽：三页签与右块真同处这一行（用户裁决④） */
.esc-toolbar-leading { flex: none; display: flex; align-items: center; }
/* ★本刀（用户裁决⑤）：维度标签（系统广场/团队空间/我启用的）与顶栏三页签同一套：无底色、
   同一字号（**本刀起 18px**，与「.esc-resource-tab」逐值相等）、字重 600，非选中灰、选中黑。
   不参与压缩（flex: none）——标签永不被压。
   ★本刀（用户原话「专家技能连接器和系统广场，工作空间小一号」）**同收一档的就是这一行**：20px → 18px，
   其余（height 30 / weight 600 / line-height 1 / 容器 gap 20）一个不动。 */
/* ★用户裁决：维度标签（系统广场/团队空间/我启用的）也走**凹槽型**——与三页签同一形态。
   容器：底色 + 淡描边 + 圆角 6px + 内衬 2px；项在槽内，选中项凸起白块。 */
.esc-source-tabs { display: flex; align-items: center; gap: 20px; margin-top: 14px; flex: none; flex-wrap: nowrap; }
.esc-source-tabs .esc-pill { height: 30px; padding: 0; display: inline-flex; align-items: center; background: none !important; box-shadow: none !important; border: 0; border-radius: 0; font-size: 18px; font-weight: 600; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s; }
.esc-source-tabs .esc-pill:hover { color: var(--dsw-alias-label-primary); }
/* ★用户裁决（本轮）：维度标签的「未选中」与三页签**同步深一档**（同一套视觉语言，不许一行深一行浅） */
.esc-source-tabs .esc-pill:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }
/* ★用户裁决⑤：**选中变黑**。判据是 data-esc-selected（我们自己的标记）而不是 .active——
   官方 Pill 把 active 渲染成它那份 CSS Modules 哈希类名，外部样式表选不中（实测）。 */
.esc-source-tabs .esc-pill[data-esc-selected='true'] { background: none !important; box-shadow: none !important; color: var(--dsw-alias-label-primary); }
/* ★本刀（用户裁决②③）：右块**不再吃满剩余宽度**（此前 flex: 1 1 auto 让搜索框把整行撑满，
   与 workbuddy 那张里「约 200px 的小搜索框 + 右对齐」差得最远）。改为 flex: none + 右对齐：
   主 tab 在左、右块整体靠右，两者同一行（主行已是 nowrap，窄屏时靠搜索框自己的 min-width 兜底）。 */
.esc-toolbar-right { display: flex; align-items: center; gap: 12px; flex: none; margin-left: auto; }
/* ★口径 37 用户裁决：「搜索栏动态自适应宽度，和系统广场和空间放一行」。
   原先是固定宽（214px，官方那格的值）+ 右块 flex: 0 1 auto ⇒ 一点都不"自适应"；窄屏那一档又把右块
   整行占满（flex: 1 1 100%）⇒ 必然换行、与主 tab 分成两行。现在：右块、搜索框**都参与伸缩**
   （flex: 1 1 auto），搜索框吃掉主 tab 与右边之间的**全部剩余宽度**并留在同一行（口径 38 再把
   主行的 flex-wrap 关掉，min-width: 0 让它在基准宽度不够时能真的缩下去）；
   药丸组仍是 flex: none（标签永不被压缩），搜索框自己也留一个下限（窄屏档再收到 96px）。
   注意 .esc-search 落在官方 Input 的**外层 span** 上（铺 icon + input 两格，原语是 inline-flex、
   基准宽 ≈ 输入框默认 20 字符 ≈ 240px），它内部的 .input 本来就是 flex: 1 / min-width: 0
   ⇒ 宽度跟着外层走。 */
/* ★本刀（用户裁决②）：**定宽**——此前是 flex: 1 1 auto 自适应吃满剩余宽度。真机截图里那枚搜索框
   几乎占满整行，与 workbuddy（约 200px、右对齐）完全不是一回事。现在定在 200px，
   窄屏那一档（下面 @media）再收到 160px；**不再伸缩**，避免又把右块撑开。 */
.esc-search { width: 220px; height: 32px; flex: none; min-width: 0; max-width: none; border-radius: 6px; }
/* 「更多」现在是一枚**真超链接**（用户裁决指向 https://skillhub.cn/）⇒ 补 text-decoration: none 保持原观感；
   原来那条 .esc-more:disabled 随"置灰"写法一起撤掉（它不再是按钮）。 */
.esc-more { flex-shrink: 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; background: none; border: 0; padding: 0; font-family: inherit; cursor: pointer; text-decoration: none; }
/* ★口径 35⑤：accent-primary 这个名字 **在 dsh 主题里不存在**（403 枚 token 里查无此名，带上 --dsw-alias-
   前缀写出来就是计算期无效）⇒ 这条 hover 色一直没生效，官方那枚是 @colorPrimary。改用真名 brand-primary。 */
.esc-more:hover { color: var(--dsw-alias-brand-primary); }
.esc-more-hidden { visibility: hidden; pointer-events: none; }
/* 官方 ResourceToolbar/index.less:41 是 margin-top: 14px（原 8px）。 */
/* ★本刀（用户裁决⑤）：维度标签这一行与顶栏三页签**同一套视觉语言**（无底色、字号字重各加一档、
   非选中灰 / 选中黑）；.esc-source-tabs 里的每一枚都挂这条。 */
/* ★用户裁决：二级分类同样走**凹槽型**（与前两行同一形态）。 */
/* ★本刀（用户原话「全部那行分类标签之间间距紧凑些」）：容器 gap 20px → **8px**。
   选 8px 不是随手取小：药丸自己的横向内衬就是 padding 0 8px（本文件 CSS 注释的惯例是不写反引号，
   注释里不出现反引号——本段整体在一枚模板字符串内），而选中项带一层灰色底
   （interactive-bg-hover）——间距收到与内衬同宽，一排药丸才**读成一条**（选中底色相邻 8px 就是组内
   呼吸），20px 时每枚各自漂着，这也是"松"的来处。一级（全部/Agent/…）与二级分类同挂这条规则，
   故一档改完两级同时生效；行高/字重/内衬/选中灰底与滚动行为（overflow-x: auto）都不动。 */
.esc-category-tabs { display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: nowrap; overflow-x: auto; }
/* ★本刀（用户裁决⑥）：二级分类用**小圆角**——workbuddy 那排分类是近乎方角的短标签。 */
/* ★用户裁决（本轮，真机）：「一级二级分类标签再小一号」——一级（全部/Agent/经营管理…）与二级
   （选中一级后展开的子分类）**同挂这一类**（渲染点只有 esc-toolbar.tsx 一处），故一档改完两级同时生效：
   字号 14px → **13px**（字重/行高/间距/选中灰底都不动，只收字号这一档）。 */
.esc-category-tabs .esc-pill { height: 28px; padding: 0 8px; display: inline-flex; align-items: center; background: none; box-shadow: none; border: 0; border-radius: 6px; font-size: 13px; font-weight: 500; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s, background .15s; }
.esc-category-tabs .esc-pill:hover { color: var(--dsw-alias-label-primary); }
/* ★用户裁决（本轮）：二级分类的「未选中」与上面两行**同步深一档**（三行一体） */
.esc-category-tabs .esc-pill:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }
/* ★用户裁决③：**选中要有标签背景**（同一枚中性 hover 面，非选中无底色）。判据同上，走 data-esc-selected。 */
/* ★用户裁决③：选中是**灰色背景**（不是黑字块、也不是凹槽白块）。
   底色走 interactive-bg-hover（约 6% 黑）——本主题的 bg-layer-1/2/3 三者同值，不能拿它们做灰底。 */
.esc-category-tabs .esc-pill[data-esc-selected='true'] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); font-weight: 600; }
/* ★口径 35：官方那一行的 .category-tab/.category-tab-active 两条**已删**——本页的分类页签用的是官方
   Pill 原语（视觉由原语自带），这两条从来没被任何元素挂上；其中 -active 那格还挂着同一枚失效 token
   （background-secondary）。容器 .esc-category-tabs 仍照官方 :41 的 margin-top: 14px。 */
.esc-toolbar-note { margin-top: 6px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }

/* —— 列表区（原 ResourceAggregation/index.less）——
   ★口径 34/35：栅格回官方值（最小列宽 300px、间距 16px；"紧凑档"的 220/10 已撤回）。 */
.esc-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.esc-scroll-hidden::-webkit-scrollbar { display: none; }

/* ══════════════ 本刀（对标 workbuddy UI-SPEC v5.7.6 的真实数值）══════════════
 * ★**用户裁决（最终）：完全按 SPEC 的原始数值**，不为宽屏做任何折中——
 *   卡片 min-height:84px、网格 minmax(262px,1fr) + gap 12px、圆角 16、内衬 16px 20px、
 *   图标 28 正圆、标题 14.5px/650、描述 12px 两行截断 min-height 38px、
 *   统计行 11px/gap 10px/图标 opacity .7、云端按钮 22px、过渡 .2s、
 *   搜索框 220px/h32/radius6、Tab 药丸 13px/500+容器 gap 4px、主按钮近黑、技能卡有阴影专家卡无。
 *   （我此前自作主张按宽屏折中到 120/280/14，用户裁决撤掉了那个折中。）
 * ★★**一个实测坑，必须记下来**（否则下一个人会重踩）：
 *   本主题里 bg-layer-1 / bg-layer-2 / bg-layer-3 **三者逐字同值**
 *   （都是 --dsw-static-neutral-bluish-00）⇒ 拿它们做 hover 底色 = **和静止态一模一样，
 *   hover 等于没生效**。上一刀正踩了这个坑（用户反馈"hover 有点卡顿"，其实是压根没变色）。
 *   唯一能与卡片底色拉开对比的是 interactive-bg-hover（#2631480f，约 6% 黑），
 *   故 hover 底色一律用它。
 */

.esc-list-section { display: grid; grid-template-columns: repeat(auto-fill, minmax(262px, 1fr)); gap: 12px; padding-bottom: 16px; align-content: start; }

/* —— 卡片（原 CardWrapper/index.less + ResourceCard/index.less）——
   ★★用户裁决「参考官方的，除了侧边栏其他参考官方一比一还原布局和元素，使用 dsh 的 ui 体系」（最新一刀，
   **撤回**此前"紧凑些 / 底部不留白 / 收藏上移"三轮的尺寸改动）：几何**逐值回到官方**——
   卡片高 170px（无统计行 130px）、内衬 16px、卡内间距 16px、头行间距 12px、图标 48px（圆角 8）、
   标题 16px/20px、描述 16px 行高 + 32px 两行、页脚 24px、统计项间距 16px、额外信息行 120px/12px、
   栅格列宽 300px、卡间距 16px、骨架高 170px；收藏 .esc-corner-box 回到**右下角绝对定位**
   （right 16 / bottom 12，命中区 32px）；动作位 .esc-action-box 回到**右上角绝对定位**（top 12 / right 16）。
   本页只保留两处**用户明确要过**的差异：① 左栏（官方是侧边栏 ⇒ 用户裁决改成本页顶部药丸）；
   ② 边框 1px 可见（官方 .5px 发丝线 ⇒ 用户先前明确要"看得见的边框"）。 */
/* ★用户裁决⑧：边框**浅一点**——由 border-l2 调到 border-l1（主题里 l1 比 l2 更淡一档）。 */
.esc-card { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; border-radius: 16px; border: 1px solid var(--dsw-alias-border-l1); background-color: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-shadow-lv2); transition: background .2s ease-out, box-shadow .2s ease-out, border-color .2s ease-out; cursor: pointer; min-height: 84px; }
/* ★口径 35②/⑤：官方 hover 是【换描边色 + 抬升一层阴影】（CardWrapper/index.less:17-22 那三行 shadow）。
   原实现只换描边色，且那个色名（accent-primary 那名）在 dsh 主题里不存在 ⇒ hover 时边框回退成
   currentColor（截图里的"黑边卡片"）。这里改成真 token + 补上抬升阴影（用 dsh 的 lv3 表达官方那一层）。 */
/* ★本刀（用户裁决⑨）：hover 改成**背景变浅灰、边框不变**（此前是「换主色描边 + 抬升阴影」，
   真机截图里那条主色描边过于抢眼）。底色取主题里那枚中性 hover 面（interactive-bg-hover），
   边框**一字不动**（保持 border-l2），也不加阴影——只让底色动。 */
/* ★用户裁决⑧：**灰更浅**（bg-layer-2 —— 主题里比 interactive-bg-hover 淡一档）、
   边框**一字不动**（仍是 l1，与静止态同色 ⇒ 视觉上只有底色在动）；
   ★**流畅一点**：.esc-card 那条 transition: all .3s ease-in-out 改成
   background-color .15s ease-out——只让底色这一条属性做过渡（all 会把 border/box-shadow 也算进去，
   且 .3s 对底色来说偏慢，点一下就有一顿一顿的迟滞感）。 */
.esc-card:hover { border-color: var(--dsw-alias-border-l1); background-color: var(--dsw-alias-interactive-bg-hover); box-shadow: var(--dsw-shadow-lv2); }
.esc-card-compact { min-height: 84px; }
/* ★SPEC §7 分层策略：**技能卡有阴影（它是可点的入口）、专家/连接器卡无**（它们是列表项）。
   官方那套"所有卡一刀切同一阴影"在这里是错的——两类卡的交互语义不同，视觉权重就该不同。 */
.esc-card-expert, .esc-card-connector { box-shadow: none; }
/* 三行都 flex: none：官方紧凑卡片的 96px 内容盒恰好容纳「头 48 + 间隙 16 + 描述 32」，本页一旦因任何原因
   超出（例如宿主的长字号设置/文本放大），被压扁的必然是描述 ⇒ 那正是"第二行被切掉半截"的形态。钉死它。 */
.esc-card-header { display: flex; gap: 12px; flex: none; }
/* ★真图实测（workbuddy 实际 UI，SPEC 文字没写对）：图标是 **40px 圆角方块**（radius 10），不是正圆。 */
.esc-card-image { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: var(--dsw-alias-bg-skeleton); }
.esc-card-image-circle { border-radius: 50%; }
.esc-card-headmain { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
/* ★本刀（用户裁决⑦）：标题与描述**合成一块**、与图标同处卡片头那一行（描述在标题正下方）。
   描述不再独占一整行——那行原来固定 32px 高（两行），真机截图里把卡片撑得很高。
   现在描述在 headmain 内、标题之下，随卡片高度自适应。 */
.esc-card-title { margin: 0; color: var(--dsw-alias-label-primary); font-size: 14.5px; font-weight: 650; line-height: 1.4; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 头里的那一格描述：单行截断（与标题同一个块，不占独立行高）。 */
/* ★真图实测：描述是**单行**截断（不是 SPEC 文字里那个两行/min-height 38px）。 */
.esc-card-headdesc { margin: 3px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
.esc-count-box { display: flex; align-items: center; gap: 10px; flex: 1; }
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
/* ★本刀（真机故障「下滑加载中…会一直闪屏」的可见面）：触底加载那一行原先复用整屏态「.esc-state」
   （内衬 20px、字号 13px）——它出现在滚动内容里，**出现/消失都会把列表顶一下**。当底部一遍遍
   发空补拉时，那行一闪一缩就是用户看到的"闪"。改成**定高紧凑行**：高度固定 28px、12px 字、
   内衬为 0 ⇒ 它出现或消失只占这 28px，不再牵动整段列表（判据侧的根因修复见 esc-aggregation.tsx）。 */
.esc-scroll-loader { flex: none; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
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
  /* 定宽后的收窄档：200px 在手机上会挤掉右块其余两枚，收到 160px 仍在（不是 96px 那种塌成缝）。 */
  .esc-search { width: 160px; }
  /* 三行标签的间距也收一档，否则「系统广场 / 团队空间 / 我启用的」自己就换行了。 */
  .esc-resource-tabs, .esc-source-tabs, .esc-category-tabs { gap: 4px; }
}

/* ══════════════ 移动端（触屏 / 窄 / 矮）：整页单滚动面 ══════════════
 * ★用户裁决（本轮，真机）：「移动端页面不要冻结，支持全屏滚动」。
 *   原先（=桌面档）滚动面在**列表那一口小格子**里：.esc-content 的 overflow:hidden 把
 *   工具栏/精选/维度/分类整片钉死在页顶，只有下面的 .esc-scroll 能滚 —— 手机上视口本来就矮，
 *   首屏再被工具栏和精选行吃掉两三成，可滚区域只剩一小条，手指落在上半屏什么都不会动，
 *   观感就是「页面冻住了」。
 *   本档把**滚动面提到内容区自身**：.esc-content 成为滚动容器 ⇒ 工具栏、精选行、维度、分类
 *   与卡片**一起滚**（这才是「全屏滚动」），.esc-scroll 退回普通块（不再是自己的滚动容器）。
 *   ★判据为什么是「触屏 / 宽 / 高」三条**并集**、而不是只写宽度：本机真机实测 CSS 视口约 862×610
 *     （按截图里那枚 220px 定宽搜索框反推 dpr≈2.74 —— 它没吃到 160px 那档，正说明宽度档没触发），
 *     宽 862 永远够不着既有的 560px 档 ⇒ 那档对这台设备是死代码。pointer: coarse 与宽度、
 *     与横竖屏都无关，是这台设备上唯一稳的判据；另两条宽度/高度档兜住桌面浏览器里的小窗口。
 *   ★列表的触底加载**判据不改**：它挂在「谁在滚就用谁的 scrollHeight/clientHeight」上
 *     （见 esc-aggregation.tsx 的 activeScroller），所以这一档不会把无限滚动改坏。 */
@media (pointer: coarse), (max-width: 1024px), (max-height: 700px) {
  /* 高度仍是确定的（flex: 1; min-height: 0 没动）⇒ 内容区自己当滚动面是成立的。 */
  .esc-content { overflow-y: auto; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  /* 滚动条藏掉：桌面档那条 .esc-scroll-hidden 管的是列表，这一档滚动面换成了内容区。 */
  .esc-content::-webkit-scrollbar { display: none; }
  /* 列表退回普通块：高度随内容走（不再自己滚），否则会变成「格子里再滚」的套娃。 */
  .esc-scroll { flex: none; min-height: 0; overflow: visible; }
}

/* ══════════════ 本刀（workbuddy 风格重构）：以下为本刀新增的类 ══════════════
 * 几何与 token 全部取自**本文件上面已验过的那些**（主题真源 dsh-client-ui-theme 里真实存在的那几枚），
 * 一枚新 token 都没引入 —— 故这批规则不会重演「失效 token 让整条声明作废」那类坑。 */

/* —— 顶栏右块新增的两枚控件（截图里排在搜索框右侧的那一对）——
   ★两枚**本刀都不接线**（筛选与添加动作都不做），但按产品宪法不许只挂一句 title 的死控件：
   它们**看得见、有文案、有 title**，只是置灰。 */
.esc-installed { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; height: 32px; padding: 0 12px; border-radius: var(--dsw-radius-md, 8px); border: 1px solid var(--dsw-alias-border-l2); background: none; color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 13px; white-space: nowrap; cursor: pointer; }
.esc-installed:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.esc-installed:disabled { cursor: default; opacity: .6; }
.esc-installed-count { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
/* 读不到已装清单 ≠ 一个都没装 ⇒ 另出一枚「？」，不写 0（写 0 等于对用户谎称「这台机器上一个技能都没装」）。 */
.esc-installed-failed { margin-left: 2px; color: var(--dsw-alias-state-warn-primary); cursor: help; }
/* ★本刀（用户裁决④）：「添加技能」是**纯黑实底按钮**（workbuddy 那张里它是全页最重的一枚）。
   button-primary-fill 在本主题里就是近黑（浅色 #0f1115／深色反相近白），直接用原语的
   .primary 即可——**不写死颜色**，深浅两套主题都由主题自己翻。
   顺带把它那层 :disabled 的冲淡按回去（口径 36 同一手法）：本刀不接线，但**形态**要对。 */
.esc-add-skill { flex-shrink: 0; gap: 6px; white-space: nowrap; }
/* ★SPEC §7：主按钮走**近黑**（button-primary-fill 在本主题里就是 brand-primary = 近黑），
   品牌青绿**只留给状态标识**。这与本文件原先"动作按钮全黑"那一刀同源，这里把范围写清楚。 */
.esc-root .esc-add-skill:disabled { opacity: 1; }
/* 口径 36 那条（.esc-action-solid:disabled { opacity: 1 }）同样覆盖新加的「去试试」——
   动作按钮那一层灰来自原语 .button:disabled { opacity: .4 }，用户裁决「换成全黑按钮」⇒ 只把冲淡按回去。 */
.esc-try-now { white-space: nowrap; }

/* —— 技能卡右侧动作区（workbuddy 那一版式：未装「+」，已装「更多 + 去试试」）—— */
.esc-skill-actions { position: absolute; top: 12px; right: 16px; display: flex; align-items: center; gap: 8px; z-index: 1; }
/* ★用户裁决⑥：右上角那枚「安装」按钮此前是个**灰色圆圈小方块**（截图里看不出是加号），且颜色偏淡。
   现在改成 workbuddy 那种**淡底 + 可辨识的加号**：bg-layer-2 作底（比白卡略深一档，有边界感）、
   字色走主文字色（加号看得清），尺寸放大到 30px，hover 才加深。 */
/* ★真图实测：那枚「+」是**浅灰圆角方块**（不是透明底），约 24px。 */
.esc-install-plus { display: inline-flex; align-items: center; justify-content: center; width: 24px; min-width: 24px; height: 24px; flex-shrink: 0; border: none; border-radius: 6px; background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); cursor: pointer; transition: background .15s, color .15s; }
.esc-install-plus:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.esc-install-plus:disabled { cursor: default; opacity: .6; }
.esc-more-btn { display: inline-flex; align-items: center; justify-content: center; width: 24px; min-width: 24px; height: 24px; flex-shrink: 0; border: none; border-radius: 6px; background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); cursor: pointer; transition: background .15s, color .15s; }
.esc-more-btn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.esc-more-btn:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset: 2px; }

/* —— 技能卡底部那条「标签行」（取代原页面的统计页脚）：
   逐项是 图标 + 值；缺的项显示一个短横（如实说「本该有数字、现在没有」，0 会被读成「装过 0 次」）。 */
/* ★用户裁决（本轮，真机）：「技能卡片中间空白太多，去除空白行」。
   原先这里是 height: 170px 定高（照 workbuddy 真图取的卡高），而下面那条标签行又带
   margin-top: auto —— 两者合起来把标签行顶到卡底，于是在**描述与标签行之间**留出一条空白：
   那条空白不是内容，是**声明出来的**。卡高改由内容决定（.esc-card 的 min-height: 84px 仍在，
   描述那一格是定高 32px 的两行截断 ⇒ 同排卡片内容高度天然一致，不会因此变成参差）。 */
.esc-card-skill { height: auto; }
/* ★用户裁决（本轮）：「去除空白行」——margin-top: auto 已去掉。它与上面那条定高一起把标签行
   顶到卡底、在中间留白；现在标签行**紧贴描述**（间距 = .esc-card 的 gap 12 + 这里 6px 上衬）。 */
.esc-card-tags { display: flex; align-items: center; gap: 12px; flex: none; flex-wrap: nowrap; overflow: hidden; padding-top: 6px; }
.esc-tag { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.4; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* SPEC：统计行的图标 opacity .7（数字不降权，图标降权——那才是"次要信息"的正确表达）。 */
.esc-tag svg { opacity: .7; }
.esc-tag-author { min-width: 0; overflow: hidden; }
/* 作者名可能很长 ⇒ 单行截断，别把整行撑破或把别的标签挤走。 */
.esc-tag-author > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* —— 「精选技能」那一行（workbuddy 版式：标题栏 + 「换一批」+ 卡片网格）—— */
.esc-featured { flex-shrink: 0; padding-bottom: 8px; }
.esc-featured-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.esc-featured-title { margin: 0; color: var(--dsw-alias-label-primary); font-size: 15px; font-weight: 600; line-height: 22px; }
.esc-featured-refresh { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; border: 0; background: none; padding: 0; color: var(--dsw-alias-label-tertiary); font-family: inherit; font-size: 12px; cursor: pointer; }
.esc-featured-refresh:hover { color: var(--dsw-alias-brand-primary); }
.esc-featured-refresh:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset: 2px; }
.esc-featured-body { position: relative; }
/* 精选卡**刻意只两格**（图标 + 标题）：那条接口没有描述/作者/收藏量/安装量/使用量，
   薄壳是用户裁决（见 esc-featured.tsx 文件头）——宁可简，不编字段。 */
/* ★用户裁决⑤：精选卡与下面那些卡片**用同一套几何**——栅格列宽（minmax(300px,1fr)）、列间距（16px）、
   卡高（170px）、内衬（16px）、圆角、边框、背景，逐值照 .esc-list-section / .esc-card 那几行。
   此前精选那行自成一套（220px 列、64px 矮卡），真机截图里两段网格**列数都对不齐**。 */
.esc-featured-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(262px, 1fr)); gap: 12px; align-content: start; }
/* 精选卡 = 图标 + 标题**同处一行**，与普通卡片的「头行」同一形态（不是各自占一行）。 */
.esc-card-featured { flex-direction: row; align-items: center; gap: 12px; min-height: 84px; padding: 16px 20px; cursor: default; }
/* 精选卡里的图标 + 标题：照普通卡片的「头行」版式（图标在左、标题在右） */
/* 精选卡与普通卡片**同一套内部结构**：图标在左、标题在右，同处那一行。
   （此前这里用 margin-top:-46px 把标题硬拉回图标那行——那是 hack，负边距撑出的空白在真机上很明显。） */
.esc-card-featured .esc-featured-icon { display: flex; align-items: center; gap: 12px; min-width: 0; }
.esc-card-featured .esc-featured-label { flex: 1; min-width: 0; }
.esc-card-featured:hover { border-color: var(--dsw-alias-border-l1); background-color: var(--dsw-alias-interactive-bg-hover); box-shadow: var(--dsw-shadow-lv2); }
.esc-featured-icon { flex-shrink: 0; }
.esc-featured-image { display: block; width: 40px; height: 40px; border-radius: var(--dsw-radius-md, 8px); object-fit: cover; background: var(--dsw-alias-bg-skeleton); }
.esc-featured-image-empty { border: 1px solid var(--dsw-alias-border-l1); }
.esc-featured-label { min-width: 0; overflow: hidden; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
/* 精选行自己的失败/未登录说明：复用本页既有的失败色与提示字号，不另立一套。 */
.esc-featured-note { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 0; color: var(--dsw-alias-state-error-primary); font-size: 13px; line-height: 20px; }
.esc-featured-note .esc-sub { margin: 0; color: var(--dsw-alias-label-secondary); }
.esc-retry { border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 8px); background: none; padding: 4px 12px; color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 13px; cursor: pointer; }
.esc-retry:hover { background: var(--dsw-alias-interactive-bg-hover); }
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
