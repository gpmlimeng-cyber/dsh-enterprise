/**
 * [INPUT]: 依赖 React 的 createElement/useState、lucide-react 的图标、官方原语 `Button`/`Switch`（`@deepseek-ai/dsh-client-ui-primitives`）、`error-notice` 的唯一失败提示件、`esc-api` 的 `enterpriseEscImageSrc`、`esc-copy` 的文案、`esc-more-menu` 的「更多」下拉（实现已抽出）与 `esc-types` 的 `ResourceItem`
 * [OUTPUT]: 对外提供 `EnterpriseEscCard`（专家/技能/连接器共用的聚合卡片）、`EnterpriseEscCardIcon`（**本刀（Phase C D1）新导出**：卡片图标那一格——平台绝对地址经宿主图片代理 + 加载失败一次即回落兜底图形，是全仓**唯一**的破图兜底实现，连接器广场那张新卡复用它）、`EscCardInstall`（未装那枚【＋】的终态）、`EscCardMore`（已装那枚「更多」的终态，**类型再出口**；实现与那两行纯数据在 `esc-more-menu.tsx`，`SKILL_MORE_ENTRIES` 也由本文件再出口）与 `EscCardTryNow`（已装那枚「去试试」的终态）
 * [POS]: esc 页面的**卡片层**，同时移植了 NUWAX 的 `CardWrapper`（容器版式）与 `ResourceCard`（业务内容与动作位）两个组件。
 *   ★**本刀（S5a：技能卡「更多」里的两个本机管理动作）**：三件事一起动，且**全部 additive**（不给 `more`
 *     的调用方渲染逐字不变）——
 *     ① 新增可选 prop `more`（`EscCardMore`：已装那枚「更多」下拉的终态）——**缺席即整枚不画**
 *        （不是画一枚禁用的 `⋯`：缺席只可能是"这枚技能不是本机自装的"或"本端两条路由没接上"，
 *        两种都不该画出一枚点了没反应的控件）；
 *     ② 在途那句（「卸载中…」/「正在打开所在文件夹…」）按既有 `.esc-card-lock` 落点**行上可见**地写出来；
 *     ③ 这两枚动作**失败**时，唯一提示件落回**这一枚卡片**上（`role="alert"` 由提示件自己挂，
 *        **不画「重试」**：危险动作的每一次执行都必须重新过一次确认框）。
 *     ★下拉的实现与那两行纯数据搬到了 `esc-more-menu.tsx`（本件因此回到单文件上限之下）。
 *   ★**本刀（workbuddy 风格重构）——技能卡这一档被换掉了三处**（当时专家/连接器两档一字未动；
 *     ★口径 42 起**专家卡也换成了同一套版式**，见下面那一段 ⇒ 现在只剩连接器与"无 props 的默认档"是三层旧版式）：
 *     ① **底部那条「标签行」取代原来的「统计页脚」**：逐项渲染作者 / 收藏 / 安装 / 使用，
 *        缺的那几项按缺口显示 `-`（**不编数**：0 会被读成「装过 0 次」，见 `esc-copy` 的说明）；
 *     ② **动作位按「是否已安装」分流**——未安装＝一枚**常驻圆形「+」**（不再是原页面那种 hover 才浮现的
 *        「使用」按钮，也不再挂那枚启用开关）；已安装＝**「更多」下拉 + 「去试试」**两枚并排。
 *        「更多」用官方 `Menu` 原语（自带遮罩/Esc/外部点击/`danger` 行），不自造下拉；
 *     ③ ~~发布者头像 + 昵称那行只在专家卡的头里渲染~~ ⇒ **口径 42 起两档的作者都在底部标签行里**
 *        （全文件只剩一处 `AuthorRow` 渲染点，见下面 `tagRow`），故连接器的状态行
 *        `.esc-extra-box` 与标题**平级**，不再嵌在发布者行内部。
 *     ★那一档已装态取自本仓**既有真值**（`GET /skills/installed` 那张清单），不是新接口、不猜；
 *       `undefined`（读不到）与 `false`（确实没装）分开表达，读不到时顶栏另有「已安装（？）」缺口标记。
 *   ★动作位一律按 A 档**置灰**并写明原因（召唤 / 连接 / 断开 / 安装 / 去试试）：看得见的那一页
 *   先搬，动作诚实置灰——**不是**把它们删掉（删掉版式就与线上不同了）。★「更多」那一档**已经接线**
 *   （本刀 S5a：两枚本机管理动作），不再是"置灰占位"。
 *   ★两处 DSH 体系替换：① 图标兜底（原文 `agent_image.png`）→ lucide 中性图标 + token 底色；
 *   ② 发布者头像兜底（原文 `avatar.png`）→ 昵称首字字母头像。
 *   ★**图片地址一律先过 `enterpriseEscImageSrc`**（图标与头像两处）：平台给的是**要票据的绝对地址**，
 *   浏览器直连必破图（实测技能图标 401、头像 200+`{"code":"4010"}`）——换不出来的地址就落到上面两条兜底，
 *   于是这一层**永远不会画出一个破图**。
 *   ★付费角标**不做**：它的唯一用途是引到"订阅"这条本刀未移植的动作链，连它依赖的租户配置
 *   （`enableSubscription`）一起留给 B 档；故本文件没有付费相关的 prop。
 *   ★**口径 39（用户裁决「标题不要和安装图标积压在一起」）**：技能卡的动作位**进流**——
 *     从"挂在卡片直属层 + 绝对定位浮在标题上"改成头行里的一格（原为「图标 | 标题/描述 | 动作」的第三格，
 *     口径 41 起收成「标题行」里的第二格，见下）。
 *     原先那条 `position: absolute; top: 12px; right: 16px` 是浮在标题上的，而标题是 nowrap 单行截断，
 *     可用宽度是整条头行 ⇒ 长标题一直排到「+」底下才截断（真机截图里就是 `dev-engineer-toolkit+`），
 *     用户读成"标题和安装图标积压在一起"。进流之后标题那格 `flex: 1 / min-width: 0`、
 *     动作格 `flex: none` ⇒ 省略号**永远**落在动作位左侧（不靠预留魔数，字号变大也不会塌）。
 *     与它配套的版式在样式层：`.esc-card-tagrow .esc-card-header { align-items: center }`（图标与
 *     "标题行 + 描述"整块垂直居中）与 `.esc-skill-actions`（不再绝对定位，`align-self: flex-start`）。
 *   ★**口径 41（用户裁决「技能卡片描述的截断位置应该是卡片边缘而不是安装按钮，因为他是独立一行」）**：
 *     技能卡的动作位**再往里收一格**——从"头行的第三格"改成「标题行」（`.esc-card-titlerow`）里的第二格。
 *     根因：动作位是 headmain 的**兄弟**时，headmain（描述那一行的右端）要按 `flex: none` 给它让掉一整块宽，
 *     可它只对齐**标题那一行**（`align-self: flex-start`）⇒ 描述那一行让掉的宽度是白丢的，
 *     省略号落在安装按钮左边缘（用户看见的就是这一句）。收进标题行之后它只吃标题那一行的宽，
 *     描述那一行吃到**卡片内缘**（与下面那条标签行对齐）。口径 39 的三条效果一字不减（见上）。
 *   ★**口径 40（用户裁决「技能底部的图标使用专家底部的图标，作者头像使用和专家一致的」）**：
 *     技能卡底部那一行与专家卡底部**共用同一套零件**（细节与理由都写在下面 `tagRow` 那一段）：
 *     ① 作者那一格 → 专家卡用的同一枚 `AuthorRow`（真头像 + 首字兜底 + 同一套名字样式）；
 *     ② 三枚统计图标 → 专家页脚那**唯一**一套 `statIconOf`（人 / 会话 / 收藏），
 *        原先这一行独有的两枚外来字形（安装的箭头、使用量的柱状图）**整枚下线**。
 *     ⇒ 两处的作者与图标现在是**同一个函数**画出来的；星形实心跟随收藏态这条口径也只剩一处实现。
 *     顺序与项数**没动**（作者 → 收藏量 → 安装量 → 使用量，仍是上一轮用户裁决⑧的顺序）。
 *   ★**口径 42（用户裁决「专家卡片调整成和技能卡片布局一致，标题描述，底部标签。区别是右上角技能是安装，
 *     专家是召唤，但是专家的召唤默认不显示，hover 时才显示，显示按钮时标题如果太长就截断」）**：
 *     专家卡**整套换成技能卡那一版式**，四件事一起动（第⑤条是没动的前提），缺一件都不是这套版式：
 *     ① **头行**：从「标题（+ 作者行）」换成「**标题行** + 描述独立一行」——即口径 39/41 那一套
 *        （描述因此落在**卡片内缘**、单行截断）。专家卡的作者行从卡头**搬到底部标签行**，
 *        于是全文件只剩**一处** `AuthorRow` 渲染点（口径 40 要求两档同一枚零件，这一刀把"两处"
 *        收成了"一处"——同一枚零件 + 同一个渲染点，物理上不可能再分叉）；
 *     ② **底部**：从「统计页脚（`.esc-card-footer`/`.esc-count-box`）」换成**标签行**（`.esc-card-tags`），
 *        项序与技能卡一致（作者 → 收藏 → 安装 → 使用，裁决⑧）。⚠值**改为真值驱动**：
 *        哪一格在 `item.stats` 里就画那一格的真数（专家卡的人数/会话本就是真数，**不许因为"技能卡没有"
 *        就把这三格钉死**），不在就画缺口短横 —— 为此 `mapPublishedStats` 也收了一处（见那个函数的注释）；
 *     ③ **右上角那格**：技能卡是**常驻**的安装「+」（口径 39/41 进流），专家卡是**默认收起**的「召唤」
 *        （`.esc-summon-slot`：`max-width: 0` ⇒ 收起时**零占位**，标题拿到整行宽、不截断；
 *        卡片 hover 才展开 ⇒ 标题那一格随之缩到"整行 − 12 − 按钮宽"，**长标题就在这时截断**——
 *        用户那句话的两个半句正是这件事的两面）。⚠它仍**置灰未接线**（`.esc-action-solid` + `title` 写明原因），
 *        与连接器那两枚一个口径；触摸屏上靠 Chrome/WebView 的**粘滞 hover**（点一下卡片即出现）；
 *     ④ **右下角那枚 hover 浮现的收藏钮（`.esc-corner-box`/`.esc-star-box`）撤下**：它是旧三层版式的**浮层**，
 *        新版式底部是标签行（收藏量就在那一行里）⇒ 它会**浮在标签行上**；技能卡也没有它。
 *        连同两条样式规则一起下线（那条"官方几何"的记录留在样式层的反向锁注释里）。
 *        ⚠这枚按钮本来就是**置灰未接线**的占位（点了不会有动作）⇒ 撤下不丢任何可用的功能；
 *        要它回来是一行的事（放回标签行尾部或卡头），说一声即可。
 *     ⑤ 专家卡**仍无阴影**（SPEC §7：技能卡是可点入口、专家卡是列表项）——这一刀改的是版式，不是分层。
 *   ★**口径 46/47**：新增两枚 props——`actionSwitch`（标题行第二格改画官方 Switch，已安装技能卡用）与
 *   `showTags: false`（底部标签行整行撤下）；默认值让技能卡/专家卡两条既有档**一字未变**。
 *   ★**口径 53（本刀）**：三件事一起进——① 新增可选 prop `install`（`EscCardInstall`：技能卡那枚
 *     【＋】的**终态**，给了它那枚按钮**真的能点**，动作是注入进来的唯一写入口）；② 未装技能卡的
 *     【＋】**按不动时**多一句**行上可见**的原因（`.esc-card-lock` + `role="status"`）——广场那批
 *     NUWAX 技能本刀**仍禁用**，但"为什么不能装"从此写在卡片上，而不是只挂一句 `title`；
 *     ③ 新增可选元信息行（`ResourceItem.meta` → `.esc-card-meta`，**缺席即整行不进 DOM**）。
 *     ★三条都是**additive**：不给 `install`、不填 `meta` 时，另几档（专家/连接器/精选/已安装）
 *     的渲染逐字不变（既有那批大纲与类名计数锁照旧全绿）。
 *   ★**口径 64（本刀）**：`EscCardInstall.onInstall` 收成**可选**，且那枚【＋】只在它**在场**时才挂
 *     `onClick`（改前是"只要给了计划就挂"，禁用那几档也挂着一个不会被调的 `undefined`）。
 *     于是"禁用 ⇒ 无写入口"从一句纪律变成**结构事实**：系统广场那批的六档禁用
 *     （发布者不允许复制 / 需要付费 / 坐标不可用 / 本枚在途 / 别的在途 / 端口缺席）
 *     在卡片上**连 `onClick` 属性都没有**。能点那一档照旧传着写入口，渲染逐字不变。
 *   ★**本刀（S5b：技能卡那枚「去试试」真的能用）**：四处一起动，**全部 additive**（不给 `tryNow`
 *     的调用方渲染逐字不变，`tests/esc.spec.ts` / `esc-catalog.spec.ts` 那两条"置灰 + `actionNotPorted`"
 *     的既有断言因此照旧全绿——那是"没给计划"这一档的形态，不是被放宽）——
 *     ① 新增可选 prop `tryNow`（`EscCardTryNow`：那枚按钮的**终态**，唯一构造点是纯投影
 *        `esc-skill-try.ts` 的 `enterpriseEscSkillTryPlan`：**已装 + 有文案 + 端口在场** 才可点）；
 *     ② 可点那一档挂**真 `onClick`**（写入口是注入进来的，卡片仍然不认识任何数据形状）；
 *     ③ 不可点那一档按既有 `.esc-card-lock` 落点写一句**行上可见**的原因（`role="status"` +
 *        `data-esc-skill-try-lock`），在途那一档写一句交代（`data-esc-skill-try-busy`）；
 *     ④ **失败落点与 S5a 那枚合并成一处**：一张卡上同一时刻只说一件事 ⇒ 全文件
 *        `createElement(EnterpriseErrorNotice, …)` 仍然**恰好一处**（`tests/esc-skill-more.spec.ts`
 *        把这条数锁着；这不是省事，而是"一枚卡片一个失败位"这条口径的落法）。
 *     ★**缺席 `tryNow` 时逐字回到改前那一态**（禁用 + `title = actionNotPorted`）：那正是既有测试与
 *       非技能档的形态；生产路径上三处调用点（广场网格 / 精选行 / 企业技能目录）都会给计划。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { Bot, MessageSquare, Plus, Star, User } from 'lucide-react'
import { createElement, useState, type ReactNode } from 'react'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { enterpriseEscImageSrc } from './esc-api.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import { SkillMoreActions, type EscCardMore } from './esc-more-menu.js'
import type { ResourceItem, ResourceStatType } from './esc-types.js'

/** 统计项图标（原文的三枚 svg 组件 → lucide 同义图标）。 */
const STAT_ICON: Readonly<Record<ResourceStatType, () => ReactNode>> = {
  user: () => createElement(User, { size: 12, 'aria-hidden': true }),
  link: () => createElement(MessageSquare, { size: 12, 'aria-hidden': true }),
  star: () => createElement(Star, { size: 12, 'aria-hidden': true }),
}

/** 卡片入参。 */
export interface EnterpriseEscCardProps {
  readonly item: ResourceItem
  /** 图标形态：专家/专家团按「人」形资源裁圆，技能与连接器保持方形。 */
  readonly iconShape?: 'square' | 'circle' | undefined
  /**
   * 是否显示底部**统计那一行**。
   * ★**口径 42**：底部那一行的**形态**随版式走（标签行版式＝`.esc-card-tags`，含作者 + 三格统计；
   * 旧三层版式＝`.esc-card-footer`/`.esc-count-box`），本开关只对**旧三层版式**生效——
   * 标签行版式（技能/专家）**恒**渲染那条标签行（技能卡传 `false` 时它也在，那是口径 40 起的事实）。
   */
  readonly showStats?: boolean | undefined
  /**
   * 是否按**专家卡**展示。
   * ★**口径 42 起它同时决定两件事**：① 根类名 `esc-card-expert`（无阴影，SPEC §7）；
   * ② 走**标签行版式**（与技能卡同一套头与底），右上角那格放**默认收起、hover 才展开**的「召唤」。
   */
  readonly showSummon?: boolean | undefined
  /** 是否显示「立即使用」动作位与启用开关（技能卡片）。 */
  readonly showUse?: boolean | undefined
  /** 是否按连接器卡片展示（分类 + 连接状态行、连接/断开动作位）。 */
  readonly showConnect?: boolean | undefined
  /**
   * ★**本刀（workbuddy 风格）**：这一个布尔位决定技能卡右侧给哪种动作形态——
   * `false`（未安装）＝ 一枚**常驻的圆形「+」**；`true`（已安装）＝ **「更多」下拉 + 「去试试」**两枚。
   * 取值来源是本仓**既有真值**（`GET /skills/installed` 那张清单），不是新接口、不猜。
   * `undefined` 与 `false` 是**两件事实**：读不到已装清单时按「未装」画「+」，
   * 但工具栏那一行已经出了「已安装（？）」的缺口标记 ⇒ 用户不会把「不知道」误读成「没装」。
   */
  readonly installed?: boolean | undefined
  /**
   * ★**口径 47（用户裁决「已安装按钮打开已安装技能页面……唯一不同是安装图标改为开关按钮，去除底部标签」）**：
   * 给了它，标题行那一格就画**开关**（官方 `Switch` 原语），不再画技能那枚「+」/「更多 + 去试试」。
   *
   * ★为什么是一个小对象而不是四枚散参：这四个数**必须同生同死**（`checked` 与 `onChange` 分开传，
   *   就会出现"受控但没人接"的半个开关）。`title` 是**置灰原因**的唯一落点（本仓纪律：禁用即须有可见说明）。
   * ★`disabled` 与 `undefined` 是两件事实：**能不能拨**与**当前开着没有**（后者恒为 `true`——这张卡
   *   只在"已装"列表里出现）。
   */
  readonly actionSwitch?: EscCardSwitch | undefined
  /**
   * ★**口径 47**：底部那条标签行整行撤下（已安装技能页用）。
   *
   * 默认 `true`（= 技能卡/专家卡都画那条行）——只有显式传 `false` 才不画，故既有两档的渲染一字未变。
   */
  readonly showTags?: boolean | undefined
  /**
   * ★**口径 53（本刀）**：技能卡那枚【＋】的**终态**（给了它 ⇒ 那枚按钮**真的能点**）。
   *
   * ★**为什么是一门"计划对象"而不是四枚散参**：`disabled` / 文案 / 无障碍名 / 原因 / 动作
   *   这五件事实**必须同生同死**（分开传就会出现"看着能点、点下去没事"的半个按钮），
   *   而它们的取值口只有一个——`esc-catalog.ts` 的 `enterpriseCatalogActionPlan`（纯投影，可直调取证）。
   *   本组件因此**不认识任何数据形状**：它只按计划画一枚按钮、写一句原因。
   * ★**缺席时逐字回到改前那一态**（禁用 + `title = actionNotPorted`）——那正是广场那批
   *   （NUWAX 已发布技能）与本刀非目标①的形态：它们**没有可下载的制品**，本刀不动它们的动作，
   *   但**照旧补一句行上可见的原因**（产品宪法：禁用不许只挂一句 `title`）。
   * ★**已装那一档不看它**：装好的卡片改画「更多 + 去试试」（`installed === true`），
   *   故"已装"不在这里、也不该被表达成一枚禁用的【＋】。
   */
  readonly install?: EscCardInstall | undefined
  /**
   * ★**本刀（S5a）**：已装技能卡那枚「更多」下拉的**终态**（那两枚本机管理动作）。
   *
   * ★**为什么缺席 = 整枚不画**（而不是"画一枚禁用的 `⋯`"）：这一格缺席只有两种情形，
   *   而两种都不该画出一枚点了没反应的控件 ——
   *   ① 这一枚技能**不是**本机自装的（中心装下来的、官方内置的：那两条路由管不着它，
   *      画了就是在暗示能卸）；② 本部署那两条路由的端口没接上。
   *   计划里**缺哪一行就不画哪一行**（两行都缺 ⇒ `SkillMoreActions` 返回 null），
   *   取舍与理由逐条写在 `esc-more-menu.tsx` 的文件头。
   * ★**本组件不认识任何数据形状**：能不能卸、点了干什么、确认框说什么，全部由计划给
   *   （唯一构造点是 `esc-skill-more.ts` 的 `enterpriseEscSkillMorePlan`，纯投影、可直调取证）。
   * ★**与 `install` 互不干扰**：它只在 `installed === true` 那一支被读（那一支没有【＋】）。
   */
  readonly more?: EscCardMore | undefined
  /**
   * ★**本刀（S5b）**：已装技能卡那枚「去试试」的**终态**（点了它 ⇒ 新建一个会话并把一句指令填进输入框，
   * **不发送**）。
   *
   * ★**为什么缺席时不整枚不画、而仍然画着**（与 `more` 那一条**刻意相反**）：那枚按钮是已装卡片
   *   版式的一部分（用户看到的原型里「更多 + 去试试」是并排两枚）；把它抽掉会让"这枚技能没法试"
   *   变成静默事实。故缺席时逐字回到改前那一态（禁用 + `title = actionNotPorted`），
   *   而**给了计划**时由计划说了算：可点 ⇒ 真 `onClick`；不可点 ⇒ 禁用 + **行上可见**的原因。
   * ★**本组件不认识任何数据形状**：能不能点、为什么不能点、在途写什么、失败报哪个码，
   *   全部由计划给（唯一构造点 `esc-skill-try.ts` 的 `enterpriseEscSkillTryPlan`，纯投影、可直调取证）。
   * ★**与 `install`/`more` 互不干扰**：它只在 `installed === true` 那一支被读（未装那一支没有它）。
   */
  readonly tryNow?: EscCardTryNow | undefined
}

/**
 * ★**口径 53**：一枚【＋】的终态（本组件唯一认识的安装输入）。
 *
 * 形状与 `esc-catalog.ts` 的 `EnterpriseCatalogActionPlan` **刻意同构**（页面那一层只是把它铺平），
 * 但**不 import** 那个模块：卡片是本页最底的一层展示件，它不该认识"企业技能目录"这个概念——
 * 换个维度要给真实动作时，构造同样的对象即可（本组件一个字都不用改）。
 */
export interface EscCardInstall {
  /** 按钮上不一定看得见的文案（圆形图标钮；读屏与悬浮说明念的就是它）。 */
  readonly text: string
  /** `true` ⇒ 原生 `<button>` 带 `disabled`（点不到）。 */
  readonly disabled: boolean
  /**
   * 这一枚**正在装**（口径 53：在途时按钮禁用、并把文案「安装中…」**行上可见**地写出来）。
   *
   * ★为什么单列一位而不是拿 `disabled` 推：禁用有四种原因（这一枚在途 / 别的在途 / 端口缺席 /
   *   广场那批没有制品），只有"这一枚正在装"该把那三个字写上屏；凭 `disabled` 推会让另外三种
   *   也冒出「安装中…」——那是一句假话。
   */
  readonly busy?: boolean | undefined
  /** 悬浮说明（可用时说会发生什么；不可用时与 `reason` 同源）。 */
  readonly title: string
  /** 无障碍名（「安装 X」/「安装中…」）。 */
  readonly ariaLabel: string
  /** 禁用时的**行上可见**原因（可点、以及在途那一档时缺席——在途时那格写的是「安装中…」）。 */
  readonly reason?: string | undefined
  /**
   * 点它干什么（真实写入口；`disabled` 为真时不会触发）。
   *
   * ★**口径 64（本刀）起它是可选的**：禁用那一档**连写入口都不给**（不是"给一枚不会被调的回调"）
   *   —— 卡片因此连 `onClick` 属性都不会挂上（见下面那处条件展开）。纯函数直调/测试得到的
   *   "禁用 ⇒ 无 onClick"这条判据，正是靠"可点那一档才有它"成立的，而不是靠 `disabled` 挡着。
   */
  readonly onInstall?: (() => void) | undefined
}

/**
 * ★**本刀（S5b）**：一枚「去试试」的终态（本组件唯一认识的「去试试」输入）。
 *
 * ★形状与 `esc-skill-try.ts` 的 `EnterpriseEscSkillTryPlan` **刻意同构**（与 `EscCardInstall`
 *   对 `EnterpriseCatalogActionPlan` 那条同一条理由），但**不 import** 那个模块：卡片是本页最底的一层
 *   展示件，它不认识"技能名能不能拼出指令""官方那条链路接没接上"这些概念——换个维度要给真实动作时，
 *   构造同样的对象即可（本组件一个字都不用改）。
 * ★`onTry` **只有可点那一档才有**：禁用那一档**连 `onClick` 属性都不挂**（不是"挂一枚不会被调的回调"）
 *   ——「禁用 ⇒ 无写入口」因此是**结构事实**，与口径 64 那条同一条纪律。
 */
export interface EscCardTryNow {
  /** 按钮上那三个字（「去试试」）。 */
  readonly text: string
  /** `true` ⇒ 官方 `Button` 带 `disabled`（点不到）。 */
  readonly disabled: boolean
  /** 悬浮说明（可用时说会发生什么；不可用时与 `reason` 同源）。 */
  readonly title: string
  /** 无障碍名（「去试试：这枚技能」）。 */
  readonly ariaLabel: string
  /** 禁用时的**行上可见**原因（在途那一档缺席——那时写的是 `busyText`）。 */
  readonly reason?: string | undefined
  /** 在途时那句**行上可见**的交代（与 `reason` 互斥）。 */
  readonly busyText?: string | undefined
  /** 失败那一次的唯一提示件入参（稳定码 + 动作前缀）；缺席 = 没有失败要说。 */
  readonly failure?: { readonly code: string; readonly prefix: string } | undefined
  /**
   * 点它干什么（真实写入口：开新会话 + 把指令写进输入框，**不发送**）。
   *
   * ★**只有可点那一档才有它**：见上面那条（卡片因此连 `onClick` 属性都不会挂上）。
   */
  readonly onTry?: (() => void) | undefined
}

/** 已安装技能卡那一枚开关（口径 47）；见 `actionSwitch` 的长注释。 */
export interface EscCardSwitch {
  readonly checked: boolean
  readonly disabled?: boolean | undefined
  /** 置灰原因（悬浮说明；`disabled` 为真时**必须**给）。 */
  readonly title?: string | undefined
  readonly onChange: (next: boolean) => void
}

/**
 * 「更多」下拉里的两行与它的计划形状住在 `esc-more-menu.tsx`（本刀从本文件抽出）。
 *
 * ★`SKILL_MORE_ENTRIES` 仍是 `../esc/esc-more-menu.js` 的导出（那两行是**纯数据**：测试直查）。
 */
export type { EscCardMore, EscCardMoreAction, EscCardMoreConfirm, SkillMoreEntry } from './esc-more-menu.js'
export { SKILL_MORE_ENTRIES } from './esc-more-menu.js'

/**
 * 一张资源卡片。
 *
 * 本刀所有动作位都是置灰占位（见文件头），故本组件**没有** `onSummon`/`onSelect`/`onConnect` 这类回调——
 * 加一个不接线的回调只会让"这动作能用"看起来像真的。
 */
export function EnterpriseEscCard({
  item,
  iconShape = 'square',
  showStats = true,
  showSummon,
  showUse,
  showConnect,
  installed,
  actionSwitch,
  showTags = true,
  install,
  more,
  tryNow,
}: EnterpriseEscCardProps): ReactNode {
  const notPorted = ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted
  const connected = item.connected === true
  const publishName = item.publishUser?.nickName || item.publishUser?.userName || ''

  /**
   * 统计行图标。
   *
   * ★原文口径（`ResourceCard/index.tsx:186`）：星形图标**跟随收藏态切实心**（与广场卡片一致），
   * 其余两枚恒用线框图标；这一格是"同一份 collected 在两处都生效"的第二处，别只改角标那处。
   *
   * ★**口径 40 起它是全页唯一的一套统计图标**：专家页脚与技能卡底部标签行都从这里取
   * （见下面 `tagRow`），故"两处图标长得一样"是**结构上**成立的，不是两边各抄一份抄得像。
   */
  const statIconOf = (type: ResourceStatType): ReactNode =>
    type === 'star' && item.collected === true
      ? createElement(Star, { size: 12, 'aria-hidden': true, fill: 'currentColor' })
      : (STAT_ICON[type] ?? STAT_ICON.user)()

  const statsRow =
    showStats === true
      ? createElement(
          'div',
          { className: 'esc-count-box' },
          (item.stats ?? []).map(stat =>
            createElement(
              'span',
              { key: stat.type, className: 'esc-count-text' },
              statIconOf(stat.type),
              createElement('span', null, String(stat.value)),
            ),
          ),
        )
      : null

  // 专家「召唤」/ 技能动作位。
  //
  // ★**workbuddy 风格那两档**：技能卡右侧改成 workbuddy 那两种形态——
  //   未安装：一枚**常驻圆形「+」**（不是原页面那种 hover 才浮现的按钮，截图里它一直看得见）；
  //   已安装：**「更多」下拉 + 「去试试」**两枚并排。
  // ★**口径 53**：未安装那枚【＋】**在给了 `install` 计划时真的能点**（企业技能维度：
  //   点它就是 `local-api.ts` 那条 `/skills/install`）；没给（广场那批 NUWAX 技能、精选行）时
  //   **逐字回到改前那一态**——禁用 + `title` 写明原因，**另补一句行上可见的原因**（见下面 `skillLock`）。
  // ★**本刀（S5a）**：「更多」下拉里那两枚本机管理动作**真的接上线了**，但**只有拿到 `more` 计划时才画**
  //   （`SkillMoreActions` 自己按计划里的行决定画不画；两行都画不出来时它返回 null ⇒ 只剩「去试试」）。
  //   判据是"计划在不在场"而不是"已装"：已装但**不是**本机自装（中心装下来的、官方内置的）那一批
  //   拿不到计划 ⇒ **不画**（画了就是在暗示能卸；理由与取舍逐条写在 `esc-more-menu.tsx` 的文件头）。
  const skillActionBox =
    showUse === true
      ? createElement(
          'div',
          { className: 'esc-skill-actions' },
          installed === true
            ? createElement(SkillMoreActions, { name: item.name, more })
            : createElement(
                'button',
                {
                  type: 'button',
                  className: 'esc-install-plus',
                  // ★判据是**计划在不在场**（它不是"写死的禁用"）：给了计划就按计划的可点性来，
                  //   没给就是广场那批（本刀不动它们）——两态在这里各占一支，不可能混。
                  disabled: install === undefined ? true : install.disabled,
                  title: install === undefined ? notPorted : install.title,
                  'aria-label': install === undefined
                    ? `${ENTERPRISE_ESC_COPY.installSkill}：${item.name}`
                    : install.ariaLabel,
                  /**
                   * ★**口径 64（本刀）**：**没有写入口就不挂 `onClick`**（而不是挂一个 `undefined`
                   *   或一个空函数）——禁用那一档（发布者不允许复制 / 需要付费 / 坐标不可用 / 在途 /
                   *   端口缺席）因此**物理上**点不出任何请求：`props['onClick']` 在那个元素上**根本不存在**。
                   *   这是"绝不画一枚点了没反应的按钮"最硬的形态，门禁逐档咬住这一点。
                   */
                  ...(install?.onInstall === undefined ? {} : { onClick: install.onInstall }),
                },
                createElement(Plus, { size: 16, 'aria-hidden': true }),
              ),
          installed === true
            ? createElement(
                Button,
                {
                  variant: 'primary',
                  size: 'sm',
                  className: 'esc-action-solid esc-try-now',
                  /**
                   * ★**本刀（S5b）**：这一枚从"写死的禁用"改成**消费计划**（唯一构造点是纯投影
                   * `enterpriseEscSkillTryPlan`）。**缺席计划时逐字回到改前那一态**（禁用 +
                   * `title = actionNotPorted`）——那正是既有测试与非技能档的形态，生产路径上三处调用点
                   * （广场网格 / 精选行 / 企业技能目录）都会给计划。
                   * ★可点那一档挂的是**真 `onClick`**（写入口由计划带下来）；不可点那一档**连
                   * `onClick` 属性都不挂**（不是"挂一枚不会被调的回调"）。
                   */
                  disabled: tryNow === undefined ? true : tryNow.disabled,
                  title: tryNow === undefined ? notPorted : tryNow.title,
                  'aria-label': tryNow === undefined
                    ? `${ENTERPRISE_ESC_COPY.tryNow}：${item.name}`
                    : tryNow.ariaLabel,
                  ...(tryNow?.onTry === undefined ? {} : { onClick: tryNow.onTry }),
                  children: ENTERPRISE_ESC_COPY.tryNow,
                },
              )
            : null,
        )
      : null

  /**
   * ★**口径 53**：未装技能卡那枚【＋】**按不动时**那句**行上可见**的原因。
   *
   * ★为什么非有不可（产品宪法：禁用控件不许只挂一句 `title`）：本刀之前那枚【＋】只有一个
   *   `title`，键盘/触屏用户根本读不到它为什么按不动 —— 而广场那批（NUWAX 已发布技能）
   *   本刀**明令不动它们的动作**（非目标①：那条导出链是另一刀），于是"仍然禁用"这件事
   *   **必须**配一句看得见的话，否则这一刀就把一个已知缺口藏起来了。
   * ★两句取值**互斥且各自如实**：
   *   · 给了计划（企业技能维度）⇒ 说计划自己那句（在途时缺席——按钮上正写着「安装中…」）；
   *   · 没给计划（广场/精选那批）⇒ `skillInstallUnavailable`（它们没有可下载的技能包，
   *     不是"没接线"）——**绝不为让它们可点而临时接一条假路径**。
   * ★已装那一档不画它（那张卡改画「更多 + 去试试」，两个词都在按钮上、不需要额外解释）。
   */
  const skillLock = showUse === true && installed !== true
    ? (install === undefined ? ENTERPRISE_ESC_LOCAL_COPY.skillInstallUnavailable : install.reason)
    : undefined
  /**
   * ★**口径 53**：这一枚**正在装**时那三个字（「安装中…」）。
   *
   * ★为什么它必须**上屏**而不是只挂在无障碍名上：那枚【＋】是个圆形图标钮（宽 `--esc-icon-btn`），
   *   里面只有一个加号 —— 若"在途"只体现为 `disabled` 与 `aria-label`，**明眼用户看不出它在装**
   *   （只会读成"这枚按钮忽然灰了"）。故按同一枚 `.esc-card-lock` 的行上落点把文案写出来。
   * ★它**只有这一档**出（`busy` 由计划显式给，不从 `disabled` 推）——另三种禁用各自写各自的**原因**，
   *   两者互斥：`reason` 在途那一档是缺席的，所以同一时刻只有一句话。
   */
  const skillBusyText = showUse === true && installed !== true && install?.busy === true ? install.text : undefined

  /**
   * ★**本刀（S5a）**：「更多」里那两枚本机管理动作的**在途交代**与**失败交代**。
   *
   * ★**为什么在途也要上屏**（与上面那三个字同一条理由）：那枚 `⋯` 是个图标钮、菜单一关就什么都没有；
   *   而"正在删本机这份技能目录"是这件事里最必须当场看见的一句 —— 它由计划显式给
   *   （`EscCardMore.busyText`），**不从 `disabled` 推**：禁用还可能是"端口缺席"或"另一枚在跑"，
   *   凭它推会冒出一句假话。
   * ★**失败为什么落在卡片上**：这两枚动作是**卡片自己的**下拉里的动作，失败就该落回**这一枚卡片**上
   *   （与列表层那条"这一整面读不到"互不覆盖）。呈现走唯一提示组件（人话 + 下一步 + 收起稳定码），
   *   `role="alert"` 由它自己挂；本组件只负责把它画在**卡片内缘**（headmain 的最后一格）——
   *   卡片**直属子节点**的位次被一批位置级结构锁盯着，故新增的格子一律住 headmain（见下面那段）。
   */
  const moreBusyText = installed === true ? more?.busyText : undefined
  const moreFailure = installed === true ? more?.failure : undefined
  /**
   * ★**本刀（S5b）**：「去试试」那枚的**在途交代**、**行上可见原因**与**失败**。
   *
   * 三件与 `more` 那一组**同一条纪律**（在途必须上屏、禁用必须写明原因、失败走唯一提示件），
   * 只是落点由**计划**带下来（`esc-skill-try.ts` 的纯投影说了算，卡片不自己判）。
   */
  const tryBusyText = installed === true ? tryNow?.busyText : undefined
  const tryLock = installed === true ? tryNow?.reason : undefined
  const tryFailure = installed === true ? tryNow?.failure : undefined
  /**
   * ★**本刀（S5b）**：这一枚卡片上**唯一的失败位**（两枚动作共用一处提示件）。
   *
   * ★为什么合成一格而不是各画一枚：一张卡上"刚才那一下没成"同一时刻只可能有一件（两枚动作各自开始时
   *   都会清掉自己那一格，见 `esc-aggregation.tsx` 的两枚执行器）；两处并排画出来只会让员工以为
   *   **两件事都失败了**。这一格也顺带把"全文件 `createElement(EnterpriseErrorNotice, …)` 仍然恰好
   *   一处"这条既有结构锁保住（`tests/esc-skill-more.spec.ts`）。
   * ★次序是**确定**的（`more` 优先）：危险档（卸载）失败的信息量更大，且两枚同时有失败在正常路径上
   *   不会发生；真正决定"谁上屏"的是页面层那两枚执行器的清理时机，不是这里的 `??`。
   */
  const cardFailure = moreFailure ?? tryFailure

  // ★口径 47（用户原话「……唯一不同是安装图标改为开关按钮，去除底部标签」）：
  //   已安装技能页那张卡把**标题行第二格**换成官方 `Switch` 原语——它表达的是**这一包装没装**
  //   （拨下去＝卸载：本机今天**没有**技能启停路由，故开关只能表达"装/卸"这件真事；
  //     用户自定义那一档连卸载路由都没有，于是它拿到的 `disabled` 会是 true + 一句写明的原因）。
  //   位置与技能卡那枚「+」完全相同（同一个 `esc-card-titlerow` 的第二格）⇒ 版式一字未动。
  const switchBox =
    actionSwitch === undefined
      ? null
      : createElement(Switch, {
          checked: actionSwitch.checked,
          onChange: actionSwitch.onChange,
          disabled: actionSwitch.disabled === true,
          label: item.name,
          title: actionSwitch.title,
          className: 'esc-card-switch',
        })

  // 专家「召唤」（口径 42）。
  //
  // ★位置与技能卡那枚「+」**完全相同**——「标题行」的第二格；区别只在**默认状态**：
  //   技能卡那枚是**常驻**的（workbuddy 真图里一直看得见），专家这枚**默认收起、卡片 hover 才展开**。
  //   收起态由样式层的 `.esc-summon-slot`（`max-width: 0` + `opacity: 0`）做到**零占位** ⇒
  //   标题拿到整行宽、不会被一个看不见的按钮提前截断；展开时标题那一格随之缩短、省略号落在这枚按钮左侧
  //   —— 用户那句「显示按钮时标题如果太长就截断」正是这两个状态的对照。
  //   它仍**置灰未接线**（与连接器那两枚同档），故不需要键盘焦点路径（见样式层那段注释）。
  const summonSlot =
    showSummon === true
      ? createElement(
          'div',
          { className: 'esc-summon-slot' },
          createElement(Button, {
            variant: 'primary',
            size: 'sm',
            disabled: true,
            // ★本轮第 ② 条：「召唤」的高度/内衬/圆角/字重由 `.esc-root .esc-summon` 那一格给
            //   （--esc-summon-*，真源 esc-scale.ts 的 WB.control.summon）。它**不复用**工具栏那枚
            //   「添加技能」的 --esc-btn-* —— 那是主按钮的尺度，压在卡片标题行上会显得过高。
            className: 'esc-action-solid esc-summon',
            title: notPorted,
            children: ENTERPRISE_ESC_COPY.summon,
          }),
        )
      : null

  // 连接器：已连接 = 常驻启用开关 + hover 浮现的「断开」；未连接 = hover 浮现的「连接」（原文口径，同上）
  const connectBox =
    showConnect === true
      ? createElement(
          'div',
          { className: connected ? 'esc-action-box esc-action-box-pinned' : 'esc-action-box' },
          connected
            ? createElement(
                'span',
                { className: 'esc-hover-reveal' },
                createElement(Button, {
                  variant: 'primary',
                  size: 'sm',
                  disabled: true,
                  className: 'esc-action-solid',
                  title: notPorted,
                  children: '断开',
                }),
              )
            : createElement(Button, {
                variant: 'primary',
                size: 'sm',
                disabled: true,
                className: 'esc-action-solid',
                title: notPorted,
                children: '连接',
              }),
          connected
            ? createElement(Switch, {
                checked: item.connectionEnabled === true,
                onChange: () => undefined,
                disabled: true,
                label: item.name,
                title: notPorted,
              })
            : null,
        )
      : null

  // ★**口径 42**：右下角那枚 hover 浮现的收藏钮（`.esc-corner-box` + `.esc-star-box`）**整块撤下**——
  //   它是**旧三层版式**的浮层（bottom 12 / right 16，绝对定位），而新版式底部是标签行
  //   （收藏量就在那一行里）⇒ 它只会**浮在标签行上**；技能卡也没有它（用户要的正是这两档一致）。
  //   它本来就是**置灰未接线**的占位（`disabled` + title 写明原因）⇒ 撤下不丢任何可用功能。

  // ★**本刀（workbuddy 风格）**：底部那条**标签行**取代原页面的「发布者行 + 统计页脚」两层。
  // 截图里的顺序是：⚡收藏量 · ✔安装量 · 作者 · 使用量 —— 逐项**按实际有没有**渲染，
  // 缺的项留一个 `-` 占位而不是编一个数（见 `ENTERPRISE_ESC_LOCAL_COPY.statUnavailable` 的理由）。
  // ★本刀（用户裁决⑧）：顺序为 **作者 → 收藏量 → 安装量 → 使用量**（原来是收藏/安装/作者/使用）。
  //   作者排第一是因为它是唯一来自卡片主数据（`publishUser`）的那一格，另三格都是统计/占位。
  // ★**口径 40（用户裁决「技能底部的图标使用专家底部的图标，作者头像使用和专家一致的」）**：
  //   ① **作者那一格**走**专家卡用的那一枚 `AuthorRow`**（真头像经 `enterpriseEscImageSrc` 换本机代理、
  //      加载失败退首字字母头像、名字同一套 `.esc-author-name`）；
  //   ② **三枚统计图标**一律走那**唯一**一套 `statIconOf`（人 / 会话 / 收藏）⇒ 星形实心跟随收藏态
  //      那条口径也自动同源（原先两处各写一遍 `fill` 判据）。
  //      ⚠**字形与指标的对应按"这一格在数什么"定**：安装量＝「多少人装了」⇒ 人形（`user`）；
  //        使用量＝「被用了多少次」⇒ 会话气泡（`link`）；收藏量本就是收藏 ⇒ 星形（`star`）。
  // ★**口径 42（用户裁决「专家卡片调整成和技能卡片布局一致…底部标签」）——这一行现在是两档共用的那一行**，
  //   故值必须**真值驱动**，不能像上一版那样把后两格钉死成短横：
  //     ① 语料（口径 40 那一版）：平台对**技能**不回 `userCount`/`convCount`（真机 7 条技能全是 `null`），
  //        而**专家**那两格是**真数**（截图里的 👤2 💬12）⇒ 把后两格写死 `-`，等于让专家卡丢真数据；
  //     ② 现在：`tagCellOf` 按"这一格在不在 `item.stats` 里"决定画真数还是短横 ⇒
  //        技能卡画成 `★1 👤- 💬-`（一字未变），专家卡画成 `★0 👤2 💬12`（真数保住）。
  //        ★前提是**投影层不再把 `null` 假装成 `0`**（口径 42 同时改了 `mapPublishedStats`，
  //          否则两档都会拿到一个"真的 0"，这一行就分不清"没有这个数"和"确实是 0"）。
  //   ★**顺序与项数都没动**：作者 → 收藏量 → 安装量 → 使用量（裁决⑧），四格一个不增不减；
  //     作者是我们平台真有的数据（`publishUser`），删掉是丢信息。
  const tagCellOf = (type: ResourceStatType, title: string): ReactNode => {
    const stat = (item.stats ?? []).find(entry => entry.type === type)
    return createElement(
      'span',
      { className: 'esc-tag', title },
      statIconOf(type),
      createElement('span', null, stat === undefined ? ENTERPRISE_ESC_LOCAL_COPY.statUnavailable : String(stat.value)),
    )
  }
  const tagRow = createElement(
    'div',
    { className: 'esc-card-tags' },
    hasText(publishName)
      ? createElement(
          'span',
          { className: 'esc-tag esc-tag-author', title: publishName },
          createElement(AuthorRow, { avatar: item.publishUser?.avatar, name: publishName }),
        )
      : null,
    tagCellOf('star', ENTERPRISE_ESC_COPY.statCollect),
    tagCellOf('user', ENTERPRISE_ESC_COPY.statInstall),
    tagCellOf('link', ENTERPRISE_ESC_COPY.statUsage),
  )

  // 连接器卡片：分类 + 连接状态（原文口径：分类为空时不画状态点）。它只在旧三层版式里出现，
  // 故与标签行版式互斥（口径 42 的那两档头里只有「标题行 + 描述」两格）。
  const connectorExtraBox =
    showConnect === true
      ? createElement(
          'div',
          { className: 'esc-extra-box' },
          createElement(
            'span',
            { className: 'esc-connect-info' },
            hasText(item.category) ? createElement('span', { className: 'esc-connect-category' }, item.category) : null,
            createElement(
              'span',
              {
                className: `esc-connect-status ${connected ? 'esc-status-connected' : 'esc-status-disconnected'}`,
              },
              hasText(item.category) ? createElement('span', { className: 'esc-status-dot' }) : null,
              connected ? ENTERPRISE_ESC_COPY.connected : ENTERPRISE_ESC_COPY.disconnected,
            ),
          ),
        )
      : null

  // ★**口径 42（用户裁决「专家卡片调整成和技能卡片布局一致，标题描述，底部标签」）**：
  //   专家卡与技能卡现在是**同一套版式**（头行＝「标题行 + 描述独立一行」、底部＝标签行），
  //   差别只在标题行第二格放谁（技能＝常驻的安装「+」，专家＝默认收起的「召唤」，见上面 `summonSlot`）
  //   与卡片的层级（技能有阴影、专家无，SPEC §7）。
  //   判据只覆盖这两档：连接器与"无 props 的默认档"仍是原页面的三层版式（用户没提、也不该顺手改）。
  const tagRowLayout = showUse === true || showSummon === true

  // 卡片根类名：技能卡与专家卡走版式那一套（**带标签行**），连接器沿用原页面的两层。
  return createElement(
    'div',
    {
      // ★SPEC §7 分层策略：技能卡（有阴影，可点入口）· 专家/连接器卡（无阴影，列表项）。
      //   这三类此前共用同一个类名，阴影一刀切——那与 workbuddy 的分层策略相反。
      className:
        showUse === true
          ? 'esc-card esc-card-skill'
          // ★判据顺序按「哪一种卡」排，**不能先判 showStats**——连接器卡默认 `showStats` 也是 true，
          //   先判它会被误判成专家卡（分层类名给错 ⇒ 该无阴影的卡带着阴影）。
          : showConnect === true
            ? 'esc-card esc-card-connector'
            : showSummon === true
              ? 'esc-card esc-card-expert'
              : showStats === true
                ? 'esc-card esc-card-expert'
                : 'esc-card esc-card-compact',
    },
    createElement(
      'header',
      { className: 'esc-card-header' },
      createElement(EnterpriseEscCardIcon, { icon: item.icon, shape: iconShape }),
      createElement(
        'div',
        { className: 'esc-card-headmain' },
        // ★**口径 41（用户裁决「技能卡片描述的截断位置应该是卡片边缘而不是安装按钮，因为他是独立一行」）**：
        //   头里就此分成**两行**——第一行是「标题 + 动作格」（`.esc-card-titlerow`），
        //   第二行是描述（`.esc-card-headdesc`，独立成行）。
        //   为什么非要把动作格再往里收一格：口径 39 把它放进**头行**时，它是 headmain 的**兄弟**，
        //   于是 headmain 的可用宽度（也就是描述那一行的右端）被它按 `flex: none` 让掉一整块，
        //   描述的省略号就落在动作格的左边缘。可动作格只对齐**标题那一行**（`align-self: flex-start`），
        //   描述那一行上并没有东西压着它 ⇒ 让掉的那块宽度是白丢的——这正是用户看到的"描述被安装按钮截住"。
        //   收进「标题行」之后：动作格只吃标题那一行的宽度（口径 39 的效果**一字不减**：标题那格仍是
        //   `flex: 1 / min-width: 0`、动作格仍是 `flex: none`，省略号**永远**落在动作格左侧），
        //   描述那一行则吃到**卡片内缘**（headmain 现在是头行里最后一格 ⇒ 右端与下面那条标签行对齐）。
        //   ★**口径 42 起这一套对专家卡同样成立**（它此前是"标题 + 作者行"两层），
        //     故这条判据从 `showUse` 放宽到两档共用；连接器/默认档的标题仍是**裸 h3**。
        tagRowLayout
          ? createElement(
              'div',
              { className: 'esc-card-titlerow' },
              createElement('h3', { className: 'esc-card-title', title: item.name, children: item.name }),
              // ★口径 47：那一格给了开关就画开关（开关优先）——已安装技能卡既不画技能那枚「+」，
              //   也不画专家那枚「召唤」。
              actionSwitch === undefined
                ? showUse === true ? skillActionBox : summonSlot
                : switchBox,
            )
          : createElement('h3', { className: 'esc-card-title', title: item.name, children: item.name }),
        // 描述：**独立一行**（口径 41）——右端到卡片内缘、单行截断。口径 42 起专家卡也走这一格
        // （它的描述此前是 `.esc-card-content` 的两行截断，见下面那句反向说明）。
        tagRowLayout && hasText(item.description)
          ? createElement('p', { className: 'esc-card-headdesc', title: item.description, children: item.description })
          : null,
        /**
         * ★**口径 53（本刀）**：卡片元信息行（版本短号 / 大小 / 内含技能数）。
         *
         * ★**为什么它住在 headmain 里、而不是卡片的直属子节点**：本卡片的直属子节点序列**已被
         *   一批位置级结构锁**（口径 31/42 的渲染树判据按 `[header, content, footer, connect]`
         *   取位）。把新元素加到那一层会让**每一张**既有卡片的子节点位次平移 —— 那是"为了让新功能
         *   上线而改旧结构的账"，本仓不做。放进 headmain（第三、四格）则：既有几档（不填 `meta`、
         *   不画锁）**一个节点都不多**，四格位置锁照旧全绿。
         * ★取值口唯一（`ResourceItem.meta` ← `enterpriseCatalogItem` ← `enterpriseSkillMeta`），
         *   且**缺席即整行不进 DOM**。单行截断 + `title` 兜住全文：它是元信息，长出来只会把卡片顶高。
         */
        tagRowLayout && hasText(item.meta)
          ? createElement('p', { className: 'esc-card-meta', title: item.meta, children: item.meta })
          : null,
        tagRowLayout && skillBusyText !== undefined
          ? createElement('p', {
              className: 'esc-card-lock',
              role: 'status',
              'data-esc-install-busy': 'true',
              children: skillBusyText,
            })
          : null,
        /**
         * ★**口径 53（本刀）**：未装技能卡那枚【＋】**按不动时**的行上可见原因。
         *
         * 它是**可见文字**（`role="status"`）、不是悬浮说明 —— 产品宪法明令"禁用控件不许只挂一句 title"，
         * 而广场那批技能（NUWAX 已发布）在本刀**仍然禁用**（没有可下载的制品，见 `skillLock` 那段的推理）
         * ⇒ 那句话必须真的写在卡片上，否则这一刀就把一个已知缺口藏起来了。
         * `data-esc-install-lock` 是给门禁的稳定钩子（"这一档的禁用真的带着可见原因"要能被机器判据咬住）。
         */
        tagRowLayout && skillLock !== undefined
          ? createElement('p', {
              className: 'esc-card-lock',
              role: 'status',
              'data-esc-install-lock': 'true',
              children: skillLock,
            })
          : null,
        /**
         * ★**本刀（S5a）**：「更多」里那两枚本机管理动作的在途交代（「卸载中…」/「正在打开所在文件夹…」）。
         *
         * 落点与上面那枚「安装中…」**同一格**（`.esc-card-lock` + `role="status"`）：两句互斥
         * （一个属于未装那一档的【＋】，一个属于已装那一档的「更多」），故同一时刻只可能有一句上屏。
         * `data-esc-skill-more-busy` 是给门禁的稳定钩子（"在途真的有一句可见文字"要被机器判据咬住）。
         */
        tagRowLayout && moreBusyText !== undefined
          ? createElement('p', {
              className: 'esc-card-lock',
              role: 'status',
              'data-esc-skill-more-busy': 'true',
              children: moreBusyText,
            })
          : null,
        /**
         * ★**本刀（S5b）**：已装技能卡那枚「去试试」的在途交代与**行上可见**的禁用原因。
         *
         * 落点与上面那两格**同一格**（`.esc-card-lock` + `role="status"`，**零新增 CSS 类**）：
         * 四句话（安装中 / 更多在途 / 去试试在途 / 去试试为什么按不动）**两两互斥**——它们分属不同档位，
         * 同一时刻只可能有一句上屏；`data-esc-skill-try-busy` / `data-esc-skill-try-lock` 是给门禁的
         * 稳定钩子（"在途真有一句可见文字""禁用真带着可见原因"要能被机器判据咬住）。
         */
        tagRowLayout && tryBusyText !== undefined
          ? createElement('p', {
              className: 'esc-card-lock',
              role: 'status',
              'data-esc-skill-try-busy': 'true',
              children: tryBusyText,
            })
          : null,
        tagRowLayout && tryLock !== undefined
          ? createElement('p', {
              className: 'esc-card-lock',
              role: 'status',
              'data-esc-skill-try-lock': 'true',
              children: tryLock,
            })
          : null,
        /**
         * ★**本刀（S5a）**：这两枚动作**失败**时的唯一提示件（人话 + 下一步 + 收进「技术信息」的稳定码）。
         *
         * ★它由计划带来（稳定码 + 动作前缀），卡片只把它画在**这一枚卡片**上：
         *   失败落在"哪一枚技能"上是卡片级的坐标（与列表层那条"整面读不到"互不覆盖）。
         * ★**一张卡一个失败位**（本刀 S5b 把「去试试」的失败并进这一格，见上面 `cardFailure` 那段）：
         *   全文件因此仍然**恰好一处** `createElement(EnterpriseErrorNotice, …)`。
         * ★**没有「重试」按钮**（与列表层那些失败块**刻意不同**）：危险动作的每一次执行都必须重新过
         *   确认框，而提示件里塞一枚「重试」正好绕过它 —— 重试的正当入口是那枚下拉（打开 → 点它 → 确认）。
         * ★**零新增 CSS 类**：底色/字号走行内 token（与 `error-notice.tsx` 自己的口径一致：
         *   它跨多个各自注入全局单类 `<style>` 的页面复用，故不新增会被互相覆盖的类）。
         */
        tagRowLayout && cardFailure !== undefined
          ? createElement(EnterpriseErrorNotice, {
              className: 'esc-card-error',
              code: cardFailure.code,
              prefix: cardFailure.prefix,
              style: { marginTop: 4, color: 'var(--dsw-alias-state-error-primary, #c4320a)', fontSize: 12, lineHeight: '18px' },
            })
          : null,
        connectorExtraBox,
      ),
      // 动作位**不在这里**：口径 39 它进过头行（头行第三格），口径 41 起再往里收一格、
      // 挂进上面的「标题行」——它该吃的是**标题那一行**的宽度，不该让掉描述那一行（见上）。
    ),
    // 描述那一格（两行截断的 `.esc-card-content`）**只给旧三层版式**：标签行版式（技能/专家）的描述
    // 已在卡片头里独立成行（见上）。口径 42 起专家卡不再走这一格。
    tagRowLayout ? null : createElement('div', { className: 'esc-card-content', children: item.description ?? '' }),
    // 底部那一行：标签行版式＝标签行（作者 + 三格统计，口径 40/42）；旧三层版式＝统计页脚。
    // ★**口径 47**：标签行可以**整行撤下**（`showTags: false`，已安装技能页用——它与技能卡的唯一
    //   区别就是没有这一行）。默认 `true`，故技能卡/专家卡既有渲染一字未变；旧三层那一支不看它。
    //   ★口径 53 的两格（`esc-card-meta` / `esc-card-lock`）**不在这里**：它们住在上面 headmain 里
    //     的第三、四格（理由见那一处：卡片直属子节点的位次已被位置级结构锁盯着，不动它）。
    tagRowLayout
      ? (showTags ? tagRow : null)
      : showStats === true ? createElement('div', { className: 'esc-card-footer' }, statsRow) : null,
    // 连接器那两枚（常驻开关 + hover 浮现的连接/断开）仍在卡片直属层（旧三层版式，绝对定位右上角）。
    connectBox,
  )
}

/**
 * ★**本刀（S5a）**：「更多」下拉的实现（`SkillMoreActions` 与那两行纯数据）已抽到
 * `esc-more-menu.tsx`——本件因此回到单文件上限之下（抽之前它已逼近 800 行）。
 * 本文件只留一行接线（`skillActionBox` 里那一句）与上面 `more` 计划那一段契约说明。
 */

/**
 * 卡片图标：有可用地址就画图；没有就画中性图标（原文是固定 PNG 兜底图）。
 *
 * ★**本刀（Phase C D1）把它导出**（原名 `CardIcon`，私有）：连接器广场那张**新卡**
 *   （`esc-connector-plaza.tsx`）也要画图标，而"平台给的绝对地址要经宿主代理 + 加载失败一次即回落
 *   兜底图形"这条**唯一**的破图兜底只该有一处实现 —— 复制一份出来迟早在 `onError` 上漂开
 *   （本文件那段注释记的正是"没有 onError 兜底时真机画出破图"那次事故）。
 */
export function EnterpriseEscCardIcon({
  icon,
  shape,
}: {
  readonly icon?: string | undefined
  readonly shape: 'square' | 'circle'
}): ReactNode {
  const cls = shape === 'circle' ? 'esc-card-image esc-card-image-circle' : 'esc-card-image'
  // ★平台给的绝对地址要经宿主代理（那张图要票据，浏览器直连必破图）；换不出来的地址照样走兜底图标。
  // ★`broken` 这一格是**活体取证补上的**：平台数据里确实存在**跨域**图标（如 `https://s3.nuwax.com:9443/…`、
  //   `https://nuwax.nat300.top/api/f/…`），宿主的图片代理按红线只认**与会话同一台 origin** ⇒ 回 400，
  //   `<img>` 就画成一个破图（此前没有 onError 兜底，文件头那句"永远不会画出破图"只对"换不出来的地址"成立）。
  //   现在加载失败一次就切回兜底图标——"破图"这条路不再成立。
  const [broken, setBroken] = useState(false)
  const src = broken ? undefined : enterpriseEscImageSrc(icon)
  if (src !== undefined)
    return createElement('img', { className: cls, src, alt: '', loading: 'lazy', onError: () => setBroken(true) })
  return createElement(
    'span',
    { className: cls, style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
    createElement(Bot, { size: 20, 'aria-hidden': true }),
  )
}

/** 发布者的头像 + 昵称（原 `AuthorInfo`）：头像缺席时用首字字母头像（原文是固定 PNG 兜底图）。 */
function AuthorRow({ avatar, name }: { readonly avatar?: string | undefined; readonly name: string }): ReactNode {
  // 同图标那条：跨域头像会被宿主如实拒掉 ⇒ 加载失败一次就换成首字字母头像，不留破图。
  const [broken, setBroken] = useState(false)
  const src = broken ? undefined : enterpriseEscImageSrc(avatar)
  const picture = src !== undefined
    ? createElement('img', { className: 'esc-author-avatar', src, alt: '', loading: 'lazy', onError: () => setBroken(true) })
    : createElement(
        'span',
        {
          className: 'esc-author-avatar',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            // ★口径 36 修：这里原本写着 `--dsw-alias-background-secondary` —— 主题里**不存在**这枚 token
            //   （真实名见 esc-style.ts 头部的映射表），整条声明计算期无效 ⇒ 首字字母头像一直没有底色。
            //   按那张映射表换成 `bg-skeleton`（与缺图占位同一格灰）。
            background: 'var(--dsw-alias-bg-skeleton)',
            color: 'var(--dsw-alias-label-tertiary)',
            fontSize: 10,
          },
          'aria-hidden': true,
        },
        name.slice(0, 1) || '·',
      )
  return createElement(
    'span',
    { className: 'esc-author' },
    picture,
    createElement('span', { className: 'esc-author-name', children: name }),
  )
}

/** 非空白字符串判据（空串与全空白都当"没有"）。 */
function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
