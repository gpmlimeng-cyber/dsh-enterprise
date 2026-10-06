/**
 * [INPUT]: 依赖 system-search 的纯事实层（结果面文案 / 四态 → 页面投影 / 按根分组 / 单条候选的行投影）
 *   与 skill-api-decode 的盘点投影类型
 * [OUTPUT]: 验证「系统搜索」这一面的纯判定：① 四态 → loading/failed/ready 的唯一投影，且**零候选**时
 *   补上那句整体人话（`empty` 与 `ready` 的差别只有这一句）；② 按根分组保序、且两种空话**不许混**——
 *   根不存在（`present:false`）与「根在但零候选」是两句不同的人话；③ 单条候选的行投影：标题取
 *   frontmatter 技能名、缺席回退目录名、描述缺席就整行不出、三态中文与「为什么没有动作」那句、
 *   且**只有 available 才可纳入**；④ 根标签（唯一本机根给人话、注入根用 id）、计数与纳入那两句反馈的措辞
 * [POS]: 系统搜索那一面的机械门禁——把「谁可点、为什么不可点、空是哪一种空」钉在纯函数层，
 *   页面与控制器只消费（本文件不碰 React、不碰 DOM、不碰 fetch）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  ENTERPRISE_SYSTEM_ADOPT,
  ENTERPRISE_SYSTEM_ADOPTING,
  ENTERPRISE_SYSTEM_CONFLICT_NOTE,
  ENTERPRISE_SYSTEM_DIRECTORY_PREFIX,
  ENTERPRISE_SYSTEM_EMPTY,
  ENTERPRISE_SYSTEM_PRIMARY_ROOT_LABEL,
  ENTERPRISE_SYSTEM_REFRESH,
  ENTERPRISE_SYSTEM_REFRESH_LABEL,
  ENTERPRISE_SYSTEM_REGISTERED_NOTE,
  ENTERPRISE_SYSTEM_ROOT_ABSENT,
  ENTERPRISE_SYSTEM_ROOT_EMPTY,
  ENTERPRISE_SYSTEM_SECTION_LABEL,
  ENTERPRISE_SYSTEM_STATE_AVAILABLE,
  ENTERPRISE_SYSTEM_STATE_CONFLICT,
  ENTERPRISE_SYSTEM_STATE_REGISTERED,
  ENTERPRISE_SYSTEM_TITLE,
  enterpriseSystemAdoptedText,
  enterpriseSystemAdoptingText,
  enterpriseSystemCountText,
  enterpriseSystemFace,
  enterpriseSystemRootGroups,
  enterpriseSystemRootLabel,
  enterpriseSystemSkillRow,
} from '../src/system-search.js'
import type { EnterpriseSystemRoot, EnterpriseSystemSkill, EnterpriseSystemSkills } from '../src/skill-api-decode.js'

const ROOT: EnterpriseSystemRoot = { id: 'user-dsh', path: '/data/user/0/com.deepcode.shell/files/.dsh/skills', present: true }
const ABSENT_ROOT: EnterpriseSystemRoot = { id: 'other-cli', path: '/opt/other/skills', present: false }

function skill(overrides: Partial<EnterpriseSystemSkill> = {}): EnterpriseSystemSkill {
  return {
    path: `/data/user/0/com.deepcode.shell/files/.dsh/skills/${overrides.name ?? 'code-review'}`,
    rootId: 'user-dsh',
    name: 'code-review',
    state: 'available',
    ...overrides,
  }
}

function value(roots: readonly EnterpriseSystemRoot[], skills: readonly EnterpriseSystemSkill[]): EnterpriseSystemSkills {
  return { roots, skills }
}

describe('system search: the four states become exactly one face', () => {
  it('maps loading / failed / ready / empty without ever mixing them', () => {
    expect(enterpriseSystemFace({ kind: 'loading' })).toEqual({ kind: 'loading', groups: [] })
    expect(enterpriseSystemFace({ kind: 'failed', code: 'ENT_LOCAL_UNAVAILABLE' }))
      .toEqual({ kind: 'failed', failedCode: 'ENT_LOCAL_UNAVAILABLE', groups: [] })
    // 有候选：就绪，**不**补那句整体空话。
    const ready = enterpriseSystemFace({ kind: 'ready', value: value([ROOT], [skill()]) })
    expect(ready.kind).toBe('ready')
    expect(ready.emptyNote).toBeUndefined()
    expect(ready.groups).toHaveLength(1)
    // 零候选：仍是「就绪」（真值照铺，包括每个根的那句空话），**另**补一句整体空话。
    const empty = enterpriseSystemFace({ kind: 'empty', value: value([ROOT], []) })
    expect(empty.kind).toBe('ready')
    expect(empty.emptyNote).toBe(ENTERPRISE_SYSTEM_EMPTY)
    expect(empty.groups[0]!.emptyNote).toBe(ENTERPRISE_SYSTEM_ROOT_EMPTY)
  })
})

describe('system search: grouping keeps the Host order and never mixes the two empty sentences', () => {
  it('groups by rootId in the declared root order, keeping each root\'s candidate order', () => {
    const roots = [{ ...ROOT, id: 'user-dsh' }, { ...ABSENT_ROOT }]
    const skills = [
      skill({ name: 'b-skill', rootId: 'user-dsh' }),
      skill({ name: 'a-skill', rootId: 'other-cli' }),
      skill({ name: 'a-skill-2', rootId: 'user-dsh' }),
    ]
    const groups = enterpriseSystemRootGroups(value(roots, skills))
    expect(groups.map(group => group.root.id)).toEqual(['user-dsh', 'other-cli'])
    // 组内保持 Host 给的顺序（**不重排**：顺序是 Host 的契约，界面原样铺）。
    expect(groups[0]!.skills.map(item => item.name)).toEqual(['b-skill', 'a-skill-2'])
    expect(groups[1]!.skills.map(item => item.name)).toEqual(['a-skill'])
    // 有候选的组没有空话。
    expect(groups[0]!.emptyNote).toBeUndefined()
    expect(groups[1]!.emptyNote).toBeUndefined()
  })

  it('says two different things for "the location is not there" and "the location has nothing"', () => {
    expect(ENTERPRISE_SYSTEM_ROOT_ABSENT).not.toBe(ENTERPRISE_SYSTEM_ROOT_EMPTY)
    const absent = enterpriseSystemRootGroups(value([ABSENT_ROOT], []))[0]!
    expect(absent.emptyNote).toBe(ENTERPRISE_SYSTEM_ROOT_ABSENT)
    const present = enterpriseSystemRootGroups(value([ROOT], []))[0]!
    expect(present.emptyNote).toBe(ENTERPRISE_SYSTEM_ROOT_EMPTY)
    // 根标签：唯一那枚本机根给人话，注入的根用它的 id 原样（不编名字）。
    expect(enterpriseSystemRootLabel(ROOT)).toBe(ENTERPRISE_SYSTEM_PRIMARY_ROOT_LABEL)
    expect(enterpriseSystemRootLabel(ABSENT_ROOT)).toBe('other-cli')
    // 计数：零说「没有技能目录」，不写「0 个」。
    expect(enterpriseSystemCountText(0)).toBe('没有技能目录')
    expect(enterpriseSystemCountText(3)).toBe('3 个技能目录')
  })

  /**
   * ★ **复审整改（真机上的重复名）**：只有一个本机根时，根标签 === 页名
   *   （`ENTERPRISE_SYSTEM_TITLE`）⇒ 原先页标题 / 节标题 / 节的无障碍名是同一个词，屏幕上上下各读一遍、
   *   读屏还要多报一遍。规则只有一条：**这一节的标签会不会与页名逐字重复**。
   */
  it('never repeats the page title: the head goes away and the section gets its own accessible name', () => {
    // 单根（真机的默认形态）：可见节头**整键缺席**、无障碍名换成中性词。
    const alone = enterpriseSystemRootGroups(value([ROOT], [skill({ name: 'code-review' })]))[0]!
    expect(alone.label).toBe(ENTERPRISE_SYSTEM_TITLE)
    expect(alone.headLabel).toBeUndefined()
    expect(alone.sectionLabel).toBe(ENTERPRISE_SYSTEM_SECTION_LABEL)
    expect(ENTERPRISE_SYSTEM_SECTION_LABEL).not.toBe(ENTERPRISE_SYSTEM_TITLE)
    // 不重复页名的那一枚根（注入的根用 id）：节头照旧出、无障碍名就是它自己。
    const injected = enterpriseSystemRootGroups(value([ABSENT_ROOT], []))[0]!
    expect(injected.headLabel).toBe('other-cli')
    expect(injected.sectionLabel).toBe('other-cli')
    // 两根同屏：两节的无障碍名**互不相同**，也都不等于页名（嵌套同名 landmark 会连报两遍）。
    const both = enterpriseSystemRootGroups(value([ROOT, ABSENT_ROOT], []))
    expect(both.map(group => group.sectionLabel)).toEqual([ENTERPRISE_SYSTEM_SECTION_LABEL, 'other-cli'])
    expect(new Set(both.map(group => group.sectionLabel)).size).toBe(2)
    expect(both.map(group => group.sectionLabel)).not.toContain(ENTERPRISE_SYSTEM_TITLE)
  })
})

describe('system search: one candidate becomes one honest row', () => {
  it('prefers the frontmatter skill name, falls back to the directory name, and keeps the directory visible', () => {
    const named = enterpriseSystemSkillRow(skill({ name: 'code-review', displayName: '代码审查' }))
    expect(named.title).toBe('代码审查')
    // 标题不是目录名时，那一句里补上目录名（目录名是**纳入落点**的标识，不能被名字盖住）。
    expect(named.note.startsWith(`${ENTERPRISE_SYSTEM_DIRECTORY_PREFIX}code-review · `)).toBe(true)
    expect(named.note).toContain(ENTERPRISE_SYSTEM_STATE_AVAILABLE)
    // 没有 frontmatter 名 ⇒ 标题就是目录名，那一句里**不再重复**目录名。
    const plain = enterpriseSystemSkillRow(skill({ name: 'code-review' }))
    expect(plain.title).toBe('code-review')
    expect(plain.note).toBe(ENTERPRISE_SYSTEM_STATE_AVAILABLE)
    expect(plain.note).not.toContain(ENTERPRISE_SYSTEM_DIRECTORY_PREFIX)
  })

  it('draws the description only when the Host gave one (never a placeholder)', () => {
    expect(enterpriseSystemSkillRow(skill({ description: '把代码审查规则带进新会话。' })).description)
      .toBe('把代码审查规则带进新会话。')
    expect(enterpriseSystemSkillRow(skill()).description).toBeUndefined()
  })

  it('gives every state its Chinese word, and explains why the two non-adoptable ones have no action', () => {
    const available = enterpriseSystemSkillRow(skill({ state: 'available' }))
    expect(available.stateLabel).toBe(ENTERPRISE_SYSTEM_STATE_AVAILABLE)
    expect(available.adoptable).toBe(true)
    expect(available.stateNote).toBeUndefined()
    const registered = enterpriseSystemSkillRow(skill({ state: 'registered' }))
    expect(registered.stateLabel).toBe(ENTERPRISE_SYSTEM_STATE_REGISTERED)
    expect(registered.adoptable).toBe(false)
    expect(registered.stateNote).toBe(ENTERPRISE_SYSTEM_REGISTERED_NOTE)
    expect(registered.note).toContain(ENTERPRISE_SYSTEM_REGISTERED_NOTE)
    // ★ 复审整改的反锁：原因里**不再重说一遍状态**（原先读起来是「已装：这个目录已经在本机装好了」）。
    expect(registered.note).not.toContain('已经')
    expect(registered.note).toBe(`${ENTERPRISE_SYSTEM_STATE_REGISTERED}：${ENTERPRISE_SYSTEM_REGISTERED_NOTE}`)
    const conflict = enterpriseSystemSkillRow(skill({ state: 'conflict' }))
    expect(conflict.stateLabel).toBe(ENTERPRISE_SYSTEM_STATE_CONFLICT)
    expect(conflict.adoptable).toBe(false)
    // 冲突那句必须说清**为什么**（同名目录被别人占了），不是只说「冲突」两个字。
    expect(conflict.stateNote).toBe(ENTERPRISE_SYSTEM_CONFLICT_NOTE)
    expect(conflict.note).toContain(ENTERPRISE_SYSTEM_CONFLICT_NOTE)
    // 只有可纳入那一种会给出动作 ⇒ 另两态在页面上**不画按钮**（也就不存在「禁用即须有可见说明」的问题）。
    expect([available, registered, conflict].map(row => row.adoptable)).toEqual([true, false, false])
  })

  it('keeps the adopt feedback sentences complete and free of bare codes', () => {
    expect(ENTERPRISE_SYSTEM_ADOPT).toBe('纳入')
    expect(ENTERPRISE_SYSTEM_ADOPTING).toBe('正在纳入…')
    const busy = enterpriseSystemAdoptingText('代码审查')
    expect(busy).toContain('代码审查')
    expect(busy).toContain('完成前不能纳入别的目录')
    expect(busy).not.toContain('ENT_')
    expect(enterpriseSystemAdoptedText('代码审查')).toBe('已纳入「代码审查」。')
  })
})
