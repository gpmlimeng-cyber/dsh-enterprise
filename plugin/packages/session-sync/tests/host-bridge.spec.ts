/**
 * [INPUT]: 依赖 host-bridge 与 fake platform/runtime
 * [OUTPUT]: 验证 enabled=false 零注册、enabled=true 挂载与批次上传、登出卸载
 * [POS]: session-sync Host 桥测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  INITIAL_ROLLING_HASH,
  isHostSessionSyncEnabled,
  tryRegisterHostSessionSync,
  type HostBootstrapPort,
  type HostPlatformPort,
  type HostPlatformStatusPort,
  type SessionBatchBody,
  type SyncableEvent,
  type SyncableSession,
} from '../src/index.js'

const homes: string[] = []

async function tempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-session-sync-host-'))
  homes.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(homes.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

function event(seq: number): SyncableEvent {
  return { seq, time: 1_700_000_000_000 + seq, type: 'turn/start', data: { turn: seq } }
}

function session(id = 'session-1'): SyncableSession {
  return {
    id,
    header: { version: 0, id, createdAt: 1_700_000_000_000 },
    seq: 1,
  }
}

function fakePlatform(options: {
  state?: string
  enabled?: boolean
  maxBatchBytes?: number
  onRequest?: (path: string, init?: RequestInit) => Promise<Response>
}): {
  platform: HostPlatformPort
  listeners: Set<(status: HostPlatformStatusPort) => void>
  setState: (state: string) => void
  setBootstrap: (bootstrap: HostBootstrapPort | undefined) => void
} {
  let state = options.state ?? 'READY'
  let bootstrap: HostBootstrapPort | undefined = {
    sessionPolicy: {
      enabled: options.enabled ?? false,
      maxBatchBytes: options.maxBatchBytes ?? 1_048_576,
    },
  }
  const listeners = new Set<(status: HostPlatformStatusPort) => void>()
  const platform: HostPlatformPort = {
    status: () => ({ state }),
    bootstrap: () => bootstrap,
    request: async (path, init) => {
      if (options.onRequest !== undefined) return options.onRequest(String(path), init)
      return new Response(JSON.stringify({
        data: { acceptedThroughSeq: 0, rollingHash: INITIAL_ROLLING_HASH },
        requestId: 'req-1',
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    platform,
    listeners,
    setState: (next: string) => {
      state = next
      for (const listener of listeners) listener({ state })
    },
    setBootstrap: (next: HostBootstrapPort | undefined) => {
      bootstrap = next
    },
  }
}

describe('host session sync bridge', () => {
  it('reports disabled when policy is off or platform is not ready', () => {
    const off = fakePlatform({ enabled: false })
    expect(isHostSessionSyncEnabled(off.platform)).toBe(false)
    const notReady = fakePlatform({ enabled: true, state: 'SIGNED_OUT' })
    expect(isHostSessionSyncEnabled(notReady.platform)).toBe(false)
    const ready = fakePlatform({ enabled: true })
    expect(isHostSessionSyncEnabled(ready.platform)).toBe(true)
  })

  it('does not register or call request when disabled', async () => {
    const registerSpy = vi.fn()
    const requestSpy = vi.fn()
    const env = fakePlatform({
      enabled: false,
      onRequest: async () => {
        requestSpy()
        return new Response('{}', { status: 200 })
      },
    })
    const handle = tryRegisterHostSessionSync({
      dshHome: await tempHome(),
      platform: { ...env.platform, request: async (path, init) => env.platform.request(path, init) },
      runtime: {
        sessions: { flush: async () => true },
        sessionPersistence: {
          readFrom: async () => ({ meta: session().header, events: [] }),
        },
      },
      onSessionEvent: () => {
        registerSpy()
        return () => undefined
      },
    })
    await new Promise(resolve => setTimeout(resolve, 5))
    expect(handle.enabled).toBe(false)
    expect(registerSpy).not.toHaveBeenCalled()
    expect(requestSpy).not.toHaveBeenCalled()
    await handle.dispose()
  })

  it('registers when enabled, marks dirty, and posts a batch', async () => {
    const bodies: SessionBatchBody[] = []
    const env = fakePlatform({
      enabled: true,
      maxBatchBytes: 1_048_576,
      onRequest: async (path, init) => {
        expect(path).toBe('/enterprise/api/v1/sessions/session-1/batches')
        bodies.push(JSON.parse(String(init?.body)) as SessionBatchBody)
        return new Response(JSON.stringify({
          data: { acceptedThroughSeq: 0, rollingHash: INITIAL_ROLLING_HASH },
          requestId: 'req-1',
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    })
    let listener: ((session: SyncableSession) => void) | undefined
    const handle = tryRegisterHostSessionSync({
      dshHome: await tempHome(),
      platform: env.platform,
      runtime: {
        sessions: { flush: async () => true },
        sessionPersistence: {
          readFrom: async (_id, fromSeq) => ({
            meta: session().header,
            events: [event(0)].filter(item => item.seq >= fromSeq),
          }),
        },
      },
      onSessionEvent: fn => {
        listener = fn
        return () => {
          listener = undefined
        }
      },
      debounceMs: 1,
    })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(handle.enabled).toBe(true)
    listener?.(session())
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(bodies).toHaveLength(1)
    expect(bodies[0]!.header?.id).toBe('session-1')
    expect(bodies[0]!.previousRollingHash).toBe(INITIAL_ROLLING_HASH)
    await handle.dispose()
  })

  it('tears down when platform leaves READY', async () => {
    const env = fakePlatform({ enabled: true })
    const handle = tryRegisterHostSessionSync({
      dshHome: await tempHome(),
      platform: env.platform,
      runtime: {
        sessions: { flush: async () => true },
        sessionPersistence: {
          readFrom: async () => ({ meta: session().header, events: [] }),
        },
      },
    })
    await new Promise(resolve => setTimeout(resolve, 5))
    expect(handle.enabled).toBe(true)
    env.setState('SIGNED_OUT')
    await new Promise(resolve => setTimeout(resolve, 5))
    expect(handle.enabled).toBe(false)
    await handle.dispose()
  })
})
