/**
 * [INPUT]: 依赖 dsh-ui Client apply 与 `inject` 声明、账号菜单组件、插件市场入口与结构化 slots test double
 * [OUTPUT]: 验证 settings.section/settings.launcher/plugins.item/plugins.detail.badge 四处注册身份与共享 store 注入（设置区、个人中心、市场入口与 badge 槽同一 store，badge 槽位只注入 store）、`plugins.item` 注册的是**旧外观**外壳 `EnterpriseMarketLegacyPage`（官方插件页「官方」分组里的「插件市场」卡片＝本刀之后**唯一**的市场入口），并**反向锁死**独立应用商店的两处注册**已撤**——`main`（`enterprise-store` 整页面板）与 `sidebar.panellist`（「应用商店」一级入口）都不再出现，注册总数 6 → 4，导出的 `inject` 声明收敛为 `['slots','remote']`（`layout` 随两处注册一并撤掉），个人中心座位独有的官方主题源／桌面能力面／官方快捷键源（纯 Web 下动作面缺席、更新不可读、快捷键空快照），且 shell.overlay、旧 footer 入口与设置页页签均未注册
 * [POS]: dsh-ui Client 组合回归测试，锁定「官方设置区 + 官方个人中心座位 + 官方插件页入口卡片（旧外观，唯一市场入口）共用同一份商店逻辑」路线且不把 Host Context 传入 React
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  apply,
  EnterpriseAccountMenu,
  EnterpriseMarketBadge,
  EnterpriseMarketLegacyPage,
  EnterpriseSettingsSection,
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
    // `layout` 本刀已撤：它当初只为「从商店跳回官方插件列表」声明，而唯一使用场景（`enterprise-store` 面板）已删，
    // 全仓没有任何一处消费 `ctx.layout`／`selectPanel`，故声明面收敛回两项。
    expect(inject).toEqual(['slots', 'remote'])

    // 本刀撤掉独立应用商店的两处注册：注册面从六处回到四处，只留官方插件页那一处市场入口。
    expect(slotsInject.mock.calls.map(call => call[0])).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
    ])
    expect(registrations.map(item => item.options)).toMatchObject([
      { name: 'settings.section', id: 'enterprise', order: 25, label: '企业设置' },
      { name: 'settings.launcher' },
      { name: 'plugins.item', id: 'plugin-market', order: 50, label: '插件市场' },
      { name: 'plugins.detail.badge', id: 'plugin-market' },
    ])
    expect(registrations.map(item => item.component)).toEqual([
      EnterpriseSettingsSection,
      EnterpriseAccountMenu,
      // `plugins.item` 的详情页走**旧外观**外壳（9723a97 那一版官方两行卡片）——本刀之后它是唯一注册的市场入口。
      EnterpriseMarketLegacyPage,
      EnterpriseMarketBadge,
    ])
    // 设置区、个人中心、市场入口三个座位共享同一个脱敏 store；badge 槽位也无 inject 之外的多余源。
    const stores = registrations.slice(0, 3).map(item => (item.options['inject'] as () => { store: unknown })().store)
    expect(stores[0]).toBe(stores[1])
    expect(stores[2]).toBe(stores[0])
    // 只有个人中心座位另带主题/桌面/快捷键三份只读源；设置区、市场入口、badge 槽都只注入 store。
    const market = registrations[2]!.options['inject'] as () => Record<string, unknown>
    expect(market()).toEqual({ store: stores[2] })
    const badge = registrations[3]!.options['inject'] as () => Record<string, unknown>
    expect(badge()).toEqual({ store: stores[2] })
    // 【撤销锁】独立应用商店的两处注册面（`main` 面板 + `sidebar.panellist` 一级入口）必须都不再存在：
    // 注册里没有 `enterprise-store` 的 key/id、也没有那个 view='page' 的恒定注入（slot 名在用例尾部再锁一次）。
    expect(registrations.map(item => item.options['key'] ?? item.options['id'])).not.toContain('enterprise-store')
    expect(registrations.map(item => item.options['inject']).filter(Boolean)
      .map(read => (read as () => Record<string, unknown>)()))
      .not.toContainEqual(expect.objectContaining({ view: 'page' }))
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
    // 本刀撤销侧栏「应用商店」：独立应用商店的两处注册面（`sidebar.panellist` 一级入口 + `main` 整页面板）
    // 都不再注册，但卡片仍留在官方插件页（plugins.item 未撤）、也不占设置页页签。
    const names = registrations.map(item => item.options['name'])
    expect(names).not.toContain('sidebar.panellist')
    expect(names).not.toContain('main')
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
