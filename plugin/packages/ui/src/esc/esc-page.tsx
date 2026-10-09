/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useLayoutEffect/useRef/useState、`esc-api` 的取数面、
 *   `esc-aggregation`/`esc-resource-tabs`/`esc-style` 三个展示件、两个子页视图（`esc-installed`/`esc-my-experts`）
 *   与 `esc-types` 的类型
 * [OUTPUT]: 对外提供 `EnterpriseEscPanel`——「专家·技能·连接器」整页（左上三个药丸页签 + 内容区），
 *   由 `main` 槽经 inject 面拿到 `{api}` 后渲染；另导出子页收尾用的两枚判据
 *   `ENTERPRISE_ESC_VIEW_SCROLL_CLASS` / `enterpriseEscViewScroller`（见下）
 * [POS]: esc 页面的**页面壳**，移植自 NUWAX `pages/ExpertSkillConnector/index.tsx`（48 行）。
 *   ★与原文的对应关系逐条：原文从**路径**解析资源类型（`parseEscPath(location.pathname)`），这里改成组件状态
 *   （DSH 的独立页面没有那三条子路由）；原文那个"重复点击当前项也要刷新"的 `_t` 令牌，这里按下标自增——
 *   两处**都用同一个 `key={`${resourceType}-${refreshToken}`}` 把内容区 remount**，故刷新语义完全一致。
 *   ★**布局改动（用户裁决）**：原来的 200px 左栏整块撤掉，三个菜单（专家&专家团 / 技能 / 连接器）改到内容页
 *   左上角作**药丸页签**（`esc-resource-tabs`，官方 `Pill`）。页签住在这一层、**不在被 remount 的 `key` 子树里**——
 *   切换时只有数据区重建，页签自身不被重置。
 *   ★`styles.container` 的 `flex h-full` → `.esc-root`（竖排：页签行 + 内容区）；样式由 `EnterpriseEscStyle` 注入一次。
 *   ★**演示数据**（口径 32）：原先这里按 `api.escMockStatus()` 挂一条「模拟数据」免责横幅，
 *   **已按用户裁决（本轮）整条撤掉**（原话「模拟数据提示不要」）——组件文件 `esc-mock-banner.tsx` 一并删除。
 *   "这一栏是演示数据"这件事仍可在协议层查到：宿主 `GET …/esc/mock` 报开关态、演示响应多一枚 `mock: true`。
 *   ★**口径 46/47**：这一页有**两个视图**（目录 / 已安装技能）——没有真实路由，故用一份视图状态切换
 *   （与商城页的技能详情同一条手法）；`skillPort` 缺席时那一页根本打不开（按钮跟着置灰）。
 *   ★**口径 49**：`main` 的 inject 面再多带一枚 `draftPort`（技能页下拉那两项「查找技能 / 创建技能」
 *   的实现面），由本层原样转交给内容区；它同样**不进** `api`（那一面结构性只读）。
 *   ★**口径 51（本刀）**：**第三个视图**「我的专家」（`esc-my-experts.tsx`，由专家页那枚主按钮打开）。
 *   两件事在这一层一次做完、两个子页**共用同一份收尾**：
 *     ① **两条关闭路径**：子页左上角【返回】+ **Esc**（监听钉在本页根节点 `.esc-root` 上，命中即
 *        `preventDefault` + `stopPropagation`——只吃自己这一层，不去抢设置页/宿主别处的 Esc）。
 *        **浏览器返回键不接**：本页是官方 `main` 槽的一个面板、没有真实路由，硬造 `history` 会与宿主打架，
 *        故如实只给上面两条（与插件详情子页面同判，门禁有"不许出现 pushState/popstate"的反向锁）。
 *     ② **返回后还原列表滚动位置与焦点**：进入子页**那一刻**读下当前滚动面的 `scrollTop`
 *        （内容区一被换掉，浏览器立刻把它夹回去，事后再读就晚了），返回时按 `useLayoutEffect`
 *        （绘制前落定、看不见跳动）写回，并把焦点还给工具栏那一枚主按钮（旧 DOM 引用已失效 ⇒ 按
 *        `data-esc-main-action` 选择器在新树里找回它）。**写回那一步是"可达才停"的有界重放**
 *        （`ENTERPRISE_ESC_VIEW_RESTORE_FRAMES`）：列表重新挂载时先渲染 `.esc-loading`、高度不够，
 *        浏览器会把 `scrollTop` 夹回 0 ⇒ 只写一次在真实数据下是**静默失效**的；可达即停手，不与用户抢。
 *        滚动面为什么是 `.esc-content` 一格：
 *        口径 44/45/⑧ 之后，**两种档位下的滚动面都是它**（桌面档 `overflow-y: auto`、移动档同一格），
 *        列表那口 `.esc-scroll` 早已退回普通块 ⇒ 认它一格就够，不必再发明第二套"谁在滚"的判定。
 *     ③ **本刀没有加宽任何既有职责**：取数链、`refreshToken`（仍**恰好一处**自增，由页签点击改）、
 *        精选与卡片的几何一个字都没动；新增的只有"多一个视图 + 它的两条关闭路径与收尾"。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { EnterpriseEscAggregation } from './esc-aggregation.js'
import type { EnterpriseEscApi } from './esc-api.js'
import { EnterpriseEscFeatured } from './esc-featured.js'
import { EnterpriseEscInstalledView } from './esc-installed.js'
import { EnterpriseEscMyExpertsPage, ENTERPRISE_ESC_MY_EXPERTS_TITLE_ATTR } from './esc-my-experts.js'
import { EnterpriseEscResourceTabs } from './esc-resource-tabs.js'
import { EnterpriseEscStyle } from './esc-style.js'
import type { EnterpriseEscDraftPort, EnterpriseEscSkillPort, ResourceTypeEnum } from './esc-types.js'

/**
 * ★**口径 51**：esc 页子页的滚动面类名。
 *
 * 口径 44/45/⑧ 之后，**两种档位下**的滚动面都是内容区自己（桌面档 `.esc-content { overflow-y: auto }`、
 * 移动档同一格；列表那口 `.esc-scroll` 已退回普通块）⇒ "谁在滚"只有这一个答案，写成一枚常量，
 * 免得收尾那一句与视图里的类名各写一份、日后漂开。
 */
export const ENTERPRISE_ESC_VIEW_SCROLL_CLASS = 'esc-content'

/**
 * ★**口径 51**：返回时"重放滚动位置"的**帧数上限**（有界，约 0.5 秒 @60fps）。
 *
 * 返回时列表是重新挂载的、而它一挂上就重新取数 ⇒ 这个位置要等列表长回来才**留得住**。
 * 这里给的是一个**上限**而不是"一直重试"：列表真回不来（取数失败 / 被清空）时就停手，
 * 绝不把"还原滚动位置"变成一个永远在后台跑的循环。
 */
export const ENTERPRISE_ESC_VIEW_RESTORE_FRAMES = 30

/**
 * ★**口径 51**：从页壳根节点上取"此刻真的会滚的那一格"（**纯读**：不写 DOM、不发请求）。
 *
 * @param root - 页壳根节点（`.esc-root`）；缺席（还没挂载 / 纯函数直调）即 `undefined`。
 * @returns 那个滚动元素；找不到时 `undefined`（调用方据此什么都不做，绝不猜一个元素去写）。
 */
export function enterpriseEscViewScroller(
  root: { querySelector(selectors: string): unknown } | null | undefined,
): HTMLElement | undefined {
  if (root === null || root === undefined) return undefined
  const node = root.querySelector(`.${ENTERPRISE_ESC_VIEW_SCROLL_CLASS}`)
  // 这里只是一次收窄：`querySelector` 的静态返回类型是 `Element | null`，而调用方要的是能读
  // `scrollTop` 的那个元素。判空之后就把它当 `HTMLElement` 用（本页塞进这一格的只可能是那个 div）。
  return node === null || node === undefined ? undefined : (node as HTMLElement)
}

/** 页面入参（由 `main` 槽的 inject 面给出）。 */
export interface EnterpriseEscPanelProps {
  readonly api: EnterpriseEscApi
  /**
   * ★口径 46：本机技能写入口（可选——纯函数直调 / 没有本机写面时缺席，工具栏那两枚按钮随之置灰写明原因）。
   */
  readonly skillPort?: EnterpriseEscSkillPort | undefined
  /**
   * ★**口径 49**：技能页下拉里「查找技能 / 创建技能」的**草稿端口**（跳新会话 + 预填、不发送）。
   *
   * 与 `skillPort` 同一条注入范式：缺席 ⇒ 那两项置灰写明原因（判据是端口在不在场，不写死 disabled）。
   * ★它**不进** `api`（那一面结构性只读），也不是第二套开会话机制——实现在 `preset-launch.ts`。
   */
  readonly draftPort?: EnterpriseEscDraftPort | undefined
}

/** 「专家·技能·连接器」整页。 */
export function EnterpriseEscPanel({ api, skillPort, draftPort }: EnterpriseEscPanelProps): ReactNode {
  // 当前资源类型（原文由路径推导，这里就是状态）
  const [resourceType, setResourceType] = useState<ResourceTypeEnum>('expert')
  /**
   * ★口径 47：当前是不是「已安装技能」那个视图（本页没有真实路由 ⇒ 一份视图状态，见下面那段注释）。
   */
  const [installedOpen, setInstalledOpen] = useState(false)
  /**
   * ★**口径 51**：当前是不是「我的专家」那个视图（第三个视图；同一条手法——没有真实路由）。
   *
   * 两个视图状态**互斥**由开合动作保证（`openMyExperts` 会先关掉已安装那一支，反之亦然）：
   * 一个视图只有一份打开来源，故不需要第二套"谁盖住谁"的层级判定。
   */
  const [myExpertsOpen, setMyExpertsOpen] = useState(false)
  /**
   * 刷新令牌：原文的 `location.state._t`。页签每次点击都 +1——**包括重复点击当前项**，
   * 于是 `key` 变化 ⇒ 内容区 remount ⇒ 重拉数据、重置筛选与滚动（与线上行为一致）。
   */
  const [refreshToken, setRefreshToken] = useState<number>(0)
  /** 页壳根节点（Esc 的监听范围钉在这里；收尾时也从这里找回滚动面与主按钮）。 */
  const root = useRef<HTMLDivElement>(null)
  /** 进子页前那一刻的滚动位置（进入那一下读，之后内容区就被换掉了）。 */
  const scrollMemory = useRef<number | undefined>(undefined)
  /** 还在跑的那一帧（返回时重放滚动位置用；离开 / 再进子页即取消，绝不留悬空回调）。 */
  const restoreFrame = useRef<number | undefined>(undefined)
  /** 是从哪一枚打开的：返回时按它决定要不要把焦点还给主按钮（并区分进入时的聚焦落点）。 */
  const opener = useRef<'installed' | 'my-experts' | undefined>(undefined)
  /** 正在看子页（两个视图之一）——Esc 与收尾两个 effect 共用这一枚判据。 */
  const viewOpen = myExpertsOpen || (installedOpen && skillPort !== undefined)

  /** 进子页前把真值读下来（**点击那一刻**，见文件头 ②）。 */
  const rememberScroll = (): void => {
    scrollMemory.current = enterpriseEscViewScroller(root.current)?.scrollTop
  }
  /** ★口径 47：「已安装」的唯一开法（写入口缺席时这一枚根本点不到，这里再挡一次）。 */
  const openInstalled = (): void => {
    if (skillPort === undefined) return
    rememberScroll()
    opener.current = 'installed'
    setMyExpertsOpen(false)
    setInstalledOpen(true)
  }
  /** ★口径 51：专家页那枚「我的专家」的唯一开法。 */
  const openMyExperts = (): void => {
    rememberScroll()
    opener.current = 'my-experts'
    setInstalledOpen(false)
    setMyExpertsOpen(true)
  }
  /** 关子页（返回按钮与 Esc **共用**这一枚；收尾交给下面那个 `useLayoutEffect`）。 */
  const closeView = (): void => {
    setInstalledOpen(false)
    setMyExpertsOpen(false)
  }
  /**
   * ★**口径 51**：Esc 这条关闭路径。监听钉在**本页根节点**上（不是 `document`）：
   * 只有焦点落在这一页里时 Esc 才回列表，不去抢别的面板；命中后 `stopPropagation`，
   * 免得这一下继续冒泡去关设置页/宿主别的层（与 `plugin-market.tsx` 的详情子页面逐条同判）。
   */
  useEffect(() => {
    if (!viewOpen) return
    const node = root.current
    if (node === null) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setInstalledOpen(false)
      setMyExpertsOpen(false)
    }
    node.addEventListener('keydown', onKeyDown)
    return () => { node.removeEventListener('keydown', onKeyDown) }
  }, [viewOpen])
  /**
   * ★**口径 51**：进入子页时把焦点放到那一页的落点上。
   *
   * 「我的专家」子页的标题带 `data-esc-my-experts-title`（`tabIndex={-1}` 的程序化聚焦点）⇒
   * 读屏立刻报出「我的专家」。用 `useLayoutEffect`：绘制前就把焦点放好，用户看不到
   * "焦点还留在已经不在的那枚按钮上"那一帧（与插件详情子页面同一条手法）。
   * ★已安装那一支今天没有可聚焦的标题钩子（口径 47 的标题是 `span`，本刀不动那个文件），
   *   故这一条只对新子页生效；**返回**那一侧的收尾两个子页逐条相同（见下）。
   */
  useLayoutEffect(() => {
    if (!viewOpen || opener.current !== 'my-experts') return
    root.current?.querySelector<HTMLElement>(`[${ENTERPRISE_ESC_MY_EXPERTS_TITLE_ATTR}]`)?.focus()
  }, [viewOpen])
  /**
   * ★**口径 51**：返回时把**滚动位置与焦点**还原到进入子页前那一眼
   * （`useLayoutEffect` 在绘制前落定，看不见跳动）。
   *
   * 两件都按**新挂载的那棵树**找回：滚动面是新的 `.esc-content`（同类的另一枚元素），
   * 主按钮是新的那一枚（进子页前那个 DOM 节点 `isConnected === false`，照旧引用 focus 会静默失败）
   * ⇒ 故焦点用 `data-esc-main-action` 选择器取，而不是存 DOM 引用。
   */
  useLayoutEffect(() => {
    if (viewOpen) return
    const top = scrollMemory.current
    scrollMemory.current = undefined
    if (top !== undefined) {
      /**
       * ★**为什么要"重放"若干帧**（不这么做的话这一步在真实数据下**静默失效**）：
       * 返回时目录那一支是**重新挂载**的，它一挂上就重新取数（`.esc-loading` 那一态），
       * 此时滚动面里只有一枚转圈图标 ⇒ `scrollHeight` 还不够高，浏览器**立刻把 `scrollTop` 夹回 0**
       * （写是写进去了，值留不住）。故按"这个位置**此刻可达吗**"判一次：不可达就等下一帧重放，
       * 直到列表长回来（或到达有界上限 `ENTERPRISE_ESC_VIEW_RESTORE_FRAMES` 停手，绝不无限重试）。
       * ★**不与用户抢**：一旦位置可达就停手（此刻用户已经能正常滚动，后续不再写第二笔）。
       */
      let frames = 0
      const apply = (): void => {
        const scroller = enterpriseEscViewScroller(root.current)
        if (scroller === undefined) {
          restoreFrame.current = undefined
          return
        }
        scroller.scrollTop = top
        const reachable = scroller.scrollHeight - scroller.clientHeight >= top
        frames += 1
        if (reachable || frames > ENTERPRISE_ESC_VIEW_RESTORE_FRAMES) {
          restoreFrame.current = undefined
          return
        }
        restoreFrame.current = requestAnimationFrame(apply)
      }
      apply()
    }
    const from = opener.current
    opener.current = undefined
    // 焦点还给工具栏那一枚主按钮（按选择器在**新挂载**的树里找回，见上面那段）。
    if (from !== undefined) root.current?.querySelector<HTMLElement>('[data-esc-main-action]')?.focus()
    // 离开这一页 / 又进了子页 ⇒ 停掉还没跑完的重放（不留一个悬空的帧回调去写已经换掉的那棵树）。
    return () => {
      if (restoreFrame.current === undefined) return
      cancelAnimationFrame(restoreFrame.current)
      restoreFrame.current = undefined
    }
  }, [viewOpen])
  // ★用户裁决（本轮）：「模拟数据提示不要」——原来这里挂一条常驻免责横幅（读 `api.escMockStatus()`）。
  //   横幅已整条撤掉（组件文件一并删除）；**机器可读的信号仍在**：宿主 `GET …/esc/mock` 照旧报开关态、
  //   演示目录的响应仍多一枚 `mock: true` ⇒ "这一栏是演示数据"这件事在协议层仍可查，只是不再占据页面。
  return createElement(
    'div',
    { className: 'esc-root', ref: root },
    createElement(EnterpriseEscStyle),
    /**
     * ★口径 47 / **口径 51**：这一页有**三个视图** —— 目录（默认）、「已安装技能」、「我的专家」。
     *
     * 与商城页的技能/配方详情子页面**同一条手法**：这一页没有真实路由（`main` 槽的一个面板），
     * 故用视图状态切换，**不硬造 `history`**；「返回」就是把它切回来。
     * 切回来时目录那一支是**重新挂载**的 ⇒ 已装计数与列表都是新读的，不必在卸载时手工通知谁
     * （滚动位置与焦点由上面那个 `useLayoutEffect` 单独还原，与"数据是新的"这件事不冲突）。
     * ★「已安装技能」那一支要求本机写入口在场（缺席 ⇒ 那一页根本打不开：入口按钮已置灰写明原因）；
     *   「我的专家」那一支**不需要**任何端口——它今天要不到清单，内容区是一句如实交代
     *   （见 `esc-my-experts.tsx` 的头注：那不是我漏了接线，是这台部署没有那条接口）。
     */
    myExpertsOpen
      ? createElement(EnterpriseEscMyExpertsPage, { onBack: closeView })
      : installedOpen && skillPort !== undefined
        ? createElement(EnterpriseEscInstalledView, {
            api,
            skillPort,
            onBack: closeView,
          })
        : createElement(
            EnterpriseEscAggregation,
            // ★用户裁决④：**三页签与顶栏右块（更多/搜索/已安装/添加）必须在同一行**。
            //   此前页签住在 `.esc-root`、工具栏住在 `.esc-content`（聚合区）——**两个容器、两行**，
            //   怎么调 CSS 都不可能同排。解法是**结构**而不是样式：把页签交给聚合区，由它排进工具栏**左侧**，
            //   与右块同处那个 `justify-content: space-between` 的主行里 ⇒ 同排由 flex 保证，不靠巧合。
            //   ★「精选」那一行由聚合区经工具栏的**第二栏**（`belowLeading`）挂出——**专家页与技能页都挂**
            //     （两页同一套逻辑，只有 `targetType` 不同：`Agent` / `Skill`），连接器页不挂
            //     （连接器目录走 `/api/connector/providers`，与官方推荐那条取数面无关）。
            {
              key: `${resourceType}-${refreshToken}`,
              api,
              resourceType,
              onResourceTypeChange: code => {
                setResourceType(code)
                setRefreshToken(token => token + 1)
              },
              // ★口径 46：本机写入口（本地导入 + 自装清单 + 卸载），缺席时工具栏那两枚自己置灰写明原因。
              skillPort,
              // ★口径 49：技能页下拉那两项的草稿端口（跳新会话 + 预填、不发送；缺席即置灰写明原因）。
              draftPort,
              // ★口径 47：「已安装」打开已安装技能页（没有真实路由 ⇒ 一份视图状态；缺席即置灰）。
              onOpenInstalled: skillPort === undefined ? undefined : () => openInstalled(),
              // ★口径 51：「我的专家」打开第三个视图（本刀）。它**没有数据面**（子页如实交代），
              //   故这一位与 `skillPort` 无关：只要页面在就点得开。
              onOpenMyExperts: () => openMyExperts(),
            },
          ),
  )
}
