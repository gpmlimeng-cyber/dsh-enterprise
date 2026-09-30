/**
 * [INPUT]: 依赖 react 的 hooks/JSX、dsh-client-runtime 的 ClientContext、ui-primitives 的 StateDot、client/messages 的文案真源、client/panels 的三块面板，以及 routes/index 的响应 DTO（仅 type-only，编译期擦除）
 * [OUTPUT]: 对外提供 apply/inject 插槽装配、enterpriseApi 本地取数口、useEnterpriseStatus 与共用的面板骨架组件
 * [POS]: 客户端半入口；与 jingyun-dsh/src/client/index.tsx 同构（inject + apply + slots.register），只经 fetch 读本机状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives';
// 仅引入 settings 域的 SlotMap 声明（settings.section 的类型真源），编译期擦除，不进浏览器包
import type {} from '@deepseek-ai/dsh-client-ui-settings-general/client';
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import type { EnterprisePlatformStatus } from '../protocol/types.js';
import type {
  EnterpriseMarketView,
  EnterpriseRouteMarketEntry,
  EnterpriseRouteQuotaPolicy,
} from '../routes/index.js';
import {
  describeEnterpriseError,
  describeEnterpriseState,
  describeEnterpriseStateTone,
  isTransientEnterpriseState,
} from './messages.js';
import { EnterpriseMarketPanel } from './panels/EnterpriseMarketPanel.js';
import { EnterpriseSettingsPanel } from './panels/EnterpriseSettingsPanel.js';
import { EnterpriseUsagePanel } from './panels/EnterpriseUsagePanel.js';

/** 本地 UI 唯一允许访问的路由前缀；客户端从不直连企业中心。 */
export const ENTERPRISE_API_PREFIX = '/api/jingyun/enterprise';

/** 过渡态轮询间隔；只在登录/刷新途中查询，闲置时零轮询、零 SSE。 */
const TRANSIENT_POLL_INTERVAL_MS = 1500;

/** 只此一个依赖：槽位注册能力（其余状态全部经本机 HTTP 路由读取）。 */
export const inject = ['slots'];

/** 成功结果。 */
export interface EnterpriseApiOk<T> {
  readonly ok: true;
  readonly data: T;
}

/** 失败结果：只携带稳定错误码，文案由 messages.ts 统一翻译。 */
export interface EnterpriseApiFail {
  readonly ok: false;
  readonly code: string;
}

export type EnterpriseApiResult<T> = EnterpriseApiOk<T> | EnterpriseApiFail;

/** 只接受契约形状的错误码，杜绝把服务端任意字符串带进 UI。 */
const ERROR_CODE_PATTERN = /^ENT_[A-Z0-9_]{2,64}$/;

function readStringField(payload: unknown, field: string): string | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload))
    return null;
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
}

/** 从失败信封中提取稳定码；形状不符或非契约形状一律返回 null。 */
function readErrorCode(payload: unknown): string | null {
  const code = readStringField(payload, 'error');
  return code !== null && ERROR_CODE_PATTERN.test(code) ? code : null;
}

/**
 * 访问本机企业路由；永不抛异常，失败折叠为稳定码。
 * 不读写任何 localStorage/sessionStorage，不触碰令牌——令牌只存在于 Host 内存。
 */
export async function enterpriseApi<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown }
): Promise<EnterpriseApiResult<T>> {
  const body = init?.body === undefined ? undefined : JSON.stringify(init.body);
  try {
    const response = await fetch(`${ENTERPRISE_API_PREFIX}${path}`, {
      method: init?.method ?? 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body }),
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, code: 'ENT_RESPONSE_INVALID' };
    }

    if (!response.ok) {
      return { ok: false, code: readErrorCode(payload) ?? 'ENT_NETWORK_ERROR' };
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      (payload as { success?: unknown }).success !== true
    ) {
      return {
        ok: false,
        code: readErrorCode(payload) ?? 'ENT_RESPONSE_INVALID',
      };
    }
    if (!('data' in payload)) {
      return { ok: false, code: 'ENT_RESPONSE_INVALID' };
    }
    return { ok: true, data: (payload as { data: T }).data };
  } catch {
    return { ok: false, code: 'ENT_NETWORK_ERROR' };
  }
}

/** 状态查询结果；loading 只在首次/手动刷新时为 true，后台轮询不打扰界面。 */
export interface EnterpriseStatusQuery {
  status: EnterprisePlatformStatus | null;
  errorCode: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** 读取本地企业连接状态；过渡态自动轻量轮询，终态立即停表。 */
export function useEnterpriseStatus(): EnterpriseStatusQuery {
  const [status, setStatus] = useState<EnterprisePlatformStatus | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent: boolean): Promise<void> => {
    if (!silent) setLoading(true);
    const result = await enterpriseApi<EnterprisePlatformStatus>('/status');
    if (result.ok) {
      setStatus(result.data);
      setErrorCode(null);
    } else {
      setErrorCode(result.code);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const transient = isTransientEnterpriseState(status?.state);
  useEffect(() => {
    if (!transient) return undefined;
    const timer = setInterval(() => {
      void load(true);
    }, TRANSIENT_POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [transient, load]);

  const reload = useCallback(async (): Promise<void> => {
    await load(false);
  }, [load]);

  return { status, errorCode, loading, reload };
}

/** 面板骨架：统一标题/提示排版，避免三块面板各写一份容器样式。 */
export function EnterpriseSection(props: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '4px 2px',
        fontSize: '13px',
        color: 'var(--dsw-alias-label-primary)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
          {props.title}
        </h3>
        {props.hint === undefined ? null : (
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: 'var(--dsw-alias-label-tertiary)',
            }}
          >
            {props.hint}
          </p>
        )}
      </header>
      {props.children}
    </section>
  );
}

/** 错误提示：入参是稳定码，渲染的是本包文案表里的中文。 */
export function EnterpriseErrorNotice(props: {
  code: string | null;
  extra?: ReactNode;
}) {
  if (props.code === null) return null;
  return (
    <div
      role="alert"
      style={{
        border: '1px solid var(--dsw-alias-state-error-primary)',
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        color: 'var(--dsw-alias-state-error-primary)',
      }}
    >
      {describeEnterpriseError(props.code)}
      {props.extra === undefined ? null : (
        <div style={{ marginTop: '4px' }}>{props.extra}</div>
      )}
    </div>
  );
}

/** 状态行：状态点 + 中文状态 + 可选错误码文案。 */
export function EnterpriseStatusLine(props: {
  status: EnterprisePlatformStatus | null;
  errorCode: string | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <StateDot
          state={describeEnterpriseStateTone(props.status?.state)}
          size={8}
        />
        <span>{describeEnterpriseState(props.status?.state)}</span>
        {props.status?.platformUrl ? (
          <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>
            · {props.status.platformUrl}
          </span>
        ) : null}
      </div>
      {props.errorCode === null ? null : (
        <span
          style={{
            color: 'var(--dsw-alias-state-error-primary)',
            fontSize: '12px',
          }}
        >
          {describeEnterpriseError(props.errorCode)}
        </span>
      )}
    </div>
  );
}

/** 注册一块设置分区：等待 settings.section 声明后落位，并交回 disposer 以便宿主卸载时回收。 */
function registerSettingsSection(
  ctx: ClientContext,
  options: { id: string; order: number; label: string },
  component: () => ReactElement | null
): void {
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: options.id,
        order: options.order,
        label: options.label,
      },
      component
    )
  );
}

/** DSH Web 客户端入口：注册企业设置、用量与配额、企业市场三块设置页。 */
export function apply(ctx: ClientContext): void {
  registerSettingsSection(
    ctx,
    { id: 'jingyun-enterprise', order: 60, label: '企业版' },
    () => <EnterpriseSettingsPanel />
  );
  registerSettingsSection(
    ctx,
    { id: 'jingyun-enterprise-usage', order: 61, label: '用量与配额' },
    () => <EnterpriseUsagePanel />
  );
  registerSettingsSection(
    ctx,
    { id: 'jingyun-enterprise-market', order: 62, label: '企业市场' },
    () => <EnterpriseMarketPanel />
  );
}

export type {
  EnterpriseMarketView,
  EnterpriseRouteMarketEntry,
  EnterpriseRouteQuotaPolicy,
};
