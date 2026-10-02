/**
 * [INPUT]: 依赖 Node Ed25519/临时文件、可控 Response 流与 plugin-distribution 制品边界
 * [OUTPUT]: 验证默认无签名免公钥、开启验签后的缓存复查、强制大小/hash/兼容性、中断清理与 JCS 向量
 * [POS]: plugin-distribution 的零 CLI 信任回归测试，确保失败制品永远停在激活边界之外
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canonicalizeJson,
  downloadAndVerifyArtifact,
  parseTrustedPluginPublicKey,
  signatureManifest,
  verifyAssignmentMetadata,
  type EnterprisePlatformPort,
  type RuntimePluginAssignment,
} from '../src/index.js'

const HARNESS_COMMIT = '99f6f02fecdb7dff40c3fbc9470f5907c29f74ca'
/** 另一个**已确知**的引擎 commit（官方 Desktop `0.2.0-rc.2` 发行 tag 指向的 commit）。 */
const OTHER_HARNESS_COMMIT = '639ed015397290b3745d163aafe02ffee4aa3f84'
/** 生产库那 5 条制品原始声明的白名单基线（官方 Desktop `0.1.7-rc.2` 的发行 commit）。 */
const BASELINE_COMMIT = '477b4f420553e8a52c2fbccc464d7561b239c443'
const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function home(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'enterprise-plugin-verification-'))
  homes.push(path)
  return path
}

function platform(response: () => Response | Promise<Response>): EnterprisePlatformPort {
  return {
    status: () => ({
      state: 'READY', bundleVersion: '0.1.0', platformUrl: 'https://enterprise.invalid',
      transport: 'webServer.register',
    }),
    bootstrap: () => undefined,
    subscribe: () => () => undefined,
    request: vi.fn(async () => response()),
  }
}

function signedAssignment(
  content: Buffer,
  options: {
    readonly sha256?: string
    readonly signature?: Buffer
    readonly range?: string
    readonly operatingSystems?: ('darwin' | 'linux' | 'win32')[]
  } = {},
): { readonly assignment: RuntimePluginAssignment; readonly publicKey: string } {
  const pair = generateKeyPairSync('ed25519')
  const base: RuntimePluginAssignment = {
    pluginVersionId: '1901300000000000101',
    packageName: '@example/acme-tools',
    version: '1.2.3',
    sizeBytes: content.byteLength,
    sha256: options.sha256 ?? createHash('sha256').update(content).digest('hex'),
    signatureBase64: `${'A'.repeat(86)}==`,
    compatibility: {
      harnessCommits: [HARNESS_COMMIT],
      enterpriseBundleRange: options.range ?? '>=0.1.0 <0.2.0',
      operatingSystems: options.operatingSystems ?? ['darwin', 'linux', 'win32'],
    },
    downloadUrl: '/enterprise/api/v1/plugins/versions/1901300000000000101/download',
    required: true,
    desiredState: 'INSTALLED',
  }
  const signature = options.signature
    ?? sign(null, Buffer.from(canonicalizeJson(signatureManifest(base))), pair.privateKey)
  return {
    assignment: { ...base, signatureBase64: signature.toString('base64') },
    publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  }
}

describe('plugin artifact verification', () => {
  it('downloads and reuses cache without a public key, then enforces enabled signature checks on that cache', async () => {
    const content = Buffer.from('intranet artifact')
    const { assignment, publicKey } = signedAssignment(content, { signature: Buffer.alloc(0) })
    const fake = platform(() => new Response(content))
    const options = {
      platform: fake, assignment, dshHome: await home(),
      harnessCommit: HARNESS_COMMIT, bundleVersion: '0.1.0',
    }
    const path = await downloadAndVerifyArtifact(options)
    await expect(readFile(path)).resolves.toEqual(content)
    await expect(downloadAndVerifyArtifact(options)).resolves.toBe(path)
    await expect(downloadAndVerifyArtifact({ ...options, verifyPluginSignatures: true }))
      .rejects.toMatchObject({ code: 'ENT_PLUGIN_SIGNATURE_INVALID' })
    await expect(downloadAndVerifyArtifact({
      ...options, verifyPluginSignatures: true, trustedPublicKey: parseTrustedPluginPublicKey(publicKey),
    })).rejects.toMatchObject({ code: 'ENT_PLUGIN_SIGNATURE_INVALID' })
    expect(fake.request).toHaveBeenCalledOnce()
  })

  it.each<[string, Partial<RuntimePluginAssignment>, string]>([
    ['hash', { sha256: 'f'.repeat(64) }, 'ENT_PLUGIN_HASH_MISMATCH'],
    ['size', { sizeBytes: 1 }, 'ENT_PLUGIN_SIZE_MISMATCH'],
    ['compatibility', { compatibility: { harnessCommits: [], operatingSystems: ['linux'], enterpriseBundleRange: '*' } }, 'ENT_PLUGIN_INCOMPATIBLE'],
  ])('still rejects invalid %s with signature verification disabled', async (_name, change, code) => {
    const content = Buffer.from('intranet artifact')
    const { assignment } = signedAssignment(content)
    await expect(downloadAndVerifyArtifact({
      platform: platform(() => new Response(content)),
      assignment: { ...assignment, ...change }, dshHome: await home(),
      harnessCommit: HARNESS_COMMIT, bundleVersion: '0.1.0',
    })).rejects.toMatchObject({ code })
  })

  it('orders object keys by UTF-16 code units instead of locale collation', () => {
    expect(canonicalizeJson({ a: 2, Z: 1, '\u{1F600}': 4, '\uFFFD': 3 })).toBe(
      '{"Z":1,"a":2,"😀":4,"�":3}',
    )
  })

  it('matches the Server frozen RFC 8785 signature manifest vector', () => {
    const content = Buffer.alloc(4096)
    const { assignment } = signedAssignment(content, {
      sha256: '0123456789abcdef'.repeat(4),
      operatingSystems: ['darwin', 'linux'],
    })
    expect(canonicalizeJson(signatureManifest(assignment))).toBe(
      '{"artifactId":"1901300000000000101","compatibility":{"enterpriseBundleRange":">=0.1.0 <0.2.0",'
      + `"harnessCommits":["${HARNESS_COMMIT}"],"operatingSystems":["darwin","linux"]},`
      + '"packageName":"@example/acme-tools","sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",'
      + '"sizeBytes":4096,"version":"1.2.3"}',
    )
  })

  it('streams a verified artifact into the hash-addressed final path and revalidates cache metadata', async () => {
    const content = Buffer.from('verified managed plugin tgz')
    const { assignment, publicKey } = signedAssignment(content)
    const request = vi.fn(async () => new Response(content, {
      headers: { 'content-length': String(content.byteLength) },
    }))
    const fake = platform(request)
    const dshHome = await home()
    const options = {
      platform: fake,
      assignment,
      dshHome,
      verifyPluginSignatures: true,
      trustedPublicKey: parseTrustedPluginPublicKey(publicKey),
      harnessCommit: HARNESS_COMMIT,
      bundleVersion: '0.1.0',
      operatingSystem: process.platform,
    } as const
    const path = await downloadAndVerifyArtifact(options)
    expect(path).toBe(join(dshHome, 'enterprise', 'artifacts', `${assignment.sha256}.tgz`))
    await expect(readFile(path)).resolves.toEqual(content)
    await expect(stat(`${path}.part`)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(downloadAndVerifyArtifact(options)).resolves.toBe(path)
    expect(fake.request).toHaveBeenCalledOnce()
  })

  it.each([
    ['hash', { sha256: 'f'.repeat(64) }, 'ENT_PLUGIN_HASH_MISMATCH'],
    ['signature', { signature: Buffer.alloc(64) }, 'ENT_PLUGIN_SIGNATURE_INVALID'],
    ['bundle range', { range: '>=2.0.0' }, 'ENT_PLUGIN_INCOMPATIBLE'],
  ] as const)('rejects an invalid %s and deletes the part file', async (_name, change, code) => {
    const content = Buffer.from('untrusted plugin')
    const { assignment, publicKey } = signedAssignment(content, change)
    const dshHome = await home()
    await expect(downloadAndVerifyArtifact({
      platform: platform(() => new Response(content)),
      assignment,
      dshHome,
      verifyPluginSignatures: true,
      trustedPublicKey: parseTrustedPluginPublicKey(publicKey),
      harnessCommit: HARNESS_COMMIT,
      bundleVersion: '0.1.0',
      operatingSystem: process.platform,
    })).rejects.toMatchObject({ code })
    const part = join(dshHome, 'enterprise', 'artifacts', `${assignment.sha256}.tgz.part`)
    await expect(stat(part)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  // 旧断言（"未验证的引擎 commit ⇒ ENT_PLUGIN_INCOMPATIBLE"）本身就是"每次引擎升级打死整个
  // 企业商城"的病根：不认识某个引擎版本 ≠ 该制品不兼容。此用例保留但按新语义改写为
  // "降级警告 + 照常下载通过"，硬失败边界由下面的已确知-不在白名单/OS/bundleRange 用例把守。
  it('warns instead of blocking when the running Harness commit cannot be verified', async () => {
    const content = Buffer.from('future harness artifact')
    const { assignment, publicKey } = signedAssignment(content)
    const dshHome = await home()
    const warnings: { readonly code: string; readonly message: string }[] = []
    await expect(downloadAndVerifyArtifact({
      platform: platform(() => new Response(content)),
      assignment,
      dshHome,
      verifyPluginSignatures: true,
      trustedPublicKey: parseTrustedPluginPublicKey(publicKey),
      bundleVersion: '0.1.0',
      operatingSystem: process.platform,
      warn: warning => warnings.push(warning),
    })).resolves.toBe(join(dshHome, 'enterprise', 'artifacts', `${assignment.sha256}.tgz`))
    expect(warnings.map(warning => warning.code)).toEqual(['ENT_PLUGIN_HARNESS_COMMIT_UNKNOWN'])
    expect(warnings[0]!.message).toContain(HARNESS_COMMIT)
    await expect(readFile(join(dshHome, 'enterprise', 'artifacts', `${assignment.sha256}.tgz`)))
      .resolves.toEqual(content)
  })

  it('still blocks when a known Harness commit is absent from the artifact whitelist', async () => {
    const content = Buffer.from('unknown commit artifact')
    const { assignment } = signedAssignment(content)
    await expect(downloadAndVerifyArtifact({
      platform: platform(() => new Response(content)),
      assignment,
      dshHome: await home(),
      harnessCommit: OTHER_HARNESS_COMMIT,
      bundleVersion: '0.1.0',
      operatingSystem: process.platform,
    })).rejects.toMatchObject({ code: 'ENT_PLUGIN_INCOMPATIBLE' })
  })

  it('still blocks an artifact that does not declare this operating system', async () => {
    const content = Buffer.from('darwin only artifact')
    const { assignment } = signedAssignment(content, { operatingSystems: ['darwin'] })
    const context = {
      harnessCommit: HARNESS_COMMIT,
      bundleVersion: '0.1.0',
      operatingSystem: 'linux' as NodeJS.Platform,
    }
    expect(() => verifyAssignmentMetadata(assignment, undefined, context)).toThrowError(
      expect.objectContaining({ code: 'ENT_PLUGIN_INCOMPATIBLE' }),
    )
    await expect(downloadAndVerifyArtifact({
      platform: platform(() => new Response(content)),
      assignment,
      dshHome: await home(),
      ...context,
    })).rejects.toMatchObject({ code: 'ENT_PLUGIN_INCOMPATIBLE' })
  })

  it('verifies a mapped Harness commit without any warning', () => {
    const content = Buffer.from('mapped commit artifact')
    const { assignment } = signedAssignment(content)
    expect(verifyAssignmentMetadata(assignment, undefined, {
      harnessCommit: HARNESS_COMMIT, bundleVersion: '0.1.0', operatingSystem: 'linux',
    })).toEqual([])
    // android 归一化为 linux：同一条白名单命中，且仍然零警告。
    expect(verifyAssignmentMetadata(assignment, undefined, {
      harnessCommit: HARNESS_COMMIT, bundleVersion: '0.1.0', operatingSystem: 'android',
    })).toEqual([])
  })

  it('accepts every enterprise catalog row from the real 0.2.0-rc.2 commit backfill', () => {
    // 生产库 ent_plugin_version 的 6 行 compatibility 原文（2026-10-02 补齐 harnessCommits 之后）。
    // 这直接复刻验收条件：真机引擎 0.2.0-rc.2 -> commit 639ed015…、真机 process.platform='android'
    // （判定侧归一化为 linux）、企业 bundle 版本 0.1.0，六条必须全部零抛错零警告。
    const rows: readonly (readonly [string, string, readonly string[]])[] = [
      ['@furayoshi/dsh-ui-models-invert-selection', '1.0.1', [BASELINE_COMMIT, OTHER_HARNESS_COMMIT]],
      ['@mengli114/dsh-settings-nav-collapse', '1.0.1', [BASELINE_COMMIT, OTHER_HARNESS_COMMIT]],
      ['dsh-i-have-adhd', '1.0.2', [BASELINE_COMMIT, OTHER_HARNESS_COMMIT]],
      ['dsh-turnsnap', '1.0.0', [BASELINE_COMMIT, OTHER_HARNESS_COMMIT]],
      ['dsh-yorha-ui', '0.1.1', [BASELINE_COMMIT, OTHER_HARNESS_COMMIT]],
      ['owndsh-test-hello', '0.1.0', [OTHER_HARNESS_COMMIT, 'a66e4702047846cdaa10c66c9d3df3951f5ea70d',
        'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e']],
    ]
    const base = signedAssignment(Buffer.from('catalog row')).assignment
    for (const [packageName, version, harnessCommits] of rows) {
      expect(verifyAssignmentMetadata({
        ...base,
        packageName,
        version,
        compatibility: {
          harnessCommits: [...harnessCommits],
          enterpriseBundleRange: '>=0.1.0 <0.2.0',
          operatingSystems: ['darwin', 'linux', 'win32'],
        },
      }, undefined, {
        harnessCommit: OTHER_HARNESS_COMMIT, bundleVersion: '0.1.0', operatingSystem: 'android',
      }), packageName).toEqual([])
    }
  })

  it('warns without blocking when the Harness commit is unknown, and the warning carries the verified set', () => {
    const content = Buffer.from('unmapped engine artifact')
    const { assignment } = signedAssignment(content)
    const warnings = verifyAssignmentMetadata(assignment, undefined, {
      bundleVersion: '0.1.0', operatingSystem: 'linux',
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ code: 'ENT_PLUGIN_HARNESS_COMMIT_UNKNOWN' })
    expect(warnings[0]!.message).toContain('cannot be confirmed')
    expect(warnings[0]!.message).toContain(HARNESS_COMMIT)
  })

  it('removes an interrupted partial download without producing a final artifact', async () => {
    const content = Buffer.from('four')
    const { assignment, publicKey } = signedAssignment(content)
    const interrupted = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(content.subarray(0, 2))
        controller.error(new Error('connection interrupted'))
      },
    })
    const dshHome = await home()
    await expect(downloadAndVerifyArtifact({
      platform: platform(() => new Response(interrupted)),
      assignment,
      dshHome,
      verifyPluginSignatures: true,
      trustedPublicKey: parseTrustedPluginPublicKey(publicKey),
      harnessCommit: HARNESS_COMMIT,
      bundleVersion: '0.1.0',
      operatingSystem: process.platform,
    })).rejects.toMatchObject({ code: 'ENT_PLUGIN_DOWNLOAD_FAILED' })
    const base = join(dshHome, 'enterprise', 'artifacts', assignment.sha256)
    await expect(stat(`${base}.tgz.part`)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(`${base}.tgz`)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
