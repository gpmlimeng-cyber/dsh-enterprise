/**
 * [INPUT]: 依赖 vitest、`src/connector/index.js` 的凭据段与 `tests/connector-support.ts` 的连接器夹具
 * [OUTPUT]: 锁定 P0-3 的三件事——① **值永不过界**（官方 describe 即便塞了 `value`，投影与闸门结果里都不出现）；② **可送达性判定**（`env`/`project-env`/`user-env` ⇒ 送得到；`file` 保管层 ⇒ 送不到；provider 自定层 ⇒ fail-closed 当送不到；没配 ⇒ 另说）；③ 闸门的**失败分叉与顺序**（`store-only` 先于 `unconfigured` 判，因为"配了却送不到"最容易被误当成就绪）
 * [POS]: 连接器纵深 P0-3 门禁 —— 本文件不碰真官方凭据面（那要另起 Host），用注入的只读端口覆盖全部分支
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  CONNECTOR_DELIVERABLE_CREDENTIAL_SOURCES,
  CONNECTOR_STORE_CREDENTIAL_SOURCE,
  EnterpriseConnectorError,
  connectorCredentialDeliverability,
  connectorCredentialGate,
  connectorCredentialsFromContext,
  connectorEndpointCredentialRefs,
  isOfficialCredentials,
  observeConnectorCredential,
  officialConnectorCredentialPort,
  officialConnectorCredentialPortFromContext,
  readConnectorCredentialRef,
  requireConnectorCredentials,
  type ConnectorCredentialDescription,
  type ConnectorCredentialPort,
  type OfficialCredentialsLike,
} from '../src/connector/index.js'
import { connectorDescriptorFixture } from './connector-support.js'

/** 假只读端口：按 ref 回一枚描述；未列出的 ref 一律"没配"。 */
function fakeCredentials(
  table: Record<string, unknown>,
): { readonly port: ConnectorCredentialPort; readonly asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    port: {
      async describe(ref) {
        asked.push(ref)
        const row = table[ref]
        if (row === undefined) return { configured: false, writable: true }
        return row as ConnectorCredentialDescription
      },
    },
  }
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error instanceof EnterpriseConnectorError ? error.code : `UNEXPECTED:${String(error)}`
  }
}

describe('connector credential port（官方只读面的投影）', () => {
  it('keeps exactly configured/source/writable and drops everything else — including a value', async () => {
    const port = officialConnectorCredentialPort({
      async describe() {
        return { configured: true, source: 'file', writable: true, value: 'sk-live-DEADBEEF', extra: 1 }
      },
    })
    const description = await port.describe('ENT_DEMO_TOKEN')
    expect(description).toEqual({ configured: true, source: 'file', writable: true })
    expect(Object.keys(description).sort()).toEqual(['configured', 'source', 'writable'])
    expect(JSON.stringify(description)).not.toContain('DEADBEEF')
  })

  it('narrows a junk source id away rather than passing it through', async () => {
    const port = officialConnectorCredentialPort({
      async describe() {
        return { configured: true, source: '', writable: false }
      },
    })
    expect(await port.describe('X')).toEqual({ configured: true, writable: false })
    const long = officialConnectorCredentialPort({
      async describe() {
        return { configured: true, source: 'z'.repeat(65), writable: false }
      },
    })
    expect(await long.describe('X')).toEqual({ configured: true, writable: false })
  })

  it('refuses a service that is not shaped right, or an unexpected answer shape', async () => {
    expect(await codeOf(Promise.resolve().then(() => officialConnectorCredentialPort({} as never))))
      .toBe('ENT_INVALID_REQUEST')
    expect(isOfficialCredentials({ describe: 'not-a-function' })).toBe(false)
    expect(isOfficialCredentials({ describe: () => undefined })).toBe(true)
    const bad = officialConnectorCredentialPort({ async describe() { return 'nope' } })
    expect(await codeOf(bad.describe('X'))).toBe('ENT_INVALID_REQUEST')
    const half = officialConnectorCredentialPort({ async describe() { return { configured: true } } })
    expect(await codeOf(half.describe('X'))).toBe('ENT_INVALID_REQUEST')
  })

  it('reads the service off a ctx, fail-closed when absent or half-shaped', () => {
    const service: OfficialCredentialsLike = { async describe() { return { configured: false, writable: true } } }
    expect(connectorCredentialsFromContext({ get: name => name === 'credentials' ? service : undefined })).toBe(service)
    expect(connectorCredentialsFromContext({ get: () => ({ resolve: () => undefined }) })).toBeUndefined()
    expect(connectorCredentialsFromContext({ get: () => undefined })).toBeUndefined()
    expect(officialConnectorCredentialPortFromContext({ get: () => undefined })).toBeUndefined()
    expect(officialConnectorCredentialPortFromContext({ get: () => service })).toBeDefined()
  })
})

describe('connector credential deliverability（配了 ≠ 送得到）', () => {
  it('maps the four official layers exactly as the official docs describe them', () => {
    const deliverable: ConnectorCredentialDescription[] = [
      { configured: true, source: 'env', writable: false },
      { configured: true, source: 'project-env', writable: false },
      { configured: true, source: 'user-env', writable: false },
    ]
    for (const description of deliverable) {
      expect(connectorCredentialDeliverability(description)).toBe('deliverable')
    }
    expect(connectorCredentialDeliverability({ configured: true, source: 'file', writable: true })).toBe('store-only')
    expect(connectorCredentialDeliverability({ configured: true, writable: true })).toBe('unknown-source')
    expect(connectorCredentialDeliverability({ configured: true, source: 'vault', writable: true })).toBe('unknown-source')
    expect(connectorCredentialDeliverability({ configured: false, writable: true })).toBe('unconfigured')
  })

  it('pins the store layer as the one that cannot reach a child process', () => {
    expect(CONNECTOR_STORE_CREDENTIAL_SOURCE).toBe('file')
    expect(CONNECTOR_DELIVERABLE_CREDENTIAL_SOURCES).toEqual(['env', 'project-env', 'user-env'])
    expect(CONNECTOR_DELIVERABLE_CREDENTIAL_SOURCES).not.toContain(CONNECTOR_STORE_CREDENTIAL_SOURCE)
  })

  it('derives the actionable step without ever naming a value', async () => {
    const { port } = fakeCredentials({
      A: { configured: false, writable: true },
      B: { configured: true, source: 'file', writable: true },
      C: { configured: true, source: 'vault', writable: true },
      D: { configured: true, source: 'env', writable: false },
    })
    expect(await observeConnectorCredential(port, 'A')).toMatchObject({ deliverability: 'unconfigured', action: 'provide-in-env-layer', writable: true })
    expect(await observeConnectorCredential(port, 'B')).toMatchObject({ deliverability: 'store-only', action: 'mirror-into-env-layer' })
    expect(await observeConnectorCredential(port, 'C')).toMatchObject({ deliverability: 'unknown-source', action: 'verify-source-manually' })
    expect(await observeConnectorCredential(port, 'D')).toMatchObject({ deliverability: 'deliverable', action: 'none', source: 'env', writable: false })
  })
})

describe('connector credential gate', () => {
  it('is ok with no references at all (a public endpoint needs no credential)', async () => {
    const { port, asked } = fakeCredentials({})
    expect(await connectorCredentialGate(port, [])).toEqual({ ok: true, observations: [] })
    expect(asked).toEqual([])
  })

  it('passes every reference that can actually reach the child process', async () => {
    const { port, asked } = fakeCredentials({
      ENT_A: { configured: true, source: 'env', writable: false },
      ENT_B: { configured: true, source: 'user-env', writable: false },
    })
    const result = await connectorCredentialGate(port, ['ENT_B', 'ENT_A', 'ENT_B'])
    expect(result.ok).toBe(true)
    expect(result.observations.map(item => item.ref)).toEqual(['ENT_A', 'ENT_B'])
    expect(asked).toEqual(['ENT_A', 'ENT_B'])
  })

  it('reports a missing reference as MISSING', async () => {
    const { port } = fakeCredentials({})
    const result = await connectorCredentialGate(port, ['ENT_TOKEN'])
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('ENT_CONNECTOR_CREDENTIAL_MISSING')
    expect(result.observations[0]).toMatchObject({ ref: 'ENT_TOKEN', configured: false, deliverability: 'unconfigured' })
  })

  it('reports "configured but undeliverable" as NOT_DELIVERABLE and outranks MISSING', async () => {
    const { port } = fakeCredentials({ STORED: { configured: true, source: 'file', writable: true } })
    const stored = await connectorCredentialGate(port, ['STORED'])
    expect(stored).toMatchObject({ ok: false, errorCode: 'ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE' })
    // ★ 同时存在"没配"和"配了却送不到"时，报后者：前者容易被理解成"去设置里存一个"，而那恰恰对 MCP 无效。
    const both = await connectorCredentialGate(port, ['MISSING', 'STORED'])
    expect(both.errorCode).toBe('ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE')
    const unknown = await connectorCredentialGate(fakeCredentials({ V: { configured: true, source: 'vault', writable: true } }).port, ['V'])
    expect(unknown.errorCode).toBe('ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE')
  })

  it('refuses an illegal reference before touching the service', async () => {
    const { port, asked } = fakeCredentials({})
    for (const bad of ['', 'Bearer sk-abc', 'has space', 'a'.repeat(65), 42 as never]) {
      expect(await codeOf(connectorCredentialGate(port, [bad as string]))).toBe('ENT_INVALID_REQUEST')
    }
    expect(asked).toEqual([])
    expect(readConnectorCredentialRef('ENT_DEMO_TOKEN')).toBe('ENT_DEMO_TOKEN')
  })

  it('never lets a value into the result, even when the service hands one over', async () => {
    const { port } = fakeCredentials({
      ENT_SECRET: { configured: true, source: 'file', writable: true },
    })
    const leaked = officialConnectorCredentialPort({
      async describe() {
        return { configured: true, source: 'file', writable: true, value: 'sk-live-SUPERSECRET' }
      },
    })
    const viaLeaky = await connectorCredentialGate(leaked, ['ENT_SECRET'])
    const viaFake = await connectorCredentialGate(port, ['ENT_SECRET'])
    for (const result of [viaLeaky, viaFake]) {
      expect(JSON.stringify(result)).not.toContain('SUPERSECRET')
      expect(result.observations.every(item => !Object.hasOwn(item, 'value'))).toBe(true)
    }
  })

  it('throws the same stable codes from the strict helper', async () => {
    const ok = await requireConnectorCredentials(fakeCredentials({ A: { configured: true, source: 'env', writable: false } }).port, ['A'])
    expect(ok.map(item => item.ref)).toEqual(['A'])
    expect(await codeOf(requireConnectorCredentials(fakeCredentials({}).port, ['A']))).toBe('ENT_CONNECTOR_CREDENTIAL_MISSING')
    expect(await codeOf(requireConnectorCredentials(fakeCredentials({ A: { configured: true, source: 'file', writable: true } }).port, ['A'])))
      .toBe('ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE')
  })
})

describe('connector endpoint credential refs', () => {
  it('takes the keys a stdio endpoint names, deduped and sorted', () => {
    const refs = connectorEndpointCredentialRefs(connectorDescriptorFixture({
      endpoint: {
        transport: 'stdio',
        command: 'npx',
        env: [
          { name: 'A', key: 'ENT_B_TOKEN' },
          { name: 'B', key: 'ENT_A_TOKEN' },
          { name: 'C', key: 'ENT_B_TOKEN' },
        ],
      },
    }))
    expect(refs).toEqual(['ENT_A_TOKEN', 'ENT_B_TOKEN'])
  })

  it('takes header keys for the http transport and nothing when there are none', () => {
    const refs = connectorEndpointCredentialRefs(connectorDescriptorFixture({
      endpoint: {
        transport: 'streamable-http',
        url: 'https://mcp.example.com/mcp',
        headers: [{ name: 'Authorization', key: 'ENT_HTTP_TOKEN', scheme: 'Bearer' }],
      },
    }))
    expect(refs).toEqual(['ENT_HTTP_TOKEN'])
    expect(connectorEndpointCredentialRefs(connectorDescriptorFixture({
      endpoint: { transport: 'streamable-http', url: 'https://mcp.example.com/mcp' },
    }))).toEqual([])
    expect(connectorEndpointCredentialRefs(connectorDescriptorFixture({
      endpoint: { transport: 'stdio', command: 'npx' },
    }))).toEqual([])
  })

  it('is total against a malformed descriptor instead of throwing', () => {
    expect(connectorEndpointCredentialRefs({} as never)).toEqual([])
    expect(connectorEndpointCredentialRefs(null as never)).toEqual([])
    expect(connectorEndpointCredentialRefs({ endpoint: { transport: 'stdio', env: ['not-an-object'] } } as never)).toEqual([])
  })
})
