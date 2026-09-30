/**
 * [INPUT]: 依赖 help-link 的地址派生/提示投影/打开口径，以及 local-api 的固定同源路径与 createEnterpriseLocalApi
 * [OUTPUT]: 锁定「帮助与文档」的验收面：地址只由平台地址派生（不含硬编码域名）、未配置时给出「请先配置企业 Server 地址」、打开优先走 Host 系统浏览器通道且失败退 `window.open(url,'_blank','noopener')`、两条路都失败必须如实回报
 * [POS]: dsh-ui 帮助入口的契约回归；有人写死域名、把失败吞掉、或把 noopener 去掉，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ENTERPRISE_HELP_FAILED_HINT,
  ENTERPRISE_HELP_HINT,
  ENTERPRISE_HELP_LABEL,
  ENTERPRISE_HELP_UNCONFIGURED_HINT,
  enterpriseHelpHint,
  enterpriseHelpUrl,
  openEnterpriseHelp,
} from '../src/help-link.js'
import { ENTERPRISE_HELP_OPEN_LOCAL_PATH, createEnterpriseLocalApi } from '../src/local-api.js'

describe('the help url is derived from the platform address', () => {
  it('appends the fixed /help/ path to the configured origin', () => {
    expect(enterpriseHelpUrl('https://enterprise.example.com')).toBe('https://enterprise.example.com/help/')
    expect(enterpriseHelpUrl('https://enterprise.example.com/')).toBe('https://enterprise.example.com/help/')
    expect(enterpriseHelpUrl('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080/help/')
    // 带路径的平台地址按 origin 归一，不把路径拼进帮助站地址。
    expect(enterpriseHelpUrl('https://enterprise.example.com/enterprise/api')).toBe('https://enterprise.example.com/help/')
  })

  it('refuses everything that is not a usable http(s) origin', () => {
    for (const value of [null, undefined, '', 'not a url', 'ftp://enterprise.example.com', 'javascript:alert(1)']) {
      expect(enterpriseHelpUrl(value), String(value)).toBeUndefined()
    }
  })

  it('never hardcodes a domain', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile(new URL('../src/help-link.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/https?:\/\/[a-z0-9.-]+/u)
  })
})

describe('the row tells the user what it needs before it is clicked', () => {
  it('uses the 需登录 wording when configured and the 配置 hint when not', () => {
    expect(ENTERPRISE_HELP_LABEL).toBe('帮助与文档')
    expect(ENTERPRISE_HELP_HINT).toBe('将打开帮助中心（需登录）')
    expect(ENTERPRISE_HELP_UNCONFIGURED_HINT).toBe('请先配置企业 Server 地址')
    expect(enterpriseHelpHint(true)).toBe(ENTERPRISE_HELP_HINT)
    expect(enterpriseHelpHint(false)).toBe(ENTERPRISE_HELP_UNCONFIGURED_HINT)
    // 未配置不是无声的：这句提示必须能单独看懂。
    expect(enterpriseHelpHint(false)).toContain('Server 地址')
  })
})

describe('opening prefers the Host system browser and falls back to window.open', () => {
  it('reports host when the Host route accepted the request', async () => {
    const openHelp = vi.fn(async () => undefined)
    const openWindow = vi.fn()
    const outcome = await openEnterpriseHelp({
      api: { openHelp },
      openWindow,
      url: 'https://enterprise.example.com/help/',
    })
    expect(outcome).toBe('host')
    expect(openHelp).toHaveBeenCalledTimes(1)
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('falls back to a new window with noopener when the route is unavailable', async () => {
    const openHelp = vi.fn(async () => { throw new Error('404') })
    const openWindow = vi.fn()
    const outcome = await openEnterpriseHelp({
      api: { openHelp },
      openWindow,
      url: 'https://enterprise.example.com/help/',
    })
    expect(outcome).toBe('window')
    expect(openWindow).toHaveBeenCalledWith('https://enterprise.example.com/help/', '_blank', 'noopener')
  })

  it('reports failed instead of swallowing the case where both paths break', async () => {
    const outcome = await openEnterpriseHelp({
      api: { openHelp: async () => { throw new Error('404') } },
      openWindow: () => { throw new Error('popup blocked') },
      url: 'https://enterprise.example.com/help/',
    })
    expect(outcome).toBe('failed')
    expect(ENTERPRISE_HELP_FAILED_HINT).toContain('未能打开帮助中心')
  })

  it('posts the fixed same-origin path with no body and no URL parameter', async () => {
    const fetcher = vi.fn(async () => new Response('{"data":{"opened":true}}', {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }))
    const signal = new AbortController().signal
    await createEnterpriseLocalApi(fetcher as unknown as typeof fetch).openHelp(signal)
    const [path, init] = fetcher.mock.calls[0]!
    expect(path).toBe(ENTERPRISE_HELP_OPEN_LOCAL_PATH)
    expect(path).toBe('/enterprise/api/v1/local/help/open')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{}')
    // 浏览器不传 URL、不读正文：地址由 Host 按自己的平台地址派生（严格 allowlist）。
    expect(JSON.stringify(init)).not.toContain('help/')
  })

  it('projects a controlled error code when the Host refuses', async () => {
    const fetcher = vi.fn(async () => new Response('{"error":{"code":"ENT_PLATFORM_UNAVAILABLE"}}', {
      headers: { 'content-type': 'application/json' },
      status: 503,
    }))
    await expect(createEnterpriseLocalApi(fetcher as unknown as typeof fetch)
      .openHelp(new AbortController().signal)).rejects.toThrow('ENT_PLATFORM_UNAVAILABLE')
  })
})
