/**
 * [INPUT]: 依赖 V44 的 ent_connector 列族（jsonb 三列以**正文**形式承载，序列化在 persistence 层）。
 * [OUTPUT]: 提供不可变的连接器条目，含状态/传输两个封闭集合与 JDBC 行的形状不变式。
 * [POS]: connector/domain 的账本事实，**不含**任何凭据值（descriptor 里只允许引用）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.domain;

import java.time.Instant;
import java.util.Objects;

/**
 * 一条企业级连接（"已接好的系统"的管理侧事实）。
 *
 * ★ 三列 jsonb 在域对象里保持**正文**形态（`descriptorJson` 等）：解析与校验归
 * `application/ConnectorDescriptorGate`，域对象只负责"这一行长什么样"。这样做的理由与
 * `JdbcPresetStore` 把 dependencies jsonb 交给 Jackson 是同一条：域对象不依赖 Jackson。
 *
 * ★ `descriptorJson` 里**只有凭据引用**（键名），永远不会有值——落库前的闸门在
 * `ConnectorDescriptorGate`，它是 bundle 侧 `ENT_CONNECTOR_SECRET_INLINE` 那条纪律的服务端同一份实现。
 */
public record ConnectorEntry(
    long id,
    String tenantId,
    String connectorId,
    String displayName,
    String summary,
    Status status,
    Transport transport,
    String serverName,
    String descriptorJson,
    String capabilitiesJson,
    String policyJson,
    long createdBy,
    long updatedBy,
    Instant createdAt,
    Instant updatedAt,
    long revision
) {
    /** 与 V44 的 `ck_ent_connector_status` 逐字一致。 */
    public enum Status { DRAFT, ACTIVE, DISABLED }

    /**
     * 与 V44 的 `ck_ent_connector_transport` 逐字一致；九个成员与 bundle 侧
     * `CONNECTOR_TRANSPORTS`（`connector/capability.ts`）一一对应，**库内大写、下发小写**。
     */
    public enum Transport {
        MCP("mcp"),
        HTTP("http"),
        OPENAPI("openapi"),
        A2A("a2a"),
        ACP("acp"),
        IM_WEBHOOK("im-webhook"),
        SMTP("smtp"),
        IMAP("imap"),
        MQTT("mqtt");

        private final String wireValue;

        Transport(String wireValue) {
            this.wireValue = wireValue;
        }

        /** 下发到宿主/配置型 bundle 时用的词表值（bundle 侧 `CONNECTOR_TRANSPORTS` 逐字）。 */
        public String wireValue() {
            return wireValue;
        }

        /** 反向映射：`wireValue` 不认识的一律拒（不静默回落到 MCP）。 */
        public static Transport fromWireValue(String value) {
            for (Transport transport : values()) {
                if (transport.wireValue.equals(value)) return transport;
            }
            throw new IllegalArgumentException("未知的连接器传输类型");
        }
    }

    public ConnectorEntry {
        Objects.requireNonNull(tenantId, "tenantId");
        Objects.requireNonNull(connectorId, "connectorId");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(transport, "transport");
        Objects.requireNonNull(serverName, "serverName");
        Objects.requireNonNull(descriptorJson, "descriptorJson");
        Objects.requireNonNull(capabilitiesJson, "capabilitiesJson");
        Objects.requireNonNull(policyJson, "policyJson");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (revision < 0) throw new IllegalArgumentException("revision 不能为负");
    }

    /** 改一条条目时保留身份与创建人，只换可改字段并推进 revision（CAS 由 store 负责）。 */
    public ConnectorEntry revised(
        String displayName,
        String summary,
        Status status,
        Transport transport,
        String serverName,
        String descriptorJson,
        String capabilitiesJson,
        String policyJson,
        long updatedBy,
        Instant updatedAt
    ) {
        return new ConnectorEntry(
            id, tenantId, connectorId, displayName, summary, status, transport, serverName,
            descriptorJson, capabilitiesJson, policyJson, createdBy, updatedBy, createdAt, updatedAt, revision
        );
    }
}
