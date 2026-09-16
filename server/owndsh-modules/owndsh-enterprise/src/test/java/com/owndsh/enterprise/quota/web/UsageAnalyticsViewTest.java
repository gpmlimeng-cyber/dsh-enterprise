/**
 * [INPUT]: 依赖 UsageAnalyticsView 投影与 UsageAnalyticsStore 结果构造。
 * [OUTPUT]: 锁定缓存命中率空分母为 null，以及未知扣额不混入实测 Token。
 * [POS]: quota/web 分析投影的纯单元验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.quota.web;

import com.owndsh.enterprise.quota.persistence.UsageAnalyticsStore;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class UsageAnalyticsViewTest {
    @Test
    void cacheHitRatioIsNullWhenDenominatorIsZero() {
        UsageAnalyticsView view = UsageAnalyticsView.from(
            "Asia/Shanghai",
            Instant.parse("2026-09-01T00:00:00Z"),
            Instant.parse("2026-09-02T00:00:00Z"),
            new UsageAnalyticsStore.UsageAnalyticsResult(
                new UsageAnalyticsStore.TokenBucket(1, 0, 0, 0, 0, 640),
                0, 1, 1, List.of(), List.of(), List.of(), false
            )
        );
        assertThat(view.summary().cacheHitRatio()).isNull();
        assertThat(view.summary().unmeasured()).isEqualTo(1);
        assertThat(view.summary().chargedTokens()).isEqualTo(640);
        assertThat(view.summary().inputTokens()).isZero();
    }

    @Test
    void cacheHitRatioUsesInputPlusCacheDenominator() {
        UsageAnalyticsView view = UsageAnalyticsView.from(
            "Asia/Shanghai",
            Instant.parse("2026-09-01T00:00:00Z"),
            Instant.parse("2026-09-02T00:00:00Z"),
            new UsageAnalyticsStore.UsageAnalyticsResult(
                new UsageAnalyticsStore.TokenBucket(1, 3, 1, 1, 5, 5),
                1, 0, 0, List.of(), List.of(), List.of(), false
            )
        );
        assertThat(view.summary().cacheHitRatio()).isCloseTo(0.25, withinTolerance());
    }

    private static org.assertj.core.data.Offset<Double> withinTolerance() {
        return org.assertj.core.data.Offset.offset(1e-9);
    }
}
