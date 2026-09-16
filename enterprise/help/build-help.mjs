/**
 * [INPUT]: 依赖 config/site.yaml（站点地图真源）、content/ 下的 Markdown（frontmatter + 受限 Markdown 子集）、
 *          facts/ 下由宿主采集的事实快照（角色权限矩阵、控制台界面文案语料）、
 *          ../docs-assets/theme.css 与 fonts/（与 API 文档门户共享的设计令牌与字体）。
 * [OUTPUT]: 生成 dist/：各页静态 HTML、左侧导航、上/下篇、TOC、搜索索引 search-index.json、
 *           自动生成表（角色权限），并在 --check 下执行四项漂移门禁。
 * [POS]: 帮助中心唯一的构建期入口；零 npm 依赖，纯 Node 内置模块，可在 node:*-alpine 容器内离线执行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md §6.2 / §6.5
 *
 * 用法：
 *   node build-help.mjs                  # 生成 dist/
 *   node build-help.mjs --check          # 只校验，不写文件
 *   node build-help.mjs --check --strict # 额外要求所有 site.yaml 声明的页面都已存在
 */

import { readFile, writeFile, mkdir, cp, chmod, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname);
const DIST = join(HERE, 'dist');
const SRC_ROOT = process.env.OWNDSH_SRC_ROOT ?? '/opt/owndsh/src';
const DOCS_ASSETS = process.env.OWNDSH_DOCS_ASSETS ?? '/opt/owndsh/docs-assets';
const API_DOCS_DIST = process.env.OWNDSH_API_DOCS_DIST ?? '/opt/owndsh/api-docs/dist';
// 部署层根（含 DEPLOYMENT.md、api-docs/ 等非上游文件）；构建容器里需显式挂载并传入该变量
const DEPLOY_ROOT = process.env.OWNDSH_DEPLOY_ROOT ?? resolve(HERE, '..');

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const STRICT = args.has('--strict');

// ─────────────────────────────────────────────── YAML 子集解析（与 build-docs.mjs 同源策略）
function parseYamlSubset(text) {
  const lines = text.split('\n');
  const root = {};
  const stack = [{ indent: -1, container: root }];

  const stripComment = (value) => {
    let out = '';
    let quote = null;
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (quote) {
        out += ch;
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        out += ch;
      } else if (ch === '#' && (i === 0 || /\s/.test(value[i - 1]))) {
        break;
      } else {
        out += ch;
      }
    }
    return out.trimEnd();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = stripComment(raw.trim());

    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).container;

    if (line.startsWith('- ')) {
      if (!Array.isArray(parent)) continue;
      const item = line.slice(2).trim();
      if (/^[A-Za-z0-9_."'-]+:(\s|$)/.test(item)) {
        const [key, ...rest] = item.split(':');
        const node = {};
        node[key.trim()] = parseScalar(rest.join(':').trim());
        parent.push(node);
        stack.push({ indent, container: node });
      } else {
        parent.push(parseScalar(item));
      }
      continue;
    }

    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim().replace(/^["']|["']$/g, '');
    const rest = line.slice(sep + 1).trim();

    if (rest === '') {
      let probe = index + 1;
      while (probe < lines.length && (!lines[probe].trim() || lines[probe].trim().startsWith('#'))) probe += 1;
      const isList = probe < lines.length && lines[probe].trim().startsWith('- ');
      const nested = isList ? [] : {};
      parent[key] = nested;
      stack.push({ indent, container: nested });
      continue;
    }

    if (rest.startsWith('[') && rest.endsWith(']')) {
      parent[key] = rest.slice(1, -1).split(',').map((item) => parseScalar(item.trim())).filter((item) => item !== '');
      continue;
    }

    parent[key] = parseScalar(rest);
  }
  return root;

  function parseScalar(value) {
    if (value === '' || value === 'null' || value === '~') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^-?\d+$/.test(value)) return Number(value);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }
}

// ─────────────────────────────────────────────── Markdown 子集渲染
const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slug = (text) => text.trim().replace(/\s+/g, '-').replace(/[#?]/g, '');

/** 行内元素：先抽出行内代码，避免后续替换污染它。支持 代码 / 粗体 / 斜体 / 链接 / 图片。 */
function renderInline(source) {
  const codes = [];
  let text = source.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = escapeHtml(text);
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy" />`);
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = href.endsWith('.md') ? href.replace(/\.md$/, '.html') : href;
    const external = /^https?:\/\//.test(url);
    const attrs = external ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${url}"${attrs}>${label}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${escapeHtml(codes[Number(index)])}</code>`);
}

const CALLOUTS = [
  { marker: '💡', className: 'tip', label: '提示' },
  { marker: '⚠️', className: 'warn', label: '注意' },
  { marker: '🔒', className: 'secure', label: '安全' }
];

function renderCallout(paragraph) {
  const callout = CALLOUTS.find((item) => paragraph.includes(item.marker));
  if (!callout) return `<blockquote>${paragraph}</blockquote>`;
  const body = paragraph.replace(callout.marker, '').replace(/^\s*\*\*|\*\*\s*$/g, '').trim();
  return `<aside class="callout callout-${callout.className}"><span class="callout-label">${callout.label}</span><p>${body}</p></aside>`;
}

/** 受限 Markdown 子集 → HTML。不支持 HTML 混写（保持可迁移到任何渲染器）。 */
function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  let index = 0;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    out.push(renderCallout(renderInline(text)));
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];

    // 生成块：<!-- generated:name --> … <!-- /generated -->（作为独立块，不被转义）
    const generated = line.match(/^\s*<!--\s*generated:([a-z-]+)\s*-->\s*$/);
    if (generated) {
      flushParagraph();
      index += 1;
      while (index < lines.length && !/^\s*<!--\s*\/generated\s*-->\s*$/.test(lines[index])) index += 1;
      index += 1;
      out.push(`\u0001${generated[1]}\u0001`);
      continue;
    }

    // 其它 HTML 注释直接丢弃（正文不允许混写 HTML）
    if (/^\s*<!--/.test(line)) {
      index += 1;
      continue;
    }

    // 围栏代码块
    const fence = line.match(/^```([A-Za-z0-9+-]*)\s*$/);
    if (fence) {
      flushParagraph();
      const language = fence[1] || 'text';
      const body = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      out.push(
        `<div class="code-block" data-language="${language}"><button type="button" class="code-copy" hidden>复制</button>` +
        `<pre><code class="language-${language}">${escapeHtml(body.join('\n'))}</code></pre></div>`
      );
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slug(text);
      headings.push({ level, text, id });
      out.push(`<h${level} id="${id}">${renderInline(text)}<a class="anchor" href="#${id}" aria-label="锚点">#</a></h${level}>`);
      index += 1;
      continue;
    }

    // 分隔线
    if (/^---+\s*$/.test(line)) {
      flushParagraph();
      out.push('<hr />');
      index += 1;
      continue;
    }

    // 表格
    if (/^\|/.test(line) && index + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[index + 1].trim())) {
      flushParagraph();
      const parseRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
      const header = parseRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\|/.test(lines[index])) {
        rows.push(parseRow(lines[index]));
        index += 1;
      }
      out.push(
        '<div class="table-wrap"><table><thead><tr>' +
        header.map((cell) => `<th>${renderInline(cell)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('') +
        '</tbody></table></div>'
      );
      continue;
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }
      out.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      out.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ol>`);
      continue;
    }

    // 引用块（非提示框）
    if (/^>\s?/.test(line)) {
      flushParagraph();
      const body = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      out.push(renderCallout(renderInline(body.join(' '))));
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      index += 1;
      continue;
    }

    paragraph.push(line.trim());
    index += 1;
  }

  flushParagraph();
  return { html: out.join('\n'), headings };
}

// ─────────────────────────────────────────────── frontmatter
function parseFrontmatter(source) {
  if (!source.startsWith('---\n')) return { data: {}, body: source };
  const end = source.indexOf('\n---', 4);
  if (end < 0) return { data: {}, body: source };
  const raw = source.slice(4, end + 1);
  const body = source.slice(source.indexOf('\n', end + 1) + 1);
  return { data: parseYamlSubset(raw), body };
}

// ─────────────────────────────────────────────── 自动生成块
function renderRolePermissions(facts) {
  if (!facts || !Array.isArray(facts.roles)) {
    return '<p class="pending">权限表尚未生成（缺少 facts/role-permissions.json）。</p>';
  }
  const permissions = facts.permissions ?? [];
  const header = permissions.map((code) => `<th title="${code}"><code>${code.replace(/^ent:/, '')}</code></th>`).join('');
  const rows = facts.roles.map((role) => {
    const cells = permissions
      .map((code) => (role.permissions.includes(code) ? '<td class="yes">●</td>' : '<td class="no">·</td>'))
      .join('');
    return `<tr><th scope="row">${role.name}<br /><code>${role.key}</code></th><td>${role.permissions.length}</td>${cells}</tr>`;
  }).join('');
  return [
    '<div class="table-wrap"><table class="matrix">',
    `<thead><tr><th>角色</th><th>数量</th>${header}</tr></thead>`,
    `<tbody>${rows}</tbody></table></div>`,
    `<p class="fact-note">数据来源：${facts.source}，采集于 ${facts.collectedAt}。` +
    '权限码由运行实例读出，非设计稿；内置角色与权限不可自由编排。</p>'
  ].join('\n');
}

/** 首页的分组卡片：直接由 site.yaml + 实际已撰写页数生成，避免在 Markdown 里重复维护导航。 */
function renderSectionsOverview(sections, nav) {
  const cards = sections.map((section) => {
    const group = nav.find((item) => item.title === section.title);
    const written = group ? group.pages.length : 0;
    const target = group && group.pages[0] ? group.pages[0].url : null;
    const body = `<h3>${section.title}</h3><p>${section.summary}</p>` +
      `<p class="card-meta">${written === 0 ? '撰写中，敬请期待' : `${written}/${section.pages.length} 篇已撰写`}</p>`;
    // 一篇都没写时不产生死链
    return target
      ? `<a class="card" href="${target}">${body}</a>`
      : `<div class="card card-pending">${body}</div>`;
  }).join('');
  return `<div class="card-grid">${cards}</div>`;
}

function renderGeneratedBlock(name, context) {
  if (name === 'role-permissions') return renderRolePermissions(context.roleFacts);
  if (name === 'sections-overview') return renderSectionsOverview(context.sections ?? [], context.nav ?? []);
  return `<p class="pending">未知生成块：${name}</p>`;
}

function applyGeneratedBlocks(html, context) {
  return html
    .replace(/\u0001([a-z-]+)\u0001/g, (_, name) => renderGeneratedBlock(name, context))
    .replace(/<!-- generated:([a-z-]+) -->[\s\S]*?<!-- \/generated -->/g, (_, name) => renderGeneratedBlock(name, context));
}

// ─────────────────────────────────────────────── CSS 令牌完整性
/**
 * 帮助中心的样式依赖共享 theme.css 提供的设计令牌。若引用了从未定义的变量且未给兜底值，
 * 该声明会「invalid at computed-value time」而被丢弃——深色主题文字仍是黑色就是这么来的。
 * 这里做静态检查：var(--x)（无兜底）形式引用的变量必须有定义。
 */
async function checkCssTokens() {
  const sheets = [
    ['theme.css', await readFile(join(DOCS_ASSETS, 'theme.css'), 'utf8')],
    ['help.css', await readFile(join(HERE, 'assets/help.css'), 'utf8')]
  ];
  const defined = new Set();
  for (const [, css] of sheets) {
    for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(match[1]);
  }
  const found = [];
  for (const [name, css] of sheets) {
    for (const match of css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)) {
      if (!defined.has(match[1])) {
        found.push(`${name}: 变量 ${match[1]} 被引用但从未定义（无兜底 → 该声明会被丢弃）`);
      }
    }
  }
  return [...new Set(found)];
}

// ─────────────────────────────────────────────── 公开内容安全检查
/**
 * 文档自 2026-09-16 起对公网完全公开，因此内容里不得出现：
 *   ① 内网地址（10./172.16-31./192.168.）② 部署 .env 中的任何密钥值 ③ 私钥块。
 * 这是"公开"这一产品决策的直接配套防线：一旦有人在运维篇里贴了内网地址，构建就失败。
 */
async function checkPublicContent(contents) {
  const problems = [];
  const privateIp = /\b(?:10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g;
  const secrets = [];
  const envPath = join(SRC_ROOT, '.env');
  if (existsSync(envPath)) {
    for (const line of (await readFile(envPath, 'utf8')).split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]*(?:SECRET|KEY|PASSWORD|TOKEN)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (match && match[2].length >= 8 && !match[2].startsWith('#')) secrets.push({ name: match[1], value: match[2] });
    }
  }
  for (const [file, text] of contents) {
    for (const hit of text.match(privateIp) ?? []) problems.push(`${file}: 出现内网地址 ${hit}（公开内容不允许）`);
    for (const secret of secrets) {
      if (text.includes(secret.value)) problems.push(`${file}: 出现 ${secret.name} 的取值（公开内容不允许）`);
    }
    if (/BEGIN [A-Z ]*PRIVATE KEY/.test(text)) problems.push(`${file}: 出现私钥块（公开内容不允许）`);
  }
  return [...new Set(problems)];
}

// ─────────────────────────────────────────────── 页面装配
function renderPage({ page, section, site, html, headings, nav, prev, next }) {
  const toc = headings.filter((item) => item.level >= 2 && item.level <= 3);
  const navHtml = nav.map((group) => {
    const items = group.pages.map((item) => {
      const active = item.id === page.id;
      return `<li${active ? ' class="active"' : ''}><a href="${item.url}">${item.title}</a></li>`;
    }).join('');
    const pending = group.pages.length === 0 ? '<li class="pending">撰写中</li>' : '';
    return `<div class="nav-group"><p class="nav-title">${group.title}</p><ul>${items}${pending}</ul></div>`;
  }).join('');

  const pager = [
    prev ? `<a class="pager-prev" href="${prev.url}"><span>上一篇</span>${prev.title}</a>` : '<span></span>',
    next ? `<a class="pager-next" href="${next.url}"><span>下一篇</span>${next.title}</a>` : '<span></span>'
  ].join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark light" />
<meta name="robots" content="index, follow" />
<title>${page.title} · ${site.title}</title>
<link rel="stylesheet" href="/help/assets/theme.css" />
<link rel="stylesheet" href="/help/assets/help.css" />
<!-- 主题前导必须同步执行在 <head>，避免首帧闪烁；外置以满足 CSP script-src 'self' -->
<script src="/help/assets/theme-boot.js"></script>
</head>
<body>
<header class="topbar">
  <a class="brand" href="/help/"><span class="brand-mark">O</span>${site.title}</a>
  <div class="topbar-search">
    <input id="help-search" type="search" placeholder="搜索手册（⌘K）" aria-label="搜索手册" autocomplete="off" />
    <div id="help-search-results" class="search-results" hidden></div>
  </div>
      <div class="theme-toggle" hidden role="group" aria-label="主题">
        <span class="theme-toggle-indicator" aria-hidden="true"></span>
        <button type="button" data-theme-value="light" aria-label="浅色主题" aria-pressed="false">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>
        <button type="button" data-theme-value="dark" aria-label="深色主题" aria-pressed="false">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>
      </div>
  <nav class="topbar-links" aria-label="文档中心">
    <a href="/api-docs/">API 参考</a>
    <a href="/">控制台</a>
  </nav>
</header>
<div class="layout">
  <nav class="sidebar" aria-label="手册导航">${navHtml}</nav>
  <main class="content">
    ${page.url === '/help/index.html' ? '' : `<p class="breadcrumb"><a href="/help/">帮助中心</a> / ${section.title}</p>`}
    <div class="meta">
      <span>受众：${section.audienceLabel}</span>
      <span>适用版本：${site.productVersion}</span>
      ${page.verifiedAt ? `<span>最后校验：${page.verifiedAt}</span>` : ''}
      ${page.generated ? '<span class="badge">自动生成</span>' : ''}
    </div>
    <article class="prose">
${html}
    </article>
    <nav class="pager">${pager}</nav>
    <footer class="page-footer">
      <span>${site.title} · 内容版本 ${site.productVersion}</span>
      <span class="sep">·</span>
      <a href="${site.homepage ?? '/home/'}">产品官网</a>
      <span class="sep">·</span>
      <a href="${site.apiReference}">API 参考</a>
      <span class="sep">·</span>
      <a href="/">返回控制台</a>
    </footer>
  </main>
  ${toc.length > 2 ? `<aside class="toc" aria-label="本页目录"><p class="nav-title">本页目录</p><ul>${toc.map((item) => `<li class="lvl-${item.level}"><a href="#${item.id}">${item.text}</a></li>`).join('')}</ul></aside>` : ''}
</div>
<script src="/help/assets/help.js" defer></script>
</body>
</html>
`;
}

// ─────────────────────────────────────────────── 主流程
async function main() {
  const siteConfig = parseYamlSubset(await readFile(join(HERE, 'config/site.yaml'), 'utf8'));
  const site = siteConfig.site;
  const audienceLabels = { admin: '管理员', user: '员工', ops: '运维', all: '全部' };

  let roleFacts;
  const factsPath = join(HERE, 'facts/role-permissions.json');
  if (existsSync(factsPath)) roleFacts = JSON.parse(await readFile(factsPath, 'utf8'));

  let consoleStrings = '';
  const stringsPath = join(HERE, 'facts/console-strings.txt');
  if (existsSync(stringsPath)) consoleStrings = await readFile(stringsPath, 'utf8');

  const problems = [];
  const rawContents = [];
  for (const section of siteConfig.sections) {
    for (const declared of section.pages) {
      const path = join(HERE, declared.file);
      if (existsSync(path)) rawContents.push([declared.file, await readFile(path, 'utf8')]);
    }
  }
  if (siteConfig.home && existsSync(join(HERE, siteConfig.home.file))) {
    rawContents.push([siteConfig.home.file, await readFile(join(HERE, siteConfig.home.file), 'utf8')]);
  }
  problems.push(...(await checkPublicContent(rawContents)));
  if (existsSync(join(DOCS_ASSETS, 'theme.css'))) {
    problems.push(...(await checkCssTokens()));
  }
  const pages = [];
  const nav = [];

  for (const section of siteConfig.sections) {
    const group = { title: section.title, audience: section.audience, pages: [] };
    const sectionPages = [...section.pages].sort((a, b) => a.order - b.order);
    for (const declared of sectionPages) {
      const file = join(HERE, declared.file);
      if (!existsSync(file)) {
        problems.push(`未撰写：${declared.file}（${declared.title}）`);
        continue;
      }
      const { data, body } = parseFrontmatter(await readFile(file, 'utf8'));
      for (const field of ['title', 'audience', 'order', 'summary', 'verifiedAt', 'sourceRefs']) {
        if (data[field] === undefined) problems.push(`${declared.file}: frontmatter 缺少 ${field}`);
      }
      if (data.audience && data.audience !== section.audience) {
        problems.push(`${declared.file}: audience=${data.audience} 与 section「${section.id}」不一致`);
      }
      // sourceRefs 存在性
      for (const ref of data.sourceRefs ?? []) {
        if (String(ref).startsWith('/')) continue; // 绝对路径（如部署层文件）不校验
        const [path] = String(ref).split('#');
        if (path.startsWith('sys_') || path.includes('**')) continue; // 数据库表/通配引用
        // 源码树 → 帮助中心自身 → 部署层（/opt/owndsh：DEPLOYMENT.md、api-docs 等）
        const candidates = [join(SRC_ROOT, path), join(HERE, path), join(DEPLOY_ROOT, path)];
        if (!candidates.some((candidate) => existsSync(candidate))) {
          problems.push(`${declared.file}: sourceRefs 指向的文件不存在 → ${path}`);
        }
      }
      // UI 文案交叉校验（控制台构建产物语料）
      if (consoleStrings) {
        for (const label of data.uiLabels ?? []) {
          if (!consoleStrings.includes(String(label))) {
            problems.push(`${declared.file}: uiLabels「${label}」在控制台构建产物中找不到（界面文案可能已改）`);
          }
        }
      }
      const url = `${section.path}${declared.id.replace(/^(admin|user|ops|ref)-/, '')}.html`;
      const rendered = renderMarkdown(body);
      pages.push({
        id: declared.id,
        title: data.title ?? declared.title,
        summary: data.summary ?? declared.summary ?? '',
        audience: section.audience,
        sectionTitle: section.title,
        url,
        html: applyGeneratedBlocks(rendered.html, { roleFacts }),
        headings: rendered.headings,
        plain: body.replace(/[#*`>|-]/g, ' ').replace(/\s+/g, ' '),
        verifiedAt: data.verifiedAt,
        generated: declared.generated === true
      });
      group.pages.push({ id: declared.id, title: data.title ?? declared.title, url });
    }
    nav.push(group);
  }

  // 首页（帮助中心）：单独声明在 site.yaml 的 home 段，不参与 section 导航
  if (siteConfig.home) {
    const homeFile = join(HERE, siteConfig.home.file);
    if (!existsSync(homeFile)) {
      problems.push(`未撰写：${siteConfig.home.file}（帮助中心首页）`);
    } else {
      const { data, body } = parseFrontmatter(await readFile(homeFile, 'utf8'));
      const rendered = renderMarkdown(body);
      pages.push({
        id: 'help-home',
        title: data.title ?? siteConfig.home.title,
        summary: data.summary ?? siteConfig.home.summary ?? '',
        audience: 'all',
        sectionTitle: '帮助中心',
        url: '/help/index.html',
        html: applyGeneratedBlocks(rendered.html, { roleFacts, nav, sections: siteConfig.sections }),
        headings: rendered.headings,
        plain: body.replace(/[#*`>|-]/g, ' ').replace(/\s+/g, ' '),
        verifiedAt: data.verifiedAt,
        generated: false
      });
    }
  }

  // 链接与资源完整性：页面里引用的每个站内链接/资源都必须真实存在
  // （资产路径写错会静默变成"无样式页面"，必须由门禁拦下）
  const expectedTargets = new Set(pages.map((page) => page.url));
  const assetTargets = [
    '/help/assets/theme.css',
    '/help/assets/help.css',
    '/help/assets/theme-boot.js',
    '/help/assets/help.js',
    '/help/search-index.json'
  ];
  for (const fontsDir of [join(DOCS_ASSETS, 'fonts'), join(HERE, 'assets/fonts')]) {
    if (!existsSync(fontsDir)) continue;
    for (const entry of await readdir(fontsDir)) assetTargets.push(`/help/assets/fonts/${entry}`);
  }
  for (const entry of await readdir(join(HERE, 'assets'))) {
    if (entry.endsWith('.png') || entry.endsWith('.svg') || entry.endsWith('.jpg') || entry.endsWith('.webp')) {
      assetTargets.push(`/help/assets/${entry}`);
    }
  }
  for (const target of assetTargets) expectedTargets.add(target);

  const isLocal = (target) => !/^(https?:|mailto:|tel:|#|data:)/.test(target) && !target.startsWith('/api-docs/') && target !== '/';

  for (const page of pages) {
    for (const match of page.html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      let target = match[1].split('#')[0];
      if (!target || !isLocal(target)) continue;
      if (!target.startsWith('/')) {
        const base = page.url.slice(0, page.url.lastIndexOf('/') + 1);
        target = new URL(target, `https://local${base}`).pathname;
      }
      if (/^\/help\/[^]*\.html$/.test(target) || /^\/help\/[^]*\/$/.test(target)) {
        // 页面链接：/help/x/y.html 或目录形式
        const asPage = target.endsWith('/') ? `${target}index.html` : target;
        if (!expectedTargets.has(asPage)) problems.push(`${page.url}: 站内页面不存在 → ${target}`);
        continue;
      }
      if (!expectedTargets.has(target)) problems.push(`${page.url}: 引用的资源不存在 → ${target}`);
    }
  }

  const home = pages.find((page) => page.url === '/help/index.html') ?? pages[0];
  if (CHECK) {
    const blocking = problems.filter((problem) => !problem.startsWith('未撰写：'));
    const pending = problems.filter((problem) => problem.startsWith('未撰写：'));
    if (blocking.length > 0) {
      console.error(`[build-help] 门禁失败（${blocking.length} 项）：`);
      blocking.forEach((problem) => console.error(`  ✗ ${problem}`));
      process.exit(1);
    }
    if (STRICT && pending.length > 0) {
      console.error(`[build-help] --strict：仍有 ${pending.length} 篇未撰写`);
      pending.forEach((problem) => console.error(`  · ${problem}`));
      process.exit(1);
    }
    console.log(`[build-help] 门禁通过：已撰写 ${pages.length} 篇，待撰写 ${pending.length} 篇（site.yaml 共 ${siteConfig.sections.reduce((sum, section) => sum + section.pages.length, 0)} 篇）`);
    return;
  }

  // ── 写产物
  // 注意：绝不能用 rm -rf 删掉 dist 目录本身！
  // dist 是 console 容器的 bind mount 源，删除目录会让容器内的挂载点指向已删除的 inode，
  // 表现为容器内目录变空、页面变 403（directory index forbidden）或 500（重定向环）。
  // 正确做法：保留 dist 这个目录 inode，只清空其内容。
  await mkdir(DIST, { recursive: true });
  for (const entry of await readdir(DIST)) {
    await rm(join(DIST, entry), { recursive: true, force: true });
  }

  const homeNav = nav;
  for (const page of pages) {
    const order = pages.filter((item) => item.sectionTitle === page.sectionTitle);
    const position = order.findIndex((item) => item.id === page.id);
    const section = siteConfig.sections.find((item) => item.title === page.sectionTitle)
      ?? { title: '帮助中心', audience: 'all', path: '/help/' };
    const html = renderPage({
      page,
      section: { ...section, audienceLabel: audienceLabels[section.audience] ?? section.audience },
      site,
      html: page.html,
      headings: page.headings,
      nav: homeNav,
      prev: order[position - 1],
      next: order[position + 1]
    });
    const outPath = join(DIST, page.url.replace('/help/', ''));
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html);
  }

  // 搜索索引（bigram 倒排，客户端零依赖匹配；内容变多后可平替自托管 MiniSearch）
  const indexed = pages.map((page) => ({
    id: page.id,
    title: page.title,
    summary: page.summary,
    audience: page.audience,
    section: page.sectionTitle,
    url: page.url,
    text: `${page.title} ${page.summary} ${page.plain}`.slice(0, 4000)
  }));
  await writeFile(join(DIST, 'search-index.json'), JSON.stringify({ pages: indexed }));

  // 共享资产：与 API 文档门户同一份 theme.css + fonts
  await mkdir(join(DIST, 'assets'), { recursive: true });
  await cp(join(DOCS_ASSETS, 'theme.css'), join(DIST, 'assets/theme.css'));
  await cp(join(DOCS_ASSETS, 'fonts'), join(DIST, 'assets/fonts'), { recursive: true });
  await cp(join(HERE, 'assets/help.css'), join(DIST, 'assets/help.css'));
  await cp(join(HERE, 'assets/help.js'), join(DIST, 'assets/help.js'));
  await cp(join(HERE, 'assets/theme-boot.js'), join(DIST, 'assets/theme-boot.js'));

  async function makeReadable(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await chmod(full, 0o755);
        await makeReadable(full);
      } else {
        await chmod(full, 0o644);
      }
    }
  }
  await chmod(DIST, 0o755);
  await makeReadable(DIST);

  const pending = problems.filter((problem) => problem.startsWith('未撰写：'));
  console.log('[build-help] 生成完成');
  console.log(`  已撰写 ${pages.length} 篇 / 待撰写 ${pending.length} 篇 / 导航分组 ${nav.length}`);
  console.log(`  首页 ${home ? home.url : '—'}`);
  pending.forEach((problem) => console.log(`  · ${problem}`));
}

await main();
