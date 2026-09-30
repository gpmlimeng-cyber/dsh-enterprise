/**
 * [INPUT]: 依赖客户端提交的 wire 值与数据库大写枚举，以及冻结的处置链路口径。
 * [OUTPUT]: 对外提供 new/triaged/resolved/ignored 双向映射与显式状态转移规则。
 * [POS]: feedback/domain 的处置状态机真源；非法流转在这里被拒绝，Controller 不做状态判断。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 反馈处置状态。
 *
 * <p>冻结链路：{@code new → triaged → resolved | ignored}。首次流转必须先分诊，
 * 分诊后才允许解决或忽略；resolved/ignored 是终态，重复或回退流转一律拒绝。
 */
public enum FeedbackStatus {
    NEW("new"),
    TRIAGED("triaged"),
    RESOLVED("resolved"),
    IGNORED("ignored");

    private final String wireValue;

    FeedbackStatus(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static FeedbackStatus fromWire(String value) {
        for (FeedbackStatus status : values()) {
            if (status.wireValue.equals(value)) return status;
        }
        throw new FeedbackValidationException("反馈状态只允许 new/triaged/resolved/ignored");
    }

    public static FeedbackStatus fromDatabase(String value) {
        try {
            return valueOf(value);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new IllegalStateException("反馈状态数据库值非法");
        }
    }

    /**
     * 只允许 new→triaged、triaged→resolved、triaged→ignored；同值流转也算非法。
     */
    public boolean canTransitionTo(FeedbackStatus target) {
        if (target == null) return false;
        return switch (this) {
            case NEW -> target == TRIAGED;
            case TRIAGED -> target == RESOLVED || target == IGNORED;
            case RESOLVED, IGNORED -> false;
        };
    }

    public boolean terminal() {
        return this == RESOLVED || this == IGNORED;
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    public String databaseValue() {
        return name();
    }
}
