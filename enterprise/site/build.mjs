/**
 * [INPUT]: 依赖 config/site.yaml（站点真源）、partials/（导航与页脚）、content/**\/*.html（页面正文）、
 *          assets/（站点样式与脚本）、../docs-assets/（共享令牌与字体）、上游 website/assets（真实截图与品牌图）。
 * [OUTPUT]: 生成 dist/：多页静态站 + sitemap.xml + robots.txt + 404 页，并在构建期执行五道门禁。
 * [POS]: 产品官网唯一的构建入口；零 npm 依赖，可在 node:*-alpine 容器内离线执行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md §7 / §8 / §11
 *
 * 用法：
 *   node build.mjs                 # 生成 dist/
 *   node build.mjs --check         # 只跑门禁，不写文件
 * 环境变量：
 *   OWNDSH_SITE_BASE    站点基路径（默认 /home/；部署到域名根时设为 /）
 *   OWNDSH_SITE_ORIGIN  canonical/sitemap 使用的站点来源（默认 http://62.234.16.179）
 */

import { readFile, writeFile, mkdir, cp, chmod, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname);
const DIST = join(HERE, 'dist');
const DOCS_ASSETS = process.env.OWNDSH_DOCS_ASSETS ?? '/opt/owndsh/docs-assets';
const UPSTREAM_ASSETS = process.env.OWNDSH_UPSTREAM_ASSETS ?? '/opt/owndsh/src/website/assets';
const SRC_ROOT = process.env.OWNDSH_SRC_ROOT ?? '/opt/owndsh/src';
const BASE = process.env.OWNDSH_SITE_BASE ?? '/home/';
const ORIGIN = process.env.OWNDSH_SITE_ORIGIN ?? 'http://62.234.16.179';
const CHECK = process.argv.includes('--check');

// ─────────────────────────────────────────────── YAML 子集解析
function parseYamlSubset(text) {
  const lines = text.split('\n');
  const root = {};
  const stack = [{ indent: -1, container: root }];
  const stripComment = (value) => {
    let out = ''; let quote = null;
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (quote) { out += ch; if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") { quote = ch; out += ch; }
      else if (ch === '#' && (i === 0 || /\s/.test(value[i - 1]))) break;
      else out += ch;
    }
    return out.trimEnd();
  };
  const parseScalar = (value) => {
    if (value === '' || value === 'null' || value === '~') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^-?\d+$/.test(value)) return Number(value);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
    return value;
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
        const inline = rest.join(':').trim();
        if (inline.startsWith('{') && inline.endsWith('}')) {
          node[key.trim()] = parseFlowMap(inline);
        } else {
          node[key.trim()] = parseScalar(inline);
        }
        parent.push(node);
        stack.push({ indent, container: node });
      } else parent.push(parseScalar(item));
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
    if (rest.startsWith('{') && rest.endsWith('}')) { parent[key] = parseFlowMap(rest); continue; }
    parent[key] = parseScalar(rest);
  }
  return root;

  function parseFlowMap(text) {
    const node = {};
    text.slice(1, -1).split(',').forEach((pair) => {
      const [k, ...v] = pair.split(':');
      if (!k || v.length === 0) return;
      node[k.trim().replace(/^["']|["']$/g, '')] = parseScalar(v.join(':').trim());
    });
    return node;
  }
}

// ─────────────────────────────────────────────── 门禁
async function gatePublicContent(files) {
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
  for (const [file, text] of files) {
    for (const hit of text.match(privateIp) ?? []) problems.push(`${file}: 出现内网地址 ${hit}`);
    for (const secret of secrets) if (text.includes(secret.value)) problems.push(`${file}: 出现 ${secret.name} 的取值`);
    if (/BEGIN [A-Z ]*PRIVATE KEY/.test(text)) problems.push(`${file}: 出现私钥块`);
  }
  return [...new Set(problems)];
}

// ─────────────────────────────────────────────── 构建
async function main() {
  const config = parseYamlSubset(await readFile(join(HERE, 'config/site.yaml'), 'utf8'));
  const site = config.site;
  const problems = [];
  const pages = [];
  // 绝对地址一律带上基路径：/home/ 部署时首页 canonical 是 …/home/，而不是控制台所在的 …/
  const absolute = (path) => `${ORIGIN}${BASE}${path.replace(/^\//, '')}`;
  const sourceFiles = [];

  const nav = await readFile(join(HERE, 'partials/nav.html'), 'utf8');
  const footerTemplate = await readFile(join(HERE, 'partials/footer.html'), 'utf8');
  const footer = footerTemplate
    .replaceAll('{{siteName}}', site.name)
    .replaceAll('{{license}}', site.license)
    .replaceAll('{{repository}}', site.repository)
    .replaceAll('{{upstream}}', site.upstream)
    .replaceAll('{{disclaimer}}', String(site.compliance.disclaimer).replace(/\s+/g, ' ').trim());

  for (const page of config.pages) {
    // 目录型路径 → <dir>/index.html；已带扩展名的页面（如 /404.html）原样使用
    const relative = page.path === '/'
      ? 'index.html'
      : /\.html?$/.test(page.path)
        ? page.path.replace(/^\//, '')
        : `${page.path.replace(/^\/|\/$/g, '')}/index.html`;
    const file = join(HERE, 'content', relative);
    if (!existsSync(file)) { problems.push(`未撰写：content/${relative}（${page.id}）`); continue; }
    sourceFiles.push([`content/${relative}`, await readFile(file, 'utf8')]);
    pages.push({ ...page, relative });
  }

  problems.push(...(await gatePublicContent(sourceFiles)));

  // 资源引用与 SEO 元数据由下面的装配阶段校验；这里先装配
  const built = [];
  for (const page of pages) {
    const raw = sourceFiles.find(([name]) => name.endsWith(page.relative))[1];
    const canonical = absolute(page.path);
    const headMeta = [
      '<meta charset="UTF-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '<meta name="color-scheme" content="light dark" />',
      `<meta name="robots" content="${page.indexable ? 'index, follow' : 'noindex, follow'}" />`,
      `<title>${page.title}</title>`,
      `<meta name="description" content="${page.description}" />`,
      `<link rel="canonical" href="${canonical}" />`,
      '<meta property="og:type" content="website" />',
      `<meta property="og:locale" content="${site.defaultLocale.replace('-', '_')}" />`,
      `<meta property="og:site_name" content="${site.name}" />`,
      `<meta property="og:title" content="${page.title}" />`,
      `<meta property="og:description" content="${page.description}" />`,
      `<meta property="og:url" content="${canonical}" />`,
      page.ogImage ? `<meta property="og:image" content="${ORIGIN}${page.ogImage}" />` : '',
      page.ogImage ? '<meta name="twitter:card" content="summary_large_image" />' : '',
      `<link rel="alternate" hreflang="zh-CN" href="${canonical}" />`,
      // 英文站占位：P3 落地时把 en 加进 site.locales，这里会自动输出 hreflang="en"
      (site.locales ?? []).includes('en')
        ? `<link rel="alternate" hreflang="en" href="${ORIGIN}/en${page.path}" />`
        : '<!-- 英文站占位：P3 落地（site.locales 增加 en 后自动启用 hreflang） -->',
      '<link rel="icon" href="{{base}}assets/brand/favicon.png" />',
      '<link rel="stylesheet" href="{{base}}assets/theme.css" />',
      '<link rel="stylesheet" href="{{base}}assets/site.css" />',
      '<script src="{{base}}assets/theme-boot.js"></script>',
      page.indexable
        ? `<script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: site.name,
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Docker (Linux amd64)',
          description: page.description,
          license: 'https://opensource.org/licenses/MIT',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
          sameAs: [site.repository]
        })}</script>`
        : ''
    ].filter(Boolean).join('\n    ');

    let html = raw
      .replaceAll('<!-- inject:head-meta -->', headMeta)
      .replaceAll('<!-- inject:nav -->', nav)
      .replaceAll('<!-- inject:footer -->', footer)
      .replaceAll('{{base}}', BASE);
    built.push({ page, html });
  }

  // SEO 必填：所有页要有 title/description；可索引页还必须有 ogImage，且该图片必须真实存在
  for (const page of pages) {
    for (const field of ['title', 'description', 'path', 'indexable']) {
      if (page[field] === undefined || page[field] === null) problems.push(`config/site.yaml: ${page.id} 缺少 SEO 必填字段 ${field}`);
    }
    if (!page.indexable) continue;
    if (!page.ogImage) { problems.push(`config/site.yaml: ${page.id} 缺少 ogImage（可索引页必须有分享图）`); continue; }
    const ogRelative = page.ogImage.replace(new RegExp(`^${BASE}`), '').replace(/^\//, '');
    const candidates = [
      join(DIST, ogRelative),
      join(HERE, 'assets', ogRelative.replace(/^assets\//, '')),
      join(UPSTREAM_ASSETS, ogRelative.replace(/^assets\/(shots|brand)\//, ''))
    ];
    if (!candidates.some((candidate) => existsSync(candidate))) {
      problems.push(`${page.id}: ogImage 指向的文件不存在 → ${page.ogImage}（分享卡片必须真实存在，不能是占位路径）`);
    }
  }

  // 链接与资源完整性：站内 href/src 必须存在于产物
  const knownPaths = new Set(pages.map((page) => page.path));
  const assetNames = new Set();
  for (const dir of [join(HERE, 'assets'), DOCS_ASSETS]) {
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isFile()) assetNames.add(entry.name);
      if (entry.isDirectory()) for (const inner of await readdir(join(dir, entry.name))) assetNames.add(`${entry.name}/${inner}`);
    }
  }
  const isLocalRef = (href) => href.startsWith('/') && !href.startsWith('//');
  for (const { page, html } of built) {
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = match[1];
      if (!isLocalRef(raw)) continue;
      const target = raw.startsWith(BASE) ? raw.slice(BASE.length - 1) : raw;
      const withoutHash = target.split('#')[0];
      if (withoutHash === '' || withoutHash === '/') continue;
      if (withoutHash.startsWith('/help/') || withoutHash.startsWith('/api-docs/') || withoutHash.startsWith('/enterprise/') || withoutHash.startsWith('/assets/')) continue; // 站外同源路径：文档站与控制台
      if (withoutHash.startsWith('/home/')) {
        const stripped = withoutHash.slice('/home'.length);
        if (!knownPaths.has(stripped) && !assetNames.has(stripped.replace(/^\/assets\//, ''))) {
          problems.push(`${page.id}: 站内引用不存在 → ${raw}`);
        }
        continue;
      }
      if (withoutHash.startsWith('/assets/')) continue;
      if (!knownPaths.has(withoutHash) && !assetNames.has(withoutHash.replace(/^\//, ''))) {
        problems.push(`${page.id}: 站内链接不存在 → ${raw}`);
      }
    }
  }

  // 外部请求白名单
  const allowlist = new Set(config.gates?.externalRequests?.allowlist ?? []);
  const selfHost = ORIGIN.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
  for (const { page, html } of built) {
    for (const match of html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const host = match[1].toLowerCase();
      // 自身 origin（canonical/og:url）与结构化数据里的 schema/许可链接不算外部依赖
      if (host === selfHost) continue;
      if (host.startsWith('schema.org') || host.startsWith('opensource.org')) continue;
      if (!allowlist.has(host)) problems.push(`${page.id}: 出现白名单外的外部域名 → ${host}`);
    }
  }

  // HTML 注释完整性：注释体内出现 "--" 或嵌套注释，浏览器会提前结束注释，
  // 后面的文字就会被当成正文渲染（本次 [PROTOCOL] 行漏出正是这个原因）。
  for (const { page, html } of built) {
    for (const match of html.matchAll(/<!--([\s\S]*?)-->/g)) {
      if (match[1].includes('--')) problems.push(`${page.id}: HTML 注释体内出现 "--"（会提前闭合注释）`);
      if (match[1].includes('<!--')) problems.push(`${page.id}: HTML 注释里嵌套了注释（会让外层提前闭合）`);
    }
    const visible = html.replace(/<!--[\s\S]*?-->/g, '');
    const leaked = visible.match(/\[(?:INPUT|OUTPUT|POS|PROTOCOL)\]/);
    if (leaked) problems.push(`${page.id}: 头部注释泄漏为可见正文（${leaked[0]}）`);
  }

  if (CHECK || problems.length > 0) {
    const blocking = problems.filter((problem) => !problem.startsWith('未撰写：'));
    if (blocking.length > 0) {
      console.error(`[build-site] 门禁失败（${blocking.length} 项）：`);
      blocking.forEach((problem) => console.error(`  ✗ ${problem}`));
      process.exit(1);
    }
  }

  // ── 写产物
  await mkdir(DIST, { recursive: true });
  for (const entry of await readdir(DIST)) await rm(join(DIST, entry), { recursive: true, force: true });

  for (const { page, html } of built) {
    const out = join(DIST, page.relative);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html);
  }

  // 资源：站点自身 + 共享令牌/字体 + 上游真实截图与品牌图
  await cp(join(HERE, 'assets'), join(DIST, 'assets'), { recursive: true });
  await cp(join(DOCS_ASSETS, 'theme.css'), join(DIST, 'assets/theme.css'));
  await mkdir(join(DIST, 'assets/fonts'), { recursive: true });
  await cp(join(DOCS_ASSETS, 'fonts'), join(DIST, 'assets/fonts'), { recursive: true });
  await mkdir(join(DIST, 'assets/shots'), { recursive: true });
  await mkdir(join(DIST, 'assets/brand'), { recursive: true });
  if (existsSync(UPSTREAM_ASSETS)) {
    for (const entry of await readdir(UPSTREAM_ASSETS)) {
      const from = join(UPSTREAM_ASSETS, entry);
      if (!(await stat(from)).isFile()) continue;
      if (/\.(jpg|jpeg|png|webp)$/i.test(entry)) {
        const target = /favicon|whale/.test(entry) ? join(DIST, 'assets/brand', entry) : join(DIST, 'assets/shots', entry);
        await cp(from, target);
      }
    }
  }

  // sitemap 与 robots（自有策略，取代平台默认）
  const indexable = pages.filter((page) => page.indexable);
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...indexable.map((page) => `  <url><loc>${absolute(page.path)}</loc></url>`),
    '</urlset>',
    ''
  ].join('\n');
  await writeFile(join(DIST, 'sitemap.xml'), sitemap);
  await writeFile(join(DIST, 'robots.txt'), [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    ''
  ].join('\n'));

  if (existsSync(join(HERE, 'config/headers'))) {
    await cp(join(HERE, 'config/headers'), join(DIST, '_headers'));
  }

  async function makeReadable(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { await chmod(full, 0o755); await makeReadable(full); }
      else await chmod(full, 0o644);
    }
  }
  await chmod(DIST, 0o755);
  await makeReadable(DIST);

  const pending = problems.filter((problem) => problem.startsWith('未撰写：'));
  console.log('[build-site] 生成完成');
  console.log(`  基路径 ${BASE}  来源 ${ORIGIN}`);
  console.log(`  页面 ${pages.length} 篇（可索引 ${indexable.length}）+ sitemap + robots`);
  pending.forEach((problem) => console.log(`  · ${problem}`));
  console.log(`  产物 ${DIST}`);
}

await main();
