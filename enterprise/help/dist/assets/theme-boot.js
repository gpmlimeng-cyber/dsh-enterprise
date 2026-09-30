/**
 * [INPUT]: 依赖 localStorage 中与 console / API 文档门户共用的键 'bui-theme'。
 * [OUTPUT]: 在首帧绘制前恢复深浅主题（外置脚本，使页面可在 script-src 'self' 的 CSP 下工作）。
 * [POS]: 帮助中心的样式前导脚本；必须同步加载在 <head> 内，不得改为 defer。
 * [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md §6.8
 */
(function () {
  try {
    var theme = localStorage.getItem('bui-theme');
    var dark = theme !== 'light';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (error) {
    document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = 'dark';
  }
})();
