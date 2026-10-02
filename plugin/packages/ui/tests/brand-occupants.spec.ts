/**
 * [INPUT]: 依赖 brand-occupants 的三枚占用者与名称口径投影 `enterpriseBrandSeatName`、座位身份真源（含 priority）、品牌座位源 `createEnterpriseBrandingSeats` 与接线器 `bindEnterpriseBrandSeat`，branding 的视图折叠 `resolveEnterpriseBranding`／`EnterpriseBrandMark`／`EnterpriseBrandingDocument`，以及 EnterpriseAccountStore 的最小 double
 * [OUTPUT]: 锁定三件事——① 座位身份与优先级（侧栏两格 -10 遮蔽官方 0、Hero 0）；② 纯呈现口径（未配置/取数失败→null、已配置→企业 logo 与企业名、名称简称优先回退全称、Hero 接住 className 与 size）；③ 降级机制（未配置时一个占用者都不注册＝官方鱼标/HeroFish 原样接管，视图变化才重注册、不再配置就撤注册）
 * [POS]: dsh-ui 企业品牌消费点（侧栏品牌行 + 新会话 Hero 品牌位）的回归测试，真机视觉由 Harness 手工冒烟覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { EnterpriseAccountStore } from '../src/account-store.js'
import {
  bindEnterpriseBrandSeat,
  createEnterpriseBrandingSeats,
  enterpriseBrandSeatName,
  ENTERPRISE_HERO_BRAND_MARK_SEAT,
  ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT,
  ENTERPRISE_SIDEBAR_BRAND_NAME_SEAT,
  EnterpriseHeroBrandMark,
  EnterpriseSidebarBrandMark,
  EnterpriseSidebarBrandName,
  type EnterpriseBrandingSeats,
  type EnterpriseBrandSeatPorts,
} from '../src/brand-occupants.js'
import { EnterpriseBrandMark, resolveEnterpriseBranding, type EnterpriseBrandingDocument } from '../src/branding.js'

const CUSTOM: EnterpriseBrandingDocument = {
  logo: {
    dark: null,
    light: '/enterprise/api/v1/local/branding/asset/light?v=12',
    square: '/enterprise/api/v1/local/branding/asset/square?v=12',
  },
  name: 'DeepSeek Harness',
  revision: 12,
  shortName: 'DSH 企业版',
  updatedAt: '2026-09-30T02:00:00Z',
  welcome: { editionLabel: '企业版', headline: '共赴未至之境' },
}

const configured = resolveEnterpriseBranding(CUSTOM)
const unconfigured = resolveEnterpriseBranding(null)

/** 本仓测试无 jsdom，锁元素树只看 type 与 props；真渲染由真机冒烟覆盖。 */
function element(node: ReactNode): { readonly type: unknown; readonly props: Record<string, unknown> } {
  if (!isValidElement(node)) throw new Error('expected a React element')
  return node as unknown as { readonly type: unknown; readonly props: Record<string, unknown> }
}

/** 座位身份：官方 `sidebar.brand.mark`／`sidebar.brand.name` 有占用者（priority 0），Hero 那格没有。 */
describe('the three enterprise brand seats keep the shadowing priorities', () => {
  it('shadows the official sidebar pair at -10 and leaves the empty hero cell at 0', () => {
    expect(ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT).toEqual({ name: 'sidebar.brand.mark', priority: -10 })
    expect(ENTERPRISE_SIDEBAR_BRAND_NAME_SEAT).toEqual({ name: 'sidebar.brand.name', priority: -10 })
    expect(ENTERPRISE_HERO_BRAND_MARK_SEAT).toEqual({ name: 'conversation.hero.brand.mark', priority: 0 })
    // 官方 brand-official 在 priority 0 占着侧栏两格；single 槽同 priority 冲突会抛错、且取 priority 最低的
    // 那个活条目（lowest renders），所以侧栏必须严格低于 0；Hero 那格官方 occupants 为空，0 不产生冲突。
    expect(ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT.priority).toBeLessThan(0)
    expect(ENTERPRISE_SIDEBAR_BRAND_NAME_SEAT.priority).toBeLessThan(0)
  })
})

/** 纯呈现：未配置（含取数失败折叠出的内置视图）一律 null。 */
describe('occupants render nothing without an enterprise brand', () => {
  it('returns null for the built-in fallback view', () => {
    expect(unconfigured.custom).toBe(false)
    expect(EnterpriseSidebarBrandMark({ view: unconfigured })).toBeNull()
    expect(EnterpriseSidebarBrandName({ view: unconfigured })).toBeNull()
    expect(EnterpriseHeroBrandMark({ view: unconfigured })).toBeNull()
    // 取数失败与未配置在视图层是同一件事：custom === false。
    expect(resolveEnterpriseBranding(undefined).custom).toBe(false)
  })

  it('renders the enterprise logo and the enterprise name once configured', () => {
    const mark = element(EnterpriseSidebarBrandMark({ size: 24, view: configured }))
    // 24px 档走 branding.ts 既有的元素工厂：同一条本机只读资产、同一套减动效与 404 回落。
    expect(mark.type).toBe(EnterpriseBrandMark)
    expect(mark.props).toMatchObject({ size: 24, src: CUSTOM.logo.light, staticSrc: CUSTOM.logo.light })
    // 不传 size 时用官方 ownerProps 的默认档 24。
    expect(element(EnterpriseSidebarBrandMark({ view: configured })).props['size']).toBe(24)

    const name = element(EnterpriseSidebarBrandName({ view: configured }))
    expect(name.type).toBe('span')
    expect(name.props['children']).toBe('DSH 企业版')
  })

  it('prefers the short name and falls back to the full name', () => {
    expect(enterpriseBrandSeatName(configured)).toBe('DSH 企业版')
    expect(enterpriseBrandSeatName(resolveEnterpriseBranding({ ...CUSTOM, shortName: '' }))).toBe('DeepSeek Harness')
    // 后台只给了空白简称时同样回退全称（逐字段 trim/非空口径来自 resolveEnterpriseBranding）。
    expect(enterpriseBrandSeatName(resolveEnterpriseBranding({ ...CUSTOM, shortName: '   ' }))).toBe('DeepSeek Harness')
    // 未配置时的内置视图也必然给出一个非空名字（不会渲染空行）。
    expect(enterpriseBrandSeatName(unconfigured)).toBe('DSH Enterprise')
  })

  it('hands the host className and size through to the hero mark', () => {
    const hero = element(EnterpriseHeroBrandMark({ className: 'pXSMma_fish', size: 34, view: configured }))
    expect(hero.type).toBe('img')
    expect(hero.props).toMatchObject({
      className: 'pXSMma_fish',
      height: 34,
      src: configured.staticLogoSrc,
      width: 34,
    })
    // 官方 HeroShell 只传 size/className 时也给 34（ownerProps 声明的正方形边长）。
    expect(element(EnterpriseHeroBrandMark({ view: configured })).props['width']).toBe(34)
  })
})

/** 品牌座位源 double：可手动推视图变化。 */
function fakeSeats(initial = unconfigured) {
  let view = initial
  const listeners = new Set<() => void>()
  return {
    seats: {
      start: () => () => undefined,
      subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
      view: () => view,
    } satisfies EnterpriseBrandingSeats,
    set(next: typeof initial) { view = next; for (const listener of [...listeners]) listener() },
  }
}

/** 只喂 client.tsx 用到的那两个方法；把所有注册与注销记下来供断言。 */
function fakePorts() {
  const injected: string[] = []
  const registrations: { options: Readonly<Record<string, unknown>>; component: unknown }[] = []
  const disposers: (() => void)[] = []
  const ports: EnterpriseBrandSeatPorts = {
    inject: (name, register) => { injected.push(name); return register() },
    register: (options, component) => {
      registrations.push({ component, options })
      const dispose = vi.fn()
      disposers.push(dispose)
      return dispose
    },
  }
  return { disposers, injected, ports, registrations }
}

const noop = (): ReactNode => null

describe('the seat binding registers only while an enterprise brand exists', () => {
  it('registers nothing without a brand, so the official fish / HeroFish keep the cell', () => {
    const { seats } = fakeSeats()
    const { injected, ports, registrations } = fakePorts()
    const off = bindEnterpriseBrandSeat(ports, seats, ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT, noop)
    expect(injected).toEqual(['sidebar.brand.mark'])
    // 【降级锁】未配置 = 一个占用者都不留：single 槽只要有 occupant 就直接渲染它、官方 `opts.fallback`
    // 不再生效（渲染器 client.js:988-990），所以「注册了但返回 null」只会把这一格弄空；只有「不注册」
    // 才能让官方鱼标 / HeroFish 原样回来。
    expect(registrations).toEqual([])
    expect(typeof off).toBe('function')
  })

  it('registers with the seat identity and injects the current brand view once configured', () => {
    const { seats } = fakeSeats(configured)
    const { ports, registrations } = fakePorts()
    bindEnterpriseBrandSeat(ports, seats, ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT, noop)
    expect(registrations).toHaveLength(1)
    expect(registrations[0]!.options).toMatchObject({ name: 'sidebar.brand.mark', priority: -10 })
    expect(registrations[0]!.component).toBe(noop)
    const inject = registrations[0]!.options['inject'] as () => { view: unknown }
    expect(inject()).toEqual({ view: configured })
  })

  it('covers the other two seats with their own priorities', () => {
    for (const [seat, priority] of [
      [ENTERPRISE_SIDEBAR_BRAND_NAME_SEAT, -10],
      [ENTERPRISE_HERO_BRAND_MARK_SEAT, 0],
    ] as const) {
      const { seats } = fakeSeats(configured)
      const { injected, ports, registrations } = fakePorts()
      bindEnterpriseBrandSeat(ports, seats, seat, noop)
      expect(injected).toEqual([seat.name])
      expect(registrations[0]!.options).toMatchObject({ name: seat.name, priority })
    }
  })

  it('re-registers when the brand view changes, and withdraws when it disappears', () => {
    const { seats, set } = fakeSeats(configured)
    const { disposers, ports, registrations } = fakePorts()
    bindEnterpriseBrandSeat(ports, seats, ENTERPRISE_HERO_BRAND_MARK_SEAT, noop)
    expect(registrations).toHaveLength(1)
    // 同值通知不重注册（避免无意义的重挂载）。
    set(configured)
    expect(registrations).toHaveLength(1)
    // 品牌换版：先撤旧注册再注册新的，占用者随之用上新 logo/名字。
    set(resolveEnterpriseBranding({ ...CUSTOM, name: 'ACME 云', revision: 13, shortName: 'ACME' }))
    expect(registrations).toHaveLength(2)
    expect(disposers[0]).toHaveBeenCalledTimes(1)
    const inject = registrations[1]!.options['inject'] as () => { view: { name: string } }
    expect(inject().view.name).toBe('ACME 云')
    // 品牌被撤（或取数失败）：撤掉我们的注册，官方重新接管这一格。
    set(unconfigured)
    expect(disposers[1]).toHaveBeenCalledTimes(1)
    expect(registrations).toHaveLength(2)
  })

  it('disposes the registration and the subscription when the slot effect ends', () => {
    const { seats } = fakeSeats(configured)
    const { disposers, ports } = fakePorts()
    const off = bindEnterpriseBrandSeat(ports, seats, ENTERPRISE_SIDEBAR_BRAND_MARK_SEAT, noop) as () => void
    off()
    expect(disposers[0]).toHaveBeenCalledTimes(1)
  })
})

/** 品牌座位源：与 useEnterpriseBranding 同一份 deps 口径（Server 地址 / 连接状态），但必须 hook-free。 */
describe('createEnterpriseBrandingSeats reads the local branding route', () => {
  const status = {
    bundleVersion: '0.1.0',
    platformUrl: 'https://enterprise.example.com',
    state: 'READY',
    transport: 'webServer.register',
  }

  function store(double: (signal: AbortSignal) => Promise<EnterpriseBrandingDocument | null>) {
    const listeners = new Set<() => void>()
    let snapshot: Record<string, unknown> = { phase: 'ready', status }
    return {
      fake: {
        api: { branding: vi.fn(double) },
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
      } as unknown as EnterpriseAccountStore,
      push(next: unknown) {
        snapshot = { phase: 'ready', status: next }
        for (const listener of [...listeners]) listener()
      },
    }
  }

  it('folds the Host document into a configured view and notifies subscribers', async () => {
    const { fake } = store(async () => CUSTOM)
    const seats = createEnterpriseBrandingSeats(fake)
    const seen: string[] = []
    seats.subscribe(() => { seen.push(seats.view().name) })
    const off = seats.start()
    await vi.waitFor(() => { expect(seats.view().custom).toBe(true) })
    expect(seats.view().name).toBe('DeepSeek Harness')
    expect(seats.view().shortName).toBe('DSH 企业版')
    expect(seen).toContain('DeepSeek Harness')
    off()
  })

  it('degrades to the built-in view when the Host has no brand or the read fails', async () => {
    const empty = store(async () => null)
    const seats = createEnterpriseBrandingSeats(empty.fake)
    const off = seats.start()
    await vi.waitFor(() => { expect(empty.fake.api.branding).toHaveBeenCalled() })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(seats.view().custom).toBe(false)
    off()

    const broken = store(async () => { throw new Error('ENT_LOCAL_UNAVAILABLE') })
    const brokenSeats = createEnterpriseBrandingSeats(broken.fake)
    const offBroken = brokenSeats.start()
    await vi.waitFor(() => { expect(broken.fake.api.branding).toHaveBeenCalled() })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(brokenSeats.view().custom).toBe(false)
    expect(brokenSeats.view().name).toBe('DSH Enterprise')
    offBroken()
  })

  it('re-reads when the connection key changes, and stops when the seats are disposed', async () => {
    const { fake, push } = store(async () => CUSTOM)
    const seats = createEnterpriseBrandingSeats(fake)
    const off = seats.start()
    await vi.waitFor(() => { expect(seats.view().custom).toBe(true) })
    const first = fake.api.branding.mock.calls.length
    // 同一个 key 的重复通知不重读（与 useEnterpriseBranding 的 deps 口径一致）。
    push(status)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(fake.api.branding).toHaveBeenCalledTimes(first)
    push({ ...status, platformUrl: 'https://other.example.com' })
    await vi.waitFor(() => { expect(fake.api.branding.mock.calls.length).toBe(first + 1) })
    off()
    const settled = fake.api.branding.mock.calls.length
    push({ ...status, platformUrl: 'https://third.example.com' })
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(fake.api.branding).toHaveBeenCalledTimes(settled)
  })
})
