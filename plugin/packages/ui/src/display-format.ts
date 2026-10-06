/**
 * [INPUT]: 只依赖数字，不依赖 React、DTO 或任何宿主 API
 * [OUTPUT]: 对外提供 `formatByteSize`（B/KiB/MiB 三段式人类可读大小）与 `formatCount`（千分位计数）
 * [POS]: dsh-ui 的纯展示格式化叶子：配方与技能两个市场视图共用同一份大小口径，避免各自抄一份 bytes 函数后悄悄分叉；
 *   在线搜索结果里的「星标 / 安装量」是**第三方给的大数**（真机上到过 963199），也在这里出一份统一口径
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 字节数 → 人类可读大小；二进制进位、一位小数，与官方目录卡片的展示粒度一致。 */
export function formatByteSize(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`
}

/**
 * 计数 → 千分位（`963199` → `963,199`）。
 *
 * ★ 为什么不用 `toLocaleString`：它的结果取决于运行时的 ICU 数据与默认区域（同一份代码在不同机器上
 *   可能给出 `963.199` 这种分隔符），而这里要被测试逐字锁住 ⇒ 用一条**确定性**规则自己插分组符。
 * ★ 只做分组，不做单位缩写：`20.7k` 这种简称会丢掉用户拿去判断「这个来源靠不靠谱」的精度。
 */
export function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
