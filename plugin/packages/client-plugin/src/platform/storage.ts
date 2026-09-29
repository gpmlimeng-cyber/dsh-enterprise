/**
 * [INPUT]: 依赖 node:fs/node:path/node:crypto 的内置能力，读写 <dshHome>/enterprise 下的非秘密配置与凭据文件
 * [OUTPUT]: 对外提供 EnterpriseStoredConfig / EnterpriseStoredCredentials 形状与 EnterpriseStore 同步读写门面
 * [POS]: platform 层唯一的本地持久化边界；config.json 记录地址与 installation，credentials.json 独占 refreshToken，
 *        凭据文件权限收紧到 0600，全部写入走 tmp+rename 原子替换，损坏输入一律回退默认值而不抛异常
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { EnterpriseClientId } from '../protocol/types.js'

/** 与契约 InstallationId 逐字一致的 UUIDv4 形状。 */
const UUID_V4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/
/** 与契约 RefreshTokenRequest 逐字一致的轮换凭据形状。 */
const REFRESH_TOKEN = /^dshr_[A-Za-z0-9_-]{43}$/
const CLIENT_IDS: readonly EnterpriseClientId[] = ['dsh-desktop', 'enterprise-admin', 'ent-admin-cli']
const MAX_DEVICE_NAME = 120
const MAX_REFRESH_EXPIRES_IN = 2_592_000
const DIR_MODE = 0o700
const CONFIG_MODE = 0o644
const CREDENTIALS_MODE = 0o600

const CONFIG_FILE = 'config.json'
const CREDENTIALS_FILE = 'credentials.json'

/** 非秘密连接配置；installationId 与 deviceName 只在首次生成时落盘。 */
export interface EnterpriseStoredConfig {
  serverUrl: string | null
  installationId: string | null
  deviceName: string | null
}

/**
 * 本地凭据文件；refreshToken 只在这里与内存出现。
 * accessTokenExpiresAt 为 ISO8601 绝对时刻，refreshExpiresIn 为服务端下发的剩余秒数。
 */
export interface EnterpriseStoredCredentials {
  accessToken: string | null
  accessTokenExpiresAt: string | null
  refreshToken: string | null
  refreshExpiresIn: number | null
  clientId: EnterpriseClientId
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asStoredUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asStoredInstallationId(value: unknown): string | null {
  return typeof value === 'string' && UUID_V4.test(value) ? value : null
}

function asStoredDeviceName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed.length > MAX_DEVICE_NAME ? null : trimmed
}

function asStoredAccessToken(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 16 && value.length <= 512 && !/\s/.test(value) ? value : null
}

function asStoredExpiresAt(value: unknown): string | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null
  return value
}

function asStoredRefreshToken(value: unknown): string | null {
  return typeof value === 'string' && REFRESH_TOKEN.test(value) ? value : null
}

function asStoredRefreshExpiresIn(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null
  return value > 0 && value <= MAX_REFRESH_EXPIRES_IN ? value : null
}

function asStoredClientId(value: unknown): EnterpriseClientId {
  return CLIENT_IDS.includes(value as EnterpriseClientId) ? (value as EnterpriseClientId) : 'dsh-desktop'
}

/**
 * `<dshHome>/enterprise` 的唯一读写门面。
 *
 * 不变量：
 * 1. 目录 0700、config.json 0644、credentials.json 0600；
 * 2. 写入先落同目录临时文件再 rename 覆盖，任何时刻都不会读到半截 JSON；
 * 3. 读取遇到 ENOENT、非法 JSON 或字段类型不符时逐字段回退默认值，**绝不上抛**——
 *    调用方（状态机）以状态而非异常表达存储故障；缺失告警由 Host 侧状态呈现，避免散乱日志。
 */
export class EnterpriseStore {
  /** `<dshHome>/enterprise`；所有持久化文件都不得离开此目录。 */
  readonly dir: string

  private readonly now: () => Date

  constructor(options: { dshHome: string; now?: () => Date }) {
    this.dir = join(options.dshHome, 'enterprise')
    this.now = options.now ?? ((): Date => new Date())
  }

  /** 读取连接配置；文件缺失或损坏时返回全 null 默认值。 */
  readConfig(): EnterpriseStoredConfig {
    const record = this.readJson(CONFIG_FILE)
    return {
      serverUrl: asStoredUrl(record?.['serverUrl']),
      installationId: asStoredInstallationId(record?.['installationId']),
      deviceName: asStoredDeviceName(record?.['deviceName']),
    }
  }

  /** 以 patch 合并现有配置后原子写入，并返回合并结果（写入失败时返回值仍为合并结果）。 */
  writeConfig(patch: Partial<EnterpriseStoredConfig>): EnterpriseStoredConfig {
    const current = this.readConfig()
    const next: EnterpriseStoredConfig = {
      serverUrl: patch.serverUrl === undefined ? current.serverUrl : asStoredUrl(patch.serverUrl),
      installationId: patch.installationId === undefined
        ? current.installationId
        : asStoredInstallationId(patch.installationId),
      deviceName: patch.deviceName === undefined ? current.deviceName : asStoredDeviceName(patch.deviceName),
    }
    this.writeJson(CONFIG_FILE, next, CONFIG_MODE)
    return next
  }

  /** 读取凭据；任何字段非法即回退默认值，绝不让脏令牌进入内存。 */
  readCredentials(): EnterpriseStoredCredentials {
    const record = this.readJson(CREDENTIALS_FILE)
    const accessToken = asStoredAccessToken(record?.['accessToken'])
    const refreshToken = asStoredRefreshToken(record?.['refreshToken'])
    return {
      accessToken,
      accessTokenExpiresAt: accessToken === null ? null : asStoredExpiresAt(record?.['accessTokenExpiresAt']),
      refreshToken,
      refreshExpiresIn: refreshToken === null ? null : asStoredRefreshExpiresIn(record?.['refreshExpiresIn']),
      clientId: asStoredClientId(record?.['clientId']),
    }
  }

  /** 原子写入凭据，权限强制 0600。 */
  writeCredentials(next: EnterpriseStoredCredentials): void {
    const accessToken = asStoredAccessToken(next.accessToken)
    const refreshToken = asStoredRefreshToken(next.refreshToken)
    const payload: EnterpriseStoredCredentials = {
      accessToken,
      accessTokenExpiresAt: accessToken === null ? null : asStoredExpiresAt(next.accessTokenExpiresAt),
      refreshToken,
      refreshExpiresIn: refreshToken === null ? null : asStoredRefreshExpiresIn(next.refreshExpiresIn),
      clientId: asStoredClientId(next.clientId),
    }
    this.writeJson(CREDENTIALS_FILE, payload, CREDENTIALS_MODE)
  }

  /** 清空凭据：写回全空载荷而不是删文件，保持 0600 权限事实始终可观测。 */
  clearCredentials(): void {
    this.writeCredentials({
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: null,
      refreshExpiresIn: null,
      clientId: 'dsh-desktop',
    })
  }

  private readJson(fileName: string): Record<string, unknown> | undefined {
    try {
      const text = readFileSync(join(this.dir, fileName), 'utf8')
      const parsed: unknown = JSON.parse(text)
      return isRecord(parsed) ? parsed : undefined
    } catch {
      return undefined
    }
  }

  private writeJson(fileName: string, payload: unknown, mode: number): void {
    const target = join(this.dir, fileName)
    const temporary = `${target}.${String(process.pid)}.${String(this.now().getTime())}.${randomUUID()}.tmp`
    try {
      mkdirSync(this.dir, { recursive: true, mode: DIR_MODE })
      writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode })
      // rename 会保留临时文件权限，但 umask 与平台差异仍可能放宽，这里显式收紧一次。
      chmodSync(temporary, mode)
      renameSync(temporary, target)
      chmodSync(target, mode)
    } catch {
      try {
        rmSync(temporary, { force: true })
      } catch {
        // 清理失败不得掩盖写入失败本身，静默放弃。
      }
    }
  }
}
