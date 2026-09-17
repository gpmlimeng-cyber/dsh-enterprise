/**
 * [INPUT]: 包装原始 HttpServletRequest 与已解析的 Access Token password。
 * [OUTPUT]: 对外提供仅覆盖 Authorization: Bearer 的只读包装请求。
 * [POS]: workspace/web 的 Git Basic 适配内部实现，不向下游暴露 Basic 明文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

final class GitBasicWrappedRequest extends HttpServletRequestWrapper {
    private final String token;

    GitBasicWrappedRequest(HttpServletRequest request, String token) {
        super(request);
        this.token = token;
    }

    @Override
    public String getHeader(String name) {
        if ("Authorization".equalsIgnoreCase(name)) {
            return "Bearer " + token;
        }
        return super.getHeader(name);
    }
}
