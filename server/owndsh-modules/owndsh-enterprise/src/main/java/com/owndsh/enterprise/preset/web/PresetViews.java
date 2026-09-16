/**
 * [INPUT]: 投影 preset catalog/version/assignment/runtime 领域对象。
 * [OUTPUT]: 对外提供字符串化 snowflake 与无 artifact 路径的严格 HTTP views。
 * [POS]: preset/web 的统一安全投影。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.web;

import com.owndsh.enterprise.preset.application.PresetCatalogService;
import com.owndsh.enterprise.preset.domain.PresetAssignment;
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
            value.sizeBytes(), value.sha256(), value.status().name(), value.createdAt(), value.revision()
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
        long revision
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
