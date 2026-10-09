/**
 * [INPUT]: 依赖 React 的 createElement/useState、官方原语 `Button`/`Input`、lucide 的 `ArrowLeft`/`Plus`/`Search`、
 *   `esc-copy` 的文案、以及**唯一**失败提示件 `EnterpriseErrorNotice` 与**唯一**码表 `error-messages` 里那枚
 *   `ENT_ESC_MY_EXPERTS_UNAVAILABLE`（子页只用这两件，**不接任何取数面**）
 * [OUTPUT]: 对外提供「我的专家」子页的**两件**——纯投影 `EnterpriseEscMyExpertsView`（页头 + tabs +
 *   搜索/创建行 + 分段 + 内容区；不持 hook，门禁可直接直调）与薄外壳 `EnterpriseEscMyExpertsPage`
 *   （只持三个本地选中态）、两枚 chrome 真源常量 `ENTERPRISE_ESC_MY_EXPERTS_TABS`/`ENTERPRISE_ESC_MY_EXPERTS_SEGMENTS`、
 *   进入子页时的程序化聚焦钩子 `ENTERPRISE_ESC_MY_EXPERTS_TITLE_ATTR`，以及**零参数**的内容区投影
 *   `enterpriseEscMyExpertsBody`
 * [POS]: esc 页的**第三个视图**（口径 51），由专家页那枚「我的专家」主按钮打开、页壳 `esc-page` 负责切换
 *   （本页没有真实路由 ⇒ 一份视图状态，与「已安装技能」页、商城页的技能详情**同一条手法**）。
 *   ★版式照用户活体量的 WorkBuddy 5.7.6 那一页（`analysis/wb-my-experts.png`）：
 *     页头（左上角【返回】+ 标题「我的专家」）→ 一行（左：tabs「专家 / 专家团」；右：搜索框 + 「+ 创建专家」）
 *     → 右对齐分段（「我创建的 / 我购买的」）→ 卡片区。
 *   ★**它不是弹窗**：本文件**没有** `Modal`、没有 `role="dialog"`/`aria-modal`、没有遮罩、没有 portal、
 *     没有 `aria-haspopup`——它就是内容区里的一整块（两条关闭路径：左上角【返回】+ 页壳那一层的 Esc，
 *     见 `esc-page.tsx`），与口径 15/26 那条常设规则一致。
 *   ★★**为什么内容区是「如实交代」而不是假数据**（这一段是给下一个读者的）：
 *     本部署的只读白名单**恰好七条**（宿主 `bundle/src/esc-route.ts` 的 `ENTERPRISE_ESC_READ_ENDPOINTS`，
 *     界面侧逐条落在 `esc-api.ts` 里），**没有一条**是"我创建的专家"；而本刀**明令**不许新增平台端点、
 *     不许猜路径、不许发"我专家"请求（`src/esc` 里除那七条外不得出现任何新的**平台路径字面量**，有反向锁）。
 *     ⇒ 这一格今天是"要不到"，不是"要到了但是空的"。两件事**必须分开说**：
 *       · 画一个空网格/空态 = 对员工谎称"你一个专家都没创建"（**假事实**，本仓正面禁区）；
 *       · 编几条卡片 = 更严重的编造。
 *     故内容区渲染唯一提示组件 + 稳定码 `ENT_ESC_MY_EXPERTS_UNAVAILABLE`（人话 + 下一步，
 *     `retryable: false`：对"端点不存在"重试永远无效，与那四枚 `ENT_ESC_*_UNAVAILABLE` 同判）。
 *   ★★**为什么 tabs 与分段可以切、切完内容却一样**（下一刀最可能被误读的一处）：
 *     它们是**真控件**（选中态真的翻，`data-esc-selected` 跟着变），但**不是数据面的筛选器**：
 *     tabs（专家/专家团）与分段（我创建的/我购买的）本来是在**那份不存在的清单**上做过滤，
 *     清单都不存在，"过滤结果"自然也只有一个——就是那句如实交代。
 *     ★两件克制（都是产品宪法的正面要求）：
 *       ① **不画计数**——WorkBuddy 实机是「专家 6 / 专家团 1」，本仓那两枚数字**没有任何真值来源**
 *          （见 `esc-toolbar.tsx` 那枚「已安装 ？」的三态口径：读不到就不写数字），故这里只有文字；
 *       ② **不画假条目**——一个卡片元素都不建。
 *     ★**搜索框**是真输入（受控、可输入可清空），但它今天筛不动任何东西：条目集合不存在，
 *       "过滤一个不存在的清单"在数据面上必然是这个样子；真清单接上来的那一天，过滤归这一格。
 *   ★**「+ 创建专家」不许是死控件**：本部署没有创建专家的写入口（同样没有端点）⇒ 该按钮
 *     `disabled` **且行上可见地写出原因**（`createExpertLocked`）。判据是**端口在不在场**
 *     （`onCreateExpert === undefined`），不是写死的 `disabled`：真接线的那一天传进来即可用，
 *     这也正是本仓「禁用即须有可见说明」那条纪律的落法（挂一句 `title` 不算数）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { createElement, useState, type ReactNode } from 'react'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE } from '../error-messages.js'
import { ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'

/** 子页那两个 tab 的**唯一真源**（顺序即渲染顺序；**没有计数**，理由见文件头）。 */
export const ENTERPRISE_ESC_MY_EXPERTS_TABS: readonly {
  readonly key: 'expert' | 'team'
  readonly label: string
}[] = [
  { key: 'expert', label: ENTERPRISE_ESC_LOCAL_COPY.myExpertsTabExpert },
  { key: 'team', label: ENTERPRISE_ESC_LOCAL_COPY.myExpertsTabTeam },
]

/** 子页那枚分段控件的**唯一真源**（同上：真控件、无计数）。 */
export const ENTERPRISE_ESC_MY_EXPERTS_SEGMENTS: readonly {
  readonly key: 'owned' | 'purchased'
  readonly label: string
}[] = [
  { key: 'owned', label: ENTERPRISE_ESC_LOCAL_COPY.myExpertsSegmentOwned },
  { key: 'purchased', label: ENTERPRISE_ESC_LOCAL_COPY.myExpertsSegmentPurchased },
]

/** tab 的键（取自上面那张真源）。 */
export type EnterpriseEscMyExpertsTabKey = (typeof ENTERPRISE_ESC_MY_EXPERTS_TABS)[number]['key']
/** 分段的键（同上）。 */
export type EnterpriseEscMyExpertsSegmentKey = (typeof ENTERPRISE_ESC_MY_EXPERTS_SEGMENTS)[number]['key']

/**
 * 子页标题上的取证钩子。
 *
 * 两处用途，缺一不可：① 页壳在**进入子页**时把焦点落到它上面（`tabIndex={-1}` 的程序化聚焦点，
 * 读屏因此立刻报出「我的专家」）；② 门禁据此在源码级认出"焦点落点是谁"。
 */
export const ENTERPRISE_ESC_MY_EXPERTS_TITLE_ATTR = 'data-esc-my-experts-title'

/**
 * 子页**内容区**的唯一投影——**零参数**。
 *
 * ★**为什么刻意不给它任何入参**：这一格的内容在**所有** tab／分段组合下必须逐字相同
 * （理由见文件头那两段）。把这件事写成"函数签名里没有任何可变输入"，比"人肉检查每一处三元"
 * 强得多：它**结构上不可能**随选中态变化 —— 门禁直调它取证，不必渲染、不必切状态。
 */
export function enterpriseEscMyExpertsBody(): ReactNode {
  return createElement(
    'div',
    { className: 'esc-my-experts-body' },
    // 唯一提示组件 + 唯一码表里的稳定码：人话（"还没有提供「我的专家」清单所需的只读接口"）
    // + 下一步（找管理员确认部署版本）都取自 `error-messages.ts`，本页不自留第二套措辞。
    createElement(EnterpriseErrorNotice, {
      className: 'esc-installed-error',
      code: ENTERPRISE_ESC_MY_EXPERTS_UNAVAILABLE_CODE,
    }),
  )
}

/** 纯投影的入参（三个选中态与四枚动作由**外壳**持有，见 `EnterpriseEscMyExpertsPage`）。 */
export interface EnterpriseEscMyExpertsViewProps {
  /** 当前 tab（专家 / 专家团）。 */
  readonly tab: EnterpriseEscMyExpertsTabKey
  /** 当前分段（我创建的 / 我购买的）。 */
  readonly segment: EnterpriseEscMyExpertsSegmentKey
  /** 搜索框的受控值。 */
  readonly keyword: string
  readonly onTabChange: (key: EnterpriseEscMyExpertsTabKey) => void
  readonly onSegmentChange: (key: EnterpriseEscMyExpertsSegmentKey) => void
  readonly onKeywordChange: (keyword: string) => void
  /** 回专家目录（本页没有真实路由，返回就是切视图状态；由页壳连同滚动位置与焦点一起收尾）。 */
  readonly onBack: () => void
  /**
   * 「+ 创建专家」的**写入口**。
   *
   * ★今天**全仓没有任何调用方会传它**：本部署没有"创建专家"这条平台端点（见文件头那段），
   * 故它缺席 ⇒ 那枚按钮 `disabled` 且行上写明原因。这不是"预留一个将来可能用到的口子"，
   * 而是把「禁用判据＝端口不在场」这条纪律用在**本来就缺席**的那一个端口上：
   * 换成写死的 `disabled: true`，下一个读者就分不清"没有这个能力"与"忘了接线"。
   */
  readonly onCreateExpert?: (() => void) | undefined
}

/**
 * 「我的专家」子页的**纯投影**（不持 hook —— 与 `esc-toolbar.tsx` 同一条纪律：门禁可直接直调取证）。
 *
 * 三个选中态与它们的 setter 由外壳交进来；**内容区**仍是那个零参数投影
 * （`enterpriseEscMyExpertsBody`）——故"切换后内容一样"这件事在**类型层面**就成立。
 *
 * @param props - 见 `EnterpriseEscMyExpertsViewProps`。
 * @returns 页头（返回 + 标题）+ 该页整份 chrome + 内容区。
 */
export function EnterpriseEscMyExpertsView({
  tab, segment, keyword, onTabChange, onSegmentChange, onKeywordChange, onBack, onCreateExpert,
}: EnterpriseEscMyExpertsViewProps): ReactNode {
  const title = ENTERPRISE_ESC_LOCAL_COPY.myExpertsTitle
  return createElement(
    'div',
    // ★role="region" 而不是任何 dialog 语义：它就是内容区里的一块普通内容（口径 15/26）。
    { className: 'esc-content', role: 'region', 'aria-label': title },
    // ① 页头：左上角【返回】+ 标题。几何**复用** .esc-installed-* 那一份（口径 47 立的页头配方），
    //    刻意不新造第二套 —— 两个子页的标题字号/字重只有一个来源。
    createElement(
      'div',
      { className: 'esc-installed-head' },
      createElement(Button, {
        variant: 'outline',
        size: 'sm',
        className: 'esc-installed-back',
        onClick: onBack,
        icon: createElement(ArrowLeft, { size: 14, 'aria-hidden': true }),
        children: ENTERPRISE_ESC_LOCAL_COPY.myExpertsBack,
      }),
      // 标题用 h3（role=region 的名字之外再给一层真实标题语义，与插件详情子页面同一条），
      // tabIndex={-1} 只为**程序化**聚焦（进入子页时落点），不进 Tab 序。
      createElement('h3', {
        className: 'esc-installed-title',
        tabIndex: -1,
        ...{ [ENTERPRISE_ESC_MY_EXPERTS_TITLE_ATTR]: '' },
        children: title,
      }),
    ),
    // ② 一行：左 tabs、右（搜索 + 创建专家）
    createElement(
      'div',
      { className: 'esc-my-experts-row' },
      createElement(
        'div',
        { className: 'esc-my-experts-tabs', role: 'tablist', 'aria-label': title },
        ENTERPRISE_ESC_MY_EXPERTS_TABS.map(each =>
          createElement('button', {
            key: each.key,
            type: 'button',
            role: 'tab',
            id: `esc-my-experts-tab-${each.key}`,
            className: 'esc-my-experts-tab',
            'aria-selected': each.key === tab,
            'aria-controls': 'esc-my-experts-panel',
            ...{ 'data-esc-my-experts-tab': each.key },
            ...{ 'data-esc-selected': each.key === tab },
            onClick: () => onTabChange(each.key),
            children: each.label,
          }),
        ),
      ),
      createElement(
        'div',
        { className: 'esc-my-experts-right' },
        // 搜索框复用工具栏那枚**同一个** .esc-search（同一份宽度/高度/描边/聚焦口径，不新造第二个搜索框）。
        createElement(Input, {
          className: 'esc-search',
          icon: createElement(Search, { size: 14, 'aria-hidden': true }),
          placeholder: ENTERPRISE_ESC_LOCAL_COPY.myExpertsSearchPlaceholder,
          'aria-label': ENTERPRISE_ESC_LOCAL_COPY.myExpertsSearchPlaceholder,
          value: keyword,
          onChange: (event: { target: { value: string } }) => onKeywordChange(event.target.value),
        }),
        // ★「禁用即须有**可见**说明」：写入口缺席时，原因**行上**写在按钮左边（挂一句 title 不算数）。
        onCreateExpert === undefined
          ? createElement('span', {
              className: 'esc-my-experts-lock',
              role: 'status',
              children: ENTERPRISE_ESC_LOCAL_COPY.createExpertLocked,
            })
          : null,
        createElement(
          Button,
          {
            variant: 'primary',
            size: 'md',
            className: 'esc-my-experts-create',
            disabled: onCreateExpert === undefined,
            onClick: onCreateExpert,
            title: onCreateExpert === undefined
              ? ENTERPRISE_ESC_LOCAL_COPY.createExpertLocked
              : ENTERPRISE_ESC_LOCAL_COPY.myExpertsCreate,
          },
          createElement(Plus, { size: 14, 'aria-hidden': true }),
          ENTERPRISE_ESC_LOCAL_COPY.myExpertsCreate,
        ),
      ),
    ),
    // ③ 下一行右对齐：分段（真控件；两枚互斥的本地选中态）
    createElement(
      'div',
      { className: 'esc-my-experts-segments' },
      ENTERPRISE_ESC_MY_EXPERTS_SEGMENTS.map(each =>
        createElement('button', {
          key: each.key,
          type: 'button',
          className: 'esc-my-experts-segment-item',
          'aria-pressed': each.key === segment,
          ...{ 'data-esc-my-experts-segment': each.key },
          ...{ 'data-esc-selected': each.key === segment },
          onClick: () => onSegmentChange(each.key),
          children: each.label,
        }),
      ),
    ),
    // ④ 内容区：**零参数**投影（与选中态结构上无关，见 enterpriseEscMyExpertsBody）。
    //    WorkBuddy 那一格是专家卡片网格；今天没有清单接口 ⇒ 这一格放的就是那句如实交代
    //    （**不画空网格、不画假卡片**）。
    createElement(
      'div',
      {
        id: 'esc-my-experts-panel',
        role: 'tabpanel',
        className: 'esc-my-experts-panel',
        'aria-labelledby': `esc-my-experts-tab-${tab}`,
      },
      enterpriseEscMyExpertsBody(),
    ),
  )
}

/** 外壳入参（只有两枚非状态量：返回与创建写入口）。 */
export interface EnterpriseEscMyExpertsPageProps {
  readonly onBack: () => void
  readonly onCreateExpert?: (() => void) | undefined
}

/**
 * 「我的专家」子页的**外壳**：只持三个本地选中态（tab / 分段 / 搜索词），其余全交给上面那枚纯投影。
 *
 * 为什么拆成"纯投影 + 薄外壳"：本仓的 vitest 跑不了 hook（没有 DOM，直调含 hook 的组件会抛
 * `Invalid hook call`）⇒ 把 chrome 放在纯函数里，门禁才能逐项取证（与 `esc-toolbar.tsx` 同一条纪律）。
 */
export function EnterpriseEscMyExpertsPage({ onBack, onCreateExpert }: EnterpriseEscMyExpertsPageProps): ReactNode {
  /** 当前 tab（真选中态）。★它**不进**内容区——内容区是零参数投影，见 `enterpriseEscMyExpertsBody`。 */
  const [tab, setTab] = useState<EnterpriseEscMyExpertsTabKey>('expert')
  /** 当前分段（同 tab：真选中态，不进内容区）。 */
  const [segment, setSegment] = useState<EnterpriseEscMyExpertsSegmentKey>('owned')
  /** 搜索框的受控值（真输入；今天筛不动任何东西，理由见文件头）。 */
  const [keyword, setKeyword] = useState('')
  return createElement(EnterpriseEscMyExpertsView, {
    tab,
    segment,
    keyword,
    onTabChange: setTab,
    onSegmentChange: setSegment,
    onKeywordChange: setKeyword,
    onBack,
    onCreateExpert,
  })
}
