/**
 * [INPUT]: 绑定 enterprise.collab 的部署开关。
 * [OUTPUT]: 对外提供 collab 预告开关（enabled 默认关闭，V1 路径零项目信道）。
 * [POS]: collab 模块的环境配置边界，与 sessionPolicy 独立、互不强制 AND。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "enterprise.collab")
public class EnterpriseCollabProperties {
    /** 是否启用项目协作信道；默认关闭。 */
    private boolean enabled = false;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
