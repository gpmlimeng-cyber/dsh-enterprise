/**
 * [INPUT]: 依赖 BootstrapView.toSessionPolicy / from(snapshot, SessionPolicy)、空/带插件 snapshot 最小构造与 Jackson。
 * [OUTPUT]: 验证 sessionPolicy 投影来自部署参数而非写死字面量；并锁死 bootstrap 的插件分配投影与
 *          `/plugins/assignments` 同口径——displayName（**必填**，员工端卡片标题）与 description（可选，
 *          卡片第二行）服务端有值时必须**带上这两个键**（员工端本机目录 `GET /local/plugins` 的 catalog
 *          完全由这份 bootstrap 快照构建，漏在这里 = 标题只能拿包名顶、描述永远「暂无描述」），
 *          而没有 description 时必须**整个 description 键缺席**（契约 `PluginDescription` 可选，
 *          两端 strict Zod 都拒 null），displayName 则照旧必发（它不是可选键）。
 * [POS]: model/web 的轻量单测，不替代 T08 HTTP 契约；但它是 bootstrap 那套**独立于 PluginViews 的**
 *        逐字段投影唯一的机械门禁（RuntimeProjectionContractDriftTest 只覆盖 PluginViews 那一套）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.model.web;

import com.owndsh.enterprise.device.domain.DeviceStatus;
import com.owndsh.enterprise.device.domain.EnterpriseDevice;
import com.owndsh.enterprise.model.application.BootstrapService;
import com.owndsh.enterprise.model.application.BootstrapUser;
import com.owndsh.enterprise.plugin.application.EffectivePluginResolver;
import com.owndsh.enterprise.plugin.domain.PluginAssignment;
import com.owndsh.enterprise.plugin.domain.PluginCompatibility;
import com.owndsh.enterprise.plugin.domain.RuntimePluginAssignment;
import com.owndsh.enterprise.session.EnterpriseSessionProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class BootstrapViewSessionPolicyTest {
    @Test
    void mapsPropertiesIntoSessionPolicy() {
        EnterpriseSessionProperties properties = new EnterpriseSessionProperties();
        properties.setEnabled(true);
        properties.setRetentionDays(30);
        properties.setMaxBatchBytes(2_097_152);

        BootstrapView.SessionPolicy policy = BootstrapView.toSessionPolicy(properties);

        assertThat(policy.enabled()).isTrue();
        assertThat(policy.retentionDays()).isEqualTo(30);
        assertThat(policy.maxBatchBytes()).isEqualTo(2_097_152);
    }

    @Test
    void defaultsAnnounceSessionSyncDisabled() {
        BootstrapView.SessionPolicy policy = BootstrapView.toSessionPolicy(new EnterpriseSessionProperties());

        assertThat(policy.enabled()).isFalse();
        assertThat(policy.retentionDays()).isEqualTo(90);
        assertThat(policy.maxBatchBytes()).isEqualTo(1_048_576);
    }

    @Test
    void fromAttachesProvidedSessionPolicy() {
        BootstrapService.BootstrapSnapshot snapshot = new BootstrapService.BootstrapSnapshot(
            1,
            new BootstrapUser(1L, "u", "U", null),
            new EnterpriseDevice(
                2L, "t", 1L, "inst", "Dev", UUID.randomUUID(), "Desktop",
                "darwin-arm64", "0.1.0", "0.1.0", DeviceStatus.ACTIVE, Instant.now(), null, 0
            ),
            List.of(),
            List.of(),
            new EffectivePluginResolver.ResolvedAssignments(0, List.of())
        );
        EnterpriseSessionProperties properties = new EnterpriseSessionProperties();
        properties.setEnabled(true);

        BootstrapView view = BootstrapView.from(snapshot, properties);

        assertThat(view.sessionPolicy().enabled()).isTrue();
    }

    @Test
    void bootstrapPluginAssignmentCarriesDisplayNameAndDescriptionAndOmitsDescriptionWhenThereIsNone() {
        // 这里刻意给**具体**的 SessionPolicy 而不是 null：`from(snapshot, null)` 对两个重载
        // （EnterpriseSessionProperties / SessionPolicy）都是合法的，会直接编译失败。
        BootstrapView.SessionPolicy policy = new BootstrapView.SessionPolicy(false, 90, 1_048_576);
        // 有描述：bootstrap 投影必须发出 description 这个键、且值逐字相同（员工端 catalog 就从这里取值）。
        BootstrapView described = BootstrapView.from(snapshotWithAssignment("T13 门禁工具箱", "把代码审查规则带进新会话。"), policy);
        String describedJson = JSON.writeValueAsString(described.plugins());
        // ★本刀：displayName 是**必填**键——bootstrap 那套独立投影漏了它，员工端卡片标题就只能拿包名顶
        // （与 77cbb6c 的 description 漏键同形），故这里逐字锁住它。
        assertThat(describedJson).contains("\"displayName\":\"T13 门禁工具箱\"");
        assertThat(describedJson).contains("\"description\":\"把代码审查规则带进新会话。\"");
        assertThat(describedJson).contains("\"downloadUrl\":\"/enterprise/api/v1/plugins/versions/1901300000000000101/download\"");

        // 没有描述（域里是 null）：只有 description 整个键缺席，displayName **照旧必发**（它不是可选键）。
        BootstrapView bare = BootstrapView.from(snapshotWithAssignment("T13 门禁工具箱", null), policy);
        String bareJson = JSON.writeValueAsString(bare.plugins());
        assertThat(bareJson).doesNotContain("description");
        assertThat(bareJson).contains("\"displayName\":\"T13 门禁工具箱\"");
        assertThat(bareJson).contains("\"packageName\":\"@example/t13-tools\"");
    }

    private static BootstrapService.BootstrapSnapshot snapshotWithAssignment(String displayName, String description) {
        return new BootstrapService.BootstrapSnapshot(
            1,
            new BootstrapUser(1L, "u", "U", null),
            new EnterpriseDevice(
                2L, "t", 1L, "inst", "Dev", UUID.randomUUID(), "Desktop",
                "darwin-arm64", "0.1.0", "0.1.0", DeviceStatus.ACTIVE, Instant.now(), null, 0
            ),
            List.of(),
            List.of(),
            new EffectivePluginResolver.ResolvedAssignments(9, List.of(new RuntimePluginAssignment(
                1_901_300_000_000_000_101L, "@example/t13-tools", "1.0.0", displayName, description, null, 4096L,
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                new byte[64],
                new PluginCompatibility(
                    List.of("99f6f02fecdb7dff40c3fbc9470f5907c29f74ca"), ">=0.1.0 <0.2.0",
                    List.of("darwin", "linux")
                ),
                false, PluginAssignment.DesiredState.INSTALLED
            )))
        );
    }

    private static final JsonMapper JSON = JsonMapper.builder().build();
}
