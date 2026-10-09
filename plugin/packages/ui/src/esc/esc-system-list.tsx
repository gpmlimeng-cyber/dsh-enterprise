/**
 * [INPUT]: 依赖 React 的 createElement/ReactNode、官方原语 `Button`、lucide 的 `RefreshCw`、
 *   `list-state` 的重试文案、`error-notice` 的唯一提示组件、`error-messages` 的 `retryable` 判据与
 *   `esc-system` 的失败前缀
 * [OUTPUT]: 对外提供**系统广场**（`'system'` 维度）安装失败的**唯一呈现件**
 *   `EnterpriseEscSystemInstallFailure`（一行失败：唯一提示组件 + 稳定码 + **只在可重试时**给重试）
 * [POS]: esc 技能页第一枚维度的**呈现层**（纯函数、无 hook、可直调取证）。卡片本体仍归
 *   `esc-card.tsx`（本维度没有自己的卡片），聚合层只把这一件铺在**失败的那一行**下面。
 *   ★**为什么它必须是一个能直调的纯函数**（而不是聚合层里那段内联 JSX）：本仓 vitest **没有 DOM**，
 *     "这一枚码**不给**重试按钮"这条判据若只活在带 hook 的组件里，就**没有任何机械判据**能证明它
 *     ——只能靠肉眼读代码。抽出来之后，两条分支各自可以被直调咬住。
 *   ★**"可重试"的判据只有一处**：`error-messages.ts` 的 `enterpriseErrorRetryable(code)`
 *     （本文件不自己列码、不自己判哪一枚能重试）。新码 `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN`
 *     在那张表里是 `retryable: false`（授权由发布者设定，重试永远无效）⇒ 这里**不画**重试按钮：
 *     画一枚只会把员工引向一条必然失败的路（与 `esc-aggregation.tsx` 的 `ErrorRow` 同一条纪律）。
 *   ★**零新增 CSS 类**：类名取自上一刀那套 `.esc-catalog-*`（失败格 / 重试）与既有的
 *     `.esc-import-error`（唯一提示组件的底色与字号），三个类都在 `esc-style.ts` 里已声明。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { RefreshCw } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { enterpriseErrorRetryable } from '../error-messages.js'
import { EnterpriseErrorNotice } from '../error-notice.js'
import { ENTERPRISE_LIST_RETRY, ENTERPRISE_LIST_RETRY_LABEL } from '../list-state.js'
import { ENTERPRISE_ESC_SYSTEM_INSTALL_FAILED_PREFIX } from './esc-system.js'

/** 一行安装失败的输入（唯一构造点在聚合层：那一次动作失败产出的 `{targetId, code}`）。 */
export interface EnterpriseEscSystemInstallFailureProps {
  /** 失败的那一条记录的安装坐标（与卡片同一个键：同一行上的失败只落在那一行）。 */
  readonly targetId: number
  /** 宿主回的那枚稳定码（人话与下一步由唯一码表给；这里不翻译）。 */
  readonly code: string
  /** 重试：同一枚写入口、同一枚坐标（**不是**重画一下）。 */
  readonly onRetry: (targetId: number) => void
}

/**
 * 一行失败（**纯函数**）：唯一提示组件 + 稳定码 +（**仅当可重试时**）一枚会真重发的重试。
 *
 * @param props - 坐标、稳定码与重试入口。
 * @returns 那一行下面的失败块（`data-esc-system-error` 是给门禁的稳定钩子）。
 */
export function EnterpriseEscSystemInstallFailure(props: EnterpriseEscSystemInstallFailureProps): ReactNode {
  return createElement(
    'div',
    { className: 'esc-catalog-error', 'data-esc-system-error': props.targetId },
    // 人话 + 下一步 + 收进「技术信息」的稳定码 —— 全仓唯一那一枚提示组件（本层不自己拼句子）。
    createElement(EnterpriseErrorNotice, {
      className: 'esc-import-error',
      code: props.code,
      prefix: ENTERPRISE_ESC_SYSTEM_INSTALL_FAILED_PREFIX,
    }),
    // ★不可重试的失败（发布者不允许复制 / 需要付费那类）**不画**「重试」——重试对它永远无效。
    enterpriseErrorRetryable(props.code)
      ? createElement(Button, {
          size: 'sm',
          className: 'esc-catalog-retry',
          icon: createElement(RefreshCw, { size: 14, 'aria-hidden': true }),
          'aria-label': ENTERPRISE_LIST_RETRY_LABEL,
          onClick: () => { props.onRetry(props.targetId) },
          children: ENTERPRISE_LIST_RETRY,
        })
      : null,
  )
}
