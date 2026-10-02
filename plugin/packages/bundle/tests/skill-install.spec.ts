/**
 * [INPUT]: 依赖 `src/skill-install.ts` 的安装编排、`src/skill-errors.ts` 的稳定码、`@dshent/plugin-distribution` 的下载内核（经编排间接覆盖）与 `tests/zip-fixture.ts` 的 ZIP 构造器
 * [OUTPUT]: 在真实临时 dshHome 上锁定安装成功（落点/原子改名/暂存清理/内容寻址缓存/幂等）、**同一包新版本的原子升级**（新旧内容替换、旧孤儿目录清理、清单只留一条、幂等；升级要占别的包的技能名仍拒；升级无法记账时旧版本原样回来）、sha256 与大小不符、网络失败、上游受控码穿透、路径逃逸、包契约不符、落点冲突、失败回滚、已装态（含盘上文件消失）、卸载与找不到、状态文件损坏 fail-closed、入参门禁与「不执行包内内容」的源码守卫
 * [POS]: bundle 技能一键安装的端到端回归门禁；有人改成先落盘再校验、把 sha256 校验去掉、允许覆盖别的包或来路不明的同名技能目录、把「同包新版本」也当落点冲突拒掉、升级失败不回滚旧版本、或让状态文件损坏时静默重写，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installedSkillStatus,
  installSkillPackage,
  uninstallSkillPackage,
  type EnterpriseSkillInstallPlatformPort,
} from '../src/skill-install.js'
import { buildZip, type ZipFixtureEntry } from './zip-fixture.js'

const LIST_PATH = '/enterprise/api/v1/skills'
const PACKAGE_ID = '1902500000000000001'
const VERSION_ID = '1902500000000000101'
const OTHER_PACKAGE_ID = '1902500000000000002'
/** 已装清单的磁盘位置（与 `src/skill-install.ts` 的私有常量同源，这里按下盘契约写死）。 */
const STATE_RELATIVE = join('enterprise', 'skill-installs', 'installed.json')
const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

/** 临时 dshHome：按本仓硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。 */
async function makeHome(): Promise<string> {
  const root = join(homedir(), '.sshwork')
  await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'dshent-skill-install-'))
  homes.push(path)
  return path
}

function skillEntries(prefix: string, names: readonly string[], skillId = `${prefix}-pkg`): ZipFixtureEntry[] {
  return [
    { path: 'manifest.json', content: JSON.stringify({ format: 'dsh-skill', version: '1', id: skillId, name: '企业技能包', sourceDshVersion: '0.2.0-rc.2' }) },
    ...names.map(name => ({
      path: `skills/${name}/SKILL.md`,
      content: `---\nname: ${name}\ndescription: ${prefix} 技能\n---\n正文\n`,
    })),
  ]
}

interface DetailOptions {
  readonly archive: Buffer
  readonly names: readonly string[]
  readonly skillId?: string
  readonly packageId?: string
  readonly versionId?: string
  readonly sha256?: string
  readonly sizeBytes?: number
}

/** 中心详情的真实信封形状（`{data, requestId}`），字段与 contracts fixture 同形。 */
function detailEnvelope(options: DetailOptions): unknown {
  return {
    data: {
      id: options.packageId ?? PACKAGE_ID,
      skillId: options.skillId ?? 'meeting-notes',
      displayName: '会议纪要技能组',
      description: '把会议录音与转写整理成结构化纪要。',
      sourceDshVersion: '0.2.0-rc.2',
      sizeBytes: options.sizeBytes ?? options.archive.byteLength,
      skillCount: options.names.length,
      updatedAt: '2026-09-30T08:00:00Z',
      versionId: options.versionId ?? VERSION_ID,
      sha256: options.sha256 ?? createHash('sha256').update(options.archive).digest('hex'),
      skills: options.names.map(name => ({ name, description: `${name} 的说明`, modelInvocable: true, userInvocable: true })),
    },
    requestId: 'req_789ABCDEFGHJKMNPQRSTVWXYZ0',
  }
}

interface PlatformFixture {
  readonly platform: EnterpriseSkillInstallPlatformPort
  readonly request: ReturnType<typeof vi.fn>
}

/**
 * 可控平台面：详情按 `{data, requestId}` 返回，下载按 `download` 回调返回。
 * `download` 抛错即模拟网络失败；返回 `null` 即模拟没有响应体。
 */
function platformFixture(
  detail: unknown,
  download: () => Response | Promise<Response>,
): PlatformFixture {
  const request = vi.fn(async (input: string) => {
    if (input.startsWith(`${LIST_PATH}/versions/`)) {
      const response = await download()
      return response
    }
    return new Response(JSON.stringify(detail), { headers: { 'content-type': 'application/json' } })
  })
  return { platform: { request }, request }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** 暂存父目录是稳定容器，验证它「没有残留子目录」而不是「不存在」。 */
async function stagingIsEmpty(dshHome: string): Promise<boolean> {
  const entries = await readdir(join(dshHome, 'enterprise', 'skill-staging')).catch(() => [])
  return entries.length === 0
}

describe('enterprise skill install', () => {
  it('installs a verified package into the official user skill root and reports the installed state', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-actions', 'meeting-notes']))
    const names = ['meeting-actions', 'meeting-notes']
    const fixture = platformFixture(
      detailEnvelope({ archive, names, skillId: 'meeting-pkg' }),
      () => new Response(archive),
    )

    await expect(installedSkillStatus({ platform: fixture.platform, dshHome })).resolves.toEqual({ skills: [] })
    const status = await installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID)
    expect(status.skills).toHaveLength(1)
    expect(status.skills[0]).toMatchObject({
      packageId: PACKAGE_ID,
      skillId: 'meeting-pkg',
      displayName: '会议纪要技能组',
      versionId: VERSION_ID,
      names: ['meeting-actions', 'meeting-notes'],
    })
    expect(Number.isFinite(Date.parse(status.skills[0]!.installedAt))).toBe(true)

    // 落点必须是官方 `dsh-skill-filesystem` 的 user-dsh 根：`<dshHome>/skills/<name>/SKILL.md`。
    const skillMd = await readFile(join(dshHome, 'skills', 'meeting-notes', 'SKILL.md'), 'utf8')
    expect(skillMd).toContain('name: meeting-notes')
    expect(await exists(join(dshHome, 'skills', 'meeting-actions', 'SKILL.md'))).toBe(true)
    // 暂存区必须清干净：watcher 扫的是技能根，任何残留目录都是噪声。
    expect(await stagingIsEmpty(dshHome)).toBe(true)
    // 制品按 SHA-256 内容寻址缓存，且不是 `.part` 残留。
    const sha256 = createHash('sha256').update(archive).digest('hex')
    const cached = join(dshHome, 'enterprise', 'skill-artifacts', `${sha256}.dshskill`)
    expect(await exists(cached)).toBe(true)
    expect(await exists(`${cached}.part`)).toBe(false)

    // 幂等：同 sha256 且文件仍在时不再发任何请求、不再重写目录。
    fixture.request.mockClear()
    await expect(installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID)).resolves.toMatchObject({
      skills: [expect.objectContaining({ packageId: PACKAGE_ID })],
    })
    expect(fixture.request).toHaveBeenCalledTimes(1)
    // 已装态落盘成清单文件（Host 私有目录，不在技能根内，不会被发现面看到）。
    const state = JSON.parse(await readFile(join(dshHome, STATE_RELATIVE), 'utf8')) as { records: unknown[] }
    expect(state.records).toHaveLength(1)
  })

  it('rejects a download whose bytes do not hash to the published sha256', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    // 同长度、不同内容：先过大小门禁，再在 SHA-256 上被拒。
    const tampered = Buffer.from(archive)
    tampered[tampered.byteLength - 1] = (tampered[tampered.byteLength - 1] ?? 0) ^ 0xff
    const fixture = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(tampered),
    )
    await expect(installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_HASH_MISMATCH' })
    expect(await exists(join(dshHome, 'skills', 'meeting-notes'))).toBe(false)
    expect(await exists(join(dshHome, 'enterprise', 'skill-artifacts'))).toBe(true)
    // 校验失败的制品绝不落成最终文件（`.part` 也清干净）。
    const left = await readFile(join(dshHome, STATE_RELATIVE), 'utf8').catch(() => undefined)
    expect(left).toBeUndefined()
  })

  it('rejects a download larger than the published size and cleans up', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    const fixture = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(Buffer.concat([archive, Buffer.alloc(64)])),
    )
    await expect(installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_SIZE_MISMATCH' })
    expect(await exists(join(dshHome, 'skills', 'meeting-notes'))).toBe(false)
  })

  it('projects a network failure as a download failure and propagates upstream controlled codes', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    const detail = detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' })
    const failing = platformFixture(detail, () => { throw new Error('socket hang up') })
    await expect(installSkillPackage({ platform: failing.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_DOWNLOAD_FAILED' })

    // 上游受控码（退休/不可见）必须原样穿透，不能被折成笼统的下载失败。
    const denied = platformFixture(detail, () => { throw Object.assign(new Error('retired'), { code: 'ENT_SKILL_VISIBILITY_DENIED' }) })
    await expect(installSkillPackage({ platform: denied.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_VISIBILITY_DENIED' })

    // 上游非 2xx 且没抛异常时收敛为本地稳定码。
    const refused = platformFixture(detail, () => new Response('nope', { status: 403 }))
    await expect(installSkillPackage({ platform: refused.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_DOWNLOAD_FAILED' })
  })

  it('refuses a detail the upstream will not serve and a malformed package id', async () => {
    const dshHome = await makeHome()
    const request = vi.fn(async () => new Response('gone', { status: 404 }))
    await expect(installSkillPackage({ platform: { request }, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_PLATFORM_UNAVAILABLE' })

    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    const fixture = platformFixture(detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }), () => new Response(archive))
    for (const bad of ['', '..', '../../etc', '0', '01902500000000000001', 'x']) {
      await expect(installSkillPackage({ platform: fixture.platform, dshHome }, bad as string))
        .rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
    }
    expect(fixture.request).not.toHaveBeenCalled()
  })

  it('refuses an archive that escapes its root before anything reaches the disk', async () => {
    const dshHome = await makeHome()
    // 逃逸必须藏在**技能名之后的资源段**里：这样包契约（`skills/<kebab>/...`）本身是合法的，
    // 唯一能拦住它的就是解压前的路径分段校验——逃逸藏在名字位时会被 kebab 规约顺手挡掉，因而测不出真回归。
    const drafts = buildZip([
      { path: 'manifest.json', content: JSON.stringify({ format: 'dsh-skill', version: '1', id: 'meeting-pkg' }) },
      { path: 'skills/meeting-notes/SKILL.md', content: 'x' },
      { path: 'skills/meeting-notes/../../evil/SKILL.md', content: 'escaped' },
    ])
    const fixture = platformFixture(
      detailEnvelope({ archive: drafts, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(drafts),
    )
    await expect(installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_ARCHIVE_INVALID' })
    // 零落盘：技能根、暂存区、宿主 home 下都不该出现任何逃逸产物。
    expect(await exists(join(dshHome, 'evil'))).toBe(false)
    expect(await exists(join(dshHome, 'enterprise', 'skill-staging', 'evil'))).toBe(false)
    expect(await stagingIsEmpty(dshHome)).toBe(true)
    expect(await exists(join(dshHome, 'skills', 'meeting-notes'))).toBe(false)
    expect(await exists(join(dshHome, 'skills'))).toBe(false)
    expect(await exists(join(dshHome, STATE_RELATIVE))).toBe(false)
  })

  it('refuses an archive that does not match the published detail', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes', 'meeting-actions']))
    // 详情只声明一个技能：包内容与已发布事实不符，必须拒绝而不是多装一个。
    const partial = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(archive),
    )
    await expect(installSkillPackage({ platform: partial.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_PACKAGE_MISMATCH' })

    // manifest.id 与详情 skillId 不符同样拒绝。
    const wrongId = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes', 'meeting-actions'], skillId: 'other-pkg' }),
      () => new Response(archive),
    )
    await expect(installSkillPackage({ platform: wrongId.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_PACKAGE_MISMATCH' })
    expect(await exists(join(dshHome, 'skills'))).toBe(false)
  })

  it('refuses to overwrite an existing skill directory, locally or from another package', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    const fixture = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(archive),
    )
    // 盘上已有同名目录（可能是用户自己放的技能）：绝不覆盖。
    const foreign = join(dshHome, 'skills', 'meeting-notes')
    await mkdir(foreign, { recursive: true })
    await writeFile(join(foreign, 'SKILL.md'), 'user owned', 'utf8')
    await expect(installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_NAME_CONFLICT' })
    expect(await readFile(join(foreign, 'SKILL.md'), 'utf8')).toBe('user owned')
    expect(await exists(join(dshHome, STATE_RELATIVE))).toBe(false)

    // 另一个已装包已拥有同名技能：同样拒绝，且已装包不受影响。
    await rm(foreign, { force: true, recursive: true })
    await installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID)
    const second = platformFixture(
      detailEnvelope({
        archive, names: ['meeting-notes'], skillId: 'meeting-pkg', packageId: OTHER_PACKAGE_ID, versionId: '1902500000000000102',
      }),
      () => new Response(archive),
    )
    await expect(installSkillPackage({ platform: second.platform, dshHome }, OTHER_PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_NAME_CONFLICT' })
    await expect(installedSkillStatus({ platform: fixture.platform, dshHome }))
      .resolves.toMatchObject({ skills: [{ packageId: PACKAGE_ID }] })
  })

  // 升级路：本机已装**同一个 packageId 的旧版本**时再装一次 = 原子升级，绝不是落点冲突。
  // 这条用例是「市场行左侧那枚『有更新』标签」能不能真的走通的最后一环——此前会被预检直接拒成
  // ENT_SKILL_NAME_CONFLICT（连自己旧版本的目录都算「已存在」）。
  it('upgrades the same package to a newer version atomically, replacing its own directories', async () => {
    const dshHome = await makeHome()
    const v1 = buildZip(skillEntries('meeting', ['meeting-actions', 'meeting-notes']))
    const first = platformFixture(
      detailEnvelope({ archive: v1, names: ['meeting-actions', 'meeting-notes'], skillId: 'meeting-pkg', versionId: VERSION_ID }),
      () => new Response(v1),
    )
    await installSkillPackage({ platform: first.platform, dshHome }, PACKAGE_ID)
    expect(await readFile(join(dshHome, 'skills', 'meeting-notes', 'SKILL.md'), 'utf8')).toContain('meeting 技能')

    // 新版本：同一个 packageId / skillId，技能名集合变了（少一个、多一个），内容也不同。
    const v2 = buildZip(skillEntries('meeting-v2', ['meeting-notes', 'meeting-brief'], 'meeting-pkg'))
    const second = platformFixture(
      detailEnvelope({ archive: v2, names: ['meeting-notes', 'meeting-brief'], skillId: 'meeting-pkg', versionId: '1902500000000000102' }),
      () => new Response(v2),
    )
    const status = await installSkillPackage({ platform: second.platform, dshHome }, PACKAGE_ID)
    expect(status.skills).toHaveLength(1)
    expect(status.skills[0]).toMatchObject({
      packageId: PACKAGE_ID,
      versionId: '1902500000000000102',
    })
    // 技能名集合换成新版本的（少一个、多一个），顺序按解包事实，这里只锁集合。
    expect([...status.skills[0]!.names].sort()).toEqual(['meeting-brief', 'meeting-notes'])
    // 内容真的换成新版本（不是就地半覆盖后新旧混着），新技能目录落盘、旧孤儿目录被清掉。
    expect(await readFile(join(dshHome, 'skills', 'meeting-notes', 'SKILL.md'), 'utf8')).toContain('meeting-v2 技能')
    expect(await exists(join(dshHome, 'skills', 'meeting-brief', 'SKILL.md'))).toBe(true)
    expect(await exists(join(dshHome, 'skills', 'meeting-actions'))).toBe(false)
    // 清单只有一条记录（升级是替换而不是追加），暂存/备份位都清干净。
    const state = JSON.parse(await readFile(join(dshHome, STATE_RELATIVE), 'utf8')) as { records: { versionId: string }[] }
    expect(state.records).toHaveLength(1)
    expect(state.records[0]?.versionId).toBe('1902500000000000102')
    expect(await stagingIsEmpty(dshHome)).toBe(true)
    // 升级后同 sha256 再点一次仍是幂等成功：不再重下、不再重写。
    second.request.mockClear()
    await expect(installSkillPackage({ platform: second.platform, dshHome }, PACKAGE_ID))
      .resolves.toMatchObject({ skills: [expect.objectContaining({ versionId: '1902500000000000102' })] })
    expect(second.request).toHaveBeenCalledTimes(1)
  })

  // 升级不得越界：新版本要用的技能名被**别的包**占用时照样拒绝，本包旧版本一根毫毛都不动。
  it('still refuses an upgrade that would take a name owned by another package', async () => {
    const dshHome = await makeHome()
    const own = buildZip(skillEntries('meeting', ['meeting-actions']))
    const ownFixture = platformFixture(
      detailEnvelope({ archive: own, names: ['meeting-actions'], skillId: 'meeting-pkg', versionId: VERSION_ID }),
      () => new Response(own),
    )
    const foreign = buildZip(skillEntries('code-review', ['code-review']))
    const foreignFixture = platformFixture(
      detailEnvelope({
        archive: foreign, names: ['code-review'], skillId: 'code-review-pkg',
        packageId: OTHER_PACKAGE_ID, versionId: '1902500000000000103',
      }),
      () => new Response(foreign),
    )
    await installSkillPackage({ platform: ownFixture.platform, dshHome }, PACKAGE_ID)
    await installSkillPackage({ platform: foreignFixture.platform, dshHome }, OTHER_PACKAGE_ID)

    // 本包新版本想把别的包占着的 `code-review` 收进来：只能拒绝。
    const next = buildZip(skillEntries('meeting-v2', ['meeting-actions', 'code-review'], 'meeting-pkg'))
    const upgrade = platformFixture(
      detailEnvelope({
        archive: next, names: ['meeting-actions', 'code-review'], skillId: 'meeting-pkg',
        versionId: '1902500000000000104',
      }),
      () => new Response(next),
    )
    await expect(installSkillPackage({ platform: upgrade.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_SKILL_NAME_CONFLICT' })
    // 两个包都还在原版本、原内容，落点零改动。
    const status = await installedSkillStatus({ platform: ownFixture.platform, dshHome })
    expect(status.skills.map(skill => skill.packageId).sort()).toEqual([PACKAGE_ID, OTHER_PACKAGE_ID].sort())
    expect(status.skills.find(skill => skill.packageId === PACKAGE_ID)?.versionId).toBe(VERSION_ID)
    expect(await readFile(join(dshHome, 'skills', 'meeting-actions', 'SKILL.md'), 'utf8')).toContain('meeting 技能')
    expect(await readFile(join(dshHome, 'skills', 'code-review', 'SKILL.md'), 'utf8')).toContain('code-review 技能')
    expect(await exists(join(dshHome, 'skills', 'meeting-v2'))).toBe(false)
  })

  // 升级失败回滚：新目录已改名到位、清单还没写上就炸 → 旧版本必须**原样回来**，绝不变成空目录或半装态。
  it('restores the previous version when an upgrade cannot be recorded', async () => {
    const dshHome = await makeHome()
    const v1 = buildZip(skillEntries('meeting', ['meeting-actions', 'meeting-notes']))
    const first = platformFixture(
      detailEnvelope({ archive: v1, names: ['meeting-actions', 'meeting-notes'], skillId: 'meeting-pkg', versionId: VERSION_ID }),
      () => new Response(v1),
    )
    await installSkillPackage({ platform: first.platform, dshHome }, PACKAGE_ID)

    const v2 = buildZip(skillEntries('meeting-v2', ['meeting-notes', 'meeting-brief'], 'meeting-pkg'))
    const second = platformFixture(
      detailEnvelope({ archive: v2, names: ['meeting-notes', 'meeting-brief'], skillId: 'meeting-pkg', versionId: '1902500000000000102' }),
      () => new Response(v2),
    )
    const logged: string[] = []
    await expect(installSkillPackage({
      platform: second.platform,
      dshHome,
      now: () => { throw new Error('clock exploded') },
      // 升级路径上的失败**不允许**走「留痕后成功」的旁路：只接住日志，结论仍是整条拒绝。
      onError: message => { logged.push(message) },
    }, PACKAGE_ID)).rejects.toMatchObject({ code: 'ENT_SKILL_INSTALL_FAILED' })
    expect(logged).toEqual([])

    // 旧版本原样回来：内容还是 v1、旧目录还在、新版本多出来的目录没留下。
    expect(await readFile(join(dshHome, 'skills', 'meeting-notes', 'SKILL.md'), 'utf8')).toContain('meeting 技能')
    expect(await exists(join(dshHome, 'skills', 'meeting-actions', 'SKILL.md'))).toBe(true)
    expect(await exists(join(dshHome, 'skills', 'meeting-brief'))).toBe(false)
    expect(await stagingIsEmpty(dshHome)).toBe(true)
    // 清单没动过：仍是 v1，状态查询如实报 v1。
    const state = JSON.parse(await readFile(join(dshHome, STATE_RELATIVE), 'utf8')) as { records: { versionId: string }[] }
    expect(state.records).toHaveLength(1)
    expect(state.records[0]?.versionId).toBe(VERSION_ID)
    await expect(installedSkillStatus({ platform: first.platform, dshHome }))
      .resolves.toMatchObject({ skills: [expect.objectContaining({ versionId: VERSION_ID })] })
  })

  it('rolls the freshly renamed directories back when the install cannot be recorded', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes', 'meeting-actions']))
    const fixture = platformFixture(
      detailEnvelope({ archive, names: ['meeting-actions', 'meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(archive),
    )
    // 时钟在改名之后、写清单之前抛错：这就是「盘上有、清单没有」的半装态，必须整体撤回。
    await expect(installSkillPackage({
      platform: fixture.platform,
      dshHome,
      now: () => { throw new Error('clock exploded') },
    }, PACKAGE_ID)).rejects.toMatchObject({ code: 'ENT_SKILL_INSTALL_FAILED' })
    expect(await exists(join(dshHome, 'skills', 'meeting-notes'))).toBe(false)
    expect(await exists(join(dshHome, 'skills', 'meeting-actions'))).toBe(false)
    expect(await stagingIsEmpty(dshHome)).toBe(true)
    await expect(installedSkillStatus({ platform: fixture.platform, dshHome })).resolves.toEqual({ skills: [] })
  })

  it('drops an installed record once its files disappear from disk', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    const fixture = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(archive),
    )
    await installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID)
    await rm(join(dshHome, 'skills', 'meeting-notes'), { force: true, recursive: true })
    // 清单还在，但落盘事实不在了：绝不回显假已装态。
    await expect(installedSkillStatus({ platform: fixture.platform, dshHome })).resolves.toEqual({ skills: [] })
  })

  it('uninstalls only what that package owns and reports a missing record', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    const fixture = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(archive),
    )
    await installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID)
    await expect(uninstallSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID))
      .resolves.toEqual({ skills: [] })
    expect(await exists(join(dshHome, 'skills', 'meeting-notes'))).toBe(false)
    // 幂等边界：没装过的包卸载报 404 稳定码，而不是静默成功。
    await expect(uninstallSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID))
      .rejects.toMatchObject({ code: 'ENT_RESOURCE_NOT_FOUND' })
  })

  it('fails closed on a corrupted state file instead of silently overwriting it', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    const fixture = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(archive),
    )
    const statePath = join(dshHome, STATE_RELATIVE)
    await mkdir(join(dshHome, 'enterprise', 'skill-installs'), { recursive: true })
    for (const broken of ['not json', JSON.stringify({ records: [{ packageId: '../escape', names: ['a'] }] }), JSON.stringify({ other: [] })]) {
      await writeFile(statePath, broken, 'utf8')
      await expect(installedSkillStatus({ platform: fixture.platform, dshHome }))
        .rejects.toMatchObject({ code: 'ENT_SKILL_STATE_INVALID' })
      await expect(installSkillPackage({ platform: fixture.platform, dshHome }, PACKAGE_ID))
        .rejects.toMatchObject({ code: 'ENT_SKILL_STATE_INVALID' })
      expect(await readFile(statePath, 'utf8')).toBe(broken)
      expect(await exists(join(dshHome, 'skills', 'meeting-notes'))).toBe(false)
    }
  })

  it('writes a well-formed record with kebab skill names and an RFC 3339 timestamp', async () => {
    const dshHome = await makeHome()
    const archive = buildZip(skillEntries('meeting', ['meeting-notes']))
    const fixture = platformFixture(
      detailEnvelope({ archive, names: ['meeting-notes'], skillId: 'meeting-pkg' }),
      () => new Response(archive),
    )
    await installSkillPackage({
      platform: fixture.platform,
      dshHome,
      now: () => new Date('2026-10-02T00:00:00.000Z'),
    }, PACKAGE_ID)
    const state = JSON.parse(await readFile(join(dshHome, STATE_RELATIVE), 'utf8')) as { records: { installedAt: string, names: string[] }[] }
    expect(state.records).toHaveLength(1)
    expect(state.records[0]?.installedAt).toBe('2026-10-02T00:00:00.000Z')
    expect(state.records[0]?.names).toEqual(['meeting-notes'])
  })

  // 安全：安装 = 落盘。包内 scripts/ 一律不执行（并且本文件不得引入任何执行通道）。
  it('never executes package content and keeps every path on the same-origin local API', async () => {
    const source = await readFile(new URL('../src/skill-install.ts', import.meta.url), 'utf8')
    const archiveSource = await readFile(new URL('../src/skill-archive.ts', import.meta.url), 'utf8')
    for (const forbidden of ['child_process', 'execFile', 'spawn(', 'execa', 'import(']) {
      expect(source).not.toContain(forbidden)
      expect(archiveSource).not.toContain(forbidden)
    }
    expect(source).not.toMatch(/authorization|accessToken|bearer/i)
    expect(source).toContain('resolveEnterpriseDshHome')
    expect(source).toContain('downloadVerifiedArtifact')
    expect(source).toContain('decodeDshSkillArchive')
  })
})
