/**
 * [INPUT]: 依赖 GitBasicAuthFilter 的 Basic 解码与请求包装。
 * [OUTPUT]: 验证 password 提取、Bearer 改写与非 Git 路径不过滤。
 * [POS]: workspace/web 的鉴权适配单测。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class GitBasicAuthFilterTest {
    @Test
    void decodesPasswordFromBasicHeader() {
        String encoded = Base64.getEncoder()
            .encodeToString("oauth2:token-value".getBytes(StandardCharsets.UTF_8));
        assertThat(GitBasicAuthFilter.decodeBasicPassword(encoded)).isEqualTo("token-value");
        assertThat(GitBasicAuthFilter.decodeBasicPassword("!!!")).isNull();
        assertThat(GitBasicAuthFilter.decodeBasicPassword("bm9jb2xvbg==")).isNull();
    }

    @Test
    void rewritesAuthorizationToBearer() throws Exception {
        GitBasicAuthFilter filter = new GitBasicAuthFilter();
        MockHttpServletRequest request = new MockHttpServletRequest(
            "GET", "/enterprise/api/v1/git/42/info/refs"
        );
        request.setRequestURI("/enterprise/api/v1/git/42/info/refs");
        request.addHeader(
            "Authorization",
            "Basic " + Base64.getEncoder().encodeToString("oauth2:tok".getBytes(StandardCharsets.UTF_8))
        );
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> seen = new AtomicReference<>();
        FilterChain chain = (req, res) -> seen.set(((HttpServletRequest) req).getHeader("Authorization"));

        filter.doFilter(request, response, chain);

        assertThat(seen.get()).isEqualTo("Bearer tok");
    }

    @Test
    void skipsNonGitPaths() {
        GitBasicAuthFilter filter = new GitBasicAuthFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/enterprise/api/v1/sessions");
        request.setRequestURI("/enterprise/api/v1/sessions");
        assertThat(filter.shouldNotFilter(request)).isTrue();
    }
}
