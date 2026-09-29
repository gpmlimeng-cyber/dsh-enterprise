/**
 * [INPUT]: 依赖 node:crypto 的 createHash/createPublicKey/verify；依赖 protocol 的分配类型与本地错误码；依赖 core-packages 保护名单
 * [OUTPUT]: 对外提供 sha256Hex、签名声明与 JCS 规范化、verifyPluginArtifact 四道校验链
 * [POS]: market 的制品信任边界，下载字节必须先过此门才能落到磁盘或交给宿主 CLI；验签开关只由安装层决定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  createHash,
  createPublicKey,
  verify,
  type KeyObject,
} from 'node:crypto';

import type { EnterpriseClientErrorCode } from '../protocol/error-codes.js';
import type { EnterprisePluginAssignment } from '../protocol/types.js';
import { ENTERPRISE_CORE_PACKAGES, isCorePackage } from './core-packages.js';

/** 校验结论：要么放行，要么带稳定错误码拒绝；绝不抛异常打断批量调和。 */
export type ArtifactVerification =
  | { ok: true }
  | { ok: false; code: EnterpriseClientErrorCode; message: string };

export interface ArtifactVerificationInput {
  readonly bytes: Uint8Array;
  readonly assignment: EnterprisePluginAssignment;
  /** 只来自安装层配置；**不得**由服务端响应或 assignment 的任何字段决定。 */
  readonly verifySignature: boolean;
  /** Ed25519 SPKI PEM 或单行 DER Base64；验签关闭时忽略。 */
  readonly trustedPublicKey?: string;
  /** 覆盖保护名单，仅测试与多租户注入使用；默认企业真源名单。 */
  readonly corePackages?: readonly string[];
}

/** 制品摘要；大小与 sha256 永远校验，无法被任何服务端字段关闭。 */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * RFC 8785 子集：对象键按 UTF-16 码元排序，数值只接受安全有限整数。
 *
 * 这里刻意只实现签名 schema 用到的子集（string/number/boolean/null/array/object）；
 * 出现了 undefined、NaN、BigInt 等类型即说明声明被污染，直接拒绝而不是猜一个序列化。
 */
export function canonicalizeJson(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError('canonical signed numbers must be safe integers');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareUtf16(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeJson(item)}`)
      .join(',')}}`;
  }
  throw new TypeError('canonical JSON contains an unsupported value');
}

/**
 * 冻结签名声明：与服务端 `PluginManifestSigner.SignatureManifest` 同名同序。
 *
 * 键名固定为 `artifactId`（映射客户端的 `pluginVersionId`），因为服务端就是按这个声明
 * 签名的；改名会立刻让所有既有签名失效。`required` / `desiredState` / `downloadUrl`
 * 刻意不在声明内：授权范围变更不应使制品签名失效，而它们也绝不影响校验强度。
 */
export function signatureManifest(
  assignment: EnterprisePluginAssignment
): Record<string, unknown> {
  return {
    artifactId: assignment.pluginVersionId,
    packageName: assignment.packageName,
    version: assignment.version,
    sizeBytes: assignment.sizeBytes,
    sha256: assignment.sha256,
    compatibility: assignment.compatibility,
  };
}

/**
 * 解析安装层信任根：只接受 Ed25519。
 *
 * 支持两种输入形态（与参考实现一致）：SPKI PEM 文本，以及单行 DER Base64。
 * 任何解析失败、非 Ed25519 曲线都返回 null 由调用方折叠成稳定错误码，不向上抛。
 */
function parseTrustedPublicKey(value: string): KeyObject | null {
  try {
    const key = value.includes('-----BEGIN PUBLIC KEY-----')
      ? createPublicKey(value)
      : createPublicKey({
          key: Buffer.from(value, 'base64'),
          format: 'der',
          type: 'spki',
        });
    return key.asymmetricKeyType === 'ed25519' ? key : null;
  } catch {
    return null;
  }
}

function reject(
  code: EnterpriseClientErrorCode,
  message: string
): ArtifactVerification {
  return { ok: false, code, message };
}

/**
 * 制品校验。顺序**先便宜后昂贵**，任何一步失败即拒绝：
 *
 * 1. 核心包拒装（纯字符串比较，最便宜，且是策略否决）；
 * 2. `bytes.length !== assignment.sizeBytes`（O(1)）；
 * 3. sha256 不一致（O(n) 摘要，但只做一次）；
 * 4. 仅当安装层开启验签时才解析公钥并做 Ed25519 验签（最昂贵，且依赖外部信任根）。
 *
 * 不变量：
 * - 服务端响应无权关闭校验：本函数**不读取** assignment 的任何「是否需要校验」类字段，
 *   `verifySignature` 只能来自安装层选项；`required` 也不参与任何跳过逻辑；
 * - 验签关闭时 `signatureBase64` 一律忽略，但大小与 sha256 永远校验；
 * - 结论只含稳定错误码，不回显服务器正文、路径或令牌。
 */
export function verifyPluginArtifact(
  input: ArtifactVerificationInput
): ArtifactVerification {
  const { assignment } = input;
  const guard = input.corePackages ?? ENTERPRISE_CORE_PACKAGES;

  // ① 核心包拒装：无论字节多正确、签名多有效，都不得覆盖安装层拥有的产品代码。
  if (isCorePackage(assignment.packageName, guard)) {
    return reject(
      'ENT_ARTIFACT_CORE_PACKAGE',
      `企业核心包 ${assignment.packageName} 由安装层拥有，市场不得安装或覆盖`
    );
  }

  // ② 大小：先断言声明本身可信，再与实收字节数比对。
  const declaredSize = assignment.sizeBytes;
  if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
    return reject(
      'ENT_ARTIFACT_INTEGRITY_FAILED',
      '制品声明的大小不是合法的非负整数，拒绝安装'
    );
  }
  if (input.bytes.byteLength !== declaredSize) {
    return reject(
      'ENT_ARTIFACT_INTEGRITY_FAILED',
      `制品大小不符：期望 ${String(declaredSize)} 字节，实收 ${String(input.bytes.byteLength)} 字节`
    );
  }

  // ③ sha256：摘要不一致即字节已被替换或截断，后续验签不再有意义。
  const digest = sha256Hex(input.bytes);
  if (digest !== assignment.sha256.trim().toLowerCase()) {
    return reject(
      'ENT_ARTIFACT_INTEGRITY_FAILED',
      '制品 sha256 与中心声明不一致'
    );
  }

  // ④ 验签：仅在安装层显式开启时执行，且公钥缺失一律视为不可信。
  if (!input.verifySignature) {
    return { ok: true };
  }
  const signatureBase64 = assignment.signatureBase64.trim();
  if (signatureBase64.length === 0) {
    return reject(
      'ENT_ARTIFACT_UNSIGNED',
      `插件 ${assignment.packageName} 未携带签名，验签已开启故拒绝安装`
    );
  }
  const publicKeyText = input.trustedPublicKey?.trim() ?? '';
  if (publicKeyText.length === 0) {
    return reject(
      'ENT_ARTIFACT_UNSIGNED',
      '验签已开启但安装层未配置 Ed25519 公钥，无法建立信任根'
    );
  }
  const publicKey = parseTrustedPublicKey(publicKeyText);
  if (publicKey === null) {
    return reject(
      'ENT_ARTIFACT_INTEGRITY_FAILED',
      '信任根公钥不是 Ed25519 SPKI（PEM 或 DER Base64）'
    );
  }
  const signature = Buffer.from(signatureBase64, 'base64');
  if (signature.byteLength !== 64) {
    return reject(
      'ENT_ARTIFACT_INTEGRITY_FAILED',
      'Ed25519 签名长度不是 64 字节'
    );
  }
  let canonical: Buffer;
  try {
    canonical = Buffer.from(
      canonicalizeJson(signatureManifest(assignment)),
      'utf8'
    );
  } catch {
    return reject(
      'ENT_ARTIFACT_INTEGRITY_FAILED',
      '签名声明含无法规范化的字段'
    );
  }
  if (!verify(null, canonical, publicKey, signature)) {
    return reject('ENT_ARTIFACT_INTEGRITY_FAILED', 'Ed25519 签名校验失败');
  }
  return { ok: true };
}
