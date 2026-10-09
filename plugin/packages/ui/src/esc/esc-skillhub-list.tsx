/**
 * [INPUT]: 依赖 React 的 createElement/ReactNode、官方原语 `Button`、lucide 的 `RefreshCw`、`list-state` 的四态类型与重试文案、`error-notice` 的唯一提示组件、`esc-skillhub` 的全部纯投影与文案、`online-search.ts` 的**既有**计数文案、`esc-card` 那张与广场同一枚的卡片、`esc-skill-card` 的**唯一装配点** `enterpriseEscSkillCardSpec`，以及 `esc-skill-try` / `esc-more-menu` 的计划类型（后两者只在"已装"那一档透传）
 * [OUTPUT]: 对外提供 `EnterpriseEscSkillHubList`——「SkillHub」（本刀 ③）这一维度的**整块内容区**（纯渲染，无 hook、无请求、**无路径拼接**）
 * [POS]: esc 技能页第四枚维度的**呈现层**，与 `esc-skillhub.ts`（纯事实层）一带二：本文件只画。
 *   ★**为什么它是块内组件而不是工具栏的一部分**：工具栏是**纯投影**（直调可测、其结构锁靠这一点成立），
 *     而这一维度要在**内容区**整块替换掉卡片网格（四态 + 结果卡）⇒ 它是内容区的一支，由
 *     `esc-aggregation.tsx` 在本维度下挂载，与「本地三方」「企业技能」那两支是同一条形态。
 *   ★**搜索框不在这里**：这一页**只有一枚**输入框（工具栏那一枚）。本维度复用它 ⇒ 同一屏不会出现
 *     "两个搜索框、各自搜什么说不清"那种形态；查询与它引发的取数住在聚合层（与另两枚维度同一条
 *     注入范式：真值在持 hook 的那一层，这一层只画）。
 *   ★**四态互斥**由唯一状态投影 `enterpriseSkillHubFace` 给出（`loading/failed/empty/ready` 单字段联合），
 *     本文件不许自己再判一次"是不是空"——否则同一个事实会有两处判据，久了必漂。
 *   ★**失败态绝不回落空列表**：`failed` 那一支只画唯一提示组件 + **真重发**的重试，
 *     一句"没有匹配的技能"都不许出现在那一支里（那是两件不同的事实，混起来就是撒谎）。
 *   ★**界面不拼路径**：本文件里没有 `join(`、没有任何把 `~`/目录名拼起来的模板串、也没有
 *     `webkitdirectory`/`showDirectoryPicker`——回传给宿主的那枚值只会是**响应里原样给来的
 *     `installSource`**（`enterpriseSkillHubCardItem` 把它当 `id`，一路透传到 `onInstall`，
 *     中间一次都没有被加工过）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { RefreshCw } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { ENTERPRISE_LIST_RETRY, ENTERPRISE_LIST_RETRY_LABEL, type EnterpriseListState } from '../list-state.js'
import type { EnterpriseOnlineSkillSearch } from '../skill-api-decode.js'
import { EnterpriseEscCard } from './esc-card.js'
import type { EscCardInstall } from './esc-card.js'
import type { EscCardMore } from './esc-more-menu.js'
import { enterpriseEscSkillCardSpec } from './esc-skill-card.js'
import {
  ENTERPRISE_SKILLHUB_INSTALL_FAILED_PREFIX,
  ENTERPRISE_SKILLHUB_LOADING,
  ENTERPRISE_SKILLHUB_NOTE,
  ENTERPRISE_SKILLHUB_SOURCE_ID,
  ENTERPRISE_SKILLHUB_SOURCE_TITLE,
  enterpriseSkillHubCardInstall,
  enterpriseSkillHubCardItem,
  enterpriseSkillHubFace,
  enterpriseSkillHubInstallingText,
} from './esc-skillhub.js'
import type { EnterpriseEscSkillTryPlan } from './esc-skill-try.js'
import { enterpriseOnlineReadyText } from '../online-search.js'

/** 「SkillHub」内容区的输入（唯一构造点是 `esc-aggregation.tsx`）。 */
export interface EnterpriseEscSkillHubListProps {
  /** 搜索取数的四态（loading / failed / empty / ready；四态互斥由 `list-state` 的单字段联合保证）。 */
  readonly state: EnterpriseListState<EnterpriseOnlineSkillSearch>
  /** 搜索框里的当前文本（**已防抖**；由工具栏那一枚输入框统一持有）。 */
  readonly query: string
  /** 本次会话里已经装好的那些坐标（`installSource`）：决定一条结果画【＋】还是走"已装"那一档。 */
  readonly installedSources?: readonly string[] | undefined
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
  /** 重新搜索一次（失败态那枚重试；**真的**再发一次请求）。 */
  readonly onReload: () => void
}

/**
 * 「SkillHub」内容区（纯函数，无 hook）。
 *
 * 三块按序铺：① 标题 + 一句页内说明（说清"从哪来"与"安装做了什么"）；
 * ② 在途 / 刚成功那两句可见反馈（在途那一句同时是所有被禁用按钮的原因来源）；
 * ③ 四态内容（加载中 / 失败 + 重试 / 空 + 那句"为什么空" / 就绪 + 结果卡网格）。
 */
export function EnterpriseEscSkillHubList(props: EnterpriseEscSkillHubListProps): ReactNode {
  const face = enterpriseSkillHubFace(props.state, props.query, props.installedSources ?? [])
  const busy = props.busy
  const wired = props.onInstall !== undefined
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
    // ② 可见反馈：进行中（同时是所有被禁用按钮的原因）与刚成功那句各占一行。
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
    // ③ 四态。
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
          // ★两句"为什么空"由纯投影选好（`emptyReason`）——界面这里只铺那一句，不自己再判一次。
          createElement('p', {
            className: 'esc-skillhub-empty',
            'data-esc-skillhub-empty': face.emptyReason,
            children: face.emptyNote,
          }),
          /**
           * ★**这个来源自己那句坏消息**（`ok:false`）：与上面那句"为什么空"**分开说** ——
           * 那条路由是四源 fan-out，"某一个源没取到"与"真的没有结果"是两件事。
           */
          face.sourceNote === undefined
            ? null
            : createElement('p', {
                className: 'esc-skillhub-status',
                role: 'status',
                'data-esc-skillhub-source-note': ENTERPRISE_SKILLHUB_SOURCE_ID,
                children: face.sourceNote,
              }),
        )
      : null,
    face.kind === 'ready'
      ? createElement(
          'div',
          { 'data-esc-skillhub-state': 'ready' },
          /**
           * 就绪那一句 `role="status"` **播报**：说清这一趟搜完了、搜到多少（文案取自
           * `online-search.ts` 既有那枚 `enterpriseOnlineReadyText`——本文件不自己拼
           * `${rows.length} 条结果`）。★**不叠第二句同义的计数**：那一句里已经有"找到 N 条结果"。
           */
          createElement('p', {
            className: 'esc-skillhub-status',
            role: 'status',
            'data-esc-skillhub-ready': true,
            children: enterpriseOnlineReadyText(face.rows.length),
          }),
          // ★来源那句坏消息在**就绪态照铺**（有结果也照说：否则员工会以为搜的就是全部）。
          face.sourceNote === undefined
            ? null
            : createElement('p', {
                className: 'esc-skillhub-status',
                role: 'status',
                'data-esc-skillhub-source-note': ENTERPRISE_SKILLHUB_SOURCE_ID,
                children: face.sourceNote,
              }),
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
               * ★**本刀 ③**：这一枚卡的入参**只**从那一枚唯一装配来
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
  )
}
