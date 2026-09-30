/**
 * [INPUT]: 依赖 Spring Boot 配置绑定。
 * [OUTPUT]: 提供品牌制品 root、单文件字节上限与单边像素上限部署配置。
 * [POS]: branding 模块的部署配置边界，值不进入 HTTP 响应。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@ConfigurationProperties("enterprise.branding")
public class EnterpriseBrandingProperties {
    private Path artifactRoot;
    private long maxAssetBytes = 524_288L;
    private int maxDimension = 8192;

    public Path getArtifactRoot() {
        return artifactRoot;
    }

    public void setArtifactRoot(Path artifactRoot) {
        this.artifactRoot = artifactRoot;
    }

    public long getMaxAssetBytes() {
        return maxAssetBytes;
    }

    public void setMaxAssetBytes(long maxAssetBytes) {
        this.maxAssetBytes = maxAssetBytes;
    }

    public int getMaxDimension() {
        return maxDimension;
    }

    public void setMaxDimension(int maxDimension) {
        this.maxDimension = maxDimension;
    }
}
