/**
 * [INPUT]: 投影 BootstrapService 的用户、ACTIVE 设备、revision、含协议/推理 profile 的有效模型/配额与插件分配；SessionPolicy 来自 enterprise.session 部署参数。
 * [OUTPUT]: 对外提供 T06 严格客户端所需的完整脱敏 bootstrap 外壳；sessionPolicy/collabPolicy 均默认 false，显式部署可开。
 * [POS]: model/web 的 runtime 配置输出边界；插件复用下载授权事实，Session/协作能力由部署 Properties 宣告。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.model.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.owndsh.enterprise.collab.EnterpriseCollabProperties;
import com.owndsh.enterprise.model.application.BootstrapService;
import com.owndsh.enterprise.session.EnterpriseSessionProperties;

import java.util.List;
import java.util.Base64;

public record BootstrapView(
    long revision,
    User user,
    Device device,
    List<Model> models,
    List<Quota> quotas,
    Plugins plugins,
    SessionPolicy sessionPolicy,
    CollabPolicy collabPolicy
) {
    public static BootstrapView from(
        BootstrapService.BootstrapSnapshot snapshot,
        EnterpriseSessionProperties sessionProperties,
        EnterpriseCollabProperties collabProperties
    ) {
        return from(snapshot, toSessionPolicy(sessionProperties), toCollabPolicy(collabProperties));
    }

    public static BootstrapView from(
        BootstrapService.BootstrapSnapshot snapshot,
        SessionPolicy sessionPolicy,
        CollabPolicy collabPolicy
    ) {
        return new BootstrapView(
            snapshot.revision(),
            new User(
                Long.toString(snapshot.user().id()), snapshot.user().username(), snapshot.user().displayName(),
                snapshot.user().departmentId() == null ? null : Long.toString(snapshot.user().departmentId())
            ),
            new Device(
                Long.toString(snapshot.device().id()), snapshot.device().installationId().toString(), "ACTIVE"
            ),
            snapshot.models().stream().map(value -> new Model(
                value.alias(), value.name(), value.apiProtocol().value(), value.contextWindow(), value.maxTokens(),
                value.reasoningEfforts() == null ? null : value.reasoningEfforts().jsonValue(),
                value.reasoningCompat() == null ? null : value.reasoningCompat().jsonValue(), value.isDefault()
            )).toList(),
            snapshot.quotas().stream().map(value -> new Quota(
                Long.toString(value.id()), value.subjectType().name(), value.resourceType().name(),
                value.resourceId() == null ? null : Long.toString(value.resourceId()), value.fiveHourTokenLimit(),
                value.dailyTokenLimit(), value.weeklyTokenLimit(), value.monthlyTokenLimit(), value.rpm(),
                value.concurrency()
            )).toList(),
            new Plugins(
                snapshot.plugins().revision(),
                snapshot.plugins().assignments().stream().map(value -> new PluginAssignment(
                    Long.toString(value.pluginVersionId()), value.packageName(), value.version(), value.sizeBytes(),
                    value.sha256(), Base64.getEncoder().encodeToString(value.signature()), value.compatibility(),
                    value.desiredState().name().equals("INSTALLED")
                        ? "/enterprise/api/v1/plugins/versions/" + value.pluginVersionId() + "/download"
                        : null,
                    value.required(), value.desiredState().name()
                )).toList()
            ),
            sessionPolicy,
            collabPolicy
        );
    }

    public static SessionPolicy toSessionPolicy(EnterpriseSessionProperties sessionProperties) {
        return new SessionPolicy(
            sessionProperties.isEnabled(),
            sessionProperties.getRetentionDays(),
            sessionProperties.getMaxBatchBytes()
        );
    }

    public static CollabPolicy toCollabPolicy(EnterpriseCollabProperties collabProperties) {
        return new CollabPolicy(collabProperties.isEnabled());
    }

    public record User(String id, String username, String displayName, String departmentId) {
    }

    public record Device(String id, String installationId, String status) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Model(
        String alias,
        String name,
        String apiProtocol,
        Integer contextWindow,
        Integer maxTokens,
        Object reasoningEfforts,
        Object compat,
        boolean isDefault
    ) {
    }

    public record Quota(
        String policyId,
        String scope,
        String resourceType,
        String resourceId,
        Long fiveHourTokenLimit,
        Long dailyTokenLimit,
        Long weeklyTokenLimit,
        Long monthlyTokenLimit,
        Integer rpm,
        Integer concurrency
    ) {
    }

    public record Plugins(long revision, List<PluginAssignment> assignments) {
    }

    public record PluginAssignment(
        String pluginVersionId,
        String packageName,
        String version,
        long sizeBytes,
        String sha256,
        String signatureBase64,
        com.owndsh.enterprise.plugin.domain.PluginCompatibility compatibility,
        String downloadUrl,
        boolean required,
        String desiredState
    ) {
    }

    public record SessionPolicy(boolean enabled, int retentionDays, int maxBatchBytes) {
    }

    public record CollabPolicy(boolean enabled) {
    }
}
