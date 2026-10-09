/**
 * [INPUT]: 依赖 React 的 createElement/useMemo/useEffect/useSyncExternalStore、官方原语 `Button`、lucide 的 `RefreshCw`、
 *   `list-state` 的**唯一四态取数源** `createEnterpriseListSource` 与共用重试文案、`error-notice` 的唯一失败提示件、
 *   `enterprise-card-text` 的唯一「企业/官方」签渲染 `EnterpriseMarketBadgeTag`、`esc-card` 的唯一图标格
 *   `EnterpriseEscCardIcon`、`esc-types` 的连接器只读端口类型、`local-api-decode` 的连接器投影形状
 * [OUTPUT]: 对外提供连接器广场（esc 连接器页「系统广场」那一格）的**全部件**——
 *   ① **纯投影族**（可直调取证）：`enterpriseConnectorMetaParts`/`enterpriseConnectorMetaLine`（元信息一行，缺哪个少画哪个）、
 *   `enterpriseConnectorDeployText`（`deployStatus` 的可见交代）、`enterpriseConnectorEmptyNote`（**两句**不同的「为什么空」）、
 *   `enterpriseConnectorCompleteNote`（`complete === false` 的如实交代）、`enterpriseConnectorEnablePlan`（那枚**禁用**启用动作的终态）、
 *   `enterpriseConnectorMatches`/`enterpriseConnectorVisibleItems`（搜索框那一条客户端筛选，筛空那句是常量 `ENTERPRISE_CONNECTOR_FILTERED`）；
 *   ② **纯渲染层** `EnterpriseEscConnectorCard`（一张连接器卡）与 `EnterpriseEscConnectorPlazaView`（四态互斥 + 卡片网格，**无 hook、可直调**）；
 *   ③ **唯一取数源工厂** `createEnterpriseConnectorPlazaSource`（内部就是那台共享状态机，不新造取数器；可直调取证"重试真的重发"）
 *   与**有状态包装** `EnterpriseEscConnectorPlaza`（唯一持取数源的那一枚；页面只挂它）与文案常量 `ENTERPRISE_CONNECTOR_*`。
 * [POS]: esc 连接器页「系统广场」那一格的**取数与呈现层**（Phase C D1 的界面半边）。
 *   ★**为什么它是一枚新叶而不是把 `esc-aggregation.tsx` 的共享列表改掉**：这一格的数据面**不是平台目录**
 *     ——平台那条连接器目录路由在这台部署上根本没有这个端点（回 `No static resource …`），真正有货的是
 *     平台逐空间的 MCP 目录，而它只在宿主的**内部**许可表里（平台每行 18 键里带可直接落地的客户端配置面）
 *     ⇒ 界面这一侧**只能**读宿主从零构造的脱敏投影（本机那条 exact 只读路由，见 `local-api.ts`）。
 *     这一格的形状也与平台卡片不同（`installType`/`deployStatus`/`toolCount`/所属空间 + 官方标识），
 *     故按"每一格自己的数据面留一片自己的叶"落成新文件，而**不与专家页/技能页共用的那套混在一起**。
 *   ★**取数只有一条路、四态只有一份实现**：`createEnterpriseListSource`（本仓列表四态的唯一实现，
 *     技能目录 / 插件目录 / 配方目录 / 资料库 / 文件树都用它）——加载中 / 空 / 失败可重试 / 就绪**互斥**，
 *     `retry()` 是**真的**再发一次请求（不是在界面上重画一下）。
 *   ★**卡片五格逐格派生、缺哪个少画哪个**：`name`（必填）+ `description?` + `icon?`（**经宿主图片代理，
 *     加载失败一次即回落兜底图形** —— 复用 `EnterpriseEscCardIcon`，全仓唯一的破图兜底实现）+
 *     元信息一行（`installType` / `toolCount` / 所属空间名）+ `official === true` 时的**可见**「官方」签
 *     （复用 `EnterpriseMarketBadgeTag`，**不新造第二种签**；`official` 缺席或 `false` 时**整枚不画**）。
 *   ★**`deployStatus` 的如实交代**：它**原样上屏**（`部署状态：<原值>`，`data-esc-connector-deploy` 带着原值）。
 *     ★**为什么不做"未部署才画"**：`deployStatus` 的**取值域未冻结**（宿主 `bundle/src/connector-plaza.ts`
 *     只把它当字符串原样出厂，本仓没有任何一台平台的实测证据说清它的取值域）——编一张
 *     "deployed/ready/running ⇒ 已部署"的同义词表就是**猜**，猜错的代价恰恰是本刀要防的那件事
 *     （"没部署的看起来能连"）。故取**不依赖取值域**的形态：**恒把原值摆到卡片上**（于是"还没部署好"
 *     这件事不可能被界面藏起来）+ 那枚启用动作**恒禁用且写出行上可见原因**。
 *   ★**本刀（D1）不接任何启用/连接写入口**（那是 D2）：那枚启用动作是**禁用 + 行上可见原因**，
 *     且**连 `onClick` 属性都不挂**（不是"挂一枚不会被调的回调"——`props['onClick']` 在那个元素上
 *     根本不存在）；端口类型上**没有任何写方法**，"能不能写"因此是**类型层**的事实，不是界面的自觉。
 *   ★**界面零配置面**：全文件不认配置面那几格（宿主从零构造时就没有它们的位置）—— 这些键
 *     **在类型上就不可表达**（端口只交 `EnterpriseConnectorCatalog`，解码器对多带的键整份判畸形），
 *     界面自然也没有任何解码分支可写。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { RefreshCw } from 'lucide-react'
import { createElement, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { EnterpriseMarketBadgeTag } from '../enterprise-card-text.js'
import { EnterpriseErrorNotice } from '../error-notice.js'
import {
  ENTERPRISE_LIST_RETRY,
  ENTERPRISE_LIST_RETRY_LABEL,
  createEnterpriseListSource,
  type EnterpriseListSource,
  type EnterpriseListState,
} from '../list-state.js'
import type { EnterpriseConnectorCatalog, EnterpriseConnectorItem } from '../local-api-decode.js'
import { EnterpriseEscCardIcon } from './esc-card.js'
import type { EnterpriseEscConnectorPort } from './esc-types.js'

/** 加载中那一句（与 `.esc-catalog-status` 同一条落点，不新造版式）。 */
export const ENTERPRISE_CONNECTOR_LOADING = '正在读取连接器…'

/** 失败态的动作前缀（人话与下一步由 `error-messages.ts` 的唯一码表给，界面不自己写码）。 */
export const ENTERPRISE_CONNECTOR_FAILED_PREFIX = '连接器清单加载失败'

/**
 * **两句**不同的「为什么空」——判据是宿主那枚 `complete`：
 *   · `complete === true`：每个空间都读到了、也没有被上限截断 ⇒ 就是**真的**一台都没有；
 *   · `complete === false`：有空间这次没读到（或清单被上限截断）⇒ 是**读不到**，不是"没有"。
 * ★两句话**必须不同**：把"读不到"说成"企业没配"是把员工引向错误的下一步（去找管理员"要连接器"）。
 */
export const ENTERPRISE_CONNECTOR_EMPTY_NONE = '企业还没有下发连接器。'
export const ENTERPRISE_CONNECTOR_EMPTY_UNREAD = '有些空间这次没有读到，暂时看不到连接器。'

/** 就绪态里那句 `complete === false` 的如实交代（清单是真的、但**不是全部**）。 */
export const ENTERPRISE_CONNECTOR_INCOMPLETE = '有些空间这次没有读到，下面的清单可能不完整。'

/** 搜索词把这批连接器全筛掉时那句（与上面两句**不同**：数据面不是空的，是这一筛没有命中）。 */
export const ENTERPRISE_CONNECTOR_FILTERED = '没有匹配的连接器，换个词再试。'

/** 端口缺席时（本机这块没接线）那句可见交代——**不画任何卡片**、也不假装"一台都没有"。 */
export const ENTERPRISE_CONNECTOR_UNWIRED = '连接器广场还没接通，暂时读不到连接器。'

/** `official === true` 时那枚可见标识的文案（与「企业」签**同族**，复用同一枚官方 `Tag` 渲染）。 */
export const ENTERPRISE_CONNECTOR_OFFICIAL_TEXT = '官方'

/** 那枚启用动作的可见文案与**行上可见原因**（D1 不接写入口 ⇒ 恒禁用 + 恒写明原因）。 */
export const ENTERPRISE_CONNECTOR_ENABLE_TEXT = '启用'
export const ENTERPRISE_CONNECTOR_ENABLE_LOCK = '本机启用还没接通'

/** `deployStatus` 那行的前缀（原值**逐字**跟在它后面；见文件头那条"为什么不做同义词表"）。 */
export const ENTERPRISE_CONNECTOR_DEPLOY_PREFIX = '部署状态：'

/** `toolCount` 那一格的文案（数字 + 量词；缺这一格时**整格不画**）。 */
export const ENTERPRISE_CONNECTOR_TOOL_SUFFIX = ' 个工具'

/** 条**非空**字符串判据（空串与全空白都当"没有"）。 */
function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * 元信息那一行的**逐格**内容（纯投影，可直调取证）：`installType` / `N 个工具` / 所属空间名。
 *
 * ★三格**各自按在场与否**决定要不要出（`installType` 与空间名是契约必填格、恒在场；
 *   `toolCount` 是可选格，缺席就少这一格）——界面**不写空壳**、也不编一个"未知"占位。
 * ★`installType` 与 `deployStatus` 一样**原样透出**：宿主只把它们当字符串出厂，本仓没有它们的取值域
 *   证据 ⇒ 不做改写（改写要说得出依据，这里说不出）。
 */
export function enterpriseConnectorMetaParts(item: {
  readonly installType: string
  readonly toolCount?: number | undefined
  readonly space: { readonly name: string }
}): readonly string[] {
  return [
    ...(hasText(item.installType) ? [item.installType] : []),
    ...(item.toolCount === undefined ? [] : [`${String(item.toolCount)}${ENTERPRISE_CONNECTOR_TOOL_SUFFIX}`]),
    ...(hasText(item.space.name) ? [item.space.name] : []),
  ]
}

/**
 * 元信息那一行（三格按 ` · ` 连起来）；三格**一格都出不来**时返回 `undefined` = **整行不进 DOM**。
 */
export function enterpriseConnectorMetaLine(item: {
  readonly installType: string
  readonly toolCount?: number | undefined
  readonly space: { readonly name: string }
}): string | undefined {
  const parts = enterpriseConnectorMetaParts(item)
  return parts.length === 0 ? undefined : parts.join(' · ')
}

/** `deployStatus` 那一行的可见文案（**原值逐字**，见文件头那条取舍）。 */
export function enterpriseConnectorDeployText(deployStatus: string): string {
  return `${ENTERPRISE_CONNECTOR_DEPLOY_PREFIX}${deployStatus}`
}

/** 空态那一句（**两句之一**，判据是宿主那枚 `complete`；理由见上面那两枚常量）。 */
export function enterpriseConnectorEmptyNote(complete: boolean): string {
  return complete ? ENTERPRISE_CONNECTOR_EMPTY_NONE : ENTERPRISE_CONNECTOR_EMPTY_UNREAD
}

/** 就绪态里 `complete === false` 的交代；`true` 时返回 `undefined` = **整段不画**（不许折成 true）。 */
export function enterpriseConnectorCompleteNote(complete: boolean): string | undefined {
  return complete ? undefined : ENTERPRISE_CONNECTOR_INCOMPLETE
}

/**
 * 那枚启用动作的**终态**（唯一构造点）。
 *
 * ★**本刀（D1）没有写入口**：`disabled` **恒 true**、`reason` 恒是那句可见原因、
 *   而返回对象里**没有** `onClick` 这一格 —— 调用方（`EnterpriseEscConnectorCard`）因此
 *   在 `createElement` 的 props 里**不写** `onClick`（"禁用动作挂一枚不会被调的回调"是产品宪法
 *   明令禁止的形状，门禁逐档咬住 `props['onClick'] === undefined`）。
 * ★**为什么它是一枚纯投影而不是卡片里写死**：把"为什么按不动"的**唯一措辞**收在一处，
 *   下一刀（D2）接线时只改这一处，界面上那句可见原因与禁用位不可能各自漂开。
 */
export function enterpriseConnectorEnablePlan(item: { readonly name: string }): {
  readonly text: string
  readonly disabled: true
  readonly reason: string
  readonly title: string
  readonly ariaLabel: string
} {
  return {
    text: ENTERPRISE_CONNECTOR_ENABLE_TEXT,
    disabled: true,
    reason: ENTERPRISE_CONNECTOR_ENABLE_LOCK,
    title: ENTERPRISE_CONNECTOR_ENABLE_LOCK,
    ariaLabel: `${ENTERPRISE_CONNECTOR_ENABLE_TEXT}${item.name}（${ENTERPRISE_CONNECTOR_ENABLE_LOCK}）`,
  }
}

/** 这一条连接器命中搜索词吗（名字或描述，大小写不敏感；词是空白 ⇒ 全命中）。 */
export function enterpriseConnectorMatches(
  item: { readonly name: string; readonly description?: string | undefined },
  keyword: string,
): boolean {
  const needle = keyword.trim().toLowerCase()
  if (needle === '') return true
  return item.name.toLowerCase().includes(needle)
    || (item.description ?? '').toLowerCase().includes(needle)
}

/**
 * 就绪态里真正要铺的那几条（**唯一**筛选点）。
 *
 * ★筛选在**界面这一侧**做：宿主那条路由是只读、无查询参数的投影（它答的是"本机有哪些连接器"），
 *   搜索框答的是"这一屏想看哪几条" —— 两件事，故不过滤在取数层。
 * ★**命中不到就真的空**（不回落成"全铺一遍"）：搜索框说在筛，列表就不能装作没听见。
 */
export function enterpriseConnectorVisibleItems(
  catalog: EnterpriseConnectorCatalog,
  keyword: string,
): readonly EnterpriseConnectorItem[] {
  return catalog.connectors.filter(item => enterpriseConnectorMatches(item, keyword))
}

/** 一张连接器卡（**纯函数**、无 hook：可直接调用取证，本仓 vitest 没有 DOM）。 */
export function EnterpriseEscConnectorCard({ item }: { readonly item: EnterpriseConnectorItem }): ReactNode {
  const plan = enterpriseConnectorEnablePlan(item)
  const metaLine = enterpriseConnectorMetaLine(item)
  return createElement(
    'div',
    {
      className: 'esc-card esc-card-connector',
      'data-esc-connector-card': String(item.id),
    },
    createElement(
      'header',
      { className: 'esc-card-header' },
      // ★图标：有地址就经宿主图片代理画图、加载失败一次即回落兜底图形（**复用**唯一那枚实现，绝不出现破图）。
      createElement(EnterpriseEscCardIcon, { icon: item.icon, shape: 'square' }),
      createElement(
        'div',
        { className: 'esc-card-headmain' },
        createElement(
          'div',
          { className: 'esc-card-titlerow' },
          createElement('h3', { className: 'esc-card-title', title: item.name, children: item.name }),
          // ★官方标识：`official === true` **才**画（缺席 = "平台没说"，与 `false` 都不画，且都不当作官方）。
          item.official === true
            ? EnterpriseMarketBadgeTag({ text: ENTERPRISE_CONNECTOR_OFFICIAL_TEXT })
            : null,
          /**
           * ★那枚**禁用**的启用动作：`disabled` 恒 true、`title` 与 `aria-label` 都写明原因，
           *   而 **`onClick` 这个键根本不在这里**（D1 没有写入口 ⇒ 物理上点不出任何请求）。
           *   ★官方 `Button` 的类型面只声明 `variant`/`size`/`icon`/`className`/`children` 加原生属性，
           *   多给的 `data-*` 会被类型挡下 ⇒ 门禁那侧的稳定钩子取**类名** `esc-connector-enable`。
           */
          createElement(Button, {
            variant: 'primary',
            size: 'sm',
            className: 'esc-action-solid esc-connector-enable',
            disabled: plan.disabled,
            title: plan.title,
            'aria-label': plan.ariaLabel,
            children: plan.text,
          }),
        ),
        // ★描述：有（非空白）才画**整格**；缺席即这一格不进 DOM（不写空壳、不写"暂无描述"）。
        hasText(item.description)
          ? createElement('p', { className: 'esc-card-headdesc', title: item.description, children: item.description })
          : null,
        // ★元信息一行：三格都由真数据派生，缺哪个少画哪个；三格全缺则**整行不画**。
        metaLine === undefined
          ? null
          : createElement('p', { className: 'esc-card-meta', title: metaLine, children: metaLine }),
        // ★部署状态：原值**逐字**上屏（`data-esc-connector-deploy` 带着原值，门禁据此逐档取证）。
        createElement('p', {
          className: 'esc-card-lock',
          role: 'status',
          'data-esc-connector-deploy': item.deployStatus,
          children: enterpriseConnectorDeployText(item.deployStatus),
        }),
        // ★禁用动作的**行上可见原因**（产品宪法：禁用控件不许只挂一句 `title`）。
        createElement('p', {
          className: 'esc-card-lock',
          role: 'status',
          'data-esc-connector-enable-lock': 'true',
          children: plan.reason,
        }),
      ),
    ),
  )
}

/** 纯渲染层的入参（唯一构造点是下面那个有状态包装）。 */
export interface EnterpriseEscConnectorPlazaViewProps {
  /**
   * 取数四态（`loading` / `empty` / `failed` / `ready` 互斥，由 `list-state` 的单字段联合保证）。
   * `value === undefined` 只在"端口缺席"那一条路上出现，而那条路会被 `wired` 先挡掉。
   */
  readonly state: EnterpriseListState<EnterpriseConnectorCatalog | undefined>
  /** 搜索关键词（已防抖；由工具栏那个框统一持有，本层只做客户端筛选）。 */
  readonly keyword: string
  /** 端口在不在场（缺席 ⇒ 一句可见交代，**不画任何卡片**、也不假装"一台都没有"）。 */
  readonly wired: boolean
  /** 重新读取（失败态那枚【重试】与空态那枚【重试】共用它；**真的**再发一次请求）。 */
  readonly onRetry: () => void
}

/**
 * 连接器广场内容区（**纯函数**、无 hook）。
 *
 * 四态**互斥**且**只出一个** `data-esc-connector-state`：`unwired`（端口缺席）/ `loading` / `failed` /
 * `empty` / `ready`——后两态里 `ready` 若被搜索词筛空，另出 `data-esc-connector-state="ready"` +
 * `data-esc-connector-filtered`（**不是**第五种态：数据面确实是就绪的，是这一筛没命中）。
 */
export function EnterpriseEscConnectorPlazaView(props: EnterpriseEscConnectorPlazaViewProps): ReactNode {
  /** 失败态与空态那枚【重试】是**同一枚**按钮（同一个 `onRetry`、同一份文案与无障碍名）。 */
  const retryButton = (variant: 'primary' | 'outline'): ReactNode => createElement(Button, {
    size: 'sm',
    variant,
    className: 'esc-catalog-retry',
    icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
    'aria-label': ENTERPRISE_LIST_RETRY_LABEL,
    onClick: () => { props.onRetry() },
    children: ENTERPRISE_LIST_RETRY,
  })
  if (!props.wired) {
    return createElement(
      'div',
      { className: 'esc-connector', 'data-esc-connector-state': 'unwired' },
      createElement('p', { className: 'esc-catalog-status', role: 'status', children: ENTERPRISE_CONNECTOR_UNWIRED }),
    )
  }
  if (props.state.kind === 'loading') {
    return createElement(
      'div',
      { className: 'esc-connector', 'data-esc-connector-state': 'loading' },
      createElement('p', { className: 'esc-catalog-status', role: 'status', children: ENTERPRISE_CONNECTOR_LOADING }),
    )
  }
  if (props.state.kind === 'failed') {
    return createElement(
      'div',
      { className: 'esc-connector', 'data-esc-connector-state': 'failed' },
      createElement(EnterpriseErrorNotice, {
        className: 'esc-import-error',
        code: props.state.code,
        prefix: ENTERPRISE_CONNECTOR_FAILED_PREFIX,
      }),
      // ★失败可重试，且是**真的重发**（`onRetry` → 取数源的 `retry()`，不是重画一下）。
      retryButton('primary'),
    )
  }
  const catalog = props.state.value
  if (props.state.kind === 'empty' || catalog === undefined) {
    // ★两句**不同**的「为什么空」由纯投影选好（判据是 `complete`），界面这里只铺那一句。
    const complete = catalog?.complete === true
    return createElement(
      'div',
      {
        className: 'esc-connector',
        'data-esc-connector-state': 'empty',
        'data-esc-connector-empty': complete ? 'none' : 'unread',
      },
      createElement('p', { className: 'esc-catalog-empty', children: enterpriseConnectorEmptyNote(complete) }),
      // ★空态也留一枚真重试：其中一句正是"有空间没读到"（重读一次是正当的下一步）。
      retryButton('outline'),
    )
  }
  const visible = enterpriseConnectorVisibleItems(catalog, props.keyword)
  const completeNote = enterpriseConnectorCompleteNote(catalog.complete)
  return createElement(
    'div',
    { className: 'esc-connector', 'data-esc-connector-state': 'ready' },
    // ★`complete === false` **原样呈现**：不折成 true、也不当错误——它就是"这份不是全部"。
    completeNote === undefined
      ? null
      : createElement('p', {
          className: 'esc-catalog-degraded',
          role: 'status',
          'data-esc-connector-incomplete': 'true',
          children: completeNote,
        }),
    visible.length === 0
      ? createElement('p', {
          className: 'esc-catalog-empty',
          'data-esc-connector-filtered': props.keyword,
          children: ENTERPRISE_CONNECTOR_FILTERED,
        })
      : createElement(
          'div',
          { className: 'esc-list-section' },
          visible.map(item => createElement(
            'div',
            { key: item.id, className: 'esc-catalog-cell' },
            createElement(EnterpriseEscConnectorCard, { item }),
          )),
        ),
  )
}

/** 有状态包装的入参（唯一构造点是 `esc-aggregation.tsx`）。 */
export interface EnterpriseEscConnectorPlazaProps {
  /**
   * 本机连接器广场的只读端口（`client.tsx` 接在同一枚 `createEnterpriseLocalApi()` 实例上）。
   * **刻意可选**：缺席 ⇒ 一句可见交代（判据是端口在不在场，不是界面写死一个 `disabled`）。
   */
  readonly port?: EnterpriseEscConnectorPort | undefined
  /** 搜索关键词（已防抖；聚合层持有那个框的真值，本层只筛）。 */
  readonly keyword: string
}

/**
 * 连接器广场的**取数源**（唯一构造点，纯工厂、可直调取证）。
 *
 * ★**它不是第二个取数器**：内部就是本仓那**唯一**一份四态实现 `createEnterpriseListSource`
 *   （`list-state.ts`）—— 与 `createEnterpriseSkillListSource` / `createEnterprisePresetListSource`
 *   同一条形状（把"取哪一条、什么算空"这两个业务判据绑进那台共享状态机，而不是另写一台）。
 *   ★**为什么单独导出**：本仓 vitest 没有 DOM，"点重试是不是真的重发一次请求"只能在**不依赖渲染**的
 *   地方取证（`requests()` 记账）——组件那一侧只是它的订户与一枚重试按钮。
 * ★**端口缺席时 `load` 交 `undefined`**（判据仍是"端口在不在场"）：那一态由界面的 `wired: false` 先挡掉、
 *   画一句可见交代，绝不假装"企业一台连接器都没有"。
 *
 * @param port - 本机连接器广场的只读端口（`client.tsx` 交同一枚 `createEnterpriseLocalApi()` 实例上的 `connectors`）。
 * @returns 四态互斥、`retry()` 真重发的取数源；值类型是"投影或 `undefined`（端口缺席）"。
 */
export function createEnterpriseConnectorPlazaSource(
  port?: EnterpriseEscConnectorPort | undefined,
): EnterpriseListSource<EnterpriseConnectorCatalog | undefined> {
  return createEnterpriseListSource<EnterpriseConnectorCatalog | undefined>({
    load: async signal => (port === undefined ? undefined : await port.catalog(signal)),
    isEmpty: value => value === undefined || value.connectors.length === 0,
  })
}

/**
 * 连接器广场（**有状态包装**：唯一持取数源的那一枚）。
 *
 * ★取数源就是上面那枚工厂（本仓那**唯一**一份四态实现）：离开这一格 / 换端口即 `reset()`
 *   （由 `useEffect` 的清理做完），`retry()` 真的重发。
 */
export function EnterpriseEscConnectorPlaza({ port, keyword }: EnterpriseEscConnectorPlazaProps): ReactNode {
  const source = useMemo(() => createEnterpriseConnectorPlazaSource(port), [port])
  const state = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
  useEffect(() => {
    source.load()
    // 换端口 / 离开这一格 ⇒ 中止在途（迟到结果不回填由取数源自己的代际守卫保证）。
    return () => { source.reset() }
  }, [source])
  return EnterpriseEscConnectorPlazaView({
    state,
    keyword,
    wired: port !== undefined,
    onRetry: () => { source.retry() },
  })
}
