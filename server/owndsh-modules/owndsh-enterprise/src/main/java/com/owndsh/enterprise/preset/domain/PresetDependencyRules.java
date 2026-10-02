/**
 * [INPUT]: 依赖 PresetDependency 值对象的形状事实。
 * [OUTPUT]: 提供一条引用在"v1 形状下是否合法"的纯判定（违规类别 + 安全 detail），供验包与发布口共用。
 * [POS]: preset/domain 的形状闸；不触库、不做引用存在性裁决（那是发布口与 PresetStore 的职责）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 配方引用的 v1 形状规则：单条元素的类型/枚举/坐标一致性、查重与条数上限。
 *
 * <p>故意做成纯函数：验包（`preset/artifact`）与发布口（`preset/application`）必须对同一份
 * 形状给出同一结论，只在"违规映射成哪个错误码"上分叉（上传口统一 ENT_PRESET_INVALID_PACKAGE，
 * 发布口按 Violation 分到 ENT_PRESET_DEPENDENCIES_INVALID / ENT_PRESET_DEPENDENCY_KIND_UNSUPPORTED）。
 */
public final class PresetDependencyRules {
    /** 与可见范围（200 条）同量级，同时被 V39 的 jsonb_array_length 检查兜底。 */
    public static final int MAX_DEPENDENCIES = 200;
    /** 技能 ID 语法与 ent_skill_package.skill_id 的 check 约束一致（V35）。 */
    private static final Pattern SKILL_ID = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]*$");
    private static final int MAX_SKILL_ID = 128;
    /**
     * npm package name 语法与 PluginArtifactInspector.PACKAGE_NAME / PluginPackage 同源；
     * 垂直隔离要求各纵向自带副本，不跨纵向往 preset/domain 引插件包。
     */
    private static final Pattern PLUGIN_NAME = Pattern.compile("^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$");
    private static final int MAX_PLUGIN_NAME = 214;
    private static final Pattern SNOWFLAKE_ID = Pattern.compile("^[1-9][0-9]{0,18}$");

    /** 违规的两档语义：形状非法（含查重/超限）与引用类型不支持。 */
    public enum Violation { SHAPE_INVALID, KIND_UNSUPPORTED }

    /** 一条违规：类别 + 只含受控字面量（kind/id/versionId 均已过形状校验）的 detail。 */
    public record Finding(Violation violation, String detail) {
        public Finding {
            Objects.requireNonNull(violation, "violation");
            Objects.requireNonNull(detail, "detail");
        }
    }

    private PresetDependencyRules() {
    }

    /**
     * 按固定顺序判定整份引用清单：先逐条元素，再查重。
     *
     * @param dependencies 已解析的引用清单
     * @return 空表示合法；否则第一条违规
     */
    public static Optional<Finding> inspect(List<PresetDependency> dependencies) {
        Objects.requireNonNull(dependencies, "dependencies");
        if (dependencies.size() > MAX_DEPENDENCIES) {
            return Optional.of(new Finding(Violation.SHAPE_INVALID, "配方引用条数超过上限 " + MAX_DEPENDENCIES));
        }
        Set<String> seen = new HashSet<>();
        for (PresetDependency dependency : dependencies) {
            Optional<Finding> finding = inspectOne(dependency);
            if (finding.isPresent()) return finding;
            if (!seen.add(dependency.kind() + "\u0000" + dependency.id())) {
                return Optional.of(new Finding(Violation.SHAPE_INVALID, "配方引用重复：" + label(dependency)));
            }
        }
        return Optional.empty();
    }

    /**
     * 稳定的引用标签，用于发布失败时告诉管理员"缺的是哪一项"。
     * 只含已通过形状校验的 kind/id，绝不回显 manifest 里的自由文本。
     */
    public static String label(PresetDependency dependency) {
        return dependency.kind() + "/" + dependency.id();
    }

    private static Optional<Finding> inspectOne(PresetDependency dependency) {
        Objects.requireNonNull(dependency, "dependency");
        String kind = dependency.kind();
        if (!PresetDependency.KIND_SKILL.equals(kind) && !PresetDependency.KIND_PLUGIN.equals(kind)) {
            // 不把未校验的 kind 原样回显进失败 detail。
            return Optional.of(new Finding(Violation.KIND_UNSUPPORTED, "配方引用类型不支持（只允许 skill/plugin）"));
        }
        String id = dependency.id();
        if (PresetDependency.KIND_SKILL.equals(kind)) {
            if (id.length() > MAX_SKILL_ID || !SKILL_ID.matcher(id).matches()) {
                return Optional.of(new Finding(Violation.SHAPE_INVALID, "配方引用 id 非法"));
            }
        } else if (id.length() > MAX_PLUGIN_NAME || !PLUGIN_NAME.matcher(id).matches()) {
            return Optional.of(new Finding(Violation.SHAPE_INVALID, "配方引用 id 非法"));
        }
        String mode = dependency.mode();
        if (!PresetDependency.MODE_PINNED.equals(mode) && !PresetDependency.MODE_LATEST.equals(mode)) {
            return Optional.of(new Finding(Violation.SHAPE_INVALID, "配方引用 mode 非法：" + label(dependency)));
        }
        String versionId = dependency.versionId();
        if (PresetDependency.MODE_PINNED.equals(mode)) {
            if (versionId == null || !SNOWFLAKE_ID.matcher(versionId).matches()) {
                return Optional.of(new Finding(
                    Violation.SHAPE_INVALID, "pinned 引用缺少合法 versionId：" + label(dependency)
                ));
            }
        } else if (versionId != null) {
            return Optional.of(new Finding(
                Violation.SHAPE_INVALID, "latest 引用不得携带 versionId：" + label(dependency)
            ));
        }
        return Optional.empty();
    }
}
