/**
 * [INPUT]: 只依赖 `node:fs` 的 `mkdirSync`/`mkdtempSync`/`rmSync`、`node:os` 的 `homedir` 与 `node:path` 的 `join`（无网络、无宿主上下文）
 * [OUTPUT]: 提供 `nuwaxTempHome(prefix)`（造一份一次性临时 dshHome，**同步**返回）与 `disposeNuwaxTempHomes()`（清掉本次登记过的全部）；`nuwax-auth.spec.ts`、`nuwax-route.spec.ts`、`esc-route.spec.ts` 三份 spec 共用它给每个 `createNuwaxSessionHolder` 注入**隔离的** `dshHome`
 * [POS]: 会话持有者一旦带落盘（`<dshHome>/enterprise/nuwax-session.json`），测试就**必须**给每份夹具一份自己的 `dshHome`——
 *   否则一份 spec 登录写下的票据会被**下一份** spec 构造 holder 时当成"重启后的登录态"读回来（本仓真跑过一次：
 *   `nuwax-auth.spec.ts` 的「失败不缓存」用例莫名成了 signed-in）。三份 spec 因此统一经本文件造 home，
 *   谁忘了注入，红的是"状态串场"而不是"功能坏了"。临时 home 按硬约束落在 `~/.sshwork` 下，绝不写 `/tmp`。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const homes: string[] = []

/**
 * 造一份临时 dshHome。
 *
 * 同步返回（而非 `async`）是刻意的：三份 spec 里有一批 holder 夹具长在**同步**辅助函数里，
 * 用 async 会逼着整条调用链改成异步（那是纯粹的噪声）。测试夹具单线程，直接 push + 同步建目录即可。
 *
 * @param prefix - 目录名前缀（用于事后分辨是哪份 spec 留下的）。
 * @returns 临时 dshHome 的绝对路径。
 */
export function nuwaxTempHome(prefix: string): string {
  const root = join(homedir(), '.sshwork')
  mkdirSync(root, { recursive: true })
  const path = mkdtempSync(join(root, `dshent-nuwax-${prefix}-`))
  homes.push(path)
  return path
}

/** 清掉本次登记过的全部临时 dshHome。 */
export function disposeNuwaxTempHomes(): void {
  for (const path of homes.splice(0)) rmSync(path, { force: true, recursive: true })
}