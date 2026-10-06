/**
 * [INPUT]: 依赖 online-search 的纯事实层（查询档位 / 逐源两种坏消息 / 单条结果行投影 / 整面状态投影）
 *   与 error-messages 的唯一码表（含 `'online-install'` 这一流的按流取值）
 * [OUTPUT]: 验证「在线搜索」这一面的纯判定：① 查询档位（空闲 / 太短 / 可搜）按去空白后的长度判；
 *   ② **逐源两种坏消息绝不合并**——`ok:false` 是「这个源这次没取到」、`dropped>0` 是「取到了但有 N 条
 *   装不出来被丢掉」，两句都带源名，且成功源不出噪音行；③ 单条结果的行投影（来源恒有，作者/星标/安装量
 *   缺席就不进那一句；描述缺席整行不画）；④ 整面投影：查询不足门槛时**看档位**（不铺上一次的旧结果），
 *   够长时照四态铺（含零结果那句人话），逐源那两句**在就绪档照铺**；⑤ 三枚新码各有人话 + **下一步互不相同**，
 *   且三枚既有跨流码在 `'online-install'` 流下有各自正确的下一步（默认那句里的「重新下载 / 联系企业管理员」在此流下说不通）；
 *   ⑥ **本刀（复审整改）**：结果计数与就绪播报**都在这里算**（零结果时计数整枚缺席）、两枚计数走千分位、
 *   行上「已装」态由**调用方给的坐标清单**唯一决定（界面不乐观切换），且节名 `ENTERPRISE_ONLINE_RESULTS_TITLE`
 *   与页名**逐字不同**（同屏不许再说一遍页名、两个 landmark 不许同名）
 * [POS]: 在线搜索那一面的机械门禁——把「搜什么、说什么、哪条能装、为什么不能」钉在纯函数层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  ENTERPRISE_ONLINE_AUTHOR_PREFIX,
  ENTERPRISE_ONLINE_EMPTY,
  ENTERPRISE_ONLINE_IDLE,
  ENTERPRISE_ONLINE_INSTALL,
  ENTERPRISE_ONLINE_INSTALLED,
  ENTERPRISE_ONLINE_INSTALLING,
  ENTERPRISE_ONLINE_INSTALLS_PREFIX,
  ENTERPRISE_ONLINE_INSTALL_BUSY_SUFFIX,
  ENTERPRISE_ONLINE_LOADING,
  ENTERPRISE_ONLINE_QUERY_MIN,
  ENTERPRISE_ONLINE_RESULTS_TITLE,
  ENTERPRISE_ONLINE_SOURCE_PREFIX,
  ENTERPRISE_ONLINE_STARS_PREFIX,
  ENTERPRISE_ONLINE_TITLE,
  ENTERPRISE_ONLINE_TOO_SHORT,
  enterpriseOnlineCountText,
  enterpriseOnlineFace,
  enterpriseOnlineInstalledText,
  enterpriseOnlineInstallingText,
  enterpriseOnlineQueryState,
  enterpriseOnlineReadyText,
  enterpriseOnlineResultRow,
  enterpriseOnlineSourceNotes,
} from '../src/online-search.js'
import type { EnterpriseOnlineSkillResult, EnterpriseOnlineSkillSearch, EnterpriseOnlineSkillSource } from '../src/skill-api-decode.js'
import { ENTERPRISE_ERROR_CODES, ENTERPRISE_ERROR_FLOWS, enterpriseErrorAction, enterpriseErrorActionIn, enterpriseErrorPresentation } from '../src/error-messages.js'

function source(overrides: Partial<EnterpriseOnlineSkillSource> = {}): EnterpriseOnlineSkillSource {
  return { id: 'skills.sh', ok: true, ...overrides }
}

function result(overrides: Partial<EnterpriseOnlineSkillResult> = {}): EnterpriseOnlineSkillResult {
  return {
    sourceId: 'skills.sh',
    name: 'code-review',
    installSource: 'skills.sh:owner/repo/code-review',
    ...overrides,
  }
}

function search(
  sources: readonly EnterpriseOnlineSkillSource[],
  results: readonly EnterpriseOnlineSkillResult[],
): EnterpriseOnlineSkillSearch {
  return { sources, results }
}

describe('online search: the query has exactly three tiers', () => {
  it('reads idle / too-short / ready off the trimmed length', () => {
    for (const empty of ['', '   ', '\t\n']) expect(enterpriseOnlineQueryState(empty), JSON.stringify(empty)).toBe('idle')
    for (const short of ['a', ' a ', '中']) expect(enterpriseOnlineQueryState(short), short).toBe('too-short')
    expect(enterpriseOnlineQueryState('ab')).toBe('ready')
    expect(enterpriseOnlineQueryState('  ab  ')).toBe('ready')
    // 门槛常量与那句人话同源（改一个不会漏改另一个）。
    expect(ENTERPRISE_ONLINE_TOO_SHORT).toContain(String(ENTERPRISE_ONLINE_QUERY_MIN))
    expect(ENTERPRISE_ONLINE_IDLE.length).toBeGreaterThan(0)
  })
})

describe('online search: the two kinds of bad news are never merged', () => {
  it('says "this source was not fetched" and "N results were dropped" as two different lines, each naming the source', () => {
    const notes = enterpriseOnlineSourceNotes([
      source({ id: 'skills.sh', ok: false }),
      source({ id: 'claude-plugins.dev', ok: true, dropped: 3 }),
      // 这个源一切正常 ⇒ **不出任何一行**（成功不报喜、页面不加噪音）。
      source({ id: 'clawhub.ai', ok: true }),
    ])
    expect(notes.map(note => note.kind)).toEqual(['failed', 'dropped'])
    expect(notes.map(note => note.id)).toEqual(['skills.sh', 'claude-plugins.dev'])
    // 两句必须**不同**，且各自带上源名与自己的原因（混成一句「部分失败」就是把真话丢了）。
    expect(notes[0]!.text).not.toBe(notes[1]!.text)
    expect(notes[0]!.text).toContain('skills.sh')
    expect(notes[0]!.text).toContain('没有取到')
    expect(notes[1]!.text).toContain('claude-plugins.dev')
    expect(notes[1]!.text).toContain('3 条')
    expect(notes[1]!.text).toContain('不提供可安装的来源')
    // 两句话里都不许出现裸码，也不许出现「部分失败」这种把三件事糊成一句的说法。
    for (const note of notes) {
      expect(note.text).not.toContain('ENT_')
      expect(note.text).not.toContain('部分失败')
    }
    // 一个 ok、也没有 dropped 的源集合 ⇒ 零行。
    expect(enterpriseOnlineSourceNotes([source()])).toEqual([])
    expect(enterpriseOnlineSourceNotes([])).toEqual([])
  })
})

describe('online search: one result becomes one honest row', () => {
  it('always names the source and draws author / stars / installs only when the Host gave them', () => {
    const bare = enterpriseOnlineResultRow(result())
    expect(bare.note).toBe(`${ENTERPRISE_ONLINE_SOURCE_PREFIX}skills.sh`)
    expect(bare.description).toBeUndefined()
    expect(bare.installSource).toBe('skills.sh:owner/repo/code-review')
    // 没装过 ⇒ 那一行照旧画动作按钮（`installed` 为假是**默认**，不是「不知道」）。
    expect(bare.installed).toBe(false)
    const full = enterpriseOnlineResultRow(result({
      description: '把代码审查规则带进新会话。',
      author: 'acme',
      stars: 1200,
      installs: 3400,
    }))
    // 两枚计数走**千分位**（真机上到过 963199）：口径在 `display-format.formatCount` 一处。
    expect(full.note).toBe([
      `${ENTERPRISE_ONLINE_SOURCE_PREFIX}skills.sh`,
      `${ENTERPRISE_ONLINE_AUTHOR_PREFIX}acme`,
      `${ENTERPRISE_ONLINE_STARS_PREFIX}1,200`,
      `${ENTERPRISE_ONLINE_INSTALLS_PREFIX}3,400`,
    ].join(' · '))
    expect(full.description).toBe('把代码审查规则带进新会话。')
    // 计数 0 也是**给定的事实**（与服务端缺席不同）：0 要照画，不能与「没有这个字段」混。
    const zero = enterpriseOnlineResultRow(result({ stars: 0 }))
    expect(zero.note).toContain(`${ENTERPRISE_ONLINE_STARS_PREFIX}0`)
  })
})

describe('online search: the count, the ready announcement and the installed state are projections', () => {
  it('keeps the result count absent at zero, and gives the ready announcement its own sentence', () => {
    // 零结果**整枚缺席**：不说「0 条结果」，也不再叠一句「没有搜索结果」——
    // 那句空话（`ENTERPRISE_ONLINE_EMPTY`）已经把结论与下一步都说了，同屏两句同义话只是噪音。
    expect(enterpriseOnlineCountText(0)).toBeUndefined()
    expect(enterpriseOnlineCountText(1)).toBe('1 条结果')
    expect(enterpriseOnlineCountText(110)).toBe('110 条结果')
    expect(enterpriseOnlineReadyText(110)).toBe('找到 110 条结果。')
    for (const text of [enterpriseOnlineCountText(7), enterpriseOnlineReadyText(7)]) {
      expect(String(text), String(text)).not.toContain('ENT_')
    }
    // 节名与页名**逐字不同**：同屏不许把页名再说一遍，两个 landmark 也不许同名。
    expect(ENTERPRISE_ONLINE_RESULTS_TITLE).not.toBe(ENTERPRISE_ONLINE_TITLE)
    expect(ENTERPRISE_ONLINE_RESULTS_TITLE.length).toBeGreaterThan(0)
  })

  it('marks a row installed only from the coordinates the caller hands in, never optimistically', () => {
    const value = search([source()], [
      result(),
      result({ name: 'meeting-notes', installSource: 'skills.sh:owner/repo/meeting-notes' }),
    ])
    expect(enterpriseOnlineFace({ kind: 'ready', value }, 'code').rows.map(row => row.installed))
      .toEqual([false, false])
    expect(enterpriseOnlineFace({ kind: 'ready', value }, 'code', ['skills.sh:owner/repo/code-review'])
      .rows.map(row => row.installed)).toEqual([true, false])
    // 判据是**坐标**，不是技能名：同名不同坐标是两条不同的结果，不能被名字误命中。
    expect(enterpriseOnlineFace({ kind: 'ready', value }, 'code', ['code-review'])
      .rows.map(row => row.installed)).toEqual([false, false])
    // 行上那枚状态词是既定文案（界面不许自己拼一个「已安装」之类的近义词）。
    expect(ENTERPRISE_ONLINE_INSTALLED).toBe('已装')
  })
})

describe('online search: the face follows the query tier first, then the four fetch states', () => {
  const value = search([source({ id: 'skills.sh', ok: false })], [result()])

  it('shows the tier sentence (idle / too short) and never the previous results', () => {
    // 有真值，但查询不足门槛 ⇒ **看档位**：不铺那一批已经不对应的旧结果。
    expect(enterpriseOnlineFace({ kind: 'ready', value }, '')).toEqual({ kind: 'idle', notes: [], rows: [] })
    expect(enterpriseOnlineFace({ kind: 'ready', value }, 'a')).toEqual({ kind: 'too-short', notes: [], rows: [] })
    expect(ENTERPRISE_ONLINE_LOADING.length).toBeGreaterThan(0)
  })

  it('maps loading / failed / ready / empty once the query is usable', () => {
    expect(enterpriseOnlineFace({ kind: 'loading' }, 'code')).toEqual({ kind: 'loading', notes: [], rows: [] })
    expect(enterpriseOnlineFace({ kind: 'failed', code: 'ENT_SKILL_SOURCE_UNREACHABLE' }, 'code'))
      .toEqual({ kind: 'failed', failedCode: 'ENT_SKILL_SOURCE_UNREACHABLE', notes: [], rows: [] })
    const ready = enterpriseOnlineFace({ kind: 'ready', value }, 'code')
    expect(ready.kind).toBe('ready')
    expect(ready.rows.map(row => row.name)).toEqual(['code-review'])
    // 逐源那句坏消息**在就绪档也照铺**（`ok:false` 是这次取数结果的一部分）。
    expect(ready.notes.map(note => note.kind)).toEqual(['failed'])
    expect(ready.emptyNote).toBeUndefined()
    // 零结果：仍是就绪（逐源那句照铺），另补一句人话。
    const empty = enterpriseOnlineFace({ kind: 'empty', value: search([source()], []) }, 'code')
    expect(empty.kind).toBe('ready')
    expect(empty.rows).toEqual([])
    expect(empty.emptyNote).toBe(ENTERPRISE_ONLINE_EMPTY)
  })

  it('keeps the install affordance readable', () => {
    expect(ENTERPRISE_ONLINE_INSTALL).toBe('安装')
    expect(ENTERPRISE_ONLINE_INSTALLING).toBe('正在安装…')
    expect(enterpriseOnlineInstallingText('code-review')).toBe(`正在安装「code-review」…${ENTERPRISE_ONLINE_INSTALL_BUSY_SUFFIX}`)
    expect(enterpriseOnlineInstalledText('code-review')).toBe('已安装「code-review」。')
    for (const text of [enterpriseOnlineInstallingText('x'), enterpriseOnlineInstalledText('x')]) {
      expect(text).not.toContain('ENT_')
    }
  })
})

describe('online installation: three new codes with three different next steps', () => {
  const codes = ['ENT_SKILL_SOURCE_UNKNOWN', 'ENT_SKILL_SOURCE_UNREACHABLE', 'ENT_SKILL_SOURCE_TOO_LARGE'] as const

  it('keeps every source code in the one table with a distinct, executable step', () => {
    for (const code of codes) {
      expect(ENTERPRISE_ERROR_CODES, code).toContain(code)
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
    }
    const actions = codes.map(enterpriseErrorAction)
    expect(new Set(actions).size).toBe(codes.length)
    // 「源取不到」是瞬时态（同一份坐标再试可能就通了）；另两枚是终态（同一份坐标再取一次还是那样）。
    expect(enterpriseErrorPresentation('ENT_SKILL_SOURCE_UNREACHABLE').retryable).toBe(true)
    expect(enterpriseErrorPresentation('ENT_SKILL_SOURCE_UNKNOWN').retryable).toBe(false)
    expect(enterpriseErrorPresentation('ENT_SKILL_SOURCE_TOO_LARGE').retryable).toBe(false)
  })

  it('gives the online-install flow its own next step where the default one would be wrong', () => {
    // 默认流（中心安装）那三句里含「重新下载 / 重新导入 / 联系企业管理员重新发布」——
    // 在**在线安装**流下都说不通（包在第三方仓库、由本机替用户取，企业管理员也管不着那份技能）。
    for (const code of ['ENT_SKILL_ARCHIVE_INVALID', 'ENT_SKILL_SKILLMD_INVALID', 'ENT_SKILL_INSTALL_FAILED']) {
      const online = enterpriseErrorActionIn(code, 'online-install')
      expect(online, code).not.toBe(enterpriseErrorAction(code))
      expect(online, code).not.toContain('重新下载')
      expect(online.endsWith('。'), code).toBe(true)
      expect(online, code).not.toContain('ENT_')
    }
    // 在线流的下一步都得是**能做的事**：换一条结果 / 换一个来源 / 重试。
    expect(enterpriseErrorActionIn('ENT_SKILL_ARCHIVE_INVALID', 'online-install')).toContain('换一条搜索结果')
    expect(enterpriseErrorActionIn('ENT_SKILL_SKILLMD_INVALID', 'online-install')).toContain('发布方')
    expect(enterpriseErrorActionIn('ENT_SKILL_INSTALL_FAILED', 'online-install')).toContain('重试')
    // 流值清单是唯一的（新增流必须同时进它）；两枚流值都在。
    expect([...ENTERPRISE_ERROR_FLOWS].sort()).toEqual(['local-upload', 'online-install'])
  })
})
