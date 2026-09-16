/**
 * [INPUT]: 依赖 LegacyAdminSurfaceFilter 的路径判定、doFilter 行为与 Spring mock servlet。
 * [OUTPUT]: 锁定 /system、/monitor HTTP 面默认 404 JSON，且不误伤企业与认证路径；逃生口放行。
 * [POS]: owndsh-server 的遗留面拒绝回归门禁。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.common.security.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

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

    @Test
    void doFilterReturns404JsonForLegacySurface() throws IOException, ServletException {
        LegacyAdminSurfaceFilter filter = new LegacyAdminSurfaceFilter(false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/system/user/list");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chained = new AtomicBoolean(false);
        FilterChain chain = new FilterChain() {
            @Override
            public void doFilter(ServletRequest req, ServletResponse res) {
                chained.set(true);
            }
        };

        filter.doFilter(request, response, chain);

        assertThat(chained).isFalse();
        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(response.getContentType()).contains("application/json");
        assertThat(response.getContentAsString(StandardCharsets.UTF_8))
            .isEqualTo(LegacyAdminSurfaceFilter.ERROR_BODY);
    }

    @Test
    void doFilterPassesThroughWhenEscapeHatchEnabled() throws IOException, ServletException {
        LegacyAdminSurfaceFilter filter = new LegacyAdminSurfaceFilter(true);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/system/user/list");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chained = new AtomicBoolean(false);

        filter.doFilter(request, response, new FilterChain() {
            @Override
            public void doFilter(ServletRequest req, ServletResponse res) {
                chained.set(true);
            }
        });

        assertThat(chained).isTrue();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void doFilterPassesEnterprisePath() throws IOException, ServletException {
        LegacyAdminSurfaceFilter filter = new LegacyAdminSurfaceFilter(false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/enterprise/admin/v1/bootstrap");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chained = new AtomicBoolean(false);

        filter.doFilter(request, response, new FilterChain() {
            @Override
            public void doFilter(ServletRequest req, ServletResponse res) {
                chained.set(true);
            }
        });

        assertThat(chained).isTrue();
        assertThat(response.getStatus()).isEqualTo(200);
    }
}
