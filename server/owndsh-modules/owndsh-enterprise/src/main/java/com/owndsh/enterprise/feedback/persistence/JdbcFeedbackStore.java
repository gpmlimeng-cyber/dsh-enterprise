/**
 * [INPUT]: 依赖 V34 的 ent_feedback/ent_feedback_attachment 两表与 Spring JDBC。
 * [OUTPUT]: 实现主行插入、倒序 keyset 列表、附件同事务写入、幂等键查询与状态 CAS。
 * [POS]: feedback/persistence 的 PostgreSQL adapter；列表用子查询计数，详情才装载附件行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.persistence;

import com.owndsh.enterprise.feedback.domain.FeedbackAttachment;
import com.owndsh.enterprise.feedback.domain.FeedbackDiagnostics;
import com.owndsh.enterprise.feedback.domain.FeedbackRecord;
import com.owndsh.enterprise.feedback.domain.FeedbackStatus;
import com.owndsh.enterprise.feedback.domain.FeedbackType;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class JdbcFeedbackStore implements FeedbackStore {
    private static final String COLUMNS = """
        f.id, f.tenant_id, f.submitter_user_id, f.device_id, f.type, f.description, f.occurred_at,
        f.contact, f.consent, f.status, f.status_note, f.status_changed_by, f.status_changed_at,
        f.revision, f.plugin_version, f.host_version, f.os, f.reported_installation_id,
        f.last_error_code, f.idempotency_key, f.created_at, f.updated_at
        """;

    private static final String ATTACHMENT_COLUMNS = """
        a.id, a.tenant_id, a.feedback_id, a.seq, a.artifact_ref, a.sha256, a.content_type,
        a.size_bytes, a.width, a.height, a.created_at
        """;

    private static final RowMapper<FeedbackAttachment> ATTACHMENT = (rs, rowNumber) -> new FeedbackAttachment(
        rs.getLong("id"), rs.getString("tenant_id"), rs.getLong("feedback_id"), rs.getInt("seq"),
        rs.getString("artifact_ref"), rs.getString("sha256"), rs.getString("content_type"),
        extension(rs.getString("content_type")), rs.getLong("size_bytes"),
        rs.getInt("width"), rs.getInt("height"), rs.getTimestamp("created_at").toInstant()
    );

    private final JdbcOperations jdbc;

    public JdbcFeedbackStore(JdbcOperations jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public Optional<FeedbackRecord> findById(String tenantId, long feedbackId) {
        List<FeedbackRecord> rows = jdbc.query(
            "select " + COLUMNS + ", (select count(*) from ent_feedback_attachment a"
                + " where a.feedback_id = f.id) as attachment_count"
                + " from ent_feedback f where f.tenant_id = ? and f.id = ?",
            emptyAttachments(), tenantId, feedbackId
        );
        if (rows.isEmpty()) return Optional.empty();
        FeedbackRecord record = rows.getFirst();
        return Optional.of(withAttachments(record, listAttachments(tenantId, feedbackId)));
    }

    @Override
    public Optional<FeedbackRecord> findForUpdate(String tenantId, long feedbackId) {
        return one(jdbc.query(
            "select " + COLUMNS + ", (select count(*) from ent_feedback_attachment a"
                + " where a.feedback_id = f.id) as attachment_count"
                + " from ent_feedback f where f.tenant_id = ? and f.id = ? for update",
            emptyAttachments(), tenantId, feedbackId
        ));
    }

    @Override
    public Optional<FeedbackRecord> findByIdempotencyKey(
        String tenantId,
        long submitterUserId,
        String idempotencyKey
    ) {
        List<FeedbackRecord> rows = jdbc.query(
            "select " + COLUMNS + ", (select count(*) from ent_feedback_attachment a"
                + " where a.feedback_id = f.id) as attachment_count"
                + " from ent_feedback f"
                + " where f.tenant_id = ? and f.submitter_user_id = ? and f.idempotency_key = ?",
            emptyAttachments(), tenantId, submitterUserId, idempotencyKey
        );
        if (rows.isEmpty()) return Optional.empty();
        FeedbackRecord record = rows.getFirst();
        return Optional.of(withAttachments(record, listAttachments(tenantId, record.id())));
    }

    @Override
    public List<FeedbackRecord> list(String tenantId, FeedbackStatus status, long afterId, int limit) {
        if (tenantId == null || tenantId.isBlank() || afterId < 0 || limit < 1 || limit > 201) {
            throw new IllegalArgumentException("反馈列表查询边界非法");
        }
        long cursor = afterId <= 0 ? Long.MAX_VALUE : afterId;
        String sql = "select " + COLUMNS + ", (select count(*) from ent_feedback_attachment a"
            + " where a.feedback_id = f.id) as attachment_count"
            + " from ent_feedback f where f.tenant_id = ? and f.id < ?"
            + (status == null ? "" : " and f.status = ?")
            + " order by f.id desc limit ?";
        return status == null
            ? jdbc.query(sql, emptyAttachments(), tenantId, cursor, limit)
            : jdbc.query(sql, emptyAttachments(), tenantId, cursor, status.databaseValue(), limit);
    }

    @Override
    public void insert(FeedbackRecord record, List<FeedbackAttachment> attachments) {
        Objects.requireNonNull(record, "record");
        List<FeedbackAttachment> rows = List.copyOf(Objects.requireNonNull(attachments, "attachments"));
        jdbc.update(
            """
            insert into ent_feedback (
                id, tenant_id, submitter_user_id, device_id, type, description, occurred_at, contact,
                consent, status, status_note, status_changed_by, status_changed_at, revision,
                plugin_version, host_version, os, reported_installation_id, last_error_code,
                idempotency_key, created_at, updated_at
            ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            record.id(), record.tenantId(), record.submitterUserId(), record.deviceId(),
            record.type().databaseValue(), record.description(), Timestamp.from(record.occurredAt()),
            record.contact(), record.consent(), record.status().databaseValue(), record.statusNote(),
            record.statusChangedBy(),
            record.statusChangedAt() == null ? null : Timestamp.from(record.statusChangedAt()),
            record.revision(), record.diagnostics().pluginVersion(), record.diagnostics().hostVersion(),
            record.diagnostics().os(), record.diagnostics().installationId(),
            record.diagnostics().lastErrorCode(), record.idempotencyKey(),
            Timestamp.from(record.createdAt()), Timestamp.from(record.updatedAt())
        );
        for (FeedbackAttachment attachment : rows) {
            jdbc.update(
                """
                insert into ent_feedback_attachment (
                    id, tenant_id, feedback_id, seq, artifact_ref, sha256, content_type,
                    size_bytes, width, height, created_at
                ) values (?,?,?,?,?,?,?,?,?,?,?)
                """,
                attachment.id(), attachment.tenantId(), attachment.feedbackId(), attachment.seq(),
                attachment.artifactRef(), attachment.sha256(), attachment.contentType(),
                attachment.sizeBytes(), attachment.width(), attachment.height(),
                Timestamp.from(attachment.createdAt())
            );
        }
    }

    @Override
    public boolean compareAndSetStatus(
        String tenantId,
        long feedbackId,
        long expectedRevision,
        FeedbackStatus target,
        String note,
        long actorId,
        Instant changedAt
    ) {
        return jdbc.update(
            """
            update ent_feedback
               set status = ?, status_note = ?, status_changed_by = ?, status_changed_at = ?,
                   revision = revision + 1, updated_at = ?
             where tenant_id = ? and id = ? and revision = ?
            """,
            target.databaseValue(), note, actorId, Timestamp.from(changedAt), Timestamp.from(changedAt),
            tenantId, feedbackId, expectedRevision
        ) == 1;
    }

    @Override
    public Optional<FeedbackAttachment> findAttachment(String tenantId, long feedbackId, long attachmentId) {
        return one(jdbc.query(
            "select " + ATTACHMENT_COLUMNS + """
             from ent_feedback_attachment a
             join ent_feedback f on f.id = a.feedback_id
             where a.tenant_id = ? and a.feedback_id = ? and a.id = ? and f.tenant_id = ?
            """,
            ATTACHMENT, tenantId, feedbackId, attachmentId, tenantId
        ));
    }

    private List<FeedbackAttachment> listAttachments(String tenantId, long feedbackId) {
        return jdbc.query(
            "select " + ATTACHMENT_COLUMNS + """
             from ent_feedback_attachment a
             where a.tenant_id = ? and a.feedback_id = ?
             order by a.seq
            """,
            ATTACHMENT, tenantId, feedbackId
        );
    }

    private static FeedbackRecord withAttachments(FeedbackRecord record, List<FeedbackAttachment> attachments) {
        return new FeedbackRecord(
            record.id(), record.tenantId(), record.submitterUserId(), record.deviceId(), record.type(),
            record.description(), record.occurredAt(), record.contact(), record.consent(), record.status(),
            record.statusNote(), record.statusChangedBy(), record.statusChangedAt(), record.revision(),
            record.diagnostics(), attachments.size(), attachments, record.idempotencyKey(),
            record.createdAt(), record.updatedAt()
        );
    }

    /** 列表投影不装载附件行，只保留 SQL 计数；附件数为 0 时两者一致。 */
    private static RowMapper<FeedbackRecord> emptyAttachments() {
        return (rs, rowNumber) -> map(rs, List.of());
    }

    private static FeedbackRecord map(ResultSet rs, List<FeedbackAttachment> attachments) throws SQLException {
        return new FeedbackRecord(
            rs.getLong("id"), rs.getString("tenant_id"), rs.getLong("submitter_user_id"),
            rs.getString("device_id"), FeedbackType.fromDatabase(rs.getString("type")),
            rs.getString("description"), rs.getTimestamp("occurred_at").toInstant(), rs.getString("contact"),
            rs.getBoolean("consent"), FeedbackStatus.fromDatabase(rs.getString("status")),
            rs.getString("status_note"), rs.getObject("status_changed_by", Long.class),
            instant(rs, "status_changed_at"), rs.getLong("revision"),
            new FeedbackDiagnostics(
                rs.getString("plugin_version"), rs.getString("host_version"), rs.getString("os"),
                rs.getString("reported_installation_id"), rs.getString("last_error_code")
            ),
            rs.getInt("attachment_count"), attachments, rs.getString("idempotency_key"),
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant()
        );
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static String extension(String contentType) {
        return switch (contentType) {
            case "image/png" -> "png";
            case "image/jpeg" -> "jpg";
            case "image/webp" -> "webp";
            default -> throw new IllegalStateException("反馈附件 MIME 非法");
        };
    }

    private static <T> Optional<T> one(List<T> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }
}
