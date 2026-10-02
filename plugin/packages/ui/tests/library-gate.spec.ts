/**
 * [INPUT]: 依赖 library-gate 的管理门真源与三个口径函数（`createEnterpriseLibraryGate` / `createEnterpriseLibraryLocalStorage` /
 *          `enterpriseLibraryGateValue` / `enterpriseLibraryGateEnabled` / 默认值与存储键常量），以及一个**假本机设置**（读/写各自可注入失败与内容）
 * [OUTPUT]: 锁定资料库管理开关（本地设置）的行为契约：默认**关**、拨动**立刻生效**再写、切换后**真的持久化**、
 *          写失败**可见可重试**（值不被回滚）、读失败按默认关并给码、值没变且已保存不重复写
 * [POS]: 「组件行那枚 Switch 的状态存本机设置」这条要求的**行为门禁**。本仓 vitest 没有 DOM，故取证落在
 *        组件与侧栏座位共同订阅的那个非 React 真源上（它们都只是 `subscribe`/`getSnapshot` 的订户）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_LIBRARY_GATE_DEFAULT,
  ENTERPRISE_LIBRARY_GATE_OFF,
  ENTERPRISE_LIBRARY_GATE_ON,
  ENTERPRISE_LIBRARY_GATE_STORAGE_KEY,
  createEnterpriseLibraryGate,
  createEnterpriseLibraryLocalStorage,
  enterpriseLibraryGateEnabled,
  enterpriseLibraryGateValue,
  type EnterpriseLibraryGateStorage,
} from '../src/library-gate.js'

/** 一份可编排的假本机设置：写次数是「重试真的再写一次」的取证点，读写各自可注入失败。 */
function fakeStorage(initial?: string) {
  let value = initial
  let reads = 0
  let readFails = false
  let writeFails = false
  const writes: string[] = []
  const storage: EnterpriseLibraryGateStorage = {
    read(): string | undefined {
      reads += 1
      if (readFails) throw new Error('本机设置不可用')
      return value
    },
    write(next: string): void {
      if (writeFails) throw new Error('本机设置不可用')
      writes.push(next)
      value = next
    },
  }
  return {
    storage,
    reads: (): number => reads,
    writes: (): readonly string[] => writes,
    value: (): string | undefined => value,
    failRead: (on: boolean): void => { readFails = on },
    failWrite: (on: boolean): void => { writeFails = on },
  }
}

describe('资料库管理开关（本机设置）', () => {
  it('默认关：没保存过、存的值不认识、读不出来，一律按关处理', () => {
    // 值 → 布尔的唯一解析口径。
    expect(enterpriseLibraryGateValue(true)).toBe(ENTERPRISE_LIBRARY_GATE_ON)
    expect(enterpriseLibraryGateValue(false)).toBe(ENTERPRISE_LIBRARY_GATE_OFF)
    expect(enterpriseLibraryGateEnabled(ENTERPRISE_LIBRARY_GATE_ON)).toBe(true)
    expect(enterpriseLibraryGateEnabled(ENTERPRISE_LIBRARY_GATE_OFF)).toBe(false)
    expect(enterpriseLibraryGateEnabled(undefined)).toBe(ENTERPRISE_LIBRARY_GATE_DEFAULT)
    expect(enterpriseLibraryGateEnabled('乱七八糟')).toBe(ENTERPRISE_LIBRARY_GATE_DEFAULT)
    expect(ENTERPRISE_LIBRARY_GATE_DEFAULT).toBe(false)
    expect(ENTERPRISE_LIBRARY_GATE_STORAGE_KEY).toBe('dshent.library.enabled')

    // 建源即读一次：没保存过 → 关，没有失败码（「没保存过」不是错误）。
    const empty = fakeStorage(undefined)
    const fresh = createEnterpriseLibraryGate(empty.storage)
    expect(empty.reads()).toBe(1)
    expect(fresh.getSnapshot()).toEqual({ enabled: false, persisted: false, saving: false })

    // 存的是不认识的值 → 仍按关（并把「当前值没落盘」如实标出来，拨一次就会把它修正成 off）。
    const garbage = createEnterpriseLibraryGate(fakeStorage('乱七八糟').storage)
    expect(garbage.getSnapshot()).toEqual({ enabled: false, persisted: false, saving: false })

    // 保存过 on → 开，且 persisted=true（本机存的就是当前值）。
    const stored = createEnterpriseLibraryGate(fakeStorage(ENTERPRISE_LIBRARY_GATE_ON).storage)
    expect(stored.getSnapshot()).toEqual({ enabled: true, persisted: true, saving: false })

    // 读不出来 → 按默认关 + 读取失败码（不是静默回落）。
    const failing = createEnterpriseLibraryGate({
      read: () => { throw new Error('不可用') },
      write: () => undefined,
    })
    expect(failing.getSnapshot()).toEqual({
      enabled: false,
      persisted: false,
      saving: false,
      errorCode: 'ENT_LIBRARY_SETTING_READ_FAILED',
    })
  })

  it('拨动立刻生效（订阅者先看到新值），随后真的写进本机设置', () => {
    const fake = fakeStorage(undefined)
    const gate = createEnterpriseLibraryGate(fake.storage)
    const seen: boolean[] = []
    const off = gate.subscribe(() => { seen.push(gate.getSnapshot().enabled) })

    gate.setEnabled(true)

    // 立刻生效：第一次通知时值就已经是用户要的方向（侧栏入口据此随之出现）。
    expect(seen[0]).toBe(true)
    // 真的持久化：本机设置收到 on。
    expect(fake.writes()).toEqual([ENTERPRISE_LIBRARY_GATE_ON])
    expect(fake.value()).toBe(ENTERPRISE_LIBRARY_GATE_ON)
    expect(gate.getSnapshot()).toEqual({ enabled: true, persisted: true, saving: false })

    // 关回去同样落盘。
    gate.setEnabled(false)
    expect(fake.writes()).toEqual([ENTERPRISE_LIBRARY_GATE_ON, ENTERPRISE_LIBRARY_GATE_OFF])
    expect(gate.getSnapshot()).toEqual({ enabled: false, persisted: true, saving: false })

    // 值没变且已保存过 → 不再白写一次。
    gate.setEnabled(false)
    expect(fake.writes()).toHaveLength(2)

    off()
    const notified = seen.length
    gate.setEnabled(true)
    expect(seen.length).toBe(notified)
  })

  it('写失败：值照样立刻生效，失败摆进快照并可重试（重试真的再写一次）', () => {
    const fake = fakeStorage(undefined)
    const gate = createEnterpriseLibraryGate(fake.storage)
    fake.failWrite(true)

    gate.setEnabled(true)

    // 用户的动作没有被吞掉：门是开的（侧栏入口出现），只是**没有保存到本机**。
    expect(gate.getSnapshot()).toEqual({
      enabled: true,
      persisted: false,
      saving: false,
      errorCode: 'ENT_LIBRARY_SETTING_SAVE_FAILED',
    })
    expect(fake.writes()).toEqual([])

    // 重试：本机设置恢复后 `retry()` 真的再写一次，并清掉失败码。
    fake.failWrite(false)
    gate.retry()
    expect(fake.writes()).toEqual([ENTERPRISE_LIBRARY_GATE_ON])
    expect(gate.getSnapshot()).toEqual({ enabled: true, persisted: true, saving: false })

    // 重新拨一次也是重试（不必先点重试按钮）。
    fake.failWrite(true)
    gate.setEnabled(false)
    expect(gate.getSnapshot().errorCode).toBe('ENT_LIBRARY_SETTING_SAVE_FAILED')
    fake.failWrite(false)
    gate.setEnabled(true)
    expect(gate.getSnapshot()).toEqual({ enabled: true, persisted: true, saving: false })
  })

  it('读失败：按默认关处理，重试会真的重读一次本机设置', () => {
    const fake = fakeStorage(ENTERPRISE_LIBRARY_GATE_ON)
    fake.failRead(true)
    const gate = createEnterpriseLibraryGate(fake.storage)
    expect(gate.getSnapshot().errorCode).toBe('ENT_LIBRARY_SETTING_READ_FAILED')
    expect(fake.reads()).toBe(1)

    fake.failRead(false)
    gate.retry()
    expect(fake.reads()).toBe(2)
    expect(gate.getSnapshot()).toEqual({ enabled: true, persisted: true, saving: false })
  })

  it('默认端口就落在本机设置的同一条键上；本机存储不可用时读与写都如实失败', () => {
    const storage = createEnterpriseLibraryLocalStorage()
    expect(typeof storage.read).toBe('function')
    expect(typeof storage.write).toBe('function')
    expect(ENTERPRISE_LIBRARY_GATE_STORAGE_KEY).toBe('dshent.library.enabled')
    const gate = createEnterpriseLibraryGate(storage)
    expect(gate.getSnapshot().enabled).toBe(ENTERPRISE_LIBRARY_GATE_DEFAULT)
    // 测试环境（Node / 沙箱）里没有浏览器本机存储：读不到 → 按默认关 + **显式**失败码，写也如实抛。
    if ((globalThis as { localStorage?: unknown }).localStorage === undefined) {
      expect(gate.getSnapshot().errorCode).toBe('ENT_LIBRARY_SETTING_READ_FAILED')
      expect(() => storage.write(ENTERPRISE_LIBRARY_GATE_ON)).toThrow()
    }
  })

  it('订阅是逐份通知且可以注销', () => {
    const gate = createEnterpriseLibraryGate(fakeStorage(undefined).storage)
    const listener = vi.fn()
    const off = gate.subscribe(listener)
    gate.setEnabled(true)
    // 一次拨动恰好三次快照变化：**立刻生效**（enabled 翻过去）/ 写入中（saving=true）/ 写完（saving=false）。
    // 前两次是「门已经开了」的形状，界面据此既能让侧栏入口立刻出现、又能在写入在途时禁用那枚 Switch。
    expect(listener).toHaveBeenCalledTimes(3)
    off()
    gate.setEnabled(false)
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
