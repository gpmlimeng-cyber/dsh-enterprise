/**
 * [INPUT]: 依赖 ent_usage_ledger 索引与部署时区自然日分桶的固定 SQL。
 * [OUTPUT]: 实现按日/模型/成员的 prompt-free 聚合，并把实测 Token 与配额扣额分开。
 * [POS]: quota/persistence 的 PostgreSQL 分析 adapter，筛选参数白名单绑定。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.quota.persistence;

import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.jdbc.core.RowMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class JdbcUsageAnalyticsStore implements UsageAnalyticsStore {
    private static final RowMapper<DayRow> DAY = (rs, i) -> new DayRow(
        rs.getString("bucket_date"),
        rs.getLong("requests"), rs.getLong("input_tokens"), rs.getLong("output_tokens"),
        rs.getLong("cache_tokens"), rs.getLong("total_tokens"), rs.getLong("charged_tokens")
    );
    private static final RowMapper<ModelRowSql> MODEL = (rs, i) -> new ModelRowSql(
        rs.getLong("model_id"), rs.getString("alias"), rs.getString("display_name"),
        rs.getLong("requests"), rs.getLong("input_tokens"), rs.getLong("output_tokens"),
        rs.getLong("cache_tokens"), rs.getLong("total_tokens"), rs.getLong("charged_tokens")
    );
    private static final RowMapper<MemberRowSql> MEMBER = (rs, i) -> new MemberRowSql(
        rs.getLong("user_id"), rs.getString("username"), rs.getString("display_name"),
        rs.getLong("requests"), rs.getLong("input_tokens"), rs.getLong("output_tokens"),
        rs.getLong("cache_tokens"), rs.getLong("total_tokens"), rs.getLong("charged_tokens")
    );

    private final JdbcOperations jdbc;

    public JdbcUsageAnalyticsStore(JdbcOperations jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Override
    public UsageAnalyticsResult analyze(String tenantId, UsageAnalyticsQuery query) {
        ZoneId zone = ZoneId.of(query.timezoneId());
        Filter filter = filter(tenantId, query);

        SummaryRow summaryRow = Objects.requireNonNull(jdbc.queryForObject("""
            select count(*) as requests,
                   coalesce(sum(l.input_tokens), 0) as input_tokens,
                   coalesce(sum(l.output_tokens), 0) as output_tokens,
                   coalesce(sum(l.cache_tokens), 0) as cache_tokens,
                   coalesce(sum(l.total_tokens), 0) as total_tokens,
                   coalesce(sum(l.charged_tokens), 0) as charged_tokens,
                   count(*) filter (where l.result = 'SETTLED') as settled,
                   count(*) filter (where l.result = 'CHARGED_MAX') as charged_max,
                   count(*) filter (where l.result = 'CHARGED_MAX' and l.total_tokens = 0) as unmeasured
              from ent_usage_ledger l
            """ + filter.where,
            (rs, i) -> new SummaryRow(
                new TokenBucket(
                    rs.getLong("requests"), rs.getLong("input_tokens"), rs.getLong("output_tokens"),
                    rs.getLong("cache_tokens"), rs.getLong("total_tokens"), rs.getLong("charged_tokens")
                ),
                rs.getLong("settled"), rs.getLong("charged_max"), rs.getLong("unmeasured")
            ),
            filter.arguments.toArray()
        ));

        Map<String, TokenBucket> byDayMap = new LinkedHashMap<>();
        LocalDate start = query.from().atZone(zone).toLocalDate();
        LocalDate endExclusive = query.to().atZone(zone).toLocalDate();
        for (LocalDate date = start; date.isBefore(endExclusive); date = date.plusDays(1)) {
            byDayMap.put(date.toString(), TokenBucket.zero());
        }
        List<DayRow> dayRows = jdbc.query("""
            select to_char(l.created_at at time zone 'UTC' at time zone ?, 'YYYY-MM-DD') as bucket_date,
                   count(*) as requests,
                   coalesce(sum(l.input_tokens), 0) as input_tokens,
                   coalesce(sum(l.output_tokens), 0) as output_tokens,
                   coalesce(sum(l.cache_tokens), 0) as cache_tokens,
                   coalesce(sum(l.total_tokens), 0) as total_tokens,
                   coalesce(sum(l.charged_tokens), 0) as charged_tokens
              from ent_usage_ledger l
            """ + filter.where + """
             group by 1
             order by 1
            """,
            DAY,
            prepend(query.timezoneId(), filter.arguments)
        );
        for (DayRow row : dayRows) {
            byDayMap.put(row.date(), row.bucket());
        }
        List<DayPoint> byDay = byDayMap.entrySet().stream()
            .map(entry -> new DayPoint(entry.getKey(), entry.getValue()))
            .toList();

        List<ModelRow> byModel = jdbc.query("""
            select l.model_id,
                   m.alias,
                   m.display_name,
                   count(*) as requests,
                   coalesce(sum(l.input_tokens), 0) as input_tokens,
                   coalesce(sum(l.output_tokens), 0) as output_tokens,
                   coalesce(sum(l.cache_tokens), 0) as cache_tokens,
                   coalesce(sum(l.total_tokens), 0) as total_tokens,
                   coalesce(sum(l.charged_tokens), 0) as charged_tokens
              from ent_usage_ledger l
              join ent_managed_model m on m.id = l.model_id and m.tenant_id = l.tenant_id
            """ + filter.where + """
             group by l.model_id, m.alias, m.display_name
             order by sum(l.total_tokens) desc, l.model_id
             limit ?
            """,
            MODEL,
            append(filter.arguments, MAX_DIMENSION_ROWS + 1)
        ).stream().map(row -> new ModelRow(row.modelId(), row.alias(), row.displayName(), row.bucket())).toList();

        List<MemberRow> byMember = jdbc.query("""
            select l.user_id,
                   u.user_name as username,
                   u.nick_name as display_name,
                   count(*) as requests,
                   coalesce(sum(l.input_tokens), 0) as input_tokens,
                   coalesce(sum(l.output_tokens), 0) as output_tokens,
                   coalesce(sum(l.cache_tokens), 0) as cache_tokens,
                   coalesce(sum(l.total_tokens), 0) as total_tokens,
                   coalesce(sum(l.charged_tokens), 0) as charged_tokens
              from ent_usage_ledger l
              join sys_user u on u.user_id = l.user_id
            """ + filter.where + """
             group by l.user_id, u.user_name, u.nick_name
             order by sum(l.total_tokens) desc, l.user_id
             limit ?
            """,
            MEMBER,
            append(filter.arguments, MAX_DIMENSION_ROWS + 1)
        ).stream().map(row -> new MemberRow(row.userId(), row.username(), row.displayName(), row.bucket())).toList();

        boolean truncated = byModel.size() > MAX_DIMENSION_ROWS || byMember.size() > MAX_DIMENSION_ROWS;
        List<ModelRow> models = byModel.size() > MAX_DIMENSION_ROWS ? byModel.subList(0, MAX_DIMENSION_ROWS) : byModel;
        List<MemberRow> members = byMember.size() > MAX_DIMENSION_ROWS
            ? byMember.subList(0, MAX_DIMENSION_ROWS)
            : byMember;

        return new UsageAnalyticsResult(
            summaryRow.bucket(), summaryRow.settled(), summaryRow.chargedMax(), summaryRow.unmeasured(),
            byDay, models, members, truncated
        );
    }

    private static Filter filter(String tenantId, UsageAnalyticsQuery query) {
        StringBuilder where = new StringBuilder(" where l.tenant_id = ? and l.created_at >= ? and l.created_at < ?");
        List<Object> arguments = new ArrayList<>();
        arguments.add(tenantId);
        arguments.add(Timestamp.from(query.from()));
        arguments.add(Timestamp.from(query.to()));
        if (query.userId() != null) {
            where.append(" and l.user_id = ?");
            arguments.add(query.userId());
        }
        if (query.modelId() != null) {
            where.append(" and l.model_id = ?");
            arguments.add(query.modelId());
        }
        return new Filter(where.toString(), arguments);
    }

    private static Object[] prepend(Object head, List<Object> rest) {
        List<Object> values = new ArrayList<>(rest.size() + 1);
        values.add(head);
        values.addAll(rest);
        return values.toArray();
    }

    private static Object[] append(List<Object> values, Object tail) {
        List<Object> next = new ArrayList<>(values.size() + 1);
        next.addAll(values);
        next.add(tail);
        return next.toArray();
    }

    private record Filter(String where, List<Object> arguments) {
    }

    private record SummaryRow(TokenBucket bucket, long settled, long chargedMax, long unmeasured) {
    }

    private record DayRow(String date, long requests, long inputTokens, long outputTokens, long cacheTokens,
                          long totalTokens, long chargedTokens) {
        TokenBucket bucket() {
            return new TokenBucket(requests, inputTokens, outputTokens, cacheTokens, totalTokens, chargedTokens);
        }
    }

    private record ModelRowSql(long modelId, String alias, String displayName, long requests, long inputTokens,
                               long outputTokens, long cacheTokens, long totalTokens, long chargedTokens) {
        TokenBucket bucket() {
            return new TokenBucket(requests, inputTokens, outputTokens, cacheTokens, totalTokens, chargedTokens);
        }
    }

    private record MemberRowSql(long userId, String username, String displayName, long requests, long inputTokens,
                                long outputTokens, long cacheTokens, long totalTokens, long chargedTokens) {
        TokenBucket bucket() {
            return new TokenBucket(requests, inputTokens, outputTokens, cacheTokens, totalTokens, chargedTokens);
        }
    }
}
