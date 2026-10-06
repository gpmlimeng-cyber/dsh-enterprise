/**
 * [INPUT]: 由 ConnectorDescriptorGate 在形状/凭据/层级三处闸门上抛出。
 * [OUTPUT]: 对外提供稳定错误码（ENT_CONNECTOR_DECLARATION_INVALID / ENT_CONNECTOR_SECRET_INLINE / ENT_CONNECTOR_LEVEL_DECLARED）。
 * [POS]: connector/application 的失败防泄漏边界——消息里**绝不回显**收到的凭据正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.application;

/**
 * 连接器声明被拒。
 *
 * ★ 三枚码与 bundle 侧 `EnterpriseConnectorErrorCode`（`src/connector/errors.ts`）逐字同名：
 * 同一份纪律在宿主与服务端各实现一次，两边的**码必须一致**，否则运维看到两个名字以为是两件事。
 *
 * ★ 消息不放任何收到的正文：本类唯一会带上下文的地方是字段名（如"descriptor 里出现 value"），
 * 而**不放值**——闸门拒绝的正是"值"，把它写进异常等于把值搬到日志里。
 */
public final class ConnectorDeclarationException extends RuntimeException {
    /** 形状不合（字段缺失/越界/未知键/未知枚举）。 */
    public static final String INVALID = "ENT_CONNECTOR_DECLARATION_INVALID";
    /** 配置里出现明文凭据（唯一允许的形态是引用：只写键名）。 */
    public static final String SECRET_INLINE = "ENT_CONNECTOR_SECRET_INLINE";
    /** 声明方自贴权限等级（层级只能由求值器算，方案 §3.2 纪律 2）。 */
    public static final String LEVEL_DECLARED = "ENT_CONNECTOR_LEVEL_DECLARED";

    private static final long serialVersionUID = 1L;

    private final String errorCode;

    public ConnectorDeclarationException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String errorCode() {
        return errorCode;
    }

    public static ConnectorDeclarationException invalid(String message) {
        return new ConnectorDeclarationException(INVALID, message);
    }

    public static ConnectorDeclarationException secretInline(String field) {
        return new ConnectorDeclarationException(SECRET_INLINE, "配置里只允许写凭据引用（键名），不允许写值：" + field);
    }

    public static ConnectorDeclarationException levelDeclared(String field) {
        return new ConnectorDeclarationException(LEVEL_DECLARED, "权限等级由求值器计算，不允许声明侧自贴：" + field);
    }

    /** 供 application 层把任意声明异常按需重包（保持码不变）。 */
    public ConnectorDeclarationException withMessage(String message) {
        return new ConnectorDeclarationException(errorCode, message);
    }
}
