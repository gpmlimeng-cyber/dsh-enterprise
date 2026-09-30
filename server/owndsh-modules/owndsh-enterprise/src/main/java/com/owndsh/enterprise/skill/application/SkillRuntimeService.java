/**
 * [INPUT]: 依赖 ACTIVE DeviceService、BootstrapUserStore、SkillStore、artifact store 与审计。
 * [OUTPUT]: 提供 runtime 可见技能列表/详情与逐请求下载授权。
 * [POS]: skill/application 的员工信任编排，每次下载重算可见性。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

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
import com.owndsh.enterprise.skill.artifact.SkillArtifactStore;
import com.owndsh.enterprise.skill.domain.RuntimeSkill;
import com.owndsh.enterprise.skill.domain.SkillVersion;
import com.owndsh.enterprise.skill.persistence.SkillStore;
import org.springframework.transaction.support.TransactionOperations;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.function.LongSupplier;

public final class SkillRuntimeService {
    private final TransactionOperations transactions;
    private final DeviceService devices;
    private final BootstrapUserStore users;
    private final SkillStore skills;
    private final SkillArtifactStore artifacts;
    private final AuditSink auditSink;
    private final LongSupplier ids;
    private final Clock clock;

    public SkillRuntimeService(
        TransactionOperations transactions,
        DeviceService devices,
        BootstrapUserStore users,
        SkillStore skills,
        SkillArtifactStore artifacts,
        AuditSink auditSink,
        LongSupplier ids
    ) {
        this(transactions, devices, users, skills, artifacts, auditSink, ids, Clock.systemUTC());
    }

    SkillRuntimeService(
        TransactionOperations transactions,
        DeviceService devices,
        BootstrapUserStore users,
        SkillStore skills,
        SkillArtifactStore artifacts,
        AuditSink auditSink,
        LongSupplier ids,
        Clock clock
    ) {
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.devices = Objects.requireNonNull(devices, "devices");
        this.users = Objects.requireNonNull(users, "users");
        this.skills = Objects.requireNonNull(skills, "skills");
        this.artifacts = Objects.requireNonNull(artifacts, "artifacts");
        this.auditSink = Objects.requireNonNull(auditSink, "auditSink");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public List<RuntimeSkill> list(DeviceCallContext context) {
        EnterpriseDevice device = devices.requireActive(context);
        BootstrapUser user = requireUser(context.tenantId(), device.userId());
        return skills.findVisiblePublished(context.tenantId(), user.id());
    }

    public RuntimeSkill detail(DeviceCallContext context, long packageId) {
        EnterpriseDevice device = devices.requireActive(context);
        BootstrapUser user = requireUser(context.tenantId(), device.userId());
        return skills.findVisiblePublishedById(context.tenantId(), user.id(), packageId)
            .orElseThrow(() -> new SkillAccessException(SkillAccessException.VISIBILITY_DENIED));
    }

    public AuthorizedDownload authorizeDownload(DeviceCallContext context, long versionId) {
        EnterpriseDevice device = devices.requireActive(context);
        BootstrapUser user = requireUser(context.tenantId(), device.userId());
        SkillVersion version = skills.findPublishedVersionForUser(context.tenantId(), user.id(), versionId)
            .orElseThrow(() -> new SkillAccessException(SkillAccessException.VISIBILITY_DENIED));
        Path path = artifacts.resolve(version.artifactRef());
        audit(context, device, user, version);
        return new AuthorizedDownload(path, version.sizeBytes(), version.sha256());
    }

    private BootstrapUser requireUser(String tenantId, long userId) {
        return users.findActive(tenantId, userId).orElseThrow(SkillResourceNotFoundException::new);
    }

    private void audit(DeviceCallContext context, EnterpriseDevice device, BootstrapUser user, SkillVersion version) {
        transactions.executeWithoutResult(status -> auditSink.append(new AuditEvent(
            ids.getAsLong(), context.tenantId(), Instant.now(clock), AuditActorType.USER, user.id(), device.id(),
            AuditAction.SKILL_DOWNLOAD_AUTHORIZED, "SKILL_VERSION", Long.toString(version.id()),
            AuditResult.SUCCESS, null, context.requestId(), context.sourceIp(), context.userAgentHash(),
            new SkillAuditMetadata.Download(version.id(), device.id(), user.id())
        )));
    }

    public record AuthorizedDownload(Path path, long sizeBytes, String sha256) {
    }
}
