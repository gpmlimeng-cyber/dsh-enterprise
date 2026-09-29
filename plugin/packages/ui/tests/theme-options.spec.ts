/**
 * [INPUT]: 依赖 theme-options 的偏好词表、官方主题只读源工厂、选项组模型与点击写入决策，以及一个记录调用并支持「服务晚到」的官方主题服务替身
 * [OUTPUT]: 锁定外观选项组正好覆盖官方 light/dark/system、选中态来自官方 getTheme 回读、点击经官方 setTheme 写入并可回读、theme/change 与晚到服务都能驱动订阅、主题服务缺席或取值非法时整组禁用且不落本地状态
 * [POS]: dsh-ui 外观选项组的无 React 契约回归，真实分段交互与视觉由 Harness 手工冒烟覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_THEME_ABSENT,
  ENTERPRISE_THEME_PREFERENCES,
  createEnterpriseThemeSource,
  enterpriseThemeRow,
  isEnterpriseThemePreference,
  selectEnterpriseTheme,
  type EnterpriseThemeContextPort,
} from '../src/theme-options.js'

/**
 * 官方 ThemeRuntime 的替身：setTheme 写入后按 `theme/change` 通知，读取永远回当前值；
 * `available: false` 模拟 ui-theme 晚于本插件 provide，`provide()` 兑现等待中的服务回调。
 */
interface FakeTheme {
  readonly context: EnterpriseThemeContextPort
  readonly writes: string[]
  publish(preference: string): void
  provide(): void
}

function fakeTheme(initial: string, available = true): FakeTheme {
  const writes: string[] = []
  const listeners = new Set<() => void>()
  const arrivals = new Set<() => void>()
  let ready = available
  let preference = initial
  const notify = (): void => { for (const listener of [...listeners]) listener() }
  const service = {
    getTheme: () => ({ preference }),
    setTheme: (id: string) => { writes.push(id); preference = id; notify() },
  }
  return {
    writes,
    context: {
      get: () => (ready ? service : undefined),
      on: (_event, listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
      inject: (deps, callback) => { if (deps.includes('theme')) arrivals.add(callback); return undefined },
    },
    publish: (next) => { preference = next; notify() },
    provide: () => { ready = true; for (const callback of [...arrivals]) callback() },
  }
}

/** 选项组正好覆盖官方偏好集合，顺序与官方外观行一致。 */
describe('the appearance group covers the official preference set', () => {
  it('offers light, dark and system in the official order', () => {
    expect(ENTERPRISE_THEME_PREFERENCES).toEqual(['light', 'dark', 'system'])
    expect(enterpriseThemeRow('dark').options.map(option => [option.id, option.label]))
      .toEqual([['light', '浅色'], ['dark', '深色'], ['system', '跟随系统']])
    expect(enterpriseThemeRow('dark').label).toBe('外观')
    expect(isEnterpriseThemePreference('system')).toBe(true)
    expect(isEnterpriseThemePreference('midnight')).toBe(false)
  })
})

/** 选中态是官方回读值，不是本地 state：改变官方偏好后，同一份模型立即跟随。 */
describe('the selected segment comes from the official theme service', () => {
  it('reads the current preference back from getTheme and follows later changes', () => {
    const fake = fakeTheme('dark')
    const source = createEnterpriseThemeSource(fake.context)
    expect(source.getSnapshot()).toBe('dark')
    expect(enterpriseThemeRow(source.getSnapshot()).options.map(option => option.selected))
      .toEqual([false, true, false])
    fake.publish('system')
    expect(source.getSnapshot()).toBe('system')
    expect(enterpriseThemeRow(source.getSnapshot()).options.map(option => option.selected))
      .toEqual([false, false, true])
  })

  it('notifies subscribers on theme/change and releases the listener with the last subscriber', () => {
    const fake = fakeTheme('light')
    const source = createEnterpriseThemeSource(fake.context)
    const listener = vi.fn()
    const off = source.subscribe(listener)
    fake.publish('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    fake.publish('system')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('re-notifies a mounted subscriber when the host provides the theme service late', () => {
    const fake = fakeTheme('dark', false)
    const source = createEnterpriseThemeSource(fake.context)
    const listener = vi.fn()
    source.subscribe(listener)
    expect(source.getSnapshot()).toBeUndefined()
    expect(enterpriseThemeRow(source.getSnapshot()).options.every(option => option.disabled)).toBe(true)
    fake.provide()
    expect(source.getSnapshot()).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

/** 点击就是官方写入路径：setTheme 收到选中值，随后同一来源回读到该值；重复点击不重复写。 */
describe('selecting a segment writes through the official theme API', () => {
  it('calls the official setTheme and re-reads the chosen preference', () => {
    const fake = fakeTheme('system')
    const source = createEnterpriseThemeSource(fake.context)
    selectEnterpriseTheme(source, source.getSnapshot(), 'light')
    expect(fake.writes).toEqual(['light'])
    expect(source.getSnapshot()).toBe('light')
    selectEnterpriseTheme(source, source.getSnapshot(), 'light')
    expect(fake.writes).toEqual(['light'])
    expect(enterpriseThemeRow(source.getSnapshot()).options.map(option => option.selected))
      .toEqual([true, false, false])
  })
})

/** 宿主没有 ui-theme、或官方偏好取值不在词表内时，整组禁用而不是假装选中或落本地状态。 */
describe('the group degrades when the host exposes no usable theme service', () => {
  it('disables every segment and writes nothing without the service', () => {
    const source = createEnterpriseThemeSource({ get: () => undefined, inject: () => undefined, on: () => () => undefined })
    expect(source.getSnapshot()).toBeUndefined()
    expect(enterpriseThemeRow(source.getSnapshot()).options.every(option => option.disabled)).toBe(true)
    expect(() => { selectEnterpriseTheme(source, source.getSnapshot(), 'dark') }).not.toThrow()
  })

  it('treats a foreign or out-of-vocabulary value as unavailable', () => {
    const context: EnterpriseThemeContextPort = {
      get: () => ({ setTheme: () => undefined }),
      inject: () => undefined,
      on: () => () => undefined,
    }
    expect(createEnterpriseThemeSource(context).getSnapshot()).toBeUndefined()
    expect(createEnterpriseThemeSource(fakeTheme('midnight').context).getSnapshot()).toBeUndefined()
    expect(enterpriseThemeRow(undefined).options.every(option => option.disabled)).toBe(true)
    expect(ENTERPRISE_THEME_ABSENT.getSnapshot()).toBeUndefined()
    expect(ENTERPRISE_THEME_ABSENT.subscribe(() => undefined)()).toBeUndefined()
  })
})
