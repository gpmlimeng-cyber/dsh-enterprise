/**
 * [INPUT]: 依赖 node:os/path 解析 CLI 配置目录
 * [OUTPUT]: 对外提供 entAdminHome 与 config/installation/credentials 路径
 * [POS]: ent-admin-cli 的唯一文件系统定位边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

export function entAdminHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env['DSH_ENT_ADMIN_HOME']
  if (override !== undefined && override.trim() !== '') return override
  return join(homedir(), '.dsh-ent-admin')
}

export function configPath(env?: NodeJS.ProcessEnv): string {
  return join(entAdminHome(env), 'config.json')
}

export function installationPath(env?: NodeJS.ProcessEnv): string {
  return join(entAdminHome(env), 'installation.json')
}

export function credentialsPath(env?: NodeJS.ProcessEnv): string {
  return join(entAdminHome(env), 'credentials.json')
}
