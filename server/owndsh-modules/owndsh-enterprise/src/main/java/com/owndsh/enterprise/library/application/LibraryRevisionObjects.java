/**
 * [INPUT]: 无（纯值类型）。
 * [OUTPUT]: 对象层写完一条修订后回给应用层的事实（两个引用 + 两个 sha256 + 字节数），应用层据此落 `ent_library_revision` 行。
 * [POS]: library/application 与"对象存储"之间的值类型；与 bundle 侧 `LibraryRevisionObjects` 是同一件事的两端。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.application;

/**
 * 一次修订落盘后的事实。
 *
 * @param originalObjectRef 原件引用
 * @param originalSha256 原件 sha256（小写十六进制）
 * @param originalByteLength 原件字节数
 * @param contentObjectRef 派生正文引用
 * @param contentSha256 派生正文 sha256
 * @param contentByteLength 派生正文字节数
 */
public record LibraryRevisionObjects(
    String originalObjectRef,
    String originalSha256,
    long originalByteLength,
    String contentObjectRef,
    String contentSha256,
    long contentByteLength
) {
}
