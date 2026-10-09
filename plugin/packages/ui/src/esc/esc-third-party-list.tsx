/**
 * [INPUT]: 依赖 React 的 createElement/ReactNode、官方原语 `Button`、lucide 的 `RefreshCw`、`list-state` 的四态类型与重试文案、`error-notice` 的唯一提示组件、`esc-third-party` 的全部纯投影与文案、以及 `esc-sub-tabs` 的按 key 过滤
 * [OUTPUT]: 对外提供 `EnterpriseEscThirdPartyList`——「本地三方」（本地三方 Agent 技能源，口径 62）这一维度的**整块内容区**（纯渲染，无 hook、无请求、无路径拼接）；★**用户修正（二级 chip 行数据驱动）**：外多一枚可选 `selectedRoot`（当前选中的来源）——过滤同样走 `esc-sub-tabs` 那一份判据，与工具栏那一排 chip 同源；且内容区多一句“检测到 N 个源、其中 M 个有技能”（报那些**不进 chip** 的位置）
 * [POS]: esc 技能页第三枚维度的**呈现层**，与 `esc-third-party.ts`（纯事实层）/ `esc-third-party-install.ts`（一次一条的动作闸）构成一带三：本文件只画。
 *   ★**为什么它是块内组件而不是工具栏的一部分**：工具栏是**纯投影**（直调可测、其结构锁靠这一点成立），
 *     而这一维度要在**内容区**整块替换掉卡片网格（四态 + 按根分组）⇒ 它是内容区的一支，由
 *     `esc-aggregation.tsx` 在本维度下挂载，与系统搜索那一面"整块替换"是同一条形态。
 *   ★**四态互斥**由唯一状态投影 `enterpriseThirdPartyFace` 给出（`loading/failed/empty/ready` 单字段联合），
 *     本文件不许自己再判一次"是不是空"——否则同一个事实会有两处判据，久了必漂。
 *   ★**失败态绝不回落空列表**（口径 62 明令）：`failed` 那支只画唯一提示组件 + 真重发的重试，
 *     一句"没检测到技能源"都不许出现在那一支里（那是两件不同的事实，混起来就是撒谎）。
 *   ★**界面不拼路径**：本文件里没有 `join(`、没有把 `~` 与目录名拼起来的模板串、也没有任何
 *     `webkitdirectory`/`showDirectoryPicker`——回传给宿主的那枚值只会是**上次响应里原样给来的 `id`**
 *     （`row.id` 一路透传到 `onInstall`，中间一次都没有被加工过）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { RefreshCw } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { ENTERPRISE_LIST_RETRY, ENTERPRISE_LIST_RETRY_LABEL, type EnterpriseListState } from '../list-state.js'
import type { EnterpriseThirdPartySkills } from '../skill-api-decode.js'
import { ENTERPRISE_ESC_SUB_TAB_ALL_KEY, enterpriseEscSubTabFilter } from './esc-sub-tabs.js'
import {
  ENTERPRISE_THIRD_PARTY_ABSENT_TAG,
  ENTERPRISE_THIRD_PARTY_INSTALL_FAILED_PREFIX,
  ENTERPRISE_THIRD_PARTY_LOADING,
  ENTERPRISE_THIRD_PARTY_NOTE,
  ENTERPRISE_THIRD_PARTY_REFRESH,
  ENTERPRISE_THIRD_PARTY_REFRESH_LABEL,
  ENTERPRISE_THIRD_PARTY_SOURCE_TITLE,
  enterpriseThirdPartyActionPlan,
  enterpriseThirdPartyCountText,
  enterpriseThirdPartyFace,
  enterpriseThirdPartyInstallingText,
  enterpriseThirdPartySkillRow,
  enterpriseThirdPartySourceSummary,
} from './esc-third-party.js'

/** 「本地三方」内容区的输入（唯一构造点是 `esc-aggregation.tsx`）。 */
export interface EnterpriseEscThirdPartyListProps {
  /** 扫描取数的四态（loading / failed / empty / ready；四态互斥由 `list-state` 的单字段联合保证）。 */
  readonly state: EnterpriseListState<EnterpriseThirdPartySkills>
  /**
   * ★**口径 62（用户修正：二级 chip 行数据驱动）**：**当前选中的来源根**（空串 = 全部）。
   *
   * ★为什么把 key 交进来、而不是交"筛好的数组"：这一层的**四态投影**要看**整份真值**
   *   （"空"是"整台机器上一枚候选都没有"，不是"当前这一枚 chip 下没有"）——若把筛过的数组当输入，
   *   "选了一个空来源"就会被误判成整机空态，那是**编造**。故真值整份进来、过滤只发生在**铺行**这一步。
   * ★过滤本身仍走**同一份**通用判据（`enterpriseEscSubTabFilter`）：工具栏那一排 chip 与这里这一行
   *   行用的是同一条规则、同一个 key，两处不可能漂。
   */
  readonly selectedRoot?: string | undefined
  /** 在途的那一条（`id` 判定"这一行正在装"、`title` 是那一行可见文案里念的名字）。 */
  readonly busy?: { readonly id: string; readonly title: string } | undefined
  /** 哪一条装失败了（`id` + 稳定码）：只落在那一行上。 */
  readonly installError?: { readonly id: string; readonly code: string } | undefined
  /** 刚刚装成功那一句（`role="status"`；下一次动作开始时清掉）。 */
  readonly installedNotice?: string | undefined
  /**
   * 安装一条候选（**界面上只有 `available` 那些行会调它**，另两态根本不画按钮）。
   * 缺席 = 写入口整条不在场 ⇒ 那些按钮禁用并**行上可见**写明原因（不许死控件）。
   */
  readonly onInstall?: ((id: string, name: string) => void) | undefined
  /** 重新扫描（失败态那枚重试 + 就绪态那枚重新扫描；**真的**再发一次请求）。 */
  readonly onReload: () => void
}

/**
 * 「本地三方」内容区（纯函数，无 hook）。
 *
 * 三块按序铺：① 标题 + 一句页内说明（说清"从哪来"与"安装做了什么"）；
 * ② 在途 / 刚成功那两句可见反馈（**在途那一句同时是所有被禁用按钮的原因来源**）；
 * ③ 四态内容（加载中 / 失败 + 重试 / 空 + 那句"为什么空" + 各根的空话 / 就绪 + 按根分组）。
 */
export function EnterpriseEscThirdPartyList(props: EnterpriseEscThirdPartyListProps): ReactNode {
  const face = enterpriseThirdPartyFace(props.state)
  const busy = props.busy
  const wired = props.onInstall !== undefined
  /**
   * 当前选中的来源根（空串 = 全部）。**过滤只发生在铺行这一步**（见 prop 上那段：
   * 四态投影拿的永远是**整份**真值，"整机空"与"这一枚 chip 下空"是两件事）。
   */
  const selectedRoot = props.selectedRoot ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY
  /** 真值在手的那一份（loading / failed 两态下缺席）：那句话只许报**可信**的数字。 */
  const scanned = props.state.kind === 'ready' || props.state.kind === 'empty' ? props.state.value : undefined
  return createElement(
    'div',
    { className: 'esc-third-party', 'data-enterprise-third-party': 'true' },
    // ① 标题 + 页内说明句（完整说法「本地三方 Agent 技能源」在这里，不在那四个字的标签上）。
    createElement(
      'div',
      { className: 'esc-third-party-head' },
      createElement('h3', { className: 'esc-third-party-title', children: ENTERPRISE_THIRD_PARTY_SOURCE_TITLE }),
      createElement('p', { className: 'esc-third-party-note', children: ENTERPRISE_THIRD_PARTY_NOTE }),
      /**
       * ★**"检测到几个源、其中几个有技能"**（口径 62 用户修正）：0 枚的根与别名根**不进 chip 行**
       *   （判据在 `enterpriseThirdPartySubChips`），于是员工看不到它们——不给出这个总数，那些
       *   "本机确实存在但一枚技能都没有"的位置就**没有任何交代**了。这句话就是那个交代。
       * ★**只在真值在手时画**（loading / failed 两态下没有可信数字可报，宁可不画也不编一个）。
       */
      scanned === undefined
        ? null
        : createElement('p', {
            className: 'esc-third-party-summary',
            'data-enterprise-third-party-summary': 'true',
            children: enterpriseThirdPartySourceSummary(scanned),
          }),
    ),
    // ② 可见反馈：进行中（同时是所有被禁用按钮的原因）与刚成功那句各占一行。
    busy === undefined
      ? null
      : createElement('p', {
          className: 'esc-third-party-status',
          role: 'status',
          'data-enterprise-third-party-busy': busy.id,
          children: enterpriseThirdPartyInstallingText(busy.title),
        }),
    props.installedNotice === undefined
      ? null
      : createElement('p', {
          className: 'esc-third-party-status',
          role: 'status',
          'data-enterprise-third-party-installed': 'true',
          children: props.installedNotice,
        }),
    // ③ 四态。
    face.kind === 'loading'
      ? createElement('p', {
          className: 'esc-third-party-status',
          role: 'status',
          'data-enterprise-third-party-state': 'loading',
          children: ENTERPRISE_THIRD_PARTY_LOADING,
        })
      : null,
    face.kind === 'failed'
      ? createElement(
          'div',
          { 'data-enterprise-third-party-state': 'failed' },
          createElement(EnterpriseErrorNotice, { className: 'esc-import-error', code: face.failedCode ?? '' }),
          createElement(Button, {
            size: 'sm',
            className: 'esc-third-party-retry',
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
          { 'data-enterprise-third-party-state': 'empty' },
          // ★两种"为什么空"由纯投影选好（`noSource`）——界面这里只铺那一句，不自己再判一次。
          createElement('p', {
            className: 'esc-third-party-empty',
            'data-enterprise-third-party-empty': face.noSource === true ? 'no-source' : 'no-skill',
            children: face.emptyNote,
          }),
          // 每一枚源自己那句（未检测到 / 里面没有技能 / 这里没有但别处有）照旧铺：它们说的是
          // "**这个位置**怎么了"，与上面那句"整台机器怎么了"分工不同、两句都要有。
          createElement(
            'div',
            { className: 'esc-third-party-roots' },
            face.groups.map(group =>
              createElement('p', {
                key: group.root.id,
                className: 'esc-third-party-rootnote',
                'data-enterprise-third-party-root': group.root.id,
                children: `${group.label}：${group.emptyNote ?? ''}`,
              }),
            ),
          ),
          // 就绪态那枚重新扫描在这一态**照旧给**：空态恰恰是最需要"再扫一次"的时候
          //   （员工刚往 `~/.claude/skills` 里放了一枚技能）。
          createElement(Button, {
            size: 'sm',
            className: 'esc-third-party-retry',
            icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
            'aria-label': ENTERPRISE_THIRD_PARTY_REFRESH_LABEL,
            onClick: () => { props.onReload() },
            children: ENTERPRISE_THIRD_PARTY_REFRESH,
          }),
        )
      : null,
    face.kind === 'ready'
      ? createElement(
          'div',
          { 'data-enterprise-third-party-state': 'ready' },
          createElement(Button, {
            size: 'sm',
            variant: 'outline',
            className: 'esc-third-party-retry',
            icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
            'aria-label': ENTERPRISE_THIRD_PARTY_REFRESH_LABEL,
            onClick: () => { props.onReload() },
            children: ENTERPRISE_THIRD_PARTY_REFRESH,
          }),
          createElement(
            'div',
            { className: 'esc-third-party-groups' },
            face.groups.map(group =>
              createElement(
                'section',
                {
                  key: group.root.id,
                  className: 'esc-third-party-group',
                  'aria-label': group.label,
                  'data-enterprise-third-party-group': group.root.id,
                  'data-enterprise-third-party-present': group.root.present ? 'true' : 'false',
                },
                createElement(
                  'div',
                  { className: 'esc-third-party-grouphead' },
                  createElement('h4', { className: 'esc-third-party-grouptitle', children: group.label }),
                  // ★未检测到的根**照样成组**，节头右边如实写「未检测到」（口径 62 明令可显示）。
                  group.absent
                    ? createElement('span', {
                        className: 'esc-third-party-grouptag',
                        'data-enterprise-third-party-absent': 'true',
                        children: ENTERPRISE_THIRD_PARTY_ABSENT_TAG,
                      })
                    : null,
                  createElement('span', {
                    className: 'esc-third-party-count',
                    children: enterpriseThirdPartyCountText(group.skills.length),
                  }),
                ),
                // 就绪态里某一根也可能是空的（别的根有技能）⇒ 那句空话照旧要写。
                group.emptyNote === undefined
                  ? null
                  : createElement('p', {
                      className: 'esc-third-party-rootnote',
                      'data-enterprise-third-party-root-note': group.root.id,
                      children: group.emptyNote,
                    }),
                group.skills.length === 0
                  ? null
                  : createElement(
                      'ul',
                      { className: 'esc-third-party-rows' },
                      enterpriseEscSubTabFilter(group.skills, selectedRoot, skill => skill.rootId).map((skill) => {
                        const row = enterpriseThirdPartySkillRow(skill)
                        const error = props.installError?.id === row.id ? props.installError : undefined
                        // ★按钮终态由纯投影给（在途那一行 / 被别人的在途挡住 / 端口缺席 / 可点），
                        //   四档各有自己的可见文案——界面不在这里自己拼 disabled 与原因。
                        const plan = enterpriseThirdPartyActionPlan({
                          wired,
                          id: row.id,
                          name: row.name,
                          busy,
                        })
                        return createElement(
                          'li',
                          {
                            key: row.id,
                            className: 'esc-third-party-row',
                            'data-enterprise-third-party-skill': row.id,
                            'data-enterprise-third-party-status': row.status,
                          },
                          createElement(
                            'div',
                            { className: 'esc-third-party-rowline' },
                            createElement(
                              'div',
                              { className: 'esc-third-party-rowmain' },
                              createElement('span', { className: 'esc-third-party-name', children: row.name }),
                              // 描述读不到就**没有这一行**（不是空串、不是占位句）；只显示首行。
                              row.description === undefined
                                ? null
                                : createElement('span', { className: 'esc-third-party-desc', children: row.description }),
                              // 来源根名与那一句状态（恒有）：员工据此知道"这枚从哪来、现在能不能装"。
                              createElement('span', {
                                className: 'esc-third-party-meta',
                                children: `${row.sourceName} · ${row.note}`,
                              }),
                            ),
                            // ★只有 `available` 才画按钮（另两态**不画**，行上写清为什么）——见纯投影那段。
                            //   在途那一行**照旧画**（文案变「正在安装…」），它就是"别的按钮为什么不能点"的落点。
                            row.installable
                              ? createElement(
                                  'span',
                                  { className: 'esc-third-party-action' },
                                  createElement(Button, {
                                    size: 'sm',
                                    className: 'esc-third-party-install',
                                    disabled: plan.disabled,
                                    'aria-label': plan.ariaLabel,
                                    // ★回传的只有 `row.id`（上次响应里原样给来的不透明值）与 `row.name`
                                    //   （只为在途那一句念得出名字）。**没有任何路径参与**。
                                    onClick: () => { props.onInstall?.(row.id, row.name) },
                                    children: plan.text,
                                  }),
                                  // 禁用时的**可见原因**（产品宪法：禁用控件不许只挂一句 `title`）。
                                  plan.reason === undefined
                                    ? null
                                    : createElement('span', {
                                        className: 'esc-third-party-lock',
                                        role: 'status',
                                        'data-enterprise-third-party-blocked': plan.kind,
                                        children: plan.reason,
                                      }),
                                )
                              : null,
                          ),
                          // 失败只落在**这一行**上：人话 + 下一步 + 「技术信息」里的稳定码（唯一提示组件）。
                          error === undefined
                            ? null
                            : createElement(EnterpriseErrorNotice, {
                                className: 'esc-import-error',
                                code: error.code,
                                prefix: ENTERPRISE_THIRD_PARTY_INSTALL_FAILED_PREFIX,
                              }),
                        )
                      }),
                    ),
              ),
            ),
          ),
        )
      : null,
  )
}
