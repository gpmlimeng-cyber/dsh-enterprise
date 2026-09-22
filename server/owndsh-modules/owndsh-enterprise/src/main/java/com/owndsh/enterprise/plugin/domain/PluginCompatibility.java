/**
 * [INPUT]: 接收发布方声明的 Harness commit 集合、企业 bundle SemVer range 与 OS 集合。
 * [OUTPUT]: 对外提供排序去重、不可变且可直接进入 JCS 声明的 compatibility 值对象。
 * [POS]: plugin/domain 的兼容性真源，只校验 commit 形态而非锁定单一版本，兼容裁决交给 Harness 自身 caret peer 规则。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.domain;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

public record PluginCompatibility(
    List<String> harnessCommits,
    String enterpriseBundleRange,
    List<String> operatingSystems
) {
    private static final Pattern COMMIT = Pattern.compile("^[0-9a-f]{40}$");
    private static final Set<String> OPERATING_SYSTEMS = Set.of("darwin", "linux", "win32");

    public PluginCompatibility {
        Objects.requireNonNull(harnessCommits, "harnessCommits");
        Objects.requireNonNull(operatingSystems, "operatingSystems");
        if (harnessCommits.isEmpty() || harnessCommits.size() > 20
            || harnessCommits.stream().anyMatch(value -> value == null || !COMMIT.matcher(value).matches())) {
            throw new IllegalArgumentException("harnessCommits 非法");
        }
        harnessCommits = harnessCommits.stream().distinct().sorted().toList();
        enterpriseBundleRange = requireText(enterpriseBundleRange, "enterpriseBundleRange", 120);
        if (operatingSystems.isEmpty() || operatingSystems.size() > OPERATING_SYSTEMS.size()
            || operatingSystems.stream().anyMatch(value -> !OPERATING_SYSTEMS.contains(value))) {
            throw new IllegalArgumentException("operatingSystems 非法");
        }
        operatingSystems = operatingSystems.stream().distinct().sorted().toList();
    }

    private static String requireText(String value, String name, int maxLength) {
        Objects.requireNonNull(value, name);
        if (value.isBlank() || value.length() > maxLength || value.indexOf('\0') >= 0) {
            throw new IllegalArgumentException(name + " 非法");
        }
        return value;
    }
}
