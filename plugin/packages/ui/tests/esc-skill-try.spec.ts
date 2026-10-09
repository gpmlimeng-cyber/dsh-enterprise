/**
 * [INPUT]: 依赖 `esc-skill-try.ts`（那枚「去试试」的唯一事实层：草稿构造器 / 可用性投影 / 文案）、
 *   `esc-card.tsx`（卡片本体，纯函数直调）、`error-notice.tsx` / `error-messages.ts`（唯一提示件与唯一码表）、
 *   `preset-launch.ts`（那条"跳新会话 + 写草稿、**不发送**"的**唯一实现**，用结构 double 取证）、
 *   `client.tsx` / `esc-aggregation.tsx` / `esc-catalog-list.tsx` / `esc-featured.tsx` 的源码文本
 * [OUTPUT]: 锁定 **S5b**（技能卡那枚「去试试」真的能用）的界面半边七条：
 *   ① 可用性**四态**（已装 + 有文案 + 端口在场 ⇒ 可点；未装 / 无文案 / 端口缺席 ⇒ 禁用 + **行上可见**原因 +
 *      **没有 onClick**）；② 草稿文案逐字（含技能名、不含路径 / URL / 内部键名；空名与非法名 ⇒ 没有文案）；
 *   ③ **只填不发送**（端口只被调 `setDraft` 一次、参数逐字；这条链上一个发送 / 提交类调用都没有）；
 *   ④ 失败 ⇒ 唯一提示组件 + 稳定码（`retryable` 与它那句下一步一致，且与三枚既有码的下一步都不同）；
 *   ⑤ 新码在唯一码表里（`tests/error-messages.spec.ts` 那侧另有 `REQUIRED_CODES` 一条）；
 *   ⑥ **复用证据**（`openWorkspace` / `setDraft` 全仓唯一调用点 = `preset-launch.ts`；那份文件逐字节零改动）；
 *   ⑦ 卡片接线与三处消费点（计划驱动、在途上屏、失败落这一枚卡片）
 * [POS]: S5b 界面半边的机械门禁——把"这枚按钮能不能点、点下去的句子是什么、填的是谁、失败说什么"钉在
 *   **纯函数、结构 double 与源码**三层（本仓 vitest 无 DOM，故不碰真渲染器；真机由 Lead 复量）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * ★官方原语在本仓**不是**运行期依赖（发行时用宿主共享实例），而 `devDependency` 那份在**导入期**
 * 就会 `import 'clsx'`（那个包不在本仓依赖里）⇒ 直接 import 呈现层会在"收集测试"阶段就炸。
 * 与 `tests/esc-skill-more.spec.ts` 同一条手法：整模块替身化（本文件要测的是我们自己的**投影与结构**）。
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
import {
  ENTERPRISE_ERROR_CODES,
  ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE,
  enterpriseErrorAction,
  enterpriseErrorMessage,
  enterpriseErrorPresentation,
  enterpriseErrorRetryable,
} from '../src/error-messages.js'
import { EnterpriseEscCard } from '../src/esc/esc-card.js'
import { ENTERPRISE_ESC_COPY } from '../src/esc/esc-copy.js'
import {
  ENTERPRISE_ESC_SKILL_TRY_BUSY,
  ENTERPRISE_ESC_SKILL_TRY_FAILED_PREFIX,
  ENTERPRISE_ESC_SKILL_TRY_NAME_MAX,
  ENTERPRISE_ESC_SKILL_TRY_NOT_INSTALLED,
  ENTERPRISE_ESC_SKILL_TRY_NOT_WIRED,
  ENTERPRISE_ESC_SKILL_TRY_NO_DRAFT,
  ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE,
  enterpriseEscSkillTryDraft,
  enterpriseEscSkillTryFilledText,
  enterpriseEscSkillTryPlan,
} from '../src/esc/esc-skill-try.js'
import { createEnterprisePresetLauncher, enterprisePresetSessionPortsFrom } from '../src/preset-launch.js'

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

/** 找唯一提示件（`EnterpriseErrorNotice`）。 */
function noticesIn(node: unknown): Element[] {
  return walk(node).filter(each => each.type === EnterpriseErrorNotice)
}

/**
 * 剥注释：源码级判据落在**代码**上（注释里引述官方签名 / 沿革是正当的记录 —— 少了这一刀，
 * `esc-types.ts` 与 `esc-aggregation.tsx` 的 JSDoc 会被误判成"第二个调用点"）。
 */
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

/** 读一份 `src/esc/` 下的源码（剥注释）。 */
function readEscSrc(name: string): string {
  return stripComments(readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8'))
}

/** 读一份 `src/` 下的源码（剥注释）。 */
function readSrc(name: string): string {
  return stripComments(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'))
}

/** `src` 子树里每一份**实现**源码（剥注释；`.spec.ts` 不在 `src` 下，故不需要排除）。 */
function allSrcFiles(): readonly { readonly name: string; readonly code: string }[] {
  const root = new URL('../src/', import.meta.url)
  const out: { name: string; code: string }[] = []
  const visit = (dir: URL, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      out.push({ name: `${prefix}${entry.name}`, code: stripComments(readFileSync(new URL(entry.name, dir), 'utf8')) })
    }
  }
  visit(root, '')
  return out
}

/** 卡片入参（`ResourceItem` 只填判据真正用得到的那两格）。 */
const CARD_ITEM = { id: 'skill-4189', name: 'dev-engineer-toolkit', description: '一句话说明' }
const card = (props: Record<string, unknown> = {}) => EnterpriseEscCard({ item: CARD_ITEM, showUse: true, installed: true, ...props } as never)

const NAME = 'dev-engineer-toolkit'
/** 计划工厂的调用夹（默认：这一枚真的已装、端口也在场）。 */
function planOf(overrides: Record<string, unknown> = {}) {
  return enterpriseEscSkillTryPlan({
    name: NAME,
    installed: true,
    wired: true,
    onTry: () => undefined,
    ...overrides,
  } as never)
}

/* ══════════════ ① 可用性四态 ══════════════ */

describe('S5b ①：可用性四态（唯一投影 `enterpriseEscSkillTryPlan`）', () => {
  it('已装 + 有文案 + 端口在场 ⇒ 可点：真写入口 + 计划原样带上那句**拼好的**指令', () => {
    const onTry = vi.fn()
    const plan = planOf({ onTry })
    expect(plan.disabled).toBe(false)
    expect(plan.text).toBe(ENTERPRISE_ESC_COPY.tryNow)
    expect(plan.text).toBe('去试试')
    // 可点那一档：悬浮说明说清"点它会做什么"，且**明说**不发送（我们只填）。
    expect(plan.title).toBe(ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE)
    expect(plan.title).toContain('不发送')
    expect(plan.ariaLabel).toBe(`${ENTERPRISE_ESC_COPY.tryNow}：${NAME}`)
    // 没有原因、没有在途交代、没有失败。
    expect(plan.reason).toBeUndefined()
    expect(plan.busyText).toBeUndefined()
    expect(plan.failure).toBeUndefined()
    // ★写入口**在**，且它交出去的是**那一句拼好的指令**（不是名字、不是路径、不是包 id）。
    expect(typeof plan.onTry).toBe('function')
    plan.onTry!()
    expect(onTry).toHaveBeenCalledTimes(1)
    expect(onTry).toHaveBeenCalledWith(enterpriseEscSkillTryDraft(NAME))
  })

  it('未装 / 无文案 / 端口缺席 ⇒ 三档各自禁用 + 各自一句可见原因 + 都没有 onClick', () => {
    const cases = [
      { name: NAME, installed: false, wired: true, reason: ENTERPRISE_ESC_SKILL_TRY_NOT_INSTALLED },
      { name: '', installed: true, wired: true, reason: ENTERPRISE_ESC_SKILL_TRY_NO_DRAFT },
      { name: NAME, installed: true, wired: false, reason: ENTERPRISE_ESC_SKILL_TRY_NOT_WIRED },
    ] as const
    for (const one of cases) {
      const plan = planOf({ name: one.name, installed: one.installed, wired: one.wired })
      expect(plan.disabled, one.reason).toBe(true)
      expect(plan.reason, one.reason).toBe(one.reason)
      expect(String(plan.reason).length, one.reason).toBeGreaterThan(0)
      // 不可点那一档**连写入口都没有**（不是"给一枚不会被调的回调"）。
      expect(plan.onTry, one.reason).toBeUndefined()
      // 悬浮说明与可见原因**同源**（两处不可能一个说 A、一个说 B）。
      expect(plan.title, one.reason).toBe(one.reason)
      // 没有文案那一档连无障碍名都不回显可疑字符串。
      if (one.name === '') expect(plan.ariaLabel).toBe(ENTERPRISE_ESC_COPY.tryNow)
    }
    // 三句原因两两不同（"没装 / 名字不可用 / 这条路没接上"是三件不同的事实，补救动作也不同）。
    expect(new Set([ENTERPRISE_ESC_SKILL_TRY_NOT_INSTALLED, ENTERPRISE_ESC_SKILL_TRY_NO_DRAFT, ENTERPRISE_ESC_SKILL_TRY_NOT_WIRED]).size).toBe(3)
  })

  it('名字非法（空 / 纯空白 / 路径 / URL / 空白字符）一律按「无文案」那一档 fail-closed', () => {
    for (const bad of ['', '   ', '../etc/passwd', 'a/b', 'a\\b', 'http://x', 'a b', 'a?b=1', "a'b", 'a'.repeat(ENTERPRISE_ESC_SKILL_TRY_NAME_MAX + 1)]) {
      const plan = planOf({ name: bad })
      expect(plan.disabled, bad).toBe(true)
      expect(plan.reason, bad).toBe(ENTERPRISE_ESC_SKILL_TRY_NO_DRAFT)
      expect(plan.onTry, bad).toBeUndefined()
    }
  })

  it('在途 ⇒ 那一枚禁用 + 一句可见交代（与那三档原因互斥：同一时刻只说一件事）', () => {
    const plan = planOf({ pending: true })
    expect(plan.disabled).toBe(true)
    expect(plan.busyText).toBe(ENTERPRISE_ESC_SKILL_TRY_BUSY)
    expect(plan.title).toBe(ENTERPRISE_ESC_SKILL_TRY_BUSY)
    // 在途那一档不给 reason（按钮上那句话已经说清它在做什么，再来一句就是重复）。
    expect(plan.reason).toBeUndefined()
    expect(plan.onTry).toBeUndefined()
    expect(ENTERPRISE_ESC_SKILL_TRY_BUSY).not.toBe(ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE)
  })
})

/* ══════════════ ② 草稿文案逐字 ══════════════ */

describe('S5b ②：草稿文案（唯一构造器 `enterpriseEscSkillTryDraft`）', () => {
  it('逐字含技能名；不含路径 / URL / 内部键名', () => {
    const draft = enterpriseEscSkillTryDraft(NAME)!
    expect(draft).toBe('请用「dev-engineer-toolkit」这枚技能帮我干活：先告诉我它能做什么、需要我准备什么。')
    expect(draft).toContain(NAME)
    // ★三个"不许出现"各有具体形状：路径分隔 / 协议 / 内部坐标键名（后者的值根本不是名字）。
    for (const forbidden of ['/', '\\', 'http', 'www.', '~', ':', 'packageId', 'targetId', 'skillId', 'versionId', 'sha256', 'enterprise/api']) {
      expect(draft, forbidden).not.toContain(forbidden)
    }
    // 名字是**卡片自己那一把键**（两侧 trim 后逐字）：前后有空白的名字照样只写中间那段。
    expect(enterpriseEscSkillTryDraft(`  ${NAME}  `)).toBe(draft)
  })

  it('空名 / 非法名 ⇒ 没有文案（fail-closed）；合法形状的边界照收', () => {
    for (const bad of ['', '   ', '\t', '../etc/passwd', 'a/b', 'a b', 'http://x', "a'b", '<b>', 'a'.repeat(ENTERPRISE_ESC_SKILL_TRY_NAME_MAX + 1)]) {
      expect(enterpriseEscSkillTryDraft(bad), bad).toBeUndefined()
    }
    // 点号 / 下划线 / 大小写这些**平台上真有**的形状不误伤（宁可少给一句草稿，也不能把真名判死）。
    for (const good of ['dev-engineer-toolkit', 'code_review', 'DeepResearch', 'skillhub.cn', 'a']) {
      expect(enterpriseEscSkillTryDraft(good), good).toContain(good)
    }
  })

  it('成功交代如实：只填不发送（绝不写成"已发送 / 已开始"）', () => {
    const filled = enterpriseEscSkillTryFilledText(NAME)
    expect(filled).toBe(`已在新会话的输入框里填好「${NAME}」这句指令，按发送即可。`)
    expect(filled).toContain('按发送即可')
    for (const lie of ['已发送', '发送成功', '已提交', '已开始', '已执行']) {
      expect(filled, lie).not.toContain(lie)
    }
  })
})

/* ══════════════ ③ 只填不发送 ══════════════ */

describe('S5b ③：只填不发送（端口只调 `setDraft` 一次、参数逐字；链上零发送出口）', () => {
  /**
   * 与 `client.tsx` 那一格**同形**的接线：同一个 `createEnterprisePresetLauncher` 包成
   * `fillSkillTryDraft(draft) => Promise<boolean>`。官方服务用结构 double（本仓测不到真服务）。
   */
  function services() {
    const drafts: { readonly sessionId: string; readonly text: string }[] = []
    const submit = vi.fn()
    const base = {
      uiWorkspace: {
        openWorkspace: async (workspaceId: string, beforeOpen?: (sessionId: string) => void) => {
          beforeOpen?.(`new-${workspaceId}`)
        },
      },
      workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws-1', createdAt: '2026-01-01T00:00:00Z', sessionIds: [] }] }) } },
      sessions: { list: { getSnapshot: () => ({ byId: {} }) } },
      conversation: {
        input: {
          shell: (sessionId: string) => ({
            actions: {
              setDraft: (text: string) => { drafts.push({ sessionId, text }) },
              // 官方那一份 `InputActions` 里也有 `submit`；这条链**绝不许**调它。
              submit,
            },
          }),
        },
      },
    }
    return { base, drafts, submit }
  }

  it('技能卡那枚写入口只走官方 `setDraft`：恰好一次、参数**逐字**是我们拼的那句', async () => {
    const { base, drafts, submit } = services()
    const fillSkillTryDraft = (text: string) => createEnterprisePresetLauncher(() => enterprisePresetSessionPortsFrom(base))(text)
    const draft = enterpriseEscSkillTryDraft(NAME)!
    await expect(fillSkillTryDraft(draft)).resolves.toBe(true)
    expect(drafts).toEqual([{ sessionId: 'new-ws-1', text: draft }])
    expect(submit).not.toHaveBeenCalled()
    // 「只填」的机器判据：端口这一趟**只**动了 setDraft 这一枚（写入数组里恰好一条，且是那句原文）。
    expect(drafts).toHaveLength(1)
    expect(drafts[0]!.text).toBe(draft)
  })

  it('源码级：这条链上一个发送 / 提交类调用都没有（判据落在剥注释后的代码上）', () => {
    // 五份文件构成本刀的整条链：事实层 / 卡片 / 三个消费点 + 组合根与端口类型。
    const chain = ['esc/esc-skill-try.ts', 'esc/esc-card.tsx', 'esc/esc-aggregation.tsx', 'esc/esc-catalog-list.tsx', 'esc/esc-featured.tsx', 'esc/esc-types.ts', 'client.tsx', 'preset-launch.ts']
    for (const name of chain) {
      const code = name === 'client.tsx' || name === 'preset-launch.ts' ? readSrc(name) : readEscSrc(name.replace('esc/', ''))
      for (const forbidden of ['sendMessage(', '.send(', 'submit(', 'pressEnter(', 'dispatchEvent(', '.submit', 'onSubmit']) {
        expect(code, `${name} 不该出现 ${forbidden}`).not.toContain(forbidden)
      }
      // 反向锁：这条链上没有任何"第二处开会话/写草稿"的实现面（那两枚官方写入口只能经 `preset-launch.ts`）。
      // ★`preset-launch.ts` 自己**就是**那处实现，故这条只对其余七份文件成立（"取/调官方写入口"是它的本职）。
      if (name !== 'preset-launch.ts') {
        expect(code, `${name} 不该自己取官方写入口`).not.toContain('actions.setDraft')
        expect(code, `${name} 不该自己取官方写入口`).not.toContain("['setDraft']")
      }
    }
    // 事实层不认识路由 / fetch / 官方包（它只拼一句话、只判能不能点）；卡片层额外只画、不认识数据面。
    for (const name of ['esc-skill-try.ts', 'esc-card.tsx']) {
      const code = readEscSrc(name)
      for (const forbidden of ['fetch(', 'requestJson', 'local-api', '/enterprise/api', 'join(']) {
        expect(code, `${name} 不该出现 ${forbidden}`).not.toContain(forbidden)
      }
    }
    // ★事实层**一个官方包都不许 import**（它只吃纯数据；官方那两件服务只经端口注入）。
    expect(readEscSrc('esc-skill-try.ts')).not.toContain('@deepseek-ai')
  })
})

/* ══════════════ ④ 失败：唯一提示件 + 稳定码 ══════════════ */

describe('S5b ④：失败 ⇒ 唯一提示组件 + 稳定码（`retryable` 与它那句下一步一致）', () => {
  it('码在唯一表里；人话 + 下一步 + 终态；且与三枚既有码的下一步都**不同**（为什么必须新开一枚）', () => {
    const code = ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE
    expect(code).toBe('ENT_SKILL_TRY_LAUNCH_FAILED')
    expect(ENTERPRISE_ERROR_CODES).toContain(code)
    const view = enterpriseErrorPresentation(code)
    expect(view.known).toBe(true)
    expect(view.message.length).toBeGreaterThan(0)
    expect(view.action.length).toBeGreaterThan(0)
    expect(view.message).not.toContain('ENT_')
    expect(view.action).not.toContain('ENT_')
    // ★终态：不给必然失败的重试画饼（同一条官方链路、同一份结构面）。
    expect(view.retryable).toBe(false)
    expect(enterpriseErrorRetryable(code)).toBe(false)
    // ★`retryable` 与下一步**一致**：下一步不是"再试一次"，而是一件**一定能做**的事（自己新建会话）。
    expect(view.action).not.toContain('重试')
    expect(view.action).toContain('新建一个会话')
    // ★与三枚**看起来像**的既有码逐句不同（它们的下一步在本格上都是说假话：
    //   配方导入指令 / 「复制这句指令」那枚按钮 / 「把这句话粘贴进去」——这一格都没有）。
    for (const sibling of ['ENT_PRESET_LAUNCH_FAILED', 'ENT_SKILL_CREATE_LAUNCH_FAILED', 'ENT_ESC_DRAFT_UNAVAILABLE']) {
      expect(enterpriseErrorAction(code), sibling).not.toBe(enterpriseErrorAction(sibling))
      expect(enterpriseErrorMessage(code), sibling).not.toBe(enterpriseErrorMessage(sibling))
    }
    // 反证：那三枚里有提到"复制 / 粘贴"的，本码一句都不提（界面上没有那种按钮）。
    expect(enterpriseErrorAction(code)).not.toContain('复制')
    expect(enterpriseErrorAction(code)).not.toContain('粘贴')
  })

  it('失败落回**这一枚卡片**：唯一提示件 + 动作前缀；两枚动作同时有失败时只出一枚提示件', () => {
    const failed = planOf({ failure: { code: ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE } })
    expect(failed.failure).toEqual({ code: ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE, prefix: ENTERPRISE_ESC_SKILL_TRY_FAILED_PREFIX })
    expect(failed.failure!.prefix).toBe('去试试失败')
    const tree = card({ tryNow: failed })
    const notice = noticesIn(tree)
    expect(notice).toHaveLength(1)
    expect(notice[0]!.props['code']).toBe(ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE)
    expect(notice[0]!.props['prefix']).toBe(ENTERPRISE_ESC_SKILL_TRY_FAILED_PREFIX)
    expect(notice[0]!.props['className']).toBe('esc-card-error')
    // 失败**不翻可用性**：端口还在，员工可以直接再点一次（重试的入口就是那枚按钮本身）。
    expect(failed.disabled).toBe(false)
    // ★一张卡一个失败位：两枚动作同时有失败时仍然**恰好一枚**提示件（不是两句话并排）。
    const both = card({ tryNow: failed, more: { actions: {}, failure: { code: 'ENT_SKILL_STATE_INVALID', prefix: '卸载失败' } } })
    expect(noticesIn(both)).toHaveLength(1)
  })

  it('源码级：失败在两个消费点都被**真的记下来**（各两处，且都带同一枚稳定码常量）', () => {
    for (const name of ['esc-aggregation.tsx', 'esc-catalog-list.tsx']) {
      const code = readEscSrc(name)
      // 记下来（不是空 catch / 只 console.warn）：then 的 else 与 reject 那支各一处。
      expect(code, name).toContain('setTryError({ name, code: ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE })')
      expect(code.match(/setTryError\(\{ name, code: ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE \}\)/g) ?? [], name).toHaveLength(2)
      // 码值只在唯一码表里声明一次，界面侧只**引用**常量（不写第二份字面量）。
      expect(code, name).not.toContain("'ENT_SKILL_TRY_LAUNCH_FAILED'")
      expect(code, name).not.toContain('console.warn')
    }
  })
})

/* ══════════════ ⑤ 卡片接线 ══════════════ */

describe('S5b ⑤：卡片接线（计划驱动，绝不是死按钮）', () => {
  it('可点 ⇒ 那枚按钮带真 onClick；不可点 ⇒ 禁用 + 行上可见原因 + **没有** onClick', () => {
    const onTry = vi.fn()
    const live = planOf({ onTry })
    const liveButton = byClassToken(card({ tryNow: live }), 'esc-try-now')!
    expect(liveButton.props['children']).toBe(ENTERPRISE_ESC_COPY.tryNow)
    expect(liveButton.props['disabled']).toBe(false)
    expect(liveButton.props['title']).toBe(ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE)
    expect(liveButton.props['aria-label']).toBe(`${ENTERPRISE_ESC_COPY.tryNow}：${NAME}`)
    expect(typeof liveButton.props['onClick']).toBe('function')
    ;(liveButton.props['onClick'] as () => void)()
    expect(onTry).toHaveBeenCalledTimes(1)

    // 三档不可点：按钮禁用、**连 `onClick` 属性都没有**，且原因**行上可见**（`role="status"`）。
    for (const one of [
      { name: NAME, installed: false, wired: true, reason: ENTERPRISE_ESC_SKILL_TRY_NOT_INSTALLED },
      { name: '', installed: true, wired: true, reason: ENTERPRISE_ESC_SKILL_TRY_NO_DRAFT },
      { name: NAME, installed: true, wired: false, reason: ENTERPRISE_ESC_SKILL_TRY_NOT_WIRED },
    ] as const) {
      const tree = card({ tryNow: planOf({ name: one.name, installed: one.installed, wired: one.wired }) })
      const button = byClassToken(tree, 'esc-try-now')!
      expect(button.props['disabled'], one.reason).toBe(true)
      expect(button.props['onClick'], one.reason).toBeUndefined()
      const lock = byClassToken(tree, 'esc-skill-try-lock') ?? walk(tree).find(each => each.props['data-esc-skill-try-lock'] === 'true')
      expect(lock, one.reason).toBeTruthy()
      expect(lock!.props['role']).toBe('status')
      expect(lock!.props['className']).toBe('esc-card-lock')
      expect(lock!.props['children']).toBe(one.reason)
    }
  })

  it('在途那句**行上可见**（带稳定钩子）；成功交代如实', () => {
    const tree = card({ tryNow: planOf({ pending: true }) })
    const busy = walk(tree).find(each => each.props['data-esc-skill-try-busy'] === 'true')
    expect(busy).toBeTruthy()
    expect(busy!.props['role']).toBe('status')
    expect(busy!.props['className']).toBe('esc-card-lock')
    expect(busy!.props['children']).toBe(ENTERPRISE_ESC_SKILL_TRY_BUSY)
    // 在途那一档按钮禁用且**没有** onClick；同时**不画**那句原因（两句话互斥）。
    const button = byClassToken(tree, 'esc-try-now')!
    expect(button.props['disabled']).toBe(true)
    expect(button.props['onClick']).toBeUndefined()
    expect(walk(tree).some(each => each.props['data-esc-skill-try-lock'] === 'true')).toBe(false)
  })

  it('源码级：全文件仍**恰好一处**唯一提示件；卡片不认识任何数据形状（没有第二个构造点）', () => {
    const cardSource = readEscSrc('esc-card.tsx')
    expect(cardSource.match(/createElement\(EnterpriseErrorNotice, \{/g) ?? []).toHaveLength(1)
    // 卡片只消费**形状**（`EscCardTryNow`），不认识"技能名能不能拼出指令""端口接没接上"这些概念。
    for (const forbidden of ['enterpriseEscSkillTryPlan', 'enterpriseEscSkillTryDraft', 'fillSkillTryDraft', 'preset-launch']) {
      expect(cardSource, forbidden).not.toContain(forbidden)
    }
    // "没有写入口就不挂 onClick"必须是**条件展开**（不是 `onClick: undefined` 那种挂上去的写法）。
    expect(cardSource).toContain('...(tryNow?.onTry === undefined ? {} : { onClick: tryNow.onTry }),')
    // 缺席计划时逐字回到改前那一态（另有 `esc.spec.ts` / `esc-catalog.spec.ts` 两条既有断言锁着）。
    expect(cardSource).toContain('disabled: tryNow === undefined ? true : tryNow.disabled,')
    expect(cardSource).toContain('title: tryNow === undefined ? notPorted : tryNow.title,')
  })
})

/* ══════════════ ⑥ 复用证据 ══════════════ */

describe('S5b ⑥：复用证据（那两枚官方写入口全仓只有 `preset-launch.ts` 一处 + 那份文件零改动）', () => {
  it('全 `src` 里真的取 / 调官方 `openWorkspace` 与 `setDraft` 的实现文件**恰好**是 preset-launch.ts', () => {
    const owners = allSrcFiles()
      .filter(file => /\bopenWorkspace\b/.test(file.code) || /\bsetDraft\s*\(/.test(file.code) || /\bsetDraft\b/.test(file.code))
      .map(file => file.name)
      .sort()
    // `setDraftFailure` 这类标识符不会被 `\bsetDraft\b` 命中（`\b` 之后是词字符边界），
    // 故这条判据说的是"真的写了那枚官方写入口"。
    expect(owners).toEqual(['preset-launch.ts'])
  })

  it('preset-launch.ts **逐字节零改动**（md5 基线；本刀只做消费，不动那一条链）', () => {
    const raw = readFileSync(new URL('../src/preset-launch.ts', import.meta.url), 'utf8')
    // 换行归一后再取哈希：仓库有 `.gitattributes` 的跨平台文本约定，CRLF 检出不该让这条红。
    expect(createHash('md5').update(raw.replace(/\r\n/g, '\n')).digest('hex')).toBe('a0771dd7fa546da8f70d5144632f26c5')
  })

  it('接线处：同一个启动器既是草稿端口、也是技能卡那枚写入口（不建第二枚构造器）', () => {
    const wiring = readSrc('client.tsx')
    expect(wiring).toContain('const escDraftLaunch = createEnterprisePresetLauncher(')
    expect(wiring).toContain('const escDraftPort = { launch: escDraftLaunch }')
    expect(wiring).toContain('fillSkillTryDraft: draft => escDraftLaunch(draft),')
    /**
     * ★`client.tsx` 里那份构造器**恰好两枚**，各有其主：① `plugins.item` 的 `presetLaunch`（配方降级链
     *   第二级，本刀一字未动）；② `escDraftLaunch`（技能页这一枚：草稿端口 + 技能卡那枚写入口**共用**）。
     *   本刀要锁的是"**没有第三枚**"——技能卡那格接的是既有那一枚，而不是又建一个。
     */
    expect(wiring.match(/createEnterprisePresetLauncher\(/g) ?? []).toHaveLength(2)
    // 那一枚实例**恰好三处**：声明、草稿端口、技能卡那枚写入口（多一处就是有人另起了第二条路）。
    expect(wiring.match(/escDraftLaunch/g) ?? []).toHaveLength(3)
    expect(readEscSrc('esc-types.ts'))
      .toContain('readonly fillSkillTryDraft?: ((draft: string) => Promise<boolean>) | undefined')
  })

  it('三处消费点都从**唯一**计划工厂取（广场网格 / 精选行 / 企业技能目录），且那个工厂只有一处定义', () => {
    const trySource = readEscSrc('esc-skill-try.ts')
    expect(trySource.match(/export function enterpriseEscSkillTryDraft\(/g) ?? []).toHaveLength(1)
    expect(trySource.match(/export function enterpriseEscSkillTryPlan\(/g) ?? []).toHaveLength(1)
    // 全 `src` 里 `enterpriseEscSkillTryPlan(` 的调用点：只有三层页面 + 本 spec 的夹具形态
    // （本仓约定：事实层定义一处，消费点各一处）。
    const callers = allSrcFiles()
      .filter(file => /enterpriseEscSkillTryPlan\(/.test(file.code))
      .map(file => file.name)
      .sort()
    expect(callers).toEqual(['esc/esc-aggregation.tsx', 'esc/esc-catalog-list.tsx', 'esc/esc-skill-try.ts'])
    // 精选行不自己算：它拿的是聚合层交下来的**同一个**工厂（与 `moreOf` 同一条手法）。
    expect(readEscSrc('esc-featured.tsx')).toContain('options.tryOf?.(item.name, skillInstalled)')
    expect(readEscSrc('esc-aggregation.tsx')).toContain("...(resourceType === 'skill' ? { tryOf } : {}),")
  })
})
