/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useState、官方原语 `Button`、lucide 的 `RefreshCw`、
 *   `list-state` 的四态类型与重试文案、`error-notice` 的唯一提示组件与 `error-messages` 的唯一码表、
 *   `esc-card` 的卡片、`esc-catalog` 的全部纯投影与文案、`esc-types` 的本机技能写入口类型
 * [OUTPUT]: 对外提供两件——**纯渲染层** `EnterpriseEscCatalogList`（四态互斥 + 卡片网格 + 每卡那枚
 *   真的能装的【＋】 + 失败归行可重试；无 hook、无请求、可直调取证）与它的**有状态包装**
 *   `EnterpriseEscCatalog`（持"当前有效的已装真值 / 在途那一枚 / 失败归哪一行"三件状态，
 *   并把写入口原样转交；页面只挂这一枚）
 * [POS]: esc 技能页第四枚维度「企业技能」（口径 53）的**呈现与动作层**，与 `esc-catalog.ts`（纯事实层）
 *   一带二：本文件只画与发动作，一个请求都不发。
 *   ★**为什么必须拆成两件**（与 `esc-third-party-list.tsx` / `esc-aggregation.tsx` 里那对**同一条手法**）：
 *     本仓的 vitest **没有 DOM**、而 `useState`/`useEffect` 只能活在真渲染器里 ⇒ 若把四态与每卡的
 *     可用性都塞进带 hook 的那一枚，它们就**没有任何机械判据**能证明（只能靠肉眼读代码）。
 *     拆开之后："哪一态画什么、这枚【＋】能不能点、失败落在哪一行、点重试走的哪一条路"
 *     全部落在**纯函数直调**上；带 hook 的那一枚只剩三件状态的搬运，薄到不需要再测。
 *   ★**取数源不在这里**：`state` 由聚合层经 `createEnterpriseSkillListSource`（设置页那一枚**同一个**
 *     工厂）持有——二级 chip 行住在工具栏、卡片住在内容区，两者必须认同**同一份**真值与**同一枚**
 *     选中的 key（否则就是"子组件 fetch → 回调 setState → 父组件重渲染 → 子组件重建取数源"那种自激）。
 *   ★**三条动作纪律**（与本仓既有那几条通路逐条对齐）：
 *     ① **成功不乐观切换**：装完只认 Host 回传的那份最新清单（`setInstalled(next)`），
 *        界面从不自己往清单里塞一枚、也不自己加减计数；
 *     ② **失败不吞**：失败只落在**那一行**上（人话 + 下一步 + 「技术信息」里的稳定码），
 *        与"目录读不到"（`face.kind === 'failed'`）两件事互不覆盖；
 *     ③ **在途一次一条**：`pending` 只可能是一枚包 id，其余【＋】随之禁用并**各自**写明原因
 *        （纯投影 `enterpriseCatalogActionPlan` 给文案，界面不在这里自己拼 disabled 与原因）。
 *   ★**本刀（S5b：技能卡那枚「去试试」真的能用）**：这一维度**已装**的卡片也拿到那枚按钮的终态——
 *     纯渲染层多两格可选输入（`tryNowOf` 计划工厂 + `tryNotice` 那句交代），有状态包装多**三件状态**
 *     （在途那一枚技能名 / 失败那一枚 + 稳定码 / 刚填好那一句）与唯一执行路 `runSkillTry`：
 *     写入口是技能端口上那格 `fillSkillTryDraft`（跳新会话 + 写输入框、**不发送**），成功只留一句如实
 *     交代（**不开新页面**、也**不宣称已发送**），失败出唯一提示件 + `ENT_SKILL_TRY_LAUNCH_FAILED`
 *     （落在**这一枚卡片**上）。★判据与可用性**不在本文件**：唯一构造点是纯投影
 *     `esc-skill-try.ts` 的 `enterpriseEscSkillTryPlan`（本件只接线，与广场网格 / 精选行同一枚）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { RefreshCw } from 'lucide-react'
import { createElement, useEffect, useState, type ReactNode } from 'react'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE, enterpriseErrorAction, enterpriseErrorMessage } from '../error-messages.js'
import { enterpriseLocalErrorCode } from '../local-api.js'
import { ENTERPRISE_LIST_RETRY, ENTERPRISE_LIST_RETRY_LABEL, type EnterpriseListState } from '../list-state.js'
import type { EnterpriseInstalledSkill } from '../skill-api-decode.js'
import type { EnterpriseSkillListPayload } from '../skill-market.js'
import { EnterpriseEscCard } from './esc-card.js'
import {
  enterpriseEscSkillTryFilledText,
  enterpriseEscSkillTryPlan,
  type EnterpriseEscSkillTryPlan,
} from './esc-skill-try.js'
import {
  ENTERPRISE_CATALOG_FAILED_PREFIX,
  ENTERPRISE_CATALOG_INSTALL_FAILED_PREFIX,
  ENTERPRISE_CATALOG_LOADING,
  ENTERPRISE_CATALOG_NOTE,
  ENTERPRISE_CATALOG_REFRESH,
  ENTERPRISE_CATALOG_REFRESH_LABEL,
  ENTERPRISE_CATALOG_SOURCE_TITLE,
  enterpriseCatalogActionPlan,
  enterpriseCatalogFace,
  enterpriseCatalogInstalledText,
  enterpriseCatalogInstallingText,
} from './esc-catalog.js'
import { ENTERPRISE_ESC_SUB_TAB_ALL_KEY } from './esc-sub-tabs.js'
import type { EnterpriseEscSkillPort } from './esc-types.js'

/**
 * 一次安装的**超时**（120s）。
 *
 * 中心制品上限 50 MiB，且 Host 要走「下载 → SHA-256 校验 → 解包 → 落盘」四步；
 * 与「企业设置 → 技能」那一页**同一个数字**（同一件事没有理由有两个超时口径）。
 */
const ENTERPRISE_CATALOG_INSTALL_TIMEOUT_MS = 120_000

/** 在途那一枚（包 id + 行上要念出来的名字）。 */
export interface EnterpriseCatalogPending {
  readonly id: string
  readonly name: string
}

/** **纯渲染层**的输入（唯一构造点是下面那个有状态包装）。 */
export interface EnterpriseEscCatalogListProps {
  /** 目录取数的四态（loading / failed / empty / ready；互斥由 `list-state` 的单字段联合保证）。 */
  readonly state: EnterpriseListState<EnterpriseSkillListPayload>
  /** 搜索关键词（已防抖；由工具栏那一个框统一持有）。 */
  readonly keyword: string
  /** 选中的二级分类 key（空串 = 全部；由聚合层的 `enterpriseEscSubTabs` 投影出来）。 */
  readonly category?: string | undefined
  /** 当前**有效**的已装真值（Host 回传的最新清单优先于取数源里那份，见包装那一层）。 */
  readonly installed: readonly EnterpriseInstalledSkill[]
  /** 在途的那一枚（缺席 = 没有动作在跑）。 */
  readonly pending?: EnterpriseCatalogPending | undefined
  /** 哪一枚装失败了（包 id + 稳定码）：只落在那一行上。 */
  readonly installError?: { readonly id: string; readonly code: string } | undefined
  /** 刚刚装成功那一句（`role="status"`；下一次动作开始时清掉）。 */
  readonly installedNotice?: string | undefined
  /**
   * ★**本刀（S5b）**：这一枚技能卡的「去试试」计划（**唯一构造点**在下面的有状态包装，
   * 纯投影 `enterpriseEscSkillTryPlan`）。缺席 ⇒ 卡片逐字回到改前那一态（禁用 + `title`）。
   */
  readonly tryNowOf?: ((name: string, installed: boolean) => EnterpriseEscSkillTryPlan) | undefined
  /** ★**本刀（S5b）**：刚在新会话里填好那句交代（`role="status"`；下一次动作开始时清掉）。 */
  readonly tryNotice?: string | undefined
  /** 写入口在不在场（`false` ⇒ 每枚【＋】禁用 + **行上可见**写明原因；判据是端口，不写死 disabled）。 */
  readonly wired: boolean
  /** 安装一枚（包 id + 名字；名字只为在途那一句念得出来）。 */
  readonly onInstall: (packageId: string, name: string) => void
  /** 重新读取目录（失败态那枚【重试】与就绪/空态那枚【刷新】共用它；**真的**再发一次请求）。 */
  readonly onReload: () => void
}

/**
 * 「企业技能」内容区（**纯函数**，无 hook）。
 *
 * 三块按序铺：① 标题 + 一句页内说明（说清"从哪来"与【＋】做了什么）；
 * ② 在途 / 刚成功那两句可见反馈 + 次级取数降级那句；③ 四态内容（加载 / 失败 + 重试 /
 * 空 + 那句"为什么空" / 就绪 + 卡片网格）。
 */
export function EnterpriseEscCatalogList(props: EnterpriseEscCatalogListProps): ReactNode {
  const face = enterpriseCatalogFace({
    state: props.state,
    keyword: props.keyword,
    category: props.category ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY,
    installed: props.installed,
  })
  const pending = props.pending
  return createElement(
    'div',
    { className: 'esc-catalog', 'data-esc-catalog': 'true' },
    // ① 标题 + 页内说明句。
    createElement(
      'div',
      { className: 'esc-catalog-head' },
      createElement('h3', { className: 'esc-catalog-title', children: ENTERPRISE_CATALOG_SOURCE_TITLE }),
      createElement('p', { className: 'esc-catalog-note', children: ENTERPRISE_CATALOG_NOTE }),
    ),
    // ② 可见反馈：进行中（同时是其余按钮的可见背景）与刚成功那句各占一行。
    pending === undefined
      ? null
      : createElement('p', {
          className: 'esc-catalog-status',
          role: 'status',
          'data-esc-catalog-busy': pending.id,
          children: enterpriseCatalogInstallingText(pending.name),
        }),
    props.installedNotice === undefined
      ? null
      : createElement('p', {
          className: 'esc-catalog-status',
          role: 'status',
          'data-esc-catalog-installed': 'true',
          children: props.installedNotice,
        }),
    /**
     * ★**本刀（S5b）**：「去试试」办成之后那句交代（「已在新会话的输入框里填好…按发送即可」）。
     *
     * 落点与上面那两句同一条（`.esc-catalog-status` + `role="status"`，**零新增 CSS 类**）。
     * ★措辞**如实**：只填不发送；且它**不**宣称"已打开新页面"——官方会把主视图切过去，
     *   我们这一侧只留这句话（回到这一页时还看得见）。
     */
    props.tryNotice === undefined
      ? null
      : createElement('p', {
          className: 'esc-catalog-status',
          role: 'status',
          'data-esc-skill-try-notice': 'true',
          children: props.tryNotice,
        }),
    /**
     * ★次级取数降级的可见交代（本机已装清单没读全）：非打扰但看得见 + 可重试；
     *   措辞取自唯一映射（人话 + 下一步）。**绝不静默**——吞掉它，员工会把"读不到"读成"一枚都没装"，
     *   于是每张卡都画着【＋】（那是口径 53 最不想看到的谎）。
     */
    face.installedCode === undefined
      ? null
      : createElement('p', {
          className: 'esc-catalog-degraded',
          role: 'status',
          'data-esc-catalog-degraded': face.installedCode,
          children: `${enterpriseErrorMessage(face.installedCode)}下一步：${enterpriseErrorAction(face.installedCode)}`,
        }),
    // ③ 四态。
    face.kind === 'loading'
      ? createElement('p', {
          className: 'esc-catalog-status',
          role: 'status',
          'data-esc-catalog-state': 'loading',
          children: ENTERPRISE_CATALOG_LOADING,
        })
      : null,
    face.kind === 'failed'
      ? createElement(
          'div',
          { 'data-esc-catalog-state': 'failed' },
          createElement(EnterpriseErrorNotice, {
            className: 'esc-import-error',
            code: face.failedCode ?? '',
            prefix: ENTERPRISE_CATALOG_FAILED_PREFIX,
          }),
          createElement(Button, {
            size: 'sm',
            className: 'esc-catalog-retry',
            icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
            'aria-label': ENTERPRISE_LIST_RETRY_LABEL,
            onClick: () => { props.onReload() },
            children: ENTERPRISE_LIST_RETRY,
          }),
        )
      : null,
    face.kind === 'empty'
      ? createElement(
          'div',
          { 'data-esc-catalog-state': 'empty' },
          // ★两种"为什么空"由纯投影选好（`noMatch`）——界面这里只铺那一句，不自己再判一次。
          createElement('p', {
            className: 'esc-catalog-empty',
            'data-esc-catalog-empty': face.noMatch === true ? 'no-match' : 'directory',
            children: face.emptyNote,
          }),
          createElement(Button, {
            size: 'sm',
            variant: 'outline',
            className: 'esc-catalog-retry',
            icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
            'aria-label': ENTERPRISE_CATALOG_REFRESH_LABEL,
            onClick: () => { props.onReload() },
            children: ENTERPRISE_CATALOG_REFRESH,
          }),
        )
      : null,
    face.kind === 'ready'
      ? createElement(
          'div',
          { 'data-esc-catalog-state': 'ready' },
          createElement(Button, {
            size: 'sm',
            variant: 'outline',
            className: 'esc-catalog-retry',
            icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
            'aria-label': ENTERPRISE_CATALOG_REFRESH_LABEL,
            onClick: () => { props.onReload() },
            children: ENTERPRISE_CATALOG_REFRESH,
          }),
          createElement(
            'div',
            { className: 'esc-list-section' },
            face.items.map((item) => {
              const packageId = item.packageId
              /**
               * ★**不可达的兜底**（`enterpriseCatalogItem` 恒填 `packageId`）：宁可少画一枚按钮，
               *   也绝不拿一枚 `undefined` 当包 id 去装东西（那会打到 Host 的 400 上）。
               *   写成 early return 而不是三元：后面那两处闭包（`onInstall` / 重试）需要
               *   `packageId` 是**已收窄的 string**，靠三元里的收窄是传不进闭包的。
               */
              if (packageId === undefined) {
                return createElement(
                  'div',
                  { key: item.id, className: 'esc-catalog-cell' },
                  createElement(EnterpriseEscCard, {
                    item,
                    iconShape: 'square',
                    showUse: true,
                    showTags: false,
                    installed: false,
                  }),
                )
              }
              const isInstalled = face.installed.has(packageId)
              /**
               * ★**已装那一档根本不画【＋】**（`installed === true` ⇒ 卡片自己改画「更多 + 去试试」），
               *   故那一态**不给** `install` 计划 —— 也就不会渲染出一枚"装了还能再装"的按钮。
               */
              const plan = isInstalled
                ? undefined
                : enterpriseCatalogActionPlan({
                    wired: props.wired,
                    packageId,
                    name: item.name,
                    ...(pending === undefined ? {} : { busy: pending.id }),
                  })
              const error = props.installError !== undefined && props.installError.id === packageId
                ? props.installError
                : undefined
              return createElement(
                'div',
                { key: item.id, className: 'esc-catalog-cell', 'data-esc-catalog-package': packageId },
                createElement(EnterpriseEscCard, {
                  item,
                  iconShape: 'square',
                  showUse: true,
                  // 底部标签行整行撤下：企业目录的响应里没有作者也没有统计，画三枚短横只是噪音。
                  showTags: false,
                  installed: isInstalled,
                  /**
                   * ★**本刀（S5b）**：已装那一档那枚「去试试」的终态（与广场网格 / 精选行**同一枚**
                   * 纯投影，只是状态住在下面的包装里——本层不持 hook）。可点 ⇒ 真 `onClick`；
                   * 不可点 ⇒ 禁用 + **行上可见**原因（`.esc-card-lock`）。
                   */
                  ...(props.tryNowOf === undefined ? {} : { tryNow: props.tryNowOf(item.name, isInstalled) }),
                  ...(plan === undefined ? {} : {
                    install: {
                      text: plan.text,
                      disabled: plan.disabled,
                      // ★在途那一档把那三个字**行上可见**地写出来（见 `EscCardInstall.busy` 的说明）。
                      busy: plan.kind === 'this-busy',
                      title: plan.title,
                      ariaLabel: plan.ariaLabel,
                      ...(plan.reason === undefined ? {} : { reason: plan.reason }),
                      onInstall: () => { props.onInstall(packageId, item.name) },
                    },
                  }),
                }),
                // 失败只落在**这一行**上：人话 + 下一步 + 「技术信息」里的稳定码（唯一提示组件）+ 真重试。
                error === undefined
                  ? null
                  : createElement(
                      'div',
                      { className: 'esc-catalog-error', 'data-esc-catalog-error': packageId },
                      createElement(EnterpriseErrorNotice, {
                        className: 'esc-import-error',
                        code: error.code,
                        prefix: ENTERPRISE_CATALOG_INSTALL_FAILED_PREFIX,
                      }),
                      createElement(Button, {
                        size: 'sm',
                        className: 'esc-catalog-retry',
                        icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
                        'aria-label': ENTERPRISE_LIST_RETRY_LABEL,
                        // ★"可重试"是真的重发：同一枚写入口、同一枚包 id，不是重画一下。
                        onClick: () => { props.onInstall(packageId, item.name) },
                        children: ENTERPRISE_LIST_RETRY,
                      }),
                    ),
              )
            }),
          ),
        )
      : null,
  )
}

/** 「企业技能」内容区的输入（唯一构造点是 `esc-aggregation.tsx`）。 */
export interface EnterpriseEscCatalogProps {
  /** 目录取数的四态（由聚合层持有：chip 行与它同源）。 */
  readonly state: EnterpriseListState<EnterpriseSkillListPayload>
  /** 搜索关键词（已防抖）。 */
  readonly keyword: string
  /** 选中的二级分类 key（空串 = 全部）。 */
  readonly category?: string | undefined
  /** 本机技能写入口（**只有它上面那枚 `installSkill` 参与这一维度**；缺席 ⇒ 那枚【＋】置灰 + 写明原因）。 */
  readonly skillPort?: EnterpriseEscSkillPort | undefined
  /** 重新读取目录（失败态那枚【重试】与就绪/空态那枚【刷新】共用它）。 */
  readonly onReload: () => void
  /** 装好一枚之后请「已安装」计数重读（**复用**聚合层那枚既有的 refresh token，不新造第二个）。 */
  readonly onInstalledRefresh: () => void
}

/**
 * 「企业技能」内容区（**有状态包装**：三件状态 + 把动作结果说出来）。
 *
 * 三件状态：**当前有效的已装真值**（Host 回传优先）、**在途那一枚**、**失败归哪一行**。
 * 它们都不进 `esc-catalog.ts`（那是纯投影）也不进纯渲染层（那一层没有 hook 可持）——
 * 这正是"能测的与必须活在渲染器里的"那条分界。
 */
export function EnterpriseEscCatalog(props: EnterpriseEscCatalogProps): ReactNode {
  const listValue = props.state.kind === 'ready' || props.state.kind === 'empty' ? props.state.value : undefined
  /**
   * 当前**有效**的已装真值。
   *
   * 种子来自取数源（每次取数成功都刷新），装完之后**被 Host 回传的那份清单覆盖**
   * ——`/skills/install` 的响应就是"装完之后本机真的有哪些包"，这就是"以 Host 为准"的落点；
   * 界面**从不**自己往这份清单里塞一枚（那是乐观切换，口径 53 明令不许）。
   */
  const [installed, setInstalled] = useState<readonly EnterpriseInstalledSkill[]>([])
  useEffect(() => {
    if (listValue !== undefined) setInstalled(listValue.installed)
  }, [listValue])
  /** 在途的那一枚（一次只允许一条；其余【＋】随之禁用并写明原因）。 */
  const [pending, setPending] = useState<EnterpriseCatalogPending | undefined>(undefined)
  /** 哪一枚装失败了（包 id + 稳定码）：只落在那一行上。 */
  const [installError, setInstallError] = useState<{ readonly id: string; readonly code: string } | undefined>(undefined)
  /** 刚刚装成功那一句（`role="status"`；下一次动作开始时清掉）。 */
  const [installedNotice, setInstalledNotice] = useState<string | undefined>(undefined)
  /** 唯一写入口：`local-api.ts` 那条 `/skills/install`（由 `client.tsx` 接线；这里不碰任何路由）。 */
  const installSkill = props.skillPort?.installSkill
  /**
   * 发起一次安装（**界面上只有未装那些卡片的【＋】与失败那一行的【重试】会调它**）。
   *
   * ★这里没有第二个 `fetch`、没有第二个解码器：动作原样交给注入的 `installSkill`，
   *   它内部就是 `local-api.ts` 的 `requestJson('/skills/install', …)` + 同一个严格解码器。
   * ★被"一次一条"挡住时直接返回（那一条请求一条都没发）——原因已经在屏幕上（正在装的那一枚写着
   *   「安装中…」、其余每一枚按钮下面写着"另一枚技能正在安装"）。
   */
  const runInstall = (packageId: string, name: string): void => {
    if (pending !== undefined) return
    if (installSkill === undefined) return
    setPending({ id: packageId, name })
    setInstallError(undefined)
    setInstalledNotice(undefined)
    const signal = AbortSignal.timeout(ENTERPRISE_CATALOG_INSTALL_TIMEOUT_MS)
    void installSkill(packageId, signal).then(
      (next) => {
        // ★以 Host 回传的最新清单为准（不乐观翻态）：卡片据此翻「更多 + 去试试」。
        setInstalled(next)
        setInstalledNotice(enterpriseCatalogInstalledText(name))
        // ★同一枚 refresh token（聚合层那枚）：装了东西就该让顶栏计数重数一遍。
        props.onInstalledRefresh()
      },
      (error: unknown) => {
        setInstallError({ id: packageId, code: enterpriseLocalErrorCode(error) })
      },
    ).finally(() => { setPending(undefined) })
  }
  /**
   * ★**本刀（S5b）**：技能卡那枚「去试试」的三件状态 + 唯一执行路（与上面那三件**并列**）。
   *
   * ★为什么它住在这里（而不是提到聚合层）：这一维度的卡片就是本件在铺，且**只有这一处**消费它
   *   （广场网格与精选行那两处在 `esc-aggregation.tsx` 里另有同形的三件状态）——两处各自与自己的
   *   卡片列表同生共死，不存在"同一枚技能两处不一致"（它们是两个互斥的维度）。
   * ★**一次一条只禁那一枚**：这件事不占本机资源、也不与别人抢工作区（与安装那种"一次一条挡住全场"
   *   的语义刻意不同）。
   * ★**成功只留一句如实交代**（只填不发送、不开新页面）；**失败只记稳定码**，由那一张卡片上的
   *   唯一提示件说出来（`EnterpriseErrorNotice`，前缀在 `esc-skill-try.ts` 里）。
   */
  const fillSkillTryDraft = props.skillPort?.fillSkillTryDraft
  const [tryPending, setTryPending] = useState<string | undefined>(undefined)
  const [tryError, setTryError] = useState<{ readonly name: string; readonly code: string } | undefined>(undefined)
  const [tryNotice, setTryNotice] = useState<string | undefined>(undefined)
  /** 发起一次「去试试」（界面上只有已装卡片那枚按钮会调它；`draft` 是计划层拼好的那句指令）。 */
  const runSkillTry = (name: string, draft: string): void => {
    if (tryPending !== undefined) return
    if (fillSkillTryDraft === undefined) return
    setTryPending(name)
    setTryError(undefined)
    setTryNotice(undefined)
    // 一张卡上同一时刻只说一件事：清掉上面那两条安装反馈（同一枚卡片上不会再冒两句话）。
    setInstallError(undefined)
    setInstalledNotice(undefined)
    void fillSkillTryDraft(draft).then(
      (ok) => {
        if (ok) setTryNotice(enterpriseEscSkillTryFilledText(name))
        else setTryError({ name, code: ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE })
      },
      // 端口抛错与返回 false 同一条收束（都是"这一级没走成"），绝不静默。
      () => { setTryError({ name, code: ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE }) },
    ).finally(() => { setTryPending(undefined) })
  }
  /** 某一枚技能 → 它的「去试试」计划（**唯一构造点**：纯投影 `enterpriseEscSkillTryPlan`）。 */
  const tryNowOf = (name: string, installed: boolean): EnterpriseEscSkillTryPlan => enterpriseEscSkillTryPlan({
    name,
    installed,
    wired: fillSkillTryDraft !== undefined,
    ...(tryPending === name ? { pending: true } : {}),
    ...(tryError !== undefined && tryError.name === name ? { failure: { code: tryError.code } } : {}),
    onTry: (draft: string) => { runSkillTry(name, draft) },
  })
  return EnterpriseEscCatalogList({
    state: props.state,
    keyword: props.keyword,
    ...(props.category === undefined ? {} : { category: props.category }),
    installed,
    ...(pending === undefined ? {} : { pending }),
    ...(installError === undefined ? {} : { installError }),
    ...(installedNotice === undefined ? {} : { installedNotice }),
    ...(props.skillPort === undefined ? {} : { tryNowOf }),
    ...(tryNotice === undefined ? {} : { tryNotice }),
    wired: installSkill !== undefined,
    onInstall: runInstall,
    onReload: props.onReload,
  })
}
