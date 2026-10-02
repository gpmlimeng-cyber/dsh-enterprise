/**
 * [INPUT]: 投影 preset catalog/version/assignment/runtime 领域对象与 version 的引用清单。
 * [OUTPUT]: 对外提供字符串化 snowflake 与无 artifact 路径的严格 HTTP views（管理与 runtime 都带 dependencies）。
 * [POS]: preset/web 的统一安全投影；runtime 摘要与详情共用同一份 dependencies（详情经契约 allOf 继承），
 *        因此员工端只需一套解码即可在启用前看清「N 技能 · M 插件」。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.owndsh.enterprise.preset.application.PresetCatalogService;
import com.owndsh.enterprise.preset.domain.PresetAssignment;
import com.owndsh.enterprise.preset.domain.PresetDependency;
import com.owndsh.enterprise.preset.domain.PresetVersion;
import com.owndsh.enterprise.preset.domain.RuntimePreset;

import java.time.Instant;
import java.util.List;

public final class PresetViews {
    private PresetViews() {
    }

    public static PackageView packageView(PresetCatalogService.CatalogItem value) {
        return new PackageView(
            Long.toString(value.presetPackage().id()),
            value.presetPackage().presetId(),
            value.presetPackage().displayName(),
            value.presetPackage().description(),
            value.presetPackage().status().name(),
            value.presetPackage().revision(),
            value.versions().stream().map(PresetViews::version).toList(),
            value.assignments().stream().map(PresetViews::assignment).toList()
        );
    }

    public static VersionView version(PresetVersion value) {
        return new VersionView(
            Long.toString(value.id()), Long.toString(value.packageId()), value.sourceDshVersion(),
            value.sizeBytes(), value.sha256(), value.status().name(), value.createdAt(), value.revision(),
            value.dependencies().stream().map(PresetViews::dependency).toList()
        );
    }

    /**
     * 单条引用的投影（管理与 runtime 共用）：只有 kind/id/mode/versionId/required 五个作者面字段。
     *
     * <p>服务端字段 `resolvedVersionId`（方案 §D 的可选第 6 键）本切片不填充，因此不在这里出现——
     * 契约里它仍是可选字段，二期发布口解析"当时最新"后由这里带出。
     */
    public static DependencyView dependency(PresetDependency value) {
        return new DependencyView(
            value.kind(), value.id(), value.mode(), value.versionId(), value.required()
        );
    }

    public static AssignmentView assignment(PresetAssignment value) {
        return new AssignmentView(
            Long.toString(value.id()), Long.toString(value.packageId()), value.subjectType().name(),
            value.subjectId() == null ? null : Long.toString(value.subjectId()),
            value.status().name(), value.revision()
        );
    }

    /** 员工端列表投影：与详情同一份 dependencies，列表行因此能直接渲染「N 技能 · M 插件」。 */
    public static RuntimeSummaryView runtime(RuntimePreset value) {
        return new RuntimeSummaryView(
            Long.toString(value.packageId()), value.presetId(), value.displayName(), value.description(),
            value.sourceDshVersion(), value.sizeBytes(), value.updatedAt(),
            value.dependencies().stream().map(PresetViews::dependency).toList()
        );
    }

    /**
     * 员工端详情投影：契约里经 allOf 继承摘要的 dependencies，故这里同样带上。
     *
     * <p>此前这里还多输出一个未声明字段 `downloadPath`（一期遗留）。它不在契约 `RuntimePresetDetail`
     * 里、不在 fixture 里、也不在两端生成物里，而下载 URL 完全可由本投影已带的 `versionId` 拼出
     * （员工端就是这样做的：`版本/<versionId>/download`）。员工端解码器是**关闭键集**，
     * 任何未声明键都会让整条响应判 `ENT_LOCAL_RESPONSE_INVALID`，所以这个字段必须去掉而不是白名单化。
     */
    public static RuntimeDetailView runtimeDetail(RuntimePreset value) {
        return new RuntimeDetailView(
            Long.toString(value.packageId()), value.presetId(), value.displayName(), value.description(),
            Long.toString(value.versionId()), value.sourceDshVersion(), value.sizeBytes(), value.sha256(),
            value.updatedAt(),
            value.dependencies().stream().map(PresetViews::dependency).toList()
        );
    }

    public record PackageView(
        String id,
        String presetId,
        String displayName,
        String description,
        String status,
        long revision,
        List<VersionView> versions,
        List<AssignmentView> assignments
    ) {
    }

    public record VersionView(
        String id,
        String packageId,
        String sourceDshVersion,
        long sizeBytes,
        String sha256,
        String status,
        Instant createdAt,
        long revision,
        List<DependencyView> dependencies
    ) {
    }

    /**
     * 单条引用的投影（管理与 runtime 共用）：只有 kind/id/mode/versionId/required 五个作者面字段。
     *
     * <p>服务端字段 `resolvedVersionId`（方案 §D 的可选第 6 键）本切片不填充，因此不在这里出现——
     * 契约里它仍是可选字段，二期发布口解析"当时最新"后由这里带出。
     *
     * <p>`@JsonInclude(NON_NULL)` 是必须的：契约里 `versionId` 是**可选**属性（`PresetVersionId`），
     * 而 `mode=latest` 时它是 null；不加这一条会序列化出 `"versionId": null`，
     * 既违反契约与两端生成的 strict Zod，也与既有 fixture 的"缺席"口径不一致。
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DependencyView(
        String kind,
        String id,
        String mode,
        String versionId,
        boolean required
    ) {
    }

    public record AssignmentView(
        String id,
        String packageId,
        String subjectType,
        String subjectId,
        String status,
        long revision
    ) {
    }

    /**
     * 员工端列表投影：带 dependencies，供"启用前看清这份配方包含什么"。
     * 摘要不是空壳计数，而是完整引用清单（同一 PresetDependency 形状），与详情零分叉。
     */
    public record RuntimeSummaryView(
        String id,
        String presetId,
        String displayName,
        String description,
        String sourceDshVersion,
        long sizeBytes,
        Instant updatedAt,
        List<DependencyView> dependencies
    ) {
    }

    /**
     * 员工端详情投影：**只输出契约声明的字段**（摘要全部字段 + versionId + sha256 + dependencies）。
     * 键集与 fixture `runtime-preset-detail-success.json` 逐字一致，员工端列表与详情共用同一解码白名单。
     */
    public record RuntimeDetailView(
        String id,
        String presetId,
        String displayName,
        String description,
        String versionId,
        String sourceDshVersion,
        long sizeBytes,
        String sha256,
        Instant updatedAt,
        List<DependencyView> dependencies
    ) {
    }
}
