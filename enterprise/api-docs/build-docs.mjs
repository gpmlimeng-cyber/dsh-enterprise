/**
 * [INPUT]: 依赖 contracts/enterprise-openapi.yaml 契约真源、config/tags.yaml、config/overlay.zh.yaml、
 *          config/intro.zh.md、server/**\/*Controller.java 的 @RequestMapping/@SaCheckPermission 注解，
 *          以及可选的 contracts/generated/protocol-sha256.txt。
 * [OUTPUT]: 生成 dist/enterprise-openapi.json（注入 servers/tags/中文文案/权限矩阵/错误码字典/构建指纹）
 *           与 dist/index.html、dist/theme.css，并支持 --check 漂移门禁。
 * [POS]: API 文档门户的构建期唯一入口；只读契约与源码，绝不修改契约真源（保证 check:generated 仍通过）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 设计方案.md §6.1
 *
 * 用法：
 *   node build-docs.mjs                 # 生成 dist/
 *   node build-docs.mjs --check         # 不写文件，只校验文案/分组是否覆盖全部 operationId
 *   node build-docs.mjs --check --strict # 额外要求 permission=auto 的项必须被源码提取器解析出结果
 *
 * 说明：本文件是设计方案附带的可用草稿。P1 落地时按仓库实际依赖（swagger-parser / yaml）微调 import。
 */

import { readFile, writeFile, mkdir, cp, chmod, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname);
const SRC_ROOT = process.env.OWNDSH_SRC_ROOT ?? '/opt/owndsh/src';
const CONTRACT = join(SRC_ROOT, 'contracts/enterprise-openapi.yaml');
const BUNDLED = join(SRC_ROOT, 'contracts/generated/enterprise-openapi.json');
const PROTOCOL_HASH = join(SRC_ROOT, 'contracts/generated/protocol-sha256.txt');
const DIST = join(HERE, 'dist');

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const STRICT = args.has('--strict');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

// ─────────────────────────────────────────────── 极简 YAML 读取（仅支持本仓库配置的子集）
// P1 落地时替换为 `yaml` 包：import { parse } from 'yaml';
async function loadSimpleYaml(path) {
  const text = await readFile(path, 'utf8');
  return parseYamlSubset(text);
}

/**
 * 支持：映射、序列、标量、行内 {k: v, k2: v2}、块标量(>- / |)、# 注释、引号字符串。
 * 不支持：锚点/别名、多文档、复杂流式嵌套。配置文件的复杂度刚好落在这个子集内。
 */
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
    let line = stripComment(raw.trim());

    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).container;

    if (line.startsWith('- ')) {
      const item = line.slice(2).trim();
      const list = Array.isArray(parent) ? parent : null;
      if (!list) continue;
      if (/^[A-Za-z0-9_."'-]+:\s/.test(item)) {
        const [key, ...rest] = item.split(':');
        const node = {};
        node[key.trim()] = parseScalar(rest.join(':').trim());
        list.push(node);
        stack.push({ indent, container: node });
      } else {
        list.push(parseScalar(item));
      }
      continue;
    }

    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim().replace(/^["']|["']$/g, '');
    const rest = line.slice(sep + 1).trim();

    if (rest === '' || rest === '>' || rest === '>-' || rest === '|' || rest === '|-') {
      // 块标量或嵌套容器：先探测下一非空行是列表还是映射
      let nested = null;
      let probe = index + 1;
      while (probe < lines.length && (!lines[probe].trim() || lines[probe].trim().startsWith('#'))) probe += 1;
      const probeIndent = probe < lines.length ? lines[probe].length - lines[probe].trimStart().length : -1;
      const isList = probe < lines.length && lines[probe].trim().startsWith('- ');
      if (isList && rest === '') {
        nested = [];
      } else if (rest === '') {
        nested = {};
      } else {
        // 块标量：收集更深缩进的行
        const chunks = [];
        let cursor = index + 1;
        while (cursor < lines.length) {
          const candidate = lines[cursor];
          if (candidate.trim() === '') { chunks.push(''); cursor += 1; continue; }
          const candidateIndent = candidate.length - candidate.trimStart().length;
          if (candidateIndent <= indent) break;
          chunks.push(candidate.slice(indent + 2));
          cursor += 1;
        }
        index = cursor - 1;
        const folded = rest.startsWith('>');
        nested = chunks
          .map((chunk) => chunk.trimEnd())
          .join(folded ? ' ' : '\n')
          .replace(/\s+/g, folded ? ' ' : '\n')
          .trim();
        if (rest.endsWith('-')) nested += folded ? '' : '\n';
      }
      parent[key] = nested;
      if (nested !== null && typeof nested === 'object') stack.push({ indent, container: nested });
      continue;
    }

    if (rest.startsWith('{') && rest.endsWith('}')) {
      const node = {};
      rest.slice(1, -1).split(',').forEach((pair) => {
        const [k, ...v] = pair.split(':');
        if (k && v.length) node[k.trim()] = parseScalar(v.join(':').trim());
      });
      parent[key] = node;
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

// ─────────────────────────────────────────────── 步骤 1：读取契约（优先用打包 JSON，避免 YAML 依赖）
async function loadContract() {
  if (existsSync(BUNDLED)) {
    return JSON.parse(await readFile(BUNDLED, 'utf8'));
  }
  // 兜底：契约只有 YAML 时，P1 落地改用 swagger-parser bundle
  const { default: SwaggerParser } = await import('@apidevtools/swagger-parser');
  return SwaggerParser.bundle(CONTRACT);
}

// ─────────────────────────────────────────────── 步骤 5：从 Java 源码提取权限矩阵
/**
 * 关联逻辑：类级 @RequestMapping("/enterprise/admin/v1/devices")
 *        + 方法级 @GetMapping("/{deviceId}") + HTTP 动词
 *        = "GET /enterprise/admin/v1/devices/{deviceId}"
 *        再与契约的 method+path 关联，得到 operationId → ent:* 权限。
 * 提取失败时回落到 overlay 里显式标注的值；两者都无则记为 unknown（--strict 下失败）。
 *
 * 实现说明：用纯 Node 递归遍历，不调用 shell —— 构建容器是 node:*-alpine，
 * busybox grep 不支持 --include，走 shell 会静默漏掉全部控制器。
 */
async function extractPermissions() {
  const controllers = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // server/ 源码不在场时（例如只挂了 contracts/）安静跳过
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('Controller.java')) controllers.push(full);
    }
  }
  await walk(join(SRC_ROOT, 'server'));

  const table = {};
  for (const file of controllers) {
    const text = await readFile(file, 'utf8');
    if (!text.includes('@SaCheckPermission')) continue;
    const base = text.match(/@RequestMapping\(\s*"([^"]+)"/)?.[1] ?? '';
    const methodRe = /@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*(?:value\s*=\s*)?"([^"]*)"[^)]*\))?([\s\S]{0,600}?)@SaCheckPermission\(\s*"([^"]+)"\s*\)/g;
    for (const match of text.matchAll(methodRe)) {
      const [, verb, sub = '', , permission] = match;
      const path = normalizePath(base + sub);
      table[`${verb.toUpperCase()} ${path}`] = permission;
    }
  }
  return table;
}

function normalizePath(path) {
  const joined = `/${path}`.replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

// ─────────────────────────────────────────────── 步骤 2/3/4/6/7/8：装配
async function build() {
  const spec = await loadContract();
  const tagsConfig = await loadSimpleYaml(join(HERE, 'config/tags.yaml'));
  const overlay = await loadSimpleYaml(join(HERE, 'config/overlay.zh.yaml'));
  const intro = await readFile(join(HERE, 'config/intro.zh.md'), 'utf8');
  const permissionTable = await extractPermissions();

  const contractOperations = new Map();
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method) || !operation?.operationId) continue;
      contractOperations.set(operation.operationId, { path, method, operation });
    }
  }

  const problems = [];
  const tagByOperation = new Map();
  const groupNames = [];
  for (const group of tagsConfig.tagGroups ?? []) {
    groupNames.push(group.name);
    for (const tag of group.tags ?? []) {
      for (const operationId of tag.operations ?? []) {
        if (!contractOperations.has(operationId)) {
          problems.push(`tags.yaml: 契约中不存在 operationId「${operationId}」（tag: ${tag.name}）`);
          continue;
        }
        if (tagByOperation.has(operationId)) {
          problems.push(`tags.yaml: operationId「${operationId}」被重复分组`);
        }
        tagByOperation.set(operationId, { group: group.name, tag: tag.name });
      }
    }
  }
  for (const operationId of contractOperations.keys()) {
    if (!tagByOperation.has(operationId)) problems.push(`tags.yaml: 未分组「${operationId}」`);
    if (!overlay.operations?.[operationId]?.summary) problems.push(`overlay.zh.yaml: 缺少中文摘要「${operationId}」`);
  }

  const contractCodes = new Set(Object.values(spec['x-enterprise-error-statuses'] ?? {}).flat());
  for (const code of contractCodes) {
    if (!overlay.errorCodes?.[code]) problems.push(`overlay.zh.yaml: 缺少错误码释义「${code}」`);
  }
  for (const code of Object.keys(overlay.errorCodes ?? {})) {
    if (!contractCodes.has(code)) problems.push(`overlay.zh.yaml: 契约中不存在的错误码「${code}」`);
  }

  if (problems.length > 0) {
    console.error(`[build-docs] 覆盖校验失败（${problems.length} 项）：`);
    problems.forEach((problem) => console.error(`  ✗ ${problem}`));
    if (CHECK) process.exit(1);
  }

  // ── 逐操作注入中文文案、tag、权限、写操作标记
  const unknownPermissions = [];
  for (const [operationId, entry] of contractOperations) {
    const { path, method, operation } = entry;
    const text = overlay.operations?.[operationId] ?? {};
    const grouping = tagByOperation.get(operationId);

    operation.summary = text.summary ?? operation.summary ?? operationId;
    const writeWarning = text.write === true
      ? '> ⚠️ **写操作**：本请求会修改平台数据。在本文档页执行 Try it out 将**直接作用于生产环境**，请确认目标资源后再发送。\n\n'
      : '';
    if (text.description) operation.description = writeWarning + text.description;
    else if (writeWarning) operation.description = writeWarning.trimEnd();
    if (grouping) operation.tags = [grouping.tag];

    // Scalar 1.68.0 已验证支持：x-scalar-stability（稳定性徽标）、x-scalar-order（导航顺序）
    operation['x-scalar-stability'] = text.stability ?? 'stable';

    const declared = text.permission;
    const extracted = permissionTable[`${method.toUpperCase()} ${path}`];
    let permission = extracted ?? (declared && declared !== 'auto' ? declared : undefined);
    if (declared === 'auto' && !extracted) {
      unknownPermissions.push(`${operationId}（${method.toUpperCase()} ${path}）`);
      permission = undefined;
    }
    if (permission) operation['x-enterprise-permission'] = permission;
    if (text.write === true) operation['x-docs-write-risk'] = true;
    if (text.idempotent) operation['x-docs-idempotent'] = text.idempotent;
  }

  if (unknownPermissions.length > 0) {
    const message = `[build-docs] 权限提取未命中（${unknownPermissions.length} 项）：\n  ${unknownPermissions.join('\n  ')}`;
    if (STRICT) { console.error(message); process.exit(1); }
    console.warn(message);
  }

  // ── 分组、servers、info、错误码字典
  spec.tags = (tagsConfig.tagGroups ?? []).flatMap((group) =>
    (group.tags ?? []).map((tag) => ({ name: tag.name, description: tag.description }))
  );
  spec['x-tagGroups'] = (tagsConfig.tagGroups ?? []).map((group) => ({
    name: group.name,
    tags: (group.tags ?? []).map((tag) => tag.name)
  }));
  // Scalar 1.68.0 支持 x-scalar-order：固定侧栏顺序，避免依赖契约里的 tag 出现顺序
  spec['x-scalar-order'] = spec.tags.map((tag) => tag.name);

  // 相对 server：HTTP→HTTPS 迁移、换域名/IP 都不用重生成文档，Try it out 自动跟随页面 origin
  spec.servers = [{ url: '/', description: '当前站点（同源）' }];

  const errorTable = Object.entries(spec['x-enterprise-error-statuses'] ?? {})
    .map(([status, codes]) => {
      const rows = codes
        .map((code) => `| \`${code}\` | ${overlay.errorCodes?.[code]?.meaning ?? ''} | ${overlay.errorCodes?.[code]?.action ?? ''} |`)
        .join('\n');
      return `#### HTTP ${status}\n\n| 错误码 | 含义 | 处置建议 |\n|---|---|---|\n${rows}`;
    })
    .join('\n\n');

  const protocolHash = existsSync(PROTOCOL_HASH)
    ? (await readFile(PROTOCOL_HASH, 'utf8')).trim()
    : 'unknown';
  const commit = process.env.OWNDSH_COMMIT ?? (() => {
    try {
      return execFileSync('git', ['-C', SRC_ROOT, 'rev-parse', '--short', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      return 'unknown';
    }
  })();
  const generatedAt = new Date().toISOString();

  spec.info.title = 'DSH Enterprise 企业管理平台 API';
  spec.info.description = [
    intro.trim(),
    `\n---\n\n### 错误码字典\n\n> 由契约 \`x-enterprise-error-statuses\` 的 ${contractCodes.size} 个稳定错误码自动生成。\n`,
    errorTable
  ].join('\n');
  spec.info['x-owndsh-build'] = {
    version: spec.info.version,
    commit,
    protocolSha256: protocolHash,
    generatedAt,
    operationCount: contractOperations.size,
    tagCount: spec.tags.length
  };

  // 去掉仅用于跨语言契约夹具的扩展，缩小传输体积
  delete spec['x-enterprise-fixtures'];

  if (CHECK) {
    console.log(`[build-docs] 覆盖校验通过：${contractOperations.size} 个操作 / ${spec.tags.length} 个 tag / ${contractCodes.size} 个错误码`);
    return;
  }

  // ── 写产物
  await mkdir(DIST, { recursive: true });
  const specJson = JSON.stringify(spec);
  await writeFile(join(DIST, 'enterprise-openapi.json'), specJson);
  await cp(join(HERE, 'public/index.html'), join(DIST, 'index.html'));
  await cp(join(HERE, 'public/theme.css'), join(DIST, 'theme.css'));
  if (existsSync(join(HERE, 'public/fonts'))) {
    await cp(join(HERE, 'public/fonts'), join(DIST, 'fonts'), { recursive: true });
  } else {
    console.warn('[build-docs] 未找到 public/fonts —— 文档将回落到系统字体');
  }
  if (existsSync(join(HERE, 'vendor/scalar.standalone.js'))) {
    await cp(join(HERE, 'vendor/scalar.standalone.js'), join(DIST, 'scalar.standalone.js'));
  } else if (existsSync(join(HERE, 'public/scalar.standalone.js'))) {
    await cp(join(HERE, 'public/scalar.standalone.js'), join(DIST, 'scalar.standalone.js'));
  } else {
    console.warn('[build-docs] 未找到 vendor/scalar.standalone.js —— 页面会回落到 public/ 里的占位提示');
  }

  // 容器内为 user 101:101 且 rootfs 只读，产物必须 world-readable，否则 bind mount 后 403
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

  console.log('[build-docs] 生成完成');
  console.log(`  操作 ${contractOperations.size} / tag ${spec.tags.length} / 分组 ${groupNames.length} / 错误码 ${contractCodes.size}`);
  console.log(`  spec ${(Buffer.byteLength(specJson) / 1024 / 1024).toFixed(2)} MB（未压缩，nginx 侧 gzip 生效）`);
  console.log(`  协议指纹 ${protocolHash.slice(0, 16)}…  commit ${commit}`);
  console.log(`  产物目录 ${DIST}`);
}

await build();
