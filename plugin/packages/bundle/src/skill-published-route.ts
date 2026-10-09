/**
 * [INPUT]: 依赖 Node HTTP 类型、platform-client 的 `ctx.webServer` route port、稳定码→状态码唯一映射 `enterpriseLocalErrorStatus` 与 `thrownErrorDiagnostics`、本包 `skill-published.ts` 的安装内核（由组合层绑定）
 * [OUTPUT]: 对外提供口径 64 B0 的**唯一**本机路由注册器 `registerEnterprisePublishedSkillRoute`（`POST /enterprise/api/v1/local/skills/published/install`）、路径常量 `ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH`、端口形状 `EnterprisePublishedSkillRoutePort` 与失败投影 `projectPublishedSkillFailure`
 * [POS]: bundle 的「系统广场·已发布技能 → 导出安装」**本机 HTTP 面**——与 `skill-third-party-route.ts`（口径 62）并列的又一条技能动作面，注册面**全在 bundle 侧**（platform-client 零改动）：`skill-route.ts` 持有 `/enterprise/api/v1/local/skills` 这条 prefix，本文件这条注册成 **exact** sibling（引擎 `dsh-host-webserver` 是 exact / prefix 两张表，exact 整路径优先 ⇒ `published` 不会被当成包 id 判 400）。
 *   ★**只做形状门禁 + 分派 + 投影**：合规判决、取数与落盘全在 `skill-published.ts`（本层不写第二套判定）；
 *   正文**关闭键集恰好** `{targetId}`（多键/少键/非数字/非安全整数/越界/非 JSON/`content-type` 不是
 *   `application/json` 一律 400 且**一次都不进端口**）。
 *   ★**为什么端口是必需参数而不是可选**：这条路由的端口在组合层 `apply()` 里**同步**接线
 *   （不像配方/官方安装面那样要等官方服务 provide），"端口缺席"在类型上就不可表达 ——
 *   为一个不可能出现的状态编一枚码会违背本仓「一个码一句话」；真出意外（端口自己抛）
 *   由 {@link projectPublishedSkillFailure} 收敛成既有码 `ENT_SKILL_INSTALL_FAILED`（503）。
 *   ★**新码刻意不进** platform-client 那张码→状态表（`ENT_SKILL_PUBLISHED_COPY_FORBIDDEN` 落表尾默认 503）
 *   ⇒ platform-client 零改动，与另两枚 `ENT_SKILL_*_UNAVAILABLE` 同一手法。
 *   ★非 POST 一律 405 + `Allow: POST`。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { enterpriseLocalErrorStatus, thrownErrorDiagnostics, type WebServerRoutePort } from '@dshent/platform-client'

/**
 * 已发布技能**安装**的 exact 动作路由：`POST /enterprise/api/v1/local/skills/published/install`。
 *
 * ★必须注册成 **exact**：`skill-route.ts` 持有 `/enterprise/api/v1/local/skills` 这条 prefix，
 * 而引擎 `match()` 是「exact 整路径优先、miss 后才取最长 prefix」⇒ 不注册 exact 的话
 * `published` 会被那条 prefix handler 当成包 id 去判 400（`skill-third-party-route.ts` 同一个坑）。
 */
export const ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH = '/enterprise/api/v1/local/skills/published/install'

/** `targetId` 的上界：JS 安全整数（`1..2^53-1`），与内核那道形状门禁同一条。 */
const MAX_TARGET_ID = Number.MAX_SAFE_INTEGER

/** 与既有本机技能路由同源：错误码只回显受控标识符，任意外字符串不进响应体。 */
const CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** JSON 正文上限：与 platform-client 的 `MAX_LOCAL_BODY_BYTES` 同一条 256 KiB（本面只收一个数字）。 */
const MAX_LOCAL_BODY_BYTES = 256 * 1024

/**
 * 本面唯一的端口：把一次安装交给 `skill-published.ts` 的内核。
 *
 * 形状故意最小：路由只负责「方法 + 正文形状 + 错误投影」，**合规判决与落盘语义全在内核那一份里**。
 */
export interface EnterprisePublishedSkillRoutePort {
  /** `POST <local>/skills/published/install`：把广场记录那枚 `targetId` 装进 `<dshHome>/skills`。 */
  install(targetId: number): Promise<unknown>
}

/** 一次失败被投影成的 HTTP 事实：状态码、稳定码与日志用的判定点。 */
export interface PublishedSkillFailureProjection {
  readonly status: number
  readonly code: string
  readonly step: 'install-failed'
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': JSON_CONTENT_TYPE,
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader('allow', allow)
  writeJson(response, 405, { error: { code: 'ENT_INVALID_REQUEST' } })
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code: unknown = Reflect.get(error, 'code')
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/**
 * 失败投影的唯一判断点：状态码走 platform-client 的**唯一**那张表
 * （本面新码 `ENT_SKILL_PUBLISHED_COPY_FORBIDDEN` 落在表尾 ⇒ 503），响应体只回受控形状的稳定码。
 *
 * ★**受控码优先于状态码**：`ENT_SKILL_ARCHIVE_INVALID` / `ENT_SKILL_SKILLMD_INVALID` 在那张表上都是 400，
 * 但它们与"请求形状不对"（`ENT_INVALID_REQUEST`）的**下一步完全不同**（换一份包 / 改文件头 / 改正文）
 * ⇒ 只要异常带着受控码就原样透出；只有**连码都没有**的形状类失败（`TypeError` 等）才归 `ENT_INVALID_REQUEST`，
 * 其余无码失败回落既有码 `ENT_SKILL_INSTALL_FAILED`（**绝不复述任意字符串**）。
 *
 * @param error - 分派路径逃出来的异常。
 * @returns 状态码、响应体里的稳定码与日志判定点。
 */
export function projectPublishedSkillFailure(error: unknown): PublishedSkillFailureProjection {
  const code = errorCodeOf(error)
  const status = enterpriseLocalErrorStatus(error)
  return {
    status,
    code: code !== undefined && CODE_SHAPE.test(code)
      ? code
      : status === 400 ? 'ENT_INVALID_REQUEST' : 'ENT_SKILL_INSTALL_FAILED',
    step: 'install-failed',
  }
}

/**
 * 有界读 JSON 正文（与 platform-client 那条既有 JSON 路由**同一把尺**：`content-type` 必须是
 * `application/json`、正文有界 256 KiB、解析失败即 400）。本面**只收一个数字**，不引第二条配额。
 */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('content-type must be application/json')
  const declared = request.headers['content-length']
  if (typeof declared === 'string' && declared !== '' && Number(declared) > MAX_LOCAL_BODY_BYTES) {
    throw new RangeError('published skill install body is too large')
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += bytes.byteLength
    if (total > MAX_LOCAL_BODY_BYTES) throw new RangeError('published skill install body is too large')
    chunks.push(bytes)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    throw new TypeError(`published skill install body is not valid JSON: ${String(error)}`)
  }
}

/**
 * 在 Harness `ctx.webServer` 上注册「已发布技能安装」的唯一同源路由。
 *
 *  · `POST <local>/skills/published/install` → `port.install(targetId)`：正文**关闭键集恰好** `{targetId}`
 *    （安全整数 `1..2^53-1`；不是路径、不是字符串 id）；成功回 `{data:{skills:[…]}}`，
 *    与 `GET /skills/self-installed` **逐字同形**（界面复用同一份解码器）。
 *
 * 两条硬口径：① 非 POST ⇒ 405 + `Allow: POST`；② 异常一律在写状态行之前收敛成 `{error:{code}}`，
 * 绝不逃到 Cordis 顶层（合规拒那枚码由内核抛、由 {@link projectPublishedSkillFailure} 投影）。
 *
 * @param webServer - `ctx.webServer` route port。
 * @param port - 组合层绑定的安装内核（**必需**：见文件头部那条理由）。
 * @param onError - 投影留痕端口；组合层把它接到 Host logger。
 * @returns 注销这条路由的 disposer。
 */
export function registerEnterprisePublishedSkillRoute(
  webServer: WebServerRoutePort,
  port: EnterprisePublishedSkillRoutePort,
  onError?: (message: string, error: unknown) => void,
): () => void {
  const dispose = webServer.register({
    kind: 'exact',
    path: ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH,
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST')
        return
      }
      const operation = `POST ${ENTERPRISE_SKILL_PUBLISHED_INSTALL_LOCAL_PATH}`
      try {
        const value = await readJsonBody(request)
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new TypeError('invalid published skill install')
        }
        const body = value as Record<string, unknown>
        // 关闭键集**恰好** `{targetId}`：越界键、非数字、非安全整数、越界一律在这
        // 一步变成 400，**一次都不进**内核（合规判决与取数一步都不会发生）。
        const targetId = body['targetId']
        if (Object.keys(body).sort().join(',') !== 'targetId'
          || typeof targetId !== 'number'
          || !Number.isSafeInteger(targetId)
          || targetId < 1
          || targetId > MAX_TARGET_ID) {
          throw new TypeError('invalid published skill install')
        }
        writeJson(response, 200, { data: await port.install(targetId) })
      } catch (error) {
        const failure = projectPublishedSkillFailure(error)
        writeJson(response, failure.status, { error: { code: failure.code } })
        onError?.(`enterprise published skill request projected to ${failure.status}`
          + ` [operation=${operation} step=${failure.step} status=${failure.status}]`
          + ` ${thrownErrorDiagnostics(error)}`, error)
      }
    },
  })
  return dispose
}
