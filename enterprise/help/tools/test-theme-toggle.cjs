/**
 * [INPUT]: 依赖 jsdom（仅测试期）与 dist/index.html、dist/assets/{theme-boot.js,help.js}，
 *          以及 API 文档门户 dist/index.html 中的主题切换 IIFE。
 * [OUTPUT]: 断言浅/深主题切换的真实行为：类名翻转、'bui-theme' 持久化、aria-pressed 同步、
 *          指示器位移，以及 API 文档页对 Scalar updateConfiguration 的调用契约。
 * [POS]: 帮助中心的主题切换行为测试；静态样式检查无法证明"点击有效"，本测试补上这一环。
 * [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md 附录 C
 *
 * 运行（宿主无 node，用容器 + 临时安装 jsdom）：
 *   docker run --rm -v /opt/owndsh/help:/work -v /opt/owndsh/api-docs:/api-docs -w /tmp node:24-alpine \
 *     sh -c 'npm i --silent jsdom >/dev/null && NODE_PATH=/tmp/node_modules node /work/tools/test-theme-toggle.cjs'
 */

const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const HELP_DIR = process.env.OWNDSH_HELP_DIR ?? '/work';
const API_DIR = process.env.OWNDSH_API_DOCS_DIR ?? '/api-docs';

const ready = (window) => new Promise((resolve) => {
  if (window.document.readyState === 'complete') resolve();
  else window.addEventListener('load', resolve);
});

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log('  ✅ ' + label);
  } else {
    failures += 1;
    console.log('  ❌ ' + label + (detail ? ' → ' + detail : ''));
  }
}

// ── 1. 帮助中心：真点按钮
const helpHtml = fs.readFileSync(`${HELP_DIR}/dist/index.html`, 'utf8');
const dom = new JSDOM(helpHtml, {
  url: 'http://localhost/help/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
window.eval(fs.readFileSync(`${HELP_DIR}/dist/assets/theme-boot.js`, 'utf8'));
window.eval(fs.readFileSync(`${HELP_DIR}/dist/assets/help.js`, 'utf8'));

const root = window.document.documentElement;
const light = window.document.querySelector('[data-theme-value="light"]');
const dark = window.document.querySelector('[data-theme-value="dark"]');
const indicator = window.document.querySelector('.theme-toggle-indicator');

async function main() {
await ready(window);
console.log('帮助中心主题切换：');
check('控件已可见（hidden 被脚本移除）', window.document.querySelector('.theme-toggle').hidden === false);
check('无存储值时默认深色（与控制台一致）', root.classList.contains('dark'), root.className);
check('初始 aria-pressed 正确', dark.getAttribute('aria-pressed') === 'true' && light.getAttribute('aria-pressed') === 'false');

light.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('点击浅色 → 移除 dark 类', !root.classList.contains('dark'), root.className);
check('点击浅色 → data-theme=light', root.dataset.theme === 'light', root.dataset.theme);
check('点击浅色 → 持久化 bui-theme=light', window.localStorage.getItem('bui-theme') === 'light', String(window.localStorage.getItem('bui-theme')));
check('点击浅色 → aria-pressed 翻转', light.getAttribute('aria-pressed') === 'true' && dark.getAttribute('aria-pressed') === 'false');
check('点击浅色 → 指示器复位', (indicator.style.transform || '') === 'translateX(0)', indicator.style.transform);

dark.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('点击深色 → 加回 dark 类', root.classList.contains('dark'));
check('点击深色 → 持久化 bui-theme=dark', window.localStorage.getItem('bui-theme') === 'dark');
check('点击深色 → 指示器位移 32px', indicator.style.transform === 'translateX(32px)', indicator.style.transform);

// 无重复点击的幂等性
const before = root.className;
dark.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('重复点击同一主题不改变状态', root.className === before);

// ── 2. API 文档门户：切换必须把 darkMode 交给 Scalar
const apiHtml = fs.readFileSync(`${API_DIR}/dist/index.html`, 'utf8');
const apiDom = new JSDOM(apiHtml, { url: 'http://localhost/api-docs/', runScripts: 'outside-only', pretendToBeVisual: true });
const apiWindow = apiDom.window;
let updated = null;
apiWindow.__owndshScalar = {
  api: {
    getConfiguration: () => ({ url: './enterprise-openapi.json', darkMode: true, hideDownloadButton: false }),
    updateConfiguration: (config) => { updated = config; }
  }
};
const start = apiHtml.indexOf('// 主题切换：');
const end = apiHtml.indexOf('})();', apiHtml.indexOf('toggle.hidden = false;', start));
apiWindow.eval(apiHtml.slice(start, end + 5));

const apiLight = apiWindow.document.querySelector('[data-theme-value="light"]');
const apiDark = apiWindow.document.querySelector('[data-theme-value="dark"]');

console.log('API 文档门户主题切换：');
check('控件已可见', apiWindow.document.querySelector('.theme-toggle').hidden === false);
apiDark.dispatchEvent(new apiWindow.MouseEvent('click', { bubbles: true }));
check('点击深色 → 页面类名加 dark', apiWindow.document.documentElement.classList.contains('dark'));
check('点击深色 → 持久化 bui-theme=dark', apiWindow.localStorage.getItem('bui-theme') === 'dark', String(apiWindow.localStorage.getItem('bui-theme')));
check('点击深色 → 调用 Scalar updateConfiguration', updated !== null);
check('updateConfiguration 保留既有配置并只改 darkMode',
  updated && updated.darkMode === true && updated.url === './enterprise-openapi.json' && updated.hideDownloadButton === false,
  JSON.stringify(updated));

apiLight.dispatchEvent(new apiWindow.MouseEvent('click', { bubbles: true }));
check('点击浅色 → 移除 dark 且再次通知 Scalar', !apiWindow.document.documentElement.classList.contains('dark') && updated.darkMode === false);

console.log(failures === 0 ? '\n结论：全部通过 ✅' : `\n结论：${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => { console.error(error); process.exit(1); });
