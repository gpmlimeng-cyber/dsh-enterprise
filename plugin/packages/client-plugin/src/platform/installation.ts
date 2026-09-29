/**
 * [INPUT]: 依赖 node:crypto/node:os 的内置能力与 platform/storage 的 EnterpriseStore 配置读写
 * [OUTPUT]: 对外提供 resolveInstallationId（UUIDv4 首次生成后持久化）与 defaultDeviceName（`主机名 (平台)`，≤120）
 * [POS]: platform 层的设备身份来源；installationId 是全客户端唯一的设备绑定键，被 auth 事务与 device enroll 共同引用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomUUID } from 'node:crypto'
import { hostname, platform as osPlatform } from 'node:os'

import { EnterpriseStore } from './storage.js'

/** 与契约 InstallationId 逐字一致的 UUIDv4 形状。 */
const UUID_V4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/
const MAX_DEVICE_NAME = 120
const FALLBACK_HOST = 'dsh-host'
const FALLBACK_PLATFORM = 'unknown'

/** 去掉控制字符与多余空白，避免设备名污染中心侧展示与审计字段。 */
function sanitize(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, Math.max(1, max)).trim()
}

/**
 * 推导稳定的设备展示名：`<hostname> (<platform>)`，总长不超过 120。
 * 主机名不可读时退化为固定前缀，绝不抛异常（该函数在首启路径上被同步调用）。
 */
export function defaultDeviceName(): string {
  let rawHost = ''
  let rawPlatform = ''
  try {
    rawHost = hostname()
  } catch {
    rawHost = ''
  }
  try {
    rawPlatform = osPlatform()
  } catch {
    rawPlatform = ''
  }
  const cleanedHost = sanitize(rawHost)
  const cleanedPlatform = sanitize(rawPlatform)
  const host = cleanedHost.length === 0 ? FALLBACK_HOST : cleanedHost
  const platform = cleanedPlatform.length === 0 ? FALLBACK_PLATFORM : cleanedPlatform
  const suffix = ` (${platform})`
  if (suffix.length >= MAX_DEVICE_NAME) return truncate(`${host}${suffix}`, MAX_DEVICE_NAME)
  return `${truncate(host, MAX_DEVICE_NAME - suffix.length)}${suffix}`
}

/**
 * 返回本机 installationId：磁盘上是合法 UUIDv4 就直接复用，否则生成并持久化。
 * 持久化失败（只读目录、磁盘故障）时仍返回本次生成的标识，并把故障留给后续 enroll 失败呈现，
 * 以免首启阶段因为存储不可用而抛到 Cordis 顶层。
 */
export function resolveInstallationId(store: EnterpriseStore): string {
  const config = store.readConfig()
  if (config.installationId !== null) return config.installationId
  const installationId = randomUUID()
  store.writeConfig({
    installationId,
    deviceName: config.deviceName ?? defaultDeviceName(),
  })
  return installationId
}
