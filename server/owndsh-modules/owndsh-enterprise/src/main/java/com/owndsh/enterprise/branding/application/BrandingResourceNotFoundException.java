/**
 * [INPUT]: 由品牌 revision 或资产在目标 scope 下不存在时抛出。
 * [OUTPUT]: 对外提供统一 ENT_RESOURCE_NOT_FOUND 语义的领域异常。
 * [POS]: branding/application 的 404 边界；公开资源路由借它同时拒绝对未发布资产的枚举。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.application;

public final class BrandingResourceNotFoundException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public BrandingResourceNotFoundException() {
        super("品牌资源不存在");
    }
}
