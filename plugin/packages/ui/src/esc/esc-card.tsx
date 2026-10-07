/**
 * [INPUT]: 依赖 React 的 createElement/useState、lucide-react 的图标、官方原语 `Button`/`Menu`/`Switch`（`@deepseek-ai/dsh-client-ui-primitives`）、`esc-api` 的 `enterpriseEscImageSrc`、`esc-copy` 的文案与 `esc-types` 的 `ResourceItem`
 * [OUTPUT]: 对外提供 `EnterpriseEscCard`（专家/技能/连接器共用的聚合卡片）与 `SKILL_MORE_ENTRIES`（技能卡「更多」下拉那三行的**纯数据**）
 * [POS]: esc 页面的**卡片层**，同时移植了 NUWAX 的 `CardWrapper`（容器版式）与 `ResourceCard`（业务内容与动作位）两个组件。
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
 *   ★动作位一律按 A 档**置灰**并写明原因（召唤 / 连接 / 断开 / 安装 / 更多三行 / 去试试）：看得见的那一页
 *   先搬，动作诚实置灰——**不是**把它们删掉（删掉版式就与线上不同了）。
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
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Menu, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { Bot, Folder, MessageSquare, MoreHorizontal, Pencil, Plus, Star, Trash2, User } from 'lucide-react'
import { createElement, useState, type ReactNode } from 'react'
import { enterpriseEscImageSrc } from './esc-api.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
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
}

/**
 * 「更多」下拉里的三行（照 workbuddy 截图：编辑 / 打开文件夹 / 卸载，卸载是危险档）。
 *
 * ★显式标出 `danger?` —— 不标的话 TS 会把三条推成三个互不相容的字面量联合，
 * 于是 `.map` 里读 `entry.danger` 直接报错（这就是 `MenuItem` 期望的那个可选位）。
 */
export interface SkillMoreEntry {
  readonly id: 'edit' | 'open-folder' | 'uninstall'
  readonly label: string
  readonly danger?: boolean | undefined
}

/**
 * ★**导出**：这三条的**内容**（id / 文案 / 危险档）是纯数据，测试要能直查——
 * 而 `SkillMoreActions` 自己持有 `open` 态，在没有 React 调度器的纯函数测试里渲染不出来。
 * 导出它就能让「三行逐字 + 逐行置灰 + 卸载是危险档」这条判据落在**真数据**上，
 * 而不是靠把组件硬渲染一遍。
 */
export const SKILL_MORE_ENTRIES: readonly SkillMoreEntry[] = [
  { id: 'edit', label: '编辑' },
  { id: 'open-folder', label: '打开文件夹' },
  { id: 'uninstall', label: '卸载', danger: true },
]

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
  // ★**本刀（workbuddy 风格）**：技能卡右侧改成 workbuddy 那两种形态——
  //   未安装：一枚**常驻圆形「+」**（不是原页面那种 hover 才浮现的按钮，截图里它一直看得见）；
  //   已安装：**「更多」下拉 + 「去试试」**两枚并排。
  // 两枚动作本刀都**不接线**（安装/编辑/打开文件夹/卸载/去试用都不是本页这条纵深的事），
  // 但照旧**置灰 + 写明原因**，且「更多」是真能打开的下拉（形态对、行为空），
  // 这样用户看到的版式就是上线后的样子，差的那一步一眼可见。
  const skillActionBox =
    showUse === true
      ? createElement(
          'div',
          { className: 'esc-skill-actions' },
          installed === true
            ? createElement(SkillMoreActions, { name: item.name, notPorted })
            : createElement(
                'button',
                {
                  type: 'button',
                  className: 'esc-install-plus',
                  disabled: true,
                  title: notPorted,
                  'aria-label': `${ENTERPRISE_ESC_COPY.installSkill}：${item.name}`,
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
                  disabled: true,
                  title: notPorted,
                  children: ENTERPRISE_ESC_COPY.tryNow,
                },
              )
            : null,
        )
      : null

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
            className: 'esc-action-solid',
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
      createElement(CardIcon, { icon: item.icon, shape: iconShape }),
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
              showUse === true ? skillActionBox : summonSlot,
            )
          : createElement('h3', { className: 'esc-card-title', title: item.name, children: item.name }),
        // 描述：**独立一行**（口径 41）——右端到卡片内缘、单行截断。口径 42 起专家卡也走这一格
        // （它的描述此前是 `.esc-card-content` 的两行截断，见下面那句反向说明）。
        tagRowLayout && hasText(item.description)
          ? createElement('p', { className: 'esc-card-headdesc', title: item.description, children: item.description })
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
    tagRowLayout ? tagRow : showStats === true ? createElement('div', { className: 'esc-card-footer' }, statsRow) : null,
    // 连接器那两枚（常驻开关 + hover 浮现的连接/断开）仍在卡片直属层（旧三层版式，绝对定位右上角）。
    connectBox,
  )
}

/**
 * 已安装技能那枚「更多」下拉（workbuddy 截图里的 `⋯`）。
 *
 * ★形态照截图（三行：编辑 / 打开文件夹 / 卸载，卸载是危险档），**行为空**：三行都置灰并写明原因——
 * 那三个动作分别属于技能编辑/文件/卸载三条纵深，都不在本页这一刀里。
 * 用官方 `Menu` 原语（它自带遮罩、Esc、外部点击关闭、`danger` 行），不自造下拉。
 */
function SkillMoreActions({ name, notPorted }: { readonly name: string; readonly notPorted: string }): ReactNode {
  const [open, setOpen] = useState(false)
  return createElement(
    Menu,
    {
      open,
      // 官方 Menu 是「触发器 + 条件列表」两合一：`anchor` 落在原位、列表跟随它。
      anchor: createElement(
        'button',
        {
          type: 'button',
          className: 'esc-more-btn',
          'aria-label': `${ENTERPRISE_ESC_COPY.moreActions}：${name}`,
          'aria-expanded': open,
          title: ENTERPRISE_ESC_COPY.moreActions,
        },
        createElement(MoreHorizontal, { size: 16, 'aria-hidden': true }),
      ),
      items: SKILL_MORE_ENTRIES.map(entry => ({
        id: entry.id,
        label: entry.label,
        disabled: true,
        title: notPorted,
        danger: 'danger' in entry && entry.danger === true,
        icon: createElement(entry.danger === true ? Trash2 : entry.id === 'edit' ? Pencil : Folder, {
          size: 14,
          'aria-hidden': true,
        }),
      })),
      onSelect: () => setOpen(false),
      onClose: () => setOpen(false),
    },
  )
}

/** 卡片图标：有可用地址就画图；没有就画中性图标（原文是固定 PNG 兜底图）。 */
function CardIcon({
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
