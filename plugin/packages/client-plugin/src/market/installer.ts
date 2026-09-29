/**
 * [INPUT]: 依赖 node:fs/promises 与 node:os/node:path；依赖 protocol/envelope 的错误折叠与 error-codes；依赖 verify/assignments/core-packages
 * [OUTPUT]: 对外提供 PluginCommandPort、插件 argv 构造器与 EnterprisePluginInstaller.apply（applied/skipped/failures）
 * [POS]: market 的唯一执行边界：下载→验包→落临时目录→委托宿主既有 DSH CLI 安装/卸载，绝不另造第二套安装器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EnterprisePlatformError } from '../protocol/envelope.js';
import type { EnterpriseClientErrorCode } from '../protocol/error-codes.js';
import type { EnterprisePluginAssignment } from '../protocol/types.js';
import type { MarketEntry } from './assignments.js';
import { isCorePackage } from './core-packages.js';
import {
  verifyPluginArtifact,
  type ArtifactVerification,
  type ArtifactVerificationInput,
} from './verify.js';

/**
 * 宿主插件命令端口。
 *
 * 约定：`argv` **不含可执行文件**，从 `plugin` 子命令开始，`plugin --profile <p>` 由本模块拼好；
 * `cwd` 是调用方目录（本模块传制品暂存目录），DSH CLI 只用它解析相对 spec，
 * 传绝对 tgz 路径因此与 cwd 无关。
 *
 * 生产环境的实现必须复用宿主既有能力，而不是新写进程管理：
 * `packages/jingyun-dsh/src/plugins/service.ts` 的 `getDshRuntimeEnv()`（:191-309）解析绿色运行时、
 * `dsh` bin 与注入环境，`:539-544` / `:643-648` 用 `execFile(execTarget, [nodeExec/dshBin, ...args])`
 * 执行同形 argv。本端口就是把这套既有执行器（含 jingyun 的安装互斥与 profile 收尾）接到企业市场上，
 * 端口实现者可继续复用 `uninstallCommunityPlugin`（:625-736）的卸载后 profile 清理与内存 dispose。
 */
export interface PluginCommandPort {
  run(argv: readonly string[], cwd: string): Promise<void>;
}

export interface EnterprisePluginInstallerOptions {
  readonly command: PluginCommandPort;
  /** Harness profile 名（jingyun 现网固定 `web`），必须与端口执行器作用的 profile 一致。 */
  readonly profile: string;
  /** CLI 身份，供端口解析可执行文件（jingyun 的 `dshBin` 或 PATH 上的 `dsh`）；不进入 argv。 */
  readonly dshCommand: string;
  /** 下载制品字节；实现必须走 platform/EnterpriseHttpClient，以携带逐请求授权。 */
  readonly download: (
    assignment: EnterprisePluginAssignment
  ) => Promise<Uint8Array>;
  readonly verifySignature: boolean;
  readonly trustedPublicKey?: string;
  /** 企业市场安装总开关；关闭时不再新增/升级，但**不阻止**中心显式 ABSENT 的撤回。 */
  readonly marketInstallEnabled: boolean;
}

/** 单条失败只带包名与稳定错误码，不带服务器正文、路径或令牌。 */
export interface PluginApplyFailure {
  readonly packageName: string;
  readonly code: EnterpriseClientErrorCode;
}

export interface PluginApplyResult {
  applied: string[];
  skipped: string[];
  failures: PluginApplyFailure[];
}

const PROFILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** 安装 argv：与 dshent 参考实现 `installPluginArguments` 逐字同形，也复用宿主 CLI 的 add 语义。 */
export function installPluginArguments(
  profile: string,
  artifactPath: string
): readonly string[] {
  return [
    'plugin',
    '--profile',
    profile,
    'add',
    '--ignore-scripts',
    '--save-exact',
    artifactPath,
  ];
}

/** 卸载 argv：与宿主 `uninstallCommunityPlugin`（service.ts:634-637）的 remove 调用同形。 */
export function removePluginArguments(
  profile: string,
  packageName: string
): readonly string[] {
  return ['plugin', '--profile', profile, 'remove', packageName];
}

/** 制品文件名只保留安全字符，防止包名里的 `/` 或 `..` 逃出暂存目录。 */
function artifactFileName(assignment: EnterprisePluginAssignment): string {
  const safe = (value: string): string =>
    value.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${safe(assignment.packageName)}-${safe(assignment.version)}.tgz`;
}

/** 下载/命令异常折叠为稳定错误码：平台错误保留自身码，未知按调用场景兜底。 */
function toFailureCode(
  error: unknown,
  fallback: EnterpriseClientErrorCode
): EnterpriseClientErrorCode {
  if (error instanceof EnterprisePlatformError) return error.code;
  return fallback;
}

/** 校验本身也必须无异常泄露：任何意外都折成完整性失败，而不是打断整批调和。 */
function verifySafely(input: ArtifactVerificationInput): ArtifactVerification {
  try {
    return verifyPluginArtifact(input);
  } catch {
    return {
      ok: false,
      code: 'ENT_ARTIFACT_INTEGRITY_FAILED',
      message: '制品校验异常，拒绝安装',
    };
  }
}

/**
 * 受管插件执行器。
 *
 * 不变量：
 * - **绝不抛到调用方**：每条目独立 try/catch，单条失败不中断其余；
 * - 制品先过 `verifyPluginArtifact`（核心包/大小/sha256/可选 Ed25519）才落盘；
 * - tgz 只存在于 `mkdtemp` 的暂存目录，`finally` 必定递归清理，异常路径同样不留残骸；
 * - `apply` 串行排队：同一 profile 的 pnpm 操作绝不能并发（与宿主 `isCommunityInstalling` 同一动机）；
 * - 不写任何日志，令牌与制品路径都不外泄。
 */
export class EnterprisePluginInstaller {
  private readonly command: PluginCommandPort;
  private readonly profile: string;
  private readonly dshCommand: string;
  private readonly download: (
    assignment: EnterprisePluginAssignment
  ) => Promise<Uint8Array>;
  private readonly verifySignature: boolean;
  private readonly trustedPublicKey: string | undefined;
  private readonly marketInstallEnabled: boolean;
  private queue: Promise<unknown> = Promise.resolve();
  private stagingDir: string | undefined;

  constructor(options: EnterprisePluginInstallerOptions) {
    if (
      !PROFILE_NAME_PATTERN.test(options.profile) ||
      options.profile === '.' ||
      options.profile === '..'
    ) {
      throw new TypeError('profile must be one Harness profile name');
    }
    if (options.dshCommand.trim().length === 0) {
      throw new TypeError('dshCommand is required');
    }
    this.command = options.command;
    this.profile = options.profile;
    this.dshCommand = options.dshCommand;
    this.download = options.download;
    this.verifySignature = options.verifySignature;
    this.trustedPublicKey = options.trustedPublicKey;
    this.marketInstallEnabled = options.marketInstallEnabled;
  }

  /** 端口解析可执行文件时使用的 CLI 身份；仅暴露给宿主接线，不含任何凭据。 */
  get commandName(): string {
    return this.dshCommand;
  }

  /** 串行执行一批调和动作；返回的 Promise 永不 reject。 */
  apply(entries: readonly MarketEntry[]): Promise<PluginApplyResult> {
    const run = this.queue.then(() => this.applyInternal(entries));
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async applyInternal(
    entries: readonly MarketEntry[]
  ): Promise<PluginApplyResult> {
    const result: PluginApplyResult = {
      applied: [],
      skipped: [],
      failures: [],
    };
    try {
      for (const entry of entries) {
        await this.applyEntry(entry, result);
      }
      return result;
    } finally {
      await this.cleanupStaging();
    }
  }

  private async applyEntry(
    entry: MarketEntry,
    result: PluginApplyResult
  ): Promise<void> {
    const { assignment } = entry;
    const packageName = assignment.packageName;

    if (entry.action === 'NONE' || entry.blockedReason !== undefined) {
      result.skipped.push(packageName);
      return;
    }
    // 纵深防御：planMarketActions 已把核心包降级为 NONE，这里再拦一次，防止绕过计划直接执行。
    if (isCorePackage(packageName)) {
      result.failures.push({ packageName, code: 'ENT_ARTIFACT_CORE_PACKAGE' });
      return;
    }

    if (entry.action === 'UNINSTALL') {
      try {
        const cwd = await this.staging();
        await this.command.run(
          removePluginArguments(this.profile, packageName),
          cwd
        );
        result.applied.push(packageName);
      } catch (error) {
        result.failures.push({
          packageName,
          code: toFailureCode(error, 'ENT_PLUGIN_COMMAND_FAILED'),
        });
      }
      return;
    }

    if (!this.marketInstallEnabled) {
      result.skipped.push(packageName);
      return;
    }
    if (assignment.downloadUrl === null) {
      result.failures.push({ packageName, code: 'ENT_PLUGIN_NOT_ASSIGNED' });
      return;
    }

    let bytes: Uint8Array;
    try {
      bytes = await this.download(assignment);
    } catch (error) {
      result.failures.push({
        packageName,
        code: toFailureCode(error, 'ENT_NETWORK_ERROR'),
      });
      return;
    }

    const verdict = verifySafely({
      bytes,
      assignment,
      verifySignature: this.verifySignature,
      ...(this.trustedPublicKey === undefined
        ? {}
        : { trustedPublicKey: this.trustedPublicKey }),
    });
    if (!verdict.ok) {
      result.failures.push({ packageName, code: verdict.code });
      return;
    }

    try {
      const cwd = await this.staging();
      const artifactPath = join(cwd, artifactFileName(assignment));
      await writeFile(artifactPath, bytes, { mode: 0o600 });
      await this.command.run(
        installPluginArguments(this.profile, artifactPath),
        cwd
      );
      result.applied.push(packageName);
    } catch (error) {
      result.failures.push({
        packageName,
        code: toFailureCode(error, 'ENT_PLUGIN_COMMAND_FAILED'),
      });
    }
  }

  /** 惰性建立暂存目录：没有任何需要子进程的动作时不碰磁盘。 */
  private async staging(): Promise<string> {
    if (this.stagingDir === undefined) {
      this.stagingDir = await mkdtemp(
        join(tmpdir(), 'dshent-enterprise-plugins-')
      );
    }
    return this.stagingDir;
  }

  private async cleanupStaging(): Promise<void> {
    const dir = this.stagingDir;
    this.stagingDir = undefined;
    if (dir === undefined) return;
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // 清理失败不改变调和结论；残留只是磁盘卫生问题。
    }
  }
}
