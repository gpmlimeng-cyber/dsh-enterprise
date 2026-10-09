/**
 * [INPUT]: 依赖新叶 `esc/esc-connector-plaza.tsx`（四态取数源 / 卡片 / 纯投影 / 文案）、`list-state` 的共享状态机、
 *          `local-api` 的 `createEnterpriseLocalApi` 与路径常量、`local-api-decode` 的严格解码与键集常量、
 *          `enterprise-card-text` 的「企业/官方」签、`esc-card` 的唯一图标格，以及本刀**涉及到的每一个源文件**
 *          的原文（源码级反向锁）；无 DOM（自造最小树遍历，官方原语按元素身份取证）
 * [OUTPUT]: 本刀（Phase C D1：连接器广场）的七条锁，逐条可执行——
 *          ① **数据源只打那条本机路由**：本刀涉及的每一个源文件里、原文（含注释）都**零**出现平台那条
 *             连接器目录路径；新路由相对字面量全 `src` **恰好一处**、导出常量逐字等于冻结契约、
 *             运行时打的是 `GET /enterprise/api/v1/local/connectors`（GET + no-store，无正文）；
 *             全 `src` 零 `/api/mcp` 字面量（那三条只在宿主的内部许可表里）；
 *          ② **四态互斥 + 失败可重试 + 两句空话**：界面只出一个 `data-esc-connector-state`；
 *             失败态 = 唯一提示组件（带稳定码）+ 一枚**真的重发**的重试（`requests()` 逐次记账）；
 *             空态按宿主那枚 `complete` 分**两句不同**的话（真没有 / 读不到）；
 *          ③ **卡片投影逐格**：`description`/`icon`/`toolCount` 缺哪个**整格不画**（不写空壳、不编占位）；
 *             元信息一行三格都由真数据派生；`official === true` 才出官方签（复用唯一那枚 `Tag` 渲染）；
 *          ④ **`complete === false` 原样**：解码与四态都逐字保留 `false`（不许折成 `true`、不许当失败），
 *             就绪态另有一句可见交代；
 *          ⑤ **禁用动作带可见原因且没有 `onClick`**（结构事实：那个键在元素 props 上**根本不存在**），
 *             端口类型上**一个写方法都没有**（D2 才是写入口）；
 *          ⑥ **界面零配置面**（反向锁）：响应多带 `mcpConfig`/`deployedConfig`/`serverConfig`/`url`/
 *             `creatorId`/`uid` 任一键**整份判畸形**（不是悄悄透传），且全 `src` 对这几个键零引用；
 *          ⑦ **不新增 fetch/路由**：新叶不 `fetch`、不拼任何 `/api/...`、不 import 任何 `decodeEnterprise*`，
 *             取数只经注入端口；解码/收发各只有一处实现（`local-api-decode.ts` / `local-api.ts`）。
 * [POS]: 连接器广场的机械门禁 —— 把"这一格的数据面换了、卡片逐格派生、写入口还不存在"从口号变成可执行断言。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement, type ReactNode } from 'react'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { ENTERPRISE_MARKET_BADGE_TEXT } from '../src/enterprise-card-text.js'
import {
  EnterpriseEscCardIcon,
} from '../src/esc/esc-card.js'
import {
  ENTERPRISE_CONNECTOR_DEPLOY_PREFIX,
  ENTERPRISE_CONNECTOR_EMPTY_NONE,
  ENTERPRISE_CONNECTOR_EMPTY_UNREAD,
  ENTERPRISE_CONNECTOR_ENABLE_LOCK,
  ENTERPRISE_CONNECTOR_ENABLE_TEXT,
  ENTERPRISE_CONNECTOR_FAILED_PREFIX,
  ENTERPRISE_CONNECTOR_FILTERED,
  ENTERPRISE_CONNECTOR_INCOMPLETE,
  ENTERPRISE_CONNECTOR_LOADING,
  ENTERPRISE_CONNECTOR_OFFICIAL_TEXT,
  ENTERPRISE_CONNECTOR_TOOL_SUFFIX,
  ENTERPRISE_CONNECTOR_UNWIRED,
  EnterpriseEscConnectorCard,
  EnterpriseEscConnectorPlazaView,
  createEnterpriseConnectorPlazaSource,
  enterpriseConnectorCompleteNote,
  enterpriseConnectorDeployText,
  enterpriseConnectorEmptyNote,
  enterpriseConnectorEnablePlan,
  enterpriseConnectorMatches,
  enterpriseConnectorMetaLine,
  enterpriseConnectorMetaParts,
  enterpriseConnectorVisibleItems,
} from '../src/esc/esc-connector-plaza.js'
import {
  ENTERPRISE_CONNECTOR_CATALOG_KEYS,
  ENTERPRISE_CONNECTOR_MAX_CONNECTORS,
  ENTERPRISE_CONNECTOR_MAX_SPACES,
  ENTERPRISE_CONNECTOR_OPTIONAL_KEYS,
  ENTERPRISE_CONNECTOR_REQUIRED_KEYS,
  ENTERPRISE_CONNECTOR_SPACE_KEYS,
  decodeEnterpriseConnectors,
  type EnterpriseConnectorCatalog,
  type EnterpriseConnectorItem,
} from '../src/local-api-decode.js'
import {
  ENTERPRISE_CONNECTOR_LOCAL_PATH,
  EnterpriseLocalApiError,
  createEnterpriseLocalApi,
} from '../src/local-api.js'
import {
  ENTERPRISE_ERROR_CODES,
  enterpriseErrorAction,
  enterpriseErrorMessage,
  enterpriseErrorRetryable,
} from '../src/error-messages.js'
import { EnterpriseErrorNotice } from '../src/error-notice.js'
import { ENTERPRISE_LIST_RETRY, ENTERPRISE_LIST_RETRY_LABEL } from '../src/list-state.js'

// 官方原语包在本仓不可直接加载（它依赖的 `clsx` 没进本包依赖树），既有 ui 测试一律 mock 掉它。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
  Modal: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Pill: vi.fn(),
}))

/** 一次取数的完成（取数源走的是 Promise 链，多让几个宏任务过去即可稳定观察）。 */
async function settle(times = 6): Promise<void> {
  for (let index = 0; index < times; index += 1) await new Promise(resolve => setTimeout(resolve, 0))
}

/** 一条连接器（**逐格可覆写**，缺省即契约必填那几格的真实形状）。 */
function item(overrides: Partial<EnterpriseConnectorItem> = {}): EnterpriseConnectorItem {
  return {
    id: 134,
    name: '启信慧眼',
    installType: 'marketplace',
    deployStatus: 'deployed',
    space: { id: 3, name: '数智化空间' },
    ...overrides,
  }
}

/** 一次盘点（与宿主出厂形状逐键同形）。 */
function catalog(overrides: Partial<EnterpriseConnectorCatalog> = {}): EnterpriseConnectorCatalog {
  return {
    connectors: [item()],
    complete: true,
    spaces: [{ id: 3, name: '数智化空间', ok: true, count: 1 }],
    ...overrides,
  }
}

/**
 * 遍历一棵 React 元素树（**不调用任何函数组件**）。
 *
 * ★与 `plugin-card.spec.ts` 的遍历助手**有意不同**：那边靠"调用函数组件"钻进子树，而本刀那枚图标件
 *   （`EnterpriseEscCardIcon`）持 `useState`（破图兜底），在没有渲染器时**直接调用它会抛**
 *   —— 故这里只走"元素 + 它的 props 对象"，函数组件一律当**叶子**，靠元素身份（`node.type`）取证。
 */
function walk(node: ReactNode, visit: (type: unknown, props: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  if (!isValidElement(node)) return
  const props = node.props as Record<string, unknown>
  visit(node.type, props)
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') walk(value as ReactNode, visit)
  }
}

/**
 * 收集某个 `className` **字面量**命中的元素 props（整串精确相等）。
 *
 * ★与 `byType` 分开：这一枚按**样式钩子**取（`className` 里的某一段），那一枚按**元素身份**取
 *   （官方 `Button`/`Tag` 的本体、自家图标件的函数本体）——两类判据混在一处就分不清"类名对"与"原语对"。
 */
function byClass(node: ReactNode, className: string): readonly Record<string, unknown>[] {
  const hits: Record<string, unknown>[] = []
  walk(node, (_type, props) => {
    const value = props['className']
    if (typeof value === 'string' && value.split(/\s+/).includes(className)) hits.push(props)
  })
  return hits
}

/** 收集元素身份命中的 props（官方 `Button`/`Tag` 与自家图标件都按**本体**取证，不看类名）。 */
function byType(node: ReactNode, type: unknown): readonly Record<string, unknown>[] {
  const hits: Record<string, unknown>[] = []
  walk(node, (nodeType, props) => {
    if (nodeType === type) hits.push(props)
  })
  return hits
}

/** 整棵树里的可见文本（字符串子节点）。 */
function textOf(node: ReactNode, acc: string[] = []): string {
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node))
    return acc.join('')
  }
  if (Array.isArray(node)) {
    for (const child of node) textOf(child, acc)
    return acc.join('')
  }
  if (!isValidElement(node)) return acc.join('')
  const props = node.props as Record<string, unknown>
  // 按 `children` 走（不回看其它 props 里的 React 元素）——「可见文本」只可能来自子节点。
  textOf(props['children'] as ReactNode, acc)
  return acc.join('')
}

/** 读 `src/**` 下的一个源文件（源码级判据用）。 */
function readSrc(name: string, dir = '../src/'): string {
  return readFileSync(new URL(`${dir}${name}`, import.meta.url), 'utf8')
}

/**
 * 全 `src`（递归）扫一遍：返回**命中该正则**的源文件相对路径（码元升序）。
 *
 * @param pattern - 判据正则。
 * @param strip - 为真时判据落在**剥掉注释后的代码**上（沿革注释里引用旧路径是正当的记录）。
 */
function filesMatching(pattern: RegExp, strip = false): readonly string[] {
  const hits: string[] = []
  const collect = (dir: URL, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, dir)
      const next = `${prefix}${entry.name}`
      if (entry.isDirectory()) { collect(child, `${next}/`); continue }
      if (!/\.tsx?$/.test(entry.name)) continue
      const text = readFileSync(child, 'utf8')
      if (pattern.test(strip ? stripComments(text) : text)) hits.push(next)
    }
  }
  collect(new URL('../src/', import.meta.url), '')
  return hits.sort()
}

/** 剥掉注释（源码级反向锁的判据落在**代码**上；沿革说明写在注释里是正当的）。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}

/** 本刀**涉及到的**源文件（相对 `src/`）——锁①与锁⑦的靶心就是这份清单，逐字钉住。 */
const TOUCHED_FILES = [
  'client.tsx',
  'enterprise-card-text.tsx',
  'esc/esc-aggregation.tsx',
  'esc/esc-card.tsx',
  'esc/esc-categories.ts',
  'esc/esc-connector-plaza.tsx',
  'esc/esc-entry.tsx',
  'esc/esc-list.ts',
  'esc/esc-page.tsx',
  'esc/esc-style.ts',
  'esc/esc-types.ts',
  'local-api-decode.ts',
  'local-api.ts',
] as const

describe('连接器广场 ① 数据源：只打那条本机路由（源码级 + 运行时）', () => {
  it('本刀涉及的每一个源文件里、原文（含注释）零出现平台那条连接器目录路径', () => {
    // 判据取**原文**而不是剥注释后的代码：这条路径在这台部署上"根本没有这个端点"，
    // 连一句"以前读过它"的沿革注释都不该留在本刀碰过的文件里（换了数据面就要换干净）。
    const platformPath = ['/api', 'connector', 'providers'].join('/')
    for (const name of TOUCHED_FILES) {
      expect(readSrc(name), `${name} 不该再出现平台那条连接器目录路径`).not.toContain(platformPath)
    }
  })

  it('新路由的相对字面量全 `src` 恰好一处、导出常量逐字等于冻结契约', () => {
    // 冻结契约：`GET /enterprise/api/v1/local/connectors`（宿主注册面 `bundle/src/connector-plaza.ts`）。
    expect(ENTERPRISE_CONNECTOR_LOCAL_PATH).toBe('/enterprise/api/v1/local/connectors')
    const quoted = (readSrc('local-api.ts').match(/'\/connectors'/g) ?? []).length
    expect(quoted, '相对路径字面量只许在 local-api.ts 里出现一次').toBe(1)
    // 全 `src`：**代码**（剥注释后）里没有第二个文件出现过这条路径 —— 注释里写"本机那条 exact 只读路由"
    // 是沿革说明，不算拼接；真正能拼出第二条请求的只可能是代码。
    expect(filesMatching(/\/connectors/, true)).toEqual(['local-api.ts'])
  })

  it('运行时打的是 GET /enterprise/api/v1/local/connectors（无正文、no-store）且严格解码', async () => {
    const calls: { readonly url: string; readonly init: RequestInit | undefined }[] = []
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { connectors: [item()], complete: false, spaces: [] } }),
      } as unknown as Response
    })
    const signal = new AbortController().signal
    const result = await createEnterpriseLocalApi(fetcher as unknown as typeof fetch).connectors(signal)
    expect(calls[0]!.url).toBe('/enterprise/api/v1/local/connectors')
    // GET 是 fetch 的默认方法，故 init 里**不写** method（与既有几条只读路由同一口径）。
    expect(calls[0]!.init?.method).toBeUndefined()
    expect(calls[0]!.init?.cache).toBe('no-store')
    expect(calls[0]!.init?.signal).toBe(signal)
    expect(calls[0]!.init?.body).toBeUndefined()
    // `complete:false` 原样收下（锁④的第一半）。
    expect(result.complete).toBe(false)
    expect(result.connectors).toHaveLength(1)
  })

  it('全 `src` 零平台 MCP 路径字面量：那几条只在宿主的内部许可表里', () => {
    expect(filesMatching(/\/api\/mcp/)).toEqual([])
  })
})

describe('连接器广场 ② 四态取数：互斥 / 失败真重试 / 两句空话', () => {
  it('四态只出一个 `data-esc-connector-state`（含端口缺席那一态）', async () => {
    const stateOf = (tree: ReactNode): readonly unknown[] =>
      byClass(tree, 'esc-connector').map(props => props['data-esc-connector-state'])

    const failed = view({ state: { kind: 'failed', code: 'ENT_CONNECTOR_PLAZA_UNAVAILABLE' } })
    expect(stateOf(failed)).toEqual(['failed'])

    const loading = view({ state: { kind: 'loading' } })
    expect(stateOf(loading)).toEqual(['loading'])
    expect(textOf(loading)).toContain(ENTERPRISE_CONNECTOR_LOADING)

    const empty = view({ state: { kind: 'empty', value: catalog({ connectors: [], complete: true }) } })
    expect(stateOf(empty)).toEqual(['empty'])

    const ready = view({ state: { kind: 'ready', value: catalog() } })
    expect(stateOf(ready)).toEqual(['ready'])

    const unwired = EnterpriseEscConnectorPlazaView({ state: { kind: 'loading' }, keyword: '', wired: false, onRetry: () => undefined })
    // ★端口缺席**压过**任何取数态（那种情形下一条请求都不该发过）。
    expect(stateOf(unwired)).toEqual(['unwired'])
    expect(textOf(unwired)).toContain(ENTERPRISE_CONNECTOR_UNWIRED)
  })

  it('失败态：唯一提示组件（带稳定码）+ 一枚真的重发的重试', async () => {
    const code = 'ENT_CONNECTOR_PLAZA_UNAVAILABLE'
    const onRetry = vi.fn()
    const tree = view({ state: { kind: 'failed', code }, onRetry })
    // 唯一提示组件：官方 `Tag` 之外，失败块里那枚按钮就是重试（它带同一份无障碍名与文案）。
    const retry = byType(tree, Button)
    expect(retry).toHaveLength(1)
    expect(retry[0]!['aria-label']).toBe(ENTERPRISE_LIST_RETRY_LABEL)
    expect(retry[0]!['children']).toBe(ENTERPRISE_LIST_RETRY)
    ;(retry[0]!['onClick'] as () => void)()
    expect(onRetry).toHaveBeenCalledTimes(1)
    // 稳定码**原样**交给唯一提示件（界面上只出人话 + 稳定码，不重写码）。
    expect(JSON.stringify(tree)).toContain(code)
    // 呈现来自**唯一**码表：人话 + 下一步都不含裸码，且这一枚是可重试的（与那枚真重发的按钮一致）。
    expect(ENTERPRISE_ERROR_CODES).toContain(code)
    expect(enterpriseErrorMessage(code)).not.toMatch(/ENT_/)
    expect(enterpriseErrorAction(code)).not.toMatch(/ENT_/)
    expect(enterpriseErrorRetryable(code)).toBe(true)
    // 那枚提示件是**唯一**的失败呈现（纯函数，可直接调用取证它的正文）。
    const notice = byType(tree, EnterpriseErrorNotice)
    expect(notice).toHaveLength(1)
    expect(notice[0]!['code']).toBe(code)
    expect(notice[0]!['prefix']).toBe(ENTERPRISE_CONNECTOR_FAILED_PREFIX)
    const noticeText = textOf(EnterpriseErrorNotice(notice[0] as never))
    expect(noticeText).toContain(enterpriseErrorMessage(code))
    expect(noticeText).toContain(enterpriseErrorAction(code))
    // 失败态不出任何卡片。
    expect(byClass(tree, 'esc-connector')).toHaveLength(1)
  })

  it('★重试真的重发：拿真取数源数请求轮次（失败 → 重试 → 再失败仍可再试）', async () => {
    const catalogValue = catalog()
    let fail = true
    const calls: AbortSignal[] = []
    const source = createEnterpriseConnectorPlazaSource({
      catalog: async (signal) => {
        calls.push(signal)
        if (fail) throw new EnterpriseLocalApiError('ENT_CONNECTOR_PLAZA_UNAVAILABLE')
        return catalogValue
      },
    })
    expect(source.getSnapshot()).toEqual({ kind: 'loading' })
    source.load()
    await settle()
    expect(source.requests()).toBe(1)
    expect(source.getSnapshot()).toEqual({ kind: 'failed', code: 'ENT_CONNECTOR_PLAZA_UNAVAILABLE' })
    // ★点重试**真的**再发一次（不是重画一下）：请求轮次 +1、状态立刻回到进行中。
    source.retry()
    expect(source.getSnapshot()).toEqual({ kind: 'loading' })
    await settle()
    expect(source.requests()).toBe(2)
    expect(source.getSnapshot()).toEqual({ kind: 'failed', code: 'ENT_CONNECTOR_PLAZA_UNAVAILABLE' })
    // 失败后仍可再试；这次成功 ⇒ 就绪（并真的拿到了那一份）。
    fail = false
    source.retry()
    await settle()
    expect(source.requests()).toBe(3)
    expect(source.getSnapshot()).toEqual({ kind: 'ready', value: catalogValue })
    // 每次取数都带一枚**新**的 signal（前一次被中止）——离开这一格即由 `reset()` 收尾。
    expect(new Set(calls).size).toBe(3)
    // `load()` 幂等：已有结果时不再发第二条。
    source.load()
    await settle()
    expect(source.requests()).toBe(3)
  })

  it('空态两句**不同**的「为什么空」，判据是宿主那枚 `complete`', async () => {
    expect(enterpriseConnectorEmptyNote(true)).toBe(ENTERPRISE_CONNECTOR_EMPTY_NONE)
    expect(enterpriseConnectorEmptyNote(false)).toBe(ENTERPRISE_CONNECTOR_EMPTY_UNREAD)
    // 两句是两件事（值不同），且都不含裸码。
    expect(ENTERPRISE_CONNECTOR_EMPTY_NONE).not.toBe(ENTERPRISE_CONNECTOR_EMPTY_UNREAD)
    expect(ENTERPRISE_CONNECTOR_EMPTY_NONE).not.toMatch(/ENT_/)
    expect(ENTERPRISE_CONNECTOR_EMPTY_UNREAD).not.toMatch(/ENT_/)

    const none = view({ state: { kind: 'empty', value: catalog({ connectors: [], complete: true }) } })
    expect(byClass(none, 'esc-connector').map(props => props['data-esc-connector-empty'])).toEqual(['none'])
    expect(textOf(none)).toContain(ENTERPRISE_CONNECTOR_EMPTY_NONE)

    const unread = view({ state: { kind: 'empty', value: catalog({ connectors: [], complete: false }) } })
    expect(byClass(unread, 'esc-connector').map(props => props['data-esc-connector-empty'])).toEqual(['unread'])
    expect(textOf(unread)).toContain(ENTERPRISE_CONNECTOR_EMPTY_UNREAD)

    // 空态也留一枚真重试（"读不到"那一句的正当下一步就是再读一次）。
    expect(byType(none, Button)).toHaveLength(1)
  })

  it('端口缺席时**一条请求都不发**（取数源交出 undefined ⇒ 判空），且不假装"一台都没有"', async () => {
    const source = createEnterpriseConnectorPlazaSource(undefined)
    source.load()
    await settle()
    expect(source.requests()).toBe(1)
    expect(source.getSnapshot()).toEqual({ kind: 'empty', value: undefined })
    // 但界面上那一态由 `wired: false` 先挡掉 —— 画的是"还没接通"，不是"企业没配"。
    const tree = EnterpriseEscConnectorPlazaView({ state: source.getSnapshot(), keyword: '', wired: false, onRetry: () => undefined })
    expect(textOf(tree)).toContain(ENTERPRISE_CONNECTOR_UNWIRED)
    expect(textOf(tree)).not.toContain(ENTERPRISE_CONNECTOR_EMPTY_NONE)
  })
})

describe('连接器广场 ③ 卡片投影：逐格派生、缺哪个整格不画', () => {
  it('标题恒画；描述缺席（含空串/纯空白）⇒ 整格不进 DOM（不写空壳、不写"暂无描述"）', () => {
    const bare = byClass(EnterpriseEscConnectorCard({ item: item() }), 'esc-card-headdesc')
    // 这一格是**唯一**候选：按原语标签收集（`esc-card-headdesc` 是 `p`）。
    expect(bare).toHaveLength(0)
    const withText = byClass(EnterpriseEscConnectorCard({ item: item({ description: '一键查企业风险。' }) }), 'esc-card-headdesc')
    expect(withText).toHaveLength(1)
    expect(withText[0]!['children']).toBe('一键查企业风险。')
    const blank = byClass(EnterpriseEscConnectorCard({ item: item({ description: '   ' }) }), 'esc-card-headdesc')
    expect(blank).toHaveLength(0)
  })

  it('图标那一格恒是代理 + 兜底那一枚（有地址原样交下去；缺席交 undefined ⇒ 画兜底图形、绝不破图）', () => {
    const withIcon = byType(EnterpriseEscConnectorCard({ item: item({ icon: 'https://cdn.example/a.png' }) }), EnterpriseEscCardIcon)
    expect(withIcon).toHaveLength(1)
    expect(withIcon[0]!['icon']).toBe('https://cdn.example/a.png')
    expect(withIcon[0]!['shape']).toBe('square')
    const without = byType(EnterpriseEscConnectorCard({ item: item() }), EnterpriseEscCardIcon)
    expect(without).toHaveLength(1)
    expect(without[0]!['icon']).toBeUndefined()
    // 卡片自己**不造** `<img>`：破图兜底只在那枚图标件里（全仓唯一一份，见 `esc-card.tsx`）。
    expect(byType(EnterpriseEscConnectorCard({ item: item({ icon: 'https://cdn.example/a.png' }) }), 'img')).toHaveLength(0)
  })

  it('元信息一行三格都由真数据派生，缺哪个少画哪个（installType / N 个工具 / 所属空间名）', () => {
    expect(enterpriseConnectorMetaParts(item({ toolCount: 3 })))
      .toEqual(['marketplace', `3${ENTERPRISE_CONNECTOR_TOOL_SUFFIX}`, '数智化空间'])
    expect(enterpriseConnectorMetaLine(item({ toolCount: 3 })))
      .toBe(`marketplace · 3${ENTERPRISE_CONNECTOR_TOOL_SUFFIX} · 数智化空间`)
    // `toolCount` 缺席 ⇒ **少画那一格**（不是画 "0 个工具"、也不是画占位）。
    expect(enterpriseConnectorMetaLine(item())).toBe('marketplace · 数智化空间')
    expect(enterpriseConnectorMetaParts(item())).toHaveLength(2)
    // 空白 `installType` / 空白空间名 ⇒ 各自那一格不画（三格全空 ⇒ 整行不进 DOM）。
    expect(enterpriseConnectorMetaLine(item({ installType: '   ', space: { id: 3, name: ' ' } }))).toBeUndefined()
    const line = byClass(EnterpriseEscConnectorCard({ item: item({ toolCount: 3 }) }), 'esc-card-meta')
    expect(line).toHaveLength(1)
    expect(line[0]!['children']).toBe(`marketplace · 3${ENTERPRISE_CONNECTOR_TOOL_SUFFIX} · 数智化空间`)
    expect(byClass(EnterpriseEscConnectorCard({ item: item({ installType: ' ', space: { id: 3, name: '' } }) }), 'esc-card-meta'))
      .toHaveLength(0)
  })

  it('`official === true` 才出官方签（复用唯一那枚 `Tag` 渲染；缺席与 false 都不出、都不当官方）', () => {
    const official = byType(EnterpriseEscConnectorCard({ item: item({ official: true }) }), Tag)
    expect(official).toHaveLength(1)
    expect(official[0]).toEqual({ className: 'own-market-tag', tone: 'info', children: ENTERPRISE_CONNECTOR_OFFICIAL_TEXT })
    // 措辞与「企业」签**同族但不同词**（两枚签各自说清来源），且官方公开面之外一个属性都不给。
    expect(ENTERPRISE_CONNECTOR_OFFICIAL_TEXT).not.toBe(ENTERPRISE_MARKET_BADGE_TEXT)
    for (const value of [undefined, false]) {
      expect(byType(EnterpriseEscConnectorCard({ item: item({ official: value }) }), Tag)).toHaveLength(0)
    }
  })

  it('`deployStatus` **原值**上屏（带 `data-esc-connector-deploy` 钩子）：不编同义词表、不藏起来', () => {
    expect(enterpriseConnectorDeployText('deployed')).toBe(`${ENTERPRISE_CONNECTOR_DEPLOY_PREFIX}deployed`)
    const deploy = byClass(EnterpriseEscConnectorCard({ item: item({ deployStatus: 'undeployed' }) }), 'esc-card-lock')
    // 两条 `esc-card-lock`：部署那行 + 启用动作的可见原因那行。
    expect(deploy).toHaveLength(2)
    expect(deploy[0]!['data-esc-connector-deploy']).toBe('undeployed')
    expect(textOf(EnterpriseEscConnectorCard({ item: item({ deployStatus: 'undeployed' }) })))
      .toContain(`${ENTERPRISE_CONNECTOR_DEPLOY_PREFIX}undeployed`)
  })

  it('搜索词那一筛：命中名字或描述、大小写不敏感；筛空另出一句（**不是**第五种态）', () => {
    expect(enterpriseConnectorMatches(item(), '启信')).toBe(true)
    expect(enterpriseConnectorMatches(item({ description: 'Risk Check' }), 'risk')).toBe(true)
    expect(enterpriseConnectorMatches(item(), '不存在')).toBe(false)
    expect(enterpriseConnectorMatches(item(), '  ')).toBe(true)
    const filtered = enterpriseConnectorVisibleItems(catalog({ connectors: [item(), item({ id: 135, name: '钉钉' })] }), '钉钉')
    expect(filtered.map(each => each.id)).toEqual([135])
    const tree = view({ state: { kind: 'ready', value: catalog({ connectors: [item()] }) }, keyword: '钉钉' })
    expect(textOf(tree)).toContain(ENTERPRISE_CONNECTOR_FILTERED)
    expect(byClass(tree, 'esc-connector').map(props => props['data-esc-connector-state'])).toEqual(['ready'])
  })
})

describe('连接器广场 ④ `complete === false` 原样呈现（不许折成 true、不许当失败）', () => {
  it('解码逐字保留 false；就绪态另出一句可见交代；true 时整段不画', () => {
    const decoded = decodeEnterpriseConnectors({ connectors: [], complete: false, spaces: [] })
    expect(decoded.complete).toBe(false)
    expect(enterpriseConnectorCompleteNote(false)).toBe(ENTERPRISE_CONNECTOR_INCOMPLETE)
    expect(enterpriseConnectorCompleteNote(true)).toBeUndefined()
    const incomplete = view({ state: { kind: 'ready', value: catalog({ complete: false }) } })
    const notes = byClass(incomplete, 'esc-catalog-degraded')
    expect(notes).toHaveLength(1)
    expect(notes[0]!['data-esc-connector-incomplete']).toBe('true')
    expect(textOf(incomplete)).toContain(ENTERPRISE_CONNECTOR_INCOMPLETE)
    // ★它**不是**失败：失败态才出唯一提示件 + 重试；这一态照旧把清单铺出来。
    expect(byClass(incomplete, 'esc-list-section')).toHaveLength(1)
    expect(byClass(incomplete, 'esc-connector').map(props => props['data-esc-connector-state'])).toEqual(['ready'])
    const complete = view({ state: { kind: 'ready', value: catalog({ complete: true }) } })
    expect(byClass(complete, 'esc-catalog-degraded')).toHaveLength(0)
    expect(textOf(complete)).not.toContain(ENTERPRISE_CONNECTOR_INCOMPLETE)
  })

  it('取数源把 `complete:false` 原样带进就绪态（不在这一层折成 true）', async () => {
    const value = catalog({ complete: false })
    const source = createEnterpriseConnectorPlazaSource({ catalog: async () => value })
    source.load()
    await settle()
    const state = source.getSnapshot()
    expect(state.kind).toBe('ready')
    expect(state.kind === 'ready' ? state.value.complete : undefined).toBe(false)
  })
})

describe('连接器广场 ⑤ 禁用动作：带可见原因、没有 onClick（结构事实）', () => {
  it('动作终态恒禁用 + 恒有可见原因，且没有 `onClick` 这一格', () => {
    const plan = enterpriseConnectorEnablePlan(item())
    expect(plan.disabled).toBe(true)
    expect(plan.text).toBe(ENTERPRISE_CONNECTOR_ENABLE_TEXT)
    expect(plan.reason).toBe(ENTERPRISE_CONNECTOR_ENABLE_LOCK)
    expect(plan.title).toBe(ENTERPRISE_CONNECTOR_ENABLE_LOCK)
    expect(Object.keys(plan)).not.toContain('onClick')
    // "说人话、不含裸码"：原因那句里一个 `ENT_` 都没有。
    expect(ENTERPRISE_CONNECTOR_ENABLE_LOCK).not.toMatch(/ENT_/)
  })

  it('卡片上那枚按钮：官方 `Button` 本体、disabled、**props 里没有 onClick**、旁边一行可见原因', () => {
    const tree = EnterpriseEscConnectorCard({ item: item() })
    const buttons = byType(tree, Button)
    expect(buttons).toHaveLength(1)
    const button = buttons[0]!
    expect(button['disabled']).toBe(true)
    expect(button['children']).toBe(ENTERPRISE_CONNECTOR_ENABLE_TEXT)
    // ★结构事实：那个键**根本不存在**（不是"挂了一个不会被调的回调"）。
    expect('onClick' in button).toBe(false)
    expect(Object.keys(button)).not.toContain('onClick')
    expect(button['title']).toBe(ENTERPRISE_CONNECTOR_ENABLE_LOCK)
    expect(String(button['aria-label'])).toContain(ENTERPRISE_CONNECTOR_ENABLE_LOCK)
    expect(String(button['className'])).toContain('esc-connector-enable')
    const locks = byClass(tree, 'esc-card-lock')
    expect(locks).toHaveLength(2)
    expect(locks[1]!['data-esc-connector-enable-lock']).toBe('true')
    expect(locks[1]!['role']).toBe('status')
    expect(locks[1]!['children']).toBe(ENTERPRISE_CONNECTOR_ENABLE_LOCK)
  })

  it('端口类型上**一个写方法都没有**（D1 不做启用/断开 ⇒ 写入口在类型层就不可表达）', () => {
    const types = readSrc('esc/esc-types.ts')
    const port = /export interface EnterpriseEscConnectorPort \{([\s\S]*?)\n\}/.exec(types)
    expect(port, 'esc-types.ts 里找不到 EnterpriseEscConnectorPort').not.toBeNull()
    const body = stripComments(port![1]!)
    // 端口上**逐个成员名**取证：只有 `catalog` 一枚（类型文本里出现 "Connector" 这类字不算法）。
    const members = [...body.matchAll(/readonly\s+([A-Za-z0-9_]+)\s*\??:/g)].map(match => match[1])
    expect(members).toEqual(['catalog'])
    // 全 `src`：本刀没有为连接器写任何第二条本机动作路径。
    const plaza = stripComments(readSrc('esc/esc-connector-plaza.tsx'))
    expect(plaza).not.toContain('onClick: plan')
    expect(plaza.match(/port\./g) ?? []).toHaveLength(1)
    expect(plaza).toContain('port === undefined ? undefined : await port.catalog(signal)')
  })
})

describe('连接器广场 ⑥ 界面零配置面（反向锁：多带一个键整份判畸形）', () => {
  it('行 / 空间 / 顶层三处键集常量与宿主出厂形状逐键同值', () => {
    expect([...ENTERPRISE_CONNECTOR_REQUIRED_KEYS]).toEqual(['id', 'name', 'installType', 'deployStatus', 'space'])
    expect([...ENTERPRISE_CONNECTOR_OPTIONAL_KEYS]).toEqual(['description', 'icon', 'official', 'toolCount'])
    expect([...ENTERPRISE_CONNECTOR_SPACE_KEYS]).toEqual(['id', 'name', 'ok', 'count'])
    expect([...ENTERPRISE_CONNECTOR_CATALOG_KEYS]).toEqual(['connectors', 'complete', 'spaces'])
    // 有界两枚与宿主 `ENTERPRISE_CONNECTOR_MAX_{SPACES,CONNECTORS}` 逐字同值。
    expect(ENTERPRISE_CONNECTOR_MAX_SPACES).toBe(64)
    expect(ENTERPRISE_CONNECTOR_MAX_CONNECTORS).toBe(1000)
  })

  it('配置面六键：多带任一键**整份判畸形**，绝不当成"忽略未知键"透传', () => {
    for (const key of ['mcpConfig', 'deployedConfig', 'serverConfig', 'url', 'headers', 'permissions', 'creatorId', 'uid']) {
      const row = { ...item(), [key]: 'x' }
      expect(
        () => decodeEnterpriseConnectors({ connectors: [row], complete: true, spaces: [] }),
        `行多带 ${key} 必须整份判畸形`,
      ).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
      expect(
        () => decodeEnterpriseConnectors({ connectors: [], complete: true, spaces: [], [key]: 'x' }),
        `顶层多带 ${key} 必须整份判畸形`,
      ).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    }
    const space = { id: 3, name: '数智化空间', ok: true, count: 1, url: 'https://x' }
    expect(() => decodeEnterpriseConnectors({ connectors: [], complete: true, spaces: [space] }))
      .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
  })

  it('全 `src` 对配置面那几个键零引用（剥注释后；界面连"读它"这件事都做不到）', () => {
    expect(filesMatching(/mcpConfig|deployedConfig|serverConfig|creatorId/, true)).toEqual([])
  })

  it('严格解码的真值表：必填缺一即畸形、可选形状不对即畸形、可选缺席即**不给键**', () => {
    expect(decodeEnterpriseConnectors({ connectors: [], complete: true, spaces: [] }))
      .toEqual({ connectors: [], complete: true, spaces: [] })
    // 必填五格逐一缺席（不是只测一个）。
    for (const key of ENTERPRISE_CONNECTOR_REQUIRED_KEYS) {
      const row: Record<string, unknown> = { ...item() }
      delete row[key]
      expect(() => decodeEnterpriseConnectors({ connectors: [row], complete: true, spaces: [] }), `缺 ${key}`)
        .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    }
    // 可选四格形状不对（空串也算）：整份判畸形。
    for (const [key, bad] of [['description', ''], ['icon', ''], ['official', 'true'], ['toolCount', -1], ['toolCount', 1.5]] as const) {
      expect(
        () => decodeEnterpriseConnectors({ connectors: [{ ...item(), [key]: bad }], complete: true, spaces: [] }),
        `${key}=${String(bad)}`,
      ).toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    }
    // `complete` 不是布尔即畸形（它是布尔时**原样**收下）。
    expect(() => decodeEnterpriseConnectors({ connectors: [], complete: 'false', spaces: [] }))
      .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
    // 可选四格**全员缺席** ⇒ 解出来的对象里**没有**这四个键（"没说"与"说空"分得开）。
    const bare = decodeEnterpriseConnectors({ connectors: [item()], complete: true, spaces: [] }).connectors[0]!
    expect(Object.keys(bare).sort()).toEqual(['deployStatus', 'id', 'installType', 'name', 'space'])
    // 两处上限：超一条即畸形。
    expect(() => decodeEnterpriseConnectors({ connectors: [], complete: true, spaces: new Array(65).fill({ id: 1, name: 'a', ok: true, count: 0 }) }))
      .toThrowError(/ENT_LOCAL_RESPONSE_INVALID/)
  })
})

describe('连接器广场 ⑦ 不新增 fetch / 路由 / 取数器', () => {
  it('新叶：不 fetch、不拼 `/api/...`、不 import 解码器；取数只经注入端口', () => {
    const code = stripComments(readSrc('esc/esc-connector-plaza.tsx'))
    expect(code).not.toContain('fetch(')
    expect(code).not.toMatch(/['"`]\/api\//)
    expect(code).not.toContain('/enterprise/api/v1/local')
    expect(code).not.toContain('decodeEnterprise')
    expect(code).toContain("from '../list-state.js'")
    // 四态那台状态机只在这里出现一次（它就是"唯一取数器"的调用点）。
    expect(code.match(/createEnterpriseListSource[<(]/g)).toHaveLength(1)
    expect(code).toContain('createEnterpriseListSource<EnterpriseConnectorCatalog | undefined>({')
  })

  it('接线：esc 那一侧只多一枚端口、`client.tsx` 复用同一枚 `createEnterpriseLocalApi()` 实例', () => {
    const client = stripComments(readSrc('client.tsx'))
    expect(client).toContain('const escSkillApi = createEnterpriseLocalApi()')
    expect(client).toContain('catalog: signal => escSkillApi.connectors(signal),')
    expect(client).not.toContain("'/connectors'")
    const entry = stripComments(readSrc('esc/esc-entry.tsx'))
    expect(entry).toContain('inject: () => ({ api, skillPort, draftPort, connectorPort }),')
    const page = stripComments(readSrc('esc/esc-page.tsx'))
    expect(page).toContain('connectorPort,')
    const agg = readSrc('esc/esc-aggregation.tsx')
    // 聚合层只接线：端口原样转交（缺席即不给那个键），自己**不**建第二个取数器。
    expect(agg).toContain('...(connectorPort === undefined ? {} : { port: connectorPort }),')
    expect(stripComments(agg)).not.toMatch(/createEnterpriseListSource\(/)
  })

  it('取数面：`connectors` 只有一处实现、响应交同一个严格解码器', () => {
    const api = stripComments(readSrc('local-api.ts'))
    // 相对段的三处：定义一次、导出常量拼一次、`connectors` 那一格引用一次。
    expect(api.match(/CONNECTOR_PLAZA_PATH/g)).toHaveLength(3)
    expect(api).toContain('requestJson(CONNECTOR_PLAZA_PATH, getInit(signal), fetcher)')
    expect(api).toContain('decodeEnterpriseConnectors(')
    const decode = stripComments(readSrc('local-api-decode.ts'))
    expect(decode.match(/export function decodeEnterpriseConnectors\(/g)).toHaveLength(1)
  })

  it('连接器页另外两格一字未动（团队空间 / 已连接的仍走平台那条目录面）', () => {
    const list = stripComments(readSrc('esc/esc-list.ts'))
    expect(list).toContain("scope: 'space'")
    expect(list).toContain("connected: 'true'")
    /**
     * ★**那一格的平台取数一格都不发**：`load` 里那条短路必须**在查适配器之前**（在发请求之前返回），
     *   而不是"取回来不用"——判据取两处的**先后位次**，故把短路挪到适配器查找之后也会红。
     */
    expect(list).toContain('if (resourceType === \'connector\' && source === \'system\') return')
    expect(list.indexOf("if (resourceType === 'connector' && source === 'system') return"))
      .toBeLessThan(list.indexOf('const adapter = adapters[resourceType][source]'))
    /**
     * 分类字典那三处短路：本刀只加了"连接器 × 系统广场"那一格（另外两枚维度一支不动）。
     * ★判据取**整块**短路语句（不是那个条件表达式本身）：条件还出现在下面那个 `useMemo` 里，
     *   只 `toContain` 条件会让"把短路块整段删掉"照样全绿（本刀自证时实测过一次，故收紧）。
     */
    const categories = stripComments(readSrc('esc/esc-categories.ts'))
    expect(categories).toContain([
      "    if (resourceType === 'connector' && source === 'system') {",
      '      setItems([])',
      '      setUnavailable(false)',
      '      return () => { active = false }',
      '    }',
    ].join('\n'))
    expect(categories).toContain("if (source === 'third-party')")
    expect(categories).toContain("if (source === 'catalog')")
    // 那一格的条件在两处（短路块 + `useMemo` 的空数组判定）——多一处就是多一个判据点。
    expect(categories.match(/resourceType === 'connector' && source === 'system'/g)).toHaveLength(2)
  })
})

/** 便捷构造一次视图调用（只覆盖需要的那几格）。 */
function view(input: {
  readonly state: Parameters<typeof EnterpriseEscConnectorPlazaView>[0]['state']
  readonly keyword?: string
  readonly onRetry?: () => void
}): ReactNode {
  return EnterpriseEscConnectorPlazaView({
    state: input.state,
    keyword: input.keyword ?? '',
    wired: true,
    onRetry: input.onRetry ?? (() => undefined),
  })
}
