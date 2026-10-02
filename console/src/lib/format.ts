/**
 * [INPUT]: 无外部依赖。
 * [OUTPUT]: 提供后台唯一的字节大小格式化 formatBytes。
 * [POS]: lib 的展示格式化单点；本次只收敛后台内部 4 份同义实现，跨端口径统一（客户端在 <1024 B 与 KiB 进位上是另一种算法）另开一刀，不动客户端。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 后台口径（三档，一名小数）：<1024 字节出整数 B；<1 MiB 出一位小数 KiB；其余出一位小数 MiB。
 * 该口径与服务端上报的 sizeBytes 一一对应，任何新增页面不得再本地实现一份。
 */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
