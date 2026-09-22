/**
 * [INPUT]: 依赖 PluginRuntimeService 的 operation→resourceType 纯映射与 PluginAuditMetadata.Operation 枚举真源。
 * [OUTPUT]: 验证 INVENTORY=DEVICE、DOWNLOAD=PLUGIN_VERSION，且全部 Operation 常量取值范围非空、可枚举、无漏项。
 * [POS]: plugin/application 的审计资源类型门禁，纯 JVM 运行，不依赖 PostgreSQL、容器或 Spring 上下文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.application;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class PluginAuditResourceTypeTest {

    /** 现有审计词表真源：device/application 用 DEVICE，plugin/preset catalog 用 *_VERSION / *_PACKAGE。 */
    private static final Set<String> KNOWN_RESOURCE_TYPES =
        Set.of("DEVICE", "PLUGIN_VERSION", "PLUGIN_PACKAGE", "PRESET_VERSION", "PRESET_PACKAGE");

    /** 逐 operation 断言内容，而不是数量；新常量必须在此显式表态。 */
    private static final Map<PluginAuditMetadata.Operation, String> EXPECTED = Map.of(
        PluginAuditMetadata.Operation.UPLOAD, "PLUGIN_VERSION",
        PluginAuditMetadata.Operation.PUBLISH, "PLUGIN_VERSION",
        PluginAuditMetadata.Operation.RETIRE, "PLUGIN_VERSION",
        PluginAuditMetadata.Operation.ASSIGN, "PLUGIN_PACKAGE",
        PluginAuditMetadata.Operation.DOWNLOAD, "PLUGIN_VERSION",
        PluginAuditMetadata.Operation.INVENTORY, "DEVICE"
    );

    @Test
    void mapsInventoryToDeviceAndDownloadToPluginVersion() {
        assertThat(PluginRuntimeService.resourceTypeFor(PluginAuditMetadata.Operation.INVENTORY))
            .isEqualTo("DEVICE");
        assertThat(PluginRuntimeService.resourceTypeFor(PluginAuditMetadata.Operation.DOWNLOAD))
            .isEqualTo("PLUGIN_VERSION");
    }

    @Test
    void mapsEveryOperationToANonBlankKnownResourceType() {
        for (PluginAuditMetadata.Operation operation : PluginAuditMetadata.Operation.values()) {
            String resourceType = PluginRuntimeService.resourceTypeFor(operation);
            assertThat(resourceType)
                .as("operation %s 的 resourceType 不能为空", operation)
                .isNotNull()
                .isNotBlank();
            assertThat(resourceType)
                .as("operation %s 的 resourceType 必须复用现有审计词表", operation)
                .isIn(KNOWN_RESOURCE_TYPES);
        }
    }

    @Test
    void coversEveryOperationConstantWithoutGaps() {
        EnumSet<PluginAuditMetadata.Operation> handled = EnumSet.noneOf(PluginAuditMetadata.Operation.class);
        for (PluginAuditMetadata.Operation operation : PluginAuditMetadata.Operation.values()) {
            // 调用即代表该常量被映射覆盖；未覆盖的常量会在上面抛错或落空。
            PluginRuntimeService.resourceTypeFor(operation);
            handled.add(operation);
        }
        assertThat(handled)
            .as("resourceType 映射必须覆盖 Operation.values() 全集")
            .containsExactlyInAnyOrderElementsOf(Arrays.asList(PluginAuditMetadata.Operation.values()));
        assertThat(EXPECTED.keySet())
            .as("测试期望表必须与 Operation 枚举同步")
            .containsExactlyInAnyOrderElementsOf(Arrays.asList(PluginAuditMetadata.Operation.values()));
    }

    @Test
    void failsOnNullOperationInsteadOfReturningASilentDefault() {
        assertThat(org.assertj.core.api.Assertions
            .catchThrowable(() -> PluginRuntimeService.resourceTypeFor(null)))
            .isInstanceOf(NullPointerException.class);
    }
}
