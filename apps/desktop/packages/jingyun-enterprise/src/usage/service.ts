/**
 * [INPUT]: 依赖 protocol/types 的配额用量窄类型、protocol/http 的 EnterpriseRequestInit 与 envelope 的错误构造
 * [OUTPUT]: 对外提供 QuotaWindowView/QuotaPolicyView/toQuotaPolicyViews 与 EnterpriseUsageService.me
 * [POS]: usage 的唯一取数入口：把中心 usage/me 响应投影成 UI 可渲染的四窗口视图，不做任何配额裁决
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { EnterprisePlatformError } from '../protocol/envelope.js';
import type { EnterpriseRequestInit } from '../protocol/http.js';
import type {
  EnterpriseQuotaUsagePolicy,
  EnterpriseTokenWindowUsage,
} from '../protocol/types.js';

/** `GET /enterprise/api/v1/usage/me`；四窗口 token 用量的唯一端点。 */
export const ENTERPRISE_USAGE_ME_PATH = '/enterprise/api/v1/usage/me';

/** 四个自然窗口的稳定键与显示顺序；顺序即 UI 顺序，不得按数据存在性重排。 */
const WINDOW_KEYS = ['fiveHours', 'daily', 'weekly', 'monthly'] as const;

export type QuotaWindowKey = (typeof WINDOW_KEYS)[number];

/** 窗口中文标签；用词固定为「5 小时 / 日 / 周 / 月」，与中心窗口语义一一对应。 */
const WINDOW_LABELS: Readonly<Record<QuotaWindowKey, string>> = {
  fiveHours: '5 小时',
  daily: '日',
  weekly: '周',
  monthly: '月',
};

export interface QuotaWindowView {
  key: QuotaWindowKey;
  label: string;
  limit: number | null;
  usedTokens: number;
  reservedTokens: number;
  resetsAt: string | null;
  percent: number | null;
  exhausted: boolean;
}

export interface QuotaPolicyView {
  policyId: string;
  name: string;
  scope: string;
  resourceType: string;
  resourceName: string;
  windows: QuotaWindowView[];
}

/** 百分比：无上限或非法上限时不给数字，避免 UI 出现 Infinity/NaN；上限内保留一位小数并封顶 100。 */
function toPercent(usedTokens: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(100, Math.round((usedTokens / limit) * 1000) / 10);
}

/** 耗尽判定用的是「已用 + 已预留」：预留代表在途请求已经占住的额度。 */
function isExhausted(
  usedTokens: number,
  reservedTokens: number,
  limit: number | null
): boolean {
  return limit !== null && usedTokens + reservedTokens >= limit;
}

function toWindowView(
  key: QuotaWindowKey,
  window: EnterpriseTokenWindowUsage
): QuotaWindowView {
  return {
    key,
    label: WINDOW_LABELS[key],
    limit: window.limit,
    usedTokens: window.usedTokens,
    reservedTokens: window.reservedTokens,
    resetsAt: window.resetsAt,
    percent: toPercent(window.usedTokens, window.limit),
    exhausted: isExhausted(
      window.usedTokens,
      window.reservedTokens,
      window.limit
    ),
  };
}

/**
 * 纯投影：策略 → 视图。
 *
 * 不变量：窗口为 null 时**不产出**该窗口（中心只返回生效窗口，UI 不得补零造成「有额度」的错觉）；
 * 不产出 rpm/concurrency——速率类限制是请求级拒绝，不属于 token 配额展示。
 * 入参顺序即输出顺序。
 */
export function toQuotaPolicyViews(
  policies: readonly EnterpriseQuotaUsagePolicy[]
): QuotaPolicyView[] {
  return policies.map((policy) => {
    const windows: QuotaWindowView[] = [];
    for (const key of WINDOW_KEYS) {
      const window = policy[key];
      if (window === null || window === undefined) continue;
      windows.push(toWindowView(key, window));
    }
    return {
      policyId: policy.policyId,
      name: policy.name,
      scope: policy.scope,
      resourceType: policy.resourceType,
      resourceName: policy.resourceName ?? '',
      windows,
    };
  });
}

/**
 * 取数依赖：**只**要求一个 request 方法。
 *
 * 调用时以 deps 自身为接收者，因此可以直接传入 `EnterpriseHttpClient` 实例
 * （它已负责 Bearer 注入、超时、401 单次续期与信封解包），业务层不再出现第二个 HTTP 出口。
 */
export interface EnterpriseUsageServiceDeps {
  request<T>(path: string, init?: EnterpriseRequestInit): Promise<T>;
}

/** 企业用量与配额查询；所有失败以 EnterprisePlatformError 码上抛，由路由层折叠为 UI 文案。 */
export class EnterpriseUsageService {
  private readonly deps: EnterpriseUsageServiceDeps;

  constructor(deps: EnterpriseUsageServiceDeps) {
    this.deps = deps;
  }

  /** 本人生效策略的实时用量；返回空数组表示中心没有生效配额，而不是错误。 */
  async me(signal?: AbortSignal): Promise<QuotaPolicyView[]> {
    const data = await this.deps.request<readonly EnterpriseQuotaUsagePolicy[]>(
      ENTERPRISE_USAGE_ME_PATH,
      signal === undefined ? {} : { signal }
    );
    if (!Array.isArray(data)) {
      throw new EnterprisePlatformError(
        'ENT_RESPONSE_INVALID',
        '企业用量响应不是策略数组'
      );
    }
    return toQuotaPolicyViews(data);
  }
}
