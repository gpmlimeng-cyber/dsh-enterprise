/**
 * [INPUT]: 依赖真实 PluginArtifactInspector/PluginTestArtifacts（读归档根下的 README）、PluginViews/RuntimePluginAssignment/
 *          PluginVersion（线协议投影与聚合根第二道闸）与 Jackson 3 JsonMapper。
 * [OUTPUT]: 对外证明三件事——① **取哪份**：只认归档 `package/` 根下的主 README（.md &gt; .markdown &gt; .txt &gt; 无后缀，
 *          大小写不敏感，同一位次取文件名字典序最小者），嵌在子目录里的 README 不当候选；
 *          ② **怎么算没有**：缺失 / 非 UTF-8（畸形字节）/ 含 NUL（二进制）/ 纯空白一律当**没有 README**
 *          且**绝不因此拒包**，首选解码失败时退次选；
 *          ③ **限长**：按 UTF-8 字节 65536 在**码点边界**上截断并追加 `(已截断)`，字符数必然 ≤ 契约
 *          `PluginReadme.maxLength`；聚合根与视图两侧照 description 的先例各有第二道闸与「没值就整个键缺席」。
 * [POS]: 插件 README 从制品到线协议这条链的机械门禁（本机无 JDK，按静态核对；远程
 *         `cd server && ./mvnw -pl owndsh-modules/owndsh-enterprise -am test -Dgroups=dev` 复核）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import com.owndsh.enterprise.plugin.domain.PluginAssignment;
import com.owndsh.enterprise.plugin.domain.PluginCompatibility;
import com.owndsh.enterprise.plugin.domain.PluginVersion;
import com.owndsh.enterprise.plugin.domain.RuntimePluginAssignment;
import com.owndsh.enterprise.plugin.web.PluginViews;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class PluginReadmeTest {
    private static final String HARNESS_COMMIT = "99f6f02fecdb7dff40c3fbc9470f5907c29f74ca";
    private static final String SHA256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    /** 与契约 `PluginReadme` / 验包器同值的截断标记（本文件把它当**契约字面量**钉住）。 */
    private static final String TRUNCATED = "(已截断)";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    /** 真实上架制品（@furayoshi/dsh-ui-models-invert-selection）README 的开头那种形态：标题 + 空行 + 正文。 */
    private static final String README = "# Acme 工具箱\n\n把代码审查规则带进新会话。\n\n## 用法\n\n- 打开新会话\n";

    @TempDir
    Path temporary;

    private PluginArtifactInspector inspector() {
        return new PluginArtifactInspector(JSON, 10_000_000L, 100, Set.of("@dshent/core"));
    }

    /** 把一份「额外文件」字典打成 tgz 并**只**返回验包器解出的 README（没有就是 null）。 */
    private String inspectedReadme(Map<String, String> extras, String fileName) throws Exception {
        Path archive = temporary.resolve(fileName);
        Files.write(archive, PluginTestArtifacts.validArchiveWithFiles("dshent-plugin-readme", "1.0.0", extras));
        return inspector().inspect(archive).readme();
    }

    private String inspectedReadme(Map<String, String> extras) throws Exception {
        return inspectedReadme(extras, "readme-" + Math.abs(extras.hashCode()) + ".tgz");
    }

    @Test
    void readsTheMainReadmeAtTheArchiveRootAndRanksEveryRecognisedName() throws Exception {
        // ① 只有 README.md ⇒ 就是它（原样，含 Markdown 记号与换行：本层是数据搬运，不解析、不改写）。
        assertThat(inspectedReadme(Map.of("README.md", README))).isEqualTo(README);
        // ② 大小写与后缀都认：readme.md / Readme.MD / README.txt / README（无后缀）都读得到。
        assertThat(inspectedReadme(Map.of("readme.md", README))).isEqualTo(README);
        assertThat(inspectedReadme(Map.of("Readme.MD", README))).isEqualTo(README);
        assertThat(inspectedReadme(Map.of("README.txt", README))).isEqualTo(README);
        assertThat(inspectedReadme(Map.of("README", README))).isEqualTo(README);
        assertThat(inspectedReadme(Map.of("README.markdown", README))).isEqualTo(README);
        // ③ 多候选共存时的**优先级**：.md > .markdown > .txt > 无后缀 > （其它后缀不认）。
        LinkedHashMap<String, String> mixed = new LinkedHashMap<>();
        mixed.put("README", "no-extension");
        mixed.put("README.txt", "txt");
        mixed.put("README.markdown", "markdown");
        mixed.put("README.md", "md");
        assertThat(inspectedReadme(mixed)).isEqualTo("md");
        assertThat(inspectedReadme(Map.of("README", "no-extension", "README.txt", "txt"))).isEqualTo("txt");
        assertThat(inspectedReadme(Map.of("README", "no-extension", "readme.txt", "txt", "Readme.TXT", "TXT")))
            .isEqualTo("TXT");
        // ④ **只认归档根下那一份**：嵌在子目录里的 README 不是这个包的主 README，不当候选。
        assertThat(inspectedReadme(Map.of("docs/README.md", "嵌套", "lib/README.md", "嵌套"))).isNull();
        // ⑤ 不认的后缀（.rst / .html）一律不是候选——HTML 更是**绝不当 HTML 用**。
        assertThat(inspectedReadme(Map.of("README.rst", "rst", "README.html", "<b>html</b>"))).isNull();
    }

    @Test
    void treatsMissingNonUtf8BinaryAndBlankReadmesAsAbsentWithoutRejectingTheUpload() throws Exception {
        // ① 压根没有 README：null（不是空串）。
        assertThat(inspectedReadme(Map.of())).isNull();
        // ② 纯空白：没有（与 description 的宽松口径同款：不落库、不发线）。
        assertThat(inspectedReadme(Map.of("README.md", "   \n\t  "))).isNull();
        // ③ 非 UTF-8（非法字节序列）：**解不出就当没有**，而不是替换成 � 或把整包拒掉。
        Path broken = temporary.resolve("broken.tgz");
        Files.write(broken, PluginTestArtifacts.validArchiveWithRawFiles("dshent-plugin-readme", "1.0.0",
            Map.of("README.md", new byte[]{(byte) 0xC3, (byte) 0x28, (byte) 0xA0, (byte) 0xA1})));
        assertThat(inspector().inspect(broken).readme()).isNull();
        // ④ 含 NUL 的二进制内容：同样当没有（绝不把二进制塞进文本字段）。
        Path binary = temporary.resolve("binary.tgz");
        Files.write(binary, PluginTestArtifacts.validArchiveWithRawFiles("dshent-plugin-readme", "1.0.0",
            Map.of("README.md", new byte[]{'h', 'i', 0, 'x'})));
        assertThat(inspector().inspect(binary).readme()).isNull();
        // ⑤ 首选（README.md）解码失败时**退次选**（README.txt），而不是整个包就没有 README。
        Path fallback = temporary.resolve("fallback.tgz");
        Files.write(fallback, PluginTestArtifacts.validArchiveWithRawFiles("dshent-plugin-readme", "1.0.0",
            Map.of("README.md", new byte[]{(byte) 0xFF, (byte) 0xFE, (byte) 0x00}, "README.txt", "次选".getBytes(StandardCharsets.UTF_8))));
        assertThat(inspector().inspect(fallback).readme()).isEqualTo("次选");
    }

    @Test
    void truncatesToTheUtf8ByteBudgetOnACodePointBoundaryAndSaysSo() throws Exception {
        // ① 没超限：一个字节都不动（不 trim、不改写）。
        String small = "小说明书";
        assertThat(inspectedReadme(Map.of("README.md", small))).isEqualTo(small);
        // ② 正好 65536 字节：原样（边界之内）。
        String exact = "y".repeat(65_536);
        assertThat(inspectedReadme(Map.of("README.md", exact))).isEqualTo(exact);
        // ③ 超一个字节：截断到「预算 - 标记占的字节」，末尾追加标记，总字节数正好 65536。
        String overflow = "y".repeat(65_537);
        String cut = inspectedReadme(Map.of("README.md", overflow));
        assertThat(cut).endsWith(TRUNCATED);
        assertThat(cut.getBytes(StandardCharsets.UTF_8)).hasSize(PluginArtifactInspector.MAX_README_BYTES);
        // 标记占 11 个 UTF-8 字节（'(' 1 + 3 个汉字各 3 + ')' 1），故字符数 = 65525 + 5 = 65530。
        assertThat(cut).hasSize(65_530);
        // ④ 多字节内容：截断必须落在**码点边界**上——绝不切出半个汉字（否则线协议里就是非法 UTF-8）。
        String chinese = "汉".repeat(30_000);
        String cutChinese = inspectedReadme(Map.of("README.md", chinese));
        assertThat(cutChinese).endsWith(TRUNCATED);
        assertThat(cutChinese).hasSizeLessThanOrEqualTo(65_536);
        assertThat(cutChinese.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(65_536);
        // 大写：真的能按 UTF-8 编码回去（半个代理对会在这里炸或产出替换字符）。
        assertThat(new String(cutChinese.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8)).isEqualTo(cutChinese);
        assertThat(cutChinese.chars().anyMatch(value -> Character.isSurrogate((char) value))).isFalse();
        // ⑤ 远超「抓取护栏」（256KiB）的 README：照旧截断到同一个字节预算（内存护栏不改变业务上限）。
        String huge = "z".repeat(400_000);
        String cutHuge = inspectedReadme(Map.of("README.md", huge));
        assertThat(cutHuge).endsWith(TRUNCATED);
        assertThat(cutHuge.getBytes(StandardCharsets.UTF_8)).hasSize(PluginArtifactInspector.MAX_README_BYTES);
        // ⑥ 抓取护栏正好切在多字节字符中间：丢掉那半个字符后照旧解得出（不是「解不出」）。
        //    262143 个 'a' + 一个 3 字节汉字 = 262146 字节，护栏停在 262144（汉字的第 1 个字节）。
        String straddle = "a".repeat(262_143) + "汉";
        String cutStraddle = inspectedReadme(Map.of("README.md", straddle));
        assertThat(cutStraddle).endsWith(TRUNCATED);
        assertThat(cutStraddle.getBytes(StandardCharsets.UTF_8)).hasSize(PluginArtifactInspector.MAX_README_BYTES);
        // ⑦ 纯函数那一枚也直接钉一遍（同一条真源，不靠归档绕路）。
        assertThat(PluginArtifactInspector.truncateReadme("abc")).isEqualTo("abc");
        assertThat(PluginArtifactInspector.truncateReadme(overflow)).isEqualTo(cut);
    }

    @Test
    void omitsTheReadmeKeyWhenThereIsNoneAndKeepsItVerbatimWhenThereIsOne() {
        // 没有 README：视图里**整个 readme 键缺席**（契约与两端 strict Zod 都要求可选键缺席），
        // 而同一记录里「必需但可为 null」的 downloadUrl 照旧原样发出。
        RuntimePluginAssignment bare = runtimeAssignment(null, PluginAssignment.DesiredState.ABSENT);
        String bareJson = JSON.writeValueAsString(PluginViews.runtime(bare));
        assertThat(bareJson).doesNotContain("readme");
        assertThat(bareJson).contains("\"downloadUrl\":null");
        // 有 README：键出现且值**逐字相同**（Markdown 记号、换行原样照发）。
        RuntimePluginAssignment described = runtimeAssignment(README, PluginAssignment.DesiredState.INSTALLED);
        String describedJson = JSON.writeValueAsString(PluginViews.runtime(described));
        assertThat(describedJson).contains("\"readme\":");
        assertThat(JSON.readTree(describedJson).get("readme").asString()).isEqualTo(README);
        // 同一份领域事实也照旧过一遍 description（README 不挤掉它——回落链在**界面**那一侧）。
        assertThat(describedJson).contains("\"description\":\"把代码审查规则带进新会话。\"");
    }

    @Test
    void rejectsBlankOrOverLimitReadmesAtTheAggregateBoundary() {
        // 聚合根是第二道闸：绕过验包器的写入也不能落地违契约/空白的 README（字符数上界 = 65536）。
        assertThatThrownBy(() -> runtimeAssignment("   ", PluginAssignment.DesiredState.INSTALLED))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> runtimeAssignment("x".repeat(65_537), PluginAssignment.DesiredState.INSTALLED))
            .isInstanceOf(IllegalArgumentException.class);
        // 版本根同样有这道闸（README 是版本级事实）。
        assertThatThrownBy(() -> pluginVersion("x".repeat(65_537))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> pluginVersion("   ")).isInstanceOf(IllegalArgumentException.class);
        // 边界之内照收。
        assertThat(pluginVersion("x".repeat(65_536)).readme()).hasSize(65_536);
    }

    private static PluginVersion pluginVersion(String readme) {
        return new PluginVersion(
            1_901_300_000_000_000_701L, "000000", 1_901_300_000_000_000_501L, "@example/t13-tools", "1.0.0",
            "sha256/aa/" + SHA256 + ".tgz", readme, 4096L, SHA256, new byte[64],
            new PluginCompatibility(List.of(HARNESS_COMMIT), ">=0.1.0 <0.2.0", List.of("darwin", "linux")),
            PluginVersion.Status.PUBLISHED, 1L, java.time.Instant.parse("2026-08-19T03:00:00Z"), 0
        );
    }

    private static RuntimePluginAssignment runtimeAssignment(String readme, PluginAssignment.DesiredState state) {
        return new RuntimePluginAssignment(
            1_901_300_000_000_000_701L, "@example/t13-tools", "1.0.0", "T13 门禁工具箱",
            "把代码审查规则带进新会话。", readme, 4096L, SHA256, new byte[64],
            new PluginCompatibility(List.of(HARNESS_COMMIT), ">=0.1.0 <0.2.0", List.of("darwin", "linux")),
            false, state
        );
    }
}
