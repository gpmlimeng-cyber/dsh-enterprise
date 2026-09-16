/**
 * [INPUT]: 依赖当前 HTTP 请求的 servlet path / URI。
 * [OUTPUT]: 对 /system/** 与 /monitor/** 遗留管理面返回 404 JSON，其余请求直接放行。
 * [POS]: owndsh-common-security 的纵深防御 Filter；默认关闭上游 RuoYi 面 HTTP 暴露，不删除 in-process Service 依赖。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.common.security.web;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.owndsh.common.core.utils.StringUtils;
import org.springframework.core.Ordered;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 拒绝上游遗留 /system、/monitor HTTP 面。
 * <p>
 * 企业层仍进程内使用 owndsh-system 的 Service/表；本 Filter 只切断可被直接调用的 Controller 面，
 * 避免「nginx 没配」成为唯一安全边界。
 */
public final class LegacyAdminSurfaceFilter implements Filter, Ordered {

    public static final String ERROR_BODY = "{\"error\":\"ENT_LEGACY_SURFACE_DISABLED\"}";

    /** 默认拒绝；仅本地极少数调试可显式打开。 */
    private final boolean enabled;

    public LegacyAdminSurfaceFilter(boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public int getOrder() {
        // 在 Sa-Token 上下文之后、业务之前拦截；保持 HIGHEST+1 量级即可
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
        throws IOException, ServletException {
        if (enabled) {
            chain.doFilter(request, response);
            return;
        }
        if (request instanceof HttpServletRequest http && response instanceof HttpServletResponse httpResponse) {
            String path = resolvePath(http);
            if (isLegacyAdminSurface(path)) {
                httpResponse.setStatus(HttpServletResponse.SC_NOT_FOUND);
                httpResponse.setContentType("application/json;charset=UTF-8");
                httpResponse.getOutputStream().write(ERROR_BODY.getBytes(StandardCharsets.UTF_8));
                return;
            }
        }
        chain.doFilter(request, response);
    }

    static String resolvePath(HttpServletRequest request) {
        return StringUtils.blankToDefault(request.getServletPath(), request.getRequestURI());
    }

    public static boolean isLegacyAdminSurface(String requestPath) {
        if (StringUtils.isBlank(requestPath)) {
            return false;
        }
        String path = requestPath;
        int q = path.indexOf('?');
        if (q >= 0) {
            path = path.substring(0, q);
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        return matchesPrefix(path, "/system") || matchesPrefix(path, "/monitor");
    }

    private static boolean matchesPrefix(String path, String prefix) {
        if (!path.startsWith(prefix)) {
            return false;
        }
        if (path.length() == prefix.length()) {
            return true;
        }
        char next = path.charAt(prefix.length());
        return next == '/' || next == ';';
    }
}
