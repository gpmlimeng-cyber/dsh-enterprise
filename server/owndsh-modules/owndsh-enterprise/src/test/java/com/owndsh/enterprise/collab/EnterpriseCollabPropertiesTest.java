/**
 * [INPUT]: 依赖 EnterpriseCollabProperties 无配置构造。
 * [OUTPUT]: 验证 collabPolicy.enabled 默认关闭。
 * [POS]: collab 配置漂移门禁，与 session 默认关闭对称。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class EnterpriseCollabPropertiesTest {
    @Test
    void defaultsCollabDisabled() {
        EnterpriseCollabProperties properties = new EnterpriseCollabProperties();
        assertThat(properties.isEnabled()).isFalse();
        properties.setEnabled(true);
        assertThat(properties.isEnabled()).isTrue();
    }
}
