/**
 * [INPUT]: 依赖系统 git PATH、GIT_ASKPASS 临时脚本与 AccessTokenProvider。
 * [OUTPUT]: 对外提供 clone/status/dirty/commit/pull/push 与临时凭据清理。
 * [POS]: cloud-workspace 的 Git 执行边界；Access Token 只经 askpass 注入子进程，不写映射文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { spawn } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CloudWorkspaceError } from './errors.js'
import type { AccessTokenProvider, GitCommandRunner } from './types.js'

export function createDefaultGitRunner(): GitCommandRunner {
  return {
    run(cwd, argv, env, signal) {
      return new Promise((resolve, reject) => {
        const child = spawn('git', argv, {
          cwd: cwd ?? undefined,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          signal,
        })
        let stdout = ''
        let stderr = ''
        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')
        child.stdout.on('data', (chunk: string) => { stdout += chunk })
        child.stderr.on('data', (chunk: string) => { stderr += chunk })
        child.on('error', error => {
          reject(new CloudWorkspaceError('ENT_GIT_UNAVAILABLE', '系统 git 不可用', 500, error))
        })
        child.on('close', (code) => {
          resolve({ exitCode: code ?? 1, stdout, stderr })
        })
      })
    },
  }
}

export class GitOps {
  constructor(
    private readonly runner: GitCommandRunner,
    private readonly tokens: AccessTokenProvider,
  ) {}

  async withAuth<T>(
    signal: AbortSignal | undefined,
    action: (env: NodeJS.ProcessEnv, cleanup: () => void) => Promise<T>,
  ): Promise<T> {
    const token = await this.tokens.getAccessToken()
    const directory = mkdtempSync(join(tmpdir(), 'dshent-git-askpass-'))
    const askpass = join(directory, 'askpass.sh')
    writeFileSync(askpass, '#!/bin/sh\nprintf \'%s\\n\' "$DSHENT_GIT_TOKEN"\n', { mode: 0o700 })
    chmodSync(askpass, 0o700)
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: askpass,
      SSH_ASKPASS: askpass,
      DISPLAY: 'dshent-mock',
      DSHENT_GIT_TOKEN: token,
    }
    try {
      return await action(env, () => { /* cleanup after */ })
    } finally {
      try { rmSync(directory, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }

  async clone(cloneUrl: string, targetPath: string, branch: string, signal?: AbortSignal): Promise<void> {
    await this.withAuth(signal, async (env) => {
      const result = await this.runner.run(null, [
        'clone', '--branch', branch, '--single-branch', cloneUrl, targetPath,
      ], env, signal)
      if (result.exitCode !== 0) {
        throw new CloudWorkspaceError('ENT_INVALID_REQUEST', result.stderr || 'git clone 失败', 400)
      }
    })
  }

  async status(cwd: string, signal?: AbortSignal): Promise<{ branch: string; dirty: boolean }> {
    return this.withAuth(signal, async (env) => {
      const branchResult = await this.runner.run(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], env, signal)
      if (branchResult.exitCode !== 0) {
        throw new CloudWorkspaceError('ENT_WORKSPACE_NOT_MAPPED', '目录不是有效工作树', 400)
      }
      const statusResult = await this.runner.run(cwd, ['status', '--porcelain'], env, signal)
      if (statusResult.exitCode !== 0) {
        throw new CloudWorkspaceError('ENT_GIT_UNAVAILABLE', 'git status 失败', 500)
      }
      return { branch: branchResult.stdout.trim() || 'main', dirty: statusResult.stdout.trim().length > 0 }
    })
  }

  async commitAll(cwd: string, message: string, signal?: AbortSignal): Promise<{ committed: boolean }> {
    return this.withAuth(signal, async (env) => {
      const status = await this.runner.run(cwd, ['status', '--porcelain'], env, signal)
      if (status.exitCode !== 0) throw new CloudWorkspaceError('ENT_GIT_UNAVAILABLE', status.stderr, 500)
      if (status.stdout.trim().length === 0) return { committed: false }
      const add = await this.runner.run(cwd, ['add', '-A'], env, signal)
      if (add.exitCode !== 0) throw new CloudWorkspaceError('ENT_GIT_UNAVAILABLE', add.stderr, 500)
      const commit = await this.runner.run(cwd, ['commit', '-m', message], env, signal)
      if (commit.exitCode !== 0) throw new CloudWorkspaceError('ENT_GIT_UNAVAILABLE', commit.stderr, 500)
      return { committed: true }
    })
  }

  async pullFfOnly(cwd: string, signal?: AbortSignal): Promise<{ fastForward: boolean; stderr: string }> {
    return this.withAuth(signal, async (env) => {
      const result = await this.runner.run(cwd, ['pull', '--ff-only'], env, signal)
      if (result.exitCode === 0) return { fastForward: true, stderr: result.stderr }
      return { fastForward: false, stderr: result.stderr }
    })
  }

  async push(cwd: string, signal?: AbortSignal): Promise<void> {
    await this.withAuth(signal, async (env) => {
      const result = await this.runner.run(cwd, ['push'], env, signal)
      if (result.exitCode === 0) return
      const combined = `${result.stdout}\n${result.stderr}`
      if (/non-fast-forward|fetch first|rejected/i.test(combined)) {
        throw new CloudWorkspaceError(
          'ENT_GIT_NON_FAST_FORWARD',
          '远端有新提交；请先 pull/merge 后再 push',
          409,
        )
      }
      throw new CloudWorkspaceError('ENT_GIT_UNAVAILABLE', result.stderr || 'git push 失败', 500)
    })
  }
}
