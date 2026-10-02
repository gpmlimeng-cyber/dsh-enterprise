/**
 * [INPUT]: 依赖 dsh-ui 的 local-api 三件新方法（`presetStatus`/`enablePreset`/`disablePreset`）、三个解码器与它们的键集常量、路径构造器；用标准 `Response` double 做同源取数取证
 * [OUTPUT]: 「配方一键启用」这一刀的**客户端落地门禁**：① 三条子路径逐字照路由形状（`/presets/<雪花 id>/{enable,status}`、`/presets/<声明 id>/disable`，标识一律 `encodeURIComponent`）；② enable 的正文是**关闭键集**——没有确认指纹时恰好 `{}`、有确认指纹时恰好 `{confirmFingerprint}`（**绝不**顺手把别的键塞进去）；③ 三个响应的**封闭键集**判定（未知键 / 缺必填 / 形状不对一律 `ENT_LOCAL_RESPONSE_INVALID`）、`disclosure` 逐项校验、`installed` 的「必填位可空」语义；④ 失败按 HTTP 状态投影成稳定码（403/409/400/503）
 * [POS]: ui 三件客户端方法 + 三个解码器的行为取证点（本仓没有 DOM，这里是「三个方法和解码同批落」的唯一机械复核）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_PRESET_ACTION_LOCAL_PATH,
  ENTERPRISE_PRESET_DISABLE_OPTIONAL_KEYS,
  ENTERPRISE_PRESET_DISABLE_REQUIRED_KEYS,
  ENTERPRISE_PRESET_DISCLOSURE_BUNDLE_KEYS,
  ENTERPRISE_PRESET_DISCLOSURE_KEYS,
  ENTERPRISE_PRESET_DISCLOSURE_MOUNT_KEYS,
  ENTERPRISE_PRESET_ENABLE_OPTIONAL_KEYS,
  ENTERPRISE_PRESET_ENABLE_REQUIRED_KEYS,
  ENTERPRISE_PRESET_INSTALLED_KEYS,
  ENTERPRISE_PRESET_OFFICIAL_ERROR_OPTIONAL_KEYS,
  ENTERPRISE_PRESET_OFFICIAL_ERROR_REQUIRED_KEYS,
  ENTERPRISE_PRESET_STATUS_REQUIRED_KEYS,
  createEnterpriseLocalApi,
  decodeEnterprisePresetDisable,
  decodeEnterprisePresetEnable,
  decodeEnterprisePresetStatus,
  enterprisePresetDisablePath,
  enterprisePresetEnablePath,
  enterprisePresetStatusPath,
} from '../src/local-api.js'

/** 一枚合法的集合指纹（64 位小写十六进制）。 */
const PRINT = 'a'.repeat(64)

const DISCLOSURE = {
  fingerprint: PRINT,
  bundles: [{ name: 'dsh-ent-preset-review-agent', summary: '带检查单的评审配方', digest: 'b'.repeat(64) }],
  mounts: [{ name: '@deepseek-ai/dsh-agent-preset', summary: '挂载行 preset-review-agent' }],
}

const INSTALLED = {
  declarationId: 'review-agent',
  recipeId: 'review-agent',
  displayName: '代码评审配方',
  packageName: 'dsh-ent-preset-review-agent',
  fingerprint: PRINT,
  version: '1.0.0',
  installedAt: '2026-09-30T08:00:00Z',
  officialApplication: 'applied',
}

const ENABLE = {
  application: 'hot',
  officialApplication: 'applied',
  installedNames: ['dsh-ent-preset-review-agent'],
  needsNewSession: false,
  declarationId: 'review-agent',
  fingerprint: PRINT,
  disclosure: DISCLOSURE,
}

const DISABLE = {
  application: 'hot',
  officialApplication: 'applied',
  declarationId: 'review-agent',
  removedNames: ['dsh-ent-preset-review-agent'],
  linkRemoved: true,
}

const STATUS = {
  presetPackageId: '1902500000000000701',
  declarationId: 'review-agent',
  fingerprint: PRINT,
  authorization: 'needs-authorization',
  inFlight: false,
  disclosure: DISCLOSURE,
  installed: null,
}

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' }, status: 200 })
}

function fail(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: { code } }), { headers: { 'content-type': 'application/json' }, status })
}

describe('配方一键启用的三条客户端方法（路径与关闭键集）', () => {
  it('derives the three sub-paths from the shared /presets prefix, encoding each identifier', () => {
    expect(ENTERPRISE_PRESET_ACTION_LOCAL_PATH).toBe('/enterprise/api/v1/local/presets')
    expect(enterprisePresetEnablePath('1902500000000000701')).toBe('/presets/1902500000000000701/enable')
    expect(enterprisePresetStatusPath('1902500000000000701')).toBe('/presets/1902500000000000701/status')
    expect(enterprisePresetDisablePath('review-agent')).toBe('/presets/review-agent/disable')
    // 标识一律 encodeURIComponent：`../` 之类的输入只会变成路径段里的字面量。
    expect(enterprisePresetEnablePath('../x')).toBe('/presets/..%2Fx/enable')
    expect(enterprisePresetDisablePath('a/b')).toBe('/presets/a%2Fb/disable')
  })

  it('reads status with GET and sends no body', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      // 只读：没有 method（浏览器默认 GET）也没有正文。
      expect(init?.method).toBeUndefined()
      expect(init?.body).toBeUndefined()
      return ok(STATUS)
    }) as unknown as typeof fetch
    const api = createEnterpriseLocalApi(fetcher)
    await expect(api.presetStatus(STATUS.presetPackageId, new AbortController().signal)).resolves.toEqual(STATUS)
    expect(vi.mocked(fetcher).mock.calls[0]?.[0])
      .toBe('/enterprise/api/v1/local/presets/1902500000000000701/status')
    expect(vi.mocked(fetcher).mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' })
  })

  it('sends exactly {} when there is no confirmed fingerprint (never a shortcut authorization)', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe('{}')
      return ok(ENABLE)
    }) as unknown as typeof fetch
    const api = createEnterpriseLocalApi(fetcher)
    await expect(api.enablePreset(ENABLE.fingerprint && STATUS.presetPackageId, undefined, new AbortController().signal))
      .resolves.toMatchObject({ application: 'hot', declarationId: 'review-agent' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetcher).mock.calls[0]?.[0]).toBe('/enterprise/api/v1/local/presets/1902500000000000701/enable')
  })

  it('sends exactly {confirmFingerprint} when the employee confirmed a disclosure', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      // 关闭键集：**只有**这一个键，没有 id/recipe/name 之类被顺手塞进来的字段。
      expect(init?.body).toBe(JSON.stringify({ confirmFingerprint: PRINT }))
      return ok(ENABLE)
    }) as unknown as typeof fetch
    const api = createEnterpriseLocalApi(fetcher)
    await api.enablePreset(STATUS.presetPackageId, PRINT, new AbortController().signal)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('disables with POST and an empty body, on the declaration id', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(init?.body).toBe('{}')
      return ok(DISABLE)
    }) as unknown as typeof fetch
    const api = createEnterpriseLocalApi(fetcher)
    await expect(api.disablePreset('review-agent', new AbortController().signal))
      .resolves.toMatchObject({ linkRemoved: true, removedNames: ['dsh-ent-preset-review-agent'] })
    expect(vi.mocked(fetcher).mock.calls[0]?.[0]).toBe('/enterprise/api/v1/local/presets/review-agent/disable')
  })

  it('projects HTTP failures into the stable codes the UI speaks (403 / 409 / 400 / 503)', async () => {
    const cases: readonly (readonly [number, string])[] = [
      [403, 'ENT_PRESET_AUTHORIZATION_REQUIRED'],
      [409, 'ENT_PRESET_AUTHORIZATION_STALE'],
      [409, 'ENT_PRESET_INSTALL_IN_PROGRESS'],
      [400, 'ENT_PRESET_RECIPE_INVALID'],
      [503, 'ENT_PRESET_INSTALL_FAILED'],
    ]
    for (const [status, code] of cases) {
      const fetcher = vi.fn(async () => fail(status, code)) as unknown as typeof fetch
      const api = createEnterpriseLocalApi(fetcher)
      await expect(api.enablePreset(STATUS.presetPackageId, undefined, new AbortController().signal), code)
        .rejects.toMatchObject({ code, status })
    }
  })
})

describe('三个响应的封闭键集与形状门禁', () => {
  it('accepts the canonical shapes and rejects any unknown key (closed key set)', () => {
    expect(decodeEnterprisePresetEnable(ENABLE)).toEqual(ENABLE)
    expect(decodeEnterprisePresetDisable(DISABLE)).toEqual(DISABLE)
    expect(decodeEnterprisePresetStatus(STATUS)).toEqual(STATUS)
    // 每一个键位上都试一遍「多一个未知键」：整条判畸形，绝不悄悄透传。
    for (const extra of [{ bundleDir: '/x' }, { warnings: ['pnpm output'] }, { logPath: '/y' }]) {
      expect(() => decodeEnterprisePresetEnable({ ...ENABLE, ...extra })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
      expect(() => decodeEnterprisePresetDisable({ ...DISABLE, ...extra })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
      expect(() => decodeEnterprisePresetStatus({ ...STATUS, ...extra })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 可选位：`officialApplication` / `alreadyInstalled` / `officialError` 缺席时**不产出那个键**。
    const minimal = { ...ENABLE, application: 'restart-required', needsNewSession: true }
    delete (minimal as Record<string, unknown>)['officialApplication']
    expect(decodeEnterprisePresetEnable(minimal)).toEqual({ ...minimal })
    expect(Object.keys(decodeEnterprisePresetEnable(minimal))).not.toContain('officialApplication')
    expect(decodeEnterprisePresetEnable({ ...ENABLE, alreadyInstalled: true, officialError: { code: 'install-failed' } }))
      .toMatchObject({ alreadyInstalled: true, officialError: { code: 'install-failed' } })
    // `officialError` 的 `code` 是可选位（Host 的类型允许空对象）。
    expect(decodeEnterprisePresetEnable({ ...ENABLE, officialError: {} })).toMatchObject({ officialError: {} })
    expect(() => decodeEnterprisePresetEnable({ ...ENABLE, officialError: { diagnostic: 'x' } })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    // disable 的 `officialApplication` 同理。
    const disableMinimal = { ...DISABLE }
    delete (disableMinimal as Record<string, unknown>)['officialApplication']
    expect(decodeEnterprisePresetDisable(disableMinimal)).toEqual(disableMinimal)
  })

  it('rejects a missing required key on each of the three responses', () => {
    for (const key of ENTERPRISE_PRESET_ENABLE_REQUIRED_KEYS) {
      const broken: Record<string, unknown> = { ...ENABLE }
      delete broken[key]
      expect(() => decodeEnterprisePresetEnable(broken), key).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    for (const key of ENTERPRISE_PRESET_DISABLE_REQUIRED_KEYS) {
      const broken: Record<string, unknown> = { ...DISABLE }
      delete broken[key]
      expect(() => decodeEnterprisePresetDisable(broken), key).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    for (const key of ENTERPRISE_PRESET_STATUS_REQUIRED_KEYS) {
      const broken: Record<string, unknown> = { ...STATUS }
      delete broken[key]
      expect(() => decodeEnterprisePresetStatus(broken), key).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })

  it('pins the closed key sets to the Host-side view interfaces', () => {
    expect([...ENTERPRISE_PRESET_ENABLE_REQUIRED_KEYS].sort())
      .toEqual(['application', 'declarationId', 'disclosure', 'fingerprint', 'installedNames', 'needsNewSession'])
    expect([...ENTERPRISE_PRESET_ENABLE_OPTIONAL_KEYS].sort())
      .toEqual(['alreadyInstalled', 'officialApplication', 'officialError'])
    expect([...ENTERPRISE_PRESET_DISABLE_REQUIRED_KEYS].sort())
      .toEqual(['application', 'declarationId', 'linkRemoved', 'removedNames'])
    expect([...ENTERPRISE_PRESET_DISABLE_OPTIONAL_KEYS]).toEqual(['officialApplication'])
    expect([...ENTERPRISE_PRESET_STATUS_REQUIRED_KEYS].sort())
      .toEqual(['authorization', 'declarationId', 'disclosure', 'fingerprint', 'inFlight', 'installed', 'presetPackageId'])
    expect([...ENTERPRISE_PRESET_INSTALLED_KEYS].sort())
      .toEqual(['declarationId', 'displayName', 'fingerprint', 'installedAt', 'officialApplication', 'packageName', 'recipeId', 'version'])
    expect([...ENTERPRISE_PRESET_DISCLOSURE_KEYS]).toEqual(['fingerprint', 'bundles', 'mounts'])
    expect([...ENTERPRISE_PRESET_DISCLOSURE_BUNDLE_KEYS]).toEqual(['name', 'summary', 'digest'])
    expect([...ENTERPRISE_PRESET_DISCLOSURE_MOUNT_KEYS]).toEqual(['name', 'summary'])
    expect([...ENTERPRISE_PRESET_OFFICIAL_ERROR_REQUIRED_KEYS]).toEqual([])
    expect([...ENTERPRISE_PRESET_OFFICIAL_ERROR_OPTIONAL_KEYS]).toEqual(['code'])
  })

  it('validates every disclosure item (name / summary / digest / fingerprint) and the caps', () => {
    expect(decodeEnterprisePresetStatus(STATUS).disclosure).toEqual(DISCLOSURE)
    const broken: readonly unknown[] = [
      { ...DISCLOSURE, fingerprint: 'A'.repeat(64) },
      { ...DISCLOSURE, fingerprint: PRINT.slice(0, 63) },
      { ...DISCLOSURE, fingerprint: PRINT, bundles: [{ name: 'x', summary: 'y' }] },
      { ...DISCLOSURE, fingerprint: PRINT, bundles: [{ name: 'x', summary: 'y', digest: 'not-a-digest' }] },
      { ...DISCLOSURE, fingerprint: PRINT, bundles: [{ name: 'x', summary: 'y', digest: 'b'.repeat(64), extra: 1 }] },
      { ...DISCLOSURE, fingerprint: PRINT, bundles: [{ name: 'Not A Package', summary: 'y', digest: 'b'.repeat(64) }] },
      { ...DISCLOSURE, fingerprint: PRINT, mounts: [{ name: '', summary: 'y' }] },
      { ...DISCLOSURE, fingerprint: PRINT, mounts: [{ name: 'x' }] },
      { ...DISCLOSURE, fingerprint: PRINT, mounts: [{ name: 'x', summary: 'y', digest: 'z' }] },
      { ...DISCLOSURE, fingerprint: PRINT, bundles: 'oops' },
      { ...DISCLOSURE, fingerprint: PRINT, bundles: Array.from({ length: 201 }, () => ({ name: 'x', summary: '', digest: 'b'.repeat(64) })) },
    ]
    for (const disclosure of broken) {
      expect(() => decodeEnterprisePresetStatus({ ...STATUS, disclosure })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // summary 允许空串（Host 用 manifest.name 兜底，但空串不是畸形）。
    expect(() => decodeEnterprisePresetStatus({
      ...STATUS,
      disclosure: { fingerprint: PRINT, bundles: [{ name: 'x', summary: '', digest: 'b'.repeat(64) }], mounts: [] },
    })).not.toThrow()
  })

  it('keeps `installed` a required-but-nullable key, and validates the record when present', () => {
    // 必填位上的可空值：键必须在，值可以是 null。
    expect(decodeEnterprisePresetStatus(STATUS).installed).toBeNull()
    expect(decodeEnterprisePresetStatus({ ...STATUS, installed: INSTALLED }).installed).toEqual(INSTALLED)
    // 键缺席 ≠ null（那是畸形，不是「没装」）。
    const missing: Record<string, unknown> = { ...STATUS }
    delete missing['installed']
    expect(() => decodeEnterprisePresetStatus(missing)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    const broken: readonly unknown[] = [
      { ...INSTALLED, declarationId: 'Review Agent' },
      { ...INSTALLED, fingerprint: 'z'.repeat(64) },
      { ...INSTALLED, installedAt: 'yesterday' },
      { ...INSTALLED, officialApplication: 'maybe' },
      { ...INSTALLED, version: '' },
      { ...INSTALLED, packageName: 'not a package' },
    ]
    for (const installed of broken) {
      expect(() => decodeEnterprisePresetStatus({ ...STATUS, installed })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
    // 已装记录里**没有**宿主绝对路径：多一个 `bundleDir` 整条判畸形。
    expect(() => decodeEnterprisePresetStatus({ ...STATUS, installed: { ...INSTALLED, bundleDir: '/data/x' } }))
      .toThrow('ENT_LOCAL_RESPONSE_INVALID')
  })

  it('refuses unknown enum members and malformed identifiers on every response', () => {
    expect(() => decodeEnterprisePresetStatus({ ...STATUS, authorization: 'maybe' })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePresetStatus({ ...STATUS, presetPackageId: '007' })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePresetStatus({ ...STATUS, inFlight: 'no' })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePresetEnable({ ...ENABLE, application: 'applied' })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePresetEnable({ ...ENABLE, needsNewSession: 'yes' })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePresetEnable({ ...ENABLE, declarationId: 'Review_Agent' })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePresetEnable({ ...ENABLE, installedNames: [''] })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePresetEnable({ ...ENABLE, officialApplication: 'done' })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    expect(() => decodeEnterprisePresetDisable({ ...DISABLE, linkRemoved: 'yes' })).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    // 非对象 / 数组 / null 一律拒。
    for (const bad of [null, undefined, [], 'x', 7]) {
      expect(() => decodeEnterprisePresetEnable(bad)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
      expect(() => decodeEnterprisePresetDisable(bad)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
      expect(() => decodeEnterprisePresetStatus(bad)).toThrow('ENT_LOCAL_RESPONSE_INVALID')
    }
  })
})
