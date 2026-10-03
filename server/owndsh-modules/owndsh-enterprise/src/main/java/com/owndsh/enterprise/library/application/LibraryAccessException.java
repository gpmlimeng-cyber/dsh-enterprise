/**
 * [INPUT]: 无（只带一枚稳定码）。
 * [OUTPUT]: 资料库应用层的一切业务拒绝都抛它，`code()` 是 bundle 侧同一族的 `library/<kebab>` 字符串。
 * [POS]: library/application 的失败边界；形状与 `plugin/application/PluginAccessException` 同族（一枚稳定码 + 一句给日志的技术话）。HTTP 投影留给下一刀（那时才有契约可依）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.application;

/**
 * 资料库业务拒绝。
 *
 * <p>`code` 与 bundle 侧 `LibraryError.code` **逐字同集合**（`library/not-found` / `library/disabled` /
 * `library/draft-format` / `library/revision-conflict` / `library/base-revision-conflict` /
 * `library/file-too-large`），这样两端对同一种失败说的是同一句话。
 */
public class LibraryAccessException extends RuntimeException {
    private final String code;

    /**
     * 构造。
     *
     * @param code 稳定码（`library/<kebab>`）
     * @param message 给日志的英文技术句（不含正文、不含绝对路径）
     */
    public LibraryAccessException(String code, String message) {
        super(message);
        this.code = code;
    }

    /** 稳定码。 */
    public String code() {
        return code;
    }
}
