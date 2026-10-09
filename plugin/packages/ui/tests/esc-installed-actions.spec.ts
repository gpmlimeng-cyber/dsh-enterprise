/**
 * [INPUT]: 依赖 `esc-installed-model.ts`（已安装页的纯投影：分组 + 卡片 + **判据键**）、
 *   `esc-skill-more.ts`（「更多」的唯一事实层：计划 / 文案 / 超时）、`esc-skill-try.ts`（「去试试」的唯一事实层）、
 *   `esc-more-menu.tsx`（行的纯数据与两个纯投影）、`esc-card.tsx`（卡片本体，纯函数直调）、
 *   `error-messages.ts`（唯一码表与唯一稳定码）、`error-notice.tsx`（唯一提示件）与 `src/**` 的源码文本
 * [OUTPUT]: 锁定**本刀**（真机缺口修复：已安装页此前缺「更多」与「去试试」两个入口）的七条：
 *   ① 两个计划在已安装页**各恰一处**、都是唯一那两枚纯投影的调用点（反向锁：定义唯一 + 调用点逐个数清）；
 *   ② **自装那枚** ⇒ 更多菜单恰好两行（卸载[危险档] + 打开文件夹）；**非自装那枚** ⇒ 更多**整枚不画**；
 *   ③ 「去试试」在本页**恒可点**（恒 `installed: true`）、键是**判据键**、草稿来自同一枚投影且**只填不发送**；
 *   ④ 失败 / 成功文案与另三处**同一份**（全 `src` 里那些句子各恰好一处，本页一句都不现编）；
 *   ⑤ **卸载失败不许在响应回来前把这一行从列表里拿掉**（列表状态只由那两趟读写）；
 *   ⑥ 本页**不新增** fetch / 路由 / 错误码（也不新建第二份自装真值）；
 *   ⑦ 那枚官方 `Switch`（中心卸载链）的语义与置灰原因**逐字未改**，且两个入口真的进树（卡片层第二半修复）
 * [POS]: 本刀界面半边的机械门禁——本仓 vitest **无 DOM、也跑不了 hook**，故判据全部落在
 *   **纯投影直调 + 卡片纯函数直调 + 源码级反向锁**三层（真机由 Lead 复量，本文件一次真机都没跑）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/**
 * ★官方原语在本仓**不是**运行期依赖（发行时用宿主共享实例），而 `devDependency` 那份在**导入期**
 * 就会 `import 'clsx'`（那个包不在本仓依赖里）⇒ 直接 import 呈现层会在"收集测试"阶段就炸。
 * 与 `tests/esc-skill-more.spec.ts` / `tests/esc-skill-try.spec.ts` 同一条手法：整模块替身化。
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

import { EnterpriseErrorNotice } from '../src/error-notice.js'
import {
  ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE,
  enterpriseErrorMessage,
} from '../src/error-messages.js'
import { EnterpriseEscCard, EnterpriseEscCardView } from '../src/esc/esc-card.js'
import { ENTERPRISE_ESC_LOCAL_COPY } from '../src/esc/esc-copy.js'
import {
  ENTERPRISE_ESC_EXTERNAL_MARKET_PREFIXES,
  ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS,
  ENTERPRISE_ESC_INTERNAL_MARKET_PREFIXES,
  enterpriseEscInstalledCount,
  enterpriseEscInstalledGroupIdOf,
  enterpriseEscInstalledGroups,
  enterpriseEscInstalledMetaTable,
  enterpriseEscSelfChannelOf,
} from '../src/esc/esc-installed-model.js'
import { SkillMoreActions, escCardMoreRows, type EscCardMore } from '../src/esc/esc-more-menu.js'
import {
  enterpriseThirdPartyRootGroups,
  enterpriseThirdPartySkillRow,
  enterpriseThirdPartySubChips,
} from '../src/esc/esc-third-party.js'
import {
  ENTERPRISE_ESC_MORE_REVEALING,
  ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX,
  ENTERPRISE_ESC_MORE_UNINSTALLING,
  ENTERPRISE_ESC_MORE_UNINSTALL_FAILED_PREFIX,
  ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT,
  enterpriseEscSkillMorePlan,
  enterpriseEscSkillMoreRevealedText,
  enterpriseEscSkillMoreUninstalledText,
  enterpriseEscSelfInstalledNames,
} from '../src/esc/esc-skill-more.js'
import {
  ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE,
  enterpriseEscSkillTryDraft,
  enterpriseEscSkillTryFilledText,
  enterpriseEscSkillTryPlan,
} from '../src/esc/esc-skill-try.js'
import type { EnterpriseDiscoveredSkill, EnterpriseSelfInstalledSkill } from '../src/skill-api-decode.js'

/* ══════════════ 夹具与树工具 ══════════════ */

type Element = { readonly type: unknown; readonly props: Record<string, unknown> }
const asElement = (node: unknown) => node as Element

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

/** 某一枚元素的子节点（`props.children` 单值 / 数组 / 缺席三种形态归一）。 */
function childrenOf(node: unknown): readonly unknown[] {
  const kids = asElement(node).props['children']
  if (Array.isArray(kids)) return kids
  return kids === undefined || kids === null ? [] : [kids]
}

/** 按类名 token 找（官方 `Button` 会把调用方类名与自己的类拼在一起）。 */
function byClassToken(node: unknown, token: string): Element | undefined {
  return walk(node).find(each => {
    const raw = each.props['className']
    return typeof raw === 'string' && raw.split(' ').includes(token)
  })
}

/** 找唯一提示件（`EnterpriseErrorNotice`）。 */
function noticesIn(node: unknown): Element[] {
  return walk(node).filter(each => each.type === EnterpriseErrorNotice)
}

/** 「更多」那枚组件元素（`SkillMoreActions` 是组件，纯调用进不去它的输出）。 */
function moreActionOf(node: unknown): Element | undefined {
  return walk(node).find(each => each.type === SkillMoreActions)
}

/** 剥注释：源码级判据落在**代码**上（注释里写沿革、引类名是正当的记录）。 */
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

/** 读一份 `src/esc/` 下的源码（剥注释）。 */
function readEscSrc(name: string): string {
  return stripComments(readFileSync(new URL(`../src/esc/${name}`, import.meta.url), 'utf8'))
}

/** 读一份 `src/` 下的源码（剥注释）。 */
function readSrc(name: string): string {
  return stripComments(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'))
}

/** `src` 子树里每一份**实现**源码（剥注释；`.spec.ts` 不在 `src` 下）。 */
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

/** 某一枚字面量在**全 `src`** 里的出现次数（"不许第二套字符串"这类反向锁的判据）。 */
function srcOccurrences(literal: string): readonly { readonly name: string; readonly count: number }[] {
  return allSrcFiles()
    .map(file => ({ name: file.name, count: file.code.split(literal).length - 1 }))
    .filter(each => each.count > 0)
}

/**
 * 某一枚字面量在 **`src/esc/` 子树**里的出现次数。
 *
 * ★为什么有一份收窄到 esc 的：`'卸载失败'` / `'打开文件夹失败'` 是**通用动作前缀**，本仓别处
 *   （商城与设置页那两条安装链）**另有它们自己的一格**（`skill-market.tsx` / `marketplace-entry.tsx`，
 *   那是另一条流的行内提示）。本刀要锁的是 **esc 这一维度**里"本页不许第二套字符串"，故判据按子树收窄
 *   —— 拿全 `src` 的计数当判据会把别处正当的那一格误判成本页的重复。
 */
function escSrcOccurrences(literal: string): readonly { readonly name: string; readonly count: number }[] {
  return srcOccurrences(literal).filter(each => each.name.startsWith('esc/'))
}

/**
 * 每一处 `createElement(EnterpriseEscCard, { … })` 的 **props 源文本**（花括号配对切出来；纯源码级）。
 *
 * ★为什么需要它：本刀在卡片层新加的那一格**只在"`actionSwitch` 在场**且**`showUse === true`"时出现**
 *   ⇒ 若还有**第二个**同时传这两个的调用点，它的标题行会**悄悄多出一格**。判据因此必须逐调用点取
 *   props 源文本、再按"两个键同时在场"筛，而不是只数某一个键的出现次数（那样漏得掉"另一处也传了"）。
 */
function cardCallSites(): readonly { readonly name: string; readonly props: string }[] {
  const out: { name: string; props: string }[] = []
  const marker = 'createElement(EnterpriseEscCard, {'
  for (const file of allSrcFiles()) {
    let at = file.code.indexOf(marker)
    while (at !== -1) {
      const open = at + marker.length - 1
      let depth = 0
      let end = open
      for (; end < file.code.length; end += 1) {
        const character = file.code[end]
        if (character === '{') depth += 1
        else if (character === '}') {
          depth -= 1
          if (depth === 0) break
        }
      }
      out.push({ name: file.name, props: file.code.slice(open, end + 1) })
      at = file.code.indexOf(marker, end)
    }
  }
  return out
}

/** 一条官方发现面的技能（本页的**列表真源**）。 */
function discovered(
  name: string,
  source: string,
  extra: Partial<EnterpriseDiscoveredSkill> = {},
): EnterpriseDiscoveredSkill {
  return {
    name,
    description: `${name} 的真描述`,
    invocation: { modelInvocable: true, userInvocable: true },
    source,
    provider: 'skill-filesystem',
    ...extra,
  }
}

/** 一条自装记录（`GET /skills/self-installed` 的一项；`names[]` 是**真正的落盘目录名**）。 */
function selfRecord(overrides: Partial<EnterpriseSelfInstalledSkill> = {}): EnterpriseSelfInstalledSkill {
  return {
    skillId: 'meeting-notes',
    displayName: '会议纪要技能组',
    sha256: 'a'.repeat(64),
    names: ['dev-engineer-toolkit'],
    installedAt: '2026-10-05T08:00:00.000Z',
    // 渠道坐标：本地上传那条写的是**用户文件名**（`bundle/src/skill-upload.ts:420`）⇒ 归「用户自定义」。
    sourceInput: 'team-notes.dshskill',
    ...overrides,
  }
}

/**
 * 本页的三枚卡（中心记录那一枚 / 自装记录那一枚 / 官方内置那一枚）——**全部经本页自己的纯投影**算出来。
 *
 * ★为什么要三枚而不是一枚：本刀要锁的正是"**有自装记录的那一枚才给「更多」**"
 *   （中心记录那一枚与内置那一枚没有自装记录 ⇒ 「更多」整枚不画）。
 * ★三枚各自落哪一组（按**渠道**分，见 `enterpriseEscInstalledGroupIdOf`）：
 *   `center-pack`（中心记录）⇒ `internal`；`dev-engineer-toolkit`（自装记录，前缀是文件名）⇒ `custom`；
 *   `bundled-thing`（官方 `source: bundled`）⇒ `builtin`。
 */
const CENTER_RECORDS = [{
  packageId: '2105915576743428098',
  skillId: 'center-pack',
  displayName: '中心技能包',
  versionId: '2.0.3',
  sha256: 'b'.repeat(64),
  names: ['center-pack'],
  installedAt: '',
}]
/** 自装记录那一份真值（视图复用的就是这一份：`meta.value.self`）。 */
const SELF_RECORDS = [selfRecord({ names: ['dev-engineer-toolkit'], displayName: '开发工程工具箱' })]
const DISCOVERED = [
  discovered('center-pack', 'user-dsh'),
  discovered('dev-engineer-toolkit', 'user-dsh'),
  discovered('bundled-thing', 'bundled'),
]
const META = enterpriseEscInstalledMetaTable(CENTER_RECORDS, SELF_RECORDS)
const GROUPS = enterpriseEscInstalledGroups(DISCOVERED, META)
const cardsOf = (id: string) => GROUPS.find(group => group.id === id)!.cards
const centerCard = cardsOf('internal')[0]!
const selfCard = cardsOf('custom')[0]!
const bundledCard = cardsOf('builtin')[0]!

/**
 * 视图那两个计划工厂的**同形夹具**（入参与 `esc-installed.tsx` 里那两处逐项相同）。
 *
 * ★这不是"再实现一遍"：判据仍在唯一那两枚纯投影里，这里只是把**视图交进去的那四件事实**摆出来
 *   （自装真值 / 端口在不在场 / 在途与失败 / 写入口），源码级那几条把它们逐字钉回视图。
 */
const WIRED = { uninstall: true, reveal: true } as const
/**
 * ★**本刀（技能页性能）**：纯投影的入参由"记录数组"改成"**已建好的名字集合**"
 *   （`enterpriseEscSelfInstalledNames` 的产物）。夹具一字未改：这一层照旧收记录、在这里折成集合
 *   （视图那一侧是"每次状态变化建一次"，见 `esc-installed.tsx` 的 `selfInstalledNames`）。
 */
const SELF_NAMES = enterpriseEscSelfInstalledNames(SELF_RECORDS)
function pageMoreOf(name: string, overrides: Record<string, unknown> = {}): EscCardMore | undefined {
  // 夹具照旧可以按旧形状给 `selfInstalled: [记录…]`（在这里折成集合，判据一侧一字未改）。
  const { selfInstalled: records, ...rest } = overrides
  return enterpriseEscSkillMorePlan({
    selfInstalledNames: records === undefined
      ? SELF_NAMES
      : enterpriseEscSelfInstalledNames(records as readonly EnterpriseSelfInstalledSkill[]),
    name,
    wired: WIRED,
    onUninstall: () => undefined,
    onReveal: () => undefined,
    ...rest,
  } as never)
}
function pageTryOf(name: string, overrides: Record<string, unknown> = {}) {
  return enterpriseEscSkillTryPlan({
    name,
    installed: true,
    wired: true,
    onTry: () => undefined,
    ...overrides,
  } as never)
}

/**
 * 已安装页那张卡的**逐字入参形态**（`installedCard()` 交出来的那一份）。
 *
 * ★判据用**卡片纯函数直调**（本仓无 DOM）：卡片没有 hook，故可以在用例里直接调它、再逐格查元素树。
 * ★标题与开关计划**提到外面**（同一个引用）：下面那条"开关 props 与位次在两条路径下逐字相同"的判据
 *   要比的是**同一个** `actionSwitch` 输入下的渲染结果，不是两次长得像的调用。
 */
const CARD_ITEM = { id: 'installed-dev-engineer-toolkit', name: '开发工程工具箱', description: 'dev-engineer-toolkit 的真描述' }
const ACTION_SWITCH = {
  checked: true,
  disabled: false,
  title: ENTERPRISE_ESC_LOCAL_COPY.centerUninstallTitle,
  onChange: () => undefined,
}
/**
 * 卡片树的取证入口。
 *
 * ★**本刀（技能页性能）**：`EnterpriseEscCard` 现在是 `memo` 包出来的那一枚（对象，不是函数）
 *   —— 纯函数直调走它的**内层**那一枚 `EnterpriseEscCardView`（渲染语义逐字同一份）。
 *   断言一字未动（本文件核的仍是"这枚计划交给组件的是什么"）。
 */
const pageCard = (props: Record<string, unknown> = {}) => EnterpriseEscCardView({
  item: CARD_ITEM,
  iconShape: 'square',
  showUse: true,
  installed: true,
  actionSwitch: ACTION_SWITCH,
  showTags: false,
  ...props,
} as never)

/* ══════════════ ① 两个计划各恰一处（唯一构造点） ══════════════ */

describe('本刀 ①：两个计划在已安装页**各恰一处**，且都是唯一那两枚纯投影的调用点', () => {
  it('`esc-installed.tsx`：`moreOf` / `tryNowOf` 各恰好一次调用，各自只调一枚纯投影', () => {
    const src = readEscSrc('esc-installed.tsx')
    // 两个工厂各恰好一处调用（定义那一行是 `const moreOf = (name…`，不含 `moreOf(`）。
    expect(src.match(/moreOf\(/g) ?? []).toHaveLength(1)
    expect(src.match(/tryNowOf\(/g) ?? []).toHaveLength(1)
    /**
     * ★**本刀重新基线化（加强，不是放宽）**：改前两处各是一枚"只取名字"的调用
     *   （`moreOf(each.name)` / `tryNowOf(each.name)`）；用户冻结规格 §3 要求「去对话」与
     *   「去试试」是**同一个动作** ⇒ 视图先把那一枚「去试试」计划算出来，再把它**原样交给**
     *   「更多」的工厂（`moreOf(each.name, tryNow)`）。判据形状一字未改（仍是精确计数 + 逐字
     *   `toContain`），改的只是那一格实参长什么样 —— 新判据更强：它同时锁住"两个入口拿到的是
     *   **同一个对象**"（旧断言看不见这一件）。
     * ★传下去的键仍是**判据键**（发现面的 kebab 名），不是给员工看的显示名。
     */
    expect(src.match(/moreOf\(each\.name, tryNow\)/g) ?? []).toHaveLength(1)
    expect(src.match(/tryNowOf\(each\.name\)/g) ?? []).toHaveLength(1)
    /**
     * ★**本刀（技能页性能）重新基线化（加强，不是放宽）**：视图**不再直调**那两枚纯投影 ——
     *   它们各自被收进**一张计划表**（`enterpriseEscSkillMoreTable` / `enterpriseEscSkillTryTable`），
     *   视图只按名字取（引用稳定才谈得上 memo）。故这一格从"投影各出现一次"**加强成**：
     *   ① 视图里那两枚纯投影**一次都不出现**（构造点唯一化，物理上不可能在视图里另造一枚）；
     *   ② 两张表各恰好一次（构造点物理上只剩一处）；
     *   ③ 自装名字集合恰好折一次（`enterpriseEscSelfInstalledNames(` 一次）——"不再逐卡折 Set"的判据。
     */
    expect(src.match(/enterpriseEscSkillMorePlan\(/g) ?? []).toHaveLength(0)
    expect(src.match(/enterpriseEscSkillTryPlan\(/g) ?? []).toHaveLength(0)
    expect(src.match(/enterpriseEscSkillMoreTable\(/g) ?? []).toHaveLength(1)
    expect(src.match(/enterpriseEscSkillTryTable\(/g) ?? []).toHaveLength(1)
    expect(src.match(/enterpriseEscSelfInstalledNames\(/g) ?? []).toHaveLength(1)
    // 卡片工厂：定义 + 调用**恰好两处**（每张卡只画一次，两个计划各只交一次）。
    expect(src.match(/installedCard\(/g) ?? []).toHaveLength(2)
    // 两个计划都落在**同一处**卡片调用上；而同一枚「去试试」计划也交给了「更多」那一处。
    expect(src).toContain('const tryNow = tryNowOf(each.name)')
    expect(src).toContain('moreOf(each.name, tryNow),')
    expect(src).toContain('tryNow,')
  })

  it('全 `src`：两枚投影的定义各恰好一处，调用点逐个数清（本刀只**新增**一个调用者，不替换任何既有）', () => {
    expect(readEscSrc('esc-skill-more.ts').match(/export function enterpriseEscSkillMorePlan\(/g) ?? []).toHaveLength(1)
    expect(readEscSrc('esc-skill-try.ts').match(/export function enterpriseEscSkillTryPlan\(/g) ?? []).toHaveLength(1)
    const callers = (name: string) => allSrcFiles()
      .filter(file => new RegExp(`${name}\\(`).test(file.code))
      .map(file => file.name)
      .sort()
    /**
     * ★**本刀（技能页性能）重新基线化（加强，不是放宽）**：两枚纯投影在全 `src` 里**只剩一处调用者**
     *   —— 各自那一张计划表（`esc-skill-more.ts` / `esc-skill-try.ts` 自己）。
     *   旧锁列的是"三个/四个调用者"（每个视图各直调一次），新锁把"**唯一构造点**"这句话
     *   从"每个调用者各自只有一处"加强成"**全 src 只有一处**"。
     *   三个视图那一侧改锁**表的调用者**（它们不再认识投影）。
     */
    expect(callers('enterpriseEscSkillMorePlan')).toEqual(['esc/esc-skill-more.ts'])
    expect(callers('enterpriseEscSkillTryPlan')).toEqual(['esc/esc-skill-try.ts'])
    expect(callers('enterpriseEscSkillMoreTable'))
      .toEqual(['esc/esc-aggregation.tsx', 'esc/esc-installed.tsx', 'esc/esc-skill-more.ts'])
    expect(callers('enterpriseEscSkillTryTable'))
      .toEqual(['esc/esc-aggregation.tsx', 'esc/esc-catalog-list.tsx', 'esc/esc-installed.tsx', 'esc/esc-skill-try.ts'])
    /**
     * ★**另三处的接线一字未改**（本刀只加一个调用者）：广场网格 / 精选行那两处仍各自只有一个构造点，
     *   精选行拿的仍是聚合层交下来的**同一个**工厂（不是一个新实现）。
     */
    expect(readEscSrc('esc-aggregation.tsx').match(/enterpriseEscSkillMoreTable\(/g) ?? []).toHaveLength(1)
    expect(readEscSrc('esc-aggregation.tsx').match(/enterpriseEscSkillTryTable\(/g) ?? []).toHaveLength(1)
    expect(readEscSrc('esc-catalog-list.tsx').match(/enterpriseEscSkillTryTable\(/g) ?? []).toHaveLength(1)
    expect(readEscSrc('esc-featured.tsx')).toContain('options.tryOf?.(item.name, skillInstalled)')
  })
})

/* ══════════════ ② 自装 ⇒ 两行；非自装 ⇒ 整枚不画 ══════════════ */

describe('本刀 ②：自装那枚 ⇒ 更多恰好两行（卸载[危险档] + 打开文件夹）；非自装那枚 ⇒ 更多整枚不画', () => {
  it('自装记录 `names[]` 命中 ⇒ 两行、危险档带齐确认文案（判据仍是纯投影，本页不重写一份）', () => {
    const plan = pageMoreOf(selfCard.name)!
    expect(plan, '名字命中自装记录 ⇒ 必须有计划').toBeTruthy()
    expect(escCardMoreRows(plan).map(entry => entry.id)).toEqual(['open-folder', 'uninstall'])
    expect(escCardMoreRows(plan).find(entry => entry.id === 'uninstall')?.danger).toBe(true)
    expect(plan.actions.uninstall?.confirm?.impact).toBe(ENTERPRISE_ESC_MORE_UNINSTALL_IMPACT)
    expect(typeof plan.actions.uninstall?.onSelect).toBe('function')
    expect(typeof plan.actions['open-folder']?.onSelect).toBe('function')
  })

  it('中心装下来的 / 官方内置的那两枚 ⇒ 计划是 `undefined`（⇒ 连 `⋯` 都不画，不是画成禁用）', () => {
    expect(centerCard.name).toBe('center-pack')
    expect(bundledCard.name).toBe('bundled-thing')
    for (const card of [centerCard, bundledCard]) {
      expect(pageMoreOf(card.name), card.name).toBeUndefined()
      expect(escCardMoreRows(pageMoreOf(card.name)), card.name).toEqual([])
    }
    // 卡片层那道闸：拿不到计划时交给组件的是 `undefined`（组件据 `escCardMoreRows` 空数组返回 null）。
    const tree = pageCard({ more: undefined, tryNow: pageTryOf(bundledCard.name) })
    expect(moreActionOf(tree), '已装那一档仍挂着那枚「更多」组件').toBeTruthy()
    expect(moreActionOf(tree)!.props['more']).toBeUndefined()
    expect(readEscSrc('esc-more-menu.tsx')).toContain('if (more === undefined || rows.length === 0) return null')
  })

  it('视图**不许**为"不画"那一档补一个假计划、也不许把端口写死成 true（"全都给"必红）', () => {
    const src = readEscSrc('esc-installed.tsx')
    // 只在计划非空时才把它交下去（`undefined` 就是不画；补一个假计划＝在暗示能卸）。
    expect(src).toContain('...(more === undefined ? {} : { more }),')
    /**
     * ★**本刀（技能页性能）重新基线化**：可用性判据的输入仍是**复用**那份已经在手的自装真值
     *   （不新建第二份、不再发一趟请求），只是形状由"记录数组"变成"**只建一次的名字集合**"
     *   （`selfInstalledNames`，在 `useMemo` 里折一次）。判据一样强：这个集合的来源仍是
     *   `meta.value.self`，且全文件只折一次（上一段那条计数锁）。
     */
    expect(src).toContain('selfInstalledNames,')
    expect(src).toContain('const selfInstalledNames = useMemo(() => enterpriseEscSelfInstalledNames(selfRecords), [selfRecords])')
    // 真值引用稳定：那份自装记录由 `useMemo` 派生（空真值取同一枚常量，不现造一个 `[]`）。
    expect(src).toContain('const selfRecords = useMemo(')
    expect(src).toContain('ENTERPRISE_ESC_INSTALLED_NO_RECORDS')
    // 端口在不在场是**判据**，不是写死的 true。
    expect(src).toContain('uninstall: uninstallSelfInstalledSkill !== undefined,')
    expect(src).toContain('reveal: revealSelfInstalledSkill !== undefined,')
    expect(src).not.toMatch(/wired:\s*\{\s*uninstall:\s*true/)
  })

  it('★判据键是**发现面的 kebab 名**、不是给员工看的显示名（拿显示名当键必红）', () => {
    // 标题仍是显示名（卡片标题那一格**一字未改**），但判据键是 kebab 名——两格各自成立。
    expect(selfCard.item.name).toBe('开发工程工具箱')
    expect(selfCard.name).toBe('dev-engineer-toolkit')
    expect(selfCard.key).toBe('installed-1-dev-engineer-toolkit')
    // 用判据键 ⇒ 有入口；用显示名 ⇒ 没有（这就是"必须分开"的机械判据）。
    expect(pageMoreOf(selfCard.name)).toBeTruthy()
    expect(pageMoreOf(selfCard.item.name)).toBeUndefined()
  })
})

/* ══════════════ ③ 去试试恒可点 + 只填不发送 ══════════════ */

describe('本刀 ③：「去试试」在本页**恒可点**（本页恒 `installed: true`），草稿来自同一枚投影、**永不发送**', () => {
  it('已装 + 端口在场 ⇒ 可点、真 `onTry`、悬浮说明说"只填不发送"（不是"已装却被禁用"）', () => {
    const seen: string[] = []
    const plan = pageTryOf(selfCard.name, { onTry: (draft: string) => { seen.push(draft) } })
    expect(plan.disabled).toBe(false)
    expect(plan.reason).toBeUndefined()
    expect(plan.title).toBe(ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE)
    expect(plan.ariaLabel).toBe(`去试试：${selfCard.name}`)
    expect(typeof plan.onTry).toBe('function')
    plan.onTry!()
    // 交出去的正是唯一草稿构造器拼的那一句（本页一个字都不自己拼）。
    expect(seen).toEqual([enterpriseEscSkillTryDraft(selfCard.name)])
    expect(seen[0]).toContain(selfCard.name)
  })

  it('三枚卡（含中心装下来的 / 官方内置的）都恒可点：本页每一枚都是磁盘上真的装着的', () => {
    for (const card of [centerCard, selfCard, bundledCard]) {
      const plan = pageTryOf(card.name)
      expect(plan.disabled, card.name).toBe(false)
      expect(typeof plan.onTry, card.name).toBe('function')
    }
    // 反向：显示名拼不出合法指令 ⇒ 若视图拿它当键，这三枚都会被静默禁用（故键必须是判据键）。
    expect(pageTryOf(selfCard.item.name).disabled).toBe(true)
  })

  it('源码级：`installed: true` 是字面量、`wired` 认端口在不在场、本页**从不**自己拼草稿', () => {
    const src = readEscSrc('esc-installed.tsx')
    expect(src).toContain('installed: true,')
    expect(src).toContain('wired: fillSkillTryDraft !== undefined,')
    // 草稿的唯一构造器在事实层：本页一次都没调它（拼不出第二份）。
    expect(src.match(/enterpriseEscSkillTryDraft\(/g) ?? []).toHaveLength(0)
  })

  it('**只填不发送**（结构事实）：全文件零发送 / 提交类调用，`fillSkillTryDraft` 只有那一处"填"', () => {
    const src = readEscSrc('esc-installed.tsx')
    for (const forbidden of ['sendMessage(', '.send(', 'submit(', 'dispatchEvent(', 'onSubmit', 'setDraft(']) {
      expect(src, forbidden).not.toContain(forbidden)
    }
    // 唯一那处写入口调用就是"把草稿交出去"（填），且它拿的是计划带下来的 `draft`。
    expect(src.match(/fillSkillTryDraft\(/g) ?? []).toHaveLength(1)
    expect(src).toContain('void fillSkillTryDraft(draft).then(')
  })
})

/* ══════════════ ④ 失败 / 成功文案与另三处**同一份** ══════════════ */

describe('本刀 ④：失败 / 成功文案与另三处**同一份**（本页一句都不现编、不许第二套字符串）', () => {
  it('两句成功交代与三枚前缀都出自事实层（本页只引用，不写字面量）', () => {
    const src = readEscSrc('esc-installed.tsx')
    expect(src).toContain('enterpriseEscSkillMoreUninstalledText(name)')
    expect(src).toContain('enterpriseEscSkillMoreRevealedText(name)')
    expect(src).toContain('enterpriseEscSkillTryFilledText(name)')
    // 失败前缀由计划带下来（`moreOf` / `tryNowOf` 里那两枚常量在事实层）；稳定码引用唯一常量。
    expect(src).toContain('ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE')
    expect(src).not.toContain("'ENT_SKILL_TRY_LAUNCH_FAILED'")
    // 六句话一个字都不许在本页重抄一遍。
    for (const literal of [
      '卸载中', '正在打开所在文件夹', '卸载失败', '打开文件夹失败', '去试试失败',
      '已卸载', '已在新会话的输入框里填好', '已打开',
    ]) {
      expect(src, literal).not.toContain(literal)
    }
  })

  it('全 `src` 里那六句话各**恰好一处**（唯一事实层就是那一处，本页与另三处都只引用）', () => {
    expect(srcOccurrences('已卸载「')).toEqual([{ name: 'esc/esc-skill-more.ts', count: 1 }])
    expect(srcOccurrences('已在系统文件管理器中打开')).toEqual([{ name: 'esc/esc-skill-more.ts', count: 1 }])
    expect(srcOccurrences('已在新会话的输入框里填好')).toEqual([{ name: 'esc/esc-skill-try.ts', count: 1 }])
    expect(escSrcOccurrences('卸载失败')).toEqual([{ name: 'esc/esc-skill-more.ts', count: 1 }])
    expect(escSrcOccurrences('打开文件夹失败')).toEqual([{ name: 'esc/esc-skill-more.ts', count: 1 }])
    expect(escSrcOccurrences('去试试失败')).toEqual([{ name: 'esc/esc-skill-try.ts', count: 1 }])
    // 稳定码值也只有一个真源（唯一码表），界面侧一律引常量。
    expect(srcOccurrences("'ENT_SKILL_TRY_LAUNCH_FAILED'")).toEqual([{ name: 'error-messages.ts', count: 1 }])
  })

  it('失败那一枚的两句前缀与事实层逐字同源（`esc-card.tsx` 那件唯一提示件照旧只有一处）', () => {
    const uninstallFailed = pageMoreOf(selfCard.name, {
      failure: { name: selfCard.name, action: 'uninstall', code: 'ENT_SKILL_STATE_INVALID' },
    })!
    expect(uninstallFailed.failure).toEqual({
      code: 'ENT_SKILL_STATE_INVALID',
      prefix: ENTERPRISE_ESC_MORE_UNINSTALL_FAILED_PREFIX,
    })
    const revealFailed = pageMoreOf(selfCard.name, {
      failure: { name: selfCard.name, action: 'open-folder', code: 'ENT_RESOURCE_NOT_FOUND' },
    })!
    expect(revealFailed.failure).toEqual({
      code: 'ENT_RESOURCE_NOT_FOUND',
      prefix: ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX,
    })
    // 卡片上那件唯一提示件仍在（失败落在**这一枚卡片**上），且全文件恰好一处。
    const tree = pageCard({ more: revealFailed, tryNow: pageTryOf(selfCard.name) })
    const notices = noticesIn(tree)
    expect(notices).toHaveLength(1)
    expect(notices[0]!.props['code']).toBe('ENT_RESOURCE_NOT_FOUND')
    expect(notices[0]!.props['prefix']).toBe(ENTERPRISE_ESC_MORE_REVEAL_FAILED_PREFIX)
    expect(readEscSrc('esc-card.tsx').match(/createElement\(EnterpriseErrorNotice, \{/g) ?? []).toHaveLength(1)
    // 人话与下一步仍来自唯一码表（本页不写第二份失败文案）。
    expect(enterpriseErrorMessage(ENTERPRISE_ESC_SKILL_TRY_FAILED_CODE).length).toBeGreaterThan(0)
  })

  it('成功交代的**落点与钩子**与另三处逐字相同（`role="status"` + 同一枚 `data-*`，零新增 CSS 类）', () => {
    const src = readEscSrc('esc-installed.tsx')
    const agg = readEscSrc('esc-aggregation.tsx')
    const catalog = readEscSrc('esc-catalog-list.tsx')
    for (const hook of ["'data-esc-skill-more-notice': 'true'", "'data-esc-skill-try-notice': 'true'"]) {
      expect(src, hook).toContain(hook)
      expect(agg, hook).toContain(hook)
    }
    expect(catalog).toContain("'data-esc-skill-try-notice': 'true'")
    for (const code of [src, agg, catalog]) {
      expect(code).toContain('className: \'esc-catalog-status\'')
      expect(code).toContain("role: 'status'")
    }
    // 两枚动作各自的**在途交代**落点与卡片层那一道既有钩子同源（`data-esc-skill-more-busy`）。
    const busy = pageCard({
      more: { ...pageMoreOf(selfCard.name)!, busyText: ENTERPRISE_ESC_MORE_UNINSTALLING },
      tryNow: pageTryOf(selfCard.name),
    })
    const line = byClassToken(busy, 'esc-card-lock')!
    expect(line.props['children']).toBe(ENTERPRISE_ESC_MORE_UNINSTALLING)
    expect(line.props['role']).toBe('status')
    expect(line.props['data-esc-skill-more-busy']).toBe('true')
    // 另一枚的在途也上屏（同一落点、另一枚钩子）——两枚都不许静默。
    expect(ENTERPRISE_ESC_MORE_REVEALING).toBe('正在打开所在文件夹…')
  })
})

/* ══════════════ ⑤ 不乐观翻态 ══════════════ */

describe('本刀 ⑤：卸载**失败不许在响应回来前就把这一行从列表里拿掉**（列表只由那两趟读说）', () => {
  it('卸载那一支只做两件事：那句成功交代 + 请那两趟读重跑（**不碰**列表状态）', () => {
    const src = readEscSrc('esc-installed.tsx')
    const region = src.slice(
      src.indexOf('const runUninstallSelfInstalled'),
      src.indexOf('const runRevealSelfInstalled'),
    )
    // 成功：如实说一句 + 复用既有 `reloadToken`（真值仍由官方发现面说）。
    expect(region).toContain('setMoreNotice(enterpriseEscSkillMoreUninstalledText(name))')
    expect(region).toContain('setReloadToken(token => token + 1)')
    // 失败：**只**记稳定码（一格都不翻）。
    expect(region).toContain("setMoreError({ name, action: 'uninstall', code: enterpriseLocalErrorCode(error) })")
    // ★反向锁：那一支里不许出现任何改列表的写法（乐观减一枚 / 先删行都长这样）。
    for (const forbidden of ['setDiscovery(', 'setMeta(', 'setSkills(', '.filter(', '.splice(', '.slice(', '.concat(']) {
      expect(region, forbidden).not.toContain(forbidden)
    }
  })

  it('全文件那两格列表状态**只有那两趟读**写（3 + 3），列表的增删永远由官方发现面说', () => {
    const src = readEscSrc('esc-installed.tsx')
    expect(src.match(/setDiscovery\(/g) ?? []).toHaveLength(3) // loading / ready / failed（同一个 effect）
    expect(src.match(/setMeta\(/g) ?? []).toHaveLength(3)
    // 重跑那两趟读的令牌**恰好三处**：开关那一支、本机卸载那一支、失败态那枚「重试」。
    expect(src.match(/setReloadToken\(/g) ?? []).toHaveLength(3)
    // 卸载成功后**先**说结果、再请重读（顺序即语义：那句交代不依赖列表重读的结果）。
    const src2 = readEscSrc('esc-installed.tsx')
    const region = src2.slice(src2.indexOf('const runUninstallSelfInstalled'), src2.indexOf('const runRevealSelfInstalled'))
    expect(region.indexOf('setMoreNotice(')).toBeLessThan(region.indexOf('setReloadToken('))
  })
})

/* ══════════════ ⑥ 不新增 fetch / 路由 / 错误码 / 第二份真值 ══════════════ */

describe('本刀 ⑥：本页**不新增** fetch / 路由 / 错误码，也不新建第二份自装真值', () => {
  it('零 `fetch(` / 零路由字面量 / 零取数器 / 零裸码', () => {
    const src = readEscSrc('esc-installed.tsx')
    for (const forbidden of ['fetch(', 'requestJson', '/enterprise/api/v1', 'createEnterpriseLocalApi', 'local-api.js"']) {
      expect(src, forbidden).not.toContain(forbidden)
    }
    // 一个稳定码字面量都没有（一律引用唯一码表那枚常量）。
    expect(src).not.toMatch(/ENT_[A-Z_]/)
  })

  it('取数面**恰好**仍是那三条只读（一条不多、一条不少）', () => {
    const src = readEscSrc('esc-installed.tsx')
    expect(src.match(/api\.[a-zA-Z]+\(/g) ?? []).toEqual([
      'api.discoveredSkills(',
      'api.installedSkills(',
      'api.selfInstalledSkills(',
    ])
    // ★那趟自装记录**只有一处**（本刀复用它，不为这两个入口再发一趟）。
    expect(src.match(/selfInstalledSkills\(/g) ?? []).toHaveLength(1)
    // 也没有为本刀新起一格 state 装一份"自装清单"（防第二真值）；那份真值只有 `meta.value.self` 一个出口。
    expect(src).not.toMatch(/useState<readonly EnterpriseSelfInstalledSkill/)
    expect(src.match(/meta\.value\.self/g) ?? []).toHaveLength(2) // 建元信息表那一处 + selfRecords 那一处
  })
})

/* ══════════════ ⑦ 开关逐字未改 + 两枚动作真的进树 ══════════════ */

describe('本刀 ⑦：那枚官方 `Switch`（中心卸载链）逐字未改；两个入口真的进树（卡片层那半修复）', () => {
  it('源码级：开关那一份 props、两句原因、那条写入口一字未动', () => {
    const src = readEscSrc('esc-installed.tsx')
    expect(src).toContain('actionSwitch: { checked: true, disabled, title, onChange },')
    expect(src.match(/actionSwitch/g) ?? []).toHaveLength(1)
    expect(src).toContain('withMeta(centerWired ? ENTERPRISE_ESC_LOCAL_COPY.centerUninstallTitle : ENTERPRISE_ESC_LOCAL_COPY.selfInstalledLocked)')
    expect(src).toContain('centerWired ? (next: boolean) => { if (!next && busyId !== packageId) uninstall(packageId) } : () => undefined,')
    expect(src).toContain('const centerWired = !each.locked && packageId !== undefined')
    // 中心那条链仍走它自己那枚写入口与它自己那个在途格（不许被本刀改成按名字卸）。
    expect(src.match(/skillPort\.uninstallSkill\(/g) ?? []).toHaveLength(1)
    expect(src).toContain('await skillPort.uninstallSkill(packageId, controller.signal)')
    expect(src).toContain('setBusyId(packageId)')
    // 卡片两处"唯一不同"仍逐字在场。
    expect(src).toContain("showTags: false,")
    expect(src).toContain("iconShape: 'square',")
  })

  it('卡片层：开关仍在标题行第二格，动作格（更多 + 去试试）在它之后——**两个入口真的进树**', () => {
    const plan = pageMoreOf(selfCard.name)
    const tree = pageCard({ more: plan, tryNow: pageTryOf(selfCard.name) })
    const titlerow = byClassToken(tree, 'esc-card-titlerow')!
    const cells = childrenOf(titlerow).filter(node => node !== null && node !== undefined && node !== false)
    expect(cells).toHaveLength(3)
    // 开关位次与 props 一字未改（第二格、`.esc-card-switch`）。
    expect(asElement(cells[1]!).props['className']).toBe('esc-card-switch')
    expect(asElement(cells[1]!).props['checked']).toBe(true)
    expect(asElement(cells[1]!).props['label']).toBe('开发工程工具箱')
    expect(asElement(cells[1]!).props['title']).toBe(ENTERPRISE_ESC_LOCAL_COPY.centerUninstallTitle)
    // ★本刀第二半：动作格真的挂上了（改前"有开关 ⇒ 只画开关"，它进不了树）。
    expect(asElement(cells[2]!).props['className']).toBe('esc-skill-actions')
    // 「更多」拿到的是**同一枚**计划（引用相等：这一页只构造一次）；「去试试」可点且挂着真写入口。
    expect(moreActionOf(tree)!.props['more']).toBe(plan)
    const tryButton = byClassToken(tree, 'esc-try-now')!
    expect(tryButton.props['disabled']).toBe(false)
    expect(typeof tryButton.props['onClick']).toBe('function')
    expect(tryButton.props['title']).toBe(ENTERPRISE_ESC_SKILL_TRY_OPEN_TITLE)
    // 「已安装」页那两处"唯一不同"仍成立：底部标签行整行不画。
    const classes = walk(tree).flatMap(each => String(each.props['className'] ?? '').split(' '))
    expect(classes).not.toContain('esc-card-tags')
  })

  it('additive：不给开关那两档的标题行**一格未动**（本刀只多已安装页那一格）', () => {
    // 技能卡（无开关）：标题行仍恰好两格（标题 + 动作格）。
    const skillRow = byClassToken(EnterpriseEscCardView({ item: { id: 's', name: 'skill', description: 'd' }, showUse: true, installed: true, tryNow: pageTryOf('skill') } as never), 'esc-card-titlerow')!
    expect(childrenOf(skillRow).filter(node => node !== null && node !== undefined).map(node => asElement(node).props['className']))
      .toEqual(['esc-card-title', 'esc-skill-actions'])
    // 专家卡（无开关）：标题行仍恰好两格（标题 + 召唤格）。
    const expertRow = byClassToken(EnterpriseEscCardView({ item: { id: 'e', name: 'expert', description: 'd' }, showSummon: true } as never), 'esc-card-titlerow')!
    expect(childrenOf(expertRow).filter(node => node !== null && node !== undefined).map(node => asElement(node).props['className']))
      .toEqual(['esc-card-title', 'esc-summon-slot'])
  })

  it('★additive 的核心判据：开关那个元素自己的 **props 与位次**在三形态下**逐字相同**', () => {
    /**
     * 三种形态喂**同一个** `actionSwitch` 对象：
     *   A 本刀那一档（`installed: true` + 两个计划）—— 第三格＝`.esc-skill-actions`（⋯ + 去试试）
     *   B 只给 `installed: true`、不给计划 —— 第三格仍在（动作格里那枚「去试试」仍在）
     *   C 连 `installed` 都不给（技能卡那一档的开关形态）—— 第三格＝动作格（里面是那枚【＋】）
     * ⇒ 追加的那一格**永远是第三格**，开关**永远是第二格**、props 逐字相同（`toEqual` 逐键）。
     */
    const shapes = [
      pageCard({ more: pageMoreOf(selfCard.name), tryNow: pageTryOf(selfCard.name) }),
      pageCard({ tryNow: pageTryOf(selfCard.name) }),
      EnterpriseEscCardView({ item: CARD_ITEM, showUse: true, actionSwitch: ACTION_SWITCH, showTags: false } as never),
    ]
    const switchProps = shapes.map((tree) => {
      const cells = childrenOf(byClassToken(tree, 'esc-card-titlerow')!)
      // 位次：**原始下标**第二格（不是过滤后的下标——过滤会把"这一格在不在"这件事糊掉）。
      expect(asElement(cells[1]!).props['className']).toBe('esc-card-switch')
      expect(asElement(cells[2]!).props['className']).toBe('esc-skill-actions')
      return asElement(cells[1]!).props
    })
    expect(switchProps[0]).toEqual(switchProps[1])
    expect(switchProps[0]).toEqual(switchProps[2])
    // 源码级：追加那一格是标题行 `createElement` 的**最后一个实参**（开关是它前面那一个）——
    // 判据是它后面**紧跟**那个调用的收尾括号（`),` 之前不再有别的实参）。
    const rowBlock = /'esc-card-titlerow'([\s\S]*?)tagRowLayout && hasText\(item\.description\)/.exec(readEscSrc('esc-card.tsx'))![1]!
    expect(rowBlock).toMatch(/\.\.\.\(actionSwitch === undefined \|\| showUse !== true \? \[\] : \[skillActionBox\]\),\s*\)/)
  })

  it('★全 src 里**同时**传 `actionSwitch` 与 `showUse` 的调用点**恰好一处**（＝「已安装」页那一处，逐调用点列出）', () => {
    const sites = cardCallSites()
    // 先把分母数清：全 `src` 里 `createElement(EnterpriseEscCard, { … })` 恰好五处（逐调用点列出）。
    expect(sites.map(site => site.name).sort()).toEqual([
      'esc/esc-aggregation.tsx',
      'esc/esc-catalog-list.tsx',
      'esc/esc-catalog-list.tsx',
      'esc/esc-featured.tsx',
      'esc/esc-installed.tsx',
    ])
    /**
     * ★**这一条就是"第三格只出现在这两个条件同时成立时"的反向锁**：若还有第二处同时传这两个，
     *   它的标题行会**悄悄多出一格**（而它的 spec 未必盯着这件事）⇒ 这里逐调用点取 props 源文本、
     *   按"两个键同时在场"筛，筛出来必须**恰好**是「已安装」页那一处。
     */
    const both = sites.filter(site => site.props.includes('showUse:') && site.props.includes('actionSwitch:'))
    expect(both).toHaveLength(1)
    expect(both[0]!.name).toBe('esc/esc-installed.tsx')
    // 那一处也确实同时给了 `showUse: true`（不是 `showUse: false` 那半截）。
    expect(both[0]!.props).toContain('showUse: true,')
    expect(both[0]!.props).toContain('actionSwitch: {')
  })

  it('非自装那一枚：动作格仍在，但「更多」是 `undefined`（只有「去试试」那一枚）', () => {
    const tree = pageCard({ tryNow: pageTryOf(bundledCard.name) })
    const actions = byClassToken(tree, 'esc-skill-actions')!
    expect(actions).toBeTruthy()
    expect(moreActionOf(tree)!.props['more']).toBeUndefined()
    expect(byClassToken(tree, 'esc-try-now')!.props['disabled']).toBe(false)
    // 底座那枚开关仍画着（本页每张卡都有它）。
    expect(byClassToken(tree, 'esc-card-switch')).toBeTruthy()
  })

  it('成功两句与失败两枚前缀的函数仍是**唯一事实层**的导出（本页拿到的就是它们）', () => {
    expect(enterpriseEscSkillMoreUninstalledText('dev-engineer-toolkit'))
      .toBe('已卸载「dev-engineer-toolkit」，本机这份技能目录已移除。')
    expect(enterpriseEscSkillMoreRevealedText('dev-engineer-toolkit'))
      .toBe('已在系统文件管理器中打开「dev-engineer-toolkit」的所在文件夹。')
    expect(enterpriseEscSkillTryFilledText('dev-engineer-toolkit'))
      .toBe('已在新会话的输入框里填好「dev-engineer-toolkit」这句指令，按发送即可。')
  })
})

/* ══════════════ ⑧ 账目口径：恰好四组渠道 ══════════════ */

/**
 * 真机口径的夹具（用户复量给的名字，逐字进这一组用例）：
 *   · 三枚 **DSH 内置**：`office-docx` / `office-pptx` / `office-xlsx`（官方 `source: bundled`）；
 *   · 那 **7 枚无记录 `user-dsh`** 与 **41 枚无记录 `user-agents`**（用户原话：它们**不在**「已安装」）。
 */
const BUILTIN_THREE = ['office-docx', 'office-pptx', 'office-xlsx'] as const
const UNRECORDED_SEVEN = [
  'agent-manager', 'dingtalk-connector', 'feishu-connector', 'ima-skill',
  'interactive-architecture-diagram', 'skill-creator', 'wecom-connector',
] as const
const UNRECORDED_AGENTS = Array.from({ length: 41 }, (_unused, index) => `agents-skill-${index}`)

/** 四组各来一份夹具：中心记录 / `nuwax:` / 四个市场前缀各一条 / 三种自定义 + 未知 + 缺席。 */
const RULING_CENTER = [{
  packageId: 'p-center', skillId: 'center-pack', displayName: '中心技能包', versionId: '1.0.0',
  sha256: 'c'.repeat(64), names: ['center-pack'], installedAt: '',
}]
const RULING_SELF = [
  { skillId: 'nuwax-skill', displayName: '广场技能', sha256: 'd'.repeat(64), names: ['nuwax-skill'], installedAt: '', sourceInput: 'nuwax:158' },
  { skillId: 'skillhub-skill', displayName: 'SkillHub 技能', sha256: 'e'.repeat(64), names: ['skillhub-skill'], installedAt: '', sourceInput: 'skillhub:slug@1.0.0' },
  { skillId: 'skillssh-skill', displayName: 'skills.sh 技能', sha256: 'f'.repeat(64), names: ['skillssh-skill'], installedAt: '', sourceInput: 'skills.sh:owner/repo/dir' },
  { skillId: 'claudeplugins-skill', displayName: '外部技能', sha256: '1'.repeat(64), names: ['claudeplugins-skill'], installedAt: '', sourceInput: 'claude-plugins.dev:owner/repo/dir' },
  { skillId: 'clawhub-skill', displayName: 'ClawHub 技能', sha256: '2'.repeat(64), names: ['clawhub-skill'], installedAt: '', sourceInput: 'clawhub.ai:skills-sh:owner/repo/dir' },
  // ④ 用户自定义那三种（本地三方复制记的是**来源根 id**；系统搜索纳入记的是**绝对路径**）+ 未知前缀 + 缺席。
  { skillId: 'uploaded-skill', displayName: '上传的技能', sha256: '3'.repeat(64), names: ['uploaded-skill'], installedAt: '', sourceInput: 'notes.dshskill' },
  { skillId: 'third-party-skill', displayName: '复制进来的', sha256: '4'.repeat(64), names: ['third-party-skill'], installedAt: '', sourceInput: 'claude-code' },
  { skillId: 'adopted-skill', displayName: '纳进来的', sha256: '5'.repeat(64), names: ['adopted-skill'], installedAt: '', sourceInput: '/Users/x/.agents/skills/adopted-skill' },
  { skillId: 'mystery-skill', displayName: '来路不明', sha256: '6'.repeat(64), names: ['mystery-skill'], installedAt: '', sourceInput: 'mystery:whatever' },
  { skillId: 'bare-skill', displayName: '没有渠道', sha256: '7'.repeat(64), names: ['bare-skill'], installedAt: '' },
]
const RULING_DISCOVERED = [
  ...BUILTIN_THREE.map(name => discovered(name, 'bundled')),
  discovered('center-pack', 'user-dsh'),
  discovered('nuwax-skill', 'user-dsh'),
  discovered('skillhub-skill', 'user-dsh'),
  discovered('skillssh-skill', 'user-dsh'),
  discovered('claudeplugins-skill', 'user-dsh'),
  discovered('clawhub-skill', 'user-dsh'),
  discovered('uploaded-skill', 'user-dsh'),
  discovered('third-party-skill', 'user-dsh'),
  discovered('adopted-skill', 'user-dsh'),
  discovered('mystery-skill', 'user-dsh'),
  discovered('bare-skill', 'user-dsh'),
  ...UNRECORDED_SEVEN.map(name => discovered(name, 'user-dsh')),
  ...UNRECORDED_AGENTS.map(name => discovered(name, 'user-agents')),
  // project-* 没有记录 ⇒ 出页（已知缺口）；未知 source 也没有记录 ⇒ 出页（不是"其它来源"那一组）。
  discovered('project-helper', 'project-agents'),
  discovered('weird', 'custom'),
]
const RULING_META = enterpriseEscInstalledMetaTable(RULING_CENTER, RULING_SELF)
const RULING_GROUPS = enterpriseEscInstalledGroups(RULING_DISCOVERED, RULING_META)
const rulingCards = (id: string) => RULING_GROUPS.find(group => group.id === id)!.cards
const rulingNames = (id: string) => rulingCards(id).map(card => card.name)

describe('本刀 ⑧：账目口径 —— 只有 DSH 装过的进这一页，且**恰好四组**（系统内置 → 内部 → 外部 → 自定义）', () => {
  it('四组身份与组名逐字（用户给的说法）+ 顺序真源', () => {
    expect(ENTERPRISE_ESC_INSTALLED_SOURCE_KINDS).toEqual(['builtin', 'internal', 'external', 'custom'])
    expect(RULING_GROUPS.map(group => group.id)).toEqual(['builtin', 'internal', 'external', 'custom'])
    expect(RULING_GROUPS.map(group => group.title))
      .toEqual(['系统内置', '来自内部市场', '来自外部市场', '用户自定义'])
  })

  it('① 三枚 `office-*`（`source: bundled`）在「系统内置」里', () => {
    expect(rulingNames('builtin')).toEqual([...BUILTIN_THREE])
    for (const name of BUILTIN_THREE) {
      expect(enterpriseEscInstalledGroupIdOf(discovered(name, 'bundled'), RULING_META)).toBe('builtin')
    }
    // ★反向锁：内置优先于记录 —— 即便名字也命中自装记录，它仍归「系统内置」（"谁放进去的"只有一个答案）。
    const shadowed = enterpriseEscInstalledMetaTable([], [selfRecord({ names: ['office-docx'], sourceInput: 'nuwax:9' })])
    expect(enterpriseEscInstalledGroupIdOf(discovered('office-docx', 'bundled'), shadowed)).toBe('builtin')
    // `runtime` 与 `bundled` 同一档（官方 `source` 的两种写法）。
    expect(enterpriseEscInstalledGroupIdOf(discovered('runtime-thing', 'runtime'), RULING_META)).toBe('builtin')
  })

  it('② 中心记录 / `nuwax:` 记录 ⇒ 「来自内部市场」', () => {
    expect(rulingNames('internal')).toEqual(['center-pack', 'nuwax-skill'])
    expect(enterpriseEscSelfChannelOf('nuwax:158')).toBe('internal')
    expect(enterpriseEscInstalledGroupIdOf(discovered('center-pack', 'user-dsh'), RULING_META)).toBe('internal')
    expect(enterpriseEscInstalledGroupIdOf(discovered('nuwax-skill', 'user-dsh'), RULING_META)).toBe('internal')
    // 真机那一枚（自装记录 `sourceInput: 'nuwax:158'`）也落在这一组。
    expect(ENTERPRISE_ESC_INTERNAL_MARKET_PREFIXES).toEqual(['nuwax:'])
  })

  it('③ 四个市场前缀的记录 ⇒ 「来自外部市场」（**逐源各一条**）', () => {
    expect(ENTERPRISE_ESC_EXTERNAL_MARKET_PREFIXES)
      .toEqual(['skillhub:', 'skills.sh:', 'claude-plugins.dev:', 'clawhub.ai:'])
    expect(rulingNames('external'))
      .toEqual(['skillhub-skill', 'skillssh-skill', 'claudeplugins-skill', 'clawhub-skill'])
    for (const prefix of ENTERPRISE_ESC_EXTERNAL_MARKET_PREFIXES) {
      expect(enterpriseEscSelfChannelOf(`${prefix}whatever`), prefix).toBe('external')
    }
    // `clawhub.ai` 那条的 reference 里嵌套着 `skills-sh:…`，坐标前缀仍是它（不被内层前缀抢走）。
    expect(enterpriseEscSelfChannelOf('clawhub.ai:skills-sh:owner/repo')).toBe('external')
  })

  it('④ 上传 / 本地三方复制 / 系统搜索纳入 / 未知前缀 / 前缀缺席 ⇒ 「用户自定义」', () => {
    expect(rulingNames('custom'))
      .toEqual(['uploaded-skill', 'third-party-skill', 'adopted-skill', 'mystery-skill', 'bare-skill'])
    // 三种真实自定义形态 + 未知 + 缺席，逐条落 `custom`（不新造第五组、不隐藏）。
    for (const sourceInput of ['notes.dshskill', 'claude-code', '/Users/x/.agents/skills/a', 'mystery:whatever', '', undefined]) {
      expect(enterpriseEscSelfChannelOf(sourceInput), String(sourceInput)).toBe('custom')
    }
  })

  it('⑤ 无记录那批（7 枚 `user-dsh` + 41 枚 `user-agents` + project + 未知 source）**这一页一枚都不出现**', () => {
    const shown = RULING_GROUPS.flatMap(group => group.cards.map(card => card.name))
    for (const name of [...UNRECORDED_SEVEN, ...UNRECORDED_AGENTS, 'project-helper', 'weird']) {
      expect(shown, name).not.toContain(name)
    }
    // 逐条判据：无记录 ⇒ `undefined`（"分类"都没有，更谈不上画）。
    for (const skill of RULING_DISCOVERED.filter(each => [...UNRECORDED_SEVEN, ...UNRECORDED_AGENTS].includes(each.name))) {
      expect(enterpriseEscInstalledGroupIdOf(skill, RULING_META), skill.name).toBeUndefined()
    }
    // 账上那批照旧全在：3 内置 + 2 内部 + 4 外部 + 5 自定义 = 14 张卡。
    expect(shown).toHaveLength(14)
    expect(RULING_DISCOVERED).toHaveLength(64)
  })

  it('⑥⑦ 判据是"记录 + source 枚举 + `sourceInput` 前缀"，**绝不拿"在磁盘上"当安装过**', () => {
    /**
     * ★反向锁：发现面里**每一条都在磁盘上**（它本来就是磁盘真值）—— 故"在磁盘上"这件事**不构成**判据。
     *   这里喂一条"在磁盘上、但没有记录"的技能 ⇒ 必须出页；同一条**补上记录** ⇒ 立刻进页。
     */
    const orphan = discovered('on-disk-but-no-record', 'user-dsh')
    expect(enterpriseEscInstalledGroups([orphan], enterpriseEscInstalledMetaTable([], []))).toEqual([])
    const recorded = enterpriseEscInstalledMetaTable([], [selfRecord({ names: ['on-disk-but-no-record'], sourceInput: 'x.dshskill' })])
    expect(enterpriseEscInstalledGroups([orphan], recorded).map(group => group.id)).toEqual(['custom'])
    // ★源码级：这一层**不认识文件系统**（不认识路径 / home / 目录读），它只读记录与 source 枚举。
    const model = readEscSrc('esc-installed-model.ts')
    for (const forbidden of ['join(', 'homedir', 'readdir', 'exists(', 'readFile', '~/.dsh', 'node:fs']) {
      expect(model, forbidden).not.toContain(forbidden)
    }
  })
})

/* ══════════════ ⑨ 两头断言：出页的那批**仍在「本地三方」**里 ══════════════ */

/** 那一批"不在账上"的名字（7 枚 `user-dsh` + 41 枚 `user-agents`）——**同一份夹具两头断言**。 */
const OFF_LEDGER = [...UNRECORDED_SEVEN, ...UNRECORDED_AGENTS]

/**
 * 「本地三方」那一次的扫描响应（同一批名字，两个根：`dsh` = 我们自己的 `~/.dsh/skills`，
 * `agents` = `~/.agents/skills`）。
 *
 * ★这一份夹具存在的唯一理由：证明"这批从「已安装」出去"**不等于丢** —— 它们仍在「本地三方」那一面
 *   （宿主 `buildThirdPartySkillRoots` 的根表里就有这两枚根）。
 */
const THIRD_PARTY_SCAN = {
  roots: [
    { id: 'dsh', name: 'DSH', present: true, count: UNRECORDED_SEVEN.length, skipped: 0 },
    { id: 'agents', name: 'Agent Skills', present: true, count: UNRECORDED_AGENTS.length, skipped: 0 },
  ],
  skills: [
    ...UNRECORDED_SEVEN.map((name, index) => ({
      id: `dsh-${index}`, name, rootId: 'dsh', sourceName: 'DSH', directory: name, status: 'available' as const,
    })),
    ...UNRECORDED_AGENTS.map((name, index) => ({
      id: `agents-${index}`, name, rootId: 'agents', sourceName: 'Agent Skills', directory: name, status: 'available' as const,
    })),
  ],
}

describe('本刀 ⑨：「不在账上」那批**没有丢** —— 它们仍在「本地三方」的投影里（两头断言）', () => {
  it('「已安装」一枚都不出现，而「本地三方」两个根、48 条候选一枚不少', () => {
    // 头一：这一页一枚都没有。
    const shown = enterpriseEscInstalledGroups(RULING_DISCOVERED, RULING_META).flatMap(group => group.cards.map(card => card.name))
    for (const name of OFF_LEDGER) expect(shown, name).not.toContain(name)
    // 那一枚都没有账目 ⇒ 这一页是**空**的（空态说真话，见下一组）。
    expect(enterpriseEscInstalledGroups(OFF_LEDGER.map(name => discovered(name, 'user-dsh')), RULING_META)).toEqual([])
    // 头二：在「本地三方」里照旧（chip 行 / 分组 / 行投影三层都取一次证）。
    expect(enterpriseThirdPartySubChips(THIRD_PARTY_SCAN as never).map(chip => chip.key)).toEqual(['dsh', 'agents'])
    const groups = enterpriseThirdPartyRootGroups(THIRD_PARTY_SCAN as never)
    expect(groups.map(group => [group.root.id, group.skills.length])).toEqual([['dsh', 7], ['agents', 41]])
    const rows = THIRD_PARTY_SCAN.skills.map(skill => enterpriseThirdPartySkillRow(skill as never).name)
    expect(rows).toHaveLength(48)
    for (const name of OFF_LEDGER) expect(rows, name).toContain(name)
  })
})

/* ══════════════ ⑩ 分组只决定"画不画 / 归哪一组" ══════════════ */

describe('本刀 ⑩：分组是**显示口径**，绝不参与动作可用性（记录 + 端口才是判据）', () => {
  it('`sourceInput` 是未知形态（空串 / 文件名 / 路径 / 根 id）⇒ 归「用户自定义」，但卸载与去试试**照旧可点**', () => {
    for (const sourceInput of ['', 'notes.dshskill', '/Users/x/.agents/skills/a', 'claude-code', 'mystery:whatever']) {
      const records = [selfRecord({ names: ['dev-engineer-toolkit'], sourceInput })]
      const meta = enterpriseEscInstalledMetaTable([], records)
      const skill = discovered('dev-engineer-toolkit', 'user-dsh')
      // 分组：用户自定义（渠道未知）。
      expect(enterpriseEscInstalledGroupIdOf(skill, meta), sourceInput).toBe('custom')
      // 动作：**不受分组影响** —— 「更多」两行照旧、卸载与打开文件夹的写入口都在场。
      const more = enterpriseEscSkillMorePlan({
        selfInstalledNames: enterpriseEscSelfInstalledNames(records), name: 'dev-engineer-toolkit', wired: WIRED,
        onUninstall: () => undefined, onReveal: () => undefined,
      })!
      expect(escCardMoreRows(more).map(entry => entry.id), sourceInput).toEqual(['open-folder', 'uninstall'])
      expect(typeof more.actions.uninstall?.onSelect, sourceInput).toBe('function')
      // 「去试试」照旧恒可点（本页恒 `installed: true`）。
      expect(enterpriseEscSkillTryPlan({
        name: 'dev-engineer-toolkit', installed: true, wired: true, onTry: () => undefined,
      }).disabled, sourceInput).toBe(false)
    }
  })

  it('源码级：分组判定**不在这两个计划的链上**（那两份事实层不认识分组，视图也不把分组交进去）', () => {
    for (const name of ['esc-skill-more.ts', 'esc-skill-try.ts']) {
      const code = readEscSrc(name)
      expect(code, name).not.toContain('esc-installed-model')
      expect(code, name).not.toContain('InstalledGroup')
      expect(code, name).not.toContain('ChannelOf')
    }
    const view = readEscSrc('esc-installed.tsx')
    expect(view).not.toContain('enterpriseEscInstalledGroupIdOf')
    expect(view).not.toContain('enterpriseEscSelfChannelOf')
  })
})

/* ══════════════ ⑪ 空态说真话 ══════════════ */

describe('本刀 ⑪：空态说真话（"账上没有" ≠ "这台机器上没有技能"）', () => {
  it('空态那句把"扫到的那些在「本地三方」里"说出来，不再是旧那句假话', () => {
    const empty = ENTERPRISE_ESC_LOCAL_COPY.installedEmpty
    expect(empty).toContain('还没有在这台机器上装过技能')
    expect(empty).toContain('本地三方')
    expect(empty).not.toBe('本机还没有装任何技能')
    // 这句是**整页空态的唯一取值口**（不新造第二句空话）。
    expect(readEscSrc('esc-installed.tsx').match(/installedEmpty/g) ?? []).toHaveLength(1)
  })

  it('页头那个数＝**这一页真的铺出来的卡片数**（不是发现面扫到的总数）——数字与列表同源', () => {
    const view = readEscSrc('esc-installed.tsx')
    // ★本刀起取值口是**共享纯投影**（与顶栏同一个函数），本页不再自己 `reduce`。
    expect(view).toContain('const total = enterpriseEscInstalledCount(skills, metaTable)')
    expect(view).not.toContain('const total = skills.length')
    expect(view).not.toContain('groups.reduce(')
  })
})

/* ══════════════ ⑫ 同一个词在同一屏上只指一个数 ══════════════ */

describe('本刀 ⑫：顶栏「已安装(N)」与页头「已安装技能（N）」是**同一个纯投影的两个消费者**', () => {
  it('等式锁：账本条数 === 分组卡片总数 === 页头那个数（同一份夹具、同一个函数）', () => {
    const skills = RULING_DISCOVERED
    const meta = RULING_META
    const groups = enterpriseEscInstalledGroups(skills, meta)
    const pageTotal = groups.reduce((total, group) => total + group.cards.length, 0)
    // ① 顶栏那个数（同一个函数）② 页头那个数（`esc-installed.tsx` 里就是这一行）
    // ③ 投影数组长度（列表真的铺出来的枚数）——三者逐字相等。
    expect(enterpriseEscInstalledCount(skills, meta)).toBe(pageTotal)
    expect(enterpriseEscInstalledCount(skills, meta)).toBe(groups.flatMap(group => group.cards).length)
    // 同一份夹具多形态跑一遍（空 / 全账外 / 四组齐全）。
    expect(enterpriseEscInstalledCount([], meta)).toBe(0)
    expect(enterpriseEscInstalledCount(
      UNRECORDED_SEVEN.map(name => discovered(name, 'user-dsh')), meta,
    )).toBe(0)
    expect(enterpriseEscInstalledCount(skills, meta)).toBe(14)
  })

  it('反向锁：名字**同时**命中中心记录与自装记录 ⇒ 只算一次（不是"两份之和"）', () => {
    const dual = discovered('dual', 'user-dsh')
    const dualMeta = enterpriseEscInstalledMetaTable(
      [{ packageId: 'p-dual', skillId: 'dual', displayName: 'D', versionId: '1.0.0', sha256: 'a'.repeat(64), names: ['dual'], installedAt: '' }],
      [selfRecord({ names: ['dual'], sourceInput: 'nuwax:7' })],
    )
    expect(enterpriseEscInstalledCount([dual], dualMeta)).toBe(1)
    // 中心记录 + 自装记录同名 ⇒ 组身份按 ① 优先（仍未重复计）；再加一枚只命中自装记录的，才是 2。
    expect(enterpriseEscInstalledCount([dual, discovered('only-self', 'user-dsh')], enterpriseEscInstalledMetaTable(
      [{ packageId: 'p-dual', skillId: 'dual', displayName: 'D', versionId: '1.0.0', sha256: 'a'.repeat(64), names: ['dual'], installedAt: '' }],
      [selfRecord({ names: ['dual'], sourceInput: 'nuwax:7' }), selfRecord({ skillId: 's', names: ['only-self'], sourceInput: 'x.dshskill' })],
    ))).toBe(2)
  })

  it('源码级：那个纯投影**定义恰好一处**，两个消费者调的是**同一个函数**（不许各算一遍）', () => {
    expect(readEscSrc('esc-installed-model.ts').match(/export function enterpriseEscInstalledCount\(/g) ?? []).toHaveLength(1)
    // 消费者①页头（`esc-installed.tsx`）、②顶栏（`esc-aggregation.tsx`）。
    expect(readEscSrc('esc-installed.tsx')).toContain('enterpriseEscInstalledCount(skills, metaTable)')
    const agg = readEscSrc('esc-aggregation.tsx')
    expect(agg).toContain('enterpriseEscInstalledCount(')
    expect(agg).toContain('enterpriseEscInstalledMetaTable(installedCenter, selfInstalled)')
    // ★反向锁：旧那个"发现面枚数"的计数写法不许回来（它就是"同一个词两个数"的另一半）。
    expect(agg).not.toContain('setInstalledCount(')
    expect(agg).not.toContain('snapshot.skills.length')
    // `installedSnapshotFacts` 从**三件**事实收成**两件**（已装判定键 + 还没发现完）——计数从它里面搬走了。
    expect(agg).toContain('export function installedSnapshotFacts(snapshot: {')
    expect(agg).not.toContain('count: snapshot.skills.length')
  })
})

