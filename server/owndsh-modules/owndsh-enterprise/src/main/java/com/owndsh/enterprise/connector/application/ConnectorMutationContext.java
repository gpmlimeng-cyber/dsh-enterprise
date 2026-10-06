/**
 * [INPUT]: 依赖管理会话可信 tenant/actor/request 上下文（与 PresetMutationContext 同形）。
 * [OUTPUT]: 提供连接器写事务的审计上下文。
 * [POS]: connector/application 的管理写边界值对象。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.application;

import java.util.Objects;

public record ConnectorMutationContext(
    String tenantId,
    long actorId,
    String requestId,
    String sourceIp,
    byte[] userAgentHash
) {
    public ConnectorMutationContext {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(requestId, "requestId");
    }
}
