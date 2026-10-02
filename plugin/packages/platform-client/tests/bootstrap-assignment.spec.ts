/**
 * [INPUT]: 依赖 platform-client 出口上的严格 bootstrap schema（`zBootstrapResponse` / `zBootstrapSnapshot`）与契约
 *           `PluginDescription` 的线协议形态（可选 string ≤300、没有就**整个键缺席**）。
 * [OUTPUT]: 锁四件事——① bootstrap 里的插件分配**认识**新增的可选 `description`：服务端发了就收下并保留；
 *          ② 服务端**不发**这一个键（未升级 / 包里没有描述）时照旧整条通过——这正是「`.strict()` 不认新字段
 *          会把整条 bootstrap 打挂」那个老坑的反向锁；③ 服务端**不许**发 `null`/空串/超长（契约是可选 string，
 *          读不到要**省略该键**），三种形态一律判非法，免得半吊子服务端产出「看起来能过、下游解码炸」的线协议；
 *          ④ 边界：300 字收、301 字拒。
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
      ['301 字', 'x'.repeat(301)],
    ] as const) {
      const parsed = zBootstrapResponse.safeParse({
        data: snapshotWith(assignment({ description })),
        requestId: REQUEST_ID,
      })
      expect(parsed.success, label).toBe(false)
    }
  })

  it('draws the boundary at exactly 300 characters', () => {
    for (const [label, length, valid] of [['300 字', 300, true], ['301 字', 301, false]] as const) {
      const parsed = zBootstrapSnapshot.safeParse(snapshotWith(assignment({ description: 'y'.repeat(length) })))
      expect(parsed.success, label).toBe(valid)
    }
  })
})
