/**
 * [INPUT]: 依赖 AuditAction 与配方 package/version 事实。
 * [OUTPUT]: 提供五类配方审计 action 的非敏感 metadata 白名单。
 * [POS]: preset/application 的审计 DTO，禁止投影 artifact 路径与包内 YAML。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditMetadata;

public sealed interface PresetAuditMetadata extends AuditMetadata {
    record Upload(long packageId, long versionId, String presetId, String sourceDshVersion, String sha256, long sizeBytes)
        implements PresetAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PRESET_VERSION_UPLOADED;
        }
    }

    record Publish(long packageId, long versionId, long revision) implements PresetAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PRESET_VERSION_PUBLISHED;
        }
    }

    record Retire(long packageId, long versionId, long revision) implements PresetAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PRESET_VERSION_RETIRED;
        }
    }

    record Assignments(long packageId, boolean all, int userCount) implements PresetAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PRESET_ASSIGNMENTS_REPLACED;
        }
    }

    record Download(long versionId, long deviceId, long memberId) implements PresetAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.PRESET_DOWNLOAD_AUTHORIZED;
        }
    }
}
