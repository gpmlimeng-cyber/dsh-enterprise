/**
 * [INPUT]: 依赖 node:http 与 HTTP/JSON 契约 fixture（bootstrap/token/auth-sources/usage/enroll）
 * [OUTPUT]: 对外提供 startMockEnterpriseServer，返回基址、请求记录与关闭句柄
 * [POS]: tests 的协议裁判；用真 HTTP 而不是打桩 fetch，保证信封、状态码与 headers 与契约一致
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'

export interface RecordedRequest {
  readonly method: string
  readonly path: string
  readonly authorization: string | undefined
  readonly body: string
}

export interface MockEnterpriseServer {
  readonly baseUrl: string
  readonly requests: RecordedRequest[]
  /** 让后续请求返回一次失败，用于错误路径断言。 */
  failNext(status: number, body: unknown): void
  close(): Promise<void>
}

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'),
  ) as unknown
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', chunk => {
      body += String(chunk)
    })
    request.on('end', () => {
      resolve(body)
    })
  })
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

function sendRaw(response: ServerResponse, status: number, body: Buffer, contentType: string): void {
  response.writeHead(status, { 'content-type': contentType, 'content-length': body.length })
  response.end(body)
}

/**
 * 覆盖 E1–E4 客户端实际会打的全部端点。任何未实现的路径都会 404 并留下记录，
 * 使"漏实现端点"在集成测试里立刻暴露，而不是被静默吞掉。
 */
export async function startMockEnterpriseServer(): Promise<MockEnterpriseServer> {
  const requests: RecordedRequest[] = []
  let pendingFailure: { status: number; body: unknown } | null = null

  const server: Server = createServer((request, response) => {
    void (async () => {
      const method = request.method ?? 'GET'
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const body = await readBody(request)
      requests.push({
        method,
        path: url.pathname + url.search,
        authorization: request.headers.authorization,
        body,
      })

      if (pendingFailure !== null) {
        const failure = pendingFailure
        pendingFailure = null
        send(response, failure.status, failure.body)
        return
      }

      const path = url.pathname

      if (method === 'GET' && path === '/enterprise/auth/v1/authorize') {
        send(response, 200, fixture('auth-sources-success.json'))
        return
      }
      if (method === 'POST' && path === '/enterprise/auth/v1/token') {
        send(response, 200, fixture('token-success.json'))
        return
      }
      if (method === 'POST' && path === '/enterprise/auth/v1/logout') {
        send(response, 204, {})
        return
      }
      if (method === 'POST' && path === '/enterprise/api/v1/devices/enroll') {
        const installationId = (JSON.parse(body) as { installationId?: string }).installationId ?? ''
        send(response, 200, {
          data: { id: '1900200000000000001', installationId, status: 'ACTIVE' },
          requestId: 'req_mock_enroll',
        })
        return
      }
      if (method === 'POST' && path === '/enterprise/api/v1/devices/heartbeat') {
        send(response, 200, {
          data: { status: 'ACTIVE', revision: 9 },
          requestId: 'req_mock_heartbeat',
        })
        return
      }
      if (method === 'GET' && path === '/enterprise/api/v1/bootstrap') {
        send(response, 200, fixture('bootstrap-models-success.json'))
        return
      }
      if (method === 'GET' && path === '/enterprise/api/v1/usage/me') {
        send(response, 200, fixture('quota-usage-me-success.json'))
        return
      }
      if (method === 'GET' && path === '/enterprise/api/v1/plugins/assignments') {
        send(response, 200, fixture('plugin-assignments-success.json'))
        return
      }
      if (method === 'GET' && path.startsWith('/enterprise/api/v1/plugins/versions/') && path.endsWith('/download')) {
        sendRaw(response, 200, Buffer.from('mock-plugin-tarball'), 'application/octet-stream')
        return
      }
      if (method === 'POST' && path === '/enterprise/gateway/v1/chat/completions') {
        send(response, 200, { id: 'chatcmpl_mock', choices: [] })
        return
      }
      if (method === 'POST' && path === '/enterprise/gateway/v1/responses') {
        send(response, 200, { id: 'resp_mock', output: [] })
        return
      }
      if (method === 'POST' && path === '/enterprise/gateway/v1/messages') {
        send(response, 200, { id: 'msg_mock', content: [] })
        return
      }

      send(response, 404, {
        error: {
          code: 'ENT_RESOURCE_NOT_FOUND',
          message: `mock server has no handler for ${method} ${path}`,
          requestId: 'req_mock_missing',
          retryable: false,
        },
      })
    })()
  })

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('mock enterprise server failed to bind a loopback port')
  }

  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    requests,
    failNext(status, body) {
      pendingFailure = { status, body }
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error === undefined) resolve()
          else reject(error)
        })
      })
    },
  }
}
