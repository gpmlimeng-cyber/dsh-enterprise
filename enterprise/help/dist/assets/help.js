/**
 * [INPUT]: 依赖同源 ./search-index.json（构建期生成的页面索引）与 DOM 中已有的 .code-block 结构。
 * [OUTPUT]: 渐进增强四件事：① 搜索（bigram 打分，懒加载索引）② 代码块复制 ③ ⌘K/Ctrl+K 聚焦搜索 ④ 浅/深主题切换（共用 'bui-theme' 键）。
 *           无 JavaScript 时正文、导航与代码块均保持完整可读。
 * [POS]: 帮助中心唯一的客户端脚本；不请求任何外部资源（CSP connect-src 'self' 已约束）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md §6.3
 */

(function () {
  'use strict';

  var byId = function (id) { return document.getElementById(id); };

  /* ── 1. 代码块复制（渐进增强，无 JS 时可手动选中） ── */
  function setupCopyButtons() {
    var blocks = document.querySelectorAll('.code-block');
    for (var i = 0; i < blocks.length; i += 1) {
      (function (block) {
        var button = block.querySelector('.code-copy');
        var code = block.querySelector('code');
        if (!button || !code) return;
        button.hidden = false;
        button.addEventListener('click', function () {
          var text = code.textContent || '';
          var done = function () {
            button.textContent = '已复制';
            window.setTimeout(function () { button.textContent = '复制'; }, 1400);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () { selectAll(code); });
          } else {
            selectAll(code);
          }
        });
      })(blocks[i]);
    }
  }

  function selectAll(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /* ── 2. 搜索：bigram 倒排 + 字段加权，索引懒加载 ── */
  var indexPromise = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch('/help/search-index.json', { credentials: 'same-origin' })
        .then(function (response) { return response.ok ? response.json() : { pages: [] }; })
        .catch(function () { return { pages: [] }; });
    }
    return indexPromise;
  }

  function bigrams(text) {
    var normalized = String(text).toLowerCase().replace(/[\s\u3000]+/g, '');
    var grams = [];
    for (var i = 0; i < normalized.length - 1; i += 1) grams.push(normalized.slice(i, i + 2));
    if (normalized.length === 1) grams.push(normalized);
    return grams;
  }

  function score(page, grams) {
    var haystack = (page.title + ' ' + page.summary + ' ' + page.text).toLowerCase().replace(/[\s\u3000]+/g, '');
    var titleHay = (page.title + ' ' + page.summary).toLowerCase().replace(/[\s\u3000]+/g, '');
    var total = 0;
    for (var i = 0; i < grams.length; i += 1) {
      var gram = grams[i];
      if (titleHay.indexOf(gram) >= 0) total += 6;
      var at = haystack.indexOf(gram);
      if (at >= 0) {
        total += 1;
        if (haystack.indexOf(gram, at + 1) >= 0) total += 1;
      }
    }
    return total;
  }

  function setupSearch() {
    var input = byId('help-search');
    var panel = byId('help-search-results');
    if (!input || !panel) return;
    var pages = [];
    var selected = -1;

    var render = function (query) {
      var trimmed = query.trim();
      if (!trimmed) {
        panel.hidden = true;
        panel.innerHTML = '';
        return;
      }
      var grams = bigrams(trimmed);
      var hits = pages
        .map(function (page) { return { page: page, score: score(page, grams) }; })
        .filter(function (hit) { return hit.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 8);
      selected = hits.length > 0 ? 0 : -1;
      panel.innerHTML = hits.length === 0
        ? '<p class="empty">没有匹配的页面</p>'
        : hits.map(function (hit, position) {
          return '<a href="' + hit.page.url + '"' + (position === 0 ? ' aria-selected="true"' : '') + '>' +
            hit.page.title + '<span class="hit-section">' + hit.page.section + ' · ' + hit.page.summary + '</span></a>';
        }).join('');
      panel.hidden = false;
    };

    input.addEventListener('focus', function () {
      loadIndex().then(function (data) { pages = data.pages || []; });
    });
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (event) {
      var links = panel.querySelectorAll('a');
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (links.length === 0) return;
        event.preventDefault();
        selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        for (var i = 0; i < links.length; i += 1) {
          if (i === selected) links[i].setAttribute('aria-selected', 'true');
          else links[i].removeAttribute('aria-selected');
        }
      } else if (event.key === 'Enter' && links[selected]) {
        window.location.assign(links[selected].getAttribute('href'));
      } else if (event.key === 'Escape') {
        panel.hidden = true;
      }
    });

    document.addEventListener('click', function (event) {
      if (!panel.contains(event.target) && event.target !== input) panel.hidden = true;
    });

    document.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /* ── 3. 主题切换：与 console / API 文档共用 'bui-theme' 键，行为与控制台 ThemeToggle 对齐 ── */
  function setupThemeToggle() {
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
        // 指示器位移 = 一列宽度（2rem = 32px），与控制台同款
        indicator.style.transform = dark ? 'translateX(32px)' : 'translateX(0)';
        indicator.style.opacity = '1';
      }
      lightButton.setAttribute('aria-pressed', dark ? 'false' : 'true');
      darkButton.setAttribute('aria-pressed', dark ? 'true' : 'false');
    };

    var apply = function (next) {
      if (next === isDark()) return;
      // 令牌整体翻转时冻结过渡，避免上百个颜色各自动画
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

    // 同一浏览器的其它标签页/站点切换后跟随
    window.addEventListener('storage', function (event) {
      if (event.key !== 'bui-theme') return;
      var dark = event.newValue !== 'light';
      root.classList.toggle('dark', dark);
      root.dataset.theme = dark ? 'dark' : 'light';
      render();
    });

    toggle.hidden = false;
    render();
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    setupCopyButtons();
    setupSearch();
    setupThemeToggle();
  });
})();
