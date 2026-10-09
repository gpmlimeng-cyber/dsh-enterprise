/**
 * [INPUT]: 依赖 `src/skill-self-installed.ts` 的三个内核与端口形状（`uninstall`/`reveal` 被本文件逐条锁定；`edit` 只作为第三条**必需端口**接进 fixture —— 它自己的锁在 `tests/skill-self-installed-edit.spec.ts`）、`src/skill-self-installed-route.ts` 的三条 exact 路由、`src/skill-upload.ts` 的记录读写与 `SELF_INSTALLED_STATE_FILENAME`、`src/skill-install.ts` 的 `deleteOwnedSkillDirectory`/`SKILL_LOCAL_ROOT_SEGMENTS`、`@dshent/platform-client` 的 route port 类型、`tests/engine-route-match.ts` 的引擎语义匹配器与 node:fs/http/crypto
 * [OUTPUT]: 在真实临时 dshHome + 真实 HTTP（引擎语义分发）上锁定本刀：**跨归属**（中心记录认领 ⇒ 404 拒且零删除；两条自装记录认领 ⇒ 409 fail-closed；真正独占才删）、**路径安全**（目录本身符号链接 / 指向技能根之外的链接 / `..` / 绝对路径 / 非 kebab / 非普通目录一律拒且零删除）、**不动别人**（删一个技能时技能根下其它条目逐字节与 mtime 不变、`skills/` 本身不被删）、**原子与幂等**（盘上目录本来就没了 ⇒ 记录照样收干净；写失败 ⇒ 目录原样挪回，绝无半删状态；清单损坏 ⇒ fail-closed）、**一包多技能只删一个目录**（记录保留其余名字）、**`reveal`**（路径只来自记录、目录不在 ⇒ 404、符号链接/越界 ⇒ 409、系统交接失败 ⇒ 503、端口拿到的是宿主自己拼出来的那条路径）、**405 + Allow**、**正文 10 种坏值 400 + 零副作用**，以及**源码级反锁**（递归删除入口恰好一处、`self-installed.json` 写入口恰好一处、两条路径各恰好一处、`execFile` 参数数组无用户输入拼接 / 无 `shell: true` / 无 `exec(`/`execSync`）
 * [POS]: bundle 技能纵深**自装卸载 / 打开所在文件夹**这一刀的回归门禁；有人把跨归属判据删掉、让删除跟随符号链接、先删记录后删目录（中途抛错就留半删）、把 `reveal` 做成"打开任意路径"、或给 `self-installed.json` 长出第二个写者，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 只给「临时件 → self-installed.json」那一次 `rename` 装一个可开可关的失败开关。
 * 其余 `node:fs/promises` 的导出**原样透传**（内核里"目录 → 暂存位"那次 rename 必须成功，才能真的走到记账那一步）。
 */
const fsFailure = vi.hoisted(() => ({ on: false, target: '', rmPrefix: '' }))
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    default: actual,
    rename: async (from: Parameters<typeof actual.rename>[0], to: Parameters<typeof actual.rename>[1]): Promise<void> => {
      if (fsFailure.on && (String(to) === fsFailure.target || (fsFailure.rmPrefix !== '' && String(to).startsWith(fsFailure.rmPrefix)))) {
        throw new Error('simulated self-installed rename failure')
      }
      return await actual.rename(from, to)
    },
  }
})
import type { WebServerRoutePort } from '@dshent/platform-client'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'
import { deleteOwnedSkillDirectory, SKILL_LOCAL_ROOT_SEGMENTS, type EnterpriseSkillInstallPlatformPort } from '../src/skill-install.js'
import {
  installedSelfSkills,
  readSelfInstalledRecords,
  SELF_INSTALLED_STATE_FILENAME,
  upsertSelfInstalledRecord,
  type SelfInstalledSkillRecord,
} from '../src/skill-upload.js'
import {
  revealSelfInstalledSkill,
  uninstallSelfInstalledSkill,
  type EnterpriseFileManagerLauncher,
  type SelfInstalledDependencies,
} from '../src/skill-self-installed.js'
import {
  ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH,
  ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH,
  registerEnterpriseSelfInstalledActionRoutes,
} from '../src/skill-self-installed-route.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UNINSTALL_PATH = ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH
const REVEAL_PATH = ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH
const SELF_STATE_RELATIVE = join('enterprise', 'skill-installs', SELF_INSTALLED_STATE_FILENAME)
const ENTERPRISE_STATE_RELATIVE = join('enterprise', 'skill-installs', 'installed.json')
const SHA = 'a'.repeat(64)
const NOW = '2026-10-06T00:00:00.000Z'
const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-self-uninstall-'))
  homes.push(path)
  return path
}

/**
 * 平台面：本刀的两条路都**不许**碰网络。需要模拟"记账写盘失败"时把 `fail` 打开——
 * 自装清单的写口是 `mkdir`/`writeFile`/`rename`，落盘前会读两个清单，其中 `installed.json` 由平台面提供。
 */
function makePlatform(): { platform: EnterpriseSkillInstallPlatformPort, fail: { on: boolean } } {
  const fail = { on: false }
  return {
    fail,
    platform: {
      request: async () => {
        if (fail.on) throw new Error('simulated enterprise installed.json read failure')
        // 中心清单：真机上由 `/skills/installed` 代取；本刀面**不需要**平台，故一律 404（读成空清单）。
        return new Response('not found', { status: 404 })
      },
    },
  }
}

function options(dshHome: string, platform: EnterpriseSkillInstallPlatformPort, fileManager?: EnterpriseFileManagerLauncher): SelfInstalledDependencies {
  return {
    platform,
    dshHome,
    now: () => new Date(NOW),
    ...(fileManager === undefined ? {} : { fileManager }),
  }
}

/** 往技能根落一个真技能目录（`<dshHome>/skills/<name>/SKILL.md` + 可选附加文件）。 */
async function placeSkill(dshHome: string, name: string, extra: Readonly<Record<string, string>> = {}): Promise<string> {
  const directory = join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS, name)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: 说明\n---\n正文 ${name}\n`, { mode: 0o600 })
  for (const [relative, content] of Object.entries(extra)) {
    const file = join(directory, relative)
    await mkdir(dirname(file), { recursive: true, mode: 0o700 })
    await writeFile(file, content, { mode: 0o600 })
  }
  return directory
}

/** 七键自装记录（与 `skill-upload.ts` 的键集逐字同源）。 */
function record(skillId: string, names: readonly string[], sourceType = 'upload', sourceInput = ''): SelfInstalledSkillRecord {
  return { skillId, displayName: `${skillId} 展示名`, sha256: SHA, names, installedAt: NOW, sourceType, sourceInput }
}

/** 直接写一份自装清单（用来构造"两条记录认领同一个名字"这种只能从盘上出现的形态）。 */
async function writeSelfState(dshHome: string, records: readonly SelfInstalledSkillRecord[]): Promise<void> {
  const path = join(dshHome, SELF_STATE_RELATIVE)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify({ records }), { encoding: 'utf8', mode: 0o600 })
}

/** 直接写一份**中心**已装清单（八键、雪花 id / sha256 / 时间都过那道严格闸门）。 */
async function writeEnterpriseState(dshHome: string, names: readonly string[]): Promise<void> {
  const path = join(dshHome, ENTERPRISE_STATE_RELATIVE)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify({
    records: [{
      packageId: '1902500000000000001',
      skillId: 'enterprise-pkg',
      displayName: '中心技能包',
      versionId: '1902500000000000101',
      sha256: SHA,
      names: [...names],
      installedAt: NOW,
    }],
  }), { encoding: 'utf8', mode: 0o600 })
}

/** 逐条固化技能根下**除 excluded 之外**的全部条目（相对路径 → 内容摘要 + 字节数 + mtime）。 */
async function snapshotTree(root: string, excluded: readonly string[] = []): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>()
  const walk = async (directory: string, relative: string): Promise<void> => {
    const items = await readdir(directory, { withFileTypes: true })
    for (const item of items.sort((left, right) => (left.name < right.name ? -1 : 1))) {
      const child = join(directory, item.name)
      const childRelative = relative === '' ? item.name : `${relative}/${item.name}`
      if (excluded.includes(childRelative)) continue
      const stats = await stat(child)
      if (item.isDirectory()) {
        snapshot.set(`${childRelative}/`, `dir mtime=${stats.mtimeMs}`)
        await walk(child, childRelative)
      } else {
        const bytes = await readFile(child)
        snapshot.set(childRelative, `${createHash('sha256').update(bytes).digest('hex')} size=${bytes.byteLength} mtime=${stats.mtimeMs}`)
      }
    }
  }
  await walk(root, '')
  return snapshot
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

describe('self-installed skill actions over the real local API', () => {
  let routes: RegisteredRoute[] = []
  let server: Server | undefined
  let baseUrl = ''
  let onError: ReturnType<typeof vi.fn>
  let opened: string[] = []
  let fileManager: EnterpriseFileManagerLauncher

  function dispatch(incoming: IncomingMessage, response: ServerResponse): void {
    const pathname = new URL(incoming.url ?? '/', 'http://127.0.0.1').pathname
    const route = engineRouteMatch(routes, pathname)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(incoming, response))
  }

  /** 起一台本地 server：两条真路由 + 一个**假的** `/skills` prefix（证明 exact 优先）交给真 HTTP。 */
  async function serve(dshHome: string, platform: EnterpriseSkillInstallPlatformPort): Promise<void> {
    routes = []
    onError = vi.fn<(message: string, error: unknown) => void>()
    opened = []
    fileManager = { open: async (directory: string) => { opened.push(directory) } }
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        routes.push(registered)
        return () => { routes = routes.filter(route => route !== registered) }
      },
    }
    registerEnterpriseSelfInstalledActionRoutes(webServer, {
      uninstall: name => uninstallSelfInstalledSkill(options(dshHome, platform, fileManager), name),
      reveal: (name, signal) => revealSelfInstalledSkill(options(dshHome, platform, fileManager), name, signal),
      // 第三条必需端口：本文件不驱动它（它的锁在 `skill-self-installed-edit.spec.ts`），
      // 但端口形状是**必需成员** ⇒ fixture 必须如实提供，否则这个 double 就不是真的那条端口。
      edit: async () => ({ edited: true }),
    }, onError)
    // 假的 `/skills` prefix：本刀两条 exact 若没抢在前面，请求会掉进这里（并回 400），测试立刻红。
    webServer.register({
      kind: 'prefix',
      path: '/enterprise/api/v1/local/skills',
      handler: (_request, response) => { response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: 'FELL_INTO_PREFIX' } })) },
    })
    server = createServer(dispatch)
    await new Promise<void>(resolvePromise => server!.listen(0, '127.0.0.1', resolvePromise))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  }

  beforeEach(() => {
    routes = []
    server = undefined
    onError = vi.fn()
    opened = []
  })

  afterEach(async () => {
    if (server !== undefined) await new Promise<void>(resolvePromise => server!.close(() => resolvePromise()))
  })

  /** 发一条本机 POST：默认 `application/json`，可由 `body`/`headers` 覆盖（坏值用例靠它）。 */
  async function post(path: string, body: string, contentType: string | null = 'application/json'): Promise<{ status: number, payload: unknown, allow: string | null }> {
    const headers: Record<string, string> = {}
    if (contentType !== null) headers['content-type'] = contentType
    const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body })
    // 405 的响应体是 `{error:{code}}`，200 是 `{data:…}`：一律当 JSON 读。
    const payload = await response.json() as unknown
    return { status: response.status, payload, allow: response.headers.get('allow') }
  }

  // ── ① 跨归属（本刀要害） ─────────────────────────────────────────────────────
  it('deletes the directory only when this record exclusively owns it, and drops just that name from a multi-skill record', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    await placeSkill(dshHome, 'meeting-notes')
    await placeSkill(dshHome, 'meeting-actions')
    await writeSelfState(dshHome, [record('meeting-pkg', ['meeting-notes', 'meeting-actions'])])
    await serve(dshHome, platform)

    const response = await post(UNINSTALL_PATH, JSON.stringify({ name: 'meeting-notes' }))
    expect(response.status).toBe(200)
    const data = (response.payload as { data: { skills: SelfInstalledSkillRecord[], removed: string[] } }).data
    // ★响应键集闭合：**恰好两键**（内核那枚 `alreadyMissing` 只进 Host 日志，不上屏）。
    expect(Object.keys(data).sort()).toEqual(['removed', 'skills'])
    expect(JSON.stringify(response.payload)).not.toContain('alreadyMissing')
    // ★反向锁：恒空的 `kept` 已按裁决删除，**不许复活**（连键名都不许出现在响应里）。
    expect(JSON.stringify(response.payload)).not.toContain('kept')
    expect(data.removed).toEqual(['meeting-notes'])
    // 独占 ⇒ 目录真的没了；一包多技能 ⇒ **只删这一个**，记录保留其余名字（`skills` 仍是 GET 的逐字同形）。
    expect(await exists(join(dshHome, 'skills', 'meeting-notes'))).toBe(false)
    expect(await exists(join(dshHome, 'skills', 'meeting-actions', 'SKILL.md'))).toBe(true)
    expect(data.skills.map(item => item.skillId)).toEqual(['meeting-pkg'])
    expect(data.skills[0]?.names).toEqual(['meeting-actions'])
    const records = await readSelfInstalledRecords({ platform, dshHome })
    expect(records.map(item => item.names)).toEqual([['meeting-actions']])

    // 最后一个名字被卸掉 ⇒ 整条记录移除（`GET /skills/self-installed` 投影里也不再出现）。
    const last = await post(UNINSTALL_PATH, JSON.stringify({ name: 'meeting-actions' }))
    expect(last.status).toBe(200)
    expect((last.payload as { data: { skills: unknown[] } }).data.skills).toEqual([])
    expect(await readSelfInstalledRecords({ platform, dshHome })).toEqual([])
  })

  it('refuses a name claimed by the enterprise record (404, zero deletion) and a name claimed by two self records (409, fail-closed)', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    await placeSkill(dshHome, 'shared-skill')
    // ① 名字同时被**中心**记录认领：那是一条中心装的东西，本路由管不着 ⇒ 404，且一个字节都不动。
    await writeEnterpriseState(dshHome, ['shared-skill'])
    await writeSelfState(dshHome, [record('self-pkg', ['shared-skill'])])
    await serve(dshHome, platform)
    const byCenter = await post(UNINSTALL_PATH, JSON.stringify({ name: 'shared-skill' }))
    expect(byCenter.status).toBe(404)
    expect((byCenter.payload as { error: { code: string } }).error.code).toBe('ENT_RESOURCE_NOT_FOUND')
    expect(await exists(join(dshHome, 'skills', 'shared-skill', 'SKILL.md'))).toBe(true)
    expect((await readSelfInstalledRecords({ platform, dshHome })).map(item => item.skillId)).toEqual(['self-pkg'])
    // `reveal` 同一条判据（中心的技能不属于这条路由）。
    expect((await post(REVEAL_PATH, JSON.stringify({ name: 'shared-skill' }))).status).toBe(404)
    expect(opened).toEqual([])
    // `deleteOwnedSkillDirectory` 这个唯一删除入口本身**不认识归属**（归属判据在自装那一层）：
    // 直接调它会删掉中心的目录 —— 这正是"判据必须写在调用方"的原因，本断言把这条分工钉死。
    await deleteOwnedSkillDirectory(options(dshHome, platform), 'shared-skill')
    expect(await exists(join(dshHome, 'skills', 'shared-skill'))).toBe(false)

    // ② 名字被**两条自装记录**认领（只能从盘上出现）：fail-closed 拒（409），绝不"猜一条删掉"。
    await placeSkill(dshHome, 'overlap-skill')
    await rm(join(dshHome, ENTERPRISE_STATE_RELATIVE), { force: true })
    await writeSelfState(dshHome, [record('pkg-a', ['overlap-skill']), record('pkg-b', ['overlap-skill'])])
    const overlap = await post(UNINSTALL_PATH, JSON.stringify({ name: 'overlap-skill' }))
    expect(overlap.status).toBe(409)
    expect((overlap.payload as { error: { code: string } }).error.code).toBe('ENT_SKILL_NAME_CONFLICT')
    expect(await exists(join(dshHome, 'skills', 'overlap-skill', 'SKILL.md'))).toBe(true)
    expect((await readSelfInstalledRecords({ platform, dshHome })).map(item => item.skillId)).toEqual(['pkg-a', 'pkg-b'])
    expect((await post(REVEAL_PATH, JSON.stringify({ name: 'overlap-skill' }))).status).toBe(409)
    expect(opened).toEqual([])
  })

  // ── ② 路径安全 ───────────────────────────────────────────────────────────────
  it('rejects symlinked directories, symlinks pointing outside the root, `..`, absolute paths and non-regular entries with zero deletion', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    const root = join(dshHome, 'skills')
    await mkdir(root, { recursive: true, mode: 0o700 })
    // 技能根之外的"别人的东西"：任何一条路径逃逸都不许碰到它。
    const outside = join(dshHome, 'outside-target')
    await mkdir(outside, { recursive: true })
    await writeFile(join(outside, 'keep.txt'), '别人的东西\n')

    // 目录本身是指向技能根之外的符号链接 ⇒ 拒（409），且链接与目标都在。
    await writeSelfState(dshHome, [record('link-pkg', ['linked-skill'])])
    await serve(dshHome, platform)
    await symlink(outside, join(root, 'linked-skill'))
    const linked = await post(UNINSTALL_PATH, JSON.stringify({ name: 'linked-skill' }))
    expect(linked.status).toBe(409)
    expect((linked.payload as { error: { code: string } }).error.code).toBe('ENT_SKILL_CONTENT_INVALID')
    expect(await exists(join(root, 'linked-skill'))).toBe(true)
    expect(await exists(join(outside, 'keep.txt'))).toBe(true)
    expect((await post(REVEAL_PATH, JSON.stringify({ name: 'linked-skill' }))).status).toBe(409)

    // 名字形状：`..` / 绝对路径 / 大写 / 空段 / 超长 / `%` 一律 400（在拼任何路径之前）。
    for (const bad of ['..', '../../etc', '/etc', 'skills/../x', 'Meeting-Notes', 'meeting--notes', 'meeting_notes', 'a/%2e%2e', `${'a'.repeat(65)}`]) {
      const response = await post(UNINSTALL_PATH, JSON.stringify({ name: bad }))
      expect(response.status, bad).toBe(400)
      expect((response.payload as { error: { code: string } }).error.code, bad).toBe('ENT_INVALID_REQUEST')
    }
    expect(await exists(outside)).toBe(true)

    // 普通文件占了技能名（非普通目录）⇒ 409，且那个文件一个字节都不动。
    await writeSelfState(dshHome, [record('file-pkg', ['file-skill'])])
    await writeFile(join(root, 'file-skill'), '不是目录\n')
    const notDirectory = await post(UNINSTALL_PATH, JSON.stringify({ name: 'file-skill' }))
    expect(notDirectory.status).toBe(409)
    expect(await readFile(join(root, 'file-skill'), 'utf8')).toBe('不是目录\n')
  })

  // ── ③ 不动别人 ───────────────────────────────────────────────────────────────
  it('leaves every other entry under the skill root byte-identical (content + mtime) and never removes the root itself', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    await placeSkill(dshHome, 'victim-skill', { 'references/guide.md': '# 指南\n' })
    await placeSkill(dshHome, 'sibling-skill', { 'references/other.md': '# 别的\n' })
    const root = join(dshHome, 'skills')
    // 技能根下的"别的东西"：一个用户手放的普通文件 + 一个不属于任何记录的目录。
    await writeFile(join(root, 'README.md'), '用户自己的说明\n')
    await mkdir(join(root, 'manual-skill'), { recursive: true })
    await writeFile(join(root, 'manual-skill', 'SKILL.md'), '---\nname: manual-skill\ndescription: 手工放的\n---\n'
    )
    await writeSelfState(dshHome, [record('victim-pkg', ['victim-skill'])])
    await serve(dshHome, platform)

    const before = await snapshotTree(root, ['victim-skill'])
    expect(before.size).toBeGreaterThan(5)
    const response = await post(UNINSTALL_PATH, JSON.stringify({ name: 'victim-skill' }))
    expect(response.status).toBe(200)
    expect(await exists(join(root, 'victim-skill'))).toBe(false)
    // 父目录 `skills/` 本身还在；其余条目逐字节 + mtime 完全不变。
    expect(await exists(root)).toBe(true)
    expect(await snapshotTree(root)).toEqual(before)
  })

  // ── ④ 原子与幂等 ─────────────────────────────────────────────────────────────
  it('is idempotent when the directory is already gone, and restores the directory when the state write fails (never a half-deleted state)', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    await placeSkill(dshHome, 'ghost-skill')
    await writeSelfState(dshHome, [record('ghost-pkg', ['ghost-skill'])])
    await serve(dshHome, platform)
    // 用户手工删过目录：记录还在 ⇒ 仍要"把记录收干净"并如实回 200（不报"损坏"），同名再装得回来。
    await rm(join(dshHome, 'skills', 'ghost-skill'), { force: true, recursive: true })
    const idempotent = await post(UNINSTALL_PATH, JSON.stringify({ name: 'ghost-skill' }))
    expect(idempotent.status).toBe(200)
    const idempotentData = (idempotent.payload as { data: Record<string, unknown> }).data
    expect(Object.keys(idempotentData).sort()).toEqual(['removed', 'skills'])
    expect(idempotentData['removed']).toEqual(['ghost-skill'])
    expect(JSON.stringify(idempotent.payload)).not.toContain('alreadyMissing')
    expect(JSON.stringify(idempotent.payload)).not.toContain('kept')
    // "盘上本来就没了"这条幂等事实**只进 Host 日志**（判定点带 idempotent）。
    expect(onError.mock.calls.map(call => String(call[0])).join('\n')).toContain('step=idempotent')
    expect(await readSelfInstalledRecords({ platform, dshHome })).toEqual([])
    // 同名再装回来：写一条新记录 + 目录，**再卸一次仍然成功**（幂等闭环）。
    await placeSkill(dshHome, 'ghost-skill')
    await writeSelfState(dshHome, [record('ghost-pkg', ['ghost-skill'])])
    expect((await post(UNINSTALL_PATH, JSON.stringify({ name: 'ghost-skill' }))).status).toBe(200)
    // 第二次卸载：记录里已经没有这个名字 ⇒ 既有 404（不是 500、不是"损坏"）。
    const again = await post(UNINSTALL_PATH, JSON.stringify({ name: 'ghost-skill' }))
    expect(again.status).toBe(404)
    expect((again.payload as { error: { code: string } }).error.code).toBe('ENT_RESOURCE_NOT_FOUND')

    // 记账写失败：目录必须原样挪回（"都在"），**绝不**留"目录没了、记录还在"的半删状态。
    // 打桩 `fs/promises.rename`：只让"临时件 → 清单"那一次（目标就是 self-installed.json）失败，
    // 不动内核里"目录 → 暂存位"那次 rename（那次要成功，才能真的走到记账那一步）。
    await placeSkill(dshHome, 'atomic-skill')
    const atomicRecord = record('atomic-pkg', ['atomic-skill'])
    await writeSelfState(dshHome, [atomicRecord])
    const statePath = join(dshHome, SELF_STATE_RELATIVE)
    const stateBytes = await readFile(statePath, 'utf8')
    fsFailure.rmPrefix = ''
    fsFailure.target = statePath
    fsFailure.on = true
    try {
      await expect(uninstallSelfInstalledSkill(options(dshHome, platform), 'atomic-skill'))
        .rejects.toMatchObject({ code: 'ENT_SKILL_STATE_INVALID' })
    } finally {
      fsFailure.on = false
    }
    // 目录**原样挪回**（"都在"）、清单**逐字节没变**：没有任何半删状态。
    expect(await exists(join(dshHome, 'skills', 'atomic-skill', 'SKILL.md'))).toBe(true)
    expect(await readFile(statePath, 'utf8')).toBe(stateBytes)
    expect((await readSelfInstalledRecords({ platform, dshHome })).map(item => item.skillId)).toEqual(['atomic-pkg'])
    // 失败之后重试（这次写盘正常）仍然能成功：没有留下任何不可恢复的状态。
    expect((await uninstallSelfInstalledSkill(options(dshHome, platform), 'atomic-skill')).removed).toEqual(['atomic-skill'])
    expect(await exists(join(dshHome, 'skills', 'atomic-skill'))).toBe(false)
    expect(await readSelfInstalledRecords({ platform, dshHome })).toEqual([])
  })

  it('leaves the record untouched when the directory cannot even be staged, and never follows a symlink inside the tree', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    // ① **因果顺序**：目录挪到暂存位失败时，记录必须**一个字节都没动**。
    //    这条能抓住"先把记录收干净、再去动目录"那种顺序——那时记录已经少了这个名字，本断言立刻红。
    await placeSkill(dshHome, 'stage-skill')
    await writeSelfState(dshHome, [record('stage-pkg', ['stage-skill'])])
    await serve(dshHome, platform)
    const stateBytes = await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')
    // 只打掉"目录 → 暂存位"那次 rename（目标落在暂存位前缀下）：
    // ★这条断言是**因果顺序**的，不是"最终状态"的收尾：如果实现先写记录再去动目录，
    //   记录这时已经被改写（这个名字被摘掉了），下面的逐字节比对当场红。
    fsFailure.target = ''
    fsFailure.rmPrefix = join(dshHome, 'enterprise', 'skill-uninstall-trash')
    fsFailure.on = true
    try {
      const staged = await post(UNINSTALL_PATH, JSON.stringify({ name: 'stage-skill' }))
      expect(staged.status).toBe(503)
      expect((staged.payload as { error: { code: string } }).error.code).toBe('ENT_SKILL_INSTALL_FAILED')
    } finally {
      fsFailure.on = false
      // 钩子必须收回：下一个用例的"目录 → 暂存位"rename 也落在这个前缀下。
      fsFailure.rmPrefix = ''
    }
    // 记录逐字节不变、目录原封不动 ⇒ 没有半删状态。
    expect(await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')).toBe(stateBytes)
    expect(await exists(join(dshHome, 'skills', 'stage-skill', 'SKILL.md'))).toBe(true)
    expect((await readSelfInstalledRecords({ platform, dshHome })).map(item => item.names)).toEqual([['stage-skill']])

    // ② **不跟随符号链接**：技能目录**内部**有一个指向技能根外目录的符号链接时，
    //    卸载只摘掉那个链接本身（`lstat` 判符号链接、`rmdir`/`rm` 不带递归 ⇒ 绝不下钻），
    //    链接指向的目标目录与其中内容一个字节都不动。
    await placeSkill(dshHome, 'linker-skill')
    const victimDirectory = join(dshHome, 'sibling-victim')
    await mkdir(victimDirectory, { recursive: true })
    await writeFile(join(victimDirectory, 'keep.txt'), '绝不能删到的东西\n')
    await symlink(victimDirectory, join(dshHome, 'skills', 'linker-skill', 'escape-link'))
    await writeSelfState(dshHome, [record('linker-pkg', ['linker-skill'])])
    const removed = await post(UNINSTALL_PATH, JSON.stringify({ name: 'linker-skill' }))
    expect(removed.status).toBe(200)
    expect(await exists(join(dshHome, 'skills', 'linker-skill'))).toBe(false)
    expect(await exists(join(dshHome, 'skills', 'linker-skill', 'escape-link'))).toBe(false)
    expect(await readFile(join(victimDirectory, 'keep.txt'), 'utf8')).toBe('绝不能删到的东西\n')
  })

  it('fails closed on a corrupt self-installed state and on a name no record claims', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    await placeSkill(dshHome, 'corrupt-skill')
    // 清单损坏：不猜、不覆盖、不动磁盘（既有码 → 唯一那张表给 503）。
    const statePath = join(dshHome, SELF_STATE_RELATIVE)
    await mkdir(dirname(statePath), { recursive: true, mode: 0o700 })
    await writeFile(statePath, '{ not json', { encoding: 'utf8', mode: 0o600 })
    await serve(dshHome, platform)
    const corrupt = await post(UNINSTALL_PATH, JSON.stringify({ name: 'corrupt-skill' }))
    expect(corrupt.status).toBe(503)
    expect((corrupt.payload as { error: { code: string } }).error.code).toBe('ENT_SKILL_STATE_INVALID')
    expect(await exists(join(dshHome, 'skills', 'corrupt-skill', 'SKILL.md'))).toBe(true)
    expect(await readFile(statePath, 'utf8')).toBe('{ not json')
    // 名字没人认领（清单是空的合法状态）⇒ 404，零删除。
    await writeSelfState(dshHome, [])
    const unknown = await post(UNINSTALL_PATH, JSON.stringify({ name: 'corrupt-skill' }))
    expect(unknown.status).toBe(404)
    expect(await exists(join(dshHome, 'skills', 'corrupt-skill'))).toBe(true)
    expect((await post(REVEAL_PATH, JSON.stringify({ name: 'corrupt-skill' }))).status).toBe(404)
  })

  // ── ⑤ reveal ─────────────────────────────────────────────────────────────────
  it('reveals the record-derived directory (never a client path) and fails explicitly when it is unavailable', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    await placeSkill(dshHome, 'reveal-skill')
    await writeSelfState(dshHome, [record('reveal-pkg', ['reveal-skill'])])
    await serve(dshHome, platform)

    // 真 HTTP：端口拿到的是宿主自己拼出来的那一条路径（`<dshHome>/skills/<name>`），客户端没有第二个入口。
    const response = await post(REVEAL_PATH, JSON.stringify({ name: 'reveal-skill' }))
    expect(response.status).toBe(200)
    expect(response.payload).toEqual({ data: { revealed: true } })
    expect(opened).toEqual([join(dshHome, 'skills', 'reveal-skill')])
    const openedByHost = [...opened]
    // 响应体里**没有**宿主绝对路径（`data` 只有 `revealed` 这一枚键）。
    expect(JSON.stringify(response.payload)).not.toContain(dshHome)

    // 目录不在 ⇒ 404 明确失败（绝不静默说"打开了"）。
    await rm(join(dshHome, 'skills', 'reveal-skill'), { force: true, recursive: true })
    const missing = await post(REVEAL_PATH, JSON.stringify({ name: 'reveal-skill' }))
    expect(missing.status).toBe(404)
    expect((missing.payload as { error: { code: string } }).error.code).toBe('ENT_RESOURCE_NOT_FOUND')
    expect(opened).toEqual(openedByHost)

    // 系统文件管理器交接失败 ⇒ 503 `ENT_PLATFORM_UNAVAILABLE`（明确失败，不静默成功）。
    await placeSkill(dshHome, 'reveal-skill')
    const broken = options(dshHome, platform, { open: async () => { throw new Error('no file manager here') } })
    await expect(revealSelfInstalledSkill(broken, 'reveal-skill')).rejects.toMatchObject({ code: 'ENT_PLATFORM_UNAVAILABLE' })
    // 平台不支持（非 darwin/win32/linux）：默认实现同样给那一枚码，而不是"什么也没发生"。
    const spy = vi.spyOn(process, 'platform', 'get').mockReturnValue('aix' as NodeJS.Platform)
    try {
      await expect(revealSelfInstalledSkill(options(dshHome, platform), 'reveal-skill'))
        .rejects.toMatchObject({ code: 'ENT_PLATFORM_UNAVAILABLE' })
    } finally {
      spy.mockRestore()
    }
    // 客户端传路径的形态在**类型上不可表达**：端口只收一个名字（源码级断言见下一组）。
    const withPath = await post(REVEAL_PATH, JSON.stringify({ name: 'reveal-skill', path: '/etc' }))
    expect(withPath.status).toBe(400)
    // 端口**一次都没因为这个请求**被调用：端口的入参只有一个名字，"传一个路径进来"进不来。
    expect(opened).toEqual(openedByHost)
  })

  // ── ⑥ 路由形状：注册面 / 引擎语义 / 405 / 坏值 400 ───────────────────────────
  it('registers exactly two exact siblings that beat the `/skills` prefix, answers 405 + Allow on other methods, and 400 on ten malformed bodies with zero side effects', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    await placeSkill(dshHome, 'route-skill')
    await writeSelfState(dshHome, [record('route-pkg', ['route-skill'])])
    await serve(dshHome, platform)

    // 注册面：恰好两条，都是 exact，路径逐字（各恰好一处）。
    expect(routes.filter(route => route.path === UNINSTALL_PATH || route.path === REVEAL_PATH)
      .map(route => `${route.kind} ${route.path}`).sort())
      .toEqual([`exact ${UNINSTALL_PATH}`, `exact ${REVEAL_PATH}`].sort())
    // 引擎语义：exact 整路径优先 ⇒ 两条都命中自己，绝不掉进 `/skills` prefix。
    expect(engineRouteMatch(routes, UNINSTALL_PATH)?.path).toBe(UNINSTALL_PATH)
    expect(engineRouteMatch(routes, REVEAL_PATH)?.path).toBe(REVEAL_PATH)
    // 相邻的只读那条（platform-client 的 exact）在本文件里**没有**第二条注册：本刀不碰它。
    expect(routes.filter(route => route.path === '/enterprise/api/v1/local/skills/self-installed')).toHaveLength(0)

    const before = await snapshotTree(join(dshHome, 'skills'))
    const stateBefore = await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')

    // 非 POST ⇒ 405 + `Allow: POST`，且零副作用（GET/HEAD/PUT/DELETE 各来一遍）。
    for (const method of ['GET', 'HEAD', 'PUT', 'DELETE']) {
      for (const path of [UNINSTALL_PATH, REVEAL_PATH]) {
        const response = await fetch(`${baseUrl}${path}`, { method })
        expect(response.status, `${method} ${path}`).toBe(405)
        expect(response.headers.get('allow'), `${method} ${path}`).toBe('POST')
        if (method !== 'HEAD') expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
      }
    }
    expect(await snapshotTree(join(dshHome, 'skills'))).toEqual(before)

    // 正文坏值 10 种（键集/类型/长度/分帧）⇒ 400 **且一次都不进端口**（盘上逐字节不变）。
    const malformed: readonly { readonly label: string, readonly body: string, readonly contentType?: string | null }[] = [
      { label: 'empty object', body: '{}' },
      { label: 'missing key', body: JSON.stringify({ skillId: 'route-skill' }) },
      { label: 'extra key', body: JSON.stringify({ name: 'route-skill', path: '/etc' }) },
      { label: 'name not a string', body: JSON.stringify({ name: 7 }) },
      { label: 'name empty', body: JSON.stringify({ name: '' }) },
      { label: 'name too long', body: JSON.stringify({ name: 'a'.repeat(65) }) },
      { label: 'name illegal shape', body: JSON.stringify({ name: 'Route_Skill' }) },
      { label: 'not json', body: 'name=route-skill' },
      { label: 'json array', body: JSON.stringify(['route-skill']) },
      { label: 'wrong content-type', body: JSON.stringify({ name: 'route-skill' }), contentType: 'text/plain' },
    ]
    for (const item of malformed) {
      for (const path of [UNINSTALL_PATH, REVEAL_PATH]) {
        const response = await post(path, item.body, item.contentType === undefined ? 'application/json' : item.contentType)
        expect(response.status, `${item.label} @ ${path}`).toBe(400)
        expect((response.payload as { error: { code: string } }).error.code, item.label).toBe('ENT_INVALID_REQUEST')
      }
    }
    expect(await snapshotTree(join(dshHome, 'skills'))).toEqual(before)
    expect(await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')).toBe(stateBefore)
    expect(opened).toEqual([])
    // 留痕：坏值 400 与 405 **都没进端口**（盘上零副作用已断言），且每一条 400 都在日志里带 status=400；
    // 405 那条路**根本不到**分派，故不产生日志。
    expect(onError.mock.calls.length).toBe(malformed.length * 2)
    for (const call of onError.mock.calls) expect(String(call[0])).toContain('status=400')
  })

  it('projects kernel failures through the single code table and logs the decision point', async () => {
    const dshHome = await makeHome()
    const { platform } = makePlatform()
    await serve(dshHome, platform)
    // 没装过 ⇒ 404 走唯一那张表 + 判定点日志（operation/step/status）。
    const response = await post(UNINSTALL_PATH, JSON.stringify({ name: 'never-installed' }))
    expect(response.status).toBe(404)
    expect((response.payload as { error: { code: string } }).error.code).toBe('ENT_RESOURCE_NOT_FOUND')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(String(onError.mock.calls[0]?.[0])).toContain(`operation=POST ${UNINSTALL_PATH} step=uninstall-failed status=404`)
    const reveal = await post(REVEAL_PATH, JSON.stringify({ name: 'never-installed' }))
    expect(reveal.status).toBe(404)
    expect(String(onError.mock.calls[1]?.[0])).toContain(`operation=POST ${REVEAL_PATH} step=reveal-failed status=404`)
  })

  // ── ⑦ 源码级反锁 ─────────────────────────────────────────────────────────────
  it('keeps exactly one recursive delete entry point, one self-installed write door, one registration per path, and an argv-only file-manager handoff', async () => {
    const files = (await readdir(join(ROOT, 'src'), { recursive: true })).filter(name => name.endsWith('.ts'))
    const sources = new Map<string, string>()
    for (const file of files) sources.set(file, await readFile(join(ROOT, 'src', file), 'utf8'))

    // ① 技能目录的**递归**删除入口恰好一处：技能家族两个文件里任何 `rm(..., { recursive: true })`
    //    都不许出现（`removeResolvedSkillDirectory` 只做逐条 unlink/rmdir），落点解析也恰好一处。
    const installSource = sources.get('skill-install.ts') ?? ''
    // 唯一允许出现的递归 `rm` 是**暂存位/备份位**这种宿主私有临时目录的收尾（不是技能目录）；
    // 技能目录的删除一律走那条逐条 unlink/rmdir 的内核。
    // 路径段只允许是简单标识符（`staging,` / `backup,`）：带括号的复杂表达式一律匹配不到，
    // 故这条断言同时证明"没有第二处带表达式目标的递归删除"。
    const recursiveRms = [...installSource.matchAll(/rm\(([A-Za-z0-9_]+),\s*\{[^}]*recursive:\s*true/g)].map(match => match[1] ?? '')
    expect(recursiveRms.sort()).toEqual(['backup', 'staging'])
    // 技能目录自身那一层用 `rmdir`（只删空目录），与"逐条固化"配成一对结构性反锁。
    expect(installSource).toContain('await rmdir(directory.path)')
    expect(installSource).toContain('await rmdir(absolute)')
    for (const file of ['skill-upload.ts', 'skill-self-installed.ts']) {
      expect(sources.get(file) ?? '', file).not.toMatch(/rm\([^)]*recursive:\s*true/)
    }
    const definition = [...sources.entries()].filter(([, text]) => text.includes('async function removeResolvedSkillDirectory'))
    expect(definition.map(([file]) => file)).toEqual(['skill-install.ts'])
    expect((sources.get('skill-install.ts') ?? '').match(/export async function deleteOwnedSkillDirectory/g)).toHaveLength(1)
    // 删除入口的调用方（`skill-install.ts` 内）：安装回滚 / 升级孤儿清理 / 中心卸载 —— 恰好三处调用，
    // 加上那条 `export async function` 定义本身共四处出现；`skill-upload.ts` 的孤儿清理再一处。
    expect((sources.get('skill-install.ts') ?? '').match(/deleteOwnedSkillDirectory\(/g)).toHaveLength(4)
    expect((sources.get('skill-upload.ts') ?? '').match(/deleteOwnedSkillDirectory\(/g)).toHaveLength(1)

    // ② `self-installed.json` 的写入口恰好一处（`writeSelfInstalledRecords` 里那一次 `writeFile`），
    //    且**只**住在记录所有者那个文件里：别处连那份清单的文件名都不许出现。
    const stateNameFiles = [...sources.entries()]
      .filter(([, text]) => text.includes('SELF_INSTALLED_STATE_FILENAME'))
      .map(([file]) => file)
      .sort()
    expect(stateNameFiles).toEqual(['skill-upload.ts'])
    const upload = sources.get('skill-upload.ts') ?? ''
    expect((upload.match(/JSON\.stringify\(\{ records \}\)/g) ?? []).length).toBe(1)
    expect((upload.match(/export async function replaceSelfInstalledRecords/g) ?? []).length).toBe(1)
    // 内核侧只调记录所有者那一个写口，自己不落盘、不碰那份文件名。
    const kernel = sources.get('skill-self-installed.ts') ?? ''
    expect(kernel).toContain('replaceSelfInstalledRecords')
    expect(kernel).not.toContain('writeFile')
    expect(kernel).not.toContain('SELF_INSTALLED_STATE_FILENAME')
    // 注释里可以解释这份文件（那是文档），**代码**里一个字节都不许出现它的文件名/路径。
    expect(kernel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).not.toContain('self-installed.json')

    // ③ 两条路径各恰好一处（注册器里），且都在 bundle 侧（platform-client 零改动）。
    const route = sources.get('skill-self-installed-route.ts') ?? ''
    // 注释里可以提这条路径（文档），但**代码**里那条字面串只允许出现一次（就是那条路径常量）。
    const routeCode = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect((routeCode.match(/self-installed\/uninstall/g) ?? []).length).toBe(1)
    expect((routeCode.match(/self-installed\/reveal/g) ?? []).length).toBe(1)
    expect(routeCode).toContain('export const ENTERPRISE_SKILL_SELF_INSTALLED_UNINSTALL_LOCAL_PATH =')
    expect(routeCode).toContain('export const ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH =')
    const platform = await readFile(join(ROOT, '..', 'platform-client', 'src', 'local-api.ts'), 'utf8')
    expect(platform).not.toContain('self-installed/uninstall')
    expect(platform).not.toContain('self-installed/reveal')

    // ④ 执行通道：`execFile` + **参数数组**、无 `shell: true`、无 `exec(`/`execSync(`/`spawn(`，参数里没有用户输入拼接。
    //    一律只看**去掉注释后的代码**（注释里当然可以写"不许 shell: true"这句话本身）。
    const kernelCode = kernel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect((kernelCode.match(/execFile\(/g) ?? []).length).toBe(1)
    expect(kernelCode).toContain("execFile(command.file, command.args, { signal, windowsHide: true }, (error) => {")
    expect(kernelCode).not.toMatch(/shell:\s*true/)
    expect(kernelCode).not.toMatch(/\bexec(Sync)?\s*\(/)
    expect(kernelCode).not.toMatch(/\bspawn(Sync)?\s*\(/)
    // 命令与参数都是**常量 + 已解析的宿主路径**：没有任何 `+ name` / 模板插值 / 客户端字符串进 argv。
    expect(kernel).toContain("{ file: 'open', args: [directory] }")
    expect(kernel).toContain("{ file: 'explorer', args: [directory] }")
    expect(kernel).toContain("{ file: 'xdg-open', args: [directory] }")
    expect(kernel).not.toMatch(/args:\s*\[`/)
    // 端口形状里只有一个名字：`reveal`/`uninstall` 的入参签名不含 path/目录参数。
    expect(route).toContain('uninstall(name: string): Promise<EnterpriseSelfInstalledUninstallKernelResult>')
    expect(route).toContain('reveal(name: string, signal: AbortSignal): Promise<unknown>')
    // 出厂视图是**关闭三键**：`alreadyMissing` 在写响应之前被剥掉，且带一条只进日志的幂等判定点。
    expect(route).toContain('const { alreadyMissing, ...result } = await port.uninstall(name)')
    expect(route).toContain('interface EnterpriseSelfInstalledUninstallView {')
    // ★死字段不许复活（同口径 55 那次的处理）：内核回值、出厂视图与路由里都不许再有 `kept` 这一格。
    for (const [name, text] of [['skill-self-installed.ts', kernel], ['skill-self-installed-route.ts', route]] as const) {
      expect(text, name).not.toContain('kept')
    }
    expect(route).toContain('readonly removed: readonly string[]')
    expect(route).not.toContain('readonly kept')
    expect(routeCode).toContain('writeJson(response, 200, { data: result })')
    // 本刀没有新增任何执行通道到既有内核里（`skill-install.ts` / `skill-upload.ts` 仍然零 exec）。
    expect(upload).not.toContain('child_process')
    expect(sources.get('skill-install.ts') ?? '').not.toContain('child_process')
  })
})
