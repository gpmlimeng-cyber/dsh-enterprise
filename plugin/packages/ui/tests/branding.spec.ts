/**
 * [INPUT]: 依赖 dsh-ui 的品牌读取层、内置品牌位图与 local-api 的品牌解码器
 * [OUTPUT]: 锁定「未配置/取数失败 → 内置名称、欢迎语、版本标识与内置位图」的逐字段回落、LOGO 来源门禁（只认同源本地副本）与 Host 投影的严格解码 **本刀**：新增品牌读态三态（未配置仍静默 / 取数失败显式可见）、「企业标识」三态取值两两不同、会话内记忆的键失效行为。
 * [POS]: dsh-ui 品牌读取层的回归测试，保证登录弹窗与菜单头部在任何企业状态下都有可渲染的品牌
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import { DSHENT_ANIMATED_ICON, DSHENT_ICON } from '../src/brand.js'
import {
  ENTERPRISE_BRANDING_BUILTIN_VALUE,
  ENTERPRISE_BRANDING_IDENTITY_LABEL,
  ENTERPRISE_BRANDING_READ_FAILED,
  ENTERPRISE_BRANDING_UNAVAILABLE_VALUE,
  ENTERPRISE_BUILTIN_BRANDING,
  enterpriseBrandingIdentityValue,
  enterpriseBrandingLogoUrl,
  enterpriseBrandingReadState,
  recallEnterpriseBranding,
  rememberEnterpriseBranding,
  resolveEnterpriseBranding,
  type EnterpriseBrandingDocument,
} from '../src/branding.js'
import { decodeEnterpriseBranding, EnterpriseLocalApiError } from '../src/local-api.js'

const CUSTOM: EnterpriseBrandingDocument = {
  logo: {
    dark: null,
    light: '/enterprise/api/v1/local/branding/asset/light?v=12',
    square: '/enterprise/api/v1/local/branding/asset/square?v=12',
  },
  name: 'ACME 云',
  revision: 12,
  shortName: 'ACME',
  updatedAt: '2026-09-30T02:00:00Z',
  welcome: { editionLabel: '正式版', headline: '一起把事做完' },
}

describe('enterprise branding fallback', () => {
  it('renders the built-in brand whenever the Host has none', () => {
    for (const document of [null, undefined]) {
      const view = resolveEnterpriseBranding(document)
      expect(view).toEqual({
        custom: false,
        editionLabel: '预览版',
        headline: '探索未至之境',
        logoSrc: DSHENT_ANIMATED_ICON,
        name: 'DSH Enterprise',
        shortName: 'DSH Enterprise',
        staticLogoSrc: DSHENT_ICON,
      })
    }
    expect(ENTERPRISE_BUILTIN_BRANDING.editionLabel).toBe('预览版')
  })

  it('uses the configured brand when the Host has one, and falls back per field', () => {
    expect(resolveEnterpriseBranding(CUSTOM)).toEqual({
      custom: true,
      editionLabel: '正式版',
      headline: '一起把事做完',
      logoSrc: CUSTOM.logo.light,
      name: 'ACME 云',
      shortName: 'ACME',
      staticLogoSrc: CUSTOM.logo.light,
    })
    // 后台只配了名称：其余字段逐个回落，LOGO 也回到内置位图。
    const partial = resolveEnterpriseBranding({ ...CUSTOM, logo: { dark: null, light: null, square: null }, welcome: { editionLabel: '', headline: '  ' } })
    expect(partial).toMatchObject({
      editionLabel: '预览版',
      headline: '探索未至之境',
      logoSrc: DSHENT_ANIMATED_ICON,
      name: 'ACME 云',
      shortName: 'ACME',
      staticLogoSrc: DSHENT_ICON,
    })
  })

  it('falls back to the light mark for both theme slots of the login page', () => {
    const darkOnly = resolveEnterpriseBranding({ ...CUSTOM, logo: { dark: '/enterprise/api/v1/local/branding/asset/dark?v=12', light: null, square: null } })
    expect(darkOnly.logoSrc).toBe('/enterprise/api/v1/local/branding/asset/dark?v=12')
    expect(darkOnly.staticLogoSrc).toBe('/enterprise/api/v1/local/branding/asset/dark?v=12')
  })
})

describe('enterprise branding logo source gate', () => {
  it('accepts only the local read-only copy path', () => {
    for (const slot of ['light', 'dark', 'square'] as const) {
      expect(enterpriseBrandingLogoUrl(`/enterprise/api/v1/local/branding/asset/${slot}?v=13`))
        .toBe(`/enterprise/api/v1/local/branding/asset/${slot}?v=13`)
    }
  })

  it('rejects remote, data, script and traversal sources', () => {
    for (const value of [
      '//evil.example/logo.png',
      'https://evil.example/logo.png',
      'http://127.0.0.1:9/logo.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'javascript:alert(1)',
      '/enterprise/api/v1/local/branding/asset/evil?v=12',
      '/enterprise/api/v1/local/branding/asset/light',
      '/enterprise/api/v1/local/branding/asset/light?v=12&x=1',
      null,
      12,
    ]) {
      expect(enterpriseBrandingLogoUrl(value)).toBeUndefined()
    }
  })
})

describe('enterprise branding decode', () => {
  const wire = {
    logo: { dark: null, light: '/enterprise/api/v1/local/branding/asset/light?v=12', square: null },
    name: 'ACME 云',
    revision: 12,
    shortName: 'ACME',
    updatedAt: '2026-09-30T02:00:00Z',
    welcome: { editionLabel: '预览版', headline: '探索未至之境' },
  }

  it('accepts the Host projection and an explicit null', () => {
    expect(decodeEnterpriseBranding(wire)).toEqual(wire)
    expect(decodeEnterpriseBranding(null)).toBeNull()
  })

  it('drops a logo that is not a local copy without losing the rest', () => {
    const decoded = decodeEnterpriseBranding({
      ...wire,
      logo: { dark: null, light: 'https://evil.example/logo.png', square: null },
    })
    expect(decoded).toMatchObject({ logo: { dark: null, light: null, square: null }, name: 'ACME 云' })
  })

  it('rejects a malformed projection with a stable error code', () => {
    const broken: unknown[] = [
      { ...wire, revision: -1 },
      { ...wire, name: 42 },
      { ...wire, welcome: { editionLabel: '预览版' } },
      { ...wire, logo: { light: null } },
      { ...wire, extra: true },
      [],
    ]
    for (const value of broken) {
      expect(() => decodeEnterpriseBranding(value)).toThrowError(EnterpriseLocalApiError)
      expect(() => decodeEnterpriseBranding(value)).toThrowError('ENT_LOCAL_RESPONSE_INVALID')
    }
  })
})

/**
 * **本刀（品牌取数失败不再与「未配置」混同）**。
 *
 * 裁定与理由：**未配置**（Host 明确回 null）继续静默回落内置——那是正确行为，产品口径不变；
 * **取数失败**（本机品牌路由出错）必须让员工看得出来，否则员工会以为「公司没配」。
 * 可见的那一处只有「企业设置 → 账号」的「企业标识」行（非打扰：中性色、不弹窗、不在登录时打断），
 * 侧栏与登录弹窗继续静默回落官方标识。
 */
describe('enterprise branding read state', () => {
  it('keeps «not configured» and «read failed» apart', () => {
    // 未配置：静默回落（保留）。
    expect(enterpriseBrandingReadState(null, undefined)).toBe('builtin')
    expect(enterpriseBrandingReadState(undefined, undefined)).toBe('builtin')
    // 已配置：读到企业品牌。
    expect(enterpriseBrandingReadState(CUSTOM, undefined)).toBe('configured')
    // 取数失败：显式可见（有没有读到过文档都一样——失败就是失败）。
    expect(enterpriseBrandingReadState(CUSTOM, 'ENT_LOCAL_UNAVAILABLE')).toBe('unavailable')
    expect(enterpriseBrandingReadState(null, 'ENT_PLATFORM_UNAVAILABLE')).toBe('unavailable')
  })

  it('gives the 「企业标识」 row a distinct value per state', () => {
    expect(enterpriseBrandingIdentityValue('configured', 'ACME 云')).toBe('ACME 云')
    expect(enterpriseBrandingIdentityValue('builtin', 'DSH Enterprise')).toBe(ENTERPRISE_BRANDING_BUILTIN_VALUE)
    expect(enterpriseBrandingIdentityValue('unavailable', 'DSH Enterprise')).toBe(ENTERPRISE_BRANDING_UNAVAILABLE_VALUE)
    // 三态三个值，两两不同：员工一眼能分出「没配」与「读不到」。
    expect(new Set([
      enterpriseBrandingIdentityValue('configured', 'ACME 云'),
      enterpriseBrandingIdentityValue('builtin', 'DSH Enterprise'),
      enterpriseBrandingIdentityValue('unavailable', 'DSH Enterprise'),
    ]).size).toBe(3)
    expect(ENTERPRISE_BRANDING_IDENTITY_LABEL).toBe('企业标识')
    // 失败提示的前缀也是一句人话，不带裸码。
    expect(ENTERPRISE_BRANDING_READ_FAILED).not.toContain('ENT_')
  })

  it('remembers the last document inside this session so a failed re-read does not drop the brand', () => {
    rememberEnterpriseBranding('https://a.example#READY', CUSTOM)
    expect(recallEnterpriseBranding('https://a.example#READY')).toEqual(CUSTOM)
    // 「这家企业确实没配」也是一件要记住的事实。
    rememberEnterpriseBranding('https://a.example#READY', null)
    expect(recallEnterpriseBranding('https://a.example#READY')).toBeNull()
    // 键变了（换 Server 地址 / 连接状态变）就不复用旧文档：不会把 A 企业的品牌画到 B 企业头上。
    expect(recallEnterpriseBranding('https://b.example#READY')).toBeNull()
    expect(recallEnterpriseBranding('')).toBeNull()
  })

  it('still renders a fully usable built-in brand for the unconfigured path', () => {
    // 静默回落这条路的可渲染性一字未动（逐字段回落仍由 resolveEnterpriseBranding 保证）。
    const view = resolveEnterpriseBranding(null)
    expect(view.custom).toBe(false)
    expect(view.name).toBe(ENTERPRISE_BUILTIN_BRANDING.name)
    // 读态是**另算**的一层（不改 resolveEnterpriseBranding 的既有形状）。
    expect(enterpriseBrandingReadState(null, undefined)).toBe('builtin')
  })
})
