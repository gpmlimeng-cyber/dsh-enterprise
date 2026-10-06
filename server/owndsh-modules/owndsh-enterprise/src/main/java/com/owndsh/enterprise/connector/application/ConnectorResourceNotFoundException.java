/**
 * [INPUT]: 由 connector catalog 查不到条目时抛出。
 * [OUTPUT]: 对外提供稳定 ENT_RESOURCE_NOT_FOUND（与 preset/skill 同码，不为同一种结果造第二枚）。
 * [POS]: connector/application 的管理资源缺失边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.application;

public final class ConnectorResourceNotFoundException extends RuntimeException {
    public static final String ERROR_CODE = "ENT_RESOURCE_NOT_FOUND";
    private static final long serialVersionUID = 1L;

    public ConnectorResourceNotFoundException() {
        super("连接不存在");
    }
}
