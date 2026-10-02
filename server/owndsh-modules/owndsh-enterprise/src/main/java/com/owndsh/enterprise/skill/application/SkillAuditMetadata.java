/**
 * [INPUT]: 依赖 AuditAction 与技能 package/version 事实。
 * [OUTPUT]: 提供六类技能审计 action 的非敏感 metadata 白名单。
 * [POS]: skill/application 的审计 DTO，禁止投影 artifact 路径与 SKILL.md 正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditMetadata;

public sealed interface SkillAuditMetadata extends AuditMetadata {
    record Upload(long packageId, long versionId, String skillId, String sourceDshVersion, String sha256, long sizeBytes)
        implements SkillAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.SKILL_VERSION_UPLOADED;
        }
    }

    record Publish(long packageId, long versionId, long revision) implements SkillAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.SKILL_VERSION_PUBLISHED;
        }
    }

    record Retire(long packageId, long versionId, long revision) implements SkillAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.SKILL_VERSION_RETIRED;
        }
    }

    record Assignments(long packageId, boolean all, int userCount) implements SkillAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.SKILL_ASSIGNMENTS_REPLACED;
        }
    }

    record Marks(long packageId, boolean builtin, boolean featured, long revision) implements SkillAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.SKILL_MARKS_CHANGED;
        }
    }

    record Download(long versionId, long deviceId, long memberId) implements SkillAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.SKILL_DOWNLOAD_AUTHORIZED;
        }
    }
}
