/**
 * [INPUT]: 依赖 SnakeYAML SafeConstructor 与解压/entry 上限，读取不可信 .dshskill ZIP。
 * [OUTPUT]: 对外提供已验证 manifest 字段（含可选 category）与包内每个 SKILL.md 的 frontmatter 脱敏投影。
 * [POS]: skill/artifact 的单遍验包闸门，不把 ZIP entry 解压到文件系统，也不保留技能正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.artifact;

import com.owndsh.enterprise.skill.domain.SkillEntry;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * `.dshskill` 单遍验包器。
 *
 * <p>包结构与 DSH 官方技能规范同构：根 `manifest.json` 声明 `format=dsh-skill` `version=1`，
 * 其余内容位于 `skills/<name>/SKILL.md`；一个包允许携带多个技能条目（对齐官方
 * `dsh.skills` 数组语义与 `dsh-agent-preset` 包内 `skills/` 多目录形态）。
 */
public final class SkillArtifactInspector {
    private static final int MAX_MANIFEST_BYTES = 1_048_576;
    /** manifest 可选 category 的长度上限，与契约 maxLength 32 逐字一致。 */
    private static final int MAX_CATEGORY_LENGTH = 32;
    private static final int MAX_SKILL_MD_BYTES = 262_144;
    private static final int MAX_SKILLS = 200;
    /** 与官方 `dsh-skill` 的 SKILL_NAME 正则逐字一致。 */
    private static final Pattern SKILL_NAME = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final Pattern PACKAGE_REF = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]*$");
    private static final String SKILL_FILE = "SKILL.md";
    /** 官方明确拒收的旧字段名，必须给出可诊断的错误而不是静默忽略。 */
    private static final Map<String, String> LEGACY_FIELDS = Map.of(
        "modelInvocable", "disable-model-invocation",
        "userInvocable", "user-invocable",
        "disableModelInvocation", "disable-model-invocation"
    );

    private final JsonMapper json;
    private final long maxExpandedBytes;
    private final int maxEntries;

    public SkillArtifactInspector(JsonMapper json, long maxExpandedBytes, int maxEntries) {
        this.json = Objects.requireNonNull(json, "json");
        if (maxExpandedBytes <= 0 || maxEntries <= 0) throw new IllegalArgumentException("归档上限必须为正数");
        this.maxExpandedBytes = maxExpandedBytes;
        this.maxEntries = maxEntries;
    }

    public InspectedSkillPackage inspect(Path archive) {
        Objects.requireNonNull(archive, "archive");
        Set<String> paths = new HashSet<>();
        Map<String, byte[]> skillFiles = new LinkedHashMap<>();
        byte[] manifest = null;
        long expanded = 0;
        int entries = 0;
        try (InputStream file = Files.newInputStream(archive); ZipInputStream zip = new ZipInputStream(file)) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > maxEntries) throw tooLarge("归档 entry 数超过上限");
                String name = validateEntry(entry);
                if (!paths.add(name)) throw invalid("归档包含重复路径");
                boolean isManifest = "manifest.json".equals(name);
                boolean isSkillFile = isSkillFile(name);
                ByteArrayOutputStream capture = isManifest || isSkillFile ? new ByteArrayOutputStream() : null;
                int limit = isManifest ? MAX_MANIFEST_BYTES : MAX_SKILL_MD_BYTES;
                int read;
                while ((read = zip.read(buffer)) != -1) {
                    expanded = Math.addExact(expanded, read);
                    if (expanded > maxExpandedBytes) throw tooLarge("归档解压大小超过上限");
                    if (capture != null) {
                        if (capture.size() + read > limit) {
                            throw invalid(isManifest ? "manifest.json 过大" : "SKILL.md 过大");
                        }
                        capture.write(buffer, 0, read);
                    }
                }
                if (capture != null) {
                    if (isManifest) {
                        manifest = capture.toByteArray();
                    } else {
                        if (skillFiles.size() >= MAX_SKILLS) throw invalid("包内技能条目超过上限");
                        skillFiles.put(name, capture.toByteArray());
                    }
                }
            }
        } catch (SkillArtifactException exception) {
            throw exception;
        } catch (ArithmeticException exception) {
            throw tooLarge("归档解压大小溢出");
        } catch (IOException | RuntimeException exception) {
            throw invalid("dshskill 归档无法解析", exception);
        }
        if (entries == 0 || manifest == null) throw invalid("归档缺少 manifest.json");
        if (skillFiles.isEmpty()) throw invalid("归档至少需要一个 skills/<name>/SKILL.md");
        return validateManifest(manifest, skillFiles);
    }

    private static boolean isSkillFile(String name) {
        String[] segments = name.split("/", -1);
        return segments.length == 3 && "skills".equals(segments[0]) && SKILL_FILE.equals(segments[2]);
    }

    private static String validateEntry(ZipEntry entry) {
        String name = entry.getName();
        if (name == null || name.isEmpty() || name.indexOf('\0') >= 0 || name.indexOf('\\') >= 0
            || name.startsWith("/") || name.startsWith("\\")) {
            throw invalid("归档路径非法");
        }
        String[] segments = name.split("/", -1);
        for (String segment : segments) {
            if ("..".equals(segment) || ".".equals(segment)) throw invalid("归档路径包含逃逸段");
        }
        // 只接受根 manifest.json 与 skills/ 子树，杜绝包内携带可执行落点的旁路目录。
        if (!"manifest.json".equals(name) && !name.startsWith("skills/") && !"skills".equals(name)) {
            throw invalid("归档路径必须位于根或 skills/ 下");
        }
        return name;
    }

    private InspectedSkillPackage validateManifest(byte[] bytes, Map<String, byte[]> skillFiles) {
        JsonNode root;
        try {
            root = json.readTree(bytes);
        } catch (RuntimeException exception) {
            throw invalid("manifest.json 不是有效 JSON", exception);
        }
        if (root == null || !root.isObject()) throw invalid("manifest.json 必须是 object");
        if (!"dsh-skill".equals(requiredText(root.get("format"), "format", 32))) {
            throw invalid("manifest format 必须为 dsh-skill");
        }
        String version = requiredText(root.get("version"), "version", 8);
        if (!"1".equals(version)) throw invalid("manifest version 仅支持 1");
        String skillId = requiredText(root.get("id"), "id", 128);
        if (!PACKAGE_REF.matcher(skillId).matches()) throw invalid("manifest id 非法");
        String displayName = requiredText(root.get("name"), "name", 120);
        String sourceDshVersion = requiredText(root.get("sourceDshVersion"), "sourceDshVersion", 64);
        String description = optionalText(root.get("description"), 2000);
        String category = optionalCategory(root.get("category"));

        List<SkillEntry> skills = new ArrayList<>(skillFiles.size());
        Set<String> names = new HashSet<>();
        for (Map.Entry<String, byte[]> file : skillFiles.entrySet()) {
            SkillEntry skill = parseSkillFile(file.getKey(), file.getValue());
            if (!names.add(skill.name())) throw invalid("包内技能名重复：" + skill.name());
            skills.add(skill);
        }
        return new InspectedSkillPackage(
            skillId, displayName, description, category, sourceDshVersion, List.copyOf(skills)
        );
    }

    /** 解析单个 SKILL.md 的 YAML frontmatter，规则对齐官方 `dsh-skill-filesystem`。 */
    private SkillEntry parseSkillFile(String path, byte[] bytes) {
        String text = new String(bytes, StandardCharsets.UTF_8);
        String frontmatter = extractFrontmatter(text);
        Object loaded;
        try {
            LoaderOptions options = new LoaderOptions();
            options.setAllowDuplicateKeys(false);
            options.setMaxAliasesForCollections(16);
            loaded = new Yaml(new SafeConstructor(options)).load(frontmatter);
        } catch (RuntimeException exception) {
            throw invalid("SKILL.md frontmatter 不是有效 YAML：" + path, exception);
        }
        if (!(loaded instanceof Map<?, ?> raw)) throw invalid("SKILL.md frontmatter 必须是映射：" + path);
        Map<String, Object> data = new LinkedHashMap<>();
        for (Map.Entry<?, ?> item : raw.entrySet()) {
            if (!(item.getKey() instanceof String key)) throw invalid("SKILL.md frontmatter 键必须是字符串：" + path);
            data.put(key, item.getValue());
        }
        for (Map.Entry<String, String> legacy : LEGACY_FIELDS.entrySet()) {
            if (data.containsKey(legacy.getKey())) {
                throw invalid(
                    "SKILL.md frontmatter 字段 \"" + legacy.getKey() + "\" 不受支持，请改用 \"" + legacy.getValue() + "\""
                );
            }
        }
        String name = requiredSkillText(data, "name", path, 64);
        if (!SKILL_NAME.matcher(name).matches()) throw invalid("SKILL.md name 必须是 kebab-case：" + name);
        String description = requiredSkillText(data, "description", path, 1024);
        String whenToUse = optionalSkillText(data, "whenToUse", path, 2048);
        boolean disableModelInvocation = booleanField(data, "disable-model-invocation", path);
        boolean userInvocable = data.containsKey("user-invocable")
            ? booleanField(data, "user-invocable", path)
            : true;
        return new SkillEntry(name, description, whenToUse, !disableModelInvocation, userInvocable);
    }

    /** 提取 `---` 起止的 frontmatter 块；官方在缺失 frontmatter 时忽略该文件，这里升级为整包拒绝。 */
    private static String extractFrontmatter(String text) {
        String normalized = text.startsWith("\uFEFF") ? text.substring(1) : text;
        int start = normalized.indexOf("---");
        if (start < 0 || !normalized.substring(0, start).isBlank()) throw invalid("SKILL.md 缺少 YAML frontmatter");
        int lineStart = normalized.indexOf('\n', start);
        if (lineStart < 0) throw invalid("SKILL.md frontmatter 未闭合");
        int end = normalized.indexOf("\n---", lineStart);
        if (end < 0) throw invalid("SKILL.md frontmatter 未闭合");
        return normalized.substring(lineStart + 1, end + 1);
    }

    private static String requiredSkillText(Map<String, Object> data, String key, String path, int maxLength) {
        String value = optionalSkillText(data, key, path, maxLength);
        if (value == null || value.isBlank()) throw invalid("SKILL.md 缺少 " + key + "：" + path);
        return value;
    }

    private static String optionalSkillText(Map<String, Object> data, String key, String path, int maxLength) {
        Object value = data.get(key);
        if (value == null) return null;
        if (!(value instanceof String text)) throw invalid("SKILL.md 字段 " + key + " 必须是字符串：" + path);
        if (text.length() > maxLength) throw invalid("SKILL.md 字段 " + key + " 过长：" + path);
        return text;
    }

    /** 官方接受 boolean 与 true/false/yes/no/on/off/1/0 字面量，其余一律拒绝。 */
    private static boolean booleanField(Map<String, Object> data, String key, String path) {
        Object value = data.get(key);
        if (value == null) return false;
        if (value instanceof Boolean bool) return bool;
        if (value instanceof Integer number && (number == 1 || number == 0)) return number == 1;
        if (value instanceof String text) {
            return switch (text.toLowerCase()) {
                case "true", "yes", "on", "1" -> true;
                case "false", "no", "off", "0" -> false;
                default -> throw invalid("SKILL.md 字段 " + key + " 必须是布尔值：" + path);
            };
        }
        throw invalid("SKILL.md 字段 " + key + " 必须是布尔值：" + path);
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

    /**
     * 读取 manifest 的可选 category。
     *
     * <p>口径：缺席、JSON null 与空串都归一为 null（"没有分类"只有一种表示），
     * 非空纯空白（如 {@code "   "}）是无效声明，整包拒绝而不是静默归一，
     * 避免"提交了分类却看不到标签"的静默分歧；长度上限 32，超出即拒绝；
     * 合法值原样透传、不做 trim（分类是声明真值，服务端不改写它）。</p>
     */
    private static String optionalCategory(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (!node.isString()) throw invalid("manifest 字段 category 必须是字符串");
        String value = node.stringValue();
        if (value.length() > MAX_CATEGORY_LENGTH) {
            throw invalid("manifest 字段 category 超过 " + MAX_CATEGORY_LENGTH + " 字符");
        }
        if (value.isEmpty()) return null;
        if (value.isBlank()) throw invalid("manifest 字段 category 不接受纯空白");
        return value;
    }

    private static SkillArtifactException invalid(String message) {
        return new SkillArtifactException(SkillArtifactException.Kind.INVALID, message);
    }

    private static SkillArtifactException invalid(String message, Throwable cause) {
        return new SkillArtifactException(SkillArtifactException.Kind.INVALID, message, cause);
    }

    private static SkillArtifactException tooLarge(String message) {
        return new SkillArtifactException(SkillArtifactException.Kind.TOO_LARGE, message);
    }

    /**
     * 已验证的包级声明。
     *
     * <p>category 是 manifest 的可选分类：缺席、JSON null 与空串都归一为 null
     * （表示没有分类），非空纯空白整包拒绝，合法值原样透传不做 trim。</p>
     */
    public record InspectedSkillPackage(
        String skillId,
        String displayName,
        String description,
        String category,
        String sourceDshVersion,
        List<SkillEntry> skills
    ) {
    }
}
