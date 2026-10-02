/**
 * [INPUT]: 依赖 node:fs/promises/node:path、vitest，以及 src/preset 的授权段与 tests/preset-support 夹具
 * [OUTPUT]: 锁定集合指纹的稳定性与敏感面（集合变必变、仅展示文案变不变）、三态流转（需要授权 → 已授权 → 指纹已变）、披露数据形状、状态文件权限与损坏 fail-closed
 * [POS]: 配方纵深「授权门」门禁 —— 官方服务面零弹层，这一刀要证的正是 D1 第 2 条「一次授权、按集合指纹免打扰」确实由我们自己的状态实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  authorizePreset,
  presetAuthorizationPath,
  presetBundleSetFingerprint,
  presetDisclosure,
  readPresetAuthorizations,
  resolvePresetAuthorization,
  revokePresetAuthorization,
  type PresetBundleSetItem,
} from '../src/preset/index.js'
import { cleanupPresetHomes, makePresetHome } from './preset-support.js'

const DIGEST_A = 'a'.repeat(64)
const DIGEST_B = 'b'.repeat(64)

function bundleItem(digest = DIGEST_A, summary = 'demo'): PresetBundleSetItem {
  return { kind: 'bundle', name: 'dsh-ent-preset-ent-demo', summary, digest }
}

function mountItem(name: string): PresetBundleSetItem {
  return { kind: 'mount', name, summary: `挂载行 ${name}` }
}

afterEach(cleanupPresetHomes)

describe('preset authorization gate', () => {
  it('fingerprints the set, not the prose, and is order-insensitive', () => {
    const base = [bundleItem(), mountItem('@deepseek-ai/dsh-persona')]
    const reordered = [...base].reverse()
    expect(presetBundleSetFingerprint(base)).toBe(presetBundleSetFingerprint(reordered))
    // 只改展示文案（summary）不改变指纹：改一句描述不该让员工重新确认。
    expect(presetBundleSetFingerprint([bundleItem(DIGEST_A, 'renamed')])).toBe(presetBundleSetFingerprint([bundleItem()]))
    // 集合项内容摘要变 / 增删挂载项都必须重新确认。
    expect(presetBundleSetFingerprint([bundleItem(DIGEST_B)])).not.toBe(presetBundleSetFingerprint([bundleItem()]))
    expect(presetBundleSetFingerprint([...base, mountItem('@deepseek-ai/dsh-tool-web')]))
      .not.toBe(presetBundleSetFingerprint(base))
    expect(presetBundleSetFingerprint([bundleItem()])).not.toBe(presetBundleSetFingerprint([bundleItem(), mountItem('@deepseek-ai/dsh-persona')]))
  })

  it('rejects malformed set items instead of hashing them', () => {
    expect(() => presetBundleSetFingerprint([])).toThrowError(/non-empty/)
    expect(() => presetBundleSetFingerprint([{ kind: 'mount', name: 'x', digest: DIGEST_A } as PresetBundleSetItem]))
      .toThrowError(/must not carry a digest/)
    expect(() => presetBundleSetFingerprint([{ kind: 'bundle', name: 'x', summary: 'x' } as PresetBundleSetItem]))
      .toThrowError(/digest is invalid/)
    expect(() => presetBundleSetFingerprint([{ kind: 'other', name: 'x', summary: 'x' } as unknown as PresetBundleSetItem]))
      .toThrowError(/kind is invalid/)
  })

  it('projects disclosure as bundles (name + summary + digest) and mounts', () => {
    const disclosure = presetDisclosure([bundleItem(DIGEST_A, '演示用的企业配方。'), mountItem('@deepseek-ai/dsh-persona')])
    expect(disclosure.fingerprint).toBe(presetBundleSetFingerprint([bundleItem(), mountItem('@deepseek-ai/dsh-persona')]))
    expect(disclosure.bundles).toEqual([{ name: 'dsh-ent-preset-ent-demo', summary: '演示用的企业配方。', digest: DIGEST_A }])
    expect(disclosure.mounts).toEqual([{ name: '@deepseek-ai/dsh-persona', summary: '挂载行 @deepseek-ai/dsh-persona' }])
  })

  it('walks needs-authorization to authorized, then back through fingerprint-changed', async () => {
    const dshHome = await makePresetHome()
    const options = { dshHome, now: () => new Date('2026-10-02T00:00:00.000Z') }
    const first = presetBundleSetFingerprint([bundleItem()])
    const changed = presetBundleSetFingerprint([bundleItem(DIGEST_B)])

    await expect(resolvePresetAuthorization(options, 'ent-demo', first)).resolves.toMatchObject({
      state: 'needs-authorization', declarationId: 'ent-demo', fingerprint: first,
    })
    await expect(authorizePreset(options, 'ent-demo', first)).resolves.toMatchObject({
      state: 'authorized', authorizedFingerprint: first, authorizedAt: '2026-10-02T00:00:00.000Z',
    })
    await expect(resolvePresetAuthorization(options, 'ent-demo', first)).resolves.toMatchObject({ state: 'authorized' })
    // 集合变了：同一条授权记录仍在，但当前指纹对不上 ⇒ 必须重新确认。
    await expect(resolvePresetAuthorization(options, 'ent-demo', changed)).resolves.toMatchObject({
      state: 'fingerprint-changed', authorizedFingerprint: first, fingerprint: changed,
    })
    await authorizePreset(options, 'ent-demo', changed)
    await expect(resolvePresetAuthorization(options, 'ent-demo', changed)).resolves.toMatchObject({ state: 'authorized' })
    // 撤销后回到未授权；再次撤销返回 false（幂等）。
    await expect(revokePresetAuthorization(options, 'ent-demo')).resolves.toBe(true)
    await expect(resolvePresetAuthorization(options, 'ent-demo', changed)).resolves.toMatchObject({ state: 'needs-authorization' })
    await expect(revokePresetAuthorization(options, 'ent-demo')).resolves.toBe(false)
    // 不同配方互不影响。
    await expect(resolvePresetAuthorization(options, 'ent-other', first)).resolves.toMatchObject({ state: 'needs-authorization' })
  })

  it('persists the state privately and atomically', async () => {
    const dshHome = await makePresetHome()
    const options = { dshHome }
    const fingerprint = presetBundleSetFingerprint([bundleItem(), mountItem('@deepseek-ai/dsh-persona')])
    await authorizePreset(options, 'ent-demo', fingerprint)
    const path = presetAuthorizationPath(options)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      records: [{ declarationId: 'ent-demo', fingerprint, authorizedAt: expect.any(String) }],
    })
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect((await stat(join(dshHome, 'enterprise', 'preset-authorizations'))).mode & 0o777).toBe(0o700)
    expect((await readdir(join(dshHome, 'enterprise', 'preset-authorizations'))).some(name => name.endsWith('.tmp'))).toBe(false)
    await expect(readPresetAuthorizations(options)).resolves.toHaveLength(1)
  })

  it('fails closed on a damaged state file instead of treating it as empty', async () => {
    const dshHome = await makePresetHome()
    const path = presetAuthorizationPath({ dshHome })
    await mkdir(join(dshHome, 'enterprise', 'preset-authorizations'), { recursive: true, mode: 0o700 })
    await writeFile(path, 'not json', { mode: 0o600 })
    await expect(readPresetAuthorizations({ dshHome })).rejects.toMatchObject({ code: 'ENT_PRESET_STATE_INVALID' })
    await writeFile(path, JSON.stringify({ records: [{ declarationId: 'ent-demo', fingerprint: 'nope', authorizedAt: 'x' }] }), { mode: 0o600 })
    await expect(readPresetAuthorizations({ dshHome })).rejects.toMatchObject({ code: 'ENT_PRESET_STATE_INVALID' })
    await writeFile(path, JSON.stringify({ wrong: [] }), { mode: 0o600 })
    await expect(readPresetAuthorizations({ dshHome })).rejects.toMatchObject({ code: 'ENT_PRESET_STATE_INVALID' })
  })

  it('validates the declaration id and fingerprint at the write door', async () => {
    const dshHome = await makePresetHome()
    await expect(authorizePreset({ dshHome }, 'Bad Id', DIGEST_A)).rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
    await expect(authorizePreset({ dshHome }, 'ent-demo', 'short')).rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
    await expect(resolvePresetAuthorization({ dshHome }, 'ent-demo', DIGEST_A.toUpperCase()))
      .rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
  })
})
