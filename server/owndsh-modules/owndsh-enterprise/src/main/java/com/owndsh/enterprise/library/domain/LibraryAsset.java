/**
 * [INPUT]: 无（纯值类型）；字段与 V43 的 ent_library_asset 逐列对应。
 * [OUTPUT]: 一份资料的内容身份（树位置在 `LibraryNode`）；`currentRevisionId == null` 表示尚无修订。
 * [POS]: library/domain 的值类型；与 bundle 侧 `LibraryAssetRecord` 是同一实体的两端。
 * [PROTOCOL]: 变更时同步 V43 的列与 bundle 侧 domain.ts，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.domain;

import java.time.Instant;

/**
 * 一份资料的元数据。
 *
 * @param id 资产 ID
 * @param tenantId 租户
 * @param ownerId 主体
 * @param scope 主体范围
 * @param nodeId 树上的节点（一对一）
 * @param name 展示名（与节点 title 同步写入）
 * @param kind 格式
 * @param mediaType 媒体类型
 * @param byteLength 当前修订的原件字节数
 * @param currentRevisionId 当前修订；null = 还没有修订
 * @param status 启用 / 停用（停用即隔离）
 * @param source 来源
 * @param createdAt 创建时刻
 * @param updatedAt 最后改动时刻
 */
public record LibraryAsset(
    long id,
    String tenantId,
    String ownerId,
    LibraryScope scope,
    long nodeId,
    String name,
    Kind kind,
    String mediaType,
    long byteLength,
    Long currentRevisionId,
    Status status,
    Source source,
    Instant createdAt,
    Instant updatedAt
) {
    /** 格式（与 `ck_ent_library_asset_kind` 同集合；与 bundle 侧 `LIBRARY_ASSET_KINDS` 逐字对应）。 */
    public enum Kind {
        /** Markdown。 */
        MARKDOWN,
        /** 纯文本。 */
        TEXT,
        /** PDF。 */
        PDF,
        /** Word 文档。 */
        DOCX,
        /** 幻灯片。 */
        PPTX,
        /** 网页。 */
        HTML
    }

    /** 启用状态（停用的资产不可读、不可被选中、不可建草稿）。 */
    public enum Status {
        /** 正常。 */
        ACTIVE,
        /** 已停用（隔离）。 */
        DISABLED
    }

    /** 来源。 */
    public enum Source {
        /** 员工上传。 */
        UPLOAD,
        /** 会话交付物。 */
        TASK,
        /** 工具直接创建。 */
        CREATED
    }
}
