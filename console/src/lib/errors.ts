/**
 * [INPUT]: 依赖生成 API 的企业错误信封类型 EnterpriseErrorResponse。
 * [OUTPUT]: 提供后台唯一的错误取文函数 errorMessage，把服务端错误信封转成人话并回落调用方兜底。
 * [POS]: lib 的错误取文单点；后台所有失败文案必须走这里，禁止任何功能文件再本地复制同义函数。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseErrorResponse } from '@/api/generated/types.gen';

/**
 * 从服务端错误信封里取出可行动的人话，顺序即优先级：
 * ① 生成客户端对企业端错误抛的是纯对象 `{ error: { code, message } }`（`client.gen.ts` 的
 *    `throw jsonError ?? textError`），既不是 Error 实例也没有顶层 message，所以必须先认 `error.error.message`；
 * ② 再回落真正的 Error 实例消息（本地 throw、网络层错误）；
 * ③ 最后才是调用方给的稳定码兜底。
 * 只认 `instanceof Error` 会让企业端错误恒假、服务端中文 message 被静默丢弃（后台 21 张表格曾因此全部退化成兜底）。
 */
export function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'error' in error) {
    const payload = (error as EnterpriseErrorResponse).error;
    if (payload?.message) return payload.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
