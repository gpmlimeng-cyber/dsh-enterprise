/**
 * [INPUT]: 依赖 paths 与 node:fs 原子写
 * [OUTPUT]: 对外提供 loadConfig/saveConfig/resolveServerUrl
 * [POS]: ent-admin-cli 的 Server origin 配置边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { configPath } from './paths.js'

export interface CliConfig {
  readonly serverUrl: string
}

export function normalizeServerOrigin(value: string): string {
  const url = new URL(value.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('server URL must use http or https')
  }
  if (
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    throw new TypeError('server URL must be an origin without path, query, fragment, or credentials')
  }
  url.pathname = '/'
  return url.origin
}

export async function loadConfig(env?: NodeJS.ProcessEnv): Promise<CliConfig | undefined> {
  try {
    const raw = await readFile(configPath(env), 'utf8')
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TypeError('config must be an object')
    }
    const serverUrl = (value as Record<string, unknown>)['serverUrl']
    if (typeof serverUrl !== 'string' || serverUrl.length === 0) {
      throw new TypeError('config.serverUrl is required')
    }
    return { serverUrl: normalizeServerOrigin(serverUrl) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export async function saveConfig(config: CliConfig, env?: NodeJS.ProcessEnv): Promise<void> {
  const path = configPath(env)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify({ serverUrl: normalizeServerOrigin(config.serverUrl) }, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  })
  await rename(temporary, path)
}

export async function resolveServerUrl(
  options: { server?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<string> {
  const env = options.env ?? process.env
  const fromFlag = options.server ?? env['DSH_ENT_ADMIN_SERVER']
  if (fromFlag !== undefined && fromFlag.trim() !== '') {
    return normalizeServerOrigin(fromFlag)
  }
  const config = await loadConfig(env)
  if (config === undefined) {
    throw new Error('server URL is not configured; run login or pass --server')
  }
  return config.serverUrl
}
