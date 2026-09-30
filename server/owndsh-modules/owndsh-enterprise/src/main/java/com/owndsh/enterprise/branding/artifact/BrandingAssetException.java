/**
 * [INPUT]: 由不确定的品牌位图字节流校验失败时抛出。
 * [OUTPUT]: 对外提供 ENT_BRANDING_ASSET_INVALID 与 ENT_BRANDING_ASSET_TOO_LARGE 两类稳定错误。
 * [POS]: branding/artifact 的不可信输入拒绝边界，不携带文件路径或字节内容。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.artifact;

public final class BrandingAssetException extends RuntimeException {
    public static final String INVALID = "ENT_BRANDING_ASSET_INVALID";
    public static final String TOO_LARGE = "ENT_BRANDING_ASSET_TOO_LARGE";

    public enum Kind { INVALID, TOO_LARGE }

    private static final long serialVersionUID = 1L;

    private final Kind kind;
    private final String errorCode;

    public BrandingAssetException(Kind kind, String message) {
        super(message);
        this.kind = kind;
        this.errorCode = kind == Kind.TOO_LARGE ? TOO_LARGE : INVALID;
    }

    public BrandingAssetException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
        this.errorCode = kind == Kind.TOO_LARGE ? TOO_LARGE : INVALID;
    }

    public Kind kind() {
        return kind;
    }

    public String errorCode() {
        return errorCode;
    }
}
