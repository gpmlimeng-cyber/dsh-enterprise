/**
 * [INPUT]: 投影 preset catalog/version/assignment/runtime 领域对象与 version 的引用清单。
 * [OUTPUT]: 对外提供字符串化 snowflake 与无 artifact 路径的严格 HTTP views（管理端带 dependencies）。
 * [POS]: preset/web 的统一安全投影；runtime 分支刻意保持原样，避免员工端解码器出现未知键中间态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.web;

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
     * 单条引用的管理端投影：只有 kind/id/mode/versionId/required 五个作者面字段。
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

    public static RuntimeSummaryView runtime(RuntimePreset value) {
        return new RuntimeSummaryView(
            Long.toString(value.packageId()), value.presetId(), value.displayName(), value.description(),
            value.sourceDshVersion(), value.sizeBytes(), value.updatedAt()
        );
    }

    public static RuntimeDetailView runtimeDetail(RuntimePreset value) {
        return new RuntimeDetailView(
            Long.toString(value.packageId()), value.presetId(), value.displayName(), value.description(),
            Long.toString(value.versionId()), value.sourceDshVersion(), value.sizeBytes(), value.sha256(),
            value.updatedAt(),
            "/enterprise/api/v1/presets/versions/" + value.versionId() + "/download"
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

    /** 管理端引用投影；`versionId` 只在 mode=pinned 时非空（latest 引用跟中心当前最新）。 */
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

    public record RuntimeSummaryView(
        String id,
        String presetId,
        String displayName,
        String description,
        String sourceDshVersion,
        long sizeBytes,
        Instant updatedAt
    ) {
    }

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
        String downloadPath
    ) {
    }
}
