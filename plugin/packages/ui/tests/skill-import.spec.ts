/**
 * [INPUT]: 依赖 skill-import 的纯事实层（accept 串 / 50 MiB 上限 / 三枚码 / 预检 / 三态 → 人话 / 自装记录 → 名字）
 *   与 error-messages 的唯一码表（含**跨流** action 的按流查询）
 * [OUTPUT]: 验证「本地上传」这条通路的纯判定与文案：① accept 与上限逐字（50 MiB 与字节数双向绑定）；
 *   ② 三枚上传码都在唯一码表里且各有人话 + 下一步；③ 尺寸预检只有一条判据、边界精确（恰好 50 MiB 放行）；
 *   ④ 三态 → 反馈的唯一投影（进行中含文件名与大小、成功含「装好了哪几个」、清单读不到时如实补那半句、
 *   失败只交稳定码与前缀，**不写第二句人话**）；⑤ 自装记录按**用户原始文件名**精确匹配（匹配不上不编名字）；
 *   ⑥ `ENT_SKILL_ARCHIVE_INVALID` 是**跨流**码：本地上传流下不出现「重新下载」，默认流那句一字未改；
 *   ⑦ `ENT_SKILL_NAME_CONFLICT` 的下一步在两条流下都走得通（不再指向员工做不到的自装卸载）
 * [POS]: 本地上传通路的机械门禁——把「哪几件事实、哪几句话、哪条判据」钉在纯函数层，界面与控制器只消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  ENTERPRISE_SKILL_IMPORT_ACCEPT,
  ENTERPRISE_SKILL_IMPORT_DONE,
  ENTERPRISE_SKILL_IMPORT_FAILED,
  ENTERPRISE_SKILL_IMPORT_FAILED_CODE,
  ENTERPRISE_SKILL_IMPORT_INPUT_LABEL,
  ENTERPRISE_SKILL_IMPORT_INVALID_CODE,
  ENTERPRISE_SKILL_IMPORT_MAX_BYTES,
  ENTERPRISE_SKILL_IMPORT_MAX_TEXT,
  ENTERPRISE_SKILL_IMPORT_NAMES_PREFIX,
  ENTERPRISE_SKILL_IMPORT_NAMES_SHOWN,
  ENTERPRISE_SKILL_IMPORT_RESELECT,
  ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL,
  ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE,
  ENTERPRISE_SKILL_IMPORT_UNLISTED,
  ENTERPRISE_SKILL_IMPORT_UPLOADING,
  enterpriseSkillImportNames,
  enterpriseSkillImportNotice,
  enterpriseSkillImportRejectReason,
  type EnterpriseSkillImportState,
} from '../src/skill-import.js'
import {
  ENTERPRISE_ERROR_CODES,
  enterpriseErrorAction,
  enterpriseErrorActionIn,
  enterpriseErrorPresentation,
} from '../src/error-messages.js'
import type { EnterpriseSelfInstalledSkill } from '../src/skill-api-decode.js'

/** 一份自装记录的最小真实形状（Host 侧七键：五枚必备 + 两枚 provenance）。 */
function selfRecord(overrides: Partial<EnterpriseSelfInstalledSkill> = {}): EnterpriseSelfInstalledSkill {
  return {
    skillId: 'meeting-notes',
    displayName: '会议纪要技能组',
    sha256: 'a'.repeat(64),
    names: ['meeting-notes'],
    installedAt: '2026-10-05T08:00:00.000Z',
    sourceInput: 'meeting-notes.dshskill',
    ...overrides,
  }
}

describe('local skill upload: the frozen facts (accept / quota / codes)', () => {
  it('pins the accept list and the 50 MiB quota with the byte count bound to the human text', () => {
    // 冻结契约逐字：`.dshskill` + 两个 zip 媒体类型（浏览器按它过滤，Host 仍独立再判一次）。
    expect(ENTERPRISE_SKILL_IMPORT_ACCEPT).toBe('.dshskill,application/vnd.dsh.skill+zip,application/zip')
    // 50 MiB 与字节数**双向绑定**：谁改了一个而忘了另一个，这条先红。
    expect(ENTERPRISE_SKILL_IMPORT_MAX_BYTES).toBe(50 * 1024 * 1024)
    expect(ENTERPRISE_SKILL_IMPORT_MAX_TEXT).toBe('50 MiB')
    // 那句话里的「50 MiB」与人话常量同源（不许各写一份数字）。
    expect(enterpriseErrorAction(ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE)).toContain(ENTERPRISE_SKILL_IMPORT_MAX_TEXT)
    // 选择器与「重新选择文件」两枚文案都不空白（读屏靠它们）。
    expect(ENTERPRISE_SKILL_IMPORT_INPUT_LABEL.length).toBeGreaterThan(0)
    expect(ENTERPRISE_SKILL_IMPORT_RESELECT.length).toBeGreaterThan(0)
    expect(ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL).toContain('重新选择')
    expect(ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL).toContain('技能包文件')
  })

  it('keeps all three upload codes in the one and only error table', () => {
    for (const code of [
      ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE,
      ENTERPRISE_SKILL_IMPORT_INVALID_CODE,
      ENTERPRISE_SKILL_IMPORT_FAILED_CODE,
      // Host 侧第 4 枚（SKILL.md frontmatter 闸门）：保留成独立码，下一步是**改文件头**、不是换一份文件。
      'ENT_SKILL_SKILLMD_INVALID',
    ]) {
      expect(ENTERPRISE_ERROR_CODES, code).toContain(code)
      const view = enterpriseErrorPresentation(code)
      expect(view.known, code).toBe(true)
      expect(view.message.length, code).toBeGreaterThan(0)
      expect(view.action.endsWith('。'), code).toBe(true)
      expect(view.message, code).not.toContain('ENT_')
      expect(view.action, code).not.toContain('ENT_')
    }
    // 「换一份文件」与「改文件头」是**两句不同的下一步**（不许互相抄，否则两枚码没必要分开）。
    expect(enterpriseErrorAction(ENTERPRISE_SKILL_IMPORT_INVALID_CODE))
      .not.toBe(enterpriseErrorAction('ENT_SKILL_SKILLMD_INVALID'))
    expect(enterpriseErrorAction('ENT_SKILL_SKILLMD_INVALID')).toContain('文件开头')
  })
})

describe('local skill upload: the size pre-check (one rule, exact boundary)', () => {
  it('rejects only what is over the quota, with the frozen stable code', () => {
    // 恰好 50 MiB **放行**（判据是 `>` 而不是 `>=`：Host 侧的配额也是「不超过 50 MiB」）。
    expect(enterpriseSkillImportRejectReason({ name: 'ok.dshskill', size: ENTERPRISE_SKILL_IMPORT_MAX_BYTES }))
      .toBeUndefined()
    // 超一个字节即拦下，且给的是冻结契约那枚码。
    expect(enterpriseSkillImportRejectReason({ name: 'big.dshskill', size: ENTERPRISE_SKILL_IMPORT_MAX_BYTES + 1 }))
      .toBe(ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE)
    // 空文件（0 字节）**不在这里**判：形状与内容归 Host 的闸门，前端不造第二套规则。
    expect(enterpriseSkillImportRejectReason({ name: 'empty.dshskill', size: 0 })).toBeUndefined()
  })
})

describe('local skill upload: state machine → the one visible sentence', () => {
  it('says what is being imported, with the real file name and size', () => {
    const notice = enterpriseSkillImportNotice({ kind: 'uploading', name: 'meeting-notes.dshskill', bytes: 2_097_152 })
    expect(notice.kind).toBe('busy')
    expect(notice).toEqual({ kind: 'busy', text: `${ENTERPRISE_SKILL_IMPORT_UPLOADING}「meeting-notes.dshskill」（2.0 MiB）…` })
  })

  it('reports success with the installed skill names, and says so when the list could not be read', () => {
    // 清单读到了、也匹配上了这一次那一枚 ⇒ 念出技能名。
    expect(enterpriseSkillImportNotice({
      kind: 'done', name: 'meeting-notes.dshskill', bytes: 1024, names: ['meeting-notes', 'minutes'], listed: true,
    })).toEqual({
      kind: 'done',
      text: `${ENTERPRISE_SKILL_IMPORT_DONE}「meeting-notes.dshskill」（1.0 KiB）。${ENTERPRISE_SKILL_IMPORT_NAMES_PREFIX}meeting-notes、minutes。`,
    })
    // 清单读到了、但这次那一枚没匹配上（例如同包重传、旧记录留着上次的文件名）⇒ 只报成功，**不编名字**。
    expect(enterpriseSkillImportNotice({
      kind: 'done', name: 'again.dshskill', bytes: 0, names: [], listed: true,
    }).text).toBe(`${ENTERPRISE_SKILL_IMPORT_DONE}「again.dshskill」（0 B）。`)
    // 清单**读不到** ⇒ 成功那件事一个字不改，另补一句如实的交代（不是失败、也不是静默）。
    const unlisted = enterpriseSkillImportNotice({ kind: 'done', name: 'x.dshskill', bytes: 1, names: [], listed: false })
    expect(unlisted.kind).toBe('done')
    expect(unlisted.text).toContain(ENTERPRISE_SKILL_IMPORT_DONE)
    expect(unlisted.text).toContain(ENTERPRISE_SKILL_IMPORT_UNLISTED)
  })

  it('caps the listed skill names so one feedback line can never explode', () => {
    const names = Array.from({ length: ENTERPRISE_SKILL_IMPORT_NAMES_SHOWN + 4 }, (_, index) => `skill-${index}`)
    const notice = enterpriseSkillImportNotice({ kind: 'done', name: 'many.dshskill', bytes: 1, names, listed: true })
    expect(notice.text).toContain(`等 ${names.length} 个`)
    expect(notice.text).not.toContain(names[names.length - 1]!)
  })

  it('hands failures over as a stable code and a prefix — never a second human sentence', () => {
    const notice = enterpriseSkillImportNotice({
      kind: 'failed', name: 'broken.dshskill', bytes: 2048, code: ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE,
    })
    expect(notice).toEqual({
      kind: 'failed',
      code: ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE,
      prefix: `${ENTERPRISE_SKILL_IMPORT_FAILED}「broken.dshskill」（2.0 KiB）失败`,
    })
    // 前缀里**没有**裸码（码只在「技术信息」折叠区里，由唯一提示组件渲染）。
    expect(notice.kind === 'failed' ? notice.prefix : '').not.toContain('ENT_')
    // 三态都覆盖到了（漏一态就没有反馈，静默吞掉）：
    const states: readonly EnterpriseSkillImportState[] = [
      { kind: 'uploading', name: 'a.dshskill', bytes: 1 },
      { kind: 'done', name: 'a.dshskill', bytes: 1, names: [], listed: true },
      { kind: 'failed', name: 'a.dshskill', bytes: 1, code: ENTERPRISE_SKILL_IMPORT_FAILED_CODE },
    ]
    expect(states.map(state => enterpriseSkillImportNotice(state).kind)).toEqual(['busy', 'done', 'failed'])
  })
})

describe('local skill upload: which record belongs to this upload', () => {
  it('matches the record by the user file name and never guesses', () => {
    const mine = selfRecord({ sourceInput: 'mine.dshskill', names: ['meeting-notes'] })
    const other = selfRecord({ skillId: 'other', sourceInput: 'other.dshskill', names: ['finance-crawler'] })
    expect(enterpriseSkillImportNames([other, mine], 'mine.dshskill')).toEqual(['meeting-notes'])
    // 没匹配上 ⇒ 空集合（界面只报成功，绝不把「上一个」技能的名字报成本次结果）。
    expect(enterpriseSkillImportNames([other, mine], 'third.dshskill')).toEqual([])
    // Host 不给 `sourceInput`（可选第六件）⇒ 一样匹配不上，一样不编名字。
    expect(enterpriseSkillImportNames([selfRecord({ sourceInput: undefined })], 'meeting-notes.dshskill')).toEqual([])
    expect(enterpriseSkillImportNames([], 'mine.dshskill')).toEqual([])
  })
})

describe('a code that really spans two flows keeps each flow\'s next step', () => {
  it('offers the upload flow its own action for ENT_SKILL_ARCHIVE_INVALID, leaving the default untouched', () => {
    const code = 'ENT_SKILL_ARCHIVE_INVALID'
    // 默认流（中心下载安装）：一个字都没改（那条流里技能包是应用替员工下的）。
    expect(enterpriseErrorAction(code)).toBe('请重新下载；仍然失败请联系企业管理员重新发布。')
    expect(enterpriseErrorActionIn(code)).toBe(enterpriseErrorAction(code))
    // 本地上传流：技能包就是员工手里那份文件 ⇒ 不许出现「重新下载」，且下一步**不同**。
    const upload = enterpriseErrorActionIn(code, 'local-upload')
    expect(upload).not.toBe(enterpriseErrorAction(code))
    expect(upload).not.toContain('重新下载')
    expect(upload).toContain('重新选择')
    expect(upload.endsWith('。')).toBe(true)
    // 不跨流的码两条取值必须**逐字相同**（这一位只在真跨流时才允许改变呈现）。
    for (const otherCode of ENTERPRISE_ERROR_CODES) {
      if (otherCode === code) continue
      expect(enterpriseErrorActionIn(otherCode, 'local-upload'), otherCode).toBe(enterpriseErrorAction(otherCode))
    }
    // 未映射/畸形码：兜底那句，与流无关。
    expect(enterpriseErrorActionIn('ENT_NOT_A_REAL_CODE', 'local-upload'))
      .toBe(enterpriseErrorAction('ENT_NOT_A_REAL_CODE'))
  })

  it('keeps the same-name conflict pointing at something the employee can actually do', () => {
    const action = enterpriseErrorAction('ENT_SKILL_NAME_CONFLICT')
    // 改前那句「请先卸载同名技能，再重试安装。」指向一个今天做不到的动作（自装的那份没有卸载面）。
    expect(action).not.toBe('请先卸载同名技能，再重试安装。')
    // 两条流都走得通：先试卸载（企业目录装来的那份真能卸），走不通就找人清。
    expect(action).toContain('无法卸载')
    expect(action).toContain('企业管理员')
    expect(action.endsWith('。')).toBe(true)
  })
})
