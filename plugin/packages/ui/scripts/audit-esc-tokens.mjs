/**
 * [INPUT]: 本仓 `packages/ui/src/**` 里所有 `var(--dsw-alias-*)` 用法 + DSH 主题包（`dsh-client-ui-theme`）里
 *   真实定义过的 token 名。主题包不在本工作区的依赖里，故按候选路径找，或用 `--defined <file>` / 环境变量
 *   `DSH_THEME_CLIENT` 直接给一份（文件里任意位置出现 `--dsw-alias-x:` 都会被视为"定义过"）。
 * [OUTPUT]: 打印 used / defined / **dead** 三行读数；默认**只报告**（exit 0，便于随时看），
 *   `--strict` 时"有死 token 即 exit 1"（扫干净后接门禁用——**已扫干净，见下面的读数**），`--json` 出机器可读结果。
 *   ★首次运行读数（2026-10-07）：`src/esc` 子树 **0 枚**；整个 `src` 共 **9 枚**，全在 esc 之外的老面板里
 *   （account-* / login-page / marketplace-* / plugin-market / preset-market / skill-market / markdown-render /
 *   menu-styles / maintenance-view / shortcuts-view / feedback-dialog）——那 9 枚留给**下一刀**。
 *   ★**那一刀已经做完了（2026-10-07）**：9 枚按主题真源逐枚换成真名（`accent-primary`→`brand-primary`、
 *   `background-primary`→`bg-layer-1`、`background-secondary`/`fill-secondary`→`bg-skeleton`、
 *   `label-disabled`→`label-dimmed`、`label-on-primary`→`label-primary-foreground`、
 *   `status-error`→`state-error-primary`、`status-warning`→`state-warn-primary`、
 *   `stroke-border-2`→`border-l2`），换掉 **72 处**声明（14 个源文件）。**当前读数：`dead 0 枚`**，且
 *   在 0.1.7-rc.2（99 枚定义）与 0.2.0-rc.2（107 枚定义）两个基线上**都是 0**。
 *   ⇒ **`--strict` 现在可以直接接进门禁**：新增一枚 token 若在两版主题里都查无此名，测试即红。
 *   （`esc-style.ts:45` 早就写下了前三枚的映射，本刀只是把它推广到其余六枚与全部老面板。）
 * [POS]: 「失效 token」这一类 bug 的门禁。※ 定义集只取主题包是**验过的**：全引擎 `node_modules/@deepseek-ai/*`
 *   （theme / chat / plugin-manager）里 `--dsw-alias-x:` 的定义并集 = 主题包那 107 枚，一枚不多。它已经咬过三次（`accent-primary` 让 hover 描边回退成 currentColor
 *   的**黑边卡片**、`background-primary/secondary` 让卡片底色与字母头像兜底**整条声明作废**）——这类 bug
 *   在 vitest 里表现为"字符串锁住了"，只有对着**主题真源**才看得出来，故单独成脚本。
 *   用法：`node packages/ui/scripts/audit-esc-tokens.mjs`
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '..', 'src')
const JSON_OUT = process.argv.includes('--json')
/** 默认只**报告**（exit 0）；`--strict` 时"有死 token 就 exit 1"——本仓已扫干净（`dead 0`），这枚开关可接进门禁。 */
const STRICT = process.argv.includes('--strict')
const DEFINED_FLAG = process.argv.indexOf('--defined')

/** 主题包 client.js 的候选位置（先给 `--defined` / `DSH_THEME_CLIENT`，再按引擎安装位置猜）。 */
function themeCandidates() {
  const rel = ['node_modules', '@deepseek-ai', 'dsh-client-ui-theme', 'lib', 'client.js']
  const list = []
  if (DEFINED_FLAG > 0 && process.argv[DEFINED_FLAG + 1]) list.push(process.argv[DEFINED_FLAG + 1])
  if (process.env['DSH_THEME_CLIENT']) list.push(process.env['DSH_THEME_CLIENT'])
  list.push(resolve(HERE, '..', '..', '..', ...rel))
  list.push(resolve('/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh', ...rel))
  list.push(resolve(homedir(), '.dsh', ...rel))
  return list
}

/** 递归收集 src 下的文本文件（.ts/.tsx/.css/.mjs）。 */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|css|mjs)$/.test(name)) out.push(full)
  }
  return out
}

const files = walk(SRC)
/** used：只在**真用法** `var(--dsw-alias-x)` 里取（注释里为了记录历史提到某个名字不算使用）。 */
const used = new Map()
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/var\(\s*(--dsw-alias-[a-z0-9-]+)/g)) {
    const where = used.get(m[1]) ?? []
    if (!where.includes(file)) where.push(file)
    used.set(m[1], where)
  }
}

const themePath = themeCandidates().find(candidate => candidate && existsSync(candidate))
if (!themePath) {
  console.error('找不到 DSH 主题包 client.js —— 用 --defined <file> 或 DSH_THEME_CLIENT=<file> 指一份。')
  process.exit(2)
}
const themeText = readFileSync(themePath, 'utf8')
const defined = new Set()
for (const m of themeText.matchAll(/(--dsw-alias-[a-z0-9-]+)\s*:/g)) defined.add(m[1])

const dead = [...used.keys()].filter(token => !defined.has(token)).sort()

if (JSON_OUT) {
  console.log(JSON.stringify({ theme: themePath, files: files.length, used: [...used.keys()].sort(), defined: defined.size, dead }, null, 2))
} else {
  console.log(`used     ${used.size} 枚（扫了 ${files.length} 个源文件）`)
  console.log(`defined  ${defined.size} 枚（主题真源 ${themePath}）`)
  console.log(`dead     ${dead.length} 枚${dead.length === 0 ? ' —— 干净' : ''}`)
  for (const token of dead) console.log(`  ✗ ${token}  ←  ${used.get(token).join(', ')}`)
}
process.exit(STRICT && dead.length > 0 ? 1 : 0)
