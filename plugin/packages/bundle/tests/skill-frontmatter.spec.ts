/**
 * [INPUT]: 依赖 `src/skill-frontmatter.ts` 的 `parseSkillFrontmatter`/`validateSkillFrontmatter` 与 `src/skill-errors.ts` 的稳定码
 * [OUTPUT]: 锁定 §D.4 的客户端 frontmatter 闸门逐条规则（D4-1 缺/未闭合、D4-2 必须是映射、D4-3 重复键、D4-5 name、D4-6 description、D4-7 whenToUse 与两个布尔、D4-8 legacy 字段带改名建议、D4-10 未知键容忍并留痕），并锁住「客户端只允许更严」的两处显式偏差（多行 plain 标量、未知 YAML 形式）
 * [POS]: bundle 技能纵深的正文闸门回归门禁；服务端 `SkillArtifactInspector.java:167-202` 是权威，本文件是它的客户端同源实现——有人放宽 kebab/长度/布尔字面量、删掉重复键扫描、或把 legacy 字段静默忽略，这里都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import { parseSkillFrontmatter, validateSkillFrontmatter } from '../src/skill-frontmatter.js'

/** 组一个 `SKILL.md`：`---` + 给定正文 + `---` + 技能正文。 */
function skillMd(frontmatter: string, body = '正文\n'): Buffer {
  return Buffer.from(`---\n${frontmatter}\n---\n${body}`, 'utf8')
}

function codeOf(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return (error as { code?: string }).code ?? 'NO_CODE'
  }
  return 'NO_THROW'
}

const VALID = 'name: meeting-notes\ndescription: 把会议录音整理成结构化纪要'

describe('client skill frontmatter gate (§D.4)', () => {
  it('accepts the official five keys and reports the parsed facts', () => {
    const facts = parseSkillFrontmatter(skillMd(
      [VALID, 'whenToUse: 当用户说"把这次会议整理一下"时', 'disable-model-invocation: false', 'user-invocable: yes'].join('\n'),
    ))
    expect(facts.name).toBe('meeting-notes')
    expect(facts.description).toBe('把会议录音整理成结构化纪要')
    expect(facts.whenToUse).toBe('当用户说"把这次会议整理一下"时')
    expect(facts.disableModelInvocation).toBe(false)
    expect(facts.userInvocable).toBe(true)
    expect(facts.unknownKeys).toEqual([])
  })

  // D4-1：`---` 起止的块必须存在且闭合；官方运行时只忽略该文件，我们升级为整包拒绝（与 D4-1 的处置一致）。
  it('requires a closed frontmatter block and tolerates a BOM and leading blank lines', () => {
    expect(codeOf(() => parseSkillFrontmatter(Buffer.from('没有 frontmatter 的正文')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(Buffer.from('前言\n---\nname: a\n---\n正文')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(Buffer.from('---\nname: a\ndescription: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(Buffer.from('\n\n---\nname: a\ndescription: d\n---\n正文')))).toBe('NO_THROW')
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), skillMd(VALID)])
    expect(parseSkillFrontmatter(bom).name).toBe('meeting-notes')
    // CRLF 是 Windows 上真实存在的写法：块边界判定与服务端一致（都按 `\n---` 找收尾）。
    expect(parseSkillFrontmatter(Buffer.from(`---\r\nname: meeting-notes\r\ndescription: d\r\n---\r\n正文`)).name)
      .toBe('meeting-notes')
  })

  // D4-2：必须是映射（根序列/非键行一律拒）。
  it('rejects a root that is not a mapping', () => {
    expect(codeOf(() => parseSkillFrontmatter(skillMd('- name: a\n- description: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd('just a line')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    // 多行 plain 标量的续行：本实现按「不支持」拒（服务端会折成一行），这是一处显式更严。
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: a\n\n  description: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
  })

  // D4-3：服务端 `setAllowDuplicateKeys(false)`；JS 侧没有解析器帮我们拒，必须自己扫（原型用正则预扫的同一件事）。
  it('rejects duplicate keys at the top level and inside a nested mapping', () => {
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: a\ndescription: d\nname: b')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    // 真样本形态：`multi-search-engine` 因重复 homepage 被服务端拒（EVIDENCE.md:127）。
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\nhomepage: https://a\nhomepage: https://b`))))
      .toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\nextra:\n  x: 1\n  x: 2`))))
      .toBe('ENT_SKILL_SKILLMD_INVALID')
    // 反例：序列里两个**各自独立**的映射项用同名键是合法 YAML，不许误伤。
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\nextra:\n  - x: 1\n  - x: 2`)))).toBe('NO_THROW')
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\na:\n  x: 1\nb:\n  x: 2`)))).toBe('NO_THROW')
  })

  // D4-5：name 必填、非空白、kebab-case、≤64。
  it('enforces the name field', () => {
    expect(codeOf(() => parseSkillFrontmatter(skillMd('description: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name:\ndescription: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: "  "\ndescription: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: Meeting_Notes\ndescription: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`name: ${'a'.repeat(95)}\ndescription: d`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(parseSkillFrontmatter(skillMd(`name: ${'a'.repeat(64)}\ndescription: d`)).name).toBe('a'.repeat(64))
    // 引号标量是字符串，服务端同样按字符串判。
    expect(parseSkillFrontmatter(skillMd('name: "meeting-notes"\ndescription: d')).name).toBe('meeting-notes')
  })

  // D4-6：description 必填、非空白、≤1024。
  it('enforces the description field', () => {
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: a')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: a\ndescription:')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`name: a\ndescription: ${'x'.repeat(1025)}`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(parseSkillFrontmatter(skillMd(`name: a\ndescription: ${'x'.repeat(1024)}`)).description).toHaveLength(1024)
    // 块标量：`|` 保行、`>-` 折行且 strip 掉尾换行。
    expect(parseSkillFrontmatter(skillMd('name: a\ndescription: |\n  第一行\n  第二行')).description).toBe('第一行\n第二行\n')
    expect(parseSkillFrontmatter(skillMd('name: a\ndescription: >-\n  第一行\n  第二行')).description).toBe('第一行 第二行')
    // chomping 必须与服务端 libyaml 对齐：`|-` 的 name 是干净的 kebab（clip 会带上尾换行而被拒）。
    expect(parseSkillFrontmatter(skillMd('name: |-\n  meeting-notes\ndescription: d')).name).toBe('meeting-notes')
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: |\n  meeting-notes\ndescription: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
  })

  // D4-7：whenToUse ≤2048；两个布尔按官方字面量表宽松解析。
  it('enforces whenToUse and both boolean fields', () => {
    expect(parseSkillFrontmatter(skillMd(`${VALID}\nwhenToUse: ${'x'.repeat(2048)}`)).whenToUse).toHaveLength(2048)
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\nwhenToUse: ${'x'.repeat(2049)}`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\nwhenToUse: 2026-10-03`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    // 官方接受布尔与 true/false/yes/no/on/off/1/0（大小写不敏感），其余一律拒。
    for (const value of ['true', 'True', 'TRUE', 'yes', 'YES', 'on', 'ON', '1', '"yes"', "'on'"]) {
      expect(parseSkillFrontmatter(skillMd(`${VALID}\ndisable-model-invocation: ${value}`)).disableModelInvocation).toBe(true)
    }
    for (const value of ['false', 'no', 'No', 'off', 'OFF', '0']) {
      expect(parseSkillFrontmatter(skillMd(`${VALID}\ndisable-model-invocation: ${value}`)).disableModelInvocation).toBe(false)
    }
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\ndisable-model-invocation: maybe`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\ndisable-model-invocation: 2`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    // 缺席才是 true；显式 null 是 false（服务端 `data.containsKey` 判法）。
    expect(parseSkillFrontmatter(skillMd(VALID)).userInvocable).toBe(true)
    expect(parseSkillFrontmatter(skillMd(`${VALID}\nuser-invocable:`)).userInvocable).toBe(false)
    expect(parseSkillFrontmatter(skillMd(`${VALID}\nuser-invocable: no`)).userInvocable).toBe(false)
  })

  // D4-8：legacy 字段拒绝且错误文案必须含改名建议。
  it('rejects legacy field names with a rename suggestion', () => {
    for (const [legacy, replacement] of [
      ['modelInvocable', 'disable-model-invocation'],
      ['userInvocable', 'user-invocable'],
      ['disableModelInvocation', 'disable-model-invocation'],
    ] as const) {
      try {
        parseSkillFrontmatter(skillMd(`${VALID}\n${legacy}: true`))
        expect.unreachable('legacy field must be rejected')
      } catch (error) {
        expect((error as { code?: string }).code).toBe('ENT_SKILL_SKILLMD_INVALID')
        expect((error as Error).message).toContain(legacy)
        expect((error as Error).message).toContain(replacement)
      }
    }
  })

  // D4-10：未知键容忍但不透传（服务端只按名取五个键），并把键名回给调用方留痕。
  it('tolerates unknown keys and reports them for tracing', () => {
    const facts = parseSkillFrontmatter(skillMd(`${VALID}\nhomepage: https://example.com\nmetadata:\n  author: 某人\n  tags:\n    - a`))
    expect(facts.name).toBe('meeting-notes')
    expect(facts.unknownKeys).toEqual(['homepage', 'metadata'])
    // 注释与尾注释不影响取值。
    expect(parseSkillFrontmatter(skillMd(`# 开头注释\n${VALID} # 尾注释`)).description).toBe('把会议录音整理成结构化纪要')
  })

  // 客户端**更严**的两处显式偏差（服务端 libyaml 会折行 / 会认锚点；我们 fail-closed）。
  it('fails closed on YAML forms this implementation does not support', () => {
    // 多行 plain 标量：服务端折成一行，我们拒（绝不猜折行结果）。
    expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\n  extra: 1`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: a\ndescription: 第一行\n  第二行')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    for (const form of ['&anchor x', '*alias', '!!str x', '{a: b}', '[a, b]']) {
      expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\ndescription: ${form}`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    }
    // 非字符串的已知键取值（服务端 `optionalSkillText` 判「必须是字符串」）；
    // 但显式 `null`/`~` 是 YAML null ⇒ 服务端当作「没写」，故 whenToUse 接受、name/description 仍缺。
    for (const value of ['123', '2026-10-03', '1.5']) {
      expect(codeOf(() => parseSkillFrontmatter(skillMd(`${VALID}\nwhenToUse: ${value}`)))).toBe('ENT_SKILL_SKILLMD_INVALID')
    }
    expect(parseSkillFrontmatter(skillMd(`${VALID}\nwhenToUse: null`)).whenToUse).toBeUndefined()
    expect(parseSkillFrontmatter(skillMd(`${VALID}\nwhenToUse: ~`)).whenToUse).toBeUndefined()
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: null\ndescription: d')))).toBe('ENT_SKILL_SKILLMD_INVALID')
    // 制表符缩进（YAML 禁止，服务端解析器直接报错）。
    expect(codeOf(() => parseSkillFrontmatter(skillMd('name: a\ndescription: d\n\tfoo: 1')))).toBe('ENT_SKILL_SKILLMD_INVALID')
  })

  it('exposes the same decision through validateSkillFrontmatter with a locating label', () => {
    expect(validateSkillFrontmatter(skillMd(VALID), 'meeting-notes').name).toBe('meeting-notes')
    const bytes = skillMd('name: meeting-notes')
    try {
      validateSkillFrontmatter(bytes, 'meeting-notes')
      expect.unreachable('missing description must be rejected')
    } catch (error) {
      expect((error as { code?: string }).code).toBe('ENT_SKILL_SKILLMD_INVALID')
      expect((error as Error).message).toContain('meeting-notes/SKILL.md')
    }
  })
})
