/**
 * [INPUT]: 依赖 React 的 createElement/ReactNode、官方原语 `Button`、lucide 的 `RefreshCw`、`list-state` 的四态类型与重试文案、`error-notice` 的唯一提示组件、`esc-third-party` 的全部纯投影与文案、`esc-sub-tabs` 的按 key 过滤、**`esc-card` 那张与广场同一枚的卡片**、`esc-skill-card` 的**唯一装配点** `enterpriseEscSkillCardSpec`、以及 `esc-skill-try` / `esc-more-menu` 的计划类型（后两者只在"已装"那一档透传）
 * [OUTPUT]: 对外提供 `EnterpriseEscThirdPartyList`——「本地三方」（本地三方 Agent 技能源，口径 62）这一维度的**整块内容区**（纯渲染，无 hook、无请求、无路径拼接）；★**用户修正（二级 chip 行数据驱动）**：外多一枚可选 `selectedRoot`（当前选中的来源）——过滤同样走 `esc-sub-tabs` 那一份判据，与工具栏那一排 chip 同源；★**本刀**：内容区**第一件东西就是卡片**（页内大标题、页内说明句、统计横幅、空来源那一族句子**全部退场**），如实丢弃计数改挂「重新扫描」的**悬浮说明**
 * [POS]: esc 技能页第三枚维度的**呈现层**，与 `esc-third-party.ts`（纯事实层）/ `esc-third-party-install.ts`（一次一条的动作闸）构成一带三：本文件只画。
 *   ★**为什么它是块内组件而不是工具栏的一部分**：工具栏是**纯投影**（直调可测、其结构锁靠这一点成立），
 *     而这一维度要在**内容区**整块替换掉卡片网格（四态 + 按根分组）⇒ 它是内容区的一支，由
 *     `esc-aggregation.tsx` 在本维度下挂载，与系统搜索那一面"整块替换"是同一条形态。
 *   ★**本刀（② 本地三方换成与广场同一张卡 + 同一骨架）**：那套**手写行版式整体退场** ——
 *     `.esc-third-party-row` / `-rowline` / `-rowmain` / `-name` / `-desc` / `-meta` / `-action` /
 *     `-install` / `-lock` 九个类名（连同 `esc-style.ts` 里那九条规则）一并删掉，换成与广场
 *     **逐字同构**的骨架：`.esc-list-section > .esc-catalog-cell > 同一张卡`。★**为什么非换不可**：
 *     同一个页面上两张卡两种版式，就是用户已经报过的那类"同一件东西两种形态"；更要紧的是
 *     "这一枚卡片拿到哪些入参"这件事一旦在本文件里再写一遍，就必然与广场那一份漂（本仓被咬过三次）。
 *   ★**换卡不丢东西**（逐件保留，门禁逐件取证）：按来源根分组的**组标题**、根汇总那句、
 *     **二级 chip 行**（`esc-sub-tabs.ts` 那一份机制，本文件只按 key 过滤）、**两句不同的"为什么空"**、
 *     **失败态与真重发**、**在途与禁用原因**（后者现在落在卡片那枚【＋】的行上可见原因上，
 *     与广场那几档同一条落点 `.esc-card-lock`）。
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
import { EnterpriseEscCard } from './esc-card.js'
import type { EscCardInstall } from './esc-card.js'
import type { EscCardMore } from './esc-more-menu.js'
import { enterpriseEscSkillCardSpec } from './esc-skill-card.js'
import type { EnterpriseEscSkillTryPlan } from './esc-skill-try.js'
import { ENTERPRISE_ESC_SUB_TAB_ALL_KEY, enterpriseEscSubTabFilter } from './esc-sub-tabs.js'
import {
  ENTERPRISE_THIRD_PARTY_INSTALL_FAILED_PREFIX,
  ENTERPRISE_THIRD_PARTY_LOADING,
  ENTERPRISE_THIRD_PARTY_REFRESH,
  ENTERPRISE_THIRD_PARTY_REFRESH_LABEL,
  enterpriseThirdPartyCardInstall,
  enterpriseThirdPartyCardItem,
  enterpriseThirdPartyCountText,
  enterpriseThirdPartyFace,
  enterpriseThirdPartyInstallingText,
  enterpriseThirdPartySkillRow,
  enterpriseThirdPartySkippedCount,
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
   *   "选了一个空来源"就会被误判成整机空态，那是**编造**。故真值整份进来、过滤只发生在**铺卡**这一步。
   * ★过滤本身仍走**同一份**通用判据（`enterpriseEscSubTabFilter`）：工具栏那一排 chip 与这里这一行
   *   行用的是同一条规则、同一个 key，两处不可能漂。
   */
  readonly selectedRoot?: string | undefined
  /** 在途的那一条（`id` 判定"这一行正在装"、`title` 是那一行可见文案里念的名字）。 */
  readonly busy?: { readonly id: string; readonly title: string } | undefined
  /** 哪一条装失败了（`id` + 稳定码）：只落在那一张卡上。 */
  readonly installError?: { readonly id: string; readonly code: string } | undefined
  /** 刚刚装成功那一句（`role="status"`；下一次动作开始时清掉）。 */
  readonly installedNotice?: string | undefined
  /**
   * ★**本刀（②）**：「已装」那一档（`status === 'installed'`）卡片上那两枚按钮的计划工厂
   *   —— **与广场网格是同一枚**（聚合层交下来的 `moreOf` / `tryOf`，内部就是那两张计划表）。
   *
   * ★为什么要交下来而不是本文件自己造：规格 §2 的根因就是"某一面少递一份计划"⇒ 卡片退回兜底形态。
   *   故这两格与广场那两处**共用同一份事实**：同一枚技能名在两处不可能一处能卸、一处卸不了。
   * ★缺席 ⇒ 那两枚按钮逐字回到"计划缺席"那一态（禁用 + 卡片自己那句 `actionNotPorted`），
   *   不是本文件写死一个 `disabled`。
   */
  readonly moreOf?: ((name: string, tryPlan?: EnterpriseEscSkillTryPlan | undefined) => EscCardMore | undefined) | undefined
  readonly tryOf?: ((name: string, installed: boolean) => EnterpriseEscSkillTryPlan) | undefined
  /**
   * 安装一条候选（**界面上只有 `available` 那一档真会调它**，另两档那枚【＋】是禁用的）。
   * 缺席 = 写入口整条不在场 ⇒ 那些按钮禁用并**行上可见**写明原因（不许死控件）。
   */
  readonly onInstall?: ((id: string, name: string) => void) | undefined
  /** 重新扫描（失败态那枚重试 + 就绪态那枚重新扫描；**真的**再发一次请求）。 */
  readonly onReload: () => void
}

/**
 * 「本地三方」内容区（纯函数，无 hook）。
 *
 * ★★**本刀（版面精简 + 空来源不显示）**：内容区的第一件东西**就是卡片**（或四态那一档）——
 *   改前顶上那三块（大标题 + 页内说明句 + 统计横幅）已**整族删除**、连容器一起删掉 ⇒ 标题原来占的那块
 *   高度**不补回来**（`.esc-third-party` 那一格自己的 `margin-top` 是块间距、不是"标题预留位"，
 *   删了标题自然就没有空档；上面剩下的只有二级 chip 行与「重新扫描」那枚按钮）。
 *   仍然铺的三块按序是：① 可见反馈（在途 / 刚成功，那一句同时是所有被禁用按钮的原因来源）；
 *   ② 四态内容（加载中 / 失败 + 重试 / 空 + 那句**整机级**的"为什么空" / 就绪 + 按**可见**来源分组）。
 */
export function EnterpriseEscThirdPartyList(props: EnterpriseEscThirdPartyListProps): ReactNode {
  const face = enterpriseThirdPartyFace(props.state)
  const busy = props.busy
  const wired = props.onInstall !== undefined
  /**
   * 当前选中的来源根（空串 = 全部）。**过滤只发生在铺卡这一步**（见 prop 上那段：
   * 四态投影拿的永远是**整份**真值，"整机空"与"这一枚 chip 下空"是两件事）。
   */
  const selectedRoot = props.selectedRoot ?? ENTERPRISE_ESC_SUB_TAB_ALL_KEY
  /**
   * 真值在手的那一份（loading / failed 两态下缺席）：**如实丢弃的目录数**只在这里算一次，
   * 落点是「重新扫描」那枚按钮的**悬浮说明**（见下面那一句怎么组）。
   */
  const scanned = props.state.kind === 'ready' || props.state.kind === 'empty' ? props.state.value : undefined
  /**
   * ★**本刀**：「重新扫描」的悬浮说明 —— 改前那句「另有 190 个目录不符合技能规范」在**统计横幅**上，
   *   横幅已随版面精简删除；本仓纪律"丢弃不许静默"不许把这个数一起吞掉，故它挪到这里：
   *   **悬浮可见、一行版面都不占**，且这正是"要解释才看"的落点。
   * ★**计数为 0 时整句不出现**（不写"没有丢弃"这种零信息量的话——那会把真有缺口时的分量冲掉）。
   */
  const skipped = scanned === undefined ? 0 : enterpriseThirdPartySkippedCount(scanned)
  const refreshTitle = skipped === 0 ? undefined : `${ENTERPRISE_THIRD_PARTY_REFRESH_LABEL}：另有 ${skipped} 个目录不符合技能规范。`
  /**
   * 那枚「重新扫描」按钮（就绪态 / 空态两处共用**同一枚**，判据与文案一字不改）。
   * ★**失败态那枚是「重试」**（`ENTERPRISE_LIST_RETRY`，四个列表共用），**刻意不**挂这一句 ——
   *   扫描读不到时"丢弃了几个"是**零信息**（没有可信真值），挂上去等于凭空给一个数。
   */
  const refreshButton = createElement(Button, {
    size: 'sm',
    className: 'esc-third-party-retry',
    icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
    'aria-label': ENTERPRISE_THIRD_PARTY_REFRESH_LABEL,
    ...(refreshTitle === undefined ? {} : { title: refreshTitle }),
    onClick: () => { props.onReload() },
    children: ENTERPRISE_THIRD_PARTY_REFRESH,
  })
  return createElement(
    'div',
    { className: 'esc-third-party', 'data-enterprise-third-party': 'true' },
    // ① 可见反馈：进行中（同时是所有被禁用按钮的原因）与刚成功那句各占一行。
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
          // ★这两句说的是**整机**（"这台机器上一枚源都没有" vs "源在、里面没东西"），
          //   **照旧**——本刀删的是针对**单个**空来源的那三句，不是这两句。
          createElement('p', {
            className: 'esc-third-party-empty',
            'data-enterprise-third-party-empty': face.noSource === true ? 'no-source' : 'no-skill',
            children: face.emptyNote,
          }),
          /**
           * ★**本刀**：改前这里还有一整块「每一枚源自己那句」（`Agent Skills 未检测到 / Codex 未检测到 /
           *   …没有技能`）——**整块删除**，连同 `.esc-third-party-roots` 那个容器。
           *   ★**为什么必须删而不是留**：空来源（含 `present:false` 的位置与 `aliasOf` 别名）在这一刀
           *   之后**整枚不显示** ⇒ 这一族句子**永远不可达**，却还在源码里占着位置、还在版式里占着
           *   高度。本仓纪律：留着不可达的句子就是一张"看着还能用"的死条目。
           *   ★**这不违反"零编造"**：说真话的义务落在**整机级**那一句上（"检测到了技能源，但里面没有技能"）
           *   与**可见来源的真实计数**上，这两句一个字节都没动。
           */
          // 就绪态那枚重新扫描在这一态**照旧给**：空态恰恰是最需要"再扫一次"的时候
          //   （员工刚往 `~/.claude/skills` 里放了一枚技能）。**丢弃计数的悬浮说明也照旧**。
          refreshButton,
        )
      : null,
    face.kind === 'ready'
      ? createElement(
          'div',
          { 'data-enterprise-third-party-state': 'ready' },
          refreshButton,
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
                  'data-enterprise-third-party-present': 'true',
                },
                /**
                 * ★**本刀（组标题瘦身）**：改前节头是三件东西——根名 +「未检测到」签 + 计数，
                 *   并且空组还额外铺一句"这个位置里没有技能…"。现在**只留**「来源名 + N 枚技能」
                 *   **一行**：可见来源恒有候选、恒 `present: true` ⇒「未检测到」签与那句空话都不可达，
                 *   三件并排读出来是同一件事说两遍。
                 */
                createElement(
                  'div',
                  { className: 'esc-third-party-grouphead' },
                  createElement('h4', { className: 'esc-third-party-grouptitle', children: group.label }),
                  createElement('span', {
                    className: 'esc-third-party-count',
                    children: enterpriseThirdPartyCountText(group.skills.length),
                  }),
                ),
                createElement(
                  /**
                   * ★**本刀（②）**：这一格从 `ul.esc-third-party-rows` 换成 **`.esc-list-section`**
                   *   —— 与广场网格**逐字同一枚类名**（同一份列模板、同一份间距、同一条
                   *   `content-visibility` 跳过屏幕外的规则）。因此本维度的卡片与广场那些卡片
                   *   在版式上不可能漂：它们由**同一个选择器**排版。
                   */
                  'div',
                  { className: 'esc-list-section' },
                  enterpriseEscSubTabFilter(group.skills, selectedRoot, skill => skill.rootId).map((skill) => {
                        const row = enterpriseThirdPartySkillRow(skill)
                        const error = props.installError?.id === row.id ? props.installError : undefined
                        /**
                         * ★**本刀（②）**：这一枚该走哪一支动作，按"**DSH 里到底有没有**"分流
                         *   —— `status === 'installed'` 就是"盘上已经有同名技能"，与广场那张卡
                         *   的 `installed` 是同**一件事**（那一档画「更多 + 去试试」，不画【＋】）。
                         *   ★`conflict`（同名目录被别的技能占用）**不是**这一档：它不是"已装"，
                         *     是"复制过去会覆盖"，故它走**禁用的【＋】+ 可见原因**那一档。
                         */
                        const installed = row.status === 'installed'
                        /**
                         * ★**本刀（②）**：那枚【＋】的终态 —— **纯适配器**把**既有**那枚
                         *   `enterpriseThirdPartyActionPlan`（一个字不改）映成卡片的 `install` 形态。
                         *   可点 / 本枚在途 / 被别的在途挡住 / 端口缺席 / 另两态都带上**行上可见**的原因。
                         *   ★已装那一档**不给** `install`（那一档根本画不出【＋】，给了就是一枚够不到的
                         *     计划）；这一条与广场那张卡的判据**同形**。
                         */
                        const install: EscCardInstall | undefined = installed
                          ? undefined
                          : enterpriseThirdPartyCardInstall({
                              row,
                              wired,
                              ...(busy === undefined ? {} : { busy }),
                              // ★回传的只有 `row.id`（上次响应里原样给来的不透明值）与 `row.name`
                              //   （只为在途那一句念得出名字）。**没有任何路径参与**。
                              onInstall: () => { props.onInstall?.(row.id, row.name) },
                            })
                        /**
                         * ★**本刀（②）**：已装那一档那两枚按钮的计划 —— 与广场**同一枚工厂**
                         *   （聚合层交下来的 `moreOf` / `tryOf`）。缺席 ⇒ 卡片自己回到"计划缺席"那一态。
                         */
                        const tryNow = installed ? props.tryOf?.(row.name, true) : undefined
                        const more = installed ? props.moreOf?.(row.name, tryNow) : undefined
                        /**
                         * ★**本刀（①）**：这一枚卡的入参**只**从那一枚唯一装配来
                         *   （`enterpriseEscSkillCardSpec`，广场网格 / 精选行 / SkillHub 调的
                         *   是**同一个函数**）⇒ 四个面的卡片入参逐键同源。
                         *   ★本维度**没有**"刚装那一枚留在原地"那条例外（口径 62 的落地是
                         *     "装完重新扫描"，扫描回来的 `status` 自己就翻成 `installed`），
                         *     故 `justInstalled` 恒 `false` —— 这不是漏接线，是这一面的真值形状。
                         */
                        const cardProps = enterpriseEscSkillCardSpec({
                          installed,
                          justInstalled: false,
                          ...(install === undefined ? {} : { install }),
                          ...(more === undefined ? {} : { more }),
                          ...(tryNow === undefined ? {} : { tryNow }),
                        })
                        return createElement(
                          /**
                           * ★**本刀（②）**：这一格是**广场那一枚格子**（`.esc-catalog-cell`
                           *   —— 既有那套"卡片 + 其下失败块"的列布局，零新增 CSS）。
                           *   两个取证钩子（`-skill` / `-status`）原样留着：门禁据此核
                           *   "这一枚是谁、它属于哪一态"，不必去数第几个子节点。
                           */
                          'div',
                          {
                            key: row.id,
                            className: 'esc-catalog-cell',
                            'data-enterprise-third-party-skill': row.id,
                            'data-enterprise-third-party-status': row.status,
                          },
                          createElement(EnterpriseEscCard, { item: enterpriseThirdPartyCardItem(row), ...cardProps }),
                          // 失败只落在**这一张卡**上：人话 + 下一步 + 「技术信息」里的稳定码（唯一提示组件）。
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
