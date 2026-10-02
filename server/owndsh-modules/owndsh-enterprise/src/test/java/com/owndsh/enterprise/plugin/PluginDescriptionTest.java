/**
 * [INPUT]: 依赖真实 PluginArtifactInspector/PluginTestArtifacts（读 package.json 的 description）、
 *          PluginViews/PluginPackage/RuntimePluginAssignment（线协议投影）与 Jackson 3 JsonMapper。
 * [OUTPUT]: 对外证明两件事——① **读入**：验包器只把「非空、无 NUL、≤1000」的 description 当描述，
 *          其余形态（缺席 / null / 空串 / 纯空白 / 非字符串 / 超长）一律按**没有描述**处理且**绝不因此拒包**
 *          （描述不是制品的合法性要件）；② **投影**：没有描述时视图里**整个 description 键缺席**
 *          （契约与两端 strict Zod 都要求可选键缺席，绝不发 null），而同一记录里「必需但可为 null」的
 *          `downloadUrl` 照旧原样发出；聚合根对空白/超长描述仍有第二道闸。
 * [POS]: 插件描述从制品到线协议这条链的机械门禁（本机无 JDK，按静态核对；远程
 *         `cd server && ./mvnw -pl owndsh-modules/owndsh-enterprise -am test -Dgroups=dev` 复核）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import com.owndsh.enterprise.plugin.application.PluginCatalogService;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import com.owndsh.enterprise.plugin.domain.PluginAssignment;
import com.owndsh.enterprise.plugin.domain.PluginCompatibility;
import com.owndsh.enterprise.plugin.domain.PluginPackage;
import com.owndsh.enterprise.plugin.domain.RuntimePluginAssignment;
import com.owndsh.enterprise.plugin.web.PluginViews;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class PluginDescriptionTest {
    private static final String HARNESS_COMMIT = "99f6f02fecdb7dff40c3fbc9470f5907c29f74ca";
    private static final String SHA256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String DESCRIPTION = "把代码审查规则带进新会话。";
    /**
     * 真实上架制品（@mengli114/dsh-settings-nav-collapse）的 package.json 描述，长度按码点 = 347。
     * 旧的 300 上限让它在**上传那一刻**就被验包器归一成 null（库里一直是 NULL），
     * 所以它既是「上限太小」的实证，也是 V41 回填的那条真值。
     */
    private static final String REAL_347 =
        "DSH web client plugin: one toggle in the settings panel header collapses the settings navigation"
            + " column into a narrow icon rail, so the settings content keeps a readable width on phones"
            + " and other narrow viewports. The panel is located at runtime from the plugin's own node"
            + " (no package-internal attribute), and the choice is remembered per browser.";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @TempDir
    Path temporary;

    private String inspectedDescription(String descriptionJson) throws Exception {
        Path archive = temporary.resolve("described-" + Math.abs(String.valueOf(descriptionJson).hashCode()) + ".tgz");
        Files.write(archive, PluginTestArtifacts.validArchiveWithDescription(
            "dshent-plugin-described", "1.0.0", descriptionJson
        ));
        PluginArtifactInspector inspector = new PluginArtifactInspector(JSON, 10_000_000L, 100, Set.of("@dshent/core"));
        return inspector.inspect(archive).description();
    }

    @Test
    void readsThePackageDescriptionAndTreatsEveryMissingFormAsAbsentWithoutRejectingTheUpload() throws Exception {
        // 有描述：原样读出来（不改写、不截断）。
        assertThat(inspectedDescription('"' + DESCRIPTION + '"')).isEqualTo(DESCRIPTION);
        // 边界：正好 1000 字照收（与契约 PluginDescription.maxLength 同值；V41 由 300 提到 1000）。
        assertThat(inspectedDescription('"' + "y".repeat(1000) + '"')).hasSize(1000);
        // 真实上架制品的那条 347 字符描述（@mengli114/dsh-settings-nav-collapse 的 package.json）：
        // 旧的 300 上限让它在**上传那一刻**就被归一成 null（库里一直是 NULL），这条锁死它今后照收。
        assertThat(inspectedDescription('"' + REAL_347 + '"')).hasSize(347);
        // 逐条「没有描述」形态：缺席 / null / 空串 / 纯空白 / 数字 / 超长（1001）——一律 null，且都不拒包。
        assertThat(inspectedDescription(null)).isNull();
        assertThat(inspectedDescription("null")).isNull();
        assertThat(inspectedDescription("\"\"")).isNull();
        assertThat(inspectedDescription("\"   \"")).isNull();
        assertThat(inspectedDescription("7")).isNull();
        assertThat(inspectedDescription('"' + "x".repeat(1001) + '"')).isNull();
    }

    @Test
    void omitsTheDescriptionKeyWhenThereIsNoDescriptionButKeepsRequiredNullableDownloadUrl() {
        // 没有描述、且方向是 ABSENT（downloadUrl 必为 null）：description 键必须缺席，downloadUrl 必须**仍在**。
        RuntimePluginAssignment absent = runtimeAssignment(null, PluginAssignment.DesiredState.ABSENT);
        String absentJson = JSON.writeValueAsString(PluginViews.runtime(absent));
        assertThat(absentJson).doesNotContain("description");
        assertThat(absentJson).contains("\"downloadUrl\":null");

        // 有描述：键出现且值逐字相同（中文字面量照发）。
        RuntimePluginAssignment described = runtimeAssignment(DESCRIPTION, PluginAssignment.DesiredState.INSTALLED);
        String describedJson = JSON.writeValueAsString(PluginViews.runtime(described));
        assertThat(describedJson).contains("\"description\":\"" + DESCRIPTION + "\"");

        // 管理端 package 视图同口径：没有描述时整个键缺席，displayName 照旧。
        String bareJson = JSON.writeValueAsString(PluginViews.packageView(
            new PluginCatalogService.CatalogItem(pluginPackage(null), List.of(), List.of())
        ));
        assertThat(bareJson).doesNotContain("description");
        assertThat(bareJson).contains("\"displayName\":\"T13 Test Plugin\"");

        String describedPackageJson = JSON.writeValueAsString(PluginViews.packageView(
            new PluginCatalogService.CatalogItem(pluginPackage(DESCRIPTION), List.of(), List.of())
        ));
        assertThat(describedPackageJson).contains("\"description\":\"" + DESCRIPTION + "\"");
    }

    @Test
    void rejectsBlankOrOverLimitDescriptionsAtTheAggregateBoundary() {
        // 聚合根是第二道闸：绕过验包器的写入也不能落地违契约/空白描述（上界跟契约 = 1000）。
        assertThatThrownBy(() -> pluginPackage("   ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> pluginPackage("x".repeat(1001))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> runtimeAssignment("   ", PluginAssignment.DesiredState.INSTALLED))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> runtimeAssignment("x".repeat(1001), PluginAssignment.DesiredState.INSTALLED))
            .isInstanceOf(IllegalArgumentException.class);
    }

    private static PluginPackage pluginPackage(String description) {
        return new PluginPackage(
            1_901_300_000_000_000_501L, "000000", "@example/t13-tools", "T13 Test Plugin",
            description, PluginPackage.Status.ACTIVE, 0
        );
    }

    private static RuntimePluginAssignment runtimeAssignment(String description, PluginAssignment.DesiredState state) {
        return new RuntimePluginAssignment(
            1_901_300_000_000_000_601L, "@example/t13-tools", "1.0.0", description, 4096L, SHA256,
            new byte[64],
            new PluginCompatibility(List.of(HARNESS_COMMIT), ">=0.1.0 <0.2.0", List.of("darwin", "linux")),
            false, state
        );
    }
}
