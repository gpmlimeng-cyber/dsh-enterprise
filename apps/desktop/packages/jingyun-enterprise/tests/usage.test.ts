/**
 * [INPUT]: 依赖 node:fs 读取契约 fixture 与 vitest；依赖 src/usage/service 的投影与取数服务、protocol 的窄类型
 * [OUTPUT]: 对外提供 E3 验收断言：四窗口视图映射、percent/exhausted 边界、窗口 null 不产出、usage/me 端点与错误折叠
 * [POS]: tests 的 E3 裁判面，用 contracts 真源 fixture 校验投影公式，不依赖网络与宿主
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { EnterprisePlatformError } from '../src/protocol/envelope.js';
import type { EnterpriseRequestInit } from '../src/protocol/http.js';
import type {
  EnterpriseQuotaUsagePolicy,
  EnterpriseTokenWindowUsage,
} from '../src/protocol/types.js';
import {
  ENTERPRISE_USAGE_ME_PATH,
  EnterpriseUsageService,
  toQuotaPolicyViews,
} from '../src/usage/service.js';

// ---------- fixture 与构造器 ----------

const USAGE_FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/quota-usage-me-success.json', import.meta.url),
    'utf8'
  )
) as { data: EnterpriseQuotaUsagePolicy[] };

function windowUsage(
  overrides: Partial<EnterpriseTokenWindowUsage> = {}
): EnterpriseTokenWindowUsage {
  return {
    limit: 1000,
    usedTokens: 100,
    reservedTokens: 0,
    resetsAt: '2026-08-19T00:00:00+08:00',
    ...overrides,
  };
}

function policy(
  overrides: Partial<EnterpriseQuotaUsagePolicy> = {}
): EnterpriseQuotaUsagePolicy {
  return {
    policyId: '1900100000000000002',
    name: 'Default',
    scope: 'ORGANIZATION',
    subjectId: null,
    resourceType: 'ALL_MODELS',
    resourceId: null,
    resourceName: '全部模型',
    fiveHours: null,
    daily: null,
    weekly: null,
    monthly: null,
    ...overrides,
  };
}

// ---------- 投影：契约 fixture ----------

describe('toQuotaPolicyViews（契约 fixture）', () => {
  const views = toQuotaPolicyViews(USAGE_FIXTURE.data);

  it('逐条映射策略并保持服务端顺序', () => {
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({
      policyId: '1900100000000000002',
      name: 'Default',
      scope: 'ORGANIZATION',
      resourceType: 'ALL_MODELS',
      resourceName: '全部模型',
    });
  });

  it('四窗口按固定顺序产出中文标签与用量', () => {
    const windows = views[0]?.windows ?? [];
    expect(windows.map((window) => window.key)).toEqual([
      'fiveHours',
      'daily',
      'weekly',
      'monthly',
    ]);
    expect(windows.map((window) => window.label)).toEqual([
      '5 小时',
      '日',
      '周',
      '月',
    ]);
    expect(windows[0]).toEqual({
      key: 'fiveHours',
      label: '5 小时',
      limit: 200000,
      usedTokens: 12000,
      reservedTokens: 1024,
      resetsAt: '2026-08-18T20:00:00+08:00',
      percent: 6,
      exhausted: false,
    });
    // 公式 Math.round(used/limit*1000)/10：monthly = round(0.0125*1000)/10 = 1.3
    expect(windows[3]).toMatchObject({
      key: 'monthly',
      percent: 1.3,
      exhausted: false,
    });
    // 与集成断言对齐：daily = 12000/1000000 → 1.2%
    expect(windows[1]).toMatchObject({
      key: 'daily',
      limit: 1_000_000,
      usedTokens: 12_000,
      percent: 1.2,
      exhausted: false,
    });
  });

  it('窗口为 null 时不产出该窗口', () => {
    const sparse = toQuotaPolicyViews([
      policy({ daily: windowUsage(), monthly: windowUsage() }),
    ]);
    expect(sparse[0]?.windows.map((window) => window.key)).toEqual([
      'daily',
      'monthly',
    ]);
    expect(toQuotaPolicyViews([policy()])[0]?.windows).toEqual([]);
  });

  it('resourceName 缺失时降级为空串而不是渲染 null', () => {
    const viewsWithNullName = toQuotaPolicyViews([
      policy({ resourceName: null as unknown as string }),
    ]);
    expect(viewsWithNullName[0]?.resourceName).toBe('');
  });

  it('空输入返回空数组，且不改写入参', () => {
    const input = [policy({ fiveHours: windowUsage() })];
    const snapshot = JSON.stringify(input);
    expect(toQuotaPolicyViews([])).toEqual([]);
    toQuotaPolicyViews(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

// ---------- percent 与 exhausted 边界 ----------

describe('percent 边界', () => {
  function percentOf(usedTokens: number, limit: number | null): number | null {
    const view = toQuotaPolicyViews([
      policy({ daily: windowUsage({ usedTokens, limit }) }),
    ]);
    return view[0]?.windows[0]?.percent ?? null;
  }

  it('limit 为 0 或 null 或负数时不产出百分比', () => {
    expect(percentOf(500, 0)).toBeNull();
    expect(percentOf(500, null)).toBeNull();
    expect(percentOf(500, -1)).toBeNull();
  });

  it('保留一位小数并封顶 100', () => {
    expect(percentOf(0, 1000)).toBe(0);
    expect(percentOf(1, 1000)).toBe(0.1);
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(999, 1000)).toBe(99.9);
    expect(percentOf(1000, 1000)).toBe(100);
    expect(percentOf(2500, 1000)).toBe(100);
  });

  it('无上限时 limit 原样透出，便于 UI 展示「不限」', () => {
    const view = toQuotaPolicyViews([
      policy({ daily: windowUsage({ limit: null }) }),
    ]);
    expect(view[0]?.windows[0]).toMatchObject({
      limit: null,
      percent: null,
      exhausted: false,
    });
  });
});

describe('exhausted 边界', () => {
  function exhaustedOf(
    usedTokens: number,
    reservedTokens: number,
    limit: number | null
  ): boolean {
    const view = toQuotaPolicyViews([
      policy({ daily: windowUsage({ usedTokens, reservedTokens, limit }) }),
    ]);
    return view[0]?.windows[0]?.exhausted ?? false;
  }

  it('已用加预留达到或超过上限即耗尽', () => {
    expect(exhaustedOf(1000, 0, 1000)).toBe(true);
    expect(exhaustedOf(999, 1, 1000)).toBe(true);
    expect(exhaustedOf(1200, 0, 1000)).toBe(true);
    expect(exhaustedOf(999, 0, 1000)).toBe(false);
    expect(exhaustedOf(0, 0, 1000)).toBe(false);
  });

  it('无上限永不耗尽', () => {
    expect(exhaustedOf(10_000_000, 10_000_000, null)).toBe(false);
  });

  it('limit 为 0 时按公式判定为耗尽（用量必然 >= 0）', () => {
    expect(exhaustedOf(0, 0, 0)).toBe(true);
  });
});

// ---------- EnterpriseUsageService.me ----------

interface RequestObservation {
  path: string;
  init: EnterpriseRequestInit | undefined;
  receiver: unknown;
}

class FakeHttpClient {
  readonly observations: RequestObservation[] = [];
  payload: unknown = USAGE_FIXTURE.data;

  async request<T>(path: string, init?: EnterpriseRequestInit): Promise<T> {
    this.observations.push({ path, init, receiver: this });
    return this.payload as T;
  }
}

describe('EnterpriseUsageService.me', () => {
  it('打 usage/me 端点并投影为四窗口视图', async () => {
    const http = new FakeHttpClient();
    const service = new EnterpriseUsageService(http);
    const views = await service.me();

    expect(http.observations.map((observation) => observation.path)).toEqual([
      ENTERPRISE_USAGE_ME_PATH,
    ]);
    expect(ENTERPRISE_USAGE_ME_PATH).toBe('/enterprise/api/v1/usage/me');
    expect(views).toHaveLength(1);
    expect(views[0]?.windows.map((window) => window.key)).toEqual([
      'fiveHours',
      'daily',
      'weekly',
      'monthly',
    ]);
  });

  it('透传 AbortSignal 且以 deps 自身为接收者调用 request', async () => {
    const http = new FakeHttpClient();
    const service = new EnterpriseUsageService(http);
    const controller = new AbortController();
    await service.me(controller.signal);

    const observation = http.observations[0];
    expect(observation?.init?.signal).toBe(controller.signal);
    expect(observation?.receiver).toBe(http);
  });

  it('响应不是数组时折叠为 ENT_RESPONSE_INVALID', async () => {
    const http = new FakeHttpClient();
    http.payload = { data: [] };
    const service = new EnterpriseUsageService(http);

    await expect(service.me()).rejects.toBeInstanceOf(EnterprisePlatformError);
    await expect(service.me()).rejects.toMatchObject({
      code: 'ENT_RESPONSE_INVALID',
    });
  });

  it('中心返回空策略列表时得到空数组而不是错误', async () => {
    const http = new FakeHttpClient();
    http.payload = [];
    const service = new EnterpriseUsageService(http);
    await expect(service.me()).resolves.toEqual([]);
  });

  it('平台错误原样上抛给路由层折叠', async () => {
    const failing = {
      async request<T>(): Promise<T> {
        throw new EnterprisePlatformError(
          'ENT_QUOTA_DAILY_EXCEEDED',
          '配额已用尽',
          {
            retryable: false,
          }
        );
      },
    };
    const service = new EnterpriseUsageService(failing);
    await expect(service.me()).rejects.toMatchObject({
      code: 'ENT_QUOTA_DAILY_EXCEEDED',
      retryable: false,
    });
  });
});
