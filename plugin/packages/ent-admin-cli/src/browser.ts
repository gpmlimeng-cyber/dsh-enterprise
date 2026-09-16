/**
 * [INPUT]: 依赖 node:child_process 以 argv 打开系统浏览器
 * [OUTPUT]: 对外提供 openSystemBrowser
 * [POS]: ent-admin-cli 的桌面能力适配器，不拼 shell
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { execFile } from 'node:child_process'

export async function openSystemBrowser(url: string, signal: AbortSignal): Promise<void> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError('browser URL must use http or https')
  }
  const command =
    process.platform === 'darwin'
      ? { file: 'open', args: [url] }
      : process.platform === 'win32'
        ? { file: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] }
        : process.platform === 'linux'
          ? { file: 'xdg-open', args: [url] }
          : undefined
  if (command === undefined) throw new Error(`system browser is unsupported on ${process.platform}`)
  await new Promise<void>((resolvePromise, reject) => {
    execFile(command.file, command.args, { signal, windowsHide: true }, (error) => {
      if (error === null) resolvePromise()
      else reject(error)
    })
  })
}
