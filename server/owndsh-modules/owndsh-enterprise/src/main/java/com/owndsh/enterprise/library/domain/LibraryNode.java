/**
 * [INPUT]: 无（纯值类型）；字段与 V43 的 ent_library_node 逐列对应。
 * [OUTPUT]: 目录树节点（文件夹与"文件节点"共用一棵树）；`parentId == null` 表示挂在隐式根下。
 * [POS]: library/domain 的值类型；与 bundle 侧 `LibraryNodeRecord` 是同一实体的两端（字段名逐字对应）。
 * [PROTOCOL]: 变更时同步 V43 的列与 bundle 侧 domain.ts，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.domain;

import java.time.Instant;

/**
 * 一个树节点。
 *
 * @param id 节点 ID
 * @param tenantId 租户
 * @param ownerId 主体（企业用户）
 * @param scope 主体范围
 * @param parentId 父节点；null = 隐式根
 * @param kind 文件夹 / 文件节点
 * @param title 展示名（同父下大小写不敏感唯一）
 * @param depth 物化深度（隐式根 = 0）
 * @param assetId 文件节点指向的资产；文件夹恒为 null
 * @param createdAt 创建时刻
 * @param updatedAt 最后改动时刻
 */
public record LibraryNode(
    long id,
    String tenantId,
    String ownerId,
    LibraryScope scope,
    Long parentId,
    Kind kind,
    String title,
    int depth,
    Long assetId,
    Instant createdAt,
    Instant updatedAt
) {
    /** 节点种类（与检查约束 `ck_ent_library_node_kind` 同集合）。 */
    public enum Kind {
        /** 文件夹。 */
        FOLDER,
        /** 文件节点（必带 assetId）。 */
        ASSET
    }
}
