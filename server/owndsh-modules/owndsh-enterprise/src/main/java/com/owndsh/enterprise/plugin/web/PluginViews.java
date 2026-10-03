/**
 * [INPUT]: 投影 plugin catalog/version/assignment/runtime/inventory 领域对象。
 * [OUTPUT]: 对外提供字符串化 snowflake、完整 catalog assignments、**必填 displayName（1..120，员工端卡片标题）**、**可选 description（缺席即不下发该键）**、Base64 Ed25519（未签名为空字符串）与无 artifact 路径的严格 HTTP views。
 * [POS]: plugin/web 的统一安全投影，管理端和 runtime 共享签名/compatibility 字段语义。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.owndsh.enterprise.plugin.application.EffectivePluginResolver;
import com.owndsh.enterprise.plugin.application.PluginCatalogService;
import com.owndsh.enterprise.plugin.domain.DevicePluginInventory;
import com.owndsh.enterprise.plugin.domain.PluginAssignment;
import com.owndsh.enterprise.plugin.domain.PluginCompatibility;
import com.owndsh.enterprise.plugin.domain.PluginVersion;
import com.owndsh.enterprise.plugin.domain.RuntimePluginAssignment;

import java.time.Instant;
import java.util.Base64;
import java.util.List;

public final class PluginViews {
    private PluginViews() {
    }

    public static PackageView packageView(PluginCatalogService.CatalogItem value) {
        return new PackageView(
            Long.toString(value.pluginPackage().id()), value.pluginPackage().packageName(),
            value.pluginPackage().displayName(), value.pluginPackage().description(),
            value.pluginPackage().status().name(),
            value.pluginPackage().revision(), value.versions().stream().map(PluginViews::version).toList(),
            value.assignments().stream().map(PluginViews::assignment).toList()
        );
    }

    public static VersionView version(PluginVersion value) {
        return new VersionView(
            Long.toString(value.id()), Long.toString(value.packageId()), value.packageName(), value.version(),
            value.sizeBytes(), value.sha256(), Base64.getEncoder().encodeToString(value.signature()),
            value.compatibility(), value.status().name(), value.createdAt(), value.revision()
        );
    }

    public static AssignmentView assignment(PluginAssignment value) {
        return new AssignmentView(
            Long.toString(value.id()), Long.toString(value.packageId()), Long.toString(value.pluginVersionId()),
            value.subjectType().name(), value.subjectId() == null ? null : Long.toString(value.subjectId()),
            value.desiredState().name(), value.required(), value.status().name(), value.revision()
        );
    }

    public static RuntimeAssignmentsView runtime(EffectivePluginResolver.ResolvedAssignments resolved) {
        return new RuntimeAssignmentsView(
            resolved.revision(), resolved.assignments().stream().map(PluginViews::runtime).toList()
        );
    }

    public static RuntimeAssignmentView runtime(RuntimePluginAssignment value) {
        return new RuntimeAssignmentView(
            Long.toString(value.pluginVersionId()), value.packageName(), value.version(), value.displayName(),
            value.description(),
            value.sizeBytes(),
            value.sha256(), Base64.getEncoder().encodeToString(value.signature()), value.compatibility(),
            value.desiredState() == PluginAssignment.DesiredState.INSTALLED
                ? "/enterprise/api/v1/plugins/versions/" + value.pluginVersionId() + "/download"
                : null,
            value.required(), value.desiredState().name()
        );
    }

    public static InventoryView inventory(DevicePluginInventory value) {
        return new InventoryView(
            Long.toString(value.deviceId()), value.username(), value.packageName(), value.version(), value.sha256(),
            value.desiredRevision(), value.state().name(), value.loaderPhase(), value.lastErrorCode(),
            value.observedAt()
        );
    }

    public record PackageView(
        String id,
        String packageName,
        String displayName,
        /**
         * 制品 package.json 的可选 description。契约里它是**可选属性**：为 null 时必须**整个键缺席**
         * （见下面 `@JsonInclude(NON_NULL)` 的说明），故这里不能序列化成 `"description": null`。
         */
        @JsonInclude(JsonInclude.Include.NON_NULL) String description,
        String status,
        long revision,
        List<VersionView> versions,
        List<AssignmentView> assignments
    ) {
    }

    public record VersionView(
        String id,
        String packageId,
        String packageName,
        String version,
        long sizeBytes,
        String sha256,
        String signatureBase64,
        PluginCompatibility compatibility,
        String status,
        Instant createdAt,
        long revision
    ) {
    }

    public record AssignmentView(
        String id,
        String packageId,
        String pluginVersionId,
        String subjectType,
        String subjectId,
        String desiredState,
        boolean required,
        String status,
        long revision
    ) {
    }

    public record RuntimeAssignmentsView(long revision, List<RuntimeAssignmentView> assignments) {
    }

    /**
     * 员工端分配投影（bootstrap 与 `/plugins/assignments` 共用）。
     *
     * <p>`displayName` 是**必填**字段（契约 `PluginDisplayName`，1..120）：制品包里没写时验包器已回退成
     * 包名，故领域对象永不为 null，这里既不加 `@JsonInclude(NON_NULL)` 也不允许缺席——
     * 员工端卡片标题（本刀）就取这一枚。
     *
     * <p>`description` 上那条 `@JsonInclude(NON_NULL)` 是**必须的**：契约里 `PluginDescription` 是
     * **可选**属性（`description?: string`），而包没有描述时领域对象是 null；不加这一条会序列化出
     * `"description": null`，既违反契约、也会被两端生成的 strict Zod（`.optional()`）判为畸形。
     * 注意这里**只注解这一个分量**——同一条记录里的 `downloadUrl` 是「必需但可为 null」，绝不能被顺手隐掉。
     */
    public record RuntimeAssignmentView(
        String pluginVersionId,
        String packageName,
        String version,
        String displayName,
        @JsonInclude(JsonInclude.Include.NON_NULL) String description,
        long sizeBytes,
        String sha256,
        String signatureBase64,
        PluginCompatibility compatibility,
        String downloadUrl,
        boolean required,
        String desiredState
    ) {
    }

    public record InventoryView(
        String deviceId,
        String username,
        String packageName,
        String version,
        String sha256,
        long desiredRevision,
        String state,
        String loaderPhase,
        String lastErrorCode,
        Instant observedAt
    ) {
    }

    public record InventoryAck(int reported) {
    }
}
