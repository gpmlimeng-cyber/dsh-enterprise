/**
 * [INPUT]: 投影 UsageAnalyticsStore 聚合结果与冻结部署时区。
 * [OUTPUT]: 提供 OpenAPI UsageAnalyticsData：摘要、连续日序列、模型/成员分解与截断标记。
 * [POS]: quota/web 的分析响应边界；缓存命中率仅由 cache/(input+cache) 推导，无价格字段。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.quota.web;

import com.owndsh.enterprise.quota.persistence.UsageAnalyticsStore;

import java.time.Instant;
import java.util.List;

public record UsageAnalyticsView(
    String timezone,
    Instant from,
    Instant to,
    Summary summary,
    List<DayPoint> byDay,
    List<ModelRow> byModel,
    List<MemberRow> byMember,
    boolean truncated
) {
    public record Summary(
        long requests,
        long settled,
        long chargedMax,
        long unmeasured,
        long inputTokens,
        long outputTokens,
        long cacheTokens,
        long totalTokens,
        long chargedTokens,
        Double cacheHitRatio
    ) {
    }

    public record DayPoint(
        String date,
        long requests,
        long inputTokens,
        long outputTokens,
        long cacheTokens,
        long totalTokens,
        long chargedTokens
    ) {
    }

    public record ModelRow(
        long modelId,
        String alias,
        String displayName,
        long requests,
        long inputTokens,
        long outputTokens,
        long cacheTokens,
        long totalTokens,
        long chargedTokens,
        Double cacheHitRatio
    ) {
    }

    public record MemberRow(
        long userId,
        String username,
        String displayName,
        long requests,
        long inputTokens,
        long outputTokens,
        long cacheTokens,
        long totalTokens,
        long chargedTokens
    ) {
    }

    public static UsageAnalyticsView from(
        String timezone,
        Instant from,
        Instant to,
        UsageAnalyticsStore.UsageAnalyticsResult result
    ) {
        UsageAnalyticsStore.TokenBucket summaryBucket = result.summary();
        List<DayPoint> byDay = result.byDay().stream()
            .map(point -> new DayPoint(
                point.date(),
                point.bucket().requests(),
                point.bucket().inputTokens(),
                point.bucket().outputTokens(),
                point.bucket().cacheTokens(),
                point.bucket().totalTokens(),
                point.bucket().chargedTokens()
            ))
            .toList();
        List<ModelRow> byModel = result.byModel().stream()
            .map(row -> new ModelRow(
                row.modelId(),
                row.alias(),
                row.displayName(),
                row.bucket().requests(),
                row.bucket().inputTokens(),
                row.bucket().outputTokens(),
                row.bucket().cacheTokens(),
                row.bucket().totalTokens(),
                row.bucket().chargedTokens(),
                cacheHitRatio(row.bucket().inputTokens(), row.bucket().cacheTokens())
            ))
            .toList();
        List<MemberRow> byMember = result.byMember().stream()
            .map(row -> new MemberRow(
                row.userId(),
                row.username(),
                row.displayName(),
                row.bucket().requests(),
                row.bucket().inputTokens(),
                row.bucket().outputTokens(),
                row.bucket().cacheTokens(),
                row.bucket().totalTokens(),
                row.bucket().chargedTokens()
            ))
            .toList();
        return new UsageAnalyticsView(
            timezone,
            from,
            to,
            new Summary(
                summaryBucket.requests(),
                result.settled(),
                result.chargedMax(),
                result.unmeasured(),
                summaryBucket.inputTokens(),
                summaryBucket.outputTokens(),
                summaryBucket.cacheTokens(),
                summaryBucket.totalTokens(),
                summaryBucket.chargedTokens(),
                cacheHitRatio(summaryBucket.inputTokens(), summaryBucket.cacheTokens())
            ),
            byDay,
            byModel,
            byMember,
            result.truncated()
        );
    }

    private static Double cacheHitRatio(long inputTokens, long cacheTokens) {
        long denominator = inputTokens + cacheTokens;
        if (denominator <= 0) return null;
        return (double) cacheTokens / (double) denominator;
    }
}
