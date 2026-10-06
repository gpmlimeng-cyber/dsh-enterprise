/**
 * [INPUT]: 依赖 skill-create 的纯事实层（草稿构造器 / 三段文案 / 三态反馈的唯一投影）与 error-messages 的唯一码表
 * [OUTPUT]: 验证「通过 Agent 创建」这一项的纯判定：① 草稿**逐条**说到冻结契约要求的那四件事
 *   （目标 / 落点 / frontmatter 的 name+description 硬门 / skill-creator 的**条件句**），且确定性、可审、
 *   不含员工侧禁用词（那段字是**会进官方输入框、用户按发送前看得见**的）；② 三态 → 反馈的唯一投影
 *   （成功/已复制各一句 `role="status"` 人话；失败**只交稳定码**，人话与下一步由唯一映射给）；
 *   ③ 两枚本机动作码都在唯一表里，且**下一步不同**（一个是「把这句指令复制走」，一个是「检查剪贴板权限后重试」）
 * [POS]: 「通过 Agent 创建」那一项的机械门禁——把「说什么、什么时候说、失败后往哪走」钉在纯函数层，
 *   控制器只接线、页面只画（本文件不碰 React、不碰 DOM、不碰剪贴板、不发网络）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  ENTERPRISE_SKILL_CREATE_COPIED,
  ENTERPRISE_SKILL_CREATE_COPY,
  ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE,
  ENTERPRISE_SKILL_CREATE_COPY_LABEL,
  ENTERPRISE_SKILL_CREATE_DRAFT_FILE,
  ENTERPRISE_SKILL_CREATE_DRAFT_ROOT,
  ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE,
  ENTERPRISE_SKILL_CREATE_OPENED,
  buildSkillCreateDraft,
  enterpriseSkillCreateNotice,
  type EnterpriseSkillCreateState,
} from '../src/skill-create.js'
import { ENTERPRISE_ERROR_CODES, enterpriseErrorAction, enterpriseErrorPresentation } from '../src/error-messages.js'

describe('the agent-creation draft says exactly what the contract requires', () => {
  it('is deterministic and covers goal, landing spot, the frontmatter hard gate and the conditional skill-creator sentence', () => {
    const draft = buildSkillCreateDraft()
    // 纯函数：同样的调用永远得到同一段字（用户看到的与用例审的是同一份）。
    expect(buildSkillCreateDraft()).toBe(draft)
    // ① 目标：让助手在本机造一份**可被加载**的技能。
    expect(draft).toContain('请在本机创建一份 DeepSeek Harness 技能')
    // ② 落点：官方 user-dsh 根 + SKILL.md（系统搜索扫的就是这一处）。
    expect(draft).toContain(ENTERPRISE_SKILL_CREATE_DRAFT_ROOT)
    expect(draft).toContain(ENTERPRISE_SKILL_CREATE_DRAFT_FILE)
    expect(ENTERPRISE_SKILL_CREATE_DRAFT_ROOT).toBe('~/.dsh/skills/<技能名>/')
    // ③ 硬门：frontmatter 的 name 与 description **两项缺一不可**，且说明白「缺了不会被加载」。
    expect(draft).toContain('frontmatter')
    expect(draft).toMatch(/缺一不可/)
    expect(draft).toMatch(/name:\s*技能名/)
    expect(draft).toMatch(/description:\s*一句话/)
    expect(draft).toContain('不会被加载')
    // 技能名规约：全小写连字符（kebab-case），且与目录名一致。
    expect(draft).toContain('kebab-case')
    expect(draft).toContain('与本技能目录名一致')
    // ④ skill-creator **只能是条件句**：本机实测没装它 ⇒ 前半句必须是「如果已经装了…」，
    //    后半句必须给出「没装怎么办」；绝不出现「优先用 skill-creator」这种无条件承诺。
    expect(draft).toContain('如果本机已经装了 skill-creator 技能，就优先用它来创建')
    expect(draft).toContain('没有装的话，直接按上面的要求写文件即可')
    expect(draft).not.toMatch(/请使用 skill-creator|用 skill-creator 创建这份技能。/)
    // 末尾给出下一步（写完怎么走）——可执行，不是一句「祝你好运」。
    expect(draft).toContain('写完告诉我技能名与它的落点')
    expect(draft).toContain('纳入')
  })

  it('keeps the employee-banned technical words out of a text the user really reads and sends', () => {
    // 这段字会进官方输入框（用户按发送前看得见），故按员工侧文案同一条纪律审一遍。
    const draft = buildSkillCreateDraft()
    for (const banned of ['preset', 'Preset', '.dshpreset', 'manifest', 'YAML', 'yaml', 'Cordis', 'MCP', 'bundle patch']) {
      expect(draft, banned).not.toContain(banned)
    }
    // 也不许出现裸的稳定码（那段字是给助手看的自然语言，不是排障信息）。
    expect(draft).not.toContain('ENT_')
  })
})

describe('the three feedback states become exactly one notice', () => {
  it('maps opened / copied to one status sentence each and failures to the raw code only', () => {
    expect(enterpriseSkillCreateNotice({ kind: 'opened' }))
      .toEqual({ kind: 'status', text: ENTERPRISE_SKILL_CREATE_OPENED })
    expect(enterpriseSkillCreateNotice({ kind: 'copied' }))
      .toEqual({ kind: 'status', text: ENTERPRISE_SKILL_CREATE_COPIED })
    // 失败态**只有码**：本模块不长出第二份人话（人话 + 下一步在 error-messages 的唯一表里）。
    const failed = enterpriseSkillCreateNotice({
      kind: 'failed', code: ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE, draft: buildSkillCreateDraft(),
    })
    expect(failed).toEqual({ kind: 'failed', code: ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE })
    // 三态都覆盖到了（漏一态就是一条静默）。成功那句必须说清「已经发生什么 + 你只要做什么」。
    const states: readonly EnterpriseSkillCreateState[] = [
      { kind: 'opened' },
      { kind: 'copied' },
      { kind: 'failed', code: ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE, draft: 'x' },
    ]
    expect(states.map(state => enterpriseSkillCreateNotice(state).kind)).toEqual(['status', 'status', 'failed'])
    expect(ENTERPRISE_SKILL_CREATE_OPENED).toContain('按发送即可')
    expect(ENTERPRISE_SKILL_CREATE_COPIED).toContain('粘贴给助手即可')
  })

  it('keeps the copy affordance readable and its accessible name complete', () => {
    expect(ENTERPRISE_SKILL_CREATE_COPY).toBe('复制这句指令')
    expect(ENTERPRISE_SKILL_CREATE_COPY_LABEL).toContain(ENTERPRISE_SKILL_CREATE_COPY)
    expect(ENTERPRISE_SKILL_CREATE_COPY_LABEL).toContain('粘贴给助手')
  })
})

describe('the two local-action codes give two different, executable next steps', () => {
  it('keeps both codes in the one table, with the copy path and the clipboard path kept apart', () => {
    for (const code of [ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE, ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE]) {
      expect(ENTERPRISE_ERROR_CODES, code).toContain(code)
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
    }
    // 开新会话失败 ⇒ 把这句指令复制走（界面那枚按钮就是这个动作，文案必须与它同名同义）。
    expect(enterpriseErrorAction(ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE)).toContain(ENTERPRISE_SKILL_CREATE_COPY)
    // 复制失败 ⇒ 检查剪贴板权限后重试（不是「再点一次那一项」也不是「重试安装」）。
    expect(enterpriseErrorAction(ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE)).toContain('剪贴板权限')
    // 两枚的下一步**必须不同**（否则没必要分两枚码）。
    expect(enterpriseErrorAction(ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE))
      .not.toBe(enterpriseErrorAction(ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE))
    // 两枚码都不带预设/配方字样（它们只属于这一条通路，出现在技术信息里不该指向别的功能）。
    for (const code of [ENTERPRISE_SKILL_CREATE_LAUNCH_FAILED_CODE, ENTERPRISE_SKILL_CREATE_COPY_FAILED_CODE]) {
      expect(code, code).not.toContain('PRESET')
    }
  })
})
