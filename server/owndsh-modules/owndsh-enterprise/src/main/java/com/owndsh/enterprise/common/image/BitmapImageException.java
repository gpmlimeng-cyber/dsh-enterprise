/**
 * [INPUT]: 由不确定的位图头部字节在格式判定或尺寸解析失败时抛出。
 * [OUTPUT]: 对外提供一个不含纵向错误码的格式拒绝信号。
 * [POS]: common/image 的中性异常，使品牌与反馈各自映射成自己的稳定错误码而不共享纵向语义。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.common.image;

public final class BitmapImageException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public BitmapImageException(String message) {
        super(message);
    }
}
