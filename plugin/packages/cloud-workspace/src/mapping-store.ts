/**
 * [INPUT]: 依赖原子 JSON 写与 enterprise/cloud-workspace-mappings.json。
 * [OUTPUT]: 对外提供 projectId→本地映射的 load/save/clear 与路径解析。
 * [POS]: cloud-workspace 的本地持久化边界；映射元数据不含 Access Token。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CloudProjectMapping } from './types.js'

export interface MappingFile {
  readonly version: 1
  readonly mappings: readonly CloudProjectMapping[]
}

const EMPTY: MappingFile = { version: 1, mappings: [] }

export function defaultMappingPath(dshHome: string): string {
  return join(dshHome, 'enterprise', 'cloud-workspace-mappings.json')
}

export class MappingStore {
  constructor(private readonly path: string) {}

  load(): MappingFile {
    try {
      const raw = readFileSync(this.path, 'utf8')
      const parsed = JSON.parse(raw) as MappingFile
      if (parsed?.version !== 1 || !Array.isArray(parsed.mappings)) return EMPTY
      return {
        version: 1,
        mappings: parsed.mappings.filter((value): value is CloudProjectMapping =>
          typeof value === 'object'
          && value !== null
          && typeof (value as CloudProjectMapping).projectId === 'string'
          && typeof (value as CloudProjectMapping).path === 'string',
        ),
      }
    } catch {
      return EMPTY
    }
  }

  get(projectId: string): CloudProjectMapping | null {
    return this.load().mappings.find(value => value.projectId === projectId) ?? null
  }

  getByPath(path: string): CloudProjectMapping | null {
    return this.load().mappings.find(value => value.path === path) ?? null
  }

  list(): readonly CloudProjectMapping[] {
    return this.load().mappings
  }

  put(mapping: CloudProjectMapping): void {
    const current = this.load().mappings.filter(value => value.projectId !== mapping.projectId)
    this.save({ version: 1, mappings: [...current, mapping] })
  }

  remove(projectId: string): void {
    const current = this.load().mappings.filter(value => value.projectId !== projectId)
    this.save({ version: 1, mappings: current })
  }

  private save(file: MappingFile): void {
    mkdirSync(dirname(this.path), { recursive: true })
    const temporary = `${this.path}.tmp`
    writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporary, this.path)
  }
}
