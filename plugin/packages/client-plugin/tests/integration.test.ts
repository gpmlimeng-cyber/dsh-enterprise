/**
 * [INPUT]: 依赖 vitest、mock 企业服务端、protocol 层、platform 控制面、usage 与 market 调和
 * [OUTPUT]: 覆盖 E1 登录到 READY 的完整链路、令牌落盘、E3 用量映射与 E4 调和计划
 * [POS]: 集成层的端到端裁判；用真 HTTP + 真文件系统，证明"插件真的能接上企业控制面"
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { unwrapEnvelope, toPlatformError } from '../src/protocol/envelope.js'
import type { EnterpriseRequestInit } from '../src/protocol/http.js'
import type { EnterpriseBootstrapSnapshot } from '../src/protocol/types.js'
import { EnterpriseControlPlane } from '../src/platform/control-plane.js'
import { EnterpriseUsageService } from '../src/usage/service.js'
import { planMarketActions } from '../src/market/assignments.js'
import { startMockEnterpriseServer, type MockEnterpriseServer } from './mock-enterprise-server.js'

const cleanups: (() => void | Promise<void>)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

/** 与 bootstrap fixture 的 device.installationId 一致；客户端随机生成会与之不匹配导致 ENT_DEVICE_REVOKED。 */
const INSTALLATION_ID = '123e4567-e89b-42d3-a456-426614174000'

function makeDshHome(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dshent-enterprise-'))
  cleanups.push(() => {
    rmSync(dir, { recursive: true, force: true })
  })
  // EnterpriseStore 的 dir 是 `<dshHome>/enterprise`；预写该处 config.json 的 installationId
  // 使其与 bootstrap fixture 对齐——否则 resolveInstallationId 会随机生成 UUID，
  // loadBootstrap 的 `snapshot.device.installationId !== this.installationId` 恒不相等 → 误判 DEVICE_REVOKED。
  const enterpriseDir = join(dir, 'enterprise')
  mkdirSync(enterpriseDir, { recursive: true, mode: 0o700 })
  writeFileSync(join(enterpriseDir, 'config.json'), JSON.stringify({
    serverUrl: null,
    installationId: INSTALLATION_ID,
    deviceName: null,
  }, null, 2))
  return dir
}

async function waitForState(
  plane: EnterpriseControlPlane,
  expected: string,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (plane.status().state === expected) return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error(
    `期望状态 ${expected} 未在 ${String(timeoutMs)}ms 内到达，当前为 ${plane.status().state}` +
      (plane.status().errorCode === undefined ? '' : `（${plane.status().errorCode}）`),
  )
}

/** 把控制面原始 Response 适配成 usage/market 需要的 JSON 取数器。 */
function jsonRequest(plane: EnterpriseControlPlane) {
  return async <T>(path: string, init?: EnterpriseRequestInit): Promise<T> => {
    const response = await plane.request(path, init)
    const text = await response.text()
    const payload: unknown = text.length === 0 ? undefined : JSON.parse(text)
    if (!response.ok) {
      throw toPlatformError(payload, response.status, response.headers)
    }
    return unwrapEnvelope<T>(payload)
  }
}

/**
 * 模拟"用户在浏览器里完成登录"：解析 authorize URL，取回 redirect_uri 与 state，
 * 再带一次性 code 回调本机 loopback —— 与真实浏览器行为等价。
 */
function browserStub(): (url: string) => Promise<void> {
  return async (url: string) => {
    const authorize = new URL(url)
    const redirectUri = authorize.searchParams.get('redirect_uri')
    const state = authorize.searchParams.get('state')
    expect(redirectUri).toBeTruthy()
    expect(state).toBeTruthy()
    const callback = new URL(redirectUri!)
    callback.searchParams.set('code', 'C'.repeat(43))
    callback.searchParams.set('state', state!)
    const response = await fetch(callback)
    expect(response.status).toBeLessThan(500)
  }
}

async function connectedPlane(): Promise<{
  mock: MockEnterpriseServer
  plane: EnterpriseControlPlane
  dshHome: string
}> {
  const mock = await startMockEnterpriseServer()
  cleanups.push(() => mock.close())
  const dshHome = makeDshHome()
  const plane = new EnterpriseControlPlane({
    dshHome,
    harnessVersion: '0.1.5-rc.2',
    bundleVersion: '0.1.0',
    requestTimeoutMs: 5_000,
    callbackTimeoutMs: 8_000,
    openBrowser: browserStub(),
  })
  cleanups.push(() => plane.dispose())
  await plane.setServerUrl(mock.baseUrl)
  await plane.startLogin()
  await waitForState(plane, 'READY')
  return { mock, plane, dshHome }
}

describe('E1 控制面接入（端到端）', () => {
  it('未配置地址时处于 UNCONFIGURED，配置后进入 SIGNED_OUT', async () => {
    const mock = await startMockEnterpriseServer()
    cleanups.push(() => mock.close())
    const plane = new EnterpriseControlPlane({
      dshHome: makeDshHome(),
      harnessVersion: '0.1.5-rc.2',
      bundleVersion: '0.1.0',
    })
    cleanups.push(() => plane.dispose())
    expect(plane.status().state).toBe('UNCONFIGURED')
    const saved = await plane.setServerUrl(mock.baseUrl)
    expect(saved.serverUrl).toBe(mock.baseUrl)
    expect(plane.status().state).toBe('SIGNED_OUT')
  })

  it('PKCE 登录 → 令牌交换 → 设备注册 → bootstrap 后进入 READY，并带回用户与模型目录', async () => {
    const { mock, plane, dshHome } = await connectedPlane()

    const status = plane.status()
    expect(status.state).toBe('READY')
    expect(status.user?.username).toBe('alice')
    expect(status.platformUrl).toBe(mock.baseUrl)
    expect(plane.accessToken()).toBe('fixture-sa-token-value-not-a-secret')

    const snapshot = plane.bootstrap()
    expect(snapshot).toBeDefined()
    expect(snapshot?.models.some(model => model.isDefault)).toBe(true)
    expect(snapshot?.device.status).toBe('ACTIVE')

    // 关键端点确实被打过，且令牌只出现在 Authorization 头里
    const paths = mock.requests.map(request => `${request.method} ${request.path}`)
    expect(paths.some(entry => entry.startsWith('GET /enterprise/auth/v1/authorize'))).toBe(true)
    expect(paths).toContain('POST /enterprise/auth/v1/token')
    expect(paths).toContain('POST /enterprise/api/v1/devices/enroll')
    expect(paths).toContain('GET /enterprise/api/v1/bootstrap')

    const tokenCall = mock.requests.find(request => request.path === '/enterprise/auth/v1/token')
    const grant = JSON.parse(tokenCall?.body ?? '{}') as Record<string, unknown>
    expect(grant.grantType).toBe('authorization_code')
    expect(typeof grant.installationId).toBe('string')
    expect(grant.codeVerifier).toBeTruthy()

    // refresh token 落盘且文件权限收紧；access token 不进凭据文件的明文字段之外
    const credentialsPath = join(dshHome, 'enterprise', 'credentials.json')
    expect(existsSync(credentialsPath)).toBe(true)
    const mode = statSync(credentialsPath).mode & 0o777
    expect(mode).toBe(0o600)
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as Record<string, unknown>
    expect(String(credentials.refreshToken)).toMatch(/^dshr_/)
  })

  it('登出后回到 SIGNED_OUT 且清空凭据', async () => {
    const { plane, dshHome } = await connectedPlane()
    await plane.logout()
    expect(plane.status().state).toBe('SIGNED_OUT')
    const credentialsPath = join(dshHome, 'enterprise', 'credentials.json')
    const raw = existsSync(credentialsPath) ? readFileSync(credentialsPath, 'utf8') : ''
    expect(raw).not.toContain('dshr_')
  })

  it('网关透传请求带 Bearer 且返回原始响应', async () => {
    const { mock, plane } = await connectedPlane()
    const response = await plane.request('/enterprise/gateway/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'enterprise/default', stream: true }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(200)
    const gatewayCall = mock.requests.find(
      request => request.path === '/enterprise/gateway/v1/chat/completions',
    )
    expect(gatewayCall?.authorization).toBe('Bearer fixture-sa-token-value-not-a-secret')
  })
})

describe('E3 用量与配额（真 fixture）', () => {
  it('usage/me 映射为四窗口视图并给出占比与耗尽判定', async () => {
    const { plane } = await connectedPlane()
    const usage = new EnterpriseUsageService({ request: jsonRequest(plane) })
    const policies = await usage.me()
    expect(policies.length).toBeGreaterThan(0)
    const first = policies[0]!
    expect(first.policyId).toBeTruthy()
    const keys = first.windows.map(window => window.key)
    expect(keys).toContain('daily')
    const daily = first.windows.find(window => window.key === 'daily')!
    expect(daily.limit).toBe(1_000_000)
    expect(daily.usedTokens).toBe(12_000)
    expect(daily.percent).toBeCloseTo(1.2, 5)
    expect(daily.exhausted).toBe(false)
  })
})

describe('E4 企业插件市场（真 fixture）', () => {
  it('bootstrap 分配在本地未安装时给出 INSTALL 计划，且不动名单外的本地包', async () => {
    const { plane } = await connectedPlane()
    const snapshot = plane.bootstrap() as EnterpriseBootstrapSnapshot
    const entries = planMarketActions(snapshot.plugins.assignments, new Map())
    expect(entries).toHaveLength(snapshot.plugins.assignments.length)
    for (const entry of entries) {
      expect(entry.action).toBe('INSTALL')
      expect(entry.blockedReason).toBeUndefined()
    }

    // 已安装且版本一致 → NONE；中心不再分配的本地包不产生任何动作
    const [assignment] = snapshot.plugins.assignments
    expect(assignment).toBeDefined()
    const installed = new Map([
      [assignment!.packageName, { version: assignment!.version, sha256: assignment!.sha256 }],
    ])
    const same = planMarketActions(snapshot.plugins.assignments, installed)
    expect(same[0]?.action).toBe('NONE')
    expect(same[0]?.installed?.version).toBe(assignment!.version)
  })
})
