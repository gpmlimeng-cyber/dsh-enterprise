/**
 * [INPUT]: 依赖 ConnectorDescriptorGate 与 ConnectorDeclarationException 的三枚稳定码。
 * [OUTPUT]: 锁定声明闸门的每一档：形状/取值域、明文凭据（含 mapping 形态与深扫）、自贴层级、九枚必填、空 effects、策略上限。
 * [POS]: connector/application 的纯单测（不依赖 PostgreSQL、Spring 与 Jackson）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.connector.application;

import com.owndsh.enterprise.connector.domain.ConnectorEntry;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class ConnectorDescriptorGateTest {
    private final ConnectorDescriptorGate gate = new ConnectorDescriptorGate();

    @Test
    void acceptsAWellFormedStdioMcpConnector() {
        ConnectorDescriptorGate.Validated validated = gate.validate(input(Map.of(
            "transport", "stdio",
            "command", "npx",
            "args", List.of("-y", "@mobilenext/mobile-mcp@latest"),
            "env", List.of(Map.of("name", "DEMO_TOKEN", "key", "ENT_DEMO_TOKEN"))
        )));

        assertEquals("ent-demo", validated.connectorId());
        assertEquals("ent-demo", validated.serverName());
        assertEquals(ConnectorEntry.Transport.MCP, validated.transport());
        assertEquals("示例连接器", validated.displayName());
        assertEquals(1, validated.capabilities().size());
        assertEquals("L2", validated.policy().get("maxLevel"));
    }

    @Test
    void acceptsStreamableHttpWithBearerHeader() {
        ConnectorDescriptorGate.Validated validated = gate.validate(input(Map.of(
            "transport", "streamable-http",
            "url", "https://mcp.example.com/rpc",
            "headers", List.of(Map.of("name", "Authorization", "key", "ENT_DEMO_TOKEN", "scheme", "Bearer"))
        )));
        assertEquals(ConnectorEntry.Transport.MCP, validated.transport());
    }

    @Test
    void rejectsAnObjectMappingWhereReferencesAreRequired() {
        // `{ GITHUB_TOKEN: 'ghp_…' }`：旧写法，必须判**明文**而不是笼统的形状错。
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(input(Map.of(
                "transport", "stdio", "command", "npx",
                "env", Map.of("GITHUB_TOKEN", "ghp_secret_value")
            ))));
        assertEquals(ConnectorDeclarationException.SECRET_INLINE, failure.errorCode());
        assertFalse(failure.getMessage().contains("ghp_secret_value"), "异常里绝不能出现凭据正文");
    }

    @Test
    void rejectsAReferenceEntryCarryingAValue() {
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(input(Map.of(
                "transport", "stdio", "command", "npx",
                "env", List.of(Map.of("name", "X", "key", "Y", "value", "literal"))
            ))));
        assertEquals(ConnectorDeclarationException.SECRET_INLINE, failure.errorCode());
    }

    @Test
    void rejectsABareStringReferenceEntry() {
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(input(Map.of(
                "transport", "stdio", "command", "npx", "env", List.of("ENT_DEMO_TOKEN")
            ))));
        assertEquals(ConnectorDeclarationException.SECRET_INLINE, failure.errorCode());
    }

    @Test
    void rejectsABearerSchemeOnStdioEnv() {
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(input(Map.of(
                "transport", "stdio", "command", "npx",
                "env", List.of(Map.of("name", "X", "key", "Y", "scheme", "Bearer"))
            ))));
        assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode());
    }

    @Test
    void rejectsALevelKeyOnACapability() {
        // 声明侧自贴层级是方案 §3.2 纪律 2 的硬禁止项，必须给**专属**码。
        for (String key : List.of("level", "permission", "tier")) {
            Map<String, Object> capability = new LinkedHashMap<>(capability());
            capability.put(key, "L1");
            ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
                gate.validate(new ConnectorDescriptorGate.Input(
                    "ent-demo", "示例连接器", null, ConnectorEntry.Transport.MCP, "ent-demo",
                    Map.of("transport", "stdio", "command", "npx"), List.of(capability), null)));
            assertEquals(ConnectorDeclarationException.LEVEL_DECLARED, failure.errorCode(), key);
        }
    }

    @Test
    void rejectsAMissingRequiredCapabilityField() {
        for (String required : List.of("capabilityId", "title", "stateAddress", "effects",
            "reversibility", "blastRadius", "transport", "platformRequired", "discovery")) {
            Map<String, Object> capability = new LinkedHashMap<>(capability());
            capability.remove(required);
            ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
                gate.validate(new ConnectorDescriptorGate.Input(
                    "ent-demo", "示例连接器", null, ConnectorEntry.Transport.MCP, "ent-demo",
                    Map.of("transport", "stdio", "command", "npx"), List.of(capability), null)));
            assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode(), required);
        }
    }

    @Test
    void rejectsAnEmptyEffectsSet() {
        // 空集会让"只读"判据空集真 ⇒ 什么都不做的东西自动放行（bundle 侧同一条理由）。
        Map<String, Object> capability = new LinkedHashMap<>(capability());
        capability.put("effects", List.of());
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(new ConnectorDescriptorGate.Input(
                "ent-demo", "示例连接器", null, ConnectorEntry.Transport.MCP, "ent-demo",
                Map.of("transport", "stdio", "command", "npx"), List.of(capability), null)));
        assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode());
    }

    @Test
    void rejectsAnUnknownCapabilityKey() {
        Map<String, Object> capability = new LinkedHashMap<>(capability());
        capability.put("magic", true);
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(new ConnectorDescriptorGate.Input(
                "ent-demo", "示例连接器", null, ConnectorEntry.Transport.MCP, "ent-demo",
                Map.of("transport", "stdio", "command", "npx"), List.of(capability), null)));
        assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode());
    }

    @Test
    void rejectsAnIllegalConnectorIdOrServerName() {
        for (String bad : List.of("Ent-Demo", "ent_demo", "-ent", "ent-", "1".repeat(65))) {
            assertEquals(ConnectorDeclarationException.INVALID, assertThrows(
                ConnectorDeclarationException.class,
                () -> gate.validate(new ConnectorDescriptorGate.Input(
                    bad, "示例", null, ConnectorEntry.Transport.MCP, "ent-demo",
                    Map.of("transport", "stdio", "command", "npx"), List.of(capability()), null))
            ).errorCode(), bad);
        }
        assertEquals(ConnectorDeclarationException.INVALID, assertThrows(
            ConnectorDeclarationException.class,
            () -> gate.validate(new ConnectorDescriptorGate.Input(
                "ent-demo", "示例", null, ConnectorEntry.Transport.MCP, "has spaces",
                Map.of("transport", "stdio", "command", "npx"), List.of(capability()), null))
        ).errorCode());
    }

    @Test
    void rejectsTheLegacySseTransport() {
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(input(Map.of("transport", "sse", "url", "https://x.example.com"))));
        assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode());
    }

    @Test
    void rejectsAUrlWithoutAnHttpScheme() {
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(input(Map.of("transport", "streamable-http", "url", "mcp.example.com"))));
        assertEquals(ConnectorDeclarationException.INVALID, failure.errorCode());
    }

    @Test
    void rejectsAnIllegalPolicyLevelAndUnknownPolicyKey() {
        ConnectorDeclarationException badLevel = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(new ConnectorDescriptorGate.Input(
                "ent-demo", "示例", null, ConnectorEntry.Transport.MCP, "ent-demo",
                Map.of("transport", "stdio", "command", "npx"), List.of(capability()),
                Map.of("maxLevel", "L9"))));
        assertEquals(ConnectorDeclarationException.INVALID, badLevel.errorCode());

        ConnectorDeclarationException unknown = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(new ConnectorDescriptorGate.Input(
                "ent-demo", "示例", null, ConnectorEntry.Transport.MCP, "ent-demo",
                Map.of("transport", "stdio", "command", "npx"), List.of(capability()),
                Map.of("maxLevel", "L2", "quota", Map.of("maxCalls", 10, "windowSeconds", 60, "extra", 1)))));
        assertEquals(ConnectorDeclarationException.INVALID, unknown.errorCode());
    }

    @Test
    void defaultsTheCeilingToL3WhenPolicyIsAbsent() {
        // 缺策略一律按最严（L3 = 每次确认）；"没写"绝不能等于"没限制"。
        ConnectorDescriptorGate.Validated validated = gate.validate(new ConnectorDescriptorGate.Input(
            "ent-demo", "示例", null, ConnectorEntry.Transport.MCP, "ent-demo",
            Map.of("transport", "stdio", "command", "npx"), List.of(capability()), null));
        assertEquals("L3", validated.policy().get("maxLevel"));
    }

    @Test
    void rejectsANonMcpDescriptorCarryingALiteralHeaderMapping() {
        // 深扫只看**键名**；mapping 形态的 headers 键名是普通头名 ⇒ 必须靠引用数组闸门拦住。
        ConnectorDeclarationException failure = assertThrows(ConnectorDeclarationException.class, () ->
            gate.validate(new ConnectorDescriptorGate.Input(
                "ent-http", "示例 HTTP", null, ConnectorEntry.Transport.HTTP, "ent-http",
                Map.of("url", "https://api.example.com", "headers", Map.of("Authorization", "Bearer literal")),
                List.of(capability()), null)));
        assertEquals(ConnectorDeclarationException.SECRET_INLINE, failure.errorCode());
    }

    @Test
    void copiesTheValidatedStructuresSoCallersCannotMutateThem() {
        Map<String, Object> descriptor = new LinkedHashMap<>(Map.of("transport", "stdio", "command", "npx"));
        ConnectorDescriptorGate.Validated validated = gate.validate(new ConnectorDescriptorGate.Input(
            "ent-demo", "示例", null, ConnectorEntry.Transport.MCP, "ent-demo",
            descriptor, List.of(capability()), null));
        descriptor.put("command", "rm -rf /");
        assertEquals("npx", validated.descriptor().get("command"));
        assertTrue(validated.descriptor().get("command") instanceof String);
    }

    private ConnectorDescriptorGate.Input input(Map<String, Object> descriptor) {
        return new ConnectorDescriptorGate.Input(
            "ent-demo", "示例连接器", "读一份演示数据。", ConnectorEntry.Transport.MCP, "ent-demo",
            descriptor, List.of(capability()), Map.of("maxLevel", "L2")
        );
    }

    /** §3.1 的九枚必填集都齐的一条最小声明。 */
    private static Map<String, Object> capability() {
        Map<String, Object> capability = new LinkedHashMap<>();
        capability.put("capabilityId", "ent-demo-read");
        capability.put("title", "示例只读能力");
        capability.put("stateAddress", Map.of("kind", "resource", "path", "documents/readme"));
        capability.put("effects", List.of("read"));
        capability.put("reversibility", "reversible");
        capability.put("blastRadius", "self");
        capability.put("transport", "mcp");
        capability.put("platformRequired", List.of(Map.of("platform", "android", "support", "supported")));
        capability.put("discovery", List.of("catalog"));
        return capability;
    }

    static List<Map<String, Object>> capabilities(int count) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int index = 0; index < count; index += 1) list.add(capability());
        return list;
    }
}
