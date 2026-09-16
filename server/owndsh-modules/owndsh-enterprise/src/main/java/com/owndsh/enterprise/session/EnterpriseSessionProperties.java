/**
 * [INPUT]: 绑定 enterprise.session 的客户端宣告开关、批次容量与 retention 部署参数。
 * [OUTPUT]: 对外提供带安全默认值的 Session Server 配置（enabled 默认关闭，V1 路径零 Session 同步）。
 * [POS]: session 模块的环境配置边界，业务层只消费已验证的字节数、时间范围与布尔开关。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.session;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "enterprise.session")
public class EnterpriseSessionProperties {
    /** 是否向 bootstrap 客户端宣告 Session 同步旁路可用；默认关闭（V1 门禁）。 */
    private boolean enabled = false;
    private int maxBatchBytes = 1024 * 1024;
    private int retentionDays = 90;
    private int retentionBatchSize = 100;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getMaxBatchBytes() {
        return maxBatchBytes;
    }

    public void setMaxBatchBytes(int maxBatchBytes) {
        this.maxBatchBytes = maxBatchBytes;
    }

    public int getRetentionDays() {
        return retentionDays;
    }

    public void setRetentionDays(int retentionDays) {
        this.retentionDays = retentionDays;
    }

    public int getRetentionBatchSize() {
        return retentionBatchSize;
    }

    public void setRetentionBatchSize(int retentionBatchSize) {
        this.retentionBatchSize = retentionBatchSize;
    }
}
