/**
 * [INPUT]: 依赖 localStorage 中与 console / 帮助中心 / API 文档共用的键 'bui-theme'。
 * [OUTPUT]: 首帧前恢复主题；官网无存储值时**默认浅色**（营销页阅读体验优先，与参考站一致）。
 * [POS]: 官网样式前导脚本；必须同步加载在 <head>，不得改为 defer。
 * [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md §7
 */
(function () {
  try {
    var stored = localStorage.getItem('bui-theme');
    var dark = stored === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
  }
})();
