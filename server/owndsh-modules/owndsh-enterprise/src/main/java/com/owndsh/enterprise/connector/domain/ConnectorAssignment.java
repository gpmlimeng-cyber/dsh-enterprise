/**
 * [INPUT]: 依赖 V44 的 ent_connector_assignment 列族与 ALL/USER 可见范围封闭集合。
 * [OUTPUT]: 提供不可变的连接可见性 assignment，含主体形状不变式。
 * [POS]: connector/domain 的可见范围事实，**没有** DEPT 与 required 字段（与 PresetAssignment 同口径）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.domain;

import java.util.Objects;

/**
 * 一条连接的可见范围（"谁能看到/用这条连接"）。
 *
 * 与 `PresetAssignment` 同构：**全组织 / 指定成员**两种主体，**全量原子替换、禁增量补丁、CAS 冲突**。
 * 刻意不做部门级——仓库已把部门资源移除（`docs/plan/enterprise-presets.md:767`），
 * 这里跟着既有收敛走，不逆着来（方案 §8.1 第 2 条）。
 */
public record ConnectorAssignment(
    long id,
    String tenantId,
    long connectorId,
    SubjectType subjectType,
    Long subjectId,
    Status status,
    long revision
) {
    /** 与 V44 的 `ck_ent_connector_assignment_subject_type` 逐字一致。 */
    public enum SubjectType { ALL, USER }

    /** 与 V44 的 `ck_ent_connector_assignment_status` 逐字一致。 */
    public enum Status { ACTIVE, DISABLED }

    public ConnectorAssignment {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(subjectType, "subjectType");
        Objects.requireNonNull(status, "status");
        if (subjectType == SubjectType.ALL && subjectId != null) {
            throw new IllegalArgumentException("ALL 主体不能携带 subjectId");
        }
        if (subjectType == SubjectType.USER && (subjectId == null || subjectId <= 0)) {
            throw new IllegalArgumentException("USER 主体必须携带正 subjectId");
        }
    }
}
