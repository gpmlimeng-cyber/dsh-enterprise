/**
 * [INPUT]: 依赖 dsh-ui Client apply 与 `inject` 声明、账号菜单组件、插件市场入口与结构化 slots test double
 * [OUTPUT]: 验证 settings.section/settings.launcher/plugins.item/plugins.detail.badge/main/sidebar.panellist 六处注册身份与共享 store 注入（设置区、个人中心、市场入口、商店面板同一 store，市场入口靠它让详情页开关/登录弹窗取真值，badge 槽位只注入 store）、**两条入口注册的是两个不同的呈现外壳组件**（`plugins.item` → `EnterpriseMarketLegacyPage`（旧外观）、`main` → `EnterpriseMarketStorePage`（新外观），面板侧 inject 额外给 `view:'page'`——两条入口各用各的外观、共用同一份控制器逻辑）、独立应用商店的 key/id 同值（`main.key === sidebar.panellist.id === 'enterprise-store'`、order 20、label「应用商店」、图标为函数组件）、`inject` 声明含 `layout`，个人中心座位独有的官方主题源／桌面能力面／官方快捷键源（纯 Web 下动作面缺席、更新不可读、快捷键空快照），且 shell.overlay、旧 footer 入口与设置页页签均未注册
 * [POS]: dsh-ui Client 组合回归测试，锁定「官方设置区 + 官方个人中心座位 + 官方插件页入口卡片（旧外观）+ 侧栏一级入口／主内容区面板（新外观）共用同一份商店逻辑」路线且不把 Host Context 传入 React
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  apply,
  EnterpriseAccountMenu,
  EnterpriseMarketBadge,
  EnterpriseMarketLegacyPage,
  EnterpriseMarketStorePage,
  EnterpriseSettingsSection,
  EnterpriseStoreIcon,
  inject,
} from '../src/client.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: vi.fn(),
  IconEllipsisOutlineMedium: vi.fn(),
  IconLoadingOutlineMedium: vi.fn(),
  IconSettingsOutlineMedium: vi.fn(),
  IconUserOutlineMedium: vi.fn(),
  Input: vi.fn(),
  Menu: vi.fn(),
  MenuItemButton: vi.fn(),
  Modal: vi.fn(),
}))

describe('enterprise Client plugin', () => {
  it('registers the account section and the personal-center launcher through official slots', async () => {
    const registrations: { options: Record<string, unknown>; component: unknown }[] = []
    const register = vi.fn((options, component) => {
      registrations.push({ options, component })
      return () => undefined
    })
    const slotsInject = vi.fn((_name, callback: () => unknown) => callback())
    const remoteEvents: string[] = []
    const serviceWaits: string[][] = []
    apply({
      slots: { inject: slotsInject, register },
      remote: { $on: (event) => { remoteEvents.push(event); return () => undefined } },
      get: () => undefined,
      inject: (deps) => { serviceWaits.push([...deps]); return undefined },
      on: vi.fn(() => () => undefined),
      effect: effect => { effect() },
    })
    expect(remoteEvents).toContain('llm/adapters-updated')
    // 不硬注入 ui-theme 与 shortcuts：只各等一次服务出现来补发通知，服务缺席时插件照常激活。
    expect(serviceWaits).toEqual([['theme'], ['shortcuts']])
    // `layout` 是本刀新增的声明：官方 ui-layout 的导航服务（跳回官方插件列表要用 selectPanel）。
    expect(inject).toEqual(['slots', 'remote', 'layout'])

    expect(slotsInject.mock.calls.map(call => call[0])).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
      'main',
      'sidebar.panellist',
    ])
    expect(registrations.map(item => item.options)).toMatchObject([
      { name: 'settings.section', id: 'enterprise', order: 25, label: '企业设置' },
      { name: 'settings.launcher' },
      { name: 'plugins.item', id: 'plugin-market', order: 50, label: '插件市场' },
      { name: 'plugins.detail.badge', id: 'plugin-market' },
      // 独立应用商店：main 的 key 与 sidebar 行的 id 同值（官方「list id ↔ 同名 main 面板」契约）。
      { name: 'main', key: 'enterprise-store' },
      { name: 'sidebar.panellist', id: 'enterprise-store', order: 20, label: '应用商店' },
    ])
    expect(registrations.map(item => item.component)).toEqual([
      EnterpriseSettingsSection,
      EnterpriseAccountMenu,
      // `plugins.item` 的详情页走**旧外观**外壳（9723a97 那一版官方两行卡片）。
      EnterpriseMarketLegacyPage,
      EnterpriseMarketBadge,
      // 商店面板走**新外观**外壳（HERO + 官方卡片网格 + 搜索 + 行展开）。
      EnterpriseMarketStorePage,
      EnterpriseStoreIcon,
    ])
    // 设置区、个人中心、市场入口三个座位共享同一个脱敏 store；badge 槽位无 inject（版本签纯呈现）。
    const stores = registrations.slice(0, 3).map(item => (item.options['inject'] as () => { store: unknown })().store)
    expect(stores[0]).toBe(stores[1])
    expect(stores[2]).toBe(stores[0])
    // 只有个人中心座位另带主题/桌面/快捷键三份只读源；设置区、市场入口、badge 槽都只注入 store。
    const market = registrations[2]!.options['inject'] as () => Record<string, unknown>
    expect(market()).toEqual({ store: stores[2] })
    const badge = registrations[3]!.options['inject'] as () => Record<string, unknown>
    expect(badge()).toEqual({ store: stores[2] })
    // **双外观拆分**：商店面板与插件页市场条目注册的是**两个不同**的组件（各用各的呈现外壳），
    // 但两者共享同一份控制器逻辑与同一个 store；面板侧只多注入一个恒定等价的 view='page'。
    const panel = registrations[4]!.options['inject'] as () => Record<string, unknown>
    expect(panel()).toEqual({ store: stores[2], view: 'page' })
    expect(registrations[4]!.component).toBe(EnterpriseMarketStorePage)
    expect(registrations[2]!.component).toBe(EnterpriseMarketLegacyPage)
    expect(registrations[4]!.component).not.toBe(registrations[2]!.component)
    // 侧栏条目只带 list metadata（id/order/label），没有自有注入面；图标是函数组件（owner props: {size, active}）。
    expect(registrations[5]!.options['inject']).toBeUndefined()
    expect(registrations[5]!.options['id']).toBe(registrations[4]!.options['key'])
    expect(registrations[5]!.options['order']).toBe(20)
    expect(typeof registrations[5]!.component).toBe('function')
    expect(registrations[5]!.component).toBe(EnterpriseStoreIcon)
    // 外观选项组住在个人中心菜单里：只有该座位拿到官方主题源，设置区不碰主题。
    const section = registrations[0]!.options['inject'] as () => Record<string, unknown>
    const launcher = registrations[1]!.options['inject'] as () => {
      theme: { getSnapshot: () => unknown; subscribe: (listener: () => void) => () => void }
      desktop: { actions: unknown; updates: { available: boolean; getSnapshot: () => unknown } }
      shortcuts: { getSnapshot: () => { catalog: readonly unknown[]; fixed: readonly unknown[] } }
      shortcutsOpener: { open: () => Promise<{ readonly outcome: string }> }
    }
    expect(section()).not.toHaveProperty('theme')
    expect(section()).not.toHaveProperty('desktop')
    expect(section()).not.toHaveProperty('shortcuts')
    // 宿主没有 ui-theme 时源仍存在但读不到偏好，选项组据此禁用。
    expect(launcher().theme.getSnapshot()).toBeUndefined()
    expect(launcher().theme.subscribe(() => undefined)()).toBeUndefined()
    // 纯 Web / Node 里没有任何桌面载体：动作面缺席、更新不可读，维护组只剩「重新载入页面」。
    expect(launcher().desktop.actions).toBeUndefined()
    expect(launcher().desktop.updates.available).toBe(false)
    expect(launcher().desktop.updates.getSnapshot()).toBeUndefined()
    // 快捷键服务缺席时是常量空快照（引用稳定），入口行随之隐藏。
    expect(launcher().shortcuts.getSnapshot()).toEqual({ catalog: [], fixed: [] })
    expect(launcher().shortcuts.getSnapshot()).toBe(launcher().shortcuts.getSnapshot())
    // 快捷键 reach-in（unsupported workaround）随座位注入：测试宿主没有官方 slots 台账，
    // 打开时按「入口缺失」走降级，绝不抛错。
    await expect(launcher().shortcutsOpener.open()).resolves.toMatchObject({ outcome: 'unavailable' })
    expect(registrations.map(item => item.options['name'])).not.toContain('shell.overlay')
    // 官方账户行整行停用后，个人中心只由 launcher 座位承载，不再挂 footer 动作，避免第二入口。
    expect(registrations.map(item => item.options['name'])).not.toContain('sidebar.footer.action')
    // 二期结构切片后：应用商店有自己的侧栏一级入口与主内容区面板（同一个 id/key），
    // 但卡片仍留在官方插件页（plugins.item 未撤），且不顶替官方插件页、不占设置页页签。
    const names = registrations.map(item => item.options['name'])
    expect(names).toContain('sidebar.panellist')
    expect(names).toContain('main')
    expect(names).toContain('plugins.item')
    expect(names).not.toContain('settings.plugins.tab')
  })
})

/**
 * 队列第 8 项：设置页标题统一叫「企业设置」。
 * 断言面覆盖两处真源（`settings.section` 注册 label 与 `EnterpriseSettingsSection` 页内标题），
 * 并守住「不动」清单——账号菜单触发按钮的 aria-label 仍是「DSH Enterprise 账号菜单」。
 */
describe('the enterprise settings section is titled 企业设置', () => {
  it('drops the old name from every Client source file and keeps both titles identical', async () => {
    const { readFile, readdir } = await import('node:fs/promises')
    const directory = new URL('../src/', import.meta.url)
    const files = (await readdir(directory)).filter(name => /\.tsx?$/.test(name))
    const sources = await Promise.all(files.map(name => readFile(new URL(name, directory), 'utf8')))
    expect(sources.join('\n')).not.toContain('DSH Enterprise 设置')

    const client = await readFile(new URL('../src/client.tsx', import.meta.url), 'utf8')
    const view = await readFile(new URL('../src/account-view.tsx', import.meta.url), 'utf8')
    expect(client).toContain("label: '企业设置'")
    // 页内标题（h2）与 tablist 的无障碍名都取同一个词，两处不许分叉。
    expect(view.match(/企业设置/g)).toHaveLength(2)

    const menu = await readFile(new URL('../src/account-menu.tsx', import.meta.url), 'utf8')
    expect(menu).toContain("const MENU_LABEL = 'DSH Enterprise 账号菜单'")
  })
})
