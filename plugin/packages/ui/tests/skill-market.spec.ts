/**
 * [INPUT]: 依赖 skill-market 的装配指令/条目与元信息纯投影，以及 local-api 再导出的技能严格解码
 * [OUTPUT]: 验证装配指令文案要点（下载 URL/名称/skillId/~/.dsh/skills 落点/落盘前确认）、调用策略标签、列表与详情投影（含 sha256 丢弃、null 归一）、畸形拒绝与浏览器不接触令牌/不绕开 local-api
 * [POS]: dsh-ui 技能 tab 的产品词汇与边界门禁，真实 DOM 与视觉由 Harness 快照与真机验收覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  buildSkillInstruction,
  enterpriseSkillEntryRows,
  enterpriseSkillInvocationLabel,
  enterpriseSkillMeta,
} from '../src/skill-market.js'
import { decodeEnterpriseSkillDetail, decodeEnterpriseSkills } from '../src/local-api.js'

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

  it('fetches only through the shared same-origin local API and never touches tokens', async () => {
    const source = await readFile(new URL('../src/skill-market.tsx', import.meta.url), 'utf8')
    expect(source).toContain('createEnterpriseLocalApi')
    expect(source).not.toMatch(/authorization|accessToken|bearer/i)
    expect(source).not.toContain('fetch(')
  })
})
