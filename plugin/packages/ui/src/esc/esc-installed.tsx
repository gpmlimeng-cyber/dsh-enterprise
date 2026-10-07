/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useRef/useState、官方原语 `Button`、lucide 的 `ArrowLeft`/`Inbox`，`esc-copy` 的文案、`esc-card` 那张卡、`esc-installed-model` 的纯投影、`esc-api` 的只读已装清单、`esc-types` 的写入口类型，以及 `error-notice` 的唯一失败提示件
 * [OUTPUT]: 对外提供 `EnterpriseEscInstalledView`——「已安装技能」页（两个分组 + 每张卡一枚开关）
 * [POS]: esc 页的**第二个视图**（口径 47），由工具栏那枚「已安装」打开、页壳 `esc-page` 负责切换（没有真实路由，故用一份视图状态切换——与商城页的技能详情子页面同一条手法）。
 *   ★版式照用户那张参考图：**分组标题 + 卡片网格**（两个分组：`用户自定义` / `来自市场`）。
 *   ★卡片**就是技能卡那张**（`EnterpriseEscCard` + `showUse`）——唯一两处不同按用户原话：
 *     ① 标题行第二格＝**开关**（`actionSwitch`，不再画安装「+」/「更多 + 去试试」）；
 *     ② **没有底部标签行**（`showTags: false`）。
 *   ★两个分组的两份真值**各自独立**（不是一份清单切两半），判定全在 `esc-installed-model.ts`（纯投影，
 *     因为本仓 vitest 跑不了 hook —— 见那个文件头）：
 *     · `来自市场`＝`GET …/skills/installed`（**企业**已装记录，条目带中心雪花 `packageId` ⇒ 有卸载路由）；
 *     · `用户自定义`＝`GET …/skills/self-installed`（**本机自装**记录，没有中心 id ⇒ **没有**卸载路由）。
 *     故「只有本地导入的是用户自定义」这件事是**数据面**成立的，不是按名字猜的。
 *   ★如实缺口（写在开关的置灰原因里）：本机自装包今天**没有**卸载落盘路由 ⇒ 那一组的开关置灰并写明原因；
 *     而技能**启停**（参考图里那个开关的原意）在本机与平台两侧**都不存在**路由，故开关在这里表达的是
 *     **装/卸**这件真事——与商城页技能行那枚开关同义（那一枚也走 `/skills/uninstall`）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { ArrowLeft, Inbox } from 'lucide-react'
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { enterpriseLocalErrorCode } from '../local-api.js'
import type { EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'
import { EnterpriseEscCard } from './esc-card.js'
import type { EnterpriseEscApi } from './esc-api.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import {
  ENTERPRISE_ESC_INSTALLED_KINDS,
  enterpriseEscCenterInstalledCard,
  enterpriseEscInstalledTitleOf,
  enterpriseEscSelfInstalledCard,
  type EnterpriseEscInstalledCard,
  type EnterpriseEscInstalledKind,
} from './esc-installed-model.js'
import type { EnterpriseEscSkillPort } from './esc-types.js'

/** 一个分组的四态（两份真值各算各的：一个读不到**不**把另一个也拖成失败）。 */
type InstalledGroup<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'ready'; readonly items: readonly T[] }

/** 入参。 */
export interface EnterpriseEscInstalledViewProps {
  /** 只读面：企业已装清单（`GET …/skills/installed`）。 */
  readonly api: EnterpriseEscApi
  /** 写入口：自装清单读 + 卸载（口径 46 起与「添加技能」共用同一枚端口）。 */
  readonly skillPort: EnterpriseEscSkillPort
  /** 回列表（本页没有真实路由，返回就是切视图状态）。 */
  readonly onBack: () => void
}

/**
 * 一个分组那一格的**正文**（四态 → 一棵子树；空着与读不到是两件事，分开说）。
 *
 * @param state - 这一组的状态。
 * @param cards - 这一组铺出来的卡片（`state.kind === 'ready'` 时给）。
 * @returns 卡片网格，或一句如实的提示。
 */
function installedGroupBody<T>(state: InstalledGroup<T>, cards: readonly ReactNode[] | undefined): ReactNode {
  if (state.kind === 'loading') {
    return createElement('div', { className: 'esc-installed-hint', 'aria-busy': true }, ENTERPRISE_ESC_COPY.loading)
  }
  if (state.kind === 'failed') {
    return createElement(
      'div',
      { className: 'esc-installed-hint' },
      ENTERPRISE_ESC_LOCAL_COPY.installedGroupFailed,
      createElement('code', { className: 'esc-state-code' }, state.code),
    )
  }
  if (state.items.length === 0) {
    return createElement('div', { className: 'esc-installed-hint' }, ENTERPRISE_ESC_LOCAL_COPY.installedGroupEmpty)
  }
  return createElement('div', { className: 'esc-list-section' }, cards)
}

/**
 * 一张已安装卡片：技能卡那套版式 + 标题行那一格开关 + **没有底部标签行**（口径 47 的两处不同）。
 *
 * @param each - 纯投影给出的一条卡片数据（key / 卡片 / 开关能不能拨）。
 * @param disabled - 这一枚**此刻**能不能拨（在途时置灰；`each.locked` 的置灰在调用处另算）。
 * @param title - 悬浮说明（置灰原因，或"拨下去会发生什么"）。
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
 * @returns 页头（返回 + 标题 + 总数）+ 两个分组（各自四态）+ 卡片网格；两份都空时出一个空态。
 */
export function EnterpriseEscInstalledView({ api, skillPort, onBack }: EnterpriseEscInstalledViewProps): ReactNode {
  const [centerGroup, setCenterGroup] = useState<InstalledGroup<EnterpriseInstalledSkill>>({ kind: 'loading' })
  const [selfGroup, setSelfGroup] = useState<InstalledGroup<EnterpriseSelfInstalledSkill>>({ kind: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  /** 在途卸载的包 id（那一枚开关在途时置灰；别的开关不受影响）。 */
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  /** 卸载失败的稳定码（唯一失败提示件的输入；下一次动作开始时清掉）。 */
  const [actionCode, setActionCode] = useState<string | undefined>(undefined)
  const actionAbort = useRef<AbortController | null>(null)
  // 两趟取数**各自**落地（口径同文件头：一个读不到不拖另一个）。
  useEffect(() => {
    const controller = new AbortController()
    setCenterGroup({ kind: 'loading' })
    setSelfGroup({ kind: 'loading' })
    void (async () => {
      try {
        const items = await api.installedSkills(controller.signal)
        if (controller.signal.aborted) return
        setCenterGroup({ kind: 'ready', items })
      } catch (error) {
        if (controller.signal.aborted) return
        setCenterGroup({ kind: 'failed', code: enterpriseLocalErrorCode(error) })
      }
    })()
    void (async () => {
      try {
        const items = await skillPort.selfInstalledSkills(controller.signal)
        if (controller.signal.aborted) return
        setSelfGroup({ kind: 'ready', items })
      } catch (error) {
        if (controller.signal.aborted) return
        setSelfGroup({ kind: 'failed', code: enterpriseLocalErrorCode(error) })
      }
    })()
    return () => controller.abort()
  }, [api, skillPort, reloadToken])
  // 离开这一页即中止在途的卸载（迟到结果不回填）。
  useEffect(() => () => { actionAbort.current?.abort() }, [])

  const total =
    (centerGroup.kind === 'ready' ? centerGroup.items.length : 0) +
    (selfGroup.kind === 'ready' ? selfGroup.items.length : 0)
  /** 两份都落了地（不管成没成）——空态与"两个都失败"的重试都只在它成立时才判。 */
  const settled = centerGroup.kind !== 'loading' && selfGroup.kind !== 'loading'
  const allEmpty = settled && total === 0 && centerGroup.kind === 'ready' && selfGroup.kind === 'ready'
  const bothFailed = settled && centerGroup.kind === 'failed' && selfGroup.kind === 'failed'

  const uninstall = (packageId: string): void => {
    actionAbort.current?.abort()
    const controller = new AbortController()
    actionAbort.current = controller
    setActionCode(undefined)
    setBusyId(packageId)
    void (async () => {
      try {
        const items = await skillPort.uninstallSkill(packageId, controller.signal)
        if (controller.signal.aborted) return
        // Host 回的就是「卸载后最新已装态」⇒ 直接覆盖，不再多打一趟（与商城行上那条同源）。
        setCenterGroup({ kind: 'ready', items })
      } catch (error) {
        if (controller.signal.aborted) return
        setActionCode(enterpriseLocalErrorCode(error))
      } finally {
        if (!controller.signal.aborted) setBusyId(undefined)
      }
    })()
  }

  /** 组名带计数（读不到/加载中时给 0——括号里的数**只**统计真的读到的那些）。 */
  const groupTitleOf = (kind: EnterpriseEscInstalledKind, count: number): ReactNode =>
    createElement('h4', { className: 'esc-installed-group-title' }, `${enterpriseEscInstalledTitleOf(kind)}（${count}）`)

  /** 「用户自定义」那一组：本机自装记录，那枚开关**恒拨不动**（没有卸载路由，原因写在 title 里）。 */
  const selfGroupNode = (): ReactNode => createElement(
    'section',
    { className: 'esc-installed-group' },
    groupTitleOf('self', selfGroup.kind === 'ready' ? selfGroup.items.length : 0),
    installedGroupBody(
      selfGroup,
      selfGroup.kind === 'ready'
        ? selfGroup.items.map(record =>
            installedCard(enterpriseEscSelfInstalledCard(record), true, ENTERPRISE_ESC_LOCAL_COPY.selfInstalledLocked, () => undefined))
        : undefined,
    ),
  )

  /** 「来自市场」那一组：企业已装记录，那枚开关能拨 —— 拨下去就是**卸载**（既有 `POST …/skills/uninstall`）。 */
  const centerGroupNode = (): ReactNode => createElement(
    'section',
    { className: 'esc-installed-group' },
    groupTitleOf('center', centerGroup.kind === 'ready' ? centerGroup.items.length : 0),
    installedGroupBody(
      centerGroup,
      centerGroup.kind === 'ready'
        ? centerGroup.items.map(record =>
            installedCard(
              enterpriseEscCenterInstalledCard(record),
              busyId === record.packageId,
              ENTERPRISE_ESC_LOCAL_COPY.centerUninstallTitle,
              (next: boolean) => { if (!next && busyId !== record.packageId) uninstall(record.packageId) },
            ))
        : undefined,
    ),
  )

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
    ),
    actionCode === undefined
      ? null
      : createElement(EnterpriseErrorNotice, { className: 'esc-installed-error', code: actionCode }),
    createElement(
      'div',
      { className: 'esc-scroll esc-scroll-hidden' },
      allEmpty
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
        // 顺序取 `ENTERPRISE_ESC_INSTALLED_KINDS`（用户自定义在前）——顺序的真源只有那一处。
        : ENTERPRISE_ESC_INSTALLED_KINDS.map(kind => kind === 'self' ? selfGroupNode() : centerGroupNode()),
    ),
    // 两份都读不到 ⇒ 给一枚真重试（读得到任何一份时不画：那时页面上有内容，重试该按那一组自己的语义来）。
    bothFailed
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
