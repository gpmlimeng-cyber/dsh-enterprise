/**
 * [INPUT]: 依赖 `src/skill-system.ts` 的 `discoverSystemSkills`/`adoptSystemSkill`/`digestSkillDirectory`/`SYSTEM_ADOPT_SOURCE_TYPE`/`SKILL_SYSTEM_PRIMARY_ROOT_ID`、`src/skill-upload.ts` 的 `installedSelfSkills`/`SELF_INSTALLED_STATE_FILENAME`、`src/skill-install.ts` 的平台面类型与 node:fs/promises 的 mkdir/mkdtemp/readdir/readlink/stat/symlink/writeFile
 * [OUTPUT]: 在真实临时 dshHome 上锁定通路二「系统搜索 → 纳入」：目录不存在静默跳过（不报错、不留痕、不造目录）、present 但无候选、候选的 frontmatter 事实与 canonical 绝对路径、可注入额外只读根与它的归属、canonical 路径去重（符号链接别名根）、**候选判据是 frontmatter 的 `name`**（缺/非法 ⇒ 不进清单但**必须留痕**；目录名不是 kebab 也照常进清单并可按技能名纳入）、三态（企业记录 / 自装记录 → registered、另一条目录声明同一技能名 → conflict、其余 available）、三条 fail-closed（不在候选 / 已登记 / 同名冲突）、纳入**只登记不复制**（目录字节零改动、无制品副本、七键 + 0600 原子写、响应与 `GET /skills/self-installed` 逐字同形、第二次纳入转 409）、符号链接逃逸被拒、摘要**不跟随**符号链接、摘要预算超限给独立基础设施码
 * [POS]: bundle 技能纵深的**第三条通路**回归门禁；有人把跨根去重拆成按名字、把三态判成两态、让纳入去复制/移动那份目录、放宽「不在候选里」这道门、把「非 kebab 目录名」误当成「不是技能」而静默不列、或者让摘要跟随符号链接读到根外，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adoptSystemSkill,
  digestSkillDirectory,
  discoverSystemSkills,
  SKILL_SYSTEM_PRIMARY_ROOT_ID,
  SYSTEM_ADOPT_SOURCE_TYPE,
  type EnterpriseSkillSystemOptions,
} from '../src/skill-system.js'
import { installedSelfSkills, SELF_INSTALLED_STATE_FILENAME } from '../src/skill-upload.js'
import type { EnterpriseSkillInstallPlatformPort } from '../src/skill-install.js'

const SKILL_ROOT_RELATIVE = 'skills'
const STATE_DIR_RELATIVE = join('enterprise', 'skill-installs')
const SELF_STATE_RELATIVE = join(STATE_DIR_RELATIVE, SELF_INSTALLED_STATE_FILENAME)
const ENTERPRISE_STATE_RELATIVE = join(STATE_DIR_RELATIVE, 'installed.json')
const NOW = '2026-10-05T00:00:00.000Z'
const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-skill-system-'))
  homes.push(path)
  return path
}

/** 平台面**故意会抛**：这两个通路都不许发任何网络请求，真发了就让测试红。 */
function offlinePlatform(): EnterpriseSkillInstallPlatformPort {
  return {
    request: async () => {
      throw new Error('system search must never touch the network')
    },
  }
}

function options(
  dshHome: string,
  extraRoots?: EnterpriseSkillSystemOptions['extraRoots'],
): EnterpriseSkillSystemOptions {
  return {
    platform: offlinePlatform(),
    dshHome,
    now: () => new Date(NOW),
    ...(extraRoots === undefined ? {} : { extraRoots }),
  }
}

/** 在某个根下造一份技能目录：`<root>/<name>/SKILL.md`。 */
async function writeSkill(root: string, name: string, frontmatter?: string): Promise<string> {
  const directory = join(root, name)
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(directory, 'SKILL.md'),
    `---\n${frontmatter ?? `name: ${name}\ndescription: ${name} 的说明`}\n---\n正文\n`,
    'utf8',
  )
  return directory
}

/** 把一条**企业**已装记录写进中心口径的 `installed.json`（八键 + 雪花 id）。 */
async function seedEnterpriseRecord(dshHome: string, names: readonly string[]): Promise<void> {
  const path = join(dshHome, ENTERPRISE_STATE_RELATIVE)
  await mkdir(join(dshHome, STATE_DIR_RELATIVE), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify({
    records: [{
      packageId: '1902500000000000001',
      skillId: 'enterprise-pkg',
      displayName: '企业技能包',
      versionId: '1902500000000000101',
      sha256: 'a'.repeat(64),
      names: [...names],
      installedAt: '2026-10-01T00:00:00.000Z',
    }],
  }), { encoding: 'utf8', mode: 0o600 })
}

/** 把一条**本机自装**记录写进刀 3a 那份独立清单（逐字七键）。 */
async function seedSelfInstalledRecord(dshHome: string, names: readonly string[]): Promise<void> {
  const path = join(dshHome, SELF_STATE_RELATIVE)
  await mkdir(join(dshHome, STATE_DIR_RELATIVE), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify({
    records: [{
      skillId: names[0]!,
      displayName: names[0]!,
      sha256: 'b'.repeat(64),
      names: [...names],
      installedAt: '2026-10-02T00:00:00.000Z',
      sourceType: 'upload',
      sourceInput: 'seeded.dshskill',
    }],
  }), { encoding: 'utf8', mode: 0o600 })
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** 跑一次预期失败的调用，只取稳定码（不吞掉「居然成功了」这种最危险的形态）。 */
async function codeOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action()
    return '<resolved>'
  } catch (error) {
    return (error as { code?: string }).code ?? '<no-code>'
  }
}

function stateOf(discovery: Awaited<ReturnType<typeof discoverSystemSkills>>): Record<string, string> {
  return Object.fromEntries(discovery.skills.map(skill => [skill.name, skill.state]))
}

describe('enterprise skill system search', () => {
  it('skips a missing skill root silently and reports it as absent', async () => {
    const home = await makeHome()
    const onError = vi.fn()
    const discovery = await discoverSystemSkills({ ...options(home), onError })
    // §2.2：ENOENT 被吞 ⇒ present:false、零候选、**一次留痕都没有**（不是 500、不是 warn）。
    expect(discovery.roots).toEqual([
      { id: SKILL_SYSTEM_PRIMARY_ROOT_ID, path: join(home, SKILL_ROOT_RELATIVE), present: false },
    ])
    expect(discovery.skills).toEqual([])
    expect(onError).not.toHaveBeenCalled()
    // 静默跳过 ≠ 顺手造一个目录：盘点不许在磁盘上留下任何东西。
    expect(await exists(join(home, SKILL_ROOT_RELATIVE))).toBe(false)
  })

  it('reports a present root with no candidates as an empty list', async () => {
    const home = await makeHome()
    await mkdir(join(home, SKILL_ROOT_RELATIVE, 'not-a-skill'), { recursive: true })
    await writeFile(join(home, SKILL_ROOT_RELATIVE, 'README.md'), 'x', 'utf8')
    const discovery = await discoverSystemSkills(options(home))
    expect(discovery.roots[0]).toEqual({
      id: SKILL_SYSTEM_PRIMARY_ROOT_ID,
      path: join(home, SKILL_ROOT_RELATIVE),
      present: true,
    })
    // 没有 SKILL.md 的目录、根下的普通文件都不是候选。
    expect(discovery.skills).toEqual([])
  })

  it('lists a candidate with its frontmatter facts and its canonical absolute path', async () => {
    const home = await makeHome()
    const directory = await writeSkill(
      join(home, SKILL_ROOT_RELATIVE),
      'team-notes',
      'name: team-notes\ndescription: 团队会议纪要',
    )
    const discovery = await discoverSystemSkills(options(home))
    expect(discovery.skills).toEqual([{
      path: await realpath(directory),
      rootId: SKILL_SYSTEM_PRIMARY_ROOT_ID,
      name: 'team-notes',
      displayName: 'team-notes',
      description: '团队会议纪要',
      state: 'available',
    }])
    // `path` 必须是 canonical 绝对路径（界面把它原样回传给 /skills/adopt）。
    expect(discovery.skills[0]!.path.startsWith('/')).toBe(true)
  })

  it('keeps a SKILL.md without a usable frontmatter name out of the list and leaves a trace instead of swallowing it', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    // 官方 watcher 的两条硬门（`dsh-skill-filesystem/lib/index.js:679`/`:685`）：name/description 必须同在、name 必须 kebab。
    await writeSkill(root, 'broken-frontmatter', 'name: Broken Name\ndescription: 名字不是 kebab')
    await writeSkill(root, 'empty-frontmatter', '')
    await writeSkill(root, 'no-name', 'description: 只有描述')
    const onError = vi.fn()
    const discovery = await discoverSystemSkills({ ...options(home), onError })
    // 它们不是技能（官方 watcher 在这个位置同样是 warn + 忽略）⇒ 不进清单。
    expect(discovery.skills).toEqual([])
    // ★但不许**静默**丢：磁盘上确实摆着 SKILL.md，就必须留痕，否则「本机有什么没被列出来」无从查起。
    expect(onError).toHaveBeenCalledTimes(3)
    expect(onError.mock.calls.map(call => String(call[0]))).toEqual([
      expect.stringContaining('broken-frontmatter'),
      expect.stringContaining('empty-frontmatter'),
      expect.stringContaining('no-name'),
    ])
  })

  it('scans an injected extra read-only root and attributes each candidate to its own root', async () => {
    const home = await makeHome()
    await writeSkill(join(home, SKILL_ROOT_RELATIVE), 'team-notes')
    const extra = join(home, 'extras')
    await writeSkill(extra, 'extra-skill')
    const discovery = await discoverSystemSkills(options(home, [{ id: 'extra', path: extra }]))
    expect(discovery.roots).toEqual([
      { id: SKILL_SYSTEM_PRIMARY_ROOT_ID, path: join(home, SKILL_ROOT_RELATIVE), present: true },
      { id: 'extra', path: extra, present: true },
    ])
    expect(discovery.skills.map(skill => [skill.name, skill.rootId])).toEqual([
      ['team-notes', SKILL_SYSTEM_PRIMARY_ROOT_ID],
      ['extra-skill', 'extra'],
    ])
  })

  it('dedupes the same real directory found under two roots by canonical path', async () => {
    const home = await makeHome()
    const primary = join(home, SKILL_ROOT_RELATIVE)
    await writeSkill(primary, 'team-notes')
    // 别名的根：一个指向主根的符号链接（同一个真实目录挂在两个根下）。
    const alias = join(home, 'alias-skills')
    await symlink(primary, alias)
    const discovery = await discoverSystemSkills(options(home, [{ id: 'alias', path: alias }]))
    expect(discovery.roots.map(root => root.present)).toEqual([true, true])
    // §2.3：去重键是 canonical 路径、不是技能名 ⇒ 只列一次，归属保留**先出现**的主根。
    expect(discovery.skills.map(skill => [skill.name, skill.rootId])).toEqual([
      ['team-notes', SKILL_SYSTEM_PRIMARY_ROOT_ID],
    ])
  })

  it('classifies registered (both records), conflict (another directory claiming the same skill name) and available', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    await writeSkill(root, 'code-review', 'name: code-review\ndescription: 代码评审')
    await writeSkill(root, 'team-notes', 'name: team-notes\ndescription: 会议纪要')
    // 两条目录声明**同一个技能名**：官方 watcher 只认 frontmatter 的 name（`:679`）⇒ 这就是同名两条，真冲突。
    await writeSkill(root, 'notes-a', 'name: shared-notes\ndescription: 甲')
    await writeSkill(root, 'notes-b', 'name: shared-notes\ndescription: 乙')
    await writeSkill(root, 'plain-skill', 'name: plain-skill\ndescription: 普通')
    await seedEnterpriseRecord(home, ['code-review'])
    await seedSelfInstalledRecord(home, ['team-notes'])
    const discovery = await discoverSystemSkills(options(home))
    expect(stateOf(discovery)).toEqual({
      // ★有意偏离上游：企业记录命中也算**已装**（Cherry 会把自家库的技能判成 conflict）。
      'code-review': 'registered',
      // 自装记录命中同样算已装（两份记录合并判定）。
      'team-notes': 'registered',
      // 两条目录声明同一个技能名，**两条都**是 conflict（谁先纳入都会让另一条无法登记）。
      'notes-a': 'conflict',
      'notes-b': 'conflict',
      'plain-skill': 'available',
    })
    // 投影的 `name` 是**目录名**（`path` 的 basename），技能名在 `displayName`（frontmatter 的 name）。
    const notesA = discovery.skills.find(skill => skill.name === 'notes-a')!
    expect(notesA.displayName).toBe('shared-notes')
    expect(notesA.path).toBe(await realpath(join(root, 'notes-a')))
    expect(notesA.description).toBe('甲')
  })

  it('adopts a directory whose directory name is not an official skill name, keyed by its frontmatter name', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    const directory = await writeSkill(root, 'My Skill', 'name: my-skill\ndescription: 我的技能')
    const adopting = options(home)
    // 官方 watcher 不看目录名（`:584-597` 逐目录取 SKILL.md，`:679` 只认 frontmatter 的 name）
    // ⇒ 这是**活技能**，必须进清单（目录名照旧出现在投影的 `name` 里，技能名在 `displayName`）。
    expect((await discoverSystemSkills(adopting)).skills).toEqual([{
      path: await realpath(directory),
      rootId: SKILL_SYSTEM_PRIMARY_ROOT_ID,
      name: 'My Skill',
      displayName: 'my-skill',
      description: '我的技能',
      state: 'available',
    }])

    const result = await adoptSystemSkill(adopting, directory)
    const record = {
      // `skillId`/`names` 用 **frontmatter 的技能名**；目录名完整落在 `sourceInput` 的绝对路径里，信息不丢。
      skillId: 'my-skill',
      displayName: 'my-skill',
      sha256: await digestSkillDirectory(directory),
      names: ['my-skill'],
      installedAt: NOW,
      sourceType: SYSTEM_ADOPT_SOURCE_TYPE,
      sourceInput: await realpath(directory),
    }
    expect(result).toEqual({ skills: [record] })
    // 目录名 ≠ 技能名时，存在性判据必须走 `sourceInput`：否则刚纳入的记录会被立刻判成「目录没了」，
    // 界面（读的就是这份投影）既看不到它、也没法再纳入一次。
    expect(await installedSelfSkills(adopting)).toEqual(result)
    expect(stateOf(await discoverSystemSkills(adopting))).toEqual({ 'My Skill': 'registered' })
  })

  it('refuses to adopt a path that is not one of the discovered candidates', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    await writeSkill(root, 'team-notes')
    await mkdir(join(root, 'no-skill-md'), { recursive: true })
    for (const path of [
      join(root, 'no-skill-md'),              // 没有 SKILL.md
      join(root, 'team-notes', 'SKILL.md'),   // 文件不是目录
      root,                                   // 根本身不是候选
      join(home, 'nowhere'),                  // 不存在
      'skills/team-notes',                    // 相对路径
      '',                                     // 空串
    ]) {
      expect(await codeOf(() => adoptSystemSkill(options(home), path))).toBe('ENT_SKILL_DISCOVERY_UNKNOWN')
    }
    // 一条都没登记：被拒的纳入**零副作用**。
    expect(await exists(join(home, SELF_STATE_RELATIVE))).toBe(false)
  })

  it('refuses a symlink that escapes the skill root, at scan time and at adopt time', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    await writeSkill(root, 'team-notes')
    const outside = join(home, 'outside')
    const escaped = await writeSkill(outside, 'evil-skill')
    // 根里一条指向根外的符号链接（目录符号链接不是候选；lstat 不跟随）。
    await symlink(escaped, join(root, 'evil-link'))
    const discovery = await discoverSystemSkills(options(home))
    expect(discovery.skills.map(skill => skill.name)).toEqual(['team-notes'])
    // 先 realpath 再查候选 ⇒ 传链接路径与传真实路径**都**落在候选之外，两条都必须被拒。
    expect(await codeOf(() => adoptSystemSkill(options(home), join(root, 'evil-link'))))
      .toBe('ENT_SKILL_DISCOVERY_UNKNOWN')
    expect(await codeOf(() => adoptSystemSkill(options(home), escaped)))
      .toBe('ENT_SKILL_DISCOVERY_UNKNOWN')
    expect(await exists(join(home, SELF_STATE_RELATIVE))).toBe(false)
  })

  it('refuses a directory that is already registered or whose skill name is claimed by another directory', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    await writeSkill(root, 'code-review', 'name: code-review\ndescription: 代码评审')
    const first = await writeSkill(root, 'notes-a', 'name: shared-notes\ndescription: 甲')
    const conflicting = await writeSkill(root, 'notes-b', 'name: shared-notes\ndescription: 乙')
    await seedEnterpriseRecord(home, ['code-review'])
    const adopting = options(home)
    // ② 已被企业记录认领 ⇒ 不必也不能再登记一次（不是 conflict，也不是「包不对」）。
    expect(await codeOf(() => adoptSystemSkill(adopting, join(root, 'code-review'))))
      .toBe('ENT_SKILL_ALREADY_REGISTERED')
    // ③ 技能名已被别的技能占用 ⇒ 复用**既有**那枚重名码；两条同名目录**都**被拒（状态是互相的）。
    expect(await codeOf(() => adoptSystemSkill(adopting, conflicting))).toBe('ENT_SKILL_NAME_CONFLICT')
    expect(await codeOf(() => adoptSystemSkill(adopting, first))).toBe('ENT_SKILL_NAME_CONFLICT')
    expect(await exists(join(home, SELF_STATE_RELATIVE))).toBe(false)
  })

  it('adopts an available directory by registering it without touching a single byte of it', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    const directory = await writeSkill(root, 'team-notes', 'name: team-notes\ndescription: 团队会议纪要')
    await mkdir(join(directory, 'references'), { recursive: true })
    await writeFile(join(directory, 'references', 'guide.md'), '参考资料\n', 'utf8')
    const digestBefore = await digestSkillDirectory(directory)
    const listingBefore = (await readdir(directory, { recursive: true })).sort()
    const adopting = options(home)
    // 记录里的 `path` 是 **canonical** 绝对路径（`realpath` 之后）——`sourceInput` 与候选投影同源。
    const canonicalDirectory = await realpath(directory)

    const result = await adoptSystemSkill(adopting, directory)
    const record = {
      skillId: 'team-notes',
      displayName: 'team-notes',
      sha256: digestBefore,
      names: ['team-notes'],
      installedAt: NOW,
      sourceType: SYSTEM_ADOPT_SOURCE_TYPE,
      sourceInput: canonicalDirectory,
    }
    // ① 响应与 `GET /skills/self-installed` **逐字同形**（界面复用同一份解码器）。
    expect(result).toEqual({ skills: [record] })
    expect(await installedSelfSkills(adopting)).toEqual(result)
    expect(SYSTEM_ADOPT_SOURCE_TYPE).toBe('system')
    // ② 只登记：那份目录一个字节都没动（内容摘要与目录清单都逐字不变）。
    expect(await digestSkillDirectory(directory)).toBe(digestBefore)
    expect((await readdir(directory, { recursive: true })).sort()).toEqual(listingBefore)
    // ③ 没有复制/挪出任何东西：制品缓存里零文件，技能根下仍然只有那一份目录。
    expect(await exists(join(home, 'enterprise', 'skill-uploads'))).toBe(false)
    expect(await readdir(root)).toEqual(['team-notes'])
    // ④ 落盘仍是刀 3a 那份七键清单 + 0600 原子写（不是第二份记录）。
    const state = JSON.parse(await readFile(join(home, SELF_STATE_RELATIVE), 'utf8')) as { records: unknown[] }
    expect(state.records).toEqual([record])
    expect((await stat(join(home, SELF_STATE_RELATIVE))).mode & 0o777).toBe(0o600)
    // ⑤ 登记之后再纳入同一条 ⇒ 三态已翻成 registered，第二次纳入转 409。
    expect(stateOf(await discoverSystemSkills(adopting))).toEqual({ 'team-notes': 'registered' })
    expect(await codeOf(() => adoptSystemSkill(adopting, directory))).toBe('ENT_SKILL_ALREADY_REGISTERED')
  })

  it('never follows a symlink while digesting a skill directory', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    const directory = await writeSkill(root, 'team-notes')
    const outside = join(home, 'outside.txt')
    await writeFile(outside, 'v1', 'utf8')
    await symlink(outside, join(directory, 'link.txt'))
    const before = await digestSkillDirectory(directory)
    // 改了链接指向的文件之后摘要必须**不变**：摘要只计入链接目标字符串，不代表去读根外的字节。
    await writeFile(outside, 'v2 — 完全不同的内容', 'utf8')
    expect(await digestSkillDirectory(directory)).toBe(before)
    // 反向锁：真实文件与指向同样内容的链接**不是**同一个摘要。
    const real = join(root, 'plain-skill')
    await mkdir(real, { recursive: true })
    await writeFile(join(real, 'link.txt'), 'v2 — 完全不同的内容', 'utf8')
    expect(await digestSkillDirectory(real)).not.toBe(before)
  })

  it('fails closed with its own infrastructure code when the directory is too deep to digest', async () => {
    const home = await makeHome()
    const root = join(home, SKILL_ROOT_RELATIVE)
    const directory = await writeSkill(root, 'team-notes')
    // 深度超过本仓既有 `SKILL_FILE_MAX_DEPTH`：本机**完不成**这次登记 ⇒ 一枚基础设施码（500），
    // 而不是「请求有问题」(4xx)，更不是静默写一个半截摘要。
    let nested = directory
    for (let depth = 0; depth < 10; depth += 1) {
      nested = join(nested, `d${depth}`)
      await mkdir(nested, { recursive: true })
    }
    await writeFile(join(nested, 'deep.txt'), 'x', 'utf8')
    expect(await codeOf(() => adoptSystemSkill(options(home), directory))).toBe('ENT_SKILL_ADOPT_FAILED')
    // 零副作用：被拒的纳入一条记录都不写。
    expect(await exists(join(home, SELF_STATE_RELATIVE))).toBe(false)
  })
})
