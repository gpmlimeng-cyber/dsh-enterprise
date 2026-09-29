/**
 * [INPUT]: 依赖 node:os/node:path/node:fs 与环境变量 DSH_HOME / DSH_CONFIG_DIR
 * [OUTPUT]: 对外提供 resolveEnterpriseDshHome 与 resolveEnterpriseStateDir
 * [POS]: config 层的路径真源；与宿主 $DSH_HOME 语义保持一致，使企业状态跟随同一数据根
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * 解析 DSH 数据根目录。优先级与宿主一致：
 * 1. 显式 `DSH_HOME` / `DSH_CONFIG_DIR`；
 * 2. 当前工作目录下的 `./data`（便携模式）；
 * 3. `~/.dsh` 兜底。
 */
export function resolveEnterpriseDshHome(): string {
  const envHome = process.env.DSH_HOME?.trim() ?? process.env.DSH_CONFIG_DIR?.trim()
  if (envHome !== undefined && envHome.length > 0) {
    return path.resolve(envHome)
  }
  const portable = path.resolve(process.cwd(), 'data')
  if (fs.existsSync(portable)) {
    return portable
  }
  return path.resolve(os.homedir(), '.dsh')
}

/** 企业状态目录：`<dshHome>/enterprise`。仅拼接路径，不创建。 */
export function resolveEnterpriseStateDir(dshHome: string = resolveEnterpriseDshHome()): string {
  return path.join(dshHome, 'enterprise')
}
