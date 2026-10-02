/**
 * [INPUT]: 依赖 vitest、src/preset-service.ts 的三端口、`tests/preset-support.ts` 的假安装端口与临时 dshHome、核心的 `renderPresetBundle`/`presetBundleSetFingerprint`/`authorizePreset`
 * [OUTPUT]: 覆盖配方一键启用的**端口层**（本机路由真正调用的那一层）：成功（热）、未授权、指纹已变、进行中、官方失败、官方取消、制品拿不到、找不到、非法 id/指纹，断言每一枚失败都带**核心 `ENT_*` 家族里的稳定码**，并锁死**脱敏**（响应体里不出现宿主绝对路径、`rowId`、官方自由文本 warnings）
 * [POS]: 配方纵深的**路由语义门禁**。真正的 HTTP 路由在 platform-client 的 `/presets` prefix 分派上（它的注册形状/关闭键集/**码→HTTP 状态**由 `platform-client/tests/local-api.spec.ts` 锁），本文件锁的是"路由背后那一段"：谁决定一次失败该带哪枚码、授权何时才被写入、status 与 enable 是否看同一份指纹。码→状态那道断言刻意留在 platform-client：本包运行时按 `main: lib/index.js` 解析依赖，只有那边（自己的 src）才能在任何未重建 lib 的机器上稳定判绿
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  authorizePreset,
  createEnterprisePresetInstall,
  presetBundleSetFingerprint,
  renderPresetBundle,
} from '../src/preset/index.js'
import { createEnterprisePresetService } from '../src/preset-service.js'
import type { EnterprisePresetRecipeSource } from '../src/preset-source.js'
import {
  appliedResult,
  cleanupPresetHomes,
  createFakePresetPort,
  makePresetHome,
  makeRecipe,
} from './preset-support.js'

const PACKAGE_ID = '1902500000000000001'
const RECIPE = makeRecipe()
const RENDERED = renderPresetBundle(RECIPE)
const FINGERPRINT = presetBundleSetFingerprint(RENDERED.bundleSet)

afterEach(cleanupPresetHomes)

interface Rig {
  readonly dshHome: string
  readonly fake: ReturnType<typeof createFakePresetPort>
  readonly service: ReturnType<typeof createEnterprisePresetService>
  readonly recipeCalls: string[]
  readonly errors: { message: string; error: unknown }[]
}

async function makeRig(options: { readonly sourceError?: unknown } = {}): Promise<Rig> {
  const dshHome = await makePresetHome()
  const profileDir = join(dshHome, 'profile')
  const fake = createFakePresetPort({ profileDir })
  const recipeCalls: string[] = []
  const errors: { message: string; error: unknown }[] = []
  const source: EnterprisePresetRecipeSource = {
    async archive() {
      throw new Error('archive() is not used by the service')
    },
    async recipe(presetPackageId) {
      recipeCalls.push(presetPackageId)
      if (options.sourceError !== undefined) throw options.sourceError
      return RECIPE
    },
  }
  const install = createEnterprisePresetInstall({
    dshHome,
    profileDir,
    port: fake.port,
    onError: (message, error) => { errors.push({ message, error }) },
  })
  const service = createEnterprisePresetService({
    install,
    source,
    authorization: { dshHome },
    onError: (message, error) => { errors.push({ message, error }) },
  })
  return { dshHome, fake, service, recipeCalls, errors }
}

/** 已授权的 rig：把"授权门"这一步单独铺平，于是 enable 一定走到官方安装端口。 */
async function makeAuthorizedRig(options: { readonly sourceError?: unknown } = {}): Promise<Rig> {
  const rig = await makeRig(options)
  await authorizePreset({ dshHome: rig.dshHome }, RENDERED.declarationId, FINGERPRINT)
  return rig
}

/** 捕获一次拒绝，返回它的 `code`（没有 code 时返回 undefined）。 */
async function codeOf(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run()
    return undefined
  } catch (error) {
    const code: unknown = Reflect.get(error as object, 'code')
    return typeof code === 'string' ? code : undefined
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('condition was never met')
}

describe('enterprise preset service', () => {
  it('status 给出三态授权 / 进行中 / 披露清单，且与 enable 看同一份指纹', async () => {
    const rig = await makeRig()
    const status = await rig.service.status(PACKAGE_ID)
    expect(rig.recipeCalls).toEqual([PACKAGE_ID])
    expect(status.presetPackageId).toBe(PACKAGE_ID)
    expect(status.declarationId).toBe(RENDERED.declarationId)
    expect(status.fingerprint).toBe(FINGERPRINT)
    expect(status.authorization.state).toBe('needs-authorization')
    expect(status.inFlight).toBe(false)
    expect(status.installed).toBeNull()
    // 披露 = 我们会装的那个最小 bundle + 配方会挂载的模块，指纹与 status.fingerprint 同值。
    expect(status.disclosure.fingerprint).toBe(FINGERPRINT)
    expect(status.disclosure.bundles.map(item => item.name)).toEqual([RENDERED.packageName])
    expect(status.disclosure.mounts.map(item => item.name)).toEqual(['@deepseek-ai/dsh-persona'])
  })

  it('未确认披露时绝不代写授权：未授权拒 / 指纹已变拒 / 指纹形状非法拒', async () => {
    const rig = await makeRig()
    expect(await codeOf(() => rig.service.enable(PACKAGE_ID))).toBe('ENT_PRESET_AUTHORIZATION_REQUIRED')
    expect(await codeOf(() => rig.service.enable(PACKAGE_ID, 'f'.repeat(64)))).toBe('ENT_PRESET_AUTHORIZATION_STALE')
    expect(await codeOf(() => rig.service.enable(PACKAGE_ID, 'not-a-fingerprint'))).toBe('ENT_INVALID_REQUEST')
    // 三次都被拒 ⇒ 一枚字节都没落到官方安装面，授权文件也不存在。
    expect(rig.fake.installCalls).toEqual([])
    await expect(readFile(join(rig.dshHome, 'enterprise', 'preset-authorizations', 'authorizations.json')))
      .rejects.toThrowError()
  })

  it('确认指纹才写授权并安装；同配方同指纹重复点幂等', async () => {
    const rig = await makeRig()
    const result = await rig.service.enable(PACKAGE_ID, FINGERPRINT)
    expect(result.application).toBe('hot')
    expect(result.officialApplication).toBe('applied')
    expect(result.needsNewSession).toBe(true)
    expect(result.alreadyInstalled).toBeUndefined()
    expect(result.declarationId).toBe(RENDERED.declarationId)
    expect(result.fingerprint).toBe(FINGERPRINT)
    expect(result.disclosure.fingerprint).toBe(FINGERPRINT)
    // 出 host 的只有脱敏视图：宿主绝对路径（bundleDir 那一类）一个字节都不许进响应体。
    expect(rig.fake.installCalls).toHaveLength(1)
    expect(rig.fake.installCalls[0]!).toContain('preset-bundles')
    expect(JSON.stringify(result)).not.toContain('preset-bundles')
    expect(result).not.toHaveProperty('bundleDir')
    expect(result).not.toHaveProperty('rowId')
    expect(result).not.toHaveProperty('errorCode')

    // 授权状态确实落盘（下次 status 必须看到 authorized，且不再需要确认）。
    const stored = JSON.parse(await readFile(
      join(rig.dshHome, 'enterprise', 'preset-authorizations', 'authorizations.json'), 'utf8',
    )) as { records: { declarationId: string; fingerprint: string }[] }
    expect(stored.records).toEqual([expect.objectContaining({
      declarationId: RENDERED.declarationId,
      fingerprint: FINGERPRINT,
    })])

    const status = await rig.service.status(PACKAGE_ID)
    expect(status.authorization.state).toBe('authorized')
    expect(status.installed?.declarationId).toBe(RENDERED.declarationId)
    expect(status.installed?.fingerprint).toBe(FINGERPRINT)
    expect(JSON.stringify(status)).not.toContain(rig.dshHome)

    // 已授权 ⇒ 不带确认指纹也能重入，并且因为同指纹 + link 仍在，直接幂等成功（端口只调过一次）。
    const again = await rig.service.enable(PACKAGE_ID)
    expect(again.alreadyInstalled).toBe(true)
    expect(rig.fake.installCalls).toHaveLength(1)
  })

  it('进行中再点如实拒（不排队），status 同时报 inFlight', async () => {
    const rig = await makeAuthorizedRig()
    let release = (): void => {}
    rig.fake.installGate = new Promise<void>(resolve => { release = resolve })
    const first = rig.service.enable(PACKAGE_ID)
    await waitFor(() => rig.fake.installCalls.length === 1)
    expect(await codeOf(() => rig.service.enable(PACKAGE_ID))).toBe('ENT_PRESET_INSTALL_IN_PROGRESS')
    expect((await rig.service.status(PACKAGE_ID)).inFlight).toBe(true)
    release()
    await expect(first).resolves.toMatchObject({ application: 'hot' })
    expect((await rig.service.status(PACKAGE_ID)).inFlight).toBe(false)
  })

  it('官方安装面抛错 / 官方回 failed / 官方取消：逐条带上正确的稳定码', async () => {
    // 官方抛错：原样保留在 cause 与留痕里，界面只拿稳定码。
    const thrown = await makeAuthorizedRig()
    thrown.fake.installError = new Error('pnpm exploded')
    expect(await codeOf(() => thrown.service.enable(PACKAGE_ID))).toBe('ENT_PRESET_INSTALL_FAILED')
    expect(thrown.errors.map(entry => entry.message)).toContain('preset bundle install failed')

    // 官方如实回 failed（携带受控 error.code）。
    const failed = await makeAuthorizedRig()
    failed.fake.installResult = {
      target: RENDERED.packageName,
      changed: false,
      application: 'failed',
      error: { code: 'spec-host' },
    }
    expect(await codeOf(() => failed.service.enable(PACKAGE_ID))).toBe('ENT_PRESET_INSTALL_FAILED')

    // 官方取消（用户点了取消 / 被后来者顶掉）。
    const cancelled = await makeAuthorizedRig()
    cancelled.fake.installResult = appliedResult(RENDERED.packageName, 'cancelled')
    expect(await codeOf(() => cancelled.service.enable(PACKAGE_ID))).toBe('ENT_PRESET_INSTALL_CANCELLED')
  })

  it('配方正文来源失败（制品不可用）原样穿透，不折成安装失败', async () => {
    const artifact = Object.assign(new Error('preset artifact download failed'), {
      code: 'ENT_PRESET_ARTIFACT_UNAVAILABLE',
    })
    const rig = await makeRig({ sourceError: artifact })
    expect(await codeOf(() => rig.service.enable(PACKAGE_ID))).toBe('ENT_PRESET_ARTIFACT_UNAVAILABLE')
    expect(await codeOf(() => rig.service.status(PACKAGE_ID))).toBe('ENT_PRESET_ARTIFACT_UNAVAILABLE')
    expect(rig.fake.installCalls).toEqual([])
  })

  it('官方自由文本 warnings 不进响应体，只留 Host 日志', async () => {
    const rig = await makeAuthorizedRig()
    rig.fake.installResult = {
      ...appliedResult(RENDERED.packageName),
      warnings: ['/data/user/0/com.deepcode.shell/files/home — pnpm said something'],
    }
    const result = await rig.service.enable(PACKAGE_ID)
    expect(JSON.stringify(result)).not.toContain('/data/user/0')
    expect(result).not.toHaveProperty('warnings')
    expect(rig.errors.map(entry => entry.message)).toContain('official preset install reported warnings')
  })

  it('停用：合法声明 id 走官方卸载 + 清 link 残壳；没装过就是 404；非法 id 是 400', async () => {
    const rig = await makeRig()
    await rig.service.enable(PACKAGE_ID, FINGERPRINT)
    const removed = await rig.service.disable(RENDERED.declarationId)
    expect(removed.application).toBe('hot')
    expect(removed.declarationId).toBe(RENDERED.declarationId)
    expect(removed.removedNames).toEqual([RENDERED.packageName])
    expect(removed.linkRemoved).toBe(true)
    expect(rig.fake.removeCalls).toEqual([RENDERED.packageName])

    expect(await codeOf(() => rig.service.disable(RENDERED.declarationId))).toBe('ENT_RESOURCE_NOT_FOUND')
    for (const bad of ['', 'Ent-Demo', '-bad', 'bad-', 'a_b']) {
      expect(await codeOf(() => rig.service.disable(bad)), bad).toBe('ENT_INVALID_REQUEST')
    }
  })
})
