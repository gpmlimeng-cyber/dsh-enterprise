/**
 * [INPUT]: 只依赖宿主 DOM（`Document`／`Element`／`MutationObserver`）与 `marketplace-entry` 的三个字面真源
 *          （`ENTERPRISE_MARKET_ENTRY_ID`／`ENTERPRISE_MARKET_ENTRY_LABEL`／`ENTERPRISE_MARKET_BADGE_TEXT`）；
 *          **不依赖 React、不 import 官方包的私有导出**（`@deepseek-ai/dsh-client-ui-plugin-manager` 只导出
 *          `NS`／`PANEL_ID`／`apply`／`inject`，拿不到它 CSS module 里的哈希类名，`./src/*` 指向的 `src/` 也没随包发布）
 * [OUTPUT]: 对外提供唯一入口 `startEnterpriseMarketBadgeDecoration`（铺一次签 + 观察官方重渲染 + 返回 `dispose`）、
 *           一次性纯动作 `decorateEnterpriseMarketBadge`（幂等，测试直调）、行定位选择器
 *           `ENTERPRISE_MARKET_ROW_SELECTOR`、幂等/清理标记 `ENTERPRISE_MARKET_BADGE_ATTRIBUTE`
 *           与铺签结果联合 `EnterpriseMarketBadgeApplyResult`
 * [POS]: dsh-ui 里**唯一**一处 DOM 级装饰。官方插件列表卡片由官方 `ItemCard` 渲染
 *        （`dsh-client-ui-plugin-manager/lib/client.js:2083-2097`），它只往 `CardHead` 传 title/icon/description，
 *        **没有 tags 座位**——官方 API 层次做不到「我们那行【插件市场】的标题正后方有一枚签」，所以这枚签只能在官方
 *        渲染完成后往我们那一行的 `titleRow` 里插 DOM。
 *
 *        ★ 这条路是**脆的，且必须脆得诚实**：它依赖三个官方结构标记——
 *          ① 官方 `ItemCard` 把条目 id 写在 `data-plugin-item` 上（行定位）；
 *          ② 官方 `CardHead` 的标题是一枚 `button[type=button]`，它的 `textContent` 就是条目 label，
 *             且它的 `parentElement` 就是 `titleRow`（插入点）；
 *          ③ 页面上存在一枚**官方 `Tag` 原语渲染出来的实物**（`span[data-tone]`）——首选官方「实验性」签
 *             （`[data-plugin-package]` 行里 `[data-tone="info"]`，它带官方那个只声明尺寸的哈希类
 *             `statusTag`：`height:18px;padding:0 7px;font-size:10px;line-height:1`，见同文件 `:1569`／`:1692`）。
 *        官方**任何一条**变了（改属性名、改标签语义、去掉实验性签），失效表现是**不显示这枚签**：
 *        **不报错、不留半成品、不动官方任何一行**，只记一条 warn。绝不做「找不到就退化成自绘 span」这种
 *        半成品——那样坏的是官方页面的观感与本插件「官方 UI 零分叉」的纪律。
 *        「不显示」有两种，**分得清**：不在官方插件页（或官方那块面板还在 `aria-busy="true"` 加载）＝正常，静默；
 *        面板在、也不在加载，却找不到我们那一行／插入点／官方 Tag 实物＝**官方结构变了**，记一条 warn（同一
 *        实例同一原因只记一次，观察器不刷屏）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ENTERPRISE_MARKET_BADGE_TEXT,
  ENTERPRISE_MARKET_ENTRY_ID,
  ENTERPRISE_MARKET_ENTRY_LABEL,
} from './marketplace-entry.js'

/**
 * 官方列表里我们那一行的稳定标记：官方 `ItemCard` 把 `item.id` 写在 `data-plugin-item` 上
 * （`dsh-client-ui-plugin-manager/lib/client.js:2086`），故 `plugin-market` 那一行是唯一命中项。
 * 注意 `data-plugin-item-detail`（详情页那个 `div`）是**另一个属性名**，不会被这个选择器命中。
 */
export const ENTERPRISE_MARKET_ROW_SELECTOR = '[data-plugin-item="plugin-market"]'

/** 我们插入的那枚签身上的归属标记：幂等判定（同一条行只插一枚）与卸载清理（`dispose`）的唯一抓手。 */
export const ENTERPRISE_MARKET_BADGE_ATTRIBUTE = 'data-enterprise-market-badge'

/** 官方列表里「实验性」签的实物选择器：官方 `PackageCard` 行里 tone=info 的那一枚就是 beta 签。 */
const OFFICIAL_STATUS_TAG_SELECTOR = '[data-plugin-package] [data-tone="info"]'

/**
 * 官方插件页面板的标记（`dsh-client-ui-plugin-manager/lib/client.js:3209` 的 `"data-plugin-panel": true`）。
 * 只用来区分「**不在**这个页面」（静默，不是失败）与「**在这个页面上**但找不到我们那一行」（官方行标记变了 ⇒ 记 warn）。
 * 面板在加载时带 `aria-busy="true"`，那时行还没出来，同样静默——不然每次开页都白记一条。
 */
const OFFICIAL_PANEL_SELECTOR = '[data-plugin-panel]'

/**
 * 退路样本：页面上**任意一枚**官方 `Tag` 原语渲染物（`span[data-tone]`），但排除我们自己插的和我们自己
 * React 渲染的（详情页 `plugins.detail.badge` 的 `.own-market-tag`）——把官方实物改 tone 成 `info` 就是
 * 「官方 Tag 原语 + tone=info」，尺寸/圆角/边距仍逐像素来自官方那个哈希 `statusTag` 类。
 */
const OFFICIAL_TAG_FALLBACK_SELECTOR =
  'span[data-tone]:not([data-enterprise-market-badge]):not(.own-market-tag)'

/** 官方 `CardHead` 里的标题按钮（官方只给 `type="button"`，我们那一行的 `ItemCard` 不传 `end`，故没有别的按钮）。 */
const TITLE_BUTTON_SELECTOR = 'button[type="button"]'

/**
 * 一次铺签的结果（可测对象，不抛异常）：
 *  · `present` —— 该行已经有一枚我们的签（幂等命中，什么也没做）；
 *  · `cloned-status-tag` —— 克隆了官方「实验性」签实物（首选路径，逐像素一致）；
 *  · `cloned-official-tag` —— 官方「实验性」签不在场，退到页面上另一枚官方 Tag 实物并改 tone=info（已记 warn）；
 *  · `not-on-page` —— 官方插件列表里没有我们那一行（**不是**失败：可能只是没打开这个页面，或官方还在加载，静默）；
 *                    装饰句柄 `dispose()` 之后再调 `apply` 也恒返回它（已停，不再动作、也不再插）。
 *  · `row-missing` —— 官方插件页面板在、也不在加载中，却找不到我们那一行（官方行标记变了：已记 warn，不插）；
 *  · `anchor-missing` —— 行在，但找不到「标题按钮 / 它的父节点 titleRow」这一对插入点（已记 warn，不插）；
 *  · `sample-missing` —— 行在、插入点在，但页面上连一枚官方 Tag 实物都没有（已记 warn，不插——宁可没有签）。
 */
export type EnterpriseMarketBadgeApplyResult =
  | 'present'
  | 'cloned-status-tag'
  | 'cloned-official-tag'
  | 'not-on-page'
  | 'row-missing'
  | 'anchor-missing'
  | 'sample-missing'

/** 装饰句柄：`apply` 幂等可反复调，`dispose` 停观察 + 摘掉我们插的那枚签（官方的签一个都不动）。 */
export interface EnterpriseMarketBadgeDecoration {
  /** 铺一次签（幂等）；观察器每次变化也走它。 */
  apply(): EnterpriseMarketBadgeApplyResult
  /** 停观察 + 移除我们插入的全部签节点；可反复调。 */
  dispose(): void
}

/** `startEnterpriseMarketBadgeDecoration` 的可注入面（只为可测：测试用自造 domOutline 与假观察器替掉宿主实现）。 */
export interface EnterpriseMarketBadgeDecorationOptions {
  /** warn 出口；客户端传 `ctx.logger.warn`，缺席退 `console.warn`——失败绝不静默。 */
  readonly warn?: ((message: string) => void) | undefined
  /** 订阅文档变化（官方切页/刷新/路由变化会整块重渲染）；返回退订。缺席用全局/CSP 视角下的 `MutationObserver`。 */
  readonly observe?: ((onChange: () => void) => () => void) | undefined
}

/** 收集铺签需要的那几个 DOM 事实；纯读，不改任何东西。 */
interface EnterpriseMarketBadgeAnchor {
  readonly titleRow: Element
  readonly titleButton: Element
}

/** 在**已经定位到的那一行**里找「标题按钮 + 它的父节点（官方 titleRow）」这一对；任何一个对不上都返回 null（宁可不插）。 */
function resolveEnterpriseMarketBadgeAnchor(row: Element): EnterpriseMarketBadgeAnchor | null {
  const titleButton = row.querySelector(TITLE_BUTTON_SELECTOR)
  if (titleButton === null) return null
  // 标题按钮必须真的是「标题」：官方 `CardHead` 把它渲染成 `children: title`，所以正文就是条目 label。
  if ((titleButton.textContent ?? '').trim() !== ENTERPRISE_MARKET_ENTRY_LABEL) return null
  const titleRow = titleButton.parentElement
  // 父节点不能就是那一行本身（官方结构变了、按钮不再裹在 titleRow 里时必须放弃，不能插到行根上）。
  if (titleRow === null || titleRow === row) return null
  return { titleRow, titleButton }
}

/** 官方签实物的选择：首选「实验性」签，其次任意一枚官方 Tag（退路要在 warn 里如实说清）。 */
function resolveEnterpriseMarketBadgeSample(doc: Document):
  { readonly node: Element; readonly kind: 'status' | 'fallback' } | null {
  const statusTag = doc.querySelector(OFFICIAL_STATUS_TAG_SELECTOR)
  if (statusTag !== null) return { node: statusTag, kind: 'status' }
  const fallbackTag = doc.querySelector(OFFICIAL_TAG_FALLBACK_SELECTOR)
  if (fallbackTag !== null) return { node: fallbackTag, kind: 'fallback' }
  return null
}

/**
 * 铺一次签（幂等、纯动作、不抛）：只往**我们那一行**的 `titleRow` 里、标题按钮的**正后方**插一枚克隆自官方
 * Tag 实物的节点，把文本换成「企业」。返回结果联合，失败记 warn（同一实例内同一原因只记一条，避免观察器刷屏）。
 */
export function decorateEnterpriseMarketBadge(
  doc: Document,
  warn: (message: string) => void,
  warned: Set<string> = new Set<string>(),
): EnterpriseMarketBadgeApplyResult {
  const warnOnce = (key: string, message: string): void => {
    if (warned.has(key)) return
    warned.add(key)
    warn(message)
  }
  const row = doc.querySelector(ENTERPRISE_MARKET_ROW_SELECTOR)
  if (row === null) {
    const panel = doc.querySelector(OFFICIAL_PANEL_SELECTOR)
    // 没打开官方插件页、或官方那块面板还在加载（`aria-busy="true"`）——都不是失败，静默。
    if (panel === null || panel.getAttribute('aria-busy') === 'true') return 'not-on-page'
    warnOnce(
      'row-missing',
      `企业标签未显示：官方插件页在，但找不到我们那一行的 \`${ENTERPRISE_MARKET_ROW_SELECTOR}\` 行标记（官方行标记可能已改）。`,
    )
    return 'row-missing'
  }
  const anchor = resolveEnterpriseMarketBadgeAnchor(row)
  if (anchor === null) {
    warnOnce(
      'anchor-missing',
      '企业标签未显示：官方插件列表里那一行的标题按钮/titleRow 结构已变（无法定位「插件市场」的标题正后方）。',
    )
    return 'anchor-missing'
  }
  // 幂等：同一条行只插一枚（观察器与重复调用都会走到这里）。
  if (anchor.titleRow.querySelector(`[${ENTERPRISE_MARKET_BADGE_ATTRIBUTE}]`) !== null) return 'present'
  const sample = resolveEnterpriseMarketBadgeSample(doc)
  if (sample === null) {
    warnOnce(
      'sample-missing',
      '企业标签未显示：页面上找不到官方 Tag 实物（官方「实验性」签不在场，也没有别的官方 Tag 可克隆）。',
    )
    return 'sample-missing'
  }
  if (sample.kind === 'fallback') {
    warnOnce(
      'sample-fallback',
      '企业标签改用退路样式：官方「实验性」签不在场，已克隆页面上另一枚官方 Tag 实物并把 tone 改为 info（尺寸仍来自官方 statusTag 类）。',
    )
  }
  const node = sample.node.cloneNode(true) as Element
  // 官方 `Tag` 的调色只由 `data-tone` + 官方 CSS 决定；退路样本要把 tone 掰成 info，首选样本本来就是 info。
  node.setAttribute('data-tone', 'info')
  node.textContent = ENTERPRISE_MARKET_BADGE_TEXT
  node.setAttribute(ENTERPRISE_MARKET_BADGE_ATTRIBUTE, ENTERPRISE_MARKET_ENTRY_ID)
  // 插在标题按钮**正后方**（`nextSibling` 为 null 时等价于 append，即标题行末尾）。
  anchor.titleRow.insertBefore(node, anchor.titleButton.nextSibling)
  return sample.kind === 'status' ? 'cloned-status-tag' : 'cloned-official-tag'
}

/** 摘掉我们插入的全部签节点；官方自己的签一个都不碰。 */
export function removeEnterpriseMarketBadge(doc: Document): void {
  const nodes = doc.querySelectorAll(`[${ENTERPRISE_MARKET_BADGE_ATTRIBUTE}]`)
  for (let index = 0; index < nodes.length; index += 1) nodes[index]?.remove()
}

/**
 * 默认观察器：订阅 `document.body` 的子树结构变化。宿主没有 `MutationObserver`（例如纯 Node 环境）时退成
 * 空退订——此时装饰仍会在 `start` 里铺一次，只是不再跟随重渲染。
 */
function observeDocumentMutations(doc: Document, onChange: () => void): () => void {
  const view = doc.defaultView as (Document['defaultView'] & { MutationObserver?: typeof MutationObserver }) | null
  const ctor = view?.MutationObserver ?? (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver
  if (typeof ctor !== 'function') return () => undefined
  const target = doc.body ?? doc.documentElement
  if (target === null) return () => undefined
  const observer = new ctor(() => { onChange() })
  observer.observe(target, { childList: true, subtree: true })
  return () => { observer.disconnect() }
}

/**
 * 唯一入口：先在当前官方列表上铺一次签，然后盯着文档结构变化——官方**每次重渲染**（切页签/刷新/路由来回）都
 * 会重建卡片，故必须每次重建后重新铺；我们自己的插入也会触发一次变化，但那时幂等判定会直接命中 `present`，
 * 不会重复插、也不会自激。返回的 `dispose` 停观察并摘掉我们插的签。
 *
 * @param doc - 宿主 `document`（测试传自造 domOutline 的假 document）。
 * @param options - warn 出口与可注入的观察器（默认走宿主 `MutationObserver`）。
 * @returns 幂等 `apply` + `dispose` 的装饰句柄。
 */
export function startEnterpriseMarketBadgeDecoration(
  doc: Document,
  options: EnterpriseMarketBadgeDecorationOptions = {},
): EnterpriseMarketBadgeDecoration {
  const warn = options.warn ?? ((message: string): void => { console.warn(message) })
  const warned = new Set<string>()
  let stopped = false
  const apply = (): EnterpriseMarketBadgeApplyResult => {
    if (stopped) return 'not-on-page'
    return decorateEnterpriseMarketBadge(doc, warn, warned)
  }
  // 先铺一次，再开始观察（顺序反过来的话，首次插入会立刻换来一次无意义的变化通知）。
  apply()
  const unobserve = (options.observe ?? (onChange => observeDocumentMutations(doc, onChange)))(
    () => { apply() },
  )
  return {
    apply,
    dispose: (): void => {
      if (stopped) return
      stopped = true
      unobserve()
      removeEnterpriseMarketBadge(doc)
    },
  }
}
