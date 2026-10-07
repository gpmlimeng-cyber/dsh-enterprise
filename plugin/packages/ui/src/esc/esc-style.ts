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
 *   ⑧ **字号体系 + 三处间距/上限（本刀）**：
 *      ① 字号：全页 27 处硬编码 px ⇒ 接上壳的字体缩放
 *         （`calc(基准px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px))`）。
 *         壳的真源：布局层写 `--dsh-content-font-size: Npx`（用户的「字体大小」设置），主题层派生
 *         加法 delta（`body{--dsh-content-font-delta:calc(--dsh-content-font-size,14px - 14px)}`）。
 *         本页原先不跟随；现在两档都跟随。`--esc-fs-delta` 在桌面档是 `0px`（像素观感不变），
 *         移动档换成 `clamp(-1.5px, (100vmin - 400px) * 0.007, 1.5px)` 的**视口自适应**一档。
 *         纪律：本页不许再出现裸 px 字号（门禁剥注释后逐条扫）。
 *      ② 顶部两行 20px → 18px（用户「小一号」）；分类行 gap 20px → 8px（用户「紧凑些」）。
 *      ③ 「精选」上下间距同为 20（上 margin-top 20 = 下 6+14），原先上方是 0（贴死）。
 *      ④ 精选行**最多画 6 枚**（展示上限，不是取数上限，见 `esc-featured.tsx`）。
 *      ⑤ 触底「加载中」那行换定高紧凑行 `.esc-scroll-loader`（原先复用整屏态会被顶一下）。
 *   ⑨ **口径 39（本轮两条真机裁决）**：
 *      ① **网格列数**：两条网格（列表 + 精选）改用**同一个真源** `--esc-grid-cols`，
 *         默认档（手机竖屏）单列，其余档取 `minmax(min(262px, (100% - gap) / 2), 1fr)` 的
 *         auto-fill ⇒ **平板横竖屏都最少两列**（横屏掉成单列的真因：内容区 532px 比 262×2+12=536
 *         差 4px，见网格规则上方那段实测）；
 *      ② **技能卡头行**：图标与"标题行 + 描述"整块垂直居中（`.esc-card-skill .esc-card-header`
 *         ——口径 42 起这条规则的选择器是**两档并列**，见⑪），
 *         动作位（+ / 更多 + 去试试）从**绝对定位浮在标题上**改成**流里的一格**（`.esc-skill-actions`）
 *         ⇒ 标题的省略号由 flex 分配、不再积压到安装图标底下。
 *   ⑩ **口径 41（本轮真机裁决「技能卡片描述的截断位置应该是卡片边缘而不是安装按钮，因为他是独立一行」）**：
 *      技能卡的**描述独立成一行**——新增 `.esc-card-titlerow`（「标题 + 动作位」那一行，口径 42 起改名共用），
 *      动作位从"headmain 的兄弟"收成这一行的第二格 ⇒ 它只吃**标题那一行**的宽度，描述那一行的右端回到
 *      **卡片内缘**（与下面那条标签行对齐、省略号落在卡片边缘）。口径 39 的三条效果一字不减：
 *      标题仍 `flex: 1 / min-width: 0` 且省略号永远落在动作位左侧，仍不靠任何预留魔数。
 *   ⑪ **口径 42（本轮真机裁决「专家卡片调整成和技能卡片布局一致，标题描述，底部标签。区别是右上角技能是安装，
 *      专家是召唤，但是专家的召唤默认不显示，hover 时才显示，显示按钮时标题如果太长就截断」）**：
 *      ① **专家卡整套换成技能卡那一版式**——头行的两条居中规则、标题行 `.esc-card-titlerow`、
 *         描述行 `.esc-card-headdesc`、底部标签行 `.esc-card-tags` 现在**两档共用**（①那条居中规则
 *         写成"技能 + 专家"两档并列的**同一条规则**，不是一个抄一份）；
 *      ② **标题行改成 `gap: 0`**，动作格自带 `margin-left: 12px`：`gap` 是**容器**属性，它对"收起态的
 *         召唤格"照样算 12px ⇒ 标题会平白短 12px。让每一格自带间距，"收起 = 零占位"才成立（见③）；
 *      ③ **新增 `.esc-summon-slot`**（专家那枚「召唤」的格子）：默认 `max-width: 0` + `opacity: 0`
 *         ⇒ 标题拿到整行宽、长标题**不**截断；卡片 `:hover` 才展开（`max-width: none` + `margin-left: 12px`）
 *         ⇒ 标题那一格随之下缩、省略号就落在召唤左侧。**两个状态正是用户那一句话的两半**；
 *      ④ **撤下**右下角那枚 hover 浮现的收藏钮（`.esc-corner-box` / `.esc-star-box`）——它是旧三层版式的
 *         浮层，新版式底部是标签行 ⇒ 它只会压在标签行上（记录与理由留在原地那段注释里，两条规则整块删掉）。
 *   ⑫ **口径 43（用户裁决「精选的卡片调整成和非精选的一致」）**：**精选卡与广场卡合成同一张卡**，
 *      故上一版那套"薄壳卡"的样式**整组下线**（`.esc-card-featured`、`.esc-featured-icon`、
 *      `.esc-featured-image`(-empty)、`.esc-featured-label` 共八条规则/位）。精选卡现在吃到的是
 *      `.esc-card` + `.esc-card-skill` / `.esc-card-expert` 那几条（边框、底色、hover、标签行全都同源）。
 *      `.esc-featured`/`-head`/`-title`/`-refresh`/`-body`/`-grid`/`-note` 与 `--esc-grid-cols` **一字未动**
 *      —— 前六条是这一行自己的壳与四态，最后那条是两段网格列对齐的那个真源（口径 39）。
 *      数字后果：全文 `font-size` 声明 27 → 26 处（下线的那条 `.esc-featured-label` 是唯一带字号的一条）。
 *   ⑬ **口径 44（用户裁决「移动端下，专家技能连接器，和右侧搜索、已安装、添加分成两行」）**：
 *      移动档（触屏/窄/矮 —— 判据就是文件下部那一条 `@media`，本档不另立判据）把工具栏**第一栏拆成两行**：
 *      ① 三页签（`.esc-toolbar-leading`）独占一行；② 右块（更多/搜索/已安装/添加）整块落第二行，
 *      搜索框在该行内 `flex: 1 1 auto` 吃掉剩余宽度（下限仍是 120px，与口径 37 同一条）。
 *      ★它**取代口径 38** 的「主行 nowrap」——但**只取代移动档**：桌面档那三条（nowrap / 搜索 220px 定宽 /
 *      右块 `margin-left: auto`）一字不动，故这是"同一个类的两档不同布局"，不是把桌面档也改了。
 *   ⑭ **口径 45（用户裁决「移动端搜索已安装添加要显示完，搜索栏自适应，不要溢出」）**：
 *      口径 44 只做对了一半——搜索框下限留在 120px，而第一栏真机可用宽 377.5 减去右块固定宽 257
 *      只剩 120.5 ⇒ **一超过就把右端那枚「添加技能」裁掉**（容器 nowrap + overflow 可见 = 裁切，不是换行）。
 *      本刀三条：① 下限 120 → **88**；② 搜索框 `flex: 1 1 auto` → **`flex: 1 1 0`**（行断开用的是
 *      假设主尺寸，basis: auto 会取内容宽约 240 ⇒ 一打开 wrap 就先断行、轮不到收缩）；③ 移动档把右块
 *      **间隙 12 → 8**、两枚按钮**内衬收到 `0 8px`** 且用 `.esc-root` 前缀提特异性（基类在本文件里更靠后）
 *      ⇒ 固定宽 257 → 233，搜索框拿到 144.5（竖屏全屏 327）。`.esc-toolbar-right` 同时**允许折行**作兜底：
 *      容器再窄时最后那枚按钮整枚落到下一行 —— 宁可多一行，绝不裁半枚。
 *      ★尺子更正：口径 44 写的「CSS 视口 608、内容区 560」是**竖屏全屏**那一档；分屏/横屏下第一栏可用宽
 *      分别是 377.5（1170 物理 ÷ 2.75 − 48）与 532（860 − 280 侧栏 − 48）。三条规则在两档下都成立。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, type ReactNode } from 'react'

const CSS = `
/* ★口径 35①：官方页面跑在 antd/umi 的全局 * { box-sizing: border-box } 下（官方那几枚原语也各自显式写着
   border-box，正是"壳里没有这条"的旁证），而 dsh 壳**没有**这条重置。本页所有几何都是照官方 border-box 口径
   抄的（卡片 170/130 = 内容 136/96 + 内衬 32 + 描边 2）⇒ 少了它整块长胖 34px，紧凑卡片还会因内容超出而
   把描述挤掉半行。故在 esc 子树内补上同一条（作用域内，不外溢到壳）。 */
.esc-root, .esc-root *, .esc-root *::before, .esc-root *::after { box-sizing: border-box; }
/* ★**字号体系（本刀）**：本页原先 27 处字号全是硬编码 px ⇒ **完全不跟随**壳的字体缩放。
   壳的做法是"一条加法 delta"：body 上
   --dsh-content-font-delta: calc(var(--dsh-content-font-size,14px) - 14px)
   （布局层把用户的「字体大小」设置写成 --dsh-content-font-size: Npx），壳内每个组件都写
   calc(基准px + var(--dsh-content-font-delta, 0px))。故本页同样接上，并**再叠一档视口自适应**
   --esc-fs-delta（见移动档）——两个 delta 相加，层级关系不变（全体同加同一个数）。
   ★纪律：本页**不许再出现裸 px 字号**（"font-size: 13px;" 这种形式），门禁逐条扫（见 spec）。
   ★注意：本段整体在一枚模板字符串内，注释里**不许出现反引号**（会截断字符串）。 */
/* ★**网格列数（口径 39）**：两条网格（列表 .esc-list-section 与精选 .esc-featured-grid）的列模板
   走这**同一个真源**，默认档（手机竖屏）是**单列**；非手机竖屏那一档由下面的 @media 换成"最少两列、
   宽度够更多"。为什么默认取单列、而不是"默认两列 + 手机档收一列"：用户那一句裁决的判据就是
   **手机竖屏**，把它写成默认档，页面在"最窄的那一种设备"上就不会先排出两列再被覆盖回来
   （CSS 只有一条最终值，但读代码的人一眼能看出哪个是兜底）。详见网格规则上方那段。 */
.esc-root { min-height: 0; background: var(--dsw-alias-bg-base); display: flex; flex-direction: column; height: 100%; --esc-fs-delta: 0px; --esc-grid-cols: minmax(0, 1fr); }
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
.esc-resource-tab { height: 32px; padding: 0; display: inline-flex; align-items: center; gap: 6px; background: none !important; box-shadow: none !important; border: 0; border-radius: 0; font-size: calc(18px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); font-weight: 600; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s; }
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
/* ★本刀（用户原话「精选和上方间距调大，上下间距一样」）：
   结构事实——工具栏里三行依次是 .esc-toolbar-row（三页签）→ .esc-toolbar-second（精选）→ .esc-source-tabs（维度），
   而 .esc-toolbar 是普通块容器、行与行之间**没有** gap ⇒ 原先"精选与上方"的间距是 **0**（两行直接贴死，
   这正是"太挤"的来处），"精选与下方"则是 8px（.esc-featured 的底部内衬）+ 14px（维度行上边距）= 22px。
   本刀把上下的两个数**调成同一个值 20**：上 = 这里的 margin-top: 20px；
   下 = .esc-featured 的 6px 底部内衬 + 维度行的 14px 上边距（那 14px 是官方值，且连接器页**没有精选行**
   时它就是与上方之间的唯一间距，故不挪它，改精选那一侧）。
   ★门禁是"上下相等"这条不变量本身（三个数提取后相加比对），不是把两个 20 硬写两遍。 */
.esc-toolbar-second { flex-shrink: 0; width: 100%; margin-top: 20px; }
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
.esc-source-tabs .esc-pill { height: 30px; padding: 0; display: inline-flex; align-items: center; background: none !important; box-shadow: none !important; border: 0; border-radius: 0; font-size: calc(18px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); font-weight: 600; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s; }
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
.esc-more { flex-shrink: 0; font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); color: var(--dsw-alias-label-tertiary); white-space: nowrap; background: none; border: 0; padding: 0; font-family: inherit; cursor: pointer; text-decoration: none; }
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
.esc-category-tabs .esc-pill { height: 28px; padding: 0 8px; display: inline-flex; align-items: center; background: none; box-shadow: none; border: 0; border-radius: 6px; font-size: calc(13px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); font-weight: 500; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s, background .15s; }
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
.esc-toolbar-note { margin-top: 6px; font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); color: var(--dsw-alias-label-tertiary); }

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

/* ══════════════ 网格列数（口径 39 · 用户裁决「平板下最少两列，只有手机竖屏才一列」）══════════════
 * **真机事实**（这台折叠屏，dpr = 440dpi ÷ 160 = 2.75）：
 *   · 横屏：物理 2364×1672 ⇒ CSS 视口 **860×608**；此时壳的侧栏是**停靠**的（截图实测 ≈ 280 CSS px），
 *     内容区只剩 860 − 280 − 48（.esc-content 的左右内衬 24×2）= **532px**；
 *   · 竖屏：物理 1672×2364 ⇒ CSS 视口 **608×860**；竖屏侧栏是**抽屉**（顶栏有汉堡键，不占宽），
 *     内容区 = 608 − 48 = **560px**。
 * 而原来那条 minmax(262px, 1fr) 要 2 × 262 + 12（gap）= **536px** 才肯排第二列 ⇒
 *   **竖屏 560 ≥ 536 ⇒ 两列；横屏 532 < 536 ⇒ 掉回一列**——差的正是这 4px。
 * 这就是「横向一列、竖着两列」的**全部来处**：不是"横屏没适配"，是差 4 像素。
 * 修法：最小列宽不放死 262，取 min(262px, (100% − gap) ÷ 2)——
 *   · 容器 ≥ 536px：min 就是 262 ⇒ 列数照旧随宽度长（宽屏 3/4 列，与官方栅格口径一致）；
 *   · 容器 < 536px：min 收成"两列各占一半"（532 ⇒ 260/列）⇒ **永远排得下两列**，
 *     付出的只是每列 2px 的宽度，读起来与 262 那一档没有任何差别。
 * 手机竖屏那一档（≤560px 且 portrait）留在默认档 ⇒ 仍是单列（用户要的"只有手机竖屏一列"）。
 * ★两条网格**共用** --esc-grid-cols 这一个真源，不各写一份：选精选行时上下两段网格是**列对齐**的，
 *   各写一份迟早会漂（口径 ⑤ 定的"两段同一套几何"就是为这件事）。
 * ★min() 里那个 12px 必须等于两条 grid 规则里的 gap（门禁按**提取值**比对，不靠人眼，见 spec）。
 */
@media (min-width: 561px), (orientation: landscape) {
  .esc-root { --esc-grid-cols: repeat(auto-fill, minmax(min(262px, calc((100% - 12px) / 2)), 1fr)); }
}

.esc-list-section { display: grid; grid-template-columns: var(--esc-grid-cols); gap: 12px; padding-bottom: 16px; align-content: start; }

/* —— 卡片（原 CardWrapper/index.less + ResourceCard/index.less）——
   ★★用户裁决「参考官方的，除了侧边栏其他参考官方一比一还原布局和元素，使用 dsh 的 ui 体系」（最新一刀，
   **撤回**此前"紧凑些 / 底部不留白 / 收藏上移"三轮的尺寸改动）：几何**逐值回到官方**——
   卡片高 170px（无统计行 130px）、内衬 16px、卡内间距 16px、头行间距 12px、图标 48px（圆角 8）、
   标题 16px/20px、描述 16px 行高 + 32px 两行、页脚 24px、统计项间距 16px、额外信息行 120px/12px、
   栅格列宽 300px、卡间距 16px、骨架高 170px；收藏 .esc-corner-box 回到**右下角绝对定位**
   （right 16 / bottom 12，命中区 32px）；动作位 .esc-action-box 回到**右上角绝对定位**（top 12 / right 16）。
   ⚠这两条里的**收藏那一半已被口径 42 撤下**（新版式底部是标签行，浮层会压在它上面，见下面那段"已撤下"）；
   动作位那一半仍**有效但只对连接器生效**（专家卡的召唤已进流，技能卡的动作位口径 39 起就已进流）。
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
/* ★本刀（用户裁决⑦）：标题与描述**同处卡片头**（描述在标题正下方的一个独立行里，不再各占一大格）。
   描述那一行原来是固定 32px 高的两行截断，真机截图里把卡片撑得很高；现在它是**单行**（见下面那条）。 */
.esc-card-title { margin: 0; color: var(--dsw-alias-label-primary); font-size: calc(14.5px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); font-weight: 650; line-height: 1.4; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 技能卡的描述——**独立一行**（口径 41：用户裁决「截断位置应该是卡片边缘而不是安装按钮，因为他是独立一行」）。
   它在 headmain 里是「标题行」的**下一行**，而动作位只吃标题那一行的宽 ⇒ 这一行的右端是**卡片内缘**
   （与下面那条标签行对齐），省略号落在卡片边缘。
   flex: none 与头行/页脚同一条纪律（见上面 .esc-card-header 那段）：任何超出都不许把它压扁。 */
.esc-card-headdesc { margin: 3px 0 0; color: var(--dsw-alias-label-secondary); font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; }
/* ★**口径 39（用户裁决「标题和描述加一起要和图标中间对齐」）**：标签行版式的头行**垂直居中**。
   .esc-card-header 默认 align-items: stretch，而图标是定高 40px 的 img（stretch 对定高项无效 ⇒
   回落成 start）⇒ 头行比图标高时图标被钉在行首、看上去偏上（真机截图里就是"图标顶在标题上方"）。
   这一档的头行里只有「图标 + headmain（标题行 + 描述）」两格，居中正是用户要的那一句。
   ★**口径 42**：这一套现在**专家卡也走**（用户裁决「专家卡片调整成和技能卡片布局一致」）⇒
   选择器写成**两档并列的同一条规则**（不是两边各写一份：两档的头现在结构完全相同，抄两份必然分叉）。
   ★**谁不受影响**：连接器与"无 props 的默认档"仍是三层版式，它们的图标本来就该对齐第一行。
   （⚠默认档的根类名也是 esc-card-expert，故它也会吃到这两条——生产上从不渲染那一档，
     而它的头里只有一个标题，居中与 space-between 的差别只在那一个标题的垂直位置。） */
.esc-card-skill .esc-card-header, .esc-card-expert .esc-card-header { align-items: center; }
/* 同一处：这一档的 headmain 里是「标题行 + 描述」两格，只要它们贴成一块、整块与图标居中；
   space-between（头行里把内容上下撑开）是给三层版式留的，标签行版式换成 center。 */
.esc-card-skill .esc-card-headmain, .esc-card-expert .esc-card-headmain { justify-content: center; }
/* ★**口径 41（用户裁决「技能卡片描述的截断位置应该是卡片边缘而不是安装按钮，因为他是独立一行」）**：
   头里的**第一行**——「标题 + 动作格」。动作格从 headmain 的**兄弟**收成这一行的**第二格**，
   于是它只吃**标题那一行**的宽度，不再让掉描述那一行的右端（描述因此吃到卡片内缘）。
   口径 39 的效果一字不减：标题那格 flex: 1 / min-width: 0、动作格 flex: none ⇒ 标题的省略号
   仍**永远**落在动作格左侧、仍不靠任何预留魔数（字号跟随壳的「字体大小」设置，魔数会当场失效）。
   align-items: flex-start + 动作格自带的 align-self: flex-start ⇒ 动作格对齐**标题那一行**。
   ★**口径 42**：这一行**两档共用**（技能＝常驻动作格 .esc-skill-actions，专家＝默认收起的
   .esc-summon-slot，见下面那两条）。类名也从 esc-skill-titlerow 改成 esc-card-titlerow——
   它已经不是技能卡专属的那一行了。
   ★**gap: 0（口径 42 的关键一处）**：两格之间的 12px 改由**动作格自己**用 margin-left 带。
   因为 gap 是**容器**属性——它对"收起态的召唤格"（宽度 0）照样会算 12px，于是标题会平白短 12px、
   在卡片右边缘提前出现省略号（那正是用户不想看到的：没显示按钮时不该截断）。
   让每一格自带间距，"收起 = 真零占位"才成立。 */
.esc-card-titlerow { display: flex; align-items: flex-start; gap: 0; flex: none; }
/* 标题那一格必须仍可收缩（min-width: 0），否则 flex 分配不到宽度、省略号不生效。 */
.esc-card-titlerow .esc-card-title { flex: 1; min-width: 0; }
.esc-card-author-row { display: flex; align-items: center; gap: 12px; }
/* 官方 AuthorInfo/index.less：容器 min-width: 30px; gap: 4px; flex: 0 1 auto，
   头像 **16×16**（原实现写的是 14×14，比官方小一圈），名字 height: 16px; line-height: 16px。 */
.esc-author { display: flex; align-items: center; gap: 4px; overflow: hidden; min-width: 30px; flex: 0 1 auto; }
.esc-author-avatar { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
.esc-author-name { font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); height: 16px; line-height: 16px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.esc-extra-box { min-width: 120px; flex: 1 1 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--dsw-alias-label-tertiary); font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); overflow: hidden; }
/* 描述：官方那一格是 EllipsisTooltip 渲染的 <div class="text-ellipsis-2 {module}.content">——
   text-ellipsis-2（styles/custom.less:11-23）给 display:-webkit-box / -webkit-line-clamp:2 /
   -webkit-box-orient:vertical / overflow:hidden / **text-overflow:ellipsis / word-break:break-all /
   white-space:normal**，.content（CardWrapper/index.less:61-67）给 line-height:16px; height:32px;
   color:font-tertiary; font-size:12px; font-weight:strong。本页原先漏了 text-ellipsis-2 里那三条，
   现补齐；再加 flex: none（见上，描述不许被压扁）。 */
.esc-card-content { line-height: 16px; height: 32px; color: var(--dsw-alias-label-tertiary); font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-all; white-space: normal; flex: none; }
/* 页脚：官方只有【有统计行】的专家卡片才渲染这个元素（{showStats && <footer/>}，height: 24px）——
   技能/连接器卡片没有它（否则多出 24px + 16px 间隙，正是把描述挤出内容盒的那 40px）。渲染与否由卡片的
   showStats 决定（见 esc-card.tsx），这里只保证它的几何。 */
.esc-card-footer { height: 24px; display: flex; align-items: center; flex: none; }
.esc-count-box { display: flex; align-items: center; gap: 10px; flex: 1; }
.esc-count-text { display: flex; align-items: center; font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); color: var(--dsw-alias-label-tertiary); gap: 4px; }
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
/* —— 已撤下（口径 42）：右下角那枚 hover 浮现的收藏钮 ——
   它原来在这里画两条规则：.esc-corner-box { position: absolute; right: 16px; bottom: 12px; }
   （官方口径：收藏钮回右下角、命中区 32px 的 .esc-star-box），按钮自己挂 .esc-hover-reveal
   浮现在右下角。口径 42 起**专家卡与技能卡同版式**（底部是**标签行**，收藏量就在那一行里）⇒
   那个浮层只会**压在标签行上**，故两条规则连同渲染点一起撤下（技能卡本来也没有它）。
   ★那枚按钮一直是**置灰未接线**的占位（disabled + title 写明原因，点了不会有动作）
     ⇒ 撤下**不丢任何可用功能**；收藏量仍在标签行里如实显示（真数或缺口短横）。
   ★要它回来：放进标签行尾部或卡头即可（一行的事）——但**别再回到"绝对定位浮在内容上"**，
     那正是本页从口径 39 起一路在拆的形态（浮层压住标题/描述/标签行）。 */
.esc-connect-info { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.esc-connect-category { color: var(--dsw-alias-label-tertiary); font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.esc-connect-status { display: flex; align-items: center; flex-shrink: 0; gap: 4px; font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); white-space: nowrap; }
.esc-status-dot { width: 6px; height: 6px; border-radius: 50%; background-color: currentcolor; }
.esc-status-connected { color: var(--dsw-alias-state-success-primary); }
.esc-status-disconnected { color: var(--dsw-alias-label-tertiary); }

/* —— 三态与提示（本页新增：原页面读不到数据时是"静默空态"）—— */
.esc-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--dsw-alias-label-tertiary); font-size: calc(13px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); text-align: center; padding: 20px; }
.esc-state-title { color: var(--dsw-alias-label-secondary); font-size: calc(14px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); }
.esc-state-error { color: var(--dsw-alias-state-error-primary); }
.esc-state-code { font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); color: var(--dsw-alias-label-tertiary); word-break: break-all; }
/* ★本刀（真机故障「下滑加载中…会一直闪屏」的可见面）：触底加载那一行原先复用整屏态「.esc-state」
   （内衬 20px、字号 13px）——它出现在滚动内容里，**出现/消失都会把列表顶一下**。当底部一遍遍
   发空补拉时，那行一闪一缩就是用户看到的"闪"。改成**定高紧凑行**：高度固定 28px、12px 字、
   内衬为 0 ⇒ 它出现或消失只占这 28px，不再牵动整段列表（判据侧的根因修复见 esc-aggregation.tsx）。 */
.esc-scroll-loader { flex: none; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary); font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); }
/* 空态插图（官方是 antd <Empty> 的默认插图；dsh 无 Empty 原语 ⇒ 用 token 画一张等价物，见 esc-aggregation.tsx）。 */
.esc-empty-art { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--dsw-radius-lg, 12px); background: var(--dsw-alias-bg-skeleton); color: var(--dsw-alias-label-tertiary); }

/* —— 首屏加载（官方那一态画的是 components/custom/Loading：居中的一枚转圈图标 + 「加载中...」，
   色走主色、字号 12、间距 8px）——原先是本页自造的六张骨架卡，口径 35 按官方换成这一枚。 */
.esc-loading { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--dsw-alias-brand-primary); font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); }
.esc-loading-icon { animation: esc-spin 1s linear infinite; }
@keyframes esc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .esc-loading-icon { animation: none; } }

/* —— 未登录门（未登录那态：原页面不存在，因为那时它总在平台内）—— */
.esc-gate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px; text-align: center; }
.esc-gate-title { font-size: calc(15px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); font-weight: 500; color: var(--dsw-alias-label-primary); }
.esc-gate-body { font-size: calc(13px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); color: var(--dsw-alias-label-secondary); max-width: 420px; line-height: 20px; }

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
  /* ★本刀（用户原话「我希望移动端下的字体能自适应缩放」）：移动档再叠一档**视口自适应**字号。
     取 100vmin（宽高里较小的那一维：横竖屏都不会反向）——视口越小 delta 越负、越大越正，
     clamp 夹在 ±1.5px（≈13px 基准的一成上下：看得出"随屏缩放"，又不至于把已排好的卡片挤变形）。
     ★只暴露**一个** delta、全体字号同加同一个数 ⇒ 层级关系不变；桌面档 --esc-fs-delta: 0px
     （见 .esc-root），故桌面像素观感与本刀之前一致，而壳「字体大小」那一路在两档都生效。 */
  .esc-root { --esc-fs-delta: clamp(-1.5px, (100vmin - 400px) * 0.007, 1.5px); }

  /* ★口径 44（用户原话「移动端下，专家技能连接器，和右侧搜索、已安装、添加分成两行」）：
     这一档把工具栏**第一栏拆成两行** —— ① 三页签（.esc-toolbar-leading）独占一行；
     ② 右块（更多/搜索/已安装/添加）整块落到第二行。
     ★它取代口径 38 的「主行 nowrap」（那条是桌面上「三页签与右块同行」的裁决）——但**只取代移动档**：
       桌面档那三条（nowrap / 搜索 220px 定宽 / 右块 margin-left: auto）一字不动 ⇒ 同一个类、两种布局，
       门禁按"两条各自在自己的块里"比对，而不是把桌面档也一起改了。
     ★为什么不是只让右块换行（那是口径 38 撤下的旧形态）：那样搜索框仍与三页签抢同一行，
       右块两枚按钮反而被挤到第三行 —— 拆分点必须在「三页签 / 右块」之间，不在「搜索框 / 按钮」之间。
     ★为什么用 row-gap 12 而不是继承主行的 gap 20：拆行后这一处是"两行"的间距（20px 太散），
       12px 与右块内部的间隙同值，读起来才是一条工具栏的两行。

     ★★口径 45（用户原话「移动端搜索已安装添加要显示完，搜索栏自适应，不要溢出」）——
     口径 44 只做对了一半：那一版把搜索框下限留在 120px，而 120 恰好卡在真机边界上，一超过就
     **从容器右边缘裁掉半枚「添加技能」**（不是换行、是裁切：.esc-toolbar-right 自身 nowrap 且
     overflow 可见）。本刀先把尺子量对，再改三条：
       · 真机读数（本刀实测，**更正口径 44 里那个 608**）：设备窗口 1170×1672 物理、dpr = 440÷160 = 2.75
         ⇒ CSS 视口 **425.5**；第一栏可用宽 = 视口 − .esc-content 的左右内衬 24×2 = **377.5**
         （竖屏全屏：608 − 48 = 560；横屏侧栏停靠：860 − 280 − 48 = 532）。注：壳的 centerCol
         **不带**内衬（官方 dsh-client-ui-layout 的 .centerCol 只有 flex/min-width/overflow），
         所以这里不叠第二份 24 —— 官方那 24 是各页面自己的 clamp(24px,4vw,48px)，本页没有。
       · 右块固定宽（按官方原语真值逐项算：更多 2×12.2=24.4 + 已安装 24 内衬+2 描边+6 间隙+14 图标
         +3×13.2 字+计数约 23 = 108.6 + 添加技能 20 内衬+6 间隙+14 图标+4×12 字 = 88 + 3×12 间隙 = 36）
         ⇒ **257**，于是搜索框只剩 377.5 − 257 = **120.5**，正好压在那枚 120px 下限上：字号档、
         计数位数、字体回退任何一项宽一点，右端就溢出被裁。
     ⇒ 三条改法：① 下限 120 → **88**（官方 Input 自身内衬+图标 39px ⇒ 还剩约 49px 写字）；
        ② flex-basis auto → **0** —— 这是与「打开 wrap」配套的必需项：行断开用的是**假设主尺寸**，
        而 basis: auto 取的是内容宽（官方 Input 基准约 240px）⇒ 行会**先断**、把「添加技能」提前顶到
        第三行，根本轮不到收缩（"开了 wrap 反而更散"的那个坑）；basis: 0 之后假设尺寸 = 下限 88，
        行只在**真的放不下**时才断；
        ③ 移动档把右块**间隙 12 → 8**、两枚按钮**内衬收到 0 8px**（.esc-root 前缀提特异性：基类在
        本文件里更靠后，同特异性下后者胜）⇒ 固定宽 257 → **233**，搜索框拿到 377.5 − 233 = **144.5**
        （竖屏 560 时 327）。
      ★兜底：.esc-toolbar-right 自己也允许折行 ⇒ 容器再窄（< 321）时最后那枚按钮**整枚**折到下一行，
        **宁可多一行，绝不裁半枚** —— 这是"不要溢出"的结构保证，不依赖上面任何估值。
     ★另一条**刻意没做**的省法：把「更多」在非系统广场时从「占位隐藏」改成 display: none（省 36px）。
       留着它是为了**切主 tab 时右块宽度不跳**（那是口径 31 的用户裁决），本刀不动它。 */
  .esc-toolbar-row { flex-wrap: wrap; row-gap: 12px; }
  .esc-toolbar-leading { flex: 1 1 100%; }
  .esc-toolbar-right { flex: 1 1 100%; margin-left: 0; flex-wrap: wrap; row-gap: 12px; column-gap: 8px; }
  .esc-search { width: auto; flex: 1 1 0; min-width: 88px; }
  .esc-root .esc-installed { padding: 0 8px; }
  .esc-root .esc-add-skill { padding: 0 8px; }
}

/* ══════════════ 本刀（workbuddy 风格重构）：以下为本刀新增的类 ══════════════
 * 几何与 token 全部取自**本文件上面已验过的那些**（主题真源 dsh-client-ui-theme 里真实存在的那几枚），
 * 一枚新 token 都没引入 —— 故这批规则不会重演「失效 token 让整条声明作废」那类坑。 */

/* —— 顶栏右块新增的两枚控件（截图里排在搜索框右侧的那一对）——
   ★两枚**本刀都不接线**（筛选与添加动作都不做），但按产品宪法不许只挂一句 title 的死控件：
   它们**看得见、有文案、有 title**，只是置灰。 */
.esc-installed { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; height: 32px; padding: 0 12px; border-radius: var(--dsw-radius-md, 8px); border: 1px solid var(--dsw-alias-border-l2); background: none; color: var(--dsw-alias-label-primary); font-family: inherit; font-size: calc(13px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); white-space: nowrap; cursor: pointer; }
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

/* —— 技能卡右侧动作区（workbuddy 那一版式：未装「+」，已装「更多 + 去试试」）——
   ★**口径 39（用户裁决「标题不要和安装图标积压在一起」）**：这一格从**绝对定位**改成**流里的一格**。
   原先它是 position: absolute; top: 12px; right: 16px —— 是**浮在**标题上的：
   .esc-card-title 是 white-space: nowrap 的单行截断，它的可用宽度是整条头行（图标到卡片右边缘），
   于是长标题（真机截图里的 dev-engineer-toolkit）一直排到那一枚「+」底下才截断，
   读起来就是"标题和安装图标积压在一起"。进流之后，标题那格的宽度由 flex **分配**：
   标题是 flex: 1 / min-width: 0，动作格是 flex: none ⇒ 省略号**永远**落在动作位左侧。
   ★为什么不用"给标题预留 32px 右内衬"那条省事写法：预留值是个**魔数**，而字号在本页是跟随壳的
   「字体大小」设置走的（口径 38 那一刀）——设置一变大，已装态那枚「去试试」会变宽，魔数当场失效、
   标题又被压回去。让 flex 去量，才是唯一不随字号漂的写法。
   ★**口径 41（用户裁决「描述截断位置应该是卡片边缘而不是安装按钮」）**：这一格现在是
   「标题行」（.esc-card-titlerow，口径 42 前的旧名是 .esc-skill-titlerow）里的第二格，而不再是 headmain 的兄弟——两者差别只在
   **描述那一行的右端**：做兄弟时整块 headmain 都要按 flex: none 给它让宽（描述跟着短一截），
   收进标题行之后它只吃标题那一行的宽，描述那一行吃到卡片内缘。口径 39 那三条效果一字不减。
   align-self: flex-start：那枚「+」按真图（与 workbuddy 一致）对齐**标题那一行**，不跟整块居中。
   （它现在是「标题行」的子项，"整块"也就只是标题那一行——这条声明在 口径 41 之后依然是它的语义。）
   ★**口径 42**：间距从「标题行的 gap: 12px」挪到这一格自己的 margin-left（同值）。
     为什么要挪：专家卡的召唤格**默认收起**（宽度 0）而 gap 对收起态照样计 12px ⇒ 标题会平白短 12px。
     让动作格自带间距以后，技能卡这边**像素不变**（12px 一处没少），专家卡那边收起态才是真零占位。 */
.esc-skill-actions { display: flex; align-items: center; gap: 8px; flex: none; align-self: flex-start; margin-left: 12px; }
/* ★**口径 42（用户裁决「区别是右上角技能是安装，专家是召唤，但是专家的召唤默认不显示，hover 时才显示，
   显示按钮时标题如果太长就截断」）**：专家卡那枚「召唤」的格子。
   位置与技能卡那枚「+」**完全相同**（标题行的第二格），差别只在**默认状态**：
     · 收起（默认）：max-width: 0 + overflow: hidden + opacity: 0 ⇒ 宽度与间距都是 0，
       标题拿到**整行**宽 ⇒ 长标题照常铺满、**不**截断；
     · 展开（卡片 hover）：max-width: none ⇒ 由内容定宽、margin-left 补回 12px 间距
       ⇒ 标题那一格缩到"整行 − 12 − 按钮宽"，**省略号就落在召唤左侧**。
   用户那句话的两个半句正是这两个状态的对照。
   ★为什么 max-width: 0 而不是 display: none：display 不能过渡（那口淡入就没了）。
     收起态用 max-width: 0 与 display: none 的占位效果**完全相同**（都是 0×0），
     前提是间距不挂在容器的 gap 上（见 .esc-card-titlerow 的 gap: 0 那条）。
   ★触发只有 :hover：这枚按钮**置灰未接线**（disabled ⇒ 不可聚焦，连点击都不响应），
     与 .esc-hover-reveal 同一口径，故不需要 :focus-within 路径（等它接线时再补）。
   ★触摸屏：Chrome/WebView 的 hover 会在**点按后粘住** ⇒ 点一下卡片即出现（这也是它在手机上
     唯一的露出方式——卡片本身没有 onClick，点它不会导航走）。
   ★过渡只走 opacity：宽度那一跳没有过渡（max-width 由 0 到 none 不可插值）⇒
     淡入看得见、淡出是"瞬间收起"。这一条是**刻意留的**，不是漏写（要对称淡出就得把 max-width
     写成一个魔数上限，而那会随壳的字号设置失效——口径 39 明确不要那种写法）。 */
.esc-summon-slot { display: flex; align-items: center; flex: none; align-self: flex-start; max-width: 0; margin-left: 0; overflow: hidden; opacity: 0; transition: opacity .2s ease-out; }
.esc-card:hover .esc-summon-slot { max-width: none; margin-left: 12px; opacity: 1; }
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
.esc-tag { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: calc(11px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); line-height: 1.4; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* SPEC：统计行的图标 opacity .7（数字不降权，图标降权——那才是"次要信息"的正确表达）。 */
.esc-tag svg { opacity: .7; }
.esc-tag-author { min-width: 0; overflow: hidden; }
/* 作者名可能很长 ⇒ 单行截断，别把整行撑破或把别的标签挤走。 */
.esc-tag-author > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* —— 「精选技能」那一行（workbuddy 版式：标题栏 + 「换一批」+ 卡片网格）—— */
.esc-featured { flex-shrink: 0; padding-bottom: 6px; }
.esc-featured-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.esc-featured-title { margin: 0; color: var(--dsw-alias-label-primary); font-size: calc(15px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); font-weight: 600; line-height: 22px; }
.esc-featured-refresh { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; border: 0; background: none; padding: 0; color: var(--dsw-alias-label-tertiary); font-family: inherit; font-size: calc(12px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); cursor: pointer; }
.esc-featured-refresh:hover { color: var(--dsw-alias-brand-primary); }
.esc-featured-refresh:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset: 2px; }
.esc-featured-body { position: relative; }
/* ★**口径 43（用户裁决「精选的卡片调整成和非精选的一致」）**：精选卡现在就是广场那张卡
   （.esc-card + .esc-card-skill / .esc-card-expert），几何/边框/底色/hover 全由那几条规则给。
   于是**上一版那套"薄壳卡"的规则整组下线**：.esc-card-featured（行向布局 + 自己的 hover）、
   .esc-card-featured .esc-featured-icon / .esc-featured-label 两条后代位，以及
   .esc-featured-icon / .esc-featured-image / .esc-featured-image-empty / .esc-featured-label
   四条（40px 图片 + 单行标题）。它们服务的那个薄壳（图标 + 标题、无描述无标签行）已不再存在——
   留着就是死样式，而且会让"精选自带一套几何"这件事看起来仍然成立。
   ★栅格仍与广场**同一个真源**（--esc-grid-cols + gap: 12px，见口径 39 那一段）：
   两段网格列对齐这条不变量一字未动。
   ⚠本段整体在一枚模板字符串内 ⇒ 注释里**不许出现反引号**（会截断字符串，本刀当场踩过一次）。 */
.esc-featured-grid { display: grid; grid-template-columns: var(--esc-grid-cols); gap: 12px; align-content: start; }
/* 精选行自己的失败/未登录说明：复用本页既有的失败色与提示字号，不另立一套。 */
.esc-featured-note { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 0; color: var(--dsw-alias-state-error-primary); font-size: calc(13px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); line-height: 20px; }
.esc-featured-note .esc-sub { margin: 0; color: var(--dsw-alias-label-secondary); }
.esc-retry { border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 8px); background: none; padding: 4px 12px; color: var(--dsw-alias-label-primary); font-family: inherit; font-size: calc(13px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px)); cursor: pointer; }
.esc-retry:hover { background: var(--dsw-alias-interactive-bg-hover); }


`
/**
 * 把 esc 页面样式注入一次。
 *
 * 内联 `<style>` 是本包既有的样式手法（官方原语只给结构，视觉由消费方自持），故这里与
 * login-page.tsx/library-panel.tsx 同一路子：一个纯字符串 + 一个只渲染 `<style>` 的组件。
 */
export function EnterpriseEscStyle(): ReactNode {
  return createElement('style', { 'data-dshent-esc': 'true' }, CSS)
}
