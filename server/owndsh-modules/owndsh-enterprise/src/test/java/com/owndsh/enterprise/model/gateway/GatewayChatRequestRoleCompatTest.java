/**
 * [INPUT]: 依赖 GatewayChatRequest 的 upstreamBody 与 OpenAI Completions 协议。
 * [OUTPUT]: 验证 developer role 映射为 system，且不动 user/assistant 角色。
 * [POS]: gateway 的 role 兼容回归门禁，锁定 DeepSeek 422 根因修复。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.model.gateway;

import com.owndsh.enterprise.model.domain.ProviderApiProtocol;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("dev")
class GatewayChatRequestRoleCompatTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void mapsDeveloperRoleToSystemForOpenAiCompletions() throws Exception {
        var request = parse("""
            {"model":"alias","stream":true,"messages":[
              {"role":"developer","content":"be concise"},
              {"role":"user","content":"hi"},
              {"role":"assistant","content":"ok"}
            ]}
            """);
        var body = request.upstreamBody("deepseek-flash", ProviderApiProtocol.OPENAI_COMPLETIONS, 1024);
        var roles = JSON.readTree(body.get("messages").toString());
        assertThat(roles.get(0).get("role").stringValue()).isEqualTo("system");
        assertThat(roles.get(1).get("role").stringValue()).isEqualTo("user");
        assertThat(roles.get(2).get("role").stringValue()).isEqualTo("assistant");
        assertThat(body.get("model").stringValue()).isEqualTo("deepseek-flash");
    }

    @Test
    void leavesDeveloperRoleUntouchedForAnthropic() throws Exception {
        var request = parse("""
            {"model":"claude","stream":true,"max_tokens":64,"messages":[{"role":"developer","content":"x"}]}
            """);
        var body = request.upstreamBody("claude-opus", ProviderApiProtocol.ANTHROPIC_MESSAGES, 64);
        assertThat(body.get("messages").get(0).get("role").stringValue()).isEqualTo("developer");
    }

    private static GatewayChatRequest parse(String json) {
        return new GatewayChatRequestParser(JSON).parse(json.getBytes(java.nio.charset.StandardCharsets.UTF_8),
            ProviderApiProtocol.OPENAI_COMPLETIONS);
    }
}
