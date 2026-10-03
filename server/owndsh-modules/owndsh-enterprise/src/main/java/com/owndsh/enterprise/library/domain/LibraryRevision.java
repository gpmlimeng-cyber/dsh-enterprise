/**
 * [INPUT]: 无（纯值类型）；字段与 V43 的 ent_library_revision 逐列对应。
 * [OUTPUT]: 一条**不可变**修订的元数据（正文本体在对象存储里，这里只有引用与摘要）；**没有 updatedAt 字段**——不可覆盖是这条记录的类型级性质。
 * [POS]: library/domain 的值类型；与 bundle 侧 `LibraryRevisionRecord` 是同一实体的两端。
 * [PROTOCOL]: 变更时同步 V43 的列与 bundle 侧 domain.ts，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.domain;

import java.time.Instant;
import java.util.List;

/**
 * 一条不可变修订。
 *
 * @param id 修订 ID
 * @param tenantId 租户
 * @param ownerId 主体
 * @param scope 主体范围
 * @param assetId 所属资产
 * @param number 版本号（从 1 起，发布时 = 上一版 + 1）
 * @param originalSha256 原件 sha256
 * @param originalByteLength 原件字节数
 * @param originalObjectRef 原件在对象存储里的引用
 * @param contentSha256 派生正文 sha256
 * @param contentByteLength 派生正文字节数
 * @param contentObjectRef 派生正文在对象存储里的引用
 * @param conversionStatus 转换状态
 * @param conversionWarnings 转换告警
 * @param createdAt 创建时刻（**没有 updatedAt**：修订不可覆盖）
 */
public record LibraryRevision(
    long id,
    String tenantId,
    String ownerId,
    LibraryScope scope,
    long assetId,
    int number,
    String originalSha256,
    long originalByteLength,
    String originalObjectRef,
    String contentSha256,
    long contentByteLength,
    String contentObjectRef,
    ConversionStatus conversionStatus,
    List<String> conversionWarnings,
    Instant createdAt
) {
    /** 转换状态（与 `ck_ent_library_revision_conversion_status` 同集合）。 */
    public enum ConversionStatus {
        /** 已转换（正文可用）。 */
        READY,
        /** 尚未转换。 */
        PENDING,
        /** 转换失败（正文不可用，原件仍在）。 */
        FAILED
    }
}
