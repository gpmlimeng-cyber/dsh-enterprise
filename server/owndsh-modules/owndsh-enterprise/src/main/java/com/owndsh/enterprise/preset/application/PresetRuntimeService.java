/**
 * [INPUT]: 依赖 ACTIVE DeviceService、BootstrapUserStore、PresetStore、artifact store 与审计。
 * [OUTPUT]: 提供 runtime 可见配方列表/详情与逐请求下载授权。
 * [POS]: preset/application 的员工信任编排，每次下载重算可见性。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditActorType;
import com.owndsh.enterprise.audit.AuditEvent;
import com.owndsh.enterprise.audit.AuditResult;
import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.application.DeviceService;
import com.owndsh.enterprise.device.domain.EnterpriseDevice;
import com.owndsh.enterprise.model.application.BootstrapUser;
import com.owndsh.enterprise.model.persistence.BootstrapUserStore;
import com.owndsh.enterprise.preset.artifact.PresetArtifactStore;
import com.owndsh.enterprise.preset.domain.PresetVersion;
import com.owndsh.enterprise.preset.domain.RuntimePreset;
import com.owndsh.enterprise.preset.persistence.PresetStore;
import org.springframework.transaction.support.TransactionOperations;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.function.LongSupplier;

public final class PresetRuntimeService {
    private final TransactionOperations transactions;
    private final DeviceService devices;
    private final BootstrapUserStore users;
    private final PresetStore presets;
    private final PresetArtifactStore artifacts;
    private final AuditSink auditSink;
    private final LongSupplier ids;
    private final Clock clock;

    public PresetRuntimeService(
        TransactionOperations transactions,
        DeviceService devices,
        BootstrapUserStore users,
        PresetStore presets,
        PresetArtifactStore artifacts,
        AuditSink auditSink,
        LongSupplier ids
    ) {
        this(transactions, devices, users, presets, artifacts, auditSink, ids, Clock.systemUTC());
    }

    PresetRuntimeService(
        TransactionOperations transactions,
        DeviceService devices,
        BootstrapUserStore users,
        PresetStore presets,
        PresetArtifactStore artifacts,
        AuditSink auditSink,
        LongSupplier ids,
        Clock clock
    ) {
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.devices = Objects.requireNonNull(devices, "devices");
        this.users = Objects.requireNonNull(users, "users");
        this.presets = Objects.requireNonNull(presets, "presets");
        this.artifacts = Objects.requireNonNull(artifacts, "artifacts");
        this.auditSink = Objects.requireNonNull(auditSink, "auditSink");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public List<RuntimePreset> list(DeviceCallContext context) {
        EnterpriseDevice device = devices.requireActive(context);
        BootstrapUser user = requireUser(context.tenantId(), device.userId());
        return presets.findVisiblePublished(context.tenantId(), user.id());
    }

    public RuntimePreset detail(DeviceCallContext context, long packageId) {
        EnterpriseDevice device = devices.requireActive(context);
        BootstrapUser user = requireUser(context.tenantId(), device.userId());
        return presets.findVisiblePublishedById(context.tenantId(), user.id(), packageId)
            .orElseThrow(() -> new PresetAccessException(PresetAccessException.VISIBILITY_DENIED));
    }

    public AuthorizedDownload authorizeDownload(DeviceCallContext context, long versionId) {
        EnterpriseDevice device = devices.requireActive(context);
        BootstrapUser user = requireUser(context.tenantId(), device.userId());
        PresetVersion version = presets.findPublishedVersionForUser(context.tenantId(), user.id(), versionId)
            .orElseThrow(() -> new PresetAccessException(PresetAccessException.VISIBILITY_DENIED));
        Path path = artifacts.resolve(version.artifactRef());
        audit(context, device, user, version);
        return new AuthorizedDownload(path, version.sizeBytes(), version.sha256());
    }

    private BootstrapUser requireUser(String tenantId, long userId) {
        return users.findActive(tenantId, userId).orElseThrow(PresetResourceNotFoundException::new);
    }

    private void audit(DeviceCallContext context, EnterpriseDevice device, BootstrapUser user, PresetVersion version) {
        transactions.executeWithoutResult(status -> auditSink.append(new AuditEvent(
            ids.getAsLong(), context.tenantId(), Instant.now(clock), AuditActorType.USER, user.id(), device.id(),
            AuditAction.PRESET_DOWNLOAD_AUTHORIZED, "PRESET_VERSION", Long.toString(version.id()),
            AuditResult.SUCCESS, null, context.requestId(), context.sourceIp(), context.userAgentHash(),
            new PresetAuditMetadata.Download(version.id(), device.id(), user.id())
        )));
    }

    public record AuthorizedDownload(Path path, long sizeBytes, String sha256) {
    }
}
