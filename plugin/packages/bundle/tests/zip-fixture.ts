/**
 * [INPUT]: 只依赖 Node `zlib.deflateRawSync` 与 `Buffer`；CRC-32 在这里**独立重写一份**（不复用 `src/skill-archive.ts` 的私有实现）
 * [OUTPUT]: 导出 `buildZip(entries, options)` 与 `crc32`——按中央目录语义手写最小 ZIP 编码器，允许逐条覆盖方法/位标记/大小/CRC/Unix 模式与整体覆盖盘号/ZIP64 locator
 * [POS]: bundle 技能解包回归测试的**制品构造器**（非 spec，不被 vitest 收集）：能造出合规包，也能造出路径逃逸、符号链接、CRC 不符、ZIP64 等畸形包，从而让 `skill-archive.spec.ts` 断言的是解析器行为而不是解析器自己的常量
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { deflateRawSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

/** 独立实现的 CRC-32（IEEE 802.3），用来给测试包写正确的校验值。 */
export function crc32(bytes: Buffer): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0)
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipFixtureEntry {
  /** 条目路径；以 `/` 结尾即目录条目。 */
  readonly path: string
  readonly content?: Buffer | string
  /** 中央目录与本地头声明的压缩方法；默认 8（deflate），0 为存储。 */
  readonly method?: number
  /** 通用位标记；bit0 = 加密、bit11 = UTF-8 名。 */
  readonly flags?: number
  /** 声明的 CRC-32；默认真值，写错即构造出「CRC 不符」。 */
  readonly crc?: number
  readonly uncompressedSize?: number
  readonly compressedSize?: number
  /** `externalAttributes >>> 16`；默认常规文件 0o100644（目录 0o040755）。 */
  readonly unixMode?: number
  /** 制作系统字节；默认 3（Unix）——只有它才会让 Unix 模式参与符号链接判定。 */
  readonly hostSystem?: number
}

export interface ZipFixtureOptions {
  /** EOCD 里的磁盘号；非 0 用来构造多盘包。 */
  readonly diskNumber?: number
  /** 在 EOCD 之前插入 ZIP64 EOCD locator，用来验证显式拒绝。 */
  readonly zip64Locator?: boolean
}

/**
 * 手写一个最小 ZIP；字段全部按中央目录语义写入，因此覆盖任一声明字段都能得到对应的畸形包。
 *
 * @param entries - 条目清单（顺序即本地头顺序）。
 * @param options - 盘号与 ZIP64 locator 开关。
 * @returns 完整 ZIP 字节。
 */
export function buildZip(entries: readonly ZipFixtureEntry[], options: ZipFixtureOptions = {}): Buffer {
  const parts: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const content = typeof entry.content === 'string' ? Buffer.from(entry.content, 'utf8') : entry.content ?? Buffer.alloc(0)
    const name = Buffer.from(entry.path, 'utf8')
    const isDirectory = entry.path.endsWith('/')
    const method = entry.method ?? 8
    const flags = entry.flags ?? 0
    const hostSystem = entry.hostSystem ?? 3
    const unixMode = entry.unixMode ?? (isDirectory ? 0o040755 : 0o100644)
    const payload = method === 0 ? content : deflateRawSync(content)
    const crc = entry.crc ?? crc32(content)
    const uncompressedSize = entry.uncompressedSize ?? content.byteLength
    const compressedSize = entry.compressedSize ?? payload.byteLength

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressedSize, 18)
    local.writeUInt32LE(uncompressedSize, 22)
    local.writeUInt16LE(name.byteLength, 26)
    const localOffset = offset
    parts.push(local, name, payload)
    offset += local.byteLength + name.byteLength + payload.byteLength

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(((hostSystem & 0xff) << 8) | 20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(flags, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressedSize, 20)
    central.writeUInt32LE(uncompressedSize, 24)
    central.writeUInt16LE(name.byteLength, 28)
    // 扩展属性高 16 位是 Unix 模式；`>>> 0` 把 32 位有符号位移结果还原成 writeUInt32LE 要的无符号值。
    central.writeUInt32LE((((unixMode & 0xffff) << 16) >>> 0), 38)
    central.writeUInt32LE(localOffset, 42)
    centrals.push(central, name)
  }
  const centralBytes = Buffer.concat(centrals)
  const centralOffset = offset
  parts.push(centralBytes)

  if (options.zip64Locator === true) {
    const locator = Buffer.alloc(20)
    locator.writeUInt32LE(0x07064b50, 0)
    parts.push(locator)
  }

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(options.diskNumber ?? 0, 4)
  eocd.writeUInt16LE(options.diskNumber ?? 0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBytes.byteLength, 12)
  eocd.writeUInt32LE(centralOffset, 16)
  parts.push(eocd)
  return Buffer.concat(parts)
}
