/**
 * [INPUT]: 无（纯值类型）；字段与 V43 的 ent_library_draft 逐列对应。
 * [OUTPUT]: 一份**可变**待审草稿：`revisionToken` 是乐观锁 token，`content` 是当前正文（上限 8 MiB，由 check 兜底）。
 * [POS]: library/domain 的值类型；与 bundle 侧 `LibraryDraftRecord` 是同一实体的两端——★差异只有一处：bundle 侧正文在**草稿对象层**（`contentRelativePath`），服务端正文在**这一行**（`content`），因为服务端的元数据行不是"每主体一条大 JSON"，8 MiB 的 text 列不构成写放大。
 * [PROTOCOL]: 变更时同步 V43 的列与 bundle 侧 domain.ts，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.domain;

import java.time.Instant;

/**
 * 一份待审草稿。
 *
 * @param id 草稿 ID
 * @param tenantId 租户
 * @param ownerId 主体
 * @param scope 主体范围
 * @param assetId 要改的那份资料
 * @param baseRevisionId 分叉出来的基准修订（发布时必须是资产的当前修订，否则 `library/base-revision-conflict`）
 * @param revisionToken 乐观锁 token（每次更新换新的）
 * @param content 草稿正文
 * @param contentByteLength 正文字节数（必须等于 `octet_length(content)`）
 * @param createdBy 创建者（草稿可能由模型工具代笔，故与 ownerId 分开记）
 * @param createdAt 创建时刻
 * @param updatedAt 最后改动时刻
 */
public record LibraryDraft(
    long id,
    String tenantId,
    String ownerId,
    LibraryScope scope,
    long assetId,
    long baseRevisionId,
    String revisionToken,
    String content,
    long contentByteLength,
    long createdBy,
    Instant createdAt,
    Instant updatedAt
) {
}
