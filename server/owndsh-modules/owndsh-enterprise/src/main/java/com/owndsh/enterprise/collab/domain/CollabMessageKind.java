/**
 * [INPUT]: 房间消息 kind 分类；SYSTEM 仅服务端写入。
 * [OUTPUT]: 对外提供与 V31 check 同构的 CHAT/MENTION/SYSTEM/INJECT_REQUEST。
 * [POS]: collab/domain 消息分类真源；不进入 Session Event 日志。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.domain;

public enum CollabMessageKind {
    CHAT,
    MENTION,
    SYSTEM,
    INJECT_REQUEST
}
