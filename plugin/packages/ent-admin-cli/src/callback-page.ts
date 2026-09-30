/**
 * [INPUT]: 只依赖标准 JS 字符串与调用方给出的品牌文本，不触碰 Node API、网络与磁盘
 * [OUTPUT]: 提供 CALLBACK_DEFAULT_LOCALE、pickCallbackLocale、escapeHtmlText、renderCallbackPage 与回调页语言/品牌/结局类型
 * [POS]: ent-admin-cli 登录回环的浏览器唯一可见面，由 pkce.ts 消费，缺省中文；与 platform-client 同源文件保持语义一致，改动必须两侧同步
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 回调页只区分中文与英文，不做半成品翻译。 */
export type CallbackLocale = 'zh' | 'en'

/**
 * 企业默认语言：产品要求缺省中文。`Accept-Language` 缺失、空、畸形、不可解析，
 * 或用户偏好既非中文也非明确英文（fr/de…）时，回调页一律用中文。
 */
export const CALLBACK_DEFAULT_LOCALE: CallbackLocale = 'zh'

/**
 * 失败原因只用于挑选页面文案，绝不把原始错误细节渲染给用户：
 * 回环回调页是 Host 在浏览器里露出的唯一表面。
 */
export type CallbackFailureReason = 'state' | 'code' | 'error' | 'expired'

export type CallbackOutcome =
  | { readonly status: 'success' }
  | { readonly status: 'failure'; readonly reason: CallbackFailureReason }

/**
 * 回调页只需要品牌文档的三处文本；结构上兼容 `EnterpriseBrandingCache.document()` 的投影，
 * 因此 platform-client 直接传缓存文档，ent-admin-cli 传 null 即回落内置名。
 */
export interface CallbackBranding {
  readonly name: string
  readonly shortName: string
  readonly welcome: { readonly headline: string; readonly editionLabel: string }
}

/** 拿不到企业品牌时的内置名（与 ui 侧默认保持一致）。 */
export const CALLBACK_DEFAULT_BRAND_NAME = 'DSH Enterprise'

export interface CallbackPageOptions {
  readonly outcome: CallbackOutcome
  readonly locale: CallbackLocale
  readonly branding?: CallbackBranding | null
}

/** RFC 5646 的宽松形状；`*` 与畸形片段都不算可识别语言。 */
const CALLBACK_LANGUAGE_TAG = /^[a-z]{1,8}(?:-[a-z0-9]{1,8})*$/

/**
 * 从入站 `Accept-Language` 判定回调页语言：首选（q 值优先、同级取先出现者）语言的主子标签是 `zh`
 * 即中文，是 `en` 才用英文，其余（含空值、畸形头、通配符、q=0、未知名与非中英偏好）一律回落
 * `CALLBACK_DEFAULT_LOCALE`（中文，产品要求缺省中文）。
 *
 * @param acceptLanguage - 原始请求头，允许 null/undefined。
 * @returns 页面语言。
 */
export function pickCallbackLocale(acceptLanguage: string | null | undefined): CallbackLocale {
  if (typeof acceptLanguage !== 'string' || acceptLanguage.trim() === '') return CALLBACK_DEFAULT_LOCALE
  let best: { readonly tag: string; readonly quality: number } | undefined
  for (const entry of acceptLanguage.split(',')) {
    const [rawTag, ...parameters] = entry.split(';')
    const tag = (rawTag ?? '').trim().toLowerCase()
    if (tag === '*' || !CALLBACK_LANGUAGE_TAG.test(tag)) continue
    let quality = 1
    for (const parameter of parameters) {
      const [rawKey, rawValue] = parameter.split('=')
      if ((rawKey ?? '').trim().toLowerCase() !== 'q') continue
      const parsed = Number.parseFloat((rawValue ?? '').trim())
      quality = Number.isFinite(parsed) ? parsed : 0
    }
    if (quality <= 0) continue
    if (best === undefined || quality > best.quality) best = { quality, tag }
  }
  if (best === undefined) return CALLBACK_DEFAULT_LOCALE
  const primary = best.tag.split('-')[0] ?? ''
  if (primary === 'zh') return 'zh'
  if (primary === 'en') return 'en'
  return CALLBACK_DEFAULT_LOCALE
}

const CALLBACK_HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * 文本节点的唯一转义出口。品牌名与企业欢迎语来自企业后台，属于不可信输入，
 * 任何进入 HTML（含 `<title>` 与属性）的品牌文本都必须先过这里。
 *
 * @param value - 任意文本。
 * @returns 可直接嵌入 HTML 文本或双引号属性的安全文本。
 */
export function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"']/g, character => CALLBACK_HTML_ESCAPES[character] ?? character)
}

/**
 * 品牌名按 名称 → 简称 → 欢迎语标题 → 内置默认 依次回落，空串与空白视为没有。
 *
 * @param branding - 已缓存的品牌文档；没有品牌时传 null/undefined。
 * @returns 未转义的品牌名，交由渲染层统一转义。
 */
export function callbackBrandName(branding: CallbackBranding | null | undefined): string {
  const candidates: readonly (string | undefined)[] = [
    branding?.name,
    branding?.shortName,
    branding?.welcome.headline,
    CALLBACK_DEFAULT_BRAND_NAME,
  ]
  for (const candidate of candidates) {
    const text = typeof candidate === 'string' ? candidate.trim() : ''
    if (text !== '') return text
  }
  return CALLBACK_DEFAULT_BRAND_NAME
}

interface CallbackCopy {
  readonly htmlLang: string
  readonly close: string
  readonly autoCloseHint: string
  readonly success: { readonly title: string; readonly lead: string }
  readonly failure: {
    readonly title: string
    readonly detail: string
    readonly reason: Readonly<Record<CallbackFailureReason, string>>
  }
}

const CALLBACK_COPY: Readonly<Record<CallbackLocale, CallbackCopy>> = {
  zh: {
    htmlLang: 'zh-CN',
    close: '关闭窗口',
    autoCloseHint: '若窗口未自动关闭，请手动关闭并回到客户端。',
    success: { title: '登录已完成', lead: '登录已完成，可以关闭此窗口。' },
    failure: {
      title: '登录未完成',
      detail: '请回到客户端重试。',
      reason: {
        state: '登录会话已失效。',
        code: '未收到授权码。',
        error: '身份认证未通过。',
        expired: '本次登录已结束。',
      },
    },
  },
  en: {
    htmlLang: 'en',
    close: 'Close window',
    autoCloseHint: 'If the window does not close by itself, close it manually and return to the client.',
    success: { title: 'Login completed', lead: 'Login completed. You can close this window.' },
    failure: {
      title: 'Login not completed',
      detail: 'Please return to the client and try again.',
      reason: {
        state: 'This login session is no longer valid.',
        code: 'The authorization code was not received.',
        error: 'Authentication was not completed.',
        expired: 'This login request has already ended.',
      },
    },
  },
}

/**
 * 渲染单文件自包含回调页：无 CDN、无外链字体与图片、样式内联，深色随系统偏好。
 * 成功态只尽力 `window.close()` 一次（浏览器通常拒绝）并保留按钮与手关闭提示；
 * 失败态不自动关窗，保证用户能读完原因。
 *
 * @param options - 结局、语言与可选品牌。
 * @returns 完整 HTML 文档。
 */
export function renderCallbackPage(options: CallbackPageOptions): string {
  const copy = CALLBACK_COPY[options.locale]
  const outcome = options.outcome
  const failed = outcome.status === 'failure'
  const title = escapeHtmlText(failed ? copy.failure.title : copy.success.title)
  const brand = escapeHtmlText(callbackBrandName(options.branding))
  const edition = escapeHtmlText((options.branding?.welcome.editionLabel ?? '').trim())
  const lead = escapeHtmlText(failed ? copy.failure.reason[outcome.reason] : copy.success.lead)
  const detail = escapeHtmlText(failed ? copy.failure.detail : '')
  // 自动关窗只可能出现在成功态；失败态必须让用户读完原因，手关提示也只留给成功态。
  const hint = failed ? '' : escapeHtmlText(copy.autoCloseHint)
  const autoClose = !failed
  const editionMarkup = edition === '' ? '' : `<span class="edition">${edition}</span>`
  const detailMarkup = detail === '' ? '' : `\n      <p class="detail">${detail}</p>`
  const hintMarkup = hint === '' ? '' : `\n      <p class="hint">${hint}</p>`

  return `<!doctype html>
<html lang="${copy.htmlLang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light dark;
        --page: #f6f7f9;
        --card: #ffffff;
        --fg: #16181d;
        --muted: #5d6470;
        --line: #e3e6ec;
        --ok: #1a7f4b;
        --ok-bg: #e6f4ec;
        --err: #b3261e;
        --err-bg: #fdeceb;
        --action: #16181d;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --page: #0f1115;
          --card: #171a20;
          --fg: #eef0f4;
          --muted: #9aa2b1;
          --line: #262b33;
          --ok: #5ed39a;
          --ok-bg: #12291f;
          --err: #ff8a80;
          --err-bg: #2c1615;
          --action: #eef0f4;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: var(--page);
        color: var(--fg);
        font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        -webkit-text-size-adjust: 100%;
      }
      .card {
        width: 100%;
        max-width: 26rem;
        padding: 28px 24px;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 14px;
        text-align: center;
      }
      .brand {
        margin: 0 0 18px;
        color: var(--muted);
        font-size: 13px;
        letter-spacing: 0.02em;
        overflow-wrap: anywhere;
      }
      .edition {
        margin-left: 6px;
        padding: 1px 7px;
        border: 1px solid var(--line);
        border-radius: 999px;
        font-size: 11px;
      }
      .mark {
        width: 44px;
        height: 44px;
        margin: 0 auto 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-size: 22px;
        font-weight: 600;
      }
      .mark.ok { background: var(--ok-bg); color: var(--ok); }
      .mark.error { background: var(--err-bg); color: var(--err); }
      .lead {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .lead.error { color: var(--err); }
      .detail { margin: 10px 0 0; color: var(--fg); }
      .hint { margin: 12px 0 0; color: var(--muted); font-size: 12.5px; }
      button {
        width: 100%;
        margin-top: 20px;
        padding: 10px 16px;
        font: inherit;
        font-weight: 600;
        color: var(--card);
        background: var(--action);
        border: 1px solid transparent;
        border-radius: 10px;
        cursor: pointer;
      }
      button:hover { opacity: 0.9; }
      @media (max-width: 360px) { .card { padding: 22px 16px; } }
    </style>
  </head>
  <body>
    <main class="card" role="status">
      <p class="brand">${brand}${editionMarkup}</p>
      <p class="mark ${failed ? 'error' : 'ok'}" aria-hidden="true">${failed ? '!' : '✓'}</p>
      <h1 class="lead${failed ? ' error' : ''}">${lead}</h1>${detailMarkup}
      <button type="button" id="close-window">${escapeHtmlText(copy.close)}</button>${hintMarkup}
    </main>
    <script>
      (function () {
        var button = document.getElementById('close-window')
        if (button !== null) {
          button.addEventListener('click', function () { window.close() })
        }
        if (${autoClose ? 'true' : 'false'}) {
          // 浏览器一般只允许脚本打开的窗口关闭自己：这里只尝试一次，失败就交给按钮与提示。
          try { window.close() } catch (error) { /* 不能自动关闭是常态，忽略 */ }
        }
      })()
    </script>
  </body>
</html>
`
}
