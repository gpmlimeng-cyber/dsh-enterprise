/**
 * [INPUT]: 只依赖 `esc-card` 的 `EscCardInstall`（**类型**导入）、`error-messages` 的唯一码表
 *   （取那句话本身与 `retryable`）与 `skill-api-decode` 的本机自装记录类型（**类型**导入）；
 *   不依赖 React、不依赖宿主 API、不发请求、不认识任何路由
 * [OUTPUT]: 对外提供**系统广场**（维度 key `'system'`，「已发布技能」那一批 NUWAX 技能）安装动作的
 *   纯事实层——可见文案（【＋】三态 / 两句各自如实的中文原因 / 写入口缺席 / 被别人的在途挡住 /
 *   在途与成功交代 / 失败提示前缀）、一次安装的**超时**、唯一**按钮终态** `escSystemInstallPlan`
 *   （七档互斥：可点 / 这一枚在途 / 被别人的在途挡住 / 坐标不可用 / 发布者不允许复制 / 需要付费 /
 *   写入口缺席）、把终态铺成卡片入参的唯一投影 `enterpriseEscSystemCardInstall`，以及把 Host
 *   回传的自装清单折成**已装名字集**的 `enterpriseEscSystemInstalledNames`
 * [POS]: dsh-ui 技能页**第一枚维度**（系统广场，`ResourceSourceEnum` 的 `'system'`）那一枚【＋】的
 *   **唯一判定与文案真源**（页面只画、聚合层只接线）。真源是冻结契约
 *   `analysis/esc-platform-skill-export-spec.md` §3.2 + §4（宿主路由 `POST …/local/skills/published/install`）。
 *
 *   ★**为什么合规判据的权威在宿主、界面只预判**：真机实测平台**有 `allowCopy` 字段、没有执行**
 *   （138 条里 68 条 `allowCopy=0`，而 `allowCopy=0` 的 `export/700` **照样回 200 + 128,784B ZIP`**）
 *   ⇒ 不判就等于**替员工绕过发布者的授权**。宿主按**那一条记录的 `targetId`** 重判一次详情
 *   （同名技能可以有多条发布记录、各自 `allowCopy` 不同 ⇒ 判据必须绑 id、不能绑名字），判不过回
 *   `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN`；界面这一侧只拿**列表记录**里的 `allowCopy` / `paymentRequired`
 *   做一次**预判**：判不过就**禁用 + 行上给可见原因**（绝不画死按钮、也绝不画一枚点下去必被拒的按钮），
 *   判过了也**不代表一定成功**（宿主会再判）。这就是"预判"与"权威"的分工，两处都不许少。
 *
 *   ★**为什么 `targetId` 必须是安全整数**：宿主那条路由的正文门禁是「关闭键集恰好 `{targetId}`，
 *   且 `targetId` 是安全整数 `1..2^53-1`」——畸形值（小数 / 字符串 / `NaN` / 越界）过去只会换回一个
 *   400，而 400 到了员工眼前是一句"提交的内容不完整或格式不正确"，**指不到真正的原因**。
 *   故本层在**发请求之前**就用 `esc-list.ts` 的 `escSafeTargetId` 挡下（判据在投影层，
 *   这里只消费"它到底在不在场"）：坐标不在场 ⇒ `no-target` 档 + 一句如实的人话。
 *
 *   ★**它与 `esc-catalog.ts`（企业技能维度）的关系（为什么两枚维度各有一份终态投影）**：
 *     · 那一面的坐标是**企业中心雪花字符串 `packageId`**、动作是「Host 代取中心制品」、
 *       响应是**企业已装清单**；
 *     · 这一面的坐标是**平台数字 `targetId`**、动作是「Host 走只读面 + 票据取平台导出 ZIP」、
 *       响应是**本机自装清单**。
 *     两面的坐标、制品来源、响应形状、可装判据**全不同**，故各自成文；谁也不冒充谁（门禁有反锁：
 *     本文件里不许出现 `packageId`，`esc-catalog.ts` 里不许出现 `targetId`）。
 *
 *   ★**零编造**：本文件不产生任何卡片文案与已装态 —— 名字取自平台响应，"装没装"由聚合层那份
 *     官方发现面真值（`installedIds`）说；界面**从不乐观翻态**（成功只认 Host 回传的那份清单，
 *     失败不翻态）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'
import { ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE, enterpriseErrorMessage } from '../error-messages.js'
import type { EscCardInstall } from './esc-card.js'

/** 【＋】可点时那三件（按钮上的词 / 悬浮说明 / 无障碍名前缀）——与另两枚维度**刻意同词**（同一件事）。 */
export const ENTERPRISE_ESC_SYSTEM_INSTALL = '安装'
/**
 * 在途那三个字（`role="status"`，按既有 `.esc-card-lock` 落点**行上可见**）。
 *
 * ★与 `esc-catalog.ts` / `esc-third-party.ts` 那两枚**刻意同词**：三处说的是同一件事
 *   （一枚技能正在装到本机），没有理由长出第二种说法。
 */
export const ENTERPRISE_ESC_SYSTEM_INSTALLING = '安装中…'
/** 可点时那枚悬浮说明：说清【＋】到底做了什么（"从平台取回并落盘"必须说出来）。 */
export const ENTERPRISE_ESC_SYSTEM_INSTALL_TITLE = '安装到本机 DSH（从平台取回技能目录并落盘，无需重启）'
/** 安装失败提示的动作前缀（人话与下一步由 `error-messages.ts` 的唯一映射按稳定码给）。 */
export const ENTERPRISE_ESC_SYSTEM_INSTALL_FAILED_PREFIX = '安装失败'
/**
 * 在途时**其余**每一枚【＋】的可见原因（它们会禁用，故必须各有一句可见说明）。
 *
 * ★与 `esc-catalog.ts` / `esc-third-party.ts` 那两枚**刻意同词**（同一个事实、同一句话）。
 * ★它**不是**"这一条有问题"，而是"另一条正在装"——产品宪法要的正是前者：一枚禁用的控件旁边
 *   必须能读出它**为什么**按不动。
 */
export const ENTERPRISE_ESC_SYSTEM_BLOCKED_BY_BUSY = '另一枚技能正在安装，稍后再试。'
/** 写入口**整条缺席**时那枚按钮的可见原因（判据是**端口在不在场**，不是写死的 `disabled`）。 */
export const ENTERPRISE_ESC_SYSTEM_INSTALL_NOT_PORTED = '这台机器还没有接上系统广场技能的安装接口。'
/**
 * 那条记录**没有可用的安装坐标**（`targetId` 缺席 / 小数 / 字符串 / 越界）时的可见原因。
 *
 * ★为什么把"编号"这个词说出来：员工能据此判断"是这条记录本身不完整"，
 *   而不是"我这台机器坏了"或"网络不好"——后两者的下一步（重试 / 找管理员）在这里都不对。
 */
export const ENTERPRISE_ESC_SYSTEM_TARGET_MISSING = '这条技能记录没有可用的技能编号，暂时无法安装。'
/** 这一条**需要付费**时那枚按钮的可见原因（宿主同判，回同一枚码）。 */
export const ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED = '这枚技能需要付费。'
/**
 * 发布者**不允许复制**时那枚按钮的可见原因 —— **就是**唯一码表里那句话（同一件事只有一句）。
 *
 * ★为什么不在这里另写一份字面量：真失败时界面上出的是 `EnterpriseErrorNotice` 里那句
 *   （`ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE` 的人话），而**预判**时行上写的是这一句
 *   ——两处若各写一份，改一处就会让"判不过"与"被判回来"在同一条技能上各说各的。
 *   本格因此是那句人话的**唯一再出口**（`enterpriseErrorMessage` 的直接投影）。
 */
export const ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON = enterpriseErrorMessage(ENTERPRISE_ESC_PUBLISHED_COPY_FORBIDDEN_CODE)
/**
 * 一次安装的**超时**（120s）。
 *
 * 与「企业技能」那一维度和「企业设置 → 技能」**同一个数字**：同一件事（下载 → 校验 → 解包 → 落盘）
 * 没有理由长出第二、第三个超时口径。宿主这一条要多走一次详情（合规判据）+ 一次有界取制品（上限复用
 * 那条 50 MiB 配额），量级与中心那一条相同。
 */
export const ENTERPRISE_ESC_SYSTEM_INSTALL_TIMEOUT_MS = 120_000

/** 那一枚【＋】当前处在哪一档（七档互斥，各有自己的可见文案）。 */
export type EnterpriseEscSystemActionKind =
  /** 这一枚正在装（按钮文案变「安装中…」、禁用）。 */
  | 'this-busy'
  /** 别的枚正在装（按钮禁用 + **行上可见原因**，不是只挂 title）。 */
  | 'blocked'
  /** 这一次真的可以点。 */
  | 'install'
  /** 写入口整条缺席（本部署还没接上这条接口）；按钮禁用 + 可见原因。 */
  | 'not-ported'
  /** 那条记录没有可用的安装坐标（安全整数门禁没过）——**不发请求**，行上写明原因。 */
  | 'no-target'
  /** 发布者不允许复制（`allowCopy !== 1`）——宿主会再判一次，界面这一侧只预判。 */
  | 'copy-forbidden'
  /** 这一条需要付费（`paymentRequired === true`）——与上一条同一个码，但原因逐字不同。 */
  | 'payment-required'

/** 一枚【＋】的**终态**（渲染层唯一的输入：文案 / 能不能点 / 为什么不能点 / 无障碍名 / 回传的坐标）。 */
export interface EnterpriseEscSystemInstallPlan {
  readonly kind: EnterpriseEscSystemActionKind
  /** 按钮上不一定看得见的文案（圆形图标钮）——但它就是读屏与悬浮说明念出来的那一句。 */
  readonly text: string
  readonly disabled: boolean
  /** 禁用时的**可见原因**（可点、以及在途那一档时缺席——在途时按钮那格写着「安装中…」）。 */
  readonly reason?: string | undefined
  /** 悬浮说明（可用时说会发生什么；不可用时与 `reason` 同源）。 */
  readonly title: string
  /** 无障碍名（读屏听到的是「安装 X」/「安装中…」）。 */
  readonly ariaLabel: string
  /**
   * ★**只有可点那一档才在场**：安全整数 `targetId`。
   *
   * 它是"这枚按钮**能不能**发出请求"的唯一判据——渲染层据此**构造并交出** `onInstall`；
   * 其余六档一律缺席 ⇒ 那枚按钮连一个 `onClick` 都不会挂上（门禁逐档咬住这一点：
   * "禁用"不只是 `disabled` 属性，而是**物理上没有写入口**）。
   */
  readonly targetId?: number | undefined
}

/**
 * 一枚【＋】的终态（唯一判定点）。
 *
 * ★**判据优先级（刻意与 `esc-catalog.ts` 那一枚**不同**，理由在下面）**：
 *   ① `no-target` → ② `copy-forbidden` → ③ `payment-required` → ④ `this-busy` → ⑤ `blocked`
 *   → ⑥ `not-ported` → ⑦ `install`。
 *   · 前三条是**这条记录自身的、不会自己变好的事实**（坐标不完整 / 发布者不允许复制 / 要付费）：
 *     它们必须**压过**"另一枚正在装"与"端口缺席"这两条**环境态**——否则员工会看到一枚
 *     "等一会儿就能装"的按钮，等一整晚也装不上（那是一句用时间说的假话）。
 *   · 反过来，④ 那一枚（正在装的这一枚）必然已经通过了前三档（它刚被点下去过）⇒ 两条判据
 *     在真实交互里不可能同时命中，优先级定死只为让**纯函数**有一个确定答案。
 *   · `esc-catalog.ts` 那一枚没有前三档（它没有"这条记录自身不可装"的事实），故它的次序
 *     从"在途"开始；两处次序不同是**判据集不同**的结果，不是两套风格。
 *
 * ★**已装那一档不在这里**：装好的卡片**根本不画【＋】**（改画「更多 + 去试试」），
 *   故"已装"是一条渲染分流（判据是聚合层那份 `installedIds`），不是一个按钮终态。
 *
 * @param input - 端口在不在场、这条记录的坐标与授权事实、在途的那一枚。
 * @returns 按钮终态（文案 + 可点性 + 可见原因 + 悬浮说明 + 无障碍名 + 可回传的坐标）。
 */
export function escSystemInstallPlan(input: {
  /** 写入口在不在场（`false` ⇒ 禁用 + **行上可见**写明原因；判据是端口，不写死 disabled）。 */
  readonly wired: boolean
  /** 那条记录的安装坐标（**已过安全整数门禁**；缺席 = 判不过或平台没给）。 */
  readonly targetId?: number | undefined
  /** 那条记录的 `allowCopy` 原值（**只有数字 `1` 才算允许**；缺席 / `0` / `true` / `'1'` 一律不允许）。 */
  readonly allowCopy?: number | undefined
  /** 那条记录是否要求付费（`true` 才算）。 */
  readonly paymentRequired: boolean
  /** 行上要念出来的技能名。 */
  readonly name: string
  /** 在途那一枚的 `targetId`（缺席 = 没有动作在跑）。 */
  readonly busy?: number | undefined
}): EnterpriseEscSystemInstallPlan {
  const ariaLabel = `${ENTERPRISE_ESC_SYSTEM_INSTALL}${input.name}`
  const targetId = input.targetId
  // ① 坐标不在场：**连理由都不用问宿主** —— 这一条记录自己装不了，且重试不会让它长出编号。
  if (targetId === undefined) {
    return {
      kind: 'no-target',
      text: ENTERPRISE_ESC_SYSTEM_INSTALL,
      disabled: true,
      reason: ENTERPRISE_ESC_SYSTEM_TARGET_MISSING,
      title: ENTERPRISE_ESC_SYSTEM_TARGET_MISSING,
      ariaLabel,
    }
  }
  // ② 发布者不允许复制（fail-closed：`!== 1` 一律不允许，`0`/`true`/`'1'`/缺席都走这一支）。
  if (input.allowCopy !== 1) {
    return {
      kind: 'copy-forbidden',
      text: ENTERPRISE_ESC_SYSTEM_INSTALL,
      disabled: true,
      reason: ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON,
      title: ENTERPRISE_ESC_SYSTEM_COPY_FORBIDDEN_REASON,
      ariaLabel,
    }
  }
  // ③ 需要付费（与上一条**同一个宿主码**，但界面这一侧的原因逐字不同：员工要做的判断不同）。
  if (input.paymentRequired) {
    return {
      kind: 'payment-required',
      text: ENTERPRISE_ESC_SYSTEM_INSTALL,
      disabled: true,
      reason: ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED,
      title: ENTERPRISE_ESC_SYSTEM_PAYMENT_REQUIRED,
      ariaLabel,
    }
  }
  // ④ 这一枚正在装：文案变「安装中…」，**不给 reason**（按钮那格自己已经写着那三个字）。
  if (input.busy !== undefined && input.busy === targetId) {
    return {
      kind: 'this-busy',
      text: ENTERPRISE_ESC_SYSTEM_INSTALLING,
      disabled: true,
      title: ENTERPRISE_ESC_SYSTEM_INSTALLING,
      ariaLabel: ENTERPRISE_ESC_SYSTEM_INSTALLING,
    }
  }
  // ⑤ 别的枚正在装：禁用 + 行上可见原因（一次只允许一条在途）。
  if (input.busy !== undefined) {
    return {
      kind: 'blocked',
      text: ENTERPRISE_ESC_SYSTEM_INSTALL,
      disabled: true,
      reason: ENTERPRISE_ESC_SYSTEM_BLOCKED_BY_BUSY,
      title: ENTERPRISE_ESC_SYSTEM_BLOCKED_BY_BUSY,
      ariaLabel,
    }
  }
  // ⑥ 写入口缺席（本部署还没接上这条接口）。
  if (!input.wired) {
    return {
      kind: 'not-ported',
      text: ENTERPRISE_ESC_SYSTEM_INSTALL,
      disabled: true,
      reason: ENTERPRISE_ESC_SYSTEM_INSTALL_NOT_PORTED,
      title: ENTERPRISE_ESC_SYSTEM_INSTALL_NOT_PORTED,
      ariaLabel,
    }
  }
  // ⑦ 终于可点：**只有这一档**带上那枚安全整数坐标。
  return {
    kind: 'install',
    text: ENTERPRISE_ESC_SYSTEM_INSTALL,
    disabled: false,
    title: ENTERPRISE_ESC_SYSTEM_INSTALL_TITLE,
    ariaLabel,
    targetId,
  }
}

/**
 * 终态 → 卡片入参（**唯一**铺平点）。
 *
 * 两条硬口径：
 *   · `onInstall` **只在可点那一档**交出去（其余六档的 `targetId` 恒缺席）⇒ 卡片上那枚按钮
 *     连 `onClick` 都不会挂上（"禁用的按钮物理上没有写入口"，不是"挂了一个不会被调的回调"）。
 *   · `busy` 只由 `this-busy` 这一档给（**不从 `disabled` 推**）：禁用有六种原因，
 *     只有"这一枚正在装"该把那三个字写上屏，凭 `disabled` 推会让另外五种也冒出「安装中…」——那是假话。
 *
 * @param plan - `escSystemInstallPlan` 的终态。
 * @param onInstall - 真写入口（收那枚安全整数坐标）；只在可点那一档会被调到。
 * @returns 卡片那枚【＋】的入参（`esc-card.tsx` 的 `EscCardInstall`）。
 */
export function enterpriseEscSystemCardInstall(
  plan: EnterpriseEscSystemInstallPlan,
  onInstall: (targetId: number) => void,
): EscCardInstall {
  const targetId = plan.targetId
  return {
    text: plan.text,
    disabled: plan.disabled,
    ...(plan.kind === 'this-busy' ? { busy: true } : {}),
    title: plan.title,
    ariaLabel: plan.ariaLabel,
    ...(plan.reason === undefined ? {} : { reason: plan.reason }),
    ...(targetId === undefined ? {} : { onInstall: () => { onInstall(targetId) } }),
  }
}

/**
 * 装好一枚之后，把 Host 回传的**自装清单**折成一串**已装技能名**（唯一投影）。
 *
 * ★为什么是"名字"这把键：这一维度（系统广场）的卡片判"装没装"用的是**名字**
 *   （平台那条记录的 `name` ↔ 官方发现面给的 kebab 名），因为平台 `targetId` 与中心 `packageId`
 *   是两套坐标系（真机实测），而自装记录里**只有名字**能与平台那条对上。
 * ★为什么只**并进**这份集合、不拿它**替换**：聚合层那份集合的真源是**官方发现面**
 *   （磁盘上真的装着什么，含企业装下来的与官方内置的）；这份自装清单只是它的一个子集，
 *   拿它替换会让另外那几类技能在卡片上凭空变回"未安装"。
 *   ⇒ 这里加上去的每一个名字都来自 Host 那一次回执（不是我们猜的），随后的计数重读
 *   （`onInstalledRefresh`）会用官方真值再收敛一次。
 *
 * @param next - `installPublishedSkill` 的返回值（Host 落盘后的本机自装清单）。
 * @returns 去重后的已装技能名（顺序 = 响应原序，便于取证）。
 */
export function enterpriseEscSystemInstalledNames(
  next: readonly EnterpriseSelfInstalledSkill[],
): readonly string[] {
  const names = new Set<string>()
  for (const record of next) for (const name of record.names) names.add(name)
  return [...names]
}

/** 装好一枚那行 `role="status"` 里那一整句（说清刚刚装了谁）。 */
export function enterpriseEscSystemInstalledText(name: string): string {
  return `已${ENTERPRISE_ESC_SYSTEM_INSTALL}「${name}」。`
}
