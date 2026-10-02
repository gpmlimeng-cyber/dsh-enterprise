/**
 * [INPUT]: 依赖 skill-market 的装配指令/条目与元信息纯投影，以及 local-api 再导出的技能严格解码
 * [OUTPUT]: 验证装配指令文案要点（下载 URL/名称/skillId/~/.dsh/skills 落点/落盘前确认）、调用策略标签、列表与详情投影（含 sha256 丢弃、null 归一、**可选分类 category 的严格解码与缺席归一**）、**已装态解码与逐行安装态投影（已装/未装/在途文案与按钮语义）**、三条安装动作的同源路径常量、畸形拒绝与浏览器不接触令牌/不绕开 local-api
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
  decodeEnterpriseInstalledSkills,
  decodeEnterpriseSkillDetail,
  decodeEnterpriseSkills,
  ENTERPRISE_SKILL_INSTALLED_LOCAL_PATH,
  ENTERPRISE_SKILL_INSTALL_LOCAL_PATH,
  ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH,
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
    // 三条都是 `/skills` prefix 的子路径（靠 Host 侧 exact 表优先命中），因此**不以** `/skills/` 结尾。
    for (const path of [ENTERPRISE_SKILL_INSTALL_LOCAL_PATH, ENTERPRISE_SKILL_UNINSTALL_LOCAL_PATH]) {
      expect(path.endsWith('/')).toBe(false)
      expect(path.startsWith('/enterprise/api/v1/local/skills/')).toBe(true)
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
