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
 *      ④ 精选行**不设枚数上限**——口径 43 起 `esc-featured.tsx` 把平台给的那一批**一枚不截**全画进 DOM；
 *         那一行只排**一行**、放不下的条目由样式层裁掉（口径 48 的网格机制），要下一批点「换一批」。
 *      ⑤ 触底「加载中」那行换定高紧凑行 `.esc-scroll-loader`（原先复用整屏态会被顶一下）。
 *   ⑨ **口径 39（本轮两条真机裁决）**：
 *      ① **网格列数**：两条网格（列表 + 精选）改用**同一个真源** `--esc-grid-cols`，
 *         默认档（手机竖屏）单列，其余档取 `minmax(min(var(--esc-grid-min), calc((100% - var(--esc-grid-gap)) / 2)), 1fr)`
 *         的 auto-fill ⇒ **平板横竖屏都最少两列**（横屏掉成单列的真因：内容区 532px 比 262×2+12=536
 *         差 4px，见网格规则上方那段实测）；★**口径 48** 把 `--esc-grid-min` 由 500 收到 **320**
 *         （1377.7px 内容区由 2 列回到 4 列），那层 clamp 与算式**一字未动**；
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
 *   ★**口径 46/47**：新增 `.esc-card-switch`（已安装技能卡标题行那一格＝官方 Switch 的位置）与
 *   「已安装技能」页那一组几何（`.esc-installed-*`、`.esc-import-error`）；字号声明 26 → 29（三处新字号，
 *   全是 calc(基准 + 两 delta)，门禁里那一格随之加一档）。
 *   ★**口径 49（本刀）**：`.esc-add-skill` 的高度从 `min-height` 改成 **`height: var(--esc-btn-h)`**
 *   （官方 Button `.md` 那一格写的就是 `height: 36px`，`min-height` 压不住 ⇒ 三页盒高恒 32），
 *   并把字号/字重钉到 `--esc-fs-xs` / 500；新增 `.esc-add-skill-outline`（专家页白底描边，
 *   配方逐条复用既有 `.esc-installed`，**不新造第二套白底按钮**）；移动档那条 `padding: 0 8px`
 *   的类名清单同步覆盖描边档（否则窄屏三页宽度不再一致）。
 *   ★**口径 51（本刀）**：新增「我的专家」子页那一组几何（`.esc-my-experts-*` 五个类 + 工具栏主按钮
 *   旁边那句**行上可见原因** `.esc-toolbar-lock`）——页头**复用**口径 47 立的 `.esc-installed-head/-title/-back`
 *   那一份（刻意不新造第二套，否则两个子页的标题字号迟早漂开），本刀只给 `.esc-installed-title` 补一条
 *   `margin: 0`（新子页的标题是 `h3`，那条对已安装页的 `span` 是空操作）；另在 `.esc-root` 里新增
 *   一枚圆角刻度 `--esc-pill-radius`（WorkBuddy 那枚「+ 创建专家」是**整圆胶囊**，与工具栏主按钮的 8px
 *   不是同一档）。**卡片与精选的几何一个字节都没动**（口径 48 那两段照旧）。
 *   ★**口径 52（本刀：禁用胶囊的禁用外观）**：**删掉**两条把官方 `:disabled` 冲淡按回来的覆盖
 *   （`.esc-root .esc-add-skill:disabled { opacity: 1; }` 与 `.esc-root .esc-my-experts-create:disabled
 *   { opacity: 1; }`）——查证结论：官方 `Button.module.css` 的 `.button:disabled { cursor: not-allowed;
 *   opacity: 0.4 }` **本来就改外观**，是我们的 (0,3,0) 那条把它的 (0,2,0) 冲淡压掉了（不是"官方只改
 *   cursor"、也不是"某枚 token 恰等于启用色"）⇒ 修法是**撤销覆盖**（官方那条是唯一真源），本页为此
 *   **一个新色值、一条新规则都不写**。**启用态三枚（技能页「+ 添加技能」、专家页「我的专家」、
 *   子页其它几何）一字未动**；几何（32 / 右边界 / 圆角 / 字号）与行为接线照旧。
 *   ⑮ **★本刀（八条真机对标，逐像素对着 workbuddy 的真实 UI）**——八条各落一处**可断言的判据**：
 *   ① **三页签**（`.esc-resource-tab`）：字号/字重各加一档（`--esc-fs-base` + 600，档位真源在 `esc-scale.ts`
 *      的 `rows.tab`）、容器 gap 收到 `--esc-sp-md`、**左移与卡片左边界对齐**（容器 `margin-left:
 *      calc(0px - var(--esc-tab-px))` 抵消首枚药丸自己的横向内衬 ⇒ 首枚文字左缘落在 .esc-content 那 24px
 *      = 卡片左缘）。★为什么用负 margin 而不削药丸 padding：削 padding 只把**文字**右移而那枚浅灰盒子
 *      留在原处（"盒子与文字错位"是更难修的坑），负 margin 整枚左移且不动药丸自身几何。
 *   ② **「已安装」与「添加技能」**：「已安装」的图标与文字都走 `--dsw-alias-label-primary`
 *      （浅色实测解析 #0f1115 = 近黑、深色反相 #f9fafb，**不写死 #000**）；两枚的圆角**同吃**
 *      `--esc-btn-radius`（18，取自官方 Button `size:'md'` 那一档）；「添加技能」由 `size:'sm'`(h28)
 *      升到 `size:'md'`(h36)，比同行的次级控件（32）高一档。SPEC §7 的分层策略照旧：主按钮近黑、
 *      品牌色只留给状态标识。
 *   ③ **搜索框**：定宽那一档由字面 220px 提成**刻度变量** `--esc-search-w`（本刀起 **220px** =
 *      SPEC §3.2 真值；沿革 220 → 180"窄一点" → 回 220，见 `.esc-root` 那一格）；
 *      聚焦态的描边按官方 `Input.module.css` 真值**对调**成一条自己的灰阶梯——静止 `border-l2`
 *      （#0000001a）→ 聚焦 `border-l4`（#00000029）：官方是"静止 l4 / 聚焦品牌色"，用户要的是**灰色**、
 *      只比静止**深一点**。两条都带 `.esc-root` 前缀（0,2,0）压过原语自带的那两条。
 *   ④ **「换一批」**：**样式与取数链一字未动**（它本来就只重发精选那一条取数，`esc-featured.tsx` 里有取证
 *      与反向锁）；精选**仍只显示一行**——但口径 48 重写了那条机制（旧写法从没锁住过，见下方网格规则
 *      上方那段"三道锁为什么是错的"）。
 *   ⑤ **维度页签**（`.esc-source-tabs`）：左移与三页签**同一条手法**、字号落到 `--esc-fs-s`
 *      （**与 `.esc-featured-title`「精选技能」那一行逐值相等**——这才是用户说的"与精选技能那一行一致"）、
 *      容器 gap 与三页签**同值**、hover 走 `label-primary`（变黑）。
 *      ★注意：①②⑤ 让**两行标签不再同档**（三页签 base-16/600 · 维度行 s-14/500）——这是本轮两条裁决的
 *      结果（一条对 workbuddy 的页签、一条对"精选技能"那个标题），门禁那条"两行逐值相等"的旧不变量
 *      已随之换成"各等于自己的参照物 + 两行 gap 仍相等"。
 *   ⑥ **二级分类**：hover 与选中**走同一对声明**（同一枚底色 + 同一枚字色 + 同一档字重），
 *      旧的"hover 只换字色"那条一并撤下；容器 gap 由字面 8px 改成**刻度变量** `--esc-sp-md`（真源仍是 8px）。
 *   ⑦ **卡片那枚「+」**：`color` 由 `label-secondary` 提到 `label-primary`（近黑）；
 *      静止态已是近黑 ⇒ 原先那条 `:hover` 成**空转的插值**，按本页"只声明真正会变的属性"那条纪律一并撤掉。
 *   ⑧ **滚动**：桌面档滚动面由 `.esc-scroll`（列表那口小格子）提到 `.esc-content` ⇒ 工具栏右块/精选/维度/
 *      二级分类与卡片**一起滚**（这才是"全页"），只有「三页签 + 右块」那一行以 `.esc-tabs-freeze`
 *      （`position: sticky; top: 0`）固定不动；**移动档显式 `position: static` opt-out**，
 *      既有那条「整页单滚动面」裁决逐条保持（见下方那条 @media 里的说明）。
 *   ⑯ **★口径 48（用户实机裁决「现在成2列了，而且精选的卡片内容有点错乱」——两处各一条根因）**：
 *      ① **精选那一行从没真的"只排一行"**：旧机制三条声明自相矛盾（详见下方网格规则上方那段记录）——
 *         `grid-template-rows: 1fr` 只定**第一行**（隐式行照样生成），
 *         `grid-auto-rows: var(--esc-card-min-h)` 把**第二行起**钉成 84px，而真实卡片自然高约 121px
 *         ⇒ 第二行起的每张卡都**溢出自己的轨道约 37px、压进下一行**（用户截图实测：行距 137 = 121+16、
 *         之后 100 = 84+16），这就是"精选的卡片内容错乱"；`overflow: hidden` 挂在高度自适应的容器上
 *         一枚都裁不掉（容器高度 = 四行轨道之和）。新机制见下方规则：第一行 `auto`（卡片自然高）、
 *         隐式行 `0`、`row-gap: 0`、`overflow: hidden` + `overflow: clip`（后者让容器不是滚动容器，
 *         键盘焦点也带不动它）——多出来的卡片仍**在 DOM 里**，换一批的数据通路一字未动。
 *      ② **列宽基准 500 → 320**：算式与合法区间记在 `esc-scale.ts` 的 `WB.grid.minColumn` 那一格上方
 *         （1377.7px 内容区：500 ⇒ 2 列 680.2/枚；320 ⇒ 4 列 332.4/枚）。
 *   ⑰ **★本刀（用户已裁决的三枚杠杆 A / B / E —— 另两枚 C/D 明确否决，故不在本刀范围）**：
 *      前提：两页在**同一尺寸**窗口（1710×1006）实测，逐项差异见 `analysis/esc-vs-workbuddy-diff.md`
 *      （WorkBuddy 自己的 SPEC 记的是**弹窗形态**，故页面级数字一律取实机读数）。
 *      · **A 桌面档字号 +1px（一处杠杆）**：`--esc-fs-delta-base: 1px` 作基准、`--esc-fs-delta` 读它；
 *        compact 档由"替换 delta"改成 `calc(base + clamp(...))`（**相加**，视口自适应一字未丢）。
 *        为什么：WB 实机每处字号大一档（同字「专家」15.3 vs 14.2、「全部」13.1 vs 12.0，−7%…−15%），
 *        而 15/17 这一档在 DSH 官方阶梯里**不存在** ⇒ 唯一可动的就是那枚 delta。八档全派生自它
 *        ⇒ 全体同加一个数、**层级关系不变**（门禁有源码级锁盯着这一条）。
 *      · **B 卡片内衬 24/20 → 20/16**：SPEC §4.2 逐字 `padding: 16px 20px`；实测 DSH 卡高 119.0、
 *        WB 110.3（+8.7）；纵向上下各减 4px ⇒ 卡高 −8 ⇒ **≈111**。`--esc-card-min-h: 84px` 不动，
 *        标签行**内容与格数不动**（那是被否决的杠杆 D）。若真机仍 >112，只允许把标签行**自己的盒子**
 *        压薄一点点（`.esc-card-tags` 的 padding-top 6 → 4），不重构卡片、不改两行截断（被否决的 E'）。
 *      · **E 搜索框 180 → 220**：SPEC §3.2 `.search { width: 220px; height: 32px }`。桌面档一行仍不换行
 *        （1710 窗口容器 1377.7：三页签 ≈210 + 右块 ≈350 < 1377.7）；窄屏两档（560px 的 160px、
 *        compact 档的 auto + flex: 1 1 0 + 下限 88）一字未动，故窄断点没有新增横向溢出。
 *      门禁：本刀把三处**按设计**重新基线化（旧 0px / 24/20 / 180 三个数就是被裁决改掉的），
 *      并新增四条锁（八档派生自同一 delta、card 内衬与 WB 同值、搜索宽与 WB 同值、桌面一行装得下）。
 *   ★**用户裁决（读不到 ⇒ 0）**：**删掉** `.esc-installed-failed` 那一条（"读不到已装清单"时另出的
 *   橙色「？」，`margin-left: 2px` + `state-warn-primary` + `cursor: help`）——计数位现在恒画 `(N)`、
 *   读不到就画 `(0)`（与真 0 同形），如实交代改由按钮自己的 `title` 承担，那一格再无元素使用。
 *   删的是一条**死规则**，`.esc-installed` / `.esc-installed-count` 与全部几何（110×32、右边界、字号）
 *   **一个字节都没动**；CSS 模板内仍是零反引号（本刀的注释只用「」引号）。
 *   ★**口径 54（本刀）**：新增一条 `.esc-installed-discovering`（已安装子页页头那句「还在发现中」：
 *     `--esc-fs-xs` + 20px 行高 + `--dsw-alias-label-tertiary`）—— **两个 token 都是既有的**，
 *     卡片几何与本页其它规则一个字节没动；模板内反引号计数仍为 **0**。
 *   ★**口径 56（本刀：二级分类胶囊文字在灰底里居中 —— 真机像素缺陷）**：
 *     用户原话「全部那行分类标签的标签文字没有居中」——技能页/专家页那行二级分类
 *     （`.esc-category-tabs` 里的胶囊，「全部／Agent／经营管理」）选中/悬停时那层灰底里文字**贴左**、
 *     右侧空一块。**根因**：口径 35④ 把这一行的左内衬**刻意归零**（四值内衬左值为 0），
 *     为的是让分类**文字**与下面卡片的左边界对齐；代价是灰底只往右长 8px。
 *     **沿革（用户两次反馈的取向变化，如实记录）**：
 *       ① **口径 35④**：用户先要「这行更紧凑」⇒ 容器 gap 一路收到 --esc-sp-sm(6)、并把左内衬**归零**
 *          （视觉左边距 = 内容区 padding = 卡片左边界，这正是"对齐"的初衷；代价：灰底里文字贴左）。
 *       ② **口径 56 第一版**：用户报「标签文字没有居中」⇒ 内衬改成**左右对称**的一枚新刻度
 *          --esc-cat-pad，多出来的那半个左内衬由容器负外边距整行拉回。那一版把口径取成
 *          「口径 35④ 的历史组成」14px（= 右内衬 --esc-sp-md 8 + 容器 gap --esc-sp-sm 6）
 *          ⇒ 内衬只反解出 **4px**，**真机上依然太紧**（用户第二次反馈：文字贴边、不像"在标签中间"）。
 *       ③ **本刀 = 口径 56 第二版（重基线：只改口径，不改手法）**：用户看得还是太紧、明确要"往
 *          WorkBuddy 靠" ⇒ 把那一格口径 token 重新基线到 WB **实机实测值**，其余结构性手法
 *          （对称内衬 + 容器负外边距补偿 + 恒等式）**一字不动**。
 *     **本刀怎么修**（三条同时成立，缺一不可；口径 35④ 的"对齐"初衷一个字都没丢）：
 *       ① 胶囊内衬仍是**左右对称**的一枚刻度 `--esc-cat-pad`
 *          （= (--esc-cat-label-pitch − --esc-sp-sm) / 2 = (30 − 6) / 2 = **12px**）
 *          ⇒ 文字在灰底里水平居中；
 *       ② 多出来的那半个左内衬仍由容器 `margin-left: calc(0px - var(--esc-cat-pad))` **整行拉回**
 *          ⇒ 首枚**文字**的 x 与口径 35④ 逐像素相同（与卡片左边界那条对齐纪律不丢）。
 *          口径 35④ 那句"负 margin 与内衬归零只能选其一"说的是**并存会多减一次**；
 *          本刀是**换成**负 margin（内衬不再归零），不是两套叠加。
 *       ③ 内衬**仍不写死**，而是从文字间距口径 `--esc-cat-label-pitch` 与容器**实际**用到的 gap
 *          刻度**反解**出来 ⇒ 恒等式 **2 × --esc-cat-pad + 容器 gap ≡ --esc-cat-label-pitch**
 *          （2×12 + 6 = 30）由构造保证；门禁按 token 逐值复算，并有一条**形式锁**钉住"反解"这个
 *          代数形态（把内衬直接写成 px 就红——这是本刀新增的加强，旧版只锁了"内衬引用 token"，
 *          而写死的 token 值能同时满足旧版全部断言）。
 *     ★口径的**出处**（WorkBuddy 实机实测，本机对 `analysis/wb-live.png` 逐像素量，口径 = 灰底 bbox
 *       与墨迹 bbox；截图 1567×922 是窗口 1710×1006 的等比缩放，换算系数 k = 1567/1710）：
 *       灰底 51.3×31.6 窗口 px、文字墨迹 26.2px、**左右内衬 ≈ 13.1 / 12.0（基本对称）**、
 *       左右偏差 ≈ +0.5px、**文字到文字口径 ≈ 29.5**（左一枚墨迹右缘 → 右一枚墨迹左缘）。
 *       ⇒ `--esc-cat-label-pitch` 取 **30px** = WB 实测 29.5 **向上取整**（只许更宽、不许更紧），
 *       内衬随之反解成 **12px**（与 WB 实测的 12.0~13.1 一致）。门禁把这一格钉在出处上：
 *       锚定 `pitch ≡ ceil(29.5)` ＋ 方向锁 `pitch ≥ 29.5`（**不许比 WB 更紧**）——这正是用户
 *       这次反馈的机器化落点。
 *     ★**横向滚动核算**（内衬 4 → 12 会让这一行变宽，先算再改）：技能页那排 **13 枚**（v7-disk-truth.png
 *       逐枚墨迹 bbox）Σ墨迹 ≈ 626.4px、gap 12×6 = 72、旧内衬 13×8 = 104 ⇒ 行盒 ≈ 802.4px；
 *       新内衬 13×24 = 312 ⇒ 行盒 ≈ **1010.4px**，而这一行可用宽 = 内容区 1377.7 + 负外边距 12
 *       = **1389.7px** ⇒ **仍在一行内，未触发横向滚动**（余量 ≈ 379px；再多一枚平均宽度的标签
 *       也只 +≈78px，仍在预算内）。窄屏档必然横向滚动，那是**既有**行为（这一行一直是
 *       flex-wrap: nowrap + overflow-x: auto），不是本刀引入的降级。
 *     颜色/字号/字重/圆角/行高/选中与 hover 那几条规则、以及**垂直居中**（height + align-items: center
 *     + line-height: 1，真机实测上 13.1 / 下 12.4 本来已居中）**一字未动**——本刀只动口径那一格 token
 *     （内衬与负外边距都从它反解、与它同源，故数值跟着变，但那两条声明本身一字未改）。
 *     ★**窄屏档（@media max-width: 560px）那条既有的「gap: 3px」本刀一个字不动**：它只覆盖 gap，
 *     不碰内衬与负 margin ⇒ 居中与对齐在**所有档**成立；那一档 2p + g = 27 ≤ 基档口径 30，
 *     比基档**更紧**。门禁有一条**逐档扫描**同时锁住这两件事
 *     （每一档 2p+g ≤ 口径、且除基档外不许有任何规则碰 padding / margin-left）。
 *     ★**真机像素仍由 Lead 复量**：上面 WB 的读数是本机对那张截图的像素测量；"口径放宽之后本页
 *     真机上是否与 WB 同观感、是否真的不滚动"本层不冒充量过。
 *     模板内反引号计数仍为 **0**（本刀新增注释只用「」引号）。
 *  * **口径 53（本刀）**：新增三块规则——① `.esc-card-meta` / `.esc-card-lock`（卡片元信息行与
 *    "那枚【＋】为什么按不动"的行上可见原因；两者**缺席即不进 DOM**，另几档的渲染一字未变）；
 *    ② `.esc-catalog-*`（企业技能维度内容区：标题/说明/状态/降级/空/重试/失败格）。卡片网格**复用**
 *    `.esc-list-section`（与另几维同一份列模板与间距）、色值一律走既有 `--dsw-*` token
 *    （**一个新 token 名都没加** ⇒ 审计 `--strict` 仍 `dead 0`）；本刀新增注释**零反引号**。
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
/* ══════════════ 本刀：字号改走**官方主题 token**（不再裸写 px）══════════════
 * 官方字号标尺七档（dsh-client-ui-theme，0.1.7-rc.2 与 0.2.0-rc.2 两个基线都在）：
 *   xxxs 11/14 · xxs 12/18 · xs 13/20 · s 14/22 · base-16 16/24 · l-20 20/28 · xl-24 24/32
 *
 * ★**为什么包一层本地变量，而不是把 font-size 直接写成 var(--dsw-font-*)**：
 *   官方那七档是**固定 px**，**不跟随壳的「字体大小」设置**（只有 markdown 系那三枚跟随）。
 *   而本仓上一刀（口径 39 那一族）已经把整页字号接上了两个 delta：
 *   --dsh-content-font-delta（壳的用户设置）与 --esc-fs-delta（本页的视口自适应）。
 *   直接换成官方 token ⇒ **丢掉那两个 delta**，移动端缩放与无障碍字号一起失效。
 *   故取「两者叠加」：基准取官方 token（层次与官方永远一致），
 *   **再把两个 delta 加上去**（壳设置 + 视口自适应都还在）。
 *   —— 换句话说：**基准来自官方、缩放来自本仓**，各管一段，不互相覆盖。
 */
.esc-root {
  min-height: 0; background: var(--dsw-alias-bg-base);
  display: flex; flex-direction: column; height: 100%;
  /* ══════════════ 本刀 A：桌面档字号 +1px（全局**一处**杠杆）══════════════
   * ★**为什么桌面档现在带 +1px**（实测，不是拍脑袋）：同一台 1710×1006 窗口下逐字量「墨高」
   *   （一段文字最深像素的上下跨度，同字体下 ≈ 0.86–0.89×字号），WorkBuddy 实机每一处都比本页大
   *   一档：同字「专家」15.3 vs 14.2、「全部」13.1 vs 12.0、「换一批」12.0 vs 10.9 ⇒ 系统性小
   *   7%–15%。根因**不是"照抄没照对"**：WorkBuddy 那些值（≈14.5 / ≈15.3 / ≈17.8）在 DSH 的官方
   *   字号阶梯里**根本不存在**（官方只有 xxxs 11 / xxs 12 / xs 13 / s 14 / base 16 / l 20 / xl 24，
   *   缺 15 / 17 那一档）⇒ 没有那个数可抄。既然八档变量都写成
   *   calc(官方 token + --dsh-content-font-delta + --esc-fs-delta)，**唯一能补上这半档的就是
   *   --esc-fs-delta 本身**：把它从 0px 提到 +1px。
   * ★**不变量（本杠杆的全部意义）**：八档 --esc-fs-* 全部读 var(--esc-fs-delta)，故桌面档
   *   提升的是**同一个数** ⇒ 全体字号同加 1px，**层级关系一字不变**（11 与 18 的相对关系不因
   *   缩放而变），也不会挑动任何一处"这一格该用哪一档"的裁决。门禁里有一条源码级锁盯着这件事：
   *   八档**每一档**都必须仍然派生自 var(--esc-fs-delta)。
   * ★**compact 档不许丢**：原来的视口自适应（clamp(-1.5px, (100vmin-400px)*0.007, 1.5px)）从
   *   "替换 delta"改成**加在基准之上**（见下面那条 @media 里的 calc）——基础 +1px 与视口项**相加**，
   *   而不是二选一；窄屏该缩还是缩，只是缩的基准抬高了一档。
   * ★**为什么拆成 base + delta 两枚**：门禁要能分别断言"桌面档 = +1px"与"compact 档 = +1px 再叠
   *   视口项"，而 delta 这一枚同时是八档公式里的那一枚（不许另起第二个变量名去当加法项）。
   * ⚠本文件整体在一枚模板字符串内 ⇒ 注释里**不许出现反引号**（会截断字符串，本页踩过两次）。 */
  --esc-fs-delta-base: 1px; --esc-fs-delta: var(--esc-fs-delta-base);
  --esc-grid-cols: minmax(0, 1fr);
  /* ── 字号八档 = 官方 --dsw-font-* + 两个 delta（壳字号设置 + 视口自适应）── */
  --esc-fs-xxxs: calc(var(--dsw-font-xxxs-11-font-size) + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px));
  --esc-fs-xxs: calc(var(--dsw-font-xxs-12-font-size) + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px));
  --esc-fs-xs: calc(var(--dsw-font-xs-13-font-size) + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px));
  --esc-fs-s: calc(var(--dsw-font-s-14-font-size) + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px));
  --esc-fs-base: calc(var(--dsw-font-base-16-font-size) + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px));
  --esc-fs-label: calc(var(--dsw-font-s-14-font-size) + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px));
  --esc-fs-l: calc(var(--dsw-font-l-20-font-size) + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px));
  --esc-fs-xl: calc(var(--dsw-font-xl-24-font-size) + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px));
  /* ── 间距六档（唯一真源：WB.space）── */
  --esc-sp-xs: 4px; --esc-sp-sm: 6px; --esc-sp-md: 8px;
  --esc-sp-base: 12px; --esc-sp-lg: 16px; --esc-sp-xl: 20px; --esc-sp-xxl: 24px;
  /* ── 二级分类那一行胶囊的两枚几何真源（口径 56 · 真机像素缺陷修复）──
     ★用户原话「全部那行分类标签的标签文字没有居中」：选中/悬停那层灰底里，文字贴着左边、右侧空一块。
     根因是口径 35④ 的「左内衬归零」写法（四值内衬的左值为 0）——那一刀的意图是让分类**文字**与
     下面卡片的左边界对齐（这个初衷**必须保住**），代价就是灰底只往右长 8px、文字落在灰底最左。
     ★**沿革（用户两次反馈的取向变化）**：① 口径 35④ 用户先要「这行更紧凑」⇒ 容器 gap 收到
     --esc-sp-sm(6) 并把左内衬归零；② 口径 56 第一版用户报「文字没有居中」⇒ 内衬左右对称化，
     口径取「历史组成」14px ⇒ 内衬只反解出 4px，**真机上依然太紧**（用户第二次反馈：文字贴边、
     不像"在标签中间"，明确要往 WorkBuddy 靠）；③ **本刀 = 口径 56 第二版：只改口径、不改手法**——
     那一格口径 token 重新基线到 WB 实机实测值，对称内衬 / 容器负外边距补偿 / 恒等式三条结构一字不动。
     ★口径 56 三条同时成立（缺一不可）：
       ① **左右内衬对称**（--esc-cat-pad）⇒ 文字在灰底里水平居中（同一枚胶囊左右内衬相等）；
       ② 对称之后多出来的那半个左内衬，用容器「margin-left: calc(0px - var(--esc-cat-pad))」
          把**整行**拉回去 ⇒ 首枚**文字**的 x 与口径 35④ 逐像素相同（对齐卡片左边界不丢）。
          用负 margin 而不是"再削内衬"：削内衬只会把文字挪回去、灰底依旧不对称，等于没修；
          而"容器负 margin + 对称内衬"同时满足居中与对齐两件事（口径 35④ 那句"两套手法只能选其一"
          说的是"负 margin 抵消 + 内衬归零"并存会多减一次，本刀是**换成**负 margin，不是叠加）。
       ③ 内衬**不写死**，而是从文字间距口径 --esc-cat-label-pitch 与容器**实际**用的 gap 刻度
          **反解**出来（--esc-cat-pad = (pitch − --esc-sp-sm) / 2 = (30 − 6) / 2 = 12px）
          ⇒ **基档**（默认档）的恒等式 **2 × --esc-cat-pad + 容器 gap ≡ --esc-cat-label-pitch**
          （2×12 + 6 = 30）由构造保证，门禁再按 token 逐值复算一遍，另有一条**形式锁**钉住这条
          反解式本身（把内衬写成 px 字面就红——旧版只锁"内衬引用 token"，写死的 token 值能骗过它）。
          ⚠**窄屏档是既有裁决、本刀不动**：下面 @media (max-width: 560px) 里这一行另有一条「gap: 3px」
          （"它比上面两行更紧"那条实测裁决）⇒ 那一档 2p + g = 27 ≤ 基档口径 30，**更紧**；
          **内衬与对齐补偿全档一致**——那条媒体规则只覆盖 gap，一个字都不碰 padding / margin-left
          ⇒ 居中与对齐不因视口而变（门禁有一条逐档扫描把这两件事一起锁住）。
     ★--esc-cat-label-pitch 取**字面 30px**，出处是 **WorkBuddy 实机实测**（不是拍的，也不是从旧口径推的）：
       analysis/wb-live.png 那枚「全部」胶囊按「灰底 bbox 与墨迹 bbox」量得 —— 灰底 51.3×31.6 窗口 px
       （截图 1567×922 ÷ 窗口 1710×1006，k = 1567/1710）、墨迹 26.2px、左右内衬 ≈ 13.1 / 12.0、
       **文字到文字口径 ≈ 29.5**（左一枚墨迹右缘 → 右一枚墨迹左缘）。
       ⇒ 取 **30** = 29.5 **向上取整**（只许更宽、不许更紧）；内衬随之反解成 12（与 WB 实测 12.0~13.1 一致）。
       门禁把这一格钉在出处上：**锚定** pitch ≡ ceil(29.5) ＋ **方向锁** pitch ≥ 29.5（不许比 WB 更紧）。
       ⚠这一格必须写成**字面 px**（不许 calc 二次派生）：恒等式两侧若同源，刻度漂移会一起漂、谁都咬不住；
       门禁有一条"口径必须是字面 px"的锁盯着它（旧版那条"pitch ≡ --esc-sp-md + --esc-sp-sm"的历史组成
       锚定已按用户这次反馈**有意废止**——它恰好把"太紧的 4px 内衬"锁成了合法）。
     ⚠**横向滚动核算**（内衬 4 → 12 会让这一行变宽，先算再改）：技能页那排 **13 枚**
       （v7-disk-truth.png 逐枚墨迹 bbox）Σ墨迹 ≈ 626.4px、gap 12×6 = 72、旧内衬 13×8 = 104
       ⇒ 行盒 ≈ 802.4px；新内衬 13×24 = 312 ⇒ 行盒 ≈ **1010.4px**，这一行可用宽 = 内容区 1377.7
       + 负外边距 12 = **1389.7px** ⇒ **仍在一行内、不触发横向滚动**（余量 ≈ 379px）。窄屏档必然
       横向滚动，那是既有行为（这一行一直是 flex-wrap: nowrap + overflow-x: auto），不是本刀引入的。 */
  --esc-cat-label-pitch: 30px;
  --esc-cat-pad: calc((var(--esc-cat-label-pitch) - var(--esc-sp-sm)) / 2);
  /* ── 圆角与控件几何（唯一真源：WB.control / WB.card / WB.grid）── */
  --esc-radius-sm: 6px; --esc-radius-md: 8px; --esc-radius-card: 16px;
  --esc-tab-h: 30px; --esc-tab-px: 16px;
  --esc-field-h: 32px; --esc-field-radius: 6px;
  /* ★**本刀 E：搜索框定宽 180 → 220**（用户裁决）。
     真源：WorkBuddy UI-SPEC §3.2 的 .search { width: 220px; height: 32px }（逐字）。
     ★**沿革**：220（移植原值）→ 180（口径 47"搜索框窄一点"）→ **回 220**（本刀）：那一刀当时是
     为了给同排放大的「已安装 / 添加技能」让宽，而本刀已把右块两枚的几何收回控件档（32/8），
     让出来的宽度正好还回去 ⇒ 桌面档这一行仍不换行（1710px 窗口实测容器 1377.7）。
     窄屏那一档由下面 @media 的 width: 160px 与 compact 档的 width: auto + flex: 1 1 0 接管
     （都在本文件里更靠后 ⇒ 同特异性下后者胜），故 220 只在桌面档生效、不会造成窄屏溢出。
     ★**只改这一枚变量**：.esc-search 那条规则仍只写 width: var(--esc-search-w)，
     不写任何字面 px（"改一处、全页同步"，门禁里有与 WB.control.search.width 的恒等式）。 */
  --esc-search-w: 220px;
  /* ★本刀第 ② 条：「添加技能」主按钮放大一档 —— 由原语 size:'sm'(h28/pad10) 升到
     size:'md'(h36/pad14，真源 WB.control.button = 官方 Button.module.css 的 .md 逐字)。
     它比同行的次级控件（--esc-field-h 32）高 4px，是 workbuddy 那张图里"最重的一枚"那一眼。
     圆角随原语 md 档走（18px 胶囊形，官方 figma 就是 18）——本页不再另压圆角，让原语自己那一档说话。 */
  /* ★本轮第 ⑦ 条：「添加技能」**再收一档**（用户原话「高度小一点、圆角小一点」）：
     官方原语 md 档的真值 36/14/18 是当初为"全页最重的一枚主按钮"设计的；用户在真机上要的是
     "别那么高、别那么圆" ⇒ 收到**控件档** 32（= 同行的 --esc-field-h，与搜索框/「已安装」同高）
     / 圆角 8（= --esc-radius-md）。★「已安装」那枚自绘按钮吃**同一个** --esc-btn-radius ⇒
     "两枚圆角一致"仍由这一格保证（现在两者都是 8，整条右块读起来是同一族控件）。
     真源仍是 WB.control.button（esc-scale.ts），改一处全页同步。 */
  --esc-btn-h: 32px; --esc-btn-px: 14px; --esc-btn-radius: 8px;
  /* ★**口径 51**：「我的专家」子页那枚「+ 创建专家」在 WorkBuddy 实机里是**整圆胶囊**
     （黑底 pill），与工具栏主按钮的 8px 圆角**不是同一档** —— 故单独一格刻度，
     免得下一个人"顺手统一"成 --esc-btn-radius 而把那枚按钮的形态改掉。 */
  --esc-pill-radius: 999px;
  /* ★专家卡那枚「召唤」（本轮第 ② 条）：单开一格——它是**卡片内**次级动作，不复用工具栏那枚
     「添加技能」的 36/14/18。取 28（官方原语 sm 档真值）后与标题行（14px × 1.4）同量级，
     兑现用户那句「高度小一点、与卡片标题文字高度大致对齐」；字重 600 = 三页签那一档的 weightActive。
     真源 WB.control.summon（esc-scale.ts）。 */
  --esc-summon-h: 28px; --esc-summon-px: 10px; --esc-summon-radius: 6px;
  --esc-icon-btn: 24px; --esc-icon-btn-radius: 6px;
  /* ★**本刀 B：卡片内衬 24/20 → 20/16**（用户裁决）。
     ① **SPEC 真值**：WorkBuddy UI-SPEC §4.2 的卡片容器逐字是 min-height: 84px; padding: 16px 20px
        ⇒ 横向 20、纵向 16（我们此前是 --esc-card-px: 24 / --esc-card-py: 20，两侧都比它大一档）。
     ② **实测缺口**：同尺寸窗口下 DSH 卡高 **119.0**、WorkBuddy **110.3**（+8.7 = +8%）。
        纵向内衬上下各减 4px ⇒ 卡高恰好减 8px（119 − 8 = **≈111**，落进 110–112 的目标带），
        这就是"一处改动能补掉全部 8px"的算式来处。
     ③ **刻意不动**：--esc-card-min-h 仍是 84px（SPEC 同值）；卡片结构、标签行的**内容与格数**
        （作者 + ★ + 安装 + 使用，四格）一字不动——那是被明确否决的杠杆 D。
        横向 24 → 20 会把卡片内文字可用宽每侧多让 4px，与栅格无关（列宽只由 --esc-grid-min/gap 决定）。
     ④ 真源仍是 esc-scale.ts 的 WB.card.paddingX/paddingY，门禁有一条恒等式比对这两处。 */
  --esc-card-px: 20px; --esc-card-py: 16px; --esc-card-gap: 12px;
  --esc-card-min-h: 84px; --esc-card-icon: 40px; --esc-card-icon-radius: 10px;
  /* ★**口径 48**：500 → **320**（用户实机「现在成2列了」，他要 4 列）。真源是 esc-scale.ts 的
     WB.grid.minColumn，两处**必须同值**（门禁有一条恒等式直接比对这两处，本仓被这对不同步咬过）。
     实算与 4 列的合法容器宽区间见下面"网格列数"那一段（W = 1377.7 / gap = 16）。 */
  --esc-grid-min: 320px; --esc-grid-gap: 16px;
}
/* 内容区内衬照官方 index.less:12 的 .content-wrapper { padding: 16px 24px }（原为 10px 16px，是"紧凑"那一刀
   遗留的缩水值，官方从来不是这个数）。 */
/* ★**本刀第 ⑧ 条**：桌面档的滚动面从 .esc-scroll（列表那口小格子）提到 .esc-content（内容区自身）——
   用户原话「除了专家/技能/连接器这一行是冻结的，其余全页滚动」。
   ⇒ 工具栏右块（更多/搜索/已安装/添加）、精选行、维度行、二级分类与卡片**一起滚**（这才是"全页"），
     只有「三页签 + 右块」那一行（.esc-tabs-freeze）以 position: sticky; top: 0 固定不动。
   ★**为什么用 sticky 而不是把它提成 .esc-content 的兄弟**（那才是"冻住"的物理做法）：sticky 的吸附
     范围是**它的包含块**，页签行提到滚动面直属子节点后包含块就是整段可滚高度 ⇒ 冻得住；
     而 .esc-content 之外再放一层会让布局多一根柱子、与"整页单滚动面"那条移动端裁决打架。
   ★**移动档必须显式 opt-out**（见本文件下方那条 @media）：那一档的既有用户裁决是"整页单滚动面、
     工具栏也一起滚"，sticky 会让页签在手机上吸顶而违反它 ⇒ 该档把 sticky 关掉。
   这两条（桌面冻结头 / 移动整页滚）是**同一句裁决在两种档位下的不同落点**，不是互相打架。 */
.esc-content { flex: 1; min-width: 0; min-height: 0; padding: 16px 24px; display: flex; flex-direction: column; overflow-y: auto; }
/* ★第 ⑧ 条：桌面档滚动面换成内容区之后，滚动条也归它管——与列表那条 .esc-scroll-hidden
   同一口径（esc 页面从不画可见滚动条；桌面档 hide 的是这口盒子）。 */
.esc-content { scrollbar-width: none; }
.esc-content::-webkit-scrollbar { display: none; }
/* ★第 ⑧ 条：**冻结头**。position: sticky + top: 0 ⇒ 随内容滚、但滚到顶后钉在内容区上缘不动。
   ★自增一条 z-index：它与下面的工具栏/精选**不重叠**（各自占行），但精选网格的 hover 抬升阴影
     （box-shadow）和卡片一样会向上溢出一点点，给一个 z-index 免得滚过时阴影盖住页签底边。 */
.esc-tabs-freeze { position: sticky; top: 0; z-index: 1; flex: none; background: var(--dsw-alias-bg-base); }

/* —— 资源类型页签（原左栏 CategorySidebar 的三项，用户裁决改到内容页左上角作药丸）—— */
/* ★本刀（用户裁决①②⑤，三行标签同一套语言）：**不要底色**——那层胶囊底是官方 Pill 的
   自带底 + 我们之前压描边时留下的观感；workbuddy 那三行标签都是**纯文字**。
   非选中走三级文字色、选中走主文字色。.esc-root .esc-pill 那条把原语底色一起压掉（见下方）。 */
/* ★用户裁决④：页签行现在**排进工具栏那一行**（与右块同排），故不再自带一整行的高度与内衬——
   否则「三页签」与「搜索/已安装/添加」之间会多出一条空白带。左右内衬交给 .esc-content 那 24px。 */
/* ★**本刀第 ① 条（用户原话「专家技能连接器更紧凑、字号字重各大一号、整体左移与卡片左边界对齐」）**：
   三个动作各自对应一处**可断言的判据**，不是一个笼统的"调一下"：
     · 字号/字重各加一档 → 走 --esc-fs-base（官方 base 16）+ 600（真源在 esc-scale.ts 的 rows.tab）；
     · 三枚之间收窄 → 容器 gap 由 --esc-sp-xl(20) 收到 --esc-sp-md(8)，**与下面维度行同值**（判据：两处 gap 相等）；
     · **左移与卡片左边界对齐** → 容器 margin-left: calc(0px - var(--esc-tab-px))（负值吃掉首枚药丸自己的
       16px 横向内衬）⇒ 首枚的**文字左缘**与**卡片左缘**（.esc-content 的 24px 内衬）逐像素对齐。
       ★为什么负 margin 而不是给药丸改 padding：药丸左右内衬对称，单独削左边会让这三枚的图标与文字
       离它的圆角盒子太近（那枚 24px 的浅灰方块仍在 24 处，只是文字右移 16）——用户要的是**整枚**左移。
       —— 选负 margin 是因为它不动药丸自身的几何（hover 态、官方原语的高亮盒都照旧对位），
       而削 padding 会让"药丸盒子"与"文字"错位，是更难修的那种坑。
       ★只抵消**首枚**那一格：容器上收负 margin 后三枚整体左移 16px，故首枚文字恰落在 24（卡片缘），
         后两枚的相对间距不变（gap 那一档管的就是它们之间的事）。 */
.esc-resource-tabs { flex: none; display: inline-flex; align-items: center; gap: var(--esc-sp-md); flex-wrap: nowrap; }
/* 字号/字重沿革（逐条用户裁决，每次都只改"这一档"）：官方 Pill 原值 13px/400 → 15px/600（① 三行标签统一）
   → 17px（⑦"三页签再大一号"）→ 20px（真图对齐）→ 18px（"工作空间小一号"）→ **16px / 600**（本刀第①条
   "字号与字重各加一档"：字重 500→600 是那一档，字号由 18 降到 16 换的是**与下面两行同档**这一条）。
   ★档位真源在 esc-scale.ts 的 rows.tab，这里只声明"走 --esc-fs-base"；字重 600 与官方 Pill 的
     weightActive 同值（WB.control.tab.weightActive）。本行与维度行（.esc-source-tabs .esc-pill）
     **必须继续逐值相等**——它们是同一套视觉语言（判据：两处 font-size/weight/line-height 提取后直接比对，见 spec）。 */
.esc-resource-tab { height: var(--esc-tab-h); padding: 0 var(--esc-sp-md) 0 0; display: inline-flex; align-items: center; gap: 6px; background: none !important; box-shadow: none !important; border: 0; border-radius: 0; font-size: var(--esc-fs-base); font-weight: 600; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s; }
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
/* ★本刀第 ⑧ 条：工具栏**体**（精选/维度/二级分类）现在随内容一起滚（整页滚），
   故它自己**不再是钉死的那一格**：去掉 flex-shrink: 0 的语义、让它跟着内容高度走；
   margin-bottom: 16px 保留（与"工具栏紧跟页签行"那条旧裁决对应的分隔，本刀没改行序/间距）。
   ★它现在是 .esc-content 的**直属子节点**（不再嵌套在 .esc-toolbar 里，见 esc-toolbar.tsx 的拆分理由）。 */
.esc-toolbar { flex: none; margin-bottom: 16px; }
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
/* ★本刀第 ⑤ 条（用户原话「系统广场/团队空间/我启用的：左移与卡片左边界对齐、字号与「精选技能」
   那一行一致、三枚之间间隔紧凑些与上面那行一致、hover 变黑」）：四件事四条判据。
   · 字号：走 --esc-fs-s（官方 s 14）——★**与 .esc-featured-title（「精选技能」那一行）逐值相等**
     （这条就是用户说的"与精选技能那一行一致"；门禁按"两处提取后比对"锁，不各写一条 toMatch）。
   · 间隔：容器 gap 与 .esc-resource-tabs **同值**（--esc-sp-md）——即"与第 ① 条那行一致"。
   · 左移：与三页签**同一条手法**（margin-left: calc(0px - var(--esc-tab-px)) 抵消首枚药丸的横向内衬），
     ⇒ 首枚文字左缘落在 .esc-content 的 24px = **卡片左缘**。
   · hover 变黑：:hover 走 --dsw-alias-label-primary（与选中同一枚）——此前 hover 落在
     secondary/tertiary 一带，真机上是"只是略深"、读不出可点。
   ★不参与压缩（flex: none）——标签永不被压。 */
.esc-source-tabs { display: flex; align-items: center; gap: var(--esc-sp-md); margin-top: var(--esc-sp-lg); flex: none; flex-wrap: nowrap; }
.esc-source-tabs .esc-pill { height: var(--esc-tab-h); padding: 0 var(--esc-sp-md) 0 0; display: inline-flex; align-items: center; background: none !important; box-shadow: none !important; border: 0; border-radius: 0; font-size: var(--esc-fs-s); font-weight: 500; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s; }
/* ★本刀第 ⑤ 条：**hover 变黑**（与选中同色）——此前 hover 只到 secondary 一带，真机上是"略深"而非"变黑"。 */
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
   窄屏那一档（下面 @media）再收到 160px；**不再伸缩**，避免又把右块撑开。
   ★**本刀 E（用户裁决）**：180px → **220px**（真源 --esc-search-w，见 .esc-root；SPEC §3.2 逐字）。
     —— 口径 47 那条"窄一点"（220→180）**已被本刀取代**：它当时是为了给同排放大的两枚按钮让宽，
     而本刀把「已安装 / 添加技能」收回控件档（32/8）⇒ 让出来的宽度正好还给搜索框，桌面档仍不换行。 */
/* ★**本刀第 ③ 条第二半（用户原话「聚焦时的边框用灰色，比现在深一点即可」）**：
   ★**先看官方真值**（dsh-client-ui-primitives/lib/Input.module.css 逐字）：
     .wrap { border: 0.5px solid var(--dsw-alias-border-l4) }   ← 静止态已是阶梯**最深**那一档（16% 黑）
     .wrap:focus-within { border-color: var(--dsw-alias-brand-primary) }  ← 聚焦变成**品牌近黑**
   于是真机上的观感是"一聚焦就跳成近黑"——用户要的是**灰色**、只比静止态**深一点**。
   ⇒ 这一刀把两者**对调**成一条自己的阶梯（都取自真实存在的边框 token，不是硬编码色）：
     · 静止态收浅一档到 --dsw-alias-border-l2（#0000001a ≈ 10% 黑，深色反相 #ffffff1f）——
       官方那 0.5px 也一并补成 1px（本仓 esc 子树有自己的 box-sizing 重置，且用户先前明确要"看得见的边框"，
       与卡片那条同一条纪律；不补的话静止态那圈发丝线在 dpr 2.75 的屏上会断续）；
     · 聚焦态**变灰**：--dsw-alias-border-l4（#00000029 ≈ 16% 黑）——**比静止态深一档，且仍是灰**。
   ★为什么是 l4 而不是 l3：用户说"深一点即可"，而官方静止态本来就是 l4 ⇒ 聚焦若取 l3（#0000001f）
     反而比原来的静止态**更浅**，那就不是"深一点"而是"浅一点"了。取 l4 是这条灰阶梯上
     **既存在、又确实是灰**的最后一档，再深就该越到近黑（那就回到"品牌色/纯黑"那一档，不是用户要的）。
   ★为什么压过官方那两条：官方是 .wrap（0,1,0）；这里两条都用 .esc-root .esc-search（0,2,0）提特异性，
     不靠 !important、不靠加载顺序。官方是 :focus-within（0,2,0，同特异性）⇒ 故聚焦那条必须也带
     .esc-root 前缀才能赢，本文件里它更靠后，同样赢。 */
.esc-search { width: var(--esc-search-w); height: var(--esc-field-h); flex: none; min-width: 0; max-width: none; border-radius: var(--esc-radius-sm); }
/* ★静止态那条也带 .esc-root 前缀：官方 .wrap 是单类 (0,1,0)，而**官方那份 CSS 由原语自己注入、
   加载顺序不由本文件决定** ⇒ 只写单类是不可靠的（同 .esc-root .esc-pill { box-shadow: none } 那条既有先例）。 */
.esc-root .esc-search { border: 1px solid var(--dsw-alias-border-l2); }
.esc-root .esc-search:focus-within { border-color: var(--dsw-alias-border-l4); }
/* 「更多」现在是一枚**真超链接**（用户裁决指向 https://skillhub.cn/）⇒ 补 text-decoration: none 保持原观感；
   原来那条 .esc-more:disabled 随"置灰"写法一起撤掉（它不再是按钮）。 */
.esc-more { flex-shrink: 0; font-size: var(--esc-fs-xxs); color: var(--dsw-alias-label-tertiary); white-space: nowrap; background: none; border: 0; padding: 0; font-family: inherit; cursor: pointer; text-decoration: none; }
/* ★口径 35⑤：accent-primary 这个名字 **在 dsh 主题里不存在**（403 枚 token 里查无此名，带上 --dsw-alias-
   前缀写出来就是计算期无效）⇒ 这条 hover 色一直没生效，官方那枚是 @colorPrimary。改用真名 brand-primary。 */
.esc-more:hover { color: var(--dsw-alias-brand-primary); }
.esc-more-hidden { visibility: hidden; pointer-events: none; }
/* 官方 ResourceToolbar/index.less:41 是 margin-top: 14px（原 8px）。 */
/* ★本刀（用户裁决⑤）：维度标签这一行与顶栏三页签**同一套视觉语言**（无底色、字号字重各加一档、
   非选中灰 / 选中黑）；.esc-source-tabs 里的每一枚都挂这条。 */
/* ★用户裁决：二级分类同样走**凹槽型**（与前两行同一形态）。 */
/* ★本刀（用户原话「全部那行分类标签之间间距紧凑些」）：容器 gap 20px → **8px**。
   ★**本轮（用户原话「更紧凑」）把这行单独再收一档 → --esc-sp-sm（6）**：
   真机实测两行的视觉间距是**不同**的 —— 三页签那一行块间约 25px（那是两个带图标的**块**），
   二级分类那行约 10~20px（那是纯文字短标签）。用户只要求"更紧凑"、**没说两行相同** ⇒
   故本行取 6，而上面两行仍取 --esc-sp-md（8）：**两行的 gap 刻意不相等**，
   若日后有人"顺手对齐"成同一个值，那正是把实测事实抹平的那一刀。
   ★**口径 56（本刀）**：这一格仍是「--esc-sp-sm」（6）**一字未改**——文字间距口径
   --esc-cat-label-pitch（本刀按 WB 实测重基线成 30）减去胶囊两枚对称内衬（2 × --esc-cat-pad = 24）
   之后剩下的正是 6 ⇒ gap 与内衬是一对**互相反解**的数，改任何一枚都会让**基档**的恒等式对不上
   （门禁按 token 复算）。**内衬 14→30 的重基线落在口径那一格 token 上，这一格的声明一个字没改。**
   ★**窄屏档例外（既有裁决，本刀一个字不动）**：@media (max-width: 560px) 里这一行另有一条
   「gap: 3px」（"它比上面两行更紧"那条实测裁决）⇒ 那一档 2p + g = 27 ≤ 30：更紧，不回退；
   **那条媒体规则只覆盖 gap，不碰内衬与负 margin** ⇒ 居中（对称内衬）与对齐（补偿）在**所有档**成立。
   ★另加一条**负外边距**：把加了对称内衬之后多出来的那半个左内衬整行拉回去
   （补偿值 === 内衬值，同一个 token，不许写死），首枚文字仍落在卡片左边界上。 */
.esc-category-tabs { display: flex; align-items: center; gap: var(--esc-sp-sm); margin-top: var(--esc-sp-lg); margin-left: calc(0px - var(--esc-cat-pad)); flex-wrap: nowrap; overflow-x: auto; }
/* ★本刀（用户裁决⑥）：二级分类用**小圆角**——workbuddy 那排分类是近乎方角的短标签。 */
/* ★用户裁决（本轮，真机）：「一级二级分类标签再小一号」——一级（全部/Agent/经营管理…）与二级
   （选中一级后展开的子分类）**同挂这一类**（渲染点只有 esc-toolbar.tsx 一处），故一档改完两级同时生效。
   ★**本轮再收一档**：14 → **--esc-fs-xs**（官方 xs 13），兑现用户那句「那行字体小一号」
   （字重/行高/选中灰底都不动，只收字号这一档）。
   ★**口径 56（本刀）：左内衬不再是 0**——「左内衬归零」正是用户这次报的缺陷根因
   （选中/悬停那层灰底里文字偏左，右内衬 8px 全空在右边）。内衬改走**左右同一枚** token
   「--esc-cat-pad」（两值语法的水平分量天然左右相等），那是"文字在灰底里居中"的**充分且必要**条件：
   只要左右内衬相等，文字（唯一子节点、inline-flex 居中）到两边的距离就必然相等。
   ★**本刀（口径 56 第二版）**：这一条声明**一个字没改**——用户第二次反馈"还是太紧"改的是**口径**
   那一格 token（14 → 30，出处见 .esc-root 里那段），内衬由反解式跟着变成 12px（WB 实测 12.0~13.1）。
   ★垂直方向**一个字节都没动**（height: var(--esc-tab-h) + align-items: center + line-height: 1，
   真机实测上下 13.1 / 12.4 本来就已经居中）——内衬只动水平分量，「padding: 0 …」的垂直 0 保持不变。 */
.esc-category-tabs .esc-pill { height: var(--esc-tab-h); padding: 0 var(--esc-cat-pad); display: inline-flex; align-items: center; background: none; box-shadow: none; border: 0; border-radius: var(--esc-radius-sm); font-size: var(--esc-fs-xs); font-weight: 500; line-height: 1; color: var(--dsw-alias-label-secondary); transition: color .15s, background .15s; }
/* ★**本刀第 ⑥ 条（用户原话「全部/Agent/经营管理…那一行，hover 与选中效果一致」）**：
   此前 hover 只换**文字色**、选中才有那层**灰底** ⇒ 两者观感是两件事（hover 时那枚标签"亮一下字"，
   选中时"整块压灰"），指针移上去与点下去读起来不像同一个控件。
   现在 hover 与选中**走同一对声明**：同一枚底色 interactive-bg-hover + 同一枚字色 label-primary
   + 同一档字重 600（字重也一并对齐：只对底色不改字重的话，hover 与选中仍差半个层级）。
   ★顺序纪律：这条 :hover 必须**在** [data-esc-selected] 那条**之前**吗？——不，两者选择器互斥
   （hover 可以落在选中的那一枚上），故后写的选中规则按同特异性胜出、hover 不会把选中态的底色改掉。
   这里把 hover 写在选中**之前**，让"选中的那一枚被 hover"时仍是选中的那一档（字重 600 由选中那条定），
   而"未选中被 hover"时拿到完整的 hover 观感。 */
.esc-category-tabs .esc-pill:not([data-esc-selected='true']):hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); font-weight: 600; }
/* ★用户裁决（本轮）：二级分类的「未选中」与上面两行**同步深一档**（三行一体） */
.esc-category-tabs .esc-pill:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }
/* ★用户裁决③：**选中要有标签背景**（同一枚中性 hover 面，非选中无底色）。判据同上，走 data-esc-selected。 */
/* ★用户裁决③：选中是**灰色背景**（不是黑字块、也不是凹槽白块）。
   底色走 interactive-bg-hover（约 6% 黑）——本主题的 bg-layer-1/2/3 三者同值，不能拿它们做灰底。 */
.esc-category-tabs .esc-pill[data-esc-selected='true'] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); font-weight: 600; }
/* ★口径 35：官方那一行的 .category-tab/.category-tab-active 两条**已删**——本页的分类页签用的是官方
   Pill 原语（视觉由原语自带），这两条从来没被任何元素挂上；其中 -active 那格还挂着同一枚失效 token
   （background-secondary）。容器 .esc-category-tabs 仍照官方 :41 的 margin-top: 14px。 */
.esc-toolbar-note { margin-top: 6px; font-size: var(--esc-fs-xxs); color: var(--dsw-alias-label-tertiary); }

/* —— 列表区（原 ResourceAggregation/index.less）——
   ★口径 34/35：栅格回官方值（最小列宽 300px、间距 16px；"紧凑档"的 220/10 已撤回）。
   ★**本刀第 ⑧ 条**：桌面档滚动面已提到 .esc-content ⇒ .esc-scroll 退回**普通块**（自己不再滚，
     否则就是"格子里再滚"的套娃），它的高度随内容走。
   ★flex: none（不是 1）：它现在不再是"占满剩余高度"的那一格，剩余高度归滚动面自己管。 */
.esc-scroll { flex: none; min-height: 0; overflow: visible; }
.esc-scroll-hidden::-webkit-scrollbar { display: none; }
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

/* ══════════════ 网格列数（口径 39 立 · 口径 48 换基准 500 → 320）══════════════
 * **算式**（两条网格共用的唯一真源 --esc-grid-cols，非手机竖屏那一档）：
 *   repeat(auto-fill, minmax(min(var(--esc-grid-min), calc((100% - var(--esc-grid-gap)) / 2)), 1fr))
 *   · 列数 = floor((W + gap) / (min + gap))（auto-fill 的实算式；W = 容器内容宽）；
 *   · 外层那枚 min() 是**窄容器保底两列**的机制（口径 39 的来处）：容器 < 2×min + gap 时
 *     把列宽收成"两列各占一半"，永远排得下两列，付出的只是每列一点点宽度。
 * **口径 39 的真机事实**（这台折叠屏，dpr = 440dpi ÷ 160 = 2.75）：
 *   · 横屏：物理 2364×1672 ⇒ CSS 视口 860×608；侧栏**停靠**（截图实测 ≈ 280 CSS px），
 *     内容区只剩 860 − 280 − 48（.esc-content 的左右内衬 24×2）= 532px；
 *   · 竖屏：物理 1672×2364 ⇒ CSS 视口 608×860；竖屏侧栏是**抽屉**（顶栏有汉堡键，不占宽），
 *     内容区 = 608 − 48 = 560px。
 *   当年级那枚硬编码 262 的门槛是 2 × 262 + 12 = 536px ⇒ 横屏 532 差 4px 掉回单列，
 *   这就是「横向一列、竖着两列」的**全部来处**（不是"横屏没适配"，是差 4 像素）——
 *   故列宽基准提成变量、再叠那层 min() 保底。
 * **口径 48 的实算**（用户那台窗口：逻辑 1708 宽、侧栏到 x=280.3 ⇒ 内容区 W = **1377.7**、gap = 16）：
 *   · 旧基准 500 ⇒ floor(1393.7 / 516) = **2 列**，列宽 680.2（= (1377.7 − 16) / 2）；
 *   · 新基准 320 ⇒ floor(1393.7 / 336) = **4 列**，列宽 = (1377.7 − 3×16) / 4 = **332.4**；
 *   · 4 列的容器宽区间 = [4×320 + 3×16, 5×320 + 4×16) = **[1328, 1664)**（1377.7 落在这一段里）；
 *   · 窄容器照旧保底两列（那层 min() 一字未动，320 只是"最宽列宽的上限"）。
 * 手机竖屏那一档（≤560px 且 portrait）留在默认档 ⇒ 仍是单列（用户要的"只有手机竖屏一列"）。
 * ★两条网格**共用** --esc-grid-cols 这一个真源，不各写一份：选精选行时上下两段网格是**列对齐**的，
 *   各写一份迟早会漂（口径 ⑤ 定的"两段同一套几何"就是为这件事）。
 * ★min() 里那枚 gap 必须等于两条 grid 规则里的 gap（门禁按**提取值**比对，不靠人眼，见 spec）。
 * ⚠本段整体在一枚模板字符串内 ⇒ 注释里**不许出现反引号**（会截断字符串）。 */
@media (min-width: 561px), (orientation: landscape) {
  .esc-root { --esc-grid-cols: repeat(auto-fill, minmax(min(var(--esc-grid-min), calc((100% - var(--esc-grid-gap)) / 2)), 1fr)); }
}

.esc-list-section { display: grid; grid-template-columns: var(--esc-grid-cols); gap: var(--esc-grid-gap); padding-bottom: 16px; align-content: start; }

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
/* ★本刀（真机裁决「技能卡 hover 卡顿、专家卡丝滑」）：根因不是性能，是**空转的过渡**。
   这张卡原先声明 transition: background, box-shadow, border-color 三条 .2s，
   但 box-shadow 与 border-color 在 :hover 时**逐字未变**（静止与 hover 都是 lv2 / border-l1）——
   ⇒ 每次 hover 都在插值两个**没变**的值。叠加技能卡那两枚按钮（各 2 条，其中 background 同样没变），
   一次 hover 共跑 5 条 transition、其中 3 条空转；专家卡只有 1 条真的（background）——
   这就是「一卡卡、一卡滑」的**全部机制**（不是机器慢，是声明多了）。
   ⇒ 纪律：本页 **transition 只声明真正会变的属性**。空转的过渡不是"无害的保险"，是每帧白烧的插值。
   ★上面的 box-shadow: var(--dsw-shadow-lv2) 逐字保留：那是静止态那一档，本条不再给它挂过渡。 */
.esc-card { position: relative; display: flex; flex-direction: column; gap: var(--esc-card-gap); padding: var(--esc-card-py) var(--esc-card-px); border-radius: var(--esc-radius-card); border: 1px solid var(--dsw-alias-border-l1); background-color: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-shadow-lv2); transition: background-color .2s ease-out; cursor: pointer; min-height: var(--esc-card-min-h); }
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
.esc-card-compact { min-height: var(--esc-card-min-h); }
/* ★SPEC §7 分层策略：**技能卡有阴影（它是可点的入口）、专家/连接器卡无**（它们是列表项）。
   官方那套"所有卡一刀切同一阴影"在这里是错的——两类卡的交互语义不同，视觉权重就该不同。 */
.esc-card-expert, .esc-card-connector { box-shadow: none; }
/* 三行都 flex: none：官方紧凑卡片的 96px 内容盒恰好容纳「头 48 + 间隙 16 + 描述 32」，本页一旦因任何原因
   超出（例如宿主的长字号设置/文本放大），被压扁的必然是描述 ⇒ 那正是"第二行被切掉半截"的形态。钉死它。 */
.esc-card-header { display: flex; gap: 12px; flex: none; }
/* ★真图实测（workbuddy 实际 UI，SPEC 文字没写对）：图标是 **40px 圆角方块**（radius 10），不是正圆。 */
.esc-card-image { width: var(--esc-card-icon); height: var(--esc-card-icon); border-radius: var(--esc-card-icon-radius); object-fit: cover; flex-shrink: 0; background: var(--dsw-alias-bg-skeleton); }
.esc-card-image-circle { border-radius: 50%; }
.esc-card-headmain { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
/* ★本刀（用户裁决⑦）：标题与描述**同处卡片头**（描述在标题正下方的一个独立行里，不再各占一大格）。
   描述那一行原来是固定 32px 高的两行截断，真机截图里把卡片撑得很高；现在它是**单行**（见下面那条）。 */
.esc-card-title { margin: 0; color: var(--dsw-alias-label-primary); font-size: var(--esc-fs-s); font-weight: 650; line-height: 1.4; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 技能卡的描述——**独立一行**（口径 41：用户裁决「截断位置应该是卡片边缘而不是安装按钮，因为他是独立一行」）。
   它在 headmain 里是「标题行」的**下一行**，而动作位只吃标题那一行的宽 ⇒ 这一行的右端是**卡片内缘**
   （与下面那条标签行对齐），省略号落在卡片边缘。
   flex: none 与头行/页脚同一条纪律（见上面 .esc-card-header 那段）：任何超出都不许把它压扁。 */
.esc-card-headdesc { margin: 3px 0 0; color: var(--dsw-alias-label-secondary); font-size: var(--esc-fs-xxs); line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; }
/* ★**口径 53**：卡片元信息行（版本短号 / 大小 / 内含技能数）。
   ★**缺席即整行不进 DOM**（取值口唯一：ResourceItem.meta）⇒ 广场/专家/连接器/精选那几档
     的卡片渲染**一字未变**。单行截断 + title 兜住全文：它是元信息，长出来只会把卡片顶高。 */
.esc-card-meta { margin: 0; color: var(--dsw-alias-label-tertiary); font-size: var(--esc-fs-xxxs); line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; }
/* ★**口径 53**：未装技能卡那枚【＋】**按不动时**那句**行上可见**的原因
   （产品宪法：禁用控件不许只挂一句 title）。它是可见文字、role="status"，不是悬浮说明。 */
.esc-card-lock { margin: 0; color: var(--dsw-alias-label-tertiary); font-size: var(--esc-fs-xxxs); line-height: 1.5; flex: none; }
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
/* ★**本轮第 ⑧ 条（用户原话「卡片标题下移一点 —— 标题与图标那行的垂直关系调一下（现在偏上）」）**：
   margin-top: var(--esc-sp-xs) 把「标题行 + 描述」那一整块**在图标旁边下移一档**。
   ★为什么落在**这一行**而不是标题本体：这一行是 headmain 里的**第一格**，它下面紧挨着描述。
     压标题本体的 margin 会把标题与描述**拆开**（描述留在原位、标题单独下去，那才是真的"错位"）；
     推这一行则是**整块**（标题 + 描述 + 同行的动作格）一起下移 —— 那正是"标题与图标那行的关系"。
   ★为什么是 var(--esc-sp-xs)（4px）而不是一个裸 px：本页纪律是**几何一律走刻度变量**。
   ★动作格随之一起下移是**要的效果**：它是标题行的兄弟，整枚「召唤 / +」与标题始终对齐在同一行上。 */
.esc-card-titlerow { display: flex; align-items: flex-start; gap: 0; flex: none; margin-top: var(--esc-sp-xs); }
/* 标题那一格必须仍可收缩（min-width: 0），否则 flex 分配不到宽度、省略号不生效。 */
.esc-card-titlerow .esc-card-title { flex: 1; min-width: 0; }
.esc-card-author-row { display: flex; align-items: center; gap: 12px; }
/* 官方 AuthorInfo/index.less：容器 min-width: 30px; gap: 4px; flex: 0 1 auto，
   头像 **16×16**（原实现写的是 14×14，比官方小一圈），名字 height: 16px; line-height: 16px。 */
.esc-author { display: flex; align-items: center; gap: 4px; overflow: hidden; min-width: 30px; flex: 0 1 auto; }
.esc-author-avatar { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
.esc-author-name { font-size: var(--esc-fs-xxs); height: 16px; line-height: 16px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.esc-extra-box { min-width: 120px; flex: 1 1 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--dsw-alias-label-tertiary); font-size: var(--esc-fs-xxs); overflow: hidden; }
/* 描述：官方那一格是 EllipsisTooltip 渲染的 <div class="text-ellipsis-2 {module}.content">——
   text-ellipsis-2（styles/custom.less:11-23）给 display:-webkit-box / -webkit-line-clamp:2 /
   -webkit-box-orient:vertical / overflow:hidden / **text-overflow:ellipsis / word-break:break-all /
   white-space:normal**，.content（CardWrapper/index.less:61-67）给 line-height:16px; height:32px;
   color:font-tertiary; font-size:12px; font-weight:strong。本页原先漏了 text-ellipsis-2 里那三条，
   现补齐；再加 flex: none（见上，描述不许被压扁）。 */
.esc-card-content { line-height: 16px; height: 32px; color: var(--dsw-alias-label-tertiary); font-size: var(--esc-fs-xxs); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-all; white-space: normal; flex: none; }
/* 页脚：官方只有【有统计行】的专家卡片才渲染这个元素（{showStats && <footer/>}，height: 24px）——
   技能/连接器卡片没有它（否则多出 24px + 16px 间隙，正是把描述挤出内容盒的那 40px）。渲染与否由卡片的
   showStats 决定（见 esc-card.tsx），这里只保证它的几何。 */
.esc-card-footer { height: 24px; display: flex; align-items: center; flex: none; }
.esc-count-box { display: flex; align-items: center; gap: 10px; flex: 1; }
.esc-count-text { display: flex; align-items: center; font-size: var(--esc-fs-xxs); color: var(--dsw-alias-label-tertiary); gap: 4px; }
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
.esc-connect-category { color: var(--dsw-alias-label-tertiary); font-size: var(--esc-fs-xxs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.esc-connect-status { display: flex; align-items: center; flex-shrink: 0; gap: 4px; font-size: var(--esc-fs-xxs); white-space: nowrap; }
.esc-status-dot { width: 6px; height: 6px; border-radius: 50%; background-color: currentcolor; }
.esc-status-connected { color: var(--dsw-alias-state-success-primary); }
.esc-status-disconnected { color: var(--dsw-alias-label-tertiary); }

/* —— 三态与提示（本页新增：原页面读不到数据时是"静默空态"）—— */
.esc-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--dsw-alias-label-tertiary); font-size: var(--esc-fs-xs); text-align: center; padding: 20px; }
.esc-state-title { color: var(--dsw-alias-label-secondary); font-size: var(--esc-fs-s); }
.esc-state-error { color: var(--dsw-alias-state-error-primary); }
.esc-state-code { font-size: var(--esc-fs-xxs); color: var(--dsw-alias-label-tertiary); word-break: break-all; }
/* ★本刀（真机故障「下滑加载中…会一直闪屏」的可见面）：触底加载那一行原先复用整屏态「.esc-state」
   （内衬 20px、字号 13px）——它出现在滚动内容里，**出现/消失都会把列表顶一下**。当底部一遍遍
   发空补拉时，那行一闪一缩就是用户看到的"闪"。改成**定高紧凑行**：高度固定 28px、12px 字、
   内衬为 0 ⇒ 它出现或消失只占这 28px，不再牵动整段列表（判据侧的根因修复见 esc-aggregation.tsx）。 */
.esc-scroll-loader { flex: none; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary); font-size: var(--esc-fs-xxs); }
/* 空态插图（官方是 antd <Empty> 的默认插图；dsh 无 Empty 原语 ⇒ 用 token 画一张等价物，见 esc-aggregation.tsx）。 */
.esc-empty-art { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--dsw-radius-lg, 12px); background: var(--dsw-alias-bg-skeleton); color: var(--dsw-alias-label-tertiary); }

/* —— 口径 62：「本地三方」（本地三方 Agent 技能源）这一维度的内容区 ——
   复用本页既有那几个排版角色（块间距/两级字色/错误提示），类名一律 esc-third-party-* 单层命名，
   不新造 token（审计 --strict 会以 dead 抓住不存在的名字）。 */
.esc-third-party { display: flex; flex-direction: column; gap: var(--esc-sp-lg); margin-top: var(--esc-sp-lg); }
.esc-third-party-head { display: flex; flex-direction: column; gap: 6px; }
.esc-third-party-title { margin: 0; font-size: var(--esc-fs-s); font-weight: 600; line-height: 20px; color: var(--dsw-alias-label-primary); }
.esc-third-party-note { margin: 0; font-size: var(--esc-fs-xs); line-height: 20px; color: var(--dsw-alias-label-secondary); }
.esc-third-party-status { margin: 0; font-size: var(--esc-fs-xs); line-height: 20px; color: var(--dsw-alias-label-secondary); }
.esc-third-party-empty { margin: 0; font-size: var(--esc-fs-s); color: var(--dsw-alias-label-secondary); }
.esc-third-party-roots { display: flex; flex-direction: column; gap: 4px; margin-top: var(--esc-sp-sm); }
.esc-third-party-rootnote { margin: 0; font-size: var(--esc-fs-xxs); line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.esc-third-party-groups { display: flex; flex-direction: column; gap: var(--esc-sp-lg); }
.esc-third-party-group { display: flex; flex-direction: column; gap: var(--esc-sp-sm); }
.esc-third-party-grouphead { display: flex; align-items: center; gap: var(--esc-sp-sm); }
.esc-third-party-grouptitle { margin: 0; font-size: var(--esc-fs-xs); font-weight: 600; line-height: 18px; color: var(--dsw-alias-label-primary); }
.esc-third-party-grouptag { flex: none; font-size: var(--esc-fs-xxs); color: var(--dsw-alias-label-tertiary); }
.esc-third-party-count { flex: none; font-size: var(--esc-fs-xxs); color: var(--dsw-alias-label-tertiary); }
.esc-third-party-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.esc-third-party-row { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-top: 1px solid var(--dsw-alias-border-l1); }
.esc-third-party-rowline { display: flex; align-items: flex-start; gap: var(--esc-sp-sm); }
.esc-third-party-rowmain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.esc-third-party-name { font-size: var(--esc-fs-xs); font-weight: 500; line-height: 18px; color: var(--dsw-alias-label-primary); word-break: break-all; }
.esc-third-party-desc { font-size: var(--esc-fs-xxs); line-height: 18px; color: var(--dsw-alias-label-secondary); word-break: break-all; }
.esc-third-party-meta { font-size: var(--esc-fs-xxs); line-height: 18px; color: var(--dsw-alias-label-tertiary); word-break: break-all; }
.esc-third-party-action { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; max-width: 200px; }
.esc-third-party-lock { font-size: var(--esc-fs-xxs); line-height: 16px; color: var(--dsw-alias-label-tertiary); text-align: right; }
.esc-third-party-retry { align-self: flex-start; }

/* —— 口径 53：「企业技能」（企业中心注册的技能包）这一维度的内容区 ——
   ★它与上面那一族**同一条手法**（复用本页既有那几个排版角色：块间距 / 两级字色 / 错误提示），
     类名一律 esc-catalog-* 单层命名、不新造 token（审计 --strict 会以 dead 抓住不存在的名字）。
   ★卡片网格**复用** .esc-list-section（与系统广场/团队广场同一份列模板与间距）——
     这一维度的卡片与那几维**长得一样**（同一个按钮、同一套版式），不该长出第二套网格。
   ★谁都不许在这里写死色值（本文件门禁有一条反向锁盯着六位色）。 */
.esc-catalog { display: flex; flex-direction: column; gap: var(--esc-sp-lg); margin-top: var(--esc-sp-lg); }
.esc-catalog-head { display: flex; flex-direction: column; gap: 6px; }
.esc-catalog-title { margin: 0; font-size: var(--esc-fs-s); font-weight: 600; line-height: 20px; color: var(--dsw-alias-label-primary); }
.esc-catalog-note { margin: 0; font-size: var(--esc-fs-xs); line-height: 20px; color: var(--dsw-alias-label-secondary); }
.esc-catalog-status { margin: 0; font-size: var(--esc-fs-xs); line-height: 20px; color: var(--dsw-alias-label-secondary); }
.esc-catalog-degraded { margin: 0; font-size: var(--esc-fs-xxs); line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.esc-catalog-empty { margin: 0; font-size: var(--esc-fs-s); color: var(--dsw-alias-label-secondary); }
.esc-catalog-retry { align-self: flex-start; }
/* 一张卡 + 它那一行失败提示（失败**只落在那一行**上，故卡与提示同处一格）。
   ★flex: 1 让卡把这一格撑满：网格项是这一格而不是卡本身 ⇒ 卡的高度仍由内容决定、同排不参差。 */
.esc-catalog-cell { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.esc-catalog-cell > .esc-card { flex: 1; }
.esc-catalog-error { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }

/* —— 首屏加载（官方那一态画的是 components/custom/Loading：居中的一枚转圈图标 + 「加载中...」，
   色走主色、字号 12、间距 8px）——原先是本页自造的六张骨架卡，口径 35 按官方换成这一枚。 */
.esc-loading { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--dsw-alias-brand-primary); font-size: var(--esc-fs-xxs); }
.esc-loading-icon { animation: esc-spin 1s linear infinite; }
@keyframes esc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .esc-loading-icon { animation: none; } }

/* —— 未登录门（未登录那态：原页面不存在，因为那时它总在平台内）—— */
.esc-gate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px; text-align: center; }
.esc-gate-title { font-size: var(--esc-fs-s); font-weight: 500; color: var(--dsw-alias-label-primary); }
.esc-gate-body { font-size: var(--esc-fs-xs); color: var(--dsw-alias-label-secondary); max-width: 420px; line-height: 20px; }

/* —— 窄屏 ——
   ★口径 37：这一档原本是「药丸组保持自然宽度，搜索框整行占满（flex: 1 1 100%）」，那必然换行、把搜索框
   赶到第二行；用户裁决要它**和主 tab 同一行**且宽度自适应 ⇒ 那条整行占满已撤。自适应交给上面的默认值。
   ★口径 38：主行已 nowrap ⇒ 这一档只负责把搜索框的**下限**从 120px 收到 96px（缩得下去但不塌成一条缝）。
   下限以下宁可让搜索框轻微溢出，也不许回到"换行"那一态。 */
@media (max-width: 560px) {
  /* 定宽后的收窄档：200px 在手机上会挤掉右块其余两枚，收到 160px 仍在（不是 96px 那种塌成缝）。 */
  .esc-search { width: 160px; }
  /* 三行标签的间距也收一档，否则「系统广场 / 团队空间 / 我启用的」自己就换行了。
     ★**本轮**：二级分类那行**另收一档到 3px**（实测它比上面两行更紧，且它是纯文字短标签）——
     三行同收 4 会把"上面两行 8 / 这一行 6"那条**相对关系**抹平，而那正是用户"更紧凑"要说的事。
     ★**口径 56（本刀）**：这一档**只覆盖 gap**（一个字都不碰胶囊内衬与容器负 margin）——
     对称内衬与对齐补偿是**跨档同一条**声明，故"灰底里文字居中 + 文字与卡片左边界对齐"在最窄这一档
     也照样成立；这一档的文字间距 2p + g = 27 **小于**基档口径 30（更紧，符合"不许变大"）。 */
  .esc-resource-tabs, .esc-source-tabs { gap: 4px; }
  .esc-category-tabs { gap: 3px; }
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
  /* ★**本刀第 ⑧ 条：这一档把「冻结头」显式 opt-out**（position: static）。
     判据很硬：这一档的**既有用户裁决是"整页单滚动面"**——手指落在上半屏（也就是落在页签/工具栏那一片）
     任何地方**都要能拖动整页**。而 position: sticky 的页签会吸在视口上缘，那正是这条裁决点名要去掉的
     「页面冻住了」的观感。故本档把它退回 static ⇒ 页签与工具栏、全页一起滚，整页单滚动面**逐条保持**。
     ★桌面档的「三页签冻结」是用户**本轮真机**对标 workbuddy 时新给的那一条（冻结**这一行**、其余全滚）；
       这一档的「整页全滚、什么都不冻」是**先前那条**裁决。两者不是同一个诉求在不同设备上的分歧，
       而是同一诉求在两种档位下的不同落点（冻一行 vs 一行都不冻）——故按档位各给一条，不合并。 */
  .esc-tabs-freeze { position: static; }
  /* 列表退回普通块：高度随内容走（不再自己滚），否则会变成「格子里再滚」的套娃。 */
  .esc-scroll { flex: none; min-height: 0; overflow: visible; }
  /* ★本刀（用户原话「我希望移动端下的字体能自适应缩放」）：移动档再叠一档**视口自适应**字号。
     取 100vmin（宽高里较小的那一维：横竖屏都不会反向）——视口越小 delta 越负、越大越正，
     clamp 夹在 ±1.5px（≈13px 基准的一成上下：看得出"随屏缩放"，又不至于把已排好的卡片挤变形）。
     ★只暴露**一个** delta、全体字号同加同一个数 ⇒ 层级关系不变；桌面档 --esc-fs-delta: +1px
     （见 .esc-root 那段"本刀 A"），故桌面观感 = 本刀之前 + 1px，而壳「字体大小」那一路在两档都生效。 */
  /* ★**本刀 A 的 compact 档**：视口自适应那一项由"替换 delta"改成**加在基准之上**——
     基础 +1px 与 clamp 项**相加**（而不是二选一）：窄屏仍旧随 100vmin 缩放，只是基准抬高了一档。
     判据（门禁）：这一档必须写成 calc(var(--esc-fs-delta-base) + clamp(...))，即"additive"，
     不是把 --esc-fs-delta 直接赋成 clamp（那会把桌面那一刀在移动档抹掉）。 */
  .esc-root { --esc-fs-delta: calc(var(--esc-fs-delta-base) + clamp(-1.5px, (100vmin - 400px) * 0.007, 1.5px)); }

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
  /* ★口径 49：主按钮那枚整条类名清单（含专家页的描边档）都吃这条移动档内衬——否则描边那一枚
     在窄屏会比其他两页宽一档，"三页同一枚按钮"这条在移动档就破了。 */
  .esc-root .esc-add-skill { padding: 0 8px; }
}

/* ══════════════ 本刀（workbuddy 风格重构）：以下为本刀新增的类 ══════════════
 * 几何与 token 全部取自**本文件上面已验过的那些**（主题真源 dsh-client-ui-theme 里真实存在的那几枚），
 * 一枚新 token 都没引入 —— 故这批规则不会重演「失效 token 让整条声明作废」那类坑。 */

/* —— 顶栏右块新增的两枚控件（截图里排在搜索框右侧的那一对）——
   ★两枚**本刀都不接线**（筛选与添加动作都不做），但按产品宪法不许只挂一句 title 的死控件：
   它们**看得见、有文案、有 title**，只是置灰。 */
/* ★**本刀第 ② 条（用户原话「已安装的图标与文字都用接近纯黑的颜色、圆角与添加技能一致、添加技能整体放大」）**：
   三件事、三条判据，全部落在**主题 token** 上（不写死 #000 / #0f1115）：
     · **近黑** = --dsw-alias-label-primary（浅色主题实测解析为 --dsw-static-neutral-bluish-1000 = **#0f1115**，
       深色反相为 #f9fafb）——这与「添加技能」那枚主按钮的 button-primary-fill（= brand-primary，
       同一枚 #0f1115）**落在同一个色阶**上，故两枚并排时"已安装"的图标与文字是同一种黑。
       ★为什么是 label-primary 而不是 label-secondary：secondary 在浅色主题下是 #cfd3d6（近乎白），
         正是用户说的"现在是灰的"那一档。SPEC §7 的分层策略只约束**主按钮**（近黑），
         而这一枚是**次级控件**——它该跟主按钮同黑，才对得上 workbuddy 那张图。
      · **圆角一致** = --esc-btn-radius（★**本轮已从 18 收到 8**：用户「圆角小一点」）。
        两枚都吃这**同一枚**变量 ⇒「两枚看起来是一对」仍由这一格保证。
        ★沿革与理由：18 是原语 size:'md' 的胶囊形（当初取它是为了「主按钮是全页最重的一枚」那一眼），
          但用户真机裁决要「圆角小一点、高度小一点」⇒ 收成控件档 8（与搜索框/字段那一族同档）。
          ——「一致」这条不变量**没动**，动的是它们一致到**哪一档**；所以仍是同一个变量、不是两个字面量。
      · 「添加技能」的尺寸：组件里 size 由 'sm' 升到 'md'，并用 --esc-btn-h/--esc-btn-px/--esc-btn-radius
        把高度/内衬/圆角**钉到本地刻度**（真源 WB.control.button）——不散落裸 px。
        ★本轮 height 36 → **32**，与 --esc-field-h（搜索框/「已安装」）同高。 */
.esc-installed { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; height: var(--esc-field-h); padding: 0 12px; /* 高度与搜索框齐平（SPEC §3.2 搜索框 h32） */ border-radius: var(--esc-btn-radius); border: 1px solid var(--dsw-alias-border-l2); background: none; color: var(--dsw-alias-label-primary); font-family: inherit; font-size: var(--esc-fs-xs); white-space: nowrap; cursor: pointer; }
/* ★第 ② 条：图标与文字**都**是近黑——图标是 lucide 的 Download，它 fill/stroke 走 currentColor，
   而这一枚按钮的 color 已是 label-primary ⇒ 图标自动同黑，**不需要**（也不该）另写一条 svg 规则。 */
.esc-installed:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.esc-installed:disabled { cursor: default; opacity: .6; }
.esc-installed-count { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
/* ★**用户裁决（读不到 ⇒ 0）**：原先这里还有一条 .esc-installed-failed —— 那是"读不到已装清单"时
   另出的一枚「？」（橙色 + cursor: help）。本刀按用户裁决撤掉整枚：计数位现在**恒画** (N)、读不到就画
   (0)（与真 0 同形），"这个 0 是暂定的"改由按钮自己的 title 说清。那一格既已无元素使用，
   规则连同它的注释一并删除（不留死规则）——**几何（高度/内衬/圆角/右边界）一个字节都没动**。 */
/* ★本刀（用户裁决④）：「添加技能」是**纯黑实底按钮**（workbuddy 那张里它是全页最重的一枚）。
   button-primary-fill 在本主题里就是近黑（浅色 #0f1115／深色反相近白），直接用原语的
   .primary 即可——**不写死颜色**，深浅两套主题都由主题自己翻。
   顺带把它那层 :disabled 的冲淡按回去（口径 36 同一手法）：本刀不接线，但**形态**要对。
   ⚠**这一句只对卡片里的视觉占位成立**：工具栏那两枚主胶囊的同一手已在口径 52 **撤销**
   （禁用控件必须看得出来按不动——查证结论见下面 .esc-add-skill 之后那一段）。
   ★**第 ② 条的尺寸**：组件里 size: 'sm' → size: 'md'（见 esc-toolbar.tsx），
     这里再用 --esc-btn-h/--esc-btn-px/--esc-btn-radius 把高度/内衬/圆角**钉到本地刻度**
     （真源 WB.control.button）——
     ★这样钉而不是"只改 size"的原因：原语那三条是 CSS Modules 哈希类，本页外部要覆盖时
     得靠特异性与顺序打架；落成本地变量后，「已安装」那枚自绘按钮与这枚原语按钮吃**同一张表**，
     圆角/高度天然对得上（那正是用户第②条要的"两枚一致"）。
     ★**本轮**：用户「高度小一点、圆角小一点」⇒ 该格由 36/18 收到 **32/8**（控件档，
       与 --esc-field-h / --esc-radius-md 同档）。仍是**同一个变量**，「已安装」那枚自动跟着走。
   ★**口径 49（本刀）**：高度从 min-height 改成 **height** 真钉住。上一轮写了 min-height 却没生效，
     根因是**官方 Button.module.css 的 md 档那一格写的是 height: 36px**（不是 min-height）——
     min-height: 32px 对 height: 36px 毫无约束力，盒子照样 36。换成同名的 height 之后，
     两条规则同特异性（都是单类），由本页样式表在官方之后注入取胜 ⇒ 三页那枚按钮的盒高恒为 32。
     字号/字重同样在这里钉（--esc-fs-xs + 500），与 WorkBuddy .btn { font-size:13px; font-weight:500 } 同值。 */
.esc-add-skill { flex-shrink: 0; gap: 6px; white-space: nowrap; height: var(--esc-btn-h); padding: 0 var(--esc-btn-px); border-radius: var(--esc-btn-radius); font-size: var(--esc-fs-xs); font-weight: 500; }
/* ★SPEC §7：主按钮走**近黑**（button-primary-fill 在本主题里就是 brand-primary = 近黑），
   品牌青绿**只留给状态标识**。这与本文件原先"动作按钮全黑"那一刀同源，这里把范围写清楚。 */
/* ★**口径 52（本刀，真机像素取证）**：这里**刻意一条规则都不留** —— 原先那条
   ".esc-root .esc-add-skill:disabled { opacity: 1; }" 已删除。
   ★查证结论（三种假说逐条排除后的那一种）：官方原语产物 Button.module.css 里就是
     .button:disabled { cursor: not-allowed; opacity: 0.4 }
   —— 它**是改外观的**，故既不是"官方 :disabled 只改 cursor / pointer-events、不改色"，
   也不是"官方某一枚 token 在本主题里恰好等于启用色"（那条规则里一枚 token 都没有）；
   真因是**第三种**：本页那条 (0,3,0) 的 opacity: 1 把官方 (0,2,0) 的冲淡**压掉了**
   （两级选择器 vs 一级，特异性赢，且本页样式表在官方之后注入）。
   ⇒ 修法只能是**撤销覆盖**：删掉它，官方那条自动生效，禁用胶囊回到"看得出来的淡"。
     **不新造禁用配色**（那会变成第二处真源：官方改一次、我们漂一次），颜色照旧全部来自主题。
   ⚠别再把它写回来：写回来 = 禁用胶囊与启用的一模一样（"看着可点、点下去毫无反应"）。
   反向锁 + "官方那条真的会生效"的可证判据见 tests/esc.spec.ts 的口径 52 那一条。 */
/* ★**口径 49**：专家页那一枚的**白底描边**档。
   配方**逐条复用本页既有的 .esc-installed**（border: 1px solid var(--dsw-alias-border-l2) +
   透明底 + color: var(--dsw-alias-label-primary)）——WorkBuddy 那枚实测就是 #e5e5e5 边框 + 白底，
   与本页 border-l2（#0000001a）那档同形；**刻意不新造第二套白底按钮样式**（同一件事写两份迟早会漂）。
   ★为什么单开一个类名而不是给 .esc-add-skill 加规则：描边**只有专家页**要，
   技能/连接器两页必须留在 primary 那一档（黑胶囊）；档位由类名分流，判据在门禁里逐页锁住。
   ★内衬仍走 --esc-btn-px：那一枚 border 由 border-box 吸收（本文件根上是 box-sizing: border-box
   那一套），盒子高仍是 --esc-btn-h 那一格、右边界不因此漂。 */
.esc-add-skill-outline { border: 1px solid var(--dsw-alias-border-l2); background: none; color: var(--dsw-alias-label-primary); }
.esc-add-skill-outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
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
/* ★**口径 47（用户裁决「已安装按钮打开已安装技能页面……唯一不同是安装图标改为开关按钮，去除底部标签」）**：
   已安装技能卡标题行那一格放的是官方 Switch（flex: 0 0 auto; width: 36px; height: 20px 的胶囊，
   原语自己的尺寸与配色，我们只给**位置**）：与技能卡那枚「+」**同一格**（标题行第二格），
   间距同样走自己那 12px（理由见上一条：这一格自带间距，收起/展开才不会靠容器 gap 算错宽度）。
   align-self: center 是因为它的高度（20px）只有标题行高的一半——靠上会显得飘。 */
.esc-card-switch { flex: none; align-self: center; margin-left: 12px; }
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
/* ★**本轮第 ② 条（用户原话「召唤按钮高度小一点、与卡片标题文字高度大致对齐；文字字重更重更显眼」）**：
   这枚是**卡片内**的次级动作（收起态、hover 才露出），不是工具栏那枚主按钮 ⇒ 它的几何单开一格
   --esc-summon-*（真源 WB.control.summon），**不复用** --esc-btn-*（那是「添加技能」的 32/14/8）。
   · 高度 28：标题行那一行是「标题（14px × line-height 1.4 ≈ 19.6）+ 描述（12px × 1.5），
     取 28 让按钮**大致**与那一行文字齐平（"大致"是用户原话，不是一个要抠到像素的等式）；
   · 字重 600：三页签那一档的 weightActive（同 token 语义，见 WB.control.tab.weightActive）。
   选择器带 .esc-root 提高特异性压过官方原语自带的高度/内衬/圆角（CSS Modules 哈希类 + 本文件更靠后）。 */
.esc-root .esc-summon { height: var(--esc-summon-h); min-height: var(--esc-summon-h); padding: 0 var(--esc-summon-px); border-radius: var(--esc-summon-radius); font-weight: 600; }
/* ★用户裁决⑥：右上角那枚「安装」按钮此前是个**灰色圆圈小方块**（截图里看不出是加号），且颜色偏淡。
   现在改成 workbuddy 那种**淡底 + 可辨识的加号**：bg-layer-2 作底（比白卡略深一档，有边界感）、
   字色走主文字色（加号看得清），尺寸放大到 30px，hover 才加深。 */
/* ★真图实测：那枚「+」是**浅灰圆角方块**（不是透明底），约 24px。 */
/* ★**本刀第 ⑦ 条（用户原话「技能卡片右上角安装按钮的加号颜色更黑、接近纯黑」）**：
   color 由 label-secondary（浅色主题 #cfd3d6——正是用户说的"浅灰"那一档）提到
   **--dsw-alias-label-primary**（浅色 #0f1115 ≈ 纯黑，深色反相 #f9fafb）——
   与第 ② 条那枚「已安装」**同一枚 token**、同一层级（"要点的正事"在两处都近黑，不写死 #000）。
   ★静止态改过来之后，原先那条 :hover 已是**空转**（两态同值）⇒ 按本页既有纪律
     （"transition 只声明真正会变的属性"，见 .esc-card 那段：空转的插值是每帧白烧）
     **连同那条 hover 规则一起撤掉**——留着它只会让这枚加号 hover 时"点了没反应"。 */
.esc-install-plus { display: inline-flex; align-items: center; justify-content: center; width: var(--esc-icon-btn); min-width: var(--esc-icon-btn); height: var(--esc-icon-btn); flex-shrink: 0; border: none; border-radius: var(--esc-radius-sm); background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); cursor: pointer; }
/* ★**本轮（2026-10-08）第二处冲淡的真根因**：color 提到 label-primary 之后那枚加号**仍然偏灰**，
   真因是紧跟着的那条 :disabled { opacity: .6 } —— 它把已经是 #0f1115 的字色按 60% 冲淡成
   ≈#666a6d：**灰的是"不透明度"、不是"颜色"**，所以只改 color 永远不够。
   ⇒ 照本页既有口径（.esc-root .esc-action-solid:disabled { opacity: 1 }，把原语那层冲淡按回去），
     把这一处也**按回 opacity: 1**（cursor: default 保留——它确实不可点）。
   ★**这一条与口径 52 不矛盾**：卡片里那三枚（收藏/召唤/去试试）是**视觉占位**（真图里它们是实底，
     点了也真的没有动作），而工具栏那两枚主胶囊是**用户要点的动作** ⇒ 口径 52 只撤掉了
     .esc-add-skill / .esc-my-experts-create 那两条，它们改回官方那层冲淡。两处口径不同是有意的。
   ★**刻意不写死色值**（#000 之类）：① 那过不了本文件门禁的反向锁（不许出现写死六位色）；
     ② 深色主题下会黑底黑图——label-primary 两套主题各自翻（浅 #0f1115 / 深 #f9fafb），
     跟着主题走才是一枚真正"全黑"的图标。 */
.esc-install-plus:disabled { cursor: default; opacity: 1; }
.esc-more-btn { display: inline-flex; align-items: center; justify-content: center; width: var(--esc-icon-btn); min-width: var(--esc-icon-btn); height: var(--esc-icon-btn); flex-shrink: 0; border: none; border-radius: var(--esc-radius-sm); background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); cursor: pointer; transition: color .15s ease-out; }
.esc-more-btn:hover { color: var(--dsw-alias-label-primary); }
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
.esc-tag { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: var(--esc-fs-xxxs); line-height: 1.4; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* SPEC：统计行的图标 opacity .7（数字不降权，图标降权——那才是"次要信息"的正确表达）。 */
.esc-tag svg { opacity: .7; }
.esc-tag-author { min-width: 0; overflow: hidden; }
/* 作者名可能很长 ⇒ 单行截断，别把整行撑破或把别的标签挤走。 */
.esc-tag-author > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* —— 「精选技能」那一行（workbuddy 版式：标题栏 + 「换一批」+ 卡片网格）—— */
.esc-featured { flex-shrink: 0; padding-bottom: var(--esc-sp-xs); }
.esc-featured-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.esc-featured-title { margin: 0; color: var(--dsw-alias-label-primary); font-size: var(--esc-fs-s); font-weight: 600; line-height: 22px; }
.esc-featured-refresh { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; border: 0; background: none; padding: 0; color: var(--dsw-alias-label-tertiary); font-family: inherit; font-size: var(--esc-fs-xxs); cursor: pointer; }
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
/* ★用户裁决（最终）：「精选只排**一行**，能排几个排几个，**不滚动、不折行**，
   超出的用『换一批』」——
   ⇒ 网格宽度按**容器**排（1fr），一行能放几枚放几枚；放不下的**不画第二行**，
     用户点右上角「换一批」换下一批。**刻意不写 overflow-x: auto**——横向滚动条会让
     那一行看起来像"还有内容在右边被截断"，与 workbuddy 的观感不符。
   ★两段网格仍共用同一个列宽真源（--esc-grid-cols 给出**列宽基准**）：列表那行按 auto-fill 铺满；
     精选这行同样只填**一行**。多出来的条目**仍在 DOM 里**（只被裁掉，不 unmount）⇒ 换一批的数据通路
     一字未动。
   ══ 口径 48：上一版那"三道锁"**从来没锁住过**（用户报的"精选的卡片内容错乱"就是它）══
     旧写法 = grid-template-rows: 1fr + grid-auto-rows: var(--esc-card-min-h) + overflow: hidden，
     三条各自都错，合起来把卡片压进了下一行：
       ① grid-template-rows: 1fr **只定第一行**——隐式行照样生成，第二行起仍然存在
          （"1fr 把多余条目留在行外"这句是假的：它只给第一行轨道定尺寸）；
       ② grid-auto-rows: var(--esc-card-min-h) = **84px**，而一张真卡的自然高校实约 **121px**
          （图标 40 + 标题行 + 描述行 + 标签行，box-sizing: border-box）⇒ 第二行起的每张卡都
          **溢出自己的轨道约 37px、压进下一行**：用户截图的纵向实测正是
          137 = 121 + 16（第一行，被 1fr 按内容撑开）与 100 = 84 + 16（之后每行，被 84px 钉死）；
       ③ overflow: hidden 挂在**高度自适应**的容器上：容器高度 = 四行轨道之和，
          要裁的东西全在容器**里面** ⇒ 它一枚都裁不掉。
   ══ 现在这几条（每条都可断言，见 spec 的口径 48 那一组）══
     · grid-template-rows: auto —— **第一行按内容高**（卡片自然高，一枚都不裁、不裁半截）；
     · grid-auto-rows: 0 —— **隐式行压成 0 高**（多余条目所在的行不再是 84px 的假行）；
     · row-gap: 0 —— **行间不留缝隙**：若留 16px，容器高度会含那条缝、第二行会露出一条 sliver
       （列间距照旧走 --esc-grid-gap，改由 column-gap 单独承担）；
     · overflow: hidden —— 0 高轨道里溢出的那几张被裁掉（老引擎兜底；它同时是滚动容器）；
       overflow: clip —— 现代引擎下**不建立滚动容器**，故键盘 Tab 到被裁的卡片也带不动它
       （overflow: hidden 的容器会被焦点滚动，那样第二行会"自己冒出来"）。
       两句**都留着**是有意的：不认 clip 的引擎在解析期丢掉第二条、hidden 仍在；认得的引擎由 clip 胜出。
   ⚠本段整体在一枚模板字符串内 ⇒ 注释里**不许出现反引号**（会截断字符串，本刀当场踩过一次）。 */
.esc-featured-grid {
  display: grid;
  grid-template-columns: var(--esc-grid-cols);
  grid-template-rows: auto;
  grid-auto-rows: 0;
  column-gap: var(--esc-grid-gap);
  row-gap: 0;
  align-content: start;
  overflow: hidden;
  overflow: clip;
}
/* 精选行自己的失败/未登录说明：复用本页既有的失败色与提示字号，不另立一套。 */
.esc-featured-note { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 0; color: var(--dsw-alias-state-error-primary); font-size: var(--esc-fs-xs); line-height: 20px; }
.esc-featured-note .esc-sub { margin: 0; color: var(--dsw-alias-label-secondary); }
.esc-retry { border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 8px); background: none; padding: 4px 12px; color: var(--dsw-alias-label-primary); font-family: inherit; font-size: var(--esc-fs-xs); cursor: pointer; }
.esc-retry:hover { background: var(--dsw-alias-interactive-bg-hover); }

/* ══════════════ 口径 47：已安装技能页（第二个视图）══════════════
 * 版式照用户那张参考图：页头（返回 + 标题 + 总数）→ 分组标题 → 卡片网格。
 * 卡片本身**零新样式**（还是 .esc-card + .esc-card-skill 那一套），这里只有页头/分组标题/提示
 * 三种几何；开关那一格（.esc-card-switch）在卡片那段里。网格仍取同一个列真源 --esc-grid-cols
 * （口径 39），故这一页的卡片列与列表页**永远对齐**，不靠巧合。 */
.esc-installed-head { display: flex; align-items: center; gap: 12px; flex: none; margin-bottom: 16px; }
/* 标题字号与三页签（.esc-resource-tab）同档 18px —— 同一页里的"页标题级"字号只有一个来源。
   ★口径 51：本子页的标题渲染成 h3（真实标题语义 + 程序化聚焦落点），故补一条 margin: 0；
   对已安装页那枚 span 是空操作（既有渲染逐字不变）。 */
.esc-installed-title { margin: 0; font-size: var(--esc-fs-label); font-weight: 600; line-height: 1; color: var(--dsw-alias-label-primary); }
.esc-installed-group { display: flex; flex-direction: column; gap: 12px; padding-bottom: 16px; }
.esc-installed-group-title { margin: 0; font-size: var(--esc-fs-s); font-weight: 600; line-height: 20px; color: var(--dsw-alias-label-primary); }
.esc-installed-hint { display: flex; align-items: center; gap: 8px; font-size: var(--esc-fs-xs); line-height: 20px; color: var(--dsw-alias-label-tertiary); }
/* 卸载失败的落点：唯一提示件自己带行内样式，这里只给它上下留白与失败色（与精选行那条同色）。 */
.esc-installed-error { margin-bottom: 12px; color: var(--dsw-alias-state-error-primary); }
/* 工具栏下方那条**本地导入失败**的落点（同上：唯一提示件带行内样式，这里只给失败色与间距）。 */
.esc-import-error { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; color: var(--dsw-alias-state-error-primary); }
.esc-installed-back { flex: none; }
.esc-installed-retry { flex: none; align-self: flex-start; margin-top: 12px; }
/* ★口径 54：官方发现面还没发现完（complete === false）时页头那一句。
   走既有的次级色与 xs 字号真源，**不新造颜色/字号**；它排在标题之后、不抢标题的位置。 */
.esc-installed-discovering { font-size: var(--esc-fs-xs); line-height: 20px; color: var(--dsw-alias-label-tertiary); }

/* ══════════════ 口径 51：「我的专家」子页（第三个视图）+ 主按钮的行上可见原因 ══════════════
 * 版式照 WorkBuddy 5.7.6 实机那一页（analysis/wb-my-experts.png）：页头（返回 + 标题）→ 一行
 * （左 tabs「专家 / 专家团」、右「搜索我创建的专家 + 创建专家」）→ 右对齐分段（我创建的 / 我购买的）
 * → 内容区（今天是一句如实交代，见 esc-my-experts.tsx 的头注）。
 * ★**页头零新增**：复用口径 47 立的 .esc-installed-head / -title / -back 那一份几何 —— 两个子页的
 *   标题字号与页头内衬只有一个来源，刻意不新造第二套（那正是"两页迟早漂开"的老路）。
 * ★新加的只有下面几个类：tabs / 搜索+创建那一行 / 分段 / 分段格 / 行上可见原因。
 * ⚠本段整体在一枚模板字符串内 ⇒ 注释里不许出现反引号（会截断模板）。 */
.esc-my-experts-row { display: flex; align-items: center; justify-content: space-between; gap: var(--esc-sp-lg); flex: none; margin-bottom: 12px; }
.esc-my-experts-tabs { display: flex; align-items: center; gap: var(--esc-sp-lg); min-width: 0; }
/* tab 是无底色纯文字（与三页签／维度行同一套语言）：非选中走三级文字色、选中走主文字色 + 600。
   ★**不画计数**（WorkBuddy 那边是「专家 6 / 专家团 1」）：那两枚数字在本部署**没有任何真值来源**，
   写一个上去就是编事实；见 esc-my-experts.tsx 头注与工具栏那枚「已安装 ？」的三态口径。 */
.esc-my-experts-tab { height: var(--esc-tab-h); padding: 0 var(--esc-sp-md); border: 0; background: none; border-radius: var(--esc-radius-sm); color: var(--dsw-alias-label-tertiary); font-family: inherit; font-size: var(--esc-fs-s); font-weight: 500; line-height: 1; cursor: pointer; transition: color .15s, background .15s; }
.esc-my-experts-tab:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.esc-my-experts-tab[data-esc-selected='true'] { color: var(--dsw-alias-label-primary); font-weight: 600; }
/* 右块：搜索框（**复用**工具栏那枚 .esc-search 的同一份宽度/高度/描边/聚焦口径）+ 行上原因 + 「+ 创建专家」。 */
.esc-my-experts-right { display: flex; align-items: center; gap: var(--esc-sp-base); flex: none; }
/* ★产品宪法（禁用控件不许只挂一句 title）：主按钮按不动时那句原因**行上可见**。
   两处共用这一条规则（子页的「+ 创建专家」与工具栏三页的主按钮），故选择器写两枚。 */
.esc-my-experts-lock,
.esc-toolbar-lock { flex: none; max-width: 220px; font-size: var(--esc-fs-xxs); line-height: 1.4; color: var(--dsw-alias-label-tertiary); }
/* WB 那一枚是**黑胶囊**（整圆）：圆角自占一格刻度，内衬/高度与工具栏主按钮同源（--esc-btn-*）。 */
.esc-my-experts-create { flex: none; height: var(--esc-btn-h); padding: 0 var(--esc-btn-px); border-radius: var(--esc-pill-radius); font-size: var(--esc-fs-xs); font-weight: 500; }
/* ★口径 52：这一枚的 ".esc-root .esc-my-experts-create:disabled { opacity: 1; }" 同样**删除** ——
   写入口缺席（onCreateExpert === undefined）时它必须看起来按不动。查证结论与理由见上面
   .esc-add-skill 之后那一段（官方 .button:disabled 的 opacity 才是唯一真源，本页不新造一套）。 */
/* 分段：WB 那一枚是浅灰轨道 + 选中格白底（与菜单里的外观分段同一条语言）。 */
.esc-my-experts-segments { display: flex; align-items: center; justify-content: flex-end; gap: 2px; flex: none; margin-bottom: var(--esc-sp-lg); padding: 2px; border-radius: var(--esc-radius-sm); background: var(--dsw-alias-bg-skeleton); }
.esc-my-experts-segment-item { height: var(--esc-summon-h); padding: 0 var(--esc-sp-base); border: 0; border-radius: var(--esc-radius-sm); background: none; color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: var(--esc-fs-xs); font-weight: 500; line-height: 1; cursor: pointer; }
.esc-my-experts-segment-item[data-esc-selected='true'] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-weight: 600; }
/* 内容区那一格（WB 那边是专家卡片网格）：今天放着唯一提示组件那一棵树。 */
.esc-my-experts-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.esc-my-experts-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }

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
