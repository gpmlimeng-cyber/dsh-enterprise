/**
 * [INPUT]: 投影 skill catalog/version/assignment/runtime 领域对象。
 * [OUTPUT]: 对外提供字符串化 snowflake、包内技能条目与无 artifact 路径的严格 HTTP views。
 * [POS]: skill/web 的统一安全投影，条目只出 frontmatter 元数据，永不出技能正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.owndsh.enterprise.skill.application.SkillCatalogService;
import com.owndsh.enterprise.skill.domain.RuntimeSkill;
import com.owndsh.enterprise.skill.domain.SkillAssignment;
import com.owndsh.enterprise.skill.domain.SkillEntry;
import com.owndsh.enterprise.skill.domain.SkillVersion;

import java.time.Instant;
import java.util.List;

public final class SkillViews {
    private SkillViews() {
    }

    public static PackageView packageView(SkillCatalogService.CatalogItem value) {
        return new PackageView(
            Long.toString(value.skillPackage().id()),
            value.skillPackage().skillId(),
            value.skillPackage().displayName(),
            text(value.skillPackage().description()),
            value.skillPackage().status().name(),
            value.skillPackage().revision(),
            value.versions().stream().map(SkillViews::version).toList(),
            value.assignments().stream().map(SkillViews::assignment).toList()
        );
    }

    public static VersionView version(SkillVersion value) {
        return new VersionView(
            Long.toString(value.id()), Long.toString(value.packageId()), value.skillId(),
            value.sourceDshVersion(), value.sizeBytes(), value.sha256(), value.status().name(),
            value.skillCount(), value.skills().stream().map(SkillViews::entry).toList(),
            value.createdAt(), value.revision()
        );
    }

    public static EntryView entry(SkillEntry value) {
        return new EntryView(
            value.name(), value.description(), text(value.whenToUse()),
            value.modelInvocable(), value.userInvocable()
        );
    }

    /** 契约把 description/whenToUse 声明为 string；选填字段缺席时出空串，绝不出 JSON null。 */
    private static String text(String value) {
        return value == null ? "" : value;
    }

    public static AssignmentView assignment(SkillAssignment value) {
        return new AssignmentView(
            Long.toString(value.id()), Long.toString(value.packageId()), value.subjectType().name(),
            value.subjectId() == null ? null : Long.toString(value.subjectId()),
            value.status().name(), value.revision()
        );
    }

    public static RuntimeSummaryView runtime(RuntimeSkill value) {
        return new RuntimeSummaryView(
            Long.toString(value.packageId()), value.skillId(), value.displayName(), text(value.description()),
            value.sourceDshVersion(), value.sizeBytes(), value.skillCount(), value.updatedAt()
        );
    }

    public static RuntimeDetailView runtimeDetail(RuntimeSkill value) {
        return new RuntimeDetailView(
            Long.toString(value.packageId()), value.skillId(), value.displayName(), text(value.description()),
            Long.toString(value.versionId()), value.sourceDshVersion(), value.sizeBytes(), value.sha256(),
            value.skillCount(), value.skills().stream().map(SkillViews::entry).toList(), value.updatedAt()
        );
    }

    public record PackageView(
        String id,
        String skillId,
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
        String skillId,
        String sourceDshVersion,
        long sizeBytes,
        String sha256,
        String status,
        int skillCount,
        List<EntryView> skills,
        Instant createdAt,
        long revision
    ) {
    }

    public record EntryView(
        String name,
        String description,
        String whenToUse,
        boolean modelInvocable,
        boolean userInvocable
    ) {
    }

    /** ALL 可见范围没有 subjectId；契约把该字段声明为可选 string，故非空才序列化。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
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
        String skillId,
        String displayName,
        String description,
        String sourceDshVersion,
        long sizeBytes,
        int skillCount,
        Instant updatedAt
    ) {
    }

    public record RuntimeDetailView(
        String id,
        String skillId,
        String displayName,
        String description,
        String versionId,
        String sourceDshVersion,
        long sizeBytes,
        String sha256,
        int skillCount,
        List<EntryView> skills,
        Instant updatedAt
    ) {
    }
}
