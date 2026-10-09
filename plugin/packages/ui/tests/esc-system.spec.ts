/**
 * [INPUT]: 依赖 `esc-system.ts`（系统广场【＋】的**唯一**终态/文案真源）、`esc-system-list.tsx`
 *   （失败那一行的唯一呈现件）、`esc-card.tsx`（卡片本体，取它收到的 `install` 入参）、
 *   `esc-list.ts`（published 适配器与安全整数门禁 `escSafeTargetId`）、`local-api.ts`
 *   （唯一那条安装路由的实现与常量）、`error-messages.ts`（唯一码表与 `retryable` 判据），
 *   以及 `src` 的源码文本
 * [OUTPUT]: 锁定**口径 64 收口**（系统广场【＋】接线）的八条判据：
 *   ① `allowCopy` 预判：`1` 放行，`0` / `true` / `'1'` / 缺席 / 其它任何值一律判 `copy-forbidden`
 *      （禁用 + **行上可见原因** + 物理上没有 `onClick`）；② `paymentRequired` 为真同样拒；
 *   ③ 坐标**必须是 `targetId` 且是安全整数 `1..2^53-1`**（字符串/非整数/负数/越界/`packageId` 顶替
 *      ⇒ 投影层整格缺席 ⇒ 计划落 `no-target` ⇒ **一条请求都发不出去** + 行上给原因）；
 *   ④ 源码级：全 `src` 里 `'/skills/published/install'` **恰好一处**（那条常量）、
 *      `requestJson(SKILL_PUBLISHED_INSTALL_PATH, …)` **恰好一个**调用点、裸 `fetch(` 全 src 恰好一处
 *      （不是这条链的）；⑤ 在途禁双击 + **不乐观翻态** + 失败归行（唯一提示组件 + 稳定码，且
 *      `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN` **不给重试**）；⑥ 成功后触发**同一枚**计数刷新回调
 *      （源码级：只有一枚 `installedRefreshToken` / 一枚 `onInstalledRefresh`，且在并入 Host 回传清单
 *      **之后**调；行为级：并入的每一个名字都出自 Host 那次回执）；⑦ 新码入唯一码表 + `retryable: false`
 *      + 码值只有一处真源；⑧ 两条安装路**不串**的反锁（系统广场 = published + `targetId`；
 *      企业技能 = `/skills/install` + `packageId`）+ 导出 ZIP / 技能详情**永不**从界面走
 * [POS]: 口径 64 界面半边的机械门禁——把"这条记录能不能装、这枚【＋】能不能点、为什么不能点、
 *   装完信谁、失败落在哪、刷新谁、两条路有没有串"钉在**纯投影/纯渲染的行为**与**源码结构**两层。
 *   本仓 vitest 没有 DOM，故**不碰真渲染器**：卡片那一侧只核对交给它的 `install` 入参，
 *   源码那一侧先**剥注释**再断言（注释里引述路线是正当的记录，不是第二个调用点）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * ★官方原语在本仓**不是**运行期依赖（发行时用宿主的共享实例），而 `devDependency` 那份的
 * `Button` 在**导入期**就会 `import 'clsx'`（那个包不在本仓依赖里）⇒ 直接 import 呈现层会在
 * "收集测试"阶段就炸。与 `tests/esc-catalog.spec.ts` / `tests/esc-third-party.spec.ts` 同一条手法：
 * 整模块替身化 —— 本文件要测的是我们自己的**投影与结构**（那些元素收到哪些 props）。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: 'button',
  Pill: 'button',
  Input: 'input',
  // `official-ui.ts` 在**模块求值**时就把这几枚取出来，故替身里必须给它们一个值。
  Menu: 'div',
  MenuItemButton: 'button',
  IconEllipsisOutlineMedium: 'span',
  IconSettingsOutlineMedium: 'span',
  IconUserOutlineMedium: 'span',
  IconLoadingOutlineMedium: 'span',
  // `esc-card.tsx` 在模块顶取了这三枚（本文件只核对它收到的入参，不断言官方原语自己的渲染）。
  Switch: 'span',
  // `skill-market.tsx` 一路（`esc-list` 的适配器夹具会把它加载进来）用到。
  Modal: 'div',
  Tag: 'span',
}))

/**
 * ★**本刀（技能页性能）**：`EnterpriseEscCard` 现在是 `memo` 包出来的那一枚（对象，不是函数）
 *   —— 既有那批"纯函数直调取渲染树"的用例改调它的**内层**那一枚 `EnterpriseEscCardView`
 *   （渲染语义逐字同一份）；`.type` 那几条结构锁仍对着 `EnterpriseEscCard`（元素类型就是它）。
 */
import { EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { escResourceAdapters, escSafeTargetId } from '../src/esc/esc-list.js'
import { EnterpriseEscSystemInstallFailure } from '../src/esc/esc-system-list.js'
import {
  ENTERPRISE_ESC_SYSTEM_BLOCKED_BY_BUSY,
  ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON,
  ENTERPRISE_ESC_SYSTEM_INSTALL,
  ENTERPRISE_ESC_SYSTEM_INSTALLING,
  ENTERPRISE_ESC_SYSTEM_INSTALL_FAILED_PREFIX,
  ENTERPRISE_ESC_SYSTEM_INSTALL_NOT_PORTED,
  ENTERPRISE_ESC_SYSTEM_INSTALL_TIMEOUT_MS,
  ENTERPRISE_ESC_SYSTEM_INSTALL_TITLE,
  ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED,
  ENTERPRISE_ESC_SYSTEM_TARGET_MISSING,
  enterpriseEscSystemCardInstall,
  enterpriseEscSystemInstalledNames,
  enterpriseEscSystemInstalledText,
  escSystemInstallPlan,
} from '../src/esc/esc-system.js'
import type { EnterpriseEscApi } from '../src/esc/esc-api.js'
import type { ResourceItem } from '../src/esc/esc-types.js'
import {
  ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE,
  enterpriseErrorMessage,
  enterpriseErrorRetryable,
} from '../src/error-messages.js'
import { EnterpriseErrorNotice } from '../src/error-notice.js'
import {
  ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH,
  createEnterpriseLocalApi,
} from '../src/local-api.js'

/* ══════════════ 夹具与树工具 ══════════════ */

type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
const asElement = (node: unknown) => node as Element
const childrenOf = (element: Element): unknown[] => {
  const children = element.props['children']
  return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
}
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
/** 按类名找第一处（判据是类名，不是第几层）。 */
function findByClass(node: unknown, className: string): Element | undefined {
  return walk(node).find(each => each.props['className'] === className)
}

/**
 * 剥注释：源码级判据落在**代码**上（注释里引述路线/沿革是正当的记录 —— `esc-aggregation.tsx` 与
 * `esc-types.ts` 的 JSDoc 里就写着那条路径字面量，不剥会把"记录"误判成"第二个调用点"）。
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
/** 递归列出 `src/` 下全部 `.ts`/`.tsx`（含 `esc/` 子目录），键是相对 `src/` 的路径。 */
function allSrcFiles(dir = new URL('../src/', import.meta.url), prefix = ''): { readonly name: string; readonly code: string }[] {
  const out: { name: string; code: string }[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...allSrcFiles(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`))
      continue
    }
    if (!/\.tsx?$/.test(entry.name)) continue
    out.push({ name: `${prefix}${entry.name}`, code: stripComments(readFileSync(new URL(entry.name, dir), 'utf8')) })
  }
  return out
}

/**
 * 一条**平台已发布技能记录**（`POST /api/published/skill/list` 的 `records` 里那一份，
 * 字段形状照真机：`id=4194` 与 `targetId=158` 是**两套坐标系**，`allowCopy` 是平台原值）。
 */
function publishedRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 4194,
    targetId: 158,
    name: 'dev-engineer-toolkit',
    description: '研发工程工具箱',
    allowCopy: 1,
    paymentRequired: false,
    ...overrides,
  }
}

/** 一枚最小的 `EnterpriseEscApi` 桩：published 那一支只把注入的信封原样回出去。 */
function escApiStub(envelope: unknown): EnterpriseEscApi {
  const record = async () => envelope as never
  return {
    publishedCategoryList: record,
    spaceList: record,
    publishedAgentList: record,
    publishedSkillList: record,
    publishedSkillEnableList: record,
    connectorProviderPageList: record,
    escMockStatus: async () => ({ enabled: false }),
  } as unknown as EnterpriseEscApi
}

/**
 * 端到端走**真投影**：`escResourceAdapters` 的技能·系统广场那一支（`fetchPage` → `extract`）
 * ——页面吃到的 `ResourceItem` 就是这一份，故"坐标在不在场、授权原值是多少"这件事的判据
 * 落在**真实取值口**上，不是我们另抄一份。
 */
async function projectedSkill(overrides: Record<string, unknown> = {}): Promise<ResourceItem> {
  const envelope = { code: '0000', data: { records: [publishedRecord(overrides)], current: 1, pages: 1 } }
  const adapter = escResourceAdapters(escApiStub(envelope)).skill.system
  if (adapter === undefined || adapter.mode !== 'server') throw new Error('技能页的系统广场应当是服务端分页适配器')
  const fetched = await adapter.fetchPage({ page: 1, pageSize: 20, category: '', keyword: '', spaceId: undefined, spaceIds: undefined })
  return adapter.extract(fetched, 1, 20).items[0]!
}

/** 一枚系统广场技能卡片的 `ResourceItem`（只列本文件断言到的那几格）。 */
function itemOf(overrides: Partial<ResourceItem> = {}): ResourceItem {
  return { id: 'skill-4194', name: 'dev-engineer-toolkit', targetId: 158, allowCopy: 1, paymentRequired: false, ...overrides }
}

/** 一条安装终态（计划）的入参：默认就是"这条真的能装"。 */
function planFor(overrides: Record<string, unknown> = {}) {
  return escSystemInstallPlan({
    wired: true,
    targetId: 158,
    allowCopy: 1,
    paymentRequired: false,
    name: 'dev-engineer-toolkit',
    ...overrides,
  } as never)
}

/** 把计划铺成卡片入参并**真渲染**那张卡（取它收到的东西，本仓无 DOM）。 */
function cardOf(install: unknown, item: ResourceItem = itemOf()): unknown {
  return EnterpriseEscCardView({ item, showUse: true, installed: false, install } as never)
}
const plusOf = (tree: unknown): Element => {
  const found = findByClass(tree, 'esc-install-plus')
  expect(found, '那枚【＋】').toBeTruthy()
  return found as Element
}
const lockOf = (tree: unknown): Element | undefined => findByClass(tree, 'esc-card-lock')

/** 一条 Host 回传的**本机自装清单**（`{ data: { skills: [...] } }` 里的那些记录）。 */
const HOST_SELF_INSTALLED = [
  {
    skillId: 'dev-engineer-toolkit',
    displayName: '研发工程工具箱',
    sha256: 'a'.repeat(64),
    names: ['dev-engineer-toolkit'],
    installedAt: '2026-10-01T00:00:00Z',
  },
  {
    skillId: 'code-review',
    displayName: '代码评审',
    sha256: 'b'.repeat(64),
    names: ['code-review', 'code-review-strict'],
    installedAt: '2026-10-01T00:00:01Z',
  },
]

/* ══════════════ ① allowCopy 预判 ══════════════ */

describe('口径 64 ①：`allowCopy` 预判 —— 只有数字 `1` 才算允许（fail-closed）', () => {
  it('`0` / `true` / `\'1\'` / 缺席 / 其它任何值 ⇒ `copy-forbidden`：禁用 + **行上可见原因** + 没有写入口', () => {
    // 真机实测平台**有字段没有执行**（68/138 条 `allowCopy=0`，`export/700` 照样回 ZIP）
    // ⇒ 判据只能自己判，且必须 fail-closed（判不过就是一个字都不发）。
    const notAllowed: readonly unknown[] = [0, true, '1', undefined, 2, -1, Number.NaN, 'yes', null, 0.5]
    for (const form of notAllowed) {
      const plan = planFor({ allowCopy: form })
      expect(plan.kind, String(form)).toBe('copy-forbidden')
      expect(plan.disabled, String(form)).toBe(true)
      expect(plan.reason, String(form)).toBe(ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON)
      expect(plan.title, String(form)).toBe(ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON)
      // ★"不交坐标"就是"点不出请求"：可点那一档才带得动写入口（见下面卡片那两条断言）。
      expect(plan.targetId, String(form)).toBeUndefined()

      const onInstall = vi.fn()
      const install = enterpriseEscSystemCardInstall(plan, onInstall)
      expect(install.onInstall, String(form)).toBeUndefined()
      const tree = cardOf(install)
      const plus = plusOf(tree)
      expect(plus.props['disabled'], String(form)).toBe(true)
      // ★判据是**元素上根本没有 `onClick`**（不是挂了一个不会被调的回调）。
      expect(plus.props['onClick'], String(form)).toBeUndefined()
      // 产品宪法：禁用控件不许只挂一句 title ⇒ 原因必须真的写在卡片上（`role="status"`）。
      const lock = lockOf(tree)
      expect(lock, String(form)).toBeTruthy()
      expect(lock!.props['children'], String(form)).toBe(ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON)
      expect(lock!.props['role'], String(form)).toBe('status')
      expect(lock!.props['data-esc-install-lock'], String(form)).toBe('true')
      // 一次都不许被调到（那是"预判没过还发了请求"的样子）。
      expect(onInstall).not.toHaveBeenCalled()
    }
  })

  it('只有**数字 `1`** 放行：`install` 档、可点、交出的正是那枚安全整数坐标', () => {
    const plan = planFor({ allowCopy: 1 })
    expect(plan.kind).toBe('install')
    expect(plan.disabled).toBe(false)
    expect(plan.reason).toBeUndefined()
    expect(plan.targetId).toBe(158)
    expect(plan.title).toBe(ENTERPRISE_ESC_SYSTEM_INSTALL_TITLE)

    const onInstall = vi.fn()
    const tree = cardOf(enterpriseEscSystemCardInstall(plan, onInstall))
    const plus = plusOf(tree)
    expect(plus.props['disabled']).toBe(false)
    expect(typeof plus.props['onClick']).toBe('function')
    ;(plus.props['onClick'] as () => void)()
    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onInstall).toHaveBeenCalledWith(158)
    // 能点的时候**不画**原因行（没有原因可写）。
    expect(lockOf(tree)).toBeUndefined()
  })

  it('平台把 `allowCopy` 给成非数字（`true` / `\'1\'`）时，投影层归一成**缺席** ⇒ 与"没给"同判（都装不了）', async () => {
    for (const form of [true, '1', null, '0', 0]) {
      const item = await projectedSkill({ allowCopy: form })
      // 不把"没给/给错"伪造成一个值：非数字一律不进投影（`0` 是数字、原样在场但判不过）。
      expect(item.allowCopy, String(form)).toBe(form === 0 ? 0 : undefined)
      const plan = planFor({ allowCopy: item.allowCopy })
      expect(plan.kind, String(form)).toBe('copy-forbidden')
    }
    expect((await projectedSkill({ allowCopy: 1 })).allowCopy).toBe(1)
  })

  it('那句行上原因**就是**唯一码表里那句话（同一处真源，界面不另写一份字面量）', () => {
    expect(ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON)
      .toBe(enterpriseErrorMessage(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE))
    expect(ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON.length).toBeGreaterThan(0)
    // 人话里不许出现裸码（码只在「技术信息」里）。
    expect(ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON).not.toContain('ENT_')
    // 源码级：本格是 `enterpriseErrorMessage(码常量)` 的直接投影，不是第二份句子。
    const system = readEscSrc('esc-system.ts')
    expect(system).toContain('export const ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON = enterpriseErrorMessage(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE)')
    // 全 `src` 里那句话**恰好一处**（唯一码表里那一格）——多一处就说明有人在界面里另写了一份。
    const duplicated = allSrcFiles()
      .map(file => ({ name: file.name, count: (file.code.match(/这枚技能的发布者不允许复制到本机。/g) ?? []).length }))
      .filter(each => each.count > 0)
    expect(duplicated).toEqual([{ name: 'error-messages.ts', count: 1 }])
  })
})

/* ══════════════ ② paymentRequired ══════════════ */

describe('口径 64 ②：`paymentRequired` 为真 ⇒ 同样拒（同一个宿主码，界面原因逐字不同）', () => {
  it('授权过了但要付费 ⇒ `payment-required`：禁用 + 行上可见原因 + 没有写入口', () => {
    const plan = planFor({ allowCopy: 1, paymentRequired: true })
    expect(plan.kind).toBe('payment-required')
    expect(plan.disabled).toBe(true)
    expect(plan.reason).toBe(ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED)
    expect(plan.targetId).toBeUndefined()

    const onInstall = vi.fn()
    const tree = cardOf(enterpriseEscSystemCardInstall(plan, onInstall))
    const plus = plusOf(tree)
    expect(plus.props['disabled']).toBe(true)
    expect(plus.props['onClick']).toBeUndefined()
    expect(lockOf(tree)!.props['children']).toBe(ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED)
    expect(onInstall).not.toHaveBeenCalled()
  })

  it('两种拒的原因**逐字不同**（员工要做的判断不同），但都指向同一枚宿主码、都不含裸码', () => {
    expect(ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED).not.toBe(ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON)
    for (const reason of [ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED, ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON]) {
      expect(reason.length).toBeGreaterThan(0)
      expect(reason).not.toContain('ENT_')
    }
    // 两档的失败收束是**同一枚**稳定码（宿主同判、回同一枚）。
    expect(enterpriseErrorMessage(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE)).toBe(ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON)
  })

  it('投影层把"要付费"归一成**布尔真**才在场：字符串 `\'true\'` / 数字 `1` 一律不算（不替平台猜）', async () => {
    expect((await projectedSkill({ paymentRequired: true })).paymentRequired).toBe(true)
    for (const form of ['true', 1, '1', null, undefined]) {
      expect((await projectedSkill({ paymentRequired: form })).paymentRequired, String(form)).toBe(false)
    }
    // 计划那一侧只认布尔真（接的是投影给的归一值）——真值走同一支。
    expect(planFor({ paymentRequired: true }).kind).toBe('payment-required')
    expect(planFor({ paymentRequired: false }).kind).toBe('install')
  })
})

/* ══════════════ ③ 坐标：targetId 且安全整数 ══════════════ */

describe('口径 64 ③：坐标必须是 `targetId` 且是安全整数 `1..2^53-1`', () => {
  it('`escSafeTargetId` 逐形态：`158` / `1` / `2^53-1` 过；字符串/非整数/负数/越界/畸形全部不过', () => {
    expect(escSafeTargetId(158)).toBe(158)
    expect(escSafeTargetId(1)).toBe(1)
    expect(escSafeTargetId(2 ** 53 - 1)).toBe(2 ** 53 - 1)
    for (const bad of [
      '158', '0', '', 0, -1, -158, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
      2 ** 53, 2 ** 53 + 1, true, false, null, undefined, {}, [], [158], '2105915576743428098',
    ]) {
      expect(escSafeTargetId(bad), JSON.stringify(bad) ?? String(bad)).toBeUndefined()
    }
  })

  it('端到端投影（真走 published 适配器）：畸形坐标**整格缺席**，合法的原样在场', async () => {
    expect((await projectedSkill({ targetId: 158 })).targetId).toBe(158)
    for (const bad of ['158', 0, -1, 1.5, 2 ** 53, null, undefined, true, {}]) {
      expect((await projectedSkill({ targetId: bad })).targetId, String(bad)).toBeUndefined()
    }
    // `skillId`（页内既有的跳转坐标）与 `targetId`（安装坐标）是**两格**：本刀只把闸门加在后一格上。
    const item = await projectedSkill({ targetId: 158 })
    expect(item.skillId).toBe(158)
    expect(item.targetId).toBe(158)
  })

  it('坐标不在场 ⇒ `no-target`：禁用 + 行上可见原因 + 卡片上没有 `onClick`（一条请求都发不出去）', async () => {
    for (const bad of ['158', 0, -1, 1.5, 2 ** 53, undefined]) {
      const item = await projectedSkill({ targetId: bad, allowCopy: 1 })
      const plan = planFor({ targetId: item.targetId })
      expect(plan.kind, String(bad)).toBe('no-target')
      expect(plan.disabled, String(bad)).toBe(true)
      expect(plan.reason, String(bad)).toBe(ENTERPRISE_ESC_SYSTEM_TARGET_MISSING)
      expect(plan.title, String(bad)).toBe(ENTERPRISE_ESC_SYSTEM_TARGET_MISSING)
      expect(plan.targetId, String(bad)).toBeUndefined()

      const onInstall = vi.fn()
      const install = enterpriseEscSystemCardInstall(plan, onInstall)
      expect(install.onInstall, String(bad)).toBeUndefined()
      const tree = cardOf(install, item)
      expect(plusOf(tree).props['onClick'], String(bad)).toBeUndefined()
      expect(lockOf(tree)!.props['children'], String(bad)).toBe(ENTERPRISE_ESC_SYSTEM_TARGET_MISSING)
      expect(onInstall, String(bad)).not.toHaveBeenCalled()
    }
    // 那句原因说清"是这条记录本身不完整"，而不是"网络不好/重试一下"（后两者的下一步在这里都不对）。
    expect(ENTERPRISE_ESC_SYSTEM_TARGET_MISSING).toContain('编号')
  })

  it('`packageId` 顶替必红：字符串雪花号走不进这条路（安全整数门禁就是那道闸）', async () => {
    const packageId = '2105915576743428098'
    expect(escSafeTargetId(packageId)).toBeUndefined()
    // 平台记录里把 `packageId` 塞进 `targetId` 那一格（或反过来）⇒ 投影判不过、计划落 `no-target`。
    const item = await projectedSkill({ targetId: packageId })
    expect(item.targetId).toBeUndefined()
    expect(planFor({ targetId: item.targetId }).kind).toBe('no-target')
    // 源码级：这条链的三个文件里一个 `packageId` 都没有（那条是企业技能维度的坐标）。
    for (const name of ['esc-system.ts', 'esc-system-list.tsx', 'esc-aggregation.tsx']) {
      expect(readEscSrc(name), name).not.toContain('packageId')
    }
  })
})

/* ══════════════ ④ 唯一一处路径 / 唯一一个调用点 / 没有第二个 fetch ══════════════ */

describe('口径 64 ④：那条同源路由在全 `src` 里只有**一处**字面量与**一个**调用点', () => {
  it('`\'/skills/published/install\'` 恰好一处，就在 `local-api.ts` 的那条常量上', () => {
    const owners = allSrcFiles()
      .map(file => ({ name: file.name, count: (file.code.match(/'\/skills\/published\/install'/g) ?? []).length }))
      .filter(each => each.count > 0)
    expect(owners).toEqual([{ name: 'local-api.ts', count: 1 }])
    // 注册面常量与 Host 那条 exact 路径逐字同值（它是两侧唯一的合同面）。
    expect(ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/published/install')
    expect(ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH.endsWith('/skills/published/install')).toBe(true)
  })

  it('`requestJson(SKILL_PUBLISHED_INSTALL_PATH, …)` 恰好一处，正文是 `jsonInit(\'POST\', { targetId }, …)`', () => {
    const owners = allSrcFiles()
      .map(file => ({ name: file.name, count: (file.code.match(/requestJson\(SKILL_PUBLISHED_INSTALL_PATH/g) ?? []).length }))
      .filter(each => each.count > 0)
    expect(owners).toEqual([{ name: 'local-api.ts', count: 1 }])
    const local = readSrc('local-api.ts')
    // 正文**关闭键集恰好** `{targetId}`（多一枚键就是另一条合同）。
    expect(local).toContain('requestJson(SKILL_PUBLISHED_INSTALL_PATH, jsonInit(\'POST\', { targetId }, signal), fetcher)')
    // 响应**复用** `GET /skills/self-installed` 那枚既有严格解码器（不新写第二套；也不拿企业已装那个解）。
    const block = local.slice(local.indexOf('installPublishedSkill: async (targetId, signal)'))
    expect(block.slice(0, 400)).toContain('decodeEnterpriseSelfInstalledSkills(')
  })

  it('系统广场这半边（`esc-system.ts` / `esc-system-list.tsx` / 聚合层）零 `fetch(` / 零 `requestJson` / 零自造解码', () => {
    for (const name of ['esc-system.ts', 'esc-system-list.tsx', 'esc-aggregation.tsx']) {
      const code = readEscSrc(name)
      expect(code, name).not.toContain('fetch(')
      expect(code, name).not.toContain('requestJson')
      expect(code, name).not.toContain('decodeEnterprise')
      expect(code, name).not.toContain('/enterprise/api/v1/local')
    }
    // 写入口是**注入**的（可选端口；判据是端口在不在场）。
    expect(readEscSrc('esc-aggregation.tsx')).toContain('const installPublishedSkill = skillPort?.installPublishedSkill')
  })

  it('全 `src` 里裸 `fetch(` **恰好一处**（`client.tsx` 那枚既有接线），这条链上一个都没有', () => {
    const owners = allSrcFiles()
      .map(file => ({ name: file.name, count: (file.code.match(/(^|[^.\w])fetch\s*\(/g) ?? []).length }))
      .filter(each => each.count > 0)
    expect(owners).toEqual([{ name: 'client.tsx', count: 1 }])
    expect(readSrc('client.tsx')).toContain('(input, init) => fetch(input, init)')
  })

  it('导出 ZIP 与技能详情**只走宿主内部**（界面永不取字节、永不调那条详情）——反向锁', () => {
    for (const file of allSrcFiles()) {
      expect(file.code, file.name).not.toContain('/export/')
      expect(file.code, file.name).not.toContain('skill/export')
      expect(file.code, file.name).not.toContain('published/skill/detail')
    }
    // UI 侧认得的 published 面**恰好**是四条只读清单（没有导出、没有详情）。
    expect([...readEscSrc('esc-api.ts').matchAll(/'\/api\/published[^']*'/g)].map(match => match[0]).sort())
      .toEqual([
        "'/api/published/agent/list'",
        "'/api/published/category/list'",
        "'/api/published/skill/enable/list'",
        "'/api/published/skill/list'",
      ])
  })
})

/* ══════════════ ⑤ 在途 / 不乐观翻态 / 失败归行 ══════════════ */

describe('口径 64 ⑤：在途禁双击 + 不乐观翻态 + 失败归行（唯一提示组件 + 稳定码）', () => {
  it('在途那一枚：文案切「安装中…」、禁用、不给 reason、**且不交坐标**（物理上点不出第二次）', () => {
    const plan = planFor({ busy: 158 })
    expect(plan.kind).toBe('this-busy')
    expect(plan.text).toBe(ENTERPRISE_ESC_SYSTEM_INSTALLING)
    expect(plan.disabled).toBe(true)
    expect(plan.reason).toBeUndefined()
    expect(plan.targetId).toBeUndefined()

    const onInstall = vi.fn()
    const install = enterpriseEscSystemCardInstall(plan, onInstall)
    expect(install.busy).toBe(true)
    expect(install.onInstall).toBeUndefined()
    const tree = cardOf(install)
    expect(plusOf(tree).props['onClick']).toBeUndefined()
    // 那三个字**上屏**（圆形图标钮里只有一个加号，只挂 aria-label 等于没说）。
    const lock = lockOf(tree)!
    expect(lock.props['children']).toBe(ENTERPRISE_ESC_SYSTEM_INSTALLING)
    expect(lock.props['data-esc-install-busy']).toBe('true')
    expect(onInstall).not.toHaveBeenCalled()
  })

  it('别的枚在途：`blocked` 档禁用 + 行上可见原因（不是只挂 title），且**绝不**冒出一句「安装中…」', () => {
    const plan = planFor({ targetId: 159, busy: 158 })
    expect(plan.kind).toBe('blocked')
    expect(plan.disabled).toBe(true)
    expect(plan.reason).toBe(ENTERPRISE_ESC_SYSTEM_BLOCKED_BY_BUSY)
    expect(plan.targetId).toBeUndefined()
    const tree = cardOf(enterpriseEscSystemCardInstall(plan, () => undefined), itemOf({ targetId: 159 }))
    const lock = lockOf(tree)!
    expect(lock.props['children']).toBe(ENTERPRISE_ESC_SYSTEM_BLOCKED_BY_BUSY)
    expect(lock.props['data-esc-install-busy']).toBeUndefined()
    expect(String(lock.props['children'])).not.toContain('安装中')
    expect(plusOf(tree).props['onClick']).toBeUndefined()
  })

  it('写入口整条缺席：`not-ported` 档禁用 + 行上可见原因（判据是端口，不写死 `disabled`）', () => {
    const plan = planFor({ wired: false })
    expect(plan.kind).toBe('not-ported')
    expect(plan.reason).toBe(ENTERPRISE_ESC_SYSTEM_INSTALL_NOT_PORTED)
    expect(plan.targetId).toBeUndefined()
    const tree = cardOf(enterpriseEscSystemCardInstall(plan, () => undefined))
    expect(lockOf(tree)!.props['children']).toBe(ENTERPRISE_ESC_SYSTEM_INSTALL_NOT_PORTED)
    expect(plusOf(tree).props['onClick']).toBeUndefined()
  })

  it('失败件：唯一提示组件 + 前缀 + 稳定码；`ENT_SKILL_PUBLISHED_COPY_FORBIDDEN` **不画**重试', () => {
    const onRetry = vi.fn()
    const tree = EnterpriseEscSystemInstallFailure({
      targetId: 158,
      code: ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE,
      onRetry,
    })
    const root = asElement(tree)
    expect(root.props['className']).toBe('esc-catalog-error')
    // 失败只落在**那一行**上（坐标是它的键）。
    expect(root.props['data-esc-system-error']).toBe(158)
    const notice = walk(tree).find(each => each.type === EnterpriseErrorNotice)
    expect(notice, '失败走唯一提示组件').toBeTruthy()
    expect(notice!.props['code']).toBe(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE)
    expect(notice!.props['prefix']).toBe(ENTERPRISE_ESC_SYSTEM_INSTALL_FAILED_PREFIX)
    // ★授权由发布者设定、付款不是"再点一次"能改的 ⇒ `retryable: false` ⇒ **不画**重试按钮。
    expect(enterpriseErrorRetryable(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE)).toBe(false)
    expect(findByClass(tree, 'esc-catalog-retry')).toBeUndefined()
    expect(walk(tree).some(each => each.props['className'] === 'esc-catalog-retry')).toBe(false)
  })

  it('可重试的失败才画重试，且点它真的重发**同一枚坐标**（不是重画一下）', () => {
    for (const code of ['ENT_SKILL_INSTALL_FAILED', 'ENT_PLATFORM_UNAVAILABLE']) {
      expect(enterpriseErrorRetryable(code), code).toBe(true)
      const onRetry = vi.fn()
      const tree = EnterpriseEscSystemInstallFailure({ targetId: 158, code, onRetry })
      expect(walk(tree).find(each => each.type === EnterpriseErrorNotice)!.props['code']).toBe(code)
      const retry = findByClass(tree, 'esc-catalog-retry')
      expect(retry, code).toBeTruthy()
      ;(retry!.props['onClick'] as () => void)()
      expect(onRetry, code).toHaveBeenCalledWith(158)
    }
    // 四枚宿主既有失败码都在唯一码表里（本刀只是把它们的收束接上，没有新增语义）。
    const codes = readSrc('error-messages.ts')
    for (const code of ['ENT_SKILL_ALREADY_REGISTERED', 'ENT_SKILL_NAME_CONFLICT', 'ENT_SKILL_ARCHIVE_INVALID', 'ENT_SKILL_SKILLMD_INVALID', 'ENT_SKILL_SOURCE_TOO_LARGE', 'ENT_SKILL_INSTALL_FAILED']) {
      expect(codes, code).toContain(`${code}: {`)
    }
  })

  it('成功那句以 **Host 回传的清单**为准（名字只来自回执，绝不自己编、也不编计数）', () => {
    expect(enterpriseEscSystemInstalledNames(HOST_SELF_INSTALLED as never))
      .toEqual(['dev-engineer-toolkit', 'code-review', 'code-review-strict'])
    // 去重：同一条记录出现两次 ⇒ 名字只念一遍。
    expect(enterpriseEscSystemInstalledNames([...HOST_SELF_INSTALLED, ...HOST_SELF_INSTALLED] as never))
      .toEqual(['dev-engineer-toolkit', 'code-review', 'code-review-strict'])
    // 回执空 ⇒ 一个名字都编不出来（"不乐观翻态"的可测形态）。
    expect(enterpriseEscSystemInstalledNames([])).toEqual([])
    expect(enterpriseEscSystemInstalledText('研发工程工具箱')).toContain('研发工程工具箱')
  })

  it('源码级动作纪律：在途早退**发生在发请求之前**；成功只**并入** Host 回传清单；失败一格都不翻', () => {
    const agg = readEscSrc('esc-aggregation.tsx')
    const call = 'void installPublishedSkill(targetId, signal).then('
    // ① 一次一条：在途直接返回、且那句早退**在**发请求那一句之前（被挡下的第二次一条都不发）。
    expect(agg.indexOf('if (systemPending !== undefined) return')).toBeGreaterThanOrEqual(0)
    expect(agg.indexOf('if (systemPending !== undefined) return')).toBeLessThan(agg.indexOf(call))
    expect(agg.indexOf('if (installPublishedSkill === undefined) return')).toBeLessThan(agg.indexOf(call))
    // ② 超时复用本页既有那一枚数字（同一件事没有第二个口径）。
    expect(agg).toContain('AbortSignal.timeout(ENTERPRISE_ESC_SYSTEM_INSTALL_TIMEOUT_MS)')

    const handler = agg.slice(agg.indexOf('const runSystemInstall = useCallback'), agg.indexOf('}, [systemPending, installPublishedSkill, onInstalledRefresh])'))
    expect(handler.length).toBeGreaterThan(0)
    const success = handler.slice(handler.indexOf('(next) => {'), handler.indexOf('(error: unknown)'))
    const failure = handler.slice(handler.indexOf('(error: unknown) => {'), handler.indexOf('.finally('))
    // 成功：**并进** Host 回传的名字（不是替换、不是自己塞一枚、不是自己加计数）。
    expect(success).toContain('setInstalledIds(previous => new Set([...previous, ...enterpriseEscSystemInstalledNames(next)]))')
    expect(success).toContain('setSystemNotice(enterpriseEscSystemInstalledText(name))')
    expect(handler).not.toMatch(/setInstalledIds\(\[/)
    expect(handler).not.toContain('.concat(')
    expect(handler).not.toMatch(/setInstalledIds\w*\(\s*[^)]*\+\s*1/)
    // 失败：只记那一行的稳定码（不翻态、不吞、不 catch）。
    expect(failure).toContain('setSystemError({ id: targetId, code: enterpriseLocalErrorCode(error) })')
    expect(failure).not.toContain('setInstalledIds')
    expect(failure).not.toContain('setSystemNotice')
    expect(handler).not.toContain('catch')
    // 在途态在 `finally` 里清掉（成功与失败都解锁）。
    expect(handler).toContain('.finally(() => { setSystemPending(undefined) })')
    /**
     * ★**本刀（技能页性能）重新基线化（加强，不是放宽）**：聚合层**不再直调**那两枚投影 ——
     *   它调**那一张计划表**（`enterpriseEscSystemInstallTable`），表内（`esc-system.ts`）才是
     *   唯一构造点。⇒ 本文件里那几格实参逐字锁**移到了表那一侧**（同一份实参、同一个判据），
     *   而聚合层这一侧只锁"那一张表恰好被建一次"。
     */
    expect(agg).toContain('enterpriseEscSystemInstallTable({')
    expect(agg.match(/enterpriseEscSystemInstallTable\(/g) ?? []).toHaveLength(1)
    expect(agg).toContain('wired: installPublishedSkill !== undefined,')
    expect(agg).toContain('onInstall: runSystemInstall,')
    // 七档只有"可点"那一档带得动写入口 —— 实参逐字锁仍在，位置是**表内**（唯一构造点）。
    const system = readEscSrc('esc-system.ts')
    expect(system).toContain('if (!input.enabled) return undefined')
    expect(system).toContain('...(item.targetId === undefined ? {} : { targetId: item.targetId }),')
    expect(system).toContain('...(item.allowCopy === undefined ? {} : { allowCopy: item.allowCopy }),')
    expect(system).toContain('paymentRequired: item.paymentRequired === true,')
    expect(system).toContain('enterpriseEscSystemCardInstall(plan, targetId => { input.onInstall(targetId, item.name) })')
    // 失败块与「平台目录读不到」那条 `ErrorRow` **互不覆盖**（两件事实各有各的落点）。
    expect(agg).toContain('createElement(EnterpriseEscSystemInstallFailure, {')
    expect(agg).toContain('createElement(ErrorRow, { code: error.code, message: error.message, onRetry: retry })')
  })
})

/* ══════════════ ⑥ 计数刷新 ══════════════ */

describe('口径 64 ⑥：成功后触发**同一枚**计数刷新回调（不造第二个令牌）', () => {
  it('全聚合层只有一枚 `installedRefreshToken` 与一枚 `onInstalledRefresh`；成功分支在并入清单**之后**调它', () => {
    const agg = readEscSrc('esc-aggregation.tsx')
    expect(agg.match(/\[installedRefreshToken, setInstalledRefreshToken\]/g)).toHaveLength(1)
    expect(agg.match(/const onInstalledRefresh = useCallback/g)).toHaveLength(1)
    // 三条装了东西的路（本地导入 / 本地三方 / 系统广场）共用**同一枚**：一处定义、两处显式转发。
    expect(agg).toContain('setInstalledRefreshToken(token => token + 1)')
    expect(agg).toContain('onInstalledRefresh,')
    /**
     * ★**S5a 改写（不是放宽）**：`onInstalledRefresh()` 从**两处**变成**三处** ——
     *   ① 系统广场装好一枚之后；② 「本地三方」装好一枚之后（那一支经 `onRefresh` 一起调）；
     *   ③ **本刀新增**：自装技能**卸载**成功之后（`setSelfInstalled(next.skills)` 紧随其后）。
     *   三处请的都是**同一枚**回调（下面两行仍在锁"全文件只有一枚令牌、一个 updater"）⇒
     *   任何"另造一枚令牌"的改法照样红。
     * ★**本刀收尾重新基线化（不是放宽）**：再由**三处**变成**四处** —— 新增的那一处是技能页
     *   第四枚维度 `SkillHub` 装好一条结果之后（同一枚 refresh token，一条机制）。
     */
    expect(agg.match(/onInstalledRefresh\(\)/g)).toHaveLength(4)
    // 系统广场那一支：并入 Host 清单在前、请计数重读在后（顺序即语义：先有真值、再请重数）。
    const handler = agg.slice(agg.indexOf('const runSystemInstall = useCallback'), agg.indexOf('}, [systemPending, installPublishedSkill, onInstalledRefresh])'))
    expect(handler.indexOf('setInstalledIds(previous =>')).toBeLessThan(handler.indexOf('onInstalledRefresh()'))
    expect(handler).toContain('onInstalledRefresh()')
    // 依赖表里带着它（回调身份变了才重建）。
    expect(agg).toContain('}, [systemPending, installPublishedSkill, onInstalledRefresh])')
    // 反向锁：系统广场这一支**没有**直接去动那枚 token 的 setter（那是第二套机制的形态）。
    expect(handler).not.toContain('setInstalledRefreshToken')
    // 「企业技能」那一支交下去的也是**同一枚**回调（同一份计数只有一条机制）。
    expect(agg).toContain('onInstalledRefresh,')
  })

  it('行为级：并进集合的每一个名字都出自 Host 那次回执（成功那一刻它说得出"装了谁"）', () => {
    // 这一次回执 = Host 落盘后的本机自装清单 ⇒ 并进集合的就是这几个名字，一个不多一个不少。
    const next = enterpriseEscSystemInstalledNames(HOST_SELF_INSTALLED as never)
    expect(next).toEqual(['dev-engineer-toolkit', 'code-review', 'code-review-strict'])
    const previous = new Set(['官方内置技能'])
    expect([...new Set([...previous, ...next])]).toEqual(['官方内置技能', 'dev-engineer-toolkit', 'code-review', 'code-review-strict'])
    // 回执说"没装任何东西" ⇒ 集合**一个字节都不动**（这就是"不乐观翻态"的可测形态）。
    expect([...new Set([...previous, ...enterpriseEscSystemInstalledNames([])])]).toEqual(['官方内置技能'])
  })
})

/* ══════════════ ⑦ 新码 ══════════════ */

describe('口径 64 ⑦：`ENT_SKILL_PUBLISHED_COPY_FORBIDDEN` 入表 + `retryable: false` + 码值一处真源', () => {
  it('码在唯一码表里、常量值 === 表里的键、`retryable: false`、人话 + 下一步且不含裸码', () => {
    expect(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE).toBe('ENT_SKILL_PUBLISHED_COPY_FORBIDDEN')
    expect(enterpriseErrorMessage(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE)).toBe('这枚技能的发布者不允许复制到本机。')
    // 终态：授权由发布者在平台上设定、付款也不是"再点一次"能改的 ⇒ 不给必然失败的重试画饼。
    expect(enterpriseErrorRetryable(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE)).toBe(false)
    // 码值只有一处真源（常量），界面侧只引用它，不各写一遍字面量。
    expect(readSrc('error-messages.ts')).toContain('export const ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE = \'ENT_SKILL_PUBLISHED_COPY_FORBIDDEN\'')
    const system = readEscSrc('esc-system.ts')
    expect(system).toContain('ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE')
    expect(system).not.toContain("'ENT_SKILL_PUBLISHED_COPY_FORBIDDEN'")
  })
})

/* ══════════════ ⑧ 两条安装路不串 ══════════════ */

describe('口径 64 ⑧：两条安装路**不串**（系统广场 = published + `targetId`；企业技能 = `/skills/install` + `packageId`）', () => {
  it('行为级：两条路由的路径与正文**各是各的**（同一个同源 API 实例上两枚方法）', async () => {
    const calls: { readonly url: string; readonly init: RequestInit | undefined }[] = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init })
      return { ok: true, status: 200, json: async () => ({ data: { skills: [] } }) } as unknown as Response
    }) as unknown as typeof fetch
    const local = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal

    // ① 企业技能：`/skills/install` + `{packageId}`（雪花字符串）——本刀一个字都没改它。
    await local.installSkill('2105915576743428098', signal)
    expect(calls[0]!.url).toBe('/enterprise/api/v1/local/skills/install')
    expect(calls[0]!.init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ packageId: '2105915576743428098' })

    // ② 系统广场：`/skills/published/install` + `{targetId}`（**安全整数**）。
    await local.installPublishedSkill(158, signal)
    expect(calls[1]!.url).toBe(ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH)
    expect(calls[1]!.url).toBe('/enterprise/api/v1/local/skills/published/install')
    expect(calls[1]!.init?.method).toBe('POST')
    const body = JSON.parse(String(calls[1]!.init?.body)) as Record<string, unknown>
    // ★关闭键集**恰好** `{targetId}`，且值是**数字**（不是路径、不是字符串 id、不是 packageId）。
    expect(Object.keys(body)).toEqual(['targetId'])
    expect(body).toEqual({ targetId: 158 })
    expect(typeof body['targetId']).toBe('number')
    expect(calls[1]!.url).not.toBe(calls[0]!.url)
  })

  it('行为级：200 的响应与 `GET /skills/self-installed` **逐字同形**（复用同一枚解码器）', async () => {
    const fetcher = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { skills: HOST_SELF_INSTALLED } }),
    })) as unknown as typeof fetch
    const local = createEnterpriseLocalApi(fetcher)
    const signal = new AbortController().signal
    const installed = await local.installPublishedSkill(158, signal)
    expect(installed).toEqual(await local.selfInstalledSkills(signal))
    expect(installed.map(record => record.names)).toEqual([['dev-engineer-toolkit'], ['code-review', 'code-review-strict']])
  })

  it('行为级：宿主那枚 `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN` 原样翻成稳定码（403 不吞、不换码）', async () => {
    for (const [status, code] of [[403, ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE], [409, 'ENT_SKILL_ALREADY_REGISTERED'], [400, 'ENT_SKILL_ARCHIVE_INVALID'], [413, 'ENT_SKILL_SOURCE_TOO_LARGE'], [503, 'ENT_SKILL_INSTALL_FAILED']] as const) {
      // 同源错误信封的真形状（`decodeEnterpriseErrorCode` 只认 `{error:{code}}`）。
      const fetcher = (async () => ({
        ok: false,
        status,
        json: async () => ({ error: { code } }),
      })) as unknown as typeof fetch
      const local = createEnterpriseLocalApi(fetcher)
      await expect(local.installPublishedSkill(158, new AbortController().signal))
        .rejects.toMatchObject({ code })
    }
  })

  it('源码级：系统广场那三个文件里没有 `/skills/install` / `packageId`；企业技能那面没有 `targetId`', () => {
    for (const name of ['esc-system.ts', 'esc-system-list.tsx']) {
      const code = readEscSrc(name)
      expect(code, name).not.toContain('/skills/install')
      expect(code, name).not.toContain('packageId')
      expect(code, name).not.toContain('targetId: packageId')
    }
    for (const name of ['esc-catalog.ts', 'esc-catalog-list.tsx']) {
      expect(readEscSrc(name), name).not.toContain('targetId')
      expect(readEscSrc(name), name).not.toContain('published')
    }
    // `/skills/install` 全 `src` 里只有 `local-api.ts` 一处调用点（本刀没有在别处再抄一条）。
    const installOwners = allSrcFiles()
      .map(file => ({ name: file.name, count: (file.code.match(/requestJson\('\/skills\/install'/g) ?? []).length }))
      .filter(each => each.count > 0)
    expect(installOwners).toEqual([{ name: 'local-api.ts', count: 1 }])
    // 两枚写入口在接线处**并列**（同一枚实例、同一处），谁也不冒充谁。
    const client = readSrc('client.tsx')
    expect(client).toContain('const escSkillApi = createEnterpriseLocalApi()')
    expect(client).toContain('installSkill: (packageId, signal) => escSkillApi.installSkill(packageId, signal),')
    expect(client).toContain('installPublishedSkill: (targetId, signal) => escSkillApi.installPublishedSkill(targetId, signal),')
    expect(client).not.toContain("'/skills/published/install'")
    expect(client).not.toContain('/skills/install')
  })

  it('端口类型把两条路写成**两格**（可选端口：判据是"端口在不在场"，不是编译期就能骗过的必填位）', () => {
    const types = readEscSrc('esc-types.ts')
    expect(types).toContain('readonly installSkill?: ((packageId: string, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>) | undefined')
    expect(types).toContain('readonly installPublishedSkill?: ((targetId: number, signal: AbortSignal) => Promise<readonly EnterpriseSelfInstalledSkill[]>) | undefined')
    // `ResourceItem` 那两格的在场判据：`targetId` 过安全整数门禁、`allowCopy` 只收数字。
    expect(types).toContain('readonly targetId?: number | undefined')
    expect(types).toContain('readonly allowCopy?: number | undefined')
    expect(readEscSrc('esc-list.ts')).toContain('targetId: escSafeTargetId(item.targetId),')
    expect(readEscSrc('esc-list.ts')).toContain('allowCopy: typeof item.allowCopy === \'number\' ? item.allowCopy : undefined,')
  })

  it('文案常量互不相同：安装 / 安装中 / 端口缺席 / 被别人的在途挡住（四句话各说各的）', () => {
    expect(new Set([
      ENTERPRISE_ESC_SYSTEM_INSTALL,
      ENTERPRISE_ESC_SYSTEM_INSTALLING,
      ENTERPRISE_ESC_SYSTEM_INSTALL_NOT_PORTED,
      ENTERPRISE_ESC_SYSTEM_BLOCKED_BY_BUSY,
      ENTERPRISE_ESC_SYSTEM_TARGET_MISSING,
      ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED,
      ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON,
    ]).size).toBe(7)
    expect(ENTERPRISE_ESC_SYSTEM_INSTALL).toBe('安装')
    expect(ENTERPRISE_ESC_SYSTEM_INSTALL_TIMEOUT_MS).toBe(120_000)
    // 无障碍名说清装谁（那枚圆形图标钮里只有一个加号）。
    expect(planFor().ariaLabel).toBe(`${ENTERPRISE_ESC_SYSTEM_INSTALL}dev-engineer-toolkit`)
  })
})
