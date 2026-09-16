/**
 * [INPUT]: 依赖 DOM 中已有的 .nav-toggle / .theme-toggle / .copy-command / [data-detect-device] 结构。
 * [OUTPUT]: 渐进增强四件事：① 移动端导航展开 ② 命令复制 ③ 浅/深主题切换（共用 'bui-theme'）
 *           ④ 下载页"当前设备"识别与推荐标记。
 * [POS]: 官网唯一的客户端脚本；不请求任何外部资源，无 JavaScript 时正文与链接保持可用。
 * [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md §7
 */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ① 移动端导航 */
  function setupNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.classList.toggle('nav-locked', open);
    });
  }

  /* ② 命令复制 */
  function setupCopy() {
    var buttons = document.querySelectorAll('.copy-command');
    for (var i = 0; i < buttons.length; i += 1) {
      (function (button) {
        button.hidden = false;
        button.addEventListener('click', function () {
          var block = button.closest('.command');
          var code = block ? block.querySelector('code') : null;
          if (!code) return;
          var text = code.textContent || '';
          var done = function () {
            button.textContent = '已复制';
            window.setTimeout(function () { button.textContent = '复制'; }, 1400);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () { select(code); });
          } else select(code);
        });
      })(buttons[i]);
    }
  }

  function select(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /* ③ 主题切换（与 console / 帮助中心 / API 文档共用 'bui-theme'） */
  function setupTheme() {
    var root = document.documentElement;
    var toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;
    var lightButton = toggle.querySelector('[data-theme-value="light"]');
    var darkButton = toggle.querySelector('[data-theme-value="dark"]');
    var indicator = toggle.querySelector('.theme-toggle-indicator');
    if (!lightButton || !darkButton) return;

    var isDark = function () { return root.classList.contains('dark'); };

    var render = function () {
      var dark = isDark();
      if (indicator) {
        indicator.style.transform = dark ? 'translateX(32px)' : 'translateX(0)';
        indicator.style.opacity = '1';
      }
      lightButton.setAttribute('aria-pressed', dark ? 'false' : 'true');
      darkButton.setAttribute('aria-pressed', dark ? 'true' : 'false');
    };

    var apply = function (next) {
      if (next === isDark()) return;
      root.classList.add('theme-switching');
      root.classList.toggle('dark', next);
      root.dataset.theme = next ? 'dark' : 'light';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.remove('theme-switching'); });
      });
      try { localStorage.setItem('bui-theme', next ? 'dark' : 'light'); } catch (error) { /* 隐私模式 */ }
      render();
    };

    lightButton.addEventListener('click', function () { apply(false); });
    darkButton.addEventListener('click', function () { apply(true); });
    window.addEventListener('storage', function (event) {
      if (event.key !== 'bui-theme') return;
      var dark = event.newValue === 'dark';
      root.classList.toggle('dark', dark);
      root.dataset.theme = dark ? 'dark' : 'light';
      render();
    });

    toggle.hidden = false;
    render();
  }

  /* ④ 下载页：当前设备识别（不伪造不可得的数字，只做平台推荐） */
  function setupDevice() {
    var host = document.querySelector('[data-detect-device]');
    if (!host) return;
    var ua = navigator.userAgent || '';
    var platform = /Mac/i.test(ua) ? 'mac' : /Win/i.test(ua) ? 'windows' : /Linux|X11/i.test(ua) ? 'linux' : 'unknown';
    var label = { mac: 'macOS', windows: 'Windows', linux: 'Linux', unknown: '当前设备' }[platform];
    host.textContent = platform === 'unknown'
      ? '未能识别当前设备，请按下方平台选择'
      : '当前设备：' + label + (platform === 'mac' ? '（Apple Silicon 与 Intel 均可）' : '');
    var card = document.querySelector('[data-platform="' + platform + '"]');
    if (card) {
      card.classList.add('is-current');
      var badge = card.querySelector('.platform-badge');
      if (badge) badge.hidden = false;
    }
  }

  ready(function () {
    setupNav();
    setupCopy();
    setupTheme();
    setupDevice();
  });
})();
