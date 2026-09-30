/**
 * [INPUT]: 依赖 AuditAction 与品牌配置/发布 revision 事实。
 * [OUTPUT]: 提供两类品牌审计 action 的非敏感 metadata 白名单。
 * [POS]: branding/application 的审计 DTO，只投影 ID 与 revision，不投影品牌文案或资产路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.application;

import com.owndsh.enterprise.audit.AuditAction;
import com.owndsh.enterprise.audit.AuditMetadata;

public sealed interface BrandingAuditMetadata extends AuditMetadata {
    /**
     * @param configId 品牌配置 ID
     * @param revision 发布产生的新 revision
     * @param logoCount 本次发布的 LOGO 槽位数量
     */
    record Published(long configId, long revision, int logoCount) implements BrandingAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.BRANDING_PUBLISHED;
        }
    }

    /**
     * @param configId 品牌配置 ID
     * @param fromRevision 回滚前 revision
     * @param targetRevision 被恢复的历史 revision
     * @param revision 回滚产生的新 revision
     */
    record RolledBack(long configId, long fromRevision, long targetRevision, long revision)
        implements BrandingAuditMetadata {
        @Override
        public AuditAction action() {
            return AuditAction.BRANDING_ROLLED_BACK;
        }
    }
}
