/**
 * [INPUT]: 依赖引用解析查询的三种结果事实。
 * [OUTPUT]: 提供 MISSING / NOT_PUBLISHED / RESOLVED 三态，供发布口 fail-closed 裁决。
 * [POS]: preset/domain 的引用解析结果；把"不存在"与"存在但不可分发"分成两码，避免管理员拿到笼统失败。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

/**
 * 一条引用的中心侧解析结果。
 */
public enum PresetDependencyResolution {
    /** 中心没有这项资产（或 pinned 的 versionId 不属于该资产）。 */
    MISSING,
    /** 资产存在，但当前没有可分发版本（未 PUBLISHED / 已 RETIRED，或 package 不是 ACTIVE）。 */
    NOT_PUBLISHED,
    /** 存在且当前可分发（pinned 命中 PUBLISHED 版本；latest 至少有一个 PUBLISHED 版本）。 */
    RESOLVED
}
