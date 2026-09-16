/**
 * [INPUT]: 依赖 UsageAnalyticsStore、QuotaWindowCalculator 冻结时区、可信管理上下文与 ent:usage:read。
 * [OUTPUT]: 提供 GET `/enterprise/admin/v1/usage/analytics` 的时间范围聚合。
 * [POS]: quota/web 的只读分析入口；最长 180 天，不投影 prompt 或价格。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.quota.web;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.owndsh.enterprise.auth.web.EnterpriseRequestContext;
import com.owndsh.enterprise.auth.web.IdentityAdminRequestContextResolver;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.quota.application.QuotaWindowCalculator;
import com.owndsh.enterprise.quota.persistence.UsageAnalyticsStore;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

@RestController
@RequestMapping("/enterprise/admin/v1/usage/analytics")
public final class AdminUsageAnalyticsController {
    private static final Duration MAX_RANGE = Duration.ofDays(180);

    private final UsageAnalyticsStore analytics;
    private final QuotaWindowCalculator calculator;
    private final IdentityAdminRequestContextResolver contexts;

    public AdminUsageAnalyticsController(
        UsageAnalyticsStore analytics,
        QuotaWindowCalculator calculator,
        IdentityAdminRequestContextResolver contexts
    ) {
        this.analytics = Objects.requireNonNull(analytics, "analytics");
        this.calculator = Objects.requireNonNull(calculator, "calculator");
        this.contexts = Objects.requireNonNull(contexts, "contexts");
    }

    @GetMapping
    @SaCheckPermission("ent:usage:read")
    public EnterpriseResponse<UsageAnalyticsView> analyze(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) Long modelId,
        HttpServletRequest request
    ) {
        if (!from.isBefore(to)) throw new IllegalArgumentException("from 必须早于 to");
        if (Duration.between(from, to).compareTo(MAX_RANGE) > 0) {
            throw new IllegalArgumentException("分析窗口不能超过 180 天");
        }
        requirePositive(userId, "userId");
        requirePositive(modelId, "modelId");
        EnterpriseRequestContext context = contexts.resolve(request);
        String timezoneId = calculator.zone().getId();
        UsageAnalyticsStore.UsageAnalyticsResult result = analytics.analyze(
            context.tenantId(),
            new UsageAnalyticsStore.UsageAnalyticsQuery(from, to, userId, modelId, timezoneId)
        );
        return new EnterpriseResponse<>(
            UsageAnalyticsView.from(timezoneId, from, to, result),
            context.requestId()
        );
    }

    private static void requirePositive(Long value, String name) {
        if (value != null && value <= 0) throw new IllegalArgumentException(name + " 必须为正数");
    }
}
