/**
 * [INPUT]: 依赖 `src/skill-archive.ts` 的解包边界、`src/skill-errors.ts` 的稳定码，以及 `tests/zip-fixture.ts` 手写的 ZIP 构造器
 * [OUTPUT]: 锁定 `.dshskill`（根 `manifest.json` + `skills/<kebab>/SKILL.md`）的解出结果与全部拒绝分支——路径逃逸/绝对路径/盘符/反斜杠/空段/控制字符/重复路径/符号链接/ZIP64/加密/非法压缩方法/CRC 不符/大小不符/skills 子树外的旁路目录/非 kebab 技能名/缺 SKILL.md/坏 manifest/非 ZIP
 * [POS]: bundle 技能落盘的**解压前防线**回归门禁；有人把逃逸校验挪到解压之后、放宽到只查 `startsWith`、或让符号链接条目通过，本文件都会红
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  decodeDshSkillArchive,
  SKILL_ARCHIVE_MAX_ENTRIES,
  SKILL_ARCHIVE_MAX_SKILLS,
  SKILL_MD_MAX_BYTES,
} from '../src/skill-archive.js'
import { buildZip, type ZipFixtureEntry } from './zip-fixture.js'

const MANIFEST = { format: 'dsh-skill', version: '1', id: 'meeting-notes', name: '会议纪要技能组', sourceDshVersion: '0.2.0-rc.2' }

/** 一个合规包：两个技能，其中一个带 `references/` 资源。 */
function goodEntries(): ZipFixtureEntry[] {
  return [
    { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
    { path: 'skills/meeting-notes/SKILL.md', content: '---\nname: meeting-notes\ndescription: 整理会议纪要\n---\n正文\n' },
    { path: 'skills/meeting-notes/references/checklist.md', content: '检查单' },
    { path: 'skills/meeting-actions/SKILL.md', content: '---\nname: meeting-actions\ndescription: 行动项\n---\n正文\n' },
  ]
}

describe('dshskill archive decoding', () => {
  it('decodes a well-formed package into skill directories with their resources', () => {
    const archive = decodeDshSkillArchive(buildZip(goodEntries()))
    expect(archive.skillId).toBe('meeting-notes')
    expect(archive.skills.map(entry => entry.name)).toEqual(['meeting-actions', 'meeting-notes'])
    const notes = archive.skills.find(entry => entry.name === 'meeting-notes')
    expect(notes?.files.map(file => file.path).sort()).toEqual(['SKILL.md', 'references/checklist.md'])
    expect(notes?.files.find(file => file.path === 'references/checklist.md')?.bytes.toString('utf8')).toBe('检查单')
  })

  it('accepts stored entries, directory entries and a UTF-8 flag', () => {
    const archive = decodeDshSkillArchive(buildZip([
      { path: 'manifest.json', content: JSON.stringify(MANIFEST), method: 0, flags: 0x800 },
      { path: 'skills/a/', content: '', method: 0 },
      { path: 'skills/a/SKILL.md', content: 'x', method: 0 },
    ]))
    expect(archive.skills.map(entry => entry.name)).toEqual(['a'])
  })

  it.each<[string, ZipFixtureEntry[]]>([
    ['parent traversal', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/../../etc/SKILL.md', content: 'x' },
    ]],
    // 逃逸藏在资源段：包契约（有 manifest、有 `skills/a/SKILL.md`、技能名是 kebab）本身完全合法，
    // 因此这里唯一能拦住它的就是解压前的分段校验——负对照（移除 `..` 判定）会让这三条一起红。
    ['traversal below a valid skill name', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: 'x' },
      { path: 'skills/a/../../etc/SKILL.md', content: 'escaped' },
    ]],
    ['traversal in a resource segment', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: 'x' },
      { path: 'skills/a/references/../../SKILL.md', content: 'escaped' },
    ]],
    ['single dot segment', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: 'x' },
      { path: 'skills/a/./SKILL.md', content: 'escaped' },
    ]],
    ['absolute path', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: '/etc/passwd/SKILL.md', content: 'x' },
    ]],
    ['drive letter', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'C:/windows/SKILL.md', content: 'x' },
    ]],
    ['backslash separator', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/..\\..\\etc/SKILL.md', content: 'x' },
    ]],
    ['empty segment', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills//SKILL.md', content: 'x' },
    ]],
    ['NUL byte', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a\u0000/SKILL.md', content: 'x' },
    ]],
    ['control character', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a\u0007/SKILL.md', content: 'x' },
    ]],
    ['duplicate path', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: 'x' },
      { path: 'skills/a/SKILL.md', content: 'y' },
    ]],
    ['case-folded path collision', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: 'x' },
      { path: 'skills/a/notes.md', content: 'y' },
      { path: 'skills/a/NOTES.md', content: 'z' },
    ]],
    ['unicode-folded path collision', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      // 两份**码点不同**的写法：U+00E9 预组合 与 e + U+0301 分解形式，macOS APFS 视为同一文件。
      // 字面量写成 `caf` + `\u00e9` 与 `cafe` + `\u0301`，避免源文件本身被工具规范化成同一个码点序列。
      { path: 'skills/a/caf\u00e9.md', content: 'x' },
      { path: 'skills/a/cafe\u0301.md', content: 'y' },
    ]],
    ['symlink entry', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: '/etc/passwd', unixMode: 0o120777 },
    ]],
    ['encrypted entry', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: 'x', flags: 0x0001 },
    ]],
    ['unsupported compression method', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: 'x', method: 12 },
    ]],
    ['CRC mismatch', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: 'x', crc: 0 },
    ]],
    ['declared size mismatch', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: '0123456789', uncompressedSize: 3 },
    ]],
    ['truncated entry data', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: '0123456789', compressedSize: 4096 },
    ]],
    ['path outside skills/', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'README.md', content: 'x' },
    ]],
    ['nested skill tree', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/nested/b/SKILL.md', content: 'x' },
    ]],
    ['non-kebab skill name', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/Code Review/SKILL.md', content: 'x' },
    ]],
    ['missing SKILL.md', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/notes.md', content: 'x' },
    ]],
    ['missing manifest.json', [
      { path: 'skills/a/SKILL.md', content: 'x' },
    ]],
    ['manifest is not JSON', [
      { path: 'manifest.json', content: 'not json' },
      { path: 'skills/a/SKILL.md', content: 'x' },
    ]],
    ['manifest is not dsh-skill v1', [
      { path: 'manifest.json', content: JSON.stringify({ ...MANIFEST, version: '2' }) },
      { path: 'skills/a/SKILL.md', content: 'x' },
    ]],
    ['manifest id is invalid', [
      { path: 'manifest.json', content: JSON.stringify({ ...MANIFEST, id: '../escape' }) },
      { path: 'skills/a/SKILL.md', content: 'x' },
    ]],
    ['oversized SKILL.md', [
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: Buffer.alloc(SKILL_MD_MAX_BYTES + 1, 0x61) },
    ]],
  ])('rejects %s', (_name, entries) => {
    expect(() => decodeDshSkillArchive(buildZip(entries)))
      .toThrowError(expect.objectContaining({ code: 'ENT_SKILL_ARCHIVE_INVALID' }))
  })

  // 阳性对照之二：折叠检查**不得**把正常包拒掉。同一技能目录内只有 `notes.md`（没有 NOTES.md）时照常解出。
  it('still accepts an archive whose resource names merely differ in case across separate files', () => {
    const archive = decodeDshSkillArchive(buildZip([
      { path: 'manifest.json', content: JSON.stringify(MANIFEST) },
      { path: 'skills/a/SKILL.md', content: '---\nname: a\ndescription: 甲\n---\n正文\n' },
      { path: 'skills/a/notes.md', content: '资源' },
      { path: 'skills/a/refs/Deep.md', content: '子目录资源' },
    ]))
    expect(archive.skills.map(entry => entry.name)).toEqual(['a'])
    const files = archive.skills[0]?.files.map(file => file.path).sort()
    expect(files).toEqual(['SKILL.md', 'notes.md', 'refs/Deep.md'])
    expect(archive.skills[0]?.files.find(file => file.path === 'notes.md')?.bytes.toString('utf8')).toBe('资源')
  })

  it('rejects ZIP64 locators, multi-disk archives and non-ZIP bytes', () => {
    expect(() => decodeDshSkillArchive(buildZip(goodEntries(), { zip64Locator: true })))
      .toThrowError(expect.objectContaining({ code: 'ENT_SKILL_ARCHIVE_INVALID' }))
    expect(() => decodeDshSkillArchive(buildZip(goodEntries(), { diskNumber: 1 })))
      .toThrowError(expect.objectContaining({ code: 'ENT_SKILL_ARCHIVE_INVALID' }))
    expect(() => decodeDshSkillArchive(Buffer.from('not a zip at all')))
      .toThrowError(expect.objectContaining({ code: 'ENT_SKILL_ARCHIVE_INVALID' }))
    // 截掉尾部：EOCD 不完整，扫描不到签名。
    const zip = buildZip(goodEntries())
    expect(() => decodeDshSkillArchive(zip.subarray(0, zip.byteLength - 4)))
      .toThrowError(expect.objectContaining({ code: 'ENT_SKILL_ARCHIVE_INVALID' }))
    // 空包与超上限包。
    expect(() => decodeDshSkillArchive(buildZip([])))
      .toThrowError(expect.objectContaining({ code: 'ENT_SKILL_ARCHIVE_INVALID' }))
    expect(() => decodeDshSkillArchive(Buffer.alloc(0)))
      .toThrowError(expect.objectContaining({ code: 'ENT_SKILL_ARCHIVE_INVALID' }))
  })

  it('documents the entry and skill caps it enforces', () => {
    expect(SKILL_ARCHIVE_MAX_ENTRIES).toBe(10_000)
    expect(SKILL_ARCHIVE_MAX_SKILLS).toBe(200)
    expect(SKILL_MD_MAX_BYTES).toBe(262_144)
  })
})
