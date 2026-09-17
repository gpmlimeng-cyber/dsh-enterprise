/**
 * [INPUT]: 接收成员添加写请求。
 * [OUTPUT]: 对外提供目标 userId 的严格 DTO。
 * [POS]: workspace/web 的成员写边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

public record CloudProjectMemberRequest(long userId) {
}
