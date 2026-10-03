/**
 * [INPUT]: 无（纯枚举）。
 * [OUTPUT]: 主体范围的两档取值；本刀只写 PERSONAL，ORGANIZATION 为 P2 组织共享预留（与 V43 的 check 约束同集合）。
 * [POS]: library/domain 的值类型；与 bundle 侧 `LibrarySubject.scope` 是同一件事的两端。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.domain;

/** 资料归属的主体范围。 */
public enum LibraryScope {
    /** 个人资料库（本刀唯一写入的一档）。 */
    PERSONAL,
    /** 组织共享（P2；契约与表约束都已预留，本刀不写）。 */
    ORGANIZATION
}
