/**
 * [INPUT]: 依赖 node:child_process 的 `execFile`（无 shell、argv 数组）、node:fs/promises 的 lstat/mkdir/realpath/rename、node:crypto 的 randomUUID、node:path 的 join、platform-client 的 `resolveEnterpriseDshHome`、`skill-install.ts` 的唯一删除入口 `deleteOwnedSkillDirectory`/`readInstalledSkillRecords`/`SKILL_LOCAL_ROOT_SEGMENTS`/`SKILL_NAME` 形状、`skill-upload.ts` 的 `readSelfInstalledRecords`/`upsertSelfInstalledRecord`（**唯一写入口**）/`installedSelfSkills`、`skill-errors.ts` 的稳定码
 * [OUTPUT]: 对外提供「自装技能卸载」的宿主内核 `uninstallSelfInstalledSkill(options, name)`（**按名字**定位唯一归属记录 + 跨归属判据 + 技能根外单向暂存 + 唯一写入口原子记账 + 幂等）、「打开所在文件夹」的宿主内核 `revealSelfInstalledSkill(options, name, signal?)`、「编辑（用系统默认应用打开这枚技能的 `SKILL.md`）」的宿主内核 `editSelfInstalledSkill(options, name, signal?)`，以及结果形状 `SelfInstalledUninstallResult`/`SelfInstalledRevealResult`/`SelfInstalledEditResult`、依赖形状 `SelfInstalledDependencies`、系统文件管理器端口 `EnterpriseFileManagerLauncher` 与默认实现 `openSystemDirectory`、系统默认应用端口 `EnterpriseSkillFileLauncher` 与默认实现 `openSystemDocument`
 * [POS]: bundle 技能纵深的**自装卸载 / 打开 / 编辑这一刀** —— 自装清单（`self-installed.json`）此前**只写不删**（`skill-upload.ts` 头注里那条「★不提供自装卸载」就是这处缺口：四条自装通路装得上、卸不掉）。本文件补上三个宿主动作（卸载 / 打开所在文件夹 / 用系统默认应用打开 `SKILL.md`），但**不新造第二份记录实现**（记录七键形状、写入口、原子写、存在性判据全在 `skill-upload.ts` 那一份里；本文件只调它），也**不新造第二份归属判据**（三个动作共用同一处 `findSelfInstalledOwner` + `centerClaimsName`）。
 *   ★**入参是技能在本机的目录名（`name`），不是记录里的 `skillId`**——这是消费方决定的：界面「已安装」的真相来自官方发现面
 *   （`GET …/skills/discovered`），那份投影的白名单里**只有 `name`、没有我们的记录 id**（且它是冻结的，不为这件事加 id）
 *   ⇒ 客户端能拿到的只有名字。而 `skillId` 的真实语义**并不统一**（本地上传是 archive 的 `manifest.id`、三方/广场/skillhub 是
 *   技能名或 slug），拿它当键必然错配；真正的落盘目录名在记录的另一格 `names[]` 里。故本文件的唯一入参口径是
 *   「`name` ∈ 某条记录的 `names`」。
 *   ★两条硬判据：① **跨归属** —— 名字被中心 `installed.json` 的任何记录认领 ⇒ **拒**（那是中心装的东西，本路由管不着）；
 *   被**另一条**自装记录也认领 ⇒ **fail-closed 拒**（状态重叠，绝不"猜一条删掉"）；只有**唯一一条**记录独占它才动手。
 *   ② **路径只能来自记录** —— 落点一律由宿主按「记录里的 `name` + 固定技能根」自己拼，客户端交来的永远只是 `name` 这**一个键**
 *   （"传一个路径进来"在本文件的端口形状上**不可表达**）。★全程零 `shell`、零 `exec(`/`execSync`/`spawn(`、零动态 import，
 *   除 `openSystemDirectory`/`openSystemDocument` 这两次系统交接（同一个 `handOffToSystem` 里**唯一**那一次 `execFile`）外
 *   不碰任何外部进程、不碰网络。
 *   ★**本刀（「编辑」＝用系统默认应用打开 `SKILL.md`）**：第三个宿主动作 `editSelfInstalledSkill`，与 `reveal` **同族同口径**，
 *   判据**一个字节都不新写**——归属解析 `readSelfInstalledRecords` + 唯一归属 `findSelfInstalledOwner` + 跨归属
 *   `centerClaimsName`（无记录 / 被中心认领 ⇒ 404）与目录落点等式 `resolveOwnedDirectory`（符号链接 / 越界 / 非常规条目 ⇒ 409）
 *   全是 `reveal` 正在用的那几处实现；本刀只在它后面**追加一层文件落点** `resolveOwnedSkillFile`：
 *   落点由宿主自己拼 `<技能根>/<name>/SKILL.md`（入参仍然**只有 `name`**），`lstat` 必须是**普通文件**（符号链接即拒、
 *   目录 / 设备 / FIFO 一律拒），技能目录与文件**各自** `realpath` 并逐字等于期望路径（越界即拒）。
 *   ★**为什么「编辑」属于这一族而不是 `skill-install.ts` 那条已装正文面**：它与 `reveal` 是同一枚技能卡「更多」菜单里的
 *   相邻两行（`去对话 / 编辑 / 打开文件夹 / 卸载`），服务的是**同一个消费方**（官方发现面只给 `name`），
 *   门禁也因此必须同源——换一条路由去读正文就等于把同一枚 `name` 的第二套归属判据引进来。
 *   ★**它不写文件**：本函数一个字节都不落到 `SKILL.md`（也不去读它的正文——那是被交出去的那个系统应用的事），
 *   宿主只做 `lstat`/`realpath` 两次元数据判定，然后把**已验证的那条绝对路径**交给系统默认应用；
 *   失败语义与 `reveal` 逐条同码：没有记录认领 / 被中心认领 / 目录或文件不在 ⇒ 404 `ENT_RESOURCE_NOT_FOUND`、
 *   符号链接 / 越界 / 非常规条目 ⇒ 409 `ENT_SKILL_CONTENT_INVALID`、系统交接失败或平台不支持 ⇒ 503 `ENT_PLATFORM_UNAVAILABLE`。
 *   ★响应**不含任何宿主路径**（`{ edited: true }` 这一枚键）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, realpath, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveEnterpriseDshHome } from '@dshent/platform-client'
import { EnterpriseSkillInstallError, skillInstallError } from './skill-errors.js'
import {
  deleteOwnedSkillDirectory,
  readInstalledSkillRecords,
  SKILL_LOCAL_ROOT_SEGMENTS,
  type EnterpriseSkillInstallOptions,
} from './skill-install.js'
import {
  installedSelfSkills,
  readSelfInstalledRecords,
  replaceSelfInstalledRecords,
  type SelfInstalledSkillRecord,
} from './skill-upload.js'

/** 技能目录名的官方 kebab 规约（与 `skill-install.ts` / `skill-upload.ts` 读盘那条逐字同源）。 */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** 名字长度上界：与 `skill-upload.ts` 读盘收窄那条 `length > 64` 逐字同源。 */
const MAX_SKILL_NAME_LENGTH = 64
/**
 * 卸载的**单向暂存位**：`<dshHome>/enterprise/skill-uninstall-trash/<uuid>/<name>`。
 *
 * 为什么在 `<技能根>` **之外**（`enterprise/` 与 `skill-staging` 同级）：暂存期间那个名字从官方 watcher
 * 的发现面里消失正是**卸载的本意**；而挪进 `<技能根>/.trash/` 的话，官方 `skill-filesystem` 会把
 * `.trash` 当成技能根下的一个技能目录（它会去看 `.trash/SKILL.md`）——「暂存」会变成「多出一个可疑技能目录」。
 * 放在技能根外则完全不可见；且它与技能根同在 `<dshHome>` 下（同一文件系统），`rename` 仍是原子的。
 */
const SKILL_UNINSTALL_TRASH_DIR_SEGMENTS = ['enterprise', 'skill-uninstall-trash'] as const

/**
 * 本文件三个内核要的最小依赖（与中心安装/自装那两份同一套优先级与同一个留痕端口）。
 *
 * `fileManager` / `fileLauncher` 是**可注入端口**：真机上是 {@link openSystemDirectory} / {@link openSystemDocument}
 * （argv 调系统文件管理器 / 系统默认应用）；测试里是 spy——没有图形会话的机器上仍能断言「宿主究竟把哪个路径交给了谁」，
 * 且不需要真开窗口。
 */
export interface SelfInstalledDependencies extends EnterpriseSkillInstallOptions {
  readonly fileManager?: EnterpriseFileManagerLauncher
  readonly fileLauncher?: EnterpriseSkillFileLauncher
}

/** 系统文件管理器交接端口（与 `platform-client` 的 `openSystemBrowser` 同一个形状）。 */
export interface EnterpriseFileManagerLauncher {
  open(directory: string, signal: AbortSignal): Promise<void>
}

/**
 * 系统**默认应用**交接端口（与 {@link EnterpriseFileManagerLauncher} 同一个形状，只是被交接的是一枚**文件**）。
 *
 * 与 `fileManager` 分成两枚端口而不是合成一枚：`reveal` 交出去的是**目录**、`edit` 交出去的是**文件**，
 * 两件事在端口形状上分开 ⇒ 「把目录当文件交出去」在类型上不可表达（反之亦然）。
 */
export interface EnterpriseSkillFileLauncher {
  openDocument(file: string, signal: AbortSignal): Promise<void>
}

/** 卸载一个自装技能目录的结果：卸载后的投影 + 两个**如实**的名字清单（Host 侧日志口径）。 */
export interface SelfInstalledUninstallResult {
  /** 卸载后的自装投影：与 `GET /skills/self-installed` **逐字同形**（只列目录仍在的记录）。 */
  readonly skills: Awaited<ReturnType<typeof installedSelfSkills>>['skills']
  /** 本次**真的**从技能根里消失的名字（幂等情形下也在这里：盘上本来就没了 ⇒ 记录照样收干净）。 */
  readonly removed: readonly string[]
  /** `removed` 里属于"记录里有、盘上本来就不在"的那部分（幂等事实，只进 Host 日志）。 */
  readonly alreadyMissing: readonly string[]
}

/** `reveal` 的结果：**只有**这一枚键——宿主绝对路径不进浏览器。 */
export interface SelfInstalledRevealResult {
  readonly revealed: true
}

/** `edit` 的结果：**只有**这一枚键——宿主绝对路径（及其目录）不进浏览器。 */
export interface SelfInstalledEditResult {
  readonly edited: true
}

/**
 * **唯一**一次系统交接：`execFile` + **参数数组**、**不走 shell**（没有 `shell: true`，也没有 `exec(`/`execSync(`）。
 *
 * 两个默认实现（{@link openSystemDirectory} / {@link openSystemDocument}）都从这条通道出去：命令与参数在各自的
 * 平台分支里是**常量 + 已解析的宿主私有绝对路径**，本函数只负责把它交给内核、并把任何失败收敛成同一个稳定码
 * （`ENT_PLATFORM_UNAVAILABLE`）——**绝不静默成功**。
 *
 * @param command - 已按 `process.platform` 决议好的 `{file,args}`（argv 直接交给内核，绝不拼命令行）。
 * @param signal - 调用方取消信号（客户端在响应写完前断开时中止，避免留下半开的子进程）。
 * @param failureMessage - 失败时那条面向 Host 日志的说明（不含路径）。
 * @throws {EnterpriseSkillInstallError} `ENT_PLATFORM_UNAVAILABLE`：系统交接失败（`open`/`xdg-open` 不在、被系统拒绝等）。
 */
async function handOffToSystem(
  command: { readonly file: string, readonly args: readonly string[] },
  signal: AbortSignal,
  failureMessage: string,
): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    execFile(command.file, command.args, { signal, windowsHide: true }, (error) => {
      if (error === null) resolvePromise()
      else reject(skillInstallError(error, 'ENT_PLATFORM_UNAVAILABLE', failureMessage))
    })
  })
}

/**
 * 用**系统文件管理器**打开一个目录：macOS `open`、Windows `explorer`、Linux `xdg-open`。
 *
 * 纪律与 `help-route.ts` 打开系统浏览器那条**逐字同款**（本仓唯一的既有口径）：
 *  · `execFile` + **参数数组**（argv 直接交给内核，绝不拼命令行）；
 *  · **不走 shell**（没有 `shell: true`，也没有 `exec(`/`execSync(`）；
 *  · 路径**不由用户输入拼接**——本实现只被 {@link revealSelfInstalledSkill} 调用，那里的路径是
 *    「记录里的技能名 + 固定技能根」拼出来、并已过 `lstat` + `realpath` 双重等式的宿主私有落点。
 *
 * @param directory - 宿主自己解析出来的**绝对目录**。
 * @param signal - 调用方取消信号（客户端在响应写完前断开时中止，避免留下半开的子进程）。
 * @throws {EnterpriseSkillInstallError} `ENT_PLATFORM_UNAVAILABLE`：平台不支持、或系统交接失败
 *   （`xdg-open` 不在、被系统拒绝等）——**绝不静默成功**。
 */
export async function openSystemDirectory(directory: string, signal: AbortSignal): Promise<void> {
  const command = process.platform === 'darwin'
    ? { file: 'open', args: [directory] }
    : process.platform === 'win32'
      ? { file: 'explorer', args: [directory] }
      : process.platform === 'linux'
        ? { file: 'xdg-open', args: [directory] }
        : undefined
  if (command === undefined) {
    throw new EnterpriseSkillInstallError(
      'ENT_PLATFORM_UNAVAILABLE',
      `the system file manager is unsupported on ${process.platform}`,
    )
  }
  await handOffToSystem(command, signal, 'the system file manager could not be opened')
}

/**
 * 用**系统默认应用**打开一枚文件：macOS `open`、Windows `start`（经 `cmd /c`）、Linux `xdg-open`。
 *
 * 纪律与 {@link openSystemDirectory} 逐字同款（同一个 {@link handOffToSystem}）：
 *  · `execFile` + **参数数组**（argv 直接交给内核，绝不拼命令行）；
 *  · **不走 shell**（`cmd /c` 是**显式 argv** 里的一次进程调用，不是 `shell: true`；没有 `exec(`/`execSync(`）；
 *  · 路径**不由用户输入拼接**——本实现只被 {@link editSelfInstalledSkill} 调用，那里的路径是
 *    「记录里的技能名 + 固定技能根 + 固定文件名」拼出来、并已过 `lstat` + `realpath` 双重等式的宿主私有落点。
 *
 * `cmd /c start "" <file>` 里那个**空标题**是 `start` 的固定语义（第一个带引号的实参是窗口标题），
 * 少了它，带空格的路径会被 `start` 当成标题吞掉。
 *
 * @param file - 宿主自己解析出来的**绝对文件路径**。
 * @param signal - 调用方取消信号（客户端在响应写完前断开时中止，避免留下半开的子进程）。
 * @throws {EnterpriseSkillInstallError} `ENT_PLATFORM_UNAVAILABLE`：平台不支持、或系统交接失败
 *   （默认应用不在、被系统拒绝等）——**绝不静默成功**。
 */
export async function openSystemDocument(file: string, signal: AbortSignal): Promise<void> {
  const command = process.platform === 'darwin'
    ? { file: 'open', args: [file] }
    : process.platform === 'win32'
      ? { file: 'cmd', args: ['/c', 'start', '', file] }
      : process.platform === 'linux'
        ? { file: 'xdg-open', args: [file] }
        : undefined
  if (command === undefined) {
    throw new EnterpriseSkillInstallError(
      'ENT_PLATFORM_UNAVAILABLE',
      `the system default application is unsupported on ${process.platform}`,
    )
  }
  await handOffToSystem(command, signal, 'the system default application could not be opened')
}

/** 客户端交来的 `name` 形状门禁：官方 kebab、≤64（与记录读盘收窄那条逐字同源）。 */
function requireSkillName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_SKILL_NAME_LENGTH
    || !SKILL_NAME_PATTERN.test(value)) {
    throw new EnterpriseSkillInstallError('ENT_INVALID_REQUEST', 'name must be a kebab-case skill directory name')
  }
  return value
}

/** 官方技能根（`<dshHome>/skills`，rank 400 的 `user-dsh` 根）。 */
function selfInstalledSkillRoot(dshHome: string): string {
  return join(dshHome, ...SKILL_LOCAL_ROOT_SEGMENTS)
}

/** `realpath`，`ENOENT` 时回 `undefined`（"不在那儿"不是故障；其余 I/O 失败非静默）。 */
async function realpathOrMissing(path: string): Promise<string | undefined> {
  try {
    return await realpath(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw skillInstallError(error, 'ENT_SKILL_CONTENT_INVALID', 'the self-installed skill path could not be resolved')
  }
}

/**
 * 名字 → **唯一**归属的自装记录（两条路由共用的第一条判据；找不到回 `undefined`，重叠**抛**）。
 *
 * 为什么不是"找到第一条就用"：自装记录是**另一份状态文件**，它的形状允许两条记录都列同一个名字
 * （安装期的 `ownedElsewhere` 预检只挡"新装时"的重叠；手工改过状态文件、或历史版本落下的重叠仍可能
 * 存在于盘上）。这时"删哪一条的目录"没有正确答案 ⇒ 按本仓 fail-closed 的纪律**拒**，绝不猜。
 *
 * @param records - 已 fail-closed 读入的自装记录。
 * @param name - 客户端交来的技能目录名（已过 kebab 门禁）。
 * @returns 唯一归属的记录；没有记录认领这个名字时 `undefined`。
 * @throws {EnterpriseSkillInstallError} `ENT_SKILL_NAME_CONFLICT`：**两条及以上**自装记录都认领这个名字。
 */
function findSelfInstalledOwner(
  records: readonly SelfInstalledSkillRecord[],
  name: string,
): SelfInstalledSkillRecord | undefined {
  const owners = records.filter(record => record.names.includes(name))
  if (owners.length > 1) {
    throw new EnterpriseSkillInstallError(
      'ENT_SKILL_NAME_CONFLICT',
      `self-installed skill name ${name} is claimed by more than one record`,
    )
  }
  return owners[0]
}

/**
 * 名字是否被**中心** `installed.json` 的任何记录认领。
 *
 * 是 ⇒ 本路由**拒**：那是中心装出来的技能目录，卸载它属于 `/skills/uninstall`（按中心雪花包 id）那条路的职责；
 * 在这里"顺手删掉"等于用一条自装路由去动企业资产。状态码选 **404 `ENT_RESOURCE_NOT_FOUND`** 而不是 409：
 * 这条路由操作的是**自装清单这个命名空间**，中心的技能对它而言就是"不在里面"（409 会暗示"请求/状态冲突、
 * 也许重试或换个参数就能成"，而这里的正确下一步是**换一条路由**，没有任何"再试一次"的空间）。
 */
async function centerClaimsName(options: SelfInstalledDependencies, name: string): Promise<boolean> {
  const records = await readInstalledSkillRecords(options)
  return records.some(record => record.names.includes(name))
}

/**
 * 把 `name` 解析成技能根下那个**已落盘的普通目录**（`reveal` 与 `uninstall` 共用的第二层；删除侧另有一份等价的落点解析）。
 *
 * `lstat` 不跟随符号链接：目录本身是符号链接 ⇒ fail-closed 拒（**不**"顺着链接看看里面"）；`realpath`
 * 必须逐字等于 `<真实技能根>/<name>` ⇒ 指向技能根之外的链接、`..`、绝对路径一律不成立（名字侧本来也过不了
 * kebab 门禁，落点侧这条等式是第二道）。`reveal` 交给系统文件管理器的就是这个**已验证的未规范化绝对路径**
 * （`<技能根>/<name>`，与 `deleteOwnedSkillDirectory` 内部拼出来的那条逐字相同）。
 */
async function resolveOwnedDirectory(
  deps: { readonly dshHome: string },
  name: string,
): Promise<{ readonly status: 'present', readonly absolutePath: string } | { readonly status: 'missing' }> {
  const root = selfInstalledSkillRoot(deps.dshHome)
  const absolutePath = join(root, name)
  const resolvedRoot = await realpathOrMissing(root)
  if (resolvedRoot === undefined) return { status: 'missing' }
  let stats
  try {
    stats = await lstat(absolutePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing' }
    throw skillInstallError(error, 'ENT_SKILL_CONTENT_INVALID', 'the self-installed skill directory could not be inspected')
  }
  if (stats.isSymbolicLink()) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the self-installed skill directory is a symbolic link')
  }
  if (!stats.isDirectory()) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the self-installed skill path is not a directory')
  }
  const resolved = await realpathOrMissing(absolutePath)
  if (resolved === undefined) return { status: 'missing' }
  if (resolved !== join(resolvedRoot, name)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the self-installed skill directory escapes its skill root')
  }
  return { status: 'present', absolutePath }
}

/**
 * 技能包内唯一的技能正文文件名（与 `skill-install.ts` 的包布局判定、官方 `skill-filesystem` 的发现判据逐字同源）。
 * 本文件只把它当**固定文件名**用：落点是宿主自己拼的 `<技能根>/<name>/SKILL.md`，客户端交不来第二个键。
 */
const SKILL_FILE_NAME = 'SKILL.md'

/**
 * 把 `name` 解析成技能目录下那个**已落盘的普通 `SKILL.md`**（`edit` 专用的第三层；归属与目录两层**复用**上面那两处实现）。
 *
 * 判据顺序与理由：
 *  ① 目录那一层**原样复用** {@link resolveOwnedDirectory}（符号链接 / 非常规条目 / 越界 / 不在 ⇒ 那三枚既有结果）；
 *  ② `lstat` 不跟随符号链接 ⇒ `SKILL.md` 是符号链接即 fail-closed 拒（**不**"顺着链接打开那个文件"）；
 *  ③ 必须是**普通文件**（目录 / 设备 / FIFO / socket 一律拒）；
 *  ④ 技能目录与文件**各自** `realpath`，文件那条必须逐字等于 `<真实技能目录>/SKILL.md` ⇒ 指向目录之外的落点一律不成立
 *     （与目录那条等式同一个手法；两层都过之后，交出去的那条绝对路径只能落在技能根里那一枚名字下）。
 *
 * ★本函数**只读元数据**：不读 `SKILL.md` 的正文、更不写一个字节（打开它是被交出去的那个系统应用的事）。
 */
async function resolveOwnedSkillFile(
  deps: { readonly dshHome: string },
  name: string,
): Promise<{ readonly status: 'present', readonly absolutePath: string } | { readonly status: 'missing' }> {
  const directory = await resolveOwnedDirectory(deps, name)
  if (directory.status === 'missing') return { status: 'missing' }
  const absolutePath = join(directory.absolutePath, SKILL_FILE_NAME)
  let stats
  try {
    stats = await lstat(absolutePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing' }
    throw skillInstallError(error, 'ENT_SKILL_CONTENT_INVALID', 'the self-installed skill file could not be inspected')
  }
  if (stats.isSymbolicLink()) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the self-installed skill file is a symbolic link')
  }
  if (!stats.isFile()) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the self-installed skill file is not a regular file')
  }
  const resolvedDirectory = await realpathOrMissing(directory.absolutePath)
  const resolved = await realpathOrMissing(absolutePath)
  if (resolvedDirectory === undefined || resolved === undefined) return { status: 'missing' }
  if (resolved !== join(resolvedDirectory, SKILL_FILE_NAME)) {
    throw new EnterpriseSkillInstallError('ENT_SKILL_CONTENT_INVALID', 'the self-installed skill file escapes its skill directory')
  }
  return { status: 'present', absolutePath }
}

/**
 * 把暂存位里的目录挪回原位（回滚）。
 *
 * best-effort 但**绝不静默**：单个失败只留痕（那个目录仍在暂存位里，不会凭空消失），主错误由调用方抛出——
 * 回滚失败盖掉主错误只会让真因消失。
 */
async function restoreStaged(
  staged: readonly { readonly name: string, readonly from: string, readonly to: string }[],
  options: SelfInstalledDependencies,
): Promise<void> {
  for (const item of [...staged].reverse()) {
    await rename(item.to, item.from).catch((error: unknown) => {
      options.onError?.(`enterprise self-installed skill could not be restored ${item.name}`, error)
    })
  }
}

/**
 * 按**技能目录名**卸载（本刀①；入参口径见文件头 P0S 那条）。
 *
 * 顺序与失败语义（★要么「目录没了、记录也改了」，要么「都在」，**绝不留半删状态**）：
 *  ① 读自装清单（损坏即 fail-closed）→ 名字必须在**恰好一条**记录的 `names` 里；没有 ⇒ 404；
 *     两条以上认领 ⇒ 409（fail-closed）；被**中心**记录认领 ⇒ 404（不归这条路由管）；
 *  ② 目录不在 ⇒ 幂等：直接把记录里这个名字去掉（记录只剩这一个名字则整条移除）并回 200；
 *  ③ 名字不是普通目录（符号链接 / 普通文件 / 设备）⇒ 在手都没沾之前 fail-closed 拒，**零删除**；
 *  ④ 先把目录 `rename` 到**技能根之外**的单向暂存位（一步原子操作，且它一旦成功，这个名字就从官方
 *     发现面里正常消失）；
 *  ⑤ 再原子写自装清单：记录里还有别的名字（一包多技能）⇒ `upsert` 回**去掉这个名字**的那条记录
 *     （`skillId` 不变、其余保序）；已经是最后一个名字 ⇒ 去掉整条记录。两者都走 `skill-upload.ts` 的
 *     唯一写入口（同一份 0600 原子写）。
 *  ⑥ 写失败 ⇒ 把暂存位里的目录 `rename` 回原位并抛错（"都在"）；写成功 ⇒ 递归删掉暂存位里那一份，
 *     删不掉只留痕——记录已经落定，「装得上卸不掉」在**记录层**已经解决，暂存位里的残留既不构成半删状态、
 *     也不在技能根里（用户能立刻重装）。
 *
 * @param options - 平台面、可选 dshHome、时钟、留痕端口与可选文件管理器端口（本函数不用后者）。
 * @param name - 技能在本机的目录名（官方 kebab，≤64）。
 * @returns 卸载后的投影与**如实**的 `removed`（见 {@link SelfInstalledUninstallResult}）。
 * @throws {EnterpriseSkillInstallError} `ENT_INVALID_REQUEST`（名字形状非法）、
 *   `ENT_RESOURCE_NOT_FOUND`（没有自装记录认领这个名字 / 被中心记录认领）、
 *   `ENT_SKILL_NAME_CONFLICT`（**两条及以上**自装记录都认领它 ⇒ fail-closed 拒，零删除）、
 *   `ENT_SKILL_STATE_INVALID`（清单损坏或写失败）、`ENT_SKILL_CONTENT_INVALID`（符号链接 / 越界 /
 *   非常规条目 / 树超界）、`ENT_SKILL_INSTALL_FAILED`（I/O 失败）。
 */
export async function uninstallSelfInstalledSkill(
  options: SelfInstalledDependencies,
  name: string,
): Promise<SelfInstalledUninstallResult> {
  const skillName = requireSkillName(name)
  const records = await readSelfInstalledRecords(options)
  const owner = findSelfInstalledOwner(records, skillName)
  if (owner === undefined || await centerClaimsName(options, skillName)) {
    // 没装过 / 不在自装清单里，或这条是**中心**装的 ⇒ 都用既有码 404（理由见 `centerClaimsName`）。
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'this skill is not installed by the user')
  }
  const dshHome = resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome })
  const directory = await resolveOwnedDirectory({ dshHome }, skillName)
  const remainingNames = owner.names.filter(item => item !== skillName)
  const staged: { readonly name: string, readonly from: string, readonly to: string }[] = []
  const removed: string[] = []
  const alreadyMissing: string[] = []
  let trash: string | undefined
  try {
    if (directory.status === 'present') {
      trash = join(dshHome, ...SKILL_UNINSTALL_TRASH_DIR_SEGMENTS, randomUUID())
      await mkdir(trash, { recursive: true, mode: 0o700 })
      // 单向暂存：挪走之后这个名字在技能根里**不存在**（不做"`.bak` 再复原"那种双向 rename——
      // 那会在写失败时把"目录已换、记录未换"的半状态留在技能根里）。
      const to = join(trash, skillName)
      await rename(directory.absolutePath, to).catch((error: unknown) => {
        throw skillInstallError(error, 'ENT_SKILL_INSTALL_FAILED', 'the self-installed skill directory could not be staged')
      })
      staged.push({ name: skillName, from: directory.absolutePath, to })
    } else {
      // 幂等（要求里逐字点名的口径）：盘上目录本来就没了 ⇒ 仍然把记录收干净，并如实报成 removed。
      alreadyMissing.push(skillName)
    }
    removed.push(skillName)
    // 记录层收尾：**唯一**写入口（`skill-upload.ts` 的 `replaceSelfInstalledRecords`，同一份 0600 原子写）；
    // 本文件不写第二份实现。一包多技能 ⇒ 记录仍在、只去掉这一个名字（`skillId` 不变、其余名字保序）；
    // 已是最后一个名字 ⇒ 整条记录移除（空清单也是合法状态）。
    await replaceSelfInstalledRecords(options, remainingNames.length === 0
      ? records.filter(record => record.skillId !== owner.skillId)
      : records.map(record => (record.skillId === owner.skillId ? { ...record, names: remainingNames } : record)))
  } catch (error) {
    // 写之前/写之中任何一步抛错：把已经挪走的目录原样挪回（"都在"），再把错误抛出去。
    await restoreStaged(staged, options)
    throw error
  }
  // 记录已落定：暂存位里的目录递归删除（唯一删除入口）。删不掉只留痕，不把一次成功的卸载报成失败。
  for (const item of staged) {
    await deleteOwnedSkillDirectory(options, item.name).catch((error: unknown) => {
      options.onError?.(`enterprise self-installed skill left a staged directory ${item.name}`, error)
    })
  }
  const skills = await installedSelfSkills(options)
  return { skills: skills.skills, removed, alreadyMissing }
}

/**
 * 按**技能目录名**打开这条技能所在的文件夹（本刀②）。
 *
 * 路径**只能来自记录**：宿主先把 `name` 解析成**唯一**归属的自装记录（与卸载同一条判据：没有 ⇒ 404、
 * 两条以上认领 ⇒ 409 拒、被中心记录认领 ⇒ 404），再拼 `join(<技能根>, name)`、过 `lstat` 普通目录 +
 * `realpath` 落点等式，最后把**这个**路径交给系统文件管理器。客户端的端口形状只有 `name` 一个键 ⇒
 * "传一个路径进来"在类型上不可表达（`fileManager.open` 的实参只可能来自本函数自己拼出来的那一条）。
 *
 * 失败**绝不静默**（全部既有码，一枚码一句话）：没有记录认领 / 被中心认领 / 目录不在 ⇒ 404
 * `ENT_RESOURCE_NOT_FOUND`；符号链接 / 越界 / 非常规条目 ⇒ 409 `ENT_SKILL_CONTENT_INVALID`；
 * 系统交接失败或平台不支持 ⇒ 503 `ENT_PLATFORM_UNAVAILABLE`（与 `help-route.ts` 打开系统浏览器
 * 那条路同一个码：都是"宿主这台机器上的桌面能力这次没交出去"）。
 *
 * @param options - 平台面、可选 dshHome、时钟、留痕端口与可选文件管理器端口。
 * @param name - 技能在本机的目录名（官方 kebab，≤64）。
 * @param signal - 客户端断开时中止系统交接（缺省不取消）。
 * @returns `{ revealed: true }`（**不含**任何宿主路径）。
 * @throws {EnterpriseSkillInstallError} 见上。
 */
export async function revealSelfInstalledSkill(
  options: SelfInstalledDependencies,
  name: string,
  signal?: AbortSignal,
): Promise<SelfInstalledRevealResult> {
  const skillName = requireSkillName(name)
  const records = await readSelfInstalledRecords(options)
  const owner = findSelfInstalledOwner(records, skillName)
  if (owner === undefined || await centerClaimsName(options, skillName)) {
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'this skill is not installed by the user')
  }
  const dshHome = resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome })
  const directory = await resolveOwnedDirectory({ dshHome }, skillName)
  if (directory.status === 'missing') {
    // 记录在、盘上没有这个普通目录（被删过）⇒ 明确失败，绝不静默说"打开了"。
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'the self-installed skill directory is missing')
  }
  const fileManager = options.fileManager ?? { open: openSystemDirectory }
  // 交接失败是**同一种结果**（"这台机器上的桌面能力这次没交出去"），无论端口是默认实现还是注入实现，
  // 都收敛成同一枚既有码 503 —— 绝不把裸 I/O 错误漏出这条面。
  await fileManager.open(directory.absolutePath, signal ?? new AbortController().signal).catch((error: unknown) => {
    throw skillInstallError(error, 'ENT_PLATFORM_UNAVAILABLE', 'the system file manager could not be opened')
  })
  return { revealed: true }
}

/**
 * 按**技能目录名**用系统默认应用打开这枚技能的 `SKILL.md`（本刀③「编辑」的宿主内核）。
 *
 * 与 {@link revealSelfInstalledSkill} **同族同口径**，判据一处都不新写：
 *  ① 归属：`readSelfInstalledRecords` + `findSelfInstalledOwner` + `centerClaimsName` —— 没有记录认领 / 被中心
 *     记录认领 ⇒ 404（与 `reveal`、与 `uninstall` 那两条**逐字同源**的判定；两条以上自装记录认领 ⇒ 那两处共用的
 *     `ENT_SKILL_NAME_CONFLICT` 409 fail-closed 也一并继承）；
 *  ② 目录落点：`resolveOwnedDirectory`（名字侧 kebab 门禁 + `lstat` 普通目录 + `realpath` 逐字等于 `<真实技能根>/<name>`）
 *     —— 符号链接 / 越界 / 非常规条目 ⇒ 409 `ENT_SKILL_CONTENT_INVALID`；
 *  ③ 文件落点：本刀**唯一**新增的那一层 `resolveOwnedSkillFile` —— 宿主自己拼 `<技能根>/<name>/SKILL.md`，
 *     `lstat` 必须是普通文件（符号链接即拒）、文件与目录**各自** `realpath` 逐字相等（越界即拒）。
 *
 * 路径**只能来自记录**：客户端的端口形状只有 `name` 一个键（`fileLauncher.openDocument` 的实参只可能来自本函数
 * 自己拼出来的那一条），"传一个路径进来"在类型上不可表达。★**本函数不写一个字节、也不读 `SKILL.md` 的正文**
 * （打开它是被交出去的那个系统应用的事）——宿主只交出一条已验证的宿主私有绝对路径。
 *
 * 失败**绝不静默**（全部既有码，一枚码一句话）：没有记录认领 / 被中心认领 / 目录或文件不在 ⇒ 404
 * `ENT_RESOURCE_NOT_FOUND`；符号链接 / 越界 / 非常规条目 ⇒ 409 `ENT_SKILL_CONTENT_INVALID`；
 * 系统交接失败或平台不支持 ⇒ 503 `ENT_PLATFORM_UNAVAILABLE`（与 `reveal` 同一个码：都是"宿主这台机器上的
 * 桌面能力这次没交出去"）。
 *
 * @param options - 平台面、可选 dshHome、时钟、留痕端口与可选文件管理器/默认应用端口。
 * @param name - 技能在本机的目录名（官方 kebab，≤64）。
 * @param signal - 客户端断开时中止系统交接（缺省不取消）。
 * @returns `{ edited: true }`（**不含**任何宿主路径）。
 * @throws {EnterpriseSkillInstallError} 见上。
 */
export async function editSelfInstalledSkill(
  options: SelfInstalledDependencies,
  name: string,
  signal?: AbortSignal,
): Promise<SelfInstalledEditResult> {
  const skillName = requireSkillName(name)
  const records = await readSelfInstalledRecords(options)
  const owner = findSelfInstalledOwner(records, skillName)
  if (owner === undefined || await centerClaimsName(options, skillName)) {
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'this skill is not installed by the user')
  }
  const dshHome = resolveEnterpriseDshHome(options.dshHome === undefined ? {} : { dshHome: options.dshHome })
  const file = await resolveOwnedSkillFile({ dshHome }, skillName)
  if (file.status === 'missing') {
    // 记录在、盘上没有这枚普通文件（目录被删、或 SKILL.md 被删）⇒ 明确失败，绝不静默说"打开了"。
    throw new EnterpriseSkillInstallError('ENT_RESOURCE_NOT_FOUND', 'the self-installed skill file is missing')
  }
  const launcher = options.fileLauncher ?? { openDocument: openSystemDocument }
  // 交接失败是**同一种结果**（"这台机器上的桌面能力这次没交出去"），无论端口是默认实现还是注入实现，
  // 都收敛成同一枚既有码 503 —— 绝不把裸 I/O 错误漏出这条面。
  await launcher.openDocument(file.absolutePath, signal ?? new AbortController().signal).catch((error: unknown) => {
    throw skillInstallError(error, 'ENT_PLATFORM_UNAVAILABLE', 'the self-installed skill file could not be opened')
  })
  return { edited: true }
}
