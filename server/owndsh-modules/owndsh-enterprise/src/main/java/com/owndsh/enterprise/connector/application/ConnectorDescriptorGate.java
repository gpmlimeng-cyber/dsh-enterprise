/**
 * [INPUT]: 接收管理端已解析成 Map/List 的连接声明（JSON 解析归 web 层，本类**不依赖 Jackson**）。
 * [OUTPUT]: 提供 `validate(Input)` → `Validated`：形状/**取值域**归一化后的落库前事实，或抛 `ConnectorDeclarationException`。
 *          ★ 第二十三刀补齐：`effects`/`reversibility`/`blastRadius`/`transport`/`discovery`/`platformRequired`/`stateAddress`/
 *          `inbound`/`auditEvents`/`quota`/`egressAllowlist` 的**取值域**全部与宿主 `capability.ts` 同一把尺
 *          （此前只查"是不是非空数组"，取值域一个都没查 —— 服务端是台账与下发目录的权威侧，那是实质缺口）。
 * [POS]: connector/application 的**声明闸门**——bundle 侧 `ENT_CONNECTOR_SECRET_INLINE` / `ENT_CONNECTOR_LEVEL_DECLARED`
 *        两条纪律的服务端同一份实现（服务端不信任宿主侧校验过的输入，自己再判一次）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 *
 * ★ 2026-10-06（第二十九刀）编译闸门登记：本类此前有**一处 `QUOTA_KEYS` 重复定义**——:75 的旧两键版与
 *   :90 的四键版并存，`javac` 报「已在类中定义了变量」而**整个 enterprise 模块编译不过**（连带 5 条
 *   `@Slf4j` 的 `log` 找不到符号级联幻影，与本类无关）。已删旧版，两处引用本就解析到四键版 ⇒ **行为零变更**。
 *   ★**教训比"解析器不够用"更值得记**：上一刀用 `java-parser` 走完全部 567 个 .java 且**零失败**，
 *   而**重复字段这种错解析器根本看不见** ⇒「语法解析通过」**不等于**「编译通过」，
 *   本仓对 Java 侧的语法级验证**不得**当作编译验证登记。
 */
package com.owndsh.enterprise.connector.application;

import com.owndsh.enterprise.connector.domain.ConnectorEntry;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 连接声明的落库前闸门。
 *
 * 为什么服务端要**再实现一遍**宿主侧已经有的校验：宿主侧那一份保护的是"本机生成的 bundle"，
 * 服务端这一份保护的是"库里那一行 + 下发给所有员工的目录"。两者输入来源不同（一个是本机管理员，
 * 一个是中心 API），**不能互相代替**；两边的稳定码刻意同名，见各常量注释。
 *
 * 本类刻意不依赖 Jackson：调用方（web/application）负责把 JSON 解析成 `Map`/`List`，
 * 于是闸门的全部规则都能被纯单测覆盖（不需要数据库、不需要 Spring）。
 */
public final class ConnectorDescriptorGate {
    /** 单组凭据引用的条目上限（与 bundle 侧 `MAX_REFS` 同一个数）。 */
    public static final int MAX_REFS = 16;
    /** 一条连接的能力声明条数上限（防止一次请求塞进万条）。 */
    public static final int MAX_CAPABILITIES = 200;

    private static final Pattern CONNECTOR_ID = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final Pattern SERVER_NAME = Pattern.compile("^[A-Za-z0-9_-]{1,32}$");
    /**
     * 凭据键名：与官方 `dsh-credentials` 的 `REF_PATTERN`（POSIX 标识符，**不含 `-`/`.`**）以及
     * 宿主侧 `CONNECTOR_CREDENTIAL_KEY_PATTERN` 同一把尺。★ 2026-10-06（第十八刀）收紧：
     * 键名会被宿主写进 `!!js process.env.<键名>`，带 `-` 时 JS 会算成减法 ⇒ 旧语法能造出坏配置。
     */
    private static final Pattern CREDENTIAL_KEY = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]{0,63}$");
    private static final Pattern ENV_NAME = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]{0,63}$");
    private static final Pattern HEADER_NAME = Pattern.compile("^[A-Za-z][A-Za-z0-9-]{0,63}$");
    private static final Pattern CAPABILITY_ID = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    /** 条目里**任何**这些形状的键都判明文（与 bundle 侧 `readReferenceArray` 的正则逐字同义）。 */
    private static final Pattern SECRET_ISH_KEY = Pattern.compile("(?i)(value|secret|token|password|credential|api[_-]?key|access[_-]?key)");
    /**
     * 自贴权限等级的键：**键名命中即拒**（方案 §3.2 纪律 2）。
     *
     * ★ 2026-10-06（第二十二刀）与宿主侧对齐：宿主用的是 `LEVEL_CLAIM_PATTERN = /level|permission|tier/i`
     * （**含**这些词就判，大小写不敏感），而这里原来是"精确相等"的 `Set.of("level","permission","tier")`
     * ⇒ 同一份声明在两侧会拿到**两个不同的稳定码**（宿主 `ENT_CONNECTOR_LEVEL_DECLARED`、服务端
     * `ENT_CONNECTOR_DECLARATION_INVALID`）。两个实现是同一把尺的两次落地，故改成同一个正则。
     */
    private static final Pattern LEVEL_CLAIM = Pattern.compile("(?i)(level|permission|tier)");
    /** §3.1「最少必填集」九枚（与 `capability.ts` 的 `CONNECTOR_REQUIRED_DECLARATION_FIELDS` 逐字一致）。 */
    private static final List<String> REQUIRED_CAPABILITY_FIELDS = List.of(
        "capabilityId", "title", "stateAddress", "effects", "reversibility",
        "blastRadius", "transport", "platformRequired", "discovery"
    );
    /** 认得的全部能力声明键；未知键一律拒（与 `capability.ts` 的 `DECLARATION_KEYS` 同一份）。 */
    private static final Set<String> CAPABILITY_KEYS = Set.of(
        "capabilityId", "title", "stateAddress", "effects", "reversibility",
        "blastRadius", "transport", "platformRequired", "discovery",
        "summary", "authRef", "egressAllowlist", "quota", "inbound", "auditEvents"
    );
    private static final Set<String> POLICY_KEYS = Set.of("maxLevel", "quota");
    private static final Set<String> LEVELS = Set.of("L1", "L2", "L3");

    // ── ②（2026-10-06 第二十三刀）补齐与宿主**同一把尺**的取值域 ──
    // 起因：本闸门原来只查 `effects` "是不是非空数组"、其余取值域**一个都没查** ⇒ 库里能存进
    // `{effects:['frobnicate'], reversibility:'maybe', blastRadius:'galaxy'}` 这种没人能求值的东西，
    // 而服务端正是台账与下发目录的**权威侧**。宿主那侧（`capability.ts`）这些词表一直都查。
    private static final Set<String> EFFECTS = Set.of("read", "observe", "write", "send", "actuate");
    private static final Set<String> REVERSIBILITIES = Set.of("reversible", "compensable", "irreversible");
    private static final Set<String> BLAST_RADII = Set.of("self", "org", "external");
    private static final Set<String> INBOUNDS = Set.of("none", "webhook", "long-poll", "callback");
    private static final Set<String> DISCOVERIES = Set.of("mdns", "ssdp", "netscan", "ble-scan", "nfc-tap", "catalog", "manual");
    private static final Set<String> STATE_ADDRESS_KINDS = Set.of("object", "device", "field", "resource");
    private static final Set<String> HOST_PLATFORMS = Set.of("android", "darwin", "linux", "win32");
    private static final Set<String> PLATFORM_SUPPORTS = Set.of("supported", "needs-confirm", "unsupported");
    /** 配额键：与 `capability.ts:374` 的 `['maxCalls','windowSeconds','maxConcurrency','maxBytes']` 逐字一致。 */
    private static final Set<String> QUOTA_KEYS = Set.of("maxCalls", "windowSeconds", "maxConcurrency", "maxBytes");
    /** 审计动作名（`SCREAMING_SNAKE`）；与 `capability.ts` 的 `AUDIT_ACTION_PATTERN` 同尺。 */
    private static final Pattern AUDIT_ACTION = Pattern.compile("^[A-Z][A-Z0-9_]{1,63}$");
    /** 连接器 id 长度上限；与宿主 bundle.ts 的 `MAX_CONNECTOR_ID_LENGTH` 对齐（第二十七刀具名化，便于机械比对）。 */
    private static final int MAX_CONNECTOR_ID = 64;
    /** 能力 id 长度上限；与宿主 capability.ts 的 `MAX_CAPABILITY_ID_LENGTH` 对齐。 */
    private static final int MAX_CAPABILITY_ID = 64;
    private static final int MAX_STATE_PATH = 512;
    private static final int MAX_EGRESS_ENTRIES = 64;
    private static final int MAX_AUDIT_EVENTS = 64;
    /** 声明侧传输词表：**从 `ConnectorEntry.Transport` 派生**，保证枚举与闸门不会各说一套。 */
    private static final Set<String> DECLARED_TRANSPORTS = java.util.Arrays.stream(ConnectorEntry.Transport.values())
        .map(ConnectorEntry.Transport::wireValue)
        .collect(java.util.stream.Collectors.toUnmodifiableSet());
    private static final int MAX_DISPLAY_NAME = 120;
    private static final int MAX_SUMMARY = 2000;
    private static final int MAX_TITLE = 120;
    private static final int MAX_COMMAND = 1024;
    private static final int MAX_URL = 2048;
    private static final int MAX_ARGS = 64;
    private static final int MAX_ARG = 1024;

    /**
     * 管理端交来的原始声明。`descriptor` / `capabilities` / `policy` 是**已解析**的 JSON 结构。
     */
    public record Input(
        String connectorId,
        String displayName,
        String summary,
        ConnectorEntry.Transport transport,
        String serverName,
        Map<String, Object> descriptor,
        List<Map<String, Object>> capabilities,
        Map<String, Object> policy
    ) {
    }

    /** 归一化并判定通过后的结果：字符串已 trim、结构已深拷贝（调用方拿到的不会被后续改动影响）。 */
    public record Validated(
        String connectorId,
        String displayName,
        String summary,
        ConnectorEntry.Transport transport,
        String serverName,
        Map<String, Object> descriptor,
        List<Map<String, Object>> capabilities,
        Map<String, Object> policy
    ) {
    }

    public Validated validate(Input input) {
        Objects.requireNonNull(input, "input");
        String connectorId = requireText("connectorId", input.connectorId(), MAX_CONNECTOR_ID);
        if (!CONNECTOR_ID.matcher(connectorId).matches()) {
            throw ConnectorDeclarationException.invalid("connectorId 形状不合（小写字母/数字/连字符）");
        }
        String displayName = requireText("displayName", input.displayName(), MAX_DISPLAY_NAME);
        String summary = optionalText("summary", input.summary(), MAX_SUMMARY);
        Objects.requireNonNull(input.transport(), "transport");
        String serverName = requireText("serverName", input.serverName(), 32);
        if (!SERVER_NAME.matcher(serverName).matches()) {
            throw ConnectorDeclarationException.invalid("serverName 必须匹配官方命名空间 [A-Za-z0-9_-]{1,32}");
        }
        Map<String, Object> descriptor = requireMap("descriptor", input.descriptor());
        List<Map<String, Object>> capabilities = validateCapabilities(input.capabilities());
        Map<String, Object> policy = validatePolicy(input.policy());

        // 端点形状：MCP 两种传输按官方 schema 收窄；其余传输的逐字段形状属于后续刀（P1-5 等），
        // 本刀只保证"是对象、无明文、键认得"这三条，未知键一律拒而不是静默丢弃。
        validateEndpoint(input.transport(), descriptor);

        // 深扫：任何层级的这些键都判明文（覆盖端点、能力、策略三块）。
        scanForInlineSecrets("descriptor", descriptor);
        scanForInlineSecrets("capabilities", capabilities);
        scanForInlineSecrets("policy", policy);

        // 端点里引用的凭据键必须与能力声明里的 `authRef` 同一把尺（键名形状），
        // 否则"配置里的引用"与"声明里的引用"会是两个不同的东西。
        return new Validated(
            connectorId, displayName, summary, input.transport(), serverName,
            deepCopy(descriptor), List.copyOf(capabilities), deepCopy(policy)
        );
    }

    private void validateEndpoint(ConnectorEntry.Transport transport, Map<String, Object> descriptor) {
        if (transport != ConnectorEntry.Transport.MCP) {
            // 非 MCP 传输在本刀只做通用三件事（对象/无明文/键形状），逐字段形状留给各自适配器那一刀。
            for (String key : descriptor.keySet()) {
                if (!SAFE_ENDPOINT_KEYS.contains(key)) {
                    throw ConnectorDeclarationException.invalid("descriptor 携带未知键：" + key);
                }
            }
            // ★ 仍然要过「引用数组」闸门：深扫只看**键名**，而 headers 写成 mapping 时键名是普通头名
            // （Authorization 不含 token/secret 这些词）⇒ 只靠深扫会漏。这里按与 MCP 同一条尺判它。
            if (descriptor.containsKey("env")) readReferenceArray(descriptor.get("env"), "env", ENV_NAME);
            if (descriptor.containsKey("headers")) readReferenceArray(descriptor.get("headers"), "headers", HEADER_NAME);
            return;
        }
        Object rawTransport = descriptor.get("transport");
        if (!(rawTransport instanceof String endpointTransport)) {
            throw ConnectorDeclarationException.invalid("MCP descriptor 必须写 transport（stdio 或 streamable-http）");
        }
        switch (endpointTransport) {
            case "stdio" -> validateStdio(descriptor);
            case "streamable-http" -> validateHttp(descriptor);
            default -> throw ConnectorDeclarationException.invalid("MCP transport 只允许 stdio 或 streamable-http（无 sse）");
        }
    }

    /** 非 MCP 传输在本刀允许的端点键（够表达待接的 IM/邮件/HTTP 类连接）。 */
    private static final Set<String> SAFE_ENDPOINT_KEYS = Set.of(
        "transport", "url", "method", "command", "args", "env", "cwd", "headers",
        "host", "port", "path", "topic", "username", "namespace"
    );

    private void validateStdio(Map<String, Object> descriptor) {
        for (String key : descriptor.keySet()) {
            if (!Set.of("transport", "command", "args", "env", "cwd").contains(key)) {
                throw ConnectorDeclarationException.invalid("stdio descriptor 携带未知键：" + key);
            }
        }
        requireText("descriptor.command", descriptor.get("command"), MAX_COMMAND);
        Object args = descriptor.get("args");
        if (args != null) {
            if (!(args instanceof List<?> list)) {
                throw ConnectorDeclarationException.invalid("descriptor.args 必须是数组");
            }
            if (list.size() > MAX_ARGS) throw ConnectorDeclarationException.invalid("descriptor.args 条目过多");
            for (Object item : list) {
                if (!(item instanceof String text)) {
                    throw ConnectorDeclarationException.invalid("descriptor.args 每一项都必须是字符串");
                }
                requireText("descriptor.args[]", text, MAX_ARG);
            }
        }
        readReferenceArray(descriptor.get("env"), "env", ENV_NAME);
        Object cwd = descriptor.get("cwd");
        if (cwd != null) requireText("descriptor.cwd", cwd, 1024);
    }

    private void validateHttp(Map<String, Object> descriptor) {
        for (String key : descriptor.keySet()) {
            if (!Set.of("transport", "url", "headers").contains(key)) {
                throw ConnectorDeclarationException.invalid("streamable-http descriptor 携带未知键：" + key);
            }
        }
        String url = requireText("descriptor.url", descriptor.get("url"), MAX_URL);
        if (!url.startsWith("https://") && !url.startsWith("http://")) {
            throw ConnectorDeclarationException.invalid("descriptor.url 必须是 http(s) 绝对地址");
        }
        readReferenceArray(descriptor.get("headers"), "headers", HEADER_NAME);
    }

    /**
     * 读一组凭据引用；**任何**"直接写值"的形状都在这里被拒（与 bundle 侧 `readReferenceArray` 逐条同义）。
     *
     * @return 归一化后的引用清单（`null` 表示这一组没写）
     */
    private List<Map<String, Object>> readReferenceArray(Object value, String label, Pattern namePattern) {
        if (value == null) return null;
        if (!(value instanceof List<?> list)) {
            if (value instanceof Map<?, ?> map && !map.isEmpty()) {
                // 对象映射（`{ GITHUB_TOKEN: 'ghp_…' }`）正是"把机密抄进配置"的旧写法 ⇒ 明确判它。
                throw ConnectorDeclarationException.secretInline(label + " 只允许写引用（name/key），不允许写值");
            }
            throw ConnectorDeclarationException.invalid(label + " 必须是引用数组");
        }
        if (list.isEmpty()) throw ConnectorDeclarationException.invalid(label + " 不能是空数组");
        if (list.size() > MAX_REFS) throw ConnectorDeclarationException.invalid(label + " 条目过多");
        Set<String> seen = new LinkedHashSet<>();
        List<Map<String, Object>> refs = new ArrayList<>();
        for (Object entry : list) {
            if (entry instanceof String) {
                throw ConnectorDeclarationException.secretInline(label + " 的条目是裸字符串；请改写成凭据引用");
            }
            if (!(entry instanceof Map<?, ?> rawEntry)) {
                throw ConnectorDeclarationException.invalid(label + " 的条目必须是对象");
            }
            for (Object rawKey : rawEntry.keySet()) {
                String key = String.valueOf(rawKey);
                if (key.equals("name") || key.equals("key") || key.equals("scheme")) continue;
                if (SECRET_ISH_KEY.matcher(key).find()) {
                    throw ConnectorDeclarationException.secretInline(label + " 的条目携带 " + key);
                }
                throw ConnectorDeclarationException.invalid(label + " 的条目携带未知键：" + key);
            }
            String name = requireText(label + ".name", rawEntry.get("name"), 64);
            if (!namePattern.matcher(name).matches()) {
                throw ConnectorDeclarationException.invalid(label + ".name 形状不合");
            }
            String keyName = requireText(label + ".key", rawEntry.get("key"), 64);
            if (!CREDENTIAL_KEY.matcher(keyName).matches()) {
                throw ConnectorDeclarationException.invalid(label + ".key 必须是凭据键名（标识符形状）");
            }
            Object scheme = rawEntry.get("scheme");
            if (scheme != null) {
                if (!"Bearer".equals(scheme)) {
                    throw ConnectorDeclarationException.invalid(label + ".scheme 只允许 Bearer");
                }
                if (label.equals("env")) {
                    throw ConnectorDeclarationException.invalid("env 条目必须是裸引用；Bearer 只用于 http headers");
                }
            }
            if (!seen.add(name)) throw ConnectorDeclarationException.invalid(label + " 重复引用了 " + name);
            Map<String, Object> ref = new LinkedHashMap<>();
            ref.put("name", name);
            ref.put("key", keyName);
            if (scheme != null) ref.put("scheme", "Bearer");
            refs.add(Map.copyOf(ref));
        }
        return refs;
    }

    /** 取值域校验：值必须是非空字符串且在集合内（宿主侧 `requireEnum` 的同一条尺）。 */
    private static void requireEnumValue(String field, Object value, Set<String> allowed) {
        if (!(value instanceof String text) || !allowed.contains(text)) {
            throw ConnectorDeclarationException.invalid(field + " 取值不在允许集合内");
        }
    }

    /** 非空枚举**集合**校验：逐成员在集合内、不重复（宿主侧 `requireEnumSet` 同尺）。 */
    private static void requireEnumList(String field, Object value, Set<String> allowed) {
        if (!(value instanceof List<?> list) || list.isEmpty()) {
            throw ConnectorDeclarationException.invalid(field + " 不能是空集");
        }
        Set<String> seen = new LinkedHashSet<>();
        for (Object item : list) {
            if (!(item instanceof String text) || !allowed.contains(text)) {
                throw ConnectorDeclarationException.invalid(field + " 取值不在允许集合内");
            }
            if (!seen.add(text)) throw ConnectorDeclarationException.invalid(field + " 重复取值：" + text);
        }
    }

    /** `platformRequired`：非空数组、每条只带 platform/support、平台不重复（宿主侧同尺）。 */
    private static void requirePlatformRequirements(Object value) {
        if (!(value instanceof List<?> list) || list.isEmpty()) {
            throw ConnectorDeclarationException.invalid("capability.platformRequired 必须是非空数组");
        }
        Set<String> seen = new LinkedHashSet<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> raw)) {
                throw ConnectorDeclarationException.invalid("capability.platformRequired 的条目必须是对象");
            }
            for (Object rawKey : raw.keySet()) {
                String key = String.valueOf(rawKey);
                if (!key.equals("platform") && !key.equals("support")) {
                    throw ConnectorDeclarationException.invalid("capability.platformRequired 条目携带未知键：" + key);
                }
            }
            requireEnumValue("platformRequired.platform", raw.get("platform"), HOST_PLATFORMS);
            requireEnumValue("platformRequired.support", raw.get("support"), PLATFORM_SUPPORTS);
            if (!seen.add(String.valueOf(raw.get("platform")))) {
                throw ConnectorDeclarationException.invalid("capability.platformRequired 重复声明平台：" + raw.get("platform"));
            }
        }
    }

    /** `stateAddress`：只认 kind/path 两键、kind 在集合内、path 非空有上限（宿主侧同尺）。 */
    private static void readStateAddress(Object value) {
        if (!(value instanceof Map<?, ?> raw)) {
            throw ConnectorDeclarationException.invalid("capability.stateAddress 必须是对象");
        }
        for (Object rawKey : raw.keySet()) {
            String key = String.valueOf(rawKey);
            if (!key.equals("kind") && !key.equals("path")) {
                throw ConnectorDeclarationException.invalid("capability.stateAddress 携带未知键：" + key);
            }
        }
        requireEnumValue("stateAddress.kind", raw.get("kind"), STATE_ADDRESS_KINDS);
        requireText("stateAddress.path", raw.get("path"), MAX_STATE_PATH);
    }

    /** `auditEvents`：`SCREAMING_SNAKE`、条数上限、不重复（宿主侧同尺）。 */
    private static void requireAuditEvents(Object value) {
        if (!(value instanceof List<?> list) || list.isEmpty()) {
            throw ConnectorDeclarationException.invalid("capability.auditEvents 不能是空数组");
        }
        if (list.size() > MAX_AUDIT_EVENTS) {
            throw ConnectorDeclarationException.invalid("capability.auditEvents 条目过多");
        }
        Set<String> seen = new LinkedHashSet<>();
        for (Object item : list) {
            if (!(item instanceof String text) || !AUDIT_ACTION.matcher(text).matches()) {
                throw ConnectorDeclarationException.invalid("capability.auditEvents 只收 SCREAMING_SNAKE 形状");
            }
            if (!seen.add(text)) throw ConnectorDeclarationException.invalid("capability.auditEvents 重复：" + text);
        }
    }

    /** `quota`：只认四键、每项正整数、至少写一项（宿主侧同尺；"没写"不等于"没限制"）。 */
    private static void requireQuota(Object value) {
        if (!(value instanceof Map<?, ?> raw)) {
            throw ConnectorDeclarationException.invalid("capability.quota 必须是对象");
        }
        int provided = 0;
        for (Object rawKey : raw.keySet()) {
            String key = String.valueOf(rawKey);
            if (!QUOTA_KEYS.contains(key)) {
                throw ConnectorDeclarationException.invalid("capability.quota 携带未知键：" + key);
            }
            Object candidate = raw.get(rawKey);
            if (candidate == null) continue;
            if (!(candidate instanceof Number number) || number.longValue() <= 0
                || number.doubleValue() != Math.floor(number.doubleValue())) {
                throw ConnectorDeclarationException.invalid("capability.quota." + key + " 必须是正整数");
            }
            provided += 1;
        }
        if (provided == 0) throw ConnectorDeclarationException.invalid("capability.quota 至少要写一项");
    }

    /** `egressAllowlist`：非空小写裸主机/CIDR、不许通配与 scheme/路径/凭据、不重复（宿主侧同尺）。 */
    private static void requireEgressAllowlist(Object value) {
        if (!(value instanceof List<?> list) || list.isEmpty()) {
            throw ConnectorDeclarationException.invalid("capability.egressAllowlist 必须是非空数组");
        }
        if (list.size() > MAX_EGRESS_ENTRIES) {
            throw ConnectorDeclarationException.invalid("capability.egressAllowlist 条目过多");
        }
        Set<String> seen = new LinkedHashSet<>();
        for (Object item : list) {
            if (!(item instanceof String text) || text.isBlank()) {
                throw ConnectorDeclarationException.invalid("capability.egressAllowlist 条目必须是非空字符串");
            }
            String host = text.trim();
            if (!host.equals(host.toLowerCase(java.util.Locale.ROOT))) {
                throw ConnectorDeclarationException.invalid("capability.egressAllowlist 条目必须小写");
            }
            if (host.contains("*")) {
                throw ConnectorDeclarationException.invalid("capability.egressAllowlist 不许通配（等于没有白名单）");
            }
            if (host.contains("://") || host.matches(".*[\\s/\\\\@].*")) {
                throw ConnectorDeclarationException.invalid("capability.egressAllowlist 只收裸主机或 CIDR");
            }
            if (!seen.add(host)) throw ConnectorDeclarationException.invalid("capability.egressAllowlist 重复：" + host);
        }
    }

    private List<Map<String, Object>> validateCapabilities(List<Map<String, Object>> capabilities) {
        if (capabilities == null || capabilities.isEmpty()) {
            throw ConnectorDeclarationException.invalid("capabilities 不能为空");
        }
        if (capabilities.size() > MAX_CAPABILITIES) {
            throw ConnectorDeclarationException.invalid("capabilities 条目过多");
        }
        List<Map<String, Object>> validated = new ArrayList<>(capabilities.size());
        for (Map<String, Object> declaration : capabilities) {
            if (declaration == null) throw ConnectorDeclarationException.invalid("capability 必须是对象");
            for (String key : declaration.keySet()) {
                if (LEVEL_CLAIM.matcher(key).find()) throw ConnectorDeclarationException.levelDeclared(key);
                if (!CAPABILITY_KEYS.contains(key)) {
                    throw ConnectorDeclarationException.invalid("capability 携带未知键：" + key);
                }
            }
            for (String required : REQUIRED_CAPABILITY_FIELDS) {
                if (!declaration.containsKey(required) || declaration.get(required) == null) {
                    throw ConnectorDeclarationException.invalid("capability 缺必填字段：" + required);
                }
            }
            String capabilityId = requireText("capabilityId", declaration.get("capabilityId"), MAX_CAPABILITY_ID);
            if (!CAPABILITY_ID.matcher(capabilityId).matches()) {
                throw ConnectorDeclarationException.invalid("capabilityId 形状不合（小写字母/数字/连字符）");
            }
            requireText("capability.title", declaration.get("title"), MAX_TITLE);
            // ★ 同上：present 就按必填文本判（null/空串/非字符串一律拒），与宿主 optionalText 同一把尺。
            if (declaration.containsKey("summary")) {
                requireText("capability.summary", declaration.get("summary"), MAX_SUMMARY);
            }
            Object effects = declaration.get("effects");
            if (!(effects instanceof List<?> effectList) || effectList.isEmpty()) {
                // 空集会让"只读"判据**空集真** ⇒ 什么都不做的东西自动放行（bundle 侧同一条理由）。
                throw ConnectorDeclarationException.invalid("capability.effects 不能是空集");
            }
            requireEnumValue("capability.reversibility", declaration.get("reversibility"), REVERSIBILITIES);
            requireEnumValue("capability.blastRadius", declaration.get("blastRadius"), BLAST_RADII);
            requireEnumValue("capability.transport", declaration.get("transport"), DECLARED_TRANSPORTS);
            requireEnumList("capability.effects", effectList, EFFECTS);
            requireEnumList("capability.discovery", declaration.get("discovery"), DISCOVERIES);
            requirePlatformRequirements(declaration.get("platformRequired"));
            readStateAddress(declaration.get("stateAddress"));
            // ★ 第二十四刀：宿主侧"只有 undefined 算没写"，显式 null 会走到校验里被拒 ⇒ 这里不再用 != null 把它当缺省。
            if (declaration.containsKey("inbound")) {
                requireEnumValue("capability.inbound", declaration.get("inbound"), INBOUNDS);
            }
            // ★ 第二十四刀：宿主侧"只有 undefined 算没写"，显式 null 会走到校验里被拒 ⇒ 这里不再用 != null 把它当缺省。
            if (declaration.containsKey("auditEvents")) {
                requireAuditEvents(declaration.get("auditEvents"));
            }
            // ★ 第二十四刀：宿主侧"只有 undefined 算没写"，显式 null 会走到校验里被拒 ⇒ 这里不再用 != null 把它当缺省。
            if (declaration.containsKey("quota")) {
                requireQuota(declaration.get("quota"));
            }
            // ★ 第二十四刀：宿主侧"只有 undefined 算没写"，显式 null 会走到校验里被拒 ⇒ 这里不再用 != null 把它当缺省。
            if (declaration.containsKey("egressAllowlist")) {
                requireEgressAllowlist(declaration.get("egressAllowlist"));
            }
            if (declaration.containsKey("authRef")) {
                String authRef = requireText("capability.authRef", declaration.get("authRef"), 64);
                if (!CREDENTIAL_KEY.matcher(authRef).matches()) {
                    throw ConnectorDeclarationException.invalid("capability.authRef 必须是凭据键名（标识符形状）");
                }
            }
            validated.add(deepCopy(declaration));
        }
        return validated;
    }

    private Map<String, Object> validatePolicy(Map<String, Object> policy) {
        if (policy == null) return Map.of("maxLevel", "L3");
        for (String key : policy.keySet()) {
            if (!POLICY_KEYS.contains(key)) {
                throw ConnectorDeclarationException.invalid("policy 携带未知键：" + key);
            }
        }
        Object maxLevel = policy.get("maxLevel");
        if (maxLevel == null) throw ConnectorDeclarationException.invalid("policy.maxLevel 必填（L1/L2/L3）");
        if (!(maxLevel instanceof String level) || !LEVELS.contains(level)) {
            throw ConnectorDeclarationException.invalid("policy.maxLevel 只允许 L1/L2/L3");
        }
        Object quota = policy.get("quota");
        if (quota != null) {
            if (!(quota instanceof Map<?, ?> rawQuota)) {
                throw ConnectorDeclarationException.invalid("policy.quota 必须是对象");
            }
            for (Object rawKey : rawQuota.keySet()) {
                String key = String.valueOf(rawKey);
                if (!QUOTA_KEYS.contains(key)) {
                    throw ConnectorDeclarationException.invalid("policy.quota 携带未知键：" + key);
                }
                Object value = rawQuota.get(rawKey);
                if (!(value instanceof Number number) || number.longValue() < 0) {
                    throw ConnectorDeclarationException.invalid("policy.quota." + key + " 必须是非负整数");
                }
            }
        }
        return deepCopy(policy);
    }

    /** 递归深扫：任何层级的机密形状键名都判明文（值本身**绝不**出现在异常或日志里）。 */
    private void scanForInlineSecrets(String label, Object node) {
        if (node instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (SECRET_ISH_KEY.matcher(key).find()) {
                    throw ConnectorDeclarationException.secretInline(label + "." + key);
                }
                scanForInlineSecrets(label + "." + key, entry.getValue());
            }
            return;
        }
        if (node instanceof List<?> list) {
            int index = 0;
            for (Object item : list) {
                scanForInlineSecrets(label + "[" + index + "]", item);
                index += 1;
            }
        }
    }

    /**
     * 必填文本。★ 2026-10-06（第二十四刀）改成**吃原始值并自己判类型**：此前调用方一律先把值转成字符串（`asString`），于是"给了个数字"会退化成 null 而被报成"必填"
     * （结果仍拒，但信息误导）；
     * 更糟的是可选字段那条 —— 见 `optionalText`。
     */
    private static String requireText(String field, Object value, int maxLength) {
        if (value == null) throw ConnectorDeclarationException.invalid(field + " 必填");
        if (!(value instanceof String text)) throw ConnectorDeclarationException.invalid(field + " 必须是字符串");
        String trimmed = text.trim();
        if (trimmed.isEmpty()) throw ConnectorDeclarationException.invalid(field + " 不能为空");
        // 长度按**原始串**判，与宿主 `value.length > max` 同界（trim 只用于归一化落库值）。
        if (text.length() > maxLength) throw ConnectorDeclarationException.invalid(field + " 过长");
        return trimmed;
    }

    /**
     * 可选文本。★ 第二十四刀抓到的**第三处双实现分歧**就在这个函数：原来调用方先 `...`，
     * 非字符串（如 `summary: 42`）会变成 null 被当成"没写"——**静默丢弃用户给的东西**，
     * 而宿主侧 `optionalText` 走的是 `requireText`（非字符串**抛**）。
     * ⇒ 现在两处都按"类型不对就拒"处理，与宿主同一把尺。
     */
    private static String optionalText(String field, Object value, int maxLength) {
        if (value == null) return null;
        if (!(value instanceof String text)) throw ConnectorDeclarationException.invalid(field + " 必须是字符串");
        String trimmed = text.trim();
        if (trimmed.length() > maxLength) throw ConnectorDeclarationException.invalid(field + " 过长");
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Map<String, Object> requireMap(String field, Map<String, Object> value) {
        if (value == null) throw ConnectorDeclarationException.invalid(field + " 必填");
        return value;
    }

    /** 深拷贝（Map/List/String/Number/Boolean），保证落库前的对象与调用方后续改动无关。 */
    @SuppressWarnings("unchecked")
    private static <T> T deepCopy(T value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                copy.put(String.valueOf(entry.getKey()), deepCopy(entry.getValue()));
            }
            // 刻意用 unmodifiableMap 而不是 Map.copyOf：声明的可选字段常显式写 null（形如 summary 的 null），
            // Map.copyOf 会以 NPE 拒掉它 —— 那是「非法输入」而不是「形状错误」，会把 4xx 变成 500。
            return (T) Collections.unmodifiableMap(copy);
        }
        if (value instanceof List<?> list) {
            List<Object> copy = new ArrayList<>(list.size());
            for (Object item : list) copy.add(deepCopy(item));
            return (T) List.copyOf(copy);
        }
        return value;
    }
}
