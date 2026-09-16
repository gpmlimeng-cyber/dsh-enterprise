/**
 * [INPUT]: 项目 ACTIVE/ARCHIVED 与 OWNER/MEMBER 角色的封闭枚举。
 * [OUTPUT]: 对外提供与 V31 check 约束同构的领域分类。
 * [POS]: collab/domain 的状态真源，禁止任意字符串穿透持久化。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.domain;

public enum ProjectStatus {
    ACTIVE,
    ARCHIVED
}
