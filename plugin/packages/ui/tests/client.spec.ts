/**
 * [INPUT]: 依赖 dsh-ui Client apply 与 `inject` 声明、账号菜单组件、三枚企业品牌占用者、插件市场入口与结构化 slots test double
 * [OUTPUT]: 验证 settings.section/settings.launcher/plugins.item/plugins.detail.badge 四处注册身份与共享 store 注入（设置区、个人中心、市场入口与 badge 槽同一 store，badge 槽位只注入 store）、`plugins.item` 注册的是**旧外观**外壳 `EnterpriseMarketLegacyPage`（官方插件页「官方」分组里的「插件市场」卡片＝本刀之后**唯一**的市场入口），并**反向锁死**独立应用商店的两处注册**已撤**——`main`（`enterprise-store` 整页面板）与 `sidebar.panellist`（「应用商店」一级入口）都不再出现，注册总数 6 → 4，导出的 `inject` 声明收敛为 `['slots','remote']`（`layout` 随两处注册一并撤掉），个人中心座位独有的官方主题源／桌面能力面／官方快捷键源（纯 Web 下动作面缺席、更新不可读、快捷键空快照），且 shell.overlay、旧 footer 入口与设置页页签均未注册；**本刀新增企业品牌三处消费点的注册面**：`sidebar.brand.mark`／`sidebar.brand.name`（priority -10 遮蔽官方 0）与 `conversation.hero.brand.mark`（priority 0）追加在 inject 面末尾，未配置品牌时**一个占用者都不注册**（官方鱼标／HeroFish 原样接管——single 槽只要有 occupant 就不再走 `opts.fallback`），品牌存在时三处以 -10/-10/0 注册且注入同一份已配置视图（用全局 fetch double 喂 `/status` 与 `/branding` 走完 apply → 取数 → 注册真实链路）
 * [POS]: dsh-ui Client 组合回归测试，锁定「官方设置区 + 官方个人中心座位 + 官方插件页入口卡片（旧外观，唯一市场入口）共用同一份商店逻辑 + 企业品牌只接官方已声明的三个展示位、无品牌时一格不占」路线且不把 Host Context 传入 React
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  apply,
  EnterpriseAccountMenu,
  EnterpriseHeroBrandMark,
  EnterpriseMarketBadge,
  EnterpriseMarketLegacyPage,
  EnterpriseSettingsSection,
  EnterpriseSidebarBrandMark,
  EnterpriseSidebarBrandName,
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
    // 末尾三处是本刀新增的**企业品牌消费点**（`bindEnterpriseBrandSeat` 各自走一次 `ctx.slots.inject`）：
    // 侧栏品牌行两格 + 「新会话」Hero 品牌位；测试环境读不到本机品牌路由＝未配置，故它们不产生任何注册。
    expect(slotsInject.mock.calls.map(call => call[0])).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
      'sidebar.brand.mark',
      'sidebar.brand.name',
      'conversation.hero.brand.mark',
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

  /**
   * 本刀新增：企业品牌的三处消费点。测试宿主里品牌路由取不到（相对 URL 在 Node 下不可取）＝未配置，
   * 于是**一个占用者都不注册**——这正是降级路径本身：single 槽只要有 occupant 就直接渲染它、
   * 官方 `opts.fallback` 不再生效，只有「不注册」才能让官方鱼标与官方 HeroFish 原样回来。
   */
  it('leaves all three brand cells to the official occupants while no enterprise brand exists', () => {
    const registrations: { options: Record<string, unknown>; component: unknown }[] = []
    const injected: string[] = []
    apply({
      slots: {
        inject: (name: string, callback: () => unknown) => { injected.push(name); return callback() },
        register: (options, component) => { registrations.push({ options, component }); return () => undefined },
      },
      remote: { $on: () => () => undefined },
      get: () => undefined,
      inject: () => undefined,
      on: vi.fn(() => () => undefined),
      effect: effect => { effect() },
    })
    expect(injected).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
      'sidebar.brand.mark',
      'sidebar.brand.name',
      'conversation.hero.brand.mark',
    ])
    expect(registrations.map(item => item.options['name'])).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
    ])
  })

  /**
   * 本刀新增：品牌确实存在时，三处座位以 -10／-10／0 注册，且注入给占用者的是同一份品牌视图。
   * 用全局 fetch double 喂 Host 本机只读路由的两个响应（`/status` 与 `/branding`），走完 apply → 取数 →
   * 注册的真实链路；`vi.unstubAllGlobals()` 收尾，避免污染同文件其它用例。
   */
  it('registers the three brand occupants with their shadowing priorities once a brand exists', async () => {
    const status = {
      data: { bundleVersion: '0.1.0', platformUrl: 'https://enterprise.example.com', state: 'SIGNED_OUT', transport: 'webServer.register' },
    }
    const branding = {
      data: {
        logo: {
          dark: null,
          light: '/enterprise/api/v1/local/branding/asset/light?v=1',
          square: '/enterprise/api/v1/local/branding/asset/square?v=1',
        },
        name: 'DeepSeek Harness',
        revision: 1,
        shortName: 'DSH 企业版',
        updatedAt: '2026-09-30T02:00:00Z',
        welcome: { editionLabel: '企业版', headline: '共赴未至之境' },
      },
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      json: async () => (url.includes('/branding') ? branding : status),
      ok: true,
      status: 200,
    })))
    try {
      const registrations: { options: Record<string, unknown>; component: unknown }[] = []
      apply({
        slots: {
          inject: (_name: string, callback: () => unknown) => callback(),
          register: (options, component) => { registrations.push({ options, component }); return () => undefined },
        },
        remote: { $on: () => () => undefined },
        get: () => undefined,
        inject: () => undefined,
        on: vi.fn(() => () => undefined),
        effect: effect => { effect() },
      })
      // 前四处是本插件的既有注册（设置区／个人中心／市场入口／badge），后三处是品牌座位。
      await vi.waitFor(() => { expect(registrations).toHaveLength(7) })
      const seats = registrations.slice(4)
      expect(seats.map(item => item.options)).toMatchObject([
        { name: 'sidebar.brand.mark', priority: -10 },
        { name: 'sidebar.brand.name', priority: -10 },
        { name: 'conversation.hero.brand.mark', priority: 0 },
      ])
      expect(seats.map(item => item.component)).toEqual([
        EnterpriseSidebarBrandMark,
        EnterpriseSidebarBrandName,
        EnterpriseHeroBrandMark,
      ])
      // 三处座位拿到的是同一份已配置视图（简称/全称/资产地址都来自本机只读路由）。
      const view = (seats[0]!.options['inject'] as () => { view: { custom: boolean; shortName: string } })().view
      expect(view).toMatchObject({ custom: true, shortName: 'DSH 企业版' })
      const nameView = (seats[1]!.options['inject'] as () => { view: unknown })().view
      expect(nameView).toEqual(view)
    } finally {
      vi.unstubAllGlobals()
    }
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
