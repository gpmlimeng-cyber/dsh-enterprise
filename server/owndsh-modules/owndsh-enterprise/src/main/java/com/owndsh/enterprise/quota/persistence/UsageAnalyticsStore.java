/**
 * [INPUT]: 依赖部署时区冻结的 ledger 时间范围与可选成员/模型筛选。
 * [OUTPUT]: 对外提供按自然日/模型/成员聚合的 prompt-free 用量分析结果。
 * [POS]: quota/persistence 的只读分析端口，不写 ledger 也不投影 prompt。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.quota.persistence;

import java.time.Instant;
import java.util.List;

public interface UsageAnalyticsStore {
    int MAX_DIMENSION_ROWS = 50;

    UsageAnalyticsResult analyze(String tenantId, UsageAnalyticsQuery query);

    record UsageAnalyticsQuery(
        Instant from,
        Instant to,
        Long userId,
        Long modelId,
        String timezoneId
    ) {
        public UsageAnalyticsQuery {
            if (from == null || to == null || !from.isBefore(to)) {
                throw new IllegalArgumentException("from 必须早于 to");
            }
            if (timezoneId == null || timezoneId.isBlank()) {
                throw new IllegalArgumentException("timezoneId 必填");
            }
        }
    }

    record TokenBucket(
        long requests,
        long inputTokens,
        long outputTokens,
        long cacheTokens,
        long totalTokens,
        long chargedTokens
    ) {
        public static TokenBucket zero() {
            return new TokenBucket(0, 0, 0, 0, 0, 0);
        }
    }

    record DayPoint(String date, TokenBucket bucket) {
    }

    record ModelRow(long modelId, String alias, String displayName, TokenBucket bucket) {
    }

    record MemberRow(long userId, String username, String displayName, TokenBucket bucket) {
    }

    record UsageAnalyticsResult(
        TokenBucket summary,
        long settled,
        long chargedMax,
        long unmeasured,
        List<DayPoint> byDay,
        List<ModelRow> byModel,
        List<MemberRow> byMember,
        boolean truncated
    ) {
    }
}
