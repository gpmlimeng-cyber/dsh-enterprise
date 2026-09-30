/**
 * [INPUT]: 依赖 dsh-ui 的品牌读取层、内置品牌位图与 local-api 的品牌解码器
 * [OUTPUT]: 锁定「未配置/取数失败 → 内置名称、欢迎语、版本标识与内置位图」的逐字段回落、LOGO 来源门禁（只认同源本地副本）与 Host 投影的严格解码
 * [POS]: dsh-ui 品牌读取层的回归测试，保证登录弹窗与菜单头部在任何企业状态下都有可渲染的品牌
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import { DSHENT_ANIMATED_ICON, DSHENT_ICON } from '../src/brand.js'
import {
  ENTERPRISE_BUILTIN_BRANDING,
  enterpriseBrandingLogoUrl,
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
