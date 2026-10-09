/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useRef/useState、官方原语 `Button`、lucide 的 `ArrowLeft`/`Inbox`，`esc-copy` 的文案、`esc-card` 那张卡、`esc-installed-model` 的纯投影、`esc-api` 的三条只读取数（官方发现面 + 两份元信息）、`esc-types` 的写入口类型，以及 `error-notice` 的唯一失败提示件
 * [OUTPUT]: 对外提供 `EnterpriseEscInstalledView`——「已安装技能」页（**按来源分组** + 每张卡一枚开关）
 * [POS]: esc 页的**第二个视图**（口径 47/54），由工具栏那枚「已安装」打开、页壳 `esc-page` 负责切换（没有真实路由，故用一份视图状态切换——与商城页的技能详情子页面同一条手法）。
 *   ★**口径 54（用户裁决：同时已安装里面显示的就是 DSH 本地已安装的技能）**：
 *     · **列表真源 = `api.discoveredSkills()`**（宿主官方 `ctx.get('skills')` 的快照 = 运行时真正加载的那一份）
 *       —— 它答的是"**磁盘上真的装着什么**"，而不是"我们自己那两份记录里写了什么"。
 *     · **来源标注**：按官方 `source`（+「与企业记录同名」这一格）分组，组名就是"谁放进去的"
 *       （企业装下来的 / 本机导入的 / 项目里的 / 官方内置 / 其它来源（原样枚举）），判定全在
 *       `esc-installed-model.ts`（纯投影，因为本仓 vitest 跑不了 hook —— 见那个文件头）。
 *     · **两份老记录降级为元信息**（`api.installedSkills()` 给 `versionId`/`packageId`、
 *       `api.selfInstalledSkills()` 给 `sha256`/`displayName`）：它们**不再决定"列不列出来"**，
 *       只在卡片上贡献显示名、在开关的悬浮说明里贡献那半句版本/摘要，并决定那枚开关**能不能拨**
 *       （名字对上企业记录才有中心包 id ⇒ 才有卸载路由）。
 *     · `complete === false` ⇒ **如实说"还在发现中"**（页头一条可见的 `role="status"`），
 *       数字位保持为"目前真的读到的那几个" —— **不当 0、不写死数字**。
 *   ★版式照用户那张参考图：**分组标题 + 卡片网格**。卡片**就是技能卡那张**（`EnterpriseEscCard` + `showUse`），
 *     两处不同仍按用户原话：① 标题行第二格＝**开关**（`actionSwitch`）；② **没有底部标签行**（`showTags: false`）。
 *     ★本刀**一字未动卡片几何与类名**（"不许动卡片几何"是硬约束）：元信息那半句的落点因此选在
 *       **开关的悬浮说明**上（与"置灰原因"同一个落点，也是本仓对 title 的既有用法），不新增 DOM 层。
 *   ★如实缺口（写在开关的置灰原因里）：本机导入 / 项目里 / 官方内置的那些枚**没有**中心雪花包 id
 *     ⇒ 宿主侧**没有**对应的卸载路由，开关置灰并写明原因；而技能**启停**（参考图里那个开关的原意）
 *     在本机与平台两侧**都不存在**路由，故开关在这里表达的是**装/卸**这件真事。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { ArrowLeft, Inbox } from 'lucide-react'
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { enterpriseLocalErrorCode } from '../local-api.js'
import type { EnterpriseDiscoveredSkill, EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'
import { EnterpriseEscCard } from './esc-card.js'
import type { EnterpriseEscApi } from './esc-api.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import {
  enterpriseEscInstalledGroups,
  enterpriseEscInstalledMetaTable,
  type EnterpriseEscInstalledCard,
} from './esc-installed-model.js'
import type { EnterpriseEscSkillPort } from './esc-types.js'

/** 一个只读取数的三态（三份取数**各算各的**：元信息读不到**不**能把真源那份也拖成失败）。 */
type ReadState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'ready'; readonly value: T }

/** 官方发现面那一份（`value` 里多一枚 `complete`：官方自己说"发现完了没有"）。 */
type DiscoveryState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'ready'; readonly skills: readonly EnterpriseDiscoveredSkill[]; readonly complete: boolean }

/** 两张老记录的元信息（降级后的用途：显示名 / 版本 / 摘要 / 卸载用包 id）。 */
type MetaState = ReadState<{
  readonly center: readonly EnterpriseInstalledSkill[]
  readonly self: readonly EnterpriseSelfInstalledSkill[]
}>

/** 入参。 */
export interface EnterpriseEscInstalledViewProps {
  /** 只读面：官方发现面（真源）+ 两份元信息（`GET …/skills/discovered` / `installed` / `self-installed`）。 */
  readonly api: EnterpriseEscApi
  /** 写入口：卸载（口径 46 起与「添加技能」共用同一枚端口）。 */
  readonly skillPort: EnterpriseEscSkillPort
  /** 回列表（本页没有真实路由，返回就是切视图状态）。 */
  readonly onBack: () => void
}

/** 一句可见的加载/失败交代（空着与读不到是两件事，分开说）。 */
function hintNode(className: string, children: ReactNode): ReactNode {
  return createElement('div', { className }, children)
}

/** 加载态那一格（`aria-busy` 让读屏知道这还在读，不是"没有"）。 */
function loadingNode(): ReactNode {
  return createElement('div', { className: 'esc-installed-hint', 'aria-busy': true }, ENTERPRISE_ESC_COPY.loading)
}

/**
 * 一张已安装卡片：技能卡那套版式 + 标题行那一格开关 + **没有底部标签行**（口径 47 的两处不同）。
 *
 * @param each - 纯投影给出的一条卡片数据（key / 卡片 / 开关能不能拨 / 元信息半句）。
 * @param disabled - 这一枚**此刻**能不能拨（在途时置灰；`each.locked` 的置灰在调用处另算）。
 * @param title - 悬浮说明（置灰原因，或"拨下去会发生什么"；**元信息半句也并在这里**）。
 * @param onChange - 拨动（只有"关"这一个方向是真的动作）。
 */
function installedCard(
  each: EnterpriseEscInstalledCard,
  disabled: boolean,
  title: string,
  onChange: (next: boolean) => void,
): ReactNode {
  return createElement(EnterpriseEscCard, {
    key: each.key,
    item: each.item,
    iconShape: 'square',
    // 技能卡那套版式（标题行 + 描述独立一行）——用户原话「卡片和技能卡片一致」。
    showUse: true,
    // ① 标题行第二格＝开关；② 没有底部标签行。这两处就是用户说的"唯一不同"。
    actionSwitch: { checked: true, disabled, title, onChange },
    showTags: false,
  })
}

/**
 * 「已安装技能」页。
 *
 * @param props - 见 `EnterpriseEscInstalledViewProps`。
 * @returns 页头（返回 + 标题 + 总数 + 「还在发现中」那句）+ 按来源分组的分节 + 整页空态/失败态。
 */
export function EnterpriseEscInstalledView({ api, skillPort, onBack }: EnterpriseEscInstalledViewProps): ReactNode {
  const [discovery, setDiscovery] = useState<DiscoveryState>({ kind: 'loading' })
  const [meta, setMeta] = useState<MetaState>({ kind: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  /** 在途卸载的包 id（那一枚开关在途时置灰；别的开关不受影响）。 */
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  /** 卸载失败的稳定码（唯一失败提示件的输入；下一次动作开始时清掉）。 */
  const [actionCode, setActionCode] = useState<string | undefined>(undefined)
  const actionAbort = useRef<AbortController | null>(null)
  /**
   * 三趟取数**各自**落地（口径同文件头：元信息读不到不拖真源）。
   *
   * ★**真源那一趟只有一条请求**（`api.discoveredSkills`）：列表、计数、"装没装"三件事同源，
   *   不存在"计数读一份、列表读另一份"那种会静默漂开的形态。
   */
  useEffect(() => {
    const controller = new AbortController()
    setDiscovery({ kind: 'loading' })
    setMeta({ kind: 'loading' })
    void (async () => {
      try {
        const snapshot = await api.discoveredSkills(controller.signal)
        if (controller.signal.aborted) return
        setDiscovery({ kind: 'ready', skills: snapshot.skills, complete: snapshot.complete })
      } catch (error) {
        if (controller.signal.aborted) return
        setDiscovery({ kind: 'failed', code: enterpriseLocalErrorCode(error) })
      }
    })()
    void (async () => {
      try {
        // 两份**元信息**串行读（同一趟里各一次请求）：任一条失败即整趟降级为"元信息读不到"，
        // 但**列表那一趟不受影响**（发现面已经给出了列表与真值）。
        const center = await api.installedSkills(controller.signal)
        if (controller.signal.aborted) return
        const self = await api.selfInstalledSkills(controller.signal)
        if (controller.signal.aborted) return
        setMeta({ kind: 'ready', value: { center, self } })
      } catch (error) {
        if (controller.signal.aborted) return
        setMeta({ kind: 'failed', code: enterpriseLocalErrorCode(error) })
      }
    })()
    return () => controller.abort()
  }, [api, reloadToken])
  // 离开这一页即中止在途的卸载（迟到结果不回填）。
  useEffect(() => () => { actionAbort.current?.abort() }, [])

  const skills = discovery.kind === 'ready' ? discovery.skills : []
  /** 元信息表：读到了就用它；读不到给一张**空表**（卡片照样画出来，只是没有显示名/版本/卸载口）。 */
  const metaTable = meta.kind === 'ready'
    ? enterpriseEscInstalledMetaTable(meta.value.center, meta.value.self)
    : enterpriseEscInstalledMetaTable([], [])
  const groups = enterpriseEscInstalledGroups(skills, metaTable)
  const total = skills.length
  /** ★官方自己说"还没发现完" ⇒ 数字位那一个数**还会变**，页面必须说出来（口径 54）。 */
  const discovering = discovery.kind === 'ready' && discovery.complete === false

  const uninstall = (packageId: string): void => {
    actionAbort.current?.abort()
    const controller = new AbortController()
    actionAbort.current = controller
    setActionCode(undefined)
    setBusyId(packageId)
    void (async () => {
      try {
        await skillPort.uninstallSkill(packageId, controller.signal)
        if (controller.signal.aborted) return
        /**
         * ★卸载成功后**只重跑那两趟读**（`reloadToken`）：卸载真的改了磁盘，而"磁盘上现在有什么"
         *   只有官方发现面说了算 —— 界面绝不自己从列表里减掉一枚（那是乐观猜测，不是真值）。
         */
        setReloadToken(token => token + 1)
      } catch (error) {
        if (controller.signal.aborted) return
        setActionCode(enterpriseLocalErrorCode(error))
      } finally {
        if (!controller.signal.aborted) setBusyId(undefined)
      }
    })()
  }

  /** 组名带计数（括号里的数**只**统计这一组真的发现到的那些）。 */
  const groupTitleOf = (title: string, count: number): ReactNode =>
    createElement('h4', { className: 'esc-installed-group-title' }, `${title}（${count}）`)

  /**
   * 一节：组名 + 卡片网格。
   *
   * ★置灰与悬浮说明的判据只有一条：**这一枚有没有中心包 id**（`locked`）。
   *   有 ⇒ 真能拨（拨下去是卸载，host 侧 `POST …/skills/uninstall` 真的存在）；
   *   没有 ⇒ 置灰 + 写明原因（不是"忘了接线"，是本部署对**这一枚**没有卸载路由）。
   * ★元信息半句（版本/摘要）并进悬浮说明：卡片几何不许动，而这条事实必须**说得出**
   *   （它正是两份老记录降级之后**仅剩**的用途）。
   */
  const groupNode = (id: string, title: string, cards: readonly EnterpriseEscInstalledCard[]): ReactNode =>
    createElement(
      'section',
      { className: 'esc-installed-group', key: id },
      groupTitleOf(title, cards.length),
      createElement(
        'div',
        { className: 'esc-list-section' },
        cards.map(each => {
          const withMeta = (sentence: string): string => each.meta === undefined ? sentence : `${sentence}（${each.meta}）`
          const packageId = each.packageId
          return each.locked || packageId === undefined
            ? installedCard(each, true, withMeta(ENTERPRISE_ESC_LOCAL_COPY.selfInstalledLocked), () => undefined)
            : installedCard(
                each,
                busyId === packageId,
                withMeta(ENTERPRISE_ESC_LOCAL_COPY.centerUninstallTitle),
                (next: boolean) => { if (!next && busyId !== packageId) uninstall(packageId) },
              )
        }),
      ),
    )

  const settled = discovery.kind !== 'loading'
  const allEmpty = settled && discovery.kind === 'ready' && total === 0

  return createElement(
    'div',
    { className: 'esc-content' },
    createElement(
      'div',
      { className: 'esc-installed-head' },
      createElement(Button, {
        variant: 'outline',
        size: 'sm',
        className: 'esc-installed-back',
        onClick: onBack,
        icon: createElement(ArrowLeft, { size: 14, 'aria-hidden': true }),
        children: ENTERPRISE_ESC_LOCAL_COPY.installedBack,
      }),
      createElement(
        'span',
        { className: 'esc-installed-title' },
        `${ENTERPRISE_ESC_LOCAL_COPY.installedTitle}（${total}）`,
      ),
      /**
       * ★**口径 54**：官方还没发现完 ⇒ 当场说出来（`role="status"` 是"过程事实"的正确语义，
       * 不是 `alert`：这不是失败）。句子里一个数字都没有 —— 用户裁决「不许当 0、不许写死数字」。
       */
      discovering
        ? createElement(
            'span',
            { className: 'esc-installed-discovering', role: 'status' },
            ENTERPRISE_ESC_LOCAL_COPY.installedDiscovering,
          )
        : null,
    ),
    actionCode === undefined
      ? null
      : createElement(EnterpriseErrorNotice, { className: 'esc-installed-error', code: actionCode }),
    /**
     * ★元信息读不到**必须说出来**（本仓硬纪律"不许静默吞失败"）：它不影响列表（列表来自真源），
     *   但它决定了"能不能在这里卸载"与那半句版本/摘要 —— 静默吞掉会让员工以为
     *   "这枚技能本来就不能卸"。走唯一提示件（人话 + 下一步 + 稳定码）。
     */
    meta.kind === 'failed'
      ? createElement(EnterpriseErrorNotice, {
          className: 'esc-installed-error',
          code: meta.code,
          prefix: ENTERPRISE_ESC_LOCAL_COPY.installedMetaFailed,
        })
      : null,
    createElement(
      'div',
      { className: 'esc-scroll esc-scroll-hidden' },
      discovery.kind === 'loading'
        ? loadingNode()
        : discovery.kind === 'failed'
          ? hintNode(
              'esc-installed-hint',
              createElement(
                'span',
                null,
                ENTERPRISE_ESC_LOCAL_COPY.installedGroupFailed,
                createElement('code', { className: 'esc-state-code' }, discovery.code),
              ),
            )
          : allEmpty
            ? createElement(
                'div',
                { className: 'esc-state' },
                createElement(
                  'div',
                  { className: 'esc-empty-art', 'aria-hidden': 'true' },
                  createElement(Inbox, { size: 28, strokeWidth: 1.5 }),
                ),
                createElement('div', { children: ENTERPRISE_ESC_LOCAL_COPY.installedEmpty }),
              )
            // 分节顺序取 `ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS`（企业 → 本机 → 项目 → 官方 → 未知）：
            // 顺序的真源只有 `esc-installed-model.ts` 那一处。
            : groups.map(group => groupNode(group.id, group.title, group.cards)),
    ),
    // 真源那一趟读不到 ⇒ 给一枚真重试（它是"列表从哪来"的唯一来源，读不到就没有可看的东西）。
    discovery.kind === 'failed'
      ? createElement(Button, {
          variant: 'outline',
          size: 'sm',
          className: 'esc-installed-retry',
          onClick: () => setReloadToken(token => token + 1),
          children: ENTERPRISE_ESC_LOCAL_COPY.retry,
        })
      : null,
  )
}
