/**
 * [INPUT]: 依赖 AdminUsageAnalyticsController 的窗口边界与 QuotaWindowCalculator 冻结时区。
 * [OUTPUT]: 锁定 180 天上限与 from/to 顺序校验发生在认证上下文解析之前。
 * [POS]: quota/web 分析入口的边界单元验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.quota.web;

import com.owndsh.enterprise.quota.application.QuotaWindowCalculator;
import com.owndsh.enterprise.quota.persistence.UsageAnalyticsStore;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

@Tag("dev")
class AdminUsageAnalyticsControllerTest {
    @Test
    void rejectsInvertedRangeAndOverlongWindow() {
        UsageAnalyticsStore store = mock(UsageAnalyticsStore.class);
        QuotaWindowCalculator calculator = new QuotaWindowCalculator(ZoneOffset.ofHours(8));
        AdminUsageAnalyticsController controller = new AdminUsageAnalyticsController(
            store, calculator, mock(com.owndsh.enterprise.auth.web.IdentityAdminRequestContextResolver.class)
        );
        Instant from = Instant.parse("2026-09-01T00:00:00Z");
        assertThatThrownBy(() -> controller.analyze(from, from, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("from 必须早于 to");
        assertThatThrownBy(() -> controller.analyze(from, from.plusSeconds(181L * 24 * 3600), null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("180");
    }
}
