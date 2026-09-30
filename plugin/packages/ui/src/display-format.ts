/**
 * [INPUT]: 只依赖数字，不依赖 React、DTO 或任何宿主 API
 * [OUTPUT]: 对外提供 `formatByteSize`（B/KiB/MiB 三段式人类可读大小）
 * [POS]: dsh-ui 的纯展示格式化叶子：配方与技能两个市场视图共用同一份大小口径，避免各自抄一份 bytes 函数后悄悄分叉
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 字节数 → 人类可读大小；二进制进位、一位小数，与官方目录卡片的展示粒度一致。 */
export function formatByteSize(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`
}
