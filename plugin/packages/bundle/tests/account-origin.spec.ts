/**
 * [INPUT]: 依赖 bundle 的 cordis.patch.yml、发布源码/产物、`src/account-origin.ts` 的校验纯函数与路由注册器、Node 原生 HTTP server/fetch
 * [OUTPUT]: 锁定目标1 的后台地址不变量：base 行停用、企业默认域名进源码、地址校验纯函数、桌面身份重述、官方账户 UI/控制器 row 不被覆盖、发布物内不出现非回环的内网字面端点，以及本地 GET/POST 路由的 200/400/405 契约
 * [POS]: bundle 的部署安全回归门禁；"地址必须由用户自己填"的语义被改成硬编码、或有人把某个内网 IP 写死进包，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  accountOriginFingerprint,
  DEFAULT_ACCOUNT_ORIGIN,
  normalizeAccountOrigin,
  registerEnterpriseAccountRoutes,
  resolveAccountOrigins,
  type AccountOrigin,
  type AccountOriginPort,
} from '../src/account-origin.js'
import type { WebServerRoutePort } from '@dshent/platform-client'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 本企业账户后台默认域名；两个地址都默认指向它，且必须可由产品界面改写。 */
const ENTERPRISE_ORIGIN = 'https://meizhiyun.chat'

/**
 * 抽取一个顶层 patch 块：`- id: <name>` 起，到下一个顶层 `- ` 行为止。
 * 行式解析是刻意的——为本文件引入 YAML 依赖不值得，而 patch 由本仓固定风格维护。
 */
function patchBlock(source: string, id: string): string {
  const lines = source.split('\n')
  const start = lines.findIndex(line => line.trimEnd() === `- id: ${id}`)
  if (start === -1) throw new Error(`cordis.patch.yml 缺少顶层块: ${id}`)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(line => /^- /.test(line))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n')
}

async function patchSource(): Promise<string> {
  return readFile(resolve(ROOT, 'cordis.patch.yml'), 'utf8')
}

async function bundleSource(file: string): Promise<string> {
  return readFile(resolve(ROOT, file), 'utf8')
}

describe('目标1：官方账户行停用，后台地址由用户自定义', () => {
  it('停用 base 的 deepseek-account 行，交给企业 bundle 用同一官方实现挂载', async () => {
    const block = patchBlock(await patchSource(), 'deepseek-account')
    expect(block).toContain('disabled: true')
    // 停用之后不再覆盖 config：base 行自带的 desktopPlatform 原样保留，不会被"整体替换"语义吃掉。
    expect(block).not.toContain('config:')
  })

  it('企业默认域名进源码，且默认地址必须是 HTTPS', async () => {
    expect(DEFAULT_ACCOUNT_ORIGIN).toBe(ENTERPRISE_ORIGIN)
    const source = await bundleSource('src/account-origin.ts')
    expect(source).toContain(ENTERPRISE_ORIGIN)
    // 官方 platformOrigin() 只接受 HTTPS；企业默认值必须无明文例外。
    expect(DEFAULT_ACCOUNT_ORIGIN.startsWith('https://')).toBe(true)
  })

  it('重述 base 行的 desktopPlatform：patch 的 config 整体替换语义下也不能丢桌面原生身份', async () => {
    const source = await bundleSource('src/index.ts')
    expect(source).toContain('desktopPlatform')
    expect(source).toContain("ctx.get('profileContext')")
    expect(source).toContain("profile?.name !== 'desktop'")
    expect(source).toContain("['darwin', 'win32']")
  })

  it('发布物内不得出现硬编码的内网字面端点，只允许本地回环事实', async () => {
    // 回环是本地 PKCE callback 与 Host 私有认证代理的既定事实，不属于"内网后台地址"。
    const loopback = new Set(['http://127.0.0.1', 'https://127.0.0.1'])
    const files = [
      'cordis.patch.yml',
      'package.json',
      'scripts/build.mjs',
      'src/account-origin.ts',
      'src/index.ts',
      'lib/index.js',
      'lib/client.js',
    ]
    for (const file of files) {
      const source = await bundleSource(file)
      const endpoints = [...source.matchAll(/https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/g)].map(match => match[0])
      expect(endpoints.filter(endpoint => !loopback.has(endpoint)), `${file} 出现硬编码内网端点`).toEqual([])
    }
  })

  it('不覆盖官方账户页面与账户控制器 row：官方账户管理与页面原样复用', async () => {
    const source = await patchSource()
    expect(source).not.toMatch(/^- id: ui-settings-account$/m)
    expect(source).not.toMatch(/^- id: account-controller$/m)
    expect(source).not.toMatch(/^- id: deepseek-account-platform$/m)
  })

  it('保留既有企业策略行（默认模型 / 停用个人 provider / 插入企业 row）', async () => {
    const source = await patchSource()
    expect(patchBlock(source, 'agent-default-model')).toContain('provider: enterprise')
    expect(patchBlock(source, 'llm-deepseek')).toContain('disabled: true')
    expect(patchBlock(source, 'llm-pi-ai')).toContain('disabled: true')
    expect(patchBlock(source, 'ui-settings-models')).toContain('disabled: true')
    expect(source).toContain("- id: owndsh\n      name: 'dshent-plugin'")
  })
})

describe('目标1：账户后台地址校验纯函数', () => {
  it('接受企业默认域名并原样返回', () => {
    expect(normalizeAccountOrigin(ENTERPRISE_ORIGIN)).toBe(ENTERPRISE_ORIGIN)
  })

  it('拒绝非 loopback 的明文 HTTP —— 上游 platformOrigin() 同样拒绝', () => {
    expect(() => normalizeAccountOrigin('http://meizhiyun.chat')).toThrow(TypeError)
    expect(() => normalizeAccountOrigin('http://10.1.2.3')).toThrow(TypeError)
  })

  it('接受回环明文 HTTP（本地 Mock / 开发代理）', () => {
    expect(normalizeAccountOrigin('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080')
    expect(normalizeAccountOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('拒绝携带 path、query、fragment 或凭据的地址', () => {
    for (const value of [
      'https://meizhiyun.chat/enterprise',
      'https://meizhiyun.chat/?a=1',
      'https://meizhiyun.chat/#frag',
      'https://user:secret@meizhiyun.chat',
    ]) {
      expect(() => normalizeAccountOrigin(value), value).toThrow(TypeError)
    }
  })

  it('拒绝非绝对地址与非 HTTP(S) 协议，空串回落企业默认', () => {
    expect(() => normalizeAccountOrigin('meizhiyun.chat')).toThrow(TypeError)
    expect(() => normalizeAccountOrigin('file:///etc/passwd')).toThrow(TypeError)
    expect(normalizeAccountOrigin('   ')).toBe(ENTERPRISE_ORIGIN)
  })
})

describe('目标1：账户后台地址本地路由', () => {
  const PATH = '/enterprise/api/v1/local/account-origin'
  let server: Server
  let baseUrl: string
  let route: Parameters<WebServerRoutePort['register']>[0] | undefined
  let stored: AccountOrigin
  let mounted: string

  beforeEach(async () => {
    route = undefined
    stored = { platformOrigin: ENTERPRISE_ORIGIN, inferenceOrigin: ENTERPRISE_ORIGIN }
    mounted = accountOriginFingerprint(stored)
    const port: AccountOriginPort = {
      read: () => stored,
      mountedFingerprint: () => mounted,
      write: async (patch) => {
        stored = { ...stored, ...patch }
        mounted = accountOriginFingerprint(resolveAccountOrigins(stored))
      },
    }
    const webServer: WebServerRoutePort = {
      host: '127.0.0.1',
      port: 0,
      register: (registered) => {
        route = registered
        return () => { route = undefined }
      },
    }
    registerEnterpriseAccountRoutes(webServer, port)
    server = createServer((request, response) => {
      if (route === undefined) return void response.writeHead(404).end()
      void Promise.resolve(route.handler(request, response))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('missing test port')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
  })

  async function post(body: unknown, method = 'POST'): Promise<Response> {
    return fetch(`${baseUrl}${PATH}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  }

  it('GET 回显当前地址与企业默认值', async () => {
    const response = await fetch(`${baseUrl}${PATH}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        platformOrigin: ENTERPRISE_ORIGIN,
        inferenceOrigin: ENTERPRISE_ORIGIN,
        defaults: { platformOrigin: ENTERPRISE_ORIGIN, inferenceOrigin: ENTERPRISE_ORIGIN },
      },
    })
  })

  it('POST 写入自定义地址并报告已热重挂，重复写入不再重挂', async () => {
    const first = await post({ platformOrigin: 'https://account.example.com' })
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({
      data: {
        platformOrigin: 'https://account.example.com',
        inferenceOrigin: ENTERPRISE_ORIGIN,
        remounted: true,
      },
    })
    const second = await post({ platformOrigin: 'https://account.example.com' })
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ data: { remounted: false } })
  })

  it('POST 非法地址在写入前被拒，且不改变已存配置', async () => {
    for (const platformOrigin of [
      'http://meizhiyun.chat',
      'https://meizhiyun.chat/path',
      'https://meizhiyun.chat/?a=1',
      'https://user:secret@meizhiyun.chat',
      'http://10.0.0.7',
    ]) {
      const response = await post({ platformOrigin })
      expect(response.status, platformOrigin).toBe(400)
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
    expect(stored.platformOrigin).toBe(ENTERPRISE_ORIGIN)
    expect(mounted).toBe(accountOriginFingerprint(stored))
  })

  it('拒绝未知字段、非字符串与非法 JSON', async () => {
    for (const body of [{ platformOrigins: 'https://a.example.com' }, { platformOrigin: 7 }, '{']) {
      const response = await post(body)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
    }
  })

  it('非 GET/POST 返回 405 并声明 Allow', async () => {
    const response = await post({}, 'PUT')
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, POST')
    expect(await response.json()).toEqual({ error: { code: 'ENT_INVALID_REQUEST' } })
  })
})
