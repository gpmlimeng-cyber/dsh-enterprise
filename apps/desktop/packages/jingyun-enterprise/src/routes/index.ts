/**
 * [INPUT]: 依赖 protocol/envelope 的 EnterprisePlatformError（失败码折叠）、protocol/types 的报文窄类型、routes/guard 的同源判定
 * [OUTPUT]: 对外提供 EnterpriseRouteDeps 依赖端口与 registerEnterpriseRoutes（/api/jingyun/enterprise/* 九个端点）
 * [POS]: 本地 UI 与 Host 之间唯一的 HTTP 契约层；只做鉴权、取参与信封收口，业务语义全部留在 platform/usage/market
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import { EnterprisePlatformError } from '../protocol/envelope.js';
import type { EnterpriseClientErrorCode } from '../protocol/error-codes.js';
import type {
  EnterpriseBootstrapSnapshot,
  EnterpriseLoginFlow,
  EnterprisePlatformStatus,
  EnterprisePluginAssignment,
} from '../protocol/types.js';
import { checkEnterpriseRequestOrigin } from './guard.js';

/** 所有端点的公共前缀；客户端半只允许访问此前缀。 */
export const ENTERPRISE_ROUTE_PREFIX = '/api/jingyun/enterprise';

/** 请求体上限：九个端点里最大的载荷是服务地址与包名，64 KiB 已是量级冗余。 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * 结构化的控制面端口（对应 INTERFACES §2 EnterpriseControlPlane 的客户端子集）。
 * 这里刻意用结构类型而不是 import class：platform/ 由并行实现落地，端口按契约签名声明后
 * 真实实现可被结构赋值自动满足，同时避免 routes 反依赖未落地模块。
 */
export interface EnterpriseRoutePlatformPort {
  status(): EnterprisePlatformStatus;
  bootstrap(): EnterpriseBootstrapSnapshot | undefined;
  setServerUrl(url: string): Promise<{ serverUrl: string }>;
  startLogin(): Promise<EnterpriseLoginFlow>;
  refresh(): Promise<EnterprisePlatformStatus>;
  logout(): Promise<void>;
}

/** 对应 INTERFACES §5 的 QuotaWindowView（结构镜像，避免反向依赖未落地模块）。 */
export interface EnterpriseRouteQuotaWindow {
  key: 'fiveHours' | 'daily' | 'weekly' | 'monthly';
  label: string;
  limit: number | null;
  usedTokens: number;
  reservedTokens: number;
  resetsAt: string | null;
  percent: number | null;
  exhausted: boolean;
}

/** 对应 INTERFACES §5 的 QuotaPolicyView。 */
export interface EnterpriseRouteQuotaPolicy {
  policyId: string;
  name: string;
  scope: string;
  resourceType: string;
  resourceName: string;
  windows: EnterpriseRouteQuotaWindow[];
}

/** 用量端口（对应 §5 EnterpriseUsageService）。 */
export interface EnterpriseRouteUsagePort {
  me(signal?: AbortSignal): Promise<EnterpriseRouteQuotaPolicy[]>;
}

/** 对应 INTERFACES §4 assignments.ts 的 InstalledPluginFact。 */
export interface EnterpriseRouteInstalledFact {
  version: string;
  sha256: string;
}

/** 对应 INTERFACES §4 assignments.ts 的 MarketEntry。 */
export interface EnterpriseRouteMarketEntry {
  assignment: EnterprisePluginAssignment;
  installed: EnterpriseRouteInstalledFact | null;
  action: 'INSTALL' | 'UPGRADE' | 'UNINSTALL' | 'NONE';
  blockedReason?: string;
}

/**
 * 市场端口（对应 §4 installer/assignments 的对外动作面）。
 * `installEnabled` 是可选的**只读**能力：仅用于让 UI 进入只读态；真正的强制点在 installer 内部，
 * 因此缺席时按契约默认值 true 呈现，绝不由路由自行放行安装。
 */
export interface EnterpriseRouteMarketPort {
  list(): EnterpriseRouteMarketEntry[];
  plan(): Promise<EnterpriseRouteMarketEntry[]>;
  apply(packageName?: string): Promise<unknown>;
  readonly installEnabled?: boolean;
}

/** 宿主日志面；只接收已脱敏的短句（绝不传令牌、口令或响应正文）。 */
export interface EnterpriseRouteLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface EnterpriseRouteDeps {
  platform: EnterpriseRoutePlatformPort;
  usage: EnterpriseRouteUsagePort;
  market: EnterpriseRouteMarketPort;
  logger: EnterpriseRouteLogger;
}

/** registerEnterpriseRoutes 的最小宿主面；等价于 INTERFACES §6 的 ctx.webServer.register 签名。 */
export interface EnterpriseRouteHandlerContext {
  readonly webServer: {
    register(route: {
      kind: 'exact';
      path: string;
      handler: (
        req: IncomingMessage,
        res: ServerResponse
      ) => Promise<void> | void;
    }): void;
  };
}

type EnterpriseRouteHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> | void;

/** 本地失败码到 HTTP 状态的收敛表；未列出的码走 500，只有码本身回传客户端。 */
const LOCAL_STATUS: Partial<Record<EnterpriseClientErrorCode, number>> = {
  ENT_INVALID_REQUEST: 400,
  ENT_SERVER_URL_INVALID: 400,
  ENT_AUTH_REQUIRED: 401,
  ENT_PERMISSION_DENIED: 403,
  ENT_REQUEST_TOO_LARGE: 413,
  ENT_PLUGIN_ARCHIVE_TOO_LARGE: 413,
  ENT_PRESET_TOO_LARGE: 413,
  ENT_SESSION_BATCH_TOO_LARGE: 413,
  ENT_RESPONSE_INVALID: 502,
  ENT_NETWORK_ERROR: 502,
  ENT_PLATFORM_UNAVAILABLE: 503,
  ENT_PLATFORM_DISPOSED: 503,
  ENT_AUTH_TIMEOUT: 504,
};

/** 把任意抛出物收敛为「状态码 + 客户端错误码」，绝不把原始 message 回传。 */
function toFailure(cause: unknown): {
  status: number;
  code: EnterpriseClientErrorCode;
} {
  if (cause instanceof EnterprisePlatformError) {
    const httpStatus = cause.httpStatus;
    const status =
      typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus <= 599
        ? httpStatus
        : (LOCAL_STATUS[cause.code] ?? 500);
    return { status, code: cause.code };
  }
  return { status: 500, code: 'ENT_NETWORK_ERROR' };
}

/** 写 JSON 响应；任何写入异常都吞掉，绝不冒泡到 Cordis 顶层。 */
function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  try {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(status, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(payload));
  } catch {
    // 连接已被对端关闭：无处可写，也不允许影响宿主
  }
}

/** 成功信封：`{ success: true, data }`。 */
function sendSuccess(res: ServerResponse, data: unknown): void {
  sendJson(res, 200, { success: true, data });
}

/** 失败信封：`{ success: false, error }`，error 恒为稳定错误码字符串（与 jingyun sendError 同形）。 */
function sendFailure(
  res: ServerResponse,
  status: number,
  code: EnterpriseClientErrorCode
): void {
  sendJson(res, status, { success: false, error: code });
}

/** 读取 JSON 请求体：空体视为 `{}`；超限/非 JSON 分别抛稳定错误码。 */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const fail = (code: EnterpriseClientErrorCode): void => {
      if (settled) return;
      settled = true;
      reject(new EnterprisePlatformError(code, '请求体不可用'));
    };

    req.on('data', (chunk: Buffer | string) => {
      if (settled) return;
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        fail('ENT_REQUEST_TOO_LARGE');
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (text.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(
          new EnterprisePlatformError(
            'ENT_INVALID_REQUEST',
            '请求体不是合法 JSON'
          )
        );
      }
    });
    req.on('error', () => fail('ENT_INVALID_REQUEST'));
    req.on('close', () => fail('ENT_INVALID_REQUEST'));
  });
}

/** 取必填字符串字段；类型不符或空串抛 ENT_INVALID_REQUEST。 */
function requireStringField(payload: unknown, field: string): string {
  const value = readOptionalStringField(payload, field);
  if (value === undefined) {
    throw new EnterprisePlatformError(
      'ENT_INVALID_REQUEST',
      `缺少字段 ${field}`
    );
  }
  return value;
}

/** 取可选字符串字段；存在但类型不符或空串同样视为非法。 */
function readOptionalStringField(
  payload: unknown,
  field: string
): string | undefined {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new EnterprisePlatformError(
      'ENT_INVALID_REQUEST',
      '请求体必须是 JSON 对象'
    );
  }
  const raw = (payload as Record<string, unknown>)[field];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') {
    throw new EnterprisePlatformError(
      'ENT_INVALID_REQUEST',
      `字段 ${field} 必须是字符串`
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new EnterprisePlatformError(
      'ENT_INVALID_REQUEST',
      `字段 ${field} 不能为空`
    );
  }
  return trimmed;
}

/** 市场列表统一形状：条目 + 是否允许动作（UI 只读态依据）。 */
export interface EnterpriseMarketView {
  entries: EnterpriseRouteMarketEntry[];
  marketInstallEnabled: boolean;
}

/** 组装一条带鉴权、方法约束与结构化错误收口的端点。 */
function registerEndpoint(
  ctx: EnterpriseRouteHandlerContext,
  deps: EnterpriseRouteDeps,
  method: 'GET' | 'POST',
  path: string,
  handler: EnterpriseRouteHandler
): void {
  const fullPath = `${ENTERPRISE_ROUTE_PREFIX}${path}`;
  const wrapped: EnterpriseRouteHandler = async (req, res) => {
    try {
      const decision = checkEnterpriseRequestOrigin({
        method: req.method,
        headers: req.headers,
      });
      if (!decision.allowed) {
        // 只记录内部原因，响应体仅给稳定码，避免探测者获得边界细节
        deps.logger.warn(
          `[enterprise] 拒绝来源不可信请求 ${method} ${fullPath}（${decision.reason}）`
        );
        sendFailure(res, 403, 'ENT_PERMISSION_DENIED');
        return;
      }
      if ((req.method ?? '').toUpperCase() !== method) {
        sendFailure(res, 405, 'ENT_INVALID_REQUEST');
        return;
      }
      await handler(req, res);
    } catch (cause) {
      const failure = toFailure(cause);
      deps.logger.error(
        `[enterprise] ${method} ${fullPath} 失败：${failure.code}`
      );
      sendFailure(res, failure.status, failure.code);
    }
  };
  ctx.webServer.register({ kind: 'exact', path: fullPath, handler: wrapped });
}

/**
 * 注册企业本地路由。九个端点全部经过同源判定（GET 也校验），失败一律 403 + 稳定码。
 * 依赖通过端口注入，测试可用假对象替换 platform/usage/market。
 */
export function registerEnterpriseRoutes(
  ctx: EnterpriseRouteHandlerContext,
  deps: EnterpriseRouteDeps
): void {
  // ── 连接状态机 ────────────────────────────────────────────────
  registerEndpoint(ctx, deps, 'GET', '/status', (_req, res) => {
    sendSuccess(res, deps.platform.status());
  });

  registerEndpoint(ctx, deps, 'POST', '/server-url', async (req, res) => {
    const payload = await readJsonBody(req);
    const serverUrl = requireStringField(payload, 'serverUrl');
    const updated = await deps.platform.setServerUrl(serverUrl);
    deps.logger.info('[enterprise] 服务地址已更新');
    sendSuccess(res, {
      serverUrl: updated.serverUrl,
      status: deps.platform.status(),
    });
  });

  registerEndpoint(ctx, deps, 'POST', '/login', async (_req, res) => {
    const flow = await deps.platform.startLogin();
    deps.logger.info('[enterprise] 登录流程已启动');
    sendSuccess(res, flow);
  });

  registerEndpoint(ctx, deps, 'POST', '/logout', async (_req, res) => {
    await deps.platform.logout();
    deps.logger.info('[enterprise] 已退出企业登录');
    sendSuccess(res, deps.platform.status());
  });

  registerEndpoint(ctx, deps, 'POST', '/refresh', async (_req, res) => {
    const status = await deps.platform.refresh();
    sendSuccess(res, status);
  });

  // ── 脱敏快照与用量 ────────────────────────────────────────────
  registerEndpoint(ctx, deps, 'GET', '/bootstrap', (_req, res) => {
    sendSuccess(res, deps.platform.bootstrap() ?? null);
  });

  registerEndpoint(ctx, deps, 'GET', '/usage', async (_req, res) => {
    sendSuccess(res, await deps.usage.me());
  });

  // ── 受管插件市场 ──────────────────────────────────────────────
  registerEndpoint(ctx, deps, 'GET', '/market', async (_req, res) => {
    let entries: EnterpriseRouteMarketEntry[];
    try {
      entries = await deps.market.plan();
    } catch {
      // 计划需要联网对账；离线时降级为最近一次本地视图而不是让整页失败
      entries = deps.market.list();
    }
    const view: EnterpriseMarketView = {
      entries,
      marketInstallEnabled: deps.market.installEnabled !== false,
    };
    sendSuccess(res, view);
  });

  registerEndpoint(ctx, deps, 'POST', '/market/apply', async (req, res) => {
    if (deps.market.installEnabled === false) {
      throw new EnterprisePlatformError(
        'ENT_PERMISSION_DENIED',
        '企业市场安装已关闭'
      );
    }
    const payload = await readJsonBody(req);
    const packageName = readOptionalStringField(payload, 'packageName');
    const result = await deps.market.apply(packageName);
    deps.logger.info(
      packageName === undefined
        ? '[enterprise] 已按计划调和企业插件'
        : '[enterprise] 已提交单包企业插件动作'
    );
    sendSuccess(res, result);
  });
}
