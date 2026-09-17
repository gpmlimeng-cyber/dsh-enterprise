/**
 * [INPUT]: 仅匹配 /enterprise/api/v1/git/** 的 Basic Authorization 头。
 * [OUTPUT]: 把 Basic password（企业 Access Token）改写为 Bearer，供既有 Sa-Token/设备上下文解析。
 * [POS]: workspace/web 的 Git 鉴权适配器；用户名固定忽略，绝不记录 token 或 password。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class GitBasicAuthFilter extends OncePerRequestFilter {
    public static final String PREFIX = "/enterprise/api/v1/git/";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null || !path.contains(PREFIX);
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.regionMatches(true, 0, "Basic ", 0, 6)) {
            String token = decodeBasicPassword(header.substring(6).trim());
            if (token != null && !token.isEmpty()) {
                GitBasicWrappedRequest wrapped = new GitBasicWrappedRequest(request, token);
                filterChain.doFilter(wrapped, response);
                return;
            }
        }
        if (header == null) {
            response.setHeader("WWW-Authenticate", "Basic realm=\"dshent-git\"");
        }
        filterChain.doFilter(request, response);
    }

    static String decodeBasicPassword(String encoded) {
        try {
            byte[] decoded = Base64.getDecoder().decode(encoded);
            String pair = new String(decoded, StandardCharsets.UTF_8);
            int colon = pair.indexOf(':');
            if (colon < 0) {
                return null;
            }
            return pair.substring(colon + 1);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
