/**
 * [INPUT]: 依赖 Harness CredentialProvider、installation、T02 Token 契约、时钟与 Refresh Token 交换函数
 * [OUTPUT]: 提供 Host GrantRecord、按需单次轮换及会话代次隔离，阻止退出后旧异步任务复活凭据
 * [POS]: platform-client 的认证凭据内核，Service 只观察 Access Token，不接触持久化记录格式
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  credentialKey,
  type CredentialProvider,
  type CredentialRecord,
  type GrantRecord,
} from '@deepseek-ai/dsh-credentials'
import type { TokenRequest, TokenResponse } from '@dshent/contracts'
import type { InstallationRecord } from './installation.js'

/**
 * 当前 scope（`dshent`）与改名前的旧 scope（`owndsh`）。
 *
 * [改名迁移] 本插件对外名从 `owndsh` 改为 `dshent` 后，官方 credentials 里**已落盘**的
 * `<scope>/platform` GrantRecord 仍挂在旧 scope 下（实机 `.credentials.yaml` 形如
 * `owndsh/platform: {refreshToken: dshr_…, installationId: …}`）。若读路径直接切到新键，
 * 升级后旧记录读不到 ⇒ Refresh Token 当场作废、用户被迫重新登录。
 *
 * 因此**读路径双读**（先新键、回退旧键），**写路径单写新键并清旧键**：
 *   · `rotate()`/首刷先读新键，读不到再读旧键（保住升级前的登录态）；
 *   · `store()` 落新键；`delete()`/`discard()` 同时清两个键（登出不留半份旧凭据）。
 * 本版本窗口只保留这条回退；等所有已装设备都落过一次新键后，下一个版本移除旧键读取。
 */
const PLATFORM_GRANT_KEY = credentialKey('dshent', 'platform')
/** 改名前的 scope；仅用于读回退与登出清理，**绝不**再作为写入目标。 */
const LEGACY_PLATFORM_GRANT_KEY = credentialKey('owndsh', 'platform')
/** 读路径按此顺序取 GrantRecord：新键优先，读不到回退旧键。 */
const PLATFORM_GRANT_READ_KEYS: readonly ReturnType<typeof credentialKey>[] = [
  PLATFORM_GRANT_KEY,
  LEGACY_PLATFORM_GRANT_KEY,
]
const REFRESH_TOKEN = /^dshr_[A-Za-z0-9_-]{43}$/

interface PlatformGrantPayload {
  readonly version: 1
  readonly serverUrl: string
  readonly installationId: string
  readonly refreshToken: string
  readonly refreshExpiresAt: number
}

type PlatformTokenData = TokenResponse['data']
type ExchangeRefreshToken = (
  baseUrl: URL,
  request: TokenRequest,
  signal: AbortSignal,
) => Promise<PlatformTokenData>

function platformGrant(payload: PlatformGrantPayload): GrantRecord {
  return { kind: 'grant', payload }
}

function readPlatformGrant(record: CredentialRecord | undefined): PlatformGrantPayload | undefined {
  if (record?.kind !== 'grant' || typeof record.payload !== 'object' || record.payload === null) return undefined
  const value = record.payload as Record<string, unknown>
  if (value['version'] !== 1
    || typeof value['serverUrl'] !== 'string'
    || typeof value['installationId'] !== 'string'
    || typeof value['refreshToken'] !== 'string'
    || !REFRESH_TOKEN.test(value['refreshToken'])
    || typeof value['refreshExpiresAt'] !== 'number'
    || !Number.isSafeInteger(value['refreshExpiresAt'])) return undefined
  return value as unknown as PlatformGrantPayload
}

/** 官方 credentials 记录与进程内 Access Token 的唯一所有者。 */
export class PlatformCredentialManager {
  private accessTokenValue: string | undefined
  private accessExpiresAtValue = 0
  private refreshTask: Promise<boolean> | undefined
  private generation = 0
  private readonly tasks = new Set<Promise<unknown>>()

  constructor(
    private readonly credentials: CredentialProvider,
    private readonly installation: Promise<InstallationRecord>,
    private readonly now: () => Date,
    private readonly exchangeRefreshToken: ExchangeRefreshToken,
    private readonly canApply: (origin: string) => boolean,
    private readonly warnDeleteFailure: () => void,
  ) {}

  accessToken(): string | undefined {
    return this.accessTokenValue
  }

  needsRefresh(marginMs: number): boolean {
    return this.accessTokenValue === undefined
      || this.now().getTime() >= this.accessExpiresAtValue - marginMs
  }

  clearAccess(): void {
    this.generation++
    this.accessTokenValue = undefined
    this.accessExpiresAtValue = 0
  }

  pending(): readonly Promise<unknown>[] {
    return [...this.tasks]
  }

  async store(token: PlatformTokenData, serverUrl: string): Promise<void> {
    const generation = this.generation
    const installation = await this.installation
    await this.track(this.credentials.modifyRecord(PLATFORM_GRANT_KEY, async () =>
      generation !== this.generation || !this.canApply(serverUrl) ? undefined : platformGrant({
      version: 1,
      serverUrl,
      installationId: installation.installationId,
      refreshToken: token.refreshToken,
      refreshExpiresAt: this.now().getTime() + token.refreshExpiresIn * 1_000,
    })))
    // 登录成功即新记录落新键；**不**在此删旧键 —— 读路径已双读且新键优先，残留的旧键读不到、无害，
    // 留待下一次 rotate（命中旧键时搬移）或 delete/discard（登出）统一清理，避免误删刚写入的新记录。
    if (generation === this.generation && this.canApply(serverUrl)) this.apply(token)
  }

  refresh(baseUrl: URL, signal: AbortSignal): Promise<boolean> {
    if (this.refreshTask !== undefined) return this.refreshTask
    const task = this.track(this.rotate(baseUrl, signal))
    this.refreshTask = task
    void task.then(
      () => { if (this.refreshTask === task) this.refreshTask = undefined },
      () => { if (this.refreshTask === task) this.refreshTask = undefined },
    )
    return task
  }

  async delete(): Promise<void> {
    // 登出必须把新旧两个键都清掉：旧键可能是升级前登录态唯一的残留。
    await this.track(this.clearStored())
  }

  discard(): void {
    void this.track(this.clearStored().catch(() => {
      this.warnDeleteFailure()
    }))
  }

  /** 清理当前 scope 的两个可能存放位置（新键 + 改名前旧键）。 */
  private clearStored(): Promise<void> {
    return Promise.all(
      PLATFORM_GRANT_READ_KEYS.map(key => this.credentials.deleteRecord(key)),
    ).then(() => undefined)
  }

  /**
   * 改名迁移的双读修改原语。
   *
   * 语义与官方 `credentials.modifyRecord(key, fn)` 一致——`fn` 收到当前 GrantRecord 的**解析结果**、
   * 返回 `undefined` 表示不写、返回 GrantRecord 表示落盘——但读取按 `PLATFORM_GRANT_READ_KEYS` 顺序
   * 双读：新键读不到再读旧键（升级前的登录态还挂在旧 scope 下）。
   *
   * 写入时：无论命中的是新键还是旧键，都**只写新键**，并顺手清掉旧键（把登录态搬进新 scope）。
   * `fn` 收到 `undefined`（两个键都没有有效记录）时照常调用——调用方据此写入全新记录。
   *
   * @param fn - 复用读取的 payload 计算新记录的回调；返回 `undefined` 则不落盘，否则是待写入的 `CredentialRecord`。
   */
  private async modifyWithLegacyFallback(
    fn: (grant: PlatformGrantPayload | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<void> {
    // 第一段：双读取现有记录（新键优先）。
    let foundKey: ReturnType<typeof credentialKey> | undefined
    let foundGrant: PlatformGrantPayload | undefined
    for (const key of PLATFORM_GRANT_READ_KEYS) {
      let hit: PlatformGrantPayload | undefined
      await this.credentials.modifyRecord(key, async (current) => {
        hit = readPlatformGrant(current)
        return undefined // 只读不写；真正的写入统一在第二段落到新键。
      })
      if (hit !== undefined) {
        foundKey = key
        foundGrant = hit
        break
      }
    }
    // 第二段：用读到的记录（或空）计算新记录，只写新键。
    const next = await fn(foundGrant)
    if (next === undefined) return
    await this.credentials.modifyRecord(PLATFORM_GRANT_KEY, async () => next)
    // 命中过旧键 ⇒ 登录态已搬进新 scope，清掉旧键防止留下第二份凭据。
    if (foundKey !== undefined && foundKey !== PLATFORM_GRANT_KEY) {
      await this.credentials.deleteRecord(foundKey)
    }
  }

  private async rotate(baseUrl: URL, signal: AbortSignal): Promise<boolean> {
    const generation = this.generation
    const installation = await this.installation
    let refreshed: PlatformTokenData | undefined
    // 续期读取走双读：先新键，读不到（升级前落盘）回退旧键，保住升级前的登录态。
    await this.modifyWithLegacyFallback(async (grant) => {
      if (generation !== this.generation || !this.canApply(baseUrl.origin) || grant === undefined
        || grant.serverUrl !== baseUrl.origin
        || grant.installationId !== installation.installationId
        || grant.refreshExpiresAt <= this.now().getTime()) return undefined
      refreshed = await this.exchangeRefreshToken(baseUrl, {
        grantType: 'refresh_token',
        refreshToken: grant.refreshToken,
        clientId: 'dsh-desktop',
        installationId: installation.installationId,
      }, signal)
      if (generation !== this.generation || !this.canApply(baseUrl.origin)) return undefined
      return platformGrant({
        version: 1,
        serverUrl: baseUrl.origin,
        installationId: installation.installationId,
        refreshToken: refreshed.refreshToken,
        refreshExpiresAt: this.now().getTime() + refreshed.refreshExpiresIn * 1_000,
      })
    })
    const token = refreshed as PlatformTokenData | undefined
    if (token === undefined || generation !== this.generation || !this.canApply(baseUrl.origin)) return false
    this.apply(token)
    return true
  }

  private apply(token: PlatformTokenData): void {
    this.accessTokenValue = token.accessToken
    this.accessExpiresAtValue = this.now().getTime() + token.expiresIn * 1_000
  }

  private track<T>(task: Promise<T>): Promise<T> {
    this.tasks.add(task)
    void task.then(
      () => { this.tasks.delete(task) },
      () => { this.tasks.delete(task) },
    )
    return task
  }
}
