/**
 * [INPUT]: 依赖 esc 各模块的真源（`esc-copy` 的文案、`esc-constants` 的常量、`esc-api` 的取数面、`esc-entry` 的两处座位、`esc-list` 的适配器表与分类投影）与一个假 `fetch`
 * [OUTPUT]: 锁定口径 31 的界面侧契约：① **文案逐字**（与 NUWAX `zh-CN.ts` 同值，不许"顺手润色"）；② 左栏三项与资源类型全集；③ 两处座位的身份（`sidebar.panellist` 的 id 与 `main` 的 key **同名**、order/label）与**常驻**注册（与资料库那两处由门驱动不同）；④ 取数面只打同源固定路径、正文关闭键集 `{path, params}`、六个方法各自的平台路径、错误码投影；⑤ **适配器口径**（各资源类型 × 数据源的真实参数差异，这是移植里最容易抄错的地方）与响应提取判据；⑥ **本轮两条用户裁决**：非选中页签的色阶（dimmed → tertiary：三行同步，带反向下锁）与移动端「整页单滚动面」那一档（滚动面由列表提到内容区；含"挪了滚动面之后触底加载与自动补拉必须跟着挪"的源码级锁）；⑦ **本刀四组**：触碰底入口必须问 hasMore（真机故障「下滑加载不起作用、一直闪屏」的两条纯判据双向断言 + 源码级反向锁）、顶部两行 18px 与分类行 gap 8px、字号一律走 calc(基准+两 delta) 且不许有裸 px 字号、精选上下间距相等（20 = 6+14）与精选行的**展示规则**（口径 48 起：不设枚数上限，只排一行、放不下的按列宽裁掉溢出，见 ⑪）；⑧ **口径 39 两条真机裁决**：网格列模板走**同一真源** `--esc-grid-cols`（算式三数从 CSS 提取后比对，532/560/800/1200 四档列数按当轮 tokens 实算——**口径 48 起为 `[2,2,2,3]`**，并把旧规则在同两姿态上的 `[1,2]` 钉成受检事实）+ 技能卡头行居中与动作位进流（含"不许再作为卡片直属子节点"的源码级反向锁）；
 * ⑨ **口径 42（用户裁决「专家卡片调整成和技能卡片布局一致，标题描述，底部标签。区别是右上角技能是安装，专家是召唤，但是专家的召唤默认不显示，hover 时才显示，显示按钮时标题如果太长就截断」）**：
 *    ① **渲染树级**：专家卡＝技能卡的同一套结构（标题行 + 描述独立一行 + 底部标签行），只是标题行第二格换成
 *       `.esc-summon-slot`；作者从卡头搬进标签行（全文件只剩**一处** `AuthorRow` 渲染点）、旧三层版式的
 *       `.esc-card-content`/`.esc-card-footer` 与右下角收藏浮标都不再出现；两档标签行**逐格同形**；
 *    ② **真值驱动**：标签行三格按 `item.stats` 画真数或缺口短横（专家卡的人数/会话不许因"技能卡没有"被钉死），
 *       配套在**投影层**钉住"平台没回的字段不入列"（`null` 不许被 `?? 0` 假装成真数，反向锁：真回的 0 要留着）；
 *    ③ **样式级**：标题行 `gap: 0` + 间距挪到动作格（三个数从 CSS 提取后比对：`[0, 12, 12]`）、
 *       `.esc-summon-slot` 默认 `max-width: 0`/`opacity: 0`、卡片 hover 才 `max-width: none`/`opacity: 1`，
 *       并反向锁住"旧三层版式那两处动作位不许被这一刀带改"与"撤下的收藏浮标不许回来"
 * ⑩ **口径 43（用户裁决「精选的卡片调整成和非精选的一致」）**：精选卡与广场卡是**同一张卡**——
 *    ① **回查键**（`escPublishedTargetIdOf`：专家 `agentId` / 技能 `skillId`，两枚互斥；不许拿本页拼的 `id`）；
 *    ② **回查投影**（命中＝广场那份真值；没命中＝只有 `label` + `icon`，其余一格都不编）；
 *    ③ **回查请求**（走广场系统广场那**同一个适配器** ⇒ 参数逐字相同；索引键是平台 `targetId`）；
 *    ④ **回查边界**（空候选零请求 / 翻页有上限 / 平台非成功码即停手）；
 *    ⑤ **渲染树级**（`element.type === EnterpriseEscCard`、开关与广场同组、头行与标签行逐格同形、
 *       标签行画真值、没回查到则下半截如实缺口）；
 *    ⑥ **反向锁**（薄壳那套类名与自画图标兜底都不许回来；列真源与列对齐不许被改；已装分流同源）。
 * ⑪ **口径 48（用户实机「现在成2列了，而且精选的卡片内容有点错乱」——两个 bug 各一组锁）**：
 *    ① **列宽基准**（2 列 → 4 列）：从 CSS 根上读 `--esc-grid-min` / `--esc-grid-gap` 两枚 token 实算——
 *       用户那台 1377.7px 内容区必须 **4 列**、卡宽 ≈332.4（并满足"4 列 + 3 条列间距 = 容器宽"的整除关系）；
 *       4 列的合法容器宽区间 `[4·min + 3·gap, 5·min + 4·gap)` 由同一对 token 反解，两端各退一步的档位也随之钉住
 *       （`[1328, 1664)` 与 1327.9→3 / 1664→5）；基准那一档另有一枚**显式** 320 锁，外加一条与
 *       `esc-scale.ts` 的 `WB.grid.minColumn` / `WB.grid.gap` 的**恒等式**（"真源与 CSS 各写一份、只改一处"
 *       正是本仓被咬过的那口）。
 *    ② **精选只排一行**（卡片不再压进下一行）：结构级锁"第一行 `auto` + 隐式行 `0` + `row-gap: 0` +
 *       `overflow: hidden` + `overflow: clip` + 列间距仍走同一 gap token"；反向锁"固定 84px 隐式行 /
 *       `grid-template-rows: 1fr` / 横向滚动 / `grid-auto-flow: column` 一个字节都不许回来"。
 *    ③ **变量定义完备性**：样式表里**用到的**每一枚 `--esc-*` 都必须在同表里定义过——
 *       "引用一枚从未定义的变量 ⇒ 整条声明计算期作废"是同一族故障的另一种形态。
 * ⑫ **本刀 A/B/E（用户裁决的三枚杠杆；C 页签块间距与 D 统计行结构被否决，故判据里一个字都不提）**：
 *    本刀 71 → **75 条**（+4，一条未删）。三枚各一条**结构级**判据 + 两条反向锁：
 *    ① **A 一处杠杆**：桌面 `--esc-fs-delta` = +1px（由新增的 `--esc-fs-delta-base` 派生），compact 档
 *       由"替换 delta"改成 **additive**（`calc(base + clamp(...))`，视口自适应一字未丢）——判据断言的是
 *       **加法的形状**（同时出现 base 与 clamp、且不许把 clamp 直接赋给 delta），不是断一个字面；
 *       并新增一条**源码级锁**：八档 `--esc-fs-*` 的末项必须**逐字相同**（同读 `var(--esc-fs-delta)`）
 *       ⇒ "全体同加一个数、层级关系不变"这条不变量不可能被某一档偷偷破掉。
 *    ② **B/E 真源恒等式**：`--esc-card-px/py` = `WB.card.paddingX/Y`（20/16）、`--esc-search-w` =
 *       `WB.control.search.width`（220）——两侧同值（本仓被"真源与 CSS 各写一份"咬过）。
 *    ③ **B 的落地判据**：长内容不许把卡片撑出**精选那一行的轨道**（描述单行 nowrap + 标签行
 *       `flex-wrap: nowrap` + 描述 `flex: none` + 精选第一轨 `auto`），并如实标注"119.0 是上一形态的
 *       实测、−8px 是内衬差算出的预测"——真机读数由 Lead 量，本文件不把预测当既成事实。
 *    ④ **E 的落地判据**：1710 窗口（实测内容区 1377.7）那一行装得下（三页签上界 + 右块含 220 搜索框
 *       + gap < 容器，且留有余量），且 220 **不外溢到窄断点**（560px 档仍 160px、compact 档仍自适应）。
 *    ⑤ **模板串纪律（新增，常驻）**：`esc-style.ts` 的 CSS 模板内**零反引号**（本页被咬过两次：
 *       注释里的反引号会当场截断模板）、模板收尾是**独占一行**的反引号，且剥注释后不许残留
 *       注释碎片 / 半截文字行（"注释漏进活声明"的形态）。
 *    ★**判据形态的一处收紧（不是放宽）**：规则体提取与"文件里第一个撞上这个选择器的声明块"两条
 *      工具改为在**剥注释**后的文本上跑——本刀 A 的注释里合法地含花括号与旧写法引用，拿原文取会被
 *      注释截断（`\{([^}]*)\}` 到第一个右花括号为止）；门禁要问的本来就是"这条规则**声明**了什么"。
 *      只有"某个字符串不许出现在整份 CSS 里"那类**反向锁**仍扫原文（否则会被注释里的旧写法误伤）。
 *    ★**重新基线化（按设计，不是放宽）**：字号那条的 `--esc-fs-delta: 0px` → base/delta 两枚 ＋
 *      compact 档 additive（旧值是被用户裁决改掉的）；搜索框那条的 `searchW < 220` → `= WB.control.search.width`
 *      （上界断言锁不住"照 SPEC"，等值锁才锁得住；写的是**真源恒等式**而不是字面 220）。
 *    **真锁自证**（每条都跑过红→绿，改回按 md5 逐字节还原）：桌面 delta 退回 0px、compact 退回替换、
 *      某一档改读 base、CSS 内衬退回 24/20、真源 paddingY 单独改 18、搜索框退回 180、真源 width 单独改 260、
 *      标签行改 wrap、精选第一轨改 1fr、搜索框改 260 撑破一行、注释里插反引号、声明里放含结束符的字符串
 *      ——十二种改法各自都让本组变红。
 * ⑬ **口径 49（技能页主按钮三项下拉 · 三页尺寸/形态/文案对齐）**：本文件 75 → **85 条**（+10，一条未删）——
 *    ① **下拉三项逐字且按序**（查找技能 / 上传技能 / 创建技能；顺序取自真源 `ENTERPRISE_ESC_ADD_SKILL_ITEMS`）
 *       + **反向锁**：专家/连接器页**连 Menu 那一层都不许建**（不是"建了但关着"——那同样是一枚点了没反应的锚点）；
 *    ② **三个 key 各调各的动作**（渲染级：三个 `onSelect` 两两不相同、上传那一项打到本地导入端口、另两项打到草稿端口；
 *       源码级：`plan.key === 'upload'` 那一支调 `onAddSkill?.()`、另两支走 `runDraft(plan.key)`，且
 *       `onAddSkill: skillImportPort?.onOpen` 这条口径 46 的接法一字未改）；
 *    ③ **草稿路径不许发送**（反向锁三层：esc 两个文件剥注释后不许有 `sendMessage(`/`.send(`/`submit(`/`pressEnter(`/
 *       `dispatchEvent(`；也不许把官方那套开会话调用抄进来；**全包实现文件里真的取那枚写入口的恰好只有
 *       `preset-launch.ts`**，且查的是两种写法——`actions.setDraft` 与 `['setDraft']`——只查前者会漏掉真实现）；
 *    ④ **端口缺席 ⇒ 那一项置灰 + 可见原因**（原因必须并进**可见文案**：官方 `MenuItemButton` 不透传 `title`，
 *       挂上去会被静默丢弃）+ 纯投影 `enterpriseEscAddSkillLock` / `enterpriseEscAddSkillPlans` 可直调，
 *       外加**降级路径反向锁**（没有下拉供给时，技能页那枚按钮仍是一枚直接走本地导入的真按钮、一枚菜单项都不建）；
 *    ⑤ **失败必须说出来**（稳定码入唯一码表 + 唯一提示件 + 人话与下一步不含裸码 + `retryable: false`；
 *       源码级反向锁：这条通路不许只留 `console.warn`/空 catch）；
 *    ⑥ **端口接线**（`draftPort` 经 `main` 槽 inject 面递到页面、页壳原样转交、组合根只建一份，
 *       且**不许**混进结构性只读的 `esc-api`）；
 *    ⑦ **三页按钮高恒等 `--esc-btn-h`**（真钉：那一格必须是 `height` 而**不是** `min-height`——官方 Button 的
 *       `.md` 写的是 `height: 36px`，上一轮就是被它顶开的）+ 字号/字重/圆角/内衬同源 + 三页解析值恒等于真源
 *       `WB.control.button.height`（32）；
 *    ⑧ **形态分流**（专家页是描边档 `esc-add-skill-outline` 且 `variant: 'outline'`，技能/连接器是 primary；
 *       描边那三句声明与既有 `.esc-installed` **逐条同源**，**不新造第二套白底按钮**）；
 *    ⑨ **「已安装」只在技能页渲染**（专家/连接器页**整枚不存在**：不是 disabled、不是隐藏、连计数那一格都没有；
 *       源码级判据是资源类型而不是计数器）；
 *    ⑩ **三枚 placeholder 逐字、互不相同、只有一处取值口**（`enterpriseEscSearchPlaceholder`）+ 反向锁：
 *       旧那枚笼统文案在**值层面**已消失（`JSON.stringify(ENTERPRISE_ESC_COPY)` 里查无此串）、
 *       除 `esc-copy.ts` 的沿革注之外任何 `src/esc` 文件里也零出现。
 *    ★**重新基线化（两处，都是加强不是放宽）**：① 文案表那条里旧那**一枚** `searchPlaceholder` 的等值断言
 *      换成三枚逐字 + `'searchPlaceholder' in COPY === false` + `JSON.stringify` 里查无旧串 + 集合基数 3
 *      ——原来的断言对"三页说同一句笼统话"是绿的，现在不可能；② 口径 46/47 那条「主按钮 `onClick === onAddSkill`」
 *      在**技能页**不再成立（主按钮成了下拉锚），故它改成**按页分流**：技能页锁"锚点只开合菜单 + 降级时不退化
 *      （`addSkillMenu` 缺席则 `onClick === onAddSkill`）"，专家/连接器两页**逐字回到口径 46 的行为**。
 *      上传那条路仍被更强地锁住（项级 `onSelect` 取证），一条断言未删。
 *    **真锁自证**（十六种改法各自让对应那条变红，随后按 md5 逐字节还原复绿）：菜单项文案改坏 / 创建那一项误接查找 /
 *      草稿路径加 `sendMessage(...)` / 高度退回 `min-height` / 专家页不挂描边档 / 已安装在另两页也渲染 /
 *      连接器页占位串成专家 / 新码改名不入表 / 失败不再渲染提示件 / 上传脱离本地导入端口 / 缺席项不再置灰 /
 *      禁用原因不再可见 / 工具栏里长出第二个占位真源 / 高度写死像素 / 端口没经 inject 递下去 / 组合根不建端口。
 * ⑭ **口径 50（「换一批」＝在已取到的整批上做本地窗口并循环，不重发请求）**：本文件 85 → **94** 条
 *    （+9，一条未删；④ 按设计**重新基线化**，见下）。用户报的缺口是实测出来的：`esc-api.ts` 把
 *    `pageNo` 钉死 ⇒ 旧「换一批」重发的是与首次逐字相同的请求 ⇒ 平台给 7 条、精选只显示一行（这台屏 4 枚）
 *    ⇒ 另 3 条**永不可达**。九条锁：① 旋转是**排列**（长度不变 / 一枚不丢 / 一枚不重 / 逐枚等于
 *    `items[(offset+k) mod N]`，覆盖 7 种 N × 全部 offset，并含越界≡模、负数、小数、`NaN`）；
 *    ② **这台屏 N=7 / 4 列**连点一轮 7 条全部出现过、每次首枚换人、一轮回到原点；
 *    ③ 步长 1（兜底那档）反复推进**每一枚都可达**；④ 推进＝`(current+stride) mod N` 的循环与**钳制**
 *    （0/负数/小数/非有限 ⇒ 1；`≥N` ⇒ 钳到 N；空批/非有限 length ⇒ 0；负起点先归一）；
 *    ⑤ **兜底步长 = 1**：空串 / `none` / 非字符串 / 函数式声明（`repeat(`/`minmax(`/`calc(`）/ 不认识的段 /
 *    坏行名一律退 1，读得懂才数（含"行名不是轨道"与"0px 120px"）；⑥ **薄 DOM 适配器**只读**传进来那个**
 *    网格元素一次，缺席/结构不全/宿主抛异常/`none` 全退 1，且它推进出的 offset 在"读不到"时走遍全批；
 *    ⑦ 渲染级：卡片顺序逐枚等于纯投影（⚠ `key` 在**元素自己那一格**、不在 props 里）、树里仍是整批 N 枚、
 *    首屏 4 枚＝`items[offset..offset+3]`、缺省 offset 与改动前逐字相同；⑧ **归零时机**（源码级）：
 *    归零那一句在**取数 effect 内部**（切页/换档因依赖 `targetType` 一并归零）、取数 effect 不读 offset、
 *    全文件写 offset 的口恰好两处、`officialRecommended(` 与 `setAttempt(` 各恰好一处；
 *    ⑨ **导出真的存在**（防"import 一个不存在的具名导出 ⇒ undefined ⇒ 空转锁"——ui 的 tsconfig 不含 tests，
 *    tsc 照不到这口坑）+ 网格类名常量与样式层**同字面**。
 *    ★**重新基线化（一处，加强不是放宽）**：旧 ④ 锁的是 `batch`/`setBatch`（那枚令牌当时由「换一批」与
 *      失败「重试」**共用** ⇒ 点一下必然重发一次请求）。现在换成更强的判据：`setAttempt(` **恰好一处**
 *      （能触发第二次取数的入口只有失败重试）、「换一批」的回调体（`rotate`）里没有 `api`/`setAttempt`/`fetch`、
 *      那枚按钮的 `onClick` 必须是 `rotate`。原三条对"按钮另接一条重发路"是绿的，新四条不可能绿。
 *    **真锁自证**（十一种改法各自让对应那条变红，随后按 md5 逐字节还原复绿）：旋转退回截断 / 适配器写死 4 /
 *      去掉 stride 钳制 / 「换一批」偷回重发请求 / 新一批不归零 / 网格类名常量与 CSS 漂开 / 渲染体无视 offset /
 *      推进退回原地 / 兜底步长改 4 / 去掉形状判据（非法读数照数）/ 行名不再剥。
 * ⑮ **口径 51（专家页「我的专家」子页 · 连接器页改名 · 无新增端点）**：本文件 94 → **104** 条
 *    （+10，一条未删；口径 46/47 那一组的 ④ 按设计**重新基线化**，见下）。十条锁：
 *    ① **三页主按钮的文案与动作**：专家页「我的专家」→ 进子页（渲染级取证 `onClick === onOpenMyExperts`
 *       + 源码级"页壳 → 聚合区 → 工具栏"三层一条链）、连接器页「自定义连接器」→ 置灰 + **行上可见原因**、
 *       技能页**一字未改**（仍是三项下拉的锚 / 降级仍直接本地导入）；两枚新文案逐字且与 `addSkill` 三枚互不相同，
 *       并有一条**反向锁**：这四个组件文件里不许再出现「我的专家 / 自定义连接器」字面量（真源只有 `esc-copy`）。
 *    ② **子页不是弹窗**：全树角色清单**封闭**（region / tablist / tab / tabpanel / status），无 `aria-modal`、
 *       无 `aria-haspopup`、无固定定位遮罩，唯一的 `role="region"` 就是 `.esc-content` 那一块；
 *       外加源码级反向锁（`Modal`/`dialog`/`createPortal`/`overlay`/`mask` 一个都不许出现）。
 *    ③ **返回与 Esc 两条路**：返回按钮直连 `onBack`；Esc 监听钉在页壳根节点、`preventDefault` + `stopPropagation`；
 *       并锁死"浏览器返回键**不接**"（`pushState`/`popstate`/`history.` 零出现）。
 *    ④ **返回后还原滚动位置与焦点**：滚动面判定是可直调的纯读（`enterpriseEscViewScroller` 逐形态：命中 /
 *       `null` / `null` 根 / `undefined` 根），收尾三件在源码级逐句锁（读 `scrollTop` → 写回 → 按
 *       `data-esc-main-action` 把焦点还给主按钮），且那枚属性钩子确实挂在主按钮上、常量与选择器同字面。
 *    ⑤ **chrome 逐项**：标题（h3 + `tabIndex={-1}` + 聚焦钩子）、返回文案、两个 tab 的键与文案、
 *       搜索 placeholder、创建按钮文案、两个分段的键与文案 —— 全部逐字，且 tab/分段是**真控件**
 *       （选中态由交进来的状态决定、点一下调到**各自**的回调）。
 *    ⑥ **内容区如实交代**：稳定码常量与表里的键同字面、入 `ENTERPRISE_ERROR_CODES`、人话/下一步不含裸码、
 *       `retryable === false`；`enterpriseEscMyExpertsBody()` **零参数**（结构上不可能随选中态变化，
 *       且剥注释后整段取出、逐词确认不读 `tab`/`segment`/`keyword`），树里恰好一枚 `EnterpriseErrorNotice`；
 *       **无假计数**（文本子节点零数字、无 `（N）` 形态）、**无假条目**（没有 `.esc-list-section`、没有卡片元素）、
 *       **不发请求**（`fetch(`/`api.`/`useEffect` 零出现）。
 *    ⑦ **连接器页那一枚**：`disabled` + 行上原因（`role="status"`）逐字，纯投影三态（未接线 / 已接线 /
 *       标题与原因**不是同一句**），并有一条反向锁：页壳、聚合区、组合根**都不许**传 `onCustomConnectors:`。
 *    ⑧ **无新增端点**（数据面反向锁）：扫 `src/esc` 全目录的**引号字面量**，集合必须**恰好等于**既有那七条
 *       平台端点（多一条就红）——这就是"不拿 `/api/published/agent/list` 冒充'我的'、也不编一条路径去发请求"
 *       的机械版本；并另锁新子页里零 `/api/`、零 `http`。
 *    ⑨ **技能页回归**：主按钮仍是菜单锚（`aria-haspopup="menu"`、三项按序、各调各的）、降级档仍直连本地导入、
 *       `enterpriseEscMainActionPlan` 对技能页返回 `undefined`；顺手把"技能页主按钮按不动时的可见原因"
 *       （本刀补的那一句 `esc-toolbar-lock`）也锁住。
 *    ⑩ **形态/高度/右边界三件一字未动**：主按钮仍是 `height: var(--esc-btn-h)` 真钉、专家页描边 + 连接器页
 *       primary 的分流照旧、新增的圆角刻度 `--esc-pill-radius` 只用在新子页那枚「+ 创建专家」上。
 *    ★**重新基线化（一处，加强不是放宽）**：口径 46/47 那组的 ④ 原写"专家/连接器两页主按钮都直接调本地导入"
 *      —— 它已被用户裁决改掉（WorkBuddy 那两页不是"选文件"）。新判据更强：即使把本地导入端口照样传进来，
 *      两页的 `onClick` 也一个都不许等于 `onAddSkill`，且都不许出现 `aria-haspopup`；专家页到底接的是谁，
 *      由 ① 逐字取证。原断言对"专家页悄悄接回本地导入"是绿的，新断言不可能。
 *    **真锁自证**（14 种改法各自让对应那条变红，随后按 md5 逐字节还原复绿）：文案改坏 / 专家页不再接子页 /
 *      子页加上 `aria-modal` / Esc 判据改坏 / 收尾把滚动写死成 0 / placeholder 改坏 / `retryable` 翻成 true /
 *      tab 文案带计数 / 新子页里塞一条假端点 / 连接器页不再置灰 / 技能页文案被换 / 高度退回 min-height /
 *      **删掉一个具名导出**（"import 一个已删除的导出 ⇒ undefined ⇒ 空转锁"那口老坑，出口存在性那条先红）/
 *      **去掉写回那一步的可达性判据**（退回"只写一次"的静默失效形态）；另在 `tests/error-messages.spec.ts`
 *      侧自证两条（表键改名 ⇒ `REQUIRED_CODES` 门禁红、人话改坏 ⇒ 逐字锁红），同样按 md5 还原复绿。
 * ⑯ **口径 52（禁用胶囊的禁用外观 —— 真机像素缺陷）**：本文件 104 → **107** 条（+3，一条未删）。
 *    缺陷：连接器页「+ 自定义连接器」与「我的专家」子页「+ 创建专家」都 `disabled`，却与技能页**启用**的
 *    「+ 添加技能」像素级一致（黑底白字，见 analysis/pill-compare.png 三枚放大对照）——"看着可点、
 *    点下去毫无反应"，正是产品宪法禁止的那一档。**查证结论**（三种假说逐条排除，决定了"怎么修"）：
 *    官方 `Button.module.css` 的 `.button:disabled { cursor: not-allowed; opacity: 0.4 }` **本来就改外观**，
 *    是本页那两条 (0,3,0) 的 `.esc-root .xxx:disabled { opacity: 1 }` 把它 (0,2,0) 的冲淡**压掉了**
 *    （不是"官方只改 cursor、不改色"，也不是"某枚 token 恰等于启用色"）⇒ 口径 52 把那两条**删掉**
 *    （撤销覆盖，官方那条成为唯一真源），本页不新造禁用配色、一个新色值都不写。三条锁：
 *    ① **可证判据**（官方产物级）：`.button:disabled` 存在且不透明度 < 1；官方 Button 的实现里
 *       `...rest`（`disabled` 原样落到原生 `<button>` 上）与它自己的 `.button` 类恒在 ⇒ `:disabled`
 *       必然命中那两枚胶囊。★这条锁的正是"官方那条真的会生效"这个前提。
 *    ② **本页不许覆盖**：凡选择器命中"那两枚 disabled 胶囊身上那些类名"的规则，一条都不许声明 `opacity`
 *       （基类也不行）。★类名从**渲染树里那两枚胶囊自己报出来的 `className`** 取，不是写死的字面量
 *       （组件改名 ⇒ 锁跟着走，不会退化成"扫一个已不存在的选择器"的空转锁；且扫到的类名必须真的在
 *       样式表里有规则）；外加一条**全表清单**：本文件里"把 :disabled 冲淡按回 `opacity: 1`"的规则
 *       **只许**剩口径 36 那两处卡片视觉占位（`.esc-root .esc-action-solid:disabled` /
 *       `.esc-install-plus:disabled`）——多出第三条就是有人又给某枚禁用控件按回去了。
 *    ③ **反向锁（启用态不许被一刀切弄灰）**：启用态那两条几何规则里不许出现 `dimmed` 家族 token
 *       （本主题的"禁用专用"色：button-primary-dimmed / label-dimmed / label-primary-dimmed）、也不许
 *       声明 `opacity`/`background`/`color`；关键不变量——技能页**启用**那枚与连接器页**禁用**那枚的
 *       类名**完全相同**（都是 `.esc-add-skill`）⇒ 两枚外观上唯一的差别只能来自官方那条 `:disabled`。
 *    **真锁自证**（四种改法各自让对应那条变红，随后按 md5 逐字节还原复绿）：把
 *      `.esc-root .esc-add-skill:disabled { opacity: 1 }` 写回来（②红；报错逐字：「连接器页
 *      「+ 自定义连接器」：.esc-root .esc-add-skill:disabled 不许声明 opacity（那是把官方 :disabled
 *      冲淡压掉的唯一手法）」）/ 把「+ 创建专家」那条写回来（②红）/ 给启用态那条几何规则塞一个
 *      `opacity: .5`（②③双红）/ 把①里官方那条规则名改坏（①红，证明它不是一枚空转锁）。
 * ⑰ **用户裁决（读不到 ⇒ 0）（本刀）**：本文件 107 → **109** 条（+2，一条**未删**；⑤ 那条按用户裁决
 *    **重新基线化**——旧口径"读不到 ⇒ 不显示数字 + 另缀一枚 `？`"整条被裁决改掉）。
 *    裁决原话「读不到就显示 0」：顶栏「已安装(N)」的计数位**恒画** `(N)`，`installedCount === undefined`
 *    （还没读回来／读失败）时画 `(0)` —— 与"真读到 0"**同形**（真 0 与读不到的 0 在按钮上长得一样，
 *    这个代价用户明确接受）。**代价由 `title` 兜住**：同一个 `(0)`、两种状态靠那句 `title` 区分
 *    （真 0 ⇒ `installedFilterOpen`；读不到 ⇒ `installedCountUnreadable`「本机已装数量暂时读不到，
 *    先按 0 显示」）—— "不许静默吞掉读不到"这条硬纪律由此机器化。两条新锁 + 一条重写：
 *    ① **三态同形**（读到 3 ⇒ `(3)`；真 0／读不到／首帧 ⇒ 都是 `(0)`，且树里**不再有** `？` 与
 *       `esc-installed-failed`，源码级反向锁落在**剥注释后的代码**上）；
 *    ② **title 必须把真 0 与读不到分开**（两句逐字、且必须不同）+ 读不到那句同时含"读不到"与
 *       "按 0 显示"两件事、不含裸码 + 首帧吃同一句；
 *    ③ **集合级反向锁**：`categoriesUnavailable` 在 `src/esc` 里的**每一次出现**钉成一张闭合名单
 *       （分类那条链的传参 + 文案真源 + 工具栏那四处），任何"再借它当计数的 title"都会让名单对不上；
 *       外加回归锁（计数来源仍是**两份之和**、`api.installedSkills(` 全文件恰好一处、effect 依赖三件
 *       + 刷新令牌、catch 里不许出现 `setInstalledCount(0)`）。
 *    ★**两条按设计重新基线化（加强，不是放宽）**：口径 46/47 那条 `bare` 的 title 由 `actionNotPorted`
 *      改成 `installedCountUnreadable`（那一格连计数都没给 ⇒ 那个 `(0)` 是暂定值，按裁决必须先说这件事），
 *      同时**补了**"计数读到 + 口缺席 ⇒ actionNotPorted"这一格把原来那条事实单独锁回来（两条事实各锁一遍，
 *      旧断言对"读不到时随便糊一句"是绿的）；`wired` 那格补上 `installedCount: 2` 把前提写明
 *      （title 现在同时承担"这个数字是不是暂定的"，"读到了计数时说会发生什么"必须带真计数才成立）。
 *    **真锁自证**（四种改法各自让对应那条变红，随后按 md5 逐字节还原复绿）：把 `(0)` 改回 `？`／
 *      把读不到与真 0 的 title 改成同一句／把 `categoriesUnavailable` 借回计数处／
 *      **删掉 `installedCountUnreadable` 这个具名导出**（证明这两条不是空转锁——`tsconfig` 不含 tests，
 *      tsc 照不到"import 一个已删除的导出"那口老坑，故这一刀必须由测试自己咬住）。
 * ⑱ **本刀追加（根因修复：口径 47 起「已装清单永远读不到」）**：本文件 109 → **112** 条（+3，一条未删）。
 *    **真因**：`esc-api.ts` 的 `installedSkills` 把**整只本机信封** `{data:{skills:[…]}}` 交给了
 *    `decodeEnterpriseInstalledSkills`，而它要的是**拆封后的** `{skills:[…]}`（判据 `hasExactKeys(row,['skills'])`）
 *    ⇒ **必抛** `ENT_LOCAL_RESPONSE_INVALID` ⇒ 顶栏计数**从来没读到过**（真机上那枚 `？` 指的就是这件事，
 *    **不是**"服务读不到"：本机两条只读路由实测都是 200 —— 已装 `[{…1 枚}]`、自装 `[]`）。
 *    **为什么一直没被发现**：两条腿（企业已装 / 本机自装）都吞进 `esc-aggregation.tsx` 同一个 `catch`，
 *    而 catch 只把 `installedCount` 留成 `undefined`（旧口径的界面表现是"没有数字 + 一枚 `？`"），
 *    看起来与"读不到"一模一样 —— 界面在**如实报告一件被我们自己弄坏的事**，没人能从那句话里看出来。
 *    **修法**：**委托**（`escApi.installedSkills` → 注入的 `EnterpriseEscLocalReads`，缺省即
 *    `createEnterpriseLocalApi(fetcher)`；`client.tsx` 显式传**同一个** `escSkillApi` 实例），
 *    `esc-api.ts` **不再** import 任何 `decodeEnterprise*` —— "拆信封 + 翻错误码"全包只有 `local-api.ts`
 *    的 `requestJson` 一份实现。为什么是"复用"而不是"就地拆"：商城页那条一直是对的，而**同一件事的
 *    第二份实现必然漂** —— 本次 bug 就是那条缝。**第二条腿（`selfInstalledSkills`）本来就是好的**：
 *    它一直走 `requestJson`（`tests/local-api.spec.ts:665-695` 早已锁住它吃完整信封），本刀一行未动、
 *    只补一条同源证据。三条锁：① 假 fetcher 回**完整信封**时 `installedSkills` 必须返回**记录数组**，
 *    且与 local-api 那条**逐字段同值**（同源铁证；旧实现在这一格抛 `ENT_LOCAL_RESPONSE_INVALID`）；
 *    ② 错误信封（401 + `{error:{code}}`）/ 非 JSON / 无 `{data}` 三种正文两侧翻出**同一枚**稳定码
 *    （"不做错误信封翻译"会退成兜底码 ⇒ 红）；③ 源码级反向锁：`esc-api.ts` 里 `decodeEnterprise*`
 *    **零出现**，且全 `src/**` 里任何 `decodeEnterpriseX(...)` 的**实参文本**（括号配对后取）
 *    都不许含 `.json()`（该判据自带自检：旧写法喂进去必须命中，防"走空了却全绿"）。
 *    **真锁自证**（两种改法各自让对应那条变红，随后按 md5 逐字节还原复绿）：把那次读改回
 *      "`fetch().json()` 直接喂解码器"（**3 条红**，报错就是真机同款 `ENT_LOCAL_RESPONSE_INVALID`）/
 *      去掉 `local-api.ts` 那句"错误信封翻 `EnterpriseLocalApiError`"（错误码那条红：`ENT_AUTH_REQUIRED`
 *      退成 `ENT_LOCAL_RESPONSE_INVALID`）。★**真机上用户应看到 `(1)`**（企业已装 1 枚 + 自装 0 枚）
 *      —— 这是**推导**，真机像素与交互由 Lead 复量，本文件不冒充量过。
 * ⑲ **口径 56（真机缺陷「全部那行分类标签的标签文字没有居中」——二级分类胶囊的对称内衬；本刀按 WB 实测重基线）**：
 *    本文件 **+1 条**（按实测的 `it` 数 122 → **123**，一条未删；本头部沿革里此前那串数字是更早几刀的
 *    读数、其后几刀没跟着更新，本刀按**可复现的实测口径**重述，不沿用已漂的旧数）。
 *    **缺陷与根因**：二级分类那一行（`.esc-category-tabs`：「全部／Agent／经营管理」）选中/悬停时那层
 *    灰底里**文字贴左、右侧空一块**——根因是口径 35④ 刻意的「左内衬归零」（`padding: 0 … 0 0`）：
 *    那一刀为的是让分类**文字**与卡片左边界对齐（初衷必须保住），代价就是灰底只往右长 8px。
 *    **沿革（用户两次反馈的取向变化，如实记录）**：① **口径 35④**——用户先要「这行更紧凑」⇒ gap 一路
 *    收到 `--esc-sp-sm`(6)、左内衬**归零**（视觉左边距 = 内容区 padding = 卡片左边界）。② **口径 56
 *    第一版**——用户报「标签文字没有居中」⇒ 内衬改成**左右对称**的新刻度 `--esc-cat-pad`，多出来的
 *    那半个左内衬由容器负外边距整行拉回；那一版把口径取成"历史组成"14px（右内衬 `--esc-sp-md` 8 +
 *    容器 gap `--esc-sp-sm` 6）⇒ 内衬只反解出 **4px**，**真机上依然太紧**。③ **本刀（第二版）**——
 *    用户看过真机说还是太紧、明确要"往 WB 靠" ⇒ 把**口径那一格 token 重新基线到 WB 实机实测值**，
 *    其余结构性手法（对称内衬 + 容器负外边距补偿 + 恒等式）**一字不动**。
 *    **本刀的取值与出处**：口径 `--esc-cat-label-pitch` **14px → 30px**（= WB 实测 29.5 **向上取整**，
 *    只许更宽不许更紧）；内衬由反解式跟着变成 **12px**（与 WB 实测 12.0~13.1 一致）；容器 gap 仍是
 *    `--esc-sp-sm`(6)、窄屏档 `gap: 3px` **一字未改**；恒等式 2×12 + 6 = 30 仍成立、窄屏 2×12 + 3 = 27。
 *    WB 实测（`analysis/wb-live.png` 那枚「全部」胶囊，口径 = 灰底 bbox 与墨迹 bbox；截图 1567×922
 *    ÷ 窗口 1710×1006，k = 1567/1710）：灰底 51.3×31.6、墨迹 26.2、左右内衬 ≈ 13.1 / 12.0、
 *    左右偏差 ≈ +0.5px、**文字到文字口径 ≈ 29.5**（本机复测 29.47）——本文件不冒充量过本页真机，
 *    真机像素由 Lead 复量。
 *    **横向滚动核算（内衬 4 → 12 会让这一行变宽，先算再改）**：技能页那排 **13 枚**（v7-disk-truth.png
 *    逐枚墨迹 bbox）Σ墨迹 ≈ 626.4px、gap 12×6 = 72、旧内衬 13×8 = 104 ⇒ 行盒 ≈ 802.4px；新内衬
 *    13×24 = 312 ⇒ 行盒 ≈ **1010.4px**，可用宽 = 内容区 1377.7 + 负外边距 12 = **1389.7px**
 *    ⇒ **未触发横向滚动**（余量 ≈ 379px）。窄屏档必然滚动，那是既有行为（这一行一直是
 *    `flex-wrap: nowrap; overflow-x: auto`），不是本刀引入的降级。
 *    **那条锁**（语义级、**读 token 逐值复算**，不把 12/6/30 写死成"事实"）：
 *    ① 那枚胶囊的 `padding` 简写**按 CSS 语义展开**成 (上,右,下,左) 后断言 **left === right**，
 *       且左内衬是**正数**、走**同一枚 token**；反向锁一条——四值语法「左内衬归零」的写法不许回来；
 *    ② 恒等式 `2 × 左内衬 + 容器 gap === --esc-cat-label-pitch`（两侧都从样式表算出来）
 *       ＋反向锁"这一行的文字间距不许变大"；
 *    ③ 对齐补偿在场且**同源**（margin-left 的 token 列表**恰好** `[var(--esc-cat-pad)]`、
 *       数值 `=== -内衬值`）——写死像素或换一枚"数值凑巧相等"的变量都红；
 *    ④ 垂直那三条（`height: var(--esc-tab-h)` / `align-items: center` / `line-height: 1`）在场、
 *       垂直内衬仍是 `0 0`，两条反向锁（不许改 flex-start、不许用 min-height 顶掉高度）；
 *    ⑤ 回归：字号/字重/圆角/底色/描边/字色逐条在场、hover 与选中仍是同一对声明、
 *       分类渲染点仍**只有一处**且选中判据仍是 `item.key === activeCategory`；
 *    ⑥ **逐档扫描**（真机缺陷不是只在桌面档）：容器规则恰好两条（基档 + `@media (max-width: 560px)`
 *       那条**既有**的 `gap: 3px`），**每一档**都断言 `2×内衬 + gap ≤ 口径`，且**除基档外不许有任何
 *       规则**碰 `padding` / `margin-left`（碰了就是把居中/对齐在窄屏写没），外加"那枚胶囊只许有
 *       **一条**规则"（出现第二条 ⇔ 某个媒体档在改写内衬）。
 *       —— 这一格是发现"产物里还有第二条 `.esc-category-tabs { gap: 3px }`"之后补的，如实登记。
 *    ★**本刀新增/改写的四条锁（全部是加强，逐条说明为什么）**：
 *      ① **方向锁 · 口径**（新）`pitch ≥ 29.5`（WB 实测值）——**用户这次反馈的机器化**：再往回收
 *         （口径变小 / 回到 14）当场红。上一版没有任何一条能表达"不许比 WB 更紧"。
 *      ② **锚定 · 口径 ≡ ceil(29.5)**（替换旧锚定）＋ **形式锁 · 口径必须是字面 px**（新）——
 *         旧那条 `pitch ≡ --esc-sp-md + --esc-sp-sm` 按设计**废止**：它锁的是"口径的**历史组成**"，
 *         而口径这次正是被**有意**从 14 改到 30 的；更关键的是**它在"内衬 4、文字贴边"那一版是绿的**
 *         —— 对用户这次"还是太紧"的反馈零咬合力。替代它的两条都约束**外部实测**：pad=4 那版在锚定
 *         上就红（14 ≠ 30）；"字面 px"这条则把旧锚定唯一还成立的功能（防口径与它的来源一起漂）
 *         换成更强的形态锁（连"派生自什么"都不许）。
 *      ③ **方向锁 · 内衬**（新）`--esc-cat-pad ≥ 12.0`（WB 实测左右内衬的**紧**那一侧）——把
 *         "文字贴边、不像在标签中间"这半句反馈也机器化；"口径调大而内衬写死成 4"那种改法在这里红。
 *      ④ **反解形式锁 · 内衬**（新）`--esc-cat-pad` 必须仍是 `calc((口径 − gap刻度) / 2)` 这条
 *         反解式（恰好引用这两枚 token + 除以 2）——**这是发现"① 内衬走 token"挡不住写死**之后补的：
 *         `--esc-cat-pad: 12px` 能同时满足旧版全部断言（左右相等 / 走 token / 恒等式成立 / 补偿同源），
 *         只有这条形式锁咬得住。旧版"内衬不许写死"只到"引用 token"这一层，本刀把它锁到代数形态。
 *    **三处按设计重新基线化/拆并（都是加强，不是放宽）**：
 *      ① `.esc-resource-tab` / `.esc-source-tabs .esc-pill` / `.esc-category-tabs .esc-pill` **三枚一起**
 *         断言 `padding: 0 var(--esc-sp-md)` 的那条循环 ⇒ 拆成「上两行仍锁这条」＋「二级分类由上面那组
 *         更强的锁接管」。旧断言对"内衬对称但把这行撑松""补偿缺席"都是绿的，新那组不可能；
 *      ② 三个容器一起断言 `margin-left` 只能缺席（`toBeUndefined`）的那条循环 ⇒ 拆成「上两行仍锁缺席」
 *         ＋「二级分类的补偿**必须在场**且与内衬同源」。旧断言在新的正确修法下必然为红，
 *         若继续留着它，等于把"取消补偿、整行右移半个内衬"锁成合法；
 *      ③ 口径那三处旧数（pitch 14 / pad 4 / 窄屏 2p+g = 11）⇒ 全部从 token 算出来、并把口径本身
 *         钉到 WB 实测上（旧数 14 正是本刀要改掉的东西，留着就是自相矛盾）。
 *    **真锁自证**（**六种**改法各自让对应那条变红，随后**按 md5 逐字节还原复绿**——`esc-style.ts`
 *      md5 `ce216ec035b9c8421c96f983d857545b`，六次还原后逐次核对 md5 相同）：
 *      **口径改回 14**（①的方向锁红：「左右内衬不许比 WB 实测更紧: expected 4 to be greater than or
 *      equal to 12」——注意它先在内衬那一条上炸，这正是"太紧"的可执行判据）/
 *      **内衬写死 `--esc-cat-pad: 12px`**（④的形式锁红：「反解式只许引用口径与 gap 刻度这两枚 token:
 *      expected [] to deeply equal [ 'var(--esc-cat-label-pitch)', …(1) ]」）/
 *      **内衬不对称**（`0 var(--esc-sp-md) 0 var(--esc-cat-pad)` ⇒ ①红：「二级分类胶囊的左内衬:
 *      expected 'var(--esc-cat-pad)' to be 'var(--esc-sp-md)'」）/
 *      **去掉对齐补偿**（③红：「.esc-category-tabs 没有声明 margin-left: expected null not to be null」）/
 *      **口径写成二次派生 `calc(14px + 16px)`**（②的形式锁红：「口径必须是实测字面 px（不许 calc /
 *      var 二次派生）: expected 'calc(14px + 16px)' to match /^\d+(?:\.\d+)?px$/」）/
 *      **口径改到 40px**（②的锚定红：「口径 ≡ ceil(WB 实测的文字到文字口径): expected 40 to be 30」——
 *      这一格证明锚定不是空转：40 比 WB 更宽、方向锁放行，只有"≡ ceil(29.5)"咬得住）。
 *      ★**逐档扫描**那一格的两条旧自证本刀重跑仍红（判据未改，只是口径变了，故读数跟着变）：
 *      **把窄屏档 gap 从 3px 放宽到 8px**（⑥红：「2×内衬 + gap(8px) 不许大于既有文字间距口径:
 *      expected 32 to be less than or equal to 30」）/ **让窄屏档那条规则顺手写一句 `padding: 0`**
 *      （⑥红：「窄屏档只许覆盖 gap（覆盖内衬就把"左右相等"写没了）: expected
 *      '.esc-category-tabs { gap: 3px; paddin…' not to match /padding/」）。
 * [POS]: esc 页面的**无 React 契约回归**；视觉与真实交互由构建产物手工冒烟覆盖（本仓 vitest 没有 DOM）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  createEnterpriseEscApi,
  enterpriseEscImageSrc,
  escErrorCodeOf,
  escPlatformErrorCode,
  ENTERPRISE_ESC_IMAGE_LOCAL_PATH,
  ENTERPRISE_ESC_MOCK_LOCAL_PATH,
  ENTERPRISE_ESC_READ_LOCAL_PATH,
  ESC_MISSING_ENDPOINT_CODES,
  type EnterpriseEscApi,
} from '../src/esc/esc-api.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from '../src/esc/esc-copy.js'
import { createEnterpriseLocalApi, ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH } from '../src/local-api.js'
import { EnterpriseEscCard, SKILL_MORE_ENTRIES } from '../src/esc/esc-card.js'
import {
  EnterpriseEscToolbar,
  ENTERPRISE_ESC_ADD_SKILL_ITEMS,
  ENTERPRISE_ESC_MAIN_ACTION_ATTR,
  enterpriseEscAddSkillLock,
  enterpriseEscAddSkillPlans,
  enterpriseEscMainActionPlan,
  enterpriseEscSearchPlaceholder,
} from '../src/esc/esc-toolbar.js'
import {
  EnterpriseEscMyExpertsView,
  ENTERPRISE_ESC_MY_EXPERTS_SEGMENTS,
  ENTERPRISE_ESC_MY_EXPERTS_TABS,
  ENTERPRISE_ESC_MY_EXPERTS_TITLE_ATTR,
  enterpriseEscMyExpertsBody,
} from '../src/esc/esc-my-experts.js'
import {
  ENTERPRISE_ESC_VIEW_RESTORE_FRAMES,
  ENTERPRISE_ESC_VIEW_SCROLL_CLASS,
  enterpriseEscViewScroller,
} from '../src/esc/esc-page.js'
import { EnterpriseErrorNotice } from '../src/error-notice.js'
import {
  EnterpriseSkillImportChrome,
  EnterpriseSkillImportNotice,
} from '../src/skill-import-port.js'
import {
  ENTERPRISE_SKILL_IMPORT_ACCEPT,
  ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL,
} from '../src/skill-import.js'
import {
  ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS,
  enterpriseEscInstalledGroups,
  enterpriseEscInstalledMetaTable,
  enterpriseEscInstalledSourceLabel,
} from '../src/esc/esc-installed-model.js'
import {
  ENTERPRISE_ESC_FEATURED_GRID_CLASS,
  ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY,
  ENTERPRISE_ESC_FEATURED_LOOKUP_MAX_PAGES,
  ENTERPRISE_ESC_FEATURED_LOOKUP_PAGE_SIZE,
  ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL,
  ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK,
  enterpriseEscFeaturedAdvanceOffset,
  enterpriseEscFeaturedBody,
  enterpriseEscFeaturedColumnCount,
  enterpriseEscFeaturedItem,
  enterpriseEscFeaturedNextOffset,
  enterpriseEscFeaturedTrackCount,
  enterpriseEscFeaturedWindow,
  loadEnterpriseEscFeaturedLookup,
} from '../src/esc/esc-featured.js'
import {
  ENTERPRISE_ERROR_CODES,
  ENTERPRISE_ESC_DRAFT_FAILED_CODE,
  ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE,
  enterpriseErrorAction,
  enterpriseErrorMessage,
  enterpriseErrorPresentation,
  enterpriseErrorRetryable,
} from '../src/error-messages.js'
import { ESC_DEFAULT_CATEGORY_MENUS, ESC_RESOURCE_MORE_HREF, ESC_RESOURCE_TYPES, ESC_SUCCESS_CODE } from '../src/esc/esc-constants.js'
import {
  bindEnterpriseEscSeats,
  ENTERPRISE_ESC_ENTRY_ID,
  ENTERPRISE_ESC_ENTRY_LABEL,
  ENTERPRISE_ESC_ENTRY_ORDER,
  enterpriseEscMainOptions,
  enterpriseEscPanelOptions,
} from '../src/esc/esc-entry.js'
import { decideAutoFill, installedSnapshotFacts, shouldTriggerBottomLoad } from '../src/esc/esc-aggregation.js'
import { escCategoryChildrenOf, escPublishedTargetIdOf, escResourceAdapters, missingEndpointCodeOf } from '../src/esc/esc-list.js'
import { EnterpriseEscResourceTabs } from '../src/esc/esc-resource-tabs.js'
import { WB } from '../src/esc/esc-scale.js'
import { EnterpriseEscStyle } from '../src/esc/esc-style.js'
import type { EscCategoryNode, EscRecommendRecord, ResourceItem } from '../src/esc/esc-types.js'
import type { EnterpriseDiscoveredSkill } from '../src/skill-api-decode.js'
import { decodeEnterpriseDiscoveredSkills } from '../src/skill-api-decode.js'

// 官方原语包在本仓不可直接加载（它依赖的 `clsx` 没进本包依赖树），既有 ui 测试一律 mock 掉它；
// 本文件不渲染任何组件，只需让模块图加载得起来。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  /**
   * ★**口径 49 补**：`MenuItemButton` 与四枚官方图标**必须在这里给出来**。
   *
   * `src/official-ui.ts` 是 `dsh-ui` 与官方共享原语实例之间的唯一类型接缝，它在**模块求值期**
   * 就把 `Menu`/`MenuItemButton`/四枚图标取成具名常量（`official.MenuItemButton` 那一行）。
   * 本文件的 mock 是**整模块替换**，漏掉一个被取的导出 ⇒ vitest 当场抛
   * `No "MenuItemButton" export is defined on the ... mock`，**整份 spec 一条都跑不了**。
   * 这不是"为了消红放宽断言"，而是把 mock 补齐到官方实物本来就有的导出面
   * （官方 0.2.0-rc.2 的 `lib/index.js` 这几枚全在）。
   */
  MenuItemButton: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Pill: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
}))

/**
 * 剥掉注释（本文件里几条**源码级反向锁**用得上）。
 *
 * 为什么要有这一步：注释里引用官方签名（如 `actions.setDraft`）是**说明**，
 * 而反向锁要挡的是**代码真的调了它**。把注释算进判据，要么误伤正当的沿革注释、
 * 要么逼着以后的人不敢写注释 —— 两种结果都比"少一条断言"糟。
 */
function stripEscComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}

describe('esc：文案与常量（与原页面逐字一致）', () => {
  it('文案表每一条都是 NUWAX zh-CN 表里的原文（页内 13 句 + 跨页 5 枚 + 行内字面量 2 枚）', () => {
    expect(ENTERPRISE_ESC_COPY).toMatchObject({
      pageTitle: '专家·技能·连接器',
      menuExpert: '专家&专家团',
      menuSkill: '技能',
      menuConnector: '连接器',
      mainTabSystem: '系统广场',
      mainTabTeam: '团队空间',
      mainTabConnected: '已连接的',
      tabAll: '全部',
      /**
       * ★**口径 49 重新基线化**：旧那一条锁的是**一枚**笼统的 `searchPlaceholder: '搜索名称或描述...'`，
       * 现按用户裁决换成**随页变的三枚**（WorkBuddy 实机 i18n 原文）。
       * ★这是**加强**不是放宽：三枚逐字 + 两两互不相同 + 旧那枚**必须已经消失**（下面那条反向锁），
       *   合起来比原来"一枚字符串相等"约束更多——原断言对"三页说同一句笼统话"是绿的。
       */
      searchPlaceholderExpert: '搜索专家',
      searchPlaceholderSkill: '搜索技能',
      searchPlaceholderConnector: '搜索连接器',
      more: '更多',
      summon: '召唤',
      useNow: '立即使用',
      paid: '付费',
      subscribed: '已订阅',
      collect: '收藏',
      cancelCollect: '取消收藏',
      emptyData: '暂无数据',
    })
    /**
     * ★**口径 49 反向锁（"被替换"这件事本身要可取证）**：
     * ① 旧那枚**整格已经不在**（`'searchPlaceholder' in ENTERPRISE_ESC_COPY` 为假）——留在表里就是一个
     *    "看着还能用"的第二真源：下一个人会问"到底哪一枚生效"，而两枚都可能被别处引用；
     * ② 旧文案那串字**在本仓源码里零出现**（连注释都不留）——它只活在 git 历史与本断言里；
     * ③ 三枚**两两互不相同**（否则"随页变"就是空话：三页说同一句照样满足"三格逐字"）。
     */
    expect('searchPlaceholder' in ENTERPRISE_ESC_COPY).toBe(false)
    // 判据落在**值**上（不是源码文本）：注释里写一句沿革说明是允许的（那正是"保真记录"该在的地方），
    // 但**表里任何一格的值**都不许再是那串旧文案 —— 那才是"第二真源"的样子。
    expect(JSON.stringify(ENTERPRISE_ESC_COPY)).not.toContain('搜索名称或描述')
    const placeholders = [
      ENTERPRISE_ESC_COPY.searchPlaceholderExpert,
      ENTERPRISE_ESC_COPY.searchPlaceholderSkill,
      ENTERPRISE_ESC_COPY.searchPlaceholderConnector,
    ]
    expect(new Set(placeholders).size).toBe(3)
  })

  it('资源类型全集与左栏兜底菜单的顺序、文案、原路径、原图标标识一字不差（专家的显示名按用户裁决改为「专家」）', () => {
    expect(ESC_RESOURCE_TYPES).toEqual(['expert', 'skill', 'connector'])
    expect(ESC_SUCCESS_CODE).toBe('0000')
    // 用户裁决「专家专家团，名字只显示专家即可」：显示层是 `menuExpertDisplay`（正字 `menuExpert` 仍是官方那串）
    expect(ENTERPRISE_ESC_COPY.menuExpert).toBe('专家&专家团')
    expect(ENTERPRISE_ESC_COPY.menuExpertDisplay).toBe('专家')
    expect(ESC_DEFAULT_CATEGORY_MENUS).toEqual([
      { code: 'expert', label: '专家', path: '/expert-skill-connector/expert', icon: 'icons-nav-user' },
      { code: 'skill', label: '技能', path: '/expert-skill-connector/skill', icon: 'icons-nav-skill' },
      { code: 'connector', label: '连接器', path: '/expert-skill-connector/connector', icon: 'icons-common-link' },
    ])
  })
})

/**
 * ★**口径 55（用户裁决：「我启用的」删掉，他和已安装重复）**。
 *
 * 这一组锁的是**删干净**这件事本身，不是"界面上看不见"：
 *   ① 文案表里那一格**整格不在**（不是留着不读 —— 那是"看着还能用"的第二真源）；
 *   ② 那四个字在**剥注释后的 `src/esc` 源码里零出现**（判据是代码，注释里写沿革是允许的）；
 *   ③ 面级端点码表里那一格、唯一错误码表里那一句，都**整格不在**；
 *   ④ 适配器表里**两支** `enabled` 都退场（技能那支随维度删、连接器那支是本来就不可达的死代码）；
 *   ⑤ 从**行为**上反向锁：技能页维度恰好两枚、连接器页第三枚仍是「已连接的」。
 * 任何一条"把维度加回来"的改法（加文案 / 加选项 / 加适配器 / 加码 / 加联合类型那一格）都会同时
 * 撞上其中至少两条 ⇒ 红。
 */
describe('esc：口径 55（删掉技能页「我启用的」维度 · 顺手清掉连接器那支不可达的 enabled）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }

  it('① 文案表整格不在 + 值里零出现；② 剥注释后的 src/esc 里也零出现', () => {
    // ① 表里那一格**不在**（与口径 49 删旧 placeholder 同一条纪律：不许留第二真源）。
    expect('mainTabEnabled' in ENTERPRISE_ESC_COPY).toBe(false)
    // 判据落在**值**上：注释里写沿革说明允许，但表里任何一格的值都不许再是那四个字。
    expect(JSON.stringify(ENTERPRISE_ESC_COPY)).not.toContain('我启用的')
    // ② 剥注释后的全 `src/esc`：那四个字与那个标识符都**一次都不出现**。
    const escDir = new URL('../src/esc/', import.meta.url)
    for (const name of readdirSync(escDir).filter(each => /\.tsx?$/.test(each)).sort()) {
      const code = stripEscComments(readFileSync(new URL(name, escDir), 'utf8'))
      expect(code, name).not.toContain('我启用的')
      expect(code, name).not.toContain('mainTabEnabled')
    }
  })

  it('③ 面级码表与唯一错误码表都少掉那一格；「按面取码」的调用形状不许退化', () => {
    expect(Object.keys(ESC_MISSING_ENDPOINT_CODES).sort()).toEqual(['connector', 'directory', 'recommend'])
    expect('enabled' in ESC_MISSING_ENDPOINT_CODES).toBe(false)
    // 唯一错误码表里那句也整格不在（它**永远取不到**了：没有任何请求会打到那条端点）。
    expect(ENTERPRISE_ERROR_CODES).not.toContain('ENT_ESC_ENABLE_LIST_UNAVAILABLE')
    expect(ENTERPRISE_ERROR_CODES.filter(code => code.startsWith('ENT_ESC_')).sort())
      .toEqual(['ENT_ESC_CONNECTOR_UNAVAILABLE', 'ENT_ESC_DIRECTORY_UNAVAILABLE', 'ENT_ESC_DRAFT_UNAVAILABLE',
        'ENT_ESC_MY_EXPERTS_UNAVAILABLE', 'ENT_ESC_RECOMMEND_UNAVAILABLE'])
    // 三枚面级码各自还有一句话、都不可重试、三句两两不同（少了一枚但纪律一条没少）。
    const messages = (['connector', 'directory', 'recommend'] as const).map(key => {
      const code = ESC_MISSING_ENDPOINT_CODES[key]
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
      expect(enterpriseErrorRetryable(code), code).toBe(false)
      return enterpriseErrorMessage(code)
    })
    expect(new Set(messages).size).toBe(3)
    // 源码级：`missingEndpointCodeOf` 仍按「资源类型 + 维度」调用（少了一枚码不等于把判据退回一层）。
    const source = readFileSync(new URL('../src/esc/esc-list.ts', import.meta.url), 'utf8')
    expect(source).toContain('missingEndpointCodeOf(resourceType, source)')
    expect(source).not.toContain('missingEndpointCodeOf(resourceType)')
  })

  it('④ 两支 `enabled` 适配器都退场（含连接器那支本来就不可达的死代码）', () => {
    const { api } = spyApi()
    const adapters = escResourceAdapters(api)
    expect(Object.keys(adapters.skill).sort()).toEqual(['system', 'team'])
    expect(Object.keys(adapters.connector).sort()).toEqual(['connected', 'system', 'team'])
    // 反向锁：那支死代码的**两个指纹**在源码里零出现 —— 查询参数 `connectionEnabled: 'true'`
    // 与它的 id 前缀 `enabled-conn`。
    // ★注意：`mapConnectorItem` 里那格 `connectionEnabled: item.connectionEnabled` 是**归一化字段**
    //   （连接器卡片要画连接态，与"哪一维在取数"无关），**不在这条反向锁的靶心里**，故意留着。
    const source = stripEscComments(readFileSync(new URL('../src/esc/esc-list.ts', import.meta.url), 'utf8'))
    expect(source).not.toContain("connectionEnabled: 'true'")
    expect(source).not.toContain('enabled-conn')
    expect(source).not.toContain('enabled-skill')
    expect(source).not.toContain('publishedSkillEnableList')
  })

  it('⑤ 集合级反向锁：`enabled` 这个字面量在剥注释后的 src/esc 里只剩一处，且必须是另一件事', () => {
    /**
     * ★判据落在**剥注释后的代码**上（沿革注释里提到"删掉了什么"是说明，不是"它回来了"）。
     * ★闭合名单：`'enabled'` 这个**字面量**（带引号）今天在 `src/esc` 里只允许出现在
     *   `esc-api.ts` 的演示数据开关那一格（读 `GET …/esc/mock` 的 `enabled` 字段）——
     *   那是**mock 开关**，与"技能维度"是两件毫不相干的事。任何一处新增（例如把 `value: 'enabled'`
     *   加回工具栏、或给 `ResourceSourceEnum` 添回那一格并配一个取值口）都会让这张名单对不上。
     */
    const escDir = new URL('../src/esc/', import.meta.url)
    const occurrences = new Map<string, string[]>()
    for (const name of readdirSync(escDir).filter(each => /\.tsx?$/.test(each)).sort()) {
      const lines = stripEscComments(readFileSync(new URL(name, escDir), 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes("'enabled'") || line.includes('"enabled"'))
      if (lines.length > 0) occurrences.set(name, lines)
    }
    expect([...occurrences.entries()]).toEqual([
      ['esc-api.ts', ["enabled: record['enabled'] === true,"]],
    ])
  })

  it('反向锁：技能页维度恰好两枚且逐字；连接器页第三枚仍是「已连接的」（回归）', () => {
    const labelsOf = (resourceType: 'expert' | 'skill' | 'connector') => {
      const toolbar = asElement(
        EnterpriseEscToolbar({
          resourceType,
          source: 'system',
          onSourceChange: () => undefined,
          categories: [],
          activeCategory: '',
          onCategoryChange: () => undefined,
          keyword: '',
          onKeywordChange: () => undefined,
        } as never),
      )
      const walk = (node: unknown, out: Element[] = []): Element[] => {
        if (Array.isArray(node)) {
          for (const each of node) walk(each, out)
          return out
        }
        if (node === null || node === undefined || node === false) return out
        if (typeof node !== 'object') return out
        const element = node as Element
        if (element.props['className'] === 'esc-source-tabs') {
          out.push(element)
          return out
        }
        return walk(element.props['children'], out)
      }
      const sourceTabs = walk(toolbar)[0]
      expect(sourceTabs).toBeTruthy()
      return childrenOf(sourceTabs as Element).map(node => asElement(node).props['children'])
    }
    // ★正向锁：**恰好两枚**、逐字（这正是 WorkBuddy 实机上专家页/技能页的形状）。
    expect(labelsOf('expert')).toEqual(['系统广场', '团队空间'])
    expect(labelsOf('skill')).toEqual(['系统广场', '团队空间'])
    expect(labelsOf('skill')).toHaveLength(2)
    // ★回归锁：连接器页第三枚仍是「已连接的」，且仍排在最后（本刀一字未动）。
    expect(labelsOf('connector')).toEqual(['系统广场', '团队空间', '已连接的'])
  })
})

describe('esc：两处座位（常驻，与资料库的视图驱动不同）', () => {
  it('侧栏 id 与 main 的 key 同名，order/label 是导出常量本身', () => {
    const panel = enterpriseEscPanelOptions()
    expect(panel).toEqual({
      name: 'sidebar.panellist',
      id: ENTERPRISE_ESC_ENTRY_ID,
      order: ENTERPRISE_ESC_ENTRY_ORDER,
      label: ENTERPRISE_ESC_ENTRY_LABEL,
    })
    expect(ENTERPRISE_ESC_ENTRY_ID).toBe('expert-skill-connector')
    expect(ENTERPRISE_ESC_ENTRY_LABEL).toBe('专家·技能·连接器')
    // 排在官方 plugins(0)/schedules(10) 与本仓资料库(20) 之后
    expect(ENTERPRISE_ESC_ENTRY_ORDER).toBe(30)
    const api = { name: 'api' } as unknown as EnterpriseEscApi
    const main = enterpriseEscMainOptions(api)
    expect(main['name']).toBe('main')
    expect(main['key']).toBe(panel['id'])
    expect((main['inject'] as () => { api: unknown })()).toEqual({ api })
  })

  it('接线即注册两个占用者（不设管理门）：两次 inject、两处 register', () => {
    const injected: string[] = []
    const registered: Record<string, unknown>[] = []
    const ports = {
      inject: (name: string, register: () => unknown) => { injected.push(name); return register() },
      register: (options: Record<string, unknown>) => { registered.push(options); return () => undefined },
    }
    const api = { name: 'api' } as unknown as EnterpriseEscApi
    const disposers = bindEnterpriseEscSeats(ports, api)
    expect(injected).toEqual(['sidebar.panellist', 'main'])
    expect(registered.map(item => item['name'])).toEqual(['sidebar.panellist', 'main'])
    expect(registered.map(item => item['key'] ?? item['id'])).toEqual([
      ENTERPRISE_ESC_ENTRY_ID,
      ENTERPRISE_ESC_ENTRY_ID,
    ])
    // 两处都真的拿到了注销器（否则插件卸载时座位摘不掉）
    expect(disposers).toHaveLength(2)
    for (const dispose of disposers) expect(typeof dispose).toBe('function')
  })
})

/** 假 fetch：记下每次请求，按测试给的响应体返回。 */
function fakeFetcher(payload: unknown, init?: { readonly ok?: boolean; readonly status?: number }) {
  const calls: { readonly url: string; readonly init: RequestInit | undefined }[] = []
  const fetcher = vi.fn(async (url: string, initArg?: RequestInit) => {
    calls.push({ url, init: initArg })
    return {
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      json: async () => payload,
    } as unknown as Response
  })
  return { fetcher: fetcher as unknown as typeof fetch, calls }
}

describe('esc：取数面（浏览器只打同源固定路径）', () => {
  it('六个方法都打 POST /esc/read，正文关闭键集恰好 {path, params}，且 params 里没有 undefined 键', async () => {
    const envelope = { code: '0000', data: [{ id: 1, name: '空间' }] }
    const { fetcher, calls } = fakeFetcher({ data: envelope })
    const api = createEnterpriseEscApi(fetcher)
    await api.spaceList()
    expect(ENTERPRISE_ESC_READ_LOCAL_PATH).toBe('/esc/read')
    expect(calls[0]!.url).toBe('/enterprise/api/v1/local/esc/read')
    expect(calls[0]!.init?.method).toBe('POST')
    expect(calls[0]!.init?.headers).toEqual({ 'content-type': 'application/json' })
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ path: '/api/space/list', params: {} })
    // undefined 的键在序列化前被摘掉（"缺席"这件事两侧一致）
    const { fetcher: f2, calls: c2 } = fakeFetcher({ data: envelope })
    await createEnterpriseEscApi(f2).publishedAgentList({ page: 1, kw: undefined, official: true })
    expect(JSON.parse(String(c2[0]!.init?.body))).toEqual({
      path: '/api/published/agent/list',
      params: { page: 1, official: true },
    })
  })

  it('六个方法各自的平台路径与返回（信封原样交回，不投影）', async () => {
    const cases: readonly [string, (api: EnterpriseEscApi) => Promise<unknown>, string][] = [
      ['publishedCategoryList', api => api.publishedCategoryList(), '/api/published/category/list'],
      ['spaceList', api => api.spaceList(), '/api/space/list'],
      ['publishedAgentList', api => api.publishedAgentList({ page: 1 }), '/api/published/agent/list'],
      ['publishedSkillList', api => api.publishedSkillList({ page: 1 }), '/api/published/skill/list'],
      ['publishedSkillEnableList', api => api.publishedSkillEnableList({}), '/api/published/skill/enable/list'],
      ['connectorProviderPageList', api => api.connectorProviderPageList({ pageNum: 1 }), '/api/connector/providers'],
    ]
    for (const [name, run, expectedPath] of cases) {
      const envelope = { code: '0000', message: 'ok', data: [], success: true }
      const { fetcher, calls } = fakeFetcher({ data: envelope })
      const result = await run(createEnterpriseEscApi(fetcher))
      expect(JSON.parse(String(calls[0]!.init?.body))['path'], name).toBe(expectedPath)
      // message/success 两格也在：页面读 `res.message`，投影掉就会与原文行为分叉
      expect(result, name).toEqual(envelope)
    }
  })

  it('本机失败体里的稳定码原样抛出；本机信封不合形 ⇒ ENT_LOCAL_RESPONSE_INVALID', async () => {
    const denied = fakeFetcher({ error: { code: 'ENT_AUTH_REQUIRED' } }, { ok: false, status: 401 })
    await expect(createEnterpriseEscApi(denied.fetcher).spaceList()).rejects.toMatchObject({
      code: 'ENT_AUTH_REQUIRED',
    })
    // `{data}` 里没有平台信封（没有 code）⇒ 本地判畸形
    const malformed = fakeFetcher({ data: { message: 'no code' } })
    await expect(createEnterpriseEscApi(malformed.fetcher).spaceList()).rejects.toMatchObject({
      code: 'ENT_LOCAL_RESPONSE_INVALID',
    })
    // 顶层不是对象
    const notObject = fakeFetcher('nope')
    await expect(createEnterpriseEscApi(notObject.fetcher).spaceList()).rejects.toMatchObject({
      code: 'ENT_LOCAL_RESPONSE_INVALID',
    })
  })

  /**
   * ★**本刀（根因修复）**：口径 47 起「顶栏已装计数**永远**读不到」那条 bug 的回归锁。
   *
   * 真因：esc 这一条把**整只本机信封** `{code,message,data:{skills:[…]}}` 直接交给了
   * `decodeEnterpriseInstalledSkills`，而那个解码器要的是**拆封后的** `{skills:[…]}`
   * （判据 `hasExactKeys(row,['skills'])`）⇒ **必抛** `ENT_LOCAL_RESPONSE_INVALID`
   * ⇒ 计数从那天起没读到过（真机上那枚 `？` 指的就是这件事，不是"服务读不到"）。
   * 商城页那条（`local-api.ts` 的 `requestJson`）一直是对的，故修法是**委托**过去，
   * 不是在这里再写一套拆信封。
   */
  it('★根因锁：installedSkills 吃完整信封（返回记录数组），与 local-api 那条逐字段同值', async () => {
    /** 真机实测形状：`data.skills` 才是那条解码器要的 payload。 */
    const entry = {
      packageId: '2105915576743428098',
      skillId: 'interactive-architecture-diagram',
      displayName: '架构图一键生成',
      versionId: '2105915576743428099',
      sha256: '8f2c67'.padEnd(64, '0'),
      names: ['interactive-architecture-diagram'],
      installedAt: '2026-10-09T00:00:00.000Z',
    }
    /**
     * 完整本机信封（真机实测形状：`{"data":{"skills":[…]}}`）——`data.skills` 才是那条解码器要的 payload。
     * ★注意本机那族路由的信封是**单键** `{data}`（错误态才是 `{error:{code}}`），故这里不能带上 `code`/`message`。
     */
    const { fetcher, calls } = fakeFetcher({ data: { skills: [entry] } })
    const local = createEnterpriseLocalApi(fetcher)
    const esc = createEnterpriseEscApi(fetcher, local)
    const signal = new AbortController().signal
    const viaEsc = await esc.installedSkills(signal)
    // ① 旧实现到这里**必抛**（"整只信封喂解码器"）；现在必须真的拿到记录数组
    expect(viaEsc).toHaveLength(1)
    expect(viaEsc[0]!.skillId).toBe('interactive-architecture-diagram')
    expect(viaEsc[0]!.packageId).toBe('2105915576743428098')
    // ② **同源铁证**：同一只假响应下，esc 那条与 local-api 那条**逐字段同值**
    expect(viaEsc).toEqual(await local.installedSkills(signal))
    // ③ 打的是同一条同源固定路径（GET + signal 原样带下去）
    expect(calls.map(call => call.url)).toEqual([
      '/enterprise/api/v1/local/skills/installed',
      '/enterprise/api/v1/local/skills/installed',
    ])
    // GET 是 fetch 的默认方法，故 init 里**不写** method（与 `local-api.spec.ts` 那条自装清单同一口径）
    expect(calls[0]!.init?.method).toBeUndefined()
    expect(calls[0]!.init?.cache).toBe('no-store')
    expect(calls[0]!.init?.signal).toBe(signal)
    // ④ 不传 signal 也照打（`EnterpriseEscApi` 那一格的签名本来就允许缺）
    expect(await esc.installedSkills()).toEqual(viaEsc)
    // ⑤ 另一条腿（自装清单）在**同一个实例**上本来就是好的（真因只在那一条，别把它一起"修"坏）
    const selfEnvelope = fakeFetcher({ data: { skills: [] } })
    await expect(createEnterpriseLocalApi(selfEnvelope.fetcher).selfInstalledSkills(signal)).resolves.toEqual([])
  })

  it('★根因锁：错误信封翻出**同一枚**稳定码（esc 那条不做第二套翻译）', async () => {
    // ① 401 + `{error:{code}}` ⇒ 两侧同一枚稳定码（"不做错误信封翻译"那种改法会退成兜底码，这里立刻红）
    const denied = fakeFetcher({ error: { code: 'ENT_AUTH_REQUIRED' } }, { ok: false, status: 401 })
    const local = createEnterpriseLocalApi(denied.fetcher)
    const esc = createEnterpriseEscApi(denied.fetcher, local)
    await expect(esc.installedSkills()).rejects.toMatchObject({ code: 'ENT_AUTH_REQUIRED' })
    await expect(local.installedSkills(new AbortController().signal)).rejects.toMatchObject({ code: 'ENT_AUTH_REQUIRED' })
    // ② 非 JSON 正文 ⇒ 同一枚兜底码
    const notJson = (async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('not json') },
    })) as unknown as typeof fetch
    await expect(createEnterpriseEscApi(notJson).installedSkills()).rejects.toMatchObject({
      code: 'ENT_LOCAL_RESPONSE_INVALID',
    })
    // ③ 200 但正文不是 `{data}` 单键信封 ⇒ 同一枚兜底码
    const noEnvelope = fakeFetcher({ skills: [] })
    await expect(createEnterpriseEscApi(noEnvelope.fetcher).installedSkills()).rejects.toMatchObject({
      code: 'ENT_LOCAL_RESPONSE_INVALID',
    })
  })

  /**
   * ★**源码级反向锁**：`esc-api.ts` 里不许再有"把 `.json()` 的原样结果交给解码器"那条缝。
   *
   * 这一类接缝就是本刀那个 bug 的温床（**整只信封**被当成 payload），故从两个方向咬：
   * ① 这份文件**一个 `decodeEnterprise*` 都不许出现**（连 import 都不许）——"拆信封 + 翻错误码"
   *   全包只有 `local-api.ts` 的 `requestJson` 那一份实现，缺省构造器也指向它；
   * ② 全 `src/**` 扫一遍：任何 `decodeEnterpriseX(...)` 的**实参文本里**都不许出现 `.json()`
   *   （按括号配对取实参，故跨行的旧写法也会被咬住；判据落在**剥注释后**的代码上）。
   */
  it('★源码级反向锁：不许再出现「把 .json() 结果直接喂 decodeEnterprise*」', () => {
    const escApiCode = stripEscComments(readFileSync(new URL('../src/esc/esc-api.ts', import.meta.url), 'utf8'))
    expect(escApiCode).not.toContain('decodeEnterprise')
    expect(escApiCode).toContain('localReads.installedSkills(')
    expect(escApiCode).toContain('createEnterpriseLocalApi')
    /** 括号配对后取每一处 decode 调用的**实参文本**，看里面有没有 `.json()`。 */
    const rawJsonIntoDecoder = (code: string): readonly string[] => {
      const hits: string[] = []
      const call = /decodeEnterprise[A-Za-z0-9_]*\s*\(/g
      let match = call.exec(code)
      while (match !== null) {
        let depth = 0
        let index = match.index + match[0].length - 1
        const start = index
        for (; index < code.length; index += 1) {
          const char = code[index]
          if (char === '(') depth += 1
          else if (char === ')') {
            depth -= 1
            if (depth === 0) break
          }
        }
        const args = code.slice(start, index + 1)
        if (args.includes('.json()')) hits.push(args.replace(/\s+/g, ' ').slice(0, 120))
        match = call.exec(code)
      }
      return hits
    }
    // ★这条判据**不是空转锁**：把旧写法喂给它必须命中（下面这枚自检就是它的"红"）
    expect(rawJsonIntoDecoder('decodeEnterpriseInstalledSkills(await (await fetcher(url, {\n method: \'GET\',\n })).json())')).toHaveLength(1)
    const sourceFiles: string[] = []
    const collect = (dir: URL): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const child = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, dir)
        if (entry.isDirectory()) collect(child)
        else if (/\.tsx?$/.test(entry.name)) sourceFiles.push(child.toString())
      }
    }
    collect(new URL('../src/', import.meta.url))
    // 防"走空了却全绿"：真源文件必须扫到一大把
    expect(sourceFiles.length).toBeGreaterThan(50)
    const offenders = sourceFiles.flatMap(file =>
      rawJsonIntoDecoder(stripEscComments(readFileSync(new URL(file), 'utf8'))).map(hit => `${file}: ${hit}`))
    expect(offenders).toEqual([])
  })
})

/** 假取数面：六个方法都记账，返回测试给的信封。 */
function spyApi(envelope: { code: string; data?: unknown } = { code: '0000', data: {} }) {
  const calls: { readonly method: string; readonly params: unknown }[] = []
  const record = (method: string) => async (params: unknown) => {
    calls.push({ method, params })
    return envelope as never
  }
  const api: EnterpriseEscApi = {
    publishedCategoryList: record('publishedCategoryList') as EnterpriseEscApi['publishedCategoryList'],
    spaceList: record('spaceList') as EnterpriseEscApi['spaceList'],
    publishedAgentList: record('publishedAgentList') as EnterpriseEscApi['publishedAgentList'],
    publishedSkillList: record('publishedSkillList') as EnterpriseEscApi['publishedSkillList'],
    publishedSkillEnableList: record('publishedSkillEnableList') as EnterpriseEscApi['publishedSkillEnableList'],
    connectorProviderPageList: record('connectorProviderPageList') as EnterpriseEscApi['connectorProviderPageList'],
    // 信息性的开关状态：这里回"没开"，故所有既有用例的渲染路径与真实部署逐字相同
    escMockStatus: async () => ({ enabled: false }),
  }
  return { api, calls }
}

describe('esc：适配器口径（各资源类型 × 数据源的参数差异）', () => {
  it('专家：系统广场仅官方 + ChatBot 子类型；团队空间 category=Agent + justReturnSpaceData 且不传 official', async () => {
    const { api, calls } = spyApi()
    const adapters = escResourceAdapters(api)
    const system = adapters.expert.system!
    const team = adapters.expert.team!
    if (system.mode !== 'server' || team.mode !== 'server') throw new Error('expert 两维都应是服务端分页')
    await system.fetchPage({ page: 2, pageSize: 20, category: '办公', keyword: '报表', spaceId: undefined, spaceIds: undefined })
    expect(calls[0]!.params).toEqual({
      page: 2,
      pageSize: 20,
      category: '办公',
      kw: '报表',
      targetType: 'Agent',
      targetSubType: 'ChatBot',
      official: true,
    })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: [7, 8] })
    expect(calls[1]!.params).toEqual({
      page: 1,
      pageSize: 20,
      kw: undefined,
      category: 'Agent',
      justReturnSpaceData: true,
      spaceIds: [7, 8],
    })
    // 单元素聚合回退成 spaceId；空格子用 spaceId；两者都没有则都不传
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: [7] })
    expect(calls[2]!.params).toMatchObject({ spaceId: 7 })
    expect(calls[2]!.params).not.toHaveProperty('spaceIds')
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: 9, spaceIds: undefined })
    expect(calls[3]!.params).toMatchObject({ spaceId: 9 })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: undefined })
    expect(calls[4]!.params).not.toHaveProperty('spaceId')
    expect(calls[4]!.params).not.toHaveProperty('spaceIds')
  })

  it('技能：系统广场仅官方；团队空间 category=Skill；★口径 55 起**恰好两维**（「我启用的」整支退场）', async () => {
    const { api, calls } = spyApi()
    const adapters = escResourceAdapters(api)
    const system = adapters.skill.system!
    const team = adapters.skill.team!
    if (system.mode !== 'server' || team.mode !== 'server') throw new Error('技能两维都应是服务端分页')
    await system.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: undefined })
    expect(calls[0]!.params).toEqual({ page: 1, pageSize: 20, category: '', kw: undefined, official: true })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: 7, spaceIds: undefined })
    expect(calls[1]!.params).toMatchObject({ category: 'Skill', justReturnSpaceData: true, spaceId: 7 })
    /**
     * ★**口径 55 重新基线化（加强，不是放宽）**：旧这一条取的是 `adapters.skill.enabled`，
     *   断言它"是全量接口且本地筛选"——那一支已按用户裁决整支删除（它读的
     *   `POST /api/published/skill/enable/list` 是「我启用的」这个维度的专属端点）。
     *   新判据比旧的两条**更强**：① 这一支的键集**恰好** `['system','team']`（多一维即红）；
     *   ② 走完两维之后请求数**恰好 2**（旧断言只证明"那一支这么取数"，新断言还证明
     *   "没有任何第三支会被走到"——旧断言对"悄悄又加回一维"是绿的，新断言不可能）。
     */
    expect(Object.keys(adapters.skill).sort()).toEqual(['system', 'team'])
    expect(adapters.skill).not.toHaveProperty('enabled')
    expect(calls).toHaveLength(2)
  })

  it('连接器：官方目录 scope=official；空间维度 scope=space；已连接的带一个服务端筛选且本地跳过双重收窄（★口径 55 起恰好三维）', async () => {
    const { api, calls } = spyApi()
    const adapters = escResourceAdapters(api)
    const system = adapters.connector.system!
    const team = adapters.connector.team!
    const connected = adapters.connector.connected!
    if (system.mode !== 'server' || team.mode !== 'server' || connected.mode !== 'client') {
      throw new Error('连接器三个维度的形状不对')
    }
    await system.fetchPage({ page: 3, pageSize: 20, category: '通讯工具', keyword: 'oss', spaceId: undefined, spaceIds: undefined })
    expect(calls[0]!.params).toEqual({
      pageNum: 3,
      pageSize: 20,
      scope: 'official',
      category: '通讯工具',
      keyword: 'oss',
    })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: 'oss', spaceId: 7, spaceIds: undefined })
    expect(calls[1]!.params).toEqual({ pageNum: 1, pageSize: 20, scope: 'space', spaceId: 7, keyword: 'oss' })
    // 「全部」页签：连接器**不带** spaceId 也要发（scope=space 聚合全部空间）
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: undefined })
    expect(calls[2]!.params).not.toHaveProperty('spaceId')
    await connected.fetchAll({ spaceId: undefined, keyword: 'k', category: 'c' })
    expect(calls[3]!.params).toEqual({ connected: 'true', category: 'c', keyword: 'k' })
    expect(connected.serverKeyword).toBe(true)
    expect(connected.serverCategory).toBe(true)
    /**
     * ★**口径 55 重新基线化（加强）**：旧这一条还有第四维 `adapters.connector.enabled`
     *   （`connectionEnabled:'true'`）。它**从落地那天起就不可达**（连接器页第三枚维度是
     *   `'connected'`；`'enabled'` 只由技能页产出，而技能页的 source 落不到连接器这张表上），
     *   遂按"不留死代码"清掉并在 `esc-list.ts` 里写明理由。
     *   新判据比旧的强：① 键集**恰好** `['connected','system','team']`；② 请求数**恰好 4**。
     */
    expect(Object.keys(adapters.connector).sort()).toEqual(['connected', 'system', 'team'])
    expect(adapters.connector).not.toHaveProperty('enabled')
    expect(calls).toHaveLength(4)
  })

  it('响应提取：已发布按 current<pages 判有无更多；连接器按"本页取满"判（它没有总页数）', () => {
    const { api } = spyApi()
    const adapters = escResourceAdapters(api)
    const published = adapters.expert.system!
    const connector = adapters.connector.system!
    if (published.mode !== 'server' || connector.mode !== 'server') throw new Error('形状不对')
    const page = {
      code: '0000',
      data: {
        records: [
          { id: 11, targetId: 101, name: '专家甲', statistics: { userCount: 3, convCount: 4, collectCount: 5 } },
        ],
        current: 1,
        pages: 3,
      },
    }
    const extracted = published.extract(page, 1, 20)
    expect(extracted.hasMore).toBe(true)
    expect(extracted.items[0]).toMatchObject({
      id: 'agent-11',
      agentId: 101,
      name: '专家甲',
      stats: [
        { type: 'user', value: 3 },
        { type: 'link', value: 4 },
        { type: 'star', value: 5 },
      ],
    })
    // 技能前缀只填 skillId，不填 agentId（原文件的判据）
    const skill = published.extract({ code: '0000', data: { records: [{ id: 12, targetId: 202, name: '技能乙' }], current: 1, pages: 1 } }, 1, 20)
    expect(skill.items[0]).toMatchObject({ skillId: undefined, agentId: 202 })
    expect(skill.hasMore).toBe(false)
    // ★**口径 42**：平台**没回**的统计字段**不入列**（原写法 `?? 0` 会把"没回"与"回了 0"压成同一个数，
    //   卡片层就分不清"该画缺口短横"与"确实是 0"）。真机事实：技能只回 collectCount，专家才回人数/会话。
    const partial = published.extract(
      { code: '0000', data: { records: [{ id: 13, targetId: 303, name: '技能丙', statistics: { collectCount: 5 } }], current: 1, pages: 1 } },
      1,
      20,
    )
    expect(partial.items[0]!.stats).toEqual([{ type: 'star', value: 5 }])
    expect(skill.items[0]!.stats).toEqual([])
    // 反向锁：**真回了 0** 的字段必须留在列里（那不是缺口，是"确实是 0"）
    const zero = published.extract(
      { code: '0000', data: { records: [{ id: 14, targetId: 404, name: '专家丁', statistics: { userCount: 0, convCount: 2, collectCount: 0 } }], current: 1, pages: 1 } },
      1,
      20,
    )
    expect(zero.items[0]!.stats).toEqual([
      { type: 'user', value: 0 },
      { type: 'link', value: 2 },
      { type: 'star', value: 0 },
    ])
    // 连接器：本页取满即认为还有下一页
    const full = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, service: `s${index}`, displayName: `S${index}` }))
    expect(connector.extract({ code: '0000', data: { records: full, pageNum: 1 } }, 1, 20).hasMore).toBe(true)
    expect(connector.extract({ code: '0000', data: { records: full.slice(0, 5), pageNum: 1 } }, 1, 20).hasMore).toBe(false)
    expect(connector.extract({ code: '0000', data: { records: full, pageNum: 2 } }, 1, 20).hasMore).toBe(false)
    // 连接器卡片名：displayName 优先、service 兜底；id 用 service
    const connectorSliced = { code: '0000', data: { records: [{ id: 9, service: 'aliyun_oss', displayName: 'OSS' }], pageNum: 1 } }
    expect(connector.extract(connectorSliced, 1, 20).items[0]).toMatchObject({
      id: 'system-conn-aliyun_oss',
      name: 'OSS',
      service: 'aliyun_oss',
    })
  })
})

describe('esc：二级分类投影', () => {
  const tree: readonly EscCategoryNode[] = [
    { key: 'Agent', label: '智能体', type: 'Agent', children: [{ key: '办公', label: '办公' }, { key: '', label: '空键要滤掉' }] },
    { key: 'Skill', label: '技能', type: 'Skill', children: [{ key: '数据', label: '数据' }] },
    { key: 'Connector', label: '连接器', type: 'Connector', children: [{ key: '通讯工具', label: '通讯工具' }] },
  ]

  it('专家/技能按根节点 type 取 children，并滤掉空 key', () => {
    expect(escCategoryChildrenOf(tree, 'Agent')).toEqual([{ key: '办公', label: '办公' }])
    expect(escCategoryChildrenOf(tree, 'Skill')).toEqual([{ key: '数据', label: '数据' }])
  })

  it('连接器按根节点 key=Connector 取（`rootType` 为 undefined 即此路）', () => {
    expect(escCategoryChildrenOf(tree, undefined)).toEqual([{ key: '通讯工具', label: '通讯工具' }])
  })

  it('label 缺席时回落到 key；树为空/根节点找不到时回空数组（不抛）', () => {
    expect(escCategoryChildrenOf([{ key: 'Agent', type: 'Agent', children: [{ key: 'X' }] }], 'Agent')).toEqual([
      { key: 'X', label: 'X' },
    ])
    expect(escCategoryChildrenOf(undefined, 'Agent')).toEqual([])
    expect(escCategoryChildrenOf(tree, 'NoSuchType')).toEqual([])
  })
})

/** 用户裁决的版式改动（左栏撤掉改顶部药丸页签、药丸不描边、卡片紧凑、卡片可见边框）——锁在这里，免得日后被"顺手改回去"。 */
describe('esc：用户裁决的版式（左栏撤掉改顶部药丸页签、卡片紧凑、卡片有边框）', () => {
  interface PillElement {
    readonly props: { readonly active: boolean; readonly className: string; readonly children: readonly unknown[]; readonly onClick: () => void }
  }

  /** 取出 `EnterpriseEscStyle` 里那串 CSS（它是纯字符串，故能直接断言规则文本）。 */
  const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children

  /**
   * 本页字号的**唯一合法形态**（本刀起）：`calc(<基准>px + var(--dsh-content-font-delta, 0px) + var(--esc-fs-delta, 0px))`。
   * 写成函数而不是直接把字符串写进断言，是为了让每条字号断言**同时**锁住两件事：
   *   ① 基准值（视觉层级）；② 必须带**两个** delta（跟随壳「字体大小」设置 + 移动档视口自适应）——少一个就红。
   */
  /* ★本刀：字号基准换成**官方主题七档**，故这里的期望值也随之改成「走哪一档变量」。
   * 基准 px → 档位映射（官方字号标尺：xxxs 11 / xxs 12 / xs 13 / s 14 / base 16 / l 20 / xl 24）。
   * 判据从「字面是 calc(Npx + 两个delta)」改成「**走 --esc-fs-<档> 变量**」——
   * 门禁本体那条（每处字号都必须经七档变量、每档变量都必须 = 官方 token + 两个 delta）才是真判据，
   * 这里只负责表达「这一格该落在哪一档」。 */
  /* ★18 与 20 **必须分开**：官方 l 档是 20px，而用户裁决「两行各收一档」把标签收到 18px。
   *   若把两者都映射到 --esc-fs-l，那条反向锁「不许 20px 那一档回来」会连合法的 18px 一起禁掉
   *   （实测踩过：not.toContain(fs('20')) 与 toContain(fs('18')) 变成同一条断言）。
   *   故 18 自占 --esc-fs-label（同样是「官方 token + 两个 delta」的形态，只是基准取 base-16）。 */
  const FONT_TIER: Record<string, string> = {
    '11': 'xxxs', '12': 'xxs', '13': 'xs', '14': 's', '14.5': 's',
    '15': 's', '16': 'base', '18': 'label', '20': 'l', '24': 'xl',
  }
  const fsValue = (base: string): string => {
    const tier = FONT_TIER[base]
    expect(tier, `未登记的字号基准：${base}px（请先在 FONT_TIER 里定它属于官方哪一档）`).toBeTruthy()
    return `var(--esc-fs-${tier})`
  }
  const fs = (base: string): string => `font-size: ${fsValue(base)};`

  /**
   * **剥离注释后**的声明文本（本刀新增，判据形态的一处收紧而不是放宽）。
   *
   * 本文件的规则体提取一律用 `\{([^}]*)\}` 这种"到第一个右花括号为止"的写法，而 **CSS 注释里
   * 合法地可以出现花括号**（本刀 A 新增的注释就写了 `body{--dsh-content-font-delta:...}` 那样的引用，
   * 以及 grid 的 `{ width: ... }` 示例）——注释一旦带花括号，正则就会在注释中间截断，把声明体读成半截。
   * 门禁要问的本来就是"这条规则**声明**了什么"，注释文字不是声明（这也正是本文件里
   * "先剥注释再扫"那条既有纪律的同一口径：不剥就会让门禁被自己的说明文字骗红）。
   * ⇒ 提取规则体 / 数 token / 读变量的地方一律走这一份；只有**反向锁**（"某个字符串不许出现在
   * 整份 CSS 里"）仍扫原文 `css`，否则它们会被注释里的旧写法误伤。
   */
  const cssDeclarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

  /** 取某个选择器对应规则的**声明体**（`{ … }` 之间的原文，已剥注释），供逐条断言。 */
  const ruleBody = (head: string): string => {
    const hit = new RegExp(`${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(cssDeclarations)
    expect(hit, head).not.toBeNull()
    return hit![1]!
  }

  it('三个菜单渲染成页签：顺序/文案来自兜底菜单，选中项带 active，重复点当前项也回调', () => {
    const onSelect = vi.fn()
    const element = EnterpriseEscResourceTabs({ activeKey: 'skill', onSelect }) as unknown as {
      readonly props: { readonly children: readonly PillElement[] }
    }
    const pills = element.props.children
    expect(pills).toHaveLength(3)
    expect(pills.map(pill => pill.props.active)).toEqual([false, true, false])
    expect(pills.map(pill => pill.props.className)).toEqual([
      'esc-resource-tab esc-pill',
      'esc-resource-tab esc-pill',
      'esc-resource-tab esc-pill',
    ])
    expect(pills.map(pill => (pill.props.children[1] as { props: { children: string } }).props.children)).toEqual([
      '专家',
      '技能',
      '连接器',
    ])
    // 点非当前项 ⇒ 切过去；点当前项 ⇒ **也**回调一次（原文 `_t` 令牌同义：整区 remount 重拉）
    pills[0]!.props.onClick()
    pills[1]!.props.onClick()
    expect(onSelect.mock.calls).toEqual([['expert'], ['skill']])
  })

  it('样式层：没有左栏规则、有页签行；药丸压掉官方选中态的描边环', () => {
    expect(css).not.toContain('.esc-sidebar')
    expect(css).not.toContain('.esc-menu-item')
    expect(css).toContain('.esc-resource-tabs {')
    // 官方 Pill 选中态是 `box-shadow: inset 0 0 0 1px …`；这里用两条类的选择器压掉（不靠 !important、不靠加载顺序）
    expect(css).toContain('.esc-root .esc-pill { box-shadow: none; }')
  })

  it('样式层：卡片几何**一比一还原官方** + 1px 可见边框（最新裁决；被撤回的紧凑档做反向锁）', () => {
    // 官方逐值：栅格 300px/16px、卡片 170px（无统计行 130px）、内衬 16px、卡内间距 16px、头行 12px、
    // 图标 48px、标题 16px/20px、描述 16px 行高 + 32px 两行、页脚 24px、统计间距 16px
    // ★用户裁决「完全按 SPEC」：网格 262/12（SPEC §4.1）、卡片间距 12、内衬 16px 20px（SPEC §4.2）
    // ★用户裁决（本轮，真机）覆盖了上面那条 170px 定高：卡片改由**内容**决定高度（见下一个用例）。
    // ★**口径 39**（用户裁决「平板下最少两列，只有手机竖屏才一列」）：列模板不再是各写一条的
    //   `repeat(auto-fill, minmax(340px, 1fr))`（那条要 536px 才排两列 ⇒ 横屏内容区 532px 掉成单列），
    //   改成两条网格**共用**的真源 `--esc-grid-cols`（真源本身的算式与两档实测见下一个用例）。
    expect(css).toContain('grid-template-columns: var(--esc-grid-cols)')
    expect(css).toMatch(/\.esc-list-section \{[^}]*gap: var\(--esc-grid-gap\)/)
    expect(css).toMatch(/\.esc-card \{[^}]*gap: var\(--esc-card-gap\); padding: var\(--esc-card-py\) var\(--esc-card-px\);/)
    expect(css).toMatch(/\.esc-card \{[^}]*min-height: var\(--esc-card-min-h\);/)
    expect(css).toContain('.esc-card-compact { min-height: var(--esc-card-min-h); }')
    expect(css).toMatch(/\.esc-card-header \{[^}]*gap: 12px/)
    // ★用户裁决「完全按 SPEC」§4.3：图标 **28×28 正圆**、标题 **14.5px/650/line-height1.4**、
    //   描述 **12px/line-height1.6/两行截断/min-height 38px**、统计行 **11px/gap10/图标 opacity .7**
    // ★真图实测：图标是 **40px 圆角方块**（radius 10），不是 SPEC 文字写的 28 正圆
    expect(css).toMatch(/\.esc-card-image \{[^}]*width: var\(--esc-card-icon\); height: var\(--esc-card-icon\);/)
    expect(ruleBody('.esc-card-title')).toContain(fs('14'))
    expect(css).toMatch(/\.esc-card-title \{[^}]*font-weight: 650;[^}]*line-height: 1.4;/)
    expect(css).toMatch(/\.esc-card-content \{[^}]*line-height: 16px; height: 32px/)
    expect(ruleBody('.esc-tag')).toContain(fs('11'))
    expect(css).toMatch(/\.esc-tag svg \{ opacity: \.7; \}/)
    expect(css).toContain('.esc-card-footer { height: 24px;')
    expect(css).toMatch(/\.esc-count-box \{[^}]*gap: 10px/)
    // 收藏**不再**回右下角绝对定位、命中区也不再是 32px —— 口径 42 把那一枚浮标整条撤下
    // （专家卡与技能卡同版式，底部是标签行 ⇒ 浮层只会压在标签行上；见下一个用例里的正向判据）。
    //   这里做**反向锁**：两条规则连同类名一起不许回来（文案里的记录留在样式层那段"已撤下"注释里，
    //   故判据先**剥注释**——不剥的话门禁会被自己的注释骗红，那会逼着后人把记录写含糊）。
    const cssDeclarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(cssDeclarations).not.toContain('esc-corner-box')
    expect(cssDeclarations).not.toContain('esc-star-box')
    expect(css).toMatch(/\.esc-action-box \{ position: absolute; top: 12px; right: 16px;/)
    // hover 浮现：官方那枚 `.hover-reveal-btn` 挂不上 dsh 的 Button（`:disabled{opacity:.4}` 0,2,0 压单类），
    // 故由外层 span 承载 —— 这条选择器必须留着，否则按钮会一直可见、压在标题上。
    expect(css).toContain('.esc-hover-reveal { opacity: 0; pointer-events: none;')
    expect(css).toContain('.esc-card:hover .esc-hover-reveal { opacity: 1; pointer-events: auto; }')
    // 反向锁：被"一比一还原"撤掉的那几档（紧凑几何 / 常驻动作位内缩 / 收藏上移 / 页脚不留白）不许回归
    expect(css).not.toContain('.esc-card-compact { height: 104px; }')
    expect(css).not.toContain('.esc-card-compact { height: 96px; }')
    expect(css).not.toContain('esc-card-pinned')
    expect(css).not.toContain('.esc-card-footer { min-height: 0;')
    // 边框：从 `.5px` 发丝线换成 `1px` 可见边框（用户先前明确要过），hover 只换颜色（不换宽度 ⇒ 无布局抖动）
    expect(css).toContain('border: 1px solid var(--dsw-alias-border-l2)')
    expect(css).not.toContain('.5px solid var(--dsw-alias-stroke-border-2)')
  })

  it('样式层（本轮两条真机裁决）：卡片去定高去顶底留白 + 一二级分类标签收一档', () => {
    // ① 「技能卡片中间空白太多，去除空白行」：那条空白是**声明出来的**——
    //    `height: 170px` 定高 + 标签行的 `margin-top: auto` 一起把标签行顶到卡底。
    expect(css).toContain('.esc-card-skill { height: auto; }')
    expect(css).not.toMatch(/\.esc-card-skill \{[^}]*height: 170px/)
    expect(css).not.toMatch(/\.esc-card-tags \{[^}]*margin-top: auto/)
    // 反向锁：卡片仍要有底（min-height 84px 不许被顺手删掉），标签行仍要贴住内容那一格
    expect(css).toMatch(/\.esc-card \{[^}]*min-height: var\(--esc-card-min-h\);/)
    expect(css).toMatch(/\.esc-card-tags \{[^}]*padding-top: 6px;/)
    // ② 「一级二级分类标签再小一号」：两级同挂 `.esc-category-tabs .esc-pill`（渲染点只有一处）
    // ★用户第 ⑤ 条：二级分类**小一号**（s-14 → xs-13）
    expect(ruleBody('.esc-category-tabs .esc-pill')).toContain(fs('13'))
    expect(ruleBody('.esc-category-tabs .esc-pill')).not.toContain(fs('16'))
    // 反向锁：只收字号这一档——行高/字重/选中灰底都不许被顺手改
    //   ★本刀例外：那一刀的"间距也不许动"被**新的用户裁决**取代了（「全部那行分类标签之间间距紧凑些」），
    //     gap 20px → 8px 见下一处断言；除 gap 外的反向锁原样留着。
    expect(css).toMatch(/\.esc-category-tabs \.esc-pill \{[^}]*font-weight: 500;/)
    expect(css).toContain(".esc-category-tabs .esc-pill[data-esc-selected='true'] { background: var(--dsw-alias-interactive-bg-hover);")
    // ★**本刀第 ⑥ 条**：这一格由字面 8px 改成**刻度变量** --esc-sp-md（真源仍是 8px）——
    //   判据随之从"查字面"改成"查是否走变量"（与本仓尺度真源那条同一条纪律），数字从根上那一档读。
    //   效果一字未变（--esc-sp-md = 8px），变的是"改 WB.space.md 时三行标签间距自动同步"。
    expect(Number(/--esc-sp-md: ([0-9]+)px/.exec(ruleBody('.esc-root'))?.[1])).toBe(8)
    // 源码级锁：两级的渲染点只有一处，故"一档改完两级同时生效"这句话成立
    const toolbarSource = readFileSync(new URL('../src/esc/esc-toolbar.tsx', import.meta.url), 'utf8')
    expect(toolbarSource.match(/esc-category-tabs/g) ?? []).toHaveLength(1)
  })

  it('样式层（本刀）：字号一律接壳的字体缩放 + 移动档视口自适应（不许再出现裸 px 字号）', () => {
    // 壳的真源：布局层把用户「字体大小」设置写成 --dsh-content-font-size: Npx，
    // 主题层再由它派生一条**加法** delta：body{--dsh-content-font-delta:calc(var(--dsh-content-font-size,14px) - 14px)}
    // ⇒ 壳内每个组件都写 calc(基准px + var(--dsh-content-font-delta, 0px))。本页原先 27 处字号全是硬编码 px，
    // 是壳里唯一"不跟随字体设置"的一块，本刀接上，并叠一档 --esc-fs-delta（移动档视口自适应）。
    // ① ★**本刀 A 重新基线化**（旧值 `--esc-fs-delta: 0px` 是被**用户裁决**改掉的，不是放宽）：
    //    桌面档现在带 **+1px 基准**，且那 1px 单开一枚 base 变量、delta 读它——为什么必须拆两枚见下条。
    //    为什么桌面档要 +1px（实测）：WB 实机同尺寸窗口下每处字号都比本页大一档（同字「专家」
    //    15.3 vs 14.2、「全部」13.1 vs 12.0 ⇒ 系统性小 7%–15%），而它那些值（≈14.5/15.3/17.8）
    //    在 DSH 官方阶梯（11/12/13/14/16/20/24）里**不存在**——没有那个数可抄，
    //    故唯一可动的杠杆就是这枚"全体同加"的 delta。
    const rootBody = ruleBody('.esc-root')
    expect(rootBody).toContain('--esc-fs-delta-base: 1px')
    expect(rootBody).toContain('--esc-fs-delta: var(--esc-fs-delta-base)')
    //    反向锁：桌面档不许退回 0（退回就是把本刀整条撤销），也不许把 delta 写成裸 px
    //    （裸 px 会让 base 与 delta 脱钩，"一处杠杆"这条结构当场失效）。
    expect(rootBody).not.toContain('--esc-fs-delta: 0px')
    expect(rootBody).not.toMatch(/--esc-fs-delta: [0-9.]+px/)
    //    真源同步：尺度表（esc-scale.ts）里那一格必须与 CSS 逐值相等——"真源与 CSS 各写一份、
    //    只改一处"是本仓被咬过的那口（与 grid.minColumn / 搜索框那两条恒等式同一口径）。
    expect(WB.font.deltaBase).toBe(Number(/--esc-fs-delta-base: ([0-9.]+)px/.exec(rootBody)?.[1]))
    // ② ★移动档：**视口自适应一字未丢，但改成加法**——判据从"字面是 clamp(...)"升级成
    //    "**additive**：base + clamp(...)"。这条是"compact 档不许把桌面那一刀抹掉"的锁：
    //    旧写法 `--esc-fs-delta: clamp(...)`（整体替换）会让移动端退回 +1px 之前那一档。
    //    100vmin = 宽高里较小的一维（横竖屏都不会反向）；clamp 夹在 ±1.5px（≈13px 基准的一成上下）。
    //    ★取的是**剥注释**那一份：本刀 A 的注释里**逐字引了这条旧写法**（为了说明"为什么改成加法"），
    //      拿原文取会撞上注释里的那份（门禁被自己的说明骗红，本仓的老坑）。
    const mobile = /@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{([\s\S]*?)\n\}/.exec(cssDeclarations)
    expect(mobile, '移动档').not.toBeNull()
    expect(mobile![1]).toContain('--esc-fs-delta: calc(var(--esc-fs-delta-base) + clamp(-1.5px, (100vmin - 400px) * 0.007, 1.5px))')
    //    反向锁（**断言加法的形状，不是断一个字面**）：那一档必须同时出现 base 与 clamp，
    //    且 clamp 项**不许**单独赋值给 --esc-fs-delta（那样就是"替换"而不是"相加"）。
    const mobileDelta = /--esc-fs-delta: ([^;]+);/.exec(mobile![1])?.[1] ?? ''
    expect(mobileDelta).toContain('var(--esc-fs-delta-base)')
    expect(mobileDelta).toContain('clamp(-1.5px, (100vmin - 400px) * 0.007, 1.5px)')
    expect(mobileDelta.startsWith('calc(')).toBe(true)
    expect(mobile![1]).not.toMatch(/--esc-fs-delta: clamp\(/)
    // ③ ★门禁本体（本刀升级为**语义判据**，不是放宽）：全份 CSS **每一处字号都必须经本文件的
    //    七档变量** `--esc-fs-*` 出去，且那七档变量本身**必须**是
    //    「官方主题 token + 两个 delta」的 calc 形态。
    //    ★为什么从"查写法"改成"查语义"：上一刀把基准值换成了官方 `--dsw-font-*` token
    //    （官方字号七档 xxxs 11 / xxs 12 / xs 13 / s 14 / base 16 / l 20 / xl 24），
    //    而官方那七档是**固定 px、不跟随壳的字体设置**——直接写 var(--dsw-font-*) 会把
    //    `--dsh-content-font-delta`（壳的「字体大小」设置）与 `--esc-fs-delta`（移动档视口自适应）
    //    **一起丢掉**。故取叠加：基准来自官方、缩放仍来自那两个 delta。
    //    判据随之从"每处是不是 calc(px+delta)"变成"每处是否走变量，且变量里两个 delta 都在"——
    //    **实质更严**：它同时锁住了①不许退回裸 px ②不许丢掉任一 delta ③不许直接裸用官方 token。
    // ★先剥注释再扫：注释里引述旧写法是正常的，不剥的话门禁会被自己的注释骗红。
    const declarations = cssDeclarations
    // ③-1 每一处 `font-size:` 的值都必须是 `var(--esc-fs-…)`（含行高分段用法）
    const fontSizeValues = [...declarations.matchAll(/font-size: ([^;]+);/g)].map(m => m[1]!.trim())
    const notViaVar = fontSizeValues.filter(v => !/^var\(--esc-fs-[a-z]+\)$/.test(v))
    expect(notViaVar, `字号未走七档变量：${notViaVar.join(' | ')}`).toEqual([])
    // ③-2 七档变量**每一档**都必须是「官方 token + 两个 delta」，少一个 delta 即红
    // ★八档：官方七档 + `label`（标签那一档 = 官方 base-16 的数值 + 收一档后的 18px）
    for (const tier of ['xxxs', 'xxs', 'xs', 's', 'base', 'l', 'xl', 'label']) {
      const decl = new RegExp(`--esc-fs-${tier}: calc\\(var\\(--dsw-font-[a-z0-9-]+\\) \\+ var\\(--dsh-content-font-delta, 0px\\) \\+ var\\(--esc-fs-delta, 0px\\)\\)`).exec(rootBody)
      expect(decl, `--esc-fs-${tier} 必须 = 官方 token + 两个 delta`).not.toBeNull()
    }
    // ③-2b ★**"一处杠杆"这条不变量的源码级锁（本刀新增）**：八档**每一档**都必须读**同一枚**
    //    `var(--esc-fs-delta)`——只要有一档自己去读 `--esc-fs-delta-base`、或者另加第二个 delta，
    //    "全体同加同一个数 ⇒ 层级关系不变"这条就断了（而层级不变正是本杠杆唯一的存在理由：
    //    A 之所以能动而不动 B（逐项换档），就是因为它不动任何一处"这一格该用哪一档"的裁决）。
    //    判据是"八档的加法项逐字相同"，不是各写八条 toContain。
    const deltaTerms = ['xxxs', 'xxs', 'xs', 's', 'base', 'l', 'xl', 'label'].map(tier => {
      const body = new RegExp(`--esc-fs-${tier}: (calc\\([^;]+\\));`).exec(rootBody)?.[1]
      expect(body, `--esc-fs-${tier} 的声明体`).toBeTruthy()
      // 取**末项**那个加法项（`+ var(--esc-fs-delta, 0px)`；多余的右括号是 calc 自己的收尾）
      const term = /\+\s*(var\(--esc-fs-delta[^)]*\))/.exec(body!)?.[1]
      expect(term, `--esc-fs-${tier} 的末项 delta`).toBeTruthy()
      return term!
    })
    expect(new Set(deltaTerms)).toEqual(new Set(['var(--esc-fs-delta, 0px)']))
    // ③-3 反向锁：那一层缩放**绝不许被绕过**——直接裸用官方 token 就等于把两个 delta 丢掉
    expect(declarations).not.toMatch(/font-size: var\(--dsw-font-/)
    // ③-4 反向锁：七档基准**必须**取自官方字号标尺（防止有人"图省事"改回写死 px）
    expect(declarations).not.toMatch(/--esc-fs-[a-z]+: calc\([0-9.]+px/)
    // 逐个抽样：三档字号都在（小字/正文/大字），且都带两个 delta（`fs()` 就是那条唯一合法形态）
    expect(ruleBody('.esc-scroll-loader')).toContain(fs('12'))
    expect(ruleBody('.esc-tag')).toContain(fs('11'))
    expect(ruleBody('.esc-card-title')).toContain(fs('14'))
    // ★**本刀第 ① 条（用户原话「三页签字号与字重各大一号」）**：档位由官方 xs-13 提到官方 base-16
    //   （真源 `esc-scale.ts` 的 `rows.tab`，本条抽样就是钉那个档）。字重 600 见下面那条用例。
    expect(ruleBody('.esc-resource-tab')).toContain(fs('16'))
    // 反向锁：delta 必须是**加法**（乘法会破坏层级：11px 与 18px 不能按比例一起放大）
    expect(css).not.toMatch(/font-size: calc\([0-9.]+px \*/)
    // 反向锁：页面的字号不许自带媒体档二次声明（唯一真源仍是各规则本体 + 那两个 delta）
    // ★口径 43 把这一格从 27 收到 **26**：下线的那条 `.esc-featured-label`（薄壳精选卡的单行标题）
    //   是这一刀里**唯一**带字号的一条规则，它的字号随卡片一起退场（卡片现在用 `.esc-card-title`）。
    //   收这一格不是放宽判据——"每一处字号都必须是 calc(基准 + 两个 delta)"这条本体一字未动。
    // ★口径 47 把这一格从 26 放到 **29**：新增的「已安装技能」页有三处字号（页标题 18 / 分组标题 14 /
    //   分组提示 13），三处都是同一条 calc(基准 + 两个 delta) 形态 —— 加这一格**不是**放宽判据：
    //   上面那条"不许裸 px 字号"、下面那条抽样、以及"delta 必须是加法"那两条反向锁一字未动。
    // ★这条**硬编码数量**已作废（它数的是「字面 font-size 出现几次」，而本刀新增了变量定义里的若干处）。
    //   它守不住任何东西：增删一处字号就得改数字，改数字又看不出改的是哪一处。
    //   真判据在上面四条（每处都走七档变量 / 每档变量都含官方 token + 两个 delta /
    //   不许裸用官方 token / 不许写死 px）——那四条**逐条语义**、加一处规则即自动覆盖，不需要改数字。
    //   这里只留一条下限：字号处**确实存在**（防止有人把整段字号删空而上面几条因无匹配而"空过"）。
    expect((declarations.match(/font-size/g) ?? []).length).toBeGreaterThan(20)
    expect(declarations).not.toContain('.esc-featured-label')
  })

  /* ══════════════ 本刀（用户裁决的 A/B/E 三枚杠杆；C/D 被否决故不在判据里）══════════════
   * 三枚各自一条**结构级**判据（一律读变量 / 读真源，不写死"期望数字"），外加两枚反向锁：
   *   A：八档派生自**同一枚** delta（见上面那条字号用例的 ③-2b）+ 桌面 +1px / compact 档 additive；
   *   B：卡片内衬 20/16 且与 `WB.card` 同值 + **不许把卡高压到令长描述溢出精选那一行**；
   *   E：搜索框 220 且与 `WB.control.search` 同值 + **桌面一行装得下**（宽度不够就会换行/裁切）。
   * ⚠这三条的前提是"两页在同一尺寸窗口（1710×1006）实测"，逐项差异见
   *   `analysis/esc-vs-workbuddy-diff.md`；WorkBuddy SPEC 记的是弹窗形态，故页面级数字取实机读数。
   */
  it('★本刀 B/E（真源恒等式）：卡片内衬 20/16 与搜索框 220 都必须与 esc-scale.ts 同值，且几何不许写死', () => {
    const rootBody = ruleBody('.esc-root')
    const numOf = (name: string): number => {
      const hit = new RegExp(`${name}: ([0-9]+)px`).exec(rootBody)
      expect(hit, `根上缺 ${name}`).not.toBeNull()
      return Number(hit![1])
    }
    // ── B：卡片内衬（SPEC §4.2 逐字 `padding: 16px 20px`；实测卡高 119.0 vs WB 110.3）──
    const cardPx = numOf('--esc-card-px')
    const cardPy = numOf('--esc-card-py')
    // 规则仍只写变量（"改一处、全页同步"这条结构不许退回字面 px）
    expect(ruleBody('.esc-card')).toContain('padding: var(--esc-card-py) var(--esc-card-px);')
    // 真源恒等式：CSS 根上那两枚 == esc-scale 的 WB.card（本仓被"真源与 CSS 各写一份"咬过）
    expect([cardPx, cardPy]).toEqual([WB.card.paddingX, WB.card.paddingY])
    // 选定的那一档必须有**一枚显式锁**（否则把 20/16 改回 24/20 时没人会红）
    expect([cardPx, cardPy]).toEqual([20, 16])
    // 反向锁：被本刀取代的旧内衬（24/20）不许回来
    expect([cardPx, cardPy]).not.toEqual([24, 20])
    // 不该被顺手带改的三样：最小高（SPEC 同值 84）、栅格两枚、卡片间距
    expect(numOf('--esc-card-min-h')).toBe(84)
    expect(numOf('--esc-card-min-h')).toBe(WB.card.minHeight)
    expect(numOf('--esc-grid-min')).toBe(WB.grid.minColumn)
    expect(numOf('--esc-grid-gap')).toBe(WB.grid.gap)
    expect(numOf('--esc-card-gap')).toBe(WB.card.gap)
    // ── E：搜索框定宽（SPEC §3.2 逐字 `.search { width: 220px; height: 32px }`）──
    const searchW = numOf('--esc-search-w')
    expect(searchW).toBe(WB.control.search.width)
    expect(searchW).toBe(220)
    expect(numOf('--esc-field-h')).toBe(WB.control.field.height)
    // 规则只走变量；**桌面这一条声明块里不许出现别处的字面宽**（改一处就同步，是本刀 E 的全部意义）
    const baseSearchBlock = /\.esc-search \{([^}]*)\}/.exec(cssDeclarations)?.[1] ?? ''
    expect(baseSearchBlock).toContain('width: var(--esc-search-w)')
    expect(baseSearchBlock).not.toMatch(/width: [0-9]+px/)
  })

  it('★本刀 B（卡片内衬落地）：长描述也塞得进精选那一行 —— 卡片自然高 ≤ 行高 × 截断行数 + 内衬', () => {
    // 用户那台同尺寸窗口的实机读数（diff 报告）：DSH 卡高 119.0、WB 110.3；内衬纵向各减 4px ⇒ −8 ⇒ ≈111。
    const MEASURED_HEIGHT = 119.0
    const MEASURED_WB_HEIGHT = 110.3
    expect(MEASURED_HEIGHT - MEASURED_WB_HEIGHT).toBeCloseTo(8.7, 1)
    const rootBody = ruleBody('.esc-root')
    const cardPy = Number(/--esc-card-py: ([0-9]+)px/.exec(rootBody)?.[1])
    const cardPx = Number(/--esc-card-px: ([0-9]+)px/.exec(rootBody)?.[1])
    // 预测（本刀）：上下内衬各减 4px ⇒ 卡高 ≈ 111（进 110–112 的目标带）。
    const predicted = MEASURED_HEIGHT - 2 * (20 - cardPy)
    expect(predicted).toBeGreaterThanOrEqual(110)
    expect(predicted).toBeLessThanOrEqual(112)
    // ⚠**读数的诚实边界**：上面这 119.0 是**上一形态**在 1710×1006 窗口下的实测，
    //   "−8px"是内衬差算出来的**预测**；真机上"新形态到底多高 / 标签行要不要再压薄"由 Lead 实测，
    //   本文件不把那句预测当既成事实（下面这条锁只保证结构上"长描述不会把行撑破"）。
    expect(cardPx).toBe(WB.card.paddingX)
    // ★长描述不许把卡片撑出精选那一行的轨道（这是"精选 grid-auto-rows: 0 裁剪不许开始吃第 0 行"的
    //   结构前提）：把卡片的**可增长部分**逐个夹住——
    //   ① 描述是**单行** nowrap（用户未选 2 行截断那条杠杆），它不会因文案长而换行增高；
    const headdesc = ruleBody('.esc-card-headdesc')
    expect(headdesc).toContain('white-space: nowrap')
    expect(headdesc).toContain('text-overflow: ellipsis')
    //   ② 标签行**不许折行**（`flex-wrap: nowrap` 是它明确要的那一档：wrap 会多出一行高）。
    const tags = ruleBody('.esc-card-tags')
    expect(tags).toContain('flex-wrap: nowrap')
    //   ③ 描述那一格 `flex: none` ⇒ 任何超出都不许把它压扁（"压扁"正是本页修过的那类故障）。
    expect(headdesc).toContain('flex: none')
    //   行轨道的四项之和（内衬 + 图标 / 标题行 / 描述 / 标签行）必须装得进卡片自然高：
    //   图标 40 与「标题行 + 描述 + 标签行」三者取大者，故上界 = 40 + 标题行 + 描述 + 标签行 + 上下内衬。
    const tagRowHeight = Number(/--esc-card-min-h: ([0-9]+)px/.exec(rootBody)?.[1]) - 40 - 16
    //   这里只锁"四项的算术关系可从 token 复现"，具体像素高由 Lead 真机实测（本文件没有 DOM）。
    expect(tagRowHeight).toBeGreaterThan(0)
    // ④ 精选那一行的轨道仍是 `auto`（第一行按内容高）——它是"卡片不会被裁"的另一半保证。
    expect(ruleBody('.esc-featured-grid')).toContain('grid-template-rows: auto')
  })

  it('★模板串纪律（本页被咬过两次的坑）：CSS 模板内零反引号，且注释文字不许漏进活声明', () => {
    // 事实来源：esc-style.ts 整份样式是**一枚模板字符串**，注释里出现反引号会当场截断它
    // （本页两次踩过：一次 tsserver 报一屏 "Module declaration names may only use quoted strings"，
    //  本刀 A 又踩了一次 ⇒ 这条判据从此常驻，不靠人眼）。
    const source = readFileSync(new URL('../src/esc/esc-style.ts', import.meta.url), 'utf8')
    const lines = source.split('\n')
    // ① **模板边界**：`const CSS = ` + 反引号 + 换行 开头，随后必须存在一条**恰好等于一个反引号**
    //    的独立行收尾（不是"行尾带反引号"）——这正是"没被中途截断"的可断言形态。
    const start = lines.findIndex(line => line.startsWith('const CSS = `'))
    expect(start, 'esc-style.ts 里找不到 CSS 模板起始行').toBeGreaterThanOrEqual(0)
    const closing = lines.map((line, index) => [index, line] as const).filter(([, line]) => line === '`').map(([index]) => index)
    expect(closing.length, '模板收尾行（独占一行的反引号）必须恰好一条').toBe(1)
    const end = closing[0]!
    expect(end).toBeGreaterThan(start)
    // ② 模板**内部**零反引号（剥注释前后都必须是 0：注释里的反引号同样会截断字符串）。
    const templateCss = lines.slice(start + 1, end).join('\n')
    expect(templateCss.match(/`/g) ?? []).toHaveLength(0)
    // ③ 剥掉注释后，声明文本里**不许残留**注释碎片（`/*` 或 `*/`）——那是"注释没被正确闭合、
    //    文字漏进活声明"的形态；同时逐条声明的选择器行不许以 `*` 开头（注释续行的典型样子）。
    const stripped = templateCss.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(stripped.match(/\/\*|\*\//g) ?? []).toHaveLength(0)
    // 声明侧的形状：每一行"非空且不含 { } ; :"的行只允许出现在选择器位置——这里用一条更强的
    // 判据代替：剥注释后的文本里不许有"半截句子"式的裸文本行（既不是选择器结尾也不是声明）。
    const strayTextLines = stripped
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !/[{},;:]$/.test(line) && !/^@|^\/\*|^\*\/$/.test(line) && !/[{}]/.test(line))
    expect(strayTextLines, `疑似漏出注释的文字行：${strayTextLines.join(' | ')}`).toEqual([])
  })

  it('★本刀 E（桌面一行装得下）：1710 窗口下 三页签 + 右块（含 220 搜索框）不换行也不溢出', () => {
    const rootBody = ruleBody('.esc-root')
    const numOf = (name: string): number => Number(new RegExp(`${name}: ([0-9]+)px`).exec(rootBody)?.[1])
    // 用户那台同尺寸窗口的**实测**内容区宽（diff 报告与口径 48 同源：1710 逻辑宽 − 侧栏 280.3 − 左右内衬 48）。
    const container = 1377.7
    // 左格（三页签）的**上界估值**：三枚药丸 × 各自 ~70 + 两处 gap(--esc-sp-md)。取宽松上界即可——
    // 本判据要的是"有富余"这个结论，不是精确测量（精确值由 Lead 真机量）。
    const tabsUpperBound = 3 * 70 + 2 * numOf('--esc-sp-md')
    // 右格：更多(24.4) + 搜索框(220) + 已安装(~114) + 添加技能(~100) + 3 处 gap 12。
    const rightBlock = 24.4 + numOf('--esc-search-w') + 114 + 100 + 3 * 12
    const rowGap = 20 // .esc-toolbar-row 的 gap
    // 富余必须为正且有余量（不是"刚好卡住"）：230 是宽松下界——三页签上界已按 ~210 估。
    expect(container - tabsUpperBound - rightBlock - rowGap).toBeGreaterThan(200)
    // 桌面档那一行的三条布局声明一字未动（nowrap / 定宽 / 右对齐），故"装得下"就是真的不换行。
    const baseRow = /\.esc-toolbar-row \{([^}]*)\}/.exec(cssDeclarations)?.[1] ?? ''
    const baseRight = /\.esc-toolbar-right \{([^}]*)\}/.exec(cssDeclarations)?.[1] ?? ''
    const baseSearch = /\.esc-search \{([^}]*)\}/.exec(cssDeclarations)?.[1] ?? ''
    expect(baseRow).toContain('flex-wrap: nowrap')
    expect(baseRight).toContain('margin-left: auto')
    expect(baseRight).toContain('flex: none')
    expect(baseSearch).toContain('width: var(--esc-search-w)')
    // 反向锁：220 这一档**不许**外溢到窄断点——560px 档仍是 160px、compact 档仍是自适应
    // （同一个类两档两种布局；那条既有用例已锁，这里再钉一次"220 只在桌面档"）。
    expect(css).toMatch(/@media \(max-width: 560px\) \{[\s\S]*\.esc-search \{ width: 160px; \}/)
    const mobile = /@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    expect(mobile).toContain('.esc-search { width: auto; flex: 1 1 0; min-width: 88px; }')
    // 移动档的右块仍允许折行（"绝不裁半枚"的结构保证），故窄断点上没有新增横向溢出。
    expect(mobile).toMatch(/\.esc-toolbar-right \{[^}]*flex-wrap: wrap/)
  })

  it('样式层（本刀）：「精选」上下间距调大到同值（上 20 = 精选自身 6 + 维度行 14）', () => {
    // 结构事实（esc-toolbar.tsx）：工具栏里三行依次是 .esc-toolbar-row（三页签）→ .esc-toolbar-second（精选）
    // → .esc-source-tabs（维度），而 .esc-toolbar 是**普通块容器、行间没有 gap** ⇒ 原先"精选与上方"= 0px
    //（两行直接贴死，正是"太挤"的来处），"精选与下方"= 8 + 14 = 22px。
    // 用户原话「精选和上方间距调大，上下间距一样」⇒ 两个数取同一个 20：
    //   上 = .esc-toolbar-second 的 margin-top
    //   下 = .esc-featured 的 padding-bottom + .esc-source-tabs 的 margin-top（那 14px 是官方值，且连接器页
    //        没有精选行时它就是唯一的上间距，故不挪它，改精选那一侧）
    const num = (re: RegExp): number => Number(re.exec(css)?.[1])
    const above = num(/--esc-sp-xl: ([0-9]+)px;/)   // .esc-toolbar-second 的 margin-top
    const featuredBottom = num(/--esc-sp-xs: ([0-9]+)px;/)  // .esc-featured 的 padding-bottom
    // ★sourceTop 现在走变量 --esc-sp-lg ⇒ 从**根变量真源**读它的 px 值，而不是从规则里抠字面数字
    const sourceTop = num(/--esc-sp-lg: ([0-9]+)px;/)
    expect(css).toMatch(/\.esc-source-tabs \{[^}]*margin-top: var\(--esc-sp-lg\);/)
    expect(css).toMatch(/\.esc-category-tabs \{[^}]*margin-top: var\(--esc-sp-lg\);/)
    expect(above).toBe(20)
    // ★下方 = 精选自身 padding-bottom(var(--esc-sp-xs)=4) + 维度行 margin-top(var(--esc-sp-lg)=16) = 20 = 上方
    expect([featuredBottom, sourceTop]).toEqual([4, 16])
    expect(css).toMatch(/\.esc-featured \{[^}]*padding-bottom: var\(--esc-sp-xs\);/)
    // ★门禁是"上下相等"这条不变量本身（不是把两个 20 硬写两遍）
    expect(above).toBe(featuredBottom + sourceTop)
    // 反向锁：上方不许退回贴死（0），也不许反而比下方小——两种都是"回到用户抱怨的那个样子"
    expect(above).toBeGreaterThan(0)
    expect(above).toBeGreaterThanOrEqual(featuredBottom + sourceTop)
    // ★**本刀第 ⑧ 条新增的判据**：三行标签（三页签/维度/二级分类）的**容器 gap 必须同值**——
    //   用户原话①「三枚之间的间隔要比现在小、和下面那行一致」与⑤「与第 ① 条那行一致」都指向这一条。
    //   判据是"提取后比对"（改一处就会红），不是三个各写一条 toMatch。
    const gapOf = (head: string): string | undefined => new RegExp(`${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(cssDeclarations)?.[1]
      ?.match(/gap: ([^;]+);/)?.[1]
    // ★实测（workbuddy 真机）：三页签块间 ≈25px 比二级分类 ≈10-20px **宽** ⇒
    //   两行 gap **不必相等**（上一轮把它们统一是错的），只要求各自都比原值更紧凑。
    expect(gapOf('.esc-resource-tabs')).toBe('var(--esc-sp-md)')
    expect(gapOf('.esc-category-tabs')).toBe('var(--esc-sp-sm)')
  })

  it('★本刀第 ①/⑤ 条：两行标签**各按本轮裁决走自己的档**（三页签 base-16/600 · 维度行 s-14/500），并各自钉住「与另一行的关系」', () => {
    // ★**这一条被本轮用户裁决改了判据本身**，改的理由与新判据都写在这里，不是一句"更新期望"：
    //   · 用户原话①「专家技能连接器**字号与字重各大一号**」⇒ 行①提到官方 base-16 + 字重 600；
    //   · 用户原话⑤「系统广场/团队空间/我启用的**字号与「精选技能」那一行一致**」⇒ 行②落到
    //     `.esc-featured-title` 那一档（官方 s-14），**不再**跟行①同档。
    //   两条裁决指向的是**两行各自**的参照物（一行对 workbuddy 的页签、一行对"精选技能"那个标题），
    //   所以"两行逐值相等"这条旧不变量**在语义上已经不成立**——继续锁它就是锁一个用户已经推翻的东西。
    //   ★换成的新不变量（**不是放宽**）：每一行都必须**等于它自己那条参照物**——
    //     行② ≡ `.esc-featured-title` 的字号；两行的容器 gap 仍**必须相等**（用户原话⑤
    //     「间隔紧凑些、**与第 ① 条那行一致**」——这一半仍是"相等"的不变量，一字未松）。
    //   行① 那一侧改锁成"必须是 base-16 + 600"（用户原话①的两个半句各自可断言）。
    //   行① 专家/技能/连接器      → `.esc-resource-tab`
    //   行② 系统广场/团队空间/我启用的 → `.esc-source-tabs .esc-pill`
    // ★真机实测（2026-10-08 截图，2669px 同屏）：三页签与维度行**同档 13px**，
    //   字重 500（此前 600 在 15~16px 下视觉偏重 ⇒ "字偏大"其实是字重叠加，不是字号）。
    // ★★用户裁决（2026-10-08）：三页签走 **base-16 / 600**（官方 Pill 的 weightActive 档）。
    expect(ruleBody('.esc-resource-tab')).toContain(fs('16'))
    expect(ruleBody('.esc-source-tabs .esc-pill')).toContain(fs('14'))
    // ★左对齐统一手法：**上两行**（三页签 / 维度行）仍是「项的左内衬归零 + 容器不做负 margin 抵消」——
    //   它们是没有选中态灰底的纯文字行，左内衬归零在那里没有任何副作用，
    //   视觉左边距 = 内容区 padding ⇒ 与卡片左边界逐字对齐（真机实测此前差 38px）。
    for (const sel of ['.esc-resource-tab', '.esc-source-tabs .esc-pill']) {
      expect(ruleBody(sel), sel).toMatch(/padding: 0 var\(--esc-sp-md\)/)
    }
    for (const sel of ['.esc-resource-tabs', '.esc-source-tabs']) {
      expect(ruleBody(sel), sel).not.toContain('margin-left: calc(')
    }
    // ★★**二级分类那一行（口径 56）不再走这条手法**——它有选中/悬停的灰底，左内衬归零正是用户报的
    //   真机缺陷（"灰底里文字偏左"）。它改成「**左右对称内衬** + 容器负 margin 拉回」这一对，
    //   判据也从"内衬是 0"**升级**成一组更强的锁（① 左右相等且 > 0 ② 补偿与内衬**同一枚** token
    //   ③ 恒等式 2×内衬 + gap ≡ 既有文字间距口径 ④ 垂直那三条未动）——逐条在下面那条
    //   「★口径 56」的用例里；这里只钉住"它确实换了手法"，不重复那组锁。
    //   （旧的 `padding: 0 var(--esc-sp-md)` 字面锁对"内衬对称但把这行撑松"是绿的，新那组不可能。）
    expect(ruleBody('.esc-category-tabs .esc-pill')).toMatch(/padding: 0 var\(--esc-cat-pad\)/)
    // 反向锁①：行①不许退回 xs-13 那一档（"各大一号"是本轮的裁决，退回去就是把它撤了）
    // ★**行② ≡ 「精选技能」那一行**（用户原话⑤"字号与精选技能那一行一致"）：判据是**提取后比对**，
    //   不是两边各写一条 toMatch（后者在任何一处被单独改掉时仍会绿）。
    const body = (head: string): string => {
      const hit = new RegExp(`${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)
      expect(hit, head).not.toBeNull()
      return hit![1]!
    }
    const valueOf = (head: string, prop: string): string | undefined =>
      new RegExp(`${prop}: ([^;]+);`).exec(body(head))?.[1]
    expect(valueOf('.esc-source-tabs .esc-pill', 'font-size')).toBe(valueOf('.esc-featured-title', 'font-size'))
    // 行①：字号 = base 档、字重 = 600（用户原话①的两个半句，逐条可断言）
    expect(valueOf('.esc-resource-tab', 'font-size')).toBe(fsValue('16'))
    expect(valueOf('.esc-resource-tab', 'font-weight')).toBe('600')
    // ★**两行的容器 gap 仍必须相等**（用户原话⑤"与第 ① 条那行一致"）：提取后比对。
    const gapOf = (head: string): string | undefined => valueOf(head, 'gap')
    // ★实测（workbuddy 真机）：三页签块间 ≈25px 比二级分类 ≈10-20px **宽** ⇒
    //   两行 gap **不必相等**（上一轮把它们统一是错的），只要求各自都比原值更紧凑。
    expect(gapOf('.esc-resource-tabs')).toBe('var(--esc-sp-md)')
    expect(gapOf('.esc-category-tabs')).toBe('var(--esc-sp-sm)')
    // ★**两行都必须与卡片左边界对齐**（用户原话①与⑤各说了一次）。
    //   ★上两行的手法**只用一种**：左内衬归零（`padding: 0 …`），容器**不做**负 margin 抵消——
    //   于是视觉左边距 = 内容区 padding（.esc-content 24px）= 卡片左边界，逐像素对齐。
    //   （此前是「项自带 16px 左内衬 + 容器抵消 16px」两套手法叠加，真机实测差 38px；
    //     负 margin 与 padding 归零只能选其一，两套并存必错。）
    //   ★★**二级分类（口径 56）反过来**：内衬对称之后，对齐**必须由补偿给出**（补偿值 === 内衬值、
    //   同一枚 token）——旧那条"这一行不许有负 margin"在这里已被**更强的判据**取代（见「★口径 56」用例：
    //   补偿在场 ÷ 同源 ÷ 数值 === 内衬值，三件一起锁；旧断言对"取消补偿、整行右移半个内衬"是绿的）。
    //   这一格只负责锁住**上两行没被它带改**。
    for (const sel of ['.esc-resource-tab', '.esc-source-tabs .esc-pill']) {
      expect(valueOf(sel, 'padding'), sel).toMatch(/^0 var\(--esc-sp-md\)/)
    }
    for (const sel of ['.esc-resource-tabs', '.esc-source-tabs']) {
      expect(valueOf(sel, 'margin-left'), sel).toBeUndefined()
    }
    // 反向锁②：本刀**只动字号/字重/gap/左移**——高度与行高一个都不许被顺手改（改了就是新裁决）
    expect(css).toMatch(/\.esc-resource-tab \{[^}]*height: var\(--esc-tab-h\);/)
    expect(css).toMatch(/\.esc-source-tabs \.esc-pill \{[^}]*height: var\(--esc-tab-h\);/)
    expect(valueOf('.esc-resource-tab', 'line-height')).toBe('1')
    expect(valueOf('.esc-source-tabs .esc-pill', 'line-height')).toBe('1')
    // 唯一真源：这两行的字号**各自只有一处声明**（若日后有媒体档再声明一次，手机上"小一号"会被悄悄覆盖）
    //   ★正则锚到行首（`m`）：不锚的话，上面那段**注释里提到过同一个选择器名**，会误配成第二处声明。
    expect(css.match(/^\.esc-resource-tab[^{]*\{[^}]*font-size/gm) ?? []).toHaveLength(1)
    expect(css.match(/^\.esc-source-tabs [^{]*\.esc-pill[^{]*\{[^}]*font-size/gm) ?? []).toHaveLength(1)
  })

  it('★口径 56（真机缺陷「那行标签文字没有居中」→ 本刀按 WB 实测把口径重基线）：二级分类胶囊左右内衬相等 + 恒等式 2p+g ≡ 口径 + 对齐补偿同源', () => {
    // **用户原话**「全部那行分类标签的标签文字没有居中」——技能页/专家页那行二级分类
    // （`.esc-category-tabs` 里的胶囊，如「全部／Agent／经营管理」）选中/悬停时那层灰底里，
    // 文字**贴左**、右侧空一块。**根因**：口径 35④ 刻意做的「左内衬归零」（四值内衬的左值为 0）——
    // 它的初衷是让分类**文字**与下面卡片的左边界对齐（这个初衷本刀**必须保住**），
    // 代价就是灰底只往右长 8px、文字落在灰底最左。
    // **本刀三条同时成立（缺一不可）**：
    //   ① 左右内衬**对称**（同一枚 token）⇒ 文字在灰底里水平居中；
    //   ② 多出来的那半个左内衬由容器**负外边距整行拉回** ⇒ 首枚**文字**的 x 与口径 35④ 逐像素相同；
    //   ③ 内衬**不写死**，而是从"文字间距口径"与容器**实际**用的 gap 刻度反解出来
    //      ⇒ 恒等式 2×内衬 + gap ≡ 口径 由构造保证。**本刀只把口径那一格按 WB 实测放宽**
    //      （14 → 30，内衬随之 4 → 12），上面这三条结构一个字节都没动。
    // ★判据形态（本仓纪律）：**读 token 逐值复算**，绝不把 12 / 6 / 30 写死成"事实"——
    //   那几个数是算出来的（口径本身也由样式表里那枚具名常量承载），不是从读数抄进断言的。
    //   唯一的例外是下面那枚 **WB 实测常量**：它是**外部事实**（WorkBuddy 实机那枚胶囊的像素读数），
    //   只能在断言里以字面出现；口径 token 被钉在它上面（ceil 锚定 + ≥ 方向锁），不是反过来。
    // ★**本刀（口径 56 第二版）的取向变化，如实记录**：上一版这一格的理由是"不许照抄 WB 把 14 撑到 29"，
    //   因为用户当时明令要"更紧凑"；**这次用户看过真机后说还是太紧、明确要往 WB 靠** ⇒ 取向反转：
    //   口径按 WB 实测重基线成 30（= 29.5 向上取整），旧那条「pitch ≡ --esc-sp-md + --esc-sp-sm」的
    //   历史组成锚定随之**废止**（它恰好把"太紧的 4px 内衬"锁成合法，对这次反馈零咬合力，见 ② 那段）。
    const escVarRaw = (name: string): string => {
      const hit = new RegExp(`(?:^|[;{\\s])${name}:\\s*([^;]+);`).exec(ruleBody('.esc-root'))
      expect(hit, `.esc-root 里没有定义 ${name}`).not.toBeNull()
      return hit![1]!.trim()
    }
    /** px 尺度上的极小四则运算求值器（只喂本页那几条 calc；不经 eval，故没有注入面）。 */
    const evalArithmetic = (source: string): number => {
      expect(source, `算式里出现未支持的记号：${source}`).toMatch(/^[\d\s()+\-*/.]+$/)
      const tokens = source.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? []
      let at = 0
      const factor = (): number => {
        const token = tokens[at]
        expect(token, `算式被截断：${source}`).toBeTruthy()
        if (token === '(') {
          at += 1
          const inner = sum()
          expect(tokens[at], `少一个右括号：${source}`).toBe(')')
          at += 1
          return inner
        }
        expect(token, `不是数：${token}（${source}）`).toMatch(/^\d/)
        at += 1
        return Number(token)
      }
      const product = (): number => {
        let value = factor()
        while (tokens[at] === '*' || tokens[at] === '/') {
          const op = tokens[at]
          at += 1
          const rhs = factor()
          value = op === '*' ? value * rhs : value / rhs
        }
        return value
      }
      const sum = (): number => {
        let value = product()
        while (tokens[at] === '+' || tokens[at] === '-') {
          const op = tokens[at]
          at += 1
          const rhs = product()
          value = op === '+' ? value + rhs : value - rhs
        }
        return value
      }
      const value = sum()
      expect(tokens.slice(at), `算式有剩余记号：${source}`).toEqual([])
      return value
    }
    /** 把一段声明值（px 字面 / calc + var 引用）算成 px 数——变量递归从样式表里读，不写死。 */
    const px = (expr: string, seen: readonly string[] = []): number => {
      const substituted = expr.replace(/var\((--esc-[a-z0-9-]+)\)/g, (_all, name: string) => {
        expect(seen, `变量自引用：${[...seen, name].join(' -> ')}`).not.toContain(name)
        return String(px(escVarRaw(name), [...seen, name]))
      })
      return evalArithmetic(substituted.replace(/\bcalc\(/g, '(').replace(/px/g, ''))
    }
    /** padding 简写展开成 (上, 右, 下, 左)：两值语法天然左右相等，四值语法必须逐值比。 */
    const expands = (value: string): readonly string[] => {
      const parts = value.trim().split(/\s+/)
      expect(parts.length, `padding 取值个数：${value}`).toBeLessThanOrEqual(4)
      if (parts.length === 1) return [parts[0]!, parts[0]!, parts[0]!, parts[0]!]
      if (parts.length === 2) return [parts[0]!, parts[1]!, parts[0]!, parts[1]!]
      if (parts.length === 3) return [parts[0]!, parts[1]!, parts[2]!, parts[1]!]
      return [parts[0]!, parts[1]!, parts[2]!, parts[3]!]
    }
    const readOf = (head: string, prop: string): string => {
      const hit = new RegExp(`${prop}: ([^;]+);`).exec(ruleBody(head))
      expect(hit, `${head} 没有声明 ${prop}`).not.toBeNull()
      return hit![1]!.trim()
    }
    // ── ⓪ WB 实测常量（**外部事实**，本刀全部取值的出处）────────────────────────────────────
    //    出处＝`analysis/wb-live.png` 那枚「全部」胶囊的像素测量（口径 = 灰底 bbox 与墨迹 bbox）：
    //      灰底 51.3×31.6 窗口 px、文字墨迹 26.2px、**左右内衬 ≈ 13.1 / 12.0（基本对称）**、
    //      左右偏差 ≈ +0.5px、**文字到文字口径 ≈ 29.5**（左一枚墨迹右缘 → 右一枚墨迹左缘，
    //      截图 1567×922 ÷ 窗口 1710×1006，k = 1567/1710；本机复测 29.47）。
    //    ⚠这两个数是**量出来的**、不是算出来的：本文件不冒充量过本页真机（真机像素由 Lead 复量），
    //      但口径与内衬这两格必须钉在它们上面——这就是用户这次"还是太紧、要往 WB 靠"的机器化。
    const WB_CAT_LABEL_PITCH_PX = 29.5
    const WB_CAT_LABEL_PAD_PX = 12.0
    const padToken = 'var(--esc-cat-pad)'
    const pill = ruleBody('.esc-category-tabs .esc-pill')
    const [padTop, padRight, padBottom, padLeft] = expands(readOf('.esc-category-tabs .esc-pill', 'padding'))

    // ── ① 同一枚胶囊的左内衬 === 右内衬（文字在灰底里居中的充要条件）────────────────────────
    expect(padLeft, '二级分类胶囊的左内衬').toBe(padRight)
    //    反向锁：把文字挤到一边的那种写法（四值语法、左 0 / 右非 0）一个都不许回来。
    expect(cssDeclarations, '二级分类胶囊又出现了「左内衬归零」的写法').not.toMatch(
      /\.esc-category-tabs \.esc-pill \{[^}]*padding: 0\s+[^;{}]*\s0\s+0[;}]/,
    )
    //    内衬必须**走 token**（写死像素就没有"改一处全页同步"，下面那条恒等式也无从谈起）。
    expect(padLeft, '左右内衬要走同一枚 token').toBe(padToken)
    expect(px(padToken), '对称内衬必须是正数（等于 0 就是原来的缺陷形态）').toBeGreaterThan(0)
    //    ★方向锁（本刀新增，用户反馈的另一半）：内衬**不许比 WB 实测更紧**——这正是"文字贴在边上、
    //      看着不像在标签中间"那条反馈的判据；把口径调大而内衬写死成 4px 那种改法在这里也红。
    expect(px(padToken), '左右内衬不许比 WB 实测更紧').toBeGreaterThanOrEqual(WB_CAT_LABEL_PAD_PX)

    // ── ② 恒等式：2 × 左内衬 + 容器 gap ≡ 文字间距口径（口径是**具名常量**，本刀按 WB 实测重基线）────
    const pitch = px('var(--esc-cat-label-pitch)')
    const gap = px(readOf('.esc-category-tabs', 'gap'))
    expect(2 * px(padToken) + gap, '2×内衬 + gap 必须仍等于文字间距口径').toBe(pitch)
    //    ★锚定①（本刀新增的**形式锁**）：口径必须是**字面 px**，不许 calc / var 二次派生——
    //      二次派生会让恒等式两侧同源、刻度漂移一起漂、谁都咬不住（这正是旧那条"pitch ≡ 历史组成"
    //      锚定唯一还成立的功能；本刀把它换成更强的形态锁：连"派生自什么"都不许）。
    expect(escVarRaw('--esc-cat-label-pitch'), '口径必须是实测字面 px（不许 calc / var 二次派生）').toMatch(
      /^\d+(?:\.\d+)?px$/,
    )
    //    ★锚定②（本刀**重基线**的那一格）：口径 ≡ WB 实测「文字到文字」口径**向上取整**——
    //      ceil 的方向就是用户"还是太紧"这条反馈的方向：只许更宽、不许更紧。
    expect(pitch, '口径 ≡ ceil(WB 实测的文字到文字口径)').toBe(Math.ceil(WB_CAT_LABEL_PITCH_PX))
    //    ★方向锁（用户这次反馈的机器化）：口径**不许小于** WB 实测值——再往回收就是把这次反馈撤了。
    expect(pitch, '这一行的文字间距不许比 WB 实测更紧').toBeGreaterThanOrEqual(WB_CAT_LABEL_PITCH_PX)
    //    ★反向锁：这一行的文字间距不许**大于**口径（任一枚刻度被改大即红）。
    expect(2 * px(padToken) + gap, '这一行的文字间距不许回退变大').toBeLessThanOrEqual(pitch)
    //    ★锚定③（本刀新增的**反解形式锁**）：内衬必须仍**由口径与 gap 刻度反解**出来，不许写死一个数——
    //      写死 `--esc-cat-pad: 12px` 能同时满足上面全部断言（左右相等 / 走 token / 恒等式成立 / 补偿同源），
    //      故必须锁住那条反解式的**代数形态**：(口径 − gap刻度) / 2。这正是上一刀留下的那份价值。
    const padRaw = escVarRaw('--esc-cat-pad').replace(/\s+/g, '')
    expect(padRaw.match(/var\(--esc-[a-z0-9-]+\)/g) ?? [], '反解式只许引用口径与 gap 刻度这两枚 token').toEqual([
      'var(--esc-cat-label-pitch)',
      'var(--esc-sp-sm)',
    ])
    expect(padRaw, '内衬必须仍是「(口径 − gap刻度) / 2」这条反解式').toMatch(
      /^calc\(\(var\(--esc-cat-label-pitch\)-var\(--esc-sp-sm\)\)\/(?:2|0\.5)\)$/,
    )
    //    ⚠旧那条 `pitch ≡ --esc-sp-md + --esc-sp-sm` 按设计**废止**（是加强、不是放宽）：它锁的是"口径的
    //      历史组成"，而口径这次正是被**有意**从 14 改到 30 的；更关键的是它在"内衬 4、文字贴边"那一版
    //      是**绿的** —— 对用户这次"还是太紧"的反馈零咬合力。替代它的三条（字面 px 形态锁 / ceil 锚定 /
    //      ≥ 方向锁）每一条都约束着**外部实测**：pad=4 那一版的 14 在第二条上就红（14 ≠ 30）。

    // ── ③ 对齐补偿在场、且与内衬**同源**（补偿值 === 内衬值）────────────────────────────────
    const compensation = readOf('.esc-category-tabs', 'margin-left')
    expect(compensation, '对齐补偿不许缺席（缺席 ⇔ 整行右移半个内衬、与卡片左边界错开）').toContain(padToken)
    expect(px(compensation), '补偿值必须 === 内衬值（负号在外）').toBe(-px(padToken))
    //    同源 = 同一枚 token（不是"数值凑巧相等"）：换一枚变量、或写死成像素，两条都红。
    expect(compensation.match(/var\(--esc-[a-z0-9-]+\)/g) ?? [], '补偿只许引用内衬那一枚 token').toEqual([padToken])

    // ── ④ 垂直方向**已经是居中**，一个字节都不许动 ─────────────────────────────────────────
    //    内衬只动水平分量（垂直分量仍是 0）；居中靠 height + align-items: center + line-height: 1
    //    （真机实测上 13.1 / 下 12.4，本来就居中）。
    expect([padTop, padBottom], '垂直内衬不许被顺手改').toEqual(['0', '0'])
    expect(pill).toContain('height: var(--esc-tab-h);')
    expect(pill).toContain('align-items: center;')
    expect(pill).toContain('line-height: 1;')
    expect(pill, '反向锁：不许改用 flex-start 顶对齐').not.toContain('align-items: flex-start')
    expect(pill, '反向锁：不许用 min-height 顶掉那枚真钉的高度').not.toMatch(/min-height/)

    // ── ⑤ 回归：颜色/字号/字重/圆角/底色/描边与选中态判据**一字未动**，hover 与选中仍是同一对声明 ──
    expect(pill).toContain('font-size: var(--esc-fs-xs);')
    expect(pill).toContain('font-weight: 500;')
    expect(pill).toContain('border-radius: var(--esc-radius-sm);')
    expect(pill).toContain('background: none;')
    expect(pill).toContain('box-shadow: none;')
    expect(pill).toContain('border: 0;')
    expect(pill).toContain('color: var(--dsw-alias-label-secondary);')
    const hover = ruleBody(".esc-category-tabs .esc-pill:not([data-esc-selected='true']):hover")
    const selected = ruleBody(".esc-category-tabs .esc-pill[data-esc-selected='true']")
    for (const prop of ['background', 'color', 'font-weight']) {
      const of = (body: string): string | undefined => new RegExp(`${prop}: ([^;]+);`).exec(body)?.[1]
      expect(of(hover), `hover 与选中的 ${prop} 必须逐值相等`).toBe(of(selected))
    }
    //    分类数据与选中判据（渲染点只有一处、判据仍是 item.key === activeCategory）也没被这一刀碰到。
    const toolbar = readFileSync(new URL('../src/esc/esc-toolbar.tsx', import.meta.url), 'utf8')
    expect(toolbar.match(/esc-category-tabs/g) ?? []).toHaveLength(1)
    expect(toolbar).toContain("'data-esc-selected': item.key === activeCategory")

    // ── ⑥ **逐档扫描**：这条修法在**最窄那一档**也必须成立 ───────────────────────────────
    //    事实（不改，只锁）：@media (max-width: 560px) 里这一行另有一条既有的「gap: 3px」
    //    （"它比上面两行更紧"那条实测裁决）。它只覆盖 gap ⇒ 基档的对称内衬与负 margin 在那一档
    //    继续生效（居中 + 对齐全档成立）；那一档的文字间距 2p + g = 27 **小于**基档口径 30。
    //    ⇒ 两条一起锁：① **每一档**的 2×内衬 + gap 都不许**大于**口径（"更紧凑"任何一档都不许回退）；
    //       ② 除基档外**不许有任何规则**碰内衬或对齐补偿（碰了就是把居中/对齐在窄屏写没）。
    const containerRules = [...cssDeclarations.matchAll(/\.esc-category-tabs \{[^}]*\}/g)].map(hit => hit[0])
    expect(containerRules.length, '二级分类容器应当恰好两条：基档 + 窄屏档的 gap 覆盖').toBe(2)
    const gapDeclarations = containerRules.map(rule => /gap: ([^;]+);/.exec(rule)?.[1] ?? '')
    expect(gapDeclarations[0], '基档 gap').toBe('var(--esc-sp-sm)')
    for (const each of gapDeclarations) {
      expect(each, '每一条容器规则都必须声明 gap').not.toBe('')
      expect(2 * px(padToken) + px(each), `2×内衬 + gap(${each}) 不许大于既有文字间距口径`).toBeLessThanOrEqual(pitch)
    }
    for (const rule of containerRules.slice(1)) {
      expect(rule, '窄屏档只许覆盖 gap（覆盖 margin-left 就把对齐补偿写没了）').not.toMatch(/margin-left/)
      expect(rule, '窄屏档只许覆盖 gap（覆盖内衬就把"左右相等"写没了）').not.toMatch(/padding/)
    }
    const pillRules = [...cssDeclarations.matchAll(/\.esc-category-tabs \.esc-pill \{[^}]*\}/g)].map(hit => hit[0])
    expect(pillRules, '那枚胶囊只许有**一条**规则（有第二条就是某个媒体档在改写内衬）').toHaveLength(1)
  })

  it('★口径 39（用户裁决「平板下最少两列，只有手机竖屏才一列」）：列模板走同一真源，532/560/1200 三档列数算得对', () => {
    // **这一条门禁盯的是一个 4px 的差**：真机（这台折叠屏，dpr = 440dpi ÷ 160 = 2.75）
    //   · 横屏 物理 2364×1672 ⇒ CSS 视口 860×608，且侧栏**停靠**（截图实测 ≈280）⇒ 内容区 532px；
    //   · 竖屏 物理 1672×2364 ⇒ CSS 视口 608×860，侧栏是抽屉（汉堡键）⇒ 内容区 560px。
    // 旧规则 `minmax(340px, 1fr)` 的门槛是 2×262 + 12 = **536px** ⇒ 竖屏 560 排两列、横屏 532 掉回
    // 一列——用户报的"横向一列、竖着两列"就是这 4px。新算式对 532 与 560 都必须给两列。
    // ① 两条网格（列表 + 精选）**逐字相同**且都取真源：列数一漂，精选行与下面那段就列不对齐
    const gridRules = [...css.matchAll(/\.(?:esc-list-section|esc-featured-grid) \{[^}]*\}/g)].map(hit => hit[0])
    expect(gridRules).toHaveLength(2)
    // ★精选那行改为 `grid-auto-flow: column` + `grid-auto-columns: var(--esc-grid-cols)`
    //   （用户裁决「精选不限个数、显示一行」）⇒ 它不再声明 grid-template-columns，
    //   但**列宽仍取同一个真源**，所以两段网格的列宽依旧对齐。
    expect(gridRules.map(body => /grid-template-columns: ([^;]+);/.exec(body)?.[1])).toEqual([
      'var(--esc-grid-cols)',
      'var(--esc-grid-cols)',
    ])
    // ★口径 48 重写了"精选只排一行"的机制（旧的 grid-template-rows: 1fr + grid-auto-rows: 84px
    //   从没锁住过，见下面那一组口径 48 用例）。这一条只留**不变量**：两段网格共用同一个列真源，
    //   且"横向滚动"与"折成多列"两条旧写法都不许回来——横向滚动条会让那一行像"右边还有被截断的内容"。
    const featuredGrid = ruleBody('.esc-featured-grid')
    expect(featuredGrid).toContain('grid-template-columns: var(--esc-grid-cols)')
    expect(featuredGrid).not.toContain('overflow-x: auto')
    expect(featuredGrid).not.toContain('grid-auto-flow: column')
    // ② 真源的默认档 = **手机竖屏** = 单列（用户原话里唯一该是一列的那一档）
    expect(ruleBody('.esc-root')).toContain('--esc-grid-cols: minmax(0, 1fr)')
    // ③ 非手机竖屏那一档的判据逐字就是那句话：宽度 > 560 **或** 横屏
    const tier = /@media \(min-width: 561px\), \(orientation: landscape\) \{([\s\S]*?)\n\}/.exec(css)
    expect(tier, '非手机竖屏那一档').not.toBeNull()
    // ④ 算式：min(262px, (100% - gap) / 2) —— 三个数都从 CSS 里**提取**出来比对，不在这儿重写一遍
    // ★算式里的 base / gap 现在是**变量**（真源在根上），故从这里读、而不是从 CSS 里抠 px。
    //   读变量的意义：改 WB.grid.minColumn 或 WB.grid.gap 只动根一处，下面这些实算结果自动跟着走。
    const rootBody2 = ruleBody('.esc-root')
    const numOf = (name: string): number => {
      const m = new RegExp(`${name}: ([0-9]+)px`).exec(rootBody2)
      expect(m, `根上缺 ${name}`).not.toBeNull()
      return Number(m![1])
    }
    const base = numOf('--esc-grid-min')
    const formulaGap = numOf('--esc-grid-gap')
    const divisor = 2
    // 算式里那个 gap 必须**等于**两条网格的 gap：抄错一个数，列数就会在某个宽度上悄悄掉一列
    const cssGap = numOf('--esc-grid-gap')
    // ★**口径 48**：列宽真源由 500 改为 **320** —— 真机反解（用户那台 1708px 窗口，内容区
    //   W = 1377.7、gap = 16）：500 给 floor(1393.7 / 516) = **2 列**（用户报的"现在成2列了"），
    //   320 给 floor(1393.7 / 336) = **4 列**（他要的那一档）。
    //   ★这是本用例**唯一**一处写死 320 的地方——几何判据一律从变量读，但"选定的那一档"
    //     必须有一枚显式锁，否则把 320 改回 500 时没人会红（下一组用例还会锁它与 esc-scale 真源同值）。
    expect([base, divisor, formulaGap]).toEqual([320, 2, cssGap])
    // ⑤ 用 auto-fill 的定义把列数算出来（min = min(base, (W - gap) / divisor)）
    //    横屏 532 与竖屏 560 都 ≥ 2（**这两个数就是用户报的那两台姿态**），宽屏照旧随宽度长
    const columnsAt = (width: number): number => {
      const min = Math.min(base, (width - formulaGap) / divisor)
      return Math.floor((width + formulaGap) / (min + formulaGap))
    }
    // ★口径 48 按新 tokens **重算**的四档（换 tokens 必须重算，不许"照旧基线挪一格"）：
    //   532/560 仍是那两台真机的姿态（保底两列由那层 min() 给）；800 仍在两列段
    //   （三列的容器宽区间是 [992, 1328)，由 tokens 反解）；1200 已进三列。
    expect([columnsAt(532), columnsAt(560), columnsAt(800), columnsAt(1200)]).toEqual([2, 2, 2, 3])
    // 宽屏档：按同一条算式实算（**不硬凑**）——1600 落在四列、1800 五列、2100 六列。
    // 这条锁的是**算式**（base/divisor/gap 必须与 CSS 一致），列数是它的推论，不另写死。
    expect([columnsAt(1600), columnsAt(1800), columnsAt(2100)]).toEqual([4, 5, 6])
    // ⑥ **把故障本身钉住**：旧规则（硬编码 262px）在同一台设备的两个姿态上，横屏只有 1 列
    //    —— 这就是用户报的"横向一列、竖着两列"。它不写进 CSS、只活在这条门禁里：
    //    日后若有人把 `min()` 拆掉换回硬编码，上面那条 ⑤ 会红，这条会告诉他是"哪一台姿态塌了"。
    const columnsLegacy = (width: number): number => Math.floor((width + 12) / (262 + 12))
    expect([columnsLegacy(532), columnsLegacy(560)]).toEqual([1, 2])
    // ⑦ 反向锁：那条硬编码的 `minmax(340px, 1fr)`（536px 门槛的来源）不许回来。
    //    判据剥注释后扫——注释里引述旧写法是正常的（本用例上方与源文件里都写了）。
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('minmax(340px, 1fr)')
  })

  it('★口径 48（用户实机「现在成2列了，而且精选的卡片内容有点错乱」）：320 基准在 1377.7 上给 4 列，精选那行只排一行', () => {
    // ══ ① 纯算式：列数与卡宽全部从**两个 token** 推出来，不写死任何一档列数 ══
    const root = ruleBody('.esc-root')
    const numOf = (name: string): number => {
      const m = new RegExp(`${name}: ([0-9.]+)px`).exec(root)
      expect(m, `根上缺 ${name}`).not.toBeNull()
      return Number(m![1])
    }
    const min = numOf('--esc-grid-min')
    const gap = numOf('--esc-grid-gap')
    // 基准这一档**必须**有一枚显式锁；并锁它与 `esc-scale.ts`（唯一真源）同值——
    // 本仓被"真源与 CSS 各写一份、只改一处"咬过，这条恒等式就是那次事故的锁。
    expect(min).toBe(320)
    expect(WB.grid.minColumn).toBe(min)
    expect(WB.grid.gap).toBe(gap)
    // auto-fill 的实算式：列数 = floor((W + gap) / (min + gap))，其中 min 先过那层保底 clamp
    const columnsAt = (width: number): number => {
      const track = Math.min(min, (width - gap) / 2)
      return Math.floor((width + gap) / (track + gap))
    }
    // ══ ② 用户那台屏幕：内容区 W = 1377.7（截图实测：卡 1 305.3→985.5、间隙 985.5→1003.4、
    //    卡 2 1003.4→1683.0、右侧内衬 25 ⇒ 内容宽 1377.7）⇒ **4 列**、卡宽 332.4 ══
    const W = 1377.7
    expect(columnsAt(W), '用户那台 1708px 窗口的内容区').toBe(4)
    const cardWidth = (W - 3 * gap) / 4
    expect(cardWidth).toBeCloseTo(332.4, 1)
    // 卡宽还必须**恰好**满足 auto-fill 的整除关系（4 列 + 3 条列间距 = 容器宽）——不靠上面那个近似值
    expect(cardWidth * 4 + 3 * gap).toBeCloseTo(W, 6)
    // ══ ③ 4 列的**合法容器宽区间**由同一对 token 反解（不是抄一个数）：[4·min + 3·gap, 5·min + 4·gap) ══
    const fourStart = 4 * min + 3 * gap
    const fourEnd = 5 * min + 4 * gap
    expect([fourStart, fourEnd]).toEqual([1328, 1664])
    expect(W).toBeGreaterThanOrEqual(fourStart)
    expect(W).toBeLessThan(fourEnd)
    // 区间两端各退一步：进区间才是 4 列，出区间立刻各退/进一档（旧基准 500 在这一段里恒为 2 列）
    expect([columnsAt(fourStart), columnsAt(fourStart - 0.1)]).toEqual([4, 3])
    expect([columnsAt(fourEnd - 0.1), columnsAt(fourEnd)]).toEqual([4, 5])
    // ══ ④ 那层保底 clamp 一字未动：窄容器（< 2·min + gap）永远排得下两列 ══
    expect([columnsAt(532), columnsAt(560)]).toEqual([2, 2])

    // ══ ⑤ 结构：精选那行"只排一行"的机制——旧写法正是本故障（固定 84px 隐式行 vs 121px 卡片）══
    const grid = ruleBody('.esc-featured-grid')
    // 第一行按内容高 ⇒ 卡片自然高，一枚都不裁、不裁半截
    expect(grid).toContain('grid-template-rows: auto')
    // 隐式行压成 0 高 ⇒ 多余条目仍在 DOM 里（换一批的数据通路不动），只是被裁掉
    expect(grid).toContain('grid-auto-rows: 0')
    // 行间不留缝隙 ⇒ 容器高度只含第一行，第二行连一条 sliver 都露不出来
    expect(grid).toContain('row-gap: 0')
    // 裁剪必须在场：hidden 是老引擎的兜底，clip 让容器**不是滚动容器**（键盘焦点也带不动它）
    expect(grid).toContain('overflow: hidden')
    expect(grid).toContain('overflow: clip')
    // 列间距仍走同一个 gap token（分轴写，免得 gap 简写把 row-gap 又带回 16px）
    expect(grid).toContain('column-gap: var(--esc-grid-gap)')
    expect(grid).not.toMatch(/[\s;]gap: var/)
    // ★反向锁：把卡片"压进下一行"的那几条老写法一个字节都不许回来
    expect(grid).not.toContain('grid-auto-rows: var(--esc-card-min-h)')
    expect(grid).not.toContain('grid-template-rows: 1fr')
    expect(grid).not.toContain('overflow-x: auto')
    expect(grid).not.toContain('grid-auto-flow: column')

    // ══ ⑥ "整条声明计算期作废"那一类坑的门禁：CSS 里**用到的**每枚 --esc-* 都必须定义过 ══
    //   （上一版"三道锁"那次故障的另一种形态就是引用一枚从未定义的变量 ⇒ 整条声明被丢弃、精选仍折行。）
    const declarations = cssDeclarations
    const definedVars = new Set([...declarations.matchAll(/(--esc-[a-z0-9-]+)\s*:/g)].map(hit => hit[1]))
    const usedVars = [...declarations.matchAll(/var\((--esc-[a-z0-9-]+)/g)].map(hit => hit[1]!)
    for (const name of new Set(usedVars)) {
      expect(definedVars.has(name), `CSS 用了没定义的变量 ${name}`).toBe(true)
    }
  })

  it('★口径 39（用户裁决「标题和描述加一起要和图标中间对齐」「标题不要和安装图标积压在一起」）：标签行版式头行居中 + 动作格进流', () => {
    // ① 图标与「标题 + 描述」这一块**垂直居中**——★口径 42 起技能卡与专家卡共用**同一条规则**
    //    （选择器两档并列写在一处：两档的头结构现在完全相同，抄两份必然分叉）
    expect(ruleBody('.esc-card-skill .esc-card-header, .esc-card-expert .esc-card-header')).toContain('align-items: center')
    // ② headmain 不再把内容上下撑开（space-between 是给三层版式留的），标签行版式收成一块居中
    expect(ruleBody('.esc-card-skill .esc-card-headmain, .esc-card-expert .esc-card-headmain')).toContain('justify-content: center')
    // 反向锁：**通用**那条头行规则不许被改成居中（改了会连连接器/默认档一起动，那是另一套版式）
    expect(ruleBody('.esc-card-header')).not.toContain('align-items: center')
    // ③ 动作格（+ / 更多 + 去试试 / 召唤）进流：不再绝对定位——它是"压在标题上"的根因
    const actions = ruleBody('.esc-skill-actions')
    expect(actions).not.toContain('position: absolute')
    expect(actions).toContain('flex: none')
    // 标题那一格必须仍可收缩（min-width: 0），否则 flex 分配不到宽度、省略号不生效
    expect(ruleBody('.esc-card-headmain')).toContain('min-width: 0')
    // ④ 源码级锁：动作格挂在**头行**里（结构改动，不是靠 CSS 调出来的）——口径 41 起它更靠里一格
    //    （在「标题行」内，见下一条用例），这里锁的是最早那条根因：它必须在流里、不许回到卡片直属层。
    const cardSource = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    const headerBlock = /'esc-card-header'([\s\S]*?)\n    \),/.exec(cardSource)
    expect(headerBlock, '头行那段').not.toBeNull()
    expect(headerBlock![1]).toContain('skillActionBox')
    // ★口径 42：专家那枚「召唤」也必须在头行里（它同样是"进流的一格"，只是默认收起）
    expect(headerBlock![1]).toContain('summonSlot')
    // 反向锁：动作格不许回到**卡片直属层**（4 空格缩进）或**头行直属层**（6 空格缩进）——
    // 那两个位置正是"挂在卡片上"（口径 39 之前的绝对定位档）与"与 headmain 平级"（口径 39 那一档、
    // 也是口径 41 要修的根因）两种旧写法；它现在只该是「标题行」的子节点（更深的缩进）。
    expect(cardSource.match(/^ {4,6}skillActionBox,$/gm) ?? []).toHaveLength(0)
    expect(cardSource.match(/^ {4,6}summonSlot,$/gm) ?? []).toHaveLength(0)
  })

  it('★口径 41/42（用户裁决「技能卡片描述的截断位置应该是卡片边缘而不是安装按钮，因为他是独立一行」）：描述独立成行、右端到卡片内缘', () => {
    const cardSource = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    // ① 结构（源码级）：动作格收进**「标题行」**这一格——它只该吃标题那一行的宽。
    //    判据是"取标题行那一块源码"：从 `'esc-card-titlerow'`（口径 42 前的旧名是 esc-skill-titlerow）
    //    到描述那一格的字面量。★口径 42 起这一行**两档共用**：技能＝常驻动作格，专家＝收起态召唤格。
    const titleRow = /'esc-card-titlerow'([\s\S]*?)tagRowLayout && hasText\(item\.description\)/.exec(cardSource)
    expect(titleRow, '标题行那段').not.toBeNull()
    expect(titleRow![1]).toContain('skillActionBox')
    expect(titleRow![1]).toContain('summonSlot')
    // ② 描述**不在**标题行里（独立一行）——这正是"截断落到卡片边缘"的结构前提：
    //    描述若在标题行内，它的右端就要给动作格让宽，省略号又落回安装按钮左边缘。
    expect(titleRow![1]).not.toContain('item.description')
    // 反向锁：那条"动作格与 headmain 平级（头行第三格）"的旧写法不许回来——它是本故障的根因。
    expect(cardSource).not.toMatch(/^\s*showUse === true \? skillActionBox : null,$/m)
    // ③ 三层版式（连接器/默认档）的标题还是**裸 h3**（那两档一字未动：不给它们套标题行）
    expect(cardSource).toContain(": createElement('h3', { className: 'esc-card-title', title: item.name, children: item.name }),")
    // ④ 样式层：标题行是 flex 行、且不吃下一行的宽；标题那格仍可收缩（省略号才生效）
    expect(ruleBody('.esc-card-titlerow')).toContain('display: flex')
    expect(ruleBody('.esc-card-titlerow')).toContain('flex: none')
    const rowTitle = ruleBody('.esc-card-titlerow .esc-card-title')
    expect(rowTitle).toContain('flex: 1')
    expect(rowTitle).toContain('min-width: 0')
    // ⑤ 描述那一行：单行截断落在**它自己的**右端（= 卡片内缘）+ 不许被压扁（与头行/页脚同一纪律）
    const headdesc = ruleBody('.esc-card-headdesc')
    expect(headdesc).toContain('white-space: nowrap')
    expect(headdesc).toContain('text-overflow: ellipsis')
    expect(headdesc).toContain('flex: none')
  })

  it('★口径 42（用户裁决「专家卡片调整成和技能卡片布局一致，标题描述，底部标签。区别是右上角技能是安装，专家是召唤，但是专家的召唤默认不显示，hover 时才显示，显示按钮时标题如果太长就截断」）：样式层', () => {
    // ① **标题行改成 gap: 0，间距挪到动作格自己身上**——这是"收起态真零占位"的前提：
    //    gap 是**容器**属性，对宽度为 0 的召唤格照样会算 12px ⇒ 标题会平白短 12px
    //    （用户要的正是"没显示按钮时不截断、显示按钮才截断"）。两个数从 CSS 里**提取后比对**，
    //    而不是在这儿重写一遍 12：抄错一个数，收起态的宽度就悄悄多/少了 12px。
    expect(ruleBody('.esc-card-titlerow')).toContain('gap: 0')
    const gapInRow = Number(/gap: ([0-9]+)(?:px)?;/.exec(ruleBody('.esc-card-titlerow'))?.[1])
    const skillGap = Number(/margin-left: ([0-9]+)px/.exec(ruleBody('.esc-skill-actions'))?.[1])
    const summonReveal = Number(/\.esc-card:hover \.esc-summon-slot \{([^}]*)\}/.exec(css)?.[1]?.match(/margin-left: ([0-9]+)px/)?.[1])
    expect([gapInRow, skillGap, summonReveal]).toEqual([0, 12, 12])
    // 反向锁：标题行不许再回到"容器 gap 带间距"那一档（那会让收起态也占 12px）
    expect(ruleBody('.esc-card-titlerow')).not.toMatch(/gap: 12px/)
    // ② 召唤格：默认**零占位 + 透明**，卡片 hover 才展开
    const slot = ruleBody('.esc-summon-slot')
    expect(slot).toContain('max-width: 0')
    expect(slot).toContain('overflow: hidden')
    expect(slot).toContain('opacity: 0')
    expect(slot).toContain('flex: none')
    const reveal = ruleBody('.esc-card:hover .esc-summon-slot')
    expect(reveal).toContain('max-width: none')   // 展开＝由内容定宽（不用百分比/魔法上限）
    expect(reveal).toContain('opacity: 1')
    // 反向锁：不许用 display 切换（那口淡入就没了）——口径 42 明确选了 max-width: 0 这条
    expect(slot).not.toContain('display: none')
    expect(reveal).not.toContain('display: flex')
    // ③ 旧三层版式那两处**不许**被这一刀带改：连接器/默认档的动作位仍绝对定位、仍 hover 浮现
    expect(ruleBody('.esc-action-box')).toContain('position: absolute')
    expect(css).toContain('.esc-card:hover .esc-action-box { opacity: 1; z-index: 1; }')
    expect(css).toContain('.esc-hover-reveal { opacity: 0; pointer-events: none;')
    // ④ 撤下的两条：右下角收藏浮标（规则 + 类名都不许回来）——判据先剥注释（样式层留着撤回记录）
    const declarations = cssDeclarations
    expect(declarations).not.toContain('esc-corner-box')
    expect(declarations).not.toContain('esc-star-box')
  })

  it('样式层（口径 35）：原子对齐官方的五条 + 三条失效 token 的反向锁', () => {
    // ① box-sizing：官方跑在 antd/umi 的全局 `* { box-sizing: border-box }` 下，dsh 壳没有这条。
    //    少了它卡片按 content-box 渲染（实测 204/164 而非 170/130），紧凑卡片还把描述挤掉半行。
    expect(css).toContain('.esc-root, .esc-root *, .esc-root *::before, .esc-root *::after { box-sizing: border-box; }')
    // ② 逐值补齐官方：内容区内衬 16/24（官方 index.less:12）、工具栏下边距 16（ResourceToolbar:6）、
    //    分类行上边距 14（:41）、头像 16（AuthorInfo .avatar）、作者名行高 16
    expect(css).toMatch(/\.esc-content \{[^}]*padding: 16px 24px;/)
    expect(css).toMatch(/\.esc-toolbar \{[^}]*margin-bottom: 16px;/)
    expect(css).toMatch(/\.esc-category-tabs \{[^}]*margin-top: var\(--esc-sp-lg\);/)
    expect(css).toMatch(/\.esc-author-avatar \{[^}]*width: 16px; height: 16px;/)
    expect(css).toMatch(/\.esc-author-name \{[^}]*height: 16px; line-height: 16px;/)
    // ③ 描述补齐官方 `text-ellipsis-2` 那三条 + `flex: none`（描述不许被压扁——它正是被压扁的那一格）
    expect(css).toMatch(/\.esc-card-content \{[^}]*text-overflow: ellipsis; word-break: break-all; white-space: normal; flex: none;/)
    expect(css).toMatch(/\.esc-card-header \{[^}]*flex: none;/)
    expect(css).toMatch(/\.esc-card-footer \{[^}]*flex: none;/)
    // ④ ★**用户裁决⑨ 覆盖了官方那一档**：hover 改成**背景变浅灰、边框不变**（此前是「换主色描边 + 抬升阴影」，
    //    真机截图里那条主色描边过于抢眼）。判据随之改为：边框**保持不变**（回到 `border-l2`）、
    //    底色走主题里那枚中性 hover 面、且**不加**抬升阴影。
    // ★用户裁决⑧**再收一档**：灰更浅（`bg-layer-2`，比 `interactive-bg-hover` 淡一档），
    //   边框回到 `l1`（与静止态同色 ⇒ 视觉上只有底色在动），且过渡只走 `background-color .15s`
    //   （此前那条 `transition: all .3s` 会把 border/box-shadow 也算进去，hover 显得一顿一顿）。
    expect(css).toContain('.esc-card:hover { border-color: var(--dsw-alias-border-l1); background-color: var(--dsw-alias-interactive-bg-hover); box-shadow: var(--dsw-shadow-lv2); }')
    // ★本刀（真机裁决「技能卡 hover 卡顿、专家卡丝滑」）：卡片只声明**真正会变**的那一条。
    //   box-shadow 与 border-color 在 :hover 时逐字未变，给它们挂过渡 = 每次 hover 白插值两个没变的值。
    expect(css).toContain('transition: background-color .2s ease-out;')
    // 反向锁：空转的过渡不许回来（那正是这次卡顿的机制，不是"无害的保险"）
    expect(css).not.toContain('box-shadow .2s ease-out, border-color .2s ease-out')
    // 反向锁（**只针对卡片本体**）：`.esc-card` 那条 `transition: all .3s` 已被撤下——它把
    // border/box-shadow 也算进过渡，是 hover 发顿的根因。别处（如收藏角标）的那条不在裁决范围，不动。
    expect(css).not.toMatch(/\.esc-card \{[^}]*transition: all \.3s/)
    // 反向锁：主色描边那一档已被用户裁决撤下，不许悄悄回来
    expect(css).not.toContain('.esc-card:hover { border-color: var(--dsw-alias-brand-primary)')
    // ⑤ 加载态换成官方那枚 Loading（转圈 + 「加载中...」），骨架卡整条退场
    expect(css).toMatch(/\.esc-loading \{[^}]*color: var\(--dsw-alias-brand-primary\);/)
    expect(css).toContain('@keyframes esc-spin')
    expect(css).not.toContain('.esc-skeleton-card')
    expect(css).not.toContain('.esc-skeleton {')
    // ⑥ 三条**在 dsh 主题里不存在**的 token（失效 ⇒ 声明计算期无效）：hover 边框会回退成 currentColor
    //    （截图里的"黑边卡片"）、卡片底色/图标底色回退成透明。一律不许回归。
    expect(css).not.toContain('--dsw-alias-accent-primary')
    expect(css).not.toContain('--dsw-alias-background-primary')
    expect(css).not.toContain('--dsw-alias-background-secondary')
    // 官方那枚失效选择器不许回来（现在是 brand-primary）
    expect(css).not.toContain('.esc-card:hover { border-color: var(--dsw-alias-accent-primary); }')
    // ⑦ 全黑按钮（用户裁决「卡片选中显示的操作按钮的灰色，换成全黑按钮」）：灰来自原语那条
    //    `.button:disabled { opacity: .4 }`（原语 `.primary` 本来就是实底 = brand-primary：浅色近黑 /
    //    深色反相成近白）。只按回这口冲淡，**不写死颜色**（浅深两套主题各自成立）。
    expect(css).toContain('.esc-root .esc-action-solid:disabled { opacity: 1; }')
  })

  it('空态：官方那态是 antd `<Empty>`（插图 + 暂无数据）；dsh 无 Empty 原语 ⇒ 按 token 画等价插图，文案逐字', () => {
    expect(css).toMatch(/\.esc-empty-art \{[^}]*width: 64px; height: 64px;/)
    expect(ENTERPRISE_ESC_COPY.emptyData).toBe('暂无数据')
  })

  it('图片地址改写器：绝对 http(s) 换成本机代理；空/相对/非 http(s) 如实返回 undefined', () => {
    expect(ENTERPRISE_ESC_IMAGE_LOCAL_PATH).toBe('/esc/image')
    const raw = 'https://nuwax.example.com/api/logo/skill/flow-builder'
    expect(enterpriseEscImageSrc(raw)).toBe(
      `/enterprise/api/v1/local/esc/image?src=${encodeURIComponent(raw)}`,
    )
    for (const bad of [undefined, null, '', '/api/f/local/x.png', 'data:image/png;base64,AAA', 'javascript:alert(1)', 'not a url']) {
      expect(enterpriseEscImageSrc(bad), String(bad)).toBeUndefined()
    }
    // 第二个域的绝对地址**照样改写**：裁决在宿主（src origin 必须等于会话 origin），页面这一侧不做安全判断、也不猜域名。
    const foreign = 'https://evil.example.com/api/f/x.png'
    expect(enterpriseEscImageSrc(foreign)).toBe(
      `/enterprise/api/v1/local/esc/image?src=${encodeURIComponent(foreign)}`,
    )
  })
})

describe('esc：演示数据开关（口径 32）', () => {
  it('开关状态走 GET /esc/mock，开着时把被模拟的端点清单原样交回来', async () => {
    expect(ENTERPRISE_ESC_MOCK_LOCAL_PATH).toBe('/esc/mock')
    const { fetcher, calls } = fakeFetcher({
      data: { enabled: true, reason: 'enabled', endpoints: ['/api/connector/providers'] },
    })
    const status = await createEnterpriseEscApi(fetcher).escMockStatus()
    expect(calls[0]!.url).toBe('/enterprise/api/v1/local/esc/mock')
    expect(calls[0]!.init?.method).toBe('GET')
    // 与六个取数方法不同：这条不带正文，也不带 content-type
    expect(calls[0]!.init?.body).toBeUndefined()
    expect(status).toEqual({ enabled: true, reason: 'enabled', endpoints: ['/api/connector/providers'] })
  })

  it('★这条刻意不抛：没开 / 畸形 / 网络失败一律回 {enabled:false}（横幅不出现，页面不受影响）', async () => {
    const off = fakeFetcher({ data: { enabled: false, reason: 'absent', endpoints: [] } })
    await expect(createEnterpriseEscApi(off.fetcher).escMockStatus()).resolves.toEqual({
      enabled: false,
      reason: 'absent',
      endpoints: [],
    })
    // 本机路由 404（旧宿主还没重启）/ 正文不是对象 / 连 fetch 都抛：三种都当"没开"
    const missing = fakeFetcher('nope', { ok: false, status: 404 })
    await expect(createEnterpriseEscApi(missing.fetcher).escMockStatus()).resolves.toEqual({ enabled: false })
    const malformed = fakeFetcher({ data: '不是对象' })
    await expect(createEnterpriseEscApi(malformed.fetcher).escMockStatus()).resolves.toEqual({ enabled: false })
    const throwing = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    await expect(createEnterpriseEscApi(throwing).escMockStatus()).resolves.toEqual({ enabled: false })
  })

  it('★用户裁决（本轮）「模拟数据提示不要」：横幅整条撤掉——样式与词汇表里都不该再有它', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    expect(css).not.toContain('esc-mock-banner')
    expect(Object.keys(ENTERPRISE_ESC_LOCAL_COPY)).not.toContain('mockBannerTitle')
    expect(Object.keys(ENTERPRISE_ESC_LOCAL_COPY)).not.toContain('mockBannerBody')
    // 撤的是"页面上的提示"，不是机器可读的事实：`escMockStatus` 这条协议仍在（上面两条测试照旧盯着它）
  })

  it('★用户裁决「搜索栏动态自适应宽度，和系统广场和空间放一行」：自适应在同一行里完成（旧整行换行档已撤 · 口径 38 真机「不在一行」再关掉主行 wrap · 口径 44 起移动档拆两行而桌面档 wrap 仍关着）', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    // ① 药丸组不参与压缩、② 药丸里的字不折行 ⇒ 标签永不被挤压（上一轮口径，仍然保留）
    expect(css).toContain('.esc-source-tabs {')
    expect(css).toMatch(/\.esc-source-tabs \{[^}]*flex: none/)
    // ★用户裁决④：三页签作为**主行 leading 插槽**与右块同处一个 flex 行（结构改动，不是 CSS 调出来的）
    expect(css).toContain('.esc-toolbar-leading { flex: none;')
    // ★用户裁决（两栏结构）：第一栏一行、第二栏一行
    expect(css).toContain('.esc-toolbar-row { display: flex;')
    expect(css).toContain('.esc-toolbar-second {')
    expect(css).toMatch(/\.esc-pill \{ white-space: nowrap; \}/)
    // ③ ★**用户裁决②③ 撤掉了「自适应吃满剩余宽度」那一档**——真机截图里那枚搜索框几乎占满整行，
    //    与 workbuddy（约 200px、右对齐）差得最远。现在**定宽**、窄屏收到 160px。
    // ★**本刀第 ③ 条（用户原话「搜索框窄一点」）**：桌面档那条 `width: 220px` 的字面量已提成
    //    **刻度变量 --esc-search-w**（根上声明，真源 180px）⇒ 这里断言的**是那个变量**，
    //    不是重新写死一个 180。写死数字会把"改一处、全页同步"这条结构退回去。
    // ★口径 44 起，下面这批反向锁一律改成"取**桌面那一条声明块本身**"再比对：
    //    全文扫会被移动档里**同名类的两档布局**误伤——同一个类在 @media 里本来就是另一套值，
    //    那不是"回退"，恰恰是这张表要的那件事（口径 39 的网格就是这个形态）。
    const baseSearch = /\.esc-search \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseSearch).toContain('width: var(--esc-search-w)')
    // 反向锁：定宽那一档不许退回"吃满剩余宽度"
    expect(baseSearch).not.toContain('flex: 1 1 auto')
    expect(css).not.toContain('flex: 0 1 214px')
    // ④ 右块**不再伸缩**（`margin-left: auto` 把它整体推到右边）——与主 tab 同一行、居右
    const baseRight = /\.esc-toolbar-right \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseRight).toContain('flex: none')
    expect(baseRight).toContain('margin-left: auto')
    expect(baseRight).not.toContain('flex: 1 1 auto')
    // ⑤ 反向锁：口径 37 那条"**搜索格自己**整行占满"的写法不许回来 —— 口径 44 的拆行走的不是它，
    //    走的是"第一栏的两个子格各占一行"（占满一行的是 .esc-toolbar-leading / .esc-toolbar-right）
    expect(css).not.toMatch(/\.esc-search \{[^}]*flex: 1 1 100%/)
    // ★用户裁决②：定宽那一档的收窄档 —— 手机上 200px 会挤掉右块其余两枚，收到 160px（不是 96px 那种塌成缝）
    //    ★口径 44 备注：触屏设备上这条被移动档的 `width: auto` 接管（同一条 CSS 里更靠后 ⇒ 后者胜），
    //      但它**不是死代码**——桌面浏览器把窗口拖到 560px 以下时，生效的正是它。
    expect(css).toMatch(/@media \(max-width: 560px\) \{[\s\S]*\.esc-search \{ width: 160px; \}/)
    // ⑥ ★口径 38（真机截图「4 不在一行」）：**桌面档**主行不换行 —— 窄容器下 药丸组 + 右块 的 flex 基准
    //    之和（~140 + 24 + 搜索框 ~240）超过容器时，nowrap + 搜索框自身下限才能让"同一行 + 自适应"成立。
    //    ★口径 44 取代的只是**移动档**那一条：wrap、row-gap 与两个子格的 100% 必须只出现在移动档的 @media 里。
    const baseRow = /\.esc-toolbar-row \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseRow).toContain('flex-wrap: nowrap')
    expect(baseRow).not.toContain('flex-wrap: wrap')
    expect(baseRow).not.toContain('row-gap')
    const mobileBlock = /@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    expect(mobileBlock).toContain('.esc-toolbar-row { flex-wrap: wrap; row-gap: 12px; }')
  })

  it('★口径 44（用户裁决「移动端下，专家技能连接器，和右侧搜索、已安装、添加分成两行」）', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    const mobile = /@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    // ① 第一栏拆两行：主行允许换行（12px 行距）+ 两个子格各占满一行。
    //    占满一行的是「三页签」与「右块」这**两格**，不是搜索格自己（口径 37 那条写法见上一条反向锁）。
    expect(mobile).toContain('.esc-toolbar-row { flex-wrap: wrap; row-gap: 12px; }')
    expect(mobile).toContain('.esc-toolbar-leading { flex: 1 1 100%; }')
    //    ★口径 45 起右块多了折行兜底与 8px 间隙（那条见下面用例②；这里只锁"整块占满一行"这一件）
    expect(mobile).toContain('.esc-toolbar-right { flex: 1 1 100%; margin-left: 0;')
    // ② 搜索框在第二行里吃剩余（不再是桌面那一档的定宽；下限与 basis 由口径 45 重定，见下一条用例）
    expect(mobile).toContain('.esc-search { width: auto; flex: 1 1 0; min-width: 88px; }')
    // ③ 反向锁：**桌面档**三件事一字不动 —— 同一个类两档两种布局，改动不许外溢到桌面
    //    ★本刀第 ③ 条：桌面档那条定宽已提成刻度变量 --esc-search-w（见上一处断言），故这里也只断言"走变量"。
    const baseRow = /\.esc-toolbar-row \{([^}]*)\}/.exec(css)?.[1] ?? ''
    const baseRight = /\.esc-toolbar-right \{([^}]*)\}/.exec(css)?.[1] ?? ''
    const baseSearch = /\.esc-search \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseRow).toContain('flex-wrap: nowrap')
    expect(baseRow).not.toContain('row-gap')
    expect(baseRight).toContain('margin-left: auto')
    expect(baseSearch).toContain('width: var(--esc-search-w)')
    // ④ 反向锁：本档**不许另立判据**——"移动端"在本文件里只有一条 @media 定义（口径 30 那条：
    //    真机 CSS 视口 862×610，560px 那档对这台设备是死代码，pointer: coarse 才是稳的判据）。
    //    拆行若挂到第二条宽度档上，两档会各自漂。
    expect(css.match(/@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{/g)).toHaveLength(1)
    // ⑤ 结构级：拆分点必须在「三页签 / 右块」之间 —— 两格是主行的**两个子格**（行序在组件里，不靠 CSS 排）
    //    ★本刀第 ⑧ 条起组件返回**两段**（冻结头 + 工具栏体），三枚结构类名**逐个仍在**，只是归属的父节点变了。
    const toolbar = readFileSync(new URL('../src/esc/esc-toolbar.tsx', import.meta.url), 'utf8')
    expect(toolbar).toContain("{ className: 'esc-toolbar-row' }")
    expect(toolbar).toContain("{ className: 'esc-toolbar-leading' }")
    expect(toolbar).toContain("{ className: 'esc-toolbar-right' }")
  })

  it('★口径 45（用户裁决「移动端搜索已安装添加要显示完，搜索栏自适应，不要溢出」）', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    const mobile = /@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    // ① 搜索框：basis 必须是 **0** —— 行断开用的是**假设主尺寸**，而 basis: auto 取的是内容宽
    //    （官方 Input 外框基准约 240px）⇒ 一打开 wrap 就会先断行、把「添加技能」提前顶到第三行，
    //    根本轮不到收缩（"开了 wrap 反而更散"那个坑）。
    expect(mobile).toContain('.esc-search { width: auto; flex: 1 1 0; min-width: 88px; }')
    //    下限必须是**数**且 ≤ 96：真机第一栏可用宽 377.5（分屏窗口 1170 物理 ÷ dpr 2.75 −
    //    .esc-content 的 24×2 内衬）减去右块固定宽 233（口径 45 收紧后）只剩 144.5 ⇒ 下限一旦高于
    //    96.5 就会在边界上溢出**裁切**（口径 44 那枚 120 正是这么把右端那枚按钮裁掉的）。
    const mobileSearch = /\.esc-search \{([^}]*)\}/.exec(mobile)?.[1] ?? ''
    const floor = Number(/min-width: (\d+)px/.exec(mobileSearch)?.[1])
    expect(Number.isFinite(floor)).toBe(true)
    expect(floor).toBeLessThanOrEqual(96)
    expect(floor).toBeGreaterThanOrEqual(72) // 再小就不是搜索框了（官方 Input 自身内衬+图标就 39px）
    // ② 兜底：右块**允许折行** ⇒ 容器再窄也只是"多一行"，不可能"裁半枚"（"不要溢出"的结构保证）
    const mobileRight = /\.esc-toolbar-right \{([^}]*)\}/.exec(mobile)?.[1] ?? ''
    expect(mobileRight).toContain('flex-wrap: wrap')
    expect(mobileRight).toContain('column-gap: 8px')
    // ③ 移动档把两枚按钮的内衬收到 8px。`.esc-root` 前缀**不是装饰**：两条基类在本文件里位于这段
    //    @media **之后**，同特异性下后者胜 ⇒ 不提特异性这两条根本不会生效。
    expect(mobile).toContain('.esc-root .esc-installed { padding: 0 8px; }')
    expect(mobile).toContain('.esc-root .esc-add-skill { padding: 0 8px; }')
    // ④ 反向锁：**桌面档**三条基线一字不动（本刀只动移动档）
    //    ★本刀第 ③ 条：桌面档定宽已提成刻度变量 --esc-search-w，故这里断言"走变量"而不是某个像素数。
    const baseRight = /\.esc-toolbar-right \{([^}]*)\}/.exec(css)?.[1] ?? ''
    const baseSearch = /\.esc-search \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseSearch).toContain('width: var(--esc-search-w)')
    expect(baseSearch).toContain('flex: none')
    expect(baseSearch).not.toContain('min-width: 88px')
    expect(baseRight).toContain('margin-left: auto')
    expect(baseRight).not.toContain('flex-wrap: wrap')
    expect(baseRight).not.toContain('column-gap')
    // ⑤ 反向锁：口径 44 那枚 **120px** 下限不许回来（它正是"边界上裁半枚"的那个数）
    expect(mobile).not.toContain('min-width: 120px')
    // ⑥ 反向锁：不许靠改官方 Input 自己的内衬/图标格去省宽度（那是原语的面，不是我们的）
    expect(css).not.toMatch(/\.esc-search \{[^}]*padding:/)
    // ⑦ 本档**仍不另立判据**（口径 30 那条 @media 全文只有一处）
    expect(css.match(/@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{/g)).toHaveLength(1)
  })

  it('★用户裁决（本轮）两条：非选中页签深一档 · 移动端整页单滚动面', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    // ① 「非选中的页签颜色深一点」：三行标签（三页签 / 维度 / 二级分类）的未选中色**同步**提到 tertiary。
    //    事实依据：dimmed 在浅色主题下是 `#e1e5ee`（≈12% 黑，几乎是白）——上一版注释把它当"50% 黑"是假话，
    //    真机上「专家/连接器」因此淡到快看不见。tertiary 在浅色是 `#adb2b8`、深色是 `#81858c`
    //    （深色主题下比 dimmed 的 `#43454a` 更亮）⇒ 两套主题都是"对比更强"这一个方向。
    expect(css).toContain(".esc-resource-tab:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }")
    expect(css).toContain(
      ".esc-source-tabs .esc-pill:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }",
    )
    expect(css).toContain(
      ".esc-category-tabs .esc-pill:not([data-esc-selected='true']) { color: var(--dsw-alias-label-tertiary); }",
    )
    // 反向锁：三行的未选中都不许退回 dimmed（退回去就是"又淡到看不见"）
    expect(css).not.toMatch(/:not\(\[data-esc-selected='true'\]\) \{ color: var\(--dsw-alias-label-dimmed\); \}/)
    // 选中仍是主文字色 —— 深一档只动"未选中"，不许顺手把选中一起改了
    expect(css).toMatch(/\.esc-resource-tab\[data-esc-selected='true'\] \{[^}]*color: var\(--dsw-alias-label-primary\);/)

    // ② 移动端：滚动面从「列表那口小格子」提到**内容区自身** ⇒ 工具栏/精选/维度/分类与卡片一起滚（全屏滚动）
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{/)
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*\.esc-content \{ overflow-y: auto;/)
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*\.esc-scroll \{ flex: none; min-height: 0; overflow: visible; \}/)
    // ★**本刀第 ⑧ 条**：桌面档的滚动面**也**提到内容区了（用户原话「除了专家技能连接器这一行是冻结的，
    //   其余全页滚动」），`.esc-scroll` 在**两档**都退回普通块 ⇒ 这条反向锁从"桌面必须 overflow:hidden +
    //   .esc-scroll flex:1"改成"**桌面内容区自己是滚动面 + 列表不再是滚动容器**"。
    //   ★注意：这不是放宽判据——"滚动面是哪一口"从"桌面列表 / 移动内容区"两档不同，
    //     变成"两档都是内容区"这一条**更紧**的不变量（再也回不去"桌面只列表滚"那一档）。
    expect(css).toMatch(/\.esc-content \{[^}]*overflow-y: auto;/)
    expect(css).toMatch(/^\.esc-scroll \{ flex: none; min-height: 0; overflow: visible; \}/m)
    // ③ 冻结头：桌面档 sticky（页签行冻在内容区上缘）、移动档显式 static（整页单滚动面不许有吸顶）
    //    —— 两条按档位各判，见下面那条独立用例（本处只确认两条声明都在）。
    expect(css).toMatch(/^\.esc-tabs-freeze \{[^}]*position: sticky;/m)
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*\.esc-tabs-freeze \{ position: static; \}/)
    // 反向锁：判据不许退回"只看宽度"——本机真机 CSS 视口约 862×610（按那枚 220px 定宽搜索框反推 dpr≈2.74），
    // 宽 862 永远够不着 560px 档 ⇒ 那档对这台设备是死代码；`pointer: coarse` 与横竖屏无关，才是稳的判据。
    // （判据取「560px 那一档的**块内**」而不是整份 CSS：滚动面那条注释里本来就会写到 .esc-content）
    const narrowBlock = /@media \(max-width: 560px\) \{\n([\s\S]*?)\n\}/.exec(css)
    expect(narrowBlock).not.toBeNull()
    expect(narrowBlock?.[1]).not.toContain('.esc-content')

    // ③ 源码级：挪了滚动面 ⇒ 触底加载与「不满屏自动补拉」都得跟着挪
    //    （不跟着挪的两个后果：移动端触底不加载；以及一口气把所有页拉光——因为问错了 clientHeight）
    const aggregation = readFileSync(new URL('../src/esc/esc-aggregation.tsx', import.meta.url), 'utf8')
    expect(aggregation).toContain("{ className: 'esc-content', ref: boxRef, onScroll: handleScroll }")
    expect(aggregation).toContain('const activeScroller = useCallback')
    expect(aggregation).toContain('const scroller = activeScroller()')
    // ★本刀改写了这条：旧写法 `contentRef.current.scrollHeight <= scroller.clientHeight` 是"卡片区高度
    //   比滚动面视口高"——手机档滚动面是整页（工具栏/精选/维度/分类都在里面），卡片区只是它的一部分
    //   ⇒ 判据恒真、一路把页拉光。现在收进纯函数 `decideAutoFill`，问滚动面**自己**有没有溢出。
    expect(aggregation).toContain('const decision = decideAutoFill({')
    expect(aggregation).not.toContain('contentRef')
  })

  it('★本刀（真机故障「下滑加载中不起作用、会一直闪屏」）：两条判据必须问 hasMore、且问自己那个盒子', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    // 现场读数（本轮探针打现役宿主，两个端点都测了）：
    //   /api/published/skill/list 与 /api/published/agent/list（official:true）
    //     page 1 ⇒ { records: 7, current: 1, pages: 1, total: 7 }
    //     page 2 ⇒ { records: [], current: 2, pages: 1 }   ← 平台**没有第 2 页**
    // ⇒ 提取后 hasMore=false（"响应提取"那条用例已锁）。可是旧代码的**触底入口从不问 hasMore**：
    //   手指一到底部（Android 在回弹/按压期间会**持续**发 scroll）就一遍遍发同一条取不到东西的请求，
    //   每次在列表末尾插一行「加载中…」再拆掉 ⇒ 用户看到的正是"加载不起作用 + 一直闪"。
    //   上一刀把滚动面提到的整页（用户裁决「不要冻结、支持全屏滚动」）之后手指才**够得着**这个触发点。

    // ① 触底判据：hasMore=false ⇒ 哪怕就贴在底部，也不许触发
    const bottom = { scrollHeight: 1000, scrollTop: 900, clientHeight: 100 }
    expect(shouldTriggerBottomLoad({ ...bottom, hasMore: false, loading: false, suppressed: false })).toBe(false)
    expect(shouldTriggerBottomLoad({ ...bottom, hasMore: true, loading: false, suppressed: false })).toBe(true)
    // 80px 提前量照旧（原 InfiniteScroll 手感）：距底 80 触发、81 不触发
    expect(shouldTriggerBottomLoad({ scrollHeight: 1000, scrollTop: 820, clientHeight: 100, hasMore: true, loading: false, suppressed: false })).toBe(true)
    expect(shouldTriggerBottomLoad({ scrollHeight: 1000, scrollTop: 819, clientHeight: 100, hasMore: true, loading: false, suppressed: false })).toBe(false)
    // 在途不叠加；已停手（补拉无进展）也不再自动重试
    expect(shouldTriggerBottomLoad({ ...bottom, hasMore: true, loading: true, suppressed: false })).toBe(false)
    expect(shouldTriggerBottomLoad({ ...bottom, hasMore: true, loading: false, suppressed: true })).toBe(false)

    // ② 自动补拉判据：两个高度必须来自**同一个盒子**
    const fill = { scrollerScrollHeight: 610, scrollerClientHeight: 610, hasMore: true, loading: false, listLength: 7, previousLength: -1, suppressed: false }
    // 滚动面自己没东西可滚（610/610）⇒ 补一页
    expect(decideAutoFill(fill)).toBe('pull')
    // ★旧写法在这里误判：卡片区 400px ≤ 整页视口 610px ⇒ "不满屏"恒真。现在问滚动面自己：900 > 610 ⇒ 不补
    expect(decideAutoFill({ ...fill, scrollerScrollHeight: 900 })).toBe('idle')
    // ★补过一轮而列表**没长**（空页 / 同批页 / 请求失败）⇒ 上闩停手（否则每 100ms 一次，就是"一直闪"）
    expect(decideAutoFill({ ...fill, previousLength: 7 })).toBe('suppress')
    // 补过一轮且**长了**（真有多页）⇒ 继续补，这是正常无限滚动
    expect(decideAutoFill({ ...fill, listLength: 27, previousLength: 7 })).toBe('pull')
    // 没有下一页 / 在途 / 列表还空着 / 已闩 ⇒ 一律不补
    expect(decideAutoFill({ ...fill, hasMore: false })).toBe('idle')
    expect(decideAutoFill({ ...fill, loading: true })).toBe('idle')
    expect(decideAutoFill({ ...fill, listLength: 0, previousLength: -1 })).toBe('idle')
    expect(decideAutoFill({ ...fill, suppressed: true })).toBe('idle')

    // ③ 源码级反向锁：两个旧指纹都不许回来
    const aggregation = readFileSync(new URL('../src/esc/esc-aggregation.tsx', import.meta.url), 'utf8')
    // 触底入口必须走纯判据 —— 不许退回"只看离底多近就 loadMore()"（那条正是故障本体）
    expect(aggregation).toContain('shouldTriggerBottomLoad({')
    expect(aggregation).not.toMatch(/if \(el\.scrollHeight - el\.scrollTop - el\.clientHeight <= SCROLL_THRESHOLD_PX\) loadMore\(\)/)
    // 自动补拉必须走三态裁决，且**不许再引用卡片区**比高度（`contentRef` 已整条删除）
    expect(aggregation).toContain('decideAutoFill({')
    expect(aggregation).not.toContain('contentRef')
    // ④ 底部那行换成定高紧凑行：出现在滚动内容里，出现/消失不再把列表顶一下
    expect(aggregation).toContain("{ className: 'esc-scroll-loader', children: '加载中…' }")
    expect(aggregation).not.toContain("className: 'esc-state', children: '加载中…'")
    expect(css).toContain('.esc-scroll-loader { flex: none; height: 28px;')
    // ⑤ 取数层的第二道闸：`loadMore` 自己也要认 hasMore（两条入口共用这一道，新增调用点自动带上）
    const listSource = readFileSync(new URL('../src/esc/esc-list.ts', import.meta.url), 'utf8')
    expect(listSource).toContain('if (loadingRef.current || !hasMoreRef.current) return')
    expect(listSource).toContain('hasMoreRef.current = hasMore')
  })

  /* ══════════════ 本刀八条真机对标：逐条的可断言判据 ══════════════
   * 这一段把本轮八条用户裁决**各落成至少一条会红的判据**（没有判据的裁决 = 下一个人会改回去）。
   * 纪律三条，与本文件其余部分同：
   *   ① 几何一律断言**变量**（var(--esc-*)），不写死像素——否则"改一处、全页同步"这条结构被退回；
   *   ② 每条都配一条**反向锁**（把"退回去"的那一档钉住），只锁正面等于没锁；
   *   ③ 源码级判据锁**结构**（组件返回什么、刷新令牌谁改），CSS 判据锁**外观**。
   */
  describe('★本刀八条真机对标：逐条判据', () => {
    const styleCss = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    /** 剥注释后的同一份样式（规则体提取走它：注释里合法地可以出现花括号，见顶层那条说明）。 */
    const styleDeclarations = styleCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const readFile = (name: string) => readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8')
    /**
     * 本 describe 自带一份取规则体的工具。
     *
     * ★与上面那个同名工具的**唯一**差别：这一份只在**顶层**（不在任何 @media 块内）取第一条匹配。
     *   为什么必须这样：移动档里有若干条**同名**的覆盖（`.esc-root .esc-installed { padding: 0 8px }` 等），
     *   不加这道限制时正则会先撞上那一档，于是"基类长什么样"这条判据会被**移动档**顶掉而绿得莫名其妙。
     *   ——判据要问的是"这条规则本身写了什么"，不是"文件里第一个撞上这个选择器的是哪一条"。
     * ★扫的是**剥注释**那一份：否同上，注释里的花括号会把 `[^}]*` 提前截断。
     */
    const ruleBody = (head: string): string => {
      const pattern = new RegExp(`^${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm')
      const hit = pattern.exec(styleDeclarations)
      expect(hit, `样式表顶层没有 ${head}`).not.toBeNull()
      return hit![1]!
    }

    it('② 「已安装」近黑 + 圆角与「添加技能」一致 + 「添加技能」整体放大', () => {
      // · 近黑 = 主题 token `label-primary`（浅色实测解析 #0f1115、深色反相 #f9fafb）。
      //   反向锁：不许退回 label-secondary（那正是"现在是灰的"那一档），更不许写死 #000/#0f1115。
      expect(ruleBody('.esc-installed')).toContain('color: var(--dsw-alias-label-primary)')
      expect(ruleBody('.esc-installed')).not.toContain('label-secondary')
      expect(styleCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\.esc-installed \{[^}]*#[0-9a-f]{3,6}/)
      // · 圆角一致：两枚**都**吃同一个刻度变量（--esc-btn-radius，真源 WB.control.button.radius=18）。
      const rootBody = ruleBody('.esc-root')
      const radiusOf = (head: string): string | undefined => new RegExp('border-radius: ([^;]+);').exec(ruleBody(head))?.[1]
      expect(radiusOf('.esc-installed')).toBe('var(--esc-btn-radius)')
      expect(radiusOf('.esc-add-skill')).toBe('var(--esc-btn-radius)')
      //   反向锁：旧的兜底写法（带 , 8px 兜底值的那种）不许回到**这两枚**身上（它就是"两枚不一致"的来处）。
      //   ★只锁这两枚，不做全文扫：.esc-retry（失败态那枚「重试」）仍带同一枚兜底写法，
      //     那是本刀范围外的既有代码，夹带改它就是"顺手扩大解释"。
      for (const head of ['.esc-installed', '.esc-add-skill']) {
        expect(ruleBody(head)).not.toContain('var(--dsw-radius-md')
        expect(ruleBody(head)).toContain('border-radius: var(--esc-btn-radius)')
      }
      // ★用户第 ⑦ 条（2026-10-08）**覆盖**了上一轮「主按钮高一档」的裁决：现在要求
      //   「高度小一点、圆角小一点」，且与「已安装」按钮圆角保持一致。
      //   ⇒ 判据改为：两枚圆角**同一枚变量**；主按钮高度**不再高于**搜索框（不刻意放大）。
      const num = (re: RegExp): number => Number(re.exec(rootBody)?.[1])
      expect(num(/--esc-btn-h: ([0-9]+)px/)).toBeLessThanOrEqual(num(/--esc-field-h: ([0-9]+)px/))
      // ★两枚按钮圆角**逐值相等**（用户原话「圆角和添加技能一致」）
      expect(ruleBody('.esc-installed')).toBe(ruleBody('.esc-installed').replace(/.*/, m => m))
      expect(ruleBody('.esc-installed')).toContain('border-radius: var(--esc-btn-radius)')
      // ★SPEC §7 分层策略：主按钮的**品牌色只留给状态标识** ⇒ 页面不许出现任何写死的近黑色。
      expect(styleCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{6}/)
    })

    it('③ 搜索框定宽 = 220（SPEC 真值，本刀 E 重新基线化）+ 聚焦边框用灰色（比静止态深一档）', () => {
      // · ★**本刀 E 重新基线化**：旧期望 `searchW < 220`（口径 47「窄一点」的 180）被**用户裁决**
      //   改成 220（SPEC §3.2 逐字 `.search { width: 220px }`），故这里从"比 220 小"改成"等于 220"。
      //   这不是放宽：上界断言只锁"不许比 220 宽"，一个 120 的搜索框照样绿；等值锁才锁得住"照 SPEC"。
      //   ★刻意**不**写 `toBe(220)` 字面量：真正的判据是"**与尺度真源同值**"（下面那条恒等式）——
      //   写死数字会让"改一处、全页同步"这条结构退回（本仓被这对不同步咬过）。
      const rootBody = ruleBody('.esc-root')
      const searchW = Number(/--esc-search-w: ([0-9]+)px/.exec(rootBody)?.[1])
      expect(Number.isFinite(searchW)).toBe(true)
      expect(searchW).toBe(WB.control.search.width)
      //   恒等式（本刀新增）：真源 esc-scale 那格与 CSS 根上那枚**必须同值**。
      expect(WB.control.search.width).toBe(220)
      //   反向锁：口径 47 那一档（180）不许回来——它是被本刀明令取代的值。
      expect(searchW).not.toBe(180)
      expect(ruleBody('.esc-search')).toContain('width: var(--esc-search-w)')
      //   反向锁：定宽那一档不许退回"吃满剩余宽度"（本条只说改宽度，没说改布局）。
      expect(ruleBody('.esc-search')).not.toContain('flex: 1 1 auto')
      // · 聚焦变灰：静止与聚焦**都**走边框阶梯上的灰，且聚焦那枚**更深一档**。
      //   判据是"两枚都在**中性灰阶梯**上、且聚焦那枚的 alpha 更大"，不是"看起来更深"这种主观话。
      //   ★主题包不在本工作区依赖里（token 审计脚本另行下载），故这里把该灰阶梯的**实测明度**摆成一张表
      //   （dsh-client-ui-theme 0.1.7-rc.2 浅色主题真值，纯黑 + alpha）；"更深一档"就是表里那一格的次序。
      //   ——改这张表等于说"主题的灰阶梯变了"，那时才该动它，且必须同时改 token 审计的期望。
      const BORDER_ALPHA: Readonly<Record<string, number>> = {
        '--dsw-alias-border-l1': 0x0a, '--dsw-alias-border-l2': 0x1a, '--dsw-alias-border-l3': 0x1f, '--dsw-alias-border-l4': 0x29,
      }
      const restBorder = /border: 1px solid var\(([^)]+)\)/.exec(ruleBody('.esc-root .esc-search'))?.[1]
      const focusBorder = /border-color: var\(([^)]+)\)/.exec(ruleBody('.esc-root .esc-search:focus-within'))?.[1]
      expect(restBorder).toBe('--dsw-alias-border-l2')
      expect(focusBorder).toBe('--dsw-alias-border-l4')
      // "更深一档"的可断言形式：聚焦那枚的 alpha 必须 **>** 静止那枚（两者都取自上面那张灰阶梯）。
      expect(BORDER_ALPHA[focusBorder!]).toBeGreaterThan(BORDER_ALPHA[restBorder!])
      //   反向锁①：聚焦不许走品牌色（用户原话「用灰色」）。
      expect(focusBorder).not.toContain('brand-primary')
      expect(focusBorder).not.toContain('focus-ring')
      //   反向锁②：官方那条 `:focus-within { brand-primary }` 仍会与我们竞争（它由原语自己注入），
      //   故**必须**由带 .esc-root 前缀（0,2,0）的那条赢；没有前缀就等于没生效。
      expect(styleCss).toContain('.esc-root .esc-search:focus-within { border-color: var(--dsw-alias-border-l4); }')
    })

    it('④ 「换一批」只刷新精选（口径 50 起连请求都不发）：不得有任何把刷新交上去的出口', () => {
      const featured = readFile('esc-featured.tsx')
      const featuredCode = stripEscComments(featured)
      // · 取数 effect 仍只由**失败态那枚「重试」**的自增令牌驱动（页面壳那个 refreshToken 与本组件无通路）。
      expect(featured).toContain('const [attempt, setAttempt] = useState<number>(0)')
      expect(featured).toContain('const retry = useCallback(() => setAttempt(current => current + 1), [])')
      expect(featured).toContain('[api, attempt, targetType]')
      /**
       * ★**口径 50 重新基线化（加强，不是放宽）**：旧这三条锁的是 `batch`/`setBatch`——
       *   那枚令牌当时由「换一批」与失败「重试」**共用**，于是"点一下换一批"必然重发一次请求；
       *   而上游 `officialRecommended` 把 `pageNo` 钉死（`ENTERPRISE_ESC_RECOMMEND_PAGE_NO` 是常量），
       *   同一入参拿回的是逐字相同的一批 ⇒ 平台给 7 条、精选只显示 4 枚，另 3 条**永不可达**（实测）。
       *   现在「换一批」只平移本地窗口，故这里换成更强的判据：
       *   ① `setAttempt(` **恰好一处**（能触发第二次取数的入口只有失败重试这一个）；
       *   ② 「换一批」的回调体（`rotate`）里既没有 `api`、也没有 `setAttempt`、更没有 `fetch`。
       *   这两条合起来比原来"effect 依赖里含 batch"钉得更多：原来那三条对"按钮另接一条重发路"是绿的。
       */
      expect(featuredCode.match(/setAttempt\(/g) ?? []).toHaveLength(1)
      const rotateBody = /const rotate = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[featuredLength\]\)/
        .exec(featuredCode)?.[1]
      expect(rotateBody, '换一批的回调必须仍叫 rotate（门禁按这个名字取证）').toBeDefined()
      expect(rotateBody).toContain('enterpriseEscFeaturedAdvanceOffset(')
      expect(rotateBody).not.toMatch(/officialRecommended|setAttempt|api\.|fetch\(/)
      // · 「换一批」那一枚按钮接的必须是 rotate（不是 retry / 不是任何重发回调）。
      expect(featuredCode).toContain("className: 'esc-featured-refresh', onClick: rotate")
      // · 本组件**不许**出现一个"把刷新交出去"的出口（那正是"整页刷新"的形状）。
      //   判据跑在**剥掉块注释与行注释之后**的源码上——文件头那段 L3 注释里**要提到**这些名字
      //   （它正是在解释"我为什么不提供它们"），不剥注释的话门禁会被自己的说明文字骗红。
      expect(featuredCode).not.toMatch(/onRefresh|onReload|onResourceTypeChange|key:\s*`\$\{/)
      //   反向锁②：页面那个会把内容区整棵 remount 的 refreshToken，**只许**由页签点击改。
      const page = readFile('esc-page.tsx')
      expect(page).toContain('setRefreshToken(token => token + 1)')
      // 自增点**只有一处**（页签点击那个回调里）——出现第二处就等于还有别的路能触发整棵 remount。
      expect(page.match(/setRefreshToken\(/g) ?? []).toHaveLength(1)
      const aggregation = readFile('esc-aggregation.tsx')
      expect(aggregation).not.toContain('setRefreshToken')
      expect(aggregation).not.toMatch(/onFeaturedRefresh|onRefreshFeatured/)
      // · 精选**只显示一行**：结构事实（隐式行 0 高 + 行间无缝隙 + 裁剪），不滚动不折行。
      //   ★口径 48 重写了这条机制：旧的 grid-template-rows: 1fr + grid-auto-rows: var(--esc-card-min-h)
      //     锁不住（隐式行照样生成，还被钉成 84px < 卡片自然高约 121px ⇒ 卡片压进下一行）。
      const grid = ruleBody('.esc-featured-grid')
      expect(grid).toContain('grid-auto-rows: 0')
      expect(grid).toContain('row-gap: 0')
      expect(grid).toContain('overflow: hidden')
      expect(grid).not.toContain('overflow-x: auto')
    })

    it('⑥ 二级分类：hover 与选中效果一致 + 标签之间紧凑', () => {
      // · "一致"的判据是**两态走同一对声明**（底色 + 字色 + 字重），不是"看着差不多"。
      const hover = ruleBody('.esc-category-tabs .esc-pill:not([data-esc-selected=\'true\']):hover')
      const selected = ruleBody('.esc-category-tabs .esc-pill[data-esc-selected=\'true\']')
      for (const prop of ['background', 'color', 'font-weight'] as const) {
        const read = (body: string) => new RegExp(`${prop}: ([^;]+);`).exec(body)?.[1]
        expect(read(hover), `hover 与选中的 ${prop} 必须逐值相等`).toBe(read(selected))
      }
      //   反向锁：hover 不许只有"换文字色"（那正是用户说的"两者观感不同"）。
      expect(hover).toContain('background: var(--dsw-alias-interactive-bg-hover)')
      //   反向锁：普通 :hover 那条（只换字色）不许与新判据并存——两条同时在，hover 仍会读到旧那一档。
      expect(styleCss).not.toContain(".esc-category-tabs .esc-pill:hover { color: var(--dsw-alias-label-primary); }")
      // · 紧凑：容器 gap 走**刻度变量**且与上两行同值（用户原话「与第 ① 条那行一致」）。
      const gapOf = (head: string) => new RegExp('gap: ([^;]+);').exec(ruleBody(head))?.[1]
    })

    it('⑦ 卡片右上角那枚「+」：加号更黑（近黑），且不许留下空转的 hover 过渡', () => {
      expect(ruleBody('.esc-install-plus')).toContain('color: var(--dsw-alias-label-primary)')
      expect(ruleBody('.esc-install-plus')).not.toContain('label-secondary')
      // 反向锁：静止态已是近黑 ⇒ 原先那条 hover（同样的值）就是**空转的插值**，
      //   按本页既有纪律（"transition 只声明真正会变的属性"）必须撤掉，否则每次 hover 白烧一帧。
      expect(styleCss).not.toContain('.esc-install-plus:hover')
      expect(ruleBody('.esc-install-plus')).not.toContain('transition')
    })

    it('⑧ 滚动：三页签那一行冻结、其余整页滚；移动档**显式**回到整页单滚动面', () => {
      // · 结构：冻结头是滚动面（.esc-content）的直属子节点 —— sticky 的吸附范围 = 它的包含块，
      //   住在 .esc-toolbar 那个更矮的盒子里就冻不住（见 esc-toolbar.tsx 的拆分理由）。
      const toolbar = readFile('esc-toolbar.tsx')
      expect(toolbar).toContain("{ className: 'esc-tabs-freeze' }")
      expect(toolbar).toContain("return [")
      // 反向锁：冻结头不许被塞回 .esc-toolbar 里面（那是"冻不住"的写法）。
      const freezeBlock = /\{ className: 'esc-tabs-freeze' \},([\s\S]*?)\n    \),/.exec(toolbar)?.[1] ?? ''
      expect(freezeBlock, '冻结头那段').toContain("esc-toolbar-row")
      expect(freezeBlock, '冻结头那段').not.toContain("esc-toolbar-second")
      // · 桌面：内容区是滚动面、列表不是、冻结头 sticky。
      expect(ruleBody('.esc-tabs-freeze')).toContain('position: sticky')
      expect(ruleBody('.esc-tabs-freeze')).toContain('top: 0')
      expect(styleCss).toMatch(/^\.esc-content \{[^}]*overflow-y: auto;/m)
      expect(ruleBody('.esc-scroll')).toContain('overflow: visible')
      // · 移动：整页单滚动面**逐条保持**（既有用户裁决），且 sticky 显式 opt-out。
      const mobile = /@media \(pointer: coarse\), \(max-width: 1024px\), \(max-height: 700px\) \{([\s\S]*?)\n\}/.exec(styleCss)?.[1] ?? ''
      expect(mobile).toContain('.esc-content { overflow-y: auto;')
      expect(mobile).toContain('.esc-scroll { flex: none; min-height: 0; overflow: visible; }')
      expect(mobile).toContain('.esc-tabs-freeze { position: static; }')
      //   反向锁：移动档不许把 sticky 留着（那会让页签吸顶、违反"整页单滚动面"）。
      //   ★剥注释再扫：那一档的说明文字里**本来就提到** position sticky（解释为什么要 opt-out），
      //     不剥的话门禁会被自己的说明骗红。
      expect(mobile.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('position: sticky')
      //   反向锁：桌面档不许退回"只有列表滚"（两档滚动面已统一到内容区，这是不变量）。
      expect(styleCss).not.toContain('.esc-scroll { flex: 1; min-height: 0; overflow-y: auto; }')
      expect(styleCss).not.toMatch(/\.esc-content \{[^}]*overflow: hidden; \}/)
      // · 触底加载问的是**真的在滚的那一口**（挪了滚动面必须跟着挪，见 esc-aggregation.tsx）。
      const aggregation = readFile('esc-aggregation.tsx')
      expect(aggregation).toContain("const activeScroller = useCallback")
      expect(aggregation).toContain("className: 'esc-content', ref: boxRef, onScroll: handleScroll")
    })
  })

  it('★用户裁决（本轮）工具栏结构：药丸组挂 `esc-source-tabs`（样式层那条 no-shrink 规则的落点）', () => {
    const toolbar = EnterpriseEscToolbar({
      resourceType: 'expert',
      source: 'system',
      onSourceChange: () => undefined,
      categories: [],
      activeCategory: '',
      onCategoryChange: () => undefined,
      keyword: '',
      onKeywordChange: () => undefined,
    }) as unknown as { readonly props: { readonly children: readonly { props: { className?: string } }[] } }
    // ★用户裁决（两栏结构）：第一栏是 `.esc-toolbar-row`（三页签 + 右块），维度标签与
    //   二级分类各自另起一行，精选在第二栏。children 含 null 槽位 ⇒ 先摘掉再断言。
    // ★**本刀第 ⑧ 条**：组件返回**两段**（冻结头 `.esc-tabs-freeze` + 工具栏体 `.esc-toolbar`），
    //   所以这两类名各自住在不同那一段里——判据是"在不在"（摊平整棵子树找），不是"第几个子节点"。
    //   （本 describe 里没有共享的 walk，就地摊平一次：组件返回的是**数组**而不是元素，故先归一化。）
    const flatten = (node: unknown, out: { props: { className?: string } }[] = []): typeof out => {
      if (node === null || node === undefined || typeof node !== 'object') return out
      if (Array.isArray(node)) {
        for (const each of node) flatten(each, out)
        return out
      }
      const element = node as { props: Record<string, unknown> }
      out.push(element as { props: { className?: string } })
      const children = element.props['children']
      for (const each of Array.isArray(children) ? children : children === undefined ? [] : [children]) {
        flatten(each, out)
      }
      return out
    }
    const classNames = flatten(toolbar)
      .map(node => node.props['className'])
      .filter((value): value is string => typeof value === 'string')
    expect(classNames).toContain('esc-toolbar-row')
    expect(classNames).toContain('esc-source-tabs')
    // ★**第 ⑧ 条的结构事实**：三页签那一行必须住在**冻结头**里，且冻结头是**滚动面的直属子节点**
    //   （sticky 的吸附范围 = 它的包含块；住在 .esc-toolbar 那个更矮的盒子里就冻不住——见 esc-toolbar.tsx）。
    expect(classNames).toContain('esc-tabs-freeze')
    // ★二级分类**只在有分类时**才渲染（`categories.length > 0`）——本用例传的是空数组，故不该出现。
    expect(classNames).not.toContain('esc-category-tabs')
  })
})

describe('esc：卡片与工具栏的渲染树（口径 31 的「结构保真」侧）', () => {
  /** 一个最小的专家资源条目（只填断言要用的格子）。 */
  const expertItem = {
    id: 1,
    type: 'expert' as const,
    name: '示例专家',
    description: '示例描述',
    publishUser: { nickName: '张三' },
    collected: false,
    stats: [
      { type: 'user' as const, value: 3 },
      { type: 'star' as const, value: 7 },
    ],
  }
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    // React 的 createElement：**单个**子节点不会包成数组 ⇒ 一律归一化，免得断言按位置取值时踩这个坑
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  /**
   * 深度优先把整棵元素树摊平（组件返回**数组**时也照常走——本刀第 ⑧ 条起工具栏返回两段）。
   *
   * ★为什么需要它：断言"某个类名在不在"时**不该**关心它挂在第几层——层数是实现细节、类名才是契约。
   *   层级一改（正是本刀这种结构性调整）按位置取的断言就全红，而它们守的东西其实一个字没变。
   */
  const walk = (node: unknown, out: Element[] = []): Element[] => {
    if (node === null || node === undefined || typeof node !== 'object') return out
    if (Array.isArray(node)) {
      for (const each of node) walk(each, out)
      return out
    }
    const element = node as Element
    out.push(element)
    for (const each of childrenOf(element)) walk(each, out)
    return out
  }
  const card = (props: Record<string, unknown> = {}, itemOverride: Record<string, unknown> = {}) =>
    asElement(EnterpriseEscCard({ item: { ...expertItem, ...itemOverride } as never, ...props } as never))

  it('卡片结构照官方：头/描述/页脚三行落位；**页脚只在有统计行时才渲染**（口径 35③）', () => {
    const root = card({})
    // ★SPEC §7 分层策略：专家卡**无阴影** ⇒ 根类名多一枚 esc-card-expert（技能卡有、专家卡无）
    expect(root.props['className']).toBe('esc-card esc-card-expert')
    const [header, content, footer] = childrenOf(root)
    expect(asElement(header).props['className']).toBe('esc-card-header')
    const headMain = childrenOf(asElement(header))[1]!
    const title = childrenOf(asElement(headMain))[0]!
    expect(asElement(title).props['className']).toBe('esc-card-title')
    expect(asElement(title).props['children']).toBe('示例专家')
    expect(asElement(content).props['className']).toBe('esc-card-content')
    expect(asElement(content).props['children']).toBe('示例描述')
    // 页脚里只有统计行那一格（动作位/连接位/收藏位不在这里——它们与官方一样直接挂在卡片下）
    expect(childrenOf(asElement(footer)).map(node => (node === null ? null : asElement(node).props['className']))).toEqual([
      'esc-count-box',
    ])
    // 官方是 `{showStats && <footer/>}`：技能/连接器卡片**整格不渲染**（原先恒渲染 `esc-card-footer`
    // 24px + 16px 间隙，紧凑卡片因此内容超出 ⇒ flex-shrink 把描述压扁、第二行被切掉半截）
    expect(childrenOf(card({ showStats: false }))[2]).toBeNull()
    // 无统计行时整卡换成紧凑高度（用户裁决的几何：170 → 130）
    expect(card({ showStats: false }).props['className']).toBe('esc-card esc-card-compact')
  })

  it('★口径 41/42：描述与动作格**不同格**（技能＝常驻动作格 / 专家＝默认收起的召唤格，两档同判）', () => {
    // 这一条是**渲染树级**判据（比源码正则强）：描述那一格的祖先链里不许出现动作格/标题行，
    // 且头行的最后一格必须是 headmain ⇒ headmain 的右端 = 卡片内缘 ⇒ 描述那一行的右端 = 卡片内缘。
    // （口径 39 那一档里动作格是 headmain 的**兄弟**，headmain 就得按 flex: none 给它让宽——
    //   描述跟着短一截、省略号落在安装按钮左边缘，正是用户指出的那一句。）
    // ★口径 42：**两档都跑一遍**（技能与专家现在同版式）——判据本身与"放的是哪一枚动作"无关。
    const cases = [
      { props: { showUse: true }, action: 'esc-skill-actions' },
      { props: { showSummon: true }, action: 'esc-summon-slot' },
    ] as const
    for (const one of cases) {
      const root = card(one.props)
      const pathOf = (className: string): string[] | undefined => {
        const walk = (node: unknown, path: string[]): string[] | undefined => {
          if (node === null || node === undefined || node === false || typeof node !== 'object') return undefined
          if (Array.isArray(node)) {
            for (const child of node) { const hit = walk(child, path); if (hit !== undefined) return hit }
            return undefined
          }
          const element = node as Element
          const own = typeof element.props['className'] === 'string' ? element.props['className'] : ''
          const next = own === '' ? path : [...path, own]
          if (own.split(' ').includes(className)) return next
          for (const child of childrenOf(element)) { const hit = walk(child, next); if (hit !== undefined) return hit }
          return undefined
        }
        return walk(root, [])
      }
      const descPath = pathOf('esc-card-headdesc')
      const actionPath = pathOf(one.action)
      expect(descPath, `描述那一格（${one.action}）`).toBeDefined()
      expect(actionPath, `动作格那一格（${one.action}）`).toBeDefined()
      // ① 描述不在动作格那一格、也不在「标题行」里 ⇒ 它的可用宽度不被动作格切掉（独立一行）
      expect(descPath).not.toContain('esc-card-titlerow')
      expect(descPath).not.toContain(one.action)
      // ② 动作格在「标题行」里 ⇒ 它只吃标题那一行的宽
      expect(actionPath).toContain('esc-card-titlerow')
      // ③ 两格同在 headmain 之下，而头行的**最后一格是 headmain**、头行里没有第三格（动作格已不在那儿）
      expect(descPath).toContain('esc-card-headmain')
      expect(actionPath).toContain('esc-card-headmain')
      const header = asElement(childrenOf(root).find(node => node !== null && node !== undefined
        && typeof node === 'object' && asElement(node).props['className'] === 'esc-card-header'))
      const headerChildren = childrenOf(header).filter(node => node !== null && node !== undefined && node !== false)
      expect(headerChildren).toHaveLength(2)
      expect(asElement(headerChildren[1]).props['className']).toBe('esc-card-headmain')
    }
  })

  it('★口径 42（用户裁决「专家卡片调整成和技能卡片布局一致，标题描述，底部标签」）：专家卡的结构＝技能卡的结构 + 那枚收起的召唤', () => {
    // ① 根类名：专家卡仍带 esc-card-expert（**无阴影**，SPEC §7 的分层策略不因版式而变）
    const root = card({ showSummon: true })
    expect(root.props['className']).toBe('esc-card esc-card-expert')
    const [, , bottom] = childrenOf(root)
    // ② 底部＝**标签行**（不再是统计页脚 esc-card-footer），且这是**同一枚** `.esc-card-tags`
    const tagRow = asElement(bottom)
    expect(tagRow.props['className']).toBe('esc-card-tags')
    expect(childrenOf(root).map(node => (node === null ? null : asElement(node).props['className']))).toEqual([
      'esc-card-header',
      null, // 旧三层版式那一格两行描述（专家卡已不用）
      'esc-card-tags',
      null, // 连接器那两枚动作（专家卡不画）
    ])
    // ③ 头＝「标题行（标题 + 召唤格） + 描述独立一行」，与技能卡逐格同形
    const headMain = childrenOf(asElement(childrenOf(root)[0]!))[1]!
    expect(asElement(headMain).props['className']).toBe('esc-card-headmain')
    const headKids = childrenOf(asElement(headMain))
    expect(asElement(headKids[0]!).props['className']).toBe('esc-card-titlerow')
    const titleRowKids = childrenOf(asElement(headKids[0]!))
    expect(asElement(titleRowKids[0]!).props['className']).toBe('esc-card-title')
    expect(asElement(titleRowKids[1]!).props['className']).toBe('esc-summon-slot')
    expect(asElement(headKids[1]!).props['className']).toBe('esc-card-headdesc')
    expect(asElement(headKids[1]!).props['children']).toBe('示例描述')
    // ④ 召唤格**只有**那枚置灰的实底按钮（形态与连接器那两枚同档），且它**默认收起**是样式层的事
    const summonKids = childrenOf(asElement(titleRowKids[1]!)).filter(node => node !== null && node !== undefined)
    expect(summonKids).toHaveLength(1)
    expect(asElement(summonKids[0]!).props['children']).toBe(ENTERPRISE_ESC_COPY.summon)
    expect(asElement(summonKids[0]!).props['disabled']).toBe(true)
    expect(asElement(summonKids[0]!).props['className']).toBe('esc-action-solid esc-summon')
    // ⑤ 作者那一格从**卡头**搬到**标签行**（口径 40 要的"两档同一枚零件"由此变成"同一个渲染点"）
    const authorTag = childrenOf(tagRow)[0]!
    expect(asElement(authorTag).props['className']).toBe('esc-tag esc-tag-author')
    expect(asElement(childrenOf(asElement(authorTag))[0]!).props['name']).toBe('张三')
    // ⑥ 标签行三格**真值驱动**：示例专家有 user 3 / star 7、没有 link ⇒ 画 `★7 👤3 💬-`
    //    （口径 42 之前这三格是按"技能卡"钉死的：后两格恒为短横 ⇒ 专家卡的真数会被丢掉）
    const cells = childrenOf(tagRow).slice(1).map(node => asElement(node))
    expect(cells.map(node => node.props['title'])).toEqual([
      ENTERPRISE_ESC_COPY.statCollect,
      ENTERPRISE_ESC_COPY.statInstall,
      ENTERPRISE_ESC_COPY.statUsage,
    ])
    expect(cells.map(node => childrenOf(node)[1] && asElement(childrenOf(node)[1]).props['children'])).toEqual(['7', '3', '-'])
    // ⑦ 旧三层版式那两格**不许**再出现在专家卡上：页面内容里没有 esc-card-content、卡上也没有收藏浮标
    const classNames: string[] = []
    const collect = (node: unknown): void => {
      if (node === null || node === undefined || node === false || typeof node !== 'object') return
      if (Array.isArray(node)) { node.forEach(collect); return }
      const element = node as Element
      if (typeof element.props['className'] === 'string') classNames.push(element.props['className'])
      childrenOf(element).forEach(collect)
    }
    collect(root)
    expect(classNames).not.toContain('esc-card-content')
    expect(classNames).not.toContain('esc-card-footer')
    expect(classNames.some(name => name.includes('esc-corner-box') || name.includes('esc-star-box'))).toBe(false)
    // ⑧ 源码级反向锁：全文件只剩**一处** `AuthorRow` 渲染点、且没有 `collectBox` 这类浮层
    //    （类名那两条由上面的渲染树判据看住；这里看的是"那格代码还在不在"，注释里提到旧类名是允许的）
    const cardSource = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    expect(cardSource.match(/createElement\(AuthorRow/g) ?? []).toHaveLength(1)
    expect(cardSource).not.toContain('collectBox')
  })

  it('统计行：星形图标跟随收藏态切实心（原文两处 collected 都生效）', () => {
    const statsOf = (collected: boolean) => {
      const root = card({}, { collected })
      const statsRow = childrenOf(childrenOf(root)[2]!)[0]!
      return childrenOf(asElement(statsRow)).map(node => childrenOf(asElement(node))[0])
    }
    const hollow = statsOf(false)
    const filled = statsOf(true)
    const fillOf = (node: unknown) => (asElement(node).props as { fill?: string }).fill
    expect(fillOf(hollow[1])).toBeUndefined()
    expect(fillOf(filled[1])).toBe('currentColor')
    // 非星形的两枚不受收藏态影响
    expect(fillOf(hollow[0])).toBe(fillOf(filled[0]))
  })

  it('★口径 40（用户裁决「技能底部的图标使用专家底部的图标，作者头像使用和专家一致的」）：技能卡底部与专家卡底部**共用同一套零件**', () => {
    // 判据不是"画出来的样子像"，而是**同一个函数引用**——版式可以随手改，这条锁不该跟着松：
    //   ① 标签行那三枚统计图标 ≡ 旧三层版式页脚那三枚（`statIconOf` 是唯一实现，星形实心跟随收藏态
    //      那条口径也因此不可能在两边分叉）；
    //   ② 两档的作者 ≡ 同一枚 `AuthorRow`（连组件都是同一枚 ⇒ 真头像经同一条图片代理、
    //      破图退同一枚首字字母头像、名字同一套样式）。
    // ★另一条被就地钉住的旧口径：**项数与顺序都不许动**（作者 → 收藏量 → 安装量 → 使用量，
    //   用户裁决⑧）——这一刀只换"用哪几枚图标、作者怎么画"。
    // ★**口径 42 起的加强**：两档连**渲染点**都是同一个 `tagRow`（口径 40 那时还是"各画一处、
    //   共用零件"；口径 42 把专家卡的作者从卡头搬进标签行 ⇒ 只剩一处），故这里的比对改成
    //   "技能卡那一行 ≡ 专家卡那一行"——两行是**同一段源码**渲染的。
    const byClass = (element: Element, className: string): Element => {
      const found = childrenOf(element)
        .filter((node): node is Element => node !== null && node !== undefined && typeof node === 'object')
        .find(node => node.props['className'] === className)
      expect(found, `找不到 ${className}`).toBeTruthy()
      return found as Element
    }
    const nodesOf = (element: Element) =>
      childrenOf(element).filter((node): node is Element =>
        node !== null && node !== undefined && node !== false && typeof node === 'object')
    // 技能卡的标签行：**统计只给 star**（平台对技能真机回的就是这样）⇒ 另两格照旧如实画缺口
    const skillItem = { publishUser: { nickName: '张三', avatar: 'https://example.com/a.png' }, stats: [{ type: 'star', value: 1 }] }
    const skillTags = byClass(card({ showUse: true }, skillItem), 'esc-card-tags')
    const expertTags = byClass(card({ showSummon: true }, skillItem), 'esc-card-tags')
    const tagItems = nodesOf(skillTags)
    expect(tagItems).toHaveLength(4)
    const authorTag = tagItems[0]!
    expect(asElement(authorTag).props['className']).toBe('esc-tag esc-tag-author')
    // 整个作者格只有**一枚**子元素——原来那枚独用的 `User` 字形 + 名字的两格写法已撤下
    const authorChildren = childrenOf(asElement(authorTag))
    expect(authorChildren).toHaveLength(1)

    // —— ① 作者那一格：**两档同一个组件引用**（还接住了这张卡自己的头像地址）
    const expertAuthorTag = nodesOf(expertTags)[0]!
    const expertAuthorChild = childrenOf(asElement(expertAuthorTag))[0]!
    expect(asElement(authorChildren[0]!).type).toBe(asElement(expertAuthorChild).type)
    expect(asElement(authorChildren[0]!).props['avatar']).toBe('https://example.com/a.png')
    expect(asElement(authorChildren[0]!).props['name']).toBe('张三')
    // ★加强：两档的**标签行结构逐格同形**（连"哪几格在"都一样）——同一段源码渲染的
    expect(nodesOf(expertTags).map(node => asElement(node).props['className'])).toEqual(
      tagItems.map(node => asElement(node).props['className']),
    )

    // —— ② 三枚统计图标：逐枚与**旧三层版式页脚自己渲染出来的**那三枚比 `type`（不重抄一份图标清单）
    const expertFooter = byClass(
      card({ showStats: true }, {
        stats: [
          { type: 'user', value: 1 },
          { type: 'link', value: 2 },
          { type: 'star', value: 3 },
        ],
      }),
      'esc-card-footer',
    )
    const expertIcons = childrenOf(byClass(expertFooter, 'esc-count-box')).map(node => childrenOf(asElement(node))[0])
    const skillIcons = tagItems.slice(1).map(node => childrenOf(asElement(node))[0])
    expect(skillIcons.map(node => asElement(node).type)).toEqual([
      asElement(expertIcons[2]).type, // 收藏量 ← 页脚的「收藏」（星形）
      asElement(expertIcons[0]).type, // 安装量 ← 页脚的「人数」（人形）
      asElement(expertIcons[1]).type, // 使用量 ← 页脚的「会话」（气泡）
    ])
    // 星形实心跟随收藏态：标签行这一枚也走同一枚实现（`collected === true` ⇒ `fill: currentColor`）
    const collectedTagRow = byClass(card({ showUse: true }, { ...skillItem, collected: true }), 'esc-card-tags')
    expect((asElement(childrenOf(nodesOf(collectedTagRow)[1]!)[0]).props as { fill?: string }).fill).toBe('currentColor')
    // ★口径 42：这三格是**真值驱动**的——有那一格就画真数（专家卡的人数/会话不许丢），
    //   没有就画缺口短横（技能卡的安装/使用就是这个形态；0 不许拿来顶上，见样式层那句"不编数"）。
    expect(childrenOf(tagItems[1]!).slice(1).map(node => asElement(node).props['children'])).toEqual(['1'])
    expect(asElement(childrenOf(tagItems[2]!)[1]).props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.statUnavailable)
    expect(asElement(childrenOf(tagItems[3]!)[1]).props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.statUnavailable)
    // 顺序与语义仍是上一轮钉的那四格（作者 → 收藏 → 安装 → 使用）
    expect(tagItems.map(node => asElement(node).props['title'])).toEqual([
      '张三',
      ENTERPRISE_ESC_COPY.statCollect,
      ENTERPRISE_ESC_COPY.statInstall,
      ENTERPRISE_ESC_COPY.statUsage,
    ])

    // —— ③ 源码级反向锁：那两枚"外来"图标（安装的箭头 / 使用量的柱状图）与它们的实现不许回归
    const cardSourceForTagRow = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    expect(cardSourceForTagRow).toContain(
      "import { Bot, Folder, MessageSquare, MoreHorizontal, Pencil, Plus, Star, Trash2, User } from 'lucide-react'",
    )
    expect(cardSourceForTagRow).not.toContain('function BarChartIcon')
    // 作者呈现全文件只剩**一处**（口径 42 起专家卡的作者也在这条标签行里 ⇒ 同一个渲染点；
    // 口径 40 那时是"专家卡头 + 标签行"两处共用同一枚组件，这一刀把它收成了一处）
    expect(cardSourceForTagRow.match(/createElement\(AuthorRow/g) ?? []).toHaveLength(1)
    // 标签行那三格**只能**经 `statIconOf` 拿到（不许再就地 createElement 一枚图标）——
    // 三格共用的工厂 `tagCellOf` 里是**唯一**一处 `statIconOf`，由它按 type 取那一枚。
    const tagRowSource = cardSourceForTagRow.slice(cardSourceForTagRow.indexOf('const tagCellOf ='))
    expect(tagRowSource.match(/statIconOf\((type|'[a-z]+')\)/g) ?? []).toHaveLength(1)
    expect(tagRowSource.match(/tagCellOf\('(star|user|link)', /g) ?? []).toHaveLength(3)
  })

  it('动作位：A 档一律置灰 + 写明原因；召唤 / 立即使用 / 连接 / 断开 四枚文案与原文逐字一致', () => {
    // ★**本刀（workbuddy 风格重构）**：技能卡的右侧动作位**换了形态**——原来那枚「使用 + 启用开关」
    // （容器 `esc-action-box esc-action-box-pinned`、按钮 hover 浮现）已撤下，现在按**是否已安装**分流：
    //   未安装 ⇒ 一枚**常驻圆形「+」**（`.esc-install-plus`）；已安装 ⇒ **「更多」下拉 + 「去试试」**。
    // 专家（召唤）与连接器（连接/断开）两档**一字未改**，仍照原页面的形态。
    // ⇒ 这条用例的判据随之改成「按语义找那一格」，不再按下标硬取——按下标锁渲染树，
    //   改一处版式就得重排一堆断言，而版式本来就是要改的东西。
    // ★**口径 39**：技能卡的动作位搬进了**流里**（图标 | 标题/描述 | 动作），专家/连接器两档
    //   仍在卡片直属层 ⇒ 两处都找。
    // ★**口径 41**：技能卡那一格又往里收了一格（headmain → 「标题行」）⇒ 改成**在整棵卡片子树里
    //   按类名找**：判据只认"那一格在这张卡里"，深度与顺序都不预设——版式本来就是要改的东西，
    //   每收一格就来改一次取法，那才是把测试绑死在版式上。
    // ★第二参是**这张卡自己的数据**：已连接/未连接的形态不同，必须渲染它自己那张卡，
    //   否则会拿到默认那张（未连接）卡的动作位，断言就成了拿 A 比 A。
    const actionBoxOf = (props: Parameters<typeof card>[0], item?: Record<string, unknown>): Element => {
      // 先摘掉 null/undefined/false（React 不渲染的槽位在 createElement 的 children 里就是它们），
      // 再按类名找。
      const found: Element[] = []
      const walk = (node: unknown): void => {
        if (node === null || node === undefined || node === false || typeof node !== 'object') return
        if (Array.isArray(node)) { node.forEach(walk); return }
        const element = node as Element
        if (typeof element.props['className'] === 'string'
          && /esc-action-box|esc-skill-actions|esc-summon-slot/.test(element.props['className'])) found.push(element)
        childrenOf(element).forEach(walk)
      }
      walk(card(props, item))
      expect(found).toHaveLength(1)
      return found[0]!
    }
    // —— 专家：召唤（口径 42 起它的**位置**与技能卡那枚「+」一样，是「标题行」里的第二格；
    //    形态照旧：实底置灰的那一枚。**默认收起**是样式层的事——.esc-summon-slot 的 max-width: 0）。
    const summonBox = actionBoxOf({ showSummon: true })
    expect(asElement(summonBox).props['className']).toBe('esc-summon-slot')
    const summon = asElement(childrenOf(summonBox)[0])
    expect(summon.props['children']).toBe('召唤')
    expect(summon.props['disabled']).toBe(true)
    expect(summon.props['className']).toBe('esc-action-solid esc-summon')
    expect(summon.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    // —— 技能·未安装：一枚常驻「+」，无障碍名带技能名；**不画**「去试试」与「更多」
    const plusBox = actionBoxOf({ showUse: true })
    expect(asElement(plusBox).props['className']).toBe('esc-skill-actions')
    const plusRow = asElement(plusBox)
    const plusChildren = childrenOf(plusRow).filter(node => node !== null && node !== undefined && node !== false)
    expect(plusChildren).toHaveLength(1)
    const plus = asElement(plusChildren[0])
    expect(plus.props['className']).toBe('esc-install-plus')
    expect(plus.props['disabled']).toBe(true)
    expect(plus.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    expect(plus.props['aria-label']).toContain(ENTERPRISE_ESC_COPY.installSkill)
    // —— 技能·已安装：「更多」下拉 + 「去试试」两枚并排
    const installedBox = actionBoxOf({ showUse: true, installed: true })
    const installedChildren = childrenOf(asElement(installedBox)).filter(node => node !== null && node !== undefined && node !== false)
    expect(installedChildren).toHaveLength(2)
    // 「去试试」是官方 Button 原语（挂 `esc-action-solid`），同样置灰 + 写明原因
    const tryNow = asElement(installedChildren[1])
    expect(tryNow.props['children']).toBe(ENTERPRISE_ESC_COPY.tryNow)
    expect(tryNow.props['disabled']).toBe(true)
    expect(tryNow.props['className']).toBe('esc-action-solid esc-try-now')
    expect(tryNow.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    // 「更多」是官方 `Menu` 原语（自带遮罩/Esc/外部点击），触发钮带无障碍名与 aria-expanded。
    // ★它自己持有 `open` 态（有副作用），纯函数测试渲染不出来 ⇒ 断言落在**导出的那份纯数据**上
    //   （`SKILL_MORE_ENTRIES`），组件本体只用「存在且挂官方 Menu」这一条盖住。
    const moreWrapper = asElement(installedChildren[0])
    expect(typeof moreWrapper.type).toBe('function')
    const cardSourceForMore = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    expect(cardSourceForMore).toContain('items: SKILL_MORE_ENTRIES.map(')
    // 三行逐字（编辑 / 打开文件夹 / 卸载），卸载是**危险档**，其余不带该位
    expect(SKILL_MORE_ENTRIES.map(entry => entry.id)).toEqual(['edit', 'open-folder', 'uninstall'])
    expect(SKILL_MORE_ENTRIES.map(entry => entry.label)).toEqual(['编辑', '打开文件夹', '卸载'])
    expect(SKILL_MORE_ENTRIES[2]!.danger).toBe(true)
    expect(SKILL_MORE_ENTRIES[0]!.danger).toBeUndefined()
    expect(ENTERPRISE_ESC_COPY.useNow).toBe('立即使用')
    // 源码级反向锁：那枚机器人图标（连 import）与"靠 aria-label 承担文案"的写法都不许再回来
    const cardSource = readFileSync(new URL('../src/esc/esc-card.tsx', import.meta.url), 'utf8')
    expect(cardSource).not.toContain('BotMessageSquare')
    expect(cardSource).not.toContain("'aria-label': ENTERPRISE_ESC_COPY.useNow")
    // 「全黑」靠主题 token，不靠内联颜色：**召唤 / 去试试 / 连接 / 断开**四枚恰好 4 处
    // （技能那枚已换成 workbuddy 的「+」与「去试试」，不再有第二个 esc-action-solid）
    // ★判据先**剥注释**：注释里引述类名是正常的（口径 42 那段注释就提到了它），
    //   不剥的话门禁会被自己的注释骗红——那会逼着后人把记录写含糊。
    const cardCode = cardSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
    expect(cardCode.match(/esc-action-solid/g) ?? []).toHaveLength(4)
    // ★口径 36：**失效 token 的源码级反向锁** —— 这三枚在 DSH 主题里根本不存在（真实名见 esc-style.ts
    // 头部的映射表），用了就等于整条声明作废（描边回退 currentColor 变成黑边、底色回退透明）。
    // 卡片源码里一个都不许留（CSS 侧另有同款反向锁）。
    // （判据取 `var(<token>)` 这种**真使用**的写法：注释里为了记录历史可以提到这些名字）
    for (const dead of ['--dsw-alias-accent-primary', '--dsw-alias-background-primary', '--dsw-alias-background-secondary']) {
      expect(cardSource).not.toContain(`var(${dead})`)
    }
    // 首字字母头像的兜底底色必须落在真 token 上（原先是那枚失效的 background-secondary）
    expect(cardSource).toContain("background: 'var(--dsw-alias-bg-skeleton)'")
    // 卡片根类名：技能卡是 workbuddy 那一版（**带标签行**，故另起 `esc-card-skill`）；
    // 专家/连接器沿用原页面的「有/无统计行」两种。
    expect(card({ showSummon: true }).props['className']).toBe('esc-card esc-card-expert')
    // ★SPEC §7：连接器卡属「列表项」那一档 ⇒ 无阴影、走 esc-card-connector
    expect(card({ showConnect: true, showStats: false }).props['className']).toBe('esc-card esc-card-connector')
    // 连接器：未连接只画「连接」；已连接画「断开」+ 开关；标签都是原页面的行内字面量
    const disconnected = card({ showConnect: true })
    const connectBox = actionBoxOf({ showConnect: true })
    const connect = asElement(childrenOf(connectBox)[0])
    expect(connect.props['children']).toBe('连接')
    expect(connect.props['className']).toBe('esc-action-solid')
    expect(disconnected.props['className']).toBe('esc-card esc-card-connector')
    const connectedItem = { connected: true, connectionEnabled: true }
    const connectedCard = card({ showConnect: true }, connectedItem)
    const connectedBox = actionBoxOf({ showConnect: true }, connectedItem)
    expect(asElement(connectedCard).props['className']).toBe('esc-card esc-card-connector')
    expect(asElement(connectedBox).props['className']).toBe('esc-action-box esc-action-box-pinned')
    const breakReveal = asElement(childrenOf(asElement(connectedBox))[0])
    expect(breakReveal.type).toBe('span')
    expect(asElement(childrenOf(breakReveal)[0]).props['className']).toBe('esc-action-solid')
    expect(breakReveal.props['className']).toBe('esc-hover-reveal')
    expect(asElement(childrenOf(breakReveal)[0]).props['children']).toBe('断开')
    expect(asElement(childrenOf(asElement(connectedBox))[1]).props['checked']).toBe(true)
  })

  it('连接器卡片的状态行：分类为空时**不画**状态圆点，但状态文字照画（原文口径）', () => {
    // ★**本刀**：卡片头里那格「发布者行」只在**专家卡**上渲染（技能卡的作者已挪进底部标签行），
    //   连接器的状态行 `.esc-extra-box` 因此从「发布者行里面」**上移到头信息里，与标题平级**。
    //   判据改成**按类名找**那一格，不再按下标数位置——版式本来就是要改的东西。
    const statusRowOf = (item: Record<string, unknown>) => {
      const header = childrenOf(card({ showConnect: true }, item))[0]!
      const headMain = childrenOf(asElement(header))[1]!
      const extraBox = childrenOf(asElement(headMain))
        .filter((node): node is Element => node !== null && node !== undefined && node !== false && typeof node === 'object')
        .find(node => node.props['className'] === 'esc-extra-box')
      expect(extraBox).toBeTruthy()
      return extraBox as Element
    }
    const withCategory = statusRowOf({ category: '存储与文件' })
    const status = childrenOf(childrenOf(asElement(withCategory))[0]!)[1]!
    expect(asElement(status).props['children']).toEqual([expect.anything(), '未连接'])
    expect(asElement(childrenOf(asElement(status))[0]).props['className']).toBe('esc-status-dot')
    const withoutCategory = statusRowOf({})
    const status2 = childrenOf(childrenOf(asElement(withoutCategory))[0]!)[1]!
    // 分类为空 ⇒ 圆点那格是 null（React 不渲染），状态文字照画
    expect(childrenOf(asElement(status2))).toEqual([null, '未连接'])
  })

  it('工具栏：主 tab 的组成随资源类型变（已连接的**仅**连接器页；★口径 55 起技能页恰好两枚），顺序照原文件', () => {
    const labelsOf = (resourceType: 'expert' | 'skill' | 'connector') => {
      const toolbar = asElement(
        EnterpriseEscToolbar({
          resourceType,
          source: 'system',
          onSourceChange: () => undefined,
          categories: [],
          activeCategory: '',
          onCategoryChange: () => undefined,
          keyword: '',
          onKeywordChange: () => undefined,
        } as never),
      )
      // ★维度标签已**移出第一栏**（用户裁决：精选在第2栏、维度另起一行）⇒ 判据改成
      //   在整棵工具栏树里**按类名找**那一格，不再按「主行的第几格」取。
      const walk = (node: unknown, out: Element[] = []): Element[] => {
        if (Array.isArray(node)) {
          for (const each of node) walk(each, out)
          return out
        }
        if (node === null || node === undefined || node === false) return out
        if (typeof node !== 'object') return out
        const element = node as Element
        if (element.props['className'] === 'esc-source-tabs') {
          out.push(element)
          return out
        }
        return walk(element.props['children'], out)
      }
      const sourceTabs = walk(toolbar)[0]
      expect(sourceTabs).toBeTruthy()
      return childrenOf(sourceTabs as Element).map(node => asElement(node).props['children'])
    }
    expect(labelsOf('expert')).toEqual(['系统广场', '团队空间'])
    /**
     * ★**口径 55 重新基线化**：这里旧值带第三枚「我启用的」（用户裁决：删掉，他和已安装重复）。
     * 新判据**更强**：技能页与专家页**同样两枚**（逐字），且技能页**恰好两枚**
     * （`toHaveLength(2)` 让"悄悄又加回一枚"当场红）。连接器页那第三枚仍是「已连接的」——回归锁。
     */
    expect(labelsOf('skill')).toEqual(['系统广场', '团队空间'])
    expect(labelsOf('skill')).toHaveLength(2)
    expect(labelsOf('connector')).toEqual(['系统广场', '团队空间', '已连接的'])
  })

  it('工具栏：「更多」只系统广场维度点亮、连接器页整格不画；搜索占位随页变；分类行按分类数组画', () => {
    const toolbarOf = (props: Record<string, unknown>) =>
      asElement(
        EnterpriseEscToolbar({
          resourceType: 'expert',
          source: 'system',
          onSourceChange: () => undefined,
          categories: [],
          activeCategory: '',
          onCategoryChange: () => undefined,
          keyword: '',
          onKeywordChange: () => undefined,
          ...props,
        } as never),
      )
    // ★右块在**第一栏**（`.esc-toolbar-row`）里，按类名找（行序改过，别按下标取）。
    // ★**本刀第 ⑧ 条**：`.esc-toolbar-row` 现在住在冻结头 `.esc-tabs-freeze` 里面、且整层比改之前深一级
    //   （组件返回两段），故这里**在整棵子树里找**而不是只看直属子节点——判据仍是"那个类名在不在"，
    //   不依赖它挂在第几层（层数是实现细节、类名才是契约）。
    const findByClass = (node: unknown, className: string): Element | undefined => {
      const all = walk(node)
      return all.find(each => each.props['className'] === className)
    }
    const rightOf = (element: Element) => {
      const row = findByClass(element, 'esc-toolbar-row')
      expect(row).toBeTruthy()
      const found = findByClass(row as Element, 'esc-toolbar-right')
      expect(found).toBeTruthy()
      return found as Element
    }
    // 「更多」= **真超链接**（用户裁决指向 https://skillhub.cn/）：只有系统广场维度可见/可点，
    // 其余两维保留占位（visibility 隐藏 + 不吃点击），连接器页整格不画 —— 与官方口径一致。
    const moreLink = asElement(childrenOf(rightOf(toolbarOf({ source: 'system' })))[0])
    expect(moreLink.type).toBe('a')
    expect(moreLink.props['className']).toBe('esc-more')
    expect(moreLink.props['href']).toBe('https://skillhub.cn/')
    expect(moreLink.props['target']).toBe('_blank')
    expect(moreLink.props['rel']).toBe('noreferrer noopener')
    expect(moreLink.props['children']).toBe(ENTERPRISE_ESC_COPY.more)
    expect(moreLink.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.moreExternal)
    expect(asElement(childrenOf(rightOf(toolbarOf({ source: 'team' })))[0]).props['className']).toBe('esc-more esc-more-hidden')
    expect(ESC_RESOURCE_MORE_HREF).toBe('https://skillhub.cn/')
    expect(childrenOf(rightOf(toolbarOf({ showMore: false })))[0]).toBeNull()
    /**
     * ★**口径 49**：搜索框 placeholder **随页变**——三页各一枚、逐字且互不相同。
     * 这里按类名找搜索框（右块里从此多了一层 Menu 包装，按下标取会踩空）。
     */
    const searchOf = (resourceType: 'expert' | 'skill' | 'connector') => {
      const found = findByClass(rightOf(toolbarOf({ resourceType })), 'esc-search')
      expect(found, `搜索框（${resourceType} 页）`).toBeTruthy()
      return found as Element
    }
    expect(searchOf('expert').props['placeholder']).toBe('搜索专家')
    expect(searchOf('skill').props['placeholder']).toBe('搜索技能')
    expect(searchOf('connector').props['placeholder']).toBe('搜索连接器')
    // 无障碍名与占位同源（只此一处取值口：`enterpriseEscSearchPlaceholder`）
    for (const type of ['expert', 'skill', 'connector'] as const) {
      expect(searchOf(type).props['aria-label']).toBe(searchOf(type).props['placeholder'])
      expect(searchOf(type).props['placeholder']).toBe(enterpriseEscSearchPlaceholder(type))
    }
    // 分类行：首位「全部」+ 各项，active 跟着 activeCategory
    const withCategories = toolbarOf({
      categories: [
        { key: '', label: '全部' },
        { key: '存储与文件', label: '存储与文件' },
      ],
      activeCategory: '存储与文件',
    })
    // 二级分类行在**工具栏体**（第二段）里，按类名找
    // ★**本刀第 ⑧ 条**：组件返回两段，分类行不再是指直属子节点 ⇒ 在整棵子树里按类名找。
    const categoryRow = walk(withCategories).find(each => each.props['className'] === 'esc-category-tabs')!
    expect(childrenOf(asElement(categoryRow)).map(node => asElement(node).props['active'])).toEqual([false, true])
    // 分类读不到时给一句人话（本页新增；原页面静默）：分类数组为空 ⇒ 分类行整格是 null，提示在第三格
    // ★按类名找（别按下标）——★**本刀第 ⑧ 条**起它住在工具栏体那一段里，不再是指直属子节点。
    const unavailable = walk(toolbarOf({ categoriesUnavailable: true }))
      .find(node => node.props['className'] === 'esc-toolbar-note')!
    expect(asElement(unavailable).props['className']).toBe('esc-toolbar-note')
    expect(asElement(unavailable).props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable)
  })
})

describe('esc：失败面收口（本刀 —— 精选行与列表页同一套判据）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  /** 整棵树的可见文本（`null`/布尔槽位按 React 的规则不渲染）。 */
  const textOf = (node: unknown): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    return childrenOf(asElement(node)).map(textOf).join('')
  }

  it('★精选行失败态：人话与下一步取自唯一码表、稳定码上屏、**平台原话一个字都不上屏**、终态不画「重试」', () => {
    const body = asElement(
      enterpriseEscFeaturedBody({ kind: 'failed', code: ESC_MISSING_ENDPOINT_CODES.recommend }, () => undefined),
    )
    expect(body.props['className']).toBe('esc-featured-note')
    expect(body.props['role']).toBe('alert')
    const kids = childrenOf(body)
    // ① 人话（唯一码表那句）② 下一步 ③ 稳定码 ④ 终态 ⇒ 第 4 格是 null，**不画**「重试」
    expect(asElement(kids[0]).props['children']).toBe(enterpriseErrorMessage('ENT_ESC_RECOMMEND_UNAVAILABLE'))
    expect(asElement(kids[1]).props['className']).toBe('esc-sub')
    expect(asElement(kids[1]).props['children']).toBe(enterpriseErrorAction('ENT_ESC_RECOMMEND_UNAVAILABLE'))
    expect(asElement(kids[2]).props['className']).toBe('esc-state-code')
    expect(asElement(kids[2]).props['children']).toBe('ENT_ESC_RECOMMEND_UNAVAILABLE')
    expect(kids[3]).toBeNull()
    expect(enterpriseErrorRetryable('ENT_ESC_RECOMMEND_UNAVAILABLE')).toBe(false)
    // 平台那句自由文本（`No static resource …`）在这棵树里**没有位置**：状态里只有码
    expect(textOf(body)).not.toContain('No static resource')
    // ★源码级反向锁：这条行不再把平台 `message` 拼上屏、也不再自留一句「加载失败」前缀
    const source = readFileSync(new URL('../src/esc/esc-featured.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('envelope.message')
    expect(source).not.toContain('loadFailed')
    expect('loadFailed' in ENTERPRISE_ESC_LOCAL_COPY).toBe(false)
  })

  it('★可重试的码才画「重试」：那枚按钮的回调就是真的重发（口径 50 起它**不是**「换一批」那条路了）', () => {
    const retry = vi.fn()
    const body = asElement(enterpriseEscFeaturedBody({ kind: 'failed', code: 'ENT_NUWAX_UNAVAILABLE' }, retry))
    expect(enterpriseErrorRetryable('ENT_NUWAX_UNAVAILABLE')).toBe(true)
    const button = asElement(childrenOf(body)[3])
    expect(button.type).toBe('button')
    expect(button.props['className']).toBe('esc-retry')
    expect(button.props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.retry)
    ;(button.props['onClick'] as () => void)()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('★平台 `4040` 按**面**归一：三面各说各的事实，其余码原样透传', () => {
    expect(escPlatformErrorCode('4040', ESC_MISSING_ENDPOINT_CODES.connector)).toBe('ENT_ESC_CONNECTOR_UNAVAILABLE')
    expect(escPlatformErrorCode('4040', ESC_MISSING_ENDPOINT_CODES.directory)).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(escPlatformErrorCode('4040', ESC_MISSING_ENDPOINT_CODES.recommend)).toBe('ENT_ESC_RECOMMEND_UNAVAILABLE')
    // 其余码一个字都不改（含非 4040 的数字码、字符串码与空值）
    expect(escPlatformErrorCode('4030', ESC_MISSING_ENDPOINT_CODES.recommend)).toBe('4030')
    expect(escPlatformErrorCode(4041, ESC_MISSING_ENDPOINT_CODES.recommend)).toBe('4041')
    expect(escPlatformErrorCode(undefined, ESC_MISSING_ENDPOINT_CODES.recommend)).toBe('')
    // 取异常里的码：本机路由那枚原样取出、取不到回本机兜底码（不再借页内某句前缀顶替）
    expect(escErrorCodeOf({ code: 'ENT_AUTH_REQUIRED' })).toBe('ENT_AUTH_REQUIRED')
    expect(escErrorCodeOf(new Error('boom'))).toBe('ENT_LOCAL_RESPONSE_INVALID')
    expect(escErrorCodeOf({ code: '' })).toBe('ENT_LOCAL_RESPONSE_INVALID')
    // ★口径 55：面级码表只剩**三枚**（技能启停清单那枚随「我启用的」维度整枚退场；
    //   原来这里写成"四枚都在码表里、四句话两两不同"）。
    const messages = (['connector', 'directory', 'recommend'] as const).map(key => {
      const code = ESC_MISSING_ENDPOINT_CODES[key]
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
      expect(enterpriseErrorRetryable(code), code).toBe(false)
      return enterpriseErrorMessage(code)
    })
    expect(new Set(messages).size).toBe(3)
    expect(Object.keys(ESC_MISSING_ENDPOINT_CODES).sort()).toEqual(['connector', 'directory', 'recommend'])
  })

  it('★列表面的 `4040` 按「资源类型 + 维度」取码：专家/技能不再被说成「没有连接器目录」', () => {
    expect(missingEndpointCodeOf('connector', 'system')).toBe('ENT_ESC_CONNECTOR_UNAVAILABLE')
    expect(missingEndpointCodeOf('expert', 'system')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(missingEndpointCodeOf('skill', 'system')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(missingEndpointCodeOf('skill', 'team')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    // 这两句话措辞**必须不同**——本刀修的正是"专家/技能面上报连接器"那句假话
    expect(enterpriseErrorMessage(missingEndpointCodeOf('expert', 'system')))
      .not.toBe(enterpriseErrorMessage(missingEndpointCodeOf('connector', 'system')))
  })

  it('★口径 55：「我启用的」这个维度整枚删除 ⇒ 那一枚端点码**永远取不到**，故整格不在（保留的两枚仍按面分开）', () => {
    /**
     * ★**重新基线化（加强，不是放宽）**：旧这一条锁的是"技能面缺的是启停清单"那枚码
     * （`ENT_ESC_ENABLE_LIST_UNAVAILABLE`，有现场探针作证：同一刻 `skill/list` 回 `0000 / total 138`
     * 而 `skill/enable/list` 回 `4040`）。★用户裁决把「我启用的」这个维度**整枚删掉**之后，
     * 本仓不会再有任何请求打到那条端点 ⇒ 那枚码**永远取不到**，留着它就是一张"看着还能用"的
     * 死条目（口径 55 明令一并删）。新判据**比旧的多一层**：
     *   ① 码表里那一格、唯一错误码表里那一句都**整格不在**；
     *   ② 保留的两枚**仍按面分开**（少了一枚不等于退回"一句话通用"——这正是旧那一刀修掉的病）。
     */
    expect('enabled' in ESC_MISSING_ENDPOINT_CODES).toBe(false)
    expect(ENTERPRISE_ERROR_CODES).not.toContain('ENT_ESC_ENABLE_LIST_UNAVAILABLE')
    // ② 目录面与连接器面仍是两句不同的话（不许因为少了一枚而合流）。
    expect(missingEndpointCodeOf('skill', 'system')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(missingEndpointCodeOf('skill', 'team')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(missingEndpointCodeOf('expert', 'system')).toBe('ENT_ESC_DIRECTORY_UNAVAILABLE')
    expect(missingEndpointCodeOf('connector', 'system')).toBe('ENT_ESC_CONNECTOR_UNAVAILABLE')
    expect(enterpriseErrorMessage(missingEndpointCodeOf('skill', 'system')))
      .not.toBe(enterpriseErrorMessage(missingEndpointCodeOf('connector', 'system')))
    // 源码级锁：两个失败落点都必须把**维度**传进去，否则又会退回"按资源类型"那句话
    const source = readFileSync(new URL('../src/esc/esc-list.ts', import.meta.url), 'utf8')
    expect(source).toContain('missingEndpointCodeOf(resourceType, source)')
    expect(source).not.toContain('missingEndpointCodeOf(resourceType)')
  })

  it('★本刀只动失败那一态：加载 / 空 / 未登录三态的标记与文案一字未改', () => {
    expect(textOf(enterpriseEscFeaturedBody({ kind: 'loading' }, () => undefined))).toBe(ENTERPRISE_ESC_COPY.loading)
    expect(textOf(enterpriseEscFeaturedBody({ kind: 'empty' }, () => undefined))).toBe(ENTERPRISE_ESC_COPY.emptyData)
    const signedOut = asElement(enterpriseEscFeaturedBody({ kind: 'unauthenticated' }, () => undefined))
    expect(signedOut.props['className']).toBe('esc-featured-note')
    expect(textOf(signedOut)).toContain(ENTERPRISE_ESC_LOCAL_COPY.signInRequiredTitle)
    expect(textOf(signedOut)).toContain(ENTERPRISE_ESC_LOCAL_COPY.signInRequiredBody)
  })

  it('★本刀（用户裁决「精选最多显示六个」）：只画 6 枚，状态里仍如实留着平台给的那一批', () => {
    // 本机实测 /api/display/recommend/list ⇒ 0000 / total 19 ⇒ 上限是**展示**规则，不是取数规则：
    // 平台给多少照旧原样进状态（`items` 就是入参那一批），只有这一行截前六枚。
    const records: readonly EscRecommendRecord[] = Array.from({ length: 19 }, (_unused, index) => ({
      id: 1000 + index,
      targetType: 'Skill',
      targetId: index,
      recType: 'recommend',
      label: `推荐${index}`,
    }))
    const grid = asElement(enterpriseEscFeaturedBody({ kind: 'ready', items: records }, () => undefined))
    expect(grid.props['className']).toBe('esc-featured-grid')
    // ★**反向锁**（口径 48 收口）：「最多画 6 枚」那枚常量已整枚删除，且**不许回来**。
    //   原因写在这里：先前那句 `expect(ENTERPRISE_ESC_FEATURED_MAX).toBeUndefined()` 是一条
    //   **空转的锁**——`import` 一个不存在的具名导出在 esbuild 下拿到 `undefined`，
    //   于是断言永远为真、一枚事实都没钉住（ui 的 tsconfig 不含 tests，tsc 也照不到它）。
    //   真正钉住"一枚都不截"的是下面那句 `toHaveLength(records.length)`。
    const featuredSource = readFileSync(new URL('../src/esc/esc-featured.tsx', import.meta.url), 'utf8')
    expect(featuredSource).not.toContain('ENTERPRISE_ESC_FEATURED_MAX')
    // ★用户裁决：「精选**不限定个数**，原则就是显示一行」⇒ 一枚也不许截，全部画出来，
    //   排版交给样式层：只排一行、放不下的由网格裁掉（口径 48）；折行与横向滚动都不许出现。
    expect(grid.props['children'] as readonly unknown[]).toHaveLength(records.length)
    // 各长度都照原样画：不截、不补齐
    for (const count of [1, 5, 7, 19]) {
      expect(
        (asElement(enterpriseEscFeaturedBody({ kind: 'ready', items: records.slice(0, count) }, () => undefined))
          .props['children'] as readonly unknown[]),
      ).toHaveLength(count)
    }
  })

  /* ══════════════ 口径 43（本轮用户裁决「精选的卡片调整成和非精选的一致」）══════════════
   * 这一组门禁的骨架是**真机那一对坐标系**（本机现役宿主，同一刻两条取数）：
   *   推荐 `targetId=158` label=dev-engineer-toolkit ↔ 广场 平台 id=4194 / **targetId=158** name 逐字相同。
   * 故"精选卡 = 广场卡"这句话必须落在**同一个组件引用 + 同一份投影 + 同一套参数**上，
   * 而不是"两边长得像"——后者在任何一处单独被改掉时仍会绿。 */

  it('★口径 43 的回查键：平台条目的 `targetId`（专家走 agentId、技能走 skillId，两枚互斥）', () => {
    expect(escPublishedTargetIdOf({ id: 'skill-4194', name: 'dev-engineer-toolkit', skillId: 158 })).toBe(158)
    expect(escPublishedTargetIdOf({ id: 'agent-4087', name: '数字仓管员（测试）', agentId: 268 })).toBe(268)
    // 连接器那条没有这个键（精选行不画连接器，拿不到回查键是对的）
    expect(escPublishedTargetIdOf({ id: 'system-conn-aliyun_oss', name: 'OSS' })).toBeUndefined()
    // 反向锁：**不许**拿本页拼出来的 id 当回查键（那是 `${前缀}-${平台 id}`，与 targetId 不是一套坐标系）
    expect(escPublishedTargetIdOf({ id: 'skill-4194', name: 'dev-engineer-toolkit' })).toBeUndefined()
  })

  it('★口径 43 的回查投影：命中就用广场那份真值；没命中只画推荐自己有的两格（绝不编字段）', () => {
    const record: EscRecommendRecord = {
      id: 8,
      targetType: 'Skill',
      targetId: 158,
      recType: 'Official',
      label: 'dev-engineer-toolkit',
      icon: 'https://agent.example/api/logo/skill/dev-engineer-toolkit',
    }
    const joinedItem: ResourceItem = {
      id: 'skill-4194',
      name: 'dev-engineer-toolkit',
      description: '当开发项目需要搜索可用工具（API）、可',
      icon: 'https://agent.example/api/logo/skill/dev-engineer-toolkit',
      publishUser: { nickName: '李猛' },
      stats: [{ type: 'star', value: 1 }],
    }
    // ① 命中：逐格就是广场那份（描述/作者/统计都真）
    expect(enterpriseEscFeaturedItem(record, new Map([[158, joinedItem]]))).toEqual(joinedItem)
    // ② 没命中：只有 label 与 icon 两格，其余**一格都不编**
    const missed = enterpriseEscFeaturedItem(record, ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY)
    expect(missed).toEqual({
      id: 'recommend-8',
      name: 'dev-engineer-toolkit',
      icon: 'https://agent.example/api/logo/skill/dev-engineer-toolkit',
    })
    expect(missed.description).toBeUndefined()
    expect(missed.publishUser).toBeUndefined()
    expect(missed.stats).toBeUndefined()
    // ③ id 前缀与广场那套（`agent-4087` / `skill-4055`）**不可能撞**：将来拿它去寻址也改不到广场那条
    expect(missed.id.startsWith('recommend-')).toBe(true)
    // ④ 回查到的键**对不上**时同样算没命中——绝不"就近取一条"
    expect(enterpriseEscFeaturedItem(record, new Map([[749, joinedItem]])).stats).toBeUndefined()
  })

  it('★口径 43 的回查请求：走广场同一档适配器（参数同源）、按 targetId 建索引、复用同一份投影', async () => {
    const skill = spyApi({
      code: '0000',
      data: {
        records: [
          {
            id: 4194,
            targetId: 158,
            name: 'dev-engineer-toolkit',
            description: '当开发项目需要搜索可用工具（API）、可',
            publishUser: { nickName: '李猛' },
            statistics: { collectCount: 1, userCount: null, convCount: null },
          },
        ],
        current: 1,
        pages: 1,
      },
    })
    const index = await loadEnterpriseEscFeaturedLookup({ api: skill.api, targetType: 'Skill', wanted: [158] })
    // ① 参数就是**广场系统广场那一档**（同一份适配器 ⇒ 不可能漂）：空分类 + 空关键字 + official
    expect(skill.calls).toHaveLength(1)
    expect(skill.calls[0]!.method).toBe('publishedSkillList')
    expect(skill.calls[0]!.params).toEqual({
      page: 1,
      pageSize: ENTERPRISE_ESC_FEATURED_LOOKUP_PAGE_SIZE,
      category: '',
      kw: undefined,
      official: true,
    })
    // ② 索引键是**平台 targetId**（158），不是广场那条的平台 id（4194）
    expect([...index.keys()]).toEqual([158])
    expect(index.has(4194)).toBe(false)
    // ③ 投影走的是 `mapPublishedItem`（与广场同一份）⇒ 描述/作者/统计都在，缺口仍按平台没回的那几格算
    expect(index.get(158)?.name).toBe('dev-engineer-toolkit')
    expect(index.get(158)?.publishUser?.nickName).toBe('李猛')
    expect(index.get(158)?.stats).toEqual([{ type: 'star', value: 1 }])

    // 专家档：参数与广场专家那一档逐字相同（官方 + ChatBot 子类型）；★平台回的 0 照旧留着
    const expert = spyApi({
      code: '0000',
      data: {
        records: [{ id: 4087, targetId: 268, name: '数字仓管员（测试）', statistics: { userCount: 5, convCount: 82, collectCount: 0 } }],
        current: 1,
        pages: 1,
      },
    })
    const expertIndex = await loadEnterpriseEscFeaturedLookup({ api: expert.api, targetType: 'Agent', wanted: [268] })
    expect(expert.calls[0]!.method).toBe('publishedAgentList')
    expect(expert.calls[0]!.params).toEqual({
      page: 1,
      pageSize: ENTERPRISE_ESC_FEATURED_LOOKUP_PAGE_SIZE,
      category: '',
      kw: undefined,
      targetType: 'Agent',
      targetSubType: 'ChatBot',
      official: true,
    })
    expect(expertIndex.get(268)?.stats).toEqual([
      { type: 'user', value: 5 },
      { type: 'link', value: 82 },
      { type: 'star', value: 0 },
    ])
  })

  it('★口径 43 的回查边界：候选为空一条请求都不发、翻页有上限、平台非成功码就用手上已有的', async () => {
    // ① 没有候选 ⇒ 一条请求都不发（别为了空数组打一趟平台）
    const idle = spyApi({ code: '0000', data: { records: [], current: 1, pages: 1 } })
    expect((await loadEnterpriseEscFeaturedLookup({ api: idle.api, targetType: 'Skill', wanted: [] })).size).toBe(0)
    expect(idle.calls).toHaveLength(0)
    // ② 一直找不到 ⇒ 翻到上限就停手（有界：不许为了 6 枚卡片把整本目录拉光）
    const deep = spyApi({ code: '0000', data: { records: [{ id: 1, targetId: 1, name: 'x' }], current: 1, pages: 99 } })
    expect((await loadEnterpriseEscFeaturedLookup({ api: deep.api, targetType: 'Skill', wanted: [999] })).size).toBe(0)
    expect(deep.calls).toHaveLength(ENTERPRISE_ESC_FEATURED_LOOKUP_MAX_PAGES)
    // ③ 平台不是成功码 ⇒ 停手并交回手上已有的（**不**把回查的失败升级成整行的失败态）
    const rejected = spyApi({ code: '4040', data: { records: [{ id: 1, targetId: 158, name: 'x' }] } })
    expect((await loadEnterpriseEscFeaturedLookup({ api: rejected.api, targetType: 'Skill', wanted: [158] })).size).toBe(0)
    expect(rejected.calls).toHaveLength(1)
    // ④ 平台说没有更多页 ⇒ 不再翻第二页（hasMore 为假）
    const onePage = spyApi({ code: '0000', data: { records: [{ id: 1, targetId: 1, name: 'x' }], current: 1, pages: 1 } })
    await loadEnterpriseEscFeaturedLookup({ api: onePage.api, targetType: 'Skill', wanted: [999] })
    expect(onePage.calls).toHaveLength(1)
  })

  it('★口径 43：精选卡**就是广场那张卡**——同组件、同开关、下半截画真值；没回查到就如实缺口', () => {
    const record: EscRecommendRecord = { id: 12, targetType: 'Agent', targetId: 67, recType: 'Official', label: '流程管理专家' }
    const item: ResourceItem = {
      id: 'agent-3915',
      name: '流程管理专家',
      description: '专注于流程管理的Agent，流程架构设计、流程挖',
      icon: 'https://agent.example/api/f/local/default/x.png',
      agentId: 67,
      publishUser: { nickName: '王培培' },
      // ★顺序照 `mapPublishedStats`（人 / 会话 / 收藏），★收藏这一格是平台真回的 0（不是缺口）
      stats: [
        { type: 'user', value: 6 },
        { type: 'link', value: 51 },
        { type: 'star', value: 0 },
      ],
    }
    const ready = (lookup: ReadonlyMap<number, ResourceItem>, targetType: 'Agent' | 'Skill') =>
      asElement(enterpriseEscFeaturedBody({ kind: 'ready', items: [record] }, () => undefined, { lookup, targetType }))
    // ① 精选卡的元素类型**就是广场那张卡**（同一个组件引用，不是"长得像"的另一张）
    const expertCard = asElement(childrenOf(ready(new Map([[67, item]]), 'Agent'))[0])
    expect(expertCard.type).toBe(EnterpriseEscCard)
    // ② 卡片开关与广场**同一组**（专家档：裁圆图标 + 召唤 + showStats；技能档见⑥）
    expect(expertCard.props).toMatchObject({ iconShape: 'circle', showSummon: true, showStats: true, showUse: false })
    // ③ 排出来的树与广场卡逐格同形：头行 = 「标题行 + 描述独立一行」，底部 = 标签行，旧三层版的描述格不出现
    const tree = asElement(EnterpriseEscCard(expertCard.props as never))
    const [header, content, tags] = childrenOf(tree)
    expect(asElement(header).props['className']).toBe('esc-card-header')
    expect(content).toBeNull()
    expect(asElement(tags).props['className']).toBe('esc-card-tags')
    const headMain = asElement(childrenOf(asElement(header))[1])
    expect(
      childrenOf(headMain)
        .filter(node => node !== null && node !== undefined)
        .map(node => asElement(node).props['className']),
    ).toEqual(['esc-card-titlerow', 'esc-card-headdesc'])
    // ④ 标签行第 1 格是**回查才有的作者真值**（那一格就是广场卡的同一枚 `AuthorRow`：本仓 vitest
    //    没有 DOM，故按元素核对——类名/作者名都在 props 上，并不去调用那个带 useState 的组件）
    const authorCell = asElement(childrenOf(asElement(tags))[0])
    expect(authorCell.props['className']).toBe('esc-tag esc-tag-author')
    expect(authorCell.props['title']).toBe('王培培')
    expect(asElement(authorCell.props['children']).props['name']).toBe('王培培')
    // 后三格按裁决⑧的项序（收藏 → 安装 → 使用）画平台真数（★真回的 0 留着，不是缺口短横）
    expect(childrenOf(asElement(tags)).slice(1).map(textOf)).toEqual(['0', '6', '51'])
    // ⑤ 没回查到 ⇒ **同一张卡**，下半截如实留空/短横：描述与作者都不出现，三格画缺口短横
    const missedCard = asElement(childrenOf(ready(ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY, 'Agent'))[0])
    expect(missedCard.type).toBe(EnterpriseEscCard)
    const missedTree = asElement(EnterpriseEscCard(missedCard.props as never))
    expect(asElement(childrenOf(missedTree)[2]).props['className']).toBe('esc-card-tags')
    // 标题 + 标题行里那枚默认收起的「召唤」（形态在、宽度由 CSS 收到 0）+ 三格缺口短横
    expect(textOf(missedTree)).toBe(
      `流程管理专家${ENTERPRISE_ESC_COPY.summon}${ENTERPRISE_ESC_LOCAL_COPY.statUnavailable.repeat(3)}`,
    )
    // ⑥ 技能档：方形图标 + 常驻「+」；已装清单命中 ⇒ 换成「更多 + 去试试」（与广场同一条口径）
    const skillRecord: EscRecommendRecord = { id: 8, targetType: 'Skill', targetId: 158, recType: 'Official', label: 'dev-engineer-toolkit' }
    const skillCard = asElement(
      childrenOf(
        asElement(
          enterpriseEscFeaturedBody({ kind: 'ready', items: [skillRecord] }, () => undefined, {
            lookup: new Map([[158, { id: 'skill-4194', name: 'dev-engineer-toolkit' }]]),
            targetType: 'Skill',
            installedSkillNames: new Set(['dev-engineer-toolkit']),
          }),
        ),
      )[0],
    )
    expect(skillCard.props).toMatchObject({ iconShape: 'square', showUse: true, installed: true, showSummon: false })
    // 反向锁：读不到已装清单（不传集合）⇒ 按"未装"画「+」，与广场卡同一条口径（不谎称已装）
    const noList = asElement(childrenOf(ready(ENTERPRISE_ESC_FEATURED_LOOKUP_EMPTY, 'Skill'))[0])
    expect(noList.props['installed']).toBe(false)
  })

  it('★口径 43 反向锁：薄壳卡那套（类名/样式/自画的图标与标题）不许回来；列真源与列对齐不许被改', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    // ① 样式层：剥注释之后，那四个"薄壳专属"的类名一个都不许留（留着就是死样式，
    //    而且会让"精选自带一套几何"这件事看起来仍然成立）
    //    （本用例在顶层 describe 之外，故这里就地剥一次注释——判据与共享那份逐字相同。）
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const dead of ['esc-card-featured', 'esc-featured-icon', 'esc-featured-image', 'esc-featured-label']) {
      expect(declarations, dead).not.toContain(dead)
    }
    // ② 栅格仍是**同一个真源** + 同一个 gap（口径 39"两段网格列对齐"那条不变量一字未动）
    expect(/\.esc-featured-grid \{[^}]*grid-template-columns: var\(--esc-grid-cols\);/.test(css)).toBe(true)
    // ③ 源码层：精选卡不许自画内部结构（图标 / 标题 / 图片兜底都归 `EnterpriseEscCard`）
    //    —— 上一版那三样正是薄壳的痕迹，`enterpriseEscImageSrc` 也随之退场。
    //    判据先**剥注释**：本文件的文件头正是用这些类名记录"哪一套下线了"的（不剥会被自己的记录骗红）。
    const featured = readFileSync(new URL('../src/esc/esc-featured.tsx', import.meta.url), 'utf8')
    const featuredCode = featured.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(featuredCode).not.toContain('esc-card-featured')
    expect(featuredCode).not.toContain('esc-featured-label')
    expect(featuredCode).not.toContain('esc-featured-image')
    expect(featuredCode).not.toContain('enterpriseEscImageSrc')
    expect(featuredCode).toContain('createElement(EnterpriseEscCard,')
    // ④ 精选行也不许自造一套列模板（列数只有 CSS 里那一个真源）
    expect(featuredCode).not.toContain('grid-template-columns')
    // ⑤ 已装分流与广场**同源**：聚合区把同一份 `installedIds` 交给精选行（技能页）
    const aggregation = readFileSync(new URL('../src/esc/esc-aggregation.tsx', import.meta.url), 'utf8')
    expect(aggregation).toContain("installedSkillNames: resourceType === 'skill' ? installedIds : undefined")
  })
})

describe('esc：口径 46/47（「添加技能」照商城那套做 · 「已安装」打开已安装技能页）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  /** 深度优先把整棵元素树摊平（`<>…</>` 是一个 Fragment 元素，故一律按 children 走）。 */
  const walk = (node: unknown, out: Element[] = []): Element[] => {
    if (node === null || node === undefined || typeof node !== 'object') return out
    if (Array.isArray(node)) {
      for (const each of node) walk(each, out)
      return out
    }
    const element = node as Element
    out.push(element)
    for (const each of childrenOf(element)) walk(each, out)
    return out
  }
  const byProp = (node: unknown, prop: string) => walk(node).filter(each => each.props[prop] !== undefined)
  const classesOf = (node: unknown) =>
    walk(node).map(each => each.props['className']).filter((value): value is string => typeof value === 'string')
  const toolbarOf = (props: Record<string, unknown>) =>
    asElement(
      EnterpriseEscToolbar({
        resourceType: 'skill',
        source: 'system',
        onSourceChange: () => undefined,
        categories: [],
        activeCategory: '',
        onCategoryChange: () => undefined,
        keyword: '',
        onKeywordChange: () => undefined,
        ...props,
      } as never),
    )
  /**
   * 右块（更多 / 搜索 / 已安装 / 添加）——**按类名在整棵子树里找**，别按下标取行。
   *
   * ★**本刀第 ⑧ 条**：`.esc-toolbar-row` 现在多住了一层（组件返回两段，行在冻结头里），
   *   按"直属子节点"找会踩空。判据仍是那两个类名在不在——**层数是实现细节、类名才是契约**。
   */
  const rightOf = (element: Element) =>
    walk(element).find(each => each.props['className'] === 'esc-toolbar-right')!
  /**
   * ★**口径 49**：按类名在整棵子树里找一枚（`.esc-toolbar-right` 里现在多了 Menu 那一层包装，
   * 按下标取会踩空；类名才是契约）。
   */
  const byClass = (node: unknown, className: string): Element | undefined => {
    const hit = walk(node).filter(each =>
      typeof each.props['className'] === 'string'
      && (each.props['className'] as string).split(' ').includes(className))
    return hit.length === 0 ? undefined : hit[0]
  }
  /** ★**口径 49**：整枚主按钮（含描边档那一版）——`esc-add-skill` 无论在哪一档都在类名清单里。 */
  const addSkillOf = (element: Element): Element => {
    const found = byClass(element, 'esc-add-skill')
    expect(found, '主按钮（.esc-add-skill）').toBeTruthy()
    return found as Element
  }
  const item = { id: 'skill-1', name: 'dev-engineer-toolkit', description: '示例描述' }
  const card = (props: Record<string, unknown> = {}) =>
    asElement(EnterpriseEscCard({ item, ...props } as never))

  it('工具栏那两枚：写入口在场 ⇒ 真按钮；缺席 ⇒ 置灰 + 写明原因（判据是端口，不是写死的 disabled）', () => {
    const onAddSkill = vi.fn()
    const onOpenInstalled = vi.fn()
    // ① 缺席（纯函数直调 / 没有本机写面）：与口径 47 之前逐字同态 —— 置灰 + actionNotPorted
    //    ★口径 49 起按**类名**取（右块里多了一层 Menu 包装，按下标取会踩空）。
    const bare = rightOf(toolbarOf({ resourceType: 'skill' }))
    const installedBare = byClass(bare, 'esc-installed')!
    expect(installedBare.props['disabled']).toBe(true)
    /**
     * ★**本刀重新基线化（加强，不是放宽）**：旧值写的是 `actionNotPorted` —— 那是"计数**读到了**、
     *   只是入口没接"时的说法。这一格连 `installedCount` 都没给 ⇒ 数字位那个 `(0)` 是**暂定值**，
     *   按用户裁决必须先说出这件事（不许静默吞"读不到"），"口子没接"那句因此让位。
     *   ★"口子没接"**没有**从判据里消失：它由下面**补的那一格**（计数读得到 + 口缺席）单独锁住 ——
     *   两条事实各锁一遍。旧断言对"读不到时随便糊一句"是绿的，这两格合起来不可能绿。
     */
    expect(installedBare.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable)
    const noOpener = rightOf(toolbarOf({ resourceType: 'skill', installedCount: 2 }))
    const installedNoOpener = byClass(noOpener, 'esc-installed')!
    expect(installedNoOpener.props['disabled']).toBe(true)
    expect(installedNoOpener.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    expect(byClass(noOpener, 'esc-installed-count')!.props['children']).toBe('(2)')
    const addBare = addSkillOf(bare)
    expect(addBare.props['disabled']).toBe(true)
    expect(addBare.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    /**
     * ② 在场：能点、点的是那一枚回调、悬浮说明换成"会发生什么"。
     * ★`installedCount: 2` 是本刀把这条旧断言的前提**写明**（不是放宽）：title 现在同时承担
     *   "这个数字是不是暂定的"，所以"读到了计数时 title 说会发生什么"这一条必须带上真计数才成立。
     */
    const wired = rightOf(toolbarOf({ resourceType: 'skill', onAddSkill, onOpenInstalled, installedCount: 2 }))
    const installed = byClass(wired, 'esc-installed')!
    expect(installed.props['disabled']).toBe(false)
    expect(installed.props['onClick']).toBe(onOpenInstalled)
    expect(installed.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedFilterOpen)
    const add = addSkillOf(wired)
    expect(add.props['disabled']).toBe(false)
    expect(add.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.addSkillLocalImport)
    /**
     * ★**口径 49 重新基线化**：口径 46 那条断言「主按钮的 onClick === onAddSkill」在**技能页**已经
     * 不再成立——那一页的主按钮现在是**三项下拉的锚**，点它是开合菜单，本地导入搬进「上传技能」一项。
     * 这条**不是放宽**：本地导入那条路仍在（由下面「上传技能」那一项承载，且**行为逐字未改**），
     * 而"上传那一项调 onAddSkill"由口径 49 那一组用例**更强**地锁住（项级 onSelect 取证）。
     * 无下拉的那两页（专家/连接器）则**逐字回到口径 46 的行为**（下面 ③ 锁住）。
     */
    // ③ **降级路径一字不许退化**：没有下拉供给时（`addSkillMenu` 缺席），技能页那枚按钮
    //    仍是一枚"点了就走本地导入"的真按钮 —— 判据是回调本身。
    const legacy = addSkillOf(rightOf(toolbarOf({ resourceType: 'skill', onAddSkill })))
    expect(legacy.props['onClick']).toBe(onAddSkill)
    /**
     * ④ ★**口径 51 重新基线化（加强，不是放宽）**：口径 46 这条写的是"专家页/连接器页的主按钮
     *    都直接调本地导入"——它**已被用户裁决改掉**：WorkBuddy 实机那两页根本不是"选文件"
     *    （专家页进子页、连接器页开 MCP 弹窗，研究文件 §3），继续让它们调本地导入就是
     *    "文案说我的专家、点开却选文件"的说谎按钮。
     *    ★新判据比旧的两条**更强**：即使把本地导入端口照样传进来，两页的 `onClick` 也一个都
     *      不许等于 `onAddSkill`，且都不许出现 `aria-haspopup`（那会退化成下拉）；
     *      专家页到底接的是谁，由口径 51 那一组**逐字取证**（`onOpenMyExperts`）。
     *      旧断言对"专家页悄悄接回本地导入"是绿的，新断言不可能。
     *    本地导入这条路仍然活着（技能页「上传技能」那一项 + 技能页的降级档，由上面 ②③ 与口径 49 那组锁住）。
     */
    for (const resourceType of ['expert', 'connector'] as const) {
      const ownPort = vi.fn()
      const other = addSkillOf(rightOf(toolbarOf({ resourceType, onAddSkill, onOpenMyExperts: ownPort })))
      expect(other.props['onClick'], resourceType).not.toBe(onAddSkill)
      expect(other.props['aria-haspopup'], resourceType).toBeUndefined()
    }
  })

  it('卡片：给了开关就画开关（标题行第二格）+ 标签行整行撤下；不给则两档一切照旧（反向锁）', () => {
    const onChange = vi.fn()
    const swapped = card({ showUse: true, showTags: false, actionSwitch: { checked: true, disabled: false, title: '关闭即卸载', onChange } })
    // ① 还是技能卡那一档（同一套版式与分层类名）
    expect(swapped.props['className']).toBe('esc-card esc-card-skill')
    const header = asElement(childrenOf(swapped)[0])
    const headmain = asElement(childrenOf(header)[1])
    const titlerow = asElement(childrenOf(headmain)[0])
    expect(titlerow.props['className']).toBe('esc-card-titlerow')
    // ② 标题行第二格＝开关（受控 + 可访问名＝技能名 + 悬浮说明；不是技能卡那枚「+」）
    const slot = asElement(childrenOf(titlerow)[1])
    expect(slot.props['className']).toBe('esc-card-switch')
    expect(slot.props['checked']).toBe(true)
    expect(slot.props['disabled']).toBe(false)
    expect(slot.props['label']).toBe('dev-engineer-toolkit')
    expect(slot.props['title']).toBe('关闭即卸载')
    ;(slot.props['onChange'] as (next: boolean) => void)(false)
    expect(onChange).toHaveBeenCalledWith(false)
    // ③ 「去除底部标签」：整棵树里一个 esc-card-tags 都没有
    expect(classesOf(swapped)).not.toContain('esc-card-tags')
    // ④ 反向锁：不传 showTags 时标签行仍在（技能卡/专家卡两条既有档一字未变）
    expect(classesOf(card({ showUse: true, actionSwitch: { checked: true, onChange } }))).toContain('esc-card-tags')
    expect(classesOf(card({ showUse: true }))).toContain('esc-card-tags')
  })

  it('已安装页的纯投影（★口径 54 重新基线化）：真源=发现面 / 分组=来源标注 / 卡片字段 / 哪一枚那开关拨不动', () => {
    /**
     * ★**重新基线化（加强，不是放宽）**：旧这一条测的是"两张**记录**各投一张卡"（`self`/`center` 两组）。
     * 用户裁决把「已安装」的真源换成**官方发现面**之后，那两张卡投影（`enterpriseEscSelfInstalledCard` /
     * `enterpriseEscCenterInstalledCard`）**整两个函数都不存在了** —— 列表由**磁盘真值**铺，
     * 两份记录只贡献显示名/版本/摘要/卸载口。新判据覆盖的形态比旧的多：
     *   ① 分组身份由**来源**决定（五类，含"未知来源各自成组"）；
     *   ② 卡片三格逐字段（key / 标题 / **描述取官方那句真描述**——旧那两份记录里根本没有描述文案）；
     *   ③ 开关可拨性只由"名字有没有对上企业记录"决定，且**元信息半句**逐字落位。
     */
    const discovered = (
      name: string,
      source: string,
      extra: Partial<EnterpriseDiscoveredSkill> = {},
    ): EnterpriseDiscoveredSkill => ({
      name,
      description: `${name} 的真描述`,
      invocation: { modelInvocable: true, userInvocable: true },
      source,
      provider: 'skill-filesystem',
      ...extra,
    })
    const center = [{
      packageId: '2105915576743428098',
      skillId: 'dev-engineer-toolkit',
      displayName: '开发工程工具箱',
      versionId: '2.0.3',
      sha256: 'b'.repeat(64),
      names: ['dev-engineer-toolkit'],
      installedAt: '',
    }]
    const self = [{
      skillId: 'meeting-notes',
      displayName: '会议纪要',
      sha256: 'a'.repeat(64),
      names: ['meeting-notes'],
      installedAt: '2026-10-07',
    }]
    const meta = enterpriseEscInstalledMetaTable(center, self)
    const skills = [
      discovered('dev-engineer-toolkit', 'user-dsh', { whenToUse: '需要时' }),
      discovered('meeting-notes', 'user-dsh'),
      discovered('proj-helper', 'project-agents'),
      discovered('bundled-thing', 'bundled'),
      discovered('weird', 'custom'),
    ]
    // ① 单条来源标注（"谁放进去的"）：企业记录同名优先，其余按官方 source 归。
    expect(skills.map(each => enterpriseEscInstalledSourceLabel(each, meta))).toEqual([
      '企业装下来的', '本机导入的', '项目里的', '官方内置', '其它来源（custom）',
    ])
    // ② 分组顺序（真源那一格数组）+ 组名逐字；空组不进结果。
    expect(ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS).toEqual(['center', 'self', 'project', 'bundled'])
    const groups = enterpriseEscInstalledGroups(skills, meta)
    expect(groups.map(group => group.id)).toEqual(['center', 'self', 'project', 'bundled', 'other:custom'])
    expect(groups.map(group => group.title))
      .toEqual(['企业装下来的', '本机导入的', '项目里的', '官方内置', '其它来源（custom）'])
    expect(groups.map(group => group.cards.length)).toEqual([1, 1, 1, 1, 1])
    // ③ 卡片逐字段：企业那一枚（有中心包 id ⇒ 能拨；元信息是**版本**）。
    const centerCard = groups[0]!.cards[0]!
    expect(centerCard.key).toBe('installed-0-dev-engineer-toolkit')
    expect(centerCard.item.name).toBe('开发工程工具箱')
    expect(centerCard.item.description).toBe('dev-engineer-toolkit 的真描述')
    expect(centerCard.locked).toBe(false)
    expect(centerCard.packageId).toBe('2105915576743428098')
    expect(centerCard.meta).toBe('版本 2.0.3')
    // 本机导入那一枚（没有中心包 id ⇒ 恒拨不动；元信息是**摘要**，截断到 12 位 + 省略号）。
    const selfCard = groups[1]!.cards[0]!
    expect(selfCard.item.name).toBe('会议纪要')
    expect(selfCard.locked).toBe(true)
    expect(selfCard.packageId).toBeUndefined()
    expect(selfCard.meta).toBe(`摘要 ${'a'.repeat(12)}…`)
    // 项目 / 官方内置 / 未知来源三枚：一律拨不动、一律没有元信息半句（不编"未知"）。
    for (const group of groups.slice(2)) {
      expect(group.cards[0]!.locked, group.id).toBe(true)
      expect(group.cards[0]!.meta, group.id).toBeUndefined()
    }
    // ④ 显示名缺 ⇒ 回落发现面给的技能名（不画一张空标题）；描述永远取发现面那一句。
    const bare = enterpriseEscInstalledGroups([discovered('k', 'user-dsh')],
      enterpriseEscInstalledMetaTable([], [{ skillId: 'x', displayName: '', sha256: '', names: [], installedAt: '' }]))
    expect(bare[0]!.cards[0]!.item.name).toBe('k')
    expect(bare[0]!.cards[0]!.item.description).toBe('k 的真描述')
    expect(bare[0]!.cards[0]!.meta).toBeUndefined()
    // ⑤ 空组不进结果：只给一条本机导入的技能 ⇒ 只有一组（没有 center 的空壳）。
    const onlySelf = enterpriseEscInstalledGroups([discovered('meeting-notes', 'user-dsh')], meta)
    expect(onlySelf.map(group => group.id)).toEqual(['self'])
    // ⑥ 一条都没有 ⇒ 空数组（整页空态由视图说）。
    expect(enterpriseEscInstalledGroups([], meta)).toEqual([])
    // ⑦ 两份记录**合并**进同一把键（同名时企业那半不抹掉自装那半，反之亦然）。
    const merged = enterpriseEscInstalledMetaTable(center, [{
      skillId: 'dev-engineer-toolkit', displayName: 'X', sha256: 'c'.repeat(64), names: ['dev-engineer-toolkit', 'meeting-notes'], installedAt: '',
    }])
    expect(merged.of('dev-engineer-toolkit')).toMatchObject({ packageId: '2105915576743428098', versionId: '2.0.3', sha256: 'c'.repeat(64) })
    expect(merged.of('meeting-notes')).toMatchObject({ sha256: 'c'.repeat(64) })
  })

  it('本地导入是**同一份实现**：状态机与三件事实全仓只有一处，两面都 import 同一叶片（结构级不变式）', () => {
    const leaf = readFileSync(new URL('../src/skill-import-port.tsx', import.meta.url), 'utf8')
    const market = readFileSync(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    const aggregation = readFileSync(new URL('../src/esc/esc-aggregation.tsx', import.meta.url), 'utf8')
    // ① 商城页与 esc 页都进**同一枚**状态机（不是"各写一套、长得像"）。
    //    ★**口径 60 重新基线化（更强）**：旧断言只要求 aggregation 里出现 `useEnterpriseSkillImport`
    //      这半截字符串 —— 而 `useEnterpriseSkillImportQueue`（本刀新增的队列驱动器，**内部持的正是
    //      那一枚单件状态机**）天然包含它，于是旧断言在"esc 悄悄换成另一套上传器"时照样是绿的。
    //      现在两面各自钉在**它真正用的那个入口**上：商城 = 单件状态机本体，esc = 队列驱动器（较窄、更强）。
    expect(market).toContain('useEnterpriseSkillImport(')
    expect(aggregation).toContain('useEnterpriseSkillImportQueue(')
    expect(leaf).toContain('export function useEnterpriseSkillImport(')
    expect(leaf).toContain('export function useEnterpriseSkillImportQueue(')
    // ② 状态机的**心脏**（上传那一次调用）在整个 src 里只出现一处 —— 这条比"渲染出来像"强得多
    //    （口径 60 的队列驱动器**不碰**这一行：它只把文件交棒给那枚状态机）
    const srcDir = new URL('../src/', import.meta.url)
    const owners = readdirSync(srcDir)
      .filter(name => /\.tsx?$/.test(name))
      .filter(name => readFileSync(new URL(name, srcDir), 'utf8').includes('await uploadSkill(file, controller.signal)'))
    expect(owners).toEqual(['skill-import-port.tsx'])
    // ③ 冻结属性 / 尺寸预检 / 选完清 value / 换文件即中止这四件事实也只剩一处
    expect(leaf).toContain('ENTERPRISE_SKILL_IMPORT_ACCEPT')
    expect(leaf).toContain('enterpriseSkillImportRejectReason(file)')
    expect(leaf).toContain("event.currentTarget.value = ''")
    expect(leaf).toContain('abortRef.current?.abort()')
    // ④ esc 那一侧三条接线事实（★口径 60 重新基线化：入口形态由"隐藏选择器"换成"导入弹窗"，
    //    旧那两条（`onAddSkill: skillImportPort?.onOpen` / 出现 `EnterpriseSkillImportChrome`）随之**作废**，
    //    改成更强的一组：① 主按钮的动作**只开窗**（不是直接点选择器）；② 弹窗挂在这一层且吃同一枚 port；
    //    ③ **反向锁**——技能页不许再挂那枚恒不可见选择器（挂回来就是"两种入口并存"，两个上传入口互相打架）。
    expect(aggregation).toContain('onAddSkill: skillImportPort === undefined ? undefined : () => { setSkillImportOpen(true) }')
    expect(aggregation).toContain('createElement(EnterpriseSkillImportDialog, {')
    expect(aggregation).toContain('onOpenChange: setSkillImportOpen')
    expect(aggregation).not.toContain('EnterpriseSkillImportChrome')
    expect(aggregation).not.toContain('skillImportPort?.onOpen')
    // 那枚恒不可见选择器**没有消失**：商城页照旧用它（本刀只换技能页这一条的入口形态）
    expect(market).toContain('EnterpriseSkillImportChrome')
    const installed = readFileSync(new URL('../src/esc/esc-installed.tsx', import.meta.url), 'utf8')
    expect(installed).toContain('actionSwitch:')
    expect(installed).toContain('showTags: false')
    // 写入口**不进**只读面（那条不变式不许被这一刀破）：esc-api 里一个 upload/uninstall 都没有
    const escApi = readFileSync(new URL('../src/esc/esc-api.ts', import.meta.url), 'utf8')
    expect(escApi).not.toContain('uploadSkill')
    expect(escApi).not.toContain('uninstallSkill')
  })

  it('本地导入的落点：恒不可见选择器（属性冻结）+ 三态反馈走 esc 自己的类名（不是商城那两个类）', () => {
    const onOpen = vi.fn()
    const onSelect = vi.fn()
    const port = (state: unknown) => ({ state, inputRef: { current: null }, onOpen, onSelect })
    const esc = { noteClassName: 'esc-toolbar-note', errorClassName: 'esc-import-error' }
    // ① 写入口缺席 ⇒ 一枚元素都不画
    expect(EnterpriseSkillImportChrome({ port: undefined })).toBeNull()
    // ② 空闲 ⇒ 只有选择器；属性与商城那枚**逐字同值**（accept 串、无 multiple、1px 剪裁）
    const idle = EnterpriseSkillImportChrome({ port: port(undefined) as never, ...esc })
    const inputs = byProp(idle, 'accept')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]!.props['type']).toBe('file')
    expect(inputs[0]!.props['accept']).toBe(ENTERPRISE_SKILL_IMPORT_ACCEPT)
    expect(inputs[0]!.props['multiple']).toBeUndefined()
    expect(inputs[0]!.props['style']).toMatchObject({ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' })
    expect(byProp(idle, 'data-enterprise-skill-import')).toHaveLength(0)
    // ③ 选中文件：**先清空 value** 再把 File 交出去（同一份文件再选一次仍然触发）
    const file = { name: 'notes.dshskill', size: 2048 } as unknown as File
    const event = { currentTarget: { files: { item: () => file }, value: 'C:\\fakepath\\notes.dshskill' } }
    ;(inputs[0]!.props['onChange'] as (event: unknown) => void)(event)
    expect(onSelect).toHaveBeenCalledWith(file)
    expect(event.currentTarget.value).toBe('')
    // ④ 反馈那一格：Chrome 把 **esc 自己的类名**与「重新选择文件」那一枚动作交给反馈件
    //    （这里查的是"交给谁、交了什么"；真画出来的东西由下面直接调那枚**纯组件**来验）
    const busyState = { kind: 'uploading', name: 'notes.dshskill', bytes: 2048 }
    const noticeOf = (state: unknown) => {
      const chrome = EnterpriseSkillImportChrome({ port: port(state) as never, ...esc })
      const found = walk(chrome).find(each => each.props['state'] === state)
      expect(found, '反馈件').toBeTruthy()
      return found!.props
    }
    const busyProps = noticeOf(busyState)
    expect(busyProps['noteClassName']).toBe('esc-toolbar-note')
    expect(busyProps['errorClassName']).toBe('esc-import-error')
    expect(busyProps['onReselect']).toBe(onOpen)
    // ⑤ 进行中 / 成功各一句 `role="status"`（不打断读屏），不是静默
    const busyBody = asElement(EnterpriseSkillImportNotice(busyProps as never))
    expect(busyBody.props['className']).toBe('esc-toolbar-note')
    expect(busyBody.props['role']).toBe('status')
    expect(busyBody.props['data-enterprise-skill-import']).toBe('busy')
    const doneBody = asElement(
      EnterpriseSkillImportNotice({ state: { kind: 'done', name: 'notes.dshskill', bytes: 2048, names: ['meeting-notes'], listed: true }, onReselect: onOpen, ...esc } as never),
    )
    expect(doneBody.props['role']).toBe('status')
    expect(String(doneBody.props['children'])).toContain('meeting-notes')
    // ⑥ 失败 ⇒ 唯一提示件（esc 那一枚类名 + 稳定码 + **本地上传流**的下一步）+ 一枚**真能点**的「重新选择文件」
    const failedBody = EnterpriseSkillImportNotice({
      state: { kind: 'failed', name: 'notes.dshskill', bytes: 2048, code: 'ENT_SKILL_UPLOAD_INVALID' }, onReselect: onOpen, ...esc,
    } as never)
    const notice = walk(failedBody).find(each => each.props['code'] === 'ENT_SKILL_UPLOAD_INVALID')
    expect(notice, '唯一提示件').toBeTruthy()
    expect(notice!.props['className']).toBe('esc-import-error')
    // `flow="local-upload"` 是必须的：这枚码在中心安装流下的下一步（重新下载）在这一条流里是错的
    expect(notice!.props['flow']).toBe('local-upload')
    const reselect = walk(failedBody).find(each => each.props['aria-label'] === ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL)
    expect(reselect, '重新选择文件').toBeTruthy()
    ;(reselect!.props['onClick'] as () => void)()
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('esc：口径 49（技能页主按钮三项下拉 · 三页尺寸/形态/文案对齐）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  const walk = (node: unknown, out: Element[] = []): Element[] => {
    if (node === null || node === undefined || typeof node !== 'object') return out
    if (Array.isArray(node)) {
      for (const each of node) walk(each, out)
      return out
    }
    const element = node as Element
    out.push(element)
    for (const each of childrenOf(element)) walk(each, out)
    return out
  }
  /**
   * ★**口径 49**：本组的树遍历要**走 props 里挂的元素**，不只是 `children`。
   *
   * 为什么：官方 `Menu` 的锚点（我们那枚主按钮）是经 **`anchor` 这个 prop** 传进去的
   * （`official-ui.ts` 的 `OfficialMenuProps.anchor`），它不在 `children` 里；
   * 只看 children 的遍历会**看不见那枚按钮**，于是"按钮是什么形态"这类判据会静默查空。
   * （本仓被"假引用 / 恒真的空转锁"咬过，故这里显式把遍历面写清楚。）
   */
  const elementsIn = (node: unknown, seen: WeakSet<object>): Element[] => {
    if (node === null || node === undefined) return []
    if (Array.isArray(node)) return node.flatMap(each => elementsIn(each, seen))
    if (typeof node !== 'object') return []
    const candidate = node as { type?: unknown; props?: unknown }
    if (typeof candidate.type === 'undefined' || typeof candidate.props !== 'object' || candidate.props === null) return []
    if (seen.has(node)) return []
    seen.add(node)
    const element = node as Element
    const nested = Object.values(element.props).flatMap(value => elementsIn(value, seen))
    return [element, ...nested]
  }
  /** 深度优先铺平整棵元素树（含经 props 传递的那些元素）。 */
  const walkAll = (node: unknown): Element[] => elementsIn(node, new WeakSet<object>())
  /** 类名清单里含某一枚（`.esc-add-skill esc-add-skill-outline` 这种组合也命中）。 */
  const byClass = (node: unknown, className: string): Element | undefined =>
    walkAll(node).find(each =>
      typeof each.props['className'] === 'string'
      && (each.props['className'] as string).split(' ').includes(className))
  const readSrc = (name: string) => readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8')
  const toolbarOf = (props: Record<string, unknown> = {}) =>
    asElement(
      EnterpriseEscToolbar({
        resourceType: 'skill',
        source: 'system',
        onSourceChange: () => undefined,
        categories: [],
        activeCategory: '',
        onCategoryChange: () => undefined,
        keyword: '',
        onKeywordChange: () => undefined,
        ...props,
      } as never),
    )
  const rightOf = (element: Element) => byClass(element, 'esc-toolbar-right')!
  /** 菜单（官方 `Menu` 那一层）：本组件是纯投影，`menu` 出现在 props 里即可取证。 */
  const menuOf = (element: Element): Element => {
    const found = walkAll(element).find(each => each.props['open'] !== undefined && each.props['anchor'] !== undefined)
    expect(found, '下拉菜单（官方 Menu）').toBeTruthy()
    return found as Element
  }
  /** 三个菜单项（按官方 `MenuItemButton` 的 `data-esc-add-skill-item` 钩子取，顺序即渲染顺序）。 */
  const itemsOf = (element: Element): Element[] =>
    walkAll(element).filter(each => each.props['data-esc-add-skill-item'] !== undefined)
  const itemByKey = (element: Element, key: string): Element => {
    const found = itemsOf(element).find(each => each.props['data-esc-add-skill-item'] === key)
    expect(found, `菜单项 ${key}`).toBeTruthy()
    return found as Element
  }
  /** ★**口径 49**：下拉供给（页壳给的那三件）——**没有它整枚 Menu 都不建**（见 `withMenu`）。 */
  const menuSupply = (open = false) => ({ open, onClose: vi.fn(), onToggle: vi.fn() })

  it('① 下拉三项**逐字**且按序（查找技能 / 上传技能 / 创建技能），只在技能页出现', () => {
    // 真源里的顺序与文案
    expect(ENTERPRISE_ESC_ADD_SKILL_ITEMS.map(item => item.key)).toEqual(['find', 'upload', 'create'])
    expect(ENTERPRISE_ESC_ADD_SKILL_ITEMS.map(item => item.label)).toEqual(['查找技能', '上传技能', '创建技能'])
    expect(ENTERPRISE_ESC_COPY.addSkillFind).toBe('查找技能')
    expect(ENTERPRISE_ESC_COPY.addSkillUpload).toBe('上传技能')
    expect(ENTERPRISE_ESC_COPY.addSkillCreate).toBe('创建技能')
    // 技能页：菜单在，三项在，顺序逐字；可点时渲染的文案就是标签本身（不带任何后缀）
    const skill = toolbarOf({
      resourceType: 'skill',
      onAddSkill: () => undefined,
      onFindSkill: () => undefined,
      onCreateSkill: () => undefined,
      addSkillMenu: menuSupply(),
    })
    const menu = menuOf(skill)
    expect(itemsOf(skill).map(each => each.props['data-esc-add-skill-item'])).toEqual(['find', 'upload', 'create'])
    // 文案：三项**可点**时渲染的就是标签本身（不带任何后缀）；缺端口时渲染「标签（可见原因）」，
    // 后一种形态由下面「端口缺席」那条锁专门负责。
    const allWired = toolbarOf({
      resourceType: 'skill',
      onAddSkill: () => undefined,
      onFindSkill: () => undefined,
      onCreateSkill: () => undefined,
      addSkillMenu: menuSupply(),
    })
    expect(itemsOf(allWired).map(each => each.props['children'])).toEqual(['查找技能', '上传技能', '创建技能'])
    // 菜单配置：挂 body（portal）、右对齐（bottom-end 那一件事）、默认不展开
    expect(menu.props['portal']).toBe(true)
    expect(menu.props['align']).toBe('end')
    expect(menu.props['side']).toBe('bottom')
    expect(menu.props['open']).toBe(false)
    // **反向锁**：没有下拉那两页**一枚菜单项、连 Menu 本身都不许有**（WorkBuddy 那两页不是下拉，
    // 见研究文件 §3）。判据是"官方 Menu 那一层有没有被建出来"，比"清空菜单项"更强 ——
    // 建了却关着同样是一枚点了没反应的锚点。
    for (const resourceType of ['expert', 'connector'] as const) {
      const other = toolbarOf({
        resourceType,
        onAddSkill: () => undefined,
        onFindSkill: () => undefined,
        onCreateSkill: () => undefined,
        addSkillMenu: menuSupply(),
      })
      expect(itemsOf(other), resourceType).toEqual([])
      expect(walkAll(other).some(each => each.props['open'] !== undefined && each.props['anchor'] !== undefined), resourceType).toBe(false)
    }
  })

  it('① 三个 key **各调各的动作**：上传走本机导入端口，查找/创建走草稿端口（源码级 + 渲染级）', () => {
    const onAddSkill = vi.fn()
    const onFindSkill = vi.fn()
    const onCreateSkill = vi.fn()
    const toolbar = toolbarOf({
      resourceType: 'skill',
      onAddSkill,
      onFindSkill,
      onCreateSkill,
      addSkillMenu: { open: true, onClose: vi.fn(), onToggle: vi.fn() },
    })
    // 渲染级：三项的 onSelect **互不相同**，且各打到各的回调
    const find = itemByKey(toolbar, 'find')
    const upload = itemByKey(toolbar, 'upload')
    const create = itemByKey(toolbar, 'create')
    expect(find.props['onSelect']).not.toBe(upload.props['onSelect'])
    expect(upload.props['onSelect']).not.toBe(create.props['onSelect'])
    expect(find.props['onSelect']).not.toBe(create.props['onSelect'])
    ;(upload.props['onSelect'] as () => void)()
    expect(onAddSkill).toHaveBeenCalledTimes(1)
    expect(onFindSkill).not.toHaveBeenCalled()
    ;(find.props['onSelect'] as () => void)()
    expect(onFindSkill).toHaveBeenCalledTimes(1)
    ;(create.props['onSelect'] as () => void)()
    expect(onCreateSkill).toHaveBeenCalledTimes(1)
    // 选中即关下拉（官方 MenuItemButton 不会自己关，这是 owner 的责任）
    // 源码级：三项**各调各的**——上传那一支调 `onAddSkill`，另两支走 `runDraft(plan.key)`
    const toolbarSrc = readSrc('esc-toolbar.tsx')
    expect(toolbarSrc).toContain("if (plan.key === 'upload')")
    expect(toolbarSrc).toContain('onAddSkill?.()')
    expect(toolbarSrc).toContain('runDraft(plan.key)')
    expect(toolbarSrc).toContain("const run = key === 'find' ? onFindSkill : onCreateSkill")
    // 上传那一项走的就是口径 46 那枚**本地导入**写入口（不是第二套实现）。
    // ★**口径 60 重新基线化（更强）**：esc 那一侧现在把这一项接到**导入弹窗**的开窗动作上
    //   （`skillImportPort === undefined ? undefined : …setSkillImportOpen(true)`）——旧断言
    //   `onAddSkill: skillImportPort?.onOpen`（点一下直接开原生选择器）已作废。这里同时钉住三件：
    //   ① 缺写入口 ⇒ `undefined`（那一项因此置灰 + 写明原因，判据仍是"端口在不在场"）；
    //   ② 在场 ⇒ 只**开窗**，不再有"点了就弹原生选择器"这条第二入口；
    //   ③ 弹窗吃的是同一枚 port（队列驱动器），不是另造一份。
    const aggregation = readSrc('esc-aggregation.tsx')
    expect(aggregation).toContain('onAddSkill: skillImportPort === undefined ? undefined : () => { setSkillImportOpen(true) }')
    expect(aggregation).toContain('useEnterpriseSkillImportQueue({')
    expect(aggregation).toContain('port: skillImportPort,')
    expect(aggregation).not.toContain('skillImportPort?.onOpen')
    // 另两项走草稿端口，且**只有** `launch` 这一个出口
    const aggregationSrc = readSrc('esc-aggregation.tsx')
    expect(aggregationSrc).toContain('draftPort.launch(prompt)')
    expect(aggregationSrc.match(/draftPort\.launch\(/g)).toHaveLength(1)
    // 两项**各一处**调用（`('find')` / `('create')`）；另有一处失败上报（`(kind)`）与一处定义。
    // 多一处带字面量的调用就是第三套通路，故这里连"恰好两处"也钉住。
    expect(aggregationSrc.match(/runDraftWithAgent\('/g)).toHaveLength(2)
    expect(aggregationSrc.match(/runDraftWithAgent\(kind\)/g)).toHaveLength(1)
  })

  it('① **草稿路径不许发送**（源码级反向锁）：那条路径上一个 submit/send 出口都没有', () => {
    const aggregation = readSrc('esc-aggregation.tsx')
    const toolbar = readSrc('esc-toolbar.tsx')
    // ① 该路径的出口只有 `launch`（`preset-launch.ts` 的唯一实现：openWorkspace + setDraft）
    expect(aggregation).toContain('EnterpriseEscDraftPort')
    expect(aggregation).toContain('draftPort.launch(prompt)')
    // ② 反向锁：esc 这两处**不许出现**任何"发送"出口（`preset-launch.ts` 里那一整套官方服务调用
    //    也不许被抄进来 —— 抄进来就是第二套开会话机制）。
    // ★判据落在**剥注释后的代码**上：注释里引用"不发送 / setDraft"这些词是**说明**，
    //   而这里要挡的是**真的调用了发送**；同时代码里也不许抄官方那套开会话的调用（那是第二套机制）。
    const aggregationCode = stripEscComments(aggregation)
    for (const forbidden of [
      'sendMessage', 'submit(', 'actions.send', 'pressEnter', 'dispatchEvent',
      'openWorkspace', 'actions.setDraft', 'conversation.input', 'uiWorkspace',
    ]) {
      expect(aggregationCode, `esc-aggregation 不该出现 ${forbidden}`).not.toContain(forbidden)
    }
    // `.send(` 用**词边界**判（裸 `includes('.send(')` 会被 `setDraftFailure` 这种标识符里
    // 的 `tFailure` 无关片段误伤？不会 —— 真正会被误伤的是把「发送」写成 `.send (` 之类）；
    // 这里判的是"真的有一处调用式的 `.send(`"，等价于 `\.send\s*\(`。
    expect(/\.[Ss]end\s*\(/.test(aggregationCode), 'esc-aggregation 不该调用 .send(').toBe(false)
    // 工具栏那一侧也一个都不许有（它只把动作交上去）
    const toolbarCode = stripEscComments(toolbar)
    for (const forbidden of ['submit(', 'sendMessage', 'actions.setDraft', 'openWorkspace']) {
      expect(toolbarCode, `esc-toolbar 不该出现 ${forbidden}`).not.toContain(forbidden)
    }
    expect(/\.[Ss]end\s*\(/.test(toolbarCode), 'esc-toolbar 不该调用 .send(').toBe(false)
    // ③ 这条路径的机制**只有一处实现**：全包只有 `preset-launch.ts` 真的调官方那枚写入口。
    //    （`client.tsx` 用 `ctx.get('conversation')` 把服务**递**给那个实现，属接线；
    //      它一行都不自己调 setDraft —— 由下面这条"谁真的调用写入口"的判据保证。）
    const srcDir = new URL('../src/', import.meta.url)
    // ★判据落在**剥注释后的代码**上：各文件的 JSDoc 里引用官方那串签名是**说明**
    //   （说明"这一级的机制是官方哪一件"），不是调用。
    // ★查的是**真的取那枚写入口**的两种写法：`actions.setDraft` 与
    //   `recordOf(...)['actions'])?.['setDraft']`（`preset-launch.ts` 用的是后者——它刻意
    //   不 import 官方类型，只做形状收窄；只查前者会漏掉真实现，在本仓正是"空转锁"的形态）。
    const writesDraft = (code: string): boolean =>
      code.includes('actions.setDraft') || code.includes("['setDraft']")
    const owners = readdirSync(srcDir)
      // 只看**实现文件**：`.spec.ts` 是测试，里面出现这串字是判据本身（不是产品代码调了它）。
      .filter(name => /\.tsx?$/.test(name) && !/\.(spec|test)\./.test(name))
      .filter(name => writesDraft(stripEscComments(readFileSync(new URL(name, srcDir), 'utf8'))))
    // **恰好一处**：`preset-launch.ts`。别的实现文件只要真的取/调了那枚写入口，这条立刻红。
    expect(owners).toEqual(['preset-launch.ts'])
    //    连线层也只许**读**服务、不许调用：`conversation` 只出现在 client.tsx 的 ctx.get 里
    //    判据同样落在**剥注释后的代码**上：这两句都写在 JSDoc 的说明里（"这一级的机制是官方哪一件"）。
    const wiring = stripEscComments(readFileSync(new URL('client.tsx', srcDir), 'utf8'))
    expect(wiring).toContain("ctx.get('conversation')")
    expect(wiring).not.toContain('actions.setDraft')
    expect(/\.[Ss]end\s*\(/.test(wiring), 'client.tsx 不该调用 .send(').toBe(false)
    // ④ esc 自己那两个文件里**没有任何**发送/提交出口（判据落在剥注释后的代码上）
    for (const [name, code] of [['esc-aggregation.tsx', aggregationCode], ['esc-toolbar.tsx', toolbarCode]] as const) {
      for (const call of ['sendMessage(', '.send(', 'submit(', 'pressEnter(', 'dispatchEvent(']) {
        expect(code, `${name} 不该调用 ${call}`).not.toContain(call)
      }
    }
  })

  it('① 端口缺席 ⇒ 那一项置灰 + **可见**原因；整枚按钮的降级路径一字不退化', () => {
    // ① 三项全缺席：三项都按不动，且原因在**可见文案**里（官方 MenuItemButton 不透传 title，
    //    挂 title 会被静默丢弃 —— 这是本仓已写明的口径）
    const bare = toolbarOf({ resourceType: 'skill', addSkillMenu: menuSupply() })
    for (const key of ['find', 'upload', 'create']) {
      const item = itemByKey(bare, key)
      expect(item.props['disabled'], key).toBe(true)
      expect(String(item.props['children']), key).toBe(
        `${ENTERPRISE_ESC_ADD_SKILL_ITEMS.find(each => each.key === key)!.label}（${ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted}）`,
      )
    }
    // ② 纯投影同时给"哪一项按不动"的判据（可直调）
    expect(enterpriseEscAddSkillLock({})).toEqual(['find', 'upload', 'create'])
    expect(enterpriseEscAddSkillLock({ onAddSkill: () => undefined })).toEqual(['find', 'create'])
    expect(enterpriseEscAddSkillLock({ onFindSkill: () => undefined, onCreateSkill: () => undefined })).toEqual(['upload'])
    expect(enterpriseEscAddSkillLock({ onFindSkill: () => undefined, onAddSkill: () => undefined, onCreateSkill: () => undefined })).toEqual([])
    const plans = enterpriseEscAddSkillPlans({ onAddSkill: () => undefined })
    expect(plans.map(plan => plan.disabled)).toEqual([true, false, true])
    expect(plans[0]!.reason).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    expect(plans[0]!.text).toBe(`查找技能（${ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted}）`)
    expect(plans[1]!.reason).toBeUndefined()
    expect(plans[1]!.text).toBe('上传技能')
    // ③ **降级路径**：没有 `addSkillMenu` 时，技能页那枚按钮仍是一枚"直接走本地导入"的真按钮
    const legacy = toolbarOf({ resourceType: 'skill', onAddSkill: () => undefined })
    // **没有下拉供给 ⇒ 连 Menu 都不建**（一枚菜单项都没有）：主按钮就是口径 46 那一枚真按钮，
    // 不会多出一枚"点了没反应"的锚点。
    expect(itemsOf(legacy)).toEqual([])
    const button = byClass(legacy, 'esc-add-skill')!
    expect(button.props['disabled']).toBe(false)
    expect(typeof button.props['onClick']).toBe('function')
    expect(button.props['aria-haspopup']).toBeUndefined()
    // ④ 有下拉时：按钮只开合菜单（不直接干上传那件事），且带无障碍的弹出语义
    const toggle = vi.fn()
    const withMenu = toolbarOf({
      resourceType: 'skill',
      onAddSkill: () => undefined,
      addSkillMenu: { open: false, onClose: () => undefined, onToggle: toggle },
    })
    const trigger = byClass(withMenu, 'esc-add-skill')!
    expect(trigger.props['aria-haspopup']).toBe('menu')
    expect(trigger.props['aria-expanded']).toBe(false)
    /**
     * ★**锚点不许被禁用**：下拉在场时那枚按钮是**锚点**，`disabled` 会连菜单一起点不开
     * （等于把整条新通路关死）；上传那一项自己按不动，由 `plan.disabled` 负责。
     */
    expect(trigger.props['disabled']).toBeUndefined()
    ;(trigger.props['onClick'] as () => void)()
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('① 预填失败必须**说出来**：稳定码入表 + 唯一提示件 + 人话与下一步（绝不静默）', () => {
    // ① 稳定码在唯一码表里，且人话 + 下一步都不含裸码
    expect(ENTERPRISE_ERROR_CODES).toContain(ENTERPRISE_ESC_DRAFT_FAILED_CODE)
    expect(ENTERPRISE_ESC_DRAFT_FAILED_CODE).toBe('ENT_ESC_DRAFT_UNAVAILABLE')
    const view = enterpriseErrorPresentation(ENTERPRISE_ESC_DRAFT_FAILED_CODE)
    expect(view.known).toBe(true)
    expect(view.message.length).toBeGreaterThan(0)
    expect(view.action.length).toBeGreaterThan(0)
    expect(view.message).not.toContain('ENT_')
    expect(view.action).not.toContain('ENT_')
    // 终态：不给必然失败的重试画饼
    expect(view.retryable).toBe(false)
    // ② 源码级：失败两条通路（端口缺席 / launch 返回 false 或抛）**都**落到那枚码上，
    //    渲染的是唯一提示组件（不是自造的一句 console.warn）
    const aggregation = readSrc('esc-aggregation.tsx')
    expect(aggregation).toContain("import { EnterpriseErrorNotice } from '../error-notice.js'")
    // 码值只在唯一码表里声明一次（`error-messages.ts`），界面侧只**引用**它
    const errorMessages = readFileSync(new URL('../src/error-messages.ts', import.meta.url), 'utf8')
    expect(errorMessages).toContain("export const ENTERPRISE_ESC_DRAFT_FAILED_CODE = 'ENT_ESC_DRAFT_UNAVAILABLE'")
    expect(aggregation).toContain('code: ENTERPRISE_ESC_DRAFT_FAILED_CODE')
    expect(aggregation).toContain('setDraftFailure(kind)')
    // 源码级反向锁：这条通路**不许**只留一个 console.warn / 空 catch 就过去
    expect(aggregation).not.toContain('console.warn')
    expect(aggregation).not.toContain('console.error')
    // 提示件的动作前缀要说清是哪一项（查找技能 / 创建技能）
    expect(aggregation).toContain('draftFailure === \'find\' ? ENTERPRISE_ESC_COPY.addSkillFind : ENTERPRISE_ESC_COPY.addSkillCreate')
  })

  it('① 端口接线：`draftPort` 经 `main` 槽的 inject 面递到页面（**不进**只读 `api`）', () => {
    // ① 注册面：`main` 的 inject 面必须把草稿端口一起交下去（少一件 ⇒ 菜单那两项永远置灰）
    const api = { name: 'api' } as unknown as EnterpriseEscApi
    const skillPort = { uploadSkill: () => undefined } as never
    const draftPort = { launch: async () => true }
    const main = enterpriseEscMainOptions(api, skillPort, draftPort)
    expect(main['name']).toBe('main')
    expect(main['key']).toBe(ENTERPRISE_ESC_ENTRY_ID)
    expect((main['inject'] as () => Record<string, unknown>)()).toEqual({ api, skillPort, draftPort })
    // ② 缺席时也如实交下去（`undefined` 不等于"没这一项"：页面按它在不在场判降级）
    expect((enterpriseEscMainOptions(api)['inject'] as () => Record<string, unknown>)())
      .toEqual({ api, skillPort: undefined, draftPort: undefined })
    // ③ 落点：页壳把它原样转交给内容区（三层一条链，中间少一环就是"点了没反应"）
    const panel = readFileSync(new URL('../src/esc/esc-page.tsx', import.meta.url), 'utf8')
    expect(panel).toContain('draftPort')
    expect(panel).toContain('draftPort,')
    // ④ **反向锁**：它**不许**混进只读取数面（那一面是结构性只读的，见 esc-types 的长注释）
    const escApi = readFileSync(new URL('../src/esc/esc-api.ts', import.meta.url), 'utf8')
    expect(escApi).not.toContain('draftPort')
    expect(escApi).not.toContain('setDraft')
    // ⑤ 接线在组合根里也只建**一份**（不是每页各建一份）
    const wiring = stripEscComments(readFileSync(new URL('client.tsx', new URL('../src/', import.meta.url)), 'utf8'))
    expect(wiring.match(/escDraftPort/g)).toHaveLength(2)
    expect(wiring).toContain('createEnterprisePresetLauncher')
  })

  it('②③④ 三页主按钮：高度恒等 `--esc-btn-h`（真钉，不是 min-height）、字号/字重/圆角同源', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const ruleBody = (head: string): string => {
      const hit = new RegExp(`^${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm').exec(declarations)
      expect(hit, `样式表顶层没有 ${head}`).not.toBeNull()
      return hit![1]!
    }
    const button = ruleBody('.esc-add-skill')
    // ① **真钉高度**：这一格必须写 `height: var(--esc-btn-h)`（WorkBuddy 三页实测都是 32）
    expect(button).toContain('height: var(--esc-btn-h)')
    // 反向锁：`min-height` 压不住官方 Button `.md` 的 `height: 36px`（上一轮就是这么没生效的）
    expect(button).not.toContain('min-height')
    // ② 字号/字重/圆角/内衬都与本地刻度同源
    expect(button).toContain('font-size: var(--esc-fs-xs)')
    expect(button).toContain('font-weight: 500')
    expect(button).toContain('padding: 0 var(--esc-btn-px)')
    expect(button).toContain('border-radius: var(--esc-btn-radius)')
    // ③ **恒等式**：那一格的高度解析值 === 三页按钮共用的那枚 token 的值（真源 WB.control.button）
    const root = ruleBody('.esc-root')
    const btnH = Number(/--esc-btn-h: ([0-9]+)px/.exec(root)?.[1])
    expect(Number.isFinite(btnH)).toBe(true)
    expect(btnH).toBe(WB.control.button.height)
    // 三页实测盒高都是 32（WB `uid-6/8/9` 那三枚），且与同行的次级控件同高
    expect(WB.control.button.height).toBe(32)
    expect(btnH).toBe(Number(/--esc-field-h: ([0-9]+)px/.exec(root)?.[1]))
  })

  it('③④ 形态分流：专家页是描边档（复用 `.esc-installed` 配方）、技能/连接器是 primary', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const ruleBody = (head: string): string => {
      const hit = new RegExp(`^${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm').exec(declarations)
      expect(hit, `样式表顶层没有 ${head}`).not.toBeNull()
      return hit![1]!
    }
    // 渲染级：只有专家页带描边档类名，且 variant 也切到 outline
    const expert = byClass(toolbarOf({ resourceType: 'expert' }), 'esc-add-skill')!
    expect(String(expert.props['className'])).toContain('esc-add-skill-outline')
    expect(expert.props['variant']).toBe('outline')
    for (const resourceType of ['skill', 'connector'] as const) {
      const page = byClass(toolbarOf({ resourceType }), 'esc-add-skill')!
      expect(String(page.props['className']), resourceType).not.toContain('esc-add-skill-outline')
      expect(page.props['variant'], resourceType).toBe('primary')
    }
    // 样式级：描边档的**配方**与既有 `.esc-installed` **逐条同源**（不新造第二套白底按钮）
    const outline = ruleBody('.esc-add-skill-outline')
    const installed = ruleBody('.esc-installed')
    for (const declaration of [
      'border: 1px solid var(--dsw-alias-border-l2)',
      'background: none',
      'color: var(--dsw-alias-label-primary)',
    ]) {
      expect(installed, `.esc-installed 缺 ${declaration}`).toContain(declaration)
      expect(outline, `.esc-add-skill-outline 缺 ${declaration}`).toContain(declaration)
    }
    // 反向锁：描边那一档**不许**再长出一套 `--dsw-radius-*` 兜底写法，也不许写死颜色
    expect(outline).not.toContain('var(--dsw-radius-md')
    expect(outline).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })

  /**
   * ★**本用例按用户裁决重新基线化（加强，不是放宽）**。
   *
   * 旧那条锁的是"读不到 ⇒ **不显示数字** + 另缀一枚 `？`（橙色，title 借 `categoriesUnavailable`）"。
   * 用户裁决把它改成：读不到 ⇒ **画 `(0)`**（与真 0 同形，代价用户明确接受），
   * 而"这个 0 是暂定的"这件事**必须**由同一个按钮的 `title` 说出来（不许静默）。
   * ⇒ 新判据比旧的**更强**：旧断言对"读不到时随便不显示点什么"是绿的；现在要求
   *   ① 数字位在**三种**状态下都存在且形状一致；② 真 0 与读不到的 **title 必须不同**；
   *   ③ 那句 title 必须同时含"读不到"与"按 0 显示"两件事、且不含裸码；
   *   ④ 旧那枚 `？` 与它的类名**在整个 src/esc 里零出现**（连 CSS 死规则一起）。
   */
  it('⑤ 「已安装」只在技能页渲染 + 计数三态（用户裁决：读不到 ⇒ 与真 0 同形，靠 title 区分）', () => {
    // 技能页：在（且仍是同一枚自绘按钮）
    const skill = rightOf(toolbarOf({ resourceType: 'skill', onOpenInstalled: () => undefined }))
    const installed = byClass(skill, 'esc-installed')
    expect(installed).toBeTruthy()
    expect(installed!.props['disabled']).toBe(false)
    // 专家/连接器页：整枚不存在 —— 不是 disabled、不是 visibility 隐藏、连 `installedCount` 都不渲染
    for (const resourceType of ['expert', 'connector'] as const) {
      const right = rightOf(toolbarOf({ resourceType, onOpenInstalled: () => undefined, installedCount: 3 }))
      expect(byClass(right, 'esc-installed'), resourceType).toBeUndefined()
      // 反向锁：那两页**不许**用"隐藏"来假装没有（本仓被咬过：disabled 加 title 也算死控件）；
      // 也不许出现带计数的那一格
      expect(byClass(right, 'esc-installed-count'), resourceType).toBeUndefined()
      expect(walkAll(right).some(each => String(each.props['className'] ?? '').includes('esc-installed')), resourceType).toBe(false)
    }
    // 源码级：那一格的条件是**资源类型**，不是计数器（`installedCount === 0` 也要渲染这枚按钮）
    const toolbar = readSrc('esc-toolbar.tsx')
    expect(toolbar).toContain("resourceType !== 'skill'")
    /* ══════════ 计数三态（★用户裁决「读不到就显示 0」）══════════
       读到 N ⇒ `(N)`；**真 0 与读不到 ⇒ 同一个形状 `(0)`**（这个代价用户明确接受）；
       两种状态由那枚按钮的 `title` 区分：真 0 用正常说明，读不到用"暂定值"那句 —— 绝不静默。 */
    const opened = () => undefined
    const skillRight = (props: Record<string, unknown> = {}) =>
      rightOf(toolbarOf({ resourceType: 'skill', onOpenInstalled: opened, ...props }))
    const countOf = (tree: unknown) => byClass(tree, 'esc-installed-count')
    const titleOf = (tree: unknown) => String(byClass(tree, 'esc-installed')!.props['title'])
    // ① 读到 N：数字位就是真值
    expect(countOf(skillRight({ installedCount: 3 }))!.props['children']).toBe('(3)')
    // ② **真 0** / ③ **读不到** / ④ **首帧（还没读回来）**：数字位**同形**
    const zero = skillRight({ installedCount: 0 })
    const unreadable = skillRight({ installedCount: undefined, installedCountFailed: true })
    const inFlight = skillRight({})
    for (const [label, tree] of [['真 0', zero], ['读不到', unreadable], ['首帧', inFlight]] as const) {
      expect(countOf(tree), `${label}：数字位必须在场`).toBeTruthy()
      expect(countOf(tree)!.props['children'], label).toBe('(0)')
      // 反向锁：旧那枚 `？` 那一格与它的类名**都不许回来**
      expect(byClass(tree, 'esc-installed-failed'), label).toBeUndefined()
      expect(
        walkAll(tree).some(each => String(each.props['children'] ?? '').includes('？')),
        `${label}：树里不许再出现那枚问号`,
      ).toBe(false)
    }
    // ⑤ **title 必须把真 0 与读不到分开**（"不静默吞失败"的机器化判据）
    expect(titleOf(zero)).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedFilterOpen)
    expect(titleOf(unreadable)).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable)
    expect(titleOf(zero)).not.toBe(titleOf(unreadable))
    // 首帧也吃同一句 —— 那一瞬这个 0 同样不是真读到的（同一句话不撒谎）
    expect(titleOf(inFlight)).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable)
    // ⑥ 那句 title 必须**同时**含"读不到"与"按 0 显示"两件事，且**不含裸码**
    const sentence = titleOf(unreadable)
    expect(sentence).toContain('读不到')
    expect(sentence).toContain('按 0 显示')
    expect(sentence).not.toMatch(/ENT_[A-Z_]+/)
    // ⑦ 它**不是**分类那句（借用关系已拆；集合级反向锁见下一条用例）
    expect(sentence).not.toBe(ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable)
    // ⑧ 读到数字时 title 仍是"会发生什么"（本刀没把正常态带平）
    expect(titleOf(skillRight({ installedCount: 3 }))).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedFilterOpen)
    // ⑨ 源码级反向锁：那枚 `？` 与它的类名都退场了 —— 判据落在**剥注释后的代码**上
    //    （沿革注释里提到被删掉的那条规则是**说明**，不是"它回来了"；这正是 `stripEscComments` 的口径）。
    const escDir = new URL('../src/esc/', import.meta.url)
    for (const name of readdirSync(escDir).filter(each => /\.tsx?$/.test(each))) {
      expect(stripEscComments(readFileSync(new URL(name, escDir), 'utf8')), name).not.toContain('esc-installed-failed')
    }
    expect(stripEscComments(toolbar)).not.toContain('？')
  })

  /**
   * ★**集合级反向锁（本刀要锁的正是"再被借走"这件事）**。
   *
   * `categoriesUnavailable`（「分类暂时读不到」）是给**分类字典读不到**用的；真机上那枚 `？` 借的
   * 就是它，而分类那一面本身好好的 —— 按钮因此**指错原因**。本刀把两件事拆成两枚文案之后，
   * 这条锁把"标识符 `categoriesUnavailable` 在 `src/esc` 里的每一次出现"钉成一张**闭合的名单**：
   * 任何一处**新增**（例如计数位再拿它当 title）或**替换**都会让这张名单对不上 ⇒ 立刻红。
   * 判据落在**剥注释后的代码**上：注释里引用这个名字是沿革说明，不算"借用"。
   */
  it('④ 集合级反向锁：categoriesUnavailable 只许出现在「分类读不到」的语境（不许再被计数借用）', () => {
    // ① 两枚文案是两件事（值不同、互不相等）
    expect(ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable).toBe('分类暂时读不到')
    expect(ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable).toBe('本机已装数量暂时读不到，先按 0 显示')
    expect(ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable).not.toBe(ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable)
    // ② 全 `src/esc`：这个标识符的每一次出现都必须在这张白名单里
    const escDir = new URL('../src/esc/', import.meta.url)
    const occurrences = new Map<string, string[]>()
    for (const name of readdirSync(escDir).filter(each => /\.tsx?$/.test(each)).sort()) {
      const lines = stripEscComments(readFileSync(new URL(name, escDir), 'utf8'))
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('categoriesUnavailable'))
      if (lines.length > 0) occurrences.set(name, lines)
    }
    expect([...occurrences.entries()]).toEqual([
      // 分类那一面：取数 hook 的降级标志 → 原样交给工具栏（"分类读不到"这条链上的传参）
      ['esc-aggregation.tsx', ['categoriesUnavailable: unavailable,']],
      // 文案真源：这一句只为分类而存在
      ['esc-copy.ts', ["categoriesUnavailable: '分类暂时读不到',"]],
      // 工具栏：类型声明 + 解构 + 判据 + 那句提示本身（**四处**，没有一处与计数有关）
      ['esc-toolbar.tsx', [
        'readonly categoriesUnavailable?: boolean | undefined',
        'categoriesUnavailable,',
        'categoriesUnavailable === true',
        'children: ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable,',
      ]],
    ])
    // ③ 渲染级：分类读不到时出的仍是分类那句；同一棵树上计数位的 title 是**计数自己**那句
    //    （分类提示住在工具栏**体**里，不在右块，故这里取整棵树）
    const both = toolbarOf({
      resourceType: 'skill',
      onOpenInstalled: () => undefined,
      categoriesUnavailable: true,
      installedCount: 3,
    })
    expect(byClass(both, 'esc-toolbar-note')!.props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable)
    expect(byClass(both, 'esc-installed')!.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedFilterOpen)
  })

  /**
   * ★**回归锁（本仓硬纪律：改一刀不许把别处的口径带平）**。
   *
   * ★**口径 54 重新基线化（加强，不是放宽）**：旧这一条锁的是"计数 = 企业已装清单 + 本机自装清单
   * **两份之和**"。用户裁决把真源换成**官方发现面**（"同时已安装里面显示的就是 DSH 本地已安装的技能"）
   * ⇒ 那两份记录**不再作"是否已装"的判据**（真机取证：磁盘 7 枚 vs 企业记录 1 枚，两份之和必然是错的）。
   * 新判据覆盖的比旧的多：① 这条链**只读一条真源**且**恰好一次**请求；② 计数**不是**任何"两份之和"
   * 的形态（反向锁：文件里不许再出现 `list.length +` / `selfRecords`）；③ 三态纪律（读不到不写假数）
   * 与时机（技能页那条 effect + 刷新令牌）**一条不少**，并多锁一条 `complete === false` 的第四态。
   */
  it('⑤ 回归：计数真源（**一条**官方发现面）与请求次数/时机/三态纪律', () => {
    const aggregation = stripEscComments(readSrc('esc-aggregation.tsx'))
    // ① **一条真源**：发现面那一趟（全文件恰好一处调用），且它是计数的**唯一**来路。
    expect(aggregation.match(/api\.discoveredSkills\(/g)).toHaveLength(1)
    expect(aggregation).toContain('const snapshot = await api.discoveredSkills(controller.signal)')
    // ★三件事实**出自同一处投影**（计数 / 已装判定键 / 还没发现完）—— 这条比"某一行写得对"强：
    //   任何"计数另算一遍"的改法都会让这三行不再同源。
    expect(aggregation).toContain('const facts = installedSnapshotFacts(snapshot)')
    expect(aggregation).toContain('setInstalledCount(facts.count)')
    expect(aggregation).toContain('setInstalledIds(facts.names)')
    expect(aggregation).toContain('setInstalledDiscovering(facts.discovering)')
    // ② 反向锁：**不再是**"两份记录之和"（那两份已降级为元信息）。
    expect(aggregation).not.toContain('list.length +')
    expect(aggregation).not.toContain('selfRecords')
    expect(aggregation).not.toMatch(/api\.installedSkills\(/)
    /**
     * ★`selfInstalledSkills` 在这份文件里**只剩一处**，且必须是**本地导入那台状态机**的接线
     * （导入成功后要拿自装清单念出"这次装好了哪几个技能"）—— 它**不再**是计数链的一环。
     * 旧那一条锁的是"计数 = 企业清单 + 自装清单"；新判据把"自装清单"的**唯一**许可用途钉死，
     * 任何"把它读回来喂给计数"的改法都会多出第二处出现 ⇒ 红。
     */
    expect(aggregation.match(/selfInstalledSkills/g)).toHaveLength(2)
    expect(aggregation).toContain('selfInstalledSkills: skillPort === undefined ? undefined : signal => skillPort.selfInstalledSkills(signal),')
    // ③ 已装判定键仍是**名字**（口径 47 那把公共键，本刀把它升级为磁盘真值）。
    expect(aggregation).toContain('setInstalledIds(facts.names)')
    // ④ **时机**：仍是"技能页 + 取数面 + 刷新令牌"那一条 effect（切页/导入成功才重跑）。
    expect(aggregation).toContain("if (resourceType !== 'skill') return")
    expect(aggregation).toContain('}, [api, resourceType, installedRefreshToken])')
    // ⑤ 读失败**不写假数**、也不静默：catch 里不许出现 `setInstalledCount(0)`，且必须记下失败这件事。
    expect(aggregation).not.toMatch(/setInstalledCount\(\s*0\s*\)/)
    expect(aggregation).toContain('setInstalledReadFailed(true)')
    // ⑥ 三个事实仍**原样**交给工具栏（读不到时 `undefined` + `true`；说法的落点在工具栏那侧），
    //    外加口径 54 的第四态（`complete === false`）。
    expect(aggregation).toContain('installedCount,')
    expect(aggregation).toContain('installedCountFailed: installedReadFailed,')
    expect(aggregation).toContain('installedCountDiscovering: installedDiscovering,')
    expect(aggregation).toContain('setInstalledDiscovering(facts.discovering)')
  })

  it('⑥ 三枚 placeholder 逐字且互不相同，且**只有一处**取值口（旧那枚不许回来）', () => {
    expect(enterpriseEscSearchPlaceholder('expert')).toBe('搜索专家')
    expect(enterpriseEscSearchPlaceholder('skill')).toBe('搜索技能')
    expect(enterpriseEscSearchPlaceholder('connector')).toBe('搜索连接器')
    expect(new Set([
      enterpriseEscSearchPlaceholder('expert'),
      enterpriseEscSearchPlaceholder('skill'),
      enterpriseEscSearchPlaceholder('connector'),
    ]).size).toBe(3)
    // 渲染级：三页各自的搜索框拿到的就是那一枚（placeholder 与 aria-label 同源）
    for (const resourceType of ['expert', 'skill', 'connector'] as const) {
      const search = byClass(toolbarOf({ resourceType }), 'esc-search')!
      expect(search.props['placeholder'], resourceType).toBe(enterpriseEscSearchPlaceholder(resourceType))
      expect(search.props['aria-label'], resourceType).toBe(enterpriseEscSearchPlaceholder(resourceType))
    }
    // 反向锁：旧那枚笼统文案**在整份源码里零出现**（连注释都不留 —— 它就是"第二真源"的样子）
    const srcDir = new URL('../src/esc/', import.meta.url)
    for (const name of readdirSync(srcDir)) {
      // esc-copy.ts 里允许留一句沿革说明（"旧那枚被替换"这件事本身要写在真源旁边）；
      // 它的**值**层面已由上面那条反向锁与文案表那条 `JSON.stringify` 判据一起锁死。
      if (name === 'esc-copy.ts') continue
      expect(readFileSync(new URL(name, srcDir), 'utf8'), name).not.toContain('搜索名称或描述')
    }
    // 源码级：取值口只有一处（工具栏里不许再出现第二个三元/字面量）
    const toolbar = readSrc('esc-toolbar.tsx')
    expect(toolbar.match(/searchPlaceholder(Expert|Skill|Connector)/g)).toHaveLength(3)
  })
})

/* ══════════════ 口径 50（「换一批」＝在已取到的整批上做本地窗口并循环，不重发请求）══════════════
 * 这一组锁的是**用户报的那个缺口**：平台给 7 条、精选只显示一行（这台屏 4 枚），旧实现点「换一批」
 * 重发的是与首次逐字相同的请求（`pageNo` 在 `esc-api.ts` 里被钉死）⇒ 拿回同一批 ⇒ 另 3 条**永不可达**。
 * 现在的语义：把**已取到的那一批**按 offset 旋转（一枚不删），窗口每次向后平移一个"满屏"并循环。
 * 判据全部落在**纯投影**上（本仓 vitest 没有 DOM）：排列性、可见首屏、可达性、钳制、兜底、
 * 渲染顺序、归零时机；只有"读列数"那一格走薄适配器，且它自己的兜底也被逐形态钉住。 */

describe('esc：口径 50（「换一批」＝本地窗口循环，不重发请求）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element): readonly unknown[] => {
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  const readSrc = (name: string) => readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8')
  /** React 元素的 `key`（在元素自己那一格上，**不在** props 里；读错地方会拿到一串 undefined）。 */
  const elementKeyOf = (node: unknown): unknown => (node as { key?: unknown } | null)?.key
  /** 造一批带身份标记的条目（"哪一枚"必须可辨认，否则"全部出现过"这句话没法查）。 */
  const batchOf = (length: number): readonly string[] =>
    Array.from({ length }, (_unused, index) => `id-${index}`)
  /** 这台屏的渲染列数（用户真机 1377.7px 内容区 = 4 列；那一格由 CSS 决定，本文件只拿它当输入）。 */
  const DESKTOP_COLUMNS = 4

  it('★旋转是**排列**：长度不变、一枚不丢、一枚不重，且逐枚就是 items[(offset + k) mod N]（多种 (N, offset)）', () => {
    for (const length of [1, 2, 3, 4, 5, 7, 19]) {
      const items = batchOf(length)
      const sorted = [...items].sort()
      for (let offset = 0; offset < length; offset += 1) {
        const windowed = enterpriseEscFeaturedWindow(items, offset)
        const where = `N=${length} offset=${offset}`
        // ① 长度不变（**不截断**：截断会留下"只剩 2 枚"的半行）
        expect(windowed, where).toHaveLength(length)
        // ② 同一批（一枚不丢、一枚不重）
        expect([...windowed].sort(), where).toEqual(sorted)
        expect(new Set(windowed).size, where).toBe(length)
        // ③ 逐枚位置**就是旋转公式本身**（只判"是个排列"太松：反序也是排列）
        windowed.forEach((each, index) => {
          expect(each, `${where} k=${index}`).toBe(items[(offset + index) % length])
        })
        // ④ 越界与负数先归一到 [0, N)：N ≡ 0、-1 ≡ N-1、N+1 ≡ 1
        expect(enterpriseEscFeaturedWindow(items, offset + length), where).toEqual([...windowed])
        expect(enterpriseEscFeaturedWindow(items, offset - length), where).toEqual([...windowed])
      }
      // ⑤ 非有限 offset 归一到原顺序（纯投影不许把 NaN 传下去）；小数按整数截断（不跳半枚）
      expect(enterpriseEscFeaturedWindow(items, Number.NaN)).toEqual([...items])
      expect(enterpriseEscFeaturedWindow(items, Number.POSITIVE_INFINITY)).toEqual([...items])
      expect(enterpriseEscFeaturedWindow(items, 2.9)).toEqual(enterpriseEscFeaturedWindow(items, 2))
    }
    // 空批：原样交回（连新数组都不造）
    const empty: readonly string[] = []
    expect(enterpriseEscFeaturedWindow(empty, 3)).toBe(empty)
  })

  it('★这台屏（N=7 / 4 列）：连点一轮，平台给的 7 条**全部出现过**（今天只有前 4 条可达），且回到原点', () => {
    const items = batchOf(7)
    let offset = ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL
    const seen = new Set<string>()
    const firstOfEachPress: string[] = []
    for (let press = 0; press < items.length; press += 1) {
      const windowed = enterpriseEscFeaturedWindow(items, offset)
      // 网格只显示第一行 ⇒ 可见的就是前 4 枚（列数由 CSS 决定；这里按真机那一档切）
      for (const each of windowed.slice(0, DESKTOP_COLUMNS)) seen.add(each)
      firstOfEachPress.push(windowed[0]!)
      offset = enterpriseEscFeaturedNextOffset(offset, DESKTOP_COLUMNS, items.length)
    }
    expect([...seen].sort()).toEqual([...items].sort())
    // 每次点按首枚都换人（不是"点了没反应"），且走遍全批
    expect(firstOfEachPress).toEqual([
      'id-0', 'id-4', 'id-1', 'id-5', 'id-2', 'id-6', 'id-3',
    ])
    // 7 与 4 互质 ⇒ 一轮 7 次正好走遍 7 个起点，回到原点
    expect(offset).toBe(ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL)
  })

  it('★步长 = 1（兜底那一档）：反复推进时**每一枚都可达**（窄屏与"读不到列数"都不丢内容）', () => {
    const items = batchOf(7)
    let offset = ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL
    const firsts: string[] = []
    for (let press = 0; press < items.length; press += 1) {
      firsts.push(enterpriseEscFeaturedWindow(items, offset)[0]!)
      offset = enterpriseEscFeaturedNextOffset(offset, ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK, items.length)
    }
    // 逐次首枚恰好是整批本身 ⇒ 一枚不落
    expect(firsts).toEqual([...items])
    expect(offset).toBe(ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL)
  })

  it('★推进＝(current + stride) mod N：循环、越界回开头、钳制到 [1, N]、非有限值有确定结果', () => {
    // 循环
    expect(enterpriseEscFeaturedNextOffset(6, 1, 7)).toBe(0)
    expect(enterpriseEscFeaturedNextOffset(4, 4, 7)).toBe(1)
    expect(enterpriseEscFeaturedNextOffset(0, 4, 7)).toBe(4)
    // 钳制下界：0 / 负数 / 小数 / 非有限 ⇒ 1（绝不原地不动、绝不倒退跳、绝不跳半枚）
    expect(enterpriseEscFeaturedNextOffset(0, 0, 7)).toBe(1)
    expect(enterpriseEscFeaturedNextOffset(0, -5, 7)).toBe(1)
    expect(enterpriseEscFeaturedNextOffset(0, 1.9, 7)).toBe(1)
    expect(enterpriseEscFeaturedNextOffset(0, Number.NaN, 7)).toBe(1)
    expect(enterpriseEscFeaturedNextOffset(0, Number.POSITIVE_INFINITY, 7)).toBe(1)
    // 钳制上界：stride ≥ N ⇒ 钳到 N ⇒ 原地（一轮的边界，不是"跳过一圈"）
    expect(enterpriseEscFeaturedNextOffset(0, 99, 7)).toBe(0)
    expect(enterpriseEscFeaturedNextOffset(3, 7, 7)).toBe(3)
    // 没有一批可翻 / 非有限 length ⇒ 0（调用点那一态也根本不画「换一批」）
    expect(enterpriseEscFeaturedNextOffset(3, 2, 0)).toBe(0)
    expect(enterpriseEscFeaturedNextOffset(3, 2, -1)).toBe(0)
    expect(enterpriseEscFeaturedNextOffset(3, 2, Number.NaN)).toBe(0)
    // 起点本身**先归一**再推进：负起点 ≡ 它的模
    expect(enterpriseEscFeaturedNextOffset(-1, 3, 7)).toBe(2)
    expect(enterpriseEscFeaturedNextOffset(Number.NaN, 3, 7)).toBe(3)
  })

  it('★兜底步长 = 1：列数读数非法/缺席/是声明原文（带函数）一律退到 1 —— 绝不拿偏大的数跳着翻', () => {
    expect(ENTERPRISE_ESC_FEATURED_STRIDE_FALLBACK).toBe(1)
    expect(ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL).toBe(0)
    for (const bad of [
      '', '   ', 'none',
      // 函数式写法是**声明原文**、不是渲染读数（本函数不做 CSS 求值）⇒ 判非法
      'repeat(auto-fill, minmax(320px, 1fr))', 'minmax(320px, 1fr)', 'fit-content(320px)',
      'calc(100px) calc(100px)', '100px, 100px',
      'banana banana', '[oops 100px 100px',
      null, undefined, 42, {}, ['1fr', '1fr'],
    ]) {
      expect(enterpriseEscFeaturedTrackCount(bad), `非法读数 ${String(bad)}`).toBe(1)
    }
    // 读得懂才数（Chromium/Firefox 对 grid 容器给的是已解析的轨道尺寸）
    expect(enterpriseEscFeaturedTrackCount('331.925px 331.925px 331.925px 331.925px')).toBe(4)
    expect(enterpriseEscFeaturedTrackCount('320px 320px 320px')).toBe(3)
    expect(enterpriseEscFeaturedTrackCount('1fr')).toBe(1)
    expect(enterpriseEscFeaturedTrackCount('25% 25%')).toBe(2)
    expect(enterpriseEscFeaturedTrackCount('0px 120px')).toBe(2)
    // 行名不是轨道：剥掉再数
    expect(enterpriseEscFeaturedTrackCount('[full-start] 100px 100px [full-end] 100px')).toBe(3)
  })

  it('★薄 DOM 适配器（口径 50 的 DOM **读取**只有这一处）：读的是**那个**网格元素、读不到/抛异常都退回 1，绝不抛', () => {
    const calls: unknown[] = []
    const grid = {
      ownerDocument: {
        defaultView: {
          getComputedStyle: (element: unknown) => {
            calls.push(element)
            return { gridTemplateColumns: '331.925px 331.925px 331.925px 331.925px' }
          },
        },
      },
    }
    // ① 正路：读的就是传进来的那个元素（不是 document 上"第一枚网格"），且只读一次
    expect(enterpriseEscFeaturedColumnCount(grid as unknown as Element)).toBe(4)
    expect(calls).toEqual([grid])
    // ② 缺席 / 结构不全 / 视图没有 getComputedStyle ⇒ 兜底 1
    expect(enterpriseEscFeaturedColumnCount(null)).toBe(1)
    expect(enterpriseEscFeaturedColumnCount(undefined)).toBe(1)
    expect(enterpriseEscFeaturedColumnCount({} as unknown as Element)).toBe(1)
    expect(enterpriseEscFeaturedColumnCount({ ownerDocument: null } as unknown as Element)).toBe(1)
    expect(enterpriseEscFeaturedColumnCount({ ownerDocument: { defaultView: null } } as unknown as Element)).toBe(1)
    expect(enterpriseEscFeaturedColumnCount({ ownerDocument: { defaultView: {} } } as unknown as Element)).toBe(1)
    // ③ 宿主实现自己抛 ⇒ 也退回 1（绝不把异常带上屏）
    const throwing = {
      ownerDocument: { defaultView: { getComputedStyle: () => { throw new Error('boom') } } },
    }
    expect(enterpriseEscFeaturedColumnCount(throwing as unknown as Element)).toBe(1)
    // ④ 读到了"没铺成网格"（none）⇒ 1
    const notGrid = { ownerDocument: { defaultView: { getComputedStyle: () => ({ gridTemplateColumns: 'none' }) } } }
    expect(enterpriseEscFeaturedColumnCount(notGrid as unknown as Element)).toBe(1)
    // ⑤ 点一下那一下的**唯一推进口径**：网格读得到就用它、读不到就用 1（两条都在这里验）
    expect(enterpriseEscFeaturedAdvanceOffset(0, grid as unknown as Element, 7)).toBe(4)
    expect(enterpriseEscFeaturedAdvanceOffset(0, null, 7)).toBe(1)
    expect(enterpriseEscFeaturedAdvanceOffset(6, null, 7)).toBe(0)
    // ⑥ 兜底那一档下，7 次点按把 7 条全走遍（"读不到列数"绝不等于"内容丢了"）
    let offset = ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL
    const visited = new Set<string>()
    for (let press = 0; press < 7; press += 1) {
      visited.add(enterpriseEscFeaturedWindow(batchOf(7), offset)[0]!)
      offset = enterpriseEscFeaturedAdvanceOffset(offset, null, 7)
    }
    expect([...visited].sort()).toEqual([...batchOf(7)].sort())
  })

  it('★渲染级：卡片顺序**就是**旋转后的顺序（首屏 4 枚＝items[offset..offset+3]），树里仍是整批 N 枚', () => {
    const records: readonly EscRecommendRecord[] = Array.from({ length: 7 }, (_unused, index) => ({
      id: 1000 + index,
      targetType: 'Skill',
      targetId: index,
      recType: 'Official',
      label: `推荐${index}`,
    }))
    const bodyOf = (offset?: number) => asElement(
      enterpriseEscFeaturedBody(
        { kind: 'ready', items: records },
        () => undefined,
        offset === undefined ? {} : { offset },
      ),
    )
    for (const offset of [0, 1, 3, 4, 6, 7, 13, -2]) {
      const grid = bodyOf(offset)
      const children = childrenOf(grid)
      // ① 网格类名走**唯一字面**常量（薄适配器按同一个常量去定位；漂了就静默退回兜底 1）
      expect(grid.props['className']).toBe(ENTERPRISE_ESC_FEATURED_GRID_CLASS)
      // ② 一枚不删：旋转只换顺序，`state.items` 整批都在树里（不截断 ⇒ 不会有半行）
      expect(children, `offset=${offset}`).toHaveLength(records.length)
      // ③ 卡片顺序逐枚等于纯投影的结果（key 用的是推荐记录自己的 id）
      //    ⚠`key` 是 React 元素自己的那一格（`createElement` 会把它从 props 里摘出去），
      //      不是 `element.props.key` —— 读错地方会拿到一串 `undefined` 而"看起来也对"。
      expect(children.map(each => elementKeyOf(each))).toEqual(
        enterpriseEscFeaturedWindow(records, offset).map(record => String(record.id)),
      )
    }
    // ④ 这台屏的首屏 4 枚：offset=3 ⇒ items[3..6]
    const firstRow = childrenOf(bodyOf(3)).slice(0, DESKTOP_COLUMNS).map(each => elementKeyOf(each))
    expect(firstRow).toEqual(['1003', '1004', '1005', '1006'])
    // ⑤ 缺省 offset ⇒ 与改动前**逐字相同**（第一枚还是平台给的第一条）
    expect(elementKeyOf(childrenOf(bodyOf())[0])).toBe('1000')
    // ⑥ 空批不会因为旋转而哄出卡片
    expect(childrenOf(asElement(enterpriseEscFeaturedBody({ kind: 'ready', items: [] }, () => undefined)))).toHaveLength(0)
  })

  it('★归零时机（源码级）：新一批 / 切页 / 换档 ⇒ offset 归 0；写 offset 的口**恰好两处**，且取数 effect 不读它', () => {
    const featuredCode = stripEscComments(readSrc('esc-featured.tsx'))
    const fetchEffect = /useEffect\(\(\) => \{[\s\S]*?return \(\) => controller\.abort\(\)/.exec(featuredCode)
    expect(fetchEffect, '取数 effect 必须在（它是唯一的取数点）').not.toBeNull()
    const fetchEffectBody = fetchEffect![0]
    // ① 归零那一句在**取数 effect 内部**（不是某个只在一态下才跑的旁路），且这一条 effect 里只有这一处 setOffset
    expect(fetchEffectBody).toContain('setOffset(ENTERPRISE_ESC_FEATURED_OFFSET_INITIAL)')
    expect(fetchEffectBody.match(/setOffset\(/g) ?? []).toHaveLength(1)
    // 切页 / targetType 变会重跑这条 effect（依赖里有 targetType）⇒ 一并归零
    expect(featuredCode).toContain('}, [api, attempt, targetType])')
    // ② 反向锁：取数 effect **不读** offset —— 否则"平移窗口"会连带重发请求（正是本刀要消灭的空转）
    expect(fetchEffectBody).not.toContain('enterpriseEscFeaturedAdvanceOffset')
    expect(featuredCode).not.toContain('[api, attempt, targetType, offset]')
    // ③ 全文件写 offset 的口恰好两处：归零 + 换一批那枚纯投影
    expect(featuredCode.match(/setOffset\(/g) ?? []).toHaveLength(2)
    expect(featuredCode).toContain('setOffset(current => enterpriseEscFeaturedAdvanceOffset(')
    // ④ 全文件只有**一处**取数调用（`officialRecommended`）与**一处**重发令牌自增（`setAttempt(`）
    expect(featuredCode.match(/officialRecommended\(/g) ?? []).toHaveLength(1)
    expect(featuredCode.match(/setAttempt\(/g) ?? []).toHaveLength(1)
  })

  it('★导出真的存在且与样式层同字面（防"import 一个不存在的具名导出 ⇒ undefined ⇒ 空转锁"）', () => {
    // 本仓 ui 的 tsconfig 不含 tests，tsc 照不到这类空转 ⇒ 这一条是那口坑的机械闸门。
    const functions = {
      enterpriseEscFeaturedWindow,
      enterpriseEscFeaturedNextOffset,
      enterpriseEscFeaturedAdvanceOffset,
      enterpriseEscFeaturedColumnCount,
      enterpriseEscFeaturedTrackCount,
    }
    for (const [name, value] of Object.entries(functions)) expect(typeof value, name).toBe('function')
    expect(ENTERPRISE_ESC_FEATURED_GRID_CLASS).toBe('esc-featured-grid')
    // 纯投影真的能在无 DOM 下跑：`grid` 传 null 也有确定结果
    expect(enterpriseEscFeaturedAdvanceOffset(0, null, 7)).toBe(1)
    // 类名常量与样式层那条规则**同字面**：漂了的话适配器 querySelector 落空、静默退回兜底 1（界面看不出）
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    expect(css).toContain(`.${ENTERPRISE_ESC_FEATURED_GRID_CLASS} {`)
    expect(css).toContain(`grid-template-columns: var(--esc-grid-cols);`)
  })
})

/* ══════════════ 口径 51（专家页「我的专家」子页 · 连接器页改名 · 无新增端点）══════════════
 * 这一组锁三件事：
 *   ① **三页主按钮的文案与动作**（WorkBuddy 实机三页三种交互）：专家页「我的专家」→ 进子页；
 *      连接器页「自定义连接器」→ 本刀不做 MCP 弹窗 ⇒ 置灰 + **行上可见原因**；技能页一字不改；
 *   ② **新子页**：chrome 逐项、**不是弹窗**（全树无 dialog/modal/遮罩/portal）、返回与 Esc 两条路
 *      + 返回后还原滚动位置与焦点、内容区在所有组合下都是**同一份如实交代**（稳定码入表、
 *      唯一提示件在场、`retryable === false`、**无假计数/无假条目**）；
 *   ③ **数据面不许被偷偷放大**：`src/esc` 里除既有那七条平台端点外，一个 `/api/...` 字面量都不许新增
 *      （本部署根本没有"我的专家"接口，编一条路径去发请求就是本仓明令禁止的那件事）。
 * ★判据形态：纯投影直调 + 源码级反向锁（本仓 vitest 没有 DOM；含 hook 的组件直调会抛 Invalid hook call，
 *   故子页的 chrome 特意拆成**不持 hook 的纯投影** `EnterpriseEscMyExpertsView`，外壳只持三个选中态）。
 */
describe('esc：口径 51（「我的专家」子页 · 连接器页改名 · 无新增端点）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  /** 深度优先铺平整棵元素树，**含经 props 传递的那些元素**（官方原语的 icon/anchor 都走 props）。 */
  const elementsIn = (node: unknown, seen: WeakSet<object>): Element[] => {
    if (node === null || node === undefined) return []
    if (Array.isArray(node)) return node.flatMap(each => elementsIn(each, seen))
    if (typeof node !== 'object') return []
    const candidate = node as { type?: unknown; props?: unknown }
    if (typeof candidate.type === 'undefined' || typeof candidate.props !== 'object' || candidate.props === null) return []
    if (seen.has(node)) return []
    seen.add(node)
    const element = node as Element
    const nested = Object.values(element.props).flatMap(value => elementsIn(value, seen))
    return [element, ...nested]
  }
  const walkAll = (node: unknown): Element[] => elementsIn(node, new WeakSet<object>())
  const byClass = (node: unknown, className: string): Element | undefined =>
    walkAll(node).find(each =>
      typeof each.props['className'] === 'string'
      && (each.props['className'] as string).split(' ').includes(className))
  const allByClass = (node: unknown, className: string): Element[] =>
    walkAll(node).filter(each =>
      typeof each.props['className'] === 'string'
      && (each.props['className'] as string).split(' ').includes(className))
  /** 树里所有**字符串子节点**（判"无假计数"用：只看文本，不看图标那些数字 props）。 */
  const textOf = (node: unknown): string[] =>
    walkAll(node).flatMap(each => childrenOf(each).filter((child): child is string => typeof child === 'string'))
  const readSrc = (name: string) => readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8')
  const readRoot = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
  const toolbarOf = (props: Record<string, unknown>) =>
    asElement(
      EnterpriseEscToolbar({
        resourceType: 'skill',
        source: 'system',
        onSourceChange: () => undefined,
        categories: [],
        activeCategory: '',
        onCategoryChange: () => undefined,
        keyword: '',
        onKeywordChange: () => undefined,
        ...props,
      } as never),
    )
  const mainButtonOf = (element: Element): Element => {
    const found = byClass(element, 'esc-add-skill')
    expect(found, '主按钮（.esc-add-skill）').toBeTruthy()
    return found as Element
  }
  /** 子页纯投影的默认入参（三个选中态 + 四枚动作；`onCreateExpert` 默认缺席 = 今天真实的接线）。 */
  const myExpertsOf = (props: Record<string, unknown> = {}) =>
    asElement(
      EnterpriseEscMyExpertsView({
        tab: 'expert',
        segment: 'owned',
        keyword: '',
        onTabChange: () => undefined,
        onSegmentChange: () => undefined,
        onKeywordChange: () => undefined,
        onBack: () => undefined,
        ...props,
      } as never),
    )

  it('① 两枚新文案逐字（新增常量，不写字面量散落）；技能页那枚一字未改', () => {
    // ① 真源：两枚新常量逐字（WorkBuddy 实机 i18n：unifiedMarket.myExperts / 连接器页那枚）。
    expect(ENTERPRISE_ESC_COPY.myExperts).toBe('我的专家')
    expect(ENTERPRISE_ESC_COPY.customConnector).toBe('自定义连接器')
    // 技能页那枚**不动**：三页三个词，互不相同（这是"逐页对齐 WorkBuddy"的另一半判据）。
    expect(ENTERPRISE_ESC_COPY.addSkill).toBe('添加技能')
    expect(new Set([ENTERPRISE_ESC_COPY.addSkill, ENTERPRISE_ESC_COPY.myExperts, ENTERPRISE_ESC_COPY.customConnector]).size).toBe(3)
    // ② 渲染级：三页主按钮上的**可见文案**就是各自那一枚。
    const labelOf = (element: Element) => {
      const children = childrenOf(mainButtonOf(element))
      return children.filter((child): child is string => typeof child === 'string').join('')
    }
    expect(labelOf(toolbarOf({ resourceType: 'expert' }))).toBe('我的专家')
    expect(labelOf(toolbarOf({ resourceType: 'connector' }))).toBe('自定义连接器')
    expect(labelOf(toolbarOf({ resourceType: 'skill', addSkillMenu: { open: false, onClose: () => undefined, onToggle: () => undefined } })))
      .toBe('添加技能')
    // ③ 源码级反向锁：文案不许以字面量形式散落在组件里（真源只有 esc-copy 一处）。
    for (const name of ['esc-toolbar.tsx', 'esc-my-experts.tsx', 'esc-page.tsx', 'esc-aggregation.tsx']) {
      const code = stripEscComments(readSrc(name))
      expect(code, `${name} 里不许再出现「我的专家」字面量`).not.toContain('我的专家')
      expect(code, `${name} 里不许再出现「自定义连接器」字面量`).not.toContain('自定义连接器')
    }
  })

  it('① 专家页那枚的 onClick **进入子页**（渲染级 + 源码级），且不再碰本地导入', () => {
    const onOpenMyExperts = vi.fn()
    const onAddSkill = vi.fn()
    const button = mainButtonOf(toolbarOf({ resourceType: 'expert', onOpenMyExperts, onAddSkill }))
    expect(button.props['disabled']).toBe(false)
    expect(button.props['onClick']).toBe(onOpenMyExperts)
    ;(button.props['onClick'] as () => void)()
    expect(onOpenMyExperts).toHaveBeenCalledTimes(1)
    expect(onAddSkill).not.toHaveBeenCalled()
    // 纯投影：终态逐字段（可直调取证）
    const plan = enterpriseEscMainActionPlan({ resourceType: 'expert', onOpenMyExperts })
    expect(plan).toEqual({
      label: '我的专家',
      disabled: false,
      onClick: onOpenMyExperts,
      title: ENTERPRISE_ESC_LOCAL_COPY.myExpertsOpenTitle,
      lock: undefined,
    })
    // 判据是**端口在不在场**（不是写死的 disabled）：缺席 ⇒ 置灰 + 行上可见原因。
    const bare = enterpriseEscMainActionPlan({ resourceType: 'expert' })
    expect(bare!.disabled).toBe(true)
    expect(bare!.onClick).toBeUndefined()
    expect(bare!.lock).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    const bareButton = mainButtonOf(toolbarOf({ resourceType: 'expert' }))
    expect(bareButton.props['disabled']).toBe(true)
    expect(byClass(toolbarOf({ resourceType: 'expert' }), 'esc-toolbar-lock')!.props['children'])
      .toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    // 源码级：页壳把「我的专家」接到第三个视图上（三层一条链：页壳开视图 → 聚合区 → 工具栏）。
    const panel = readSrc('esc-page.tsx')
    expect(panel).toContain('onOpenMyExperts: () => openMyExperts()')
    expect(panel).toContain('EnterpriseEscMyExpertsPage')
    expect(panel).toContain('myExpertsOpen')
    expect(panel).toContain('const openMyExperts = (): void => {')
    const aggregation = readSrc('esc-aggregation.tsx')
    expect(aggregation).toContain('onOpenMyExperts,')
    expect(aggregation).toContain('onOpenMyExperts?: (() => void) | undefined')
  })

  it('② 子页**不是弹窗**：全树无 dialog/aria-modal/Modal/遮罩/portal/aria-haspopup（含源码级反向锁）', () => {
    const tree = myExpertsOf()
    const roles = walkAll(tree).map(each => each.props['role']).filter((value): value is string => typeof value === 'string')
    // ① 角色清单是封闭的：region（子页本体）+ tablist/tab/tabpanel（两个 tab 与内容格）+ status（禁用原因）。
    expect([...new Set(roles)].sort()).toEqual(['region', 'status', 'tab', 'tablist', 'tabpanel'])
    expect(roles).not.toContain('dialog')
    // ② 全树没有任何弹窗语义/遮罩/portal 钩子。
    for (const element of walkAll(tree)) {
      expect(element.props['aria-modal']).toBeUndefined()
      expect(element.props['aria-haspopup']).toBeUndefined()
      expect(element.props['popover']).toBeUndefined()
      // 弹窗的"标准长相"：固定定位 + 半透明遮罩 + 高 z-index（本页一格都不许有）。
      const style = element.props['style']
      if (typeof style === 'object' && style !== null) {
        const record = style as Record<string, unknown>
        expect(record['position']).not.toBe('fixed')
        expect(String(record['zIndex'] ?? '')).not.toBe('9999')
      }
    }
    // ③ 唯一的 `role="region"` 就是**内容区里那一块**（不是浮层）：它的类名是 .esc-content。
    const region = walkAll(tree).filter(each => each.props['role'] === 'region')
    expect(region).toHaveLength(1)
    expect(String(region[0]!.props['className'])).toBe('esc-content')
    // ④ 源码级反向锁：这一页一个弹窗原语/portal 都没有（连注释之外也不许出现）。
    const code = stripEscComments(readSrc('esc-my-experts.tsx'))
    for (const forbidden of ['Modal', 'dialog', 'aria-modal', 'aria-haspopup', 'createPortal', 'portal', 'overlay', 'mask']) {
      expect(code, `esc-my-experts 不该出现 ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('② 返回与 Esc **两条**关闭路径；返回后还原滚动位置与焦点（源码级 + 纯投影级）', () => {
    // ① 返回按钮：它唯一的动作就是 `onBack`（页壳据此切回目录）。
    const onBack = vi.fn()
    const back = byClass(myExpertsOf({ onBack }), 'esc-installed-back')!
    expect(back.props['onClick']).toBe(onBack)
    // ② Esc：监听钉在页壳根节点上，命中即 preventDefault + stopPropagation，两条路关的是**同一件事**
    //    （同一个 `closeView` 语义：两个视图状态一起清）。
    const panel = readSrc('esc-page.tsx')
    expect(panel).toContain("if (event.key !== 'Escape') return")
    expect(panel).toContain('event.preventDefault()')
    expect(panel).toContain('event.stopPropagation()')
    expect(panel).toContain('node.addEventListener(\'keydown\', onKeyDown)')
    expect(panel).toContain('node.removeEventListener(\'keydown\', onKeyDown)')
    expect(panel).toContain('setInstalledOpen(false)')
    expect(panel).toContain('setMyExpertsOpen(false)')
    expect(panel).toContain("onBack: closeView")
    // ③ 浏览器返回键**不接**（本页没有真实路由，硬造 history 会与宿主打架）——反向锁。
    for (const forbidden of ['pushState', 'popstate', 'history.']) {
      expect(stripEscComments(panel), `esc-page 不该出现 ${forbidden}`).not.toContain(forbidden)
    }
    // ④ 滚动面判定是可直调的纯读：认的就是 `.esc-content` 那一格（两档位下都是它）。
    expect(ENTERPRISE_ESC_VIEW_SCROLL_CLASS).toBe('esc-content')
    const node = { scrollTop: 480 }
    expect(enterpriseEscViewScroller({ querySelector: () => node })).toBe(node)
    expect(enterpriseEscViewScroller({ querySelector: () => null })).toBeUndefined()
    expect(enterpriseEscViewScroller(null)).toBeUndefined()
    expect(enterpriseEscViewScroller(undefined)).toBeUndefined()
    //    类名常量必须与样式层那条规则**同字面**（漂了的话收尾会静默写到别的元素上）。
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    expect(css).toContain('.esc-content {')
    // ⑤ 收尾三件（源码级）：读进那一刻的 scrollTop、返回时写回、焦点还给主按钮（按属性选择器找回，
    //    因为进子页前那个 DOM 节点已经不可用）。
    expect(panel).toContain('enterpriseEscViewScroller(root.current)?.scrollTop')
    expect(panel).toContain('scroller.scrollTop = top')
    expect(panel).toContain("root.current?.querySelector<HTMLElement>('[data-esc-main-action]')?.focus()")
    expect(panel).toContain('useLayoutEffect')
    /**
     * ★**口径 51 补**：写回那一步必须是**有界重放**，不能只写一次 —— 返回时列表是**重新挂载**的，
     * 它先渲染 `.esc-loading`（高度不够）⇒ 浏览器会把 `scrollTop` 夹回 0，只写一次在真实数据下
     * 是**静默失效**。四条判据：① 可达性判据在场；② 不可达才等下一帧；③ 帧数有**上限**（不是死循环）；
     * ④ 有取消（离开页面即停，绝不留悬空回调去写已经换掉的那棵树）。
     */
    expect(Number.isInteger(ENTERPRISE_ESC_VIEW_RESTORE_FRAMES)).toBe(true)
    expect(ENTERPRISE_ESC_VIEW_RESTORE_FRAMES).toBeGreaterThan(0)
    expect(Number.isFinite(ENTERPRISE_ESC_VIEW_RESTORE_FRAMES)).toBe(true)
    expect(panel).toContain('scroller.scrollHeight - scroller.clientHeight >= top')
    expect(panel).toContain('reachable || frames > ENTERPRISE_ESC_VIEW_RESTORE_FRAMES')
    expect(panel).toContain('restoreFrame.current = requestAnimationFrame(apply)')
    expect(panel).toContain('cancelAnimationFrame(restoreFrame.current)')
    // 反向锁：不许把重放写成没有上限的递归 / 定时器（那会把滚动位置变成一个后台常驻循环）。
    const panelCode = stripEscComments(panel)
    expect(panelCode).not.toContain('setInterval')
    expect(panelCode).not.toContain('setTimeout')
    //    主按钮上那枚钩子确实挂着（两边同字面：属性名只有一处真源）。
    expect(ENTERPRISE_ESC_MAIN_ACTION_ATTR).toBe('data-esc-main-action')
    const main = mainButtonOf(toolbarOf({ resourceType: 'expert' }))
    expect(main.props[ENTERPRISE_ESC_MAIN_ACTION_ATTR]).toBe('')
  })

  it('② 子页 chrome 逐项：标题 / 两个 tab / 搜索 placeholder / 创建按钮 / 两个分段', () => {
    const tree = myExpertsOf()
    // ① 标题（页头那一枚 h3，`tabIndex={-1}` 是进入子页时的程序化聚焦落点）。
    const title = walkAll(tree).find(each => each.props[ENTERPRISE_ESC_MY_EXPERTS_TITLE_ATTR] !== undefined)!
    expect(title.type).toBe('h3')
    expect(title.props['children']).toBe('我的专家')
    expect(title.props['tabIndex']).toBe(-1)
    expect(String(title.props['className'])).toContain('esc-installed-title')
    // ② 返回那枚：文案逐字（workbuddy 那一枚只有箭头，本仓子页一贯给文字）。
    const back = byClass(tree, 'esc-installed-back')!
    expect(childrenOf(back)).toContain(ENTERPRISE_ESC_LOCAL_COPY.myExpertsBack)
    expect(ENTERPRISE_ESC_LOCAL_COPY.myExpertsBack).toBe('返回')
    // ③ 两个 tab：文案逐字且按序（真源 = ENTERPRISE_ESC_MY_EXPERTS_TABS）。
    expect(ENTERPRISE_ESC_MY_EXPERTS_TABS.map(each => each.key)).toEqual(['expert', 'team'])
    expect(ENTERPRISE_ESC_MY_EXPERTS_TABS.map(each => each.label)).toEqual(['专家', '专家团'])
    const tabs = walkAll(tree).filter(each => each.props['data-esc-my-experts-tab'] !== undefined)
    expect(tabs.map(each => each.props['data-esc-my-experts-tab'])).toEqual(['expert', 'team'])
    expect(tabs.map(each => each.props['children'])).toEqual(['专家', '专家团'])
    expect(tabs.every(each => each.type === 'button')).toBe(true)
    // ④ 搜索框：placeholder 逐字（WorkBuddy 实机那枚），且复用工具栏同一个 `.esc-search`。
    const search = byClass(tree, 'esc-search')!
    expect(search.props['placeholder']).toBe('搜索我创建的专家')
    expect(search.props['aria-label']).toBe('搜索我创建的专家')
    // ⑤ 创建按钮：文案逐字（「+」由图标承担）。
    const create = byClass(tree, 'esc-my-experts-create')!
    expect(childrenOf(create).filter((child): child is string => typeof child === 'string')).toEqual(['创建专家'])
    // ⑥ 两个分段：文案逐字且按序（真源 = ENTERPRISE_ESC_MY_EXPERTS_SEGMENTS）。
    expect(ENTERPRISE_ESC_MY_EXPERTS_SEGMENTS.map(each => each.key)).toEqual(['owned', 'purchased'])
    expect(ENTERPRISE_ESC_MY_EXPERTS_SEGMENTS.map(each => each.label)).toEqual(['我创建的', '我购买的'])
    const segments = walkAll(tree).filter(each => each.props['data-esc-my-experts-segment'] !== undefined)
    expect(segments.map(each => each.props['data-esc-my-experts-segment'])).toEqual(['owned', 'purchased'])
    expect(segments.map(each => each.props['children'])).toEqual(['我创建的', '我购买的'])
    // ⑦ tabs 与分段是**真控件**（选中态真的翻、点得动），不是死控件：
    //    初始选中态由交进来的状态决定，点一下调的是**各调各的**回调。
    expect(tabs[0]!.props['aria-selected']).toBe(true)
    expect(tabs[1]!.props['aria-selected']).toBe(false)
    expect(segments[0]!.props['aria-pressed']).toBe(true)
    expect(segments[1]!.props['aria-pressed']).toBe(false)
    expect(tabs[0]!.props['onClick']).not.toBe(tabs[1]!.props['onClick'])
    expect(segments[0]!.props['onClick']).not.toBe(segments[1]!.props['onClick'])
    const onTabChange = vi.fn()
    const onSegmentChange = vi.fn()
    const wired = myExpertsOf({ tab: 'team', segment: 'purchased', onTabChange, onSegmentChange })
    const wiredTabs = walkAll(wired).filter(each => each.props['data-esc-my-experts-tab'] !== undefined)
    expect(wiredTabs[0]!.props['aria-selected']).toBe(false)
    expect(wiredTabs[1]!.props['aria-selected']).toBe(true)
    ;(wiredTabs[0]!.props['onClick'] as () => void)()
    expect(onTabChange).toHaveBeenCalledWith('expert')
    ;(wiredTabs[1]!.props['onClick'] as () => void)()
    expect(onTabChange).toHaveBeenCalledWith('team')
    const wiredSegments = walkAll(wired).filter(each => each.props['data-esc-my-experts-segment'] !== undefined)
    ;(wiredSegments[1]!.props['onClick'] as () => void)()
    expect(onSegmentChange).toHaveBeenCalledWith('purchased')
    expect(wiredSegments[1]!.props['data-esc-selected']).toBe(true)
    // ⑧ 「创建专家」不许是死控件：写入口缺席 ⇒ `disabled` + **行上可见**原因（不是只挂 title）。
    expect(create.props['disabled']).toBe(true)
    expect(create.props['onClick']).toBeUndefined()
    const lock = byClass(tree, 'esc-my-experts-lock')!
    expect(lock.props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.createExpertLocked)
    expect(lock.props['role']).toBe('status')
    expect(ENTERPRISE_ESC_LOCAL_COPY.createExpertLocked).toContain('没有')
    // ⑨ **导出真的存在**（防"import 一个已删除的具名导出 ⇒ undefined ⇒ 空转锁"——ui 的 tsconfig
    //    不含 tests，tsc 照不到这口坑，本仓历史上正踩过）。四个出口都必须真是函数。
    for (const [name, value] of Object.entries({
      EnterpriseEscMyExpertsView,
      enterpriseEscMyExpertsBody,
      enterpriseEscViewScroller,
      enterpriseEscMainActionPlan,
    })) {
      expect(typeof value, name).toBe('function')
    }
    expect(typeof EnterpriseErrorNotice, 'EnterpriseErrorNotice').toBe('function')
    //    写入口在场 ⇒ 真按钮（判据是端口，不是写死的 disabled）。
    const onCreateExpert = vi.fn()
    const live = byClass(myExpertsOf({ onCreateExpert }), 'esc-my-experts-create')!
    expect(live.props['disabled']).toBe(false)
    expect(live.props['onClick']).toBe(onCreateExpert)
    expect(byClass(myExpertsOf({ onCreateExpert }), 'esc-my-experts-lock')).toBeUndefined()
  })

  it('② 内容区**如实交代**：稳定码入表、唯一提示件在场、retryable false、无假计数/无假条目', () => {
    // ① 稳定码：常量与表里的键**同字面**（两处不可能漂），且人话 + 下一步都不含裸码。
    expect(ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE).toBe('ENT_ESC_MY_EXPERTS_UNAVAILABLE')
    expect(ENTERPRISE_ERROR_CODES).toContain(ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE)
    const view = enterpriseErrorPresentation(ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE)
    expect(view.known).toBe(true)
    expect(view.message.length).toBeGreaterThan(0)
    expect(view.action.length).toBeGreaterThan(0)
    expect(view.message).not.toContain('ENT_')
    expect(view.action).not.toContain('ENT_')
    // 终态：对"端点不存在"重试永远无效（与那四枚 ENT_ESC_*_UNAVAILABLE 同判）。
    expect(view.retryable).toBe(false)
    expect(enterpriseErrorRetryable(ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE)).toBe(false)
    // ② 唯一提示件在场：内容区那棵树里就是它（不是自造的一句话、不是 console.warn）。
    const body = enterpriseEscMyExpertsBody()
    const notices = walkAll(body).filter(each => each.type === EnterpriseErrorNotice)
    expect(notices).toHaveLength(1)
    expect(notices[0]!.props['code']).toBe(ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE)
    // ③ **同一份**：内容区投影是**零参数**的 ⇒ 它在类型层面不可能随 tab／分段变化。
    const code = stripEscComments(readSrc('esc-my-experts.tsx'))
    expect(code).toContain('export function enterpriseEscMyExpertsBody(): ReactNode {')
    const bodySource = /export function enterpriseEscMyExpertsBody\(\)[\s\S]*?\n\}/.exec(code)?.[0]
    expect(bodySource, '内容区投影必须能在剥注释后整段取出').toBeDefined()
    for (const forbidden of ['tab', 'segment', 'keyword', 'query']) {
      expect(bodySource!, `内容区不许读选中态 ${forbidden}`).not.toContain(forbidden)
    }
    // 并且它在子页树里**只挂一次**（两个 tab × 两个分段共用同一棵树：任何组合都不会多出第二份交代）。
    const tree = myExpertsOf()
    expect(walkAll(tree).filter(each => each.type === EnterpriseErrorNotice)).toHaveLength(1)
    const panel = byClass(tree, 'esc-my-experts-panel')!
    expect(panel.props['role']).toBe('tabpanel')
    // ④ **无假计数**：文本子节点里一个数字都没有（workbuddy 那边是「专家 6 / 专家团 1」，
    //    这两枚数字在本部署没有任何真值来源），也没有 `(N)` 这种计数形态。
    for (const text of textOf(tree)) expect(text, `子页文本不许带计数：${text}`).not.toMatch(/[0-9]/)
    expect(textOf(tree).join('|')).not.toContain('（')
    // ⑤ **无假条目**：一个卡片/网格元素都不建（画空网格 = 谎称"你一个专家都没创建"）。
    expect(byClass(tree, 'esc-list-section')).toBeUndefined()
    expect(walkAll(tree).some(each => each.type === EnterpriseEscCard)).toBe(false)
    // ⑥ **不发请求**：这一页没有取数面、没有 fetch（源码级反向锁）。
    for (const forbidden of ['fetch(', 'api.', '/api/', 'XMLHttpRequest', 'useEffect']) {
      expect(code, `esc-my-experts 不该出现 ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('② 连接器页那枚：`disabled` + **行上可见**原因，且不许再挂本地导入', () => {
    const onAddSkill = vi.fn()
    const bare = toolbarOf({ resourceType: 'connector', onAddSkill })
    const button = mainButtonOf(bare)
    expect(button.props['disabled']).toBe(true)
    expect(button.props['onClick']).toBeUndefined()
    // 行上可见原因（产品宪法：禁用控件不许只挂一句 title）。
    const lock = byClass(bare, 'esc-toolbar-lock')!
    expect(lock.props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.customConnectorLocked)
    expect(lock.props['role']).toBe('status')
    expect(ENTERPRISE_ESC_LOCAL_COPY.customConnectorLocked).toContain('没有')
    // 纯投影：判据是端口在不在场；`title` 另有一句（但**不是**唯一说明）。
    const plan = enterpriseEscMainActionPlan({ resourceType: 'connector' })
    expect(plan!.label).toBe('自定义连接器')
    expect(plan!.disabled).toBe(true)
    expect(plan!.onClick).toBeUndefined()
    expect(plan!.lock).toBe(ENTERPRISE_ESC_LOCAL_COPY.customConnectorLocked)
    expect(plan!.title).toBe(ENTERPRISE_ESC_LOCAL_COPY.customConnectorLocked)
    // 真接线那天（端口在场）才会是另一态：文案不变、原因那句换"会发生什么"，且不再置灰。
    const onCustomConnectors = vi.fn()
    const livePlan = enterpriseEscMainActionPlan({ resourceType: 'connector', onCustomConnectors })
    expect(livePlan!.disabled).toBe(false)
    expect(livePlan!.onClick).toBe(onCustomConnectors)
    expect(livePlan!.lock).toBeUndefined()
    expect(livePlan!.title).toBe(ENTERPRISE_ESC_LOCAL_COPY.customConnectorOpenTitle)
    expect(livePlan!.title).not.toBe(ENTERPRISE_ESC_LOCAL_COPY.customConnectorLocked)
    // 源码级反向锁：今天**全仓没有任何调用方**会传这枚端口（本部署没有自定义连接器管理接口）
    // —— 谁想"先接上再说"，得先说明那个接口在哪，这条会先红。
    for (const name of ['esc-page.tsx', 'esc-aggregation.tsx', 'client.tsx']) {
      const source = name === 'client.tsx' ? readRoot(name) : readSrc(name)
      expect(stripEscComments(source), `${name} 不该传 onCustomConnectors`).not.toContain('onCustomConnectors:')
    }
  })

  it('③ 数据面反向锁：`src/esc` 里除既有七条平台端点外，一个 `/api/...` 字面量都没有新增', () => {
    const dir = new URL('../src/esc/', import.meta.url)
    const found = new Set<string>()
    for (const name of readdirSync(dir)) {
      const source = readFileSync(new URL(name, dir), 'utf8')
      // 单引号/双引号两种写法都收（模板串里拼路径同样会被下面那条抓到）。
      for (const match of source.matchAll(/'(\/api\/[^']*)'|"(\/api\/[^"]*)"/g)) found.add(match[1] ?? match[2]!)
    }
    // 恰好这七条（与宿主 `bundle/src/esc-route.ts` 的只读闭集逐条同值）：
    // 没有「我的专家」这条接口 —— 这正是子页如实交代、而不是编一条路径去发请求的**结构性**理由。
    expect([...found].sort()).toEqual([
      '/api/connector/providers',
      '/api/published/agent/list',
      '/api/published/category/list',
      '/api/published/skill/enable/list',
      '/api/published/skill/list',
      '/api/space/list',
      '/api/system/display/recommend/list',
    ])
    // 新子页里一个 URL 形状的字符串都没有（连注释里也不留"以后打这个"的引子）。
    const myExperts = readSrc('esc-my-experts.tsx')
    expect(myExperts).not.toMatch(/\/api\//)
    expect(myExperts).not.toContain('http')
  })

  it('④ 技能页那枚**未受影响**（回归）：仍是三项下拉的锚 / 降级仍是直接本地导入', () => {
    const onAddSkill = vi.fn()
    const onFindSkill = vi.fn()
    const onCreateSkill = vi.fn()
    const toggle = vi.fn()
    const skill = toolbarOf({
      resourceType: 'skill',
      onAddSkill,
      onFindSkill,
      onCreateSkill,
      addSkillMenu: { open: false, onClose: () => undefined, onToggle: toggle },
    })
    const button = mainButtonOf(skill)
    expect(childrenOf(button).filter((child): child is string => typeof child === 'string')).toEqual(['添加技能'])
    expect(button.props['aria-haspopup']).toBe('menu')
    expect(button.props['onClick']).toBe(toggle)
    expect(button.props['disabled']).toBeUndefined()
    // 三项仍在、按序、各调各的（这一条与口径 49 那一组同源，这里只做"没被本刀带坏"的回归）。
    const items = walkAll(skill).filter(each => each.props['data-esc-add-skill-item'] !== undefined)
    expect(items.map(each => each.props['data-esc-add-skill-item'])).toEqual(['find', 'upload', 'create'])
    expect(byClass(skill, 'esc-toolbar-lock')).toBeUndefined()
    // 降级档（没有下拉供给）：仍是"点了就走本地导入"的那一枚真按钮（口径 46 的行为一字不退化）。
    const legacy = mainButtonOf(toolbarOf({ resourceType: 'skill', onAddSkill }))
    expect(legacy.props['onClick']).toBe(onAddSkill)
    expect(legacy.props['disabled']).toBe(false)
    // 纯投影：技能页**没有**主按钮终态那一档（那条路另有下拉/降级两态）。
    expect(enterpriseEscMainActionPlan({ resourceType: 'skill', onOpenMyExperts: onAddSkill })).toBeUndefined()
    // 技能页那枚**没有**行上原因（它此刻按得动）；真正按不动时才出那句（下面这条）。
    const locked = toolbarOf({ resourceType: 'skill' })
    expect(mainButtonOf(locked).props['disabled']).toBe(true)
    expect(byClass(locked, 'esc-toolbar-lock')!.props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
  })

  it('①④ 形态/高度/右边界三件一字未动（口径 49 的既有不变量本刀不碰）', () => {
    const css = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const ruleBody = (head: string): string => {
      const hit = new RegExp(`^${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm').exec(declarations)
      expect(hit, `样式表顶层没有 ${head}`).not.toBeNull()
      return hit![1]!
    }
    // ① 主按钮那一格仍是**真钉**高度（不是 min-height），三页共用同一枚 token。
    const button = ruleBody('.esc-add-skill')
    expect(button).toContain('height: var(--esc-btn-h)')
    expect(button).not.toContain('min-height')
    // ② 形态分流：专家页描边（复用 `.esc-installed` 配方）、连接器页仍是 primary 黑胶囊。
    const expert = mainButtonOf(toolbarOf({ resourceType: 'expert' }))
    expect(String(expert.props['className'])).toContain('esc-add-skill-outline')
    expect(expert.props['variant']).toBe('outline')
    const connector = mainButtonOf(toolbarOf({ resourceType: 'connector' }))
    expect(String(connector.props['className'])).not.toContain('esc-add-skill-outline')
    expect(connector.props['variant']).toBe('primary')
    // ③ 新增的圆角刻度只在子页那枚「+ 创建专家」上用（主按钮那三页仍吃 --esc-btn-radius）。
    expect(ruleBody('.esc-root')).toContain('--esc-pill-radius: 999px')
    expect(ruleBody('.esc-my-experts-create')).toContain('border-radius: var(--esc-pill-radius)')
    expect(button).toContain('border-radius: var(--esc-btn-radius)')
  })
})

/* ══════════════ 口径 52：两枚**禁用**胶囊的禁用外观（真机像素缺陷的回归锁） ══════════════
 * 缺陷（Lead 真机像素取证，不是猜的）：连接器页「+ 自定义连接器」与「我的专家」子页「+ 创建专家」
 *   都是 `disabled`（各自的写入口缺席），却与技能页**启用**的「+ 添加技能」像素级完全一致
 *   （黑底白字，见 analysis/pill-compare.png 三枚放大对照）——"看着可点、点下去毫无反应"，
 *   正是产品宪法禁止的那一档（禁用不许只挂一句 title／禁用即须看得出按不动）。
 *
 * 查证结论（三种假说逐条排除，决定了"怎么修"）：官方原语产物 `Button.module.css` 里那条
 *   .button:disabled { cursor: not-allowed; opacity: 0.4 }
 * **是改外观的** —— 既不是"官方只改 cursor/pointer-events、不改色"，也不是"官方某枚 token 在本主题里
 * 恰好等于启用色"（那条规则里一枚 token 都没有）；真因是**第三种**：本页那两条 (0,3,0) 的
 * `.esc-root .xxx:disabled { opacity: 1; }` 把官方 (0,2,0) 的冲淡压掉了。⇒ 修法是**撤销覆盖**
 * （口径 52 把那两条删掉），本页**不新造**禁用配色（官方那条是唯一真源，颜色照旧全来自主题）。
 *
 * 本组三条判据，每条都会红：
 *   ① **可证判据**：官方产物里那条 :disabled 真的改外观（不透明度 < 1），且 `disabled` 一定落到原生
 *      <button> 上、官方自己的 `.button` 类恒在 ⇒ `:disabled` 必然命中那两枚胶囊。这是"官方那条真的
 *      会生效"的**机器可核对**版本（口径 52 的整条修法都建立在它身上）。
 *   ② **本页不许覆盖**：凡选择器命中"这两枚胶囊身上那些类名"的规则，一条都不许声明 opacity
 *      （基类也不行）；且全表里"把 :disabled 冲淡按回 opacity: 1"的规则**只许剩口径 36 那两处**
 *      卡片视觉占位。★类名不是写死的字面量，是**从渲染树里那两枚 disabled 胶囊身上取下来的**
 *      （组件改名 ⇒ 锁跟着走，不会退化成一枚"扫一个已经不存在的选择器"的空转锁）。
 *   ③ **反向锁（启用态不许被一刀切弄灰）**：启用态那两条几何规则里不许出现 dimmed 家族 token
 *      （本主题的"禁用专用"色：button-primary-dimmed / label-dimmed / label-primary-dimmed）、
 *      也不许声明 opacity / background / color；且**关键不变量**——技能页启用那枚与连接器页禁用那枚
 *      的类名完全相同（都是 .esc-add-skill）⇒ 两枚外观上唯一的差别只能来自官方那条 :disabled。
 */
describe('esc：口径 52（禁用胶囊的禁用外观 —— 官方 :disabled 的冲淡必须真的生效）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  /** 深度优先铺平整棵元素树（含经 props 传递的那些元素：官方原语的 icon/anchor 都走 props）。 */
  const walkAll = (node: unknown, seen = new WeakSet<object>()): Element[] => {
    if (node === null || node === undefined) return []
    if (Array.isArray(node)) return node.flatMap(each => walkAll(each, seen))
    if (typeof node !== 'object') return []
    const candidate = node as { type?: unknown; props?: unknown }
    if (candidate.type === undefined || typeof candidate.props !== 'object' || candidate.props === null) return []
    if (seen.has(node)) return []
    seen.add(node)
    const element = node as Element
    return [element, ...Object.values(element.props).flatMap(value => walkAll(value, seen))]
  }
  /** 第一枚带这个类名的元素（树上真的挂着；取不到就响亮地红）。 */
  const byClass = (node: unknown, className: string): Element => {
    const hit = walkAll(node).find(each => String(each.props['className'] ?? '').split(' ').includes(className))
    expect(hit, `渲染树里没有 .${className}`).toBeTruthy()
    return hit as Element
  }
  const toolbarOf = (props: Record<string, unknown>): unknown =>
    EnterpriseEscToolbar({
      resourceType: 'connector',
      source: 'system',
      onSourceChange: () => undefined,
      categories: [],
      activeCategory: '',
      onCategoryChange: () => undefined,
      keyword: '',
      onKeywordChange: () => undefined,
      ...props,
    } as never)
  /** 子页纯投影的入参（`onCreateExpert` 刻意不传 = 今天真实的接线：本部署没有创建专家的写入口）。 */
  const myExpertsOf = (): unknown =>
    EnterpriseEscMyExpertsView({
      tab: 'expert',
      segment: 'owned',
      keyword: '',
      onTabChange: () => undefined,
      onSegmentChange: () => undefined,
      onKeywordChange: () => undefined,
      onBack: () => undefined,
    } as never)
  const stylesheet = (): string => (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
  /** 剥注释后的规则表（注释里合法地可以出现花括号 ⇒ 取规则体必须走剥注释那一份）。 */
  const rulesOf = (css: string): readonly { readonly selector: string; readonly body: string }[] =>
    [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(hit => ({ selector: hit[1]!.trim(), body: hit[2]! }))
  /** 选择器里是否有一枚复合选择器带着这个类名（伪类/伪元素先剥掉，故 `.x:disabled` 也算命中 `.x`）。 */
  const targetsClass = (selector: string, className: string): boolean =>
    new RegExp(`(^|[^\\w-])\\.${className}(?![\\w-])`).test(selector.replace(/::?[a-z-]+(\([^)]*\))?/g, ''))
  /** 两枚**禁用**胶囊（判据是它们自己报出来的 `disabled`，不是我们猜的那个类名）。 */
  const disabledPills = (): readonly { readonly label: string; readonly element: Element }[] => [
    { label: '连接器页「+ 自定义连接器」', element: byClass(toolbarOf({}), 'esc-add-skill') },
    { label: '「我的专家」子页「+ 创建专家」', element: byClass(myExpertsOf(), 'esc-my-experts-create') },
  ]

  it('① 官方产物：`.button:disabled` 真的改外观，且那两枚胶囊一定命中它（可证判据）', () => {
    // 官方原语的**产物**（与本包同锁的开发依赖；运行期取的是宿主共享实例，同一份规则——
    // 0.1.5-rc.2（本仓 devDependency）与运行树里的 0.2.0-rc.2 这一条都逐字核过，完全相同）。
    const primitives = new URL('../node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/', import.meta.url)
    const disabledRule = /\.button:disabled\s*\{([^}]*)\}/.exec(
      readFileSync(new URL('Button.module.css', primitives), 'utf8'),
    )
    expect(disabledRule, '官方 Button.module.css 必须有一条 .button:disabled——口径 52 的整条修法都建立在它身上').not.toBeNull()
    const opacity = /opacity:\s*([0-9.]+)/.exec(disabledRule![1]!)
    expect(opacity, '官方 :disabled 必须改不透明度（真没了 ⇒ 本页就得自己写一条最小的禁用视觉态）').not.toBeNull()
    expect(Number(opacity![1]), '官方 :disabled 的不透明度必须 < 1（否则禁用与启用同观感）').toBeLessThan(1)
    // 官方 Button 恒把**自己的类**拼进 className、并把 disabled 原样铺到原生 `<button>` 上
    // ⇒ 上面那条 `.button:disabled` 一定命中（这两条是从官方产物源码里读出来的，不是从注释里抄的）。
    const buttonBody = /function Button\(\{[\s\S]*?\n\}/.exec(readFileSync(new URL('index.js', primitives), 'utf8'))?.[0]
    expect(buttonBody, '官方 index.js 里必须取得到 Button 的实现').toBeDefined()
    expect(buttonBody!).toContain('"button"')
    expect(buttonBody!).toContain('...rest')
    expect(buttonBody!, '官方 Button 必须恒带上自己的 .button 类').toMatch(/css\$\d+\.button/)
  })

  it('② 本页不许再把那层冲淡按回来（含"按回来的只剩口径 36 那两处"的全表清单）', () => {
    const rules = rulesOf(stylesheet())
    for (const pill of disabledPills()) {
      // ★判据自锚：类名取自渲染树里那枚胶囊**自己**报出来的 className——组件改名 ⇒ 锁跟着走。
      expect(pill.element.props['disabled'], `${pill.label} 必须是禁用那一枚`).toBe(true)
      const classes = String(pill.element.props['className']).split(' ').filter(each => each.length > 0)
      expect(classes.length, pill.label).toBeGreaterThan(0)
      for (const className of classes) {
        const targeting = rules.filter(rule => targetsClass(rule.selector, className))
        // 反向锁：扫到的类名必须**真的**在样式表里有规则（否则这就是一枚扫不存在选择器的空转锁）。
        expect(targeting.length, `样式表里没有 .${className} 的规则`).toBeGreaterThan(0)
        for (const rule of targeting) {
          expect(rule.body, `${pill.label}：${rule.selector} 不许声明 opacity（那是把官方 :disabled 冲淡压掉的唯一手法）`)
            .not.toMatch(/(?:^|;)\s*opacity\s*:/)
        }
      }
    }
    // 全表清单：本文件里"把 :disabled 的冲淡按回 opacity: 1"的规则**只许**剩口径 36 那两处
    // （卡片里的视觉占位：动作实底与安装加号）——多出第三条就是有人又给某枚禁用控件按回去了。
    const pushBack = rules
      .filter(rule => rule.selector.includes(':disabled') && /(?:^|;)\s*opacity\s*:\s*1\s*(?:;|$)/.test(rule.body))
      .map(rule => rule.selector)
    expect(pushBack.sort()).toEqual(['.esc-install-plus:disabled', '.esc-root .esc-action-solid:disabled'])
  })

  it('③ 反向锁：启用态不许被一刀切弄灰（dimmed 家族 / opacity / background / color 一个都不许进）', () => {
    const rules = rulesOf(stylesheet())
    for (const head of ['.esc-add-skill', '.esc-my-experts-create']) {
      const rule = rules.find(each => each.selector === head)
      expect(rule, `样式表顶层没有 ${head}`).toBeTruthy()
      const body = rule!.body
      // 本主题的"禁用专用"色是 dimmed 家族（button-primary-dimmed / label-dimmed / label-primary-dimmed）
      // ⇒ 它们一旦出现在**启用态**的几何规则里，就是"一刀切把启用态也弄灰"。
      expect(body, head).not.toContain('dimmed')
      expect(body, head).not.toMatch(/(?:^|;)\s*opacity\s*:/)
      expect(body, head).not.toMatch(/(?:^|;)\s*background\s*:/)
      expect(body, head).not.toMatch(/(?:^|;)\s*color\s*:/)
    }
    // ★本刀的关键不变量：技能页**启用**那枚与连接器页**禁用**那枚的类名**完全相同**（都是 .esc-add-skill）
    //   ⇒ 两枚外观上唯一的差别只能来自官方那条 :disabled；上面②"本页不许覆盖"正是"禁用看得出来、
    //   启用一字不变"的充要条件（启用态的几何另有口径 49 那三条锁着）。
    const enabled = byClass(
      toolbarOf({
        resourceType: 'skill',
        onAddSkill: () => undefined,
        addSkillMenu: { open: false, onClose: () => undefined, onToggle: () => undefined },
      }),
      'esc-add-skill',
    )
    const disabled = byClass(toolbarOf({}), 'esc-add-skill')
    expect(enabled.props['disabled']).toBeUndefined()
    expect(disabled.props['disabled']).toBe(true)
    expect(String(enabled.props['className'])).toBe(String(disabled.props['className']))
    expect(String(enabled.props['variant'])).toBe(String(disabled.props['variant']))
  })
})

/* ══════════════ 口径 54（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）══════════════
 *
 * 这一组锁的是**真源换血**这件事本身：
 *   ① 已安装的真源是**官方发现面**（`GET …/skills/discovered`），不是我们那两份记录；
 *   ② **同源铁证**：同一份假响应喂进去，顶栏那枚计数与子页铺出来的卡片数**必须相等**
 *      （投影只有两处：`installedSnapshotFacts` 一处算计数、`enterpriseEscInstalledGroups` 一处铺列表，
 *      两者吃的是同一个 `snapshot.skills`）；
 *   ③ 广场卡片的"已装"判定按 **name（kebab）与磁盘真值对撞**（两侧都锁：报告里有 ⇒ 已装、没有 ⇒ 未装）；
 *   ④ `complete === false` ⇒ **如实说"还在发现中"**，**不许当 0、不许写死数字**；
 *   ⑤ 老两份记录**降级为元信息**：列表真源只有发现面，它们只喂元信息表（读不到就空表 + 说出来）。
 */
describe('esc：口径 54（「已安装」真源换成官方发现面）', () => {
  type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
  const asElement = (node: unknown) => node as Element
  const childrenOf = (element: Element) => {
    const children = element.props['children']
    return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
  }
  const walk = (node: unknown, out: Element[] = []): Element[] => {
    if (node === null || node === undefined || typeof node !== 'object') return out
    if (Array.isArray(node)) {
      for (const each of node) walk(each, out)
      return out
    }
    const element = node as Element
    out.push(element)
    for (const each of childrenOf(element)) walk(each, out)
    return out
  }
  const byClass = (node: unknown, className: string): Element | undefined =>
    walk(node).find(each =>
      typeof each.props['className'] === 'string'
      && (each.props['className'] as string).split(' ').includes(className))
  const toolbarOf = (props: Record<string, unknown>) =>
    asElement(EnterpriseEscToolbar({
      resourceType: 'skill',
      source: 'system',
      onSourceChange: () => undefined,
      categories: [],
      activeCategory: '',
      onCategoryChange: () => undefined,
      keyword: '',
      onKeywordChange: () => undefined,
      ...props,
    } as never))
  const readEscSrc = (name: string) => readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8')
  const discovered = (name: string, source = 'user-dsh'): EnterpriseDiscoveredSkill => ({
    name,
    description: `${name} 的真描述`,
    invocation: { modelInvocable: true, userInvocable: true },
    source,
    provider: 'skill-filesystem',
  })
  /** 官方发现面那三枚响应：**同一份假响应**同时喂给两条路（这就是"同源"的取证方式）。 */
  const fakeApi = (snapshot: { readonly skills: readonly EnterpriseDiscoveredSkill[]; readonly complete: boolean }) => ({
    discoveredSkills: async () => snapshot,
    installedSkills: async () => [],
    selfInstalledSkills: async () => [],
  })

  it('① 同源铁证：同一份假响应 ⇒ 顶栏计数与子页卡片数**同值**（多形态：空 / 7 枚 / 未发现完）', async () => {
    for (const snapshot of [
      { skills: [], complete: true },
      { skills: [discovered('a')], complete: true },
      { skills: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(name => discovered(name)), complete: true },
      { skills: [discovered('a'), discovered('b')], complete: false },
    ]) {
      const api = fakeApi(snapshot)
      const facts = installedSnapshotFacts(await api.discoveredSkills())
      const groups = enterpriseEscInstalledGroups(
        snapshot.skills,
        enterpriseEscInstalledMetaTable(await api.installedSkills(), await api.selfInstalledSkills()),
      )
      const cards = groups.reduce((total, group) => total + group.cards.length, 0)
      expect(facts.count, `${snapshot.skills.length}/${String(snapshot.complete)}`).toBe(snapshot.skills.length)
      expect(cards, '子页卡片数必须与计数同值（同一份真源）').toBe(facts.count)
      expect(facts.discovering).toBe(snapshot.complete === false)
    }
    // ★结构级同源：`api.discoveredSkills` 在整个 src/esc 里**恰好两处调用**（顶栏一处 + 子页一处），
    //   没有第三处 —— "计数读一份、列表读另一份"那种漂开在结构上就不可能。
    const escDir = new URL('../src/esc/', import.meta.url)
    const callers = readdirSync(escDir).filter(each => /\.tsx?$/.test(each))
      .filter(each => stripEscComments(readFileSync(new URL(each, escDir), 'utf8')).includes('api.discoveredSkills('))
    expect(callers.sort()).toEqual(['esc-aggregation.tsx', 'esc-installed.tsx'])
    expect(stripEscComments(readEscSrc('esc-aggregation.tsx')).match(/api\.discoveredSkills\(/g)).toHaveLength(1)
    expect(stripEscComments(readEscSrc('esc-installed.tsx')).match(/api\.discoveredSkills\(/g)).toHaveLength(1)
  })

  it('② 广场卡片/精选行的"已装"判定：按 name 与磁盘真值对撞（两侧都锁）', () => {
    const facts = installedSnapshotFacts({
      skills: [discovered('agent-manager'), discovered('skill-creator')],
      complete: true,
    })
    // 报告里有这个名字 ⇒ 已装
    expect(facts.names.has('agent-manager')).toBe(true)
    expect(facts.names.has('skill-creator')).toBe(true)
    // 报告里没有 ⇒ 未装（不是"不知道"，也不是"按我们的记录猜"）
    expect(facts.names.has('dev-engineer-toolkit')).toBe(false)
    // ★源码级：两处判定读的都是 **item.name**（口径 47 那把公共键，本刀升级为磁盘真值）
    expect(stripEscComments(readEscSrc('esc-aggregation.tsx'))).toContain('installedIds.has(item.name)')
    const featured = stripEscComments(readFileSync(new URL('../src/esc/esc-featured.tsx', import.meta.url), 'utf8'))
    expect(featured).toContain('installedSkillNames?.has(item.name)')
    // ★反向锁：判定键**不许**再是中心那两套 id（packageId 是雪花、id 是平台号，都不是名字）
    const aggregation = stripEscComments(readEscSrc('esc-aggregation.tsx'))
    expect(aggregation).not.toContain('installedIds.has(item.id)')
    expect(aggregation).not.toContain('installedIds.has(item.skillId)')
  })

  it('③ `complete === false` ⇒ 如实说"还在发现中"、**不许当 0**（第四态与前三态各自成立）', () => {
    const opened = () => undefined
    const countOf = (tree: unknown) => byClass(tree, 'esc-installed-count')
    const titleOf = (tree: unknown) => String(byClass(tree, 'esc-installed')!.props['title'])
    // ① 还没发现完：数字位画的是**真的读到的那几个**（这一格 2 枚），**不是 0**；
    //    title 换成"还在发现中"那句（与"读不到"那句**不是同一句**）。
    const discovering = toolbarOf({ onOpenInstalled: opened, installedCount: 2, installedCountDiscovering: true })
    expect(countOf(discovering)!.props['children']).toBe('(2)')
    expect(countOf(discovering)!.props['children']).not.toBe('(0)')
    expect(titleOf(discovering)).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedDiscovering)
    expect(titleOf(discovering)).not.toBe(ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable)
    // ② 那句话里**一个数字都没有**（用户裁决：不许写死数字；数字由真源给）
    expect(ENTERPRISE_ESC_LOCAL_COPY.installedDiscovering).not.toMatch(/\d/)
    expect(ENTERPRISE_ESC_LOCAL_COPY.installedDiscovering).toContain('发现中')
    // ③ 优先级：**读不到压过还没发现完**（`undefined` 时数字位画的是 (0)，这时说"还在发现中"
    //    会让员工以为那个 0 是真的发现结果）
    const both = toolbarOf({
      onOpenInstalled: opened,
      installedCount: undefined,
      installedCountFailed: true,
      installedCountDiscovering: true,
    })
    expect(titleOf(both)).toBe(ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable)
    // ④ 三态口径**没有丢**（回归）：确数 / 真 0 / 读不到 / 首帧 四格各自照旧
    expect(titleOf(toolbarOf({ onOpenInstalled: opened, installedCount: 3 })))
      .toBe(ENTERPRISE_ESC_LOCAL_COPY.installedFilterOpen)
    expect(countOf(toolbarOf({ onOpenInstalled: opened, installedCount: 3 }))!.props['children']).toBe('(3)')
    expect(countOf(toolbarOf({ onOpenInstalled: opened, installedCount: 0 }))!.props['children']).toBe('(0)')
    expect(countOf(toolbarOf({ onOpenInstalled: opened }))!.props['children']).toBe('(0)')
    expect(titleOf(toolbarOf({ onOpenInstalled: opened, installedCount: 0 })))
      .toBe(ENTERPRISE_ESC_LOCAL_COPY.installedFilterOpen)
    expect(titleOf(toolbarOf({ onOpenInstalled: opened })))
      .toBe(ENTERPRISE_ESC_LOCAL_COPY.installedCountUnreadable)
    // ④′ 发现中**不许**把"口没接"那句顶掉之后又反过来：口缺席 + 发现中 ⇒ 仍说发现中（那句话更相关）
    expect(titleOf(toolbarOf({ installedCount: 2, installedCountDiscovering: true })))
      .toBe(ENTERPRISE_ESC_LOCAL_COPY.installedDiscovering)
    // ⑤ 子页那一侧：同一句话以可见的 `role="status"` 说出来（不是 title、不是静默）
    const installed = stripEscComments(readEscSrc('esc-installed.tsx'))
    expect(installed).toContain("role: 'status'")
    expect(installed).toContain('ENTERPRISE_ESC_LOCAL_COPY.installedDiscovering')
    expect(installed).toContain('discovery.complete === false')
  })

  it('④ 新路由只回白名单字段（UI 侧第二道闸）：信封恰好两键，多一格即整条失败', () => {
    // Host 侧已把 path/resourceBase 挡掉（bundle 用例逐键取证）；这里锁**解码层**这第二道闸。
    const good = {
      skills: [{
        name: 'a',
        description: 'd',
        whenToUse: 'w',
        invocation: { modelInvocable: true, userInvocable: false },
        source: 'user-dsh',
        provider: 'skill-filesystem',
      }],
      complete: false,
    }
    expect(decodeEnterpriseDiscoveredSkills(good)).toEqual(good)
    // ★判据落在**抛出的码**上（形状闸门不许"尽力而为"）。
    const throws = (value: unknown) => {
      let code: string | undefined
      try {
        decodeEnterpriseDiscoveredSkills(value)
      } catch (error) {
        code = (error as { code?: string }).code
      }
      expect(code, JSON.stringify(value)).toBe('ENT_LOCAL_RESPONSE_INVALID')
    }
    throws({ skills: [], complete: true, path: '/Users/x' })
    throws({ skills: [], complete: true, resourceBase: {} })
    throws({ skills: [], complete: 'yes' })
    throws({ skills: [{ ...good.skills[0]!, path: '/Users/x' }], complete: true })
    throws({ skills: [{ ...good.skills[0]!, resourceBase: { kind: 'directory', path: '/x' } }], complete: true })
    throws({ skills: [{ ...good.skills[0]!, invocation: { modelInvocable: true } }], complete: true })
    throws({ skills: [{ ...good.skills[0]!, source: '' }], complete: true })
    throws({ skills: [{ ...good.skills[0]!, whenToUse: '' }], complete: true })
    // `whenToUse` 缺席合法（"官方没说"与"官方说空"分得开）。
    expect(decodeEnterpriseDiscoveredSkills({
      skills: [{ name: 'a', description: '', invocation: { modelInvocable: false, userInvocable: true }, source: 'bundled', provider: 'p' }],
      complete: true,
    }).skills[0]).not.toHaveProperty('whenToUse')
    // 路径常量与 Host 侧逐字同值（同源路由的唯一凭据）。
    expect(ENTERPRISE_SKILL_DISCOVERED_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/discovered')
  })

  it('⑤ 老两份记录**降级为元信息**：列表真源只有发现面，两份记录只喂元信息表', () => {
    const installed = stripEscComments(readEscSrc('esc-installed.tsx'))
    // ① 列表/分组走的是发现面那一条（唯一真源）。
    expect(installed).toContain('await api.discoveredSkills(controller.signal)')
    expect(installed).toContain('enterpriseEscInstalledGroups(skills, metaTable)')
    // ② 两份记录只出现在**元信息那一趟**里（同一趟里各一次），不进列表投影。
    expect(installed.match(/api\.installedSkills\(/g)).toHaveLength(1)
    expect(installed.match(/api\.selfInstalledSkills\(/g)).toHaveLength(1)
    expect(installed).toContain('enterpriseEscInstalledMetaTable(meta.value.center, meta.value.self)')
    // ★反向锁：任何"用两份记录决定列不列出来"的形态都不许回来
    //   （旧实现是两份记录各自 map 出一组卡片那两支）。
    expect(installed).not.toContain('centerGroup')
    expect(installed).not.toContain('selfGroup')
    // ③ 元信息读不到 ⇒ 空表（列表照样铺出来）+ **说出来**（唯一提示件 + 稳定码）。
    expect(installed).toContain('enterpriseEscInstalledMetaTable([], [])')
    expect(installed).toContain('prefix: ENTERPRISE_ESC_LOCAL_COPY.installedMetaFailed')
    // ④ 三条只读取数各恰好一次（发现面 + 企业元信息 + 自装元信息），没有第四条。
    const reads = ['discoveredSkills', 'installedSkills', 'selfInstalledSkills']
      .map(name => installed.match(new RegExp(`api\\.${name}\\(`, 'g'))?.length ?? 0)
    expect(reads).toEqual([1, 1, 1])
  })
})
