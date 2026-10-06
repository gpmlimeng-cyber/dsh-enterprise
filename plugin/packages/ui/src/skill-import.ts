/**
 * [INPUT]: 只依赖 `display-format` 的 `formatByteSize` 与自装记录的类型形状（不依赖 React、不依赖任何宿主 API）
 * [OUTPUT]: 对外提供「添加技能 → 本地导入」这一条通路的**纯事实层**：冻结的 accept 串与 50 MiB 上限
 *   （`ENTERPRISE_SKILL_IMPORT_ACCEPT` / `_MAX_BYTES` / `_MAX_TEXT`）、三枚上传码常量
 *   （`ENTERPRISE_SKILL_IMPORT_{TOO_LARGE,INVALID,FAILED}_CODE`，逐字与 Host 侧同值、且都在 error-messages 的唯一表里）、
 *   选择器与重选按钮的文案常量、状态机 `EnterpriseSkillImportState`（uploading / done / failed；**没有 idle 成员**——
 *   缺席即空闲）、纯预检 `enterpriseSkillImportRejectReason`、纯人话投影 `enterpriseSkillImportNotice`
 *   与自装记录 → 技能名集合的纯投影 `enterpriseSkillImportNames`
 * [POS]: dsh-ui 本地上传通路的事实与文案真源（页面只画、控制器只接线），真源是
 *   `docs/plan/skill-install-sources.md` §B.1（multipart 恰好一个 `artifact` part + 50 MiB 配额）与本刀冻结契约；
 *   **它与 `local-api.ts` 分工**：那边只管发与收（固定同源路径、严格解码复用既有 install 那一份），
 *   这边只管「选之前拦什么、选之后说什么」。故本文件里没有一次 fetch、没有一处 React、没有第二份错误码表。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { formatByteSize } from './display-format.js'
import type { EnterpriseSelfInstalledSkill } from './skill-api-decode.js'

/**
 * 文件选择器接受的文件类型（**冻结契约逐字**：`.dshskill` + 两个 zip 媒体类型）。
 *
 * 它是「浏览器这一侧先筛一遍」的便利（原生选择器按它过滤），**不是**任何安全判定：
 * 真正的闸门在 Host（ZIP 结构 → manifest → frontmatter 整包过），用户可以选「所有文件」绕开这里。
 */
export const ENTERPRISE_SKILL_IMPORT_ACCEPT = '.dshskill,application/vnd.dsh.skill+zip,application/zip'

/**
 * 本地上传的**独立配额**：50 MiB（与 Host 侧逐字同值，见 `platform-client/src/local-api.ts` 的
 * `MAX_SKILL_UPLOAD_BODY_BYTES` 与 bundle 侧制品上限）。
 *
 * ★ 它只用于**选文件那一刻的前端预检**（超限就地拦下、一个字节都不发出去）；Host 侧仍会独立再判一次——
 *   这个数**不是**信任边界，只是「别让用户白等一次注定失败的上传」。
 */
export const ENTERPRISE_SKILL_IMPORT_MAX_BYTES = 52_428_800

/** 上面那个上限的**人话形态**（写进错误动作里；与字节常量同源，由用例双向绑定，不许各写一份）。 */
export const ENTERPRISE_SKILL_IMPORT_MAX_TEXT = '50 MiB'

/** 前端尺寸预检那枚码（冻结契约：超限即拦，且给这个稳定码）。 */
export const ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE = 'ENT_SKILL_UPLOAD_TOO_LARGE'
/** Host 侧「multipart 形状不对 / 空制品」那枚码（前端不重判内容，只在反馈里如实转述它）。 */
export const ENTERPRISE_SKILL_IMPORT_INVALID_CODE = 'ENT_SKILL_UPLOAD_INVALID'
/** Host 侧「落盘/落点失败」那枚码。 */
export const ENTERPRISE_SKILL_IMPORT_FAILED_CODE = 'ENT_SKILL_UPLOAD_FAILED'

/**
 * 文件选择器的无障碍名。
 *
 * 这个 `<input type="file">` 恒不可见（原生样式不参与产品版面，故用行内 `display:none` 收起、
 * 不新增任何 CSS 类）——它平时不可聚焦，读屏只在**脚本点开**那一刻经它的无障碍名说出「现在要选什么」。
 */
export const ENTERPRISE_SKILL_IMPORT_INPUT_LABEL = '选择要导入的技能包文件'

/** 失败后那枚「重新选择文件」的可见文案（上传失败的正确下一步**不是**原地重发同一份字节）。 */
export const ENTERPRISE_SKILL_IMPORT_RESELECT = '重新选择文件'
/** 上面那枚按钮的完整无障碍名（可见文案在按钮上，读屏要听到完整动作）。 */
export const ENTERPRISE_SKILL_IMPORT_RESELECT_LABEL = '重新选择要导入的技能包文件'

/** 进展那句话的动词（与「已导入」成对；两句都由本文件唯一产出）。 */
export const ENTERPRISE_SKILL_IMPORT_UPLOADING = '正在导入'
/** 成功那句话的动词。 */
export const ENTERPRISE_SKILL_IMPORT_DONE = '已导入'
/** 失败那句的动词——它不是独立一句话，而是 `EnterpriseErrorNotice` 的**动作前缀**（人话接在它后面）。 */
export const ENTERPRISE_SKILL_IMPORT_FAILED = '导入'
/**
 * 自装清单读不到时补的那半句（**不是失败**：导入本身已经成功了，这只是「点不出技能名」）。
 *
 * 它必须可见——否则「装好了」与「装好了但我列不出名字」在界面上长得一模一样，那是把不确定性藏起来。
 */
export const ENTERPRISE_SKILL_IMPORT_UNLISTED = '本机自装技能清单暂时没有读取到。'
/** 技能名那句的前缀（后面跟名字，超过三枚时补「等 N 个」）。 */
export const ENTERPRISE_SKILL_IMPORT_NAMES_PREFIX = '装好的技能：'
/** 技能名最多列出几枚（再多的用「等 N 个」收束，免得一行反馈被 200 个目录名撑爆）。 */
export const ENTERPRISE_SKILL_IMPORT_NAMES_SHOWN = 3

/**
 * 本地导入的三态（**没有 `idle` 成员**：`undefined` 就是空闲——与 `skillActionError` / `presetStates`
 * 那几处同一条约定，安静的页面上不留一个「什么都不是」的状态对象）。
 *
 * 三态互斥且**覆盖整条通路**：选完文件先落 `uploading`（含文件名与大小——用户要能确认自己选对了哪一份），
 * 成功落 `done`（含「装好了哪几个技能」，缺失时如实说明为什么缺失），任何失败落 `failed`（稳定码）。
 */
export type EnterpriseSkillImportState =
  | {
    readonly kind: 'uploading'
    /** 用户选中的文件名（原样回显；它是**展示事实**，不参与任何路径构造）。 */
    readonly name: string
    readonly bytes: number
  }
  | {
    readonly kind: 'done'
    readonly name: string
    readonly bytes: number
    /** 这次装好的技能目录名（来自自装清单，按**用户原始文件名**精确匹配那一枚记录）。 */
    readonly names: readonly string[]
    /** 自装清单读到了没有（`false` ⇒ 上面那句 `ENTERPRISE_SKILL_IMPORT_UNLISTED` 必须出现）。 */
    readonly listed: boolean
  }
  | {
    readonly kind: 'failed'
    readonly name: string
    readonly bytes: number
    /** 稳定错误码：前端预检那一枚，或 Host 回的任意码（人话与下一步由 `error-messages.ts` 唯一映射给）。 */
    readonly code: string
  }

/**
 * 界面反馈的**唯一判定点**：状态机 → 一句可见反馈（或一段交给人话映射的失败）。
 *
 * 三种形态刻意分开（而不是一个「有 text 有 code」的大对象）：`busy`/`done` 说本文件自己的两句人话，
 * `failed` **一个字都不说人话**——它把码交出去，由 `EnterpriseErrorNotice` 去取唯一映射表里那句
 * 「发生了什么 + 下一步」。这样失败文案永远不会在本文件里长出第二份。
 *
 * @param state - 本地导入的当前状态（**不是** `undefined`：空闲时调用方整段不渲染）。
 * @returns `{kind:'busy'|'done', text}` 或 `{kind:'failed', code, prefix}`。
 */
export type EnterpriseSkillImportNotice =
  | { readonly kind: 'busy'; readonly text: string }
  | { readonly kind: 'done'; readonly text: string }
  | { readonly kind: 'failed'; readonly code: string; readonly prefix: string }

/** 文件名 + 大小那句共用的**唯一**拼法（三处反馈都从它出，不各拼一份）。 */
function importLabel(name: string, bytes: number): string {
  return `「${name}」（${formatByteSize(bytes)}）`
}

/**
 * 状态机 → 可见反馈（纯函数，无 React、无 I/O）。
 *
 * @param state - 本地导入的当前状态。
 * @returns 见 `EnterpriseSkillImportNotice`；`failed` 的 `prefix` 逐字给出「哪一份文件失败了」。
 */
export function enterpriseSkillImportNotice(state: EnterpriseSkillImportState): EnterpriseSkillImportNotice {
  const label = importLabel(state.name, state.bytes)
  if (state.kind === 'uploading') {
    return { kind: 'busy', text: `${ENTERPRISE_SKILL_IMPORT_UPLOADING}${label}…` }
  }
  if (state.kind === 'failed') {
    return { kind: 'failed', code: state.code, prefix: `${ENTERPRISE_SKILL_IMPORT_FAILED}${label}失败` }
  }
  const done = `${ENTERPRISE_SKILL_IMPORT_DONE}${label}。`
  // 自装清单没读到 ⇒ 如实补半句（导入成功这件事一个字不改）。
  if (!state.listed) return { kind: 'done', text: `${done}${ENTERPRISE_SKILL_IMPORT_UNLISTED}` }
  // 清单读到了、但里面没有这一次那一枚（例如同一个包重传、旧记录留着上次的文件名）⇒ 只报成功，不编名字。
  if (state.names.length === 0) return { kind: 'done', text: done }
  const shown = state.names.slice(0, ENTERPRISE_SKILL_IMPORT_NAMES_SHOWN).join('、')
  const rest = state.names.length > ENTERPRISE_SKILL_IMPORT_NAMES_SHOWN
    ? ` 等 ${state.names.length} 个`
    : ''
  return { kind: 'done', text: `${done}${ENTERPRISE_SKILL_IMPORT_NAMES_PREFIX}${shown}${rest}。` }
}

/**
 * 选文件那一刻的**前端预检**（唯一判定点）：只判一件事——大小超没超 50 MiB。
 *
 * ★ 为什么不在这里判别的东西（空文件 / 扩展名 / 内容像不像 zip）：那些判定**已经有权威实现**
 *   （Host 的闸门），在这边再猜一遍只会长出第二套规则、并在它猜错时把一份合法文件挡在门外。
 *   尺寸是唯一「前端知道得和 Host 一样准、且能在发请求前省掉一次注定失败的上传」的那一件事实。
 *
 * @param file - 只要 `name` 与 `size` 两件事实（`File` 天然满足；用例可以直接喂一个字面对象）。
 * @returns 超限 ⇒ 稳定码；否则 `undefined`（放行）。
 */
export function enterpriseSkillImportRejectReason(
  file: { readonly name: string; readonly size: number },
): string | undefined {
  return file.size > ENTERPRISE_SKILL_IMPORT_MAX_BYTES ? ENTERPRISE_SKILL_IMPORT_TOO_LARGE_CODE : undefined
}

/**
 * 「这次装好了哪几个技能」的**唯一**取法：在自装清单里按**用户原始文件名**精确匹配那一枚记录。
 *
 * ★ 为什么要读自装清单、而不能拿上传响应说事：上传响应与 `POST /skills/install` **逐字同形**，
 *   是**企业**已装清单——自装包没有中心雪花 id，**不在**那一份里（这正是 `/skills/self-installed`
 *   这条只读面存在的原因）。所以「装了什么」只能从自装清单读。
 * ★ 为什么按文件名匹配而不是「取最新那一枚」：`sourceInput` 是 Host 落盘的原样文件名（已去路径），
 *   它与用户这次选的文件名精确可比；而「最新」是猜——清单顺序不是契约，猜错就会把**上一个**技能的名字
 *   报成本次结果。匹配不上就返回空集合，界面只报成功、不编名字。
 *
 * @param records - `GET /skills/self-installed` 的投影（可能不含 `sourceInput`：不是所有 Host 都给）。
 * @param fileName - 用户这次选中的文件原名。
 * @returns 命中那枚记录的技能目录名集合；没有命中 ⇒ 空集合。
 */
export function enterpriseSkillImportNames(
  records: readonly EnterpriseSelfInstalledSkill[],
  fileName: string,
): readonly string[] {
  const hit = records.find(record => record.sourceInput === fileName)
  return hit === undefined ? [] : hit.names
}
