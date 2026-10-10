/**
 * [INPUT]: 依赖 marketplace-entry 的目录页外壳 / 技能详情子页面（纯函数）+ error-notice 的「技术信息」钩子 + 各错误页源码文本
 * [OUTPUT]: 员工侧文案门禁——① 五条失败路径与未映射码的全树可见文本里**不出现裸 `ENT_`**（码只准待在 `data-enterprise-error-code` 折叠区里，且仍取得回）；② 失败提示 = 人话 + 「下一步：」+「技术信息」；③ 术语降维（页签「包含内容」/ 节标题「内容清单」/「来源」「标识」标签 / 组件行内部模块路径不上屏 / `skillId` 有标签）；④ 宪法反目标技术词不出现（上游名称与描述整段显式豁免）；⑤ 各错误页共用唯一提示组件、不再自持码表
 * [POS]: 产品宪法「反目标：不用技术术语做文案（含错误提示）」与「失败自愈」的机械门锁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readdir, readFile } from 'node:fs/promises'
import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_ERROR_ACTION_PREFIX,
  ENTERPRISE_ERROR_TECH_ATTR,
  ENTERPRISE_ERROR_TECH_SUMMARY,
  EnterpriseErrorNotice,
} from '../src/error-notice.js'
import {
  ENTERPRISE_ERROR_FALLBACK_MESSAGE,
  enterpriseErrorMessage,
} from '../src/error-messages.js'
import {
  ENTERPRISE_MARKET_TABS,
  ENTERPRISE_SKILL_DETAIL_NAME_LABEL,
  ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL,
  ENTERPRISE_SKILL_UPSTREAM_NAME_NOTE,
  EnterpriseMarketLegacyShell,
  EnterpriseSkillDetailPage,
  enterpriseMarketSkillRowFacts,
  enterpriseMarketSkillRows,
  enterpriseSkillUpstreamNameNote,
} from '../src/marketplace-entry.js'
import type { EnterpriseInstalledSkill, EnterpriseRuntimeSkill } from '../src/local-api.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  StateDot: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
}))

/** 员工看得见的文本（函数组件透明展开；**跳过码本身**——码只准待在自己的取证节点上）。 */
function visibleText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(visibleText).join(' ')
  if (!isValidElement(node)) return ''
  const props = node.props as Record<string, unknown>
  if (node.type === 'style') return ''
  if (props[ENTERPRISE_ERROR_TECH_ATTR] !== undefined) return ''
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return visibleText(rendered as ReactNode)
  }
  return visibleText(props['children'] as ReactNode)
}

/** 收集「技术信息」里那枚 `<code>` 的码（证明码没被吞掉）。 */
function technicalCodes(node: ReactNode, acc: string[] = []): string[] {
  if (Array.isArray(node)) { for (const child of node) technicalCodes(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const code = props[ENTERPRISE_ERROR_TECH_ATTR]
  if (typeof code === 'string') acc.push(code)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return technicalCodes(rendered as ReactNode, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') technicalCodes(value as ReactNode, acc)
  }
  return acc
}

/** 按类名收集（与 marketplace-entry.spec 同一口径：函数组件走产出，mock 原语退回 props）。 */
function byClassName(node: ReactNode, name: string, acc: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) { for (const child of node) byClassName(child, name, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  const className = props['className']
  if (typeof className === 'string' && className.split(/\s+/).includes(name)) acc.push(props as Record<string, any>)
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: unknown) => ReactNode)(props)
    if (rendered !== undefined && rendered !== null) return byClassName(rendered as ReactNode, name, acc)
  }
  for (const value of Object.values(props)) {
    if (value !== null && typeof value === 'object') byClassName(value as ReactNode, name, acc)
  }
  return acc
}

const PLAIN_SKILL: EnterpriseRuntimeSkill = {
  id: '1902500000000000001',
  skillId: 'code-review',
  displayName: '会议纪要技能组',
  description: '把会议录音与转写整理成结构化纪要。',
  sourceDshVersion: '0.1.7-rc.2',
  sizeBytes: 40_960,
  skillCount: 2,
  updatedAt: '2026-09-30T08:00:00Z',
  versionId: '',
  skills: [],
}
/** 上游正式名称里带技术缩写（MCP）的样本：名称/描述一律不改写，只在旁边补一句人话。 */
const UPSTREAM_SKILL: EnterpriseRuntimeSkill = {
  ...PLAIN_SKILL,
  id: '1902500000000000002',
  skillId: 'finance-crawler',
  displayName: '全能金融爬虫(新增MCP接入)',
  description: '抓取公开金融数据并汇总。',
  sourceDshVersion: 'skillhub.cn/dev-expert@2.0.3',
}
const INSTALLED: EnterpriseInstalledSkill = {
  packageId: UPSTREAM_SKILL.id,
  skillId: UPSTREAM_SKILL.skillId,
  displayName: UPSTREAM_SKILL.displayName,
  versionId: '1902500000000000101',
  sha256: 'a'.repeat(64),
  names: ['finance-crawler'],
  installedAt: '2026-09-30T08:00:00Z',
}
const UPSTREAM_TEMPLATE = { displayName: UPSTREAM_SKILL.displayName, description: UPSTREAM_SKILL.description }

/** 上游来的名称/描述整段豁免（产品边界：一律不改写；豁免逐条显式、不给通配）。 */
function stripUpstream(text: string): string {
  return text.split(UPSTREAM_TEMPLATE.displayName).join('').split(UPSTREAM_TEMPLATE.description).join('')
}

/** 宪法反目标 + 术语降维表里，员工侧界面**不许出现**的技术词。 */
const BANNED_EMPLOYEE_WORDS = [
  'manifest', 'YAML', 'yaml', '.dshpreset', 'dsh-preset', 'Preset', 'preset', 'Cordis', 'cordis',
  'bundle patch', 'MCP', '环境变量', 'API Key', '分配', '退休', '审计', '权限码',
  // 「组件」曾是技术词、员工侧整词换成「包含内容 / 内容清单」；本刀页签名改回四字基础词
  // （技能 / 插件 / 配方 / 组件）后，「组件」重新成为**员工可读的页签名**，故从黑名单里撤下。
  // 换来的那条**新口径**（页签不带「企业 / 技术 / 包含」这类词）由下面那条用例单独锁死。
] as const

/** 页签真源：五名逐字为 技能 / 插件 / 配方 / 连接器 / 组件，且**不带「企业」前缀**（「企业」由标题行徽章承担）。
 *  ★ 本刀新增第五枚「连接器」（P0-5）：**不含** `MCP` 字样——术语降维的三步里不出现它，
 *    `MCP` 只允许出现在后台管理端与客户端详情里的「技术信息」折叠区（见 connector-architecture.md §3）。 */
const MARKET_TAB_LABELS = ['技能', '插件', '配方', '连接器', '组件'] as const

function expectNoBanned(text: string, where: string): void {
  for (const word of BANNED_EMPLOYEE_WORDS) expect(stripUpstream(text), `${where} / ${word}`).not.toContain(word)
}

describe('employee-facing failure copy (failure self-healing)', () => {
  const rows = () => enterpriseMarketSkillRows([PLAIN_SKILL, UPSTREAM_SKILL])

  it('never shows a bare ENT_ code on any of the five employee-visible failure paths', () => {
    const failureCodes = ['ENT_SKILL_HASH_MISMATCH', 'ENT_PLUGIN_SIGNATURE_INVALID', 'ENT_SKILL_CONTENT_TOO_LARGE', 'ENT_SKILL_CONTENT_INVALID', 'ENT_TOTALLY_UNKNOWN']
    const skill = rows()[0]!
    const base = {
      view: 'page' as const,
      sessionUsable: true,
      enterpriseSkills: [skill],
      enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
      onToggleSkill: vi.fn(),
      onTogglePlugin: vi.fn(),
    }
    // 两条目录行失败路径（各自只在自己那一页签上挂载）：可见文本里一个裸码都没有。
    const skillsTree = EnterpriseMarketLegacyShell({
      ...base,
      skillActionError: { id: skill.id, action: 'install', code: 'ENT_SKILL_HASH_MISMATCH' },
    })
    const pluginsTree = EnterpriseMarketLegacyShell({
      ...base,
      activeTab: 'plugins' as const,
      pluginActionError: { id: 'ent-a', action: 'install', code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
    })
    expectNoBareCode(visibleText(skillsTree), '目录行（技能）')
    expectNoBareCode(visibleText(pluginsTree), '目录行（插件）')
    expect(technicalCodes(skillsTree)).toContain('ENT_SKILL_HASH_MISMATCH')
    expect(technicalCodes(pluginsTree)).toContain('ENT_PLUGIN_SIGNATURE_INVALID')
    expect(failureCodes.length).toBeGreaterThan(0)

    // 详情三条失败路径：动作失败 / 文件树读取失败 / 文件正文读取失败。
    const detail = EnterpriseSkillDetailPage({
      row: skill,
      facts: enterpriseMarketSkillRowFacts({ view: 'page', enterpriseSkills: [skill] }, skill),
      installed: INSTALLED,
      actionError: { id: skill.id, action: 'uninstall', code: 'ENT_SKILL_HASH_MISMATCH' },
      fileEntries: [],
      filesLoading: false,
      filesErrorCode: 'ENT_SKILL_CONTENT_TOO_LARGE',
      fileLoading: false,
      fileErrorCode: 'ENT_SKILL_CONTENT_INVALID',
      onSelectFile: vi.fn(),
      onBack: vi.fn(),
    })
    expectNoBareCode(visibleText(detail), '技能详情（动作 / 文件树 / 正文）')
    expect(technicalCodes(detail)).toEqual(expect.arrayContaining([
      'ENT_SKILL_HASH_MISMATCH', 'ENT_SKILL_CONTENT_TOO_LARGE', 'ENT_SKILL_CONTENT_INVALID',
    ]))

    // 未映射码：走兜底人话，同样不露裸码。
    const unknown = EnterpriseSkillDetailPage({
      row: skill,
      facts: enterpriseMarketSkillRowFacts({ view: 'page', enterpriseSkills: [skill] }, skill),
      actionError: { id: skill.id, action: 'install', code: 'ENT_TOTALLY_UNKNOWN' },
      fileEntries: [],
      filesLoading: false,
      fileLoading: false,
      onSelectFile: vi.fn(),
      onBack: vi.fn(),
    })
    expectNoBareCode(visibleText(unknown), '未映射码')
    expect(visibleText(unknown)).toContain(ENTERPRISE_ERROR_FALLBACK_MESSAGE)
    expect(technicalCodes(unknown)).toContain('ENT_TOTALLY_UNKNOWN')
    expect(failureCodes.length).toBeGreaterThan(0)
  })

  it('renders every failure as human sentence + explicit next step + collapsed technical info', () => {
    const skill = rows()[0]!
    const tree = EnterpriseMarketLegacyShell({
      view: 'page',
      sessionUsable: true,
      enterpriseSkills: [skill],
      onToggleSkill: vi.fn(),
      skillActionError: { id: skill.id, action: 'install', code: 'ENT_SKILL_HASH_MISMATCH' },
    })
    const alert = byClassName(tree, 'own-market-inlineError')
    // 函数组件透明展开时同一个类名会同时命中「组件元素」与「它的产出」两处，故只断「至少一枚」。
    expect(alert.length).toBeGreaterThanOrEqual(1)
    expect(alert.some(entry => entry['role'] === 'alert')).toBe(true)
    const text = visibleText(tree)
    expect(text).toContain('安装失败')
    expect(text).toContain(enterpriseErrorMessage('ENT_SKILL_HASH_MISMATCH'))
    expect(text).toContain(ENTERPRISE_ERROR_ACTION_PREFIX)
    // 「技术信息」折叠区在树上（码就在里面，支持排障照旧取得到）。
    expect(text).toContain(ENTERPRISE_ERROR_TECH_SUMMARY)
    // 组件本身也可独立直调（同一枚组件，不依赖外壳）。
    expect(visibleText(EnterpriseErrorNotice({ code: 'ENT_SKILL_HASH_MISMATCH' }))).toContain('技术信息')
  })

  it('says the same sentence for the same failure on the row and in the detail', () => {
    const skill = rows()[0]!
    const facts = enterpriseMarketSkillRowFacts({ view: 'page', enterpriseSkills: [skill] }, skill)
    const error = { id: skill.id, action: 'install' as const, code: 'ENT_SKILL_HASH_MISMATCH' }
    const rowText = visibleText(EnterpriseMarketLegacyShell({
      view: 'page', sessionUsable: true, enterpriseSkills: [skill], onToggleSkill: vi.fn(), skillActionError: error,
    }))
    const detailText = visibleText(EnterpriseSkillDetailPage({
      row: skill, facts, installed: INSTALLED, actionError: error,
      fileEntries: [], filesLoading: false, fileLoading: false, onSelectFile: vi.fn(), onBack: vi.fn(),
    }))
    expect(rowText).toContain(enterpriseErrorMessage(error.code))
    expect(detailText).toContain(enterpriseErrorMessage(error.code))
  })
})

/** 可见文本里不许有裸码（`ENT_` 只准待在技术信息折叠区，那一块已被 visibleText 跳过）。 */
function expectNoBareCode(text: string, where: string): void {
  expect(text, where).not.toContain('ENT_')
}

describe('employee-facing terminology (plain words only)', () => {
  it('renames the four page tabs to 技能 / 插件 / 配方 / 组件 and keeps the section to 内容清单', () => {
    const tree = EnterpriseMarketLegacyShell({ view: 'page', activeTab: 'components' })
    const text = visibleText(tree)
    // 四枚页签 = 四个基础词。
    for (const label of MARKET_TAB_LABELS) expect(text).toContain(label)
    // 第四枚页签那一节的节标题仍是「内容清单」。
    expect(text).toContain('内容清单')
    expectNoBanned(text, '页签与节标题')
    // **新口径（本刀新增的锁）**：页签真源逐字就是那四个基础词，且**不带「企业」前缀**、
    // 也不回到「包含内容」那类降维长名（「企业」二字由标题行的徽章承担）。
    expect(ENTERPRISE_MARKET_TABS.map(tab => tab.label)).toEqual([...MARKET_TAB_LABELS])
    for (const label of MARKET_TAB_LABELS) {
      for (const banned of ['企业', '技术', '包含', '内容', '清单', '市场', '商店']) {
        expect(label, `页签 ${label} / ${banned}`).not.toContain(banned)
      }
    }
  })

  it('keeps the internal module paths off the employee screen', () => {
    const text = visibleText(EnterpriseMarketLegacyShell({ view: 'page', activeTab: 'components' }))
    for (const raw of ['dsh-preset', '.dshpreset', 'remote.pluginManager', 'official skills/list']) {
      expect(text, raw).not.toContain(raw)
    }
  })

  it('labels the version/source coordinate and the mono identifier with human words in the detail', () => {
    const skill = enterpriseMarketSkillRows([UPSTREAM_SKILL])[0]!
    const facts = enterpriseMarketSkillRowFacts({ view: 'page', enterpriseSkills: [skill] }, skill)
    const tree = EnterpriseSkillDetailPage({
      row: skill,
      facts,
      installed: INSTALLED,
      fileEntries: [],
      filesLoading: false,
      fileLoading: false,
      onSelectFile: vi.fn(),
      onBack: vi.fn(),
    })
    const text = visibleText(tree)
    // 完整坐标仍在（信息不删），但前面有「来源」这个人类标签。
    expect(text).toContain(UPSTREAM_SKILL.sourceDshVersion)
    expect(text).toContain(ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL)
    expect(byClassName(tree, 'own-market-detailSourceLabel')[0]?.['children']).toBe(ENTERPRISE_SKILL_DETAIL_SOURCE_LABEL)
    // 等宽标识行保留位置与取值，但带了人话标签与悬浮说明。
    expect(text).toContain(ENTERPRISE_SKILL_DETAIL_NAME_LABEL)
    expect(text).toContain(UPSTREAM_SKILL.skillId)
    const label = byClassName(tree, 'own-market-detailNameLabel')[0]
    expect(label?.['children']).toBe(ENTERPRISE_SKILL_DETAIL_NAME_LABEL)
    expect(typeof label?.['title']).toBe('string')
  })

  it('explains an upstream name that carries a technical acronym without rewriting it', () => {
    // 纯投影：命中才给一句人话，未命中安静缺席。
    expect(enterpriseSkillUpstreamNameNote('全能金融爬虫(新增MCP接入)')).toBe(ENTERPRISE_SKILL_UPSTREAM_NAME_NOTE)
    expect(enterpriseSkillUpstreamNameNote('会议纪要技能组')).toBeUndefined()
    expect(enterpriseSkillUpstreamNameNote('')).toBeUndefined()
    // 上游名称本身**一字不改**：详情里原样出现，旁边多一句解释。
    const skill = enterpriseMarketSkillRows([UPSTREAM_SKILL])[0]!
    const facts = enterpriseMarketSkillRowFacts({ view: 'page', enterpriseSkills: [skill] }, skill)
    const tree = EnterpriseSkillDetailPage({
      row: skill, facts, installed: INSTALLED, fileEntries: [], filesLoading: false, fileLoading: false,
      onSelectFile: vi.fn(), onBack: vi.fn(),
    })
    const text = visibleText(tree)
    expect(text).toContain(UPSTREAM_SKILL.displayName)
    expect(text).toContain(ENTERPRISE_SKILL_UPSTREAM_NAME_NOTE)
    // 没有技术缩写的技能不出这句噪音。
    const plain = enterpriseMarketSkillRows([PLAIN_SKILL])[0]!
    const plainTree = EnterpriseSkillDetailPage({
      row: plain,
      facts: enterpriseMarketSkillRowFacts({ view: 'page', enterpriseSkills: [plain] }, plain),
      installed: INSTALLED, fileEntries: [], filesLoading: false, fileLoading: false,
      onSelectFile: vi.fn(), onBack: vi.fn(),
    })
    expect(visibleText(plainTree)).not.toContain(ENTERPRISE_SKILL_UPSTREAM_NAME_NOTE)
  })

  it('keeps the anti-goal technical words out of every employee tab and the detail page', () => {
    const skills = enterpriseMarketSkillRows([UPSTREAM_SKILL])
    const skill = skills[0]!
    for (const activeTab of ['skills', 'plugins', 'components'] as const) {
      const tree = EnterpriseMarketLegacyShell({
        view: 'page',
        sessionUsable: true,
        activeTab,
        enterpriseSkills: skills,
        enterprisePlugins: [{ packageName: 'ent-a', version: '1.2.0', state: 'ACTIVE', inCatalog: true }] as never,
        installedSkills: [INSTALLED],
        skillActionError: { id: skill.id, action: 'install', code: 'ENT_SKILL_HASH_MISMATCH' },
        pluginActionError: { id: 'ent-a', action: 'install', code: 'ENT_PLUGIN_SIGNATURE_INVALID' },
        onToggleSkill: vi.fn(),
        onTogglePlugin: vi.fn(),
      })
      expectNoBanned(visibleText(tree), `页签 ${activeTab}`)
    }
    const detail = EnterpriseSkillDetailPage({
      row: skill,
      facts: enterpriseMarketSkillRowFacts({ view: 'page', enterpriseSkills: skills }, skill),
      installed: INSTALLED,
      actionError: { id: skill.id, action: 'install', code: 'ENT_SKILL_HASH_MISMATCH' },
      fileEntries: [],
      filesLoading: false,
      filesErrorCode: 'ENT_SKILL_CONTENT_TOO_LARGE',
      fileLoading: false,
      fileErrorCode: 'ENT_SKILL_CONTENT_INVALID',
      onSelectFile: vi.fn(),
      onBack: vi.fn(),
    })
    expectNoBanned(visibleText(detail), '技能详情')
  })

  it('★本刀（A2.2 话清剿）：可见文案里不出现开发侧/部署内部话 —— 连「接口」二字都不出现', async () => {
    // ★判据取自**真源文件本身**（不是渲染结果）：常量表与码表是全部可见文案的来源，
    //   剥掉注释后逐条扫 —— 注释里写沿革（"原文写的是…"）是**允许**的，**值**里出现才是问题。
    //   这一条比"逐页渲染后断言"覆盖更全：新加的一句文案一落地就进网，不必等谁想起来补渲染用例。
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => {
        const at = line.indexOf('//')
        return at === -1 ? line : line.slice(0, at)
      }).join('\n')
    const banned = ['本部署', 'DSH 侧', '这台 NUWAX 服务', '尚未在', '还没有提供', '没有这条只读', '接入中', '接口']
    for (const name of ['../src/esc/esc-copy.ts', '../src/error-messages.ts', '../src/library-panel.tsx']) {
      const code = strip(await readFile(new URL(name, import.meta.url), 'utf8'))
      for (const word of banned) expect(code, `${name} 的可见文案不许出现「${word}」`).not.toContain(word)
    }
    // ★反向锁：改干净之后**必须真的说了人话**（"删掉了旧句、也没给新句"同样是缺陷）。
    const messages = await readFile(new URL('../src/error-messages.ts', import.meta.url), 'utf8')
    for (const sentence of [
      '这次没有读到连接器清单。',
      '这次没有读到这一类目录。',
      '这次没有读到推荐内容。',
      '这里暂时还看不到你的专家。',
      '资料库这次没有打开。',
    ]) expect(messages, sentence).toContain(sentence)
    const copy = await readFile(new URL('../src/esc/esc-copy.ts', import.meta.url), 'utf8')
    expect(copy).toContain('当前版本暂不支持在此添加连接器')
    expect(copy).toContain('当前版本暂不支持创建专家')
    expect(copy).toContain('这个版本还没有这项功能')
    const library = await readFile(new URL('../src/library-panel.tsx', import.meta.url), 'utf8')
    expect(library).toContain("ENTERPRISE_LIBRARY_NOT_WIRED = '这个版本还没有这项功能'")
  })
})

describe('employee-facing failure rendering has exactly one implementation', () => {
  /** 渲染失败提示的那几页必须共用 `EnterpriseErrorNotice`，且不再自持任何码 → 文案表。 */
  const RENDERING_FILES = [
    'marketplace-entry.tsx', 'skill-market.tsx', 'preset-market.tsx', 'plugin-market.tsx',
    'account-view.tsx', 'login-page.tsx', 'feedback-dialog.tsx',
  ] as const

  it('routes every error page through the shared notice and keeps no local code table', async () => {
    const names = (await readdir(new URL('../src/', import.meta.url))).filter(name => /\.tsx?$/.test(name))
    let scanned = 0
    for (const name of names) {
      const source = await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')
      // 唯一映射之外，任何源文件都不许再把码当对象键映射成中文（那是第二份码表）。
      if (name !== 'error-messages.ts') {
        expect(source.match(/'ENT_[A-Z0-9_]+'\s*:/g) ?? [], name).toEqual([])
      }
      if ((RENDERING_FILES as readonly string[]).includes(name)) {
        scanned += 1
        expect(source, name).toContain('EnterpriseErrorNotice')
        expect(source, name).toContain("from './error-notice.js'")
      }
    }
    // 抽取器自证：七页一个都没漏。
    expect(scanned).toBe(RENDERING_FILES.length)
  })

  it('keeps the notice out of the host-only entry (no React on the Host half)', async () => {
    const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('error-notice')
  })
})
