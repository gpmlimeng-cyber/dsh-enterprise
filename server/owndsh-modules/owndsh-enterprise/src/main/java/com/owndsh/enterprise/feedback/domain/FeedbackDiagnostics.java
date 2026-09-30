/**
 * [INPUT]: 依赖客户端自动附带的白名单诊断字段，不接受任意 Map 或请求对象。
 * [OUTPUT]: 对外提供只含插件版本/宿主版本/OS/installationId/最近错误码的裁剪后诊断值。
 * [POS]: feedback/domain 的诊断白名单闸门；字段内容用严格正则约束，令牌、路径与控制字符在入库前即被拒绝。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.domain;

import java.util.regex.Pattern;

/**
 * 客户端诊断摘要。
 *
 * <p>只承载 5 个白名单字段：协议层多出的键没有字段可落，字段内的任意文本也被正则收窄，
 * 因此令牌、会话内容与文件路径不可能经 diagnostics 进入数据库。
 */
public record FeedbackDiagnostics(
    String pluginVersion,
    String hostVersion,
    String os,
    String installationId,
    String lastErrorCode
) {
    private static final Pattern VERSION = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$");
    private static final Pattern PLATFORM = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$");
    private static final Pattern INSTALLATION = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$");
    private static final Pattern ERROR_CODE = Pattern.compile("^[A-Z][A-Z0-9_]{0,63}$");

    public static final FeedbackDiagnostics EMPTY = new FeedbackDiagnostics(null, null, null, null, null);

    public FeedbackDiagnostics {
        pluginVersion = match(pluginVersion, VERSION, "pluginVersion");
        hostVersion = match(hostVersion, VERSION, "hostVersion");
        os = match(os, PLATFORM, "os");
        installationId = match(installationId, INSTALLATION, "installationId");
        lastErrorCode = match(lastErrorCode, ERROR_CODE, "lastErrorCode");
    }

    public boolean empty() {
        return pluginVersion == null && hostVersion == null && os == null
            && installationId == null && lastErrorCode == null;
    }

    private static String match(String value, Pattern pattern, String name) {
        if (value == null) return null;
        String normalized = value.strip();
        if (normalized.isEmpty()) return null;
        if (!pattern.matcher(normalized).matches()) {
            throw new FeedbackValidationException("diagnostics." + name + " 格式非法");
        }
        return normalized;
    }
}
