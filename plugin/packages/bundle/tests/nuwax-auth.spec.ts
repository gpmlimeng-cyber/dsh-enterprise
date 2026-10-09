/**
 * [INPUT]: 依赖 `src/nuwax-auth.ts` 的登录/会话/上限常量与 `src/account-origin.ts` 的默认域，`tests/nuwax-support.ts` 的临时 dshHome 隔离，以及 `node:fs/promises` 读源码做反锁；HTTP 反应由**真实 `Response`** 构造（不打真网）
 * [OUTPUT]: 锁定插件侧 NUWAX 员工登录内核：口令登录 → 票据 → 自证取主体的完整链路与请求形状（`phone` 字段、第二轮带 cookie）、六枚稳定码的每一条触发路径（凭据错 / 平台拒绝+码净化 / 5xx / 网络 / 超时 / 协议）、过期时刻三级优先级（cookie Max-Age > `expireDate` UTC+8 > 兜底）与荒谬值兜底、origin 决议四条（默认 / 覆盖 / 空串停用 / 非法形状）、会话持有者五条语义（登录态、`current`、过期即登出、单飞、失败不缓存、登出不复活）、以及两条源码级反锁（**内核零 `console`／不写日志文件**；落盘纪律 0o700/0o600/临时件+rename 且顺序不反）。★**本刀的落盘行为本身**由 `tests/nuwax-session.spec.ts` 单独锁（跨重启恢复、origin 不按新配置重算、坏状态 fail-closed、`logout()` 删盘、口令绝不落盘），本份只负责 HTTP/判定面
 * [POS]: 口径 29「插件侧员工登录」的回归门禁；有人把口令写进错误消息、把重定向放开、把落盘件的键集放宽，或把"过期"当"仍有效"，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ACCOUNT_ORIGIN } from '../src/account-origin.js'
import {
  createNuwaxSessionHolder,
  DEFAULT_NUWAX_ORIGIN,
  loginNuwaxAccount,
  NUWAX_FALLBACK_SESSION_TTL_MS,
  NUWAX_MAX_RESPONSE_BYTES,
  NUWAX_ORIGIN_ENV,
  normalizeNuwaxOrigin,
  resolveNuwaxOrigin,
  type NuwaxAuthDependencies,
} from '../src/nuwax-auth.js'
import { disposeNuwaxTempHomes, nuwaxTempHome } from './nuwax-support.js'

const ORIGIN = 'https://nuwax.example.com'
const ACCOUNT = '412566213@qq.com'
const PASSWORD = 'super-secret-passphrase'
const TICKET = 'jwt-ticket-value'
const UID = 1_784_006_361

/**
 * 每份 holder 夹具一份**自己的**临时 dshHome。
 *
 * ★不是洁癖，是必需：会话持有者带落盘（`<dshHome>/enterprise/nuwax-session.json`），若不隔离，
 * 本 spec 登录写下的票据会被后面那份 spec 构造 holder 时当成"重启后的登录态"读回来（本仓真跑过一次）。
 */
async function isolatedHome(): Promise<string> {
  return await nuwaxTempHome('auth')
}

afterEach(async () => {
  await disposeNuwaxTempHomes()
})

/** 记下每一次请求，供形状断言与"谁被调了几次"的反锁用。 */
interface RecordedCall {
  readonly url: string
  readonly init: RequestInit | undefined
}

/** 造一个脚本化的 `fetch`：按调用序交回反应，并把每次调用的 url/init 留档。 */
function scriptedFetch(
  handler: (call: RecordedCall, index: number) => Response | Promise<Response>,
): { readonly calls: readonly RecordedCall[]; readonly fetch: NuwaxAuthDependencies['fetch'] } {
  const calls: RecordedCall[] = []
  return {
    calls,
    fetch: async (input: string, init?: RequestInit): Promise<Response> => {
      const call: RecordedCall = { url: input, init }
      calls.push(call)
      return await handler(call, calls.length - 1)
    },
  }
}

/** 平台信封反应（`{code, message, data}`）。 */
function envelope(payload: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

/** 一次成功的登录（第一轮出票据 cookie，第二轮出自证主体）。 */
function successfulPlatform(): ReturnType<typeof scriptedFetch> {
  return scriptedFetch(call => call.url.endsWith('/api/user/passwordLogin')
    ? envelope(
      { code: '0000', message: '成功', data: { token: 'jwt-from-body', expireDate: '2026-10-13 15:18:15' } },
      { 'set-cookie': `ticket=${TICKET}; Max-Age=604800; HttpOnly; Secure; SameSite=None` },
    )
    : envelope({ code: '0000', message: '成功', data: { uid: UID, userName: '538565', nickName: '李猛', tenantId: 1 } }))
}

/** 从错误里取稳定码（形状断言用）。 */
function codeOf(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code
}

describe('nuwax-auth：部署配置 → origin', () => {
  it('没配环境变量时回落到企业默认域（开箱可用）', () => {
    expect(resolveNuwaxOrigin({})).toBe(DEFAULT_NUWAX_ORIGIN)
    expect(DEFAULT_NUWAX_ORIGIN).toContain('agent.sunoasis.com.cn')
  })

  it('环境变量覆盖默认域，并归一化（大小写/默认端口/尾斜杠）', () => {
    expect(resolveNuwaxOrigin({ [NUWAX_ORIGIN_ENV]: 'https://Nuwax.Example.com:443/' })).toBe(ORIGIN)
  })

  it('空白 = 显式停用（绝不悄悄回落默认域，否则口令会发到用户没指定的地方）', () => {
    expect(() => resolveNuwaxOrigin({ [NUWAX_ORIGIN_ENV]: '   ' })).toThrowError()
    try {
      resolveNuwaxOrigin({ [NUWAX_ORIGIN_ENV]: '   ' })
    } catch (error) {
      expect(codeOf(error)).toBe('ENT_NUWAX_NOT_CONFIGURED')
    }
  })

  it('形状非法（带路径 / 明文非回环 http / 带凭据）一律 fail-closed 成"未配置"', () => {
    for (const value of ['https://nuwax.example.com/api', 'http://nuwax.example.com', 'https://u:p@nuwax.example.com']) {
      expect(() => normalizeNuwaxOrigin(value)).toThrowError()
      try {
        normalizeNuwaxOrigin(value)
      } catch (error) {
        expect(codeOf(error)).toBe('ENT_NUWAX_NOT_CONFIGURED')
      }
    }
    // 回环明文是唯一放行的 http（与账户后台地址同一套规则）。
    expect(normalizeNuwaxOrigin('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080')
  })

  it('origin 规则复用账户后台那一份实现：同一输入两边结果逐字相同', () => {
    // 唯一分歧是空值语义（这里停用、那边回落企业默认域），故只比非空输入。
    const value = 'https://NuWax.Example.com:443/'
    expect(normalizeNuwaxOrigin(value)).toBe(ORIGIN)
    expect(DEFAULT_ACCOUNT_ORIGIN).not.toBe(DEFAULT_NUWAX_ORIGIN)
  })
})

describe('nuwax-auth：口令登录 → 票据 → 自证', () => {
  it('打通两步链路，请求形状正确（phone 字段 + cookie 自证）', async () => {
    const platform = successfulPlatform()
    const session = await loginNuwaxAccount(ACCOUNT, PASSWORD, {
      fetch: platform.fetch,
      origin: ORIGIN,
      now: () => 1_000_000,
    })

    expect(session.ticket).toBe(TICKET)
    expect(session.principal).toEqual({ uid: UID, userName: '538565', nickName: '李猛', tenantId: 1 })
    // 过期时刻取 cookie 的 Max-Age（时区无关那一份），不是正文里的 expireDate。
    expect(session.expiresAt).toBe(1_000_000 + 604_800_000)

    expect(platform.calls).toHaveLength(2)
    expect(platform.calls[0]?.url).toBe(`${ORIGIN}/api/user/passwordLogin`)
    expect(platform.calls[0]?.init?.method).toBe('POST')
    expect(platform.calls[0]?.init?.body).toBe(JSON.stringify({ phone: ACCOUNT, password: PASSWORD }))
    expect(platform.calls[0]?.init?.redirect).toBe('manual')
    expect(platform.calls[1]?.url).toBe(`${ORIGIN}/api/user/getLoginInfo`)
    expect(platform.calls[1]?.init?.method).toBe('GET')
    expect((platform.calls[1]?.init?.headers as Record<string, string>)['cookie']).toBe(`ticket=${TICKET}`)
  })

  it('正文里的 token 是 cookie 缺席时的回退（平台两种形状都收）', async () => {
    const platform = scriptedFetch(call => call.url.endsWith('/api/user/passwordLogin')
      ? envelope({ code: '0000', data: { token: 'jwt-from-body' } })
      : envelope({ code: '0000', data: { uid: UID, userName: 'u', nickName: 'n', tenantId: 3 } }))
    const session = await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: platform.fetch, origin: ORIGIN, now: () => 0 })
    expect(session.ticket).toBe('jwt-from-body')
    expect(session.principal.tenantId).toBe(3)
  })

  it('中文昵称与纯数字串 uid 都按平台实测形状收下', async () => {
    const platform = scriptedFetch(call => call.url.endsWith('/api/user/passwordLogin')
      ? envelope({ code: '0000', data: { token: 'T' } })
      : envelope({ code: '0000', data: { uid: '1784006361', userName: '538565', nickName: '李猛', tenantId: '1' } }))
    const session = await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: platform.fetch, origin: ORIGIN, now: () => 0 })
    expect(session.principal.uid).toBe(UID)
  })
})

describe('nuwax-auth：失败面（六枚稳定码逐条）', () => {
  it('口令不对 = 凭据码，且**不再**打第二轮、消息里没有口令', async () => {
    const platform = scriptedFetch(() => envelope({ code: '0001', message: '用户不存在或密码错误' }))
    const error = await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: platform.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown)
    expect(codeOf(error)).toBe('ENT_NUWAX_INVALID_CREDENTIALS')
    expect(String((error as Error).message)).not.toContain(PASSWORD)
    expect(JSON.stringify(error)).not.toContain(PASSWORD)
    expect(platform.calls).toHaveLength(1)
  })

  it('平台业务码只保留净化后的码（自由文本一律不进消息）', async () => {
    const hostile = scriptedFetch(() => envelope({ code: '<script>alert(1)</script>', message: 'boom' }))
    const first = await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: hostile.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown)
    expect(codeOf(first)).toBe('ENT_NUWAX_REJECTED')
    expect(String((first as Error).message)).toContain('unknown')
    expect(String((first as Error).message)).not.toContain('<script>')

    const business = scriptedFetch(() => envelope({ code: 'A000004', message: '技能不存在' }))
    const second = await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: business.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown)
    expect(String((second as Error).message)).toContain('A000004')
    expect(String((second as Error).message)).not.toContain('技能不存在')
  })

  it('自证那一轮被平台拒 = 平台拒绝（票据拿到了也不算登录成功）', async () => {
    const platform = scriptedFetch(call => call.url.endsWith('/api/user/passwordLogin')
      ? envelope({ code: '0000', data: { token: TICKET } })
      : envelope({ code: '4010', message: '未登录' }))
    const error = await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: platform.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown)
    expect(codeOf(error)).toBe('ENT_NUWAX_REJECTED')
  })

  it('HTTP 5xx / 4xx / 3xx 分别是不可达 / 平台拒绝 / 协议错（且 3xx 绝不跟随）', async () => {
    const unavailable = scriptedFetch(() => new Response('nope', { status: 503 }))
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: unavailable.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_UNAVAILABLE')

    const refused = scriptedFetch(() => new Response('nope', { status: 403 }))
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: refused.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_REJECTED')

    const redirect = scriptedFetch(() => new Response(null, { status: 302, headers: { location: 'https://evil.example.com/' } }))
    const error = await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: redirect.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown)
    expect(codeOf(error)).toBe('ENT_NUWAX_PROTOCOL')
    expect(redirect.calls.every(call => call.url.startsWith(ORIGIN))).toBe(true)
  })

  it('网络异常 = 不可达；被 abort = 超时（两枚码的下一步不同）', async () => {
    const broken = scriptedFetch(() => { throw new TypeError('fetch failed') })
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: broken.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_UNAVAILABLE')

    const hanging = scriptedFetch((_call, _index) => new Promise<Response>((_resolve, reject) => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      reject(error)
    }))
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, {
      fetch: hanging.fetch, origin: ORIGIN, now: () => 0, timeoutMs: 5,
    }).then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_TIMEOUT')
  })

  it('非 JSON / 没有 code / 成功却没票据 / 缺主体字段 都判协议错', async () => {
    const html = scriptedFetch(() => new Response('<html>gateway</html>', { status: 200 }))
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: html.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_PROTOCOL')

    const noCode = scriptedFetch(() => envelope({ message: 'ok' }))
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: noCode.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_PROTOCOL')

    const noTicket = scriptedFetch(() => envelope({ code: '0000', data: { uid: UID } }))
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: noTicket.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_PROTOCOL')

    const noProfile = scriptedFetch(call => call.url.endsWith('/api/user/passwordLogin')
      ? envelope({ code: '0000', data: { token: TICKET } })
      : envelope({ code: '0000', data: { uid: UID } }))
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: noProfile.fetch, origin: ORIGIN, now: () => 0 })
      .then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_PROTOCOL')
  })

  it('响应正文超上限即拒（读到超限当场放弃，不是读完整段再判）', async () => {
    const huge = scriptedFetch(() => envelope({ code: '0000', data: { token: 'x'.repeat(4096) } }))
    expect(codeOf(await loginNuwaxAccount(ACCOUNT, PASSWORD, {
      fetch: huge.fetch, origin: ORIGIN, now: () => 0, maxBytes: 256,
    }).then(() => undefined, (thrown: unknown) => thrown))).toBe('ENT_NUWAX_PROTOCOL')
    expect(NUWAX_MAX_RESPONSE_BYTES).toBeGreaterThan(1024)
  })

  it('账号/口令形状不合 = 请求不合法（TypeError→400），不是"凭据不对"', async () => {
    const platform = successfulPlatform()
    for (const [account, password] of [['', PASSWORD], [ACCOUNT, ''], ['x'.repeat(321), PASSWORD], [ACCOUNT, 'y'.repeat(1025)]]) {
      const error = await loginNuwaxAccount(account as string, password as string, {
        fetch: platform.fetch, origin: ORIGIN, now: () => 0,
      }).then(() => undefined, (thrown: unknown) => thrown)
      expect(error).toBeInstanceOf(TypeError)
      expect(codeOf(error)).toBeUndefined()
    }
    expect(platform.calls).toHaveLength(0)
  })
})

describe('nuwax-auth：过期时刻三级优先级', () => {
  it('没有 Max-Age 时按平台 expireDate（UTC+8）解释，结果与机器时区无关', async () => {
    const platform = scriptedFetch(call => call.url.endsWith('/api/user/passwordLogin')
      ? envelope({ code: '0000', data: { token: TICKET, expireDate: '2026-10-13 15:18:15' } })
      : envelope({ code: '0000', data: { uid: UID, userName: 'u', nickName: 'n', tenantId: 1 } }))
    const session = await loginNuwaxAccount(ACCOUNT, PASSWORD, {
      fetch: platform.fetch, origin: ORIGIN, now: () => Date.UTC(2026, 9, 6, 7, 18, 15),
    })
    // 平台时间 2026-10-13 15:18:15 (UTC+8) === 2026-10-13T07:18:15Z
    expect(session.expiresAt).toBe(Date.UTC(2026, 9, 13, 7, 18, 15))
  })

  it('两种信息都没有 / 荒谬值（已过期、超 30 天）一律兜底十分钟', async () => {
    for (const expireDate of [undefined, '2020-01-01 00:00:00', '2099-01-01 00:00:00', 'not-a-date']) {
      const platform = scriptedFetch(call => call.url.endsWith('/api/user/passwordLogin')
        ? envelope({ code: '0000', data: { token: TICKET, ...(expireDate === undefined ? {} : { expireDate }) } })
        : envelope({ code: '0000', data: { uid: UID, userName: 'u', nickName: 'n', tenantId: 1 } }))
      const session = await loginNuwaxAccount(ACCOUNT, PASSWORD, { fetch: platform.fetch, origin: ORIGIN, now: () => 1_000 })
      expect(session.expiresAt).toBe(1_000 + NUWAX_FALLBACK_SESSION_TTL_MS)
    }
  })
})

describe('nuwax-auth：会话持有者', () => {
  it('登录后可读登录态，票据只在 current() 里（status 绝不带票据）', async () => {
    const platform = successfulPlatform()
    const holder = createNuwaxSessionHolder({ fetch: platform.fetch, origin: ORIGIN, now: () => 0, dshHome: await isolatedHome() })
    expect(holder.status()).toEqual({ state: 'signed-out' })
    expect(holder.current()).toBeUndefined()

    const status = await holder.login(ACCOUNT, PASSWORD)
    expect(status.state).toBe('signed-in')
    expect(status.principal?.nickName).toBe('李猛')
    expect(JSON.stringify(status)).not.toContain(TICKET)
    expect(holder.current()?.ticket).toBe(TICKET)

    holder.logout()
    expect(holder.status()).toEqual({ state: 'signed-out' })
    expect(holder.current()).toBeUndefined()
  })

  it('服务地址是只读投影：决议得出就回它，停用/形状非法回 undefined（登录态照旧、绝不换地址）', async () => {
    expect(createNuwaxSessionHolder({ fetch: successfulPlatform().fetch, origin: ORIGIN, dshHome: await isolatedHome() }).serviceOrigin()).toBe(ORIGIN)
    // 未配置 ⇒ 企业默认域，与 login() 真正打的那一台同一个决议函数。
    expect(createNuwaxSessionHolder({ fetch: successfulPlatform().fetch, env: {}, dshHome: await isolatedHome() }).serviceOrigin()).toBe(DEFAULT_NUWAX_ORIGIN)
    // 显式停用（空串）与形状非法：**不抛**、回 undefined —— login() 那边才是 fail-closed 抛 503。
    for (const value of ['', '   ', 'not-a-url']) {
      const holder = createNuwaxSessionHolder({ fetch: successfulPlatform().fetch, env: { [NUWAX_ORIGIN_ENV]: value }, dshHome: await isolatedHome() })
      expect(holder.serviceOrigin()).toBeUndefined()
      expect(holder.status()).toEqual({ state: 'signed-out' })
    }
  })

  it('过期即登出（不做后台续期：没有托管口令就没有续期的正当性）', async () => {
    const platform = successfulPlatform()
    let now = 0
    const holder = createNuwaxSessionHolder({ fetch: platform.fetch, origin: ORIGIN, now: () => now, dshHome: await isolatedHome() })
    await holder.login(ACCOUNT, PASSWORD)
    expect(holder.status().state).toBe('signed-in')
    now = 604_800_000
    expect(holder.status()).toEqual({ state: 'signed-out' })
    expect(holder.current()).toBeUndefined()
  })

  it('并发登录单飞：两次 login 只打一趟平台', async () => {
    const platform = successfulPlatform()
    const holder = createNuwaxSessionHolder({ fetch: platform.fetch, origin: ORIGIN, now: () => 0, dshHome: await isolatedHome() })
    const [first, second] = await Promise.all([holder.login(ACCOUNT, PASSWORD), holder.login(ACCOUNT, PASSWORD)])
    expect(first.state).toBe('signed-in')
    expect(second.state).toBe('signed-in')
    expect(platform.calls).toHaveLength(2)
  })

  it('失败不缓存：第一次抛错，第二次会说同一句话并且真的重打平台', async () => {
    let attempt = 0
    const platform = scriptedFetch(call => {
      if (call.url.endsWith('/api/user/passwordLogin')) {
        attempt += 1
        if (attempt === 1) return envelope({ code: '0001', message: '用户不存在或密码错误' })
        return envelope({ code: '0000', data: { token: TICKET } }, { 'set-cookie': `ticket=${TICKET}; Max-Age=604800` })
      }
      return envelope({ code: '0000', data: { uid: UID, userName: 'u', nickName: 'n', tenantId: 1 } })
    })
    const holder = createNuwaxSessionHolder({ fetch: platform.fetch, origin: ORIGIN, now: () => 0, dshHome: await isolatedHome() })
    const first = await holder.login(ACCOUNT, PASSWORD).then(() => undefined, (thrown: unknown) => thrown)
    expect(codeOf(first)).toBe('ENT_NUWAX_INVALID_CREDENTIALS')
    expect(holder.status()).toEqual({ state: 'signed-out' })
    expect((await holder.login(ACCOUNT, PASSWORD)).state).toBe('signed-in')
  })

  it('登出后迟到的登录结果被丢弃（绝不复活已登出的凭据）', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const platform = scriptedFetch(async call => {
      if (call.url.endsWith('/api/user/passwordLogin')) {
        await gate
        return envelope({ code: '0000', data: { token: TICKET } }, { 'set-cookie': `ticket=${TICKET}; Max-Age=604800` })
      }
      return envelope({ code: '0000', data: { uid: UID, userName: 'u', nickName: 'n', tenantId: 1 } })
    })
    const holder = createNuwaxSessionHolder({ fetch: platform.fetch, origin: ORIGIN, now: () => 0, dshHome: await isolatedHome() })
    const login = holder.login(ACCOUNT, PASSWORD)
    holder.logout()
    release?.()
    expect((await login).state).toBe('signed-out')
    expect(holder.current()).toBeUndefined()
    expect(holder.status()).toEqual({ state: 'signed-out' })
  })

  it('部署没配平台地址时如实成"未配置"（不是登录失败）', async () => {
    const platform = successfulPlatform()
    const holder = createNuwaxSessionHolder({
      fetch: platform.fetch, env: { [NUWAX_ORIGIN_ENV]: '' }, now: () => 0, dshHome: await isolatedHome(),
    })
    const error = await holder.login(ACCOUNT, PASSWORD).then(() => undefined, (thrown: unknown) => thrown)
    expect(codeOf(error)).toBe('ENT_NUWAX_NOT_CONFIGURED')
    expect(platform.calls).toHaveLength(0)
  })
})

describe('nuwax-auth：源码级反锁', () => {
  it('认证内核不写日志、不出现 console、不落日志文件', async () => {
    const source = await readFile(new URL('../src/nuwax-auth.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/appendFile|writeFileSync\(.*\.log|console\./)
    // 口令只在请求体里出现一次（没有第二处拼装/回显）。
    expect(source.match(/password/g)?.length ?? 0).toBeGreaterThan(0)
  })

  it('落盘纪律与本仓另两份状态文件同构：0o700 目录 + 0o600 文件 + 临时件 + rename', async () => {
    const source = await readFile(new URL('../src/nuwax-auth.ts', import.meta.url), 'utf8')
    // 本刀把「票据不落盘」改成「票据落盘但只落冻结四键」，故这里锁的是**新纪律**而不是旧缺口。
    expect(source).toMatch(/mkdirSync\(dirname\(path\), \{ recursive: true, mode: 0o700 \}\)/)
    expect(source).toMatch(/writeFileSync\(temporary,[\s\S]{0,400}mode: 0o600/)
    expect(source).toMatch(/renameSync\(temporary, path\)/)
    // 原子写必须先写临时件再 rename（顺序反了等于没有原子性）。
    expect(source.indexOf('writeFileSync(temporary')).toBeLessThan(source.indexOf('renameSync(temporary, path)'))
  })
})
