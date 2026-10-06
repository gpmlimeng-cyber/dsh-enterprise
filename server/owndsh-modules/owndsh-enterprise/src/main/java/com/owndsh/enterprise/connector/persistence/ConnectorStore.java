/**
 * [INPUT]: 接收 tenant、条目 CAS 期望版本、完整 assignment 集合与主体存在性查询。
 * [OUTPUT]: 提供自然键幂等（tenant×connectorId）、FOR UPDATE 取行、CAS 更新与可见范围全量替换所需的全部原语。
 * [POS]: connector/application 的 PostgreSQL DIP 边界（与 PresetStore 同形，故意不暴露任何 jsonb 解析）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.persistence;

import com.owndsh.enterprise.connector.domain.ConnectorAssignment;
import com.owndsh.enterprise.connector.domain.ConnectorEntry;

import java.util.List;
import java.util.Optional;

public interface ConnectorStore {
    /** 自然键查询（租户内 `connector_id` 唯一，见 V44 的 `uq_ent_connector_connector_id`）。 */
    Optional<ConnectorEntry> findByConnectorId(String tenantId, String connectorId);

    Optional<ConnectorEntry> findById(String tenantId, long id);

    /** 写事务里取行（`for update`）：CAS 之外的第二道并发闸。 */
    Optional<ConnectorEntry> findByIdForUpdate(String tenantId, long id);

    /** 控制台翻页（`id > afterId order by id asc`，与配方/技能同一把尺）。 */
    List<ConnectorEntry> list(String tenantId, long afterId, int limit);

    void insert(ConnectorEntry entry);

    /**
     * CAS 更新：`where tenant_id=? and id=? and revision=?`，受影响行数为 0 即版本冲突。
     *
     * @return 是否真的改到了那一行
     */
    boolean update(ConnectorEntry entry, long expectedRevision);

    /**
     * 只推进 revision（可见范围全量替换后调用，让宿主侧知道"这条连接的可见范围变了"）。
     *
     * @return 是否真的改到了那一行
     */
    boolean incrementRevision(String tenantId, long connectorId, long expectedRevision);

    List<ConnectorAssignment> listAssignments(String tenantId, long connectorId);

    void deleteAssignments(String tenantId, long connectorId);

    void insertAssignment(ConnectorAssignment assignment);

    /** 主体存在性（USER 可见范围必须是真实成员；查不到即拒，不静默留一条指向空气的 assignment）。 */
    boolean subjectExists(long userId);
}
