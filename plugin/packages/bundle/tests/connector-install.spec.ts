/**
 * [INPUT]: 依赖 node:fs/promises/node:path、vitest，以及 src/connector 的安装段与 tests/connector-support 的假端口夹具
 * [OUTPUT]: 用**假安装端口**覆盖官方安装面的一切内部分支——成功（hot / restart-required）、幂等（同配置不重装）、配置变了真重装（并按官方 `:1801` 如实回「要新会话」）、进行中拒绝、失败不禁用、官方抛错与官方 failed/cancelled、描述符非法时**端口零调用**、清单损坏 fail-closed；卸载与 `node_modules` link 残壳清理的三道 fail-closed；官方端口投影与两个 ctx 取值器；以及**未验证项被显式透出**（`toolAvailability` 恒 `proven-by-contract`；`hot` ⇒ `needsNewSession: false`，因为「行已挂进运行中的会话」与「工具已注册」两条都已由官方代码判明）
 * [POS]: 连接器纵深「安装/卸载」段门禁 —— 本刀不把真官方安装面接进 vitest（那要另起 Host 与临时 profile）；真安装由 `docs/plan/connector-architecture.md` §8.3 第 1 条那条 spike 在有 JDK/真机的一侧跑，这里锁编排语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { lstat, mkdir, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL,
  EnterpriseConnectorError,
  cleanConnectorBundleLink,
  connectorBundlePackageName,
  connectorBundleRoot,
  connectorLinkExists,
  connectorLinkPath,
  connectorPluginManagerFromContext,
  connectorProfileDirFromContext,
  createEnterpriseConnectorInstall,
  officialConnectorInstallPort,
  officialConnectorInstallPortFromContext,
  readInstalledConnectors,
  renderConnectorBundle,
  writeInstalledConnectors,
} from '../src/connector/index.js'
import {
  appliedConnectorResult,
  cleanupConnectorHomes,
  connectorDescriptorFixture,
  createFakeConnectorPort,
  makeConnectorHome,
} from './connector-support.js'

const PACKAGE_NAME = 'dsh-ent-connector-ent-demo'

afterEach(cleanupConnectorHomes)

async function makeRig(descriptor = connectorDescriptorFixture()) {
  const dshHome = await makeConnectorHome()
  const profileDir = join(dshHome, 'profile')
  await mkdir(join(profileDir, 'node_modules'), { recursive: true, mode: 0o700 })
  const fake = createFakeConnectorPort({ profileDir })
  const errors: { message: string; error: unknown }[] = []
  const installer = createEnterpriseConnectorInstall({
    dshHome,
    profileDir,
    port: fake.port,
    onError: (message, error) => { errors.push({ message, error }) },
  })
  return { dshHome, profileDir, fake, installer, errors, descriptor }
}

function statePath(dshHome: string): string {
  return join(dshHome, 'enterprise', 'connector-installs', 'installed.json')
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('condition was never met')
}

describe('connector official install port', () => {
  it('projects a full official ChangeResult field by field', async () => {
    const seen: unknown[] = []
    const port = officialConnectorInstallPort({
      async installBundle(spec, options) {
        seen.push({ spec, options })
        return {
          target: 'dsh-ent-connector-ent-demo',
          changed: true,
          application: 'restart-required',
          stage: 'enable',
          enabled: true,
          warnings: ['a', 7, 'b'],
          failedAt: 'registry',
          error: { code: 'pnpm-failed', diagnostic: 'x'.repeat(600), extra: 'dropped' },
        }
      },
      async removeBundle() { return {} },
    })
    const result = await port.installBundle('/some/dir', { enabled: true })
    expect(seen).toEqual([{ spec: '/some/dir', options: { enabled: true } }])
    expect(result).toEqual({
      target: 'dsh-ent-connector-ent-demo',
      changed: true,
      application: 'restart-required',
      stage: 'enable',
      enabled: true,
      warnings: ['a', 'b'],
      failedAt: 'registry',
      // 诊断超 512 字一律丢（官方自由文本不落我们的结果对象），码形状不合则丢码。
      error: { code: 'pnpm-failed' },
    })
  })

  it('never fabricates what the official result did not say', async () => {
    const port = officialConnectorInstallPort({
      async installBundle() { return { target: 't' } },
      async removeBundle() { return 'not-an-object' },
    })
    // 缺 `application` ⇒ 判 failed（fail-closed，不默认成 applied）；`changed` 缺失不伪造为 true。
    expect(await port.installBundle('/x')).toEqual({ target: 't', changed: false, application: 'failed' })
    // 非对象结果 ⇒ 只留 target 与 failed。
    expect(await port.removeBundle('pkg')).toEqual({ target: 'pkg', changed: false, application: 'failed' })
  })

  it('narrows an illegal official error code away instead of trusting it', async () => {
    const port = officialConnectorInstallPort({
      async installBundle() { return { application: 'failed', error: { code: 'Bad Code!', diagnostic: 'ok' } } },
      async removeBundle() { return {} },
    })
    expect(await port.installBundle('/x')).toEqual({
      target: '/x',
      changed: false,
      application: 'failed',
      error: { diagnostic: 'ok' },
    })
  })

  it('refuses a manager that does not expose both methods', () => {
    try {
      officialConnectorInstallPort({ installBundle: () => undefined } as never)
      expect.unreachable('a half manager must be refused')
    } catch (error) {
      expect(error).toBeInstanceOf(EnterpriseConnectorError)
      expect((error as EnterpriseConnectorError).code).toBe('ENT_INVALID_REQUEST')
    }
    expect(connectorPluginManagerFromContext({ get: () => ({ installBundle: () => undefined }) })).toBeUndefined()
    expect(connectorPluginManagerFromContext({ get: () => undefined })).toBeUndefined()
  })

  it('reads the manager and profile dir off a ctx, fail-closed when absent', () => {
    const manager = { installBundle: async () => ({}), removeBundle: async () => ({}) }
    expect(connectorPluginManagerFromContext({ get: name => name === 'pluginManager' ? manager : undefined })).toBe(manager)
    expect(officialConnectorInstallPortFromContext({ get: () => undefined })).toBeUndefined()
    expect(officialConnectorInstallPortFromContext({ get: () => manager })).toBeDefined()
    expect(connectorProfileDirFromContext({ get: () => ({ dir: '/p' }) })).toBe('/p')
    expect(connectorProfileDirFromContext({ get: () => ({ dir: '' }) })).toBeUndefined()
    expect(connectorProfileDirFromContext({ get: () => undefined })).toBeUndefined()
  })
})

describe('connector install', () => {
  it('installs through the injected port, records private state and stays honest about the unmeasured bit', async () => {
    const rig = await makeRig()
    const rendered = renderConnectorBundle(rig.descriptor)
    const result = await rig.installer.install(rig.descriptor)
    expect(result).toMatchObject({
      ok: true,
      connectorId: 'ent-demo',
      application: 'hot',
      officialApplication: 'applied',
      installedNames: [PACKAGE_NAME],
      toolNamePrefix: 'mcp__ent-demo__',
      digest: rendered.digest,
      // ★ 官方 applied = 现场有 HMR = 这行已挂进运行中的会话（官方 `plugin-manager:2042`/`:1801` + README `:67`）
      //   ⇒ **不需要**新会话；且 `reconcileProfilePatches` 等整棵树就绪、新行 pending/failed 即抛
      //   而 mcp-client 的 activation 定义里就含"发布初始工具代" ⇒ 返回时工具**已注册**（契约结论）。
      needsNewSession: false,
      toolAvailability: 'proven-by-contract',
    })
    expect(result.alreadyInstalled).toBeUndefined()
    // 合成段回的是 **realpath**（Android 上 `/data/data` ↔ `/data/user/0`），故比对也要走 realpath。
    const root = await realpath(connectorBundleRoot({ dshHome: rig.dshHome }))
    expect(rig.fake.installCalls).toHaveLength(1)
    expect(rig.fake.installCalls[0]).toBe(join(root, 'ent-demo', rendered.digest))

    const records = await readInstalledConnectors({ dshHome: rig.dshHome })
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      connectorId: 'ent-demo',
      serverName: 'ent-demo',
      displayName: '示例连接器',
      packageName: PACKAGE_NAME,
      digest: rendered.digest,
      officialApplication: 'applied',
    })
    expect(Number.isFinite(Date.parse(records[0]!.installedAt))).toBe(true)
  })

  it('does not leak endpoint or credential details into the private ledger', async () => {
    const rig = await makeRig()
    await rig.installer.install(rig.descriptor)
    const raw = await readFile(statePath(rig.dshHome), 'utf8')
    // 落盘的是脱敏事实：命令、参数、env 键名、url 一律不进清单。
    expect(raw).not.toContain('npx')
    expect(raw).not.toContain('DEMO_TOKEN')
    expect(raw).not.toContain('ENT_DEMO_TOKEN')
    expect(raw).not.toContain('mobile-mcp')
  })

  it('carries restart-required through verbatim', async () => {
    const rig = await makeRig()
    rig.fake.installResult = appliedConnectorResult(PACKAGE_NAME, 'restart-required')
    const result = await rig.installer.install(rig.descriptor)
    expect(result).toMatchObject({
      ok: true,
      application: 'restart-required',
      officialApplication: 'restart-required',
      needsNewSession: true,
      toolAvailability: 'proven-by-contract',
    })
    expect((await readInstalledConnectors({ dshHome: rig.dshHome }))[0]?.officialApplication).toBe('restart-required')
  })

  it('is idempotent: same configuration twice installs once', async () => {
    const rig = await makeRig()
    const first = await rig.installer.install(rig.descriptor)
    const second = await rig.installer.install(rig.descriptor)
    expect(first.ok).toBe(true)
    expect(second).toMatchObject({
      ok: true,
      alreadyInstalled: true,
      application: 'hot',
      installedNames: [PACKAGE_NAME],
      needsNewSession: false,
      toolAvailability: 'proven-by-contract',
    })
    expect(rig.fake.installCalls).toHaveLength(1)
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(1)
  })

  it('re-installs for real when the configuration changed, replacing the single record', async () => {
    const rig = await makeRig()
    await rig.installer.install(rig.descriptor)
    const changed = connectorDescriptorFixture({
      endpoint: { transport: 'stdio', command: 'npx', args: ['-y', 'other-mcp@latest'] },
    })
    // ★ 真实官方行为：**首次**装是热的；**换配置**时包名已在 manifest 里，`:1801` 直接回 `restart-required`
    //   ⇒ 我们原样透出并如实回"要新会话"，不自己猜（这条与上一条 hot 用例互为对照）。
    rig.fake.installResult = appliedConnectorResult(PACKAGE_NAME, 'restart-required')
    const result = await rig.installer.install(changed)
    expect(result).toMatchObject({
      ok: true,
      application: 'restart-required',
      officialApplication: 'restart-required',
      needsNewSession: true,
    })
    expect(rig.fake.installCalls).toHaveLength(2)
    const records = await readInstalledConnectors({ dshHome: rig.dshHome })
    expect(records).toHaveLength(1)
    expect(records[0]?.digest).toBe(renderConnectorBundle(changed).digest)
    expect(records[0]?.digest).not.toBe(renderConnectorBundle(rig.descriptor).digest)
  })

  it('re-installs when the bundle directory was linked away (no false idempotency)', async () => {
    const rig = await makeRig()
    await rig.installer.install(rig.descriptor)
    await rm(connectorLinkPath(rig.profileDir, PACKAGE_NAME), { force: true, recursive: true })
    const again = await rig.installer.install(rig.descriptor)
    expect(again.alreadyInstalled).toBeUndefined()
    expect(rig.fake.installCalls).toHaveLength(2)
  })

  it('refuses a second click while one is in flight, then succeeds when it settles', async () => {
    const rig = await makeRig()
    let release = (): void => {}
    rig.fake.installGate = new Promise<void>(resolve => { release = resolve })
    const first = rig.installer.install(rig.descriptor)
    await waitFor(() => rig.fake.installCalls.length === 1)
    const busy = await rig.installer.install(rig.descriptor)
    expect(busy).toMatchObject({ ok: false, errorCode: 'ENT_CONNECTOR_INSTALL_IN_PROGRESS', needsNewSession: false })
    expect(rig.installer.busy('ent-demo')).toBe(true)
    expect(rig.installer.busy()).toBe(true)
    expect((await rig.installer.status()).busy).toEqual(['ent-demo'])
    release()
    expect((await first).ok).toBe(true)
    expect(rig.installer.busy('ent-demo')).toBe(false)
  })

  it('keeps the door open after a failure (failure never disables the connector)', async () => {
    const rig = await makeRig()
    rig.fake.installError = new Error('official blew up')
    const failed = await rig.installer.install(rig.descriptor)
    expect(failed).toMatchObject({ ok: false, errorCode: 'ENT_CONNECTOR_INSTALL_FAILED', officialApplication: 'failed' })
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(0)
    expect(rig.errors.map(item => item.message)).toContain('connector bundle install failed')
    rig.fake.installError = undefined
    expect((await rig.installer.install(rig.descriptor)).ok).toBe(true)
  })

  it('maps an official failed result to the same stable code and surfaces only the official code', async () => {
    const rig = await makeRig()
    rig.fake.installResult = {
      ...appliedConnectorResult(PACKAGE_NAME, 'failed'),
      error: { code: 'pnpm-exit-1', diagnostic: 'secret log line' },
    }
    const result = await rig.installer.install(rig.descriptor)
    expect(result).toMatchObject({ ok: false, errorCode: 'ENT_CONNECTOR_INSTALL_FAILED', officialError: { code: 'pnpm-exit-1' } })
    // 诊断正文**不进**结果对象（只进 onError 的原始 error）。
    expect(JSON.stringify(result)).not.toContain('secret log line')
  })

  it('separates cancellation from failure', async () => {
    const rig = await makeRig()
    rig.fake.installResult = appliedConnectorResult(PACKAGE_NAME, 'cancelled')
    expect(await rig.installer.install(rig.descriptor))
      .toMatchObject({ ok: false, errorCode: 'ENT_CONNECTOR_INSTALL_CANCELLED', officialApplication: 'cancelled' })
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(0)
  })

  it('rejects a descriptor that is not installable and never touches the install face', async () => {
    const rig = await makeRig()
    const bad = { ...connectorDescriptorFixture(), id: 'ENT-DEMO' } as never
    const result = await rig.installer.install(bad)
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('ENT_CONNECTOR_DECLARATION_INVALID')
    expect(result.connectorId).toBe('ENT-DEMO')
    expect(rig.fake.installCalls).toHaveLength(0)
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(0)
  })

  it('rejects an inline credential before anything reaches disk', async () => {
    const rig = await makeRig()
    const inline = connectorDescriptorFixture({
      endpoint: {
        transport: 'stdio',
        command: 'npx',
        // 明文值：形状非法（`value` 不是引用），必须在合成前就被拒。
        env: [{ name: 'DEMO_TOKEN', key: 'ENT_DEMO_TOKEN', value: 'super-secret' } as never],
      },
    })
    const result = await rig.installer.install(inline)
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('ENT_CONNECTOR_SECRET_INLINE')
    expect(rig.fake.installCalls).toHaveLength(0)
    expect(JSON.stringify(result)).not.toContain('super-secret')
  })

  it('fails closed on a corrupt ledger instead of treating it as empty', async () => {
    const rig = await makeRig()
    await mkdir(join(rig.dshHome, 'enterprise', 'connector-installs'), { recursive: true, mode: 0o700 })
    await writeFile(statePath(rig.dshHome), '{ not json', 'utf8')
    await expect(rig.installer.install(rig.descriptor)).rejects.toThrowError(/not valid JSON/)
    expect(rig.fake.installCalls).toHaveLength(0)
  })

  it('rejects a record whose key set or fields drifted', async () => {
    const rig = await makeRig()
    const good = {
      connectorId: 'ent-demo',
      serverName: 'ent-demo',
      displayName: '示例连接器',
      packageName: PACKAGE_NAME,
      bundleDir: join(rig.dshHome, 'enterprise', 'connector-bundles', 'ent-demo', 'a'.repeat(64)),
      digest: 'a'.repeat(64),
      version: '1.0.0',
      installedAt: '2026-10-06T00:00:00.000Z',
      officialApplication: 'applied',
    }
    await writeInstalledConnectors({ dshHome: rig.dshHome }, [good])
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(1)
    // 多一个键即判损坏。
    await mkdir(join(rig.dshHome, 'enterprise', 'connector-installs'), { recursive: true, mode: 0o700 })
    await writeFile(statePath(rig.dshHome), JSON.stringify({ records: [{ ...good, extra: 1 }] }), 'utf8')
    await expect(readInstalledConnectors({ dshHome: rig.dshHome })).rejects.toThrowError(/invalid fields/)
    // 包名必须与连接器 id 同源（不能被别的记录顶替）。
    await writeFile(statePath(rig.dshHome), JSON.stringify({ records: [{ ...good, packageName: 'dsh-ent-connector-other' }] }), 'utf8')
    await expect(readInstalledConnectors({ dshHome: rig.dshHome })).rejects.toThrowError(/invalid fields/)
  })
})

describe('connector uninstall', () => {
  it('removes through the official face, then clears the node_modules shell the official face leaves', async () => {
    const rig = await makeRig()
    await rig.installer.install(rig.descriptor)
    expect(await connectorLinkExists(rig.profileDir, PACKAGE_NAME)).toBe(true)
    const result = await rig.installer.uninstall('ent-demo')
    expect(result).toMatchObject({ ok: true, removedNames: [PACKAGE_NAME], linkRemoved: true, application: 'hot' })
    expect(rig.fake.removeCalls).toEqual([PACKAGE_NAME])
    expect(await connectorLinkExists(rig.profileDir, PACKAGE_NAME)).toBe(false)
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(0)
  })

  it('reports a missing install as not-found and never calls the official face', async () => {
    const rig = await makeRig()
    expect(await rig.installer.uninstall('ent-demo')).toMatchObject({ ok: false, errorCode: 'ENT_RESOURCE_NOT_FOUND' })
    expect(await rig.installer.uninstall('ENT-DEMO')).toMatchObject({ ok: false, errorCode: 'ENT_INVALID_REQUEST' })
    expect(rig.fake.removeCalls).toHaveLength(0)
  })

  it('keeps the record when removal fails, so the click can be retried', async () => {
    const rig = await makeRig()
    await rig.installer.install(rig.descriptor)
    rig.fake.removeError = new Error('official remove blew up')
    expect(await rig.installer.uninstall('ent-demo'))
      .toMatchObject({ ok: false, errorCode: 'ENT_CONNECTOR_UNINSTALL_FAILED', linkRemoved: false })
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(1)
    expect(rig.errors.map(item => item.message)).toContain('connector bundle removal failed')
    rig.fake.removeError = undefined
    rig.fake.removeResult = appliedConnectorResult('x', 'failed')
    expect((await rig.installer.uninstall('ent-demo')).errorCode).toBe('ENT_CONNECTOR_UNINSTALL_FAILED')
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(1)
    rig.fake.removeResult = appliedConnectorResult(PACKAGE_NAME)
    expect((await rig.installer.uninstall('ent-demo')).ok).toBe(true)
    expect(await readInstalledConnectors({ dshHome: rig.dshHome })).toHaveLength(0)
  })

  it('refuses to uninstall while an install of the same connector is in flight', async () => {
    const rig = await makeRig()
    let release = (): void => {}
    rig.fake.installGate = new Promise<void>(resolve => { release = resolve })
    const installing = rig.installer.install(rig.descriptor)
    await waitFor(() => rig.fake.installCalls.length === 1)
    expect(await rig.installer.uninstall('ent-demo'))
      .toMatchObject({ ok: false, errorCode: 'ENT_CONNECTOR_INSTALL_IN_PROGRESS' })
    release()
    await installing
  })
})

describe('connector bundle link cleanup', () => {
  it('removes only a symlink that resolves inside our own bundle root', async () => {
    const rig = await makeRig()
    const ourDir = join(connectorBundleRoot({ dshHome: rig.dshHome }), 'ent-demo', 'b'.repeat(64))
    const linkPath = connectorLinkPath(rig.profileDir, PACKAGE_NAME)
    await symlink(ourDir, linkPath)
    expect(await cleanConnectorBundleLink({ dshHome: rig.dshHome, profileDir: rig.profileDir }, PACKAGE_NAME))
      .toEqual({ removed: true, reason: 'removed' })
    expect(await lstat(linkPath).catch(() => undefined)).toBeUndefined()
  })

  it('leaves a foreign symlink, a real directory and an absent link alone', async () => {
    const rig = await makeRig()
    const linkPath = connectorLinkPath(rig.profileDir, PACKAGE_NAME)
    const elsewhere = join(rig.dshHome, 'elsewhere')
    await mkdir(elsewhere, { recursive: true, mode: 0o700 })
    await symlink(elsewhere, linkPath)
    expect(await cleanConnectorBundleLink({ dshHome: rig.dshHome, profileDir: rig.profileDir }, PACKAGE_NAME))
      .toEqual({ removed: false, reason: 'foreign-target' })
    expect((await readlink(linkPath)).endsWith('elsewhere')).toBe(true)

    await rm(linkPath, { force: true })
    await mkdir(linkPath, { recursive: true, mode: 0o700 })
    expect(await cleanConnectorBundleLink({ dshHome: rig.dshHome, profileDir: rig.profileDir }, PACKAGE_NAME))
      .toEqual({ removed: false, reason: 'not-a-symbolic-link' })
    expect(await lstat(linkPath)).toBeDefined()

    await rm(linkPath, { force: true, recursive: true })
    expect(await cleanConnectorBundleLink({ dshHome: rig.dshHome, profileDir: rig.profileDir }, PACKAGE_NAME))
      .toEqual({ removed: false, reason: 'absent' })
  })

  it('refuses an illegal package name before touching the filesystem', async () => {
    const rig = await makeRig()
    await expect(cleanConnectorBundleLink({ dshHome: rig.dshHome, profileDir: rig.profileDir }, '../evil'))
      .rejects.toThrowError(/package name is invalid/)
  })

  it('is exported as the connector-side bundle package name', () => {
    expect(connectorBundlePackageName('ent-demo')).toBe(PACKAGE_NAME)
    expect(CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL).toBe('proven-by-contract')
  })
})

describe('connector install status', () => {
  it('reports what is installed and who is busy', async () => {
    const rig = await makeRig()
    expect(await rig.installer.status()).toEqual({ installs: [], busy: [] })
    await rig.installer.install(rig.descriptor)
    const status = await rig.installer.status()
    expect(status.installs.map(item => item.connectorId)).toEqual(['ent-demo'])
    expect(status.busy).toEqual([])
  })
  /**
   * **随机序列审计（确定性种子，120×8=960 次操作）**：单格枚举只能证明"每个分支单独对"，状态机的错往往在**乱序**里。
   * 这里跑 120 条种子 × 8 步（=960 次操作），每步随机选 install(三种变体之一) / uninstall / status，
   * 并随机让假端口成功、抛错、回 `failed`、回 `cancelled`；每步后检查四条**记账不变量**：
   *
   * ① 同一个 `connectorId` 至多一条记录（绝无重复）；
   * ② `status().installs` 与模型一致（成功装 ⇒ 一条；成功卸 ⇒ 零条；失败/取消 ⇒ 不变）；
   * ③ **失败的 install 不许改动账**（含"覆盖已有记录时失败"——旧记录必须原样留着）；
   * ④ 有记录时，记录里的 `digest` 必须等于**最后一次成功安装**那一份的摘要（账记的得是真正装上去的东西）。
   *
   * 种子固定 ⇒ 失败可复现；种子范围、步数与"违例为空"都写进断言。（本用例显式给 30s 超时：它比别的用例重。）
   */
  it('随机序列审计：120 种子 × 8 步，四条记账不变量零违例', async () => {
    const rng = (seed: number): (() => number) => {
      let state = seed >>> 0
      return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x100000000
      }
    }
    const variants = [
      connectorDescriptorFixture({ id: 'ent-demo', serverName: 'demo' }),
      connectorDescriptorFixture({
        id: 'ent-demo', serverName: 'demo',
        endpoint: { transport: 'stdio', command: 'node' },
      }),
      connectorDescriptorFixture({ id: 'ent-demo', serverName: 'demo', displayName: '改名了' }),
    ]
    const digests = variants.map(variant => renderConnectorBundle(variant).digest)
    const violations: string[] = []
    let operations = 0
    for (let seed = 1; seed <= 120; seed += 1) {
      const next = rng(seed)
      const dshHome = await makeConnectorHome()
      const profileDir = join(dshHome, 'profile')
      await mkdir(join(profileDir, 'node_modules'), { recursive: true, mode: 0o700 })
      const fake = createFakeConnectorPort({ profileDir })
      const installer = createEnterpriseConnectorInstall({ dshHome, profileDir, port: fake.port })
      let expectedRecords = 0
      let expectedDigest: string | undefined
      for (let step = 0; step < 8; step += 1) {
        operations += 1
        const roll = next()
        fake.installError = roll < 0.15 ? new Error('boom') : undefined
        fake.installResult = roll >= 0.3 && roll < 0.4
          ? appliedConnectorResult('x', 'cancelled')
          : roll >= 0.4 && roll < 0.5
            ? { ...appliedConnectorResult('x', 'failed'), error: { code: 'x' } }
            : appliedConnectorResult('x')
        const op = next()
        if (op < 0.6) {
          const index = Math.floor(next() * variants.length)
          const variant = variants[index]!
          const before = await readInstalledConnectors({ dshHome })
          const result = await installer.install(variant)
          const after = await readInstalledConnectors({ dshHome })
          if (result.ok) {
            expectedRecords = 1
            expectedDigest = digests[index]
          } else if (JSON.stringify(after) !== JSON.stringify(before)) {
            violations.push(`seed=${seed} step=${step} 失败的 install 改动了账`)
          }
        } else if (op < 0.85) {
          const result = await installer.uninstall('ent-demo')
          if (result.ok) expectedRecords = 0
        }
        const records = await readInstalledConnectors({ dshHome })
        if (new Set(records.map(record => record.connectorId)).size !== records.length) {
          violations.push(`seed=${seed} step=${step} 同一 id 出现重复记录`)
        }
        if (records.length > 1) violations.push(`seed=${seed} step=${step} 记录数 ${records.length} > 1`)
        if (records.length !== expectedRecords) {
          violations.push(`seed=${seed} step=${step} 记录数 ${records.length} ≠ 模型 ${expectedRecords}`)
        }
        if (records.length === 1 && records[0]!.digest !== expectedDigest) {
          violations.push(`seed=${seed} step=${step} 账里的摘要不是最后成功装的那份`)
        }
        if ((await installer.status()).installs.length !== records.length) {
          violations.push(`seed=${seed} step=${step} status 与账不一致`)
        }
      }
    }
    expect({ operations, violations }).toEqual({ operations: 960, violations: [] })
  }, 30_000)
})
