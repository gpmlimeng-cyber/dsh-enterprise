/**
 * [INPUT]: 依赖 skill-market 的装配指令/条目与元信息纯投影，以及 local-api 再导出的技能严格解码（含**本机文件树 / 树里单个文本文件**与两条动态路径构造器）
 * [OUTPUT]: 验证**已装技能正文的严格解码**（`decodeEnterpriseInstalledSkillContent`：单键封闭、雪花包 id、kebab 技能名、正文 ≤256 KiB，宿主路径/超限/错类型一律 `ENT_LOCAL_RESPONSE_INVALID`）与四条技能同源路径常量、装配指令文案要点（下载 URL/名称/skillId/~/.dsh/skills 落点/落盘前确认）、调用策略标签、列表与详情投影（含 sha256 丢弃、null 归一、**可选分类 category 的严格解码与缺席归一**）、**已装态解码与逐行安装态投影（已装/未装/在途文案与按钮语义）**、三条安装动作的同源路径常量、畸形拒绝与浏览器不接触令牌/不绕开 local-api；**本刀（详情子页面文件区）新增**本机**文件树**与**树里单个文本文件**两份投影的严格解码门禁（`decodeEnterpriseInstalledSkillFiles` / `decodeEnterpriseInstalledSkillFile`：键集封闭、路径形状收窄（绝对路径 / 反斜杠 / 盘符 / `..` / 空段 / `%` / 控制字符 / 超长段 / 非 kebab 首段）、目录 `sizeBytes` 恒 0、树内路径不重复、非 `file`/`directory` 类型、单文件 ≤256 KiB 与 262144 边界、条目数上限）与两条动态路径构造器 `enterpriseSkillFilesPath` / `enterpriseSkillFilePath` 的编码口径
 * [POS]: dsh-ui 技能 tab 的产品词汇与边界门禁，真实 DOM 与视觉由 Harness 快照与真机验收覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  buildSkillInstruction,
  enterpriseSkillEntryRows,
  enterpriseSkillInstallState,
  enterpriseSkillInvocationLabel,
  enterpriseSkillMeta,
} from '../src/skill-market.js'
import {
  decodeEnterpriseInstalledSkillFile,
  decodeEnterpriseInstalledSkillFiles,
  decodeEnterpriseInstalledSkillContent,
  decodeEnterpriseInstalledSkills,
  decodeEnterpriseSkillDetail,
  decodeEnterpriseSkills,
  ENTERPRISE_SKILL_CONTENT_LOCAL_PATH,
  ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH,
  ENTERPRISE_SKILL_INSTALL_LOCAL_PATH,
  ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH,
  enterpriseSkillFilePath,
  enterpriseSkillFilesPath,
} from '../src/local-api.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Button: vi.fn(), Modal: vi.fn() }))

const SUMMARY = {
  id: '7001',
  skillId: 'code-review-ent',
  displayName: '企业代码评审技能包',
  description: '企业统一的代码评审检查单',
  sourceDshVersion: '0.2.0-rc.2',
  sizeBytes: 2048,
  skillCount: 2,
  updatedAt: '2026-09-30T10:00:00Z',
}

const DETAIL = {
  ...SUMMARY,
  versionId: '9001',
  sha256: 'a'.repeat(64),
  skills: [
    { name: 'code-review', description: '按检查单评审改动', modelInvocable: true, userInvocable: true },
    { name: 'release-notes', description: '生成发布说明', whenToUse: '用户要求发布说明时', modelInvocable: false, userInvocable: true },
  ],
}

const PLATFORM = 'https://enterprise.example.com/'

describe('enterprise skill market', () => {
  it('projects the visible skill list and rejects detail-only or malformed rows', () => {
    expect(decodeEnterpriseSkills([SUMMARY])).toEqual([{ ...SUMMARY, versionId: '', skills: [] }])
    for (const broken of [
      [{ ...SUMMARY, versionId: '9001' }],
      [{ ...SUMMARY, accessToken: 'must-not-cross' }],
      [{ ...SUMMARY, sizeBytes: -1 }],
      [{ ...SUMMARY, sizeBytes: 52_428_801 }],
      [{ ...SUMMARY, skillCount: 0 }],
      [{ ...SUMMARY, updatedAt: '2026-09-30 10:00:00' }],
      'not-an-array',
      Array.from({ length: 201 }, () => SUMMARY),
    ]) {
      expect(() => decodeEnterpriseSkills(broken)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

  it('decodes the optional skill category strictly and normalizes absence to no key', () => {
    // 合法：非空分类串照原样投影（列表与详情两条路同一口径）。
    expect(decodeEnterpriseSkills([{ ...SUMMARY, category: '研发工具' }])[0]?.category).toBe('研发工具')
    expect(decodeEnterpriseSkillDetail({ ...DETAIL, category: '研发工具' }).category).toBe('研发工具')
    // 缺席 / null / 空串：一律归一成「没有这个键」（界面据此不渲染分类签，安静缺席是预期行为）。
    for (const value of [undefined, null, '']) {
      const row = decodeEnterpriseSkills([{ ...SUMMARY, category: value }])[0]
      expect(row).toEqual({ ...SUMMARY, versionId: '', skills: [] })
      expect(Object.keys(row ?? {}).includes('category')).toBe(false)
      const detail = decodeEnterpriseSkillDetail({ ...DETAIL, category: value })
      expect(Object.keys(detail).includes('category')).toBe(false)
    }
    // 类型不对（数字/对象/布尔/数组）一律抛稳定失败码，绝不让畸形值滑进界面。
    for (const broken of [42, {}, true, ['研发工具']]) {
      expect(() => decodeEnterpriseSkills([{ ...SUMMARY, category: broken }])).toThrow('ENT_LOCAL_RESPONSE_INVALID')
      expect(() => decodeEnterpriseSkillDetail({ ...DETAIL, category: broken })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // category 进白名单 ≠ 放开键集：多塞别的未知字段照样整条判失败。
    expect(() => decodeEnterpriseSkills([{ ...SUMMARY, category: '研发工具', tag: 'x' }]))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
    // 分类串也不是无上限的：超长判畸形。
    expect(() => decodeEnterpriseSkills([{ ...SUMMARY, category: 'x'.repeat(65) }]))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })

  it('projects skill detail entries with invocation policy and drops the artifact sha256', () => {
    const detail = decodeEnterpriseSkillDetail(DETAIL)
    expect(detail).toEqual({
      ...SUMMARY,
      versionId: '9001',
      skills: [
        { name: 'code-review', description: '按检查单评审改动', modelInvocable: true, userInvocable: true },
        { name: 'release-notes', description: '生成发布说明', whenToUse: '用户要求发布说明时', modelInvocable: false, userInvocable: true },
      ],
    })
    expect(JSON.stringify(detail)).not.toMatch(/sha256/i)
    // 服务端 manifest description 选填、whenToUse 缺席时出 null：都在边界归一，不把 null 送进界面。
    const nullable = decodeEnterpriseSkillDetail({
      ...DETAIL,
      description: null,
      skills: [{ ...DETAIL.skills[1], whenToUse: null }],
    })
    expect(nullable.description).toBe('')
    expect(nullable.skills[0]).toEqual({ name: 'release-notes', description: '生成发布说明', modelInvocable: false, userInvocable: true })
    for (const broken of [
      { ...DETAIL, artifactPath: '/private/x.dshskill' },
      { ...DETAIL, sha256: 'a'.repeat(63) },
      { ...DETAIL, versionId: '0' },
      { ...DETAIL, skills: [{ ...DETAIL.skills[0], name: 'Code Review' }] },
      { ...DETAIL, skills: [{ ...DETAIL.skills[0], description: '' }] },
      { ...DETAIL, skills: [{ ...DETAIL.skills[0], modelInvocable: 'yes' }] },
      { ...DETAIL, skills: 'not-a-list' },
    ]) {
      expect(() => decodeEnterpriseSkillDetail(broken)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

  it('builds the assembly instruction with download URL, identity, target directory and a pre-write confirmation', () => {
    const instruction = buildSkillInstruction(decodeEnterpriseSkillDetail(DETAIL), PLATFORM)
    expect(instruction).toContain('https://enterprise.example.com/enterprise/api/v1/skills/versions/9001/download')
    expect(instruction).not.toContain('.com//enterprise')
    expect(instruction).toContain('名称：企业代码评审技能包')
    expect(instruction).toContain('技能 ID：code-review-ent')
    expect(instruction).toContain('建议目标目录：~/.dsh/skills/')
    expect(instruction).toContain('读取详情并检查安全信息后，在实际下载和落盘前向我确认')
    expect(instruction).toContain('kebab-case')
    expect(instruction).toContain('无需重启')
    // 列表投影（无 versionId）退回包详情地址，绝不给出拼不出来的下载链接。
    expect(buildSkillInstruction(decodeEnterpriseSkills([SUMMARY])[0]!, PLATFORM))
      .toContain('https://enterprise.example.com/enterprise/api/v1/skills/7001')
    // 未配置平台地址时不拼出半截域名，仍保留同源路径骨架。
    expect(buildSkillInstruction(decodeEnterpriseSkillDetail(DETAIL), null))
      .toContain('技能包：/enterprise/api/v1/skills/versions/9001/download')
  })

  it('labels invocation policy and projects card meta with one shared size format', () => {
    expect(enterpriseSkillInvocationLabel({ name: 'a', description: 'd', modelInvocable: true, userInvocable: false })).toBe('模型可调用')
    expect(enterpriseSkillInvocationLabel({ name: 'a', description: 'd', modelInvocable: false, userInvocable: true })).toBe('仅用户可调用')
    expect(enterpriseSkillEntryRows(decodeEnterpriseSkillDetail(DETAIL))).toEqual([
      { name: 'code-review', description: '按检查单评审改动', policy: '模型可调用' },
      { name: 'release-notes', description: '生成发布说明', whenToUse: '用户要求发布说明时', policy: '仅用户可调用' },
    ])
    expect(enterpriseSkillMeta(decodeEnterpriseSkillDetail(DETAIL))).toBe('DSH 0.2.0-rc.2 · 2.0 KiB · 2 个技能')
  })

  it('decodes the installed skill state and rejects any leaked host fact', () => {
    const installed = {
      packageId: '7001',
      skillId: 'code-review-ent',
      displayName: '企业代码评审技能包',
      versionId: '9001',
      sha256: 'a'.repeat(64),
      names: ['code-review', 'release-notes'],
      installedAt: '2026-10-02T00:00:00Z',
    }
    expect(decodeEnterpriseInstalledSkills({ skills: [installed] })).toEqual([installed])
    expect(decodeEnterpriseInstalledSkills({ skills: [] })).toEqual([])
    for (const broken of [
      // Host 多塞任何字段（宿主路径、清单文件路径）都整条判失败。
      { skills: [{ ...installed, root: '/data/user/0/com.deepcode.shell/files/home/.dsh/skills' }] },
      { skills: [{ ...installed, artifactPath: '/private/x.dshskill' }] },
      { skills: [{ ...installed, sha256: 'a'.repeat(63) }] },
      { skills: [{ ...installed, packageId: '0' }] },
      { skills: [{ ...installed, versionId: '../9001' }] },
      { skills: [{ ...installed, names: [] }] },
      { skills: [{ ...installed, names: ['Code Review'] }] },
      { skills: [{ ...installed, names: ['code-review', 'code-review'] }] },
      { skills: [{ ...installed, installedAt: '2026-10-02 00:00:00' }] },
      { skills: Array.from({ length: 201 }, () => installed) },
      { skills: 'not-a-list' },
      { records: [] },
      installed,
    ]) {
      expect(() => decodeEnterpriseInstalledSkills(broken)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

  it('projects each row install state from the host truth and the in-flight action', () => {
    const record = {
      packageId: '7001',
      skillId: 'code-review-ent',
      displayName: '企业代码评审技能包',
      versionId: '9001',
      sha256: 'a'.repeat(64),
      names: ['code-review', 'release-notes'],
      installedAt: '2026-10-02T00:00:00Z',
    }
    // 未取到清单与空清单都算未装：界面从不乐观猜测。
    expect(enterpriseSkillInstallState(undefined, '7001')).toEqual({
      installed: false, names: [], actionLabel: '安装', statusLabel: '未安装', busy: false, action: 'install',
    })
    expect(enterpriseSkillInstallState([], '7001').installed).toBe(false)
    expect(enterpriseSkillInstallState([record], '7001')).toEqual({
      installed: true,
      names: ['code-review', 'release-notes'],
      actionLabel: '卸载',
      statusLabel: '已装 · 2 个技能',
      busy: false,
      action: 'uninstall',
    })
    // 在途：文案切到进行时、按钮禁用；别的包在途不影响本行。
    expect(enterpriseSkillInstallState([], '7001', { packageId: '7001', action: 'install' }))
      .toMatchObject({ actionLabel: '安装中…', busy: true, action: 'install' })
    expect(enterpriseSkillInstallState([record], '7001', { packageId: '7001', action: 'uninstall' }))
      .toMatchObject({ actionLabel: '卸载中…', busy: true, action: 'uninstall' })
    expect(enterpriseSkillInstallState([record], '7001', { packageId: '7002', action: 'install' }))
      .toMatchObject({ actionLabel: '卸载', busy: false })
    // 另一个包已装不影响本行。
    expect(enterpriseSkillInstallState([record], '7002').installed).toBe(false)
  })

  it('keeps the three skill action paths on the same origin as the rest of the local API', () => {
    expect(ENTERPRISE_SKILL_INSTALL_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/install')
    expect(ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/uninstall')
    expect(ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/installed')
    // 只读正文那条与三条动作同族：`/skills` 的子路径（靠 Host 侧 exact 表优先命中）、不带尾斜杠。
    expect(ENTERPRISE_SKILL_CONTENT_LOCAL_PATH).toBe('/enterprise/api/v1/local/skills/content')
    // 四条都是 `/skills` prefix 的子路径（靠 Host 侧 exact 表优先命中），因此**不以** `/skills/` 结尾。
    for (const path of [ENTERPRISE_SKILL_INSTALL_LOCAL_PATH, ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH, ENTERPRISE_SKILL_CONTENT_LOCAL_PATH]) {
      expect(path.endsWith('/')).toBe(false)
      expect(path.startsWith('/enterprise/api/v1/local/skills/')).toBe(true)
    }
  })

  // 已装技能**正文**（点技能行看详情时读的本机只读投影）：形状比别处更窄——单键封闭、
  // 包 id 雪花、技能名官方 kebab、正文 ≤256 KiB（与 Host 侧字节上限同值）。
  it('decodes the installed skill body strictly and rejects host paths or oversized text', () => {
    const body = { packageId: '7001', name: 'code-review', content: '# 正文\n- 检查单' }
    expect(decodeEnterpriseInstalledSkillContent(body)).toEqual(body)
    // 空正文是合法投影（界面自己说「正文为空」），不是畸形。
    expect(decodeEnterpriseInstalledSkillContent({ ...body, content: '' })).toEqual({ ...body, content: '' })
    for (const broken of [
      // Host 多塞宿主路径 / 其它字段都整条判失败（正文投影只认这三个键）。
      { ...body, path: '/data/user/0/com.deepcode.shell/files/home/.dsh/skills/code-review/SKILL.md' },
      { ...body, skillId: 'code-review-ent' },
      { packageId: '0', name: 'code-review', content: 'x' },
      { packageId: '7001', name: 'Code Review', content: 'x' },
      { packageId: '7001', name: '../etc/passwd', content: 'x' },
      { packageId: '7001', name: 'a'.repeat(65), content: 'x' },
      { packageId: '7001', name: 'code-review', content: 42 },
      { packageId: '7001', name: 'code-review', content: 'x'.repeat(262_145) },
      { packageId: '7001', name: 'code-review' },
      [],
      'not-an-object',
    ]) {
      expect(() => decodeEnterpriseInstalledSkillContent(broken)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 上限边界本身合法（256 KiB）。
    expect(decodeEnterpriseInstalledSkillContent({ ...body, content: 'x'.repeat(262_144) }).content.length).toBe(262_144)
  })

  // 已装技能的**本机文件树 / 树里单个文本文件**（技能详情子页面左树右预览的两份输入）：
  // 形状比别处更窄——键集封闭、路径必须是「相对 `/` 分隔的 kebab 技能目录 + 后代」、目录 sizeBytes 恒 0、
  // 树内路径不重复、文件正文 ≤256 KiB；宿主绝对路径 / `..` / `%` 二次编码 / 非法类型一律整条判畸形。
  it('decodes the installed skill file tree and a single text file strictly', () => {
    const files = {
      packageId: '7001',
      entries: [
        { path: 'code-review', kind: 'directory', sizeBytes: 0 },
        { path: 'code-review/SKILL.md', kind: 'file', sizeBytes: 2048 },
        { path: 'code-review/references/checklist.md', kind: 'file', sizeBytes: 512 },
      ],
    }
    expect(decodeEnterpriseInstalledSkillFiles(files)).toEqual(files)
    // 空树是合法投影（Host 侧真目录为空），不是畸形。
    expect(decodeEnterpriseInstalledSkillFiles({ packageId: '7001', entries: [] })).toEqual({ packageId: '7001', entries: [] })
    for (const broken of [
      // 键集封闭：少键、多键、多塞宿主路径都整条判失败。
      { packageId: '7001' },
      { packageId: '7001', entries: [], root: '/data/user/0/x/skills' },
      { ...files, entries: [{ path: 'code-review', kind: 'directory', sizeBytes: 0, absolutePath: '/x' }] },
      // 包 id / 路径形状：非雪花、绝对路径、反斜杠、盘符、`..`、空段、`%`、控制字符、超长段、非 kebab 首段。
      { ...files, packageId: '0' },
      { ...files, entries: [{ path: '/etc/passwd', kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: 'code-review\\SKILL.md', kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: 'C:/x', kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: '../SKILL.md', kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: 'code-review//SKILL.md', kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: 'code-review/%2e%2e/x', kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: 'code-review/a\u0000b', kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: `${'a'.repeat(256)}/x`, kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: 'Code-Review/SKILL.md', kind: 'file', sizeBytes: 1 }] },
      { ...files, entries: [{ path: `${'a'.repeat(65)}/SKILL.md`, kind: 'file', sizeBytes: 1 }] },
      // 类型 / 字节数 / 重复路径：目录的 sizeBytes 必须恒 0，文件 ≤256 KiB，同一路径不许出现两次。
      { ...files, entries: [{ path: 'code-review', kind: 'symlink', sizeBytes: 0 }] },
      { ...files, entries: [{ path: 'code-review', kind: 'directory', sizeBytes: 7 }] },
      { ...files, entries: [{ path: 'code-review/SKILL.md', kind: 'file', sizeBytes: -1 }] },
      { ...files, entries: [{ path: 'code-review/SKILL.md', kind: 'file', sizeBytes: 262_145 }] },
      { ...files, entries: [{ path: 'code-review/SKILL.md', kind: 'file', sizeBytes: 1 }, { path: 'code-review/SKILL.md', kind: 'file', sizeBytes: 2 }] },
      { ...files, entries: 'nope' },
      [],
      'not-an-object',
    ]) {
      expect(() => decodeEnterpriseInstalledSkillFiles(broken)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 文件上限边界本身合法（256 KiB）。
    expect(decodeEnterpriseInstalledSkillFiles({
      ...files, entries: [{ path: 'code-review/SKILL.md', kind: 'file', sizeBytes: 262_144 }],
    }).entries[0]?.sizeBytes).toBe(262_144)

    const file = { packageId: '7001', path: 'code-review/SKILL.md', sizeBytes: 2048, text: '# 正文\n- 检查单' }
    expect(decodeEnterpriseInstalledSkillFile(file)).toEqual(file)
    expect(decodeEnterpriseInstalledSkillFile({ ...file, text: '' })).toEqual({ ...file, text: '' })
    for (const broken of [
      { ...file, name: 'code-review' },
      { ...file, absolutePath: '/data/user/0/x/skills/code-review/SKILL.md' },
      { packageId: '0', path: 'code-review/SKILL.md', sizeBytes: 1, text: 'x' },
      { packageId: '7001', path: '../SKILL.md', sizeBytes: 1, text: 'x' },
      { packageId: '7001', path: '/SKILL.md', sizeBytes: 1, text: 'x' },
      { packageId: '7001', path: 'Code-Review/SKILL.md', sizeBytes: 1, text: 'x' },
      { packageId: '7001', path: 'code-review/SKILL.md', sizeBytes: 1.5, text: 'x' },
      { packageId: '7001', path: 'code-review/SKILL.md', sizeBytes: 1, text: 42 },
      { packageId: '7001', path: 'code-review/SKILL.md', sizeBytes: 1, text: 'x'.repeat(262_145) },
      { packageId: '7001', path: 'code-review/SKILL.md', sizeBytes: 1 },
      [],
    ]) {
      expect(() => decodeEnterpriseInstalledSkillFile(broken)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 两条**动态**同源路径构造器：包 id 走路径段、相对路径走查询串，两者各自 `encodeURIComponent`
    // （`../` 之类只会变成查询串里的字面量，永远不成为路径片段），且与 Host 注册面逐字对应。
    // 构造器返回**相对本地 API 前缀**的路径（`requestJson` 负责拼固定前缀，拼完即 Host 注册面的完整路径）。
    expect(enterpriseSkillFilesPath('7001')).toBe('/skills/7001/files')
    expect(enterpriseSkillFilePath('7001', 'code-review/SKILL.md'))
      .toBe('/skills/7001/file?path=code-review%2FSKILL.md')
    expect(enterpriseSkillFilePath('7001', '../etc/passwd'))
      .toBe('/skills/7001/file?path=..%2Fetc%2Fpasswd')
    expect(enterpriseSkillFilesPath('../../x')).toBe('/skills/..%2F..%2Fx/files')
    // 完整同源路径由「固定前缀 + 构造器」拼成，且两条都不带尾斜杠、都在 `/skills/` 子路径族里。
    for (const path of [enterpriseSkillFilesPath('7001'), enterpriseSkillFilePath('7001', 'code-review/SKILL.md')]) {
      expect(path.startsWith('/skills/')).toBe(true)
      expect(path.endsWith('/')).toBe(false)
    }
  })

  it('fetches only through the shared same-origin local API and never touches tokens', async () => {
    const source = await readFile(new URL('../src/skill-market.tsx', import.meta.url), 'utf8')
    expect(source).toContain('createEnterpriseLocalApi')
    // 一键安装只经共享同源 API 的安装/卸载/已装态三方法，不自己拼 URL、不碰令牌、不执行包内内容。
    expect(source).toContain('api.installSkill')
    expect(source).toContain('api.uninstallSkill')
    expect(source).toContain('api.installedSkills')
    expect(source).not.toMatch(/authorization|accessToken|bearer/i)
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('child_process')
  })
})
