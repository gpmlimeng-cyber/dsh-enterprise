/**
 * [INPUT]: 依赖 `esc-catalog.ts`（纯事实层：卡片投影 / 已装判定键 / 二级 chip / 四态投影 / 【＋】终态）、
 *   `esc-catalog-list.tsx`（纯渲染层 + 有状态包装）、`esc-card.tsx`（卡片本体）、`esc-toolbar.tsx`（维度行）、
 *   `esc-copy.ts`、`error-notice.tsx` 与 `skill-api-decode.ts` 的两份包投影类型，以及 `src` 的源码文本
 * [OUTPUT]: 锁定**口径 53**（技能卡片真的能装）的界面半边七条：① 维度行**恰好四枚**且逐字含顺序
 *   （含专家/连接器页的反锁）；② 卡片【＋】的**可用性判据**（企业技能维度可用 / 系统广场维度**仍禁用
 *   且带行上可见原因**，把"临时接一条假路径"钉死）；③ 安装动作**复用**既有端口（源码级：本刀不出现
 *   第二个 `fetch(` / 自造 decode；`/skills/install` 全仓只有一个调用点）；④ 已装判定走 **`packageId`
 *   精确命中**（不是按名字猜）；⑤ 在途禁双击、**不乐观翻态**、成功以 Host 清单为准、失败走唯一提示
 *   组件 + 稳定码且**可重试**；⑥ 成功后**触发计数刷新**（同一枚 refresh token）；⑦ 四态互斥 +
 *   两句不同的"为什么空"
 * [POS]: 口径 53 界面半边的机械门禁——把"哪一维、这枚【＋】能不能点、为什么不能点、装完信谁、
 *   失败落在哪、空是哪一种空"钉在**纯函数与源码**两层（本仓 vitest 无 DOM，故不碰真渲染器）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * ★官方原语在本仓**不是**运行期依赖（发行时用宿主的共享实例），而 `devDependency` 那份的
 * `Button` 在**导入期**就会 `import 'clsx'`（那个包不在本仓依赖里）⇒ 直接 import 呈现层会在
 * "收集测试"阶段就炸。与 `tests/esc-third-party.spec.ts` 同一条手法：整模块替身化 ——
 * 本文件要测的是我们自己的**投影与结构**（那些元素收到哪些 props），不是官方原语自己的渲染。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: 'button',
  Pill: 'button',
  Input: 'input',
  // `official-ui.ts` 在**模块求值**时就把这几枚取出来，故替身里必须给它们一个值。
  Menu: 'div',
  MenuItemButton: 'button',
  IconEllipsisOutlineMedium: 'span',
  IconSettingsOutlineMedium: 'span',
  IconUserOutlineMedium: 'span',
  IconLoadingOutlineMedium: 'span',
  // `skill-market.tsx`（口径 53 复用的那一枚取数源所在的文件）在模块顶 import 了这两枚。
  Modal: 'div',
  Switch: 'span',
  Tag: 'span',
}))

import { ENTERPRISE_ERROR_TECH_ATTR } from '../src/error-notice.js'
import { EnterpriseErrorNotice } from '../src/error-notice.js'
import { ENTERPRISE_SKILL_LIST_EMPTY, ENTERPRISE_SKILL_LIST_LOADING, ENTERPRISE_SKILL_LIST_NO_MATCH } from '../src/skill-market.js'
import type { EnterpriseInstalledSkill, EnterpriseRuntimeSkill } from '../src/skill-api-decode.js'
/**
 * ★**本刀（技能页性能）**：`EnterpriseEscCard` 现在是 `memo` 包出来的那一枚（对象，不是函数）
 *   —— 既有那批"纯函数直调取渲染树"的用例改调它的**内层**那一枚 `EnterpriseEscCardView`
 *   （渲染语义逐字同一份）；`.type` 那几条结构锁仍对着 `EnterpriseEscCard`（元素类型就是它）。
 */
import { EnterpriseEscCard, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import {
  ENTERPRISE_CATALOG_BLOCKED_BY_BUSY,
  ENTERPRISE_CATALOG_EMPTY,
  ENTERPRISE_CATALOG_EMPTY as CATALOG_EMPTY,
  ENTERPRISE_CATALOG_FAILED_PREFIX,
  ENTERPRISE_CATALOG_INSTALL,
  ENTERPRISE_CATALOG_INSTALLING,
  ENTERPRISE_CATALOG_INSTALL_FAILED_PREFIX,
  ENTERPRISE_CATALOG_INSTALL_NOT_PORTED,
  ENTERPRISE_CATALOG_NO_MATCH,
  enterpriseCatalogActionPlan,
  enterpriseCatalogFace,
  enterpriseCatalogInstalledPackages,
  enterpriseCatalogItem,
  enterpriseCatalogItems,
  enterpriseCatalogSubChips,
} from '../src/esc/esc-catalog.js'
import { EnterpriseEscCatalogList } from '../src/esc/esc-catalog-list.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from '../src/esc/esc-copy.js'
import { EnterpriseEscToolbar } from '../src/esc/esc-toolbar.js'
import { enterpriseEscSubTabs } from '../src/esc/esc-sub-tabs.js'
import type { EnterpriseSkillListPayload } from '../src/skill-market.js'

/* ══════════════ 夹具与树工具 ══════════════ */

type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
const asElement = (node: unknown) => node as Element
const childrenOf = (element: Element): unknown[] => {
  const children = element.props['children']
  return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
}
function walk(node: unknown, out: Element[] = []): Element[] {
  if (Array.isArray(node)) {
    for (const each of node) walk(each, out)
    return out
  }
  if (node === null || node === undefined || node === false) return out
  if (typeof node !== 'object') return out
  const element = node as Element
  out.push(element)
  return walk(element.props['children'], out)
}
/** 按类名找第一处（判据是类名，不是第几层）。 */
function findByClass(node: unknown, className: string): Element | undefined {
  return walk(node).find(each => each.props['className'] === className)
}
/** 按类名找全部。 */
function allByClass(node: unknown, className: string): Element[] {
  return walk(node).filter(each => each.props['className'] === className)
}
/**
 * 按**类名 token** 找（`className` 里空格分隔的其中一枚）。
 *
 * 官方 `Button` 那一档会把调用方给的类名与自己的类拼在一起（`esc-action-solid esc-try-now`），
 * 故"这枚元素有没有某个 token"才是判据；按整串相等去比会漏掉它。
 */
function classTokens(element: Element): string[] {
  const raw = element.props['className']
  return typeof raw === 'string' ? raw.split(' ').filter(each => each.length > 0) : []
}
function byClassToken(node: unknown, token: string): Element | undefined {
  return walk(node).find(each => classTokens(each).includes(token))
}
/**
 * 树里的**卡片元素**。
 *
 * ★为什么要单列这一条：`EnterpriseEscCard` 是**组件**（本刀起它是 `memo` 那一枚：`createElement` 的
 *   `type` 就是这个 memo 对象本身，故这里的 `===` 照旧成立），
 *   按 `children` 往下走**进不去它的输出**（那要真渲染器）。本仓 vitest 没有 DOM，
 *   故这一类判据的落点是"交给它的 props 是什么"——这也正是纯渲染层能被测到的边界。
 */
function cardsIn(node: unknown): Element[] {
  return walk(node).filter(each => each.type === EnterpriseEscCard)
}

/** 剥注释：源码级反向锁的判据落在**代码**上（注释里写沿革、引类名是正当的记录）。 */
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
function readSrc(name: string, dir = '../src/esc/'): string {
  return stripComments(readFileSync(new URL(`${dir}${name}`, import.meta.url), 'utf8'))
}

/** 一条企业技能包（真机字段形状：`GET /skills` 返回的那一份）。 */
function runtimeSkill(overrides: Partial<EnterpriseRuntimeSkill> = {}): EnterpriseRuntimeSkill {
  return {
    id: '2105915576743428098',
    skillId: 'interactive-architecture-diagram',
    displayName: '架构图一键生成',
    description: '把一句话变成一张架构图',
    category: '效率工具',
    builtin: false,
    sourceDshVersion: 'skillhub.cn/dev-expert@2.0.3',
    sizeBytes: 87_898,
    skillCount: 3,
    updatedAt: '2026-10-01T00:00:00Z',
    versionId: '2105915576743429000',
    skills: [],
    ...overrides,
  }
}
/** 一条本机已装记录（`GET /skills/installed` 里的那一份；`packageId` 与目录那条的 `id` **同一个键**）。 */
function installedSkill(overrides: Partial<EnterpriseInstalledSkill> = {}): EnterpriseInstalledSkill {
  return {
    packageId: '2105915576743428098',
    skillId: 'interactive-architecture-diagram',
    displayName: '架构图一键生成',
    versionId: '2105915576743429000',
    sha256: 'a'.repeat(64),
    names: ['interactive-architecture-diagram'],
    installedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}
function payload(
  items: readonly EnterpriseRuntimeSkill[],
  installed: readonly EnterpriseInstalledSkill[] = [],
  installedCode?: string,
): EnterpriseSkillListPayload {
  return { items, installed, ...(installedCode === undefined ? {} : { installedCode }) }
}

/* ══════════════ ① 维度行 ══════════════ */

describe('口径 53：技能页维度行恰好四枚（系统广场 / 团队空间 / 本地三方 / 企业技能）', () => {
  const labelsOf = (resourceType: 'expert' | 'skill' | 'connector') => {
    const toolbar = asElement(EnterpriseEscToolbar({
      resourceType,
      source: 'system',
      onSourceChange: () => undefined,
      categories: [],
      activeCategory: '',
      onCategoryChange: () => undefined,
      keyword: '',
      onKeywordChange: () => undefined,
    } as never))
    const row = findByClass(toolbar, 'esc-source-tabs')
    expect(row, `维度行（${resourceType}）`).toBeTruthy()
    return childrenOf(row as Element).map(node => asElement(node).props['children'])
  }

  it('技能页逐字且按序四枚（企业技能排最后）；专家页两枚；连接器页第三枚仍是「已连接的」', () => {
    // ★**本刀收尾重新基线化（用户裁决：第四枚的名字与来源都换）**：第四个字符串由「企业技能」
    //   换成 `SkillHub`（用户原话「那一枚的名字与来源都换」）。★**不是放宽**：判据形状一字未改
    //   （仍是逐字 + 顺序 + 恰好四枚 —— 少一枚、多一枚、换位次都当场红），前三枚的位次也一字未动。
    //   ★「企业技能」**维度整枚撤掉**，但它的内容不丢：「应用商店 → 企业技能」与企业设置两处照旧；
    //     那一面的**代码**本刀按 ① 明令不动，故 `mainTabCatalog` 那一格文案**照旧留着**（下面仍在锁）。
    expect(labelsOf('skill')).toEqual(['系统广场', '团队空间', '本地三方', 'SkillHub'])
    expect(labelsOf('skill')).toHaveLength(4)
    expect(ENTERPRISE_ESC_COPY.mainTabSkillHub).toBe('SkillHub')
    expect(ENTERPRISE_ESC_COPY.mainTabCatalog).toBe('企业技能')
    // ★反锁：这两枚页专属维度**都不许**出现在专家页/连接器页。
    for (const other of ['expert', 'connector'] as const) {
      expect(labelsOf(other), other).not.toContain('本地三方')
      expect(labelsOf(other), other).not.toContain('SkillHub')
      // ★本刀收尾加强：撤掉的那一枚**也不许**回来（否则就是"维度又长出一枚"）。
      expect(labelsOf(other), other).not.toContain('企业技能')
    }
    // ★回归锁：专家页仍是两枚；连接器页第三枚仍是「已连接的」（且仍排最后）。
    expect(labelsOf('expert')).toEqual(['系统广场', '团队空间'])
    expect(labelsOf('connector')).toEqual(['系统广场', '团队空间', '已连接的'])
  })

  it('SkillHub 那一枚的悬浮说明与页内说明同源（一个英文专名读不出"从哪来、装什么"）', () => {
    const toolbar = asElement(EnterpriseEscToolbar({
      resourceType: 'skill',
      source: 'system',
      onSourceChange: () => undefined,
      categories: [],
      activeCategory: '',
      onCategoryChange: () => undefined,
      keyword: '',
      onKeywordChange: () => undefined,
    } as never))
    const pills = childrenOf(findByClass(toolbar, 'esc-source-tabs') as Element)
    // ★本刀收尾：第四枚换成 `SkillHub` 之后同判（一个英文专名更读不出"从哪来、装什么"）——
    //   完整说法与页内说明句同源（同一格 `skillHubSourceTitle`）。
    expect(asElement(pills[3]).props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.skillHubTabTitle)
    expect(String(asElement(pills[3]).props['title'])).toContain(ENTERPRISE_ESC_LOCAL_COPY.skillHubSourceTitle)
    // 前两枚仍不挂 title（四个字已经说全了）。
    expect(asElement(pills[0]).props['title']).toBeUndefined()
    expect(asElement(pills[1]).props['title']).toBeUndefined()
  })
})

/* ══════════════ ④ 卡片投影 + 已装判定（packageId 精确命中）══════════════ */

describe('口径 53：卡片投影（ResourceItem）与已装判定（packageId 精确命中）', () => {
  it('投影逐字段：id 带前缀 / packageId 是原样中心坐标 / 描述 / 元信息（版本·大小·技能数）', () => {
    const item = enterpriseCatalogItem(runtimeSkill())
    // 呈现键带前缀（与另几维同一条约定，避免跨维度撞 key），而**回传宿主**的那枚是原样 packageId。
    expect(item.id).toBe('catalog-2105915576743428098')
    expect(item.packageId).toBe('2105915576743428098')
    expect(item.name).toBe('架构图一键生成')
    expect(item.description).toBe('把一句话变成一张架构图')
    expect(item.category).toBe('效率工具')
    // 元信息＝复用设置页那一枚（来源 DSH 版本 · 大小 · 内含技能数）——两处逐字同源，不各写一份。
    expect(item.meta).toBe('来源 DSH skillhub.cn/dev-expert@2.0.3 · 85.8 KiB · 3 个技能')
    // 目录响应里没有的东西**一格都不编**（图标/发布者/统计缺席 ⇒ 卡片不画那几格）。
    expect(item.icon).toBeUndefined()
    expect(item.publishUser).toBeUndefined()
    expect(item.stats).toBeUndefined()
    // 分类缺席 ⇒ 整个键不进投影（不是空串）。
    expect('category' in enterpriseCatalogItem(runtimeSkill({ category: undefined }))).toBe(false)
    // 顺序保持响应原序。
    const many = enterpriseCatalogItems([runtimeSkill({ id: 'p1' }), runtimeSkill({ id: 'p2' })])
    expect(many.map(each => each.packageId)).toEqual(['p1', 'p2'])
  })

  it('已装判定**只认 `packageId`**：同名不同包 ⇒ 未装；同包不同名 ⇒ 已装（按名字猜必红）', () => {
    const installed = enterpriseCatalogInstalledPackages([installedSkill({ packageId: 'p1' })])
    expect([...installed]).toEqual(['p1'])
    /**
     * ★这条用例就是"不许按名字猜"的机械判据：
     *   · 一条**名字对得上、包 id 对不上**的记录 —— 按名字判会误报"已装"，按 packageId 判是**未装**；
     *   · 一条**包 id 对得上、名字完全不同**的记录 —— 按名字判会漏报，按 packageId 判是**已装**。
     * 两枚卡片的 `installed` 位因此必须分别是 false / true。
     */
    const sameName: EnterpriseRuntimeSkill = runtimeSkill({ id: 'p1', displayName: '架构图一键生成' })
    const otherId: EnterpriseRuntimeSkill = runtimeSkill({ id: 'p2', displayName: '架构图一键生成' })
    const renamed: EnterpriseRuntimeSkill = runtimeSkill({ id: 'p1', displayName: '完全不同的名字' })
    const face = enterpriseCatalogFace({
      state: { kind: 'ready', value: payload([sameName, otherId, renamed], [installedSkill({ packageId: 'p1', displayName: '别的名字' })]) },
      keyword: '',
      category: '',
      installed: [installedSkill({ packageId: 'p1', displayName: '别的名字' })],
    })
    expect(face.kind).toBe('ready')
    expect(face.items.map(each => each.packageId !== undefined && face.installed.has(each.packageId)))
      .toEqual([true, false, true])
  })
})

/* ══════════════ ② 卡片【＋】的可用性判据 ══════════════ */

describe('口径 53：卡片【＋】的可用性判据（本维度可用 / 广场仍禁用 + 行上可见原因）', () => {
  const card = (props: Record<string, unknown>) => EnterpriseEscCardView({ item: enterpriseCatalogItem(runtimeSkill()) as never, ...props } as never)
  const plus = (tree: unknown): Element => {
    const found = findByClass(tree, 'esc-install-plus')
    expect(found, '那枚【＋】').toBeTruthy()
    return found as Element
  }
  const lockOf = (tree: unknown): Element | undefined => findByClass(tree, 'esc-card-lock')

  it('企业技能维度：给了安装计划 ⇒ 那枚【＋】**真的能点**（并真的把包 id 交出去）', () => {
    const onInstall = vi.fn()
    const tree = card({
      showUse: true,
      showTags: false,
      installed: false,
      install: {
        text: ENTERPRISE_CATALOG_INSTALL,
        disabled: false,
        title: '安装到本机 DSH（下载 + 校验 + 落盘，无需重启）',
        ariaLabel: `安装架构图一键生成`,
        onInstall,
      },
    })
    const button = plus(tree)
    expect(button.type).toBe('button')
    expect(button.props['disabled']).toBe(false)
    expect(button.props['title']).toBe('安装到本机 DSH（下载 + 校验 + 落盘，无需重启）')
    expect(button.props['aria-label']).toBe('安装架构图一键生成')
    expect(typeof button.props['onClick']).toBe('function')
    ;(button.props['onClick'] as () => void)()
    expect(onInstall).toHaveBeenCalledTimes(1)
    // 能点的时候**不画**那句原因（没有原因可写）。
    expect(lockOf(tree)).toBeUndefined()
    // 描述与元信息行都在（这一维度卡片的三段事实）。
    expect(findByClass(tree, 'esc-card-meta')!.props['children'])
      .toBe('来源 DSH skillhub.cn/dev-expert@2.0.3 · 85.8 KiB · 3 个技能')
  })

  it('系统广场维度（不给安装计划）：【＋】**仍禁用**，且原因**行上可见**（不是只挂 title）', () => {
    const tree = card({ showUse: true })
    const button = plus(tree)
    expect(button.props['disabled']).toBe(true)
    // 旧那枚 title 照旧（两处同源），但**这不是全部**——产品宪法要的是行上看得见的原因。
    expect(button.props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
    // ★"临时接一条假路径"被这条钉死：广场那批**没有** onClick（点了什么都不会发生）。
    expect(button.props['onClick']).toBeUndefined()
    const lock = lockOf(tree)
    expect(lock, '广场卡片的禁用原因必须行上可见').toBeTruthy()
    expect(lock!.props['role']).toBe('status')
    expect(lock!.props['children']).toBe(ENTERPRISE_ESC_LOCAL_COPY.skillInstallUnavailable)
    expect(lock!.props['data-esc-install-lock']).toBe('true')
    // 那句话说的是"没有可下载的技能包"（真实缺口），不是笼统的"未接入"。
    expect(String(lock!.props['children'])).toContain('没有可下载的技能包')
    expect(String(lock!.props['children'])).not.toBe(ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted)
  })

  it('已装那一档**根本不画【＋】**（改画「更多 + 去试试」），也不画禁用原因', () => {
    const tree = card({ showUse: true, installed: true })
    expect(findByClass(tree, 'esc-install-plus')).toBeUndefined()
    expect(lockOf(tree)).toBeUndefined()
    // 「去试试」仍在（本刀非目标④：不接线，故照旧置灰 + 写明原因）。
    const tryNow = byClassToken(tree, 'esc-try-now')
    expect(tryNow).toBeTruthy()
    expect(tryNow!.props['disabled']).toBe(true)
    expect(tryNow!.props['children']).toBe(ENTERPRISE_ESC_COPY.tryNow)
  })

  it('在途那一枚：禁用 + 文案「安装中…」**行上可见**（不是只挂在无障碍名里）', () => {
    const tree = card({
      showUse: true,
      showTags: false,
      installed: false,
      install: {
        text: ENTERPRISE_CATALOG_INSTALLING,
        disabled: true,
        busy: true,
        title: ENTERPRISE_CATALOG_INSTALLING,
        ariaLabel: ENTERPRISE_CATALOG_INSTALLING,
        onInstall: () => undefined,
      },
    })
    // 按钮确实禁用（禁双击），无障碍名也是那三个字 —— 但**这些都不够**：圆形图标钮里只有一个加号。
    const button = plus(tree)
    expect(button.props['disabled']).toBe(true)
    expect(button.props['aria-label']).toBe('安装中…')
    expect(button.props['title']).toBe('安装中…')
    // ★判据落在**上屏的文字**上：同一枚行上落点写的就是「安装中…」，且带稳定钩子与 role=status。
    const note = lockOf(tree)
    expect(note, '在途时那三个字必须真的写上屏').toBeTruthy()
    expect(note!.props['children']).toBe('安装中…')
    expect(note!.props['data-esc-install-busy']).toBe('true')
    expect(note!.props['role']).toBe('status')
  })

  it('非在途的三种禁用只写**各自的原因**，绝不冒出一句「安装中…」', () => {
    for (const reason of [ENTERPRISE_CATALOG_INSTALL_NOT_PORTED, ENTERPRISE_CATALOG_BLOCKED_BY_BUSY, ENTERPRISE_ESC_LOCAL_COPY.skillInstallUnavailable]) {
      const tree = card({
        showUse: true,
        // 广场那一档（不给计划）走的是同一条判据的第三支。
        ...(reason === ENTERPRISE_ESC_LOCAL_COPY.skillInstallUnavailable
          ? {}
          : { install: { text: ENTERPRISE_CATALOG_INSTALL, disabled: true, title: reason, ariaLabel: '安装X', reason, onInstall: () => undefined } }),
      })
      const note = lockOf(tree)!
      expect(note.props['children']).toBe(reason)
      expect(note.props['data-esc-install-busy']).toBeUndefined()
      expect(String(note.props['children'])).not.toContain('安装中')
    }
  })

  it('写入口缺席 / 另一枚在途：按钮禁用且**各自**写明原因（两句话必须不同）', () => {
    const notPorted = card({
      showUse: true,
      install: { text: ENTERPRISE_CATALOG_INSTALL, disabled: true, title: ENTERPRISE_CATALOG_INSTALL_NOT_PORTED, ariaLabel: '安装X', reason: ENTERPRISE_CATALOG_INSTALL_NOT_PORTED, onInstall: () => undefined },
    })
    expect(plus(notPorted).props['disabled']).toBe(true)
    expect(lockOf(notPorted)!.props['children']).toBe(ENTERPRISE_CATALOG_INSTALL_NOT_PORTED)
    const blocked = card({
      showUse: true,
      install: { text: ENTERPRISE_CATALOG_INSTALL, disabled: true, title: ENTERPRISE_CATALOG_BLOCKED_BY_BUSY, ariaLabel: '安装X', reason: ENTERPRISE_CATALOG_BLOCKED_BY_BUSY, onInstall: () => undefined },
    })
    expect(lockOf(blocked)!.props['children']).toBe(ENTERPRISE_CATALOG_BLOCKED_BY_BUSY)
    expect(lockOf(notPorted)!.props['children']).not.toBe(lockOf(blocked)!.props['children'])
  })
})

/* ══════════════ ⑤ 【＋】的终态（纯投影）══════════════ */

describe('口径 53：【＋】的按钮终态（在途 / 被挡 / 端口缺席 / 可点，四档互斥）', () => {
  it('四档各有自己的文案与可点性；在途那一枚的文案是「安装中…」且不给 reason', () => {
    const free = enterpriseCatalogActionPlan({ wired: true, packageId: 'p1', name: '甲' })
    expect(free.kind).toBe('install')
    expect(free.disabled).toBe(false)
    expect(free.text).toBe(ENTERPRISE_CATALOG_INSTALL)
    expect(free.ariaLabel).toBe('安装甲')
    expect(free.reason).toBeUndefined()

    const busySelf = enterpriseCatalogActionPlan({ wired: true, packageId: 'p1', name: '甲', busy: 'p1' })
    expect(busySelf.kind).toBe('this-busy')
    expect(busySelf.disabled).toBe(true)
    expect(busySelf.text).toBe(ENTERPRISE_CATALOG_INSTALLING)
    expect(busySelf.text).toBe('安装中…')
    // 在途那一枚不给 reason：按钮（与无障碍名）自己已经写着「安装中…」，再来一句就是重复。
    expect(busySelf.reason).toBeUndefined()

    const blocked = enterpriseCatalogActionPlan({ wired: true, packageId: 'p2', name: '乙', busy: 'p1' })
    expect(blocked.kind).toBe('blocked')
    expect(blocked.disabled).toBe(true)
    expect(blocked.reason).toBe(ENTERPRISE_CATALOG_BLOCKED_BY_BUSY)

    const notPorted = enterpriseCatalogActionPlan({ wired: false, packageId: 'p1', name: '甲' })
    expect(notPorted.kind).toBe('not-ported')
    expect(notPorted.disabled).toBe(true)
    expect(notPorted.reason).toBe(ENTERPRISE_CATALOG_INSTALL_NOT_PORTED)

    // 三条禁用原因两两不同（"这一枚在装 / 别的在装 / 没有接口"是三件不同的事实，补救动作也不同）。
    expect(new Set([
      ENTERPRISE_CATALOG_INSTALLING,
      ENTERPRISE_CATALOG_BLOCKED_BY_BUSY,
      ENTERPRISE_CATALOG_INSTALL_NOT_PORTED,
    ]).size).toBe(3)
  })
})

/* ══════════════ ⑦ 四态互斥 + 两句「为什么空」══════════════ */

describe('口径 53：四态互斥 + 两句不同的「为什么空」+ 二级 chip 行', () => {
  const at = (state: Parameters<typeof enterpriseCatalogFace>[0]['state'], keyword = '', category = '', installed: readonly EnterpriseInstalledSkill[] = []) =>
    enterpriseCatalogFace({ state, keyword, category, installed })

  it('loading / failed / empty / ready 四态各自只命中一档（绝不出现"空又不加载又无错误"）', () => {
    const loading = at({ kind: 'loading' })
    expect(loading.kind).toBe('loading')
    expect(loading.items).toEqual([])
    expect(loading.emptyNote).toBeUndefined()
    expect(loading.failedCode).toBeUndefined()
    expect(ENTERPRISE_SKILL_LIST_LOADING).toContain('企业技能')

    const failed = at({ kind: 'failed', code: 'ENT_SKILL_DOWNLOAD_FAILED' })
    expect(failed.kind).toBe('failed')
    expect(failed.failedCode).toBe('ENT_SKILL_DOWNLOAD_FAILED')
    expect(failed.items).toEqual([])
    // ★失败态**绝不回落空列表**：不带任何"为什么空"的说法（那是另一件事实，混起来就是撒谎）。
    expect(failed.emptyNote).toBeUndefined()
    expect('emptyNote' in failed).toBe(false)

    const ready = at({ kind: 'ready', value: payload([runtimeSkill()]) })
    expect(ready.kind).toBe('ready')
    expect(ready.items).toHaveLength(1)
    expect(ready.emptyNote).toBeUndefined()

    const empty = at({ kind: 'empty', value: payload([]) })
    expect(empty.kind).toBe('empty')
    expect(empty.noMatch).toBe(false)
    expect(empty.emptyNote).toBe(ENTERPRISE_CATALOG_EMPTY)
  })

  it('两句「为什么空」是两句不同的话，且按"目录本身空"还是"搜索没命中"选', () => {
    expect(ENTERPRISE_CATALOG_EMPTY).not.toBe(ENTERPRISE_CATALOG_NO_MATCH)
    // ① 目录本身就是空的（企业还没发布任何对当前账号可见的技能包）。
    expect(at({ kind: 'empty', value: payload([]) }).emptyNote).toBe(ENTERPRISE_SKILL_LIST_EMPTY)
    // ② 目录里有东西，是这次搜索没命中。
    const noMatch = at({ kind: 'ready', value: payload([runtimeSkill()]) }, '不存在的关键词')
    expect(noMatch.kind).toBe('empty')
    expect(noMatch.noMatch).toBe(true)
    expect(noMatch.emptyNote).toBe(ENTERPRISE_SKILL_LIST_NO_MATCH)
    expect(noMatch.items).toEqual([])
    // ③ 命中得到 ⇒ 就是就绪态，一句空话都不出。
    expect(at({ kind: 'ready', value: payload([runtimeSkill()]) }, '架构图').kind).toBe('ready')
  })

  it('次级取数降级**如实交码**（不静默：否则员工会把"读不到"读成"一枚都没装"）', () => {
    const degraded = at({ kind: 'ready', value: payload([runtimeSkill()], [], 'ENT_LOCAL_RESPONSE_INVALID') })
    expect(degraded.installedCode).toBe('ENT_LOCAL_RESPONSE_INVALID')
    expect(degraded.kind).toBe('ready')
    // 已装清单读不到 ⇒ 那一集合是空的（按"未装"画【＋】），但降级码必须交出去、由界面说出来。
    expect(degraded.installed.size).toBe(0)
    expect(at({ kind: 'ready', value: payload([runtimeSkill()]) }).installedCode).toBeUndefined()
  })

  it('二级 chip 行按**响应自己的 category** 投：缺席/空白不出 chip、按首次出现去重、不重排', () => {
    const skills = [
      runtimeSkill({ id: 'p1', category: '效率工具' }),
      runtimeSkill({ id: 'p2', category: undefined }),
      // 空白分类不是一个分类（那一条照旧铺在「全部」里，只是不配拥有一枚筛选项）。
      runtimeSkill({ id: 'p3', category: '   ' }),
      runtimeSkill({ id: 'p4', category: '研发' }),
      runtimeSkill({ id: 'p5', category: '效率工具' }),
    ]
    const chips = enterpriseCatalogSubChips(skills)
    expect(chips).toEqual([
      { key: '效率工具', label: '效率工具' },
      { key: '研发', label: '研发' },
    ])
    // 「全部」由 chip 那一套通用机制统一加（各维度不各写一份）。
    expect(enterpriseEscSubTabs({ chips, activeKey: '研发' }).chips.map(each => each.label))
      .toEqual(['全部', '效率工具', '研发'])
    // 选中的那枚**已经不在**这一排里 ⇒ 回落「全部」（不许留一个看不见的 key 继续筛）。
    expect(enterpriseEscSubTabs({ chips, activeKey: '已消失的分类' }).activeKey).toBe('')
    // 选某一枚 ⇒ 只剩那一类（缺席分类的条目归「全部」，选具体分类时不出现）。
    const scoped = at({ kind: 'ready', value: payload(skills) }, '', '研发')
    expect(scoped.items.map(each => each.packageId)).toEqual(['p4'])
    expect(at({ kind: 'ready', value: payload(skills) }, '', '').items).toHaveLength(5)
    // ★判据是**后端 category**：把那条空白分类归一成某个默认名会让 chips 多出一枚 ⇒ 红。
    expect(chips.map(each => each.key)).not.toContain('')
  })
})

/* ══════════════ 渲染层（纯函数直调）══════════════ */

describe('口径 53：「企业技能」内容区的纯渲染层（四态 + 每卡安装 + 失败归行）', () => {
  const render = (overrides: Record<string, unknown> = {}) => EnterpriseEscCatalogList({
    state: { kind: 'ready', value: payload([runtimeSkill({ id: 'p1' }), runtimeSkill({ id: 'p2', displayName: '代码评审' })]) },
    keyword: '',
    installed: [],
    wired: true,
    onInstall: () => undefined,
    onReload: () => undefined,
    ...overrides,
  } as never)

  it('四态各画各的（同一时刻只有一个 data-esc-catalog-state）；失败态给唯一提示组件 + 真重发', () => {
    const onReload = vi.fn()
    const loading = render({ state: { kind: 'loading' } })
    expect(findByClass(loading, 'esc-source-tabs')).toBeUndefined()
    const states = (tree: unknown) => walk(tree)
      .map(each => each.props['data-esc-catalog-state'])
      .filter((value): value is string => typeof value === 'string')
    expect(states(loading)).toEqual(['loading'])
    expect(findByClass(loading, 'esc-list-section')).toBeUndefined()

    const failed = render({ state: { kind: 'failed', code: 'ENT_SKILL_INSTALL_FAILED' }, onReload })
    expect(states(failed)).toEqual(['failed'])
    // 失败态**不铺卡片**、也不说"没有技能"（那是另一件事实）。
    expect(findByClass(failed, 'esc-list-section')).toBeUndefined()
    expect(findByClass(failed, 'esc-catalog-empty')).toBeUndefined()
    const notice = walk(failed).find(each => each.type === EnterpriseErrorNotice)
    expect(notice, '目录失败走唯一提示组件').toBeTruthy()
    expect(notice!.props['code']).toBe('ENT_SKILL_INSTALL_FAILED')
    expect(notice!.props['prefix']).toBe(ENTERPRISE_CATALOG_FAILED_PREFIX)
    // 重试按钮：点它**真的**调 onReload（不是重画一下）。
    const retry = findByClass(failed, 'esc-catalog-retry')!
    expect(retry.props['children']).toBe('重试')
    ;(retry.props['onClick'] as () => void)()
    expect(onReload).toHaveBeenCalledTimes(1)

    const empty = render({ state: { kind: 'empty', value: payload([]) }, onReload })
    expect(states(empty)).toEqual(['empty'])
    expect(findByClass(empty, 'esc-catalog-empty')!.props['data-esc-catalog-empty']).toBe('directory')
    expect(findByClass(empty, 'esc-catalog-empty')!.props['children']).toBe(ENTERPRISE_CATALOG_EMPTY)

    const noMatch = render({ keyword: '没有这一条', onReload })
    expect(states(noMatch)).toEqual(['empty'])
    expect(findByClass(noMatch, 'esc-catalog-empty')!.props['data-esc-catalog-empty']).toBe('no-match')
    expect(findByClass(noMatch, 'esc-catalog-empty')!.props['children']).toBe(ENTERPRISE_CATALOG_NO_MATCH)

    const ready = render()
    expect(states(ready)).toEqual(['ready'])
    expect(allByClass(ready, 'esc-catalog-cell')).toHaveLength(2)
  })

  it('每張未装卡都有一枚可点的【＋】，点它交出的正是那一枚 `packageId`（不是 id、不是名字）', () => {
    const calls: { readonly packageId: string; readonly name: string }[] = []
    const tree = render({ onInstall: (packageId: string, name: string) => { calls.push({ packageId, name }) } })
    const cells = allByClass(tree, 'esc-catalog-cell')
    expect(cells.map(each => each.props['data-esc-catalog-package'])).toEqual(['p1', 'p2'])
    const cards = cardsIn(tree)
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      const install = card.props['install'] as { readonly disabled: boolean; readonly onInstall: () => void } | undefined
      expect(install, '未装那一档必须拿到安装计划').toBeTruthy()
      expect(install!.disabled).toBe(false)
    }
    // 点第二张的【＋】⇒ 交出去的正是**那一枚 `packageId`**（`p2`）与那一行的名字；
    // 卡片自己的呈现键 `catalog-p2` **从不**回传。
    ;(cards[1]!.props['install'] as { readonly onInstall: () => void }).onInstall()
    expect(calls).toEqual([{ packageId: 'p2', name: '代码评审' }])
    // 没有失败就没有提示件（不挂一枚空的 alert）。
    expect(walk(tree).some(each => each.type === EnterpriseErrorNotice)).toBe(false)
  })

  it('已装那一张**不画【＋】**（packageId 精确命中）；其余照旧可点', () => {
    const tree = render({ installed: [installedSkill({ packageId: 'p1' })] })
    const cells = allByClass(tree, 'esc-catalog-cell')
    expect(cells).toHaveLength(2)
    expect(cells[0]!.props['data-esc-catalog-package']).toBe('p1')
    const cards = cardsIn(tree)
    // 已装那一张：`installed === true` **且没有**安装计划 ⇒ 卡片走「更多 + 去试试」那一支。
    expect(cards[0]!.props['installed']).toBe(true)
    expect(cards[0]!.props['install']).toBeUndefined()
    // 未装那一张：`installed === false` **且**有计划（可点）。
    expect(cards[1]!.props['installed']).toBe(false)
    expect((cards[1]!.props['install'] as { readonly disabled: boolean }).disabled).toBe(false)
  })

  it('在途：全表**只有那一枚**能识别出「安装中…」，其余按钮禁用且各自写明原因', () => {
    const tree = render({ pending: { id: 'p1', name: '架构图一键生成' } })
    const cards = cardsIn(tree)
    expect(cards).toHaveLength(2)
    // 在途那一枚（第一张卡）：文案/无障碍名/悬浮说明都切「安装中…」，且**没有**额外的原因行。
    const self = cards[0]!.props['install'] as { readonly disabled: boolean; readonly title: string; readonly ariaLabel: string; readonly busy: boolean; readonly reason?: string }
    expect(self.title).toBe(ENTERPRISE_CATALOG_INSTALLING)
    expect(self.ariaLabel).toBe(ENTERPRISE_CATALOG_INSTALLING)
    expect(self.disabled).toBe(true)
    // ★在途那一档的 `busy` 位必须立着（卡片据此把那三个字写上屏），且它**不**走 reason 那一支。
    expect(self.busy).toBe(true)
    expect(self.reason).toBeUndefined()
    // 别的枚：禁用 + **可见**原因（不是只挂 title），且**不**是「安装中…」。
    const other = cards[1]!.props['install'] as { readonly disabled: boolean; readonly busy: boolean; readonly reason?: string }
    expect(other.disabled).toBe(true)
    expect(other.busy).toBe(false)
    expect(other.reason).toBe(ENTERPRISE_CATALOG_BLOCKED_BY_BUSY)
    // 整块那一行句子说清"正在装谁"。
    const busy = findByClass(tree, 'esc-catalog-status')
    expect(busy!.props['data-esc-catalog-busy']).toBe('p1')
    expect(String(busy!.props['children'])).toContain('架构图一键生成')
  })

  it('失败只落在**那一行**上：唯一提示组件 + 稳定码 + 「技术信息」折叠，且重试真的重发', () => {
    const calls: string[] = []
    const tree = render({
      installError: { id: 'p2', code: 'ENT_SKILL_HASH_MISMATCH' },
      onInstall: (packageId: string) => { calls.push(packageId) },
    })
    const errorCells = allByClass(tree, 'esc-catalog-error')
    expect(errorCells).toHaveLength(1)
    expect(errorCells[0]!.props['data-esc-catalog-error']).toBe('p2')
    // 唯一提示组件：人话 + 下一步 + 「技术信息」里的稳定码（前缀说清这是安装失败）。
    const notice = walk(errorCells[0]).find(each => each.type === EnterpriseErrorNotice)!
    expect(notice.props['code']).toBe('ENT_SKILL_HASH_MISMATCH')
    expect(notice.props['prefix']).toBe(ENTERPRISE_CATALOG_INSTALL_FAILED_PREFIX)
    expect(ENTERPRISE_ERROR_TECH_ATTR).toBe('data-enterprise-error-code')
    // 可重试：那一行的重试按钮走的是**同一枚写入口**（同一枚包 id），不是重画一下。
    const retry = findByClass(errorCells[0], 'esc-catalog-retry')!
    ;(retry.props['onClick'] as () => void)()
    expect(calls).toEqual(['p2'])
    // 另一行不受影响（失败不扩散、也不禁用它）。
    const firstCard = cardsIn(tree)[0]!
    expect((firstCard.props['install'] as { readonly disabled: boolean }).disabled).toBe(false)
  })

  it('写入口缺席：按钮全部禁用 + 每张卡都写着原因（判据是端口，不写死 disabled）', () => {
    const tree = render({ wired: false })
    const cards = cardsIn(tree)
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      const install = card.props['install'] as { readonly disabled: boolean; readonly reason?: string }
      expect(install.disabled).toBe(true)
      expect(install.reason).toBe(ENTERPRISE_CATALOG_INSTALL_NOT_PORTED)
    }
  })

  it('刚成功那一句是 `role="status"`（可见、非打断）；次级降级那句也如实说出来', () => {
    const done = render({ installedNotice: '已安装「架构图一键生成」。' })
    const status = walk(done).find(each => each.props['data-esc-catalog-installed'] === 'true')!
    expect(status.props['role']).toBe('status')
    expect(status.props['children']).toBe('已安装「架构图一键生成」。')
    const degraded = render({
      state: { kind: 'ready', value: payload([runtimeSkill({ id: 'p1' })], [], 'ENT_LOCAL_RESPONSE_INVALID') },
    })
    const note = walk(degraded).find(each => typeof each.props['data-esc-catalog-degraded'] === 'string')!
    expect(note.props['role']).toBe('status')
    expect(String(note.props['children'])).toContain('下一步：')
  })
})

/* ══════════════ ③ 复用既有端口（源码级）+ ⑥ 计数刷新 ══════════════ */

describe('口径 53：安装动作复用既有端口（源码级反锁）', () => {
  it('本刀两个新文件**零** fetch / 零自造 decode / 零路由字面量', () => {
    for (const name of ['esc-catalog.ts', 'esc-catalog-list.tsx']) {
      const code = readSrc(name)
      expect(code, name).not.toContain('fetch(')
      expect(code, name).not.toContain('decodeEnterprise')
      expect(code, name).not.toContain('requestJson')
      expect(code, name).not.toContain("'/skills/install'")
      // 也不自己拼 URL（那是"第二套取数器"的另一种形态）。
      expect(code, name).not.toContain('/enterprise/api/v1/local')
    }
  })

  it('`/skills/install` 全仓**只有一个调用点**（`local-api.ts` 那条既有实现）', () => {
    const srcDir = new URL('../src/', import.meta.url)
    const files = readdirSync(srcDir).filter(name => /\.tsx?$/.test(name))
    const hits = files
      .map(name => ({ name, count: (readSrc(name, '../src/').match(/requestJson\('\/skills\/install'/g) ?? []).length }))
      .filter(each => each.count > 0)
    expect(hits).toEqual([{ name: 'local-api.ts', count: 1 }])
    // 剥注释后的**全部** `src` 里，那枚带引号的路径字面量也只允许在那一处出现一次
    //（另一处是模板串 `${LOCAL_API_PREFIX}/skills/install`，形态不同、不是第二个调用点）。
    const quoted = files
      .map(name => ({ name, count: (readSrc(name, '../src/').match(/'\/skills\/install'/g) ?? []).length }))
      .filter(each => each.count > 0)
    expect(quoted).toEqual([{ name: 'local-api.ts', count: 1 }])
    // 那条既有实现原样还在（本刀没有改它一个字节）。
    expect(readSrc('local-api.ts', '../src/'))
      .toContain("installSkill: async (packageId, signal) => decodeEnterpriseInstalledSkills(")
  })

  it('数据源**复用** `createEnterpriseSkillListSource`（不新造取数器）；`escApi` 只多一格委托读', () => {
    const agg = readSrc('esc-aggregation.tsx')
    // ★恰好一处：与「企业设置 → 技能」那一页**同一个工厂**。
    expect(agg.match(/createEnterpriseSkillListSource\(/g)).toHaveLength(1)
    expect(agg).toContain("import { createEnterpriseSkillListSource, type EnterpriseSkillListPayload } from '../skill-market.js'")
    // 反向锁：本层没有**新造**第二个取数器。
    expect(agg).not.toMatch(/createEnterpriseListSource\(/)
    expect(agg).toContain('skills: signal => api.skills(signal),')
    expect(agg).toContain('installedSkills: signal => api.installedSkills(signal),')
    // `escApi` 那一格是**委托**（同一份 `requestJson` + 同一个严格解码器），不是自己拆信封。
    const escApi = readSrc('esc-api.ts')
    expect(escApi).toContain('skills: async signal => localReads.skills(signal ?? new AbortController().signal),')
    expect(escApi).toContain("'installedSkills' | 'selfInstalledSkills' | 'discoveredSkills' | 'thirdPartySkills' | 'installThirdPartySkill' | 'skills'")
    expect(escApi).not.toContain('decodeEnterprise')
    expect(escApi).not.toContain('fetch(')
  })

  it('唯一的写入口接线在 `client.tsx`：同一个 `createEnterpriseLocalApi()` 实例上的 `installSkill`', () => {
    const client = readSrc('client.tsx', '../src/')
    expect(client).toContain('installSkill: (packageId, signal) => escSkillApi.installSkill(packageId, signal),')
    expect(client).toContain('const escSkillApi = createEnterpriseLocalApi()')
    // 反向锁：本刀没有在 esc 里再写一条 `/skills/install` 请求（那是口径 47 那个 bug 的形状）。
    expect(client).not.toContain("'/skills/install'")
    // 本仓的端口类型把这件事写成**可选**（判据是"端口在不在场"），而不是编译期就能骗过的必填位。
    const types = readSrc('esc-types.ts')
    expect(types).toContain('readonly installSkill?: ((packageId: string, signal: AbortSignal) => Promise<readonly EnterpriseInstalledSkill[]>) | undefined')
  })

  it('⑤ 动作纪律（源码级）：在途拒第二次、成功只认 Host 回传、失败走唯一提示组件 + 稳定码', () => {
    const list = readSrc('esc-catalog-list.tsx')
    // 一次一条：在途时直接返回（第二条**一条请求都不发**，也不排队）。
    expect(list).toContain('if (pending !== undefined) return')
    expect(list).toContain('if (installSkill === undefined) return')
    // ★【＋】与失败那一行的【重试】走的是**同一枚写入口**（同一枚包 id）：两处调用、一个出口。
    expect(list.match(/props\.onInstall\(packageId, item\.name\)/g)).toHaveLength(2)
    expect(list.match(/onInstall: runInstall,/g)).toHaveLength(1)
    // ★**不乐观翻态**：写回 `installed` 的只有两处——取数源那份种子、以及 Host 回传的那份清单。
    expect(list.match(/setInstalled\(/g)).toHaveLength(2)
    expect(list).toContain('setInstalled(listValue.installed)')
    expect(list).toContain('setInstalled(next)')
    expect(list.indexOf('setInstalled(next)')).toBeLessThan(list.indexOf('props.onInstalledRefresh()'))
    // 反向锁：不许自己往清单里塞一枚、也不许自己加计数。
    expect(list).not.toMatch(/setInstalled\(\[/)
    expect(list).not.toContain('.concat(')
    expect(list).not.toMatch(/setInstalled\w*\(\s*[^)]*\+\s*1/)
    // 失败：唯一提示组件 + 既有稳定码族（`enterpriseLocalErrorCode` 翻码），且**不禁用**重试。
    expect(list).toContain('code: enterpriseLocalErrorCode(error)')
    expect(list).toContain('createElement(EnterpriseErrorNotice, {')
    expect(list).toContain('prefix: ENTERPRISE_CATALOG_INSTALL_FAILED_PREFIX')
    expect(list).not.toContain('catch (')
    // 在途不中止：写动作那一次不持有 AbortController（只有超时信号，与设置页同一枚数字）。
    expect(list).toContain('AbortSignal.timeout(ENTERPRISE_CATALOG_INSTALL_TIMEOUT_MS)')
  })

  it('⑥ 成功后触发计数刷新：用的仍是**聚合层那一枚** refresh token（不造第二个）', () => {
    const agg = readSrc('esc-aggregation.tsx')
    // 计数刷新令牌全文件只有一枚（一份 state、一个 updater 类型）。
    expect(agg.match(/\[installedRefreshToken, setInstalledRefreshToken\]/g)).toHaveLength(1)
    expect(agg.match(/const onInstalledRefresh = useCallback/g)).toHaveLength(1)
    // 企业技能那一支用的就是它（把同一个回调交下去，而不是另起一枚令牌）；
    // 「本地三方」那一支调的也是**同一个**回调 —— 装了东西请计数重数一遍，这件事在本页只有一条机制。
    expect(agg).toContain('onInstalledRefresh,')
    expect(agg).toContain('onInstalledRefresh()')
    const list = readSrc('esc-catalog-list.tsx')
    expect(list.match(/props\.onInstalledRefresh\(\)/g)).toHaveLength(1)
    // 反向锁：内容区**没有**自己的第二枚刷新令牌/状态。
    expect(list).not.toContain('setInstalledRefreshToken')
    expect(list).not.toContain('RefreshToken')
  })
})
