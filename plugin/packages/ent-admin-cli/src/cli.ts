#!/usr/bin/env node
/**
 * [INPUT]: 依赖 auth/http/output 与 OpenAPI admin 只读路径
 * [OUTPUT]: 对外提供 runCli 与 command dispatch
 * [POS]: ent-admin-cli 的参数解析与 Agent stdout/stderr 契约入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { parseArgs } from 'node:util'
import { ensureAccessToken, login, logout, statusSnapshot } from './auth.js'
import { loadConfig, normalizeServerOrigin } from './config.js'
import { EntAdminHttpError, requestJson } from './http.js'
import { exitCodeFor, printErrorJson, printHuman, printJson, printPageSummary } from './output.js'

const HELP = `dsh-ent-admin — DSH Enterprise read-only admin CLI

Usage:
  dsh-ent-admin login --server <origin>
  dsh-ent-admin logout
  dsh-ent-admin status
  dsh-ent-admin <resource> list|get ... [--json] [--cursor <c>] [--limit <n>]

Resources: members, devices, providers, models, model-sets, model-grants,
           quotas, plugins, audit, usage

Usage extras:
  dsh-ent-admin bootstrap [--json]     # employee snapshot: assigned models/quotas/plugins
  dsh-ent-admin usage me
  dsh-ent-admin usage ledger [--json]
  dsh-ent-admin quotas windows <quotaId> [--json]

Global flags:
  --server <origin>   Server origin (or DSH_ENT_ADMIN_SERVER)
  --json              stdout is pure JSON for agents
  --cursor <c>        page cursor
  --limit <n>         page limit

Audit filters:
  --request-id <id>  --actor-id <id>  --action <a>  --resource-type <t>
  --resource-id <id> --from <iso>     --to <iso>
`

/** CLI kebab flags → OpenAPI camelCase query keys. */
export const AUDIT_FILTER_QUERY_KEYS: Record<string, string> = {
  'request-id': 'requestId',
  'actor-id': 'actorId',
  action: 'action',
  'resource-type': 'resourceType',
  'resource-id': 'resourceId',
  from: 'from',
  to: 'to',
}

export function mapAuditFilters(
  values: Record<string, string | boolean | undefined>,
): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [flag, queryKey] of Object.entries(AUDIT_FILTER_QUERY_KEYS)) {
    const value = values[flag]
    if (typeof value === 'string' && value.length > 0) {
      query[queryKey] = value
    }
  }
  return query
}

interface RunOptions {
  argv: string[]
  env?: NodeJS.ProcessEnv
  stdout?: NodeJS.WritableStream
  stderr?: NodeJS.WritableStream
  openBrowser?: (url: string, signal: AbortSignal) => Promise<void>
}

function resolveServer(
  values: Record<string, string | boolean | undefined>,
  env: NodeJS.ProcessEnv,
): string {
  const flag = values['server']
  if (typeof flag === 'string' && flag.length > 0) return normalizeServerOrigin(flag)
  const fromEnv = env['DSH_ENT_ADMIN_SERVER']
  if (fromEnv !== undefined && fromEnv.trim() !== '') return normalizeServerOrigin(fromEnv)
  throw new TypeError('server URL is not configured; run login or pass --server')
}

function humanLine(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value)
  const record = value as Record<string, unknown>
  const id =
    record['id'] ??
    record['userId'] ??
    record['modelId'] ??
    record['deviceId'] ??
    record['quotaId'] ??
    record['name'] ??
    '?'
  const extra =
    record['username'] ??
    record['status'] ??
    record['displayName'] ??
    record['action'] ??
    record['modelId'] ??
    ''
  return `${String(id)}${extra !== '' ? `  ${String(extra)}` : ''}`
}

function emitSuccess(data: unknown, json: boolean, stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream): void {
  if (json) {
    printJson(data, stdout)
    return
  }
  if (typeof data !== 'object' || data === null) {
    printJson(data, stdout)
    return
  }
  const record = data as Record<string, unknown>
  const page = record['data']
  if (typeof page === 'object' && page !== null) {
    const items = (page as Record<string, unknown>)['items']
    if (Array.isArray(items)) {
      for (const item of items) stdout.write(`${humanLine(item)}\n`)
      printPageSummary(data, stderr)
      return
    }
  }
  printJson(data, stdout)
}

async function authedGet<T>(
  serverUrl: string,
  path: string,
  query: Record<string, string | number | undefined>,
  env: NodeJS.ProcessEnv,
): Promise<T> {
  const attempt = async (force: boolean) => {
    const token = await ensureAccessToken(serverUrl, env, { force })
    return requestJson<T>(serverUrl, path, { query, accessToken: async () => token })
  }
  try {
    return await attempt(false)
  } catch (error) {
    if (
      error instanceof EntAdminHttpError &&
      (error.code === 'ENT_AUTH_REQUIRED' || error.code === 'ENT_AUTH_SESSION_EXPIRED') &&
      error.status === 401
    ) {
      return attempt(true)
    }
    throw error
  }
}

const PATHS: Record<string, { list?: string; get?: string }> = {
  members: { list: '/enterprise/admin/v1/members', get: '/enterprise/admin/v1/members/{id}' },
  devices: { list: '/enterprise/admin/v1/devices', get: '/enterprise/admin/v1/devices/{id}' },
  providers: {
    list: '/enterprise/admin/v1/providers',
    get: '/enterprise/admin/v1/providers/{id}',
  },
  models: { list: '/enterprise/admin/v1/models', get: '/enterprise/admin/v1/models/{id}' },
  'model-sets': {
    list: '/enterprise/admin/v1/model-sets',
    get: '/enterprise/admin/v1/model-sets/{id}',
  },
  'model-grants': { list: '/enterprise/admin/v1/model-grants' },
  quotas: { list: '/enterprise/admin/v1/quotas', get: '/enterprise/admin/v1/quotas/{id}' },
  plugins: { list: '/enterprise/admin/v1/plugins' },
  audit: { list: '/enterprise/admin/v1/audit-events' },
  usage: { list: '/enterprise/admin/v1/usage' },
}

export async function runCli(options: RunOptions): Promise<number> {
  const env = options.env ?? process.env
  const stdout = options.stdout ?? process.stdout
  const stderr = options.stderr ?? process.stderr
  const argv = options.argv

  let parsed: ReturnType<typeof parseArgs>
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        server: { type: 'string' },
        json: { type: 'boolean', default: false },
        cursor: { type: 'string' },
        limit: { type: 'string' },
        'request-id': { type: 'string' },
        'actor-id': { type: 'string' },
        action: { type: 'string' },
        'resource-type': { type: 'string' },
        'resource-id': { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        help: { type: 'boolean', default: false },
      },
    })
  } catch (error) {
    printHuman(error instanceof Error ? error.message : String(error), stderr)
    return 2
  }

  const json = parsed.values['json'] === true
  const positionals = parsed.positionals
  const command = positionals[0]

  if (command === undefined || parsed.values['help'] === true || command === 'help') {
    printHuman(HELP, stderr)
    return command === undefined ? 2 : 0
  }

  try {
    if (command === 'login') {
      const server = parsed.values['server']
      if (typeof server !== 'string' || server.length === 0) {
        throw new TypeError('--server is required for login')
      }
      const loginOptions: Parameters<typeof login>[0] = {
        server: normalizeServerOrigin(server),
        env,
        log: (message) => printHuman(message, stderr),
      }
      if (options.openBrowser !== undefined) {
        loginOptions.openBrowser = options.openBrowser
      }
      const result = await login(loginOptions)
      printJson({ ok: true, serverUrl: result.serverUrl, installationId: result.installationId }, stdout)
      return 0
    }

    if (command === 'logout') {
      const serverFlag = parsed.values['server']
      await logout(typeof serverFlag === 'string' ? serverFlag : undefined, env)
      printJson({ ok: true }, stdout)
      return 0
    }

    if (command === 'status') {
      let server: string
      try {
        server = resolveServer(parsed.values as Record<string, string | boolean | undefined>, env)
      } catch {
        const config = await loadConfig(env)
        if (config === undefined) throw new TypeError('server URL is not configured; run login or pass --server')
        server = config.serverUrl
      }
      printJson(await statusSnapshot(server, env), stdout)
      return 0
    }

    const resource = command
    const action = positionals[1]
    const paths = PATHS[resource]
    if (paths === undefined || action === undefined) {
      printHuman(HELP, stderr)
      return 2
    }

    let server: string
    try {
      server = resolveServer(parsed.values as Record<string, string | boolean | undefined>, env)
    } catch {
      const config = await loadConfig(env)
      if (config === undefined) throw new TypeError('server URL is not configured; run login or pass --server')
      server = config.serverUrl
    }

    const cursor = parsed.values['cursor']
    const limit = parsed.values['limit']
    const pageQuery: Record<string, string | number | undefined> = {
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: typeof limit === 'string' ? Number(limit) : undefined,
    }

    if (command === 'bootstrap') {
      const data = await authedGet<unknown>(server, '/enterprise/api/v1/bootstrap', {}, env)
      emitSuccess(data, json, stdout, stderr)
      return 0
    }

    if (resource === 'usage' && action === 'me') {
      const data = await authedGet<unknown>(server, '/enterprise/api/v1/usage/me', {}, env)
      emitSuccess(data, json, stdout, stderr)
      return 0
    }

    if (resource === 'quotas' && action === 'windows') {
      const id = positionals[2]
      if (id === undefined) {
        printHuman('missing id for quotas windows', stderr)
        return 2
      }
      const data = await authedGet<unknown>(
        server,
        `/enterprise/admin/v1/quotas/${encodeURIComponent(id)}/windows`,
        {},
        env,
      )
      emitSuccess(data, json, stdout, stderr)
      return 0
    }

    if (action === 'list' && paths.list !== undefined) {
      const query: Record<string, string | number | undefined> = { ...pageQuery }
      if (resource === 'audit') {
        Object.assign(query, mapAuditFilters(parsed.values as Record<string, string | boolean | undefined>))
      }
      const data = await authedGet<unknown>(server, paths.list, query, env)
      emitSuccess(data, json, stdout, stderr)
      return 0
    }

    if (action === 'get' && paths.get !== undefined) {
      const id = positionals[2]
      if (id === undefined) {
        printHuman(`missing id for ${resource} get`, stderr)
        return 2
      }
      const data = await authedGet<unknown>(server, paths.get.replace('{id}', encodeURIComponent(id)), {}, env)
      emitSuccess(data, json, stdout, stderr)
      return 0
    }

    printHuman(HELP, stderr)
    return 2
  } catch (error) {
    if (json) printErrorJson(error, stdout)
    else printHuman(error instanceof Error ? error.message : String(error), stderr)
    return exitCodeFor(error)
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const code = await runCli({ argv })
  process.exitCode = code
}

const invoked = process.argv[1]
if (
  invoked !== undefined &&
  (invoked.endsWith('cli.js') ||
    invoked.endsWith('dsh-ent-admin') ||
    import.meta.url.endsWith(invoked.replace(/\\/g, '/')))
) {
  void main()
}
