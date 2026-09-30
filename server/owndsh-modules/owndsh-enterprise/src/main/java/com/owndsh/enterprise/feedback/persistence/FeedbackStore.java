/**
 * [INPUT]: 接收 tenant、状态筛选、keyset 游标与已校验的反馈聚合。
 * [OUTPUT]: 对外提供反馈/附件的只增读写与状态 CAS 端口，不暴露 SQL 细节。
 * [POS]: feedback/application 依赖的 DIP 抽象；附件行与主行同事务写入，不存在半提交反馈。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.persistence;

import com.owndsh.enterprise.feedback.domain.FeedbackAttachment;
import com.owndsh.enterprise.feedback.domain.FeedbackRecord;
import com.owndsh.enterprise.feedback.domain.FeedbackStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface FeedbackStore {
    /** 详情读取；找不到或 tenant 不匹配时为空。 */
    Optional<FeedbackRecord> findById(String tenantId, long feedbackId);

    /** 提交事务内的行锁读取，用于状态 CAS 前的当前事实。 */
    Optional<FeedbackRecord> findForUpdate(String tenantId, long feedbackId);

    Optional<FeedbackRecord> findByIdempotencyKey(String tenantId, long submitterUserId, String idempotencyKey);

    /** 倒序 keyset 列表：id &lt; afterId，afterId 为 0 时从最新开始。 */
    List<FeedbackRecord> list(String tenantId, FeedbackStatus status, long afterId, int limit);

    void insert(FeedbackRecord record, List<FeedbackAttachment> attachments);

    boolean compareAndSetStatus(
        String tenantId,
        long feedbackId,
        long expectedRevision,
        FeedbackStatus target,
        String note,
        long actorId,
        Instant changedAt
    );

    Optional<FeedbackAttachment> findAttachment(String tenantId, long feedbackId, long attachmentId);
}
