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
import { EnterpriseEscCard, SKILL_MORE_ENTRIES } from '../src/esc/esc-card.js'
import {
  EnterpriseEscToolbar,
  ENTERPRISE_ESC_ADD_SKILL_ITEMS,
  enterpriseEscAddSkillLock,
  enterpriseEscAddSkillPlans,
  enterpriseEscSearchPlaceholder,
} from '../src/esc/esc-toolbar.js'
import {
  EnterpriseSkillImportChrome,
  EnterpriseSkillImportNotice,
} from '../src/skill-import-port.js'
import {
  ENTERPRISE_SKILL_IMPORT_ACCEPT,
  ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL,
} from '../src/skill-import.js'
import {
  ENTERPRISE_ESC_INSTALLED_KINDS,
  enterpriseEscCenterInstalledCard,
  enterpriseEscInstalledTitleOf,
  enterpriseEscSelfInstalledCard,
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
import { decideAutoFill, shouldTriggerBottomLoad } from '../src/esc/esc-aggregation.js'
import { escCategoryChildrenOf, escPublishedTargetIdOf, escResourceAdapters, missingEndpointCodeOf } from '../src/esc/esc-list.js'
import { EnterpriseEscResourceTabs } from '../src/esc/esc-resource-tabs.js'
import { WB } from '../src/esc/esc-scale.js'
import { EnterpriseEscStyle } from '../src/esc/esc-style.js'
import type { EscCategoryNode, EscRecommendRecord, ResourceItem } from '../src/esc/esc-types.js'

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
      mainTabEnabled: '我启用的',
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

  it('技能：系统广场仅官方；团队空间 category=Skill；「我启用的」是全量接口（无参数）且本地筛选', async () => {
    const { api, calls } = spyApi()
    const adapters = escResourceAdapters(api)
    const system = adapters.skill.system!
    const team = adapters.skill.team!
    const enabled = adapters.skill.enabled!
    if (system.mode !== 'server' || team.mode !== 'server' || enabled.mode !== 'client') throw new Error('技能三维的形状不对')
    await system.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: undefined })
    expect(calls[0]!.params).toEqual({ page: 1, pageSize: 20, category: '', kw: undefined, official: true })
    await team.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: 7, spaceIds: undefined })
    expect(calls[1]!.params).toMatchObject({ category: 'Skill', justReturnSpaceData: true, spaceId: 7 })
    await enabled.fetchAll({ spaceId: undefined, keyword: 'x', category: 'y' })
    expect(calls[2]!.params).toEqual({})
    // serverKeyword/serverCategory 都**没有**置位 ⇒ 本地必须自己按关键字与分类收窄
    expect(enabled.serverKeyword ?? false).toBe(false)
    expect(enabled.serverCategory ?? false).toBe(false)
  })

  it('连接器：官方目录 scope=official；空间维度 scope=space；已连接的/我启用的各带一个服务端筛选且本地跳过双重收窄', async () => {
    const { api, calls } = spyApi()
    const adapters = escResourceAdapters(api)
    const system = adapters.connector.system!
    const team = adapters.connector.team!
    const connected = adapters.connector.connected!
    const enabled = adapters.connector.enabled!
    if (system.mode !== 'server' || team.mode !== 'server' || connected.mode !== 'client' || enabled.mode !== 'client') {
      throw new Error('连接器四个维度的形状不对')
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
    await enabled.fetchAll({ spaceId: undefined, keyword: 'k', category: 'c' })
    expect(calls[4]!.params).toEqual({ connectionEnabled: 'true', category: 'c', keyword: 'k' })
    expect(enabled.serverKeyword).toBe(true)
    expect(enabled.serverCategory).toBe(true)
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
    // ★左对齐统一手法：三枚的**左内衬归零**，且**容器不做负 margin 抵消** ——
    //   视觉左边距 = 内容区 padding ⇒ 与卡片左边界逐字对齐（真机实测此前差 38px）。
    for (const sel of ['.esc-resource-tab', '.esc-source-tabs .esc-pill', '.esc-category-tabs .esc-pill']) {
      expect(ruleBody(sel), sel).toMatch(/padding: 0 var\(--esc-sp-md\)/)
    }
    for (const sel of ['.esc-resource-tabs', '.esc-source-tabs', '.esc-category-tabs']) {
      expect(ruleBody(sel), sel).not.toContain('margin-left: calc(')
    }
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
    //   ★对齐手法**只用一种**：三行的**左内衬归零**（`padding: 0 …`），容器**不做**负 margin 抵消——
    //   于是视觉左边距 = 内容区 padding（.esc-content 24px）= 卡片左边界，逐像素对齐。
    //   （此前是「项自带 16px 左内衬 + 容器抵消 16px」两套手法叠加，真机实测差 38px；
    //     负 margin 与 padding 归零只能选其一，两套并存必错。）
    for (const sel of ['.esc-resource-tab', '.esc-source-tabs .esc-pill', '.esc-category-tabs .esc-pill']) {
      expect(valueOf(sel, 'padding'), sel).toMatch(/^0 var\(--esc-sp-md\)/)
    }
    for (const sel of ['.esc-resource-tabs', '.esc-source-tabs', '.esc-category-tabs']) {
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

  it('工具栏：主 tab 的组成随资源类型变（已连接的仅连接器、我启用的仅技能），顺序照原文件', () => {
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
    expect(labelsOf('skill')).toEqual(['系统广场', '团队空间', '我启用的'])
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
    // 四枚都在**唯一码表**里、都不可重试、四句话两两不同
    //（同一件事不许说两种话；四件不同的事也不许说成同一句）
    const messages = (['connector', 'directory', 'enabled', 'recommend'] as const).map(key => {
      const code = ESC_MISSING_ENDPOINT_CODES[key]
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
      expect(enterpriseErrorRetryable(code), code).toBe(false)
      return enterpriseErrorMessage(code)
    })
    expect(new Set(messages).size).toBe(4)
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

  it('★「我启用的」是另一个端点：技能目录缺端点 ≠ 技能启停清单缺端点（本刀，有现场探针作证）', () => {
    // 现场：同一刻 skill/list → 0000 / total 138，skill/enable/list → 4040
    expect(missingEndpointCodeOf('skill', 'enabled')).toBe('ENT_ESC_ENABLE_LIST_UNAVAILABLE')
    // 两句话必须不同：说"没有技能目录"是假话（目录在），缺的是启停清单
    expect(enterpriseErrorMessage(missingEndpointCodeOf('skill', 'enabled')))
      .not.toBe(enterpriseErrorMessage(missingEndpointCodeOf('skill', 'system')))
    // 反向锁：目录面**不许**落到启停清单那一枚（反向也一样），且连接器面与维度无关
    expect(missingEndpointCodeOf('skill', 'system')).not.toBe('ENT_ESC_ENABLE_LIST_UNAVAILABLE')
    expect(missingEndpointCodeOf('expert', 'enabled')).not.toBe('ENT_ESC_ENABLE_LIST_UNAVAILABLE')
    expect(missingEndpointCodeOf('connector', 'enabled')).toBe('ENT_ESC_CONNECTOR_UNAVAILABLE')
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
    expect(installedBare.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    const addBare = addSkillOf(bare)
    expect(addBare.props['disabled']).toBe(true)
    expect(addBare.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    // ② 在场：能点、点的是那一枚回调、悬浮说明换成"会发生什么"
    const wired = rightOf(toolbarOf({ resourceType: 'skill', onAddSkill, onOpenInstalled }))
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
    // ④ 专家页/连接器页**没有下拉**：主按钮直接调本地导入（文案与动作本刀都不改）。
    for (const resourceType of ['expert', 'connector'] as const) {
      const other = addSkillOf(rightOf(toolbarOf({ resourceType, onAddSkill })))
      expect(other.props['onClick'], resourceType).toBe(onAddSkill)
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

  it('已安装页的纯投影：分组顺序 / 组名 / 卡片字段 / 哪一组那枚开关拨不动', () => {
    // 用户自定义（本机自装）：没有中心雪花 id ⇒ 开关**恒拨不动**
    const self = enterpriseEscSelfInstalledCard({
      skillId: 'meeting-notes', displayName: '会议纪要', sha256: 'a', names: ['meeting-notes'], installedAt: '2026-10-07', sourceInput: 'notes.dshskill',
    })
    expect(self.key).toBe('self-meeting-notes')
    expect(self.item.name).toBe('会议纪要')
    expect(self.item.description).toBe('meeting-notes')
    expect(self.locked).toBe(true)
    // 显示名缺 ⇒ 回落 skillId（记录里一定有它）——不画一张空标题
    expect(enterpriseEscSelfInstalledCard({ skillId: 'k', displayName: '', sha256: 'a', names: [], installedAt: '' }).item.name).toBe('k')
    // 来自市场（企业已装）：key 走 packageId（两套 id 命名空间不撞），开关能拨
    const center = enterpriseEscCenterInstalledCard({
      packageId: '2105915576743428098', skillId: 'dev-engineer-toolkit', displayName: '开发工程工具箱', versionId: 'v1', sha256: 'b', names: ['tools', 'helpers'], installedAt: '',
    })
    expect(center.key).toBe('installed-2105915576743428098')
    expect(center.item.name).toBe('开发工程工具箱')
    expect(center.item.description).toBe('tools、helpers')
    expect(center.locked).toBe(false)
    // 顺序：用户自定义在前（参考图就是这个顺序）+ 组名逐字
    expect(ENTERPRISE_ESC_INSTALLED_KINDS).toEqual(['self', 'center'])
    expect(enterpriseEscInstalledTitleOf('self')).toBe('用户自定义')
    expect(enterpriseEscInstalledTitleOf('center')).toBe('来自市场')
  })

  it('本地导入是**同一份实现**：状态机与三件事实全仓只有一处，两面都 import 同一叶片（结构级不变式）', () => {
    const leaf = readFileSync(new URL('../src/skill-import-port.tsx', import.meta.url), 'utf8')
    const market = readFileSync(new URL('../src/marketplace-entry.tsx', import.meta.url), 'utf8')
    const aggregation = readFileSync(new URL('../src/esc/esc-aggregation.tsx', import.meta.url), 'utf8')
    // ① 商城页与 esc 页都 import 同一个 hook（不是"各写一套、长得像"）
    expect(market).toContain("from './skill-import-port.js'")
    expect(aggregation).toContain("from '../skill-import-port.js'")
    expect(market).toContain('useEnterpriseSkillImport')
    expect(aggregation).toContain('useEnterpriseSkillImport')
    // ② 状态机的**心脏**（上传那一次调用）在整个 src 里只出现一处 —— 这条比"渲染出来像"强得多
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
    // ④ esc 那一侧三条接线事实：按钮接 port、落点在工具栏下方、已安装页用同一张卡的两处差异
    expect(aggregation).toContain('onAddSkill: skillImportPort?.onOpen')
    expect(aggregation).toContain('EnterpriseSkillImportChrome')
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
    // 上传那一项走的就是口径 46 那枚**本地导入**写入口（不是第二套实现）
    const aggregation = readSrc('esc-aggregation.tsx')
    expect(aggregation).toContain('onAddSkill: skillImportPort?.onOpen')
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

  it('⑤ 「已安装」只在技能页渲染：专家/连接器页**整枚不渲染**（不是 disabled、不是隐藏）', () => {
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
    // 计数三态口径一字未改：读不到 ⇒ 无数字 + `？`（不写 0）
    const unknown = rightOf(toolbarOf({ resourceType: 'skill', onOpenInstalled: () => undefined }))
    expect(byClass(unknown, 'esc-installed-count')).toBeUndefined()
    expect(byClass(unknown, 'esc-installed-failed')).toBeUndefined()
    const failed = rightOf(toolbarOf({ resourceType: 'skill', onOpenInstalled: () => undefined, installedCountFailed: true }))
    expect(byClass(failed, 'esc-installed-failed')!.props['children']).toBe('？')
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
