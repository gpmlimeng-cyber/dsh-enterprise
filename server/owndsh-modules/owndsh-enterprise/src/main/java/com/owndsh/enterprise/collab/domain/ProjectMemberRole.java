/**
 * [INPUT]: 项目内 OWNER/MEMBER 角色分类。
 * [OUTPUT]: 对外提供与 V31 同构的成员角色。
 * [POS]: collab/domain 角色真源；治理操作只信任 OWNER。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.domain;

public enum ProjectMemberRole {
    OWNER,
    MEMBER
}
