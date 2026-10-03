/**
 * [INPUT]: 投影 BootstrapService 的用户、ACTIVE 设备、revision、含协议/推理 profile 的有效模型/配额与插件分配（含必填 displayName + 可选 description）；SessionPolicy 来自 enterprise.session 部署参数。
 * [OUTPUT]: 对外提供 T06 严格客户端所需的完整脱敏 bootstrap 外壳；插件分配与 `/plugins/assignments` 同键同口径（displayName 必发、没有 description 时整个 description 键缺席）；sessionPolicy.enabled 默认 false（V1 停用），显式部署可开。
 * [POS]: model/web 的 runtime 配置输出边界；插件复用下载授权事实，且是**员工端本机目录的唯一数据源**——这里的键集必须与 PluginViews 的分配投影逐字一致；Session 能力由 EnterpriseSessionProperties 宣告。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.model.web;

import com.fasterxml.jackson.annotation.JsonInclude;
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
    SessionPolicy sessionPolicy
) {
    public static BootstrapView from(
        BootstrapService.BootstrapSnapshot snapshot,
        EnterpriseSessionProperties sessionProperties
    ) {
        return from(snapshot, toSessionPolicy(sessionProperties));
    }

    public static BootstrapView from(BootstrapService.BootstrapSnapshot snapshot, SessionPolicy sessionPolicy) {
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
                    Long.toString(value.pluginVersionId()), value.packageName(), value.version(),
                    // 制品 package.json 的 displayName（验包器缺省回退包名，故永不为 null）：
                    // 与 `/plugins/assignments` 共用同一个领域事实（RuntimePluginAssignment.displayName）。
                    // 员工端卡片**标题**取的就是这一枚——bootstrap 另有一套逐字段投影，
                    // 漏了这个键就等于服务端有名称、界面只能拿包名顶（77cbb6c 那次 description 事故的同形缺口）。
                    value.displayName(),
                    // 制品 package.json 的 description：与 `/plugins/assignments` 共用同一个领域事实
                    // （RuntimePluginAssignment.description，可空）。**这一处曾是端到端最后一公里的缺口**：
                    // 员工端本机目录（plugin-distribution 的 catalog）由 bootstrap 快照构建，
                    // bootstrap 自己另有一套逐字段投影，漏了这个键就等于服务端有描述、界面永远「暂无描述」。
                    value.description(),
                    // 这一版制品 tar 里那份 README（口径 20）：与 `/plugins/assignments` 共用同一个领域事实
                    // （RuntimePluginAssignment.readme，可空）。**同一处坑的第二形态**：bootstrap 是独立投影，
                    // 漏了这个键就等于服务端有 README、界面永远只能拿短描述顶——两条投影必须同批改。
                    value.readme(), value.sizeBytes(),
                    value.sha256(), Base64.getEncoder().encodeToString(value.signature()), value.compatibility(),
                    value.desiredState().name().equals("INSTALLED")
                        ? "/enterprise/api/v1/plugins/versions/" + value.pluginVersionId() + "/download"
                        : null,
                    value.required(), value.desiredState().name()
                )).toList()
            ),
            sessionPolicy
        );
    }

    public static SessionPolicy toSessionPolicy(EnterpriseSessionProperties sessionProperties) {
        return new SessionPolicy(
            sessionProperties.isEnabled(),
            sessionProperties.getRetentionDays(),
            sessionProperties.getMaxBatchBytes()
        );
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
        /**
         * 制品 package.json 的 displayName（**必填**，验包器缺省回退包名 ⇒ 服务端永不为 null）。
         * 与 `/plugins/assignments` 的 {@code PluginViews.RuntimeAssignmentView} 同一个键、同一口径；
         * 员工端卡片**标题**（本刀）取的就是它。它必须与那一处**同批**改——两条投影漂开一次
         * （77cbb6c 的 description 缺口）就让界面永远只拿得到包名。
         */
        String displayName,
        /**
         * 制品 package.json 的可选 description。与 `/plugins/assignments` 的
         * {@code PluginViews.RuntimeAssignmentView} 同一条领域事实、同一口径：为 null 时**整个键缺席**
         * （契约 `PluginDescription` 是可选属性，两端生成的 strict Zod 都拒 null），
         * 故这里同样只把这一个分量标成 {@code @JsonInclude(NON_NULL)}——同记录里 required 的
         * {@code downloadUrl} 是「必需但可为 null」，绝不能被顺手隐掉。
         */
        @JsonInclude(JsonInclude.Include.NON_NULL) String description,
        /**
         * 该**版本**制品里的 README 纯文本（可空，契约 `PluginReadme` ≤65536）。与
         * `/plugins/assignments` 的 {@code RuntimeAssignmentView.readme} 同一个键、同一口径：
         * 为 null（没解出 / 存量未回填）时**整个键缺席**（契约 `PluginReadme` 是可选属性，
         * 两端 strict Zod 都拒 null），故这里也只把这一个分量标成 {@code @JsonInclude(NON_NULL)}。
         */
        @JsonInclude(JsonInclude.Include.NON_NULL) String readme,
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
}
