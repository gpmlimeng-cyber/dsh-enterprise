/**
 * [INPUT]: 接收显示名用于生成 slug。
 * [OUTPUT]: 对外提供与服务端 CloudWorkspaceService.slugify 兼容的 slug 规范化。
 * [POS]: cloud-workspace 的纯函数，clone 子目录名与服务端 slug 同构。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export function slugify(name: string): string {
  let base = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-+|-+$)/g, '')
  if (base.length === 0) base = 'project'
  if (base.length > 64) base = base.slice(0, 64)
  base = base.replaceAll(/-+$/g, '')
  if (base.length === 0) base = 'project'
  return base
}

export function isValidProjectId(value: string): boolean {
  return /^[1-9][0-9]{0,18}$/.test(value)
}

/** 服务端 slug 语法；用于把服务端返回的 slug 拼进本地路径前的防御性校验。 */
export function isValidProjectSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)
}

export function isValidRootDir(value: string): boolean {
  if (!value.startsWith('/')) return false
  if (value.includes('\0')) return false
  return value.length <= 4096
}
