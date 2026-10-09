/**
 * [INPUT]: 依赖 React 的 createElement/useState、lucide-react 的 `Folder`/`MoreHorizontal`/`Trash2`、官方原语
 *   `Menu`（`@deepseek-ai/dsh-client-ui-primitives`）、`confirm-action.tsx` 的唯一二次确认与 `esc-copy.ts` 的
 *   「更多操作」那一句
 * [OUTPUT]: 对外提供技能卡「更多」下拉的**两行纯数据** `SKILL_MORE_ENTRIES` 与行形状 `SkillMoreEntry`、
 *   它的输入契约（`EscCardMore` / `EscCardMoreAction` / `EscCardMoreConfirm`）、被画出来的那些行的**纯投影**
 *   `escCardMoreRows`、按下某一行的**唯一分派** `escCardMoreSelect`（可直调取证），以及组件本体
 *   `SkillMoreActions`
 * [POS]: esc 卡片层里「更多」下拉的**唯一实现**（本刀从 `esc-card.tsx` 抽出来：那一枚卡片已接近单文件上限，
 *   而本件是一整块自洽的交互——触发器 + 下拉 + 二次确认 + 危险行；抽出后 `esc-card.tsx` 只留一行接线）。
 *
 *   ★**本刀（S5a：技能卡片「更多」里的两个本机管理动作）**——三处一起动：
 *     ① **三行收成两行**：`编辑` 整枚退场（语义不明，YAGNI）；留下的正是「打开文件夹」与「卸载」，
 *        顺序照 workbuddy 截图（非破坏性在前、危险档在最后）；
 *     ② **两行真的有动作**：能不能按、点了干什么，全部由页面层经 `EscCardMore` **计划**注入——
 *        本组件不认识任何数据形状、不自己判"能不能卸"（判据是「这个名字在不在这台机器的自装清单里」，
 *        唯一判定在 `esc-skill-more.ts` 的 `enterpriseEscSkillMorePlan`）；
 *     ③ **危险那一枚必须先过二次确认**：下拉里按它只**请求确认**（`escCardMoreSelect` 返回 `'confirm'`），
 *        业务写入口一次都不调；确认框复用 `ConfirmAction`（唯一次确认实现），三句文案由计划给。
 *
 *   ★**为什么"不适用"表达为「整行不画」而不是「画成禁用」**（本刀锁死的那条选择，理由三条）：
 *     ① 官方 `MenuItem` 的字段只有 `{id,label,disabled,icon,danger,submenu}`（0.1.5-rc.2
 *        `lib/types/Menu.d.ts`，运行期 0.2.0-rc.2 同形）—— **没有 `title`、没有描述位**，一枚禁用的菜单行
 *        说不出「为什么按不动」；把 `title` 挂上去会被官方**静默丢弃**（`esc-toolbar.tsx` 口径 49 那条
 *        逐字核过 app.asar 的记录就是这个坑），而产品宪法禁止只挂 `title` 的禁用控件；
 *     ② 那条既有先例（把原因并进**可见文案**：`标签（原因）`，`ENTERPRISE_ADD_MENU_DEVELOPING`）在这里
 *        不成立——它说的是"这台机器没有这个能力"（那一行永远在），而这里是"**这枚技能**不是本机自装的那一份"
 *        （名字级事实）：把它折进 `打开文件夹（不是本机自装技能）` 会读成技能名的一部分，而不是一句原因；
 *     ③ 「画了就是在暗示能卸」（交付里的裁决原话）：一枚画出来的「卸载」即便灰着，也在暗示这台机器能卸它。
 *     ⇒ 判据落在"计划里有没有那一格"：没有那一行就**不画**；两行都画不出来时**连 `⋯` 触发器也不画**
 *       （见 `escCardMoreRows` 与 `esc-card.tsx` 那道闸）——**不是**画一枚点了没反应的死控件。
 *
 *   ★**触发器必须有 `onClick`**：官方 `Menu`（0.1.5-rc.2 与 0.2.0-rc.2 都逐行核过）只渲染
 *     `[anchor, list]`，**不会**给 anchor 挂点击——`open` 由调用方持有，开合也只能由 anchor 自己发起
 *     （`esc-toolbar.tsx` 那枚「添加技能」下拉同一条：`onClick: addSkillMenu.onToggle` + `aria-haspopup`）。
 *     本刀补上这枚 `onClick`（此前那一版只有 `onClose`/`onSelect`，`open` 永远是 false ⇒ 下拉根本打不开）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { Folder, MoreHorizontal, Trash2 } from 'lucide-react'
import { createElement, useState, type ReactNode } from 'react'
import { ConfirmAction } from '../confirm-action.js'
import { ENTERPRISE_ESC_COPY } from './esc-copy.js'

/**
 * 「更多」下拉里的一行（**纯数据**：id / 文案 / 是否危险档）。
 *
 * ★显式标出 `danger?` —— 不标的话 TS 会把两条推成两个互不相容的字面量联合，
 * 于是 `.map` 里读 `entry.danger` 直接报错（这就是 `MenuItem` 期望的那个可选位）。
 * ★**导出**：这一份是纯数据，测试要能直查（`SkillMoreActions` 自己持有 `open` 态，
 * 在没有 React 调度器的纯函数测试里渲染不出来）——「两行逐字 + 危险档只有卸载」这条判据因此落在
 * **真数据**上，而不是靠把组件硬渲染一遍。
 */
export interface SkillMoreEntry {
  readonly id: 'open-folder' | 'uninstall'
  readonly label: string
  readonly danger?: boolean | undefined
}

/**
 * ★**本刀（S5a）**：三行收成两行——`编辑` 整枚退场（语义不明，YAGNI），
 * 留下的是本刀真的接上线的两枚本机管理动作；顺序照截图（`打开文件夹` 在前、危险档 `卸载` 收尾）。
 */
export const SKILL_MORE_ENTRIES: readonly SkillMoreEntry[] = [
  { id: 'open-folder', label: '打开文件夹' },
  { id: 'uninstall', label: '卸载', danger: true },
]

/**
 * 破坏性那一行点下去之前要问的那三句（`ConfirmAction` 的入参）。
 *
 * ★文案由**事实层**给（`esc-skill-more.ts`），本组件一个字都不写：确认框里那句"影响"是产品口径，
 * 与菜单行上的词不是一回事，混在展示层会让"说清影响"这件事散成两处。
 */
export interface EscCardMoreConfirm {
  readonly title: string
  readonly impact: string
  readonly confirmLabel: string
}

/**
 * 计划里的一行。
 *
 * ★**没有 `title`**：官方 `MenuItem` 没有这个位（挂上去被静默丢弃，见文件头），
 * 故此处的"为什么按不动"只由**卡片上那行可见文字**承担（`EscCardMore.busyText`）——
 * 这正是"禁用即须有可见说明"在本件里的落法。
 */
export interface EscCardMoreAction {
  /** `true` ⇒ 这一行禁用（在途时两枚都禁用：同一枚技能上不并存两个动作）。 */
  readonly disabled?: boolean | undefined
  /** ★只有危险行会带它；带了就必须先确认（**不带那一枚不会被画出来**，见 `escCardMoreRows`）。 */
  readonly confirm?: EscCardMoreConfirm | undefined
  /** ★**确认之后**才被调到的真写入口（危险行）／点了就跑的入口（非危险行）。 */
  readonly onSelect: () => void
}

/**
 * 技能卡「更多」下拉的**终态**（本组件唯一认识的输入）。
 *
 * ★形状与 `EscCardInstall` 那枚计划同构（页面那一层只把事实铺平成计划），但**不 import** 任何事实模块：
 * 卡片层不认识"自装清单""卸载路由"这些概念，换个维度要给真实动作时构造同样的对象即可。
 * ★`actions` 以**行的 id** 为键（`SKILL_MORE_ENTRIES` 是行的唯一真源）：计划里缺哪一格，那一行就不画。
 */
export interface EscCardMore {
  readonly actions: Partial<Record<SkillMoreEntry['id'], EscCardMoreAction>>
  /**
   * 在途时那句**行上可见**的文字（如「卸载中…」）。
   *
   * ★为什么必须上屏而不是只把行灰掉：那枚 `⋯` 是个图标钮，菜单一关就什么都看不见；
   * 而"正在删本机目录"这件事必须当场看得见（与 `EscCardInstall.busy` 那条同一条纪律）。
   */
  readonly busyText?: string | undefined
  /**
   * 这次动作失败的**唯一提示件**入参（稳定码 + 动作前缀）；缺席 = 没有失败要说。
   *
   * ★人话与下一步由 `error-notice.tsx` 走唯一码表给，本组件只把它画在卡片上（`role="alert"` 由它自己挂）。
   */
  readonly failure?: { readonly code: string; readonly prefix: string } | undefined
}

/**
 * 被画出来的那些行（**纯投影**，可直调取证）：计划里有那一格、且危险行**带齐了确认文案**的行。
 *
 * ★**危险行没有 `confirm` 就整行丢掉**（fail-closed）：这是"绝不出现一键删除"的**结构保证**——
 * 不是靠渲染时再判一次，而是根本不会有一枚没有确认文案的「卸载」被画出来。
 * ★两行都画不出来 ⇒ 返回空数组 ⇒ 调用方连触发器都不画（见 `esc-card.tsx`）。
 *
 * @param more - 页面层给的计划（缺席 = 这一枚技能没有可用的本机管理动作）。
 * @returns 该画的行（顺序 = `SKILL_MORE_ENTRIES` 的顺序）。
 */
export function escCardMoreRows(more: EscCardMore | undefined): readonly SkillMoreEntry[] {
  if (more === undefined) return []
  return SKILL_MORE_ENTRIES.filter(entry => {
    const action = more.actions[entry.id]
    if (action === undefined) return false
    return entry.danger !== true || action.confirm !== undefined
  })
}

/**
 * 按下某一行的**唯一分派**（纯函数，测试直调取证"未确认时业务写入口一次都没被调"）。
 *
 * 三条返回值的语义：
 *   · `'confirm'` —— 危险行：**只请求确认**，`action.onSelect` 一次都没调（真正的执行在确认之后由
 *     `ConfirmAction.onConfirm` 发起）；
 *   · `'run'`     —— 非破坏性那一行（打开所在文件夹）：当场执行；
 *   · `'none'`    —— 这一行没有对应动作、或已被禁用、或危险行连确认入口都没有（**什么都不做**）。
 *
 * @param id - 被选中的行 id（官方 `Menu` 的 `onSelect` 原样给）。
 * @param actions - 计划里那一份动作表。
 * @param requestConfirm - 请求确认的唯一入口（`ConfirmAction` 的 `open`）；危险行缺它就**不执行**。
 * @returns 这次分派走了哪一条路（取证用；副作用只有"请求确认"或"执行非破坏动作"两种）。
 */
export function escCardMoreSelect(
  id: string,
  actions: EscCardMore['actions'],
  requestConfirm?: (() => void) | undefined,
): 'confirm' | 'run' | 'none' {
  const action = (actions as Readonly<Record<string, EscCardMoreAction | undefined>>)[id]
  if (action === undefined || action.disabled === true) return 'none'
  if (action.confirm !== undefined) {
    // ★危险行：没有确认入口就**什么都不做**（结构上这与"这一行不会被画出来"是同一条闸的两面）。
    if (requestConfirm === undefined) return 'none'
    requestConfirm()
    return 'confirm'
  }
  action.onSelect()
  return 'run'
}

/**
 * 已安装技能卡那枚「更多」下拉（workbuddy 截图里的 `⋯`）。
 *
 * 用官方 `Menu` 原语（它自带遮罩、Esc、外部点击关闭、`danger` 行），不自造下拉：
 * anchor 是那枚图标钮（**点它开合**，见文件头那条）、列表是 `escCardMoreRows` 给的两行、
 * `onSelect` 一律走 `escCardMoreSelect`（危险行→请求确认；非危险行→执行）。
 * 危险行在场时整枚菜单被 `ConfirmAction` 包住（它的 `children` 正是"触发器 + 列表"），
 * 确认框里的三句文案全部来自计划 ⇒ **本组件没有第二套确认实现**。
 *
 * @param props.name - 行上要念出来的技能名（只进无障碍名与悬浮说明）。
 * @param props.more - 页面层给的计划；两行都画不出来时本组件返回 `null`（调用方据此整枚不画）。
 */
export function SkillMoreActions({ name, more }: {
  readonly name: string
  readonly more: EscCardMore | undefined
}): ReactNode {
  const [open, setOpen] = useState(false)
  const rows = escCardMoreRows(more)
  if (more === undefined || rows.length === 0) return null
  /**
   * 菜单本体。`requestConfirm` 缺席时**不会**画出危险行（`escCardMoreRows` 那道闸），
   * 故这里的 `escCardMoreSelect` 拿到 undefined 也只可能是"没有危险行"这一种情形。
   */
  const menu = (requestConfirm?: (() => void) | undefined): ReactNode => createElement(Menu, {
    open,
    // 官方 `Menu` 是「触发器 + 条件列表」两合一：`anchor` 落在原位、列表跟随它。
    anchor: createElement(
      'button',
      {
        type: 'button',
        className: 'esc-more-btn',
        'aria-label': `${ENTERPRISE_ESC_COPY.moreActions}：${name}`,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        title: ENTERPRISE_ESC_COPY.moreActions,
        // ★开合只能由 anchor 自己发起（官方 Menu 不给 anchor 挂点击，见文件头）。
        onClick: () => setOpen(current => !current),
      },
      createElement(MoreHorizontal, { size: 16, 'aria-hidden': true }),
    ),
    items: rows.map(entry => {
      const action = more.actions[entry.id]
      return {
        id: entry.id,
        label: entry.label,
        disabled: action?.disabled === true,
        danger: entry.danger === true,
        icon: createElement(entry.id === 'uninstall' ? Trash2 : Folder, { size: 14, 'aria-hidden': true }),
      }
    }),
    onSelect: (id: string) => {
      // 先收菜单再分派（确认框与菜单不会同时悬在屏幕上）。
      setOpen(false)
      escCardMoreSelect(id, more.actions, requestConfirm)
    },
    onClose: () => setOpen(false),
  })
  const uninstall = more.actions.uninstall
  const confirm = uninstall?.confirm
  // 没有危险行（或它没带确认文案）⇒ 不需要确认框，直接画菜单。
  if (uninstall === undefined || confirm === undefined) return menu()
  return createElement(ConfirmAction, {
    title: confirm.title,
    description: confirm.impact,
    confirmLabel: confirm.confirmLabel,
    disabled: uninstall.disabled === true,
    // ★真正的执行点：确认之后才调业务写入口（菜单那一侧只请求确认）。
    onConfirm: () => { uninstall.onSelect() },
    // `ConfirmAction` 的 `children` 是**渲染函数**（它把"请求确认"这枚入口交给触发器那一侧）：
    // 菜单因此是它的触发器，而确认框由它自己渲染 —— 全仓唯一那枚二次确认实现，这里没有第二套。
    children: (openConfirm: () => void) => menu(openConfirm),
  })
}
