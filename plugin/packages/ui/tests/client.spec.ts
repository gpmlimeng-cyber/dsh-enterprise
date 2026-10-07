/**
 * [INPUT]: 依赖 dsh-ui Client apply 与 `inject` 声明、账号菜单组件、三枚企业品牌占用者、插件市场入口与结构化 slots test double
 * [OUTPUT]: 验证 settings.section/settings.launcher/plugins.item/plugins.detail.badge 四处注册身份与共享 store 注入（设置区、个人中心、市场入口与 badge 槽同一 store，badge 槽位只注入 store）、`plugins.item` 注册的是**旧外观**外壳 `EnterpriseMarketLegacyPage`（官方插件页「官方」分组里的「插件市场」卡片＝本刀之后**唯一**的市场入口），并**反向锁死**独立应用商店的两处注册**已撤**——`main`（`enterprise-store` 整页面板）与 `sidebar.panellist`（「应用商店」一级入口）都不再出现，注册总数 6 → 4，导出的 `inject` 声明收敛为 `['slots','remote']`（`layout` 随两处注册一并撤掉），个人中心座位独有的官方主题源／桌面能力面／官方快捷键源（纯 Web 下动作面缺席、更新不可读、快捷键空快照），且 shell.overlay、旧 footer 入口与设置页页签均未注册；**本刀新增企业品牌三处消费点的注册面**：`sidebar.brand.mark`／`sidebar.brand.name`（priority -10 遮蔽官方 0）与 `conversation.hero.brand.mark`（priority 0）追加在 inject 面末尾，未配置品牌时**一个占用者都不注册**（官方鱼标／HeroFish 原样接管——single 槽只要有 occupant 就不再走 `opts.fallback`），品牌存在时三处以 -10/-10/0 注册且注入同一份已配置视图（用全局 fetch double 喂 `/status` 与 `/branding` 走完 apply → 取数 → 注册真实链路） **本刀**：inject 面末尾追加资料库两处座位名（`sidebar.panellist`/`main`，门默认关⇒不产生注册），`plugins.item` 的 inject 面断言由 `{store}` 改成 `{store, libraryGate}`。
 * [POS]: dsh-ui Client 组合回归测试，锁定「官方设置区 + 官方个人中心座位 + 官方插件页入口卡片（旧外观，唯一市场入口）共用同一份商店逻辑 + 企业品牌只接官方已声明的三个展示位、无品牌时一格不占」路线且不把 Host Context 传入 React
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  apply,
  EnterpriseAccountMenu,
  EnterpriseHeroBrandMark,
  EnterpriseMarketLegacyPage,
  EnterpriseMarketTitleSlot,
  EnterpriseSettingsSection,
  EnterpriseSidebarBrandMark,
  EnterpriseSidebarBrandName,
  inject,
} from '../src/client.js'
import { EnterpriseEscIcon } from '../src/esc/esc-entry.js'
import { EnterpriseEscPanel } from '../src/esc/esc-page.js'

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
  // esc（口径 31）用到的原语：工具栏的 Pill 与卡片上的 Switch/Tag（本文件不渲染它们，
  // 但 mock 面要如实列出，免得"mock 里没有这个导出"变成一条与本次改动无关的假失败）。
  Pill: vi.fn(),
  Switch: vi.fn(),
  Tag: vi.fn(),
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
    // 本刀再等一次 `inputTriggers`（官方 `@` 触发管线）——**同样不进 `inject` 数组**：缺席时只是没有 `@` 源。
    expect(serviceWaits).toEqual([['theme'], ['shortcuts'], ['inputTriggers']])
    // `layout` 本刀已撤：它当初只为「从商店跳回官方插件列表」声明，而唯一使用场景（`enterprise-store` 面板）已删，
    // 全仓没有任何一处消费 `ctx.layout`／`selectPanel`，故声明面收敛回两项。
    expect(inject).toEqual(['slots', 'remote'])

    // 本刀撤掉独立应用商店的两处注册：注册面从六处回到四处，只留官方插件页那一处市场入口。
    // 末尾三处是**企业品牌消费点**（`bindEnterpriseBrandSeat` 各自走一次 `ctx.slots.inject`）：
    // 侧栏品牌行两格 + 「新会话」Hero 品牌位；测试环境读不到本机品牌路由＝未配置，故它们不产生任何注册。
    // **本刀新增的最后两处**是资料库的两处座位（`bindEnterpriseLibrarySeats` 同一套 inject 手法）：
    // 管理门（本机设置）默认**关**，故这里同样一个占用者都不注册——反向锁在用例尾部再锁一次。
    expect(slotsInject.mock.calls.map(call => call[0])).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
      // ★ **`plugins.detail.actions` 那处已撤**（用户口径「刷新和添加应该和标题平行在一行」）：
      //   官方把 actions 槽渲染在 `_detailHead`（标题**上方**），badge 槽才渲染在 `_titleRow` 内部 ⇒
      //   两枚动作改由 `EnterpriseMarketTitleSlot` 与徽章一起挂在 badge 槽上，注册面回到四处。
      'sidebar.brand.mark',
      'sidebar.brand.name',
      'conversation.hero.brand.mark',
      'sidebar.panellist',
      'main',
      // **口径 31 新增的两处 esc 座位**（「专家·技能·连接器」独立页面，`bindEnterpriseEscSeats` 同一套 inject 手法）：
      // 与资料库那两处**结构差异只有一条**——它**常驻**（不设管理门），故这两处 inject 之后**真的注册占用者**
      // （见下面 `registrations` 里那两条 `expert-skill-connector`，槽名同样落在 `sidebar.panellist`/`main` 上）。
      'sidebar.panellist',
      'main',
      // **P1-A 新增的两处 composer 座位**（`bindEnterpriseLibrarySeat` 同一个 inject 手法）：
      // 「本轮已加入的资料」条（dock）与「@ 资料库」按钮（input.left）。门默认关 ⇒ 只 inject、不注册。
      'conversation.input.dock',
      'conversation.input.left',
    ])
    expect(registrations.map(item => item.options)).toMatchObject([
      { name: 'settings.section', id: 'enterprise', order: 25, label: '企业设置' },
      { name: 'settings.launcher' },
      { name: 'plugins.item', id: 'plugin-market', order: 50, label: '插件市场' },
      { name: 'plugins.detail.badge', id: 'plugin-market' },
      // esc 两处座位（常驻）：侧栏一级入口的 metadata 与 `main` 的同名 key——**同名是结构性的**
      // （官方按同名配对；不同名就是一个点不开的死入口），故这里把两边一起锁住。
      { name: 'sidebar.panellist', id: 'expert-skill-connector', order: 30, label: '专家·技能·连接器' },
      { name: 'main', key: 'expert-skill-connector' },
    ])
    expect(registrations.map(item => item.component)).toEqual([
      EnterpriseSettingsSection,
      EnterpriseAccountMenu,
      // `plugins.item` 的详情页走**旧外观**外壳（9723a97 那一版官方两行卡片）——本刀之后它是唯一注册的市场入口。
      EnterpriseMarketLegacyPage,
      // 标题行那一格：**「企业」徽章 + 两枚动作（刷新 / 「添加」）**同一个占用者。
      // ★ 从 `plugins.detail.actions` 搬到 `plugins.detail.badge`：官方把 actions 槽渲染在 `_detailHead`
      //   （标题**上方**），badge 槽才渲染在 `_titleRow` 内部 ⇒ 只有这样两枚按钮才与标题同排（用户口径）。
      EnterpriseMarketTitleSlot,
      // esc 的两处常驻占用者（口径 31）：图标组件 + 整页组件，与上面那条 `sidebar.panellist`/`main` 配对。
      EnterpriseEscIcon,
      EnterpriseEscPanel,
    ])
    // 设置区、个人中心、市场入口三个座位共享同一个脱敏 store；badge 槽位也无 inject 之外的多余源。
    const stores = registrations.slice(0, 3).map(item => (item.options['inject'] as () => { store: unknown })().store)
    expect(stores[0]).toBe(stores[1])
    expect(stores[2]).toBe(stores[0])
    // 只有个人中心座位另带主题/桌面/快捷键三份只读源；设置区、市场入口、badge 槽只注入 store
    // （市场入口多三份：资料库管理门——它是本机设置，与企业账号 store 不是一回事；
    //   配方降级链第二级的 `presetLaunch`——跳到新会话并把导入指令填进输入框；
    //   **`tabSeat`——标题右侧页签的共享座位源**，页面发布、`plugins.detail.actions` 槽订阅）。
    const market = registrations[2]!.options['inject'] as () => Record<string, unknown>
    const marketFace = market()
    expect(Object.keys(marketFace).sort()).toEqual(['libraryGate', 'presetLaunch', 'store', 'tabSeat'])
    expect(marketFace['store']).toBe(stores[2])
    expect(typeof (marketFace['libraryGate'] as { setEnabled?: unknown }).setEnabled).toBe('function')
    expect(typeof marketFace['presetLaunch']).toBe('function')
    // 座位源形状必须齐（订阅 / 取快照 / 发布三件），否则标题行那一格订阅不到页签。
    const seat = marketFace['tabSeat'] as { subscribe?: unknown; getSnapshot?: unknown; publish?: unknown }
    expect(typeof seat.subscribe).toBe('function')
    expect(typeof seat.getSnapshot).toBe('function')
    expect(typeof seat.publish).toBe('function')
    // 标题行那一格（badge 槽）现在**也**要 `tabSeat`：两枚动作（刷新 / 「添加」）与徽章同挂在它上面，
    // 动作要用 `activeTab` 决定出哪份清单、用 `addMenuOpen`/`onToggleAddMenu` 表达开合。
    const badge = registrations[3]!.options['inject'] as () => Record<string, unknown>
    const badgeFace = badge()
    expect(Object.keys(badgeFace).sort()).toEqual(['store', 'tabSeat'])
    expect(badgeFace['store']).toBe(stores[2])
    expect(badgeFace['tabSeat']).toBe(marketFace['tabSeat'])
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
    // 撤销锁（口径 31 之后更新）：`sidebar.panellist`/`main` 这两个**槽名**上此刻恰好各有一个占用者，
    // 且两边是**同一个** esc 页面（`expert-skill-connector`，常驻一级入口）——**不是**当初那两处应用商店座位。
    // 资料库那两处仍由管理门（默认关）压着、一个占用者都不注册（见上面的 inject 面锁）。
    // 卡片仍留在官方插件页（plugins.item 未撤）、也不占设置页页签。
    const names = registrations.map(item => item.options['name'])
    expect(names.filter(name => name === 'sidebar.panellist')).toHaveLength(1)
    expect(names.filter(name => name === 'main')).toHaveLength(1)
    const occupantIds = registrations.map(item => item.options['key'] ?? item.options['id'])
    expect(occupantIds).toContain('expert-skill-connector')
    expect(occupantIds).not.toContain('library')
    // 反向锁：无论谁回来，都别把那个已撤的商店 id 带回来。
    expect(registrations.map(item => item.options['key'] ?? item.options['id'])).not.toContain('enterprise-store')
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
      // `plugins.detail.actions` 已撤（两枚动作并入 badge 槽那一格，见文件顶部注释）。
      'sidebar.brand.mark',
      'sidebar.brand.name',
      'conversation.hero.brand.mark',
      // 资料库的两处座位用同一套 inject 手法；管理门默认关，故这里也只 inject、不注册；
      // esc 的两处**常驻**座位紧随其后（同一个 `sidebar.panellist`/`main` 槽名，注册表里会多两行，见下）。
      'sidebar.panellist',
      'main',
      'sidebar.panellist',
      'main',
      // P1-A 的两处 composer 座位同上：只 inject、不注册（门默认关）。
      'conversation.input.dock',
      'conversation.input.left',
    ])
    expect(registrations.map(item => item.options['name'])).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
      // esc 的两处常驻占用者（品牌未配置也不影响它们）。
      'sidebar.panellist',
      'main',
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
      // 前**四**处是本插件的既有注册（设置区／个人中心／市场入口／**标题行那一格**），接着是 esc 的两处
      // 常驻座位（口径 31），最后三处是品牌座位。（`plugins.detail.actions` 已撤 ⇒ 由五变四；esc 两处常驻 ⇒ 7 → 9。）
      await vi.waitFor(() => { expect(registrations).toHaveLength(9) })
      const seats = registrations.slice(6)
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

  /**
   * **P1-A 接线**：`@` 触发源与两处 composer 座位的注册/注销由**同一个管理门**驱动。
   *
   * 三件事一次锁死：① 门关（默认）⇒ 一个占用者都不注册、`registerSource` 一次都不调（未选中时输入区一切照旧）；
   * ② 门开 ⇒ 官方 `inputTriggers.registerSource` 收到**我们那枚源**（trigger/name/order/showGroupTitle 逐字），
   *    同时 dock 与 input.left 各注册一次；③ 再关门 ⇒ 源与两处占用者**真注销**（不是"返回 null"）。
   * 会话 id 的正规口子也在这里取证：dock 的 `inject(sessionId)` 必须把官方给的那个 id 交进组件。
   */
  it('drives the library @ trigger source and the two composer seats from the same local gate', async () => {
    const registrations: { options: Record<string, unknown>; component: unknown }[] = []
    const disposed = { dock: 0, button: 0, source: 0 }
    const register = vi.fn((options: Record<string, unknown>, component: unknown) => {
      registrations.push({ options, component })
      const name = options['name']
      return () => { if (name === 'conversation.input.dock') disposed.dock += 1; if (name === 'conversation.input.left') disposed.button += 1 }
    })
    const registerSource = vi.fn(() => () => { disposed.source += 1 })
    const triggerService = { registerSource }
    const waited: string[][] = []
    apply({
      slots: { inject: (_name: string, callback: () => unknown) => callback(), register },
      remote: { $on: () => () => undefined },
      // 只有 `inputTriggers` 这一个服务在场，别处照旧缺席。
      get: name => (name === 'inputTriggers' ? triggerService : undefined),
      // 官方 `ctx.inject(deps, cb)` 在依赖就绪时回调；这里服务已在场，故立刻回调（并记录等了谁）。
      inject: (deps: readonly string[], callback: () => void) => { waited.push([...deps]); callback(); return undefined },
      on: vi.fn(() => () => undefined),
      effect: effect => { effect() },
    })
    // ① 门默认关：composer 两处座位一个都没注册，`@` 源也没注册。
    //    （esc 的两处是**常驻**的，与这道门无关，故在清单里如实出现。）
    expect(registrations.map(item => item.options['name'])).toEqual([
      'settings.section',
      'settings.launcher',
      'plugins.item',
      'plugins.detail.badge',
      'sidebar.panellist',
      'main',
    ])
    expect(registerSource).not.toHaveBeenCalled()

    // ② 开门：官方源 + 两处座位都到位（管理门经 `plugins.item` 的 inject 面拿得到，与市场页那枚开关同源）。
    const market = registrations.find(item => item.options['name'] === 'plugins.item')!
    const gate = (market.options['inject'] as () => { libraryGate: { setEnabled(v: boolean): void } })().libraryGate
    gate.setEnabled(true)
    await vi.waitFor(() => { expect(registerSource).toHaveBeenCalledTimes(1) })
    const source = registerSource.mock.calls[0]![0] as Record<string, unknown>
    expect(source).toMatchObject({ trigger: '@', name: 'dshent-library', order: 30, showGroupTitle: false })
    expect(typeof source['candidates']).toBe('function')
    expect(typeof source['onPick']).toBe('function')
    const seats = registrations.filter(item => String(item.options['name']).startsWith('conversation.input.'))
    expect(seats.map(item => item.options)).toMatchObject([
      { name: 'conversation.input.dock', id: 'dshent-library-selection', order: 30 },
      { name: 'conversation.input.left', id: 'dshent-library-trigger', order: 30, label: '@ 资料库' },
    ])
    // dock 的 inject 面：官方交给 session 作用域座位的会话 id 原样进组件（这就是取值正规口子）。
    const face = (seats[0]!.options['inject'] as (sessionId: unknown) => { sessionId: string; selection: unknown })('session-7')
    expect(face.sessionId).toBe('session-7')
    expect(face.selection).toBeTruthy()

    // ③ 再关门：源与两处占用者**真撤**。
    gate.setEnabled(false)
    await vi.waitFor(() => { expect(disposed).toMatchObject({ dock: 1, button: 1, source: 1 }) })
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
