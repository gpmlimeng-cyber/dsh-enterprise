/**
 * [INPUT]: 依赖 React 的 createElement/useEffect/useState、lucide-react 的 `RefreshCw`、`esc-api` 的 `EnterpriseEscApi`
 *   与 `enterpriseEscImageSrc`、`esc-constants` 的成功码、`esc-copy` 的文案、`esc-types` 的推荐记录类型
 * [OUTPUT]: 对外提供 `EnterpriseEscFeatured`——内容区第一行「精选技能」（含标题栏、「换一批」、卡片网格、
 *   加载/失败/空四态）
 * [POS]: esc 页面的**精选行**，数据源是 NUWAX 的官方推荐接口（`POST /api/system/display/recommend/list`，
 *   `recType=Official` + `targetType=Skill`），由 `esc-page` 在内容区顶部挂一次。
 *   ★**薄壳是本刀的刻意裁决**（用户拍板）：这一行只画 `label` + `icon` 两项。
 *     那条接口的 `DisplayRecommendInfo` 字段是 `label`/`icon`/`placeholder`/`category`/`prompts`/`targetId`，
 *     **没有**描述、作者、收藏量、安装量、使用量；而卡片底部标签行要的正是后面这五项。
 *     于是本行的卡片与下方技能卡**刻意不同款**：它没有描述行、没有标签行，只有图标 + 标题。
 *     理由是「每一格都必须是真的」——拿 `targetId` 回查 `published/skill/list` 理论上能补齐字段，
 *     但 `targetId` 与那份列表**是否同一套坐标系在源码里查不到、必须实跑**，未验就接 = 可能静默取错技能。
 *     那一段留给「验过之后的一刀」，不夹带进本刀。
 *   ★四态与列表页同纪律：失败**说出来**（稳定码 + 平台原话 + 重试），未登录单独成一态，
 *     空态用官方那一句「暂无数据」——**绝不**把失败画成「今天没有精选」。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { RefreshCw } from 'lucide-react'
import { createElement, useCallback, useEffect, useState, type ReactNode } from 'react'
import { enterpriseEscImageSrc, type EnterpriseEscApi } from './esc-api.js'
import { ESC_SUCCESS_CODE } from './esc-constants.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import type { EscRecommendRecord, EscRecommendTargetTypeEnum } from './esc-types.js'

/** 精选行入参。 */
export interface EnterpriseEscFeaturedProps {
  readonly api: EnterpriseEscApi
  /**
   * ★用户裁决：专家页也挂精选区，**逻辑与技能页完全一致**，只有 `targetType` 那一档不同
   * （官方推荐页本身就支持 Agent 与 Skill 两档，见 `OFFICIAL_RECOMMEND_CONFIG`）。
   */
  readonly targetType: EscRecommendTargetTypeEnum
}

/** 精选行内部状态（成功/失败/空/加载四态互斥，避免出现「空数组 + 没报错」那种空白态）。 */
type FeaturedState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly items: readonly EscRecommendRecord[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'unauthenticated' }

/** 内容区第一行「精选技能」。 */
export function EnterpriseEscFeatured({ api, targetType }: EnterpriseEscFeaturedProps): ReactNode {
  const [state, setState] = useState<FeaturedState>({ kind: 'loading' })
  /**
   * 「换一批」令牌：官方那枚按钮是纯前端动作（源码里「精选」这两个字在 NUWAX 全树零命中，
   * 它是 workbuddy 的版式）。本刀让它做**如实**的事——重发一次同一个请求；
   * 若平台对同一入参返回同一批，那「换一批」就如实是这一批，绝不本地假换序。
   */
  const [batch, setBatch] = useState<number>(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    api
      .officialRecommended(targetType, controller.signal)
      .then(envelope => {
        if (controller.signal.aborted) return
        // 与 `esc-list` 同一判据：成功码是 `'0000'`（NUWAX `codes.constants.ts:11`）。
        if (envelope.code !== ESC_SUCCESS_CODE) {
          setState({ kind: 'failed', message: envelope.message ?? String(envelope.code) })
          return
        }
        const records = envelope.data?.records
        if (!Array.isArray(records) || records.length === 0) {
          setState({ kind: 'empty' })
          return
        }
        setState({ kind: 'ready', items: records })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // 未登录单独成一态：不拿「精选为空」假装"平台没有内容"。
        const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
        if (code === 'ENT_AUTH_REQUIRED') {
          setState({ kind: 'unauthenticated' })
          return
        }
        setState({ kind: 'failed', message: typeof code === 'string' ? code : ENTERPRISE_ESC_LOCAL_COPY.loadFailed })
      })
    return () => controller.abort()
  }, [api, batch, targetType])

  const retry = useCallback(() => setBatch(current => current + 1), [])

  // 标题随 targetType 变：技能页「精选技能」、专家页「精选专家」（真机截图里两处都写"精选技能"，
  // 那是同词复用导致的错读——两页的数据源不同，标题也该不同）。
  const title = targetType === 'Agent'
    ? ENTERPRISE_ESC_COPY.featuredTitleAgent
    : ENTERPRISE_ESC_COPY.featuredTitle
  return createElement(
    'section',
    { className: 'esc-featured', 'aria-label': title },
    createElement(
      'div',
      { className: 'esc-featured-head' },
      createElement('h2', { className: 'esc-featured-title', children: title }),
      state.kind === 'ready' && state.items.length > 0
        ? createElement(
            'button',
            { type: 'button', className: 'esc-featured-refresh', onClick: retry },
            createElement(RefreshCw, { size: 13, 'aria-hidden': true }),
            ENTERPRISE_ESC_COPY.refreshBatch,
          )
        : null,
    ),
    createElement('div', { className: 'esc-featured-body' }, renderFeaturedBody(state, retry)),
  )
}

/** 四态 → 具体呈现（与下方列表页同一纪律：失败说出来、空态用官方那一句）。 */
function renderFeaturedBody(state: FeaturedState, retry: () => void): ReactNode {
  switch (state.kind) {
    case 'loading':
      return createElement('div', { className: 'esc-loading', children: ENTERPRISE_ESC_COPY.loading })
    case 'empty':
      return createElement('div', { className: 'esc-empty', children: ENTERPRISE_ESC_COPY.emptyData })
    case 'unauthenticated':
      return createElement(
        'div',
        { className: 'esc-featured-note' },
        createElement('p', { children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredTitle }),
        createElement('p', { className: 'esc-sub', children: ENTERPRISE_ESC_LOCAL_COPY.signInRequiredBody }),
      )
    case 'failed':
      return createElement(
        'div',
        { className: 'esc-featured-note', role: 'alert' },
        createElement('p', null, `${ENTERPRISE_ESC_LOCAL_COPY.loadFailed}：${state.message}`),
        createElement(
          'button',
          { type: 'button', className: 'esc-retry', onClick: retry },
          ENTERPRISE_ESC_LOCAL_COPY.retry,
        ),
      )
    case 'ready':
      return createElement(
        'div',
        { className: 'esc-featured-grid' },
        state.items.map(record => createElement(FeaturedCard, { key: String(record.id), record })),
      )
  }
}

/** 一张精选卡：图标 + 标题，**只有这两项**（薄壳裁决，见文件头）。 */
function FeaturedCard({ record }: { readonly record: EscRecommendRecord }): ReactNode {
  return createElement(
    'div',
    { className: 'esc-card esc-card-featured' },
    createElement('div', { className: 'esc-featured-icon' }, createElement(FeaturedIcon, { icon: record.icon })),
    createElement('span', { className: 'esc-featured-label', title: record.label, children: record.label }),
  )
}

/** 精选图标：走与卡片同一条本机图片代理；换不出来画中性图标，**永不破图**。 */
function FeaturedIcon({ icon }: { readonly icon: string | undefined }): ReactNode {
  const [broken, setBroken] = useState(false)
  const src = broken ? undefined : enterpriseEscImageSrc(icon)
  if (src !== undefined)
    return createElement('img', { className: 'esc-featured-image', src, alt: '', loading: 'lazy', onError: () => setBroken(true) })
  return createElement('span', { className: 'esc-featured-image esc-featured-image-empty', 'aria-hidden': true })
}