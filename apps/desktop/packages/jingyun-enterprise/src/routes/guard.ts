/**
 * [INPUT]: 零外部依赖；只读取 Node 请求形态的 method 与 headers（string | string[] | undefined）
 * [OUTPUT]: 对外提供 checkEnterpriseRequestOrigin 同源判定、isLoopbackHostname 主机判定与失败原因枚举
 * [POS]: routes 的**唯一鉴权边界**：jingyun 客户端刻意关闭 DSH BrowserAuth，故所有 /api/jingyun/enterprise/* handler 必须先进此判定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 请求的最小观测面；node:http 的 IncomingMessage 天然满足，测试可用普通对象。 */
export interface EnterpriseRequestLike {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
}

/** 判定失败原因；仅用于宿主日志，绝不出现在 HTTP 响应体里（不泄露内部信息）。 */
export type EnterpriseOriginDenialReason =
  | 'HOST_MISSING'
  | 'HOST_INVALID'
  | 'ORIGIN_MULTIPLE'
  | 'ORIGIN_NULL'
  | 'ORIGIN_INVALID'
  | 'ORIGIN_MISSING'
  | 'ORIGIN_CROSS_SITE';

/** 判定结果：allowed 为 true 时无附加信息，false 时携带内部原因。 */
export type EnterpriseOriginDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: EnterpriseOriginDenialReason };

/** 同名头出现多次时返回的哨兵：不允许合并、不允许取其一，一律视为可疑。 */
const AMBIGUOUS_HEADER = Symbol('ambiguous-header');

/**
 * Host 允许的书写形态：常规主机名/IPv4 字面量或方括号 IPv6 字面量，可选端口。
 * 不含 userinfo、路径、空白与超长端口，避免 `user@host`、`host/path` 之类的解析歧义。
 */
const HOST_PATTERN =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:.]+\])(?::[0-9]{1,5})?$/;

/** 读单个头：缺失返回 null，重复返回哨兵。 */
function readSingleHeader(
  headers: EnterpriseRequestLike['headers'],
  name: string
): string | null | typeof AMBIGUOUS_HEADER {
  if (!headers || typeof headers !== 'object') return null;
  const raw = headers[name];
  if (raw === undefined) return null;
  if (Array.isArray(raw)) {
    return raw.length === 1 && typeof raw[0] === 'string'
      ? raw[0]
      : AMBIGUOUS_HEADER;
  }
  return typeof raw === 'string' ? raw : null;
}

/** 去掉单个结尾点（`localhost.` 与 `localhost` 是同一主机），并统一小写。 */
function canonicalHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}

/**
 * 判断主机名是否为本机回环：`localhost`、`::1`、整个 127.0.0.0/8。
 * 只做字面量判定，绝不解析 DNS——解析会被 DNS rebinding 绕过，字面量才是可验证事实。
 */
export function isLoopbackHostname(hostname: string): boolean {
  const host = canonicalHostname(hostname);
  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!octets) return false;
  const parts = octets.slice(1, 5).map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => part > 255)) return false;
  return parts[0] === 127;
}

interface ParsedAuthority {
  readonly hostname: string;
  /** 显式端口；空串表示使用 scheme 默认端口。 */
  readonly port: string;
}

/**
 * 端口归一化：80/443 与「省略端口」等价。
 * Host 头不带 scheme，无法区分 http/https，故两个默认端口一律折叠为空串；这与 WHATWG URL 对
 * Origin 的处理一致（`http://h:80` 的 port 也是空串）。scheme 不一致本身不构成跨源读取能力，
 * 攻击者仍需先控制与 Host 完全相同的主机名。
 */
function normalizePort(port: string): string {
  return port === '80' || port === '443' ? '' : port;
}

/** 解析 Host 头为 authority；任何歧义形态一律返回 null（fail-closed）。 */
function parseHostHeader(value: string): ParsedAuthority | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return null;
  // 无方括号的裸 IPv6 回环是合法书写但不是合法 URL authority，单独收敛为 `::1`（不允许带端口）。
  if (trimmed === '::1') return { hostname: '::1', port: '' };
  if (!HOST_PATTERN.test(trimmed)) return null;
  const separator = trimmed.lastIndexOf(':');
  const hasPort = separator > 0 && !trimmed.endsWith(']');
  const hostnamePart = hasPort ? trimmed.slice(0, separator) : trimmed;
  const portPart = hasPort ? trimmed.slice(separator + 1) : '';
  if (portPart !== '') {
    const port = Number.parseInt(portPart, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  }
  const hostname = canonicalHostname(hostnamePart.replace(/^\[|\]$/g, ''));
  if (hostname.length === 0) return null;
  return { hostname, port: normalizePort(portPart) };
}

/** 解析 Origin 头为 authority；非 http(s)、无主机名、带路径/凭据一律拒绝。 */
function parseOriginHeader(value: string): ParsedAuthority | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username !== '' || parsed.password !== '') return null;
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '')
    return null;
  const hostname = canonicalHostname(parsed.hostname.replace(/^\[|\]$/g, ''));
  if (hostname.length === 0) return null;
  return { hostname, port: parsed.port };
}

/** 安全方法（只读）：GET/HEAD 可无 Origin；其余一律按写动作要求 Origin+Host 双双在场。 */
function isWriteMethod(method: string | undefined): boolean {
  const normalized = (method ?? 'GET').toUpperCase();
  return normalized !== 'GET' && normalized !== 'HEAD';
}

/**
 * 同源判定矩阵（fail-closed，任一条不满足即拒绝）：
 *
 * | 场景                                   | 结论 |
 * | -------------------------------------- | ---- |
 * | 缺 Host / Host 形态可疑 / Host 重复      | 拒绝 |
 * | POST 缺 Origin                          | 拒绝 |
 * | `Origin: null`                          | 拒绝 |
 * | Origin 与 Host 同为回环                  | 放行 |
 * | Origin 与 Host 主机名+端口完全一致        | 放行 |
 * | 其它（跨站 Origin、端口/主机不一致）      | 拒绝 |
 * | GET 缺 Origin，且 Host 为回环             | 放行 |
 * | GET 缺 Origin，且 Host 非回环             | 拒绝 |
 *
 * 说明：非回环 Host 只在请求自带完全一致的 Origin 时放行，因此部署方把 webServer.host 设为
 * `0.0.0.0`（局域网访问）仍可用；但 GET 无法自证同源，故只接受回环 Host——这是刻意的可用性代价。
 * 残余风险：Host 与 Origin 同时被攻击者控制的 DNS rebinding 无法仅靠头校验消除，需由部署方以
 * 端口收敛/TLS 与不暴露 0.0.0.0 缓解。
 */
export function checkEnterpriseRequestOrigin(
  req: EnterpriseRequestLike
): EnterpriseOriginDecision {
  const hostHeader = readSingleHeader(req.headers, 'host');
  if (hostHeader === AMBIGUOUS_HEADER)
    return { allowed: false, reason: 'HOST_INVALID' };
  if (hostHeader === null || hostHeader.trim() === '') {
    return { allowed: false, reason: 'HOST_MISSING' };
  }
  const host = parseHostHeader(hostHeader);
  if (!host) return { allowed: false, reason: 'HOST_INVALID' };
  const hostLoopback = isLoopbackHostname(host.hostname);

  const originHeader = readSingleHeader(req.headers, 'origin');
  if (originHeader === AMBIGUOUS_HEADER)
    return { allowed: false, reason: 'ORIGIN_MULTIPLE' };

  if (originHeader === null || originHeader.trim() === '') {
    if (isWriteMethod(req.method))
      return { allowed: false, reason: 'ORIGIN_MISSING' };
    return hostLoopback
      ? { allowed: true }
      : { allowed: false, reason: 'ORIGIN_MISSING' };
  }
  if (originHeader.trim().toLowerCase() === 'null') {
    return { allowed: false, reason: 'ORIGIN_NULL' };
  }

  const origin = parseOriginHeader(originHeader);
  if (!origin) return { allowed: false, reason: 'ORIGIN_INVALID' };

  if (hostLoopback && isLoopbackHostname(origin.hostname))
    return { allowed: true };
  if (origin.hostname === host.hostname && origin.port === host.port)
    return { allowed: true };
  return { allowed: false, reason: 'ORIGIN_CROSS_SITE' };
}
