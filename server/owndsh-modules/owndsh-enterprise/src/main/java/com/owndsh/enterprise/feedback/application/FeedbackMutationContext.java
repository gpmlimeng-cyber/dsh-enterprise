/**
 * [INPUT]: 接收管理会话可信 tenant/actor/request 上下文。
 * [OUTPUT]: 提供反馈处置事务的审计上下文。
 * [POS]: feedback/application 的管理写边界值对象。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.application;

import java.util.Objects;

public record FeedbackMutationContext(
    String tenantId,
    long actorId,
    String requestId,
    String sourceIp,
    byte[] userAgentHash
) {
    public FeedbackMutationContext {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(requestId, "requestId");
        if (actorId <= 0) throw new IllegalArgumentException("actorId 必须为正数");
        if (userAgentHash != null && userAgentHash.length != 32) {
            throw new IllegalArgumentException("userAgentHash 必须是 SHA-256");
        }
        userAgentHash = userAgentHash == null ? null : userAgentHash.clone();
    }

    @Override
    public byte[] userAgentHash() {
        return userAgentHash == null ? null : userAgentHash.clone();
    }
}
