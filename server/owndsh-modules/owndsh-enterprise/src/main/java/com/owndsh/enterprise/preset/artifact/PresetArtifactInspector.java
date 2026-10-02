/**
 * [INPUT]: 依赖 Jackson 与解压/entry 上限，读取不可信 .dshpreset ZIP。
 * [OUTPUT]: 对外提供已验证 manifest id/name/description/sourceDshVersion/dependencies 与 agent.cordis.yml 存在性。
 * [POS]: preset/artifact 的单遍验包闸门，不把 ZIP entry 解压到文件系统；只读已知键、不 reject 顶层未知键。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.artifact;

import com.owndsh.enterprise.preset.domain.PresetDependency;
import com.owndsh.enterprise.preset.domain.PresetDependencyRules;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public final class PresetArtifactInspector {
    private static final int MAX_MANIFEST_BYTES = 1_048_576;
    private static final Pattern PRESET_ID = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]*$");
    /**
     * 引用元素允许出现的键（v1 作者面）。`resolvedVersionId` 是服务端字段，不在其中：
     * 它由发布口/二期解析"当时最新"时填充，作者声明一律显式拒绝而不是静默丢弃。
     */
    private static final Set<String> DEPENDENCY_KEYS = Set.of("kind", "id", "mode", "versionId", "required");
    private static final String SERVER_OWNED_DEPENDENCY_KEY = "resolvedVersionId";

    private final JsonMapper json;
    private final long maxExpandedBytes;
    private final int maxEntries;

    public PresetArtifactInspector(JsonMapper json, long maxExpandedBytes, int maxEntries) {
        this.json = Objects.requireNonNull(json, "json");
        if (maxExpandedBytes <= 0 || maxEntries <= 0) throw new IllegalArgumentException("归档上限必须为正数");
        this.maxExpandedBytes = maxExpandedBytes;
        this.maxEntries = maxEntries;
    }

    public InspectedPreset inspect(Path archive) {
        Objects.requireNonNull(archive, "archive");
        Set<String> paths = new HashSet<>();
        byte[] manifest = null;
        boolean hasAgent = false;
        long expanded = 0;
        int entries = 0;
        try (InputStream file = Files.newInputStream(archive); ZipInputStream zip = new ZipInputStream(file)) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > maxEntries) throw tooLarge("归档 entry 数超过上限");
                String name = validateEntry(entry);
                if (!paths.add(name)) throw invalid("归档包含重复路径");
                ByteArrayOutputStream capture = "manifest.json".equals(name)
                    ? new ByteArrayOutputStream()
                    : null;
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    expanded = Math.addExact(expanded, read);
                    if (expanded > maxExpandedBytes) throw tooLarge("归档解压大小超过上限");
                    if (capture != null) {
                        if (capture.size() + read > MAX_MANIFEST_BYTES) throw invalid("manifest.json 过大");
                        capture.write(buffer, 0, read);
                    }
                }
                if (capture != null) manifest = capture.toByteArray();
                if ("preset/agent.cordis.yml".equals(name) || "preset/agent.cordis.yaml".equals(name)) {
                    hasAgent = true;
                }
            }
        } catch (PresetArtifactException exception) {
            throw exception;
        } catch (ArithmeticException exception) {
            throw tooLarge("归档解压大小溢出");
        } catch (IOException | RuntimeException exception) {
            throw invalid("dshpreset 归档无法解析", exception);
        }
        if (entries == 0 || manifest == null) throw invalid("归档缺少 manifest.json");
        if (!hasAgent) throw invalid("归档缺少 preset/agent.cordis.yml");
        return validateManifest(manifest);
    }

    private static String validateEntry(ZipEntry entry) {
        String name = entry.getName();
        if (name == null || name.isEmpty() || name.indexOf('\0') >= 0 || name.indexOf('\\') >= 0
            || name.startsWith("/") || name.startsWith("\\")) {
            throw invalid("归档路径非法");
        }
        String[] segments = name.split("/", -1);
        for (int index = 0; index < segments.length; index++) {
            if ("..".equals(segments[index]) || ".".equals(segments[index])) {
                throw invalid("归档路径包含逃逸段");
            }
        }
        if (!"manifest.json".equals(name) && !name.startsWith("preset/")
            && !name.equals("preset") && !name.startsWith("preset\\")) {
            throw invalid("归档路径必须位于根或 preset/ 下");
        }
        return name;
    }

    private InspectedPreset validateManifest(byte[] bytes) {
        JsonNode root;
        try {
            root = json.readTree(bytes);
        } catch (RuntimeException exception) {
            throw invalid("manifest.json 不是有效 JSON", exception);
        }
        if (root == null || !root.isObject()) throw invalid("manifest.json 必须是 object");
        if (!"dsh-preset".equals(requiredText(root.get("format"), "format", 32))) {
            throw invalid("manifest format 必须为 dsh-preset");
        }
        String version = requiredText(root.get("version"), "version", 8);
        if (!"1".equals(version)) throw invalid("manifest version 仅支持 1");
        String id = requiredText(root.get("id"), "id", 128);
        if (!PRESET_ID.matcher(id).matches()) throw invalid("manifest id 非法");
        String name = requiredText(root.get("name"), "name", 120);
        String sourceDshVersion = requiredText(root.get("sourceDshVersion"), "sourceDshVersion", 64);
        String description = optionalText(root.get("description"), 2000);
        return new InspectedPreset(id, name, description, sourceDshVersion, dependencies(root.get("dependencies")));
    }

    /**
     * 读取 manifest.json 顶层可选 `dependencies` 数组，抄成不可变引用清单（无该键即"没有引用"）。
     *
     * <p>只认已知键：元素里出现未知键（典型是 `required` 拼错、或作者自行声明服务端字段
     * `resolvedVersionId`）一律拒包——静默降级会把"必填引用"变成"可选引用"，正是发布口
     * fail-closed 要拦的事。顶层其它未知键仍然忽略（既有包的向后兼容，行为有单测锁定）。
     */
    private List<PresetDependency> dependencies(JsonNode node) {
        if (node == null || node.isNull()) return List.of();
        if (!node.isArray()) throw invalid("manifest dependencies 必须是数组");
        if (node.size() > PresetDependencyRules.MAX_DEPENDENCIES) {
            throw invalid("manifest dependencies 条数超过上限");
        }
        List<PresetDependency> parsed = new ArrayList<>();
        for (int index = 0; index < node.size(); index++) {
            JsonNode element = node.get(index);
            if (element == null || !element.isObject()) throw invalid("manifest dependencies 元素必须是 object");
            for (String key : element.propertyNames()) {
                if (SERVER_OWNED_DEPENDENCY_KEY.equals(key)) {
                    throw invalid("manifest 不得声明 " + SERVER_OWNED_DEPENDENCY_KEY);
                }
                if (!DEPENDENCY_KEYS.contains(key)) throw invalid("manifest dependencies 元素包含未知键");
            }
            parsed.add(new PresetDependency(
                requiredText(element.get("kind"), "dependencies.kind", 16),
                requiredText(element.get("id"), "dependencies.id", 255),
                requiredText(element.get("mode"), "dependencies.mode", 16),
                optionalText(element.get("versionId"), 19),
                requiredBoolean(element.get("required"))
            ));
        }
        List<PresetDependency> dependencies = List.copyOf(parsed);
        Optional<PresetDependencyRules.Finding> finding = PresetDependencyRules.inspect(dependencies);
        if (finding.isPresent()) throw invalid("manifest dependencies 非法：" + finding.get().detail());
        return dependencies;
    }

    private static boolean requiredBoolean(JsonNode node) {
        if (node == null || node.isNull() || !node.isBoolean()) {
            throw invalid("manifest 字段必须是布尔值");
        }
        return node.booleanValue();
    }

    private static String requiredText(JsonNode node, String field, int maxLength) {
        String value = optionalText(node, maxLength);
        if (value == null || value.isBlank()) throw invalid("manifest 缺少 " + field);
        return value;
    }

    private static String optionalText(JsonNode node, int maxLength) {
        if (node == null || node.isNull()) return null;
        if (!node.isString()) throw invalid("manifest 字段必须是字符串");
        String value = node.stringValue();
        if (value.length() > maxLength) throw invalid("manifest 字段过长");
        return value;
    }

    private static PresetArtifactException invalid(String message) {
        return new PresetArtifactException(PresetArtifactException.Kind.INVALID, message);
    }

    private static PresetArtifactException invalid(String message, Throwable cause) {
        return new PresetArtifactException(PresetArtifactException.Kind.INVALID, message, cause);
    }

    private static PresetArtifactException tooLarge(String message) {
        return new PresetArtifactException(PresetArtifactException.Kind.TOO_LARGE, message);
    }

    public record InspectedPreset(
        String presetId,
        String displayName,
        String description,
        String sourceDshVersion,
        List<PresetDependency> dependencies
    ) {
        public InspectedPreset {
            dependencies = List.copyOf(Objects.requireNonNull(dependencies, "dependencies"));
        }
    }
}
