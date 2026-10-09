/**
 * [INPUT]: 依赖 error-messages 的唯一码 → 人话映射（含兜底）、error-notice 的「技术信息」钩子常量，以及 src 下全部界面源码里的 `ENT_*` 字面量
 * [OUTPUT]: 验证映射是**纯投影**且处处一致：逐码给出非空的「发生了什么 + 下一步」、文案里不出现裸码、未映射/空串/畸形形状一律落兜底人话、码原样保留可取；并锁死「ui src 里出现的每个码都在唯一映射里」 **本刀（企业插件真取消）**：码清单加 `ENT_PLUGIN_INSTALL_CANCELLED`（并逐字锁它的文案与 `retryable: true`） **本刀（在线搜索，+1 条）**：码清单加三枚在线来源码，并把「逐流逐句都成立」那条判据从**单流**扩到
 *   遍历 `ENTERPRISE_ERROR_FLOWS`（`'local-upload'` + 本刀新增的 `'online-install'`），
 *   同时锁住在线安装流下不许出现「重新下载 / 重新发布」这两句做不到的动作。
 *   **本刀（通过 Agent 创建，+1 条）**：码清单加两枚本机动作码（开新会话失败 / 复制草稿失败），并逐字锁
 *   「两枚的下一步互不相同」。**本刀（系统搜索，+2 条）**：码清单加三枚纳入码（并锁它们的下一步**互不相同**与终态/瞬时的划分），
 *   并把「同名冲突跨三条流但**只有一句话**」写成机械判据（谁想给它加流专属表述，这条会先红）。
 *   **本刀（口径 51，+1 条）**：码清单加 `ENT_ESC_MY_EXPERTS_UNAVAILABLE`（专家页「我的专家」子页：
 *   本部署的只读闭集里没有这条接口 ⇒ 子页内容区在所有 tab／分段组合下都是同一份如实交代），
 *   并逐字锁它的人话、下一步与 `retryable: false`（与"预填没走成"那枚 `ENT_ESC_DRAFT_UNAVAILABLE`
 *   刻意不同值：一枚是部署没有这个端点、一枚是本机动作这一次没成）。
 *   **本刀（本地导入，+1 条）**：码清单加四枚上传通路的码（`ENT_SKILL_UPLOAD_{TOO_LARGE,INVALID,FAILED}` + `ENT_SKILL_SKILLMD_INVALID`），并新增「**跨流码的按流下一步**」判据——逐码逐流（`local-upload`）审第二句的完整性与「本地上传流下不许出现『重新下载』」，且按流取值在不传流时与默认取值**逐字相同**
 * [POS]: 失败自愈的机械门禁——宪法「禁止把技术码砸给用户」与「一处定义、处处复用」的可执行版本
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  ENTERPRISE_ERROR_ACTIONS,
  ENTERPRISE_ERROR_CODES,
  ENTERPRISE_ESC_DRAFT_FAILED_CODE,
  ENTERPRISE_ERROR_FALLBACK_ACTION,
  ENTERPRISE_ERROR_FALLBACK_MESSAGE,
  ENTERPRISE_ERROR_FLOWS,
  enterpriseErrorAction,
  enterpriseErrorActionIn,
  enterpriseErrorMessage,
  enterpriseErrorPresentation,
  enterpriseErrorRetryable,
} from '../src/error-messages.js'
import { ENTERPRISE_ERROR_TECH_ATTR, ENTERPRISE_ERROR_TECH_CONTAINER_ATTR, ENTERPRISE_ERROR_TECH_SUMMARY } from '../src/error-notice.js'

/** 员工侧可达的码族（技能 / 插件 / 配方 / 账号 / 反馈 / 品牌 / 更新 / 会话）必须逐个在表里。 */
const REQUIRED_CODES = [
  // 技能链（bundle/skill-errors.ts 的全集 + 只读正文两枚）
  'ENT_SKILL_DOWNLOAD_FAILED', 'ENT_SKILL_SIZE_MISMATCH', 'ENT_SKILL_HASH_MISMATCH', 'ENT_SKILL_ARCHIVE_INVALID',
  'ENT_SKILL_PACKAGE_MISMATCH', 'ENT_SKILL_INVALID_PACKAGE', 'ENT_SKILL_NAME_CONFLICT', 'ENT_SKILL_STATE_INVALID',
  'ENT_SKILL_INSTALL_FAILED', 'ENT_SKILL_CONTENT_TOO_LARGE', 'ENT_SKILL_CONTENT_INVALID', 'ENT_SKILL_TOO_LARGE',
  'ENT_SKILL_NOT_PUBLISHED', 'ENT_SKILL_VISIBILITY_DENIED',
  // **本刀（本地导入）**：本地上传那条通路的四枚码（三枚上传码 + `SKILL.md` frontmatter 闸门那一枚）。
  'ENT_SKILL_UPLOAD_TOO_LARGE', 'ENT_SKILL_UPLOAD_INVALID', 'ENT_SKILL_UPLOAD_FAILED', 'ENT_SKILL_SKILLMD_INVALID',
  // **本刀（系统搜索 → 纳入）**：纳入那条通路的三枚码。
  'ENT_SKILL_DISCOVERY_UNKNOWN', 'ENT_SKILL_ALREADY_REGISTERED', 'ENT_SKILL_ADOPT_FAILED',
  // **本刀（通过 Agent 创建）**：那两项本机动作码（开新会话失败 / 复制草稿失败）。
  'ENT_SKILL_CREATE_LAUNCH_FAILED', 'ENT_SKILL_CREATE_COPY_FAILED',
  /**
   * ★**口径 49**：esc 技能页主按钮下拉里「查找技能 / 创建技能」预填失败那一枚。
   *
   * 它是**本机动作**（跳新会话 + `setDraft`），与"平台目录"无关，故**不属于** esc 那三枚
   * 「这一版部署没有这个端点」族（那三枚下一步是找管理员、`retryable: false`）；
   * 这一枚的下一步是"自己新建会话把这句话贴进去"，人话与下一步都必须与那三枚不同。
   */
  'ENT_ESC_DRAFT_UNAVAILABLE',
  /**
   * ★**口径 51**：专家页「我的专家」子页那枚（本部署的只读闭集里没有"我的专家"这条接口）。
   *
   * 它与上面那枚同族但**不是同一件事**：那一枚是"这一次预填没走成"（本机动作），
   * 这一枚是"这台部署没有这个端点"（部署事实、终态）——故两枚各自留着，且都必须 `retryable: false`。
   */
  'ENT_ESC_MY_EXPERTS_UNAVAILABLE',
  // **本刀（在线搜索 → 安装）**：三枚在线来源码。
  'ENT_SKILL_SOURCE_UNKNOWN', 'ENT_SKILL_SOURCE_UNREACHABLE', 'ENT_SKILL_SOURCE_TOO_LARGE',
  // 插件链
  'ENT_PLUGIN_DOWNLOAD_FAILED', 'ENT_PLUGIN_HASH_MISMATCH', 'ENT_PLUGIN_SIZE_MISMATCH', 'ENT_PLUGIN_ARTIFACT_INVALID',
  'ENT_PLUGIN_ARCHIVE_TOO_LARGE', 'ENT_PLUGIN_SIGNATURE_INVALID', 'ENT_PLUGIN_INCOMPATIBLE', 'ENT_PLUGIN_BUSY',
  'ENT_PLUGIN_CLI_FAILED', 'ENT_PLUGIN_COMMAND_FAILED', 'ENT_PLUGIN_LOADER_INACTIVE', 'ENT_PLUGIN_STATE_INVALID',
  'ENT_PLUGIN_NOT_ASSIGNED', 'ENT_PLUGIN_CORE_PROTECTED',
  // 取消在途安装（员工自己按下的取消**不是**失败：本机什么都没变 ⇒ 下一步就是再试一次）
  'ENT_PLUGIN_INSTALL_CANCELLED',
  // 配方
  'ENT_PRESET_INVALID_PACKAGE', 'ENT_PRESET_NOT_PUBLISHED', 'ENT_PRESET_TOO_LARGE', 'ENT_PRESET_VISIBILITY_DENIED',
  // 本地路由 / 会话 / 账号 / 反馈 / 品牌 / 更新
  'ENT_LOCAL_UNAVAILABLE', 'ENT_LOCAL_RESPONSE_INVALID', 'ENT_PLATFORM_UNAVAILABLE', 'ENT_RESOURCE_NOT_FOUND',
  'ENT_PERMISSION_DENIED', 'ENT_AUTH_REQUIRED', 'ENT_AUTH_SESSION_EXPIRED', 'ENT_AUTH_TIMEOUT', 'ENT_DEVICE_REVOKED',
  'ENT_FEEDBACK_INVALID', 'ENT_FEEDBACK_ATTACHMENT_INVALID', 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE',
  'ENT_BRANDING_ASSET_INVALID', 'ENT_BRANDING_ASSET_TOO_LARGE',
  'ENT_ARTIFACT_INTEGRITY_FAILED', 'ENT_ARTIFACT_UNSIGNED', 'ENT_ARTIFACT_CORE_PACKAGE',
  'ENT_INVALID_ACCOUNT_ORIGIN', 'ENT_ACCOUNT_ORIGIN_WRITE_FAILED', 'ENT_ACCOUNT_REMOUNT_FAILED',
] as const

describe('enterprise error vocabulary (single projection)', () => {
  it('keeps every employee-reachable code in the one and only table', () => {
    for (const code of REQUIRED_CODES) {
      expect(ENTERPRISE_ERROR_CODES, code).toContain(code)
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
    }
    // 表里没有重复项（Map 语义靠唯一性成立）。
    expect(new Set(ENTERPRISE_ERROR_CODES).size).toBe(ENTERPRISE_ERROR_CODES.length)
  })

  it('gives every mapped code a non-empty human message and an explicit next step', () => {
    for (const code of ENTERPRISE_ERROR_CODES) {
      const view = enterpriseErrorPresentation(code)
      expect(view.message.length, code).toBeGreaterThan(0)
      expect(view.action.length, code).toBeGreaterThan(0)
      expect(view.code, code).toBe(code)
      expect(view.known, code).toBe(true)
      // 人话里**绝不**出现裸码（码只在「技术信息」里）。
      expect(view.message, code).not.toContain('ENT_')
      expect(view.action, code).not.toContain('ENT_')
      // 下一步动作以动词/祈使句结尾的句号收束，读得出「我现在能做什么」。
      expect(view.action.endsWith('。'), code).toBe(true)
      expect(typeof view.retryable, code).toBe('boolean')
    }
    // 取消在途安装那一枚：员工自己按下的取消**不是**失败（Host 已把记录回到安装前），
    // 故文案就是「这次安装被取消了。请重试。」——人话 + 下一步，且按语义可重试。
    expect(enterpriseErrorMessage('ENT_PLUGIN_INSTALL_CANCELLED')).toBe('这次安装被取消了。')
    expect(enterpriseErrorAction('ENT_PLUGIN_INSTALL_CANCELLED')).toBe('请重试。')
    expect(enterpriseErrorRetryable('ENT_PLUGIN_INSTALL_CANCELLED')).toBe(true)
  })

  it('keeps the same sentence per code no matter which accessor is used', () => {
    for (const code of ENTERPRISE_ERROR_CODES) {
      const view = enterpriseErrorPresentation(code)
      expect(enterpriseErrorMessage(code), code).toBe(view.message)
      expect(enterpriseErrorAction(code), code).toBe(view.action)
      expect(enterpriseErrorRetryable(code), code).toBe(view.retryable)
      // 不传流时「按流取值」与默认取值**逐字相同**（既有入口一个字节都不变）。
      expect(enterpriseErrorActionIn(code), code).toBe(view.action)
    }
  })

  /**
   * **本刀（本地导入）：跨流码的按流下一步**。
   *
   * 第③条口径（一个码一句话）挡的是**同一条流内**各写一套；而有的码真的跨了两条流、两条流的下一步
   * 不同 —— 只有这种码才允许有第二句（`actions`）。这条用例逐码逐流地把第二句也审一遍，并**自证**
   * 表里确实存在这样的码（否则这条会退化成永真）。
   */
  it('keeps every flow-specific next step as complete as the default one', () => {
    let crossFlow = 0
    for (const code of ENTERPRISE_ERROR_CODES) {
      for (const flow of ENTERPRISE_ERROR_FLOWS) {
        const scoped = enterpriseErrorActionIn(code, flow)
        expect(scoped.length, `${code}/${flow}`).toBeGreaterThan(0)
        expect(scoped.endsWith('。'), `${code}/${flow}`).toBe(true)
        expect(scoped, `${code}/${flow}`).not.toContain('ENT_')
        if (scoped === enterpriseErrorAction(code)) continue
        crossFlow += 1
        // 本地上传流里技能包就是员工手里那份文件 ⇒ 这一流下**不许**出现「重新下载」这个做不到的动作；
        // 在线安装流同理（包在第三方仓库里、由本机替用户取，「请重新下载 / 联系企业管理员重新发布」都说不通）。
        expect(scoped, `${code}/${flow}`).not.toContain('重新下载')
        expect(scoped, `${code}/${flow}`).not.toContain('重新发布')
      }
    }
    expect(crossFlow).toBeGreaterThan(0)
    // 那一枚真实存在的跨流码：中心下载安装流那句原样保留（既有入口零改动）。
    expect(enterpriseErrorAction('ENT_SKILL_ARCHIVE_INVALID')).toBe('请重新下载；仍然失败请联系企业管理员重新发布。')
    expect(enterpriseErrorActionIn('ENT_SKILL_ARCHIVE_INVALID', 'local-upload')).toContain('重新选择')
  })

  /**
   * **本刀（口径 51）**：「我的专家」子页那枚部署缺失码——**人话 + 下一步 + 终态**三件都要对，
   * 且它与「预填没走成」那枚（同族、同为 esc 页的失败）**不是同一句话**：
   * 一枚说"这台部署没有这个端点"（找管理员），一枚说"这次没把话填进去"（自己新建会话粘贴）。
   */
  it('keeps the my-experts deployment gap apart from the draft miss, both terminal', () => {
    const gap = 'ENT_ESC_MY_EXPERTS_UNAVAILABLE'
    expect(ENTERPRISE_ERROR_CODES).toContain(gap)
    const view = enterpriseErrorPresentation(gap)
    expect(view.known).toBe(true)
    expect(view.message).toContain('我的专家')
    expect(view.message).not.toContain('ENT_')
    expect(view.action).not.toContain('ENT_')
    // 终态：对"端点不存在"重试永远无效（与那四枚 ENT_ESC_*_UNAVAILABLE 逐条同判）。
    expect(view.retryable).toBe(false)
    expect(enterpriseErrorRetryable(gap)).toBe(false)
    // 与「预填没走成」那枚**逐字不同**（人话与下一步都不同值）：两件事的补救动作本来就不同。
    const draft = enterpriseErrorPresentation(ENTERPRISE_ESC_DRAFT_FAILED_CODE)
    expect(view.message).not.toBe(draft.message)
    expect(view.action).not.toBe(draft.action)
    // 它属于"部署缺端点"那一族：下一步必须是"找管理员确认部署版本"，不是"再试一次"。
    expect(view.action).toContain('企业管理员')
  })

  it('falls back to a human sentence for unmapped, malformed, empty and missing codes', () => {
    for (const unknown of ['ENT_SOMETHING_NEW', 'ENT_X', 'NOT_A_CODE', '<img src=x onerror=alert(1)>', '', '   ', undefined, null]) {
      const view = enterpriseErrorPresentation(unknown)
      expect(view.known, String(unknown)).toBe(false)
      expect(view.message, String(unknown)).toBe(ENTERPRISE_ERROR_FALLBACK_MESSAGE)
      expect(view.action, String(unknown)).toBe(ENTERPRISE_ERROR_FALLBACK_ACTION)
      expect(view.message).not.toContain('ENT_')
      expect(view.action).not.toContain('ENT_')
      // 码本身不被吞掉：受控形状原样回传，畸形形状归一成空串（界面也不回显它）。
      expect(view.code, String(unknown)).toBe(typeof unknown === 'string' ? unknown.trim() : '')
    }
    // 兜底也是「可重试」的那一档（未知失败的默认建议：再试一次，仍然失败找人）。
    expect(enterpriseErrorRetryable('ENT_SOMETHING_NEW')).toBe(true)
  })

  it('marks terminal failures as non-retryable (no retry drawn on a sure-to-fail path)', () => {
    for (const terminal of [
      'ENT_SKILL_HASH_MISMATCH', 'ENT_SKILL_ARCHIVE_INVALID', 'ENT_SKILL_CONTENT_TOO_LARGE', 'ENT_SKILL_CONTENT_INVALID',
      'ENT_PLUGIN_INCOMPATIBLE', 'ENT_PERMISSION_DENIED', 'ENT_RESOURCE_NOT_FOUND', 'ENT_AUTH_REQUIRED',
    ]) {
      expect(enterpriseErrorRetryable(terminal), terminal).toBe(false)
    }
    for (const transient of [
      'ENT_PLATFORM_UNAVAILABLE', 'ENT_LOCAL_UNAVAILABLE', 'ENT_NETWORK_ERROR', 'ENT_PLUGIN_BUSY',
      'ENT_SKILL_DOWNLOAD_FAILED', 'ENT_SKILL_INSTALL_FAILED', 'ENT_UPSTREAM_TIMEOUT',
      'ENT_PLUGIN_INSTALL_CANCELLED',
    ]) {
      expect(enterpriseErrorRetryable(transient), transient).toBe(true)
    }
  })

  it('exposes the raw code only through the dedicated technical-info hooks', () => {
    // 码要「仍可取到」：技术信息钩子是唯一的取证点（界面把它折叠在「技术信息」里）。
    expect(ENTERPRISE_ERROR_TECH_ATTR).toBe('data-enterprise-error-code')
    expect(ENTERPRISE_ERROR_TECH_CONTAINER_ATTR).toBe('data-enterprise-error-tech')
    expect(ENTERPRISE_ERROR_TECH_SUMMARY).toBe('技术信息')
    expect(ENTERPRISE_ERROR_ACTIONS.retry).toBe('重试')
    expect(ENTERPRISE_ERROR_ACTIONS.login).toBe('去登录')
    expect(ENTERPRISE_ERROR_ACTIONS.admin).toBe('联系企业管理员')
  })

  /**
   * **本刀（系统搜索 → 纳入）**：纳入三枚码的下一步**各不相同**（这是它们存在的理由），
   * 且终态/瞬时的划分与「同一输入再试有没有意义」一致。
   */
  it('keeps the adopt vocabulary distinct, with one executable next step each', () => {
    const codes = ['ENT_SKILL_DISCOVERY_UNKNOWN', 'ENT_SKILL_ALREADY_REGISTERED', 'ENT_SKILL_ADOPT_FAILED'] as const
    for (const code of codes) {
      expect(ENTERPRISE_ERROR_CODES, code).toContain(code)
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
    }
    // 三句话各不相同：找不到 → 重新搜索；已登记 → 回列表刷新；完不成 → 重试。
    expect(new Set(codes.map(enterpriseErrorAction)).size).toBe(codes.length)
    // 404（这份 path 再发一次必然还是 404）与 409（本机没坏，只是已经登记）都不是「再试一次」能解决的；
    // 500（读盘/写盘的瞬时失败，或目录太大）重试有意义。
    expect(enterpriseErrorRetryable('ENT_SKILL_DISCOVERY_UNKNOWN')).toBe(false)
    expect(enterpriseErrorRetryable('ENT_SKILL_ALREADY_REGISTERED')).toBe(false)
    expect(enterpriseErrorRetryable('ENT_SKILL_ADOPT_FAILED')).toBe(true)
  })

  /**
   * **同名冲突现在是三条流共用的一个码**（中心安装 / 本地上传 / 系统搜索纳入）。
   *
   * 三条流的下一步**真的是同一件**事（先试卸载，卸不掉就请管理员清），故这个码**不**留流专属表述——
   * 一句话对三条流都成立。谁将来想给它加 `actions`，这条会先红，逼他把理由写清楚。
   */
  it('keeps the same-name conflict one executable sentence in every flow', () => {
    const action = enterpriseErrorAction('ENT_SKILL_NAME_CONFLICT')
    for (const flow of [undefined, 'local-upload'] as const) {
      expect(enterpriseErrorActionIn('ENT_SKILL_NAME_CONFLICT', flow)).toBe(action)
    }
    // 改前那句「请先卸载同名技能，再重试安装。」指向今天做不到的动作（自装的那份没有卸载面）。
    expect(action).not.toBe('请先卸载同名技能，再重试安装。')
    expect(action).toContain('无法卸载')
    expect(action).toContain('企业管理员')
  })

  /**
   * **本刀（通过 Agent 创建）**：两枚本机动作码的下一步**必须不同**（否则没必要分两枚）——
   * 开新会话失败往「把指令复制走」走，剪贴板失败往「检查权限后重试」走。
   */
  it('keeps the two agent-creation action codes apart, each with its own executable step', () => {
    const launch = enterpriseErrorAction('ENT_SKILL_CREATE_LAUNCH_FAILED')
    const copy = enterpriseErrorAction('ENT_SKILL_CREATE_COPY_FAILED')
    for (const code of ['ENT_SKILL_CREATE_LAUNCH_FAILED', 'ENT_SKILL_CREATE_COPY_FAILED']) {
      expect(ENTERPRISE_ERROR_CODES, code).toContain(code)
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
      // 两枚码都不带预设/配方字样：它们只属于这一条通路，出现在技术信息里不该指向别的功能。
      expect(code).not.toContain('PRESET')
    }
    expect(launch).not.toBe(copy)
    expect(launch).toContain('复制')
    expect(copy).toContain('剪贴板权限')
  })

  /**
   * **本刀（在线搜索 → 安装）**：三枚来源码**各说各的下一步**（换一条结果 / 检查网络重试 / 换一条更小的），
   * 且三枚既有跨流码在 `'online-install'` 流下取到的是**这一流说得通**的那句（默认句里的「重新下载 /
   * 联系企业管理员重新发布」在在线安装下不成立：包在第三方仓库、由本机替用户取）。
   */
  it('keeps the online source codes and the online-install flow apart', () => {
    const codes = ['ENT_SKILL_SOURCE_UNKNOWN', 'ENT_SKILL_SOURCE_UNREACHABLE', 'ENT_SKILL_SOURCE_TOO_LARGE'] as const
    for (const code of codes) {
      expect(ENTERPRISE_ERROR_CODES, code).toContain(code)
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
      expect(enterpriseErrorActionIn(code, 'online-install'), code).toBe(enterpriseErrorAction(code))
    }
    // 下一步三句互不相同（这是分三枚码的理由）。
    expect(new Set(codes.map(enterpriseErrorAction)).size).toBe(codes.length)
    // 跨流那三枚：在线安装流下有自己那句，且都不含做不到的动作。
    for (const code of ['ENT_SKILL_ARCHIVE_INVALID', 'ENT_SKILL_SKILLMD_INVALID', 'ENT_SKILL_INSTALL_FAILED']) {
      const online = enterpriseErrorActionIn(code, 'online-install')
      expect(online, code).not.toBe(enterpriseErrorAction(code))
      expect(online, code).not.toContain('重新下载')
      expect(online, code).not.toContain('重新发布')
    }
    // 流值清单是唯一真源：两枚都在、且没有第三个。
    expect([...ENTERPRISE_ERROR_FLOWS].sort()).toEqual(['local-upload', 'online-install'])
  })

  it('keeps every ENT_ code that appears in the ui sources inside the single table', async () => {
    const names = (await readdir(new URL('../src/', import.meta.url))).filter(name => /\.tsx?$/.test(name))
    expect(names.length).toBeGreaterThan(0)
    const found = new Set<string>()
    for (const name of names) {
      const source = await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')
      for (const match of source.matchAll(/'(ENT_[A-Z0-9_]+)'/g)) found.add(match[1]!)
    }
    expect(found.size).toBeGreaterThan(0)
    // ui 里出现的每个码都必须能被翻成人话——「一处定义、处处复用」的机械门禁。
    expect([...found].filter(code => !ENTERPRISE_ERROR_CODES.includes(code))).toEqual([])
  })
})
