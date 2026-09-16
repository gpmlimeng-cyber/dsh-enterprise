/**
 * [INPUT]: 依赖 BootstrapView.toSessionPolicy / from(snapshot, SessionPolicy) 与空 snapshot 最小构造。
 * [OUTPUT]: 验证 sessionPolicy 投影来自部署参数而非写死字面量。
 * [POS]: model/web 的轻量单测，不替代 T08 HTTP 契约。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.model.web;

import com.owndsh.enterprise.device.domain.DeviceStatus;
import com.owndsh.enterprise.device.domain.EnterpriseDevice;
import com.owndsh.enterprise.model.application.BootstrapService;
import com.owndsh.enterprise.model.application.BootstrapUser;
import com.owndsh.enterprise.plugin.application.EffectivePluginResolver;
import com.owndsh.enterprise.session.EnterpriseSessionProperties;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

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
                2L, "t", 1L, "inst", "Dev", "inst-id", "Desktop",
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
}
