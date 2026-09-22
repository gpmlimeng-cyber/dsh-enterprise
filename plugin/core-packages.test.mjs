/**
 * [INPUT]: 依赖 contracts/plugin-core-packages.json、workspace 各 package.json 的真实 name 与 plugin-distribution service.ts 的源码文本
 * [OUTPUT]: 提供企业核心包清单与客户端安装信任锚之间的双向漂移门禁，并拦截工作区不存在的死包名
 * [POS]: plugin 的根级跨端不变量测试，与 workspace.test.mjs 同级，守护 Server/Client 唯一真源不被单侧修改
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const WORKSPACE_ROOT = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(WORKSPACE_ROOT, '..')
const CONTRACT_PATH = resolve(PROJECT_ROOT, 'contracts', 'plugin-core-packages.json')
const SERVICE_PATH = resolve(WORKSPACE_ROOT, 'packages', 'plugin-distribution', 'src', 'service.ts')

/** 唯一匹配常量声明本身，避免把文件里其它 new Set([...]) 误当成信任锚；允许可选类型参数。 */
const PROTECTED_DECLARATION =
  /export\s+const\s+PROTECTED_ENTERPRISE_PACKAGES(?:\s*:\s*[^=]+)?\s*=\s*new Set(?:\s*<[^>]*>)?\s*\(\s*\[([\s\S]*?)\]\s*\)/

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

/** 枚举 workspace 真实存在的 package 名：根清单 + packages/* 的 name 字段。 */
async function realPackageNames() {
  const names = new Set()
  names.add((await readJson(resolve(WORKSPACE_ROOT, 'package.json'))).name)
  const packagesRoot = resolve(WORKSPACE_ROOT, 'packages')
  for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    try {
      const manifest = await readJson(resolve(packagesRoot, entry.name, 'package.json'))
      names.add(manifest.name)
    } catch {
      // 没有 package.json 的目录不是 workspace 成员，由 workspace.test.mjs 负责成员集合
    }
  }
  return names
}

/** 从 TS 源码解析信任锚；解析不到必须响亮失败，绝不静默退化成空集。 */
function parseProtectedPackages(source) {
  const declaration = source.match(PROTECTED_DECLARATION)
  assert.notEqual(
    declaration,
    null,
    `无法在 ${SERVICE_PATH} 中找到 PROTECTED_ENTERPRISE_PACKAGES 的 new Set([...]) 声明。`
    + '该常量是客户端安装信任锚，被重命名、改为从配置读取或挪出本文件都会让门禁失效；'
    + '请恢复声明，或同步更新本测试的解析目标，禁止让门禁静默通过。',
  )
  const literals = [...declaration[1].matchAll(/'([^']*)'|"([^"]*)"/g)]
    .map(match => match[1] ?? match[2])
  assert.ok(
    literals.length > 0,
    `PROTECTED_ENTERPRISE_PACKAGES 解析结果为空：${SERVICE_PATH} 的声明里没有字符串字面量，`
    + '门禁拒绝以空集通过。',
  )
  return new Set(literals)
}

/** 单向差集，用于给出「哪一侧多了哪个名字」的可操作提示。 */
function difference(left, right) {
  return [...left].filter(name => !right.has(name)).sort()
}

test('core package contract entries are real workspace packages', async () => {
  const [contract, real] = await Promise.all([readJson(CONTRACT_PATH), realPackageNames()])
  assert.ok(
    Array.isArray(contract.packages) && contract.packages.length > 0,
    `${CONTRACT_PATH} 的 packages 必须是非空字符串数组：空清单会让本门禁失去意义。`,
  )
  const dead = contract.packages.filter(name => !real.has(name))
  assert.deepEqual(
    dead,
    [],
    `企业核心包清单出现死包名：${dead.join('、')}。`
    + `这些名字不是 plugin/package.json 或 plugin/packages/*/package.json 里的真实 name，`
    + `多半是跨包改名（例如 @owndsh -> @dshent）后只改了一侧。`
    + `请修正 ${CONTRACT_PATH}，把它对齐到工作区真实包名。`,
  )
})

test('client install trust anchor matches the core package contract exactly', async () => {
  const [contract, source] = await Promise.all([
    readJson(CONTRACT_PATH),
    readFile(SERVICE_PATH, 'utf8'),
  ])
  const client = parseProtectedPackages(source)
  const declared = new Set(contract.packages)

  const missingInClient = difference(declared, client)
  assert.deepEqual(
    missingInClient,
    [],
    `核心包保护清单漂移（客户端缺失）：${missingInClient.join('、')}。`
    + `${CONTRACT_PATH} 已列出但 ${SERVICE_PATH} 的 PROTECTED_ENTERPRISE_PACKAGES 没有，`
    + `这些包会在安装或覆盖时绕过 ENT_PLUGIN_CORE_PROTECTED 保护。请补齐该常量。`,
  )

  const missingInContract = difference(client, declared)
  assert.deepEqual(
    missingInContract,
    [],
    `核心包保护清单漂移（契约缺失）：${missingInContract.join('、')}。`
    + `${SERVICE_PATH} 已保护但 ${CONTRACT_PATH} 未列出，`
    + `服务端上传验包不会拒绝这些包。请补齐契约清单，禁止只改一侧。`,
  )
})
