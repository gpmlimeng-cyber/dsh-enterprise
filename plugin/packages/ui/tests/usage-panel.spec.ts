/**
 * [INPUT]: 依赖 usage-panel 的不变量——行内三列投影/取数决策/详情预留/折叠箭头——以及 local-api 的同源路径常量与 account-menu 的源码
 * [OUTPUT]: 锁定「我的用量」行内折叠块的验收面：默认折叠（首次渲染没有数据行）、**折叠态不发请求**（懒加载决策）、展开后四行三列结构、详情为不可用态且不跳转、耗尽 0% 走警示色、失败文案复用 account-state 既有映射，以及展开区必须与开关同树
 * [POS]: dsh-ui「我的用量」的契约回归（取代已退场的 usage-dialog）；有人补零窗口、把折叠态也发请求、给详情加真跳转，或让开关状态与展开区分家，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_FEEDBACK_LOCAL_PATH,
  ENTERPRISE_HELP_OPEN_LOCAL_PATH,
} from '../src/local-api.js'
import type { EnterpriseQuotaUsagePolicy } from '../src/local-api.js'
import {
  ENTERPRISE_USAGE_COLUMNS,
  ENTERPRISE_USAGE_DETAILS_HINT,
  ENTERPRISE_USAGE_WINDOW_KEYS,
  enterpriseTokenText,
  enterpriseUsageAmountText,
  enterpriseUsageFetchDecision,
  enterpriseUsagePercent,
  enterpriseUsagePolicyView,
  enterpriseUsageRemaining,
  enterpriseUsageRemainingPercent,
  enterpriseUsageRemainingText,
  enterpriseUsageResetText,
  enterpriseUsageWindows,
} from '../src/usage-panel.js'

/**
 * 与 account-menu.spec.ts 同一处理：本包 devDependency 的官方 ui-primitives 真包在 Node 下
 * 解析不到自己的传递依赖，而这些用例只测纯投影，运行期实例由宿主提供。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  Modal: vi.fn(),
}))

/** contracts/fixtures/quota-usage-me-success.json 的真实报文形状；rpm/concurrency 也在契约里。 */
function policy(overrides: Partial<EnterpriseQuotaUsagePolicy> = {}): EnterpriseQuotaUsagePolicy {
  return {
    daily: { limit: 1_000_000, reservedTokens: 1024, resetsAt: '2026-08-19T00:00:00+08:00', usedTokens: 12_000 },
    fiveHours: { limit: 200_000, reservedTokens: 1024, resetsAt: '2026-08-18T20:00:00+08:00', usedTokens: 12_000 },
    monthly: { limit: 20_000_000, reservedTokens: 1024, resetsAt: '2026-09-01T00:00:00+08:00', usedTokens: 250_000 },
    name: 'Default',
    policyId: '1900100000000000002',
    resourceName: '全部模型',
    weekly: { limit: 5_000_000, reservedTokens: 1024, resetsAt: '2026-08-24T00:00:00+08:00', usedTokens: 250_000 },
    ...overrides,
  }
}

describe('the four-window projection keeps the product order and the counter semantics', () => {
  it('emits fiveHours → daily → weekly → monthly and never invents a missing window', () => {
    expect(ENTERPRISE_USAGE_WINDOW_KEYS).toEqual(['fiveHours', 'daily', 'weekly', 'monthly'])
    expect(enterpriseUsageWindows(policy()).map(window => window.key))
      .toEqual(['fiveHours', 'daily', 'weekly', 'monthly'])
    expect(enterpriseUsageWindows(policy()).map(window => window.label)).toEqual(['5 小时', '日', '周', '月'])
    // 未生效窗口必须整条消失：补零会造出「有额度」的错觉。
    expect(enterpriseUsageWindows(policy({ daily: null, weekly: null })).map(window => window.key))
      .toEqual(['fiveHours', 'monthly'])
    expect(enterpriseUsageWindows(policy({
      daily: null, fiveHours: null, monthly: null, weekly: null,
    }))).toEqual([])
  })

  it('shows the remaining percentage in the second column and marks exhaustion with 0%', () => {
    expect(ENTERPRISE_USAGE_COLUMNS).toEqual(['周期', '剩余额度', '详情'])
    const [fiveHours] = enterpriseUsageWindows(policy())
    expect(fiveHours).toMatchObject({
      exhausted: false,
      limit: 200_000,
      percent: 6,
      remainingPercent: 93.5,
      remainingTokens: 200_000 - 12_000 - 1024,
      usedTokens: 12_000,
    })
    expect(enterpriseUsageRemainingText(fiveHours!)).toBe('93.5%')
    // 耗尽判定含预留：已用 + 已预留越过限额即为耗尽，剩余额度和剩余百分比都恰好是 0（警示色的判据）。
    const spent = enterpriseUsageWindows(policy({
      daily: { limit: 1000, reservedTokens: 200, resetsAt: null, usedTokens: 900 },
    }))[1]
    expect(spent).toMatchObject({ exhausted: true, percent: 90, remainingPercent: 0, remainingTokens: 0 })
    expect(enterpriseUsageRemainingText(spent!)).toBe('0%')
    expect(enterpriseUsagePercent(12_000, 0)).toBeNull()
    expect(enterpriseUsagePercent(12_000, null)).toBeNull()
    expect(enterpriseUsagePercent(2_000_000, 1_000_000)).toBe(100)
    expect(enterpriseUsageRemaining(10, 5, null)).toBeNull()
    expect(enterpriseUsageRemainingPercent(10, 5, null)).toBeNull()
  })

  it('titles a policy with its resource name only when the center provides one', () => {
    expect(enterpriseUsagePolicyView(policy()).title).toBe('Default · 全部模型')
    expect(enterpriseUsagePolicyView(policy({ resourceName: null })).title).toBe('Default')
    expect(enterpriseUsagePolicyView(policy({ resourceName: '' })).title).toBe('Default')
  })

  it('formats amounts and reset moments without leaking raw JSON', () => {
    expect(enterpriseTokenText(12_000)).toBe('12,000')
    expect(enterpriseTokenText(250)).toBe('250')
    expect(enterpriseUsageAmountText(null)).toBe('不限')
    expect(enterpriseUsageAmountText(1_000_000)).toBe('1,000,000')
    expect(enterpriseUsageResetText('2026-08-18T20:00:00+08:00')).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(enterpriseUsageResetText(null)).toBe('未提供')
    expect(enterpriseUsageResetText('not-a-time')).toBe('未提供')
  })
})

/** 队列第 11 项的硬要求：折叠态一个请求都不发，首次展开才取数，之后同一代次不重复取。 */
describe('the inline block only fetches once it is expanded', () => {
  it('never fetches while collapsed, for any session state', () => {
    for (const usable of [true, false]) {
      expect(enterpriseUsageFetchDecision({ expanded: false, loaded: false, usable })).toBe('skip')
    }
    // 已取过同一份事实（再次展开）也不重复取：只有显式刷新会把 loaded 打回 false。
    expect(enterpriseUsageFetchDecision({ expanded: true, loaded: true, usable: true })).toBe('skip')
  })

  it('fetches on the first expansion and stops at a signed-out hint without a request', () => {
    expect(enterpriseUsageFetchDecision({ expanded: true, loaded: false, usable: true })).toBe('fetch')
    expect(enterpriseUsageFetchDecision({ expanded: true, loaded: false, usable: false })).toBe('signed-out')
  })

  it('lets an interrupted load be retried, but keeps a completed result from being fetched twice', async () => {
    const source = await readFile(new URL('../src/usage-panel.tsx', import.meta.url), 'utf8')
    // 折叠打断取数后必须把「已取过」的标记打回，否则再次展开会永远停在「正在读取」。
    expect(source).toContain('abandonIfInterrupted')
    expect(source).toContain('if (fetched.current === token) fetched.current = undefined')
    // 折叠态本身不触发取数（effect 的决策点仍是 enterpriseUsageFetchDecision）。
    expect(source).toContain('enterpriseUsageFetchDecision({')
  })
})

describe('the details column is a reserved seam, not a dead link', () => {
  it('keeps the hint wording and never navigates on its own', async () => {
    expect(ENTERPRISE_USAGE_DETAILS_HINT).toBe('Token 统计详情页即将上线')
    const source = await readFile(new URL('../src/usage-panel.tsx', import.meta.url), 'utf8')
    // 详情按钮：不可用态（aria-disabled）+ 只给提示；不许出现任何跳转 API 或 href。
    expect(source).toContain('aria-disabled="true"')
    expect(source).toContain('role="group"')
    expect(source).toContain('onOpenUsageDetails')
    expect(source).not.toMatch(/window\.open|location\.(href|assign)|<a\s/)
  })

  it('reuses the existing error-code wording map instead of a second one', async () => {
    const source = await readFile(new URL('../src/usage-panel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('enterpriseErrorDisplay')
    expect(source).not.toContain('ENT_LOCAL_RESPONSE_INVALID:')
    expect(source).not.toMatch(/const\s+\w*MESSAGES\s*[:=]/)
  })
})

describe('the launcher tree renders the inline block it expands', () => {
  it('mounts EnterpriseUsagePanel next to the switch state in account-menu source', async () => {
    const source = await readFile(new URL('../src/account-menu.tsx', import.meta.url), 'utf8')
    // 缺这一行时，展开只翻转本组件状态而树里没有面板元素，表现为静默无效。
    expect(source).toContain('<EnterpriseUsagePanel')
    expect(source).toContain('state={usage.state}')
    expect(source).toContain('usage.expanded')
    // 折叠块不是弹窗：不再有 EnterpriseUsageDialog 这条第二入口。
    expect(source).not.toContain('EnterpriseUsageDialog')
  })

  it('keeps the fixed same-origin paths the Host registers', () => {
    expect(ENTERPRISE_FEEDBACK_LOCAL_PATH).toBe('/enterprise/api/v1/local/feedback')
    expect(ENTERPRISE_HELP_OPEN_LOCAL_PATH).toBe('/enterprise/api/v1/local/help/open')
  })
})
