/**
 * [INPUT]: 依赖 platform-client 出口上的严格 bootstrap schema（`zBootstrapResponse` / `zBootstrapSnapshot`）与契约
 *           `PluginDescription` 的线协议形态（可选 string ≤1000、没有就**整个键缺席**）。
 * [OUTPUT]: 锁四件事——① bootstrap 里的插件分配**认识**新增的可选 `description`：服务端发了就收下并保留；
 *          ② 服务端**不发**这一个键（未升级 / 包里没有描述）时照旧整条通过——这正是「`.strict()` 不认新字段
 *          会把整条 bootstrap 打挂」那个老坑的反向锁；③ 服务端**不许**发 `null`/空串/超长（契约是可选 string，
 *          读不到要**省略该键**），三种形态一律判非法，免得半吊子服务端产出「看起来能过、下游解码炸」的线协议；
 *          ④ 边界：1000 字收、1001 字拒；真实上架制品那条 347 字符的描述必须照收（旧的 300 上限正是它在源头被抹成 null 的原因）。
 * [POS]: platform-client 侧「新增线协议字段必须两端同批、且必须为缺失设计」这件事的机械门禁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import { zBootstrapResponse, zBootstrapSnapshot } from '../src/index.js'

const REQUEST_ID = `req_${'0'.repeat(26)}`
const INSTALLATION_ID = '2f1a0c1e-3b4d-4e5f-8a9b-0c1d2e3f4a5b'

/** 与假平台服务端同形的合法 bootstrap 主体；`assignment` 是每个用例唯一要动的部分。 */
function snapshotWith(assignment: Record<string, unknown>): Record<string, unknown> {
  return {
    revision: 7,
    user: { id: '10031', username: 'zhangsan', displayName: 'Zhang San', departmentId: '210' },
    device: { id: '90018', installationId: INSTALLATION_ID, status: 'ACTIVE' },
    models: [{
      alias: 'deepseek-chat', name: 'DeepSeek Chat', apiProtocol: 'openai-completions',
      contextWindow: 65536, maxTokens: 8192, isDefault: true,
    }],
    quotas: [{
      policyId: '73001', scope: 'MEMBER', dailyTokenLimit: 1_000_000,
      resourceType: 'ALL_MODELS', resourceId: null, fiveHourTokenLimit: null,
      weeklyTokenLimit: null, monthlyTokenLimit: 20_000_000, rpm: 20, concurrency: 2,
    }],
    plugins: { revision: 7, assignments: [assignment] },
    sessionPolicy: { enabled: true, retentionDays: 90, maxBatchBytes: 1_048_576 },
  }
}

function assignment(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pluginVersionId: '880', packageName: '@example/dsh-code-review', version: '1.2.0',
    sizeBytes: 4096, sha256: 'a'.repeat(64), signatureBase64: '',
    compatibility: {
      harnessCommits: ['99f6f02fecdb7dff40c3fbc9470f5907c29f74ca'],
      enterpriseBundleRange: '>=0.1.0 <0.2.0',
      operatingSystems: ['darwin', 'linux', 'win32'],
    },
    downloadUrl: '/enterprise/api/v1/plugins/versions/880/download', required: true,
    desiredState: 'INSTALLED',
    ...extra,
  }
}

describe('bootstrap plugin assignment description', () => {
  it('accepts the new optional description and keeps it on the parsed snapshot', () => {
    const parsed = zBootstrapResponse.safeParse({
      data: snapshotWith(assignment({ description: '把代码审查规则带进新会话。' })),
      requestId: REQUEST_ID,
    })
    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data.data.plugins.assignments[0]?.description : undefined)
      .toBe('把代码审查规则带进新会话。')
  })

  it('still accepts a bootstrap from a server that does not send the key at all (未升级的服务端)', () => {
    const parsed = zBootstrapSnapshot.safeParse(snapshotWith(assignment()))
    expect(parsed.success).toBe(true)
    // 缺席 = 没有描述（员工端据此如实降级成「暂无描述」），不是畸形。
    expect(parsed.success ? parsed.data.plugins.assignments[0]?.description : 'sentinel').toBeUndefined()
  })

  it('rejects null, empty, and over-long descriptions: an absent description must be omitted, not faked', () => {
    for (const [label, description] of [
      ['null', null],
      ['空串', ''],
      ['1001 字', 'x'.repeat(1001)],
    ] as const) {
      const parsed = zBootstrapResponse.safeParse({
        data: snapshotWith(assignment({ description })),
        requestId: REQUEST_ID,
      })
      expect(parsed.success, label).toBe(false)
    }
  })

  it('draws the boundary at exactly 1000 characters', () => {
    for (const [label, length, valid] of [['1000 字', 1000, true], ['1001 字', 1001, false]] as const) {
      const parsed = zBootstrapSnapshot.safeParse(snapshotWith(assignment({ description: 'y'.repeat(length) })))
      expect(parsed.success, label).toBe(valid)
    }
  })

  it('accepts the 347-character description that the old 300 cap used to drop at the source', () => {
    // 真值来自真实上架制品 @mengli114/dsh-settings-nav-collapse 的 package.json（长度按码点 = 347）：
    // 旧上限 300 让它在验包那一刻被归一成 null（数据库里一直是 NULL），员工端只能永远「暂无描述」。
    const real = 'DSH web client plugin: one toggle in the settings panel header collapses the settings navigation'
      + ' column into a narrow icon rail, so the settings content keeps a readable width on phones and other narrow'
      + " viewports. The panel is located at runtime from the plugin's own node (no package-internal attribute), and"
      + ' the choice is remembered per browser.'
    expect(real).toHaveLength(347)
    const parsed = zBootstrapSnapshot.safeParse(snapshotWith(assignment({ description: real })))
    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data.plugins.assignments[0]?.description : undefined).toBe(real)
  })
})
