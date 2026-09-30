/**
 * [INPUT]: 无外部依赖，是品牌发布文档 logo_light/logo_dark/logo_square 三列的封闭词表。
 * [OUTPUT]: 对外提供品牌三个槽位的封闭枚举。
 * [POS]: branding/domain 的槽位词表真源，与 ent_branding_document 三个外键列一一对应。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.domain;

/**
 * 一期 LOGO 槽位。
 */
public enum BrandingLogoSlot {
    LIGHT,
    DARK,
    SQUARE
}
