/**
 * [INPUT]: 依赖 `esc-skill-more.ts`（两枚本机管理动作的唯一事实层：可用性判据 / 计划 / 文案）、
 *   `esc-more-menu.tsx`（行的纯数据与两个纯投影：`escCardMoreRows` / `escCardMoreSelect`）、
 *   `esc-card.tsx`（卡片本体，纯函数直调）、`local-api.ts`（两条 exact 路由与正文键集）、
 *   `error-notice.tsx` / `error-messages.ts` 与 `src` 的源码文本
 * [OUTPUT]: 锁定 **S5a**（技能卡「更多」里的两个本机管理动作）的界面半边七条：
 *   ① 可用性判据**只认自装记录的 `names[]`**（命中 ⇒ 可卸；只在 `displayName`/`skillId` 里出现 ⇒ 不可卸）；
 *   ② 二次确认语义（**未确认 ⇒ 业务写入口一次都不发**）与影响句逐字；
 *   ③ 在途两枚都禁用、**不乐观改本地**、成功以 Host 回执为准、失败走唯一提示组件 + 稳定码；
 *   ④ 成功后**触发同一枚**计数刷新回调；⑤ 路由字面量各一处、正文键集恰好 `{name}`、界面零 `fetch(`/零路径拼接；
 *   ⑥ 非自装技能 ⇒ 卸载入口**不画**（不是画成禁用）；⑦ `reveal` 失败如实上屏
 * [POS]: S5a 界面半边的机械门禁——把"这一枚能不能卸、点了先问谁、装完信谁、失败落在哪"钉在
 *   **纯函数与源码**两层（本仓 vitest 无 DOM，故不碰真渲染器）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * ★官方原语在本仓**不是**运行期依赖（发行时用宿主共享实例），而 `devDependency` 那份在**导入期**
 * 就会 `import 'clsx'`（那个包不在本仓依赖里）⇒ 直接 import 呈现层会在"收集测试"阶段就炸。
 * 与 `tests/esc-catalog.spec.ts` 同一条手法：整模块替身化（本文件要测的是我们自己的**投影与结构**）。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: 'button',
  Pill: 'button',
  Input: 'input',
  Menu: 'div',
  MenuItemButton: 'button',
  Modal: 'div',
  Switch: 'span',
  Tag: 'span',
  IconEllipsisOutlineMedium: 'span',
  IconSettingsOutlineMedium: 'span',
  IconUserOutlineMedium: 'span',
  IconLoadingOutlineMedium: 'span',
}))

import { EnterpriseErrorNotice } from '../src/error-notice.js'
import { EnterpriseEscCard, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import {
  SKILL_MORE_ENTRIES,
  SkillMoreActions,
  escCardMoreRows,
  escCardMoreSelect,
  type EscCardMore,
} from '../src/esc/esc-more-menu.js'
import {
  ENTERPRISE_ESC_MORE_REVEALING,
  ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX,
  ENTERPRISE_ESC_MORE_UNINSTALLING,
  ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM,
  ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM_TITLE,
  ENTERPRISE_ESC_MORE_UNINSTALL_FAILED_PREFIX,
  ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT,
  ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS,
  enterpriseEscSelfInstalledNames,
  enterpriseEscSkillMorePlan,
  enterpriseEscSkillMoreRevealedText,
  enterpriseEscSkillMoreUninstalledText,
} from '../src/esc/esc-skill-more.js'
import {
  ENTERPRISE_SKILL_SELF_INSTALLED_ACTION_KEY,
  ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH,
  ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH,
  createEnterpriseLocalApi,
} from '../src/local-api.js'
import type { EnterpriseSelfInstalledSkill } from '../src/skill-api-decode.js'

/* ══════════════ 夹具与树工具 ══════════════ */

type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
const asElement = (node: unknown) => node as Element
function walk(node: unknown, out: Element[] = []): Element[] {
  if (Array.isArray(node)) {
    for (const each of node) walk(each, out)
    return out
  }
  if (node === null || node === undefined || node === false) return out
  if (typeof node !== 'object') return out
  const element = node as Element
  out.push(element)
  return walk(element.props['children'], out)
}
/** 按类名 token 找（官方 `Button` 会把调用方类名与自己的类拼在一起）。 */
function byClassToken(node: unknown, token: string): Element | undefined {
  return walk(node).find(each => {
    const raw = each.props['className']
    return typeof raw === 'string' && raw.split(' ').includes(token)
  })
}
/** S5a 两枚动作那枚「更多」的组件元素（`SkillMoreActions` 是组件，纯调用进不去它的输出）。 */
function moreActionOf(node: unknown): Element | undefined {
  return walk(node).find(each => each.type === SkillMoreActions)
}
/** 找唯一提示件（`EnterpriseErrorNotice`）。 */
function noticesIn(node: unknown): Element[] {
  return walk(node).filter(each => each.type === EnterpriseErrorNotice)
}

/** 剥注释：源码级反向锁的判据落在**代码**上（注释里写沿革、引类名是正当的记录）。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}
function readSrc(name: string, dir = '../src/esc/'): string {
  return stripComments(readFileSync(new URL(`${dir}${name}`, import.meta.url), 'utf8'))
}

/** 一条自装记录（`GET /skills/self-installed` 的一项；`names[]` 是**真正的落盘目录名**）。 */
function selfInstalled(overrides: Partial<EnterpriseSelfInstalledSkill> = {}): EnterpriseSelfInstalledSkill {
  return {
    skillId: 'meeting-notes',
    displayName: '会议纪要技能组',
    sha256: 'a'.repeat(64),
    names: ['dev-engineer-toolkit'],
    installedAt: '2026-10-05T08:00:00.000Z',
    ...overrides,
  }
}

const WIRED = { uninstall: true, reveal: true } as const

/**
 * 计划工厂的调用夹（默认：这一枚真的在本机自装清单里、两条端口都在场）。
 *
 * ★**本刀（技能页性能）**：纯投影的入参由"记录数组"改成"**已建好的名字集合**"
 *   （`enterpriseEscSelfInstalledNames` 的产物；调用方在 `useMemo` 里建一次，不再逐卡折 Set）。
 *   夹具一字未改：夹子照旧收 `{ selfInstalled: [记录…] }`，在**这里**折成集合 ——
 *   于是这一批用例的判据（只认 `names[]` / 端口在场 / 在途 / 失败）全部原样成立，
 *   变的只是"谁负责把记录折成集合"这一件事（从每卡一次变成每次状态变化一次）。
 */
function planOf(overrides: Record<string, unknown> = {}) {
  const { selfInstalled: records = [selfInstalled()], ...rest } = overrides as {
    selfInstalled?: readonly EnterpriseSelfInstalledSkill[]
  } & Record<string, unknown>
  return enterpriseEscSkillMorePlan({
    selfInstalledNames: enterpriseEscSelfInstalledNames(records),
    name: 'dev-engineer-toolkit',
    wired: WIRED,
    onUninstall: () => undefined,
    onReveal: () => undefined,
    ...rest,
  } as never)
}

/** 卡片入参（`ResourceItem` 只填判据真正用得到的那两格）。 */
const CARD_ITEM = { id: 'skill-4189', name: 'dev-engineer-toolkit', description: '一句话说明' }
/**
 * 卡片树的取证入口。
 *
 * ★**本刀（技能页性能）**：`EnterpriseEscCard` 现在是 `memo` 包出来的那一枚（对象，不是函数）
 *   —— 纯函数直调走它的**内层**那一枚 `EnterpriseEscCardView`（渲染语义逐字同一份）。
 *   断言一字未动：本文件核的仍是"这枚计划交给组件的是什么"。
 */
const card = (props: Record<string, unknown> = {}) => EnterpriseEscCardView({ item: CARD_ITEM, showUse: true, installed: true, ...props } as never)
/** memo 那一层仍在（本轮新增的那条结构锁，见下面「卡片记忆化」那一节）。 */
void EnterpriseEscCard

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' }, status: 200 })
}

/* ══════════════ ① 可用性判据：只认 `names[]` ══════════════ */

describe('S5a ①：可用性判据**只认**自装记录的 `names[]`（命中 ⇒ 可卸；按 displayName / skillId 猜必红）', () => {
  it('名字落在某条记录的 `names[]` 里 ⇒ 两行都在（卸载 + 打开文件夹）', () => {
    const names = enterpriseEscSelfInstalledNames([selfInstalled()])
    expect([...names]).toEqual(['dev-engineer-toolkit'])
    const plan = planOf()
    expect(plan, '命中 names[] 必须给出计划').toBeTruthy()
    expect(escCardMoreRows(plan).map(entry => entry.id)).toEqual(['open-folder', 'uninstall'])
    // 卸载那一枚是**危险档**且必须带齐确认文案（`escCardMoreRows` 的 fail-closed 闸）。
    expect(plan!.actions.uninstall?.confirm).toBeTruthy()
    expect(SKILL_MORE_ENTRIES.find(entry => entry.id === 'uninstall')?.danger).toBe(true)
  })

  it('只在 `displayName` / `skillId` 里出现（不在 `names[]` 里）⇒ **整枚不画**', () => {
    /**
     * ★这条用例就是"不许按 displayName 猜"的机械判据：记录的人类可读名与 `skillId` **都**对得上，
     *   唯独 `names[]` 里没有这个目录名 ⇒ 判据必须给 `undefined`（界面连那枚 `⋯` 都不画）。
     */
    const tricky = selfInstalled({
      skillId: 'dev-engineer-toolkit',
      displayName: 'dev-engineer-toolkit',
      names: ['some-other-directory'],
    })
    expect(enterpriseEscSelfInstalledNames([tricky]).has('dev-engineer-toolkit')).toBe(false)
    expect(planOf({ selfInstalled: [tricky] })).toBeUndefined()
    // 反向：`names[]` 里有、别的字段全不对 ⇒ 照样能卸（判据只认那一格）。
    const byName = selfInstalled({ skillId: 'meeting-notes', displayName: '会议纪要技能组', names: ['dev-engineer-toolkit'] })
    expect(planOf({ selfInstalled: [byName] })).toBeTruthy()
    // 清单为空（读不到 / 一枚都没装）⇒ 一枚动作都不给。
    expect(planOf({ selfInstalled: [] })).toBeUndefined()
  })

  it('端口在不在场：两枚都没接 / 只接一枚 ⇒ 各自如实（判据是端口，不是写死的 disabled）', () => {
    expect(planOf({ wired: { uninstall: false, reveal: false } })).toBeUndefined()
    const revealOnly = planOf({ wired: { uninstall: false, reveal: true } })
    expect(escCardMoreRows(revealOnly).map(entry => entry.id)).toEqual(['open-folder'])
    const uninstallOnly = planOf({ wired: { uninstall: true, reveal: false } })
    expect(escCardMoreRows(uninstallOnly).map(entry => entry.id)).toEqual(['uninstall'])
  })

  it('`escCardMoreRows`：缺哪一格就不画哪一行；**危险行没带确认文案 ⇒ 整行丢掉**（fail-closed）', () => {
    expect(escCardMoreRows(undefined)).toEqual([])
    expect(escCardMoreRows({ actions: {} })).toEqual([])
    // 非危险行：有动作就画。
    expect(escCardMoreRows({ actions: { 'open-folder': { onSelect: () => undefined } } }).map(each => each.id))
      .toEqual(['open-folder'])
    // ★危险行：`confirm` 缺席 ⇒ **不画**（"绝不出现一键删除"的结构保证）。
    expect(escCardMoreRows({ actions: { uninstall: { onSelect: () => undefined } } })).toEqual([])
    expect(escCardMoreRows({
      actions: { uninstall: { confirm: { title: 't', impact: 'i', confirmLabel: 'c' }, onSelect: () => undefined } },
    }).map(each => each.id)).toEqual(['uninstall'])
    /**
     * ★**本刀重新基线化（加强，不是放宽）**：用户冻结规格 §3 把菜单从"两行"改回**四行**
     *   （`去对话` / `编辑` / `打开文件夹` / `卸载`）。判据的形状一字未改（两条 `toEqual` 精确逐字），
     *   只是把行数与文案换成规格给的那四行；**新增**的是三条更强的：
     *     ① **`编辑` 那一行在场（数据里）** —— 规格要求它回到第二格；
     *     ② **它今天画不出来** —— 宿主那条路由没落地 ⇒ 端口缺席 ⇒ `escCardMoreRows` 里没有它
     *        （fail-closed：不画一枚点了没反应的菜单项、也不先画成禁用）；
     *     ③ **反向锁**：端口在场时它**必须**画出来（不然"fail-closed"就退化成"永远不画"）。
     */
    expect(SKILL_MORE_ENTRIES.map(entry => entry.id)).toEqual(['goto-chat', 'edit', 'open-folder', 'uninstall'])
    expect(SKILL_MORE_ENTRIES.map(entry => entry.label)).toEqual(['去对话', '编辑', '打开文件夹', '卸载'])
    expect(SKILL_MORE_ENTRIES.filter(entry => entry.danger === true).map(entry => entry.id)).toEqual(['uninstall'])
    // ① 默认那一档（`planOf()`：只接了自装那两枚端口）里**没有** `去对话`（那一格由「去试试」计划带下来）、
    //    也**没有** `编辑`（那条路由没落地）—— 画出来的恰好还是"打开文件夹 + 卸载"两行。
    expect(escCardMoreRows(planOf()).map(entry => entry.id)).toEqual(['open-folder', 'uninstall'])
    // ③ 反向锁：那条路由落地那天（写入口在场）`编辑` 就自己出来了（`escCardMoreRows` 的 fail-closed 闸
    //    只认"计划里有没有那一格"，不是"行数据里有没有它"）。
    const withEdit = planOf({ onEdit: () => undefined, wired: { ...WIRED, edit: true } })!
    expect(escCardMoreRows(withEdit).map(entry => entry.id)).toEqual(['edit', 'open-folder', 'uninstall'])
  })
})

/* ══════════════ ② 二次确认 + 影响句逐字 ══════════════ */

describe('S5a ②：破坏性那一枚**必须先过二次确认**（未确认 ⇒ 业务写入口一次都不发）', () => {
  it('分派危险行**只请求确认**：`onUninstall` 一次都没被调；确认之后才执行', () => {
    const onUninstall = vi.fn()
    const onReveal = vi.fn()
    const plan = planOf({ onUninstall, onReveal })!
    const requestConfirm = vi.fn()
    // ★判据：走的是 `'confirm'` 那条路，而业务写入口**一次都没被调**（这就是"未确认不发请求"）。
    expect(escCardMoreSelect('uninstall', plan.actions, requestConfirm)).toBe('confirm')
    expect(requestConfirm).toHaveBeenCalledTimes(1)
    expect(onUninstall).not.toHaveBeenCalled()
    // 确认之后（真实接线里是 `ConfirmAction.onConfirm`）才轮到写入口，且交出去的正是**目录名**。
    plan.actions.uninstall!.onSelect()
    expect(onUninstall).toHaveBeenCalledTimes(1)
    expect(onUninstall).toHaveBeenCalledWith('dev-engineer-toolkit')
  })

  it('危险行连确认入口都没有 ⇒ 分派什么都不做（绝不"顺手执行"）', () => {
    const onUninstall = vi.fn()
    const plan = planOf({ onUninstall })!
    expect(escCardMoreSelect('uninstall', plan.actions)).toBe('none')
    expect(onUninstall).not.toHaveBeenCalled()
  })

  it('非破坏那一枚点了就跑（无确认）；禁用那一枚分派什么都不做', () => {
    const onReveal = vi.fn()
    const requestConfirm = vi.fn()
    const plan = planOf({ onReveal })!
    expect(escCardMoreSelect('open-folder', plan.actions, requestConfirm)).toBe('run')
    expect(onReveal).toHaveBeenCalledTimes(1)
    expect(requestConfirm).not.toHaveBeenCalled()
    // 没有这一格（计划里缺）⇒ 什么都不做。
    expect(escCardMoreSelect('edit', plan.actions, requestConfirm)).toBe('none')
    // 在途 ⇒ 两行都禁用 ⇒ 连确认都不请求（防双击）。
    const busy = planOf({ pending: { name: 'dev-engineer-toolkit', action: 'uninstall' } })!
    expect(escCardMoreSelect('uninstall', busy.actions, requestConfirm)).toBe('none')
    expect(escCardMoreSelect('open-folder', busy.actions, requestConfirm)).toBe('none')
    expect(requestConfirm).not.toHaveBeenCalled()
  })

  it('影响句**逐字**：说清删什么、哪里不受影响；三句都随计划交给卡片那枚唯一次确认', () => {
    expect(ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT)
      .toBe('卸载会删掉本机这份技能目录（本机不再加载它）；平台与企业中心那边的东西不受影响，以后可以重新安装。')
    expect(ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT).toContain('删掉本机这份技能目录')
    expect(ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT).toContain('不受影响')
    expect(ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM_TITLE).toBe('卸载这枚本机自装技能')
    expect(ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM).toBe('确认卸载')
    expect(planOf()!.actions.uninstall!.confirm).toEqual({
      title: ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM_TITLE,
      impact: ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT,
      confirmLabel: ENTERPRISE_ESC_MORE_UNINSTALL_CONFIRM,
    })
    // ★唯一确认实现：`esc-more-menu.tsx` 用的是 `confirm-action.tsx` 那一枚（不新造第二套确认框）。
    const menu = readSrc('esc-more-menu.tsx')
    expect(menu).toContain("import { ConfirmAction } from '../confirm-action.js'")
    expect(menu).toContain('createElement(ConfirmAction, {')
    // 危险行的执行入口**只**挂在 `onConfirm` 上（菜单那一侧只请求确认）。
    expect(menu).toContain('onConfirm: () => { uninstall.onSelect() }')
    expect(menu).toContain('children: (openConfirm: () => void) => menu(openConfirm),')
    expect(menu).toContain("escCardMoreSelect(id, more.actions, requestConfirm)")
    // 反向锁：本文件不画第二枚 Modal / 不自己接 Escape 那一套（确认框只有一处实现）。
    expect(menu).not.toContain('Modal')
  })
})

/* ══════════════ ③ 在途 / 不乐观 / 成功信 Host / 失败唯一提示件 ══════════════ */

describe('S5a ③：在途两枚都禁用 + 行上可见那句；不乐观改本地；成功以 Host 回执为准；失败走唯一提示件', () => {
  it('在途那一枚：两行都禁用 + 卡片上那行可见文字；**别的技能**不受影响', () => {
    const busy = planOf({ pending: { name: 'dev-engineer-toolkit', action: 'uninstall' } })!
    expect(busy.actions.uninstall?.disabled).toBe(true)
    expect(busy.actions['open-folder']?.disabled).toBe(true)
    expect(busy.busyText).toBe(ENTERPRISE_ESC_MORE_UNINSTALLING)
    expect(busy.busyText).toBe('卸载中…')
    const revealing = planOf({ pending: { name: 'dev-engineer-toolkit', action: 'open-folder' } })!
    expect(revealing.busyText).toBe(ENTERPRISE_ESC_MORE_REVEALING)
    expect(revealing.busyText).toBe('正在打开所在文件夹…')
    // 在途的是**别的**技能 ⇒ 这一枚照旧可点、也不写那三个字。
    const other = planOf({ pending: { name: 'someone-else', action: 'uninstall' } })!
    expect(other.actions.uninstall?.disabled).toBe(false)
    expect(other.actions['open-folder']?.disabled).toBe(false)
    expect(other.busyText).toBeUndefined()
    // 卡片把那一句**行上可见**地写出来（`role="status"` + 稳定钩子），而不是只把行灰掉。
    const tree = card({ more: { actions: {}, busyText: busy.busyText } as EscCardMore })
    const line = byClassToken(tree, 'esc-card-lock')!
    expect(line.props['children']).toBe('卸载中…')
    expect(line.props['role']).toBe('status')
    expect(line.props['data-esc-skill-more-busy']).toBe('true')
  })

  it('失败只落在**失败的那一枚**上（稳定码 + 动作前缀），且卡片上那件唯一提示件**不画「重试」**', () => {
    const failed = planOf({ failure: { name: 'dev-engineer-toolkit', action: 'uninstall', code: 'ENT_SKILL_STATE_INVALID' } })!
    expect(failed.failure).toEqual({ code: 'ENT_SKILL_STATE_INVALID', prefix: ENTERPRISE_ESC_MORE_UNINSTALL_FAILED_PREFIX })
    expect(failed.failure!.prefix).toBe('卸载失败')
    const revealFailed = planOf({ failure: { name: 'dev-engineer-toolkit', action: 'open-folder', code: 'ENT_RESOURCE_NOT_FOUND' } })!
    expect(revealFailed.failure).toEqual({ code: 'ENT_RESOURCE_NOT_FOUND', prefix: ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX })
    expect(revealFailed.failure!.prefix).toBe('打开文件夹失败')
    // 失败属于**别的**技能 ⇒ 这一枚不说任何失败。
    expect(planOf({ failure: { name: 'someone-else', action: 'uninstall', code: 'X' } })!.failure).toBeUndefined()
    // 卡片上那件唯一提示件：人话 + 下一步 + 稳定码（前缀说清是哪一枚动作失败的）。
    const tree = card({ more: { actions: {}, failure: failed.failure } as EscCardMore })
    const notice = noticesIn(tree)
    expect(notice).toHaveLength(1)
    expect(notice[0]!.props['code']).toBe('ENT_SKILL_STATE_INVALID')
    expect(notice[0]!.props['prefix']).toBe('卸载失败')
    expect(notice[0]!.props['className']).toBe('esc-card-error')
    // ★**不画「重试」**：危险动作的每一次执行都必须重新过一次确认框，提示件里塞一枚重试正好绕过它。
    expect(walk(tree).some(each => each.props['children'] === '重试')).toBe(false)
    // 反向锁：本刀没有第二枚提示件实现（只有 `error-notice` 那一枚）。
    const escCard = readSrc('esc-card.tsx')
    expect(escCard).toContain("import { EnterpriseErrorNotice } from '../error-notice.js'")
    expect(escCard).toContain('createElement(EnterpriseErrorNotice, {')
    expect(escCard.match(/createElement\(EnterpriseErrorNotice, \{/g)).toHaveLength(1)
  })

  it('源码级三条纪律：在途闸一次一条、Host 回执覆盖清单、失败只记稳定码（且**没有**第二处 fetch）', () => {
    const agg = readSrc('esc-aggregation.tsx')
    // ① 一次一条：在途时**直接返回**（那一条请求一条都不发，也不排队）。
    expect(agg).toContain("if (morePending !== undefined) return false")
    /**
     * ② **不乐观改本地**：`setSelfInstalled(` 全文件恰好**三处**，每一处都有名有姓——
     *   ① `useState` 的初值（`[]`）；② 那一趟读（Host 的只读投影）；③ 卸载成功时**Host 回执**里那份
     *   `skills`。界面从不自己往清单里塞一枚、也不自己减去一枚（下一条把这一点钉死）。
     */
    expect(agg.match(/setSelfInstalled\(/g)).toHaveLength(3)
    expect(agg.match(/setSelfInstalled\(\[\]\)/g)).toHaveLength(1)
    expect(agg).toContain('setSelfInstalled(records)')
    expect(agg).toContain('setSelfInstalled(next.skills)')
    expect(agg).not.toContain('.concat(')
    expect(agg).not.toMatch(/setSelfInstalled\w*\(\s*[^)]*-\s*1/)
    expect(agg).not.toMatch(/setSelfInstalled\w*\(\s*previous\s*=/)
    // ③ 失败走既有稳定码族（唯一提示件由卡片渲染），且这一层没有 catch（不静默吞）。
    expect(agg).toContain('code: enterpriseLocalErrorCode(error)')
    expect(agg).not.toContain('catch (')
    // ④ 在途那一次不中止：只挂一枚超时信号。
    expect(agg).toContain('AbortSignal.timeout(ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS)')
    expect(ENTERPRISE_ESC_SKILL_MORE_TIMEOUT_MS).toBe(30_000)
    // ⑤ 两枚动作各自的写入口**都只有一处调用点**（`void uninstallSelfInstalledSkill(name, signal)`）。
    expect(agg.match(/void uninstallSelfInstalledSkill\(name, signal\)/g)).toHaveLength(1)
    expect(agg.match(/void revealSelfInstalledSkill\(name, signal\)/g)).toHaveLength(1)
    // ⑥ 自装清单读不到 ⇒ **说出来**（降级可见），而不是让员工猜"为什么没有管理入口"。
    expect(agg).toContain("'data-esc-skill-more-degraded': selfInstalledCode")
    expect(agg).not.toContain('setSelfInstalledCode(undefined) // 吞掉')
  })

  it('成功两句各说各的事（都出自唯一事实层，不在这里现编）', () => {
    expect(enterpriseEscSkillMoreUninstalledText('dev-engineer-toolkit')).toBe('已卸载「dev-engineer-toolkit」，本机这份技能目录已移除。')
    expect(enterpriseEscSkillMoreRevealedText('dev-engineer-toolkit')).toBe('已在系统文件管理器中打开「dev-engineer-toolkit」的所在文件夹。')
    const agg = readSrc('esc-aggregation.tsx')
    expect(agg).toContain('enterpriseEscSkillMoreUninstalledText(name)')
    expect(agg).toContain('enterpriseEscSkillMoreRevealedText(name)')
    expect(agg).toContain("'data-esc-skill-more-notice': 'true'")
  })
})

/* ══════════════ ④ 同一枚计数刷新 ══════════════ */

describe('S5a ④：成功后触发**既有那一枚**「已安装」计数刷新（不造第二个令牌）', () => {
  it('卸载成功：先以 Host 回执覆盖清单，再请计数重读（顺序即语义）；用的仍是聚合层那枚 token', () => {
    const agg = readSrc('esc-aggregation.tsx')
    const uninstall = agg.slice(agg.indexOf('const runUninstallSelfInstalled = useCallback'), agg.indexOf('const runRevealSelfInstalled = useCallback'))
    expect(uninstall).toContain('setSelfInstalled(next.skills)')
    expect(uninstall).toContain('onInstalledRefresh()')
    // ★顺序：先有真值（Host 那份投影）、再请重数。
    expect(uninstall.indexOf('setSelfInstalled(next.skills)')).toBeLessThan(uninstall.indexOf('onInstalledRefresh()'))
    // 反向锁：内容这一层没有自己的第二枚刷新令牌。
    expect(agg.match(/const \[installedRefreshToken, setInstalledRefreshToken\]/g)).toHaveLength(1)
    expect(agg.match(/const onInstalledRefresh = useCallback/g)).toHaveLength(1)
    // ★三处成功都请的是**同一枚**回调（口径 46 本地导入 / 口径 64 广场安装 / 本刀卸载）。
    expect(agg.match(/onInstalledRefresh\(\)/g)).toHaveLength(3)
  })
})

/* ══════════════ ⑤ 路由字面量 / 正文键集 / 界面零 fetch ══════════════ */

describe('S5a ⑤：两条 exact 路由 + 正文**关闭键集恰好** `{name}`；界面零 `fetch(`、零路径拼接', () => {
  it('两条动作真的打到那两条路由，正文恰好一枚键（不是 `skillId`、不是路径）', async () => {
    const signal = new AbortController().signal
    const record = selfInstalled()
    const fetcher = vi.fn(async () => ok({ skills: [record], removed: ['dev-engineer-toolkit'] }))
    const api = createEnterpriseLocalApi(fetcher)
    await expect(api.uninstallSelfInstalledSkill('dev-engineer-toolkit', signal)).resolves.toEqual({
      skills: [record], removed: ['dev-engineer-toolkit'],
    })
    expect(fetcher).toHaveBeenLastCalledWith(ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH, expect.objectContaining({
      method: 'POST', cache: 'no-store', signal,
    }))
    const [, uninstallInit] = fetcher.mock.calls[0]!
    expect(JSON.parse(String(uninstallInit?.body))).toEqual({ name: 'dev-engineer-toolkit' })
    expect(Object.keys(JSON.parse(String(uninstallInit?.body)))).toEqual(['name'])
    // 打开文件夹那条：同一条正文口径、另一条路由、响应只有一枚布尔。
    const revealFetcher = vi.fn(async () => ok({ revealed: true }))
    const revealApi = createEnterpriseLocalApi(revealFetcher)
    await expect(revealApi.revealSelfInstalledSkill('dev-engineer-toolkit', signal)).resolves.toEqual({ revealed: true })
    expect(revealFetcher).toHaveBeenLastCalledWith(ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH, expect.objectContaining({
      method: 'POST', cache: 'no-store', signal,
    }))
    expect(JSON.parse(String(revealFetcher.mock.calls[0]![1]?.body))).toEqual({ name: 'dev-engineer-toolkit' })
    // 契约常量逐字（两侧键名必须同名——改一处漏一处就是"每次都 400"）。
    expect(ENTERPRISE_SKILL_SELF_INSTALLED_ACTION_KEY).toBe('name')
    expect(ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH)
      .toBe('/enterprise/api/v1/local/skills/self-installed/uninstall')
    expect(ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH)
      .toBe('/enterprise/api/v1/local/skills/self-installed/reveal')
  })

  it('响应两格各自严格（缺键 / 非数组 / 非 kebab 名字一律判畸形），多出来的键**忽略**', async () => {
    const signal = new AbortController().signal
    const record = selfInstalled()
    const at = (data: unknown) => createEnterpriseLocalApi(vi.fn(async () => ok(data))).uninstallSelfInstalledSkill('x', signal)
    // 宿主哪天多带一枚日志字段，**不许**把一次成功卸载判成畸形（姿态：校验我要的两格、其余原样放过）。
    await expect(at({ skills: [record], removed: ['x'], alreadyMissing: ['x'] })).resolves.toEqual({
      skills: [record], removed: ['x'],
    })
    for (const bad of [
      { skills: [record] },                                                   // 缺 removed
      { removed: ['x'] },                                                     // 缺 skills
      { skills: [record], removed: 'x' },                                     // removed 不是数组
      { skills: [record], removed: ['Not-Kebab'] },                           // 非 kebab 目录名
      { skills: [record], removed: [''] },                                    // 空串
      { skills: 'nope', removed: [] },                                        // skills 形状不对
      { skills: [{ ...record, names: [] }], removed: [] },                    // 记录本身畸形（复用同一枚解码器）
    ]) {
      await expect(at(bad), JSON.stringify(bad)).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    /**
     * ★**反向锁**：解码路径**不依赖**任何第三格（那条"跳过"的语义已经收敛成拒，宿主把那个字段删了）。
     *   判据落在两条上：① 多带那一格**不影响**结果；② 源码里那个键名一个字都不出现。
     */
    expect(Object.keys(await at({ skills: [record], removed: ['x'], skippedSomehow: ['y'] })))
      .toEqual(['skills', 'removed'])
    const decodeSource = readSrc('skill-api-decode.ts', '../src/')
    expect(decodeSource).not.toContain("row['kept']")
    expect(decodeSource).not.toMatch(/readonly kept/)
    const srcDir = new URL('../src/', import.meta.url)
    for (const name of readdirSync(srcDir).filter(name => /\.tsx?$/.test(name))) {
      expect(readSrc(name, '../src/'), name).not.toMatch(/\bkept\b/)
    }
    // `reveal` 那条更窄：单键封闭 + 必须是 true。
    const revealAt = (data: unknown) => createEnterpriseLocalApi(vi.fn(async () => ok(data))).revealSelfInstalledSkill('x', signal)
    for (const bad of [{ revealed: false }, { revealed: true, path: '/Users/x' }, {}]) {
      await expect(revealAt(bad), JSON.stringify(bad)).rejects.toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

  it('路由字面量各**恰好一处**（`local-api.ts`）；界面两个新文件零 `fetch(` / 零路径拼接', () => {
    const srcDir = new URL('../src/', import.meta.url)
    const files = readdirSync(srcDir).filter(name => /\.tsx?$/.test(name))
    const quoted = (literal: string) => files
      .map(name => ({ name, count: (readSrc(name, '../src/').match(new RegExp(literal, 'g')) ?? []).length }))
      .filter(each => each.count > 0)
    expect(quoted("'/skills/self-installed/uninstall'")).toEqual([{ name: 'local-api.ts', count: 1 }])
    expect(quoted("'/skills/self-installed/reveal'")).toEqual([{ name: 'local-api.ts', count: 1 }])
    for (const name of ['esc-skill-more.ts', 'esc-more-menu.tsx']) {
      const code = readSrc(name)
      expect(code, name).not.toContain('fetch(')
      expect(code, name).not.toContain('requestJson')
      expect(code, name).not.toContain('local-api')
      expect(code, name).not.toContain('/enterprise/api/v1/local')
      // 也不自己拼路径 / 不认宿主路径（正文永远只有一枚目录名）。
      expect(code, name).not.toContain('join(')
      expect(code, name).not.toContain('decodeEnterprise')
    }
    // 全 `src/esc` 子树里**一个** `fetch(` 都没有（本页所有取数都经注入的端口）。
    for (const name of readdirSync(new URL('../src/esc/', import.meta.url))) {
      if (!/\.tsx?$/.test(name)) continue
      expect(readSrc(name), name).not.toContain('fetch(')
    }
    // 那两枚动作的**唯一调用点**是聚合层（卡片只给"点它干什么"，不认识路由）。
    expect(readSrc('esc-card.tsx')).not.toContain('uninstallSelfInstalledSkill')
    expect(readSrc('esc-more-menu.tsx')).not.toContain('uninstallSelfInstalledSkill')
    expect(readSrc('client.tsx', '../src/'))
      .toContain('uninstallSelfInstalledSkill: (name, signal) => escSkillApi.uninstallSelfInstalledSkill(name, signal),')
  })
})

/* ══════════════ ⑥ 非自装 ⇒ 卸载入口不画 ══════════════ */

describe('S5a ⑥：非自装技能（中心装下来的 / 官方内置的）⇒ 「更多」里卸载**不画**（不是画成禁用）', () => {
  it('拿不到计划 ⇒ 卡片把那枚 `⋯` 交给组件的是 `more = undefined`（组件据此整枚不画）', () => {
    const tree = card()
    const more = moreActionOf(tree)
    expect(more, '已装那一档仍挂着那枚「更多」组件').toBeTruthy()
    expect(more!.props['more']).toBeUndefined()
    // ★"不画"的结构判据：行投影对 `undefined` 计划给空数组 ⇒ 组件返回 null（源码级那一道闸）。
    expect(escCardMoreRows(undefined)).toEqual([])
    const menu = readSrc('esc-more-menu.tsx')
    expect(menu).toContain('if (more === undefined || rows.length === 0) return null')
    // 反向锁：本刀**不**给"画但禁用"留后门（没有把非自装画成两行灰度的地方）。
    expect(menu).not.toContain('actionNotPorted')
  })

  it('拿到计划 ⇒ 计划原样交给那一枚组件（同一枚技能在两处只可能有一个答案）', () => {
    const plan = planOf()!
    const tree = card({ more: plan })
    expect(moreActionOf(tree)!.props['more']).toEqual(plan)
    // ★两处共用**同一个**工厂：聚合层把它同时交给广场网格与精选行（源码级反锁）。
    const agg = readSrc('esc-aggregation.tsx')
    expect(agg.match(/const moreOf = useCallback/g)).toHaveLength(1)
    /**
     * ★**本刀重新基线化（加强，不是放宽）**：那一处的实参由 `(item.name)` 变成
     *   `(item.name, tryNow)` —— 「去对话」那一行要的**整件事实**就是**同一枚**「去试试」计划
     *   （按不按得动看它的 `disabled`、按下去干什么看它的 `onTry`）。判据形状一字未改（仍是精确
     *   `toContain`），只是把那一格的实参逐字锁成"**同一枚计划**也一起交下去"——比旧断言更强：
     *   旧的看不见「去对话」与「去试试」是不是同一份实现，这一条看得见。
     */
    expect(agg).toContain('? moreOf(item.name, tryNow)')
    expect(agg).toContain('...(resourceType === \'skill\' ? { moreOf } : {}),')
    // 专家/连接器两档不给这枚下拉（`showUse` 那一档才有）。
    expect(agg).toContain("resourceType === 'skill' && source === 'system'")
  })
})

/* ══════════════ ⑦ reveal 失败如实上屏 ══════════════ */

describe('S5a ⑦：`reveal` 失败如实上屏（非破坏性、无确认，但在途禁用 + 失败可见）', () => {
  it('目录不在了（404）：计划带着稳定码 + 「打开文件夹失败」前缀，卡片上出唯一提示件', () => {
    const plan = planOf({ failure: { name: 'dev-engineer-toolkit', action: 'open-folder', code: 'ENT_RESOURCE_NOT_FOUND' } })!
    expect(plan.failure).toEqual({ code: 'ENT_RESOURCE_NOT_FOUND', prefix: '打开文件夹失败' })
    // 失败**不改**可用性：那一行照旧在（员工可以直接再点一次）。
    expect(escCardMoreRows(plan).map(entry => entry.id)).toEqual(['open-folder', 'uninstall'])
    const tree = card({ more: plan })
    const notice = noticesIn(tree)
    expect(notice).toHaveLength(1)
    expect(notice[0]!.props['code']).toBe('ENT_RESOURCE_NOT_FOUND')
    expect(notice[0]!.props['prefix']).toBe(ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX)
    // 在途那一次也如实说（异步动作不许静默）。
    expect(planOf({ pending: { name: 'dev-engineer-toolkit', action: 'open-folder' } })!.busyText).toBe('正在打开所在文件夹…')
  })
})
