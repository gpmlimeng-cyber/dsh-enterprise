/**
 * [INPUT]: 只依赖标准 Error 与内置 Date/正则，不依赖任何 DTO、fetch、React 或宿主 API
 * [OUTPUT]: 对外提供严格解码内核——失败码 `EnterpriseLocalApiError`、键集封闭判定 `hasExactKeys`、JSON 记录视图 `JsonRecord` 与 record/nonEmptyString/timestamp/nullableTimestamp/enterpriseId 校验
 * [POS]: dsh-ui 浏览器取数契约层的最底层叶子：local-api-decode 与 skill-api-decode 共享同一套「什么算畸形」判定，避免两个分片各写一份键集、时间戳与雪花 ID 规则；本文件不认识任何业务字段
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 本地 API 的稳定失败码载体。
 *
 * `code` 是受控错误码（界面据此显示中文文案），`status` 只在确有 HTTP 响应时出现；
 * 解码器抛它、调用方用 `instanceof` 取码，因此它必须是全包唯一的一份类定义。
 */
export class EnterpriseLocalApiError extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super(code)
    this.name = 'EnterpriseLocalApiError'
  }
}

/** 解码器内部的 JSON 对象视图（数组与 null 都先被 record 挡在门外）。 */
export type JsonRecord = Record<string, unknown>

export function record(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
}

/**
 * 键集封闭判定：`required` 必须全部出现，且出现的键只能是 required ∪ optional。
 *
 * 这是浏览器边界的安全属性——Host 或中心多塞任何一个字段（Token、artifact 路径、正文）
 * 都必须整条判失败，而不是悄悄透传进界面。
 */
export function hasExactKeys(value: JsonRecord, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value)
  return required.every(key => keys.includes(key))
    && keys.every(key => required.includes(key) || optional.includes(key))
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

const RFC_3339_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

export function timestamp(value: unknown): value is string {
  return nonEmptyString(value) && value.length <= 64
    && RFC_3339_PATTERN.test(value) && Number.isFinite(Date.parse(value))
}

export function nullableTimestamp(value: unknown): value is string | null {
  return value === null || timestamp(value)
}

/** 服务端雪花 ID 一律以十进制字符串过桥；前导零、负数与超 19 位都不是本仓 ID。 */
export function enterpriseId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value)
}
