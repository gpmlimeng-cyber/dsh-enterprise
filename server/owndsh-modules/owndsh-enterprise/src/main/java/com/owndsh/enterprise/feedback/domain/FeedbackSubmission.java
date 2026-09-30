/**
 * [INPUT]: 接收 multipart metadata part 解析后的产品字段与白名单 diagnostics，不接受附件字节本身。
 * [OUTPUT]: 对外提供已完成同意、描述长度与联系方式校验的不可变提交值，并暴露产品上限常量。
 * [POS]: feedback/domain 的提交内容真源；附件数量上限与描述上限在这里冻结，数据库约束与之同构。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * 一次问题反馈提交的产品内容。occurredAt 为 null 表示使用提交时刻。
 */
public record FeedbackSubmission(
    FeedbackType type,
    String description,
    Instant occurredAt,
    String contact,
    boolean consent,
    FeedbackDiagnostics diagnostics
) {
    /** 描述硬上限：产品口径 510，与 ent_feedback.description varchar(510) 同构。 */
    public static final int MAX_DESCRIPTION_LENGTH = 510;
    /** 附件数量硬上限：与 ent_feedback_attachment.seq check (1..3) 同构。 */
    public static final int MAX_ATTACHMENTS = 3;
    public static final int MAX_CONTACT_LENGTH = 160;

    private static final Pattern EMAIL = Pattern.compile(
        "^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
            + "(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
    );
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9][0-9 ()\\-]{4,31}$");

    public FeedbackSubmission {
        type = Objects.requireNonNull(type, "type");
        description = normalize(description);
        if (description == null) {
            throw new FeedbackValidationException("问题描述不能为空");
        }
        if (description.length() > MAX_DESCRIPTION_LENGTH) {
            throw new FeedbackValidationException("问题描述超过 " + MAX_DESCRIPTION_LENGTH + " 字上限");
        }
        if (!consent) {
            throw new FeedbackValidationException("必须勾选同意后才能提交反馈");
        }
        contact = normalize(contact);
        if (contact != null) {
            if (contact.length() > MAX_CONTACT_LENGTH
                || (!EMAIL.matcher(contact).matches() && !PHONE.matcher(contact).matches())) {
                throw new FeedbackValidationException("联系方式必须是邮箱或手机号");
            }
        }
        diagnostics = diagnostics == null ? FeedbackDiagnostics.EMPTY : diagnostics;
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
