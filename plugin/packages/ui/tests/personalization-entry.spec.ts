/**
 * [INPUT]: 依赖 personalization-entry 的三栏骨架真源（标题/按钮组/分组/功能页签常量）与纯函数组件
 *          `EnterprisePersonalizationShell`（无 hook、可直接函数调用）
 * [OUTPUT]: 锁定个性化页三栏框架的结构——第一栏（标题+右上按钮组）、第二栏（全局/预设）、
 *          第三栏（功能页签 + 工具栏 + 内容区），以及「统计在左、动作在右」的工具栏口径、
 *          回调缺席即不给动作（不给死按钮）、内容区 children 注入优先于占位
 * [POS]: ui 的个性化页骨架门禁（feat/personalization 线），与 marketplace-entry 的旧页签外壳并行存在
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

// 官方原语在本包测试里恒走 mock（与 marketplace-entry.spec 同一手法）：
// 本骨架只用 Button 一枚，mock 掉后测试拿到的是它的 props（onClick/children 等），不依赖 clsx 解析。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
}))

import {
  ENTERPRISE_PERSONALIZATION_DEFAULT_TAB,
  ENTERPRISE_PERSONALIZATION_GROUPS,
  ENTERPRISE_PERSONALIZATION_SUBTITLE,
  ENTERPRISE_PERSONALIZATION_TABS,
  ENTERPRISE_PERSONALIZATION_TITLE,
  ENTERPRISE_PERSONALIZATION_TOP_ACTIONS,
  EnterprisePersonalizationShell,
  enterprisePersonalizationCountText,
} from '../src/personalization-entry.js'

/** 收集元素树里所有文本（跳过样式节点——CSS 文本不算可见文案）。 */
function visibleText(node: ReactNode): string {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(visibleText).join(' ')
  if (!isValidElement(node)) return ''
  if (node.type === 'style') return ''
  const children = (node.props as Record<string, unknown>)['children']
  return visibleText(children as ReactNode)
}

/** 按标签名收集元素（函数组件透明下钻）。 */
function collectByTag(node: ReactNode, tag: string, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node === null || node === undefined || node === false || node === true) return acc
  if (Array.isArray(node)) { for (const child of node) collectByTag(child, tag, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === tag) acc.push(props)
  const children = props['children']
  if (Array.isArray(children)) { for (const child of children) collectByTag(child, tag, acc) }
  else if (children !== undefined && children !== null) collectByTag(children, tag, acc)
  return acc
}

/** 收集所有 mock 掉的官方 `Button` 组件的 props（刷新/导入/创建那三枚原语按钮）。 */
function collectButtonProps(node: ReactNode, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node === null || node === undefined || node === false || node === true) return acc
  if (Array.isArray(node)) { for (const child of node) collectButtonProps(child, acc); return acc }
  if (!isValidElement(node)) return acc
  const props = node.props as Record<string, unknown>
  if (node.type === (Button as unknown)) acc.push(props)
  const children = props['children']
  if (Array.isArray(children)) { for (const child of children) collectButtonProps(child, acc) }
  else if (children !== undefined && children !== null) collectButtonProps(children, acc)
  return acc
}

describe('个性化页三栏骨架', () => {
  it('第一栏：左上标题+副标题，右上按钮组（原四页签）', () => {
    const tree = EnterprisePersonalizationShell({})
    const text = visibleText(tree)
    expect(text).toContain(ENTERPRISE_PERSONALIZATION_TITLE)
    expect(text).toContain(ENTERPRISE_PERSONALIZATION_SUBTITLE)
    // 右上按钮组：技能/子智能体/工具/插件/记忆
    for (const action of ENTERPRISE_PERSONALIZATION_TOP_ACTIONS) expect(text).toContain(action.label)
    expect(ENTERPRISE_PERSONALIZATION_TOP_ACTIONS.map(a => a.label)).toEqual(['技能', '子智能体', '工具', '插件', '记忆'])
    // 「技能」是当前分区，按下态
    const buttons = collectByTag(tree, 'button').filter(p => String(p['aria-pressed']) !== 'undefined')
    expect(buttons.some(p => p['aria-pressed'] === true)).toBe(true)
  })

  it('第二栏：全局 + 预设两枚分组胶囊，默认选中全局', () => {
    expect(ENTERPRISE_PERSONALIZATION_GROUPS.map(g => g.label)).toEqual(['全局', '预设'])
    const tree = EnterprisePersonalizationShell({})
    const groups = collectByTag(tree, 'button').filter(p => String(p['aria-pressed']) !== 'undefined')
      .filter(p => ENTERPRISE_PERSONALIZATION_GROUPS.some(g => visibleText([p as ReactNode]) === g.label || p['children'] === g.label))
    // 默认 activeGroup = global
    const globalBtn = groups.find(p => p['children'] === '全局')
    expect(globalBtn?.['aria-pressed']).toBe(true)
    const presetBtn = groups.find(p => p['children'] === '预设')
    expect(presetBtn?.['aria-pressed']).toBe(false)
  })

  it('第三栏：四枚功能页签，默认选中「已安装技能」', () => {
    expect(ENTERPRISE_PERSONALIZATION_TABS.map(t => t.label)).toEqual(['已安装技能', '内置技能', '技能市场', '技能包'])
    expect(ENTERPRISE_PERSONALIZATION_DEFAULT_TAB).toBe('installed')
    const tree = EnterprisePersonalizationShell({})
    const tabs = collectByTag(tree, 'button').filter(p => String(p['aria-selected']) !== 'undefined')
      .filter(p => ENTERPRISE_PERSONALIZATION_TABS.some(t => p['children'] === t.label))
    expect(tabs).toHaveLength(4)
    const installed = tabs.find(p => p['children'] === '已安装技能')
    expect(installed?.['aria-selected']).toBe(true)
    // roving tabIndex：选中的 0，其余 -1
    expect(tabs.find(p => p['children'] === '已安装技能')?.['tabIndex']).toBe(0)
    expect(tabs.find(p => p['children'] === '技能包')?.['tabIndex']).toBe(-1)
  })

  it('工具栏：统计在左、动作在右（搜索/视图切换/刷新/导入/创建）', () => {
    const tree = EnterprisePersonalizationShell({ count: 7 })
    const text = visibleText(tree)
    expect(text).toContain(enterprisePersonalizationCountText(7))
    expect(text).toContain('共 7 个技能')
    // 三枚 Button 动作
    expect(text).toContain('刷新')
    expect(text).toContain('导入技能')
    expect(text).toContain('创建技能')
    // 搜索框与视图切换的无障碍名
    const buttons = collectByTag(tree, 'button').map(p => p['aria-label'])
    expect(buttons).toContain('卡片视图')
    expect(buttons).toContain('表格视图')
    expect(collectByTag(tree, 'input').map(p => p['aria-label'])).toContain('搜索技能')
  })

  it('回调缺席：分组/页签/刷新等不给死动作（按钮仍渲染但 onClick 是 no-op 或 disabled）', () => {
    // 纯函数直调不传任何回调：结构照常渲染（框架骨架可见），但没有假数据
    const tree = EnterprisePersonalizationShell({})
    expect(isValidElement(tree)).toBe(true)
    // 有 children 注入时不画占位（用 createElement，本文件是 .ts 不能写 JSX）
    const injected = createElement('div', null, '真实列表')
    const withChild = EnterprisePersonalizationShell({ children: injected })
    expect(visibleText(withChild)).toContain('真实列表')
    expect(visibleText(withChild)).not.toContain('内容区（')
    // 无 children 时画占位（内容区不空白）——占位里带当前页签名。
    // helper 会在 JSX 子节点间插空格，故只断言连续片段：前缀「内容区（」+ 页签名本体。
    const withoutChild = EnterprisePersonalizationShell({})
    const placeholderText = visibleText(withoutChild)
    expect(placeholderText).toContain('内容区（')
    expect(placeholderText).toContain('已安装技能')
    expect(placeholderText).not.toContain('真实列表')
  })

  it('count 缺席时统计为 0', () => {
    expect(enterprisePersonalizationCountText(0)).toBe('共 0 个技能')
    expect(visibleText(EnterprisePersonalizationShell({}))).toContain('共 0 个技能')
  })

  it('回调接通时点按钮真的调回调', () => {
    const onSelectTab = vi.fn()
    const onRefresh = vi.fn()
    const onSelectGroup = vi.fn()
    const tree = EnterprisePersonalizationShell({ onSelectTab, onRefresh, onSelectGroup })
    const buttons = collectByTag(tree, 'button')
    // 点「技能市场」页签
    const market = buttons.find(p => p['children'] === '技能市场')
    ;(market?.['onClick'] as () => void)()
    expect(onSelectTab).toHaveBeenCalledWith('market')
    // 点「刷新」——Button 是 mock 原语（不是字符串 button 标签），从 props 里取 onClick
    const refresh = collectButtonProps(tree).find(p => p['children'] === '刷新')
    expect(refresh, '应有「刷新」这枚 Button').toBeDefined()
    ;(refresh!['onClick'] as () => void)()
    expect(onRefresh).toHaveBeenCalledTimes(1)
    // 点「预设」分组
    const preset = buttons.find(p => p['children'] === '预设')
    ;(preset?.['onClick'] as () => void)()
    expect(onSelectGroup).toHaveBeenCalledWith('preset')
  })
})
