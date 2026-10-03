/**
 * [INPUT]: 无（纯值类型）；字段与 V43 的 ent_library_reference 逐列对应。
 * [OUTPUT]: "某个会话选了哪个树节点"的一条引用（同一会话同一节点至多一条，由唯一索引保证）。
 * [POS]: library/domain 的值类型；对应 bundle 侧 `selections` 表（那边整条选择记录存一组 nodeIds，这边按节点一行，便于并发追加与排序）。
 * [PROTOCOL]: 变更时同步 V43 的列，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.domain;

import java.time.Instant;

/**
 * 一条会话引用。
 *
 * @param id 引用 ID
 * @param tenantId 租户
 * @param ownerId 主体
 * @param scope 主体范围
 * @param sessionId 会话 ID（界面的 `session-<uuid>` 与 Agent 的裸 UUID 都能落这里）
 * @param nodeId 被选中的树节点
 * @param sortOrder 会话内的稳定顺序
 * @param createdAt 创建时刻
 */
public record LibraryReference(
    long id,
    String tenantId,
    String ownerId,
    LibraryScope scope,
    String sessionId,
    long nodeId,
    int sortOrder,
    Instant createdAt
) {
}
