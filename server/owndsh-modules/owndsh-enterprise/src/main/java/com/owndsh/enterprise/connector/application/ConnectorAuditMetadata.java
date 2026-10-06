/**
 * [INPUT]: 依赖 AuditAction 与连接器条目事实。
 * [OUTPUT]: 提供连接器审计 action 的非敏感 metadata 白名单（只有 id/形状计数，**没有**端点、URL、凭据键名）。
 * [POS]: connector/application 的审计 DTO，禁止把 descriptor/capabilities 正文投影进审计。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditMetadata;
import com.owndsh.enterprise.connector.domain.ConnectorEntry;

/**
 * ★ 这里刻意**不带** `descriptorJson` / `capabilitiesJson` 正文：审计是给人事与合规看的，
 * 端点 URL 与凭据**键名**都属于不该扩散的信息（键名本身就是攻击面提示）。
 * 只留"哪一条、什么形状、影响多少人"。
 */
public sealed interface ConnectorAuditMetadata extends AuditMetadata {
    /** 授予（新建一条连接 / 把它置为 ACTIVE）。 */
    record Granted(long connectorId, String connectorIdValue, ConnectorEntry.Transport transport, int capabilityCount)
        implements ConnectorAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.CONNECTOR_GRANTED;
        }
    }

    /** 撤销（把一条连接置为 DISABLED）。 */
    record Revoked(long connectorId, String connectorIdValue, ConnectorEntry.Status from)
        implements ConnectorAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.CONNECTOR_REVOKED;
        }
    }

    /** 改条目字段（走既有 `CONFIG_CHANGED`，见 ConnectorCatalogService 的映射口径）。 */
    record Changed(long connectorId, String connectorIdValue) implements ConnectorAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.CONFIG_CHANGED;
        }
    }

    /** 可见范围全量替换（同上走 `CONFIG_CHANGED`）。 */
    record Assignments(long connectorId, boolean all, int userCount) implements ConnectorAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.CONFIG_CHANGED;
        }
    }

    // ── 下面四枚是**宿主侧**运行时事件（由连接器自己写，服务端不产出） ──
    // 在服务端也定义 DTO 的原因：`AuditMetadataPolicyTest#everyFrozenActionHasOneConcreteMetadataSample`
    // 要求封闭枚举的**每一枚**都有一个可序列化的白名单 DTO（`samples.size() == AuditAction.values().length`）——
    // 这是仓库既有的「枚举与 metadata 空间不许脱节」门禁。★ 但**不要**因此就在服务端补发这四类事件：
    // 那等于伪造观测（方案 §6.5 的信任话术纪律）。

    /** 入站事件接收（含验签结果）。只留「收没收到 / 签名过没过」，**不带正文**。 */
    record InboundReceived(long connectorId, String capabilityId, boolean signed, boolean verified)
        implements ConnectorAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.CONNECTOR_INBOUND_RECEIVED;
        }
    }

    /** 出站动作发起。 */
    record OutboundSent(long connectorId, String capabilityId, int attempt) implements ConnectorAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.CONNECTOR_OUTBOUND_SENT;
        }
    }

    /** 动作被策略拒绝（`reasonCode` 取求值器给的稳定码，不是自由文本）。 */
    record Denied(long connectorId, String capabilityId, String reasonCode) implements ConnectorAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.CONNECTOR_DENIED;
        }
    }

    /** 平台不支持被命中（「这台设备暂不支持」也要留痕，否则无法回答「为什么没人用」）。 */
    record Unsupported(long connectorId, String platform) implements ConnectorAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.CONNECTOR_UNSUPPORTED;
        }
    }
}
