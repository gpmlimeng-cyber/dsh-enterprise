/**
 * [INPUT]: 依赖 paths 与 node:fs 原子写
 * [OUTPUT]: 对外提供 loadCredentials/saveCredentials/deleteCredentials 与 CredentialRecord
 * [POS]: ent-admin-cli 的 Refresh Token 落盘边界；Access Token 永不写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { credentialsPath } from './paths.js'
import { normalizeServerOrigin } from './config.js'

const REFRESH_TOKEN = /^dshr_[A-Za-z0-9_-]{43}$/

export interface CredentialRecord {
  readonly serverUrl: string
  readonly installationId: string
  readonly refreshToken: string
  readonly refreshExpiresAt: number
}

function parseCredentials(text: string): CredentialRecord {
  const value: unknown = JSON.parse(text)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('credentials file must contain an object')
  }
  const record = value as Record<string, unknown>
  if (
    typeof record['serverUrl'] !== 'string' ||
    typeof record['installationId'] !== 'string' ||
    typeof record['refreshToken'] !== 'string' ||
    !REFRESH_TOKEN.test(record['refreshToken']) ||
    typeof record['refreshExpiresAt'] !== 'number' ||
    !Number.isSafeInteger(record['refreshExpiresAt'])
  ) {
    throw new TypeError('credentials file is invalid')
  }
  return {
    serverUrl: normalizeServerOrigin(record['serverUrl']),
    installationId: record['installationId'],
    refreshToken: record['refreshToken'],
    refreshExpiresAt: record['refreshExpiresAt'],
  }
}

export async function loadCredentials(env?: NodeJS.ProcessEnv): Promise<CredentialRecord | undefined> {
  try {
    return parseCredentials(await readFile(credentialsPath(env), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export async function saveCredentials(record: CredentialRecord, env?: NodeJS.ProcessEnv): Promise<void> {
  const path = credentialsPath(env)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(parseCredentials(JSON.stringify(record)), null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  })
  await rename(temporary, path)
}

export async function deleteCredentials(env?: NodeJS.ProcessEnv): Promise<void> {
  await rm(credentialsPath(env), { force: true })
}
