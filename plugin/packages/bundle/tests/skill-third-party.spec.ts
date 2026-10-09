/**
 * [INPUT]: 依赖 `src/skill-third-party.ts` 的根表/盘点/安装三件事与逐键清单、`src/skill-third-party-route.ts` 的两条路由注册器与路径常量、`src/skill-system.ts` 的 `digestSkillDirectory`（摘要口径的对照物）、`src/skill-upload.ts` 的 `SELF_INSTALLED_STATE_FILENAME`、`src/skill-install.ts` 的平台面类型、`@dshent/platform-client` 的 route port 类型、`tests/engine-route-match.ts`（引擎语义分发）、node:http/fs/crypto
 * [OUTPUT]: 锁定口径 62 宿主侧：① 根表逐条（**15 个根**、三处环境变量覆盖与各自 fallback、`agents` 与 `agents-xdg` **同名不同 id**、只列存在的根）；② 响应**逐键集合断言** + ★`path` 与任何宿主绝对路径**都不在响应体里**（含嵌套，反向锁 grep 整份响应）；③ 排序确定性（根表序 + 根内 name 码元升序，两次扫描逐字节相同）；④ 三态各一格（`installed`/`conflict`/`available`，含「自家根同名但不同技能」的 conflict）；⑤ **安装 = 复制**（`<dshHome>/skills/<name>/SKILL.md` 真的出现、**源目录 mtime 与文件列表逐字节不变**、自装记录七键形状、摘要与 `digestSkillDirectory` 同值）；⑥ 冲突与幂等（同名不同技能 409 `ENT_SKILL_NAME_CONFLICT`、重复安装 409 `ENT_SKILL_ALREADY_REGISTERED`）；⑦ 路径门禁（不在候选集 / `..` / 绝对路径 / 盘符 / 符号链接 / 目录名被换成链接 **一律拒且在复制之前**）；⑧ 失败不静默（扫描抛错 ⇒ 503 + `ENT_SKILL_THIRD_PARTY_UNAVAILABLE` + **绝不是 200 空列表**）；⑨ 405 两处 + `Allow`；⑩ 源码级反锁（没有 `exec`/`spawn`/动态 import；`/skills/adopt` 与 `/skills/system-search` 两条既有路由**一字未改**）
 * [POS]: bundle 技能纵深**第四面**（口径 62「本地三方 Agent 技能源」）的回归门禁；有人把 `path` 放进响应、把扫描抛错折成空列表、把安装改成 move/删源、不查候选集直接按 `path` 装、覆盖同名技能、或顺手改了两条既有路由，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WebServerRoutePort } from '@dshent/platform-client'
import { digestSkillDirectory } from '../src/skill-system.js'
import type { EnterpriseSkillInstallPlatformPort } from '../src/skill-install.js'
import {
  buildThirdPartySkillRoots,
  discoverThirdPartySkills,
  ENTERPRISE_THIRD_PARTY_ROOT_KEYS,
  ENTERPRISE_THIRD_PARTY_ROOT_OPTIONAL_KEYS,
  ENTERPRISE_THIRD_PARTY_SKILL_KEYS,
  ENTERPRISE_THIRD_PARTY_SKILL_OPTIONAL_KEYS,
  ENT_SKILL_THIRD_PARTY_UNAVAILABLE,
  installThirdPartySkill,
  thirdPartySkillRootId,
  type EnterpriseThirdPartySkillOptions,
} from '../src/skill-third-party.js'
import {
  ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH,
  ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH,
  projectThirdPartySkillFailure,
  registerEnterpriseThirdPartySkillRoutes,
} from '../src/skill-third-party-route.js'
import { SELF_INSTALLED_STATE_FILENAME } from '../src/skill-upload.js'
import { engineRouteMatch, type RegisteredRoute } from './engine-route-match.js'

const SKILL_ROOT_RELATIVE = 'skills'
const SELF_STATE_RELATIVE = join('enterprise', 'skill-installs', SELF_INSTALLED_STATE_FILENAME)
const NOW = '2026-10-06T00:00:00.000Z'
/** 源目录的 mtime 固定成一个明确的过去值：任何写入都会让它变（比"读两次比 mtime"更强）。 */
const SOURCE_MTIME = new Date('2020-01-02T03:04:05.000Z')
const homes: string[] = []
const servers: Server[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome / 临时 home：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeTemp(prefix: string): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, prefix))
  homes.push(path)
  return path
}

const makeHome = (): Promise<string> => makeTemp('dshent-third-party-home-')

/** 平台面**故意会抛**：这三件事都不许发网络请求，真发了就让测试红。 */
function offlinePlatform(): EnterpriseSkillInstallPlatformPort {
  return {
    request: async () => {
      throw new Error('third-party skill discovery must never touch the network')
    },
  }
}

function options(
  dshHome: string,
  home: string,
  env: Readonly<Record<string, string | undefined>> = {},
): EnterpriseThirdPartySkillOptions {
  return { platform: offlinePlatform(), dshHome, home, env, now: () => new Date(NOW) }
}

/** 在某个根下造一份技能目录：`<root>/<directory>/SKILL.md`（`name` 与目录名可以故意不同）。 */
async function writeSkill(
  root: string,
  directory: string,
  name: string,
  description = `${name} 的说明`,
): Promise<string> {
  const path = join(root, directory)
  await mkdir(path, { recursive: true })
  await writeFile(join(path, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n正文\n`, 'utf8')
  return path
}

/** 一棵真实源树的"逐字节证据"：文件清单、每份大小/字节摘要与**根目录的 mtime**。 */
interface SourceSnapshot {
  readonly listing: readonly string[]
  readonly digest: string
  readonly mtimeMs: number
}

async function snapshotSource(directory: string): Promise<SourceSnapshot> {
  const listing = (await readdir(directory, { recursive: true })).sort()
  const digest = await digestSkillDirectory(directory)
  const stats = (await stat(directory)).mtimeMs
  return { listing, digest, mtimeMs: stats }
}

/** 一条稳定的失败码（不吞「居然成功了」这种最危险的形态）。 */
async function codeOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action()
    return '<resolved>'
  } catch (error) {
    return (error as { code?: string }).code ?? '<no-code>'
  }
}

/* ────────────────────────── 真路由 + 真 HTTP ────────────────────────── */

interface WiredServer {
  readonly baseUrl: string
  readonly routes: RegisteredRoute[]
}

/** 真 Node HTTP + 引擎语义分发（exact 整路径优先、prefix 取最长），与生产同一套注册面形状。 */
async function wire(
  port?: Parameters<typeof registerEnterpriseThirdPartySkillRoutes>[1],
  onError?: (message: string, error: unknown) => void,
): Promise<WiredServer> {
  const routes: RegisteredRoute[] = []
  const webServer: WebServerRoutePort = {
    host: '127.0.0.1',
    port: 0,
    register: (registered) => {
      routes.push(registered)
      return () => {
        const index = routes.indexOf(registered)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }
  registerEnterpriseThirdPartySkillRoutes(webServer, port, onError)
  const server = createServer((request, response) => {
    const route = engineRouteMatch(routes, (request.url ?? '/').split('?')[0]!)
    if (route === undefined) {
      response.writeHead(404).end()
      return
    }
    void Promise.resolve(route.handler(request, response))
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing test port')
  return { baseUrl: `http://127.0.0.1:${address.port}`, routes }
}

/** 一条真实源树（含嵌套资源文件，用来证明复制是整棵树的复制）。 */
async function seedSource(home: string): Promise<{ readonly root: string, readonly directory: string }> {
  const root = join(home, '.claude', 'skills')
  const directory = await writeSkill(root, 'source-skill', 'copied-skill', '从 Claude Code 复制来的技能')
  await mkdir(join(directory, 'references'), { recursive: true })
  await writeFile(join(directory, 'references', 'guide.md'), '参考资料 · café\n', 'utf8')
  await utimes(directory, SOURCE_MTIME, SOURCE_MTIME)
  return { root, directory }
}

/* ────────────────────────── ① 根表 ────────────────────────── */

describe('本地三方技能根表（内建，不由界面声明）', () => {
  it('逐条搬 Cherry 的 15 个根（一个不删）+ 本机普查新增的 10 个：id/name/默认路径一字不差', () => {
    const home = '/home/tester'
    const roots = buildThirdPartySkillRoots(home, {})
    // ★Cherry 那 15 个**原样在前**（别的机器上它们是真根，绝不为"本机没有"删根）。
    expect(roots.slice(0, 15).map(root => [root.id, root.name])).toEqual([
      ['agents', 'Agent Skills'],
      // ★同名重根：`agents` 与 `agents-xdg` 的 name 都是 "Agent Skills" —— 只能靠 id 区分。
      ['agents-xdg', 'Agent Skills'],
      ['claude-code', 'Claude Code'],
      ['codex', 'Codex'],
      ['cursor', 'Cursor'],
      ['gemini-cli', 'Gemini CLI'],
      ['github-copilot', 'GitHub Copilot'],
      ['opencode', 'OpenCode'],
      ['openclaw', 'OpenClaw'],
      ['clawdbot', 'ClawdBot'],
      ['moltbot', 'MoltBot'],
      ['qoder', 'Qoder'],
      ['qoder-cn', 'Qoder CN'],
      ['qwen-code', 'Qwen Code'],
      ['minimax-code', 'MiniMax Code'],
    ])
    // ★本机真机普查新增的 10 个（`~/.agents/skills`/`~/.claude/skills`/`~/.openclaw/skills` 三个
    // 早已在 Cherry 那 15 个里，不重复造 id；`~/.dsh/skills` 是我们自己的根，也进表）。
    expect(roots.slice(15).map(root => [root.id, root.name])).toEqual([
      ['workbuddy', 'WorkBuddy'],
      ['workbuddy-marketplace', 'WorkBuddy 市场'],
      ['codebuddy-marketplace', 'CodeBuddy 市场'],
      ['mateclaw', 'MateClaw'],
      ['trae-cn', 'Trae CN'],
      ['qoderworkcn', 'QoderWork CN'],
      ['hermes', 'Hermes'],
      ['dsh', 'DSH'],
      ['junie', 'Junie'],
      ['roo', 'Roo Code'],
    ])
    expect(roots).toHaveLength(25)
    expect(new Set(roots.map(root => root.id)).size).toBe(25)
    // 同名是**真实存在**的（不是我们写错）：id 唯一、name 可以撞。
    expect(roots.filter(root => root.name === 'Agent Skills').map(root => root.id)).toEqual(['agents', 'agents-xdg'])
    expect(roots.map(root => root.path)).toEqual([
      join(home, '.agents', 'skills'),
      join(home, '.config', 'agents', 'skills'),
      join(home, '.claude', 'skills'),
      join(home, '.codex', 'skills'),
      join(home, '.cursor', 'skills'),
      join(home, '.gemini', 'skills'),
      join(home, '.copilot', 'skills'),
      join(home, '.config', 'opencode', 'skills'),
      join(home, '.openclaw', 'skills'),
      join(home, '.clawdbot', 'skills'),
      join(home, '.moltbot', 'skills'),
      join(home, '.qoder', 'skills'),
      join(home, '.qoder-cn', 'skills'),
      join(home, '.qwen', 'skills'),
      join(home, '.minimax', 'skills'),
      join(home, '.workbuddy', 'skills'),
      join(home, '.workbuddy', 'skills-marketplace', 'skills'),
      join(home, '.codebuddy', 'skills-marketplace', 'skills'),
      join(home, '.mateclaw', 'skills'),
      join(home, '.trae-cn', 'skills'),
      join(home, '.qoderworkcn', 'skills'),
      join(home, '.hermes', 'skills'),
      join(home, '.dsh', 'skills'),
      join(home, '.junie', 'skills'),
      join(home, '.roo', 'skills'),
    ])
    // ★两个市场根是**独立来源**（本机实测仅 23 枚同名）⇒ 各自一根，绝不合并。
    expect(roots.filter(root => root.id.endsWith('-marketplace')).map(root => root.path)).toEqual([
      join(home, '.workbuddy', 'skills-marketplace', 'skills'),
      join(home, '.codebuddy', 'skills-marketplace', 'skills'),
    ])
  })

  it('★排除的五类：表里不出现检出/项目树、内置/包内、连接器市场包、嵌套与测试脚手架', () => {
    const home = '/home/tester'
    // 这些路径**本来就不在**声明里；`thirdPartyRootExcluded` 是兜底。这里直接锁"表里没有任何一条命中"。
    const paths = buildThirdPartySkillRoots(home, {}).map(root => root.path)
    expect(paths.some(path => path.includes('connectors-marketplace'))).toBe(false)
    expect(paths.some(path => path.includes('builtin'))).toBe(false)
    expect(paths.some(path => path.includes('skill-packages'))).toBe(false)
    expect(paths.some(path => path.includes('.sshwork'))).toBe(false)
    expect(paths.some(path => path.includes('.git'))).toBe(false)
    // 本机真机上那几类反例的**形状**（逐个不在表里）。
    for (const excluded of [
      join(home, 'WorkBuddy', 'AionUi', '.claude', 'skills'),
      join(home, 'DPH', 'halo-dsh', '.agents', 'skills'),
      join(home, 'Documents', 'HIWORK', 'skillhub', 'skills'),
      join(home, '资料', 'AgentPro', 'skills'),
      join(home, '.trae-cn', 'builtin', 'suite', 'skills'),
      join(home, '.octop', 'skill-packages', 'pkg', 'skills'),
      join(home, '.workbuddy', 'connectors-marketplace', 'connectors', 'x', 'skills'),
      join(home, '.sshwork', 'dbg-home-abc', '.claude', 'skills'),
      join(home, '.agents', 'skills', 'some-skill', 'skills'),
    ]) {
      expect(paths, excluded).not.toContain(excluded)
    }
  })

  it('三处环境变量覆盖各自生效、且缺省 fallback 一字不改（含空白值 = 未设置）', () => {
    const home = '/home/tester'
    const byId = (env: Readonly<Record<string, string | undefined>>): Map<string, string> =>
      new Map(buildThirdPartySkillRoots(home, env).map(root => [root.id, root.path]))

    // 三个都设：`XDG_CONFIG_HOME` 同时管 `agents-xdg` 与 `opencode`。
    const configured = byId({
      XDG_CONFIG_HOME: '/xdg/config',
      CLAUDE_CONFIG_DIR: '/claude/dir',
      CODEX_HOME: '/codex/home',
    })
    expect(configured.get('agents-xdg')).toBe('/xdg/config/agents/skills')
    expect(configured.get('opencode')).toBe('/xdg/config/opencode/skills')
    expect(configured.get('claude-code')).toBe('/claude/dir/skills')
    expect(configured.get('codex')).toBe('/codex/home/skills')
    // `agents`（`~/.agents/skills`）**不受** XDG 影响（上游逐字：它只 join(home, '.agents', 'skills')）。
    expect(configured.get('agents')).toBe(join(home, '.agents', 'skills'))

    // 相对值按 home 解（照抄上游 `path.resolve(home, value)`），这是上游的原样行为。
    const relative = byId({ XDG_CONFIG_HOME: 'xdg', CLAUDE_CONFIG_DIR: './claude', CODEX_HOME: 'codex' })
    expect(relative.get('agents-xdg')).toBe(join(home, 'xdg', 'agents', 'skills'))
    expect(relative.get('claude-code')).toBe(join(home, 'claude', 'skills'))
    expect(relative.get('codex')).toBe(join(home, 'codex', 'skills'))

    // 空白值 = **未设置**（上游 `configured?.trim()`），回落各自 fallback。
    const blank = byId({ XDG_CONFIG_HOME: '   ', CLAUDE_CONFIG_DIR: '', CODEX_HOME: undefined })
    expect(blank.get('agents-xdg')).toBe(join(home, '.config', 'agents', 'skills'))
    expect(blank.get('claude-code')).toBe(join(home, '.claude', 'skills'))
    expect(blank.get('codex')).toBe(join(home, '.codex', 'skills'))
  })

  it('根表在任何情况下都回全 25 条（id 各不相同；`agents`/`agents-xdg` 仍同名）', () => {
    const roots = buildThirdPartySkillRoots('/h', { XDG_CONFIG_HOME: '/h/.config' })
    expect(roots).toHaveLength(25)
    expect(roots.filter(root => root.name === 'Agent Skills')).toHaveLength(2)
    expect(thirdPartySkillRootId('/a/b')).toHaveLength(16)
    expect(thirdPartySkillRootId('/a/b')).not.toBe(thirdPartySkillRootId('/a/c'))
  })
})

/* ────────────────────────── ②③④ 盘点面 ────────────────────────── */

describe('discoverThirdPartySkills（25 个内建根 + 三态 + 别名 + skipped）', () => {
  it('只列存在的根：不存在的根 present:false / count:0，且**不是失败**（空列表合法）', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const discovery = await discoverThirdPartySkills(options(dshHome, home))
    expect(discovery.roots).toHaveLength(25)
    expect(discovery.roots.every(root => root.present === false && root.count === 0 && root.skipped === 0)).toBe(true)
    expect(discovery.skills).toEqual([])
    // ★缺省 home 下 `.claude` 等目录**存在**（本机实测），故这里用显式空 home 锁"不存在 ⇒ 静默跳过"。
    expect(discovery.roots.map(root => root.id)).toEqual(buildThirdPartySkillRoots(home, {}).map(root => root.id))
    // 盘点不许在磁盘上留东西。
    expect(await codeOf(() => stat(join(home, '.claude')))).toBe('ENOENT')
  })

  it('每个存在的根各自报 count；候选事实认 **frontmatter 的 name**（不是目录名）', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    await writeSkill(join(home, '.claude', 'skills'), 'My Skill', 'my-skill', '目录名不是 kebab')
    await writeSkill(join(home, '.claude', 'skills'), 'plain', 'plain', '普通技能')
    await writeSkill(join(home, '.qwen', 'skills'), 'qwen-skill', 'qwen-skill')
    // 没有 SKILL.md 的目录不是候选。
    await mkdir(join(home, '.claude', 'skills', 'not-a-skill'), { recursive: true })
    const discovery = await discoverThirdPartySkills(options(dshHome, home))
    const counts = new Map(discovery.roots.map(root => [root.id, root.count]))
    expect(counts.get('claude-code')).toBe(2)
    expect(counts.get('qwen-code')).toBe(1)
    expect(counts.get('codex')).toBe(0)
    expect(discovery.skills.map(skill => [skill.name, skill.directory, skill.sourceName, skill.rootId])).toEqual([
      // 根内按 **name** 码元升序（`my-skill` < `plain`），不是按目录名（`My Skill` 会排在 `plain` 前）。
      ['my-skill', 'My Skill', 'Claude Code', 'claude-code'],
      ['plain', 'plain', 'Claude Code', 'claude-code'],
      ['qwen-skill', 'qwen-skill', 'Qwen Code', 'qwen-code'],
    ])
    expect(discovery.skills[0]!.description).toBe('目录名不是 kebab')
  })

  it('★响应逐键集合断言，且整份响应体里一个宿主绝对路径都没有（含嵌套）', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const { root, directory } = await seedSource(home)
    await writeSkill(join(home, '.agents', 'skills'), 'second', 'second', '第二枚')
    const discovery = await discoverThirdPartySkills(options(dshHome, home))

    // ① 逐键**集合**断言（多一格少一格都红）。
    expect(Object.keys(discovery).sort()).toEqual(['roots', 'skills'])
    const allowedRootKeys = [...ENTERPRISE_THIRD_PARTY_ROOT_KEYS, ...ENTERPRISE_THIRD_PARTY_ROOT_OPTIONAL_KEYS]
    for (const root0 of discovery.roots) {
      const keys = Object.keys(root0)
      // 必填五格（`id`/`name`/`present`/`count`/`skipped`）一个不少，可选格只有 `aliasOf` 一个。
      for (const key of ENTERPRISE_THIRD_PARTY_ROOT_KEYS) expect(keys, key).toContain(key)
      for (const key of keys) expect(allowedRootKeys, key).toContain(key)
      expect('path' in root0).toBe(false)
    }
    const allowedSkillKeys = [...ENTERPRISE_THIRD_PARTY_SKILL_KEYS, ...ENTERPRISE_THIRD_PARTY_SKILL_OPTIONAL_KEYS]
    for (const skill of discovery.skills) {
      const keys = Object.keys(skill)
      for (const key of ENTERPRISE_THIRD_PARTY_SKILL_KEYS) expect(keys, key).toContain(key)
      for (const key of keys) expect(allowedSkillKeys, key).toContain(key)
      expect('path' in skill).toBe(false)
    }
    // ② ★泄漏面的反向锁：整份响应正文里连宿主绝对路径的字节都不出现。
    const serialized = JSON.stringify(discovery)
    expect(serialized).not.toContain(home)
    expect(serialized).not.toContain(dshHome)
    expect(serialized).not.toContain(directory)
    expect(serialized).not.toContain(root)
    expect(serialized).not.toContain('/Users/')
    expect(serialized).not.toContain('"path"')
    // ③ 但 `sourceName` 与 `directory` 必须在（人话来源 + 目录名，界面靠它们显示）。
    // 顺序是**根表序**（`agents` 在 `claude-code` 之前），不是目录名的字母序。
    expect(discovery.skills.map(skill => [skill.sourceName, skill.directory]))
      .toEqual([['Agent Skills', 'second'], ['Claude Code', 'source-skill']])
  })

  it('★排序确定性：先根表序、根内 name 码元升序；两次扫描逐字节相同', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    // 故意让目录名顺序与技能名顺序**相反**，并且跨三个根（其中 `agents` 与 `agents-xdg` 同名）。
    await writeSkill(join(home, '.agents', 'skills'), 'zzz', 'aaa')
    await writeSkill(join(home, '.agents', 'skills'), 'aaa', 'zzz')
    await writeSkill(join(home, '.claude', 'skills'), 'middle', 'middle')
    await writeSkill(join(home, '.config', 'agents', 'skills'), 'xdg-one', 'xdg-one')
    await writeSkill(join(home, '.qwen', 'skills'), 'qwen-one', 'qwen-one')
    const first = await discoverThirdPartySkills(options(dshHome, home))
    const second = await discoverThirdPartySkills(options(dshHome, home))
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.skills.map(skill => [skill.rootId, skill.name])).toEqual([
      // 根表序：agents(0) → agents-xdg(1) → claude-code(2) → … → qwen-code(13)。
      ['agents', 'aaa'],
      ['agents', 'zzz'],
      ['agents-xdg', 'xdg-one'],
      ['claude-code', 'middle'],
      ['qwen-code', 'qwen-one'],
    ])
    // ★重名根靠 id 区分：两条 `Agent Skills` 各自独立出现，绝不按 name 合并。
    expect(first.skills.filter(skill => skill.sourceName === 'Agent Skills').map(skill => skill.rootId))
      .toEqual(['agents', 'agents', 'agents-xdg'])
  })

  it('同一个真实目录被两个根命中 ⇒ 按 canonical 路径去重、**只出厂一次**、归属取先出现的根', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    await writeSkill(join(home, '.claude', 'skills'), 'shared', 'shared')
    // 别名根：`~/.qwen/skills` 指向 `~/.claude/skills`（同一个真实目录挂在两个根下）。
    await mkdir(join(home, '.qwen'), { recursive: true })
    await symlink(join(home, '.claude', 'skills'), join(home, '.qwen', 'skills'))
    const discovery = await discoverThirdPartySkills(options(dshHome, home))
    // ★技能本体**只出厂一次**（归 canonical 根 `claude-code`）；别名那次**不 push 条目**
    //   ⇒ `skills[]` 里只有一条（`aliasOf` 也不在技能条目上，那是 `roots[]` 的键）。
    expect(discovery.skills.map(skill => [skill.name, skill.rootId])).toEqual([['shared', 'claude-code']])
    expect(Object.keys(discovery.skills[0]!).sort())
      .toEqual(['description', 'directory', 'id', 'name', 'rootId', 'sourceName', 'status'])
    expect('aliasOf' in discovery.skills[0]!).toBe(false)
    // 两个根都 `present:true`：canonical 根 1 条、**别名根 0 条**（它自己一个新候选都没带来）。
    const roots = new Map(discovery.roots.map(root => [root.id, root]))
    expect([roots.get('claude-code')!.present, roots.get('claude-code')!.count]).toEqual([true, 1])
    expect([roots.get('qwen-code')!.present, roots.get('qwen-code')!.count, roots.get('qwen-code')!.skipped])
      .toEqual([true, 0, 0])
    // ★别名根**照样在 `roots[]` 里**（归并 ≠ 消失），并带 `aliasOf`；非别名根**不给这一格**。
    expect(roots.get('qwen-code')!.aliasOf).toBe('claude-code')
    expect('aliasOf' in roots.get('claude-code')!).toBe(false)
    // ★硬约束：每根 `count` == 该根名下 `skills[]` 条数。
    for (const root of discovery.roots) {
      expect(discovery.skills.filter(skill => skill.rootId === root.id), root.id).toHaveLength(root.count)
    }
  })

  it('★三态各一格：installed / conflict（自家根同名但不同技能）/ available', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    // available
    await writeSkill(join(home, '.claude', 'skills'), 'free-skill', 'free-skill')
    // installed：`<dshHome>/skills` 下已有同名技能（磁盘真值）——候选仍在**三方根**里，故它确实出现在清单上。
    await writeSkill(join(dshHome, SKILL_ROOT_RELATIVE), 'already-there', 'already-there')
    await writeSkill(join(home, '.claude', 'skills'), 'already-there', 'already-there')
    // installed：本机自装/企业记录里有它（记录面）。
    await mkdir(join(dshHome, 'enterprise', 'skill-installs'), { recursive: true, mode: 0o700 })
    await writeFile(join(dshHome, SELF_STATE_RELATIVE), JSON.stringify({
      records: [{
        skillId: 'recorded',
        displayName: 'recorded',
        sha256: 'a'.repeat(64),
        names: ['recorded'],
        installedAt: NOW,
        sourceType: 'upload',
        sourceInput: 'recorded.dshskill',
      }],
    }), { encoding: 'utf8', mode: 0o600 })
    await writeSkill(join(home, '.claude', 'skills'), 'recorded', 'recorded')
    // conflict：候选 `mine-a` 的技能名就是**另一条候选** `mine-b` 的目录名 ⇒ 名字已被别的技能占用。
    await writeSkill(join(home, '.claude', 'skills'), 'mine-a', 'mine-b')
    const conflicting = await writeSkill(join(home, '.claude', 'skills'), 'mine-b', 'some-other')
    const discovery = await discoverThirdPartySkills(options(dshHome, home))
    // 按 `directory` 取（技能名可能撞车：`mine-a` 声明出来的技能名就叫 `mine-b`）。
    const status = new Map(discovery.skills.map(skill => [skill.directory, skill.status]))
    expect(status.get('free-skill')).toBe('available')
    expect(status.get('already-there')).toBe('installed')
    expect(status.get('recorded')).toBe('installed')
    // ★这一格正是"名字被另一个技能占着"的 conflict：`mine-a` 声明的技能名就是 `mine-b` 这个落点，
    //   两者不能同时装（先装的会占掉后一条的落点）⇒ 两条里那一条落点被占的判 conflict、不能装。
    expect(status.get('mine-b')).toBe('conflict')
    expect(status.get('mine-a')).toBe('available')
    // 而且**真的装不进去**（409 既有那枚重名码）。
    expect(await codeOf(() => installThirdPartySkill(options(dshHome, home), conflicting)))
      .toBe('ENT_SKILL_NAME_CONFLICT')
  })

  it('★别名：符号链接的候选按 realpath 归并 ⇒ 技能只出现一次、别名根带 `aliasOf` 且 count=0', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    // canonical 根里放两条真技能。
    const canonical = join(home, '.agents', 'skills')
    await writeSkill(canonical, 'brandkit', 'brandkit')
    await writeSkill(canonical, 'notes', 'notes')
    // 别名根（本机形态：整个目录里每个技能都是一个指向 canonical 的符号链接）。
    const alias = join(home, '.qwen', 'skills')
    await mkdir(alias, { recursive: true })
    await symlink(join(canonical, 'brandkit'), join(alias, 'brandkit'))
    const discovery = await discoverThirdPartySkills(options(dshHome, home))
    // ① ★每枚技能**只出厂一次**（归先出现的 `agents`）：同一个 `id` 在 `skills[]` 里只出现一次。
    expect(discovery.skills.map(skill => [skill.name, skill.rootId])).toEqual([['brandkit', 'agents'], ['notes', 'agents']])
    expect(new Set(discovery.skills.map(skill => skill.id)).size).toBe(discovery.skills.length)
    // ② ★**没有任何技能条目带 `aliasOf`**：技能条目恒为「六键必填 + 可选 `description`」。
    const allowedSkillKeys = [...ENTERPRISE_THIRD_PARTY_SKILL_KEYS, ...ENTERPRISE_THIRD_PARTY_SKILL_OPTIONAL_KEYS]
    for (const skill of discovery.skills) {
      const keys = Object.keys(skill)
      for (const key of ENTERPRISE_THIRD_PARTY_SKILL_KEYS) expect(keys, key).toContain(key)
      for (const key of keys) expect(allowedSkillKeys, key).toContain(key)
      expect('aliasOf' in skill).toBe(false)
    }
    expect(JSON.stringify(discovery.skills)).not.toContain('aliasOf')
    // ③ 别名根：`present:true` / `count:0` / `skipped:0` / `aliasOf:'agents'`。
    const roots = new Map(discovery.roots.map(root => [root.id, root]))
    expect([roots.get('qwen-code')!.present, roots.get('qwen-code')!.count,
      roots.get('qwen-code')!.skipped, roots.get('qwen-code')!.aliasOf])
      .toEqual([true, 0, 0, 'agents'])
    // ④ 两个根同名时也绝不按 `name` 合并（这里 `agents` 与 `agents-xdg` 都叫 Agent Skills）。
    expect(discovery.roots.filter(root => root.name === 'Agent Skills').map(root => root.id))
      .toEqual(['agents', 'agents-xdg'])
    // ⑤ 硬约束照旧。
    for (const root of discovery.roots) {
      expect(discovery.skills.filter(skill => skill.rootId === root.id), root.id).toHaveLength(root.count)
    }
  })

  it('★混合根：一部分候选被认领、一部分是自己新的 ⇒ **不给** `aliasOf`、count 只数自己新带来的', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const canonical = join(home, '.agents', 'skills')
    await writeSkill(canonical, 'shared', 'shared')
    // 混合根：一条指回 canonical（已被认领）、一条是自己的真目录（新候选）。
    const mixed = join(home, '.qwen', 'skills')
    await mkdir(mixed, { recursive: true })
    await symlink(join(canonical, 'shared'), join(mixed, 'shared'))
    await writeSkill(mixed, 'own-skill', 'own-skill')
    const discovery = await discoverThirdPartySkills(options(dshHome, home))
    // 技能只出现一次（`shared` 归 `agents`、`own-skill` 归 `qwen-code`）。
    expect(discovery.skills.map(skill => [skill.name, skill.rootId]))
      .toEqual([['shared', 'agents'], ['own-skill', 'qwen-code']])
    const qwen = discovery.roots.find(root => root.id === 'qwen-code')!
    // ★混合根**不给** `aliasOf`：它自己带来了新候选（不是别名的镜像）。
    expect('aliasOf' in qwen).toBe(false)
    // `count` 只数**它自己新带来的**那一条（被认领的那条不算它的）。
    expect(qwen.count).toBe(1)
    expect(qwen.skipped).toBe(0)
    // 硬约束照旧（`count` == 该根名下条数）。
    expect(discovery.skills.filter(skill => skill.rootId === 'qwen-code')).toHaveLength(qwen.count)
    // `agents` 也照旧（它认领了 `shared`）。
    const agents = discovery.roots.find(root => root.id === 'agents')!
    expect(agents.count).toBe(1)
    expect('aliasOf' in agents).toBe(false)
  })

  it('★`skipped`：有 `SKILL.md` 但过不了闸门的目录**报数**、且**不出现在 skills 列表里**', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const root = join(home, '.mateclaw', 'skills')
    // 过闸门的：正常进候选。
    await writeSkill(root, 'good-skill', 'good-skill')
    // 不过闸门的三类（真机 26 枚的三种形态）：name 非 kebab / 缺 name / 缺 description。
    const pandas = join(root, 'pandas')
    await mkdir(pandas, { recursive: true })
    await writeFile(join(pandas, 'SKILL.md'), '---\nname: Pandas\ndescription: 大写名字\n---\n', 'utf8')
    const noName = join(root, 'no-name')
    await mkdir(noName, { recursive: true })
    await writeFile(join(noName, 'SKILL.md'), '---\ndescription: 只有描述\n---\n', 'utf8')
    const noDescription = join(root, 'no-description')
    await mkdir(noDescription, { recursive: true })
    await writeFile(join(noDescription, 'SKILL.md'), '---\nname: no-description\n---\n', 'utf8')
    // ★不算 skipped 的：根本没有 `SKILL.md` 的普通子目录、以及一个普通文件。
    await mkdir(join(root, 'not-a-skill'), { recursive: true })
    await writeFile(join(root, '_bm_skillid_migration.json'), '{}', 'utf8')
    const discovery = await discoverThirdPartySkills(options(dshHome, home))
    const mateclaw = discovery.roots.find(root0 => root0.id === 'mateclaw')!
    // ★丢弃不许静默：报数（3 枚），且它们**一个都不在** skills 列表里。
    expect(mateclaw.skipped).toBe(3)
    expect(mateclaw.count).toBe(1)
    expect(discovery.skills.map(skill => skill.name)).toEqual(['good-skill'])
    for (const name of ['Pandas', 'no-name', 'no-description', 'not-a-skill']) {
      expect(discovery.skills.some(skill => skill.name === name || skill.directory === name), name).toBe(false)
    }
    // 其它根没有被这条规则误伤（全 0）。
    expect(discovery.roots.filter(root0 => root0.id !== 'mateclaw').every(root0 => root0.skipped === 0)).toBe(true)
  })

  it('★出厂契约硬约束：每根 `count` 与该根名下 `skills[]` 条数**逐字相等**', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const canonical = join(home, '.agents', 'skills')
    await writeSkill(canonical, 'brandkit', 'brandkit')
    await writeSkill(canonical, 'notes', 'notes')
    const alias = join(home, '.qwen', 'skills')
    await mkdir(alias, { recursive: true })
    await symlink(join(canonical, 'brandkit'), join(alias, 'brandkit'))
    await writeSkill(join(home, '.workbuddy', 'skills'), 'wb-one', 'wb-one')
    await writeSkill(join(home, '.workbuddy', 'skills'), 'wb-two', 'wb-two')
    const discovery = await discoverThirdPartySkills(options(dshHome, home))
    for (const root of discovery.roots) {
      // ★两处数字打架时必有一个是假的：这里逐根对账。
      expect(discovery.skills.filter(skill => skill.rootId === root.id), root.id).toHaveLength(root.count)
    }
    // 顺带：不存在/无候选的根 `count` 恒 0（不是 `undefined`、也不是 `null`）。
    for (const root of discovery.roots.filter(item => !item.present)) expect(root.count, root.id).toBe(0)
    // ★`skipped` 是**数**、不是列表：响应里不许出现"被跳过的条目"。
    expect(Object.keys(discovery).sort()).toEqual(['roots', 'skills'])
    expect(JSON.stringify(discovery)).not.toContain('skippedEntries')
    // 计数对账也落在 HTTP 面上（真路由 + 真 HTTP）。
    const { baseUrl } = await wire({
      discover: () => discoverThirdPartySkills(options(dshHome, home)),
      install: path => installThirdPartySkill(options(dshHome, home), path),
    })
    const body = await (await fetch(`${baseUrl}${ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH}`)).json() as {
      readonly data: { readonly roots: readonly { readonly id: string, readonly count: number }[], readonly skills: readonly { readonly rootId: string }[] }
    }
    for (const root of body.data.roots) {
      expect(body.data.skills.filter(skill => skill.rootId === root.id), root.id).toHaveLength(root.count)
    }
  })

  it('扫描失败**绝不静默回空列表**：根存在却列不动 ⇒ 抛唯一那枚码', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    // 让 `~/.claude/skills` 落在一个**文件**之下：`readdir` 抛 ENOTDIR 是"不存在"，而这里的 home 下
    // `.claude` 是普通文件 ⇒ `~/.claude/skills` 的 readdir 得到 ENOTDIR（会被当"不存在"）。
    await writeFile(join(home, '.qwen'), 'not a directory', 'utf8')
    // 真正的"列不动"：把根做成一个**不可读**的目录（权限 000），readdir 抛 EACCES。
    const unreadable = join(home, '.openclaw', 'skills')
    await mkdir(unreadable, { recursive: true })
    await writeSkill(unreadable, 'hidden', 'hidden')
    const { chmod } = await import('node:fs/promises')
    await chmod(unreadable, 0o000)
    try {
      expect(await codeOf(() => discoverThirdPartySkills(options(dshHome, home))))
        .toBe(ENT_SKILL_THIRD_PARTY_UNAVAILABLE)
    } finally {
      await chmod(unreadable, 0o700)
    }
  })
})

/* ────────────────────────── ⑤⑥⑦ 安装面 ────────────────────────── */

describe('installThirdPartySkill（安装 = 复制，不是 move）', () => {
  it('★复制：目标真出现、源目录 mtime 与文件列表逐字节不变、记录七键形状、摘要与 digestSkillDirectory 同值', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const { directory } = await seedSource(home)
    const before = await snapshotSource(directory)
    const installing = options(dshHome, home)
    // ★摘要口径与既有通路二**逐字同源**（同一份喂入规则）：本面那条等式就钉在这里。
    expect(before.digest).toBe(await digestSkillDirectory(directory))

    // ★记录里那枚 `sha256` 是**源目录内容**的摘要（同内容必同值、与路径无关；64 位小写十六进制）。
    const record = {
      skillId: 'copied-skill',
      displayName: 'copied-skill',
      sha256: before.digest,
      names: ['copied-skill'],
      installedAt: NOW,
      sourceType: 'system',
      // ★来源根 id（**不是**宿主绝对路径）：`path` 不进浏览器，也不进记录。
      sourceInput: 'claude-code',
    }
    const result = await installThirdPartySkill(installing, directory)
    // ① 响应与 `GET /skills/self-installed` 逐字同形（七键，一字不多），且摘要与源目录内容摘要**同值**。
    expect(result.skills[0]!.sha256).toBe(await digestSkillDirectory(directory))
    expect(result).toEqual({ skills: [record] })
    expect(Object.keys(result.skills[0]!).sort())
      .toEqual(['displayName', 'installedAt', 'names', 'sha256', 'skillId', 'sourceInput', 'sourceType'])
    // ② 目标目录真的出现（`<dshHome>/skills/<frontmatter name>`），且是整棵树的复制。
    const installed = join(dshHome, SKILL_ROOT_RELATIVE, 'copied-skill')
    expect(await readFile(join(installed, 'SKILL.md'), 'utf8')).toContain('name: copied-skill')
    expect(await readFile(join(installed, 'references', 'guide.md'), 'utf8')).toBe('参考资料 · café\n')
    expect((await readdir(installed, { recursive: true })).sort()).toEqual(before.listing)
    // 复制过去的目录是同一份内容（资源文件与 SKILL.md 逐字节相同）。
    expect(await readFile(join(installed, 'SKILL.md'), 'utf8')).toBe(await readFile(join(directory, 'SKILL.md'), 'utf8'))
    // ③ ★源目录一个字节都不动：文件列表逐字不变、mtime 逐字不变、内容摘要逐字不变。
    const after = await snapshotSource(directory)
    expect(after.listing).toEqual(before.listing)
    expect(after.mtimeMs).toBe(before.mtimeMs)
    expect(after.digest).toBe(before.digest)
    expect(after.mtimeMs).toBe(SOURCE_MTIME.getTime())
    // ④ 自装记录落盘：仍是刀 3a 那份七键清单（键集严格比对）+ 0600。
    const state = JSON.parse(await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')) as { records: unknown[] }
    expect(state.records).toEqual([record])
    // ★内容寻址：复制过去的那份目录与原目录内容相同 ⇒ `digestSkillDirectory` 给出**同一个**摘要
    //   （目录名与绝对路径都不进摘要）。
    expect(await digestSkillDirectory(installed)).toBe(before.digest)
    expect((await stat(join(dshHome, SELF_STATE_RELATIVE))).mode & 0o777).toBe(0o600)
    // ⑤ 装完之后该条在盘点上翻成 installed（磁盘真值优先）。
    expect((await discoverThirdPartySkills(installing)).skills.map(skill => [skill.name, skill.status]))
      .toEqual([['copied-skill', 'installed']])
  })

  it('★幂等与冲突：同名不同技能 409 `ENT_SKILL_NAME_CONFLICT`、重复安装 409 `ENT_SKILL_ALREADY_REGISTERED`', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const root = join(home, '.claude', 'skills')
    const first = await writeSkill(root, 'first', 'twin-skill', '甲')
    const second = await writeSkill(root, 'second', 'twin-skill', '乙')
    const other = await writeSkill(root, 'other', 'other-skill')
    const installing = options(dshHome, home)
    // 两条目录声明同一个技能名（官方 watcher 只认 frontmatter 的 name ⇒ 这就是同名两条）：
    // 盘点上两条都还是 `available`（**谁先装谁赢**）；先装的那一条成功，后一条转
    // `ENT_SKILL_ALREADY_REGISTERED` —— 那个技能名此刻已经被认领了，**绝不覆盖**。
    const status = new Map((await discoverThirdPartySkills(installing)).skills.map(skill => [skill.directory, skill.status]))
    expect(status.get('first')).toBe('available')
    expect(status.get('second')).toBe('available')
    await installThirdPartySkill(installing, first)
    expect(await codeOf(() => installThirdPartySkill(installing, second))).toBe('ENT_SKILL_ALREADY_REGISTERED')
    // 已装的那一条：`<dshHome>/skills/twin-skill` 存在，且 `SKILL.md` 是**第一条**的内容（没被第二条覆盖）。
    const twin = join(dshHome, SKILL_ROOT_RELATIVE, 'twin-skill')
    expect(await readFile(join(twin, 'SKILL.md'), 'utf8')).toContain('description: 甲')
    // 再装同一条 ⇒ ALREADY_REGISTERED（且源目录仍逐字节不变）。
    const before = await snapshotSource(first)
    expect(await codeOf(() => installThirdPartySkill(installing, first))).toBe('ENT_SKILL_ALREADY_REGISTERED')
    expect((await snapshotSource(first)).digest).toBe(before.digest)
    // 「落点被**盘上已有的别的技能**占着」⇒ 409 `ENT_SKILL_NAME_CONFLICT`：
    // 盘上 `taken-dir` 里装的是 `another-skill`，而候选 `collide` 要落的目录名也是 `taken-dir`。
    await writeSkill(join(dshHome, SKILL_ROOT_RELATIVE), 'taken-dir', 'another-skill')
    const collide = await writeSkill(root, 'collide', 'taken-dir')
    expect(await codeOf(() => installThirdPartySkill(installing, collide))).toBe('ENT_SKILL_NAME_CONFLICT')
    // ★逐字锁住没有被覆盖：`another-skill` 的 SKILL.md 一字未改，且**没有**多出 `taken-dir/brand-new-skill`。
    expect(await readFile(join(dshHome, SKILL_ROOT_RELATIVE, 'taken-dir', 'SKILL.md'), 'utf8'))
      .toContain('name: another-skill')
    expect(await codeOf(() => stat(join(dshHome, SKILL_ROOT_RELATIVE, 'taken-dir', 'brand-new-skill')))).toBe('ENOENT')
    // 零副作用：被拒那一条一个字节都没落（自装清单仍是 `first` 那条）。
    const state = JSON.parse(await readFile(join(dshHome, SELF_STATE_RELATIVE), 'utf8')) as { records: { skillId: string }[] }
    expect(state.records.map(record => record.skillId)).toEqual(['twin-skill'])
    // `other` 那条（技能名与任何盘上目录都不同）仍能正常装。
    await installThirdPartySkill(installing, other)
    expect(await codeOf(() => installThirdPartySkill(installing, other))).toBe('ENT_SKILL_ALREADY_REGISTERED')
  })

  it('★路径门禁与符号链接门禁全部在**复制之前**（零落盘）', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const root = join(home, '.claude', 'skills')
    const real = await writeSkill(root, 'real', 'real-skill')
    // 根内的目录符号链接：指向根外的一份真技能（lstat 不跟随 ⇒ 不候选）。
    const outside = await writeSkill(join(home, 'outside'), 'escaped', 'escaped-skill')
    await symlink(outside, join(root, 'link-skill'))
    // 目录名被换成符号链接（真实目录被换走）。
    const replaced = await writeSkill(root, 'replaced', 'replaced-skill')
    await rm(replaced, { recursive: true, force: true })
    await symlink(outside, replaced)
    const installing = options(dshHome, home)
    const discovery = await discoverThirdPartySkills(installing)
    // ★目录符号链接**跟随一次**收成候选（本机 40+ 个别名根就是这个形态）：canonical 路径是**链接目标**，
    //   `directory` 仍是链接名；根外的目录因此能被认出（`link-skill` 与 `replaced` 都指向 `outside/escaped`）。
    // ★`link-skill` 与 `replaced` 都指向同一份真实目录（`outside/escaped`）⇒ 按 canonical 路径去重后
    //   只出厂**一条**（先出现的那个目录名），另一条**不出厂**（别名那次不 push 条目）。
    const byDirectory = new Map(discovery.skills.map(skill => [skill.directory, skill]))
    expect([...byDirectory.keys()].sort()).toEqual(['link-skill', 'real'])
    expect(byDirectory.get('link-skill')!.name).toBe('escaped-skill')
    expect(byDirectory.get('real')!.name).toBe('real-skill')

    // 链接目标那条真目录本身：`realpath` 与候选逐字相等 ⇒ **可以装**（它就是候选身份的 canonical 路径）。
    // 而链接路径（`root/link-skill`）本来就 realpath 到它，两条都通向同一条候选 —— 这不是漏，是"canonical 为准"。
    for (const path of [
      join(root, 'SKILL.md'),            // 文件不是目录
      join(root, 'real', 'SKILL.md'),    // 更深的文件
      root,                              // 根本身
      join(home, 'nowhere'),             // 不存在
      'skills/real',                     // 相对路径
      '/',                               // 绝对但不在候选集
      'C:\\windows\\system32',           // 盘符（且不是绝对 POSIX 路径）
      '',                                // 空串
      `${join(root, 'real')}\u0000x`,    // 控制字符
    ]) {
      expect(await codeOf(() => installThirdPartySkill(installing, path)), path)
        .toBe('ENT_SKILL_DISCOVERY_UNKNOWN')
    }
    // ★复制之前就拒：目标根与自装清单都不存在（一次都没落盘）。
    expect(await codeOf(() => stat(join(dshHome, SELF_STATE_RELATIVE)))).toBe('ENOENT')
    expect(await codeOf(() => stat(join(dshHome, SKILL_ROOT_RELATIVE)))).toBe('ENOENT')
    // 反过来：候选集里那一条**能**装（证明上面拒的都不是"整条路都坏了"）。
    await installThirdPartySkill(installing, real)
    expect(await codeOf(() => stat(join(dshHome, SKILL_ROOT_RELATIVE, 'real-skill', 'SKILL.md')))).toBe('<resolved>')
    // ★符号链接那条候选也能装（复制的是**链接目标**的内容，链接本身不进 DSH 的根）。
    await installThirdPartySkill(installing, join(root, 'link-skill'))
    expect(await readFile(join(dshHome, SKILL_ROOT_RELATIVE, 'escaped-skill', 'SKILL.md'), 'utf8'))
      .toContain('name: escaped-skill')
    // 源目录（链接目标）一个字节不动：它仍在原处、内容不变。
    expect(await readFile(join(outside, 'SKILL.md'), 'utf8')).toContain('name: escaped-skill')
  })

  it('复用既有闸门：frontmatter 不过的目录**不候选**（也就装不进去），磁盘零改动', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const root = join(home, '.claude', 'skills')
    const broken = join(root, 'broken')
    await mkdir(broken, { recursive: true })
    // 旧字段名（服务端 `LEGACY_FIELDS` 逐字同源的那三枚之一）：既有 `validateSkillFrontmatter` 立即 fail-closed
    // 拒掉（`ENT_SKILL_SKILLMD_INVALID`）；未知键（如 `allowed-tools`）则是 D4-10「容忍但不透传」，故不能拿它当夹具。
    await writeFile(join(broken, 'SKILL.md'), '---\nname: broken\ndescription: x\nmodelInvocable: true\n---\n', 'utf8')
    const installing = options(dshHome, home)
    expect((await discoverThirdPartySkills(installing)).skills).toEqual([])
    expect(await codeOf(() => installThirdPartySkill(installing, broken))).toBe('ENT_SKILL_DISCOVERY_UNKNOWN')
    expect(await codeOf(() => stat(join(dshHome, SKILL_ROOT_RELATIVE)))).toBe('ENOENT')
  })
})

/* ────────────────────────── ⑧⑨ 路由面 ────────────────────────── */

describe('GET /third-party 与 POST /third-party/install（真 HTTP + 引擎语义）', () => {
  it('★两条 exact 路由都抢在 `/skills` prefix 之前命中（注册面形状）', async () => {
    const { routes } = await wire()
    expect(routes.map(route => [route.kind, route.path])).toEqual([
      ['exact', ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH],
      ['exact', ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH],
    ])
    // 引擎语义：exact 整路径优先 ⇒ 这两条绝不会掉进那条 `/skills` prefix（否则会被当包 id 判 400）。
    const listRoute: RegisteredRoute = { kind: 'prefix', path: '/enterprise/api/v1/local/skills', handler: async () => {} }
    for (const path of [ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH, ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH]) {
      expect(engineRouteMatch([...routes, listRoute], path)).toBe(routes.find(route => route.path === path))
    }
  })

  it('GET 200：真扫描 → 单键信封；非 GET 405 + `Allow: GET`', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    await seedSource(home)
    const { baseUrl } = await wire({
      discover: () => discoverThirdPartySkills(options(dshHome, home)),
      install: path => installThirdPartySkill(options(dshHome, home), path),
    })
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    const body = await response.text()
    // ★整份响应正文里连宿主绝对路径的字节都不出现（HTTP 面同一把尺）。
    expect(body).not.toContain(home)
    expect(body).not.toContain(dshHome)
    expect(body).not.toContain('/Users/')
    expect(body).not.toContain('"path"')
    const parsed = JSON.parse(body) as { readonly data: { readonly roots: readonly unknown[], readonly skills: readonly unknown[] } }
    expect(Object.keys(parsed)).toEqual(['data'])
    expect(parsed.data.roots).toHaveLength(25)
    expect(parsed.data.skills).toHaveLength(1)

    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const failed = await fetch(`${baseUrl}${ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH}`, { method })
      expect(failed.status, method).toBe(405)
      expect(failed.headers.get('allow'), method).toBe('GET')
      expect(await failed.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
  })

  it('POST install 200：真复制；正文键集恰好 `{path}`；非 POST 405 + `Allow: POST`', async () => {
    const dshHome = await makeHome()
    const home = await makeHome()
    const { directory } = await seedSource(home)
    const wiring = options(dshHome, home)
    const { baseUrl } = await wire({
      discover: () => discoverThirdPartySkills(wiring),
      install: path => installThirdPartySkill(wiring, path),
    })
    const endpoint = `${baseUrl}${ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH}`
    const post = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }): Promise<Response> =>
      fetch(endpoint, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })

    // 关闭键集：多键 / 少键 / 非字符串 / 空串 / 超长 / 非 JSON / content-type 不对 一律 400，且**不进端口**。
    const install = vi.fn<() => Promise<unknown>>(async () => ({ skills: [] }))
    const { baseUrl: guarded } = await wire({ discover: async () => ({ roots: [], skills: [] }), install })
    const guardedEndpoint = `${guarded}${ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH}`
    const guardedPost = (init: RequestInit): Promise<Response> => fetch(guardedEndpoint, { method: 'POST', ...init })
    for (const [label, init, expected] of [
      // 形状门禁一律 400（`TypeError` 在唯一那张表上就是 400）：越界键、非字符串、空串、超长、非 JSON、
      // 非对象、`content-type` 不是 `application/json` —— 一条都**不进端口**。
      ['多键', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: directory, extra: 1 }) }, 400],
      ['少键', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) }, 400],
      ['非字符串', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: 7 }) }, 400],
      ['空串', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '' }) }, 400],
      ['超长', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: 'a'.repeat(1025) }) }, 400],
      ['非 JSON', { headers: { 'content-type': 'application/json' }, body: 'not json' }, 400],
      ['非对象', { headers: { 'content-type': 'application/json' }, body: '[]' }, 400],
      ['无 content-type', { body: JSON.stringify({ path: directory }) }, 400],
    ] as const) {
      const failed = await guardedPost(init)
      expect(failed.status, label).toBe(expected)
      expect(await failed.json(), label).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(install).not.toHaveBeenCalled()

    const response = await post({ path: directory })
    expect(response.status).toBe(200)
    const body = await response.json() as { readonly data: { readonly skills: readonly Record<string, unknown>[] } }
    expect(Object.keys(body)).toEqual(['data'])
    expect(body.data.skills).toHaveLength(1)
    expect(body.data.skills[0]!['names']).toEqual(['copied-skill'])
    expect(body.data.skills[0]!['sourceType']).toBe('system')
    expect(JSON.stringify(body)).not.toContain(home)

    // 不在候选集 ⇒ 复用**既有**那枚同义码（不为同一种结果造第二枚码）；状态码走唯一那张表
    // （`ENT_SKILL_DISCOVERY_UNKNOWN` → 404：那条目录**不是**我们发现的东西）。
    const unknown = await post({ path: join(home, 'nowhere') })
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual({ error: { code: 'ENT_SKILL_DISCOVERY_UNKNOWN' } })

    for (const method of ['GET', 'PUT', 'DELETE']) {
      const failed = await fetch(endpoint, { method })
      expect(failed.status, method).toBe(405)
      expect(failed.headers.get('allow'), method).toBe('POST')
    }
  })

  it('★失败不静默：扫描抛错 ⇒ 503 + `ENT_SKILL_THIRD_PARTY_UNAVAILABLE`，**绝不是 200 空列表**', async () => {
    const onError = vi.fn()
    // 内核那条真失败（可读权限被拿掉）由内核用例覆盖；这里锁**路由层**：端口抛 ⇒ 503 + 那枚码。
    const { baseUrl } = await wire({
      discover: async () => {
        throw new Error('the third-party scan blew up')
      },
      install: async () => {
        throw new Error('the third-party install blew up')
      },
    }, onError)
    const response = await fetch(`${baseUrl}${ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH}`)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: ENT_SKILL_THIRD_PARTY_UNAVAILABLE } })
    // ★绝不当成"空列表"：状态行与正文都不是 200/skills:[]。
    expect(onError).toHaveBeenCalled()
    expect(String(onError.mock.calls[0]![0])).toContain('step=discover-failed')
    // 安装侧同一枚码（真异常不逃到顶层、也不被折成 200）。
    const failedInstall = await fetch(`${baseUrl}${ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/x' }),
    })
    expect(failedInstall.status).toBe(503)
    expect(await failedInstall.json()).toEqual({ error: { code: ENT_SKILL_THIRD_PARTY_UNAVAILABLE } })

    // 端口整个缺席同样 fail-closed（不是"没接线 = 空列表"）。
    const { baseUrl: bare } = await wire()
    const absent = await fetch(`${bare}${ENTERPRISE_SKILL_THIRD_PARTY_LOCAL_PATH}`)
    expect(absent.status).toBe(503)
    expect(await absent.json()).toEqual({ error: { code: ENT_SKILL_THIRD_PARTY_UNAVAILABLE } })
    // 安装侧同一枚码（端口缺席时不 200、不空对象）。
    const absentInstall = await fetch(`${bare}${ENTERPRISE_SKILL_THIRD_PARTY_INSTALL_LOCAL_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/x' }),
    })
    expect(absentInstall.status).toBe(503)
    expect(await absentInstall.json()).toEqual({ error: { code: ENT_SKILL_THIRD_PARTY_UNAVAILABLE } })
  })

  it('失败投影：唯一那张码→状态表（本面新码落表尾默认 503）且只回受控码', () => {
    expect(projectThirdPartySkillFailure(new Error('boom'), 'discover-failed'))
      .toEqual({ status: 503, code: ENT_SKILL_THIRD_PARTY_UNAVAILABLE, step: 'discover-failed' })
    // 既有码原样透出（状态码走同一张表）：「不在候选集」在那张表上是 404，码也**原样**保留。
    expect(projectThirdPartySkillFailure(Object.assign(new Error('x'), { code: 'ENT_SKILL_DISCOVERY_UNKNOWN' }), 'install-failed'))
      .toEqual({ status: 404, code: 'ENT_SKILL_DISCOVERY_UNKNOWN', step: 'install-failed' })
    // 形状类失败（`TypeError`）在那张表上是 400，码归 `ENT_INVALID_REQUEST`。
    expect(projectThirdPartySkillFailure(new TypeError('bad body'), 'install-failed'))
      .toEqual({ status: 400, code: 'ENT_INVALID_REQUEST', step: 'install-failed' })
    // 任意字符串绝不进响应体。
    expect(projectThirdPartySkillFailure(Object.assign(new Error('x'), { code: 'not a code' }), 'install-failed').code)
      .toBe(ENT_SKILL_THIRD_PARTY_UNAVAILABLE)
  })
})

/* ────────────────────────── ⑩ 源码级反锁 ────────────────────────── */

describe('源码级反锁', () => {
  it('新文件没有任何执行通道（exec/spawn/child_process/动态 import）', async () => {
    const source = await readFile(new URL('../src/skill-third-party.ts', import.meta.url), 'utf8')
    const route = await readFile(new URL('../src/skill-third-party-route.ts', import.meta.url), 'utf8')
    /** 注释里会出现「rm/rename/exec」这些**词**（解释纪律），故判据只吃**去注释后的代码**。 */
    const codeOf = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const [name, text] of [['skill-third-party.ts', source], ['skill-third-party-route.ts', route]] as const) {
      const code = codeOf(text)
      expect(code, name).not.toContain('child_process')
      expect(code, name).not.toMatch(/\bexec(File|Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\bspawn(Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\bimport\s*\(/)
      // ★源目录只读：这两个文件里**没有任何写/删/改名**的调用（复制只发生在 `placeEnterpriseSkillArchive` 里，
      //   它写的是**目标**根，源树一个字节都不碰）。
      expect(code, name).not.toMatch(/\brm(Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\brename(Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\bwriteFile(Sync)?\s*\(/)
      expect(code, name).not.toMatch(/\b(rsync|cp)\b/)
      // 两个文件都不引任何子进程/复制工具链。
      expect(code, name).not.toMatch(/from 'node:child_process'/)
      // 内核（`skill-third-party.ts`）的磁盘面只有 `node:fs/promises` 的只读入口；路由层根本不碰磁盘。
      if (name === 'skill-third-party.ts') expect(code, name).toMatch(/from 'node:fs\/promises'/)
    }
    expect(source).toContain('placeEnterpriseSkillArchive')
    expect(source).toContain('validateSkillFrontmatter')
    // 本面**不引**任何复制/移动工具链（不 move、不 rsync）：源目录的存在性只被读。
    expect(source).not.toContain('node:stream')
  })

  it('★既有两条路由一字未改：`/skills/adopt` 与 `/skills/system-search` 的语义与实现原样', async () => {
    const source = await readFile(new URL('../src/skill-system.ts', import.meta.url), 'utf8')
    // 通路二仍是"只登记"：`adoptSystemSkill` 里没有落盘调用，且写的是 upsert 而非 place。
    expect(source).toContain('export async function adoptSystemSkill')
    expect(source).toContain('upsertSelfInstalledRecord')
    expect(source).not.toContain('placeEnterpriseSkillArchive')
    // 系统搜索的两条路径常量仍由 platform-client 所有（本刀没有新增第二套注册面）。
    const platform = await readFile(new URL('../../platform-client/src/local-api.ts', import.meta.url), 'utf8')
    expect(platform).toContain('ENTERPRISE_SKILL_ADOPT_LOCAL_PATH')
    expect(platform).toContain('ENTERPRISE_SKILL_SYSTEM_SEARCH_LOCAL_PATH')
    // ★本刀不动 platform-client 一个字节：新码刻意不进那张码→状态表（落表尾默认 503）。
    expect(platform).not.toContain('third-party')
    expect(platform).not.toContain(ENT_SKILL_THIRD_PARTY_UNAVAILABLE)
  })

  it('组合层反锁（源码级）：两条路由无条件接线、端口指向本面的两个真实现', async () => {
    const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(source).toContain("import { discoverThirdPartySkills, installThirdPartySkill } from './skill-third-party.js'")
    expect(source).toContain('registerEnterpriseThirdPartySkillRoutes(ctx.webServer, {')
    expect(source).toContain('discover: () => discoverThirdPartySkills(skillInstallOptions)')
    expect(source).toContain('install: path => installThirdPartySkill(skillInstallOptions, path)')
    // ★两边**同时**在（两套语义并存，各有名字）：通路二那两条不动、本面两条新加。
    expect(source).toContain('skillSystemSearch: () => discoverSystemSkills(skillInstallOptions)')
    expect(source).toContain('skillAdopt: path => adoptSystemSkill(skillInstallOptions, path)')
  })

  it('根表是**内建常量**（源码级）：15 个 id 全在源码里，且不读界面/环境声明的根清单', async () => {
    const source = await readFile(new URL('../src/skill-third-party.ts', import.meta.url), 'utf8')
    for (const id of [
      "id: 'agents'", "id: 'agents-xdg'", "id: 'claude-code'", "id: 'codex'", "id: 'cursor'",
      "id: 'gemini-cli'", "id: 'github-copilot'", "id: 'opencode'", "id: 'openclaw'", "id: 'clawdbot'",
      "id: 'moltbot'", "id: 'qoder'", "id: 'qoder-cn'", "id: 'qwen-code'", "id: 'minimax-code'",
    ]) {
      expect(source, id).toContain(id)
    }
    // 三处环境变量覆盖名一字不差。
    expect(source).toContain("env['XDG_CONFIG_HOME']")
    expect(source).toContain("env['CLAUDE_CONFIG_DIR']")
    expect(source).toContain("env['CODEX_HOME']")
    // ★`agents` 与 `agents-xdg` 的 name 逐字相同（重名是真实的，靠 id 区分）。
    expect(source.match(/name: 'Agent Skills'/g)).toHaveLength(2)
  })
})
