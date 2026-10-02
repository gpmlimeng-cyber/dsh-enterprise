/**
 * [INPUT]: 依赖 lib/errors 的唯一取文函数。
 * [OUTPUT]: 锁定 errorMessage 的三级优先序——企业错误信封 message > Error 实例消息 > 调用方兜底。
 * [POS]: lib 的错误取文门禁；守护后台 21 张表格不再因为“只认 instanceof Error”而丢掉服务端 message。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

describe('errorMessage（后台唯一取文）', () => {
  it('优先取企业错误信封里的服务端 message（纯对象，不是 Error 实例）', () => {
    expect(errorMessage(
      { error: { code: 'ENT_PLUGIN_ASSIGNMENT_UPDATE_FAILED', message: '可见范围冲突' } },
      'ENT_PLUGIN_ASSIGNMENT_UPDATE_FAILED'
    )).toBe('可见范围冲突');
  });

  it('回落真正的 Error 实例消息（本地 throw 与网络层错误）', () => {
    expect(errorMessage(new Error('网络中断'), '暂时无法读取数据')).toBe('网络中断');
  });

  it('再回落调用方兜底：空信封 / 空消息 / 非对象 / undefined', () => {
    expect(errorMessage({ error: {} }, '兜底')).toBe('兜底');
    expect(errorMessage({ error: { message: '' } }, '兜底')).toBe('兜底');
    expect(errorMessage(new Error(''), '兜底')).toBe('兜底');
    expect(errorMessage('boom', '兜底')).toBe('兜底');
    expect(errorMessage(undefined, '兜底')).toBe('兜底');
    expect(errorMessage(null, '兜底')).toBe('兜底');
  });
});
