/**
 * [INPUT]: 依赖 Spring Boot 配置绑定。
 * [OUTPUT]: 提供反馈附件 root、单文件字节上限与单边像素上限部署配置。
 * [POS]: feedback 模块的部署配置边界，值不进入 HTTP 响应。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@ConfigurationProperties("enterprise.feedback")
public class EnterpriseFeedbackProperties {
    private Path artifactRoot;
    /** 单张附件上限：截图场景取 2 MiB，与 ent_feedback_attachment.size check 同构。 */
    private long maxAttachmentBytes = 2_097_152L;
    private int maxDimension = 8192;

    public Path getArtifactRoot() {
        return artifactRoot;
    }

    public void setArtifactRoot(Path artifactRoot) {
        this.artifactRoot = artifactRoot;
    }

    public long getMaxAttachmentBytes() {
        return maxAttachmentBytes;
    }

    public void setMaxAttachmentBytes(long maxAttachmentBytes) {
        this.maxAttachmentBytes = maxAttachmentBytes;
    }

    public int getMaxDimension() {
        return maxDimension;
    }

    public void setMaxDimension(int maxDimension) {
        this.maxDimension = maxDimension;
    }
}
