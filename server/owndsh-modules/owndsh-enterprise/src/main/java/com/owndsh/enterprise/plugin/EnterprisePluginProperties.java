/**
 * [INPUT]: 绑定 artifact root、默认关闭的签名开关、可选 Ed25519 PKCS#8 私钥、压缩/解压/entry 三项部署上限与企业核心包清单。
 * [OUTPUT]: 对外提供插件 artifact composition root 所需的强类型配置，并提供核心包清单的格式/重复校验。
 * [POS]: plugin 模块的秘密与资源配置边界，私钥由容器环境注入且不写入配置文件；核心包清单在此被拒于装配之前，是 P0 死名单事故的唯一配置入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;

@ConfigurationProperties(prefix = "enterprise.plugin")
public final class EnterprisePluginProperties {
    private Path artifactRoot;
    private boolean signingEnabled;
    private String signingPrivateKey;
    private long maxArchiveBytes = 52_428_800L;
    private long maxExpandedBytes = 209_715_200L;
    private int maxEntries = 10_000;
    private List<String> corePackages = List.of(
        "dshent-plugin",
        "@dshent/contracts",
        "@dshent/llm-gateway",
        "@dshent/platform-client",
        "@dshent/plugin-distribution",
        "@dshent/ui"
    );

    public Path getArtifactRoot() {
        return artifactRoot;
    }

    public void setArtifactRoot(Path artifactRoot) {
        this.artifactRoot = artifactRoot;
    }

    public boolean isSigningEnabled() {
        return signingEnabled;
    }

    public void setSigningEnabled(boolean signingEnabled) {
        this.signingEnabled = signingEnabled;
    }

    public String getSigningPrivateKey() {
        return signingPrivateKey;
    }

    public void setSigningPrivateKey(String signingPrivateKey) {
        this.signingPrivateKey = signingPrivateKey;
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

    public List<String> getCorePackages() {
        return corePackages;
    }

    public void setCorePackages(List<String> corePackages) {
        this.corePackages = corePackages;
    }

    /**
     * 在装配插件验包器之前失败退出：核心包清单是分发门禁的唯一输入，空表或脏名字都会让门禁静默失效。
     */
    void validate() {
        if (corePackages == null || corePackages.isEmpty()) {
            throw new IllegalStateException("enterprise.plugin.core-packages 不能为空");
        }
        HashSet<String> seen = new HashSet<>();
        for (String corePackage : corePackages) {
            if (corePackage == null || corePackage.isBlank()) {
                throw new IllegalStateException("enterprise.plugin.core-packages 不能包含空白项");
            }
            if (!PluginArtifactInspector.PACKAGE_NAME.matcher(corePackage).matches()) {
                throw new IllegalStateException(
                    "enterprise.plugin.core-packages 含非法 package name: " + corePackage
                );
            }
            if (!seen.add(corePackage)) {
                throw new IllegalStateException(
                    "enterprise.plugin.core-packages 含重复项: " + corePackage
                );
            }
        }
    }
}
