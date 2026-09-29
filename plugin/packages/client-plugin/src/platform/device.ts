/**
 * [INPUT]: 依赖 protocol/http 的 EnterpriseHttpClient 与 protocol/types 的设备请求窄类型
 * [OUTPUT]: 对外提供 EnterpriseDeviceClient.enroll/heartbeat，返回只含客户端所需字段的窄视图
 * [POS]: platform 层的设备生命周期协议客户端；授权 installation 始终取自令牌 terminal，本模块不自行传递用户身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseHttpClient } from '../protocol/http.js'
import type {
  EnterpriseDeviceEnrollRequest,
  EnterpriseDeviceHeartbeatRequest,
} from '../protocol/types.js'

const API_PATH = '/enterprise/api/v1'
const STATUSES: readonly ('ACTIVE' | 'REVOKED')[] = ['ACTIVE', 'REVOKED']
const UUID_V4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/

/** enroll/heartbeat 共用的最小设备事实；不复制中心侧完整 Device 结构（无 userId/审计字段）。 */
export interface EnterpriseDeviceView {
  readonly id: string | null
  readonly installationId: string | null
  readonly status: 'ACTIVE' | 'REVOKED' | null
}

/** heartbeat 关心的 CAS 游标与设备状态。 */
export interface EnterpriseDeviceHeartbeatView {
  readonly status: 'ACTIVE' | 'REVOKED' | null
  readonly desiredRevision: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumericId(value: unknown): string | null {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) ? value : null
}

function asStatus(value: unknown): 'ACTIVE' | 'REVOKED' | null {
  return STATUSES.includes(value as 'ACTIVE' | 'REVOKED') ? (value as 'ACTIVE' | 'REVOKED') : null
}

/** 只提取状态判断所需字段；未知或缺失字段一律置 null，由编排层决定降级策略。 */
function toDeviceView(payload: unknown): EnterpriseDeviceView {
  const record = isRecord(payload) ? payload : {}
  const installationId = record['installationId']
  return {
    id: asNumericId(record['id']),
    installationId: typeof installationId === 'string' && UUID_V4.test(installationId) ? installationId : null,
    status: asStatus(record['status']),
  }
}

/** 企业设备端点客户端；enroll 幂等地创建或更新当前 installation 绑定的设备。 */
export class EnterpriseDeviceClient {
  constructor(private readonly http: EnterpriseHttpClient) {}

  /** `POST /enterprise/api/v1/devices/enroll`。 */
  async enroll(request: EnterpriseDeviceEnrollRequest): Promise<EnterpriseDeviceView> {
    const payload = await this.http.request<unknown>(`${API_PATH}/devices/enroll`, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
    })
    return toDeviceView(payload)
  }

  /** `POST /enterprise/api/v1/devices/heartbeat`；desiredRevision 为服务端 CAS 游标。 */
  async heartbeat(request: EnterpriseDeviceHeartbeatRequest): Promise<EnterpriseDeviceHeartbeatView> {
    const payload = await this.http.request<unknown>(`${API_PATH}/devices/heartbeat`, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
    })
    const record = isRecord(payload) ? payload : {}
    const desiredRevision = record['desiredRevision']
    return {
      status: asStatus(record['status']),
      desiredRevision: typeof desiredRevision === 'number' && Number.isSafeInteger(desiredRevision)
        ? desiredRevision
        : null,
    }
  }
}
