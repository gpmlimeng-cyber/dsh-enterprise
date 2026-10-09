/**
 * [INPUT]: 依赖 `src/nuwax-auth.ts` 的会话持有者与落盘坐标（`nuwaxSessionStatePath`/`NUWAX_SESSION_STATE_FILENAME`/`NUWAX_SESSION_STATE_KEYS`/`NUWAX_PRINCIPAL_STATE_KEYS`）、`node:fs/promises` 读真盘与读源码做反向锁；HTTP 反应由**真实 `Response`** 构造（不打真网）
 * [OUTPUT]: 锁定「NUWAX 登录态跨重启恢复」这一刀：登录成功后**落盘**（落点经 `resolveEnterpriseDshHome()`、0o700 目录 + 0o600 文件、临时件 + rename、**无 `.tmp` 残留**、正文**逐字四键**且无口令）、**跨进程重启恢复**（造一个 holder 登录后丢掉，再造第二个 holder 从盘上读回）、恢复出来的 `origin` 仍是**签发时那台**（即便 `env` 已被指到别处）、损坏/键集不符/已过期/读不到四种一律**视为无凭据且删掉文件且不抛**、`logout()` **删掉落盘件**（删不掉则抛稳定码而不是吞掉）、以及「口令绝不落盘」这条源码级反向锁
 * [POS]: 口径 29 那条「票据只在内存」的如实缺口的**接缝**门禁；有人把口令写进落盘件、把恢复出来的 origin 按新配置重算、把坏状态当成崩掉的理由、或者让"退出登录"只退内存不删盘，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createNuwaxSessionHolder,
  NUWAX_ORIGIN_ENV,
  NUWAX_PRINCIPAL_STATE_KEYS,
  NUWAX_SESSION_STATE_FILENAME,
  NUWAX_SESSION_STATE_KEYS,
  nuwaxSessionStatePath,
  type NuwaxAuthDependencies,
} from '../src/nuwax-auth.js'

const ISSUER_ORIGIN = 'https://nuwax.example.com'
const OTHER_ORIGIN = 'https://elsewhere.example.org'
const ACCOUNT = '412566213@qq.com'
const PASSWORD = 'super-secret-passphrase'
const TICKET = 'jwt-ticket-value'
const UID = 1_784_006_361
const TTL_MS = 604_800_000

const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-nuwax-session-'))
  homes.push(path)
  return path
}

/** 落点：`<dshHome>/enterprise/nuwax-session.json`（与另外两份状态文件同层）。 */
function statePath(dshHome: string): string {
  return nuwaxSessionStatePath({ dshHome })
}

/** 一次成功的平台往返（登录 + 自证），票据固定 `TICKET`。 */
function platform(): NuwaxAuthDependencies['fetch'] {
  return async (input: string): Promise<Response> => input.endsWith('/api/user/passwordLogin')
    ? new Response(JSON.stringify({ code: '0000', data: { token: 'jwt-from-body' } }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': `ticket=${TICKET}; Max-Age=${TTL_MS / 1000}; HttpOnly; Secure`,
      },
    })
    : new Response(JSON.stringify({ code: '0000', data: { uid: UID, userName: '538565', nickName: '李猛', tenantId: 1 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
}

/** 从错误里取稳定码。 */
function codeOf(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code
}

/** 手写一份落盘正文（测试要有能力造出**形状不对**的那些）。 */
async function writeState(dshHome: string, body: unknown): Promise<string> {
  const path = statePath(dshHome)
  await mkdir(join(dshHome, 'enterprise'), { recursive: true })
  await writeFile(path, typeof body === 'string' ? body : JSON.stringify(body), { encoding: 'utf8' })
  return path
}

/** 一份形状合规的落盘正文（供"只坏一处"的用例复用）。 */
function validState(now: number, origin = ISSUER_ORIGIN): Record<string, unknown> {
  return {
    ticket: TICKET,
    expiresAt: now + TTL_MS,
    origin,
    principal: { uid: UID, userName: '538565', nickName: '李猛', tenantId: 1 },
  }
}

describe('nuwax-session：登录成功即落盘', () => {
  it('落点经 resolveEnterpriseDshHome 决议成 <dshHome>/enterprise/nuwax-session.json（目录 0700 / 文件 0600）', async () => {
    const dshHome = await makeHome()
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    expect((await holder.login(ACCOUNT, PASSWORD)).state).toBe('signed-in')

    const path = statePath(dshHome)
    expect(path).toBe(join(dshHome, 'enterprise', NUWAX_SESSION_STATE_FILENAME))
    expect(NUWAX_SESSION_STATE_FILENAME).toContain('nuwax')
    const mode = (await stat(path)).mode & 0o777
    expect(mode).toBe(0o600)
    expect(((await stat(join(dshHome, 'enterprise'))).mode & 0o777)).toBe(0o700)
  })

  it('正文逐字四键、principal 再逐字四键，且临时件一个都不残留（临时件 + rename 原子落）', async () => {
    const dshHome = await makeHome()
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    await holder.login(ACCOUNT, PASSWORD)

    const parsed = JSON.parse(await readFile(statePath(dshHome), 'utf8')) as Record<string, unknown>
    expect(Object.keys(parsed).sort().join(',')).toBe(NUWAX_SESSION_STATE_KEYS)
    expect(Object.keys(parsed['principal'] as Record<string, unknown>).sort().join(',')).toBe(NUWAX_PRINCIPAL_STATE_KEYS)
    expect(parsed['ticket']).toBe(TICKET)
    expect(parsed['origin']).toBe(ISSUER_ORIGIN)
    expect(parsed['expiresAt']).toBe(TTL_MS)
    expect(await readdir(join(dshHome, 'enterprise'))).toEqual([NUWAX_SESSION_STATE_FILENAME])
  })

  it('两份状态文件同层（不新造一个目录树：与 skill-install / preset-authorization 同一层）', async () => {
    const dshHome = await makeHome()
    await mkdir(join(dshHome, 'enterprise'), { recursive: true })
    await writeFile(join(dshHome, 'enterprise', 'installed.json'), '{}', { encoding: 'utf8' })
    await writeFile(join(dshHome, 'enterprise', 'authorizations.json'), '{}', { encoding: 'utf8' })
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    await holder.login(ACCOUNT, PASSWORD)
    expect((await readdir(join(dshHome, 'enterprise'))).sort())
      .toEqual(['authorizations.json', 'installed.json', NUWAX_SESSION_STATE_FILENAME])
  })

  it('登录失败不落盘（失败不缓存那条纪律在盘上同样成立）', async () => {
    const dshHome = await makeHome()
    const rejected: NuwaxAuthDependencies['fetch'] = async () =>
      new Response(JSON.stringify({ code: '0001', message: '用户不存在或密码错误' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    const holder = createNuwaxSessionHolder({ fetch: rejected, origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    expect(codeOf(await holder.login(ACCOUNT, PASSWORD).then(() => undefined, (e: unknown) => e)))
      .toBe('ENT_NUWAX_INVALID_CREDENTIALS')
    await expect(readFile(statePath(dshHome), 'utf8')).rejects.toThrowError()
    // 连 `enterprise/` 目录都不建（没登录成功就没有任何写副作用）。
    await expect(stat(join(dshHome, 'enterprise'))).rejects.toThrowError()
  })
})

describe('nuwax-session：跨进程重启恢复', () => {
  it('丢掉第一个 holder 后，第二个 holder 直接从落盘件恢复出已登录态（零网络调用）', async () => {
    const dshHome = await makeHome()
    const first = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    await first.login(ACCOUNT, PASSWORD)

    // 模拟进程重启：第一个 holder 连同它的内存全部作废，第二个是全新构造的。
    const failing: NuwaxAuthDependencies['fetch'] = async () => { throw new Error('restart must not need the network') }
    const second = createNuwaxSessionHolder({ fetch: failing, origin: ISSUER_ORIGIN, dshHome, now: () => 0 })

    expect(second.status()).toEqual({ state: 'signed-in', principal: { uid: UID, userName: '538565', nickName: '李猛', tenantId: 1 }, expiresAt: TTL_MS })
    expect(second.current()?.ticket).toBe(TICKET)
    expect(second.status().state).toBe('signed-in')
  })

  it('恢复出来的 origin 仍是签发时那台：env 已被指到别处也绝不重算（票据只发回签发它的那一台）', async () => {
    const dshHome = await makeHome()
    const issuer = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    await issuer.login(ACCOUNT, PASSWORD)

    // 重启后部署配置已经改指另一个域（这正是"按当前配置重新决议"会把票据交给第二个域的场景）。
    const failing: NuwaxAuthDependencies['fetch'] = async () => { throw new Error('restored session must not re-login') }
    const restored = createNuwaxSessionHolder({
      fetch: failing,
      env: { [NUWAX_ORIGIN_ENV]: OTHER_ORIGIN },
      dshHome,
      now: () => 0,
    })

    expect(restored.current()?.origin).toBe(ISSUER_ORIGIN)
    expect(restored.current()?.origin).not.toBe(OTHER_ORIGIN)
    // 服务地址投影读的是**当前配置**（界面显示"这次打到哪台"），与票据归属地是两个不同的事实。
    expect(restored.serviceOrigin()).toBe(OTHER_ORIGIN)
  })

  it('没有落盘件时构造 holder 不做任何写（目录都不建）', async () => {
    const dshHome = await makeHome()
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    expect(holder.status()).toEqual({ state: 'signed-out' })
    expect(holder.current()).toBeUndefined()
    await expect(stat(join(dshHome, 'enterprise'))).rejects.toThrowError()
  })
})

describe('nuwax-session：坏状态一律视为无凭据（fail-closed 且不抛）', () => {
  const cases: readonly { readonly label: string, readonly body: unknown, readonly now?: number }[] = [
    { label: '不是 JSON', body: 'not-json{' },
    { label: '不是对象（数组）', body: [] },
    { label: '少一个键（无 ticket）', body: (now: number) => { const s = validState(now); delete s['ticket']; return s } },
    { label: '多一个键（塞了 password）', body: (now: number) => ({ ...validState(now), password: 'leaked' }) },
    { label: 'ticket 不是非空字符串', body: (now: number) => ({ ...validState(now), ticket: '' }) },
    { label: 'expiresAt 不是有限数', body: (now: number) => ({ ...validState(now), expiresAt: 'tomorrow' }) },
    { label: 'origin 形状非法', body: (now: number) => ({ ...validState(now), origin: 'https://u:p@nuwax.example.com' }) },
    { label: 'principal 少一个键', body: (now: number) => ({ ...validState(now), principal: { uid: UID, userName: 'u', nickName: 'n' } }) },
    { label: 'principal 多一个键', body: (now: number) => ({ ...validState(now), principal: { uid: UID, userName: 'u', nickName: 'n', tenantId: 1, isAdmin: true } }) },
    { label: 'uid 不是正整数', body: (now: number) => ({ ...validState(now), principal: { uid: 0, userName: 'u', nickName: 'n', tenantId: 1 } }) },
  ]

  for (const testCase of cases) {
    it(`${testCase.label} ⇒ 按没登录处理、删掉文件、且不抛`, async () => {
      const dshHome = await makeHome()
      const now = 0
      const body = typeof testCase.body === 'function'
        ? (testCase.body as (n: number) => unknown)(now)
        : testCase.body
      const path = await writeState(dshHome, body)

      const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => now })
      expect(holder.status()).toEqual({ state: 'signed-out' })
      expect(holder.current()).toBeUndefined()
      expect(holder.serviceOrigin()).toBe(ISSUER_ORIGIN)
      await expect(stat(path)).rejects.toThrowError()
    })
  }

  it('已过期 ⇒ 视为无凭据且删掉文件，绝不拿过期票据去打平台', async () => {
    const dshHome = await makeHome()
    const path = await writeState(dshHome, validState(0))
    const failing: NuwaxAuthDependencies['fetch'] = async () => { throw new Error('an expired ticket must never be used') }
    const holder = createNuwaxSessionHolder({ fetch: failing, origin: ISSUER_ORIGIN, dshHome, now: () => TTL_MS })

    expect(holder.status()).toEqual({ state: 'signed-out' })
    await expect(stat(path)).rejects.toThrowError()
  })

  it('进程内存里过期的会话也顺手删掉落盘件（下次启动不必再读一次过期事实）', async () => {
    const dshHome = await makeHome()
    let now = 0
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => now })
    await holder.login(ACCOUNT, PASSWORD)
    const path = statePath(dshHome)
    await expect(stat(path)).resolves.toBeTruthy()

    now = TTL_MS
    expect(holder.status()).toEqual({ state: 'signed-out' })
    await expect(stat(path)).rejects.toThrowError()
  })

  it('删不掉那份坏状态时不崩：结论已经是"没登录"（best-effort 有明确判据）', async () => {
    // 目录形态的那份"落盘件"：readFileSync 读目录会抛 EISDIR，按"读不到"处理且不崩插件启动。
    const dshHome = await makeHome()
    const dir = join(dshHome, 'enterprise', NUWAX_SESSION_STATE_FILENAME)
    await mkdir(join(dshHome, 'enterprise'), { recursive: true })
    await mkdir(dir, { recursive: true })
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    expect(holder.status()).toEqual({ state: 'signed-out' })
  })
})

describe('nuwax-session：logout 删落盘件', () => {
  it('登出后落盘件消失，下一个 holder（模拟重启）读不回登录态', async () => {
    const dshHome = await makeHome()
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    await holder.login(ACCOUNT, PASSWORD)

    holder.logout()
    expect(holder.status()).toEqual({ state: 'signed-out' })
    await expect(stat(statePath(dshHome))).rejects.toThrowError()

    const restored = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    expect(restored.status()).toEqual({ state: 'signed-out' })
  })

  it('从未登录时登出是幂等的（文件本来就不存在，不抛）', async () => {
    const dshHome = await makeHome()
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    holder.logout()
    holder.logout()
    expect(holder.status()).toEqual({ state: 'signed-out' })
  })

  it('删不掉落盘件就抛稳定码，而不是把"退出登录"降级成只退内存', async () => {
    const dshHome = await makeHome()
    await mkdir(join(dshHome, 'enterprise'), { recursive: true })
    // 父目录被做成不可进入 ⇒ rmSync 抛；这枚码是"这次退出没成功"的真话，不是静默吞。
    const guard = join(dshHome, 'enterprise')
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    await holder.login(ACCOUNT, PASSWORD)
    const { chmod } = await import('node:fs/promises')
    await chmod(guard, 0o500)
    try {
      const error = (() => { try { holder.logout(); return undefined } catch (thrown: unknown) { return thrown } })()
      expect(codeOf(error)).toBe('ENT_NUWAX_SESSION_STATE_INVALID')
      // 内存那一半已经清掉了（先清内存再删盘），但盘上那份仍在 ⇒ 如实抛。
      expect(holder.current()).toBeUndefined()
    } finally {
      await chmod(guard, 0o700)
    }
  })
})

describe('nuwax-session：口令绝不落盘（源码级反向锁）', () => {
  it('源码里没有任何把 password 写进落盘对象的路径（写盘的那一段只有四个键）', async () => {
    const source = await readFile(new URL('../src/nuwax-auth.ts', import.meta.url), 'utf8')
    // 只取写盘那个函数的函数体（不是全文——全文里 `password: string` 是参数声明，不是落盘字段）。
    const body = /function writePersistedSession\([\s\S]*?\n}\n/.exec(source)?.[0]
    expect(body).toBeTruthy()
    // 落盘那段 JSON.stringify 的字面键集逐字等于冻结四键（而不是"看起来没写 password"）。
    const write = /JSON\.stringify\(\{([\s\S]*?)\}\), \{ encoding: 'utf8', mode: 0o600 \}\)/.exec(body ?? '')
    expect(write).not.toBeNull()
    const keys = [...(write?.[1] ?? '').matchAll(/^\s{6}(\w+):/gm)].map(match => match[1] as string).sort()
    expect(keys.join(',')).toBe(NUWAX_SESSION_STATE_KEYS)
    // 整个写盘函数体里一次都没出现 password（既没有字段，也没有任何把它拼进去的表达式）。
    expect(body).not.toContain('password')
  })

  it('落盘件的整份正文里搜不到口令（真登录一遍再逐字节找）', async () => {
    const dshHome = await makeHome()
    const holder = createNuwaxSessionHolder({ fetch: platform(), origin: ISSUER_ORIGIN, dshHome, now: () => 0 })
    await holder.login(ACCOUNT, PASSWORD)
    const body = await readFile(statePath(dshHome), 'utf8')
    expect(body).not.toContain(PASSWORD)
    expect(body).not.toContain('password')
    expect(body).toContain(TICKET)
  })
})