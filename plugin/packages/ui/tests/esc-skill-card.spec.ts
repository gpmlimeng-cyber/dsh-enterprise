/**
 * 「技能卡规格」的门禁（用户冻结真源：`analysis/esc-skill-card-spec.md`，2026-10-09）。
 *
 * 这一份**只管本刀新立的那几条口径**，判据形态与另几份 esc 门禁同源：
 *   · 纯投影**直调**（`esc-skill-card.ts` 那三件事实、`esc-skill-more.ts` / `esc-skill-try.ts` 两枚计划）；
 *   · 渲染树**按元素读 props**（本仓 vitest 没有 DOM：`createElement` 的产物照样能逐格核对）；
 *   · 源码级**反向锁**（"同一份实现""零第二套真值"这类只能落在源码文本上的判据）。
 * 覆盖：① 隐藏规则 · ② 刚装例外 · ③ 标记生命周期 · ④ 高度同源 · ⑤ 精选与广场逐键相等 ·
 *      ⑥ 四行菜单与 `编辑` 的 fail-closed · ⑦ `去对话`/`去试试` 同一实现 · ⑧ 危险行两条既有闸 ·
 *      ⑨ 零新增错误码 / 零新增 fetch 与路由 / 零第二份真值。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * ★官方原语在本仓**不是**运行期依赖（发行时用宿主共享实例），而 `devDependency` 那份在**导入期**
 * 就会 `import 'clsx'`（那个包不在本仓依赖里）⇒ 直接 import 呈现层会在"收集测试"阶段就炸。
 * 与 `tests/esc-skill-more.spec.ts` / `esc-skill-try.spec.ts` 同一条手法：整模块替身化
 * （本文件要测的是我们自己的**投影、结构锁与源码事实**）。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: 'button',
  Pill: 'button',
  Input: 'input',
  Menu: 'div',
  MenuItemButton: 'button',
  Modal: 'div',
  Switch: 'span',
  Tag: 'span',
  IconEllipsisOutlineMedium: 'span',
  IconSettingsOutlineMedium: 'span',
  IconUserOutlineMedium: 'span',
  IconLoadingOutlineMedium: 'span',
}))

import { EnterpriseEscCard, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { ENTERPRISE_ESC_COPY } from '../src/esc/esc-copy.js'
import { enterpriseEscFeaturedBody } from '../src/esc/esc-featured.js'
import { SKILL_MORE_ENTRIES, escCardMoreRows, escCardMoreSelect } from '../src/esc/esc-more-menu.js'
import {
  ENTERPRISE_ESC_SKILL_ALL_INSTALLED_NEXT,
  ENTERPRISE_ESC_SKILL_ALL_INSTALLED_TITLE,
  ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY,
  ENTERPRISE_ESC_SKILL_CARD_NO_INSTALLED,
  enterpriseEscSkillAllInstalledEmpty,
  enterpriseEscSkillCardHidden,
  enterpriseEscSkillCardMarkState,
  enterpriseEscSkillCardParams,
} from '../src/esc/esc-skill-card.js'
import { enterpriseEscSelfInstalledNames, enterpriseEscSkillMorePlan } from '../src/esc/esc-skill-more.js'
import { enterpriseEscSkillTryDraft, enterpriseEscSkillTryPlan } from '../src/esc/esc-skill-try.js'
import { EnterpriseEscStyle } from '../src/esc/esc-style.js'

/* ────────────────────────── 公用小件（与另几份 esc 门禁同一套写法） ────────────────────────── */

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

function readEscSrc(name: string): string {
  return stripComments(readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8'))
}

function allSrcFiles(): readonly { readonly name: string; readonly code: string }[] {
  const root = new URL('../src/', import.meta.url)
  const out: { name: string; code: string }[] = []
  const visit = (dir: URL, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      out.push({ name: `${prefix}${entry.name}`, code: stripComments(readFileSync(new URL(entry.name, dir), 'utf8')) })
    }
  }
  visit(root, '')
  return out
}

interface Element {
  readonly type: unknown
  readonly props: Record<string, unknown>
}
const asElement = (node: unknown) => node as Element
const childrenOf = (element: Element): readonly unknown[] => {
  const children = element.props['children']
  return Array.isArray(children) ? children : children === undefined || children === null ? [] : [children]
}
/** 深度优先摊平整棵树（`null` / 字符串跳过），供按类名找那一格。 */
function walk(node: unknown, out: Element[] = []): readonly Element[] {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const each of node) walk(each, out)
    return out
  }
  const element = node as Element
  out.push(element)
  for (const child of childrenOf(element)) walk(child, out)
  return out
}
/** 类名里带某一枚 token 的第一个元素（`className` 有空格分隔的多枚）。 */
function byClassToken(tree: unknown, token: string): Element | undefined {
  return walk(tree).find(element => String(element.props['className'] ?? '').split(' ').includes(token))
}

/** 卡片入参（`ResourceItem` 只填判据真正用得到的那几格）。 */
const CARD_ITEM = { id: 'skill-4189', name: 'dev-engineer-toolkit', description: '一句话说明' }
/**
 * 卡片树的取证入口。
 *
 * ★**本刀（技能页性能）**：`EnterpriseEscCard` 现在是 `memo` 包出来的那一枚（对象，不是函数）
 *   —— 纯函数直调走它的**内层**那一枚 `EnterpriseEscCardView`（渲染语义逐字同一份）。
 *   断言一字未动（本文件核的仍是"这枚计划交给组件的是什么"）。
 */
const card = (props: Record<string, unknown> = {}) =>
  EnterpriseEscCardView({ item: CARD_ITEM, showUse: true, installed: true, ...props } as never)

const NAME = 'dev-engineer-toolkit'
/** 一枚「去试试」计划（默认：已装 + 端口在场 ⇒ 可点；`onTry` 可注入取证）。 */
const tryPlanOf = (onTry: (draft: string) => void = () => undefined) =>
  enterpriseEscSkillTryPlan({ name: NAME, installed: true, wired: true, onTry })
/** 一枚「更多」计划（默认：自装清单命中 + 打开文件夹/卸载两枚端口在场）。 */
function morePlanOf(overrides: Record<string, unknown> = {}) {
  /**
   * ★**本刀（技能页性能）**：纯投影的入参由"记录数组"改成"**已建好的名字集合**"
   *   （`enterpriseEscSelfInstalledNames` 的产物；调用方在 `useMemo` 里建一次）。
   *   夹具一字未改 —— 夹子照旧可以按旧形状给 `selfInstalled: [记录…]`，在这里折成集合。
   */
  const { selfInstalled: records = [{ skillId: 'meeting-notes', displayName: '会议纪要', sha256: 'a'.repeat(64), names: [NAME], installedAt: '', sourceInput: 'notes.dshskill' }], ...rest } = overrides
  return enterpriseEscSkillMorePlan({
    selfInstalledNames: enterpriseEscSelfInstalledNames(records as readonly never[]),
    name: NAME,
    wired: { uninstall: true, reveal: true },
    onUninstall: () => undefined,
    onReveal: () => undefined,
    ...rest,
  } as never)
}

/* ══════════════ ① 隐藏规则：磁盘上已有同名技能 ⇒ 从列表里去掉（不是灰化、不是打标） ══════════════ */

describe('规格 §1①：已安装的**从列表里去掉**（判据＝磁盘真值 `installedIds`，不是账本）', () => {
  it('磁盘上有同名技能 ⇒ `true`（该滤掉）；盘上没有 ⇒ `false`；刚装那一枚**例外**', () => {
    const installed = new Set(['dev-engineer-toolkit'])
    expect(enterpriseEscSkillCardHidden({ name: 'dev-engineer-toolkit', installedNames: installed })).toBe(true)
    expect(enterpriseEscSkillCardHidden({ name: 'agent-manager', installedNames: installed })).toBe(false)
    // ★例外只在"**这一枚**就是刚装的那一枚"时成立（不是"有刚装标记 ⇒ 全都不滤"）。
    expect(enterpriseEscSkillCardHidden({
      name: 'dev-engineer-toolkit', installedNames: installed, justInstalledSkillName: 'dev-engineer-toolkit',
    })).toBe(false)
    expect(enterpriseEscSkillCardHidden({
      name: 'agent-manager', installedNames: installed, justInstalledSkillName: 'dev-engineer-toolkit',
    })).toBe(false)
    // 空集合（读不到 / 一枚都没装）⇒ 一枚都不滤（不写假数）。
    expect(enterpriseEscSkillCardHidden({ name: 'dev-engineer-toolkit', installedNames: ENTERPRISE_ESC_SKILL_CARD_NO_INSTALLED }))
      .toBe(false)
  })

  it('判据是**名字**、是**一份**集合：三处调用点（广场/团队同一支 + 精选行）都只调这一枚函数', () => {
    // 定义恰好一处。
    expect(readEscSrc('esc-skill-card.ts').match(/export function enterpriseEscSkillCardHidden\(/g) ?? []).toHaveLength(1)
    // 调用点恰好两处（聚合层的 `visibleList` + 精选行那一处），各自只有一次。
    const callers = allSrcFiles()
      .filter(file => /enterpriseEscSkillCardHidden\(/.test(file.code))
      .map(file => file.name)
      .sort()
    expect(callers).toEqual(['esc/esc-aggregation.tsx', 'esc/esc-featured.tsx', 'esc/esc-skill-card.ts'])
    expect(readEscSrc('esc-aggregation.tsx').match(/enterpriseEscSkillCardHidden\(/g) ?? []).toHaveLength(1)
    expect(readEscSrc('esc-featured.tsx').match(/enterpriseEscSkillCardHidden\(/g) ?? []).toHaveLength(1)
    /**
     * ★**系统广场与团队空间是同一支**：聚合层那一处的闸只看**资源类型**（技能档），**不看** `source`
     *   ——判据里一旦出现 `source`，两个维度就会各有一套规则（那正是规格禁止的第二种形态）。
     */
    const agg = readEscSrc('esc-aggregation.tsx')
    expect(agg.match(/const visibleList =/g) ?? []).toHaveLength(1)
    // 那一句的**逐字**范围：从 `const visibleList` 到它的 else 分支 `: list`（不含后面任何代码）。
    const visible = /const visibleList = resourceType === 'skill'[\s\S]*?: list/.exec(agg)?.[0] ?? ''
    expect(visible).not.toBe('')
    expect(visible).toContain("resourceType === 'skill'")
    // ⚠`not.toContain('source')` 是**错的判据**（`resourceType` 里恰好含 `source` 六个字母）
    //   ⇒ 判据落在"维度闸"这个词本身：那个条件里不许出现 `source` 这个**标识符**。
    expect(visible).not.toMatch(/\bsource\b\s*(===|!==)/)
    expect(visible).not.toContain('source ===')
    // ★判据集合是**官方发现面那份磁盘真值**（`installedIds`），不是那两份账本记录。
    expect(visible).toContain('installedNames: installedIds,')
    expect(visible).not.toContain('selfInstalled')
    expect(visible).not.toContain('installedCenter')
    // ★"去掉"而不是"灰化/打标"：那一支是 `filter`（元素根本不进树）。
    expect(visible).toContain('.filter(item => !enterpriseEscSkillCardHidden({')
  })
})

/* ══════════════ ② 刚装那一枚：留在原地，且**只显示「去试试」** ══════════════ */

describe('规格 §1②③：刚装那一枚留在原地，卡片入参里 `more` 与 `install` **两格都不存在**', () => {
  it('投影层：`justInstalled` ⇒ 只有 `tryNow`（没有「…」也没有【＋】）；且 `installed` 钉成 true', () => {
    const params = enterpriseEscSkillCardParams({
      installed: false, // 故意给反的：刚装成功的这一枚必然已装，投影不许把这件事实交成 false
      justInstalled: true,
      install: { text: '安装', disabled: false, title: 't', ariaLabel: 'a' },
      more: morePlanOf(),
      tryNow: tryPlanOf(),
    })
    expect(Object.keys(params)).not.toContain('more')
    expect(Object.keys(params)).not.toContain('install')
    expect(params.installed).toBe(true)
    expect(params.tryNow).toBeTruthy()
    // 非例外那一档照旧把两格带上（不是"谁都摘掉"）。
    const normal = enterpriseEscSkillCardParams({
      installed: false,
      justInstalled: false,
      install: { text: '安装', disabled: false, title: 't', ariaLabel: 'a' },
      tryNow: tryPlanOf(),
    })
    expect(normal.install).toBeTruthy()
    expect(normal.more).toBeUndefined()
  })

  it('卡片层：那一枚卡上**没有** `⋯`、**没有**【＋】，只有那枚「去试试」', () => {
    const params = enterpriseEscSkillCardParams({
      installed: true,
      justInstalled: true,
      install: { text: '安装', disabled: false, title: 't', ariaLabel: 'a' },
      more: morePlanOf(),
      tryNow: tryPlanOf(),
    })
    const tree = EnterpriseEscCardView({ item: CARD_ITEM, ...params } as never)
    expect(byClassToken(tree, 'esc-more-btn')).toBeUndefined()
    expect(byClassToken(tree, 'esc-install-plus')).toBeUndefined()
    expect(byClassToken(tree, 'esc-try-now')).toBeTruthy()
    // 那一格仍是**标题行里的第二格**（占的就是原来那枚安装按钮的位置）。
    const titleRow = byClassToken(tree, 'esc-card-titlerow')!
    expect(childrenOf(titleRow).map(each => asElement(each).props['className'])).toEqual([
      'esc-card-title',
      'esc-skill-actions',
    ])
    // 反向锁：这一档**没有**那枚 `⋯` 的入口 —— 那一格确实拿到了 `more: undefined`
    //   （`SkillMoreActions` 对 `more === undefined` 返回 `null` ⇒ 渲染成空；见 `esc-more-menu.tsx` 那道闸）。
    const actions = asElement(childrenOf(titleRow)[1])
    expect(String(actions.props['className'])).toContain('esc-skill-actions')
    const kids = childrenOf(actions).filter(each => each !== null && each !== undefined)
    expect(kids).toHaveLength(2)
    expect(asElement(kids[0]).props['more']).toBeUndefined()
    expect(asElement(kids[1]).props['className']).toBe('esc-action-solid esc-try-now')
    expect(byClassToken(EnterpriseEscCardView({ item: CARD_ITEM, ...params } as never), 'esc-more-btn')).toBeUndefined()
  })
})

/* ══════════════ ③ 标记的生命周期：安装成功置上；列表重读 / 切维度清掉 ══════════════ */

describe('规格 §1②：标记的生命周期（唯一 reducer；不许永久留着）', () => {
  it('`installed` ⇒ 置上；`relist` ⇒ 撤掉（同一引用：不触发多余渲染）', () => {
    const installed = enterpriseEscSkillCardMarkState(ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY, {
      kind: 'installed',
      name: NAME,
    })
    expect(installed.name).toBe(NAME)
    // ★"这次重读是那次安装自己引发的" ⇒ 只消费掉那一格，标记**留着**（否则例外在同一次动作里就没了）。
    const afterOwnRead = enterpriseEscSkillCardMarkState(installed, { kind: 'relist' })
    expect(afterOwnRead.name).toBe(NAME)
    expect(afterOwnRead.ownRead).toBeUndefined()
    // ★真正的"列表重读 / 切维度" ⇒ 撤掉，且回到**同一枚空对象**（`setState` 同值即 bail out）。
    const cleared = enterpriseEscSkillCardMarkState(afterOwnRead, { kind: 'relist' })
    expect(cleared).toBe(ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY)
    expect(enterpriseEscSkillCardMarkState(cleared, { kind: 'relist' })).toBe(ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY)
    // 空名字不算一次安装（不置空标记）。
    expect(enterpriseEscSkillCardMarkState(ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY, { kind: 'installed', name: '' }))
      .toBe(ENTERPRISE_ESC_SKILL_CARD_MARK_EMPTY)
  })

  it('源码级：置上**恰好一处在安装成功之后**；撤销**只有一处出口**，四个"重读/切维度"出口都调它', () => {
    const agg = readEscSrc('esc-aggregation.tsx')
    expect(agg.match(/kind: 'installed'/g) ?? []).toHaveLength(1)
    expect(agg.match(/kind: 'relist'/g) ?? []).toHaveLength(1)
    // 置上那一处住在 `runSystemInstall` 的成功分支里（**在** 并入 Host 清单之后、请计数重读之旁）。
    const handler = agg.slice(
      agg.indexOf('const runSystemInstall = useCallback'),
      agg.indexOf('}, [systemPending, installPublishedSkill, onInstalledRefresh])'),
    )
    expect(handler).toContain("setCardMark(current => enterpriseEscSkillCardMarkState(current, { kind: 'installed', name }))")
    // 撤销只有一个出口 `relistCards`，且恰好一处 `setCardMark(...{ kind: 'relist' })`。
    expect(agg.match(/const relistCards = useCallback/g) ?? []).toHaveLength(1)
    // 五个出口（全都是"这一面列表被重读 / 换了维度"）：切维度 / 切资源类型 / 换分类 / 改搜索词 / 失败重试。
    expect(agg.match(/relistCards\(\)/g) ?? []).toHaveLength(5)
    for (const site of ['onSourceChange', 'onCategoryChange', 'onKeywordChange', 'onSelect', 'relistCards()']) {
      expect(agg).toContain(site)
    }
    // ★"安装成功之后那一次自动重读"**不许**被算成 `relist`：取数 effect 里没有 `relistCards`。
    const discoveryEffect = agg.slice(
      agg.indexOf('const snapshot = await api.discoveredSkills(controller.signal)'),
      agg.indexOf('setInstalledDiscovering(facts.discovering)'),
    )
    expect(discoveryEffect).not.toContain('relistCards')
  })
})

/**
 * ④ 高度同源：「去试试」与【＋】**同一处声明**，且**作用域收窄到广场那张刚装卡**（用户裁决②）。
 *
 * ★判据就是用户那句话本身："去试试就在**原安装按钮**位置、高度和安装一致" ——
 *   **已安装页根本没有安装按钮**，故那句话管不到它 ⇒ 那一页那枚必须回到官方 `.sm` 原状（28px）。
 *   两向都断言：属性在场 ⇒ 同源；属性缺席（已安装页那枚）⇒ 不受这条规则管、回到 `.sm` 语义。
 */
describe('规格 §1④：「去试试」高度与安装按钮**同一处声明**（只在广场刚装卡里生效）', () => {
  const stylesheet = (): string => (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
  const JUST_INSTALLED_SELECTOR = "[data-esc-skill-just-installed='true'] .esc-try-now"
  /** 取某条规则的声明体（剥注释；选择器**精确相等**——不用子串，免得撞上带前缀的那一条）。 */
  const ruleBody = (css: string, head: string): string => {
    const hit = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .find(each => each[1]!.trim() === head)
    expect(hit, `样式表里没有 ${head} 这条规则`).not.toBeNull()
    return hit![2]!
  }
  /** 样式表里**所有**以某一枚类名结尾的选择器（用来做"不许存在无作用域那条"的反向锁）。 */
  const selectorsEndingWith = (css: string, className: string): readonly string[] =>
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(hit => ({ selector: hit[1]!.trim(), body: hit[2]! }))
      .filter(rule => rule.selector.split(',').some(each => each.trim().endsWith(className)))
      .map(rule => rule.selector)

  /** 某条声明里某一格的值（`height: X` ⇒ X）。 */
  const valueOf = (body: string, name: string): string | undefined =>
    new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(body)?.[1]?.trim()

  it('广场刚装格里两枚的 `height` **逐字同一个表达式**，且那一枚 token **恰好声明一次**', () => {
    const declarations = stylesheet().replace(/\/\*[\s\S]*?\*\//g, '')
    const plus = valueOf(ruleBody(declarations, '.esc-install-plus'), 'height')
    const tryNow = valueOf(ruleBody(declarations, JUST_INSTALLED_SELECTOR), 'height')
    // ① 两处高度**逐字相同**（同一个 token 表达式）——这就是"高度一致"的机械判据。
    expect(plus).toBe('var(--esc-card-action-h)')
    expect(tryNow).toBe(plus)
    // ② 那一枚 token 在本文件里**恰好声明一次**（"同一处声明"这条判据的另一半）。
    expect(declarations.match(/--esc-card-action-h\s*:/g) ?? []).toHaveLength(1)
    expect(valueOf(declarations, '--esc-card-action-h')).toBe('var(--esc-icon-btn)')
    // ③ 数值只有一个来源：`--esc-icon-btn` 的 px 值在本文件里只声明一次（不许两处各写一个数字）。
    expect(declarations.match(/--esc-icon-btn\s*:\s*(\d+)px/g) ?? []).toHaveLength(1)
    expect(declarations).not.toMatch(/--esc-card-action-h\s*:\s*\d+px/)
    // ④ 那一格**不写数字**（高度只从 token 来）。
    expect(tryNow).not.toMatch(/\d+px/)
  })

  it('★两向锁（用户裁决② + 精选行那 4px 差）：高度只挂在**两个**作用域下、两条表达式逐字相同、且**没有**无作用域的那条', () => {
    const declarations = stylesheet().replace(/\/\*[\s\S]*?\*\//g, '')
    /**
     * ★**本刀重新基线化（加强，不是放宽）**：声明 `height` 的 `.esc-try-now` 规则从"恰好一条"
     *   变成"**恰好两条**"——两条都是**收窄的作用域**：
     *     ① 广场那张刚装卡的外层格（`[data-esc-skill-just-installed='true']`）；
     *     ② 精选网格（`.esc-featured-grid`：精选行里**只有刚装那一枚**才渲染「去试试」，
     *        故这条作用域天然只命中该命中的那一枚 —— 用户裁决：补掉"广场 24px / 精选 28px"那 4px 差）。
     *   两条**逐字同一表达式**（都是 `var(--esc-card-action-h)`）⇒ "同源"这件事在取值上说得出；
     *   而**无作用域**的那条仍然必须不存在（有的话已安装页会跟着从 28 变小）。
     */
    const heightRules = selectorsEndingWith(declarations, '.esc-try-now')
      .filter(selector => /(?:^|;)\s*height\s*:/.test(ruleBody(declarations, selector)))
    expect(heightRules).toEqual([JUST_INSTALLED_SELECTOR, '.esc-featured-grid .esc-try-now'])
    // 两条的 height / min-height **逐字相同**（同一个 token 表达式，不是各写一个数字）。
    for (const selector of heightRules) {
      expect(valueOf(ruleBody(declarations, selector), 'height'), selector).toBe('var(--esc-card-action-h)')
      expect(valueOf(ruleBody(declarations, selector), 'min-height'), selector).toBe('var(--esc-card-action-h)')
    }
    // ② 无作用域的那一条仍在（`white-space`）——它不是高度规则，故已安装页不受这条影响。
    const bare = ruleBody(declarations, '.esc-try-now')
    expect(bare).not.toMatch(/(?:^|;)\s*(?:min-)?height\s*:/)
    expect(bare).toContain('white-space: nowrap')
    // ③ **已安装页那枚回到官方 `.sm` 原状**：官方原语 sm 档真的声明 28px（读官方产物，不靠记忆；
    //    先剥注释——那份 CSS 里注释紧贴在 `.sm` 前面，不剥的话选择器会连着注释一起被抓出来）。
    const buttonCss = readFileSync(
      new URL('../node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/Button.module.css', import.meta.url),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(ruleBody(buttonCss, '.sm')).toContain('height: 28px')
    // ④ 那枚属性**只能**由聚合层在"刚装那一枚"上打出来（源码级：恰好一处、且判据含 `justInstalled`）。
    const agg = readEscSrc('esc-aggregation.tsx')
    expect(agg.match(/'data-esc-skill-just-installed': 'true'/g) ?? []).toHaveLength(1)
    const at = agg.indexOf("'data-esc-skill-just-installed': 'true'")
    const around = agg.slice(Math.max(0, at - 600), at)
    expect(around).toContain('justInstalled')
    expect(around).toContain("resourceType === 'skill' && item.name === cardMark.name")
    // ⑤ 属性选择器至少一层属性 + 一层类（(0,2,0)）⇒ 压得过官方 CSS module 那一层类。
    expect(JUST_INSTALLED_SELECTOR.startsWith("[data-")).toBe(true)
  })
})

/* ══════════════ ⑤ 精选卡与广场卡：**逐键相等** ══════════════ */

describe('规格 §2：精选卡接**同一份安装计划** ⇒ 与广场卡入参逐键相等（"描述三行"的根因）', () => {
  /** 一枚技能推荐记录 + 回查命中的广场卡数据（夹具与两处调用点的入参逐项相同）。 */
  const record = { id: 8, targetType: 'Skill', targetId: 158, recType: 'Official', label: NAME } as const
  const item = { id: 'skill-4194', name: NAME, description: '一句话说明', targetId: 158, allowCopy: 1 } as never
  const lookup = new Map([[158, item]])
  const installPlan = { text: '安装', disabled: false, title: '安装到本机', ariaLabel: `安装${NAME}` }

  it('同一份夹具下，精选卡与广场卡拿到的**卡片入参逐键相等**（除 key/位置）', () => {
    const tryNow = tryPlanOf()
    const more = morePlanOf()
    // 广场那一侧：聚合层调的就是这一枚共享投影（`esc-aggregation.tsx`）。
    const plaza = enterpriseEscSkillCardParams({ installed: false, justInstalled: false, install: installPlan, more, tryNow })
    // 精选那一侧：同一枚投影 + 同一批子计划（`installOf` / `moreOf` / `tryOf` 都是聚合层交下来的同一个）。
    const grid = asElement(enterpriseEscFeaturedBody(
      { kind: 'ready', items: [record] } as never,
      () => undefined,
      {
        lookup,
        targetType: 'Skill',
        installedSkillNames: new Set(['some-other-skill']),
        installOf: () => installPlan,
        moreOf: () => more,
        tryOf: () => tryNow,
      } as never,
    ))
    const featured = asElement(childrenOf(grid)[0])
    expect(featured.type).toBe(EnterpriseEscCard)
    // ⚠读 `props` 时**不许碰 `props.key`**（React 对它有 getter，一读就打一条 dev 警告）：
    //   元素自己的 `key` 不在 props 上（`createElement` 把它摘走了，见 `esc.spec.ts` 那条既有记录）。
    const featuredProps = Object.fromEntries(
      Object.entries(featured.props).filter(([name]) => name !== 'item'),
    )
    expect(featuredProps).toEqual(plaza)
    // 逐键清点（不是"看起来像"）：两边的键集**完全相同**。
    expect(Object.keys(featuredProps).sort()).toEqual(Object.keys(plaza).sort())
  })

  it('★根因锁：**少递**那一格就会退回兜底形态（拿掉 `installOf` ⇒ 卡片上多出那句长说明）', () => {
    const gridOf = (options: Record<string, unknown>) => asElement(enterpriseEscFeaturedBody(
      { kind: 'ready', items: [record] } as never,
      () => undefined,
      { lookup, targetType: 'Skill', installedSkillNames: new Set(['some-other-skill']), ...options } as never,
    ))
    // ① 递了计划 ⇒ 卡片入参里有 `install`，且**没有**那枚"按不动"的可见原因那一格
    //    （`esc-card.tsx` 的 `skillLock` 只在 `install === undefined` 时才会拿兜底那句）。
    const withPlan = asElement(childrenOf(gridOf({ installOf: () => installPlan, tryOf: () => tryPlanOf() }))[0])
    expect(withPlan.props['install']).toEqual(installPlan)
    expect(byClassToken(EnterpriseEscCardView(withPlan.props as never), 'esc-card-lock')).toBeUndefined()
    // ② 少递（改前那一版）⇒ 卡片退回兜底：`install` 缺席 + 卡片上多出一行可见的兜底说明
    //    （就是用户真机看到的"描述三行"：描述一行 + 这句长说明一行）。
    const withoutPlan = asElement(childrenOf(gridOf({ tryOf: () => tryPlanOf() }))[0])
    expect(withoutPlan.props['install']).toBeUndefined()
    const lock = byClassToken(EnterpriseEscCardView(withoutPlan.props as never), 'esc-card-lock')
    expect(lock, '少递计划 ⇒ 兜底那句长说明一定会出现在卡上（这就是根因）').toBeTruthy()
    expect(String(lock!.props['children'])).toBe('这类技能没有可下载的技能包，暂时不能装到本机')
  })

  it('源码级：精选行**不许自己**构造卡片入参（三格只能从共享投影来）', () => {
    const featured = readEscSrc('esc-featured.tsx')
    // ★**本刀收尾改名（判据形状一字未改）**：装配的正名是 `enterpriseEscSkillCardSpec`
    //   （旧名 `enterpriseEscSkillCardParams` 仍是**同一枚函数的别名**，见 `esc-skill-card.ts`）——
    //   四个技能面（广场 / 精选 / 本地三方 / SkillHub）现在都调**正名**，故这一条跟着改。
    expect(featured.match(/enterpriseEscSkillCardSpec\(/g) ?? []).toHaveLength(1)
    // 那一处只交给共享投影：技能档的 props **整份**从那枚函数来（`...cardProps`）。
    expect(featured).toContain('enterpriseEscSkillCardSpec({')
    expect(featured).toContain('...cardProps,')
    // 反向锁：技能档那三个键**不许**在精选行里就地出现（就一个字面也不许）。
    const readyBranch = featured.slice(featured.indexOf("case 'ready':"))
    const skillBranch = readyBranch.slice(readyBranch.indexOf(': enterpriseEscSkillCardSpec({'))
    const beforeSpread = skillBranch.slice(0, skillBranch.indexOf('return createElement(EnterpriseEscCard'))
    expect(beforeSpread).not.toMatch(/\bmore:/)
    expect(beforeSpread).not.toMatch(/\binstall:/)
    expect(beforeSpread).not.toMatch(/\btryNow:/)
    // 而"计划工厂"确实是从**同一枚** prop 取的（与广场同源，不是另判一套）。
    expect(featured).toContain('options.installOf?.(item)')
    expect(featured).toContain('options.moreOf?.(item.name)')
    expect(featured).toContain('options.tryOf?.(item.name, skillInstalled)')
  })
})

/* ══════════════ ⑥ 四行菜单 + `编辑` 的 fail-closed ══════════════ */

describe('规格 §3：「…」菜单四行逐字 + `编辑` 端口缺席时**整行不画**', () => {
  it('四行顺序与文案逐字；危险档只有 `卸载`（另三枚都不带 `danger`）', () => {
    expect(SKILL_MORE_ENTRIES.map(entry => entry.id)).toEqual(['goto-chat', 'edit', 'open-folder', 'uninstall'])
    expect(SKILL_MORE_ENTRIES.map(entry => entry.label)).toEqual(['去对话', '编辑', '打开文件夹', '卸载'])
    expect(SKILL_MORE_ENTRIES.filter(entry => entry.danger === true).map(entry => entry.id)).toEqual(['uninstall'])
  })

  it('端口缺席 ⇒ `编辑` **整行不画**（不是画成禁用）；端口在场 ⇒ 它才画出来（反向锁）', () => {
    // ① 今天那一档（宿主路由没落地）：`wired.edit` 与写入口都缺席 ⇒ 行里没有 `edit`。
    expect(escCardMoreRows(morePlanOf()).map(entry => entry.id)).toEqual(['open-folder', 'uninstall'])
    // ② 只给端口不给人：仍然不画（两格都查，"画一枚死行"在结构上不可能）。
    expect(escCardMoreRows(morePlanOf({ wired: { edit: true, uninstall: true, reveal: true } })).map(entry => entry.id))
      .toEqual(['open-folder', 'uninstall'])
    // ③ 两格都在场 ⇒ 它出现在第二格（反向锁：fail-closed 不等于"永远不画"）。
    expect(escCardMoreRows(morePlanOf({ wired: { edit: true, uninstall: true, reveal: true }, onEdit: () => undefined }))
      .map(entry => entry.id)).toEqual(['edit', 'open-folder', 'uninstall'])
    // ④ 端口在场时它点了真的跑（写入口被调一次；今天那一条路画不到，故这里用注入的夹具取证）。
    const onEdit = vi.fn()
    const plan = morePlanOf({ wired: { edit: true, uninstall: true, reveal: true }, onEdit })!
    expect(escCardMoreSelect('edit', plan.actions)).toBe('run')
    expect(onEdit).toHaveBeenCalledWith(NAME)
  })
})

/* ══════════════ ⑦ `去对话` 与 `去试试`：**同一个动作、同一份实现** ══════════════ */

describe('规格 §3：`去对话` 与卡片那枚 `去试试` 是同一个动作（一个执行器、一份草稿构造）', () => {
  it('行为级：`去对话` 那一行调的就是那枚「去试试」计划里的**同一个闭包**（同一句草稿、同一个执行器）', () => {
    const seen: string[] = []
    const tryNow = tryPlanOf(draft => { seen.push(draft) })
    const more = morePlanOf({ gotoChat: tryNow })!
    // ① 卡片那枚按钮按下去：草稿进执行器。
    tryNow.onTry!()
    const fromButton = [...seen]
    seen.length = 0
    // ② 「更多 → 去对话」那一行按下去：**逐字同一句草稿**进**同一个**执行器。
    expect(escCardMoreSelect('goto-chat', more.actions)).toBe('run')
    expect(seen).toEqual(fromButton)
    expect(seen[0]).toBe(enterpriseEscSkillTryDraft(NAME))
    // ③ 可点性也是**同一份事实**：计划禁用 ⇒ 那一行一起禁用（不可能"按钮按不动、菜单行却能点"）。
    const disabled = tryPlanOf() // 这一枚的名字是合法的 ⇒ 先给一个可点的
    expect(escCardMoreRows(morePlanOf({ gotoChat: disabled })).map(entry => entry.id)).toContain('goto-chat')
    const blocked = enterpriseEscSkillTryPlan({ name: NAME, installed: true, wired: false, onTry: () => undefined })
    const blockedMore = morePlanOf({ gotoChat: blocked })!
    expect(blockedMore.actions['goto-chat']?.disabled).toBe(true)
    expect(escCardMoreSelect('goto-chat', blockedMore.actions)).toBe('none')
  })

  it('源码级：那一行的动作**没有第二份实现**（计划里取的就是 `gotoChat.onTry`）', () => {
    const more = readEscSrc('esc-skill-more.ts')
    // 唯一的转交点：`onSelect: () => { gotoChat.onTry?.() }`（没有第二个执行器、没有第二种草稿构造）。
    expect(more.match(/gotoChat\.onTry\?\.\(\)/g) ?? []).toHaveLength(1)
    // 本文件**不**碰草稿构造（唯一构造器在 `esc-skill-try.ts`）。
    expect(more).not.toContain('enterpriseEscSkillTryDraft')
    /**
     * ★**本刀（技能页性能）重新基线化（加强，不是放宽）**：已安装页那枚执行器 `runSkillTry` 现在
     *   由**计划表**持有（`enterpriseEscSkillTryTable({ …, onTry: runSkillTry })`）—— 视图里它
     *   仍**恰好一处**定义、**恰好一处**交给表（交给表那一处就是它唯一的调用点），
     *   而卡片那一侧的 `onTry` 闭包由表内**唯一**那枚纯投影拼（视图不再自己拼一份）。
     *   判据形状一字未改（仍是精确计数 + 逐字 `toContain`），只是把"拼草稿那一句"从视图移到了表。
     */
    const installed = readEscSrc('esc-installed.tsx')
    // 执行器**定义恰好一处**、**交给表恰好一处**（表内那唯一一枚投影才是它唯一的卡片侧调用者）。
    expect(installed.match(/const runSkillTry = useCallback\(/g) ?? []).toHaveLength(1)
    expect(installed.match(/onTry: runSkillTry,/g) ?? []).toHaveLength(1)
    expect(installed).toContain('const tryNowOf = (name: string): EnterpriseEscSkillTryPlan => tryPlans(name, true)')
    // 同一枚计划对象**同时**交给卡片与「更多」（`const tryNow = tryNowOf(each.name)` 那一格）。
    expect(installed).toContain('const tryNow = tryNowOf(each.name)')
    expect(installed).toContain('moreOf(each.name, tryNow),')
    expect(installed).toContain('tryNow,')
    // 全 `src`：草稿构造器只有一处定义、调用恰好两处（计划自己那次判可用性 + 执行）。
    expect(readEscSrc('esc-skill-try.ts').match(/export function enterpriseEscSkillTryDraft\(/g) ?? []).toHaveLength(1)
    const draftCallers = allSrcFiles()
      .filter(file => /enterpriseEscSkillTryDraft\(/.test(file.code))
      .map(file => file.name)
      .sort()
    expect(draftCallers).toEqual(['esc/esc-skill-try.ts'])
  })
})

/* ══════════════ ⑧ 危险行两条既有闸：一字未改 ══════════════ */

describe('规格 §4：危险行（卸载）两条既有闸一字未改', () => {
  it('没有确认文案 ⇒ 整行不画；有确认文案 ⇒ 只请求确认，**绝不顺手执行**', () => {
    const onUninstall = vi.fn()
    expect(escCardMoreRows({ actions: { uninstall: { onSelect: onUninstall } } })).toEqual([])
    const plan = morePlanOf({ onUninstall })!
    expect(plan.actions.uninstall?.confirm).toBeTruthy()
    const requestConfirm = vi.fn()
    expect(escCardMoreSelect('uninstall', plan.actions, requestConfirm)).toBe('confirm')
    expect(requestConfirm).toHaveBeenCalledTimes(1)
    expect(onUninstall, '未确认 ⇒ 业务写入口一次都不许被调').not.toHaveBeenCalled()
    // 没有确认入口 ⇒ 什么都不做（"绝不顺手执行"的另一面）。
    expect(escCardMoreSelect('uninstall', plan.actions)).toBe('none')
    expect(onUninstall).not.toHaveBeenCalled()
  })
})

/* ══════════════ ⑩ 第三条"为什么空"：「都装过了」不是「暂无数据」 ══════════════ */

describe('规格补真话：某一维度全被隐藏规则滤掉时，空态必须说"都装过了"（不是"暂无数据"）', () => {
  it('纯投影：**两个数**才分得清"平台没给"与"被我们藏了"', () => {
    // ① 真没有数据（`listed === 0`）⇒ `undefined`（交给既有那一态：插图 + 官方「暂无数据」）。
    expect(enterpriseEscSkillAllInstalledEmpty({ listed: 0, visible: 0 })).toBeUndefined()
    // ② 读到了一堆、一枚没剩下 ⇒ 两句话（为什么 + 下一步）。
    const all = enterpriseEscSkillAllInstalledEmpty({ listed: 3, visible: 0 })!
    expect(all.title).toBe(ENTERPRISE_ESC_SKILL_ALL_INSTALLED_TITLE)
    expect(all.body).toBe(ENTERPRISE_ESC_SKILL_ALL_INSTALLED_NEXT)
    // ③ 有东西要画 ⇒ 不是空态。
    expect(enterpriseEscSkillAllInstalledEmpty({ listed: 3, visible: 1 })).toBeUndefined()
    // ④ 两句**不同**、都不含裸码、都不是官方那句「暂无数据」（那句在这一格里是假话）。
    expect(all.title).not.toBe(all.body)
    expect(all.title.length).toBeGreaterThan(0)
    expect(all.body.length).toBeGreaterThan(0)
    expect(`${all.title}${all.body}`).not.toContain('ENT_')
    expect(`${all.title}${all.body}`).not.toContain(ENTERPRISE_ESC_COPY.emptyData)
    // ⑤ 第一句说"为什么"、第二句给"下一步"：下一步里点了名（「已安装」那枚入口就在同一页工具栏上）。
    expect(all.title).toContain('已经装到本机')
    expect(all.body).toContain('已安装')
    // ⑥ 定义恰好一处、调用点恰好一处（判定不散）。
    expect(readEscSrc('esc-skill-card.ts').match(/export function enterpriseEscSkillAllInstalledEmpty\(/g) ?? []).toHaveLength(1)
    const callers = allSrcFiles().filter(file => /enterpriseEscSkillAllInstalledEmpty\(/.test(file.code))
      .map(file => file.name).sort()
    expect(callers).toEqual(['esc/esc-aggregation.tsx', 'esc/esc-skill-card.ts'])
  })

  it('视图：判据是**两个数**（`list.length` / `visibleList.length`），且两句走**既有**类名（零新增 CSS）', () => {
    const agg = readEscSrc('esc-aggregation.tsx')
    // ① 判据接线：两个数各取自那两份真值（不是一个布尔）。
    expect(agg).toContain('const allInstalled = enterpriseEscSkillAllInstalledEmpty({ listed: list.length, visible: visibleList.length })')
    // ② 渲染：两句话用**既有**类名，且与官方那句「暂无数据」**互斥**（同一个三元的两支）。
    const empty = agg.slice(agg.indexOf('function EmptyBlock('))
    expect(empty).toContain("note === undefined")
    expect(empty).toContain("createElement('div', { children: ENTERPRISE_ESC_COPY.emptyData })")
    expect(empty).toContain("'data-esc-skill-all-installed': 'true'")
    expect(empty).toContain("className: 'esc-state-title'")
    expect(empty).toContain("className: 'esc-catalog-status'")
    // ③ **零新增 CSS**：那两个类名早已在本页样式表里声明过（探针 = 顶层规则确实存在）。
    const declarations = (EnterpriseEscStyle() as unknown as { props: { children: string } }).props.children
      .replace(/\/\*[\s\S]*?\*\//g, '')
    for (const head of ['.esc-state-title', '.esc-catalog-status']) {
      expect(new RegExp(`^${head} \\{`, 'm').test(declarations), head).toBe(true)
    }
    // ④ 缺席那一支逐字回到改前：`note === undefined` ⇒ 那一格仍是官方那句（上面 ② 已锁）；
    //    反向锁：这一档**不许**给「暂无数据」再套一层新类名（那就是新增 CSS 的口子）。
    expect(empty).not.toContain('esc-state-note')
    expect(empty).not.toContain('esc-all-installed')
  })
})

/* ══════════════ ⑨ 零新增错误码 / 零新增 fetch 与路由 / 零第二份真值 ══════════════ */

describe('规格纪律：零新增错误码、零新增 fetch/路由、零第二份真值', () => {
  it('新叶 `esc-skill-card.ts`：零码字面量、零 fetch、零路由、零 I/O（只 import type）', () => {
    const source = readEscSrc('esc-skill-card.ts')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('ENT_')
    expect(source).not.toContain('/enterprise/api/')
    expect(source).not.toMatch(/\bENTRY\b|\brouter\b|history\./)
    // 依赖全是**类型**（运行期零依赖 ⇒ 不可能成为第二份真值的搬运工）。
    const imports = source.match(/^import .*$/gm) ?? []
    expect(imports.length).toBeGreaterThan(0)
    for (const line of imports) expect(line, line).toMatch(/^import type /)
  })

  it('本刀改到的三个实现文件：没有新开的 `fetch(`、没有新路由字面量、没有第二个真值搬运口', () => {
    for (const name of ['esc-aggregation.tsx', 'esc-featured.tsx', 'esc-installed.tsx']) {
      const source = readEscSrc(name)
      // 本刀**不加**任何请求：`fetch(` 三个文件里一个都没有（取数一律走注入的端口 / 既有的 `esc-api`）。
      expect(source, name).not.toContain('fetch(')
    }
    // 那两个"已装真值"的取数口在 esc 面里仍然**各恰好两处**（聚合层 + 已安装页）：本刀没有新增第三个消费者。
    for (const call of ['api.discoveredSkills(', 'api.installedSkills(', 'api.selfInstalledSkills(']) {
      const callers = allSrcFiles().filter(file => file.name.startsWith('esc/')).filter(file => file.code.includes(call))
        .map(file => file.name).sort()
      expect(callers, call).toEqual(['esc/esc-aggregation.tsx', 'esc/esc-installed.tsx'])
    }
    // 那几条写入口**仍然只有注入端口一条路**（界面里没有第二条：零路由字面量、零取数器、零直连）。
    // ⚠`local-api.js` 那一格是**允许**的：本页只从它取那枚纯投影 `enterpriseLocalErrorCode`（错误码归一），
    //   取数与写入口仍然全在注入的 `skillPort` 上（下面两条锁着这件事）。
    const installed = readEscSrc('esc-installed.tsx')
    expect(installed).not.toContain('requestJson')
    expect(installed).not.toContain("'/skills/")
    expect(installed).toContain("import { enterpriseLocalErrorCode } from '../local-api.js'")
    expect(installed).toContain('skillPort.uninstallSelfInstalledSkill')
    expect(installed).toContain('skillPort.revealSelfInstalledSkill')
    expect(installed).toContain('skillPort.fillSkillTryDraft')
  })

  it('★规格 §5 那句 ★ 已由本刀（A2.1）兑现：`编辑` 的端口**已接线**（`client.tsx` 提供它）', () => {
    const client = readFileSync(new URL('../src/client.tsx', import.meta.url), 'utf8')
    // ★**事实已变**（不是放宽）：宿主那条 `POST …/skills/self-installed/edit` 落地之后，本刀把端口接上
    //   ⇒ 四行菜单的第二格**随之出现**。旧断言"client.tsx 不许含 editSkillFile"锁的是当时的缺口，
    //   缺口补上了，那一条就该按新事实反过来锁——**换成更强的判据**，不是删掉。
    expect(client).toContain('editSkillFile: (name, signal) => escSkillApi.editSelfInstalledSkill(name, signal)')
    // 而端口形状本身仍在场（"端口缺席"仍是一次**查询**的结果，不是界面里写死的常量）。
    expect(readEscSrc('esc-types.ts')).toContain('readonly editSkillFile?:')
    // ★**回执键名与宿主逐字对齐**：宿主回 `{edited:true}`（不是 `revealed`）——类型写错就会让
    //   "浏览器以为拿到 revealed"，而这正是同族两枚动作最容易漂的地方。
    expect(readEscSrc('esc-types.ts')).toContain('Promise<{ readonly edited: true }>')
  })

  it('★本刀（A2.1）：`编辑` 整条链**每一步各只有一份实现**（路径 → 解码器 → 客户端方法 → 端口 → 回调 → 文案）', () => {
    const localApi = readFileSync(new URL('../src/local-api.ts', import.meta.url), 'utf8')
    const decode = readFileSync(new URL('../src/skill-api-decode.ts', import.meta.url), 'utf8')
    const client = readFileSync(new URL('../src/client.tsx', import.meta.url), 'utf8')
    const more = readEscSrc('esc-skill-more.ts')
    // ① 路由字面量恰好一处（界面侧零处：页面只认端口，不认路径）。
    expect(localApi.match(/'\/skills\/self-installed\/edit'/g) ?? [], '路径字面量只许一处').toHaveLength(1)
    expect(readEscSrc('esc-installed.tsx')).not.toContain("'/skills/")
    // ② 解码器恰好一枚，且键名恰好是 `edited`（与 `revealed` 各自一枚，不糊成一张表）。
    expect(decode).toContain('export function decodeEnterpriseSelfInstalledEdit')
    expect(decode.match(/hasExactKeys\(row, \['edited'\]\)/g) ?? []).toHaveLength(1)
    expect(decode.match(/hasExactKeys\(row, \['revealed'\]\)/g) ?? []).toHaveLength(1)
    // ③ 客户端方法恰好一处实现、恰好一处接线。
    expect(localApi.match(/editSelfInstalledSkill: async/g) ?? []).toHaveLength(1)
    expect(client.match(/editSkillFile:/g) ?? []).toHaveLength(1)
    // ④ 两个消费点（聚合层 + 已安装页）都交真写入口，且都用**同一个动作 id**。
    for (const file of ['esc-installed.tsx', 'esc-aggregation.tsx']) {
      const code = readEscSrc(file)
      expect(code, file).toContain('onEdit: runEditSelfInstalled,')
      expect(code, file).toContain("beginSkillMore('edit', name)")
      expect(code, file).toContain('skillPort')
      expect(code, file).toContain('editSelfInstalledSkill')
    }
    // ⑤ 成功交代只有一处定义（与"打开文件夹"那句**刻意分开**：交出去的东西不同）。
    expect(more.match(/export function enterpriseEscSkillMoreEditedText/g) ?? []).toHaveLength(1)
  })
})
