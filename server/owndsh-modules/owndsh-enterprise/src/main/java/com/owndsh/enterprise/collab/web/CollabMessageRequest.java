/**
 * [INPUT]: 房间消息 POST 体。
 * [OUTPUT]: 对外提供 idempotencyKey/kind/body/targetSessionId/targetSeq。
 * [POS]: collab/web 消息输入；SYSTEM 由服务端拒绝。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.web;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CollabMessageRequest(
    String idempotencyKey,
    String kind,
    String body,
    String targetSessionId,
    Long targetSeq
) {
}
