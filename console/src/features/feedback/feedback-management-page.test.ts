/**
 * [INPUT]: 依赖 features/feedback 的纯投影 helper 与生成的状态枚举。
 * [OUTPUT]: 锁定冻结分诊链路的前端下一步集合，以及处置请求只提交目标状态与去空白备注。
 * [POS]: features/feedback 的状态动作契约门禁，不启动浏览器与网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest';
import { FEEDBACK_SECTIONS, nextStatuses, statusChangeBody } from './feedback-management-page';

describe('nextStatuses', () => {
  it('mirrors the frozen server chain instead of offering free transitions', () => {
    expect(nextStatuses('new')).toEqual(['triaged']);
    expect(nextStatuses('triaged')).toEqual(['resolved', 'ignored']);
    expect(nextStatuses('resolved')).toEqual([]);
    expect(nextStatuses('ignored')).toEqual([]);
  });

  it('keeps one segment per server status filter plus the unfiltered default', () => {
    expect(FEEDBACK_SECTIONS).toEqual(['全部', '待分诊', '已分诊', '已解决', '已忽略']);
  });
});

describe('statusChangeBody', () => {
  it('sends only the target status and normalizes a blank note to null', () => {
    expect(statusChangeBody('triaged', '  已确认复现  ')).toEqual({ status: 'triaged', note: '已确认复现' });
    expect(statusChangeBody('resolved', '   ')).toEqual({ status: 'resolved', note: null });
    expect(statusChangeBody('ignored', '')).toEqual({ status: 'ignored', note: null });
    expect(Object.keys(statusChangeBody('triaged', 'x')).sort()).toEqual(['note', 'status']);
  });
});
