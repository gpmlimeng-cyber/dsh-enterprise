/**
 * [INPUT]: 依赖客户端提交的 wire 值 `issue`/`suggestion` 与数据库大写枚举。
 * [OUTPUT]: 对外提供默认发行类型、wire 双向映射与数据库值映射。
 * [POS]: feedback/domain 的类型真源，隔离产品口径的小写 wire 值与 PostgreSQL 大写枚举惯例。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 反馈类型。缺省为问题（issue）。
 */
public enum FeedbackType {
    ISSUE("issue"),
    SUGGESTION("suggestion");

    private final String wireValue;

    FeedbackType(String wireValue) {
        this.wireValue = wireValue;
    }

    /**
     * 缺省值只在请求未携带 type 时生效；显式未知值必须被拒绝。
     */
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static FeedbackType fromWire(String value) {
        if (value == null || value.isBlank()) return ISSUE;
        for (FeedbackType type : values()) {
            if (type.wireValue.equals(value)) return type;
        }
        throw new FeedbackValidationException("反馈类型只允许 issue 或 suggestion");
    }

    public static FeedbackType fromDatabase(String value) {
        try {
            return valueOf(value);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new FeedbackValidationException("反馈类型数据库值非法");
        }
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    public String databaseValue() {
        return name();
    }
}
