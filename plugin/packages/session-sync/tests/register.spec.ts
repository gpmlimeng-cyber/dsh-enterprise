/**
 * [INPUT]: 依赖 registerSessionSync 与 spy fetch
 * [OUTPUT]: 验证 enabled=false 零网络；enabled=true 为 idle 且不扫描 sessions
 * [POS]: session-sync 开关语义测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerSessionSync } from '../src/index.js'

const dirs: string[] = []

async function tempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-session-sync-reg-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('registerSessionSync', () => {
  it('stays disabled with no network and no enterprise dir when policy is off', async () => {
    const home = await tempHome()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { service, dispose } = registerSessionSync({
      dshHome: home,
      enterpriseSessionEnabled: false,
    })

    expect(service.getStatus().mode).toBe('disabled')
    expect(fetchSpy).not.toHaveBeenCalled()
    await expect(readdir(join(home, 'enterprise'))).rejects.toMatchObject({ code: 'ENOENT' })
    dispose()
    expect(service.getStatus().mode).toBe('disabled')
  })

  it('idles when enabled and does not call network', async () => {
    const home = await tempHome()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { service, dispose } = registerSessionSync({
      dshHome: home,
      enterpriseSessionEnabled: true,
      deviceId: 'device-reg',
    })

    expect(service.getStatus().mode).toBe('idle')
    await service['ensureCursors']()
    expect(service.getStatus().deviceId).toBe('device-reg')
    expect(fetchSpy).not.toHaveBeenCalled()
    dispose()
  })
})
