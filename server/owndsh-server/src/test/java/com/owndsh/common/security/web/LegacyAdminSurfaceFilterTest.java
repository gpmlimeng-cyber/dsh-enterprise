/**
 * [INPUT]: 依赖 LegacyAdminSurfaceFilter 的路径判定与 SecurityConfig 企业路由边界。
 * [OUTPUT]: 锁定 /system、/monitor HTTP 面默认 404 判定，且不误伤企业与认证路径。
 * [POS]: owndsh-server 的遗留面拒绝回归门禁。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.common.security.web;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class LegacyAdminSurfaceFilterTest {

    @Test
    void blocksSystemAndMonitorSurfaces() {
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/system")).isTrue();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/system/")).isTrue();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/system/user/list")).isTrue();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/system/user?userId=1")).isTrue();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/monitor")).isTrue();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/monitor/cache")).isTrue();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/monitor/loginInfo/export")).isTrue();
    }

    @Test
    void allowsProductAndAuthPaths() {
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/")).isFalse();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/healthz")).isFalse();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/auth/code")).isFalse();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/enterprise/admin/v1/bootstrap")).isFalse();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/enterprise/gateway/v1/chat/completions")).isFalse();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/systematic")).isFalse();
        assertThat(LegacyAdminSurfaceFilter.isLegacyAdminSurface("/monitoring")).isFalse();
    }
}
