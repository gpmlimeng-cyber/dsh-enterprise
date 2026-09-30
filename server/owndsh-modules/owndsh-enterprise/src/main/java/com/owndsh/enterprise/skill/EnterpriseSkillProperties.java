/**
 * [INPUT]: 依赖 Spring Boot 配置绑定。
 * [OUTPUT]: 提供 skill artifact root 与归档/entry 上限部署配置。
 * [POS]: skill 模块的部署配置边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@ConfigurationProperties("enterprise.skill")
public class EnterpriseSkillProperties {
    private Path artifactRoot;
    private long maxArchiveBytes = 52_428_800L;
    private long maxExpandedBytes = 209_715_200L;
    private int maxEntries = 10_000;

    public Path getArtifactRoot() {
        return artifactRoot;
    }

    public void setArtifactRoot(Path artifactRoot) {
        this.artifactRoot = artifactRoot;
    }

    public long getMaxArchiveBytes() {
        return maxArchiveBytes;
    }

    public void setMaxArchiveBytes(long maxArchiveBytes) {
        this.maxArchiveBytes = maxArchiveBytes;
    }

    public long getMaxExpandedBytes() {
        return maxExpandedBytes;
    }

    public void setMaxExpandedBytes(long maxExpandedBytes) {
        this.maxExpandedBytes = maxExpandedBytes;
    }

    public int getMaxEntries() {
        return maxEntries;
    }

    public void setMaxEntries(int maxEntries) {
        this.maxEntries = maxEntries;
    }
}
