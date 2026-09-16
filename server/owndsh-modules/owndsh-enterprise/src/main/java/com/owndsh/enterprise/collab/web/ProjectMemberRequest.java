/**
 * [INPUT]: 成员邀请/转让请求中的目标用户。
 * [OUTPUT]: 对外提供 userId 字符串 DTO。
 * [POS]: collab/web 成员治理输入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.web;

public record ProjectMemberRequest(String userId) {
}
