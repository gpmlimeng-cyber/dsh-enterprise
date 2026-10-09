/**
 * [INPUT]: 依赖 `src/skill-self-installed.ts` 的 `editSelfInstalledSkill`/`revealSelfInstalledSkill` 与端口形状 `EnterpriseSkillFileLauncher`、`src/skill-self-installed-route.ts` 的第三条 exact 路由与路径常量、`src/skill-errors.ts` 的既有码边界、`tests/engine-route-match.ts` 的引擎语义匹配器，以及 node:fs/promises、node:child_process（两处测试专用 double）、node:http、node:crypto
 * [OUTPUT]: 在真实临时 dshHome（`~/.sshwork` 下）+ 真实 HTTP（引擎语义分发）上锁定本刀「编辑」：**正常路径 ⇒ 交接被执行且 argv 逐字**（注入式 launcher double 取证路径、`execFile` double 取证三个平台的 argv；★**当前平台不是那三种桌面之一时（本机就是 `android`）改判「同一枚既有码 `ENT_PLATFORM_UNAVAILABLE` + 零交接」** —— 门禁不假设跑它的机器一定是桌面，判据按运行平台分岔）、**五类失败各自明确码且零交接**（无记录 / 被中心认领 / `SKILL.md` 不是普通文件 / 越界 / 系统交接抛错）、**正文键集紧闭**（10 种畸形 ⇒ 400；九种形状类**一次都不进内核**，kebab 形状那一种按「判据只有一处」的纪律进内核被拒）、**405 + `Allow: POST`**、**响应不含宿主路径**（逐字反向锁）、**只读**（写类 fs 出口零调用 + 技能树逐字节逐 mtime 不变）、**源码级**（唯一一次 `execFile` 与 argv 形态 / 无 shell / 无动态 import / 与 `reveal` 同一份归属判据）、**复用既有码**（本面出现的码字面量集合恰好六枚，无第二枚新码、无第二张码→状态表）
 * [POS]: bundle 技能纵深「编辑」这一刀的回归门禁；有人把 `SKILL.md` 的普通文件判据删掉、不判文件越界、改用 shell 交接、把宿主路径写进响应、给这条面新造一枚码，或另写一份归属判定，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 写类 fs 出口的调用账：一次「编辑」请求期间必须**恒空**（本刀只读元数据，不落一个字节）。
 *
 * `escapedFileRealpath` 是**故障注入**：真机上"普通文件却 `realpath` 越界"只可能由 TOCTOU 造出，
 * 故用它把 `resolveOwnedSkillFile` 那条文件落点等式**证伪得出来**（它红 ⇒ 那条判据是承重的）。
 *
 * `mutatorNames` 与账本一起 hoist：`vi.mock` 的工厂会被提到文件最前面，工厂里不能引用普通顶层变量
 * （`FS_MUTATORS` 写在顶层会让工厂拿到未初始化的绑定）。
 */
const fsAudit = vi.hoisted(() => ({
  mutations: [] as string[],
  escapedFileRealpath: '',
  /** 写类 fs 出口清单：这些函数一个都不许在一次「编辑」里被调用。 */
  mutatorNames: ['writeFile', 'appendFile', 'rm', 'rename', 'mkdir', 'rmdir', 'unlink', 'copyFile', 'truncate', 'chmod', 'chown', 'utimes', 'symlink', 'link', 'mkdtemp'] as const,
}))

/** `execFile` double：本刀默认实现那两次交接的 argv 逐字证据（真机上就是这三个平台分支）。 */
const childAudit = vi.hoisted(() => ({
  calls: [] as { readonly file: string, readonly args: readonly string[] }[],
  fail: false,
}))

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const mocked: Record<string, unknown> = {
    ...actual,
    default: actual,
    realpath: async (path: Parameters<typeof actual.realpath>[0]): Promise<string> => {
      const resolved = await actual.realpath(path)
      if (fsAudit.escapedFileRealpath !== '' && String(path).endsWith(`${sep}SKILL.md`)) return fsAudit.escapedFileRealpath
      return resolved
    },
  }
  for (const name of fsAudit.mutatorNames) {
    const original = (actual as unknown as Record<string, unknown>)[name]
    if (typeof original !== 'function') continue
    mocked[name] = async (...args: unknown[]): Promise<unknown> => {
      fsAudit.mutations.push(name)
      return await (original as (...rest: unknown[]) => Promise<unknown>)(...args)
    }
  }
  return mocked
})

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    default: actual,
    execFile: (
      file: string,
      args: readonly string[],
      _options: unknown,
      callback: (error: Error | null) => void,
    ) => {
      childAudit.calls.push({ file, args: [...args] })
      callback(childAudit.fail ? new Error('simulated system handoff failure') : null)
      return undefined
    },
  }
})

import type { WebServerRoutePort } from '@dshent/platform-client'
import { EnterpriseSkillInstallError } from '../src/skill-errors.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'
import { SKILL_LOCAL_ROOT_SEGMENTS, type EnterpriseSkillInstallPlatformPort } from '../src/skill-install.js'
import {
  SELF_INSTALLED_STATE_FILENAME,
  type SelfInstalledSkillRecord,
} from '../src/skill-upload.js'
import {
  editSelfInstalledSkill,
  revealSelfInstalledSkill,
  uninstallSelfInstalledSkill,
  type EnterpriseSkillFileLauncher,
  type SelfInstalledDependencies,
} from '../src/skill-self-installed.js'
import {
  ENTERPRISE_SKILL_SELF_INSTALLED_EDIT_LOCAL_PATH,
  ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH,
  registerEnterpriseSelfInstalledActionRoutes,
} from '../src/skill-self-installed-route.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EDIT_PATH = ENTERPRISE_SKILL_SELF_INSTALLED_EDIT_LOCAL_PATH
const SELF_STATE_RELATIVE = join('enterprise', 'skill-installs', SELF_INSTALLED_STATE_FILENAME)
const ENTERPRISE_STATE_RELATIVE = join('enterprise', 'skill-installs', 'installed.json')
const SHA = 'a'.repeat(64)
const NOW = '2026-10-06T00:00:00.000Z'
const SKILL_MD = '---\nname: edit-skill\ndescription: 说明\n---\n正文\n'
const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-self-edit-'))
  homes.push(path)
  return path
}

/** 平台面：本刀这条路**不许**碰网络（中心清单读的是本机那份状态文件）。 */
function makePlatform(): EnterpriseSkillInstallPlatformPort {
  return {
    request: async () => new Response('not found', { status: 404 }),
  }
}

function options(
  dshHome: string,
  platform: EnterpriseSkillInstallPlatformPort,
  fileLauncher?: EnterpriseSkillFileLauncher,
): SelfInstalledDependencies {
  return {
    platform,
    dshHome,
    now: () => new Date(NOW),
    ...(fileLauncher === undefined ? {} : { fileLauncher }),
  }
}

/** 往技能根落一个真技能目录（`<dshHome>/skills/<name>/SKILL.md`）。 */
async function placeSkill(dshHome: string, name: string): Promise<string> {
  const directory = join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS, name)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(join(directory, 'SKILL.md'), SKILL_MD, { mode: 0o600 })
  return directory
}

/** 七键自装记录（与 `skill-upload.ts` 的键集逐字同源）。 */
function record(skillId: string, names: readonly string[]): SelfInstalledSkillRecord {
  return { skillId, displayName: `${skillId} 展示名`, sha256: SHA, names, installedAt: NOW, sourceType: 'upload', sourceInput: '' }
}

/** 直接写一份自装清单。 */
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

/** 逐条固化技能根下全部条目（相对路径 → 内容摘要 + 字节数 + mtime）：只读的下限证据。 */
async function snapshotTree(root: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>()
  const walk = async (directory: string, relative: string): Promise<void> => {
    const items = await readdir(directory, { withFileTypes: true })
    for (const item of items.sort((left, right) => (left.name < right.name ? -1 : 1))) {
      const child = join(directory, item.name)
      const childRelative = relative === '' ? item.name : `${relative}/${item.name}`
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

/** 去掉注释后的**代码**：源码级反锁一律只看代码（注释里当然可以写"不许 shell: true"这句话本身）。 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('self-installed skill «edit» over the real local API', () => {
  let routes: RegisteredRoute[] = []
  let server: Server | undefined
  let baseUrl = ''
  let onError: ReturnType<typeof vi.fn>
  let launched: string[] = []
  let editCalls = 0

  function dispatch(incoming: IncomingMessage, response: ServerResponse): void {
    const pathname = new URL(incoming.url ?? '/', 'http://127.0.0.1').pathname
    const route = engineRouteMatch(routes, pathname)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(incoming, response))
  }

  /** 起一台本地 server：三条真路由（`edit` 端口带计数 spy）+ 一个**假的** `/skills` prefix（证明 exact 优先）。 */
  async function serve(dshHome: string): Promise<void> {
    routes = []
    onError = vi.fn<(message: string, error: unknown) => void>()
    launched = []
    editCalls = 0
    const platform = makePlatform()
    const fileLauncher: EnterpriseSkillFileLauncher = {
      openDocument: async (file: string) => { launched.push(file) },
    }
    const editSpy = vi.fn(async (name: string, signal: AbortSignal) => {
      editCalls += 1
      return await editSelfInstalledSkill(options(dshHome, platform, fileLauncher), name, signal)
    })
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        routes.push(registered)
        return () => { routes = routes.filter(route => route !== registered) }
      },
    }
    registerEnterpriseSelfInstalledActionRoutes(webServer, {
      uninstall: name => uninstallSelfInstalledSkill(options(dshHome, platform), name),
      reveal: (name, signal) => revealSelfInstalledSkill(options(dshHome, platform), name, signal),
      edit: editSpy,
    }, onError)
    // 假的 `/skills` prefix：本刀这条 exact 若没抢在前面，请求会掉进这里（并回 400），测试立刻红。
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
    launched = []
    editCalls = 0
    fsAudit.mutations = []
    fsAudit.escapedFileRealpath = ''
    childAudit.calls = []
    childAudit.fail = false
  })

  afterEach(async () => {
    fsAudit.escapedFileRealpath = ''
    if (server !== undefined) await new Promise<void>(resolvePromise => server!.close(() => resolvePromise()))
  })

  /** 发一条本机 POST：默认 `application/json`，可由 `body`/`contentType` 覆盖（坏值用例靠它）。 */
  async function post(path: string, body: string, contentType: string | null = 'application/json'): Promise<{ status: number, payload: unknown, allow: string | null, text: string }> {
    const headers: Record<string, string> = {}
    if (contentType !== null) headers['content-type'] = contentType
    const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body })
    const text = await response.text()
    return { status: response.status, payload: JSON.parse(text) as unknown, allow: response.headers.get('allow'), text }
  }

  // ── ① 正常路径：交接被执行且路径 / argv 逐字 ──────────────────────────────────
  it('hands the record-derived `<skill root>/<name>/SKILL.md` to the system default application with argv-only execFile', async () => {
    const dshHome = await makeHome()
    await placeSkill(dshHome, 'edit-skill')
    await writeSelfState(dshHome, [record('edit-pkg', ['edit-skill'])])
    await serve(dshHome)

    const response = await post(EDIT_PATH, JSON.stringify({ name: 'edit-skill' }))
    expect(response.status).toBe(200)
    // ★响应**逐字**就是这一条：不含任何宿主路径（连技能目录都不给）。
    expect(response.text).toBe('{"data":{"edited":true}}')
    expect(response.payload).toEqual({ data: { edited: true } })
    // 交接拿到的是**宿主自己拼出来的那一条**（客户端没有第二个入口）。
    const skillFile = join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS, 'edit-skill', 'SKILL.md')
    expect(launched).toEqual([skillFile])
    expect(response.text).not.toContain(dshHome)
    expect(response.text).not.toContain('SKILL.md')
    expect(response.text).not.toContain('skills')

    // ★默认实现（**不注入**端口）的 argv 逐字证据：`execFile` double 逐平台断言。
    // ★判据按**当前平台**分岔，不假设跑门禁的机器一定是三种桌面之一（本机就是 `android`）：
    //   三种桌面之一 ⇒ 交接真的发生、argv 逐字；其余平台 ⇒ 同一枚既有码 + **零交接**。
    const platform = makePlatform()
    childAudit.calls = []
    if (process.platform === 'darwin' || process.platform === 'win32' || process.platform === 'linux') {
      await editSelfInstalledSkill(options(dshHome, platform), 'edit-skill')
      expect(childAudit.calls).toHaveLength(1)
      if (process.platform === 'darwin') expect(childAudit.calls[0]).toEqual({ file: 'open', args: [skillFile] })
      else if (process.platform === 'win32') expect(childAudit.calls[0]).toEqual({ file: 'cmd', args: ['/c', 'start', '', skillFile] })
      else expect(childAudit.calls[0]).toEqual({ file: 'xdg-open', args: [skillFile] })
    } else {
      await expect(editSelfInstalledSkill(options(dshHome, platform), 'edit-skill'))
        .rejects.toMatchObject({ code: 'ENT_PLATFORM_UNAVAILABLE' })
      expect(childAudit.calls).toEqual([])
    }
    for (const [platformName, expected] of [
      ['darwin', { file: 'open', args: [skillFile] }],
      ['win32', { file: 'cmd', args: ['/c', 'start', '', skillFile] }],
      ['linux', { file: 'xdg-open', args: [skillFile] }],
    ] as const) {
      const spy = vi.spyOn(process, 'platform', 'get').mockReturnValue(platformName as NodeJS.Platform)
      try {
        childAudit.calls = []
        await editSelfInstalledSkill(options(dshHome, platform), 'edit-skill')
        expect(childAudit.calls, platformName).toEqual([expected])
      } finally {
        spy.mockRestore()
      }
    }
    // 非三平台：默认实现给同一枚既有码（而不是"什么也没发生"），且**零交接**。
    const unsupported = vi.spyOn(process, 'platform', 'get').mockReturnValue('aix' as NodeJS.Platform)
    try {
      childAudit.calls = []
      await expect(editSelfInstalledSkill(options(dshHome, platform), 'edit-skill'))
        .rejects.toMatchObject({ code: 'ENT_PLATFORM_UNAVAILABLE' })
      expect(childAudit.calls).toEqual([])
    } finally {
      unsupported.mockRestore()
    }
  })

  // ── ② 五类失败：各自明确码 + 零交接 ───────────────────────────────────────────
  it('fails each of the five classes with its own existing code and zero handoff', async () => {
    const dshHome = await makeHome()
    const root = join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS)
    await mkdir(root, { recursive: true, mode: 0o700 })
    const outside = join(dshHome, 'outside-target')
    await mkdir(outside, { recursive: true })
    await writeFile(join(outside, 'SKILL.md'), '别人的东西\n')
    await serve(dshHome)

    // ① 无记录认领 ⇒ 404 `ENT_RESOURCE_NOT_FOUND`（自装清单里没有这个名字）。
    await placeSkill(dshHome, 'orphan-skill')
    await writeSelfState(dshHome, [])
    const orphan = await post(EDIT_PATH, JSON.stringify({ name: 'orphan-skill' }))
    expect(orphan.status).toBe(404)
    expect((orphan.payload as { error: { code: string } }).error.code).toBe('ENT_RESOURCE_NOT_FOUND')

    // ② 被**中心** `installed.json` 认领 ⇒ 404（那是中心装的东西，不归这条路由管），零交接。
    await writeEnterpriseState(dshHome, ['orphan-skill'])
    await writeSelfState(dshHome, [record('self-pkg', ['orphan-skill'])])
    const byCenter = await post(EDIT_PATH, JSON.stringify({ name: 'orphan-skill' }))
    expect(byCenter.status).toBe(404)
    expect((byCenter.payload as { error: { code: string } }).error.code).toBe('ENT_RESOURCE_NOT_FOUND')
    // ②' 被两条自装记录认领 ⇒ 409 `ENT_SKILL_NAME_CONFLICT`（与 `reveal`/`uninstall` **同一份** fail-closed 判据）。
    await rm(join(dshHome, ENTERPRISE_STATE_RELATIVE), { force: true })
    await writeSelfState(dshHome, [record('pkg-a', ['orphan-skill']), record('pkg-b', ['orphan-skill'])])
    const overlap = await post(EDIT_PATH, JSON.stringify({ name: 'orphan-skill' }))
    expect(overlap.status).toBe(409)
    expect((overlap.payload as { error: { code: string } }).error.code).toBe('ENT_SKILL_NAME_CONFLICT')
    expect(launched).toEqual([])

    // ③ `SKILL.md` **不是普通文件** ⇒ 409 `ENT_SKILL_CONTENT_INVALID`：符号链接 / 目录（两种形态各来一遍）。
    const linked = join(root, 'linked-file-skill')
    await mkdir(linked, { recursive: true, mode: 0o700 })
    await symlink(join(outside, 'SKILL.md'), join(linked, 'SKILL.md'))
    const directoryForm = join(root, 'directory-file-skill')
    await mkdir(join(directoryForm, 'SKILL.md'), { recursive: true, mode: 0o700 })
    await writeSelfState(dshHome, [record('file-pkg', ['linked-file-skill', 'directory-file-skill'])])
    for (const name of ['linked-file-skill', 'directory-file-skill']) {
      const response = await post(EDIT_PATH, JSON.stringify({ name }))
      expect(response.status, name).toBe(409)
      expect((response.payload as { error: { code: string } }).error.code, name).toBe('ENT_SKILL_CONTENT_INVALID')
    }
    // 目标文件一个字节都不动。
    expect(await readFile(join(outside, 'SKILL.md'), 'utf8')).toBe('别人的东西\n')

    // ④ 越界 ⇒ 409：技能目录本身是符号链接（目录层）＋ 文件 `realpath` 逃出技能目录（文件层，故障注入）。
    const escaped = join(root, 'escaped-dir-skill')
    await symlink(outside, escaped)
    await writeSelfState(dshHome, [record('escape-pkg', ['escaped-dir-skill'])])
    const escapedDirectory = await post(EDIT_PATH, JSON.stringify({ name: 'escaped-dir-skill' }))
    expect(escapedDirectory.status).toBe(409)
    expect((escapedDirectory.payload as { error: { code: string } }).error.code).toBe('ENT_SKILL_CONTENT_INVALID')

    await placeSkill(dshHome, 'escaped-file-skill')
    await writeSelfState(dshHome, [record('escape-pkg', ['escaped-file-skill'])])
    fsAudit.escapedFileRealpath = join(outside, 'SKILL.md')
    try {
      const escapedFile = await post(EDIT_PATH, JSON.stringify({ name: 'escaped-file-skill' }))
      expect(escapedFile.status).toBe(409)
      expect((escapedFile.payload as { error: { code: string } }).error.code).toBe('ENT_SKILL_CONTENT_INVALID')
    } finally {
      fsAudit.escapedFileRealpath = ''
    }

    // ④' 目录 / 文件不在 ⇒ 404（记录在、盘上没有）：绝不静默说"打开了"。
    await writeSelfState(dshHome, [record('ghost-pkg', ['ghost-dir-skill'])])
    const noDirectory = await post(EDIT_PATH, JSON.stringify({ name: 'ghost-dir-skill' }))
    expect(noDirectory.status).toBe(404)
    expect((noDirectory.payload as { error: { code: string } }).error.code).toBe('ENT_RESOURCE_NOT_FOUND')
    await mkdir(join(root, 'ghost-file-skill'), { recursive: true, mode: 0o700 })
    await writeSelfState(dshHome, [record('ghost-pkg', ['ghost-file-skill'])])
    const noFile = await post(EDIT_PATH, JSON.stringify({ name: 'ghost-file-skill' }))
    expect(noFile.status).toBe(404)
    expect((noFile.payload as { error: { code: string } }).error.code).toBe('ENT_RESOURCE_NOT_FOUND')

    // ⑤ 系统交接抛错 ⇒ 503 `ENT_PLATFORM_UNAVAILABLE`（明确失败，不静默成功）。
    await placeSkill(dshHome, 'handoff-skill')
    await writeSelfState(dshHome, [record('handoff-pkg', ['handoff-skill'])])
    await expect(editSelfInstalledSkill(options(dshHome, makePlatform(), {
      openDocument: async () => { throw new Error('no default application here') },
    }), 'handoff-skill')).rejects.toMatchObject({ code: 'ENT_PLATFORM_UNAVAILABLE' })
    // 默认实现这一侧（`execFile` 自己回错）同样是那一枚码，且**响应**也投影成 503。
    childAudit.fail = true
    try {
      await expect(editSelfInstalledSkill(options(dshHome, makePlatform()), 'handoff-skill'))
        .rejects.toMatchObject({ code: 'ENT_PLATFORM_UNAVAILABLE' })
    } finally {
      childAudit.fail = false
    }

    // ★五类失败的共同底线：**一次交接都没有**（上面所有请求走的是同一个 `launched` 账）。
    expect(launched).toEqual([])
    expect(editCalls).toBe(9)
  })

  // ── ③ 正文键集紧闭：10 种畸形 ⇒ 400 且一次都不进内核 ─────────────────────────
  it('rejects ten malformed bodies with 400, entering the kernel exactly once (the kebab shape is judged there) and never for the nine shape failures', async () => {
    const dshHome = await makeHome()
    await placeSkill(dshHome, 'route-skill')
    await writeSelfState(dshHome, [record('route-pkg', ['route-skill'])])
    await serve(dshHome)
    const before = await snapshotTree(join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS))
    const stateBefore = await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')
    fsAudit.mutations = []

    const malformed: readonly { readonly label: string, readonly body: string, readonly contentType?: string | null, readonly reachesKernel?: boolean }[] = [
      { label: 'empty object', body: '{}' },
      { label: 'missing key', body: JSON.stringify({ skillId: 'route-skill' }) },
      { label: 'extra key', body: JSON.stringify({ name: 'route-skill', path: '/etc/passwd' }) },
      { label: 'name not a string', body: JSON.stringify({ name: 7 }) },
      { label: 'name empty', body: JSON.stringify({ name: '' }) },
      { label: 'name too long', body: JSON.stringify({ name: 'a'.repeat(65) }) },
      // ★这一条**故意**进内核：精确 kebab 判据只有一处（内核那份 `requireSkillName`），
      //   路由层只做字符串 + 长度粗闸门 ⇒ 它在内核里被拒、照样 400，但端口确实被调用了一次。
      { label: 'name illegal shape', body: JSON.stringify({ name: 'Route_Skill' }), reachesKernel: true },
      { label: 'not json', body: 'name=route-skill' },
      { label: 'json array', body: JSON.stringify(['route-skill']) },
      { label: 'wrong content-type', body: JSON.stringify({ name: 'route-skill' }), contentType: 'text/plain' },
    ]
    for (const item of malformed) {
      const callsBefore = editCalls
      const response = await post(EDIT_PATH, item.body, item.contentType === undefined ? 'application/json' : item.contentType)
      expect(response.status, item.label).toBe(400)
      expect((response.payload as { error: { code: string } }).error.code, item.label).toBe('ENT_INVALID_REQUEST')
      expect(editCalls - callsBefore, item.label).toBe(item.reachesKernel === true ? 1 : 0)
    }
    // ★除上面那一条（kebab 形状归内核判）外，**九种畸形一次都没进内核**，盘上逐字节不变，零交接。
    expect(editCalls).toBe(1)
    expect(launched).toEqual([])
    expect(fsAudit.mutations).toEqual([])
    expect(await snapshotTree(join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS))).toEqual(before)
    expect(await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')).toBe(stateBefore)
    // 每条 400 都在 Host 日志里带判定点（405 那条路根本不到分派，故不产生日志）。
    expect(onError.mock.calls.length).toBe(malformed.length)
    for (const call of onError.mock.calls) {
      expect(String(call[0])).toContain(`step=edit-failed status=400`)
    }
  })

  // ── ④ 注册面 / 引擎语义 / 405 ────────────────────────────────────────────────
  it('registers the edit path as an exact sibling that beats the `/skills` prefix and answers 405 + Allow: POST', async () => {
    const dshHome = await makeHome()
    await placeSkill(dshHome, 'route-skill')
    await writeSelfState(dshHome, [record('route-pkg', ['route-skill'])])
    await serve(dshHome)

    // 注册面：这条路径**恰好一条**、kind 是 exact（各恰好一处），且与 `reveal` 并列。
    const editRoutes = routes.filter(route => route.path === EDIT_PATH)
    expect(editRoutes.map(route => `${route.kind} ${route.path}`)).toEqual([`exact ${EDIT_PATH}`])
    expect(routes.some(route => route.path === ENTERPRISE_SKILL_SELF_INSTALLED_REVEAL_LOCAL_PATH)).toBe(true)
    // 引擎语义：exact 整路径优先 ⇒ 命中自己，绝不掉进 `/skills` prefix。
    expect(engineRouteMatch(routes, EDIT_PATH)?.path).toBe(EDIT_PATH)

    const before = await snapshotTree(join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS))
    const stateBefore = await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')
    fsAudit.mutations = []
    // 非 POST ⇒ 405 + `Allow: POST`，**零副作用**、零内核调用、零交接。
    for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'PATCH']) {
      const response = await fetch(`${baseUrl}${EDIT_PATH}`, { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow'), method).toBe('POST')
      if (method !== 'HEAD') expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(editCalls).toBe(0)
    expect(launched).toEqual([])
    expect(fsAudit.mutations).toEqual([])
    expect(await snapshotTree(join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS))).toEqual(before)
    expect(await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')).toBe(stateBefore)
    // 405 根本不进分派 ⇒ 不产生判定点日志。
    expect(onError).not.toHaveBeenCalled()
    // 失败投影仍走同一条判定点（`edit-failed`）。
    const logged = await post(EDIT_PATH, JSON.stringify({ name: 'never-installed-skill' }))
    expect(logged.status).toBe(404)
    expect(String(onError.mock.calls[0]?.[0])).toContain(`operation=POST ${EDIT_PATH} step=edit-failed status=404`)
  })

  // ── ⑤ 只读：写类 fs 出口零调用 + 技能树逐字节逐 mtime 不变 ────────────────────
  it('never writes: zero mutating fs calls and a byte- and mtime-identical skill tree', async () => {
    const dshHome = await makeHome()
    await placeSkill(dshHome, 'readonly-skill')
    await writeSelfState(dshHome, [record('readonly-pkg', ['readonly-skill'])])
    await serve(dshHome)
    const root = join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS)
    const before = await snapshotTree(root)
    const skillBytes = await readFile(join(root, 'readonly-skill', 'SKILL.md'), 'utf8')
    const stateBytes = await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')
    fsAudit.mutations = []

    const response = await post(EDIT_PATH, JSON.stringify({ name: 'readonly-skill' }))
    expect(response.status).toBe(200)
    // 一次「编辑」期间：`writeFile`/`rm`/`rename`/`mkdir`/`unlink`… **一个都没被调用**（本刀只读元数据）。
    expect(fsAudit.mutations).toEqual([])
    expect(await snapshotTree(root)).toEqual(before)
    expect(await readFile(join(root, 'readonly-skill', 'SKILL.md'), 'utf8')).toBe(skillBytes)
    expect(await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')).toBe(stateBytes)
    expect(await exists(join(dshHome, 'outside-target'))).toBe(false)
  })

  // ── ⑥ 源码级反锁 ─────────────────────────────────────────────────────────────
  it('keeps one argv-only execFile, no shell, no dynamic import, and a single ownership judgement shared with reveal', async () => {
    const files = (await readdir(join(ROOT, 'src'), { recursive: true })).filter(name => name.endsWith('.ts'))
    const sources = new Map<string, string>()
    for (const file of files) sources.set(file, await readFile(join(ROOT, 'src', file), 'utf8'))
    const kernel = sources.get('skill-self-installed.ts') ?? ''
    const route = sources.get('skill-self-installed-route.ts') ?? ''
    const kernelCode = stripComments(kernel)
    const routeCode = stripComments(route)

    // ① 唯一一次 `execFile`（两个默认实现共用同一个交接内核），argv 数组、无 shell、无动态 import。
    expect((kernelCode.match(/execFile\(/g) ?? []).length).toBe(1)
    expect(kernelCode).toContain("execFile(command.file, command.args, { signal, windowsHide: true }, (error) => {")
    expect(kernelCode).not.toMatch(/shell:\s*true/)
    expect(kernelCode).not.toMatch(/\bexec(Sync)?\s*\(/)
    expect(kernelCode).not.toMatch(/\bspawn(Sync)?\s*\(/)
    expect(kernelCode).not.toMatch(/\bimport\s*\(/)
    expect(routeCode).not.toMatch(/\bimport\s*\(/)
    // 文件那条的 argv 逐字（三个平台各一条；Windows 走 `cmd /c start` + 空标题，是 `start` 的固定语义）。
    expect(kernel).toContain("{ file: 'open', args: [file] }")
    expect(kernel).toContain("{ file: 'cmd', args: ['/c', 'start', '', file] }")
    expect(kernel).toContain("{ file: 'xdg-open', args: [file] }")
    expect(kernelCode).not.toMatch(/args:\s*\[`/)
    expect(kernelCode).not.toMatch(/args:\s*\[\s*[A-Za-z_$][\w$]*\s*\+/)

    // ② 归属判据**只有一份**，且三个内核逐字共用同一处实现（本刀一个新判定都没造）。
    for (const definition of ['function findSelfInstalledOwner', 'function centerClaimsName', 'function resolveOwnedDirectory', 'function resolveOwnedSkillFile']) {
      const owners = [...sources.entries()].filter(([, text]) => text.includes(definition)).map(([file]) => file)
      expect(owners, definition).toEqual(['skill-self-installed.ts'])
    }
    expect((kernelCode.match(/findSelfInstalledOwner\(records, skillName\)/g) ?? []).length).toBe(3)
    expect((kernelCode.match(/centerClaimsName\(options, skillName\)/g) ?? []).length).toBe(3)
    // 目录落点解析：三个内核都用**同一处**实现（`uninstall`/`reveal` 直接调，`edit` 经文件层调）。
    expect((kernelCode.match(/await resolveOwnedDirectory\(/g) ?? []).length).toBe(3)
    expect((kernelCode.match(/resolveOwnedDirectory\(\{ dshHome \}, skillName\)/g) ?? []).length).toBe(2)
    expect((kernelCode.match(/resolveOwnedDirectory\(deps, name\)/g) ?? []).length).toBe(1)
    expect((kernelCode.match(/resolveOwnedSkillFile\(\{ dshHome \}, skillName\)/g) ?? []).length).toBe(1)
    // `edit` 与 `reveal` 的那三行落点/归属解析**逐字相同**。
    const sharedLines = [
      'const owner = findSelfInstalledOwner(records, skillName)',
      'if (owner === undefined || await centerClaimsName(options, skillName)) {',
      "throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'this skill is not installed by the user')",
    ]
    for (const line of sharedLines) expect((kernelCode.match(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, line).toBe(3)

    // ③ 路由：这条路径常量恰好一处、正文门禁与失败投影只有一份（三条路共用）。
    expect(routeCode).toContain('export const ENTERPRISE_SKILL_SELF_INSTALLED_EDIT_LOCAL_PATH =')
    expect((routeCode.match(/self-installed\/edit/g) ?? []).length).toBe(1)
    expect((routeCode.match(/kind: 'exact'/g) ?? []).length).toBe(3)
    expect((routeCode.match(/async function readSkillNameBody/g) ?? []).length).toBe(1)
    expect((routeCode.match(/readSkillNameBody\(request\)/g) ?? []).length).toBe(3)
    expect((routeCode.match(/projectSelfInstalledActionFailure\(error, '/g) ?? []).length).toBe(3)
    expect(routeCode).toContain("projectSelfInstalledActionFailure(error, 'edit-failed')")
    const composition = sources.get('index.ts') ?? ''
    expect((composition.match(/edit: \(name, signal\) => editSelfInstalledSkill\(skillInstallOptions, name, signal\)/g) ?? []).length).toBe(1)
    expect((composition.match(/registerEnterpriseSelfInstalledActionRoutes\(/g) ?? []).length).toBe(1)

    // ④ 只有一个名称：端口形状收的仍是一个 `name`（"传路径进来"不可表达）。
    expect(route).toContain('edit(name: string, signal: AbortSignal): Promise<unknown>')
    expect(route).toContain("interface EnterpriseSelfInstalledActionRoutePort {")
    // ⑤ platform-client 一个字节都没动（本刀零新增路由/零新增码）。
    const platformApi = await readFile(join(ROOT, '..', 'platform-client', 'src', 'local-api.ts'), 'utf8')
    expect(platformApi).not.toContain('self-installed/edit')
    expect(platformApi.match(/export function enterpriseLocalErrorStatus/g)).toHaveLength(1)
    // ⑥ 本面**不写第二张码→状态表**：失败状态一律取自 `failure.status`，源文件里没有 4xx/5xx 字面量。
    expect(routeCode).toContain('writeJson(response, failure.status, { error: { code: failure.code } })')
    expect(routeCode).not.toMatch(/writeJson\(response,\s*(404|409|413|500|502|503)/)
  })

  // ── ⑦ 复用既有码：一枚新码都不加 ──────────────────────────────────────────────
  it('reuses only the six existing codes and maps them through the single platform-client table', async () => {
    const kernel = await readFile(join(ROOT, 'src', 'skill-self-installed.ts'), 'utf8')
    const route = await readFile(join(ROOT, 'src', 'skill-self-installed-route.ts'), 'utf8')
    // ★`\b` 边界是必须的：`JSON_CONTENT_TYPE` 里也含 `ENT_TYPE` 这串字面量（那是 content-type，不是码）。
    const codes = [...new Set([...stripComments(kernel + route).matchAll(/\bENT_[A-Z0-9_]+\b/g)].map(match => match[0]))].sort()
    expect(codes).toEqual([
      'ENT_INVALID_REQUEST',
      'ENT_PLATFORM_UNAVAILABLE',
      'ENT_RESOURCE_NOT_FOUND',
      'ENT_SKILL_CONTENT_INVALID',
      'ENT_SKILL_INSTALL_FAILED',
      'ENT_SKILL_NAME_CONFLICT',
    ])
    // ★「编辑」这条面没有第 8 枚码，`skill-errors.ts` 的码边界也一字未动。
    expect(kernel + route).not.toMatch(/\bENT_[A-Z0-9_]*EDIT/)
    const skillErrors = await readFile(join(ROOT, 'src', 'skill-errors.ts'), 'utf8')
    expect(skillErrors).not.toMatch(/\bENT_[A-Z0-9_]*EDIT/)
    // 状态码全部走 platform-client 那张唯一表（这里逐枚把本面会用到的映射钉死）。
    const { enterpriseLocalErrorStatus } = await import('@dshent/platform-client')
    expect(enterpriseLocalErrorStatus(new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', 'x'))).toBe(400)
    expect(enterpriseLocalErrorStatus(new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'x'))).toBe(404)
    expect(enterpriseLocalErrorStatus(new EnterpriseSkillInstallError('ENT_SKILL_NAME_CONFLICT', 'x'))).toBe(409)
    expect(enterpriseLocalErrorStatus(new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'x'))).toBe(409)
    expect(enterpriseLocalErrorStatus(new EnterpriseSkillInstallError('ENT_PLATFORM_UNAVAILABLE', 'x'))).toBe(503)
    expect(enterpriseLocalErrorStatus(new EnterpriseSkillInstallError('ENT_SKILL_STATE_INVALID', 'x'))).toBe(503)
    expect(enterpriseLocalErrorStatus(new EnterpriseSkillInstallError('ENT_SKILL_INSTALL_FAILED', 'x'))).toBe(503)
  })
})
