/**
 * [INPUT]: 依赖 contracts/plugin-core-packages.json、application.yml、workspace 内 plugin/**\/package.json 与真实 PluginArtifactInspector/PluginTestArtifacts。
 * [OUTPUT]: 对外证明核心包真源无死名、服务端默认名单与真源逐字一致、每个核心包都被验包器拒绝、普通包不被该规则误杀。
 * [POS]: plugin 的跨端契约门禁，专门拦截 @owndsh→@dshent 这类 scope 改名后单侧漂移造成的保护静默失效。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import com.owndsh.enterprise.plugin.artifact.PluginArtifactException;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class PluginCorePackageContractTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Path CONTRACT_ROOT = findContractRoot();
    private static final String CORE_PACKAGES_FILE = "plugin-core-packages.json";
    private static final String APPLICATION_YML = "owndsh-server/src/main/resources/application.yml";
    /** 只捕获 `${ENT_PLUGIN_CORE_PACKAGES:` 与 plugin 块收尾 `}` 之间的纯内容，避免嵌套 `${}` 破坏匹配。 */
    private static final Pattern CORE_PACKAGES_BINDING = Pattern.compile(
        "\\$\\{ENT_PLUGIN_CORE_PACKAGES:([^}]*)\\}"
    );
    private static final Pattern PACKAGE_JSON_NAME = Pattern.compile("\"name\"\\s*:\\s*\"([^\"]+)\"");
    private static final String PROTECTED_REASON = "企业核心包不能通过通用插件分发";

    @TempDir
    Path temporary;

    @Test
    void everyDeclaredCorePackageExistsAsARealWorkspacePackage() throws Exception {
        Set<String> declared = declaredCorePackages();
        Set<String> real = workspacePackageNames();

        assertThat(declared)
            .as("""
                以下名字列在 contracts/%s 里，却在 plugin/**/package.json 中不存在。
                这几乎一定是 @owndsh→@dshent 这类包作用域改名后只改了单侧留下的陈旧名字：
                死名字不会报错，只会让服务端与自己那侧的保护门禁同时静默失效。
                修复方式是修正真源里的名字，绝不是在服务端补一份别名表。工作区真实包名：%s
                """.formatted(CORE_PACKAGES_FILE, real))
            .isSubsetOf(real);
    }

    @Test
    void applicationYmlDefaultMatchesTheCorePackageTruthSource() throws Exception {
        Set<String> fromContract = declaredCorePackages();
        Set<String> fromYaml = yamlCorePackages();

        assertThat(fromYaml)
            .as("""
                %s 中 enterprise.plugin.core-packages 的默认值必须与 contracts/%s 的 packages 数组逐字一致。
                两侧不一致意味着要么真源加了包而部署默认没保护，要么默认保护了真源没有的包。
                """.formatted(APPLICATION_YML, CORE_PACKAGES_FILE))
            .isEqualTo(fromContract);
    }

    @Test
    void rejectsEveryCorePackageThroughTheRealInspector() throws Exception {
        PluginArtifactInspector inspector = inspectorFedWith(declaredCorePackages());

        for (String corePackage : declaredCorePackages()) {
            Path archive = writeArchive(corePackage, "1.0.0");
            assertThatThrownBy(() -> inspector.inspect(archive))
                .as("核心包 %s 必须被验包器拒绝，否则它能作为第三方插件上传并覆盖企业安装在层拥有的产品代码", corePackage)
                .isInstanceOfSatisfying(PluginArtifactException.class, exception -> {
                    assertThat(exception.kind()).isEqualTo(PluginArtifactException.Kind.INVALID);
                    assertThat(exception).hasMessageContaining(PROTECTED_REASON);
                });
        }
    }

    @Test
    void doesNotRejectAnOrdinaryPackageForTheProtectedPackageReason() throws Exception {
        PluginArtifactInspector inspector = inspectorFedWith(declaredCorePackages());
        Path archive = writeArchive("dshent-plugin-example", "1.0.0");

        PluginArtifactInspector.InspectedPlugin inspected = inspector.inspect(archive);

        assertThat(inspected.packageName()).isEqualTo("dshent-plugin-example");
    }

    private static PluginArtifactInspector inspectorFedWith(Set<String> corePackages) {
        return new PluginArtifactInspector(JSON, 10_000_000L, 100, corePackages);
    }

    private Path writeArchive(String packageName, String version) throws Exception {
        Path archive = temporary.resolve(packageName.replace('/', '_') + "-" + version + ".tgz");
        Files.write(archive, PluginTestArtifacts.validArchive(packageName, version));
        return archive;
    }

    private static Set<String> declaredCorePackages() throws Exception {
        JsonNode root = JSON.readTree(Files.readString(
            CONTRACT_ROOT.resolve(CORE_PACKAGES_FILE)
        ));
        // 该文件同时有 description 与 packages 两个键，只取 packages 数组。
        JsonNode packages = root.get("packages");
        assertThat(packages).as("%s 必须包含 packages 数组".formatted(CORE_PACKAGES_FILE)).isNotNull();
        Set<String> names = new LinkedHashSet<>();
        for (JsonNode entry : packages) names.add(entry.stringValue());
        assertThat(names).as("核心包清单不能为空").isNotEmpty();
        return names;
    }

    private static Set<String> yamlCorePackages() throws Exception {
        Path applicationYml = CONTRACT_ROOT.resolve("../server").resolve(APPLICATION_YML).normalize();
        assertThat(applicationYml).as("找不到 %s".formatted(APPLICATION_YML)).exists();

        Matcher matcher = CORE_PACKAGES_BINDING.matcher(Files.readString(applicationYml));
        assertThat(matcher.find())
            .as("%s 必须为 enterprise.plugin.core-packages 提供 ${ENT_PLUGIN_CORE_PACKAGES:...} 环境绑定".formatted(APPLICATION_YML))
            .isTrue();
        String value = matcher.group(1).strip();
        assertThat(value).as("core-packages 默认值不能为空").isNotEmpty();

        Set<String> names = new LinkedHashSet<>();
        for (String name : value.split(",")) names.add(name.strip());
        return names;
    }

    private static Set<String> workspacePackageNames() throws Exception {
        Path pluginRoot = CONTRACT_ROOT.resolve("../plugin").normalize();
        Set<String> names = new LinkedHashSet<>();
        try (Stream<Path> paths = Files.walk(pluginRoot)) {
            List<Path> manifests = paths
                .filter(Files::isRegularFile)
                .filter(path -> "package.json".equals(path.getFileName().toString()))
                .filter(path -> !path.toString().contains("node_modules"))
                .sorted()
                .toList();
            for (Path manifest : manifests) {
                Matcher matcher = PACKAGE_JSON_NAME.matcher(Files.readString(manifest));
                if (matcher.find()) names.add(matcher.group(1));
            }
        }
        assertThat(names).as("未在 plugin/ 下发现任何 package.json name，契约根可能解析错误").isNotEmpty();
        return names;
    }

    /**
     * 与 T13ApiContractTest 相同的契约根解析方式：优先 maven 多模块根，否则从 basedir 回溯后端根，再取同级 contracts。
     */
    private static Path findContractRoot() {
        String multiModuleRoot = System.getProperty("maven.multiModuleProjectDirectory");
        Path backendRoot = multiModuleRoot == null
            ? Path.of(System.getProperty("basedir")).resolve("../..").normalize()
            : Path.of(multiModuleRoot);
        return backendRoot.resolve("../contracts").normalize();
    }
}
