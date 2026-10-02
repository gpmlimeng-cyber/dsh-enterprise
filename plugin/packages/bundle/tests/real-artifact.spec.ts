/**
 * [INPUT]: 依赖 tests/real-artifact.bin —— 从生产中心导出的真实 `.dshskill` 制品（1642 字节，code-review）。
 * [OUTPUT]: 锁住「真实制品必须能解」：zip -r 写出的父目录条目 skills/ 不得被当成非法技能名。
 * [POS]: bundle 归档层的真品回归锁；合成 fixture 覆盖不到真实打包器写出的目录条目，本文件补上这一格。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { decodeDshSkillArchive } from '../src/skill-archive.js'

describe('真实中心制品', () => {
  const bytes = readFileSync(new URL('./real-artifact.bin', import.meta.url))

  it('解出真实制品而不把 zip 的父目录条目 skills/ 误判为非法技能名', () => {
    const archive = decodeDshSkillArchive(bytes)
    expect(archive.skillId).toBe('code-review')
    expect(archive.skills.map(skill => skill.name)).toEqual(['code-review'])
    expect(archive.skills[0]?.files).toHaveLength(1)
  })
})
