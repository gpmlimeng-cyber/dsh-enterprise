/**
 * [INPUT]: 依赖 paths 与 node:crypto/fs
 * [OUTPUT]: 对外提供 loadOrCreateInstallation 与 InstallationRecord
 * [POS]: ent-admin-cli 的非秘密设备身份，永不接触 Token
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { dirname } from 'node:path'
import { installationPath } from './paths.js'

const UUID_V4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/

export interface InstallationRecord {
  readonly installationId: string
  readonly name: string
  readonly createdAt: string
}

function parseInstallation(text: string): InstallationRecord {
  const value: unknown = JSON.parse(text)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('installation file must contain an object')
  }
  const record = value as Record<string, unknown>
  if (
    typeof record['installationId'] !== 'string' ||
    !UUID_V4.test(record['installationId']) ||
    typeof record['name'] !== 'string' ||
    record['name'].length === 0 ||
    record['name'].length > 120 ||
    typeof record['createdAt'] !== 'string' ||
    !Number.isFinite(Date.parse(record['createdAt']))
  ) {
    throw new TypeError('installation file is invalid')
  }
  return {
    installationId: record['installationId'],
    name: record['name'],
    createdAt: record['createdAt'],
  }
}

export async function loadOrCreateInstallation(env?: NodeJS.ProcessEnv): Promise<InstallationRecord> {
  const path = installationPath(env)
  try {
    return parseInstallation(await readFile(path, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const record: InstallationRecord = {
    installationId: randomUUID(),
    name: hostname(),
    createdAt: new Date().toISOString(),
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  await rename(temporary, path)
  return record
}
