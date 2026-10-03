/**
 * [INPUT]: 依赖 Commons Compress、Jackson 3、解压/entry 上限与外部注入的企业核心包清单。
 * [OUTPUT]: 对外提供已验证 package name/version/displayName、**可选 description（≤1000，宽松口径：缺失/空/超长一律 null）**、**可选 readme（归档根下那份主 README 的纯文本：缺失/非 UTF-8/空白一律 null，按 UTF-8 字节 65536 截断并追加 `(已截断)`）** 和 bundle patch 的归档摘要。
 * [POS]: plugin/artifact 的单遍验包闸门，绝不把未知 entry 解压到文件系统；核心包名单由配置注入而非本类内嵌，杜绝双份真源再次漂移。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.artifact;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

public final class PluginArtifactInspector {
    private static final int MAX_PACKAGE_JSON_BYTES = 1_048_576;
    /** 与契约 `PluginDescription.maxLength` 同值：本类只允许这个上限内的描述进库（超长按没有描述处理）。 */
    private static final int MAX_DESCRIPTION_LENGTH = 1000;
    /**
     * README 的**UTF-8 字节**上限（口径 20 的「64KB」）：含末尾那句 {@link #README_TRUNCATED_SUFFIX}
     * 在内的总字节数不超过它。与契约 `PluginReadme.maxLength`（65536 **字符**）不矛盾——合法 UTF-8 的
     * 字符数不可能超过字节数，故按字节闸住之后字符数必然也 ≤65536。
     */
    public static final int MAX_README_BYTES = 65_536;
    /** 截断时追加的那一句（与契约 `PluginReadme` 的说明逐字一致）；它的字节数算在上限之内。 */
    private static final String README_TRUNCATED_SUFFIX = "(已截断)";
    /**
     * 单份候选 README 从归档里最多抓多少字节：只是**内存护栏**（一份 100MB 的 README 不能把堆撑爆），
     * 不是业务上限——抓满这个数就停手，后面照旧按 {@link #MAX_README_BYTES} 截断。
     * 取值 256KiB = 业务上限的 4 倍，够任何真实 README。
     */
    private static final int MAX_README_CAPTURE_BYTES = 262_144;
    /** 归档里最多同时记住几份候选（4 个候选位各留一份，兜住「首选那份解码失败就退次选」这一步）。 */
    private static final int README_RANKS = 4;
    private static final Set<String> FORBIDDEN_SCRIPTS = Set.of("preinstall", "install", "postinstall", "prepare");
    /**
     * 与配置校验共用的合法 npm package name 语法，避免同一规则在两处各写一份。
     */
    public static final Pattern PACKAGE_NAME = Pattern.compile(
        "^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$"
    );
    private static final Pattern SEMVER = Pattern.compile(
        "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$"
    );
    private static final Pattern EXACT_VERSION = Pattern.compile(
        "^(?:[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?|[0-9]+(?:\\.[0-9]+){0,2}-rc\\.[0-9]+)$"
    );

    private final JsonMapper json;
    private final long maxExpandedBytes;
    private final int maxEntries;
    private final Set<String> protectedPackages;

    public PluginArtifactInspector(
        JsonMapper json,
        long maxExpandedBytes,
        int maxEntries,
        Set<String> protectedPackages
    ) {
        this.json = Objects.requireNonNull(json, "json");
        if (maxExpandedBytes <= 0 || maxEntries <= 0) throw new IllegalArgumentException("归档上限必须为正数");
        this.maxExpandedBytes = maxExpandedBytes;
        this.maxEntries = maxEntries;
        if (protectedPackages == null || protectedPackages.isEmpty()) {
            throw new IllegalArgumentException("企业核心包清单不能为空");
        }
        this.protectedPackages = Set.copyOf(protectedPackages);
    }

    public InspectedPlugin inspect(Path archive) {
        Objects.requireNonNull(archive, "archive");
        Set<String> paths = new HashSet<>();
        byte[] packageJson = null;
        // 每个候选位次留一份（位次越小越像主 README）；同一位次只留**文件名字典序最小**的那份。
        byte[][] readmeBytes = new byte[README_RANKS][];
        String[] readmeNames = new String[README_RANKS];
        boolean[] readmeTruncated = new boolean[README_RANKS];
        long expanded = 0;
        int entries = 0;
        try (InputStream file = Files.newInputStream(archive);
             GzipCompressorInputStream gzip = GzipCompressorInputStream.builder().setInputStream(file).get();
             TarArchiveInputStream tar = new TarArchiveInputStream(gzip)) {
            TarArchiveEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = tar.getNextEntry()) != null) {
                if (++entries > maxEntries) throw tooLarge("归档 entry 数超过上限");
                String name = validateEntry(entry);
                if (!paths.add(name)) throw invalid("归档包含重复路径");
                if (!tar.canReadEntryData(entry)) throw invalid("归档包含不支持的 entry");
                if (entry.getSize() > maxExpandedBytes - expanded) throw tooLarge("归档解压大小超过上限");

                ByteArrayOutputStream capture = "package/package.json".equals(name)
                    ? new ByteArrayOutputStream(Math.min(MAX_PACKAGE_JSON_BYTES, (int) Math.max(0, entry.getSize())))
                    : null;
                // README 候选：**同一次单遍扫描**顺手抓走（绝不为了 README 再解一遍 tar）。
                int readmeSlot = readmeRank(name);
                // 初始容量跟着声明大小走，但**先夹到内存护栏之内**再转 int（2GiB 以上的声明也不会溢出）。
                ByteArrayOutputStream readmeCapture = readmeSlot < 0
                    ? null
                    : new ByteArrayOutputStream(
                        (int) Math.min(MAX_README_CAPTURE_BYTES, Math.max(0L, entry.getSize()))
                    );
                int readmeCaptured = 0;
                int read;
                while ((read = tar.read(buffer)) != -1) {
                    expanded = Math.addExact(expanded, read);
                    if (expanded > maxExpandedBytes) throw tooLarge("归档解压大小超过上限");
                    if (capture != null) {
                        if (capture.size() + read > MAX_PACKAGE_JSON_BYTES) {
                            throw invalid("package.json 过大");
                        }
                        capture.write(buffer, 0, read);
                    }
                    if (readmeCapture != null && readmeCaptured < MAX_README_CAPTURE_BYTES) {
                        int allowed = Math.min(read, MAX_README_CAPTURE_BYTES - readmeCaptured);
                        readmeCapture.write(buffer, 0, allowed);
                        readmeCaptured += allowed;
                    }
                }
                if (capture != null) packageJson = capture.toByteArray();
                if (readmeCapture != null) {
                    byte[] bytes = readmeCapture.toByteArray();
                    if (readmeBytes[readmeSlot] == null || name.compareTo(readmeNames[readmeSlot]) < 0) {
                        readmeBytes[readmeSlot] = bytes;
                        readmeNames[readmeSlot] = name;
                        // 抓取被内存护栏砍过也算「截断」——末尾可能就是半个字符，解码时允许丢掉它。
                        readmeTruncated[readmeSlot] = entry.getSize() > bytes.length;
                    }
                }
            }
        } catch (PluginArtifactException exception) {
            throw exception;
        } catch (ArithmeticException exception) {
            throw tooLarge("归档解压大小溢出");
        } catch (IOException | RuntimeException exception) {
            throw invalid("tgz 归档无法解析", exception);
        }
        if (entries == 0 || packageJson == null) throw invalid("归档缺少 package/package.json");
        return validatePackageJson(packageJson, paths, decodeReadme(readmeBytes, readmeTruncated));
    }

    /**
     * 归档里某个 entry 是不是「主 README」候选；返回候选位次（**越小越像主 README**），不是候选返回 -1。
     *
     * <p>只认**归档根下那一份**（npm 布局就是 {@code package/README.md}）：嵌在子目录里的
     * （{@code package/docs/README.md}、{@code package/lib/README.md}）是文档/子包的一部分，
     * 不是这个包的主 README，一律不当候选——少一层「猜哪份是主」的不确定性。
     *
     * <p>位次表（大小写一律不敏感，{@code README.md} / {@code readme.md} / {@code Readme.md} 同一位次）：
     * <ol>
     *   <li>{@code .md}——npm/GitHub 生态的事实标准，最像主 README；</li>
     *   <li>{@code .markdown}——同一格式的另一种后缀，次之；</li>
     *   <li>{@code .txt}/{@code .text}——纯文本说明，再次之；</li>
     *   <li>无后缀的 {@code README}——老式包常见的写法，最后。</li>
     * </ol>
     * 其它后缀（{@code README.rst}/{@code README.html} 等）不认：前者非 UTF-8 文本的渲染不是我们要的形态，
     * 后者是 HTML（**绝不当 HTML 用**）。同一位次有多份时取**文件名字典序最小**的那份，保证结果确定。
     */
    private static int readmeRank(String entryName) {
        if (!entryName.startsWith("package/")) return -1;
        String leaf = entryName.substring("package/".length());
        if (leaf.isEmpty() || leaf.indexOf('/') >= 0) return -1;
        int dot = leaf.lastIndexOf('.');
        String base = dot < 0 ? leaf : leaf.substring(0, dot);
        String extension = dot < 0 ? "" : leaf.substring(dot).toLowerCase(Locale.ROOT);
        if (!"readme".equals(base.toLowerCase(Locale.ROOT))) return -1;
        return switch (extension) {
            case ".md" -> 0;
            case ".markdown" -> 1;
            case ".txt", ".text" -> 2;
            case "" -> 3;
            default -> -1;
        };
    }

    /**
     * 候选位次由优到劣解码：**第一份能解成合法 UTF-8 文本的**胜出（故首选解码失败时退次选，
     * 而不是整个包就没有 README）；全都解不出、或缺席、或解出来是空白/含 NUL（二进制）⇒ null。
     *
     * <p>README 是**数据不是指令**：本类只把它当文本读出来，不解析 Markdown、不校验 HTML、不执行任何东西。
     */
    private static String decodeReadme(byte[][] candidates, boolean[] truncated) {
        for (int rank = 0; rank < candidates.length; rank++) {
            byte[] bytes = candidates[rank];
            if (bytes == null) continue;
            String text = decodeUtf8(bytes, truncated[rank]);
            if (text == null || text.isBlank() || text.indexOf('\0') >= 0) continue;
            return truncateReadme(text);
        }
        return null;
    }

    /**
     * 严格 UTF-8 解码：畸形字节 / 不可映射字符一律判「解不出」（返回 null），绝不静默替换成 `�`。
     *
     * <p>{@code possiblyTruncated} 为真时（抓取被内存护栏砍过）允许**至多丢掉最后 3 字节**再试——
     * 末尾那点字节可能只是被砍掉一半的多字节字符；中段真的畸形时，一路丢到底仍然是 null，不会被掩盖。
     */
    private static String decodeUtf8(byte[] bytes, boolean possiblyTruncated) {
        int allowance = possiblyTruncated ? 3 : 0;
        for (int drop = 0; drop <= allowance; drop++) {
            try {
                return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes, 0, bytes.length - drop))
                    .toString();
            } catch (CharacterCodingException exception) {
                // 继续往下丢一个字节再试；丢完 allowance 个仍失败就是「解不出」。
            }
        }
        return null;
    }

    /**
     * 按 **UTF-8 字节** 上限 {@link #MAX_README_BYTES} 截断（码点边界安全，绝不切出半个字符），
     * 超限时在末尾追加一句 {@link #README_TRUNCATED_SUFFIX}——那句也**算在上限之内**，
     * 故截断后的总字节数仍然 ≤65536（契约 `PluginReadme.maxLength` 的字符数上界因此必然成立）。
     */
    public static String truncateReadme(String text) {
        if (text.getBytes(StandardCharsets.UTF_8).length <= MAX_README_BYTES) return text;
        int budget = MAX_README_BYTES - README_TRUNCATED_SUFFIX.getBytes(StandardCharsets.UTF_8).length;
        int bytes = 0;
        int index = 0;
        while (index < text.length()) {
            int codePoint = text.codePointAt(index);
            int length = utf8Length(codePoint);
            if (bytes + length > budget) break;
            bytes += length;
            index += Character.charCount(codePoint);
        }
        return text.substring(0, index) + README_TRUNCATED_SUFFIX;
    }

    private static int utf8Length(int codePoint) {
        if (codePoint < 0x80) return 1;
        if (codePoint < 0x800) return 2;
        if (codePoint < 0x10000) return 3;
        return 4;
    }

    private static String validateEntry(TarArchiveEntry entry) {
        String name = entry.getName();
        if (name == null || name.isEmpty() || name.indexOf('\0') >= 0 || name.indexOf('\\') >= 0
            || name.startsWith("/") || !name.startsWith("package/")) {
            throw invalid("归档路径非法");
        }
        String[] segments = name.split("/", -1);
        if (segments.length < 2 || !"package".equals(segments[0])) throw invalid("归档路径不在 package/ 下");
        for (int index = 1; index < segments.length; index++) {
            if ("..".equals(segments[index]) || ".".equals(segments[index])
                || (segments[index].isEmpty() && index != segments.length - 1)) {
                throw invalid("归档路径包含逃逸段");
            }
        }
        if (entry.isSymbolicLink() || entry.isLink() || entry.isCharacterDevice()
            || entry.isBlockDevice() || entry.isFIFO() || (!entry.isFile() && !entry.isDirectory())) {
            throw invalid("归档包含链接或特殊文件");
        }
        if (entry.isFile() && name.toLowerCase(Locale.ROOT).endsWith(".node")) {
            throw invalid("归档包含原生 .node 模块");
        }
        return name;
    }

    private InspectedPlugin validatePackageJson(byte[] bytes, Set<String> paths, String readme) {
        JsonNode root;
        try {
            root = json.readTree(bytes);
        } catch (RuntimeException exception) {
            throw invalid("package.json 不是有效 JSON", exception);
        }
        if (root == null || !root.isObject()) throw invalid("package.json 必须是 object");
        String name = requiredText(root.get("name"), "name", 214);
        if (!PACKAGE_NAME.matcher(name).matches()) throw invalid("package name 非法");
        if (protectedPackages.contains(name)) throw invalid("企业核心包不能通过通用插件分发");
        String version = requiredText(root.get("version"), "version", 64);
        if (!SEMVER.matcher(version).matches()) throw invalid("package version 必须是 SemVer");
        if (!"module".equals(requiredText(root.get("type"), "type", 16))) {
            throw invalid("package type 必须为 module");
        }
        validateScripts(root.get("scripts"));
        validateDependencies(root.get("dependencies"), false);
        validateDependencies(root.get("peerDependencies"), true);

        JsonNode dsh = root.get("dsh");
        JsonNode bundle = dsh == null ? null : dsh.get("bundle");
        String patch = requiredText(bundle == null ? null : bundle.get("patch"), "dsh.bundle.patch", 240);
        String normalizedPatch = normalizePatch(patch);
        if (!paths.contains("package/" + normalizedPatch)) throw invalid("bundle patch 文件不存在");
        String displayName = optionalText(root.get("displayName"), 120);
        // 描述（npm package.json 的 description）：与 displayName 同一条读取路径，但**不校验成败**——
        // 见 optionalDescription 的三条理由。读到了就带上，读不到就是没有描述。
        String description = optionalDescription(root.get("description"));
        return new InspectedPlugin(
            name, version, displayName == null ? name : displayName, description, readme, normalizedPatch
        );
    }

    private static void validateScripts(JsonNode scripts) {
        if (scripts == null) return;
        if (!scripts.isObject()) throw invalid("scripts 必须是 object");
        for (String script : FORBIDDEN_SCRIPTS) {
            if (scripts.get(script) != null) throw invalid("package 包含 install lifecycle script");
        }
    }

    private static void validateDependencies(JsonNode dependencies, boolean peers) {
        if (dependencies == null) return;
        if (!dependencies.isObject()) throw invalid((peers ? "peerDependencies" : "dependencies") + " 必须是 object");
        if (!peers && !dependencies.isEmpty()) throw invalid("dependencies 必须为空");
        if (!peers) return;
        for (String dependency : dependencies.propertyNames()) {
            JsonNode version = dependencies.get(dependency);
            if (dependency.startsWith("@deepseek-ai/")
                && (version == null || !version.isString() || !EXACT_VERSION.matcher(version.stringValue()).matches())) {
                throw invalid("Harness peerDependency 必须使用精确版本");
            }
        }
    }

    private static String normalizePatch(String patch) {
        String value = patch.startsWith("./") ? patch.substring(2) : patch;
        if (value.isEmpty() || value.startsWith("/") || value.indexOf('\\') >= 0 || value.indexOf('\0') >= 0) {
            throw invalid("bundle patch 路径非法");
        }
        for (String segment : value.split("/", -1)) {
            if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
                throw invalid("bundle patch 路径非法");
            }
        }
        return value;
    }

    private static String requiredText(JsonNode value, String name, int maxLength) {
        String text = optionalText(value, maxLength);
        if (text == null) throw invalid("package.json 缺少 " + name);
        return text;
    }

    private static String optionalText(JsonNode value, int maxLength) {
        if (value == null) return null;
        if (!value.isString() || value.stringValue().isBlank() || value.stringValue().length() > maxLength
            || value.stringValue().indexOf('\0') >= 0) {
            throw invalid("package.json 文本字段非法");
        }
        return value.stringValue();
    }

    /**
     * npm {@code description} 的**宽松**读取：只有「非空、无 NUL、且不超过契约上限」的字符串才算描述，
     * 其余一律当作**没有描述**（返回 null）。三条理由：
     * <ol>
     *   <li>描述是**附加事实**、不是制品的合法性要件——「标了描述的包因为描述写得不合规就装不上」
     *       比「这一格少一句描述」坏得多（员工侧还有如实的「暂无描述」降级）；</li>
     *   <li>npm 允许 {@code "description": ""} 这类写法，用 {@link #optionalText} 的严格口径会把
     *       本来能正常安装的包判成非法（**兼容性回归**），故这里不抛；</li>
     *   <li>契约（{@code PluginDescription}）只允许 ≤1000 的字符串或**整个键缺席**，故超长一律按
     *       没有描述处理（不落库、不发线），而不是把整包拒掉、也不是截断成半句。</li>
     * </ol>
     * 「有没有描述」由此只有一个判定点，界面侧不必再猜。
     */
    private static String optionalDescription(JsonNode value) {
        if (value == null || !value.isString()) return null;
        String text = value.stringValue();
        if (text.isBlank() || text.indexOf('\0') >= 0 || text.length() > MAX_DESCRIPTION_LENGTH) return null;
        return text;
    }

    private static PluginArtifactException invalid(String message) {
        return new PluginArtifactException(PluginArtifactException.Kind.INVALID, message);
    }

    private static PluginArtifactException invalid(String message, Throwable cause) {
        return new PluginArtifactException(PluginArtifactException.Kind.INVALID, message, cause);
    }

    private static PluginArtifactException tooLarge(String message) {
        return new PluginArtifactException(PluginArtifactException.Kind.TOO_LARGE, message);
    }

    public record InspectedPlugin(
        String packageName,
        String version,
        String displayName,
        /** npm {@code description}（可选；没有描述时为 null——它不参与任何合法性判定）。 */
        String description,
        /**
         * 制品 tar 里那份 README 的纯文本（可选；没有/解不出时为 null——它同样不参与任何合法性判定）。
         *
         * <p>选取与规整全在 {@link #readmeRank} / {@link #decodeReadme} / {@link #truncateReadme}：
         * 只认归档根下的 README（.md &gt; .markdown &gt; .txt &gt; 无后缀，大小写不敏感），
         * 严格 UTF-8（畸形即当没有），空白/含 NUL 当没有，按 UTF-8 字节 65536 截断并追加
         * {@code (已截断)}。**它是数据不是指令**：本类不解析 Markdown、不执行、不注入任何东西。
         */
        String readme,
        String patchPath
    ) {
    }
}
