/**
 * [INPUT]: 依赖 `src/skill-upload.ts` 的 `uploadSkillArchive`/`installedSelfSkills`/`readSelfInstalledRecords`/`SELF_INSTALLED_STATE_FILENAME`、`src/skill-install.ts` 的已装态、`src/skill-errors.ts` 的稳定码与 `tests/zip-fixture.ts` 的 ZIP 构造器
 * [OUTPUT]: 在真实临时 dshHome 上锁定通路一「本地上传」的全流程：multipart 形状门禁（恰好一个 `artifact` part）、两道具闸门（ZIP/manifest + frontmatter）**先于**任何落盘、内容寻址制品、幂等、**企业记录 ∪ 自装记录**的落点冲突预检、同名重传的原地原子升级与旧孤儿清理、独立自装清单的七键形状/0600 原子写/损坏 fail-closed、只读投影只列目录仍在的记录、响应 data 与 `/skills/install` **同形**（企业已装态）、用户文件名只作数据不作路径、以及「上传全程零网络零执行」；**本刀**再锁**出厂口的 `sourceInput` 形状收窄**：五类路径形态（`/abs/path`、`C:\x`、`C:/x`、`a/../b`、`a\b`）**整格不产出**且其余六键逐字仍在、四类非路径形态（`nuwax:158`/`skillhub:a@1`/`team-notes.dshskill`/`dsh`）**原样产出**、盘上**旧记录**仍按那条绝对路径判存在但路径绝不出厂、守卫**只读**（逐字节不改盘 + 源码里零写类 fs 出口）、`installedSelfSkills` 仍是**唯一**出厂口（源码级信封逐字两处：自己一处 + `skill-self-installed.ts` 的复用）
 * [POS]: bundle 技能纵深的**第二份记录**（§E.2③）回归门禁；有人把自装记录写进 `installed.json`、把上传配额/闸门放宽、让自装覆盖企业技能目录、让损坏的自装清单被静默当空清单覆盖、**让本机绝对路径随自装记录出厂**、**把守卫放去第二处投影**、**误杀上传文件名形态**或**改动冻结七键形状**，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installedSelfSkills,
  readSelfInstalledRecords,
  SELF_INSTALLED_STATE_FILENAME,
  uploadSkillArchive,
} from '../src/skill-upload.js'
import { installSkillPackage, installedSkillStatus, type EnterpriseSkillInstallPlatformPort } from '../src/skill-install.js'
import { buildZip, type ZipFixtureEntry } from './zip-fixture.js'

const BOUNDARY = '----dshentUploadBoundary20261003'
const STATE_RELATIVE = join('enterprise', 'skill-installs', SELF_INSTALLED_STATE_FILENAME)
const ENTERPRISE_STATE_RELATIVE = join('enterprise', 'skill-installs', 'installed.json')
const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-skill-upload-'))
  homes.push(path)
  return path
}

/**
 * 平台面**故意会抛**：本地上传这条通路不许发任何网络请求，真发了就让测试红。
 */
function offlinePlatform(): EnterpriseSkillInstallPlatformPort {
  return {
    request: async () => {
      throw new Error('local upload must never touch the network')
    },
  }
}

function options(dshHome: string): { platform: EnterpriseSkillInstallPlatformPort, dshHome: string, now: () => Date } {
  return { platform: offlinePlatform(), dshHome, now: () => new Date('2026-10-03T00:00:00.000Z') }
}

/** 手写 multipart 正文（与浏览器 `FormData` 的分帧同形）。 */
function multipart(parts: readonly { name: string, filename?: string, data: Buffer | string }[]): Buffer {
  const chunks: Buffer[] = []
  for (const part of parts) {
    const disposition = `form-data; name="${part.name}"`
      + (part.filename === undefined ? '' : `; filename="${part.filename}"`)
    chunks.push(Buffer.from(`--${BOUNDARY}\r\ncontent-disposition: ${disposition}\r\ncontent-type: application/octet-stream\r\n\r\n`))
    chunks.push(typeof part.data === 'string' ? Buffer.from(part.data, 'utf8') : part.data)
    chunks.push(Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`))
  return Buffer.concat(chunks)
}

function uploadBody(artifact: Buffer, filename = 'team-notes.dshskill'): Buffer {
  return multipart([{ name: 'artifact', filename, data: artifact }])
}

interface ArchiveOptions {
  readonly skillId?: string
  readonly displayName?: string
  readonly frontmatter?: (name: string) => string
}

/** 造一个合规 `.dshskill`（根 manifest.json + skills/<kebab>/SKILL.md）。 */
function archiveOf(names: readonly string[], options: ArchiveOptions = {}): Buffer {
  const manifest = {
    format: 'dsh-skill',
    version: '1',
    id: options.skillId ?? 'team-notes-pkg',
    ...(options.displayName === undefined ? {} : { name: options.displayName }),
    sourceDshVersion: '0.2.0-rc.2',
  }
  const entries: ZipFixtureEntry[] = [{ path: 'manifest.json', content: JSON.stringify(manifest) }]
  for (const name of names) {
    const frontmatter = options.frontmatter?.(name) ?? `name: ${name}\ndescription: ${name} 的说明`
    entries.push({ path: `skills/${name}/SKILL.md`, content: `---\n${frontmatter}\n---\n正文\n` })
  }
  return buildZip(entries)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function modeOf(path: string): Promise<number> {
  return (await stat(path)).mode & 0o777
}

async function readState(dshHome: string): Promise<{ records: Record<string, unknown>[] }> {
  return JSON.parse(await readFile(join(dshHome, STATE_RELATIVE), 'utf8')) as { records: Record<string, unknown>[] }
}

/** 把一条**企业**已装记录写进中心口径的 `installed.json`（八键 + 雪花 id），用来验证跨归属预检。 */
async function seedEnterpriseRecord(dshHome: string, names: readonly string[]): Promise<void> {
  const path = join(dshHome, ENTERPRISE_STATE_RELATIVE)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
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

function codeOf(error: unknown): string {
  return (error as { code?: string }).code ?? 'NO_CODE'
}

describe('enterprise local skill upload (通路一 · 方案甲)', () => {
  it('installs an uploaded .dshskill into the official skill root and writes a separate self-installed record', async () => {
    const dshHome = await makeHome()
    const archive = archiveOf(['team-notes'], { displayName: '会议纪要技能组' })
    const sha256 = createHash('sha256').update(archive).digest('hex')

    const status = await uploadSkillArchive(options(dshHome), uploadBody(archive), BOUNDARY)
    // 冻结契约：响应 data 与 `POST /skills/install` 的 data **同形**（这里是企业已装态，自装记录不在其中）。
    expect(status).toEqual({ skills: [] })
    await expect(installedSkillStatus(options(dshHome))).resolves.toEqual({ skills: [] })

    // 落点是官方 `dsh-skill-filesystem` 的 user-dsh 根；文件 0600、目录 0700（包内不落可执行位）。
    const skillMd = join(dshHome, 'skills', 'team-notes', 'SKILL.md')
    expect(await exists(skillMd)).toBe(true)
    expect(await readFile(skillMd, 'utf8')).toContain('name: team-notes')
    expect(await modeOf(skillMd)).toBe(0o600)
    expect(await modeOf(join(dshHome, 'skills', 'team-notes'))).toBe(0o700)

    // 制品按 sha256 内容寻址；不留 `.part`。
    const artifact = join(dshHome, 'enterprise', 'skill-uploads', `${sha256}.dshskill`)
    expect(await exists(artifact)).toBe(true)
    expect((await readFile(artifact)).equals(archive)).toBe(true)
    expect(await readdir(join(dshHome, 'enterprise', 'skill-uploads'))).toEqual([`${sha256}.dshskill`])
    expect(await modeOf(artifact)).toBe(0o600)

    // 自装记录写进**独立**文件：七键、原子写、0600，且**不写**中心的 installed.json。
    const state = await readState(dshHome)
    expect(state.records).toHaveLength(1)
    expect(Object.keys(state.records[0]!).sort()).toEqual(
      ['displayName', 'installedAt', 'names', 'sha256', 'skillId', 'sourceInput', 'sourceType'],
    )
    expect(state.records[0]).toEqual({
      skillId: 'team-notes-pkg',
      displayName: '会议纪要技能组',
      sha256,
      names: ['team-notes'],
      installedAt: '2026-10-03T00:00:00.000Z',
      sourceType: 'upload',
      sourceInput: 'team-notes.dshskill',
    })
    expect(await modeOf(join(dshHome, STATE_RELATIVE))).toBe(0o600)
    // 原子写的证据：同目录只留最终文件，临时件（`<name>.<uuid>.tmp`）一个残留都没有。
    expect(await readdir(join(dshHome, 'enterprise', 'skill-installs'))).toEqual([SELF_INSTALLED_STATE_FILENAME])
    expect(await exists(join(dshHome, ENTERPRISE_STATE_RELATIVE))).toBe(false)

    // 只读投影与盘上记录一致；暂存区清干净。
    await expect(installedSelfSkills(options(dshHome))).resolves.toEqual({ skills: [state.records[0]] })
    expect(await readdir(join(dshHome, 'enterprise', 'skill-staging'))).toEqual([])
  })

  it('falls back to the first skill directory name when the manifest carries no name', async () => {
    const dshHome = await makeHome()
    await uploadSkillArchive(options(dshHome), uploadBody(archiveOf(['team-notes'])), BOUNDARY)
    await expect(readSelfInstalledRecords(options(dshHome))).resolves.toMatchObject([{ displayName: 'team-notes' }])
  })

  it('accepts exactly one artifact part and rejects every other multipart shape without touching the disk', async () => {
    const dshHome = await makeHome()
    const archive = archiveOf(['team-notes'])
    const bad: readonly Buffer[] = [
      archive, // 完全不是 multipart
      Buffer.alloc(0),
      multipart([{ name: 'artifact', filename: 'a.dshskill', data: archive }, { name: 'artifact', filename: 'b.dshskill', data: archive }]),
      multipart([{ name: 'file', filename: 'a.dshskill', data: archive }]),
      multipart([{ name: 'artifact', filename: 'a.dshskill', data: Buffer.alloc(0) }]),
      multipart([{ name: 'metadata', data: '{}' }]),
    ]
    for (const body of bad) {
      await expect(uploadSkillArchive(options(dshHome), body, BOUNDARY)).rejects.toMatchObject({ code: 'ENT_SKILL_UPLOAD_INVALID' })
    }
    // 边界文本不对（声明了别的 boundary）同样拒。
    await expect(uploadSkillArchive(options(dshHome), uploadBody(archive), 'other-boundary')).rejects
      .toMatchObject({ code: 'ENT_SKILL_UPLOAD_INVALID' })
    // 一条都没过闸门 ⇒ 一个字节都不落（skills/、制品缓存、自装清单全都不存在）。
    expect(await exists(join(dshHome, 'skills'))).toBe(false)
    expect(await exists(join(dshHome, 'enterprise'))).toBe(false)
  })

  it('runs the ZIP gate and the frontmatter gate before writing anything', async () => {
    const dshHome = await makeHome()
    const cases: readonly { readonly archive: Buffer, readonly code: string }[] = [
      { archive: Buffer.from('not a zip at all'), code: 'ENT_SKILL_ARCHIVE_INVALID' },
      { archive: buildZip([]), code: 'ENT_SKILL_ARCHIVE_INVALID' },
      { archive: archiveOf(['team-notes'], { frontmatter: () => 'name: Meeting_Notes\ndescription: d' }), code: 'ENT_SKILL_SKILLMD_INVALID' },
      { archive: archiveOf(['team-notes'], { frontmatter: () => 'name: team-notes' }), code: 'ENT_SKILL_SKILLMD_INVALID' },
      { archive: archiveOf(['team-notes'], { frontmatter: () => 'name: team-notes\ndescription: d\nuserInvocable: true' }), code: 'ENT_SKILL_SKILLMD_INVALID' },
      { archive: archiveOf(['team-notes'], { frontmatter: () => 'name: team-notes\ndescription: d\nname: other' }), code: 'ENT_SKILL_SKILLMD_INVALID' },
    ]
    for (const item of cases) {
      await expect(uploadSkillArchive(options(dshHome), uploadBody(item.archive), BOUNDARY)).rejects.toMatchObject({ code: item.code })
    }
    // 闸门在制品落盘之前 ⇒ 被拒的包连制品缓存都不留（比方案步骤 5/6 的顺序更保守）。
    expect(await exists(join(dshHome, 'enterprise'))).toBe(false)
    expect(await exists(join(dshHome, 'skills'))).toBe(false)
  })

  it('rejects a landing spot owned by the enterprise record, by another self-installed package, or by a foreign directory', async () => {
    // ① 企业（中心口径）记录占用同名 → 拒。
    const ownedByEnterprise = await makeHome()
    await seedEnterpriseRecord(ownedByEnterprise, ['team-notes'])
    await expect(uploadSkillArchive(options(ownedByEnterprise), uploadBody(archiveOf(['team-notes'])), BOUNDARY))
      .rejects.toMatchObject({ code: 'ENT_SKILL_NAME_CONFLICT' })
    // 冲突拒的是**落盘**：技能根没多目录、自装清单没多记录（制品缓存是内容寻址的纯字节缓存，方案步骤 5 本就先于预检）。
    expect(await exists(join(ownedByEnterprise, 'skills', 'team-notes'))).toBe(false)
    expect(await exists(join(ownedByEnterprise, STATE_RELATIVE))).toBe(false)

    // ② **别的**自装包占用同名 → 拒（先正常装一个别的 skillId，再传一个想占同一个技能目录的包）。
    const ownedBySelf = await makeHome()
    await uploadSkillArchive(options(ownedBySelf), uploadBody(archiveOf(['team-notes'], { skillId: 'other-pkg' })), BOUNDARY)
    await expect(uploadSkillArchive(options(ownedBySelf), uploadBody(archiveOf(['team-notes'], { skillId: 'team-notes-pkg' })), BOUNDARY))
      .rejects.toMatchObject({ code: 'ENT_SKILL_NAME_CONFLICT' })
    await expect(readSelfInstalledRecords(options(ownedBySelf))).resolves.toMatchObject([{ skillId: 'other-pkg' }])

    // ③ 目录存在但两份记录都不认识（用户手工放的技能）→ 拒，绝不覆盖。
    const foreign = await makeHome()
    await mkdir(join(foreign, 'skills', 'team-notes'), { recursive: true, mode: 0o700 })
    await writeFile(join(foreign, 'skills', 'team-notes', 'SKILL.md'), '手工放的文件', { mode: 0o600 })
    await expect(uploadSkillArchive(options(foreign), uploadBody(archiveOf(['team-notes'])), BOUNDARY))
      .rejects.toMatchObject({ code: 'ENT_SKILL_NAME_CONFLICT' })
    expect(await readFile(join(foreign, 'skills', 'team-notes', 'SKILL.md'), 'utf8')).toBe('手工放的文件')
  })

  it('upgrades the same self-installed package in place and cleans the directories it no longer references', async () => {
    const dshHome = await makeHome()
    await uploadSkillArchive(options(dshHome), uploadBody(archiveOf(['team-notes', 'team-actions'], { skillId: 'team-pkg' })), BOUNDARY)
    expect(await exists(join(dshHome, 'skills', 'team-actions', 'SKILL.md'))).toBe(true)

    // 同一个 manifest.id 再传一个只含一个技能的新包：同名目录原地原子替换，旧孤儿目录清掉，记录只留一条。
    const upgraded = archiveOf(['team-notes'], { skillId: 'team-pkg', frontmatter: name => `name: ${name}\ndescription: 新版说明` })
    await uploadSkillArchive(options(dshHome), uploadBody(upgraded), BOUNDARY)
    expect(await readFile(join(dshHome, 'skills', 'team-notes', 'SKILL.md'), 'utf8')).toContain('新版说明')
    expect(await exists(join(dshHome, 'skills', 'team-actions'))).toBe(false)
    const state = await readState(dshHome)
    expect(state.records).toHaveLength(1)
    expect(state.records[0]?.['names']).toEqual(['team-notes'])
    expect(state.records[0]?.['skillId']).toBe('team-pkg')
    expect(await readdir(join(dshHome, 'enterprise', 'skill-staging'))).toEqual([])
  })

  it('is idempotent for the same bytes: no rewrite, no conflict, same record', async () => {
    const dshHome = await makeHome()
    const archive = archiveOf(['team-notes'])
    await uploadSkillArchive(options(dshHome), uploadBody(archive), BOUNDARY)
    const before = await readFile(join(dshHome, STATE_RELATIVE), 'utf8')
    const status = await uploadSkillArchive(options(dshHome), uploadBody(archive), BOUNDARY)
    expect(status).toEqual({ skills: [] })
    // 清单逐字未动（installedAt 不会刷新）⇒ 幂等路径没有重写任何记账。
    expect(await readFile(join(dshHome, STATE_RELATIVE), 'utf8')).toBe(before)
  })

  it('fails closed on a corrupt or foreign self-installed state instead of overwriting it', async () => {
    const dshHome = await makeHome()
    const path = join(dshHome, STATE_RELATIVE)
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })

    await writeFile(path, '{ not json', { encoding: 'utf8', mode: 0o600 })
    await expect(installedSelfSkills(options(dshHome))).rejects.toMatchObject({ code: 'ENT_SKILL_STATE_INVALID' })
    await expect(uploadSkillArchive(options(dshHome), uploadBody(archiveOf(['team-notes'])), BOUNDARY))
      .rejects.toMatchObject({ code: 'ENT_SKILL_STATE_INVALID' })
    expect(await readFile(path, 'utf8')).toBe('{ not json')

    // 形状不对（多一个未声明键）同样 fail-closed：盘上形状与出网投影必须是同一个。
    await writeFile(path, JSON.stringify({ records: [{
      skillId: 'team-notes-pkg',
      displayName: 'x',
      sha256: 'a'.repeat(64),
      names: ['team-notes'],
      installedAt: '2026-10-03T00:00:00.000Z',
      sourceType: 'upload',
      sourceInput: '',
      extra: 1,
    }] }), { encoding: 'utf8', mode: 0o600 })
    await expect(readSelfInstalledRecords(options(dshHome))).rejects.toMatchObject({ code: 'ENT_SKILL_STATE_INVALID' })
  })

  it('lists only self-installed records whose directories are still present', async () => {
    const dshHome = await makeHome()
    await uploadSkillArchive(options(dshHome), uploadBody(archiveOf(['team-notes'])), BOUNDARY)
    await expect(installedSelfSkills(options(dshHome))).resolves.toMatchObject({ skills: [{ names: ['team-notes'] }] })
    await rm(join(dshHome, 'skills', 'team-notes'), { force: true, recursive: true })
    await expect(installedSelfSkills(options(dshHome))).resolves.toEqual({ skills: [] })
    // 记录本身仍在（否则同名重传会被当成全新落点，而不是原地升级）。
    await expect(readSelfInstalledRecords(options(dshHome))).resolves.toHaveLength(1)
  })

  it('treats the uploaded filename as data only: it never reaches a path', async () => {
    const dshHome = await makeHome()
    const archive = archiveOf(['team-notes'])
    await uploadSkillArchive(options(dshHome), uploadBody(archive, '../../etc/passwd.dshskill'), BOUNDARY)
    const state = await readState(dshHome)
    expect(state.records[0]?.['sourceInput']).toBe('passwd.dshskill')
    // 制品落点只由 sha256 合成；技能目录只来自包内 kebab 条目。
    const sha256 = createHash('sha256').update(archive).digest('hex')
    expect(await readdir(join(dshHome, 'enterprise', 'skill-uploads'))).toEqual([`${sha256}.dshskill`])
    expect(await readdir(join(dshHome, 'skills'))).toEqual(['team-notes'])
  })

  it('keeps both ownership directions honest: the enterprise install path also refuses a self-installed landing spot', async () => {
    const dshHome = await makeHome()
    await uploadSkillArchive(options(dshHome), uploadBody(archiveOf(['team-notes'], { skillId: 'local-pkg' })), BOUNDARY)

    // 反向：中心安装一个**别的**包、但想占同一个技能目录 —— 必须拒，且绝不碰自装那一份。
    const enterpriseArchive = archiveOf(['team-notes'], { skillId: 'enterprise-pkg' })
    const sha256 = createHash('sha256').update(enterpriseArchive).digest('hex')
    const detail = {
      data: {
        id: '1902500000000000001',
        skillId: 'enterprise-pkg',
        displayName: '企业技能包',
        versionId: '1902500000000000101',
        sizeBytes: enterpriseArchive.byteLength,
        sha256,
        skills: [{ name: 'team-notes' }],
      },
    }
    const request = vi.fn(async (input: string) => input.startsWith('/enterprise/api/v1/skills/versions/')
      ? new Response(enterpriseArchive)
      : new Response(JSON.stringify(detail), { headers: { 'content-type': 'application/json' } }))
    await expect(installSkillPackage({ platform: { request }, dshHome }, '1902500000000000001'))
      .rejects.toMatchObject({ code: 'ENT_SKILL_NAME_CONFLICT' })
    expect(await readFile(join(dshHome, 'skills', 'team-notes', 'SKILL.md'), 'utf8')).toContain('name: team-notes')
    await expect(readSelfInstalledRecords(options(dshHome))).resolves.toMatchObject([{ skillId: 'local-pkg' }])
  })

  it('never executes package content and reuses the hardened placement path', async () => {
    const source = await readFile(new URL('../src/skill-upload.ts', import.meta.url), 'utf8')
    for (const forbidden of ['child_process', 'execFile', 'spawn(', 'execa', 'import(']) {
      expect(source).not.toContain(forbidden)
    }
    expect(source).not.toMatch(/authorization|accessToken|bearer/i)
    // 复用而不是另起一套：闸门、multipart 分帧、加固落盘都必须来自既有实现。
    expect(source).toContain('decodeDshSkillArchive')
    expect(source).toContain('validateSkillFrontmatter')
    expect(source).toContain('parseFeedbackMultipart')
    expect(source).toContain('placeEnterpriseSkillArchive')
    expect(source).toContain('resolveEnterpriseDshHome')
  })

  it('reports a stable code for an unreadable self-installed state directory', async () => {
    const dshHome = await makeHome()
    // 自装清单路径上压一个**目录**：读它会得到 EISDIR，必须收敛成稳定码而不是把内码甩出去。
    await mkdir(join(dshHome, STATE_RELATIVE), { recursive: true, mode: 0o700 })
    try {
      await readSelfInstalledRecords(options(dshHome))
      expect.unreachable('a directory in place of the state file must fail closed')
    } catch (error) {
      expect(codeOf(error)).toBe('ENT_SKILL_STATE_INVALID')
    }
  })
})

/**
 * **本刀（出厂口 `sourceInput` 形状收窄）的回归门禁**：自装记录会出厂（`GET /skills/self-installed`
 * 与 uninstall/reveal/edit 的响应都带这七键），而「系统搜索 → 纳入」过去往 `sourceInput` 里写宿主绝对路径
 * ⇒ 出厂口自己关门：像绝对路径的那一格**整格不产出**（不是改写、不是截断），其余六键逐字保留；
 * 非路径形态**一律原样产出**（界面靠上传文件名匹配与渠道分类，误杀比漏杀更糟）；
 * 守卫**只读**（不做迁移、不动盘上一个字节）；`installedSelfSkills` 仍是唯一出厂口。
 */
describe('self-installed projection guard (本刀 · 出厂口的 sourceInput 形状收窄)', () => {
  /** 只写盘上状态文件（逐字七键，不造任何技能目录）——用来构造「旧记录」那种形态。 */
  async function seedState(dshHome: string, records: readonly Record<string, unknown>[]): Promise<void> {
    await mkdir(join(dshHome, 'enterprise', 'skill-installs'), { recursive: true, mode: 0o700 })
    await writeFile(join(dshHome, STATE_RELATIVE), JSON.stringify({ records }), { encoding: 'utf8', mode: 0o600 })
  }

  /** 写状态 + 为每条记录落一个真实技能目录（存在性走 `names` ⇒ 守卫才是**唯一**被触发的收窄）。 */
  async function seedWithSkillDirectories(
    dshHome: string,
    records: readonly Record<string, unknown>[],
  ): Promise<void> {
    await seedState(dshHome, records)
    for (const record of records) {
      for (const name of record['names'] as string[]) {
        const directory = join(dshHome, 'skills', name)
        await mkdir(directory, { recursive: true, mode: 0o700 })
        await writeFile(
          join(directory, 'SKILL.md'),
          `---\nname: ${name}\ndescription: ${name} 的说明\n---\n正文\n`,
          { encoding: 'utf8', mode: 0o600 },
        )
      }
    }
  }

  function recordOf(index: number, sourceInput: string, name: string): Record<string, unknown> {
    return {
      skillId: `pkg-${index}`,
      displayName: `${name} 展示名`,
      sha256: 'a'.repeat(63) + index.toString(),
      names: [name],
      installedAt: '2026-10-03T00:00:00.000Z',
      sourceType: 'system',
      sourceInput,
    }
  }

  it('withholds the cell for all five path-shaped forms and keeps the other six keys verbatim', async () => {
    const dshHome = await makeHome()
    // 五类形态各一条：POSIX 绝对路径 / Windows 盘符（`X:\` 与 `X:/`）/ 含 `..` 路径段 / 含反斜杠。
    const forms = ['/abs/path', 'C:\\x', 'C:/x', 'a/../b', 'a\\b']
    const records = forms.map((sourceInput, index) => recordOf(index, sourceInput, `path-form-${index}`))
    await seedWithSkillDirectories(dshHome, records)

    const projected = await installedSelfSkills(options(dshHome))
    expect(projected.skills).toHaveLength(forms.length)
    projected.skills.forEach((skill, index) => {
      // 收窄的是**整格**："没说"比"说一半"干净 ⇒ 投影对象上根本没有这枚键（不是空串、不是截断、不是替代值）。
      expect('sourceInput' in skill).toBe(false)
      const { sourceInput: _withheld, ...expected } = records[index]!
      // 其余六键**逐字仍在**（整条记录 === 盘上那份减去 `sourceInput` 一格）。
      expect(skill).toEqual(expected)
      expect(Object.keys(skill).sort()).toEqual(
        ['displayName', 'installedAt', 'names', 'sha256', 'skillId', 'sourceType'],
      )
    })
  })

  it('emits every non-path sourceInput verbatim (filename matching and channel classification depend on it)', async () => {
    const dshHome = await makeHome()
    const forms = ['nuwax:158', 'skillhub:a@1', 'team-notes.dshskill', 'dsh']
    const records = forms.map((sourceInput, index) => recordOf(index, sourceInput, `kept-form-${index}`))
    await seedWithSkillDirectories(dshHome, records)

    const projected = await installedSelfSkills(options(dshHome))
    expect(projected.skills).toHaveLength(forms.length)
    // 原样产出：逐格相等 + 整份记录逐字相等（连键序都不改）。
    expect(projected.skills.map(skill => skill['sourceInput'])).toEqual(forms)
    expect(projected.skills).toEqual(records)
  })

  it('still lists an old on-disk record by its absolute sourceInput, but never emits that path', async () => {
    const dshHome = await makeHome()
    // 盘上**旧记录**的形态：`names` 与真实目录名不一致（目录名 `My Skill`、技能名 `my-skill`），
    // 存在性只能靠 `sourceInput` 里那条 canonical 绝对路径 —— 这条判据本刀**一字未改**。
    const directory = join(dshHome, 'skills', 'My Skill')
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(
      join(directory, 'SKILL.md'),
      '---\nname: my-skill\ndescription: 我的技能\n---\n正文\n',
      { encoding: 'utf8', mode: 0o600 },
    )
    const canonical = await realpath(directory)
    const old = recordOf(0, canonical, 'my-skill')
    await seedState(dshHome, [old])

    const projected = await installedSelfSkills(options(dshHome))
    expect(projected.skills).toHaveLength(1)
    expect('sourceInput' in projected.skills[0]!).toBe(false)
    // ★不做迁移：盘上那份记录一个字节都没动（路径照旧躺在那里，只有出厂投影不带它）。
    expect(await readState(dshHome)).toEqual({ records: [old] })
  })

  it('projects read-only: the guard never writes, never migrates, and the on-disk record keeps exactly seven keys', async () => {
    const dshHome = await makeHome()
    const record = recordOf(0, '/abs/path', 'readonly-form')
    await seedWithSkillDirectories(dshHome, [record])

    const stateBefore = await readFile(join(dshHome, STATE_RELATIVE))
    const skillsBefore = (await readdir(join(dshHome, 'skills'))).sort()
    const projected = await installedSelfSkills(options(dshHome))
    expect(projected.skills).toHaveLength(1)

    // ① 逐字节不变 + 不留任何临时件（`<name>.<uuid>.tmp`）⇒ 守卫没有第二个写者、也没有迁移动作。
    expect(await readFile(join(dshHome, STATE_RELATIVE))).toEqual(stateBefore)
    expect(await readdir(join(dshHome, 'enterprise', 'skill-installs'))).toEqual([SELF_INSTALLED_STATE_FILENAME])
    expect((await readdir(join(dshHome, 'skills'))).sort()).toEqual(skillsBefore)
    // ② 盘上仍是**逐字七键**（不是六键、不是八键）：收窄只发生在内存里的出厂投影。
    const onDisk = await readState(dshHome)
    expect(Object.keys(onDisk.records[0]!).sort()).toEqual(
      ['displayName', 'installedAt', 'names', 'sha256', 'skillId', 'sourceInput', 'sourceType'],
    )
    expect(onDisk.records[0]!['sourceInput']).toBe('/abs/path')
    // ③ 守卫本体是**纯函数**：它那段源码里一个写类 fs 出口都没有（零 `writeFile`/`rename`/`rm`/`mkdir`…）。
    const source = await readFile(new URL('../src/skill-upload.ts', import.meta.url), 'utf8')
    const start = source.indexOf('function looksLikeHostPath')
    const end = source.indexOf('function resolveUploadDependencies')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const guard = source.slice(start, end)
    for (const writeExit of ['writeFile', 'rename(', 'rm(', 'mkdir', 'unlink', 'copyFile', 'appendFile', 'chmod', 'truncate', 'symlink(']) {
      expect(guard).not.toContain(writeExit)
    }
    expect(guard).toContain('function projectSelfInstalledRecord')
  })

  it('keeps installedSelfSkills the only place that projects self-installed records (source-level)', async () => {
    const directory = new URL('../src/', import.meta.url)
    const sources = new Map<string, string>()
    for (const file of (await readdir(directory)).filter(name => name.endsWith('.ts'))) {
      sources.set(file, await readFile(new URL(file, directory), 'utf8'))
    }
    // ① 自装记录 → `{skills:[…]}` 的信封**逐字只有两处**：唯一投影口 `skill-upload.ts` 自己那一处，
    //    与 `skill-self-installed.ts` 对它的**复用**（后者那枚信封来自 `installedSelfSkills()` 的返回值，
    //    不是原始记录）。企业记录那份 `{skills}`（`skill-install.ts`）是另一族记录，不在本判据里。
    const envelopes = [...sources]
      .filter(([, source]) => source.includes('readSelfInstalledRecords'))
      .flatMap(([file, source]) => [...source.matchAll(/return \{ skills[^\n]*/g)].map(match => `${file}: ${match[0]}`))
    expect(envelopes.sort()).toEqual([
      'skill-self-installed.ts: return { skills: skills.skills, removed, alreadyMissing }',
      'skill-upload.ts: return { skills }',
    ])
    // ② 形状收窄那枚守卫也只有 `skill-upload.ts` 里有（第二处再投影必然要在别处再收窄一次 ⇒ 也在这里红）。
    expect([...sources].filter(([, source]) => source.includes('projectSelfInstalledRecord')).map(([file]) => file))
      .toEqual(['skill-upload.ts'])
    // ③ 动作面**复用**这份投影，不自己读记录再投影。
    expect(sources.get('skill-self-installed.ts')).toContain('const skills = await installedSelfSkills(options)')
  })
})
