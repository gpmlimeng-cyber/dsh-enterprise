/**
 * [INPUT]: 依赖 React 的 createElement/ReactNode、官方原语 `Button`、lucide 的 `RefreshCw`、`list-state` 的四态类型与重试文案、`error-notice` 的唯一提示组件、`esc-skillhub` 的全部纯投影与文案、`esc-sub-tabs` 的**既有** chip 行呈现 `EnterpriseEscSubTabRow`、`esc-card` 那张与广场同一枚的卡片、`esc-skill-card` 的**唯一装配点** `enterpriseEscSkillCardSpec`，以及 `esc-skill-try` / `esc-more-menu` 的计划类型（后两者只在"已装"那一档透传）
 * [OUTPUT]: 对外提供 `EnterpriseEscSkillHubList`——「SkillHub」这一维度的**整块内容区**（纯渲染，无 hook、无请求、**无路径拼接**）
 * [POS]: esc 技能页第四枚维度的**呈现层**，与 `esc-skillhub.ts`（纯事实层）一带二：本文件只画。
 *   ★**为什么它是块内组件而不是工具栏的一部分**：工具栏是**纯投影**（直调可测、其结构锁靠这一点成立），
 *     而这一维度要在**内容区**整块替换掉卡片网格（四态 + 结果卡 + 翻页）⇒ 它是内容区的一支，由
 *     `esc-aggregation.tsx` 在本维度下挂载，与「本地三方」「企业技能」那两支是同一条形态。
 *   ★**搜索框不在这里**：这一页**只有一枚**输入框（工具栏那一枚）。本维度复用它 ⇒ 同一屏不会出现
 *     "两个搜索框、各自搜什么说不清"那种形态；查询与它引发的取数住在聚合层（与另两枚维度同一条
 *     注入范式：真值在持 hook 的那一层，这一层只画）。
 *   ★**分类 chip 行画在这里**（不在工具栏里另开一套）：它吃的是**同一次浏览响应**里的
 *     `categories` ⇒ 与结果必然同源；画在内容区上方一行，工具栏那一行（平台分类树）在这一维度上
 *     已被聚合层显式换成空 chip 行（整排不出现），两边不会同时出现两排分类胶囊。
 *   ★**四态互斥**由唯一状态投影 `enterpriseSkillHubFace` 给出（`loading/failed/empty/ready` 单字段联合），
 *     本文件不许自己再判一次"是不是空"——否则同一个事实会有两处判据，久了必漂。
 *   ★**失败态绝不回落空列表**：`failed` 那一支只画唯一提示组件 + **真重发**的重试，
 *     一句"没有匹配的技能"都不许出现在那一支里（那是两件不同的事实，混起来就是撒谎）。
 *   ★**翻页只画那一枚按钮**（复用既有 `Button` 原语 + `.esc-skillhub-retry` 同一套版式）；
 *     `hasMore === false` 时**整枚不画**（连一句"到底了"都不说——没有下一页不是一条消息），
 *     聚合层那一侧同时被 `enterpriseSkillHubHasNextPage` 挡住，**一次都不再发请求**。
 *   ★**界面不拼路径**：本文件里没有 `join(`、没有任何把 `~`/目录名拼起来的模板串、也没有
 *     `webkitdirectory`/`showDirectoryPicker`/`encodeURIComponent`——回传给宿主的那枚值只会是
 *     **响应里原样给来的 `installSource`**（`enterpriseSkillHubCardItem` 把它当 `id`，一路透传到
 *     `onInstall`，中间一次都没有被加工过）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { RefreshCw } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { ENTERPRISE_LIST_RETRY, ENTERPRISE_LIST_RETRY_LABEL, type EnterpriseListState } from '../list-state.js'
import type { EnterpriseSkillhubBrowse } from '../skill-api-decode.js'
import { EnterpriseEscCard } from './esc-card.js'
import type { EscCardInstall } from './esc-card.js'
import type { EscCardMore } from './esc-more-menu.js'
import { ENTERPRISE_ESC_SUB_TAB_ALL_KEY } from './esc-sub-tabs.js'
import { EnterpriseEscSubTabRow } from './esc-sub-tabs.js'
import { enterpriseEscSkillCardSpec } from './esc-skill-card.js'
import {
  ENTERPRISE_SKILLHUB_INSTALL_FAILED_PREFIX,
  ENTERPRISE_SKILLHUB_LOADING,
  ENTERPRISE_SKILLHUB_LOAD_MORE,
  ENTERPRISE_SKILLHUB_NOTE,
  ENTERPRISE_SKILLHUB_SOURCE_TITLE,
  enterpriseSkillHubCardInstall,
  enterpriseSkillHubCardItem,
  enterpriseSkillHubCategoryChips,
  enterpriseSkillHubFace,
  enterpriseSkillHubInstallingText,
} from './esc-skillhub.js'
import type { EnterpriseEscSkillTryPlan } from './esc-skill-try.js'

/** 「SkillHub」内容区的输入（唯一构造点是 `esc-aggregation.tsx`）。 */
export interface EnterpriseEscSkillHubListProps {
  /** 浏览取数的四态（loading / failed / empty / ready；四态互斥由 `list-state` 的单字段联合保证）。 */
  readonly state: EnterpriseListState<EnterpriseSkillhubBrowse>
  /** 本次会话里已经装好的那些坐标（`installSource`）：决定一条结果画【＋】还是走"已装"那一档。 */
  readonly installedSources?: readonly string[] | undefined
  /** 当前选中的下级分类 key（「全部」即空串）；**由响应里的 `categories` 投影**（聚合层传下来）。 */
  readonly category?: string | undefined
  /** 当前页码（1..20）：翻页判据与那枚按钮的可见性都读它。 */
  readonly page?: number | undefined
  /** 在途的那一条（**按坐标认**：`source` 是 `installSource`、`name` 只为那句可见文案念得出来）。 */
  readonly busy?: { readonly source: string; readonly name: string } | undefined
  /** 哪一条装失败了（坐标 + 稳定码）：只落在那一张卡上。 */
  readonly installError?: { readonly source: string; readonly code: string } | undefined
  /** 刚刚装成功那一句（`role="status"`；下一次动作开始时清掉）。 */
  readonly installedNotice?: string | undefined
  /**
   * ★**已装那一档**那两枚按钮的计划工厂 —— **与广场网格是同一枚**（聚合层交下来的
   *   `moreOf` / `tryOf`，内部就是那两张计划表）。★缺席 ⇒ 卡片逐字回到"计划缺席"那一态
   *   （不是本文件写死一个 `disabled`）。
   */
  readonly moreOf?: ((name: string, tryPlan?: EnterpriseEscSkillTryPlan | undefined) => EscCardMore | undefined) | undefined
  readonly tryOf?: ((name: string, installed: boolean) => EnterpriseEscSkillTryPlan) | undefined
  /**
   * 安装一条结果（**界面上只有未装那一档真会调它**）。
   * 缺席 = 写入口整条不在场 ⇒ 那些按钮禁用并**行上可见**写明原因（不许死控件）。
   */
  readonly onInstall?: ((source: string, name: string) => void) | undefined
  /** 重新取一次（失败态那枚重试；**真的**再发一次请求）。 */
  readonly onReload: () => void
  /** 点某枚分类 chip（带 `category` 重取，**页码归 1**）。 */
  readonly onCategoryChange?: ((key: string) => void) | undefined
  /** 翻到下一页（`hasMore === false` 时聚合层与本文件都不许发请求）。 */
  readonly onLoadMore?: (() => void) | undefined
}

/**
 * 「SkillHub」内容区（纯函数，无 hook）。
 *
 * 四块按序铺：① 标题 + 一句页内说明（说清"从哪来"与"安装做了什么"）；
 * ② 分类 chip 行（**响应的 `categories` 缺席 ⇒ 整排不画**）；③ 在途 / 刚成功那两句可见反馈
 * （在途那一句同时是所有被禁用按钮的原因来源）；④ 四态内容（加载中 / 失败 + 重试 / 空 + 那句
 * "为什么空" / 就绪 + 结果卡网格 + 翻页那一枚）。
 */
export function EnterpriseEscSkillHubList(props: EnterpriseEscSkillHubListProps): ReactNode {
  const face = enterpriseSkillHubFace({
    state: props.state,
    ...(props.installedSources === undefined ? {} : { installedSources: props.installedSources }),
    ...(props.category === undefined ? {} : { category: props.category }),
    ...(props.page === undefined ? {} : { page: props.page }),
  })
  const busy = props.busy
  const wired = props.onInstall !== undefined
  /** 分类 chip 行：★**判据只有这一处**（`categories` 缺席 ⇒ 空清单 ⇒ 整排不画 + 选中回「全部」）。 */
  const categories = props.state.kind === 'ready' || props.state.kind === 'empty'
    ? enterpriseSkillHubCategoryChips(props.state.value.categories, props.category ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY)
    : { chips: [], activeKey: ENTERPRISE_ESC_SUB_TAB_ALL_KEY }
  return createElement(
    'div',
    { className: 'esc-skillhub', 'data-esc-skillhub': 'true' },
    // ① 标题 + 页内说明句（完整说法「SkillHub（skillhub.cn）技能市场」在这里，不在那一个词上）。
    createElement(
      'div',
      { className: 'esc-skillhub-head' },
      createElement('h3', { className: 'esc-skillhub-title', children: ENTERPRISE_SKILLHUB_SOURCE_TITLE }),
      createElement('p', { className: 'esc-skillhub-note', children: ENTERPRISE_SKILLHUB_NOTE }),
    ),
    // ② 分类 chip 行：★**复用 `esc-sub-tabs` 那一枚**（与「本地三方」「企业技能」同一套类名与选中态语言），
    //    ★**零编造**：每一枚的中文名都来自响应；`categories` 整键缺席时它是 `[]` ⇒ **整排不画**
    //    （而 `activeKey` 那时已回落「全部」，不留一个不存在的选中项在过滤清单）。
    props.onCategoryChange === undefined
      ? null
      : EnterpriseEscSubTabRow({
          chips: categories.chips,
          activeKey: categories.activeKey,
          onSelect: props.onCategoryChange,
        }),
    // ③ 可见反馈：进行中（同时是所有被禁用按钮的原因）与刚成功那句各占一行。
    busy === undefined
      ? null
      : createElement('p', {
          className: 'esc-skillhub-status',
          role: 'status',
          'data-esc-skillhub-busy': busy.source,
          children: enterpriseSkillHubInstallingText(busy.name),
        }),
    props.installedNotice === undefined
      ? null
      : createElement('p', {
          className: 'esc-skillhub-status',
          role: 'status',
          'data-esc-skillhub-installed': 'true',
          children: props.installedNotice,
        }),
    // ④ 四态。
    face.kind === 'loading'
      ? createElement('p', {
          className: 'esc-skillhub-status',
          role: 'status',
          'data-esc-skillhub-state': 'loading',
          children: ENTERPRISE_SKILLHUB_LOADING,
        })
      : null,
    face.kind === 'failed'
      ? createElement(
          'div',
          { 'data-esc-skillhub-state': 'failed' },
          createElement(EnterpriseErrorNotice, { className: 'esc-import-error', code: face.failedCode ?? '' }),
          createElement(Button, {
            size: 'sm',
            className: 'esc-skillhub-retry',
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
          { 'data-esc-skillhub-state': 'empty' },
          // ★那句"为什么空"由纯投影选好（`emptyReason`：未选分类 = `no-result`、选中分类 = `empty-category`）
          //   ——界面这里只铺那一句，**不自己再判一次**（同一个事实两处判据，久了必漂）。
          createElement('p', {
            className: 'esc-skillhub-empty',
            'data-esc-skillhub-empty': face.emptyReason,
            children: face.emptyNote,
          }),
        )
      : null,
    face.kind === 'ready'
      ? createElement(
          'div',
          { 'data-esc-skillhub-state': 'ready' },
          createElement(
            /**
             * ★**与广场逐字同一枚网格类名**（`.esc-list-section` + `.esc-catalog-cell`）——
             *   这一维度的卡片与广场那些卡片由**同一个选择器**排版，版式上不可能漂。
             */
            'div',
            { className: 'esc-list-section' },
          face.rows.map((row) => {
            const error = props.installError?.source === row.installSource ? props.installError : undefined
            /**
             * ★**本刀**：这一枚卡的入参**只**从那一枚唯一装配来
             *   （`enterpriseEscSkillCardSpec`，广场 / 精选 / 本地三方调的是**同一个函数**）。
             *   ★已装那一档**不给** `install`（那一档根本画不出【＋】）；未装那一档的计划由
             *     `enterpriseSkillHubCardInstall` 给（四档互斥，禁用**必带可行可见原因**）。
             */
            const install: EscCardInstall | undefined = row.installed
              ? undefined
              : enterpriseSkillHubCardInstall({
                  row,
                  wired,
                  ...(busy === undefined ? {} : { busy }),
                  // ★回传的只有 `row.installSource`（响应里原样给来的不透明坐标）与 `row.name`
                  //   （只为在途那一句念得出名字）。**没有任何路径或用户输入参与**。
                  onInstall: () => { props.onInstall?.(row.installSource, row.name) },
                })
            const tryNow = row.installed ? props.tryOf?.(row.name, true) : undefined
            const more = row.installed ? props.moreOf?.(row.name, tryNow) : undefined
            const cardProps = enterpriseEscSkillCardSpec({
              installed: row.installed,
              justInstalled: false,
              ...(install === undefined ? {} : { install }),
              ...(more === undefined ? {} : { more }),
              ...(tryNow === undefined ? {} : { tryNow }),
            })
            return createElement(
              'div',
              {
                key: row.installSource,
                className: 'esc-catalog-cell',
                'data-esc-skillhub-result': row.installSource,
                'data-esc-skillhub-installed': row.installed ? 'true' : 'false',
              },
              createElement(EnterpriseEscCard, { item: enterpriseSkillHubCardItem(row), ...cardProps }),
              // 失败只落在**这一张卡**上：人话 + 下一步 + 「技术信息」里的稳定码（唯一提示组件）。
              error === undefined
                ? null
                : createElement(EnterpriseErrorNotice, {
                    className: 'esc-import-error',
                    code: error.code,
                    prefix: ENTERPRISE_SKILLHUB_INSTALL_FAILED_PREFIX,
                  }),
            )
          }),
          ),
        )
      : null,
    /**
     * ★**翻页**：只画那一枚按钮，**零新增 CSS 类**（复用失败态那枚重试用的 `.esc-skillhub-retry`）。
     *
     * ★**为什么是按钮而不是触底补拉**（与「广场」那一套 `shouldTriggerBottomLoad` 的**选型理由**）：
     *   ① 这一维的滚动面**不归它**——广场那一列的 `onScroll` 挂在一只 `.esc-scroll`／`.esc-content`
     *     格子上，而本维度**整段替换**了那一格的内容（它自己的 `esc-skillhub` 是普通块、不是滚动容器）；
     *     要复用触底判据就得把滚动容器再挖一次，等于给这一维单开一条滚动通路，而那一维**本来就靠那一格在滚**；
     *   ② 触底那一套的另外两条纪律（`loading` 不叠加、`suppressed` 补拉闩锁）是为"自动补拉"准备的，
     *     而自动补拉的全部价值是"用户不点也能继续看" —— 本维每页最多 100 行、宿主把页码收窄到 20，
     *     一次真正的「加载更多」点击成本极低，而**多一次误触发的自动请求**（真机上那一族 bug 的来处）
     *     的代价更高；
     *   ③ 一个**显式控件**还给键盘与读屏用户一条确定的路径（触底没有）。
     *   ⇒ 结论：**给一枚「加载更多」按钮**；`hasMore === false` 时**整枚不画**，
     *     且聚合层那一侧同时被 `enterpriseSkillHubHasNextPage` 挡住 ⇒ **一次都不再发请求**。
     */
    face.kind === 'ready' && face.hasMore === true && props.onLoadMore !== undefined
      ? createElement(
          'div',
          { className: 'esc-skillhub-more' },
          createElement(Button, {
            size: 'sm',
            variant: 'outline',
            className: 'esc-skillhub-retry',
            'aria-label': ENTERPRISE_SKILLHUB_LOAD_MORE,
            onClick: () => { props.onLoadMore?.() },
            children: ENTERPRISE_SKILLHUB_LOAD_MORE,
          }),
        )
      : null,
  )
}