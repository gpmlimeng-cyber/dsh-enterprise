/**
 * [INPUT]: 依赖 node:crypto/node:fs/node:path 与 vitest；依赖 src/market 的 core-packages/verify/assignments/installer 与协议 fixture
 * [OUTPUT]: 对外提供 market 模块的验收断言：名单漂移、四道验包链、四种调和动作、执行器隔离与临时目录清理
 * [POS]: tests 的 E4 裁判面，用契约 fixture 与服务端冻结签名向量校验客户端实现，不做任何 mock 掉校验的捷径
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  planMarketActions,
  type InstalledPluginFact,
  type MarketEntry,
} from '../src/market/assignments.js';
import {
  ENTERPRISE_CORE_PACKAGES,
  isCorePackage,
} from '../src/market/core-packages.js';
import {
  EnterprisePluginInstaller,
  installPluginArguments,
  removePluginArguments,
  type PluginCommandPort,
} from '../src/market/installer.js';
import {
  canonicalizeJson,
  sha256Hex,
  signatureManifest,
  verifyPluginArtifact,
} from '../src/market/verify.js';
import { EnterprisePlatformError } from '../src/protocol/envelope.js';
import type { EnterprisePluginAssignment } from '../src/protocol/types.js';

// ---------- fixture 与测试数据 ----------

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
  );
}

const CORE_FIXTURE = readFixture('plugin-core-packages.json') as {
  packages: string[];
};
const ASSIGNMENT_FIXTURE = readFixture('plugin-assignments-success.json') as {
  data: { assignments: EnterprisePluginAssignment[] };
};
const FIXTURE_ASSIGNMENT = ASSIGNMENT_FIXTURE.data
  .assignments[0] as EnterprisePluginAssignment;

const BYTES = Buffer.from('acme-tools-1.2.3 tarball bytes', 'utf8');
const TAMPERED_BYTES = Buffer.from(BYTES);
TAMPERED_BYTES[0] = TAMPERED_BYTES[0] === 0x61 ? 0x62 : 0x61;
if (
  TAMPERED_BYTES.byteLength !== BYTES.byteLength ||
  TAMPERED_BYTES.equals(BYTES)
) {
  throw new Error('tampered fixture must keep the same length but differ');
}

/** 与服务端 PluginManifestSignerTest 冻结向量同形的最小声明。 */
function makeAssignment(
  overrides: Partial<EnterprisePluginAssignment> = {}
): EnterprisePluginAssignment {
  return {
    pluginVersionId: '1901300000000000101',
    packageName: '@example/acme-tools',
    version: '1.2.3',
    sizeBytes: BYTES.byteLength,
    sha256: sha256Hex(BYTES),
    signatureBase64: '',
    compatibility: {
      harnessCommits: ['b150a551b8d465e31e418e1b2eaf5e79bbb7d28e'],
      enterpriseBundleRange: '>=0.1.0 <0.2.0',
      operatingSystems: ['darwin', 'linux'],
    },
    downloadUrl:
      '/enterprise/api/v1/plugins/versions/1901300000000000101/download',
    required: true,
    desiredState: 'INSTALLED',
    ...overrides,
  };
}

const KEY_PAIR = generateKeyPairSync('ed25519');
const SPKI_PEM = KEY_PAIR.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();
const SPKI_DER_BASE64 = KEY_PAIR.publicKey
  .export({ type: 'spki', format: 'der' })
  .toString('base64');

function withSignature(
  assignment: EnterprisePluginAssignment,
  privateKey = KEY_PAIR.privateKey
): EnterprisePluginAssignment {
  const payload = Buffer.from(
    canonicalizeJson(signatureManifest(assignment)),
    'utf8'
  );
  return {
    ...assignment,
    signatureBase64: sign(null, payload, privateKey).toString('base64'),
  };
}

// ---------- core-packages：名单漂移门禁 ----------

describe('core-packages', () => {
  it('以契约真源 6 项同序开头，并追加插件自身保护项', () => {
    // 逐字一致且同序：前 6 项即契约真源，任何漂移都必须在这里红。
    expect(
      ENTERPRISE_CORE_PACKAGES.slice(0, CORE_FIXTURE.packages.length)
    ).toEqual(CORE_FIXTURE.packages);
    expect(CORE_FIXTURE.packages).toHaveLength(6);
    // 追加项只有本插件自身；宿主客户端的包名由部署方注入，不在此硬编码。
    expect([...ENTERPRISE_CORE_PACKAGES]).toEqual([
      ...CORE_FIXTURE.packages,
      'dshent-client-plugin',
    ]);
    expect(ENTERPRISE_CORE_PACKAGES).toHaveLength(7);
    expect(isCorePackage('dshent-client-plugin')).toBe(true);
  });

  it('大小写与空白不构成绕过路径', () => {
    for (const name of ENTERPRISE_CORE_PACKAGES) {
      expect(isCorePackage(name)).toBe(true);
    }
    expect(isCorePackage('  DSHENT/Client-Plugin  ')).toBe(false);
    expect(isCorePackage('  @DSHENT/Client-Plugin  ')).toBe(false);
    expect(isCorePackage('  DSHENT-CLIENT-PLUGIN  ')).toBe(true);
    expect(isCorePackage('@example/acme-tools')).toBe(false);
    expect(isCorePackage('')).toBe(false);
  });
});

// ---------- verify：先便宜后昂贵 ----------

describe('verifyPluginArtifact', () => {
  it('JCS 规范化与服务端冻结签名声明逐字一致', () => {
    expect(canonicalizeJson(signatureManifest(makeAssignment()))).toBe(
      `{"artifactId":"1901300000000000101","compatibility":{"enterpriseBundleRange":">=0.1.0 <0.2.0","harnessCommits":["b150a551b8d465e31e418e1b2eaf5e79bbb7d28e"],"operatingSystems":["darwin","linux"]},"packageName":"@example/acme-tools","sha256":"${sha256Hex(BYTES)}","sizeBytes":${String(BYTES.byteLength)},"version":"1.2.3"}`
    );
  });

  it('核心包拒装，且优先于大小与签名校验', () => {
    const verdict = verifyPluginArtifact({
      bytes: BYTES,
      assignment: makeAssignment({
        packageName: 'dshent-client-plugin',
        sizeBytes: BYTES.byteLength + 9,
        signatureBase64: 'not-a-signature',
      }),
      verifySignature: true,
      trustedPublicKey: SPKI_PEM,
    });
    expect(verdict).toMatchObject({
      ok: false,
      code: 'ENT_ARTIFACT_CORE_PACKAGE',
    });
  });

  it('自定义保护名单同样生效（含大小写）', () => {
    const verdict = verifyPluginArtifact({
      bytes: BYTES,
      assignment: makeAssignment({ packageName: '@Example/Acme-Tools' }),
      verifySignature: false,
      corePackages: ['@example/acme-tools'],
    });
    expect(verdict).toMatchObject({
      ok: false,
      code: 'ENT_ARTIFACT_CORE_PACKAGE',
    });
  });

  it('大小不符与 sha256 不符分别拒绝', () => {
    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: makeAssignment({ sizeBytes: BYTES.byteLength + 1 }),
        verifySignature: false,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' });

    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: makeAssignment({ sha256: 'a'.repeat(64) }),
        verifySignature: false,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' });

    // 同长度篡改必须走摘要路径被拦。
    expect(
      verifyPluginArtifact({
        bytes: TAMPERED_BYTES,
        assignment: makeAssignment(),
        verifySignature: false,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' });
  });

  it('验签关闭时忽略签名字段，但大小与 sha256 仍然强制', () => {
    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: makeAssignment({ signatureBase64: 'garbage-signature' }),
        verifySignature: false,
      })
    ).toEqual({ ok: true });

    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: makeAssignment({
          signatureBase64: 'garbage-signature',
          sha256: 'b'.repeat(64),
        }),
        verifySignature: false,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' });
  });

  it('验签开启时未签名一律拒绝', () => {
    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: makeAssignment(),
        verifySignature: true,
        trustedPublicKey: SPKI_PEM,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_UNSIGNED' });
  });

  it('验签开启但信任根缺失时拒绝', () => {
    const signed = withSignature(makeAssignment());
    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: signed,
        verifySignature: true,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_UNSIGNED' });
    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: signed,
        verifySignature: true,
        trustedPublicKey: '   ',
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_UNSIGNED' });
  });

  it('Ed25519 验签通过（SPKI PEM 与 DER Base64 两种公钥形态）', () => {
    const signed = withSignature(makeAssignment());
    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: signed,
        verifySignature: true,
        trustedPublicKey: SPKI_PEM,
      })
    ).toEqual({ ok: true });
    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: signed,
        verifySignature: true,
        trustedPublicKey: SPKI_DER_BASE64,
      })
    ).toEqual({ ok: true });
  });

  it('Ed25519 验签失败：换密钥、篡改声明、非法公钥、签名长度异常', () => {
    const other = generateKeyPairSync('ed25519');
    const signedByOther = withSignature(makeAssignment(), other.privateKey);

    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: signedByOther,
        verifySignature: true,
        trustedPublicKey: SPKI_PEM,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' });

    // 签名有效但声明被改写（版本升位）→ 必须失败，证明签名绑定了冻结声明。
    const signed = withSignature(makeAssignment());
    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: { ...signed, version: '1.2.4' },
        verifySignature: true,
        trustedPublicKey: SPKI_PEM,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' });

    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: signed,
        verifySignature: true,
        trustedPublicKey: 'bm90LWEta2V5',
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' });

    expect(
      verifyPluginArtifact({
        bytes: BYTES,
        assignment: {
          ...makeAssignment(),
          signatureBase64: Buffer.alloc(8).toString('base64'),
        },
        verifySignature: true,
        trustedPublicKey: SPKI_PEM,
      })
    ).toMatchObject({ ok: false, code: 'ENT_ARTIFACT_INTEGRITY_FAILED' });
  });

  it('契约 fixture 的分配可通过大小与 sha256 校验（验签关闭）', () => {
    const verdict = verifyPluginArtifact({
      bytes: Buffer.alloc(FIXTURE_ASSIGNMENT.sizeBytes, 0),
      assignment: {
        ...FIXTURE_ASSIGNMENT,
        sha256: sha256Hex(Buffer.alloc(FIXTURE_ASSIGNMENT.sizeBytes, 0)),
      },
      verifySignature: false,
    });
    expect(verdict).toEqual({ ok: true });
  });
});

// ---------- assignments：四种动作 ----------

function fact(version: string, sha256: string): InstalledPluginFact {
  return { version, sha256 };
}

describe('planMarketActions', () => {
  const assignment = makeAssignment();

  it('未装 → INSTALL；已装不一致 → UPGRADE；一致 → NONE', () => {
    expect(planMarketActions([assignment], new Map())[0]).toMatchObject({
      action: 'INSTALL',
      installed: null,
    });
    expect(
      planMarketActions(
        [assignment],
        new Map([[assignment.packageName, fact('1.0.0', assignment.sha256)]])
      )[0]
    ).toMatchObject({ action: 'UPGRADE' });
    expect(
      planMarketActions(
        [assignment],
        new Map([
          [assignment.packageName, fact(assignment.version, 'c'.repeat(64))],
        ])
      )[0]
    ).toMatchObject({ action: 'UPGRADE' });
    expect(
      planMarketActions(
        [assignment],
        new Map([
          [assignment.packageName, fact(assignment.version, assignment.sha256)],
        ])
      )[0]
    ).toMatchObject({ action: 'NONE' });
  });

  it('显式 ABSENT 且已装 → UNINSTALL；未见安装 → NONE', () => {
    const absent = makeAssignment({
      desiredState: 'ABSENT',
      downloadUrl: null,
    });
    expect(
      planMarketActions(
        [absent],
        new Map([[absent.packageName, fact('1.2.3', 'd'.repeat(64))]])
      )[0]
    ).toMatchObject({ action: 'UNINSTALL' });
    expect(planMarketActions([absent], new Map())[0]).toMatchObject({
      action: 'NONE',
    });
  });

  it('核心包降级 NONE 并给出阻塞原因', () => {
    const core = makeAssignment({ packageName: '@dshent/ui' });
    const entry = planMarketActions([core], new Map())[0] as MarketEntry;
    expect(entry.action).toBe('NONE');
    expect(entry.blockedReason).toBeTruthy();
  });

  it('需要下载而 downloadUrl 为 null 时降级 NONE 并给出阻塞原因', () => {
    const blocked = makeAssignment({ downloadUrl: null });
    expect(planMarketActions([blocked], new Map())[0]).toMatchObject({
      action: 'NONE',
      blockedReason: expect.any(String),
    });
    expect(
      planMarketActions(
        [blocked],
        new Map([[blocked.packageName, fact('1.0.0', blocked.sha256)]])
      )[0]
    ).toMatchObject({ action: 'NONE', blockedReason: expect.any(String) });
    // 已经与中心一致时不算阻塞，避免噪声掩盖真实问题。
    const satisfied = planMarketActions(
      [blocked],
      new Map([[blocked.packageName, fact(blocked.version, blocked.sha256)]])
    )[0];
    expect(satisfied?.action).toBe('NONE');
    expect(satisfied?.blockedReason).toBeUndefined();
  });

  it('不在 assignments 中的本地包一律不动', () => {
    const installed = new Map([
      ['@example/acme-tools', fact('1.2.3', assignment.sha256)],
      ['@example/local-only', fact('9.9.9', 'e'.repeat(64))],
    ]);
    const entries = planMarketActions([assignment], installed);
    expect(entries.map((entry) => entry.assignment.packageName)).toEqual([
      '@example/acme-tools',
    ]);
    expect(entries.every((entry) => entry.action !== 'UNINSTALL')).toBe(true);
  });

  it('保持入参顺序且不改写入参', () => {
    const first = makeAssignment({ packageName: '@example/a' });
    const second = makeAssignment({
      packageName: '@example/b',
      desiredState: 'ABSENT',
    });
    const assignments = [first, second];
    const entries = planMarketActions(assignments, new Map());
    expect(entries.map((entry) => entry.assignment.packageName)).toEqual([
      '@example/a',
      '@example/b',
    ]);
    expect(assignments[1]).toEqual(second);
    expect(Object.isFrozen(entries)).toBe(false);
  });
});

// ---------- installer：执行器 ----------

interface PortCall {
  argv: readonly string[];
  cwd: string;
  cwdExisted: boolean;
}

class FakePort implements PluginCommandPort {
  readonly calls: PortCall[] = [];
  maxConcurrent = 0;
  private active = 0;
  private readonly shouldFail: (argv: readonly string[]) => boolean;

  constructor(shouldFail: (argv: readonly string[]) => boolean = () => false) {
    this.shouldFail = shouldFail;
  }

  async run(argv: readonly string[], cwd: string): Promise<void> {
    this.active += 1;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.active);
    try {
      this.calls.push({ argv: [...argv], cwd, cwdExisted: existsSync(cwd) });
      await new Promise((resolve) => {
        setTimeout(resolve, 1);
      });
      if (this.shouldFail(argv))
        throw new Error('dshent plugin command failed');
    } finally {
      this.active -= 1;
    }
  }
}

function entryFor(
  assignment: EnterprisePluginAssignment,
  action: MarketEntry['action'],
  installed: InstalledPluginFact | null = null
): MarketEntry {
  return { assignment, installed, action };
}

function installerWith(options: {
  port: FakePort;
  download?: (assignment: EnterprisePluginAssignment) => Promise<Uint8Array>;
  verifySignature?: boolean;
  trustedPublicKey?: string;
  marketInstallEnabled?: boolean;
}): EnterprisePluginInstaller {
  return new EnterprisePluginInstaller({
    command: options.port,
    profile: 'web',
    dshCommand: 'dsh',
    download: options.download ?? (async () => BYTES),
    verifySignature: options.verifySignature ?? false,
    ...(options.trustedPublicKey === undefined
      ? {}
      : { trustedPublicKey: options.trustedPublicKey }),
    marketInstallEnabled: options.marketInstallEnabled ?? true,
  });
}

describe('EnterprisePluginInstaller', () => {
  it('argv 构造器与宿主 CLI 约定同形', () => {
    expect([...installPluginArguments('web', '/tmp/acme.tgz')]).toEqual([
      'plugin',
      '--profile',
      'web',
      'add',
      '--ignore-scripts',
      '--save-exact',
      '/tmp/acme.tgz',
    ]);
    expect([...removePluginArguments('web', '@example/acme-tools')]).toEqual([
      'plugin',
      '--profile',
      'web',
      'remove',
      '@example/acme-tools',
    ]);
  });

  it('安装 happy path：argv 复用宿主 CLI 形态，tgz 在 finally 清理', async () => {
    const port = new FakePort();
    const installer = installerWith({ port });
    const result = await installer.apply([
      entryFor(makeAssignment(), 'INSTALL'),
    ]);

    expect(result).toEqual({
      applied: ['@example/acme-tools'],
      skipped: [],
      failures: [],
    });
    expect(port.calls).toHaveLength(1);
    const call = port.calls[0] as PortCall;
    const artifactPath = call.argv[call.argv.length - 1] as string;
    expect([...call.argv]).toEqual([
      'plugin',
      '--profile',
      'web',
      'add',
      '--ignore-scripts',
      '--save-exact',
      artifactPath,
    ]);
    expect(isAbsolute(artifactPath)).toBe(true);
    expect(artifactPath.startsWith(call.cwd)).toBe(true);
    expect(artifactPath.endsWith('.tgz')).toBe(true);
    expect(call.cwdExisted).toBe(true);
    expect(existsSync(call.cwd)).toBe(false);
    expect(existsSync(artifactPath)).toBe(false);
  });

  it('单条失败不中断其余条目', async () => {
    const port = new FakePort();
    const installer = installerWith({ port });
    const bad = makeAssignment({
      packageName: '@example/bad',
      sha256: 'a'.repeat(64),
    });
    const good = makeAssignment({ packageName: '@example/good' });

    const result = await installer.apply([
      entryFor(bad, 'INSTALL'),
      entryFor(good, 'INSTALL'),
    ]);

    expect(result.failures).toEqual([
      { packageName: '@example/bad', code: 'ENT_ARTIFACT_INTEGRITY_FAILED' },
    ]);
    expect(result.applied).toEqual(['@example/good']);
    expect(port.calls).toHaveLength(1);
    expect(port.calls[0]?.argv).toContain('add');
  });

  it('验签开启但制品未签名时拒绝且不调用命令', async () => {
    const port = new FakePort();
    const installer = installerWith({
      port,
      verifySignature: true,
      trustedPublicKey: SPKI_PEM,
    });
    const result = await installer.apply([
      entryFor(makeAssignment(), 'INSTALL'),
    ]);
    expect(result.failures).toEqual([
      { packageName: '@example/acme-tools', code: 'ENT_ARTIFACT_UNSIGNED' },
    ]);
    expect(port.calls).toHaveLength(0);
  });

  it('验签开启时签名有效才执行命令', async () => {
    const port = new FakePort();
    const installer = installerWith({
      port,
      verifySignature: true,
      trustedPublicKey: SPKI_PEM,
    });
    const result = await installer.apply([
      entryFor(withSignature(makeAssignment()), 'INSTALL'),
    ]);
    expect(result.applied).toEqual(['@example/acme-tools']);
    expect(port.calls).toHaveLength(1);
  });

  it('核心包即使被直接指定动作也拒绝，且不下载', async () => {
    const port = new FakePort();
    let downloads = 0;
    const installer = installerWith({
      port,
      download: async () => {
        downloads += 1;
        return BYTES;
      },
    });
    const result = await installer.apply([
      entryFor(
        makeAssignment({ packageName: '@dshent/plugin-distribution' }),
        'INSTALL'
      ),
    ]);
    expect(result.failures).toEqual([
      {
        packageName: '@dshent/plugin-distribution',
        code: 'ENT_ARTIFACT_CORE_PACKAGE',
      },
    ]);
    expect(downloads).toBe(0);
    expect(port.calls).toHaveLength(0);
  });

  it('downloadUrl 为 null 时拒绝安装', async () => {
    const port = new FakePort();
    let downloads = 0;
    const installer = installerWith({
      port,
      download: async () => {
        downloads += 1;
        return BYTES;
      },
    });
    const result = await installer.apply([
      entryFor(makeAssignment({ downloadUrl: null }), 'INSTALL'),
    ]);
    expect(result.failures).toEqual([
      { packageName: '@example/acme-tools', code: 'ENT_PLUGIN_NOT_ASSIGNED' },
    ]);
    expect(downloads).toBe(0);
  });

  it('市场安装关闭时只跳过新增/升级，仍执行中心显式撤回', async () => {
    const port = new FakePort();
    const installer = installerWith({ port, marketInstallEnabled: false });
    const result = await installer.apply([
      entryFor(makeAssignment({ packageName: '@example/new' }), 'INSTALL'),
      entryFor(makeAssignment({ packageName: '@example/up' }), 'UPGRADE'),
      entryFor(
        makeAssignment({
          packageName: '@example/gone',
          desiredState: 'ABSENT',
          downloadUrl: null,
        }),
        'UNINSTALL',
        fact('1.0.0', 'f'.repeat(64))
      ),
    ]);
    expect(result.applied).toEqual(['@example/gone']);
    expect(result.skipped).toEqual(['@example/new', '@example/up']);
    expect(port.calls).toHaveLength(1);
    expect([...(port.calls[0]?.argv ?? [])]).toEqual([
      'plugin',
      '--profile',
      'web',
      'remove',
      '@example/gone',
    ]);
  });

  it('NONE 与被阻塞条目直接跳过，不做任何 IO', async () => {
    const port = new FakePort();
    let downloads = 0;
    const installer = installerWith({
      port,
      download: async () => {
        downloads += 1;
        return BYTES;
      },
    });
    const blocked: MarketEntry = {
      assignment: makeAssignment({ downloadUrl: null }),
      installed: null,
      action: 'NONE',
      blockedReason: '中心未提供下载地址，无法获取制品',
    };
    const result = await installer.apply([
      entryFor(makeAssignment({ packageName: '@example/same' }), 'NONE'),
      blocked,
    ]);
    expect(result.skipped).toEqual(['@example/same', '@example/acme-tools']);
    expect(result.applied).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(downloads).toBe(0);
    expect(port.calls).toHaveLength(0);
  });

  it('命令失败折叠为 ENT_PLUGIN_COMMAND_FAILED 且清理暂存目录', async () => {
    const port = new FakePort(() => true);
    const installer = installerWith({ port });
    const result = await installer.apply([
      entryFor(makeAssignment(), 'INSTALL'),
    ]);
    expect(result.failures).toEqual([
      { packageName: '@example/acme-tools', code: 'ENT_PLUGIN_COMMAND_FAILED' },
    ]);
    const call = port.calls[0] as PortCall;
    expect(existsSync(call.cwd)).toBe(false);
  });

  it('下载异常保留平台错误码', async () => {
    const port = new FakePort();
    const installer = installerWith({
      port,
      download: async () => {
        throw new EnterprisePlatformError(
          'ENT_PERMISSION_DENIED',
          'plugin is no longer assigned'
        );
      },
    });
    const result = await installer.apply([
      entryFor(makeAssignment(), 'INSTALL'),
    ]);
    expect(result.failures).toEqual([
      { packageName: '@example/acme-tools', code: 'ENT_PERMISSION_DENIED' },
    ]);
    expect(port.calls).toHaveLength(0);
  });

  it('空列表与并发调用：串行执行，绝不并发改动同一 profile', async () => {
    const port = new FakePort();
    const installer = installerWith({ port });
    await expect(installer.apply([])).resolves.toEqual({
      applied: [],
      skipped: [],
      failures: [],
    });

    await Promise.all([
      installer.apply([
        entryFor(makeAssignment({ packageName: '@example/one' }), 'INSTALL'),
      ]),
      installer.apply([
        entryFor(makeAssignment({ packageName: '@example/two' }), 'INSTALL'),
      ]),
    ]);
    expect(port.calls).toHaveLength(2);
    expect(port.maxConcurrent).toBe(1);
  });

  it('profile 名不合法时拒绝构造，避免越出 profile 边界', () => {
    expect(
      () =>
        new EnterprisePluginInstaller({
          command: new FakePort(),
          profile: '../web',
          dshCommand: 'dsh',
          download: async () => BYTES,
          verifySignature: false,
          marketInstallEnabled: true,
        })
    ).toThrow(TypeError);
  });
});
