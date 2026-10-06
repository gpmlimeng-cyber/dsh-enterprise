/**
 * [INPUT]: 接收稳定错误码（`ENT_*`）、可选的动作前缀（如「安装失败」/「技能文件读取失败」）、调用方自己的类名/样式，以及**可选的员工侧流标识**（本刀：真跨流、两条流下一步不同的码才需要，如本地上传）
 * [OUTPUT]: 提供员工侧统一的失败提示组件 `EnterpriseErrorNotice` 与三个呈现常量（技术信息标题、下一步前缀、技术信息里码的取证钩子）；「下一步」经 `enterpriseErrorActionIn(code, flow)` 取，不传 `flow` 时与改前逐字相同
 * [POS]: ui 员工侧失败呈现的**唯一实现**——任何失败路径都渲染「一句人话 + 一个下一步动作 + 收进「技术信息」的稳定码」，不再把裸码砸在员工脸上；样式走官方 `--dsw-*` token、以行内样式落地，因它跨多个各自注入全局单类 `<style>` 的页面复用（不新增会被互相覆盖的类）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { CSSProperties, ReactNode } from 'react'
import { enterpriseErrorActionIn, enterpriseErrorPresentation, type EnterpriseErrorFlow } from './error-messages.js'

/** 折叠区标题：员工要看的一律在上面，码只在这里。 */
export const ENTERPRISE_ERROR_TECH_SUMMARY = '技术信息'
/** 下一步动作的可见前缀（与「发生了什么」那句分开，一眼看到能做的那件事）。 */
export const ENTERPRISE_ERROR_ACTION_PREFIX = '下一步：'
/** 技术信息里那枚 `<code>` 的取证钩子：测试据此把码从「展示文案」里排除掉。 */
export const ENTERPRISE_ERROR_TECH_ATTR = 'data-enterprise-error-code'
/** 技术信息折叠区的容器钩子。 */
export const ENTERPRISE_ERROR_TECH_CONTAINER_ATTR = 'data-enterprise-error-tech'

const messageStyle: CSSProperties = { display: 'block' }
const actionStyle: CSSProperties = { color: 'var(--dsw-alias-label-secondary, #667085)', display: 'block' }
const techStyle: CSSProperties = { marginTop: 2 }
const summaryStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary, #98a2b3)', cursor: 'pointer', fontSize: '11.5px', lineHeight: '18px' }
const codeStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary, #98a2b3)', fontFamily: 'var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', fontSize: '11.5px', lineHeight: '18px', overflowWrap: 'anywhere' }

/**
 * 员工侧失败提示（技能 / 插件 / 配方 / 账号 / 反馈各页共用同一枚）。
 *
 * 呈现三层，顺序固定：
 *   ① `prefix`（可选） + 人话「发生了什么」；
 *   ② 「下一步：…」——重试 / 去登录 / 去安装 / 联系企业管理员；
 *   ③ `<details>`「技术信息」里原样保留稳定错误码（支持与排障照旧取得到，员工默认看不见）。
 *
 * `role="alert"` 固定挂着（失败要立刻被读屏播报）；视觉底色/字号沿用调用方那枚类名，
 * 故组件自身只用行内 token 样式，不发明新的可覆盖类。
 *
 * **本刀（本地导入）**：多一枚可选 `flow`——有的码**真的跨了两条流**、两条流的下一步不同
 * （典型：技能包损坏，中心安装流里去「重新下载」，本地上传流里只能「换一份本机文件」）。
 * 传了流就取该流的下一步，不传则逐字走默认那句（既有七处调用方一个字节都不变）。
 */
export function EnterpriseErrorNotice({ code, prefix, className, style, flow }: {
  readonly code: string
  /** 动作前缀（如「安装失败」）；缺席即只出人话。 */
  readonly prefix?: string | undefined
  /** 调用方页面自己的错误类名（错误色/字号由它给）。 */
  readonly className?: string | undefined
  readonly style?: CSSProperties | undefined
  /**
   * 员工侧**流**的标识（缺席 = 默认流）。只有真跨流、下一步不同的码才会因它而变
   * （见 `error-messages.ts` 的 `EnterpriseErrorFlow` 与那张表的 `actions`）。
   */
  readonly flow?: EnterpriseErrorFlow | undefined
}): ReactNode {
  const presentation = enterpriseErrorPresentation(code)
  const action = enterpriseErrorActionIn(code, flow)
  return (
    <div className={className} role="alert" style={style}>
      <span className="own-error-message" style={messageStyle}>
        {prefix === undefined ? presentation.message : `${prefix}：${presentation.message}`}
      </span>
      <span className="own-error-action" style={actionStyle}>{ENTERPRISE_ERROR_ACTION_PREFIX}{action}</span>
      <details className="own-error-tech" style={techStyle} {...{ [ENTERPRISE_ERROR_TECH_CONTAINER_ATTR]: presentation.code }}>
        <summary style={summaryStyle}>{ENTERPRISE_ERROR_TECH_SUMMARY}</summary>
        <code style={codeStyle} {...{ [ENTERPRISE_ERROR_TECH_ATTR]: presentation.code }}>{presentation.code}</code>
      </details>
    </div>
  )
}
