/**
 * [INPUT]: 依赖 `src/skill-install.ts` 的三条只读入口（`installedSkillContent`/`installedSkillFiles`/`installedSkillFile`）与它们**共用**的路径实现（`requireRelativeSkillPath`/`resolveInstalledSkillTarget`）、`src/skill-route.ts` 的 `/skills` prefix 分派、`@dshent/platform-client` 的 route port 类型、同目录的 `engine-route-match.ts` 与 `zip-fixture.ts`
 * [OUTPUT]: 锁定本机技能文件家族——文件树是真的本机目录（相对路径 / 字节数 / 类型、确定性排序、一个包多个技能目录）、单文件文本读取、**三条只读路由共用同一份路径解析**（`..`/绝对路径/盘符/反斜杠/控制字符/`%` 编码绕过/空段/`./`/超长一律 400）、未装或未知包 404、符号链接与非常规条目 409、单文件超 256 KiB 413、条目数超上限 413、二进制（非法 UTF-8 或夹 NUL）409、只读路径**完全不碰网络**，以及两条子路径在引擎语义下的可达性、查询键集门禁、注册面仍恰好两条路由
 * [POS]: bundle 技能详情子页面（下-左文件树 + 下-右文件预览）的 Host 侧回归门禁；有人把路径校验挪回路由层再写一套、放宽 `..` 或编码绕过、允许符号链接逃逸、把二进制当正文返回、或让文件树脱离本机真目录（编造 manifest.json 之类），本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import { engineRouteMatch } from './engine-route-match.js'
import {
  SKILL_FILE_MAX_ENTRIES,
  installSkillPackage,
  installedSkillContent,
  installedSkillFile,
  installedSkillFiles,
  requireRelativeSkillPath,
  resolveInstalledSkillTarget,
  type EnterpriseSkillInstallPlatformPort,
} from '../src/skill-install.js'
import {
  ENTERPRISE_SKILL_LOCAL_PATH,
  registerEnterpriseSkillRoutes,
  type EnterpriseSkillLocalFilePort,
} from '../src/skill-route.js'
import { buildZip, type ZipFixtureEntry } from './zip-fixture.js'

const LIST_PATH = '/enterprise/api/v1/skills'
const PACKAGE_ID = '1902500000000000001'
const VERSION_ID = '1902500000000000101'
const OTHER_PACKAGE_ID = '1902500000000000002'
const SKILL_NAME = 'meeting-notes'
const OTHER_SKILL_NAME = 'meeting-actions'
const NESTED_PATH = 'references/guide.md'
const FILES_SUFFIX = '/files'
const FILE_SUFFIX = '/file'
const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-skill-file-'))
  homes.push(path)
  return path
}

/**
 * 构造一个合规技能包：根 `manifest.json` + 每个技能目录的 `SKILL.md`（必在）+ 任意包内附加文件
 * （`extra` 的键是**相对技能目录**的路径，例如 `references/guide.md`）。
 */
function archiveEntries(
  names: readonly string[],
  extra: Readonly<Record<string, string>> = {},
): ZipFixtureEntry[] {
  return [
    {
      path: 'manifest.json',
      content: JSON.stringify({ format: 'dsh-skill', version: '1', id: 'meeting-pkg', name: '企业技能包', sourceDshVersion: '0.2.0-rc.2' }),
    },
    ...names.flatMap(name => [
      {
        path: `skills/${name}/SKILL.md`,
        content: `---\nname: ${name}\ndescription: 说明\n---\n正文 ${name}\n`,
      },
      ...Object.entries(extra)
        .filter(([key]) => key.startsWith(`${name}/`))
        .map(([key, content]) => ({ path: `skills/${key}`, content })),
    ]),
  ]
}

/** 中心详情的真实信封形状（`{data, requestId}`），字段与 contracts fixture 同形。 */
function detailEnvelope(archive: Buffer, names: readonly string[]): unknown {
  return {
    data: {
      id: PACKAGE_ID,
      skillId: 'meeting-pkg',
      displayName: '会议纪要技能组',
      description: '把会议录音与转写整理成结构化纪要。',
      sourceDshVersion: '0.2.0-rc.2',
      sizeBytes: archive.byteLength,
      skillCount: names.length,
      updatedAt: '2026-09-30T08:00:00Z',
      versionId: VERSION_ID,
      sha256: createHash('sha256').update(archive).digest('hex'),
      skills: names.map(name => ({ name, description: `${name} 的说明`, modelInvocable: true, userInvocable: true })),
    },
    requestId: 'req_789ABCDEFGHJKMNPQRSTVWXYZ0',
  }
}

/** 可控平台面：详情按信封返回，下载按 `download` 回调返回。 */
function platformFixture(
  detail: unknown,
  download: () => Response | Promise<Response>,
): { readonly platform: EnterpriseSkillInstallPlatformPort, readonly request: Mock<(input: string, init?: RequestInit) => Promise<Response>> } {
  const request = vi.fn(async (input: string) => {
    if (input.startsWith(`${LIST_PATH}/versions/`)) return await download()
    return new Response(JSON.stringify(detail), { headers: { 'content-type': 'application/json' } })
  })
  return { platform: { request }, request }
}

/** 真装一个技能包（走完整下载 + 校验 + 解包 + 落盘），再读它的本机文件。 */
async function installInto(
  dshHome: string,
  names: readonly string[] = [SKILL_NAME],
  extra: Readonly<Record<string, string>> = {},
): Promise<void> {
  const archive = buildZip(archiveEntries(names, extra))
  const fixture = platformFixture(detailEnvelope(archive, names), () => new Response(archive))
  await installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID)
}

/**
 * 只读入口的 options：平台面故意做成「一碰就炸」，用来证明这三条路**完全不碰网络**。
 */
function offline(dshHome: string): { readonly platform: EnterpriseSkillInstallPlatformPort, readonly dshHome: string } {
  return {
    platform: { request: vi.fn(async () => { throw new Error('the local skill file family must never touch the network') }) },
    dshHome,
  }
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'NO_ERROR'
  } catch (error) {
    return (error as { code?: string }).code ?? 'NO_CODE'
  }
}

describe('enterprise installed skill files', () => {
  it('lists the real on-disk tree with byte sizes, kinds and one deterministic order', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome, [OTHER_SKILL_NAME, SKILL_NAME], {
      [`${SKILL_NAME}/${NESTED_PATH}`]: '# 指南\n',
      [`${SKILL_NAME}/notes.txt`]: 'hello',
    })
    const options = offline(dshHome)

    const first = await installedSkillFiles(options, PACKAGE_ID)
    expect(first.packageId).toBe(PACKAGE_ID)
    // 路径码元升序：目录条目排在自己的子项之前，两个技能目录按名字先后。
    expect(first.entries.map(entry => entry.path)).toEqual([
      OTHER_SKILL_NAME,
      `${OTHER_SKILL_NAME}/SKILL.md`,
      SKILL_NAME,
      `${SKILL_NAME}/SKILL.md`,
      `${SKILL_NAME}/notes.txt`,
      `${SKILL_NAME}/references`,
      `${SKILL_NAME}/references/guide.md`,
    ])
    // 类型与**真实字节数**：目录恒 0、文件是磁盘上的 byteLength（不是字符数、不是估算）。
    const byPath = new Map(first.entries.map(entry => [entry.path, entry]))
    expect(byPath.get(OTHER_SKILL_NAME)).toEqual({ path: OTHER_SKILL_NAME, kind: 'directory', sizeBytes: 0 })
    expect(byPath.get(`${SKILL_NAME}/SKILL.md`)?.kind).toBe('file')
    expect(byPath.get(`${SKILL_NAME}/SKILL.md`)?.sizeBytes).toBe(Buffer.byteLength(`---\nname: ${SKILL_NAME}\ndescription: 说明\n---\n正文 ${SKILL_NAME}\n`))
    expect(byPath.get(`${SKILL_NAME}/notes.txt`)?.sizeBytes).toBe(5)
    expect(byPath.get(`${SKILL_NAME}/references`)?.kind).toBe('directory')
    expect(byPath.get(`${SKILL_NAME}/references/guide.md`)?.sizeBytes).toBe(Buffer.byteLength('# 指南\n'))
    // 树的键集封闭：没有宿主绝对路径、没有目录清单之外的字段。
    expect(Object.keys(first.entries[0]!).sort()).toEqual(['kind', 'path', 'sizeBytes'])
    // 确定性：同一棵树两次请求逐字节相同（界面据此稳定渲染）。
    expect((await installedSkillFiles(options, PACKAGE_ID)).entries).toEqual(first.entries)
    // 只读路径完全不碰网络。
    expect(options.platform.request).not.toHaveBeenCalled()
  })

  it('never invents a tree: unknown or uninstalled packages are 404 and malformed ids are 400', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome)
    const options = offline(dshHome)

    expect(await codeOf(installedSkillFiles(options, OTHER_PACKAGE_ID))).toBe('ENT_RESOURCE_NOT_FOUND')
    expect(await codeOf(installedSkillFile(options, OTHER_PACKAGE_ID, `${SKILL_NAME}/SKILL.md`))).toBe('ENT_RESOURCE_NOT_FOUND')
    for (const packageId of ['0', '01902500000000000001', '../1', '1a', '', '1'.repeat(20), `${PACKAGE_ID}/files`]) {
      expect(await codeOf(installedSkillFiles(options, packageId)), packageId).toBe('ENT_INVALID_REQUEST')
      expect(await codeOf(installedSkillFile(options, packageId, `${SKILL_NAME}/SKILL.md`)), packageId).toBe('ENT_INVALID_REQUEST')
    }
    // 技能目录被盘上删掉：本包落盘不完整，如实 404（不给半棵树）。
    await rm(join(dshHome, 'skills', SKILL_NAME), { force: true, recursive: true })
    expect(await codeOf(installedSkillFiles(options, PACKAGE_ID))).toBe('ENT_RESOURCE_NOT_FOUND')
  })

  it('fails closed on symlinks and non-regular entries inside the tree', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome, [SKILL_NAME], { [`${SKILL_NAME}/notes.txt`]: 'hello' })
    const options = offline(dshHome)
    const outside = join(dshHome, 'outside.md')
    await writeFile(outside, '外部文件\n', 'utf8')

    // ① 树里出现指向技能目录之外的**符号链接**：整棵树拒（409），不静默跳过、不跟随。
    const linked = join(dshHome, 'skills', SKILL_NAME, 'linked.md')
    await symlink(outside, linked)
    expect(await codeOf(installedSkillFiles(options, PACKAGE_ID))).toBe('ENT_SKILL_CONTENT_INVALID')
    await rm(linked, { force: true })

    // ② 技能目录本身是符号链接（指到别处的同名目录）：409。
    const elsewhere = join(dshHome, 'elsewhere')
    await mkdir(elsewhere, { recursive: true })
    await writeFile(join(elsewhere, 'SKILL.md'), '别处\n', 'utf8')
    const skillDir = join(dshHome, 'skills', SKILL_NAME)
    await rm(skillDir, { force: true, recursive: true })
    await symlink(elsewhere, skillDir)
    expect(await codeOf(installedSkillFiles(options, PACKAGE_ID))).toBe('ENT_SKILL_CONTENT_INVALID')
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/SKILL.md`))).toBe('ENT_SKILL_CONTENT_INVALID')
  })

  it('caps the tree at SKILL_FILE_MAX_ENTRIES and follows the 256 KiB single-file ceiling', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome)
    const options = offline(dshHome)
    const skillDir = join(dshHome, 'skills', SKILL_NAME)

    // 单文件上限与包内 SKILL.md 是同一条常量：恰好 256 KiB 合法，多一字节即 413。
    const body = join(skillDir, 'SKILL.md')
    await writeFile(body, 'a'.repeat(262_144), 'utf8')
    expect((await installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/SKILL.md`)).sizeBytes).toBe(262_144)
    await writeFile(body, 'a'.repeat(262_145), 'utf8')
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/SKILL.md`))).toBe('ENT_SKILL_CONTENT_TOO_LARGE')
    // 超限文件**仍然列得出来**（界面看得见它、读它时才拿到稳定码），而不是整棵树消失。
    expect((await installedSkillFiles(options, PACKAGE_ID)).entries.some(entry => entry.path === `${SKILL_NAME}/SKILL.md`)).toBe(true)

    // 条目数上限：目录条目 + 文件条目一起计数，超限 413（不截断成半棵树）。
    await writeFile(body, '正文\n', 'utf8')
    await Promise.all(Array.from({ length: SKILL_FILE_MAX_ENTRIES }, (_, index) => (
      writeFile(join(skillDir, `f${String(index).padStart(4, '0')}.txt`), 'x', 'utf8')
    )))
    expect(await codeOf(installedSkillFiles(options, PACKAGE_ID))).toBe('ENT_SKILL_CONTENT_TOO_LARGE')
  })

  it('reads text files and refuses every illegal path shape through the shared gate', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome, [SKILL_NAME], { [`${SKILL_NAME}/${NESTED_PATH}`]: '# 指南\n' })
    const options = offline(dshHome)

    // 显式 `SKILL.md`（界面默认选中的那个）与嵌套文件都逐字读回。
    const skill = await installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/SKILL.md`)
    expect(skill).toEqual({
      packageId: PACKAGE_ID,
      path: `${SKILL_NAME}/SKILL.md`,
      sizeBytes: Buffer.byteLength(`---\nname: ${SKILL_NAME}\ndescription: 说明\n---\n正文 ${SKILL_NAME}\n`),
      text: `---\nname: ${SKILL_NAME}\ndescription: 说明\n---\n正文 ${SKILL_NAME}\n`,
    })
    expect((await installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/${NESTED_PATH}`)).text).toBe('# 指南\n')
    // 同一份解析器也服务 `/skills/content`：同一条路径读出的正文逐字相同。
    expect((await installedSkillContent(options, PACKAGE_ID, SKILL_NAME)).content).toBe(skill.text)

    // 形状门禁（请求本身非法 → 400 族）：三种入口同一把尺，绝不带着任意路径拼文件系统。
    for (const path of [
      '..', '../x', '../../etc/passwd', '/etc/passwd', 'C:\\x', 'a\\b', 'a\u0000b', '', '.', 'a//b', 'a/./b',
      'a%2Fb', '%2e%2e%2f', '%252e%252e', `${SKILL_NAME}/%2e%2e/%2e%2e/etc/passwd`,
      `${SKILL_NAME}/../../../etc/passwd`, 'Meeting-Notes/SKILL.md', `${'a'.repeat(65)}/SKILL.md`, `${SKILL_NAME}/${'a'.repeat(300)}`,
      `${SKILL_NAME}/${'a'.repeat(2000)}`,
    ]) {
      expect(await codeOf(installedSkillFile(options, PACKAGE_ID, path)), path).toBe('ENT_INVALID_REQUEST')
    }
    // kebab 形状合法但不在本包记录里 → 404（绝不拿它拼路径）。
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, 'release-notes/SKILL.md'))).toBe('ENT_RESOURCE_NOT_FOUND')
    // 文件不在 → 404；目录当文件 → 409。
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/nope.md`))).toBe('ENT_RESOURCE_NOT_FOUND')
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, SKILL_NAME))).toBe('ENT_SKILL_CONTENT_INVALID')
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/references`))).toBe('ENT_SKILL_CONTENT_INVALID')
    // 二进制：非法 UTF-8 与「能解码但夹 NUL」都判不可预览（纯文本约定），绝不把半截字节当正文渲染。
    await writeFile(join(dshHome, 'skills', SKILL_NAME, 'raw.bin'), Buffer.from([0xff, 0xfe, 0xfd, 0x80]))
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/raw.bin`))).toBe('ENT_SKILL_CONTENT_INVALID')
    await writeFile(join(dshHome, 'skills', SKILL_NAME, 'nul.bin'), Buffer.from([0x61, 0x00, 0x62]))
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/nul.bin`))).toBe('ENT_SKILL_CONTENT_INVALID')
    // 文件本身是符号链接 → 409（lstat 不跟随 + realpath 等式双重兜底）。
    const outside = join(dshHome, 'outside.md')
    await writeFile(outside, '外部\n', 'utf8')
    await rm(join(dshHome, 'skills', SKILL_NAME, 'notes.txt'), { force: true })
    await symlink(outside, join(dshHome, 'skills', SKILL_NAME, 'notes.txt'))
    expect(await codeOf(installedSkillFile(options, PACKAGE_ID, `${SKILL_NAME}/notes.txt`))).toBe('ENT_SKILL_CONTENT_INVALID')
    expect(options.platform.request).not.toHaveBeenCalled()
  })

  it('keeps exactly one relative-path gate and one target resolver behind all three readers', async () => {
    // 纯投影：门禁本身可直调（界面/路由都不许再写第二套）。
    expect(requireRelativeSkillPath(`${SKILL_NAME}/${NESTED_PATH}`)).toEqual([SKILL_NAME, 'references', 'guide.md'])
    expect(() => requireRelativeSkillPath('a/../b')).toThrowError(/escape/)
    expect(() => requireRelativeSkillPath('a%2Fb')).toThrowError(/percent/)

    // 落点解析器也是出口上的一份：它给出规范相对路径、绝对落点与真实字节数。
    const dshHome = await makeHome()
    await installInto(dshHome)
    const target = await resolveInstalledSkillTarget(offline(dshHome), PACKAGE_ID, `${SKILL_NAME}/SKILL.md`)
    expect(target.packageId).toBe(PACKAGE_ID)
    expect(target.skillName).toBe(SKILL_NAME)
    expect(target.relativePath).toBe(`${SKILL_NAME}/SKILL.md`)
    expect(target.absolutePath).toBe(join(dshHome, 'skills', SKILL_NAME, 'SKILL.md'))
    // 未规范化落点与 `realpath` 之后的落点是**两条各自成立**的等式：`resolvedPath` 必须落在
    // 已规范化的技能目录下（本机 home 自己就可能是符号链接，故两者不逐字相等）。
    expect(target.resolvedPath).toBe(join(target.resolvedDirectory, 'SKILL.md'))
    expect(target.resolvedPath.endsWith(`/skills/${SKILL_NAME}/SKILL.md`)).toBe(true)
    expect(target.sizeBytes).toBeGreaterThan(0)

    // 源码级不变量：三个入口共用同一份实现（定义 1 处、解析器调用 3 处），路由层不做路径判定。
    const { readFile } = await import('node:fs/promises')
    const install = await readFile(new URL('../src/skill-install.ts', import.meta.url), 'utf8')
    const route = await readFile(new URL('../src/skill-route.ts', import.meta.url), 'utf8')
    expect((install.match(/export function requireRelativeSkillPath/g) ?? []).length).toBe(1)
    expect((install.match(/export async function resolveInstalledSkillTarget/g) ?? []).length).toBe(1)
    // 调用点：content + files（内部经 resolveSkillDirectoryFromRoot）+ file 各一处。
    expect((install.match(/resolveInstalledSkillTarget\(/g) ?? []).length).toBe(3)
    expect((install.match(/requireRelativeSkillPath\(/g) ?? []).length).toBe(3)
    // 路由层只分派：不许出现路径判定（`..`/绝对路径/百分号编码）的第二套实现。
    expect(route).not.toContain("'..'")
    expect(route).not.toContain('startsWith(\'/\')')
    expect(route).not.toContain("includes('%')")
  })
})

/**
 * 两条子路径的路由级门禁：注册面仍恰好两条路由，且都由**同一条既有 prefix handler** 分派。
 * 分发复用 `tests/engine-route-match.ts` 的引擎语义匹配器（与真引擎同款「exact 优先 + 最长 prefix」），
 * 绝不用裸 `startsWith` 的假匹配器。
 */
describe('GET /enterprise/api/v1/local/skills/<id>/files and /file', () => {
  let server: Server
  let baseUrl: string
  let routes: Parameters<WebServerRoutePort['register']>[0][]
  let onError: Mock<(message: string, error: unknown) => void>

  function dispatch(incoming: IncomingMessage, response: ServerResponse): void {
    const pathname = (incoming.url ?? '').split('?')[0] ?? ''
    const route = engineRouteMatch(routes, pathname)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(incoming, response))
  }

  /** 起一台本地 server，把 routes 交给真 HTTP 请求；`local` 端口由真落盘目录实现（平台面一碰就炸）。 */
  async function serve(dshHome: string, withLocalPort = true): Promise<void> {
    routes = []
    onError = vi.fn<(message: string, error: unknown) => void>()
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        routes.push(registered)
        return () => {
          routes = routes.filter(route => route !== registered)
        }
      },
    }
    const local: EnterpriseSkillLocalFilePort = {
      files: packageId => installedSkillFiles(offline(dshHome), packageId),
      file: (packageId, path) => installedSkillFile(offline(dshHome), packageId, path),
    }
    registerEnterpriseSkillRoutes(
      webServer,
      { request: vi.fn(async () => { throw new Error('the file sub-routes must never touch the network') }) },
      onError,
      withLocalPort ? local : undefined,
    )
    server = createServer(dispatch)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  }

  beforeEach(() => {
    routes = []
    onError = vi.fn()
  })

  afterEach(async () => {
    if (server !== undefined) await new Promise<void>(resolve => server.close(() => resolve()))
  })

  it('注册面仍恰好两条路由，两条子路径由同一条 prefix handler 分派', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome)
    await serve(dshHome)
    expect(ENTERPRISE_SKILL_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills')
    expect(routes.map(route => `${route.kind} ${route.path}`).sort())
      .toEqual(['exact /enterprise/api/v1/local/skills', 'prefix /enterprise/api/v1/local/skills'])
    const prefix = routes.find(route => route.kind === 'prefix')
    // 三条子路径（详情 + files + file）在引擎语义下都命中这条 prefix，注册面一条没多。
    expect(engineRouteMatch(routes, `${ENTERPRISE_SKILL_LOCAL_PATH}/${PACKAGE_ID}`)).toBe(prefix)
    expect(engineRouteMatch(routes, `${ENTERPRISE_SKILL_LOCAL_PATH}/${PACKAGE_ID}/files`)).toBe(prefix)
    expect(engineRouteMatch(routes, `${ENTERPRISE_SKILL_LOCAL_PATH}/${PACKAGE_ID}/file`)).toBe(prefix)
  })

  it('serves the real tree and one text file over the two sub-paths', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome, [SKILL_NAME], { [`${SKILL_NAME}/${NESTED_PATH}`]: '# 指南\n' })
    await serve(dshHome)

    const listed = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/${PACKAGE_ID}/files`)
    expect(listed.status).toBe(200)
    const tree = await listed.json() as { data: { packageId: string, entries: { path: string, kind: string, sizeBytes: number }[] } }
    expect(tree.data.packageId).toBe(PACKAGE_ID)
    expect(tree.data.entries.map(entry => entry.path)).toContain(`${SKILL_NAME}/${NESTED_PATH}`)

    const read = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/${PACKAGE_ID}/file?path=${encodeURIComponent(`${SKILL_NAME}/${NESTED_PATH}`)}`)
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual({
      data: { packageId: PACKAGE_ID, path: `${SKILL_NAME}/${NESTED_PATH}`, sizeBytes: Buffer.byteLength('# 指南\n'), text: '# 指南\n' },
    })
    expect(onError).not.toHaveBeenCalled()
  })

  it('narrows the query/segment shapes locally and projects failures with the shared table', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome)
    await serve(dshHome)
    const root = `${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/${PACKAGE_ID}`

    // 查询键集必须恰好一个 `path`（缺、多、重复、空一律 400，且不打上游）。
    for (const query of ['', '?', '?x=1', '?path=', '?path=a&x=1', '?path=a&path=b']) {
      const response = await fetch(`${root}${FILE_SUFFIX}${query}`)
      expect(response.status, query).toBe(400)
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    // 段形状非法（包 id 不是雪花 / 子路径不认识）一律 400，绝不带着任意路径打上游。
    for (const suffix of ['/files', '/file', `/abc${FILES_SUFFIX}`, `${FILES_SUFFIX}x`, `/abc${FILE_SUFFIX}`, `${FILE_SUFFIX}x`, `${FILES_SUFFIX}/extra`]) {
      const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}${suffix}?path=${SKILL_NAME}%2FSKILL.md`)
      expect(response.status, suffix).toBe(400)
    }
    // 编码绕过与逃逸在 bundle 侧同一份门禁里拒（400），并留判定点日志。
    for (const path of ['..', '%2e%2e%2fetc', '/etc/passwd', 'a\\b', `${SKILL_NAME}%2F..%2F..%2Fetc`, '']) {
      const response = await fetch(`${root}${FILE_SUFFIX}?path=${encodeURIComponent(path)}`)
      expect(response.status, path).toBe(400)
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    // 未装/未知包：404（与 `/skills/content` 同一份投影表）。
    const missing = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/${OTHER_PACKAGE_ID}${FILES_SUFFIX}`)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: { code: 'ENT_RESOURCE_NOT_FOUND' } })
    const missingFile = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/${OTHER_PACKAGE_ID}${FILE_SUFFIX}?path=${SKILL_NAME}%2FSKILL.md`)
    expect(missingFile.status).toBe(404)
    // 二进制 / 目录当文件 / 超限：409 / 409 / 413 三档由同一张表给。
    await writeFile(join(dshHome, 'skills', SKILL_NAME, 'raw.bin'), Buffer.from([0xff, 0xfe, 0xfd]))
    expect((await fetch(`${root}${FILE_SUFFIX}?path=${SKILL_NAME}%2Fraw.bin`)).status).toBe(409)
    expect((await fetch(`${root}${FILE_SUFFIX}?path=${SKILL_NAME}`)).status).toBe(409)
    await writeFile(join(dshHome, 'skills', SKILL_NAME, 'big.txt'), 'a'.repeat(262_145), 'utf8')
    expect((await fetch(`${root}${FILE_SUFFIX}?path=${SKILL_NAME}%2Fbig.txt`)).status).toBe(413)
    expect(onError).toHaveBeenCalled()
    // 非 GET 一律 405 并声明 Allow，且不触发任何取数。
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await fetch(`${root}${FILES_SUFFIX}`, { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow')).toBe('GET')
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
  })

  it('refuses both sub-paths with 400 when the composition layer bound no local file port', async () => {
    const dshHome = await makeHome()
    await installInto(dshHome)
    await serve(dshHome, false)
    for (const suffix of [`${FILES_SUFFIX}`, `${FILE_SUFFIX}?path=${SKILL_NAME}%2FSKILL.md`]) {
      const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_LOCAL_PATH}/${PACKAGE_ID}${suffix}`)
      expect(response.status, suffix).toBe(400)
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    // 中心详情分支一字未动（端口缺席只影响两条本机文件子路径）。
    expect(engineRouteMatch(routes, `${ENTERPRISE_SKILL_LOCAL_PATH}/${PACKAGE_ID}`)?.kind).toBe('prefix')
  })
})
