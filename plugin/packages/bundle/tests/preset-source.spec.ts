/**
 * [INPUT]: 依赖 node:crypto/fs/promises、vitest、同目录的 `preset-support.ts`（临时 dshHome）与 `zip-fixture.ts`（造真 `.dshpreset` 字节），以及 src/preset-source.ts
 * [OUTPUT]: 锁定**配方正文来源**这条链：详情取权威 `versionId/sha256/sizeBytes` → **既有**运行时授权下载 operation（`/enterprise/api/v1/presets/versions/<versionId>/download` + `application/vnd.dsh.preset+zip`）→ sha256 内容寻址落盘 → 解包成配方；并锁死下载/大小/hash/包内身份不符一律 `ENT_PRESET_ARTIFACT_UNAVAILABLE`、上游受控码原样穿透、同 sha256 第二次零网络
 * [POS]: 配方纵深「配方正文从哪来」的门禁。这里刻意**只**用假平台端口验证"复用的是既有下载面"（URL、accept、代取令牌的 request 面），真网络与真服务端不在本文件；ZIP 布局与容器层另有 `preset-archive.spec.ts` / `skill-archive.spec.ts`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ENTERPRISE_PRESET_LIST_PATH,
  createEnterprisePresetRecipeSource,
  presetArtifactDownloadPath,
} from '../src/preset-source.js'
import { buildZip } from './zip-fixture.js'
import { cleanupPresetHomes, makePresetHome } from './preset-support.js'

const AGENT_YML = `- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: You are the enterprise onboarding assistant.
`

function presetArtifact(presetId = 'ent-demo'): Buffer {
  return buildZip([
    {
      content: JSON.stringify({
        format: 'dsh-preset',
        version: '1',
        id: presetId,
        name: '企业配方演示',
        description: '演示用的企业配方。',
        order: 60,
        sourceDshVersion: '0.2.0-rc.2',
      }),
      path: 'manifest.json',
    },
    { content: AGENT_YML, path: 'preset/agent.cordis.yml' },
  ])
}

const PACKAGE_ID = '1902500000000000001'
const VERSION_ID = '1902500000000000101'

function sha256Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** 契约真投影形状（`contracts/fixtures/runtime-preset-detail-success.json` 同形）的详情。 */
function detail(bytes: Buffer, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PACKAGE_ID,
    presetId: 'ent-demo',
    displayName: '企业配方演示',
    description: '演示用的企业配方。',
    sourceDshVersion: '0.2.0-rc.2',
    sizeBytes: bytes.byteLength,
    updatedAt: '2026-09-30T08:00:00Z',
    dependencies: [],
    versionId: VERSION_ID,
    sha256: sha256Of(bytes),
    ...overrides,
  }
}

interface Rig {
  readonly dshHome: string
  readonly requests: { input: string; init?: RequestInit }[]
  readonly detailCalls: string[]
  readonly source: ReturnType<typeof createEnterprisePresetRecipeSource>
  readonly errors: { message: string; error: unknown }[]
}

async function makeRig(
  bytes: Buffer,
  overrides: Record<string, unknown> = {},
  options: { readonly getPresetError?: unknown; readonly requestError?: unknown } = {},
): Promise<Rig> {
  const dshHome = await makePresetHome()
  const requests: { input: string; init?: RequestInit }[] = []
  const detailCalls: string[] = []
  const errors: { message: string; error: unknown }[] = []
  const source = createEnterprisePresetRecipeSource({
    dshHome,
    onError: (message, error) => { errors.push({ message, error }) },
    platform: {
      async getPreset(presetPackageId) {
        detailCalls.push(presetPackageId)
        if (options.getPresetError !== undefined) throw options.getPresetError
        return detail(bytes, overrides)
      },
      async request(input, init) {
        requests.push({ input, init })
        if (options.requestError !== undefined) throw options.requestError
        return new Response(bytes, {
          headers: { 'content-length': String(bytes.byteLength), 'content-type': 'application/vnd.dsh.preset+zip' },
          status: 200,
        })
      },
    },
  })
  return { dshHome, requests, detailCalls, source, errors }
}

afterEach(cleanupPresetHomes)

describe('createEnterprisePresetRecipeSource', () => {
  it('复用既有运行时下载 operation 取正文，并按 sha256 内容寻址落盘', async () => {
    const bytes = presetArtifact()
    const rig = await makeRig(bytes)
    const recipe = await rig.source.recipe(PACKAGE_ID)

    expect(rig.detailCalls).toEqual([PACKAGE_ID])
    expect(recipe).toEqual({
      manifest: { id: 'ent-demo', name: '企业配方演示', description: '演示用的企业配方。', order: 60 },
      agentCordisYml: AGENT_YML,
    })
    // 下载面就是契约里那条既有 operation（含 Range/ETag 的服务端实现），本机不另开口子。
    expect(ENTERPRISE_PRESET_LIST_PATH).toBe('/enterprise/api/v1/presets')
    expect(presetArtifactDownloadPath(VERSION_ID))
      .toBe('/enterprise/api/v1/presets/versions/1902500000000000101/download')
    expect(rig.requests).toHaveLength(1)
    expect(rig.requests[0]!.input).toBe(presetArtifactDownloadPath(VERSION_ID))
    expect(new Headers(rig.requests[0]!.init?.headers).get('accept')).toBe('application/vnd.dsh.preset+zip')
    // 令牌由平台 Service 代取：路由/来源层绝不自己拼 Authorization。
    expect(JSON.stringify(rig.requests[0]!.init?.headers)).not.toContain('uthorization')

    const cached = join(rig.dshHome, 'enterprise', 'preset-artifacts', `${sha256Of(bytes)}.dshpreset`)
    expect(await readFile(cached)).toEqual(bytes)
    expect((await stat(cached)).size).toBe(bytes.byteLength)

    // 同 sha256 命中内容寻址缓存 ⇒ 第二次零网络、零详情请求。
    await expect(rig.source.recipe(PACKAGE_ID)).resolves.toEqual(recipe)
    expect(rig.requests).toHaveLength(1)
    expect(rig.detailCalls).toEqual([PACKAGE_ID, PACKAGE_ID])
    expect(rig.errors).toEqual([])
  })

  it('非法包 id 在本地就拒，不打详情也不下载', async () => {
    const rig = await makeRig(presetArtifact())
    for (const bad of ['', '0', 'abc', '19025000000000000010'.repeat(2)]) {
      await expect(rig.source.recipe(bad)).rejects
        .toThrowError(expect.objectContaining({ code: 'ENT_INVALID_REQUEST' }))
    }
    expect(rig.detailCalls).toEqual([])
    expect(rig.requests).toEqual([])
  })

  it('详情形状非法或不是同一个包一律拒（不拿别人的制品去装）', async () => {
    for (const overrides of [
      { id: '1902500000000000002' },
      { presetId: '-bad' },
      { versionId: '0' },
      { sha256: 'x' },
      { sizeBytes: 0 },
      { sizeBytes: 52_428_801 },
    ]) {
      const rig = await makeRig(presetArtifact(), overrides)
      await expect(rig.source.recipe(PACKAGE_ID), JSON.stringify(overrides)).rejects
        .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_RECIPE_INVALID' }))
      expect(rig.requests, JSON.stringify(overrides)).toEqual([])
    }
  })

  it('大小/hash/包内身份与详情不符一律 ENT_PRESET_ARTIFACT_UNAVAILABLE', async () => {
    const bytes = presetArtifact()
    // 大小不符：详情声明的字节数与真制品不同（content-length 门禁先命中）。
    const sized = await makeRig(bytes, { sizeBytes: bytes.byteLength + 1 })
    await expect(sized.source.recipe(PACKAGE_ID)).rejects
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_ARTIFACT_UNAVAILABLE' }))

    // hash 不符：长度一致但坐标不同。
    const hashed = await makeRig(bytes, { sha256: 'f'.repeat(64) })
    await expect(hashed.source.recipe(PACKAGE_ID)).rejects
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_ARTIFACT_UNAVAILABLE' }))

    // 包内 presetId 与详情不是同一份配方。
    const mismatched = await makeRig(bytes, { presetId: 'other-preset' })
    await expect(mismatched.source.recipe(PACKAGE_ID)).rejects
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_ARTIFACT_UNAVAILABLE' }))
    expect(mismatched.errors.map(entry => entry.message))
      .toContain('preset artifact does not match the published preset id')
  })

  it('上游受控码原样穿透（401/403 的可操作原因不被包成本地码）', async () => {
    const visibility = Object.assign(new Error('this preset is not visible'), {
      code: 'ENT_PRESET_VISIBILITY_DENIED',
      httpStatus: 403,
    })
    const detailFailure = await makeRig(presetArtifact(), {}, { getPresetError: visibility })
    await expect(detailFailure.source.recipe(PACKAGE_ID)).rejects.toBe(visibility)

    const auth = Object.assign(new Error('platform login is required'), {
      code: 'ENT_AUTH_REQUIRED',
      httpStatus: 401,
    })
    const downloadFailure = await makeRig(presetArtifact(), {}, { requestError: auth })
    await expect(downloadFailure.source.recipe(PACKAGE_ID)).rejects.toBe(auth)

    // 无受控码的传输失败：归到制品不可用，cause 保留原始异常。
    const socket = new Error('socket hang up')
    const broken = await makeRig(presetArtifact(), {}, { requestError: socket })
    await expect(broken.source.recipe(PACKAGE_ID)).rejects
      .toThrowError(expect.objectContaining({ code: 'ENT_PRESET_ARTIFACT_UNAVAILABLE' }))
  })
})
