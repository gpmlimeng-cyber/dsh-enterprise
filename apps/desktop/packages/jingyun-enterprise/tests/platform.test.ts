/**
 * [INPUT]: 依赖 vitest、node:fs/os/path、contracts fixture（auth-sources/token/device/bootstrap）、src/platform/* 与 protocol/http
 * [OUTPUT]: 对外提供存储权限与损坏回退、installation、令牌过期与轮换落盘、401 单次重放、登录状态机与 fixture 解析的验收
 * [POS]: E1 控制面的验收裁判；用注入的假 fetch 与假回环回调覆盖状态机，绝不在单测里真开监听端口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { EnterpriseAuthClient } from '../src/platform/auth.js'
import { EnterpriseControlPlane } from '../src/platform/control-plane.js'
import { defaultDeviceName, resolveInstallationId } from '../src/platform/installation.js'
import { EnterpriseStore } from '../src/platform/storage.js'
import { EnterprisePlatformError } from '../src/protocol/envelope.js'
import { EnterpriseHttpClient } from '../src/protocol/http.js'
import type { EnterprisePlatformStatus } from '../src/protocol/types.js'

/** 与 device/bootstrap fixture 逐字一致的 installation。 */
const INSTALLATION_ID = '123e4567-e89b-42d3-a456-426614174000'
const ACCESS_TOKEN = 'fixture-sa-token-value-not-a-secret'
const ROTATED_TOKEN = 'fixture-rotated-token-value-not-secret'
const REFRESH_TOKEN = 'dshr_abcdefghijklmnopqrstuvwxyzABCDEFGH123456789'
const ROTATED_REFRESH = `dshr_${'B'.repeat(43)}`
const UUID_V4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/
const FIXED_NOW = new Date('2026-08-18T08:00:00.000Z')

type Reply = { status?: number; body?: unknown }
type Handler = (url: URL, init: RequestInit) => Reply | Promise<Reply>
interface Call {
  readonly method: string
  readonly path: string
  readonly authorization: string | null
  readonly body: string
}

interface MockFetch {
  readonly impl: typeof globalThis.fetch
  readonly calls: Call[]
  countOf(path: string): number
}

/** 最小假 fetch：按路径分派、记录方法/授权头/正文，绝不触网。 */
function mockFetch(handler: Handler): MockFetch {
  const calls: Call[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const url = new URL(raw)
    const headers = new Headers(init?.headers)
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      authorization: headers.get('authorization'),
      body: typeof init?.body === 'string' ? init.body : '',
    })
    const reply = await handler(url, init ?? {})
    const text = reply.body === undefined ? '' : JSON.stringify(reply.body)
    return new Response(text.length === 0 ? null : text, {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch
  return {
    impl,
    calls,
    countOf: (path: string) => calls.filter((call) => call.path === path).length,
  }
}

const envelope = (data: unknown): unknown => ({ data, requestId: 'req_01ARZ3NDEKTSV4RRFFQ69G5FAV' })
const tokenBody = (overrides: Record<string, unknown> = {}): unknown => envelope({
  accessToken: ACCESS_TOKEN,
  tokenType: 'Bearer',
  expiresIn: 43_200,
  clientId: 'dsh-desktop',
  refreshToken: REFRESH_TOKEN,
  refreshExpiresIn: 2_592_000,
  ...overrides,
})
const errorBody = (code: string, status?: number): Reply => ({
  status: status ?? 401,
  body: { error: { code, message: 'denied', requestId: 'req_01ARZ3NDEKTSV4RRFFQ69G5FAV', retryable: false } },
})

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))

const isoAfter = (base: Date, seconds: number): string =>
  new Date(base.getTime() + seconds * 1_000).toISOString()

let home = ''
let store: EnterpriseStore

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'jingyun-enterprise-'))
  store = new EnterpriseStore({ dshHome: home })
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

/** 写入「地址 + installation + 凭据」的完整本地状态。 */
function seedCredentials(options: { accessExpiresInSeconds: number; refreshToken?: string }): void {
  store.writeConfig({ serverUrl: 'http://127.0.0.1:8080', installationId: INSTALLATION_ID })
  store.writeCredentials({
    accessToken: ACCESS_TOKEN,
    accessTokenExpiresAt: isoAfter(FIXED_NOW, options.accessExpiresInSeconds),
    refreshToken: options.refreshToken ?? REFRESH_TOKEN,
    refreshExpiresIn: 2_592_000,
    clientId: 'dsh-desktop',
  })
}

function createPlane(overrides: {
  fetch: typeof globalThis.fetch
  startCallback?: ConstructorParameters<typeof EnterpriseControlPlane>[0]['startCallback']
  openBrowser?: () => void
}): EnterpriseControlPlane {
  return new EnterpriseControlPlane({
    dshHome: home,
    harnessVersion: '0.2.9',
    bundleVersion: '0.1.0',
    fetch: overrides.fetch,
    openBrowser: overrides.openBrowser ?? ((): void => undefined),
    now: (): Date => new Date(FIXED_NOW),
    store,
    ...(overrides.startCallback === undefined ? {} : { startCallback: overrides.startCallback }),
  })
}

/** 用订阅等待状态机落到目标态；超时即失败，便于定位卡在哪一步。 */
function waitForState(plane: EnterpriseControlPlane, target: string, timeoutMs = 5_000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (plane.status().state === target) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error(`等待 ${target} 超时，当前 ${plane.status().state}`))
    }, timeoutMs)
    const unsubscribe = plane.subscribe((status) => {
      if (status.state !== target) return
      clearTimeout(timer)
      unsubscribe()
      resolve()
    })
  })
}

describe('storage 原子写与权限', () => {
  it('目录为 <dshHome>/enterprise，config.json 0644、credentials.json 0600，且不残留临时文件', () => {
    store.writeConfig({ serverUrl: 'http://127.0.0.1:8080', installationId: INSTALLATION_ID, deviceName: 'Rig (darwin)' })
    store.writeCredentials({
      accessToken: ACCESS_TOKEN,
      accessTokenExpiresAt: isoAfter(FIXED_NOW, 3_600),
      refreshToken: REFRESH_TOKEN,
      refreshExpiresIn: 2_592_000,
      clientId: 'dsh-desktop',
    })
    expect(store.dir).toBe(join(home, 'enterprise'))
    expect(statSync(join(store.dir, 'config.json')).mode & 0o777).toBe(0o644)
    expect(statSync(join(store.dir, 'credentials.json')).mode & 0o777).toBe(0o600)
    expect(readdirSync(store.dir).filter((name) => name.endsWith('.tmp'))).toEqual([])
    expect(store.readConfig().serverUrl).toBe('http://127.0.0.1:8080')
    expect(store.readCredentials().refreshToken).toBe(REFRESH_TOKEN)
  })

  it('writeConfig 以 patch 合并而不是覆盖其它字段', () => {
    store.writeConfig({ serverUrl: 'http://127.0.0.1:8080' })
    store.writeConfig({ deviceName: 'Rig (darwin)' })
    expect(store.readConfig()).toEqual({
      serverUrl: 'http://127.0.0.1:8080',
      installationId: null,
      deviceName: 'Rig (darwin)',
    })
  })

  it('JSON 损坏或字段类型不符时逐字段回退默认值且不抛异常', () => {
    store.writeConfig({})
    writeFileSync(join(store.dir, 'config.json'), '{ not json', 'utf8')
    expect(store.readConfig()).toEqual({ serverUrl: null, installationId: null, deviceName: null })

    writeFileSync(join(store.dir, 'config.json'), JSON.stringify({
      serverUrl: 42, installationId: 'not-a-uuid', deviceName: '',
    }), 'utf8')
    expect(store.readConfig()).toEqual({ serverUrl: null, installationId: null, deviceName: null })

    store.writeCredentials({ accessToken: null, accessTokenExpiresAt: null, refreshToken: null, refreshExpiresIn: null, clientId: 'dsh-desktop' })
    writeFileSync(join(store.dir, 'credentials.json'), JSON.stringify({
      accessToken: 'short',
      accessTokenExpiresAt: 'not-a-date',
      refreshToken: 'plain-token',
      refreshExpiresIn: -1,
      clientId: 'bogus',
    }), 'utf8')
    expect(store.readCredentials()).toEqual({
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: null,
      refreshExpiresIn: null,
      clientId: 'dsh-desktop',
    })
  })

  it('clearCredentials 后凭据为空但文件仍保持 0600', () => {
    seedCredentials({ accessExpiresInSeconds: 3_600 })
    store.clearCredentials()
    expect(store.readCredentials().refreshToken).toBeNull()
    expect(statSync(join(store.dir, 'credentials.json')).mode & 0o777).toBe(0o600)
  })
})

describe('installationId 与设备名', () => {
  it('首次生成 UUIDv4 并持久化，二次调用返回同一值', () => {
    const first = resolveInstallationId(store)
    expect(first).toMatch(UUID_V4)
    expect(resolveInstallationId(store)).toBe(first)
    expect(resolveInstallationId(new EnterpriseStore({ dshHome: home }))).toBe(first)
    expect(store.readConfig().installationId).toBe(first)
  })

  it('已损坏的 installationId 会被重新生成而不是复用', () => {
    store.writeConfig({ installationId: 'not-a-uuid' })
    expect(store.readConfig().installationId).toBeNull()
    expect(resolveInstallationId(store)).toMatch(UUID_V4)
  })

  it('defaultDeviceName 形如 `<hostname> (<platform>)` 且不超过 120 字符', () => {
    const name = defaultDeviceName()
    expect(name.length).toBeGreaterThan(0)
    expect(name.length).toBeLessThanOrEqual(120)
    expect(name).toMatch(/\(.+\)$/)
  })
})

describe('契约 fixture 解析', () => {
  it('auth-sources-success.json 可通过 authorize 事务解析', async () => {
    const source = fixture('auth-sources-success.json')
    const { impl } = mockFetch(() => ({ body: source }))
    const client = new EnterpriseAuthClient(new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetch: impl,
    }))
    const data = await client.createTransaction({
      redirectUri: 'http://127.0.0.1:9/enterprise/auth/callback',
      state: 'state_0123456789abcdefghijklmnopqrstuvwxyz',
      codeChallenge: 'challenge-placeholder-value',
      installationId: INSTALLATION_ID,
    })
    expect(data.transactionId).toBe('tx_01J5T05PKCEDEVICELOGIN0000000')
    expect(data.csrfToken).toBe('csrf_01J5T05PKCEDEVICELOGIN00000')
    expect(data.sources).toEqual([{ id: '1900100000000000001', name: 'Local', type: 'LOCAL' }])
  })

  it('token-success.json 可通过 exchangeToken 解析（两种 grant 共用响应形状）', async () => {
    const body = fixture('token-success.json')
    const { impl } = mockFetch(() => ({ body }))
    const client = new EnterpriseAuthClient(new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetch: impl,
    }))
    const refreshed = await client.exchangeToken({
      grantType: 'refresh_token',
      refreshToken: REFRESH_TOKEN,
      clientId: 'dsh-desktop',
      installationId: INSTALLATION_ID,
    })
    expect(refreshed).toEqual({
      accessToken: ACCESS_TOKEN,
      tokenType: 'Bearer',
      expiresIn: 43_200,
      clientId: 'dsh-desktop',
      refreshToken: REFRESH_TOKEN,
      refreshExpiresIn: 2_592_000,
    })
  })

  it('契约外的令牌形状会被拒绝，不会写进凭据文件', async () => {
    const { impl } = mockFetch(() => ({ body: tokenBody({ refreshToken: 'dshr_too-short' }) }))
    const client = new EnterpriseAuthClient(new EnterpriseHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetch: impl,
    }))
    await expect(client.exchangeToken({
      grantType: 'refresh_token',
      refreshToken: REFRESH_TOKEN,
      clientId: 'dsh-desktop',
      installationId: INSTALLATION_ID,
    })).rejects.toMatchObject({ code: 'ENT_RESPONSE_INVALID' })
  })
})

describe('令牌过期判定与刷新轮换', () => {
  it('过期的 access token 触发轮换，新 refreshToken 在返回前立即落盘', async () => {
    seedCredentials({ accessExpiresInSeconds: -60 })
    const { impl, countOf } = mockFetch((url) => {
      if (url.pathname.endsWith('/auth/v1/token')) {
        return { body: tokenBody({ accessToken: ROTATED_TOKEN, refreshToken: ROTATED_REFRESH }) }
      }
      return { body: fixture('bootstrap-models-success.json') }
    })
    const plane = createPlane({ fetch: impl })
    expect(plane.status().state).toBe('SIGNED_OUT')
    const status = await plane.refresh()
    expect(status.state).toBe('READY')
    expect(plane.accessToken()).toBe(ROTATED_TOKEN)
    // 旧 refreshToken 已作废：文件必须在 refresh() 返回时就持有新值。
    expect(store.readCredentials().refreshToken).toBe(ROTATED_REFRESH)
    expect(store.readCredentials().accessToken).toBe(ROTATED_TOKEN)
    expect(countOf('/enterprise/auth/v1/token')).toBe(1)
  })

  it('轮换后的下一次续期使用新 refreshToken 而不是旧值', async () => {
    seedCredentials({ accessExpiresInSeconds: -60 })
    const bodies: string[] = []
    const { impl } = mockFetch((url, init) => {
      if (url.pathname.endsWith('/auth/v1/token')) {
        bodies.push(typeof init.body === 'string' ? init.body : '')
        return { body: tokenBody({ accessToken: ROTATED_TOKEN, refreshToken: ROTATED_REFRESH }) }
      }
      return { body: fixture('bootstrap-models-success.json') }
    })
    const first = createPlane({ fetch: impl })
    await first.refresh()
    // 第二次进程启动：access token 人为置为已过期，refreshToken 保持轮换后的值。
    store.writeCredentials({
      accessToken: ROTATED_TOKEN,
      accessTokenExpiresAt: isoAfter(FIXED_NOW, -1),
      refreshToken: ROTATED_REFRESH,
      refreshExpiresIn: 2_592_000,
      clientId: 'dsh-desktop',
    })
    const second = createPlane({ fetch: impl })
    await second.refresh()
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toContain(REFRESH_TOKEN)
    expect(bodies[1]).toContain(ROTATED_REFRESH)
    expect(bodies[1]).not.toContain(`"refreshToken":"${REFRESH_TOKEN}"`)
  })

  it('accessTokenExpiresAt 提前 60 秒过期：剩余 30 秒不复用，剩余 120 秒直接复用', async () => {
    seedCredentials({ accessExpiresInSeconds: 30 })
    const thirty = mockFetch((url) => (url.pathname.endsWith('/auth/v1/token')
      ? { body: tokenBody({ accessToken: ROTATED_TOKEN, refreshToken: ROTATED_REFRESH }) }
      : { body: fixture('bootstrap-models-success.json') }))
    expect((await createPlane({ fetch: thirty.impl }).refresh()).state).toBe('READY')
    expect(thirty.countOf('/enterprise/auth/v1/token')).toBe(1)

    seedCredentials({ accessExpiresInSeconds: 120 })
    const hundredTwenty = mockFetch(() => ({ body: fixture('bootstrap-models-success.json') }))
    expect((await createPlane({ fetch: hundredTwenty.impl }).refresh()).state).toBe('READY')
    expect(hundredTwenty.countOf('/enterprise/auth/v1/token')).toBe(0)
  })

  it('中心拒绝续期时落 AUTH_EXPIRED 并清空本地凭据', async () => {
    seedCredentials({ accessExpiresInSeconds: -60 })
    const { impl } = mockFetch(() => errorBody('ENT_AUTH_SESSION_EXPIRED'))
    const status = await createPlane({ fetch: impl }).refresh()
    expect(status.state).toBe('AUTH_EXPIRED')
    expect(status.errorCode).toBe('ENT_AUTH_SESSION_EXPIRED')
    expect(store.readCredentials().refreshToken).toBeNull()
  })
})

describe('401 单次续期重放', () => {
  it('平台请求先 401，轮换一次后重放一次即成功', async () => {
    seedCredentials({ accessExpiresInSeconds: 3_600 })
    let bootstrapCalls = 0
    const { impl, calls, countOf } = mockFetch((url) => {
      if (url.pathname.endsWith('/auth/v1/token')) {
        return { body: tokenBody({ accessToken: ROTATED_TOKEN, refreshToken: ROTATED_REFRESH }) }
      }
      bootstrapCalls += 1
      if (bootstrapCalls === 1) return errorBody('ENT_AUTH_SESSION_EXPIRED')
      return { body: fixture('bootstrap-models-success.json') }
    })
    const plane = createPlane({ fetch: impl })
    const response = await plane.request('/enterprise/api/v1/bootstrap')
    expect(response.status).toBe(200)
    expect(countOf('/enterprise/api/v1/bootstrap')).toBe(2)
    expect(countOf('/enterprise/auth/v1/token')).toBe(1)
    expect(calls).toHaveLength(3)
    // 首次 401 后 Authorization 必须换成轮换出来的新令牌。
    expect(calls[0]?.authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
    expect(calls[2]?.authorization).toBe(`Bearer ${ROTATED_TOKEN}`)
  })

  it('重放后仍然 401 时不再重试（最多一次续期）', async () => {
    seedCredentials({ accessExpiresInSeconds: 3_600 })
    const { impl, countOf } = mockFetch((url) => {
      if (url.pathname.endsWith('/auth/v1/token')) {
        return { body: tokenBody({ accessToken: ROTATED_TOKEN, refreshToken: ROTATED_REFRESH }) }
      }
      return errorBody('ENT_AUTH_SESSION_EXPIRED')
    })
    const plane = createPlane({ fetch: impl })
    // 非 2xx 由 http 层折叠为协议错误；控制面只允许续期一次，绝不无限重试。
    await expect(plane.request('/enterprise/api/v1/bootstrap')).rejects.toMatchObject({
      code: 'ENT_AUTH_SESSION_EXPIRED',
      httpStatus: 401,
    })
    expect(countOf('/enterprise/api/v1/bootstrap')).toBe(2)
    expect(countOf('/enterprise/auth/v1/token')).toBe(1)
  })
})

describe('登录状态机', () => {
  it('UNCONFIGURED → SIGNED_OUT → AUTHORIZING → ENROLLING → BOOTSTRAPPING → READY', async () => {
    store.writeConfig({ installationId: INSTALLATION_ID })
    const { impl } = mockFetch((url) => {
      if (url.pathname.endsWith('/auth/v1/authorize')) return { body: fixture('auth-sources-success.json') }
      if (url.pathname.endsWith('/auth/v1/token')) return { body: tokenBody() }
      if (url.pathname.endsWith('/devices/enroll')) return { body: fixture('device-success.json') }
      if (url.pathname.endsWith('/api/v1/bootstrap')) return { body: fixture('bootstrap-models-success.json') }
      return { status: 404, body: { error: { code: 'ENT_RESOURCE_NOT_FOUND', message: 'missing' } } }
    })
    const plane = createPlane({
      fetch: impl,
      startCallback: async (options) => ({
        redirectUri: 'http://127.0.0.1:9/enterprise/auth/callback',
        waitForCode: async () => ({ code: 'code-from-browser', state: options.expectedState }),
        close: async () => undefined,
      }),
    })
    expect(plane.status().state).toBe('UNCONFIGURED')
    expect(plane.serverUrl()).toBeNull()

    await plane.setServerUrl('http://127.0.0.1:8080/')
    expect(plane.status().state).toBe('SIGNED_OUT')
    expect(plane.serverUrl()).toBe('http://127.0.0.1:8080')

    const observed: string[] = []
    plane.subscribe((status) => {
      observed.push(status.state)
    })
    const flow = await plane.startLogin()
    expect(flow.flowId.length).toBeGreaterThan(0)
    await waitForState(plane, 'READY')

    const status = plane.status()
    expect(status.state).toBe('READY')
    expect(status.platformUrl).toBe('http://127.0.0.1:8080')
    expect(status.revision).toBe(9)
    expect(status.user?.username).toBe('alice')
    expect(status.connectedAt).toBe(FIXED_NOW.toISOString())
    expect(observed).toEqual(['AUTHORIZING', 'ENROLLING', 'BOOTSTRAPPING', 'READY'])

    const snapshot = plane.bootstrap()
    expect(snapshot?.device.installationId).toBe(INSTALLATION_ID)
    expect(snapshot?.models[0]?.alias).toBe('deepseek-chat')
    expect(snapshot?.plugins.assignments[0]?.packageName).toBe('@example/acme-tools')
    expect(snapshot?.sessionPolicy).toEqual({ enabled: false, retentionDays: 90, maxBatchBytes: 1_048_576 })

    // 凭据纪律：令牌只进内存与 0600 凭据文件，状态副本里绝不出现任何令牌。
    expect(plane.accessToken()).toBe(ACCESS_TOKEN)
    expect(store.readCredentials().refreshToken).toBe(REFRESH_TOKEN)
    const serialized = JSON.stringify(status)
    expect(serialized).not.toContain(ACCESS_TOKEN)
    expect(serialized).not.toContain(REFRESH_TOKEN)

    // 已有活动会话时不得改地址：必须先 logout。
    await expect(plane.setServerUrl('http://127.0.0.1:9091')).rejects.toMatchObject({
      code: 'ENT_PERMISSION_DENIED',
    })
    await plane.logout()
    expect(plane.status().state).toBe('SIGNED_OUT')
    expect(plane.accessToken()).toBeNull()
    expect(store.readCredentials().refreshToken).toBeNull()
  })

  it('enroll 返回 REVOKED 落 DEVICE_REVOKED 并作废凭据', async () => {
    store.writeConfig({ serverUrl: 'http://127.0.0.1:8080', installationId: INSTALLATION_ID })
    const { impl } = mockFetch((url) => {
      if (url.pathname.endsWith('/auth/v1/authorize')) return { body: fixture('auth-sources-success.json') }
      if (url.pathname.endsWith('/auth/v1/token')) return { body: tokenBody() }
      if (url.pathname.endsWith('/devices/enroll')) {
        return { body: envelope({ id: '1900200000000000001', installationId: INSTALLATION_ID, status: 'REVOKED' }) }
      }
      return { body: fixture('bootstrap-models-success.json') }
    })
    const plane = createPlane({
      fetch: impl,
      startCallback: async (options) => ({
        redirectUri: 'http://127.0.0.1:9/enterprise/auth/callback',
        waitForCode: async () => ({ code: 'code-from-browser', state: options.expectedState }),
        close: async () => undefined,
      }),
    })
    await plane.startLogin()
    await waitForState(plane, 'DEVICE_REVOKED')
    expect(plane.status().errorCode).toBe('ENT_DEVICE_REVOKED')
    expect(plane.accessToken()).toBeNull()
    expect(store.readCredentials().refreshToken).toBeNull()
  })

  it('用户取消回调落 CANCELLED，且不残留内存令牌', async () => {
    store.writeConfig({ serverUrl: 'http://127.0.0.1:8080', installationId: INSTALLATION_ID })
    const { impl } = mockFetch(() => ({ body: tokenBody() }))
    const plane = createPlane({
      fetch: impl,
      startCallback: async () => ({
        redirectUri: 'http://127.0.0.1:9/enterprise/auth/callback',
        waitForCode: async () => {
          // 真实路径下由 pkce 层在超时/abort/close 时抛出同一错误码。
          throw new EnterprisePlatformError('ENT_AUTH_CANCELLED', '企业登录已取消')
        },
        close: async () => undefined,
      }),
    })
    await plane.startLogin()
    await waitForState(plane, 'CANCELLED')
    expect(plane.status().errorCode).toBe('ENT_AUTH_CANCELLED')
    expect(plane.accessToken()).toBeNull()
  })

  it('无法打开浏览器时落 FAILED（不悬挂在 AUTHORIZING）', async () => {
    store.writeConfig({ serverUrl: 'http://127.0.0.1:8080', installationId: INSTALLATION_ID })
    const { impl } = mockFetch(() => ({ body: tokenBody() }))
    const plane = createPlane({
      fetch: impl,
      openBrowser: () => {
        throw new Error('no browser')
      },
      startCallback: async () => ({
        redirectUri: 'http://127.0.0.1:9/enterprise/auth/callback',
        // 永不结算：本用例的结局必须由 openBrowser 失败决定。
        waitForCode: () => new Promise<{ code: string; state: string }>(() => undefined),
        close: async () => undefined,
      }),
    })
    await plane.startLogin()
    await waitForState(plane, 'FAILED')
    expect(plane.status().errorCode).toBe('ENT_PLATFORM_UNAVAILABLE')
  })

  it('setServerUrl 变更地址时清空旧凭据，非法地址不改变当前状态', async () => {
    seedCredentials({ accessExpiresInSeconds: 3_600 })
    const plane = createPlane({ fetch: mockFetch(() => ({ body: tokenBody() })).impl })
    expect(plane.status().state).toBe('SIGNED_OUT')
    expect(plane.serverUrl()).toBe('http://127.0.0.1:8080')

    await expect(plane.setServerUrl('ftp://127.0.0.1')).rejects.toThrowError(/企业服务地址/)
    await expect(plane.setServerUrl('   ')).rejects.toThrowError(/企业服务地址/)
    expect(plane.serverUrl()).toBe('http://127.0.0.1:8080')
    expect(store.readCredentials().refreshToken).toBe(REFRESH_TOKEN)

    await plane.setServerUrl('http://127.0.0.1:9090/')
    expect(plane.serverUrl()).toBe('http://127.0.0.1:9090')
    expect(store.readConfig().serverUrl).toBe('http://127.0.0.1:9090')
    expect(store.readCredentials().refreshToken).toBeNull()
  })

  it('dispose 释放内存令牌但不删除磁盘上的 refresh grant', async () => {
    seedCredentials({ accessExpiresInSeconds: 3_600 })
    const plane = createPlane({ fetch: mockFetch(() => ({ body: tokenBody() })).impl })
    await plane.dispose()
    expect(plane.accessToken()).toBeNull()
    expect(store.readCredentials().refreshToken).toBe(REFRESH_TOKEN)
    await expect(plane.setServerUrl('http://127.0.0.1:9090')).rejects.toMatchObject({
      code: 'ENT_PLATFORM_DISPOSED',
    })
  })
})

describe('登录事务预创建（GET /authorize）', () => {
  const callbackStub = async (options: { expectedState: string }) => ({
    redirectUri: 'http://127.0.0.1:9/enterprise/auth/callback',
    waitForCode: async () => ({ code: 'code-from-browser', state: options.expectedState }),
    close: async () => undefined,
  })

  it('中心明确 4xx 拒绝时登录立即失败，且不打开浏览器', async () => {
    store.writeConfig({ serverUrl: 'http://127.0.0.1:8080', installationId: INSTALLATION_ID })
    const { impl, countOf } = mockFetch((url) => (url.pathname.endsWith('/auth/v1/authorize')
      ? { status: 400, body: { error: { code: 'ENT_INVALID_REDIRECT_URI', message: 'bad redirect' } } }
      : { body: tokenBody() }))
    const opened: string[] = []
    const plane = createPlane({
      fetch: impl,
      openBrowser: (url?: string) => {
        opened.push(String(url))
      },
      startCallback: callbackStub,
    })
    await plane.startLogin()
    await waitForState(plane, 'FAILED')
    expect(plane.status().errorCode).toBe('ENT_INVALID_REDIRECT_URI')
    expect(opened).toEqual([])
    expect(countOf('/enterprise/auth/v1/token')).toBe(0)
  })

  it('authorize 返回跳转页而非 JSON 信封时不阻断登录（契约允许 dsh-desktop 303）', async () => {
    store.writeConfig({ serverUrl: 'http://127.0.0.1:8080', installationId: INSTALLATION_ID })
    const { impl } = mockFetch((url) => {
      if (url.pathname.endsWith('/auth/v1/authorize')) return { status: 303, body: { redirect: '/login/sources' } }
      if (url.pathname.endsWith('/auth/v1/token')) return { body: tokenBody() }
      if (url.pathname.endsWith('/devices/enroll')) return { body: fixture('device-success.json') }
      return { body: fixture('bootstrap-models-success.json') }
    })
    const plane = createPlane({ fetch: impl, startCallback: callbackStub })
    await plane.startLogin()
    await waitForState(plane, 'READY')
    expect(plane.status().state).toBe('READY')
  })
})

describe('设备绑定与撤销', () => {
  it('bootstrap 回到另一台设备时落 DEVICE_REVOKED 并作废凭据', async () => {
    store.writeConfig({ serverUrl: 'http://127.0.0.1:8080', installationId: INSTALLATION_ID })
    const bootstrap = fixture('bootstrap-models-success.json') as {
      data: { device: { id: string } }
    }
    bootstrap.data.device.id = '1900200000000000999'
    const { impl } = mockFetch((url) => {
      if (url.pathname.endsWith('/auth/v1/authorize')) return { body: fixture('auth-sources-success.json') }
      if (url.pathname.endsWith('/auth/v1/token')) return { body: tokenBody() }
      if (url.pathname.endsWith('/devices/enroll')) return { body: fixture('device-success.json') }
      return { body: bootstrap }
    })
    const plane = createPlane({
      fetch: impl,
      startCallback: async (options) => ({
        redirectUri: 'http://127.0.0.1:9/enterprise/auth/callback',
        waitForCode: async () => ({ code: 'code-from-browser', state: options.expectedState }),
        close: async () => undefined,
      }),
    })
    await plane.startLogin()
    await waitForState(plane, 'DEVICE_REVOKED')
    expect(plane.status().errorCode).toBe('ENT_DEVICE_REVOKED')
    expect(plane.bootstrap()).toBeUndefined()
    expect(store.readCredentials().refreshToken).toBeNull()
  })
})
