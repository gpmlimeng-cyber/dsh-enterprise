/**
 * [INPUT]: 依赖 GitOps 注入的假 GitCommandRunner 与 AccessTokenProvider。
 * [OUTPUT]: 验证 clone 不带 --branch、push 非 FF 错误映射、askpass 环境注入与临时凭据清理。
 * [POS]: cloud-workspace 的 Git 执行边界单测，不调用真实 git。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { CloudWorkspaceError } from '../src/errors.js'
import { createDefaultGitRunner, GIT_USERNAME, GitOps } from '../src/git-ops.js'
import type { GitCommandRunner } from '../src/types.js'

interface Call {
  cwd: string | null
  argv: readonly string[]
  env: NodeJS.ProcessEnv
}

function runnerFor(results: Array<{ exitCode: number; stdout?: string; stderr?: string }>) {
  const calls: Call[] = []
  let index = 0
  const runner: GitCommandRunner = {
    async run(cwd, argv, env) {
      // 快照 env：withAuth 会在 finally 中清除 token，按引用记录会丢失证据。
      calls.push({ cwd, argv: [...argv], env: { ...env } })
      const result = results[Math.min(index, results.length - 1)]
      index += 1
      return { exitCode: result?.exitCode ?? 0, stdout: result?.stdout ?? '', stderr: result?.stderr ?? '' }
    },
  }
  return { runner, calls }
}

const tokens = { getAccessToken: async () => 'access-token-value' }

describe('GitOps', () => {
  it('clones without --branch so empty repositories work', async () => {
    const { runner, calls } = runnerFor([{ exitCode: 0 }])
    const git = new GitOps(runner, tokens)

    await git.clone('https://ent.example/api/v1/git/1', '/tmp/target')

    expect(calls).toHaveLength(1)
    expect(calls[0]?.argv).toEqual(['clone', 'https://ent.example/api/v1/git/1', '/tmp/target'])
    expect(calls[0]?.argv).not.toContain('--branch')
  })

  it('maps non-fast-forward push output to a stable error', async () => {
    const { runner } = runnerFor([
      { exitCode: 1, stdout: ' ! [rejected]        main -> main (fetch first)', stderr: 'failed to push' },
    ])
    const git = new GitOps(runner, tokens)

    await expect(git.push('/tmp/work')).rejects.toMatchObject({ code: 'ENT_GIT_NON_FAST_FORWARD' })
  })

  it('maps a missing git binary to ENT_GIT_UNAVAILABLE', async () => {
    const runner: GitCommandRunner = {
      async run() { throw new CloudWorkspaceError('ENT_GIT_UNAVAILABLE', '系统 git 不可用', 500) },
    }
    const git = new GitOps(runner, tokens)

    await expect(git.status('/tmp/work')).rejects.toMatchObject({ code: 'ENT_GIT_UNAVAILABLE' })
  })

  it('injects credentials only through env and removes the askpass directory', async () => {
    const { runner, calls } = runnerFor([{ exitCode: 0, stdout: 'main\n' }])
    const git = new GitOps(runner, tokens)

    await git.status('/tmp/work')

    const env = calls[0]!.env
    expect(env.DSHENT_GIT_TOKEN).toBe('access-token-value')
    expect(env.DSHENT_GIT_USERNAME).toBe(GIT_USERNAME)
    expect(env.GIT_TERMINAL_PROMPT).toBe('0')
    const askpass = env.GIT_ASKPASS ?? ''
    expect(askpass.length).toBeGreaterThan(0)
    expect(existsSync(askpass)).toBe(false)
    expect(existsSync(String(env.DSHENT_GIT_TOKEN))).toBe(false)
  })

  it('reports an existing non-empty target directory on clone failure', async () => {
    const { runner } = runnerFor([
      { exitCode: 128, stderr: "fatal: destination path 'x' already exists and is not an empty directory." },
    ])
    const git = new GitOps(runner, tokens)

    await expect(git.clone('https://ent.example/api/v1/git/1', '/tmp/x'))
      .rejects.toMatchObject({ code: 'ENT_INVALID_REQUEST' })
  })

  it('exposes a default runner bound to the system git', () => {
    expect(createDefaultGitRunner()).toHaveProperty('run')
  })

  it('reports an unborn branch as main without failing', async () => {
    const { runner } = runnerFor([
      { exitCode: 1, stderr: 'fatal: ref HEAD is not a symbolic ref' },
      { exitCode: 0, stdout: '' },
    ])
    const git = new GitOps(runner, tokens)

    await expect(git.status('/tmp/empty')).resolves.toEqual({ branch: 'main', dirty: false })
  })
})
