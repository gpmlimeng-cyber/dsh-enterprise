<!--
[INPUT]: 依赖用户对连接器的目标条文（docs/notes/connector-vision.md：万能连接 · 三层权限 · 必须满足 dsh 插件规范 ·
         跨平台两层）与产品宪法（docs/notes/product-charter.md：人人可用/极易上手/企业级 + 术语降维表），
         并参考 docs/plan/enterprise-presets.md 的结构与「引用 vs 快照」口径；
         官方规范以本机会话技能 cordis-plugin-development（含 references/host-plugin.md、references/mcp-bundle.md）
         为准，官方能力面取证于本机安装目录 /data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/
         （版本 0.2.0-rc.2，package.json:4）下的 node_modules/@deepseek-ai/*。
[OUTPUT]: 给出连接器（万能连接）的架构方案：公理与推导、三层架构（跨平台内核 / 主机能力面 / 企业侧）、
          能力的形式化描述与 L1/L2/L3 可执行判据、六类连接的适配规格（含 IM/邮件入站拓扑）、
          中国开箱即用清单、企业端配置/集成/部署、P0/P1/P2 人日与前置依赖、开放问题/明确不做/不确定项。
          ★ §7 另含 **P0-1/P0-2 的落地登记**（2026-10-06，落点 `plugin/packages/bundle/src/connector/`）
          与 §3.2/§3.3 **两处自相矛盾**的取严处置（实现取严的一侧，建议回写本节）。
[POS]: docs/plan 下的方案文档（**只规划、不实现、不改任何源文件**）。与 docs/notes/connector-vision.md 不冲突，
       是它的第一份落地方案；跨平台部分落实 connector-vision.md §6，插件规范部分落实其 §5 的七条合规清单。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md。
-->

# 连接器架构 · 方案（万能连接 · 三层权限 · 官方插件规范 · 跨平台两层）

> **本文只出方案，不写代码、不改任何源文件、不新增依赖、不部署、不提交。**
> 取证纪律：仓库事实给 `路径:行号`；官方能力给 **包名 + 文件 + 行号**（本机安装目录，只读）；外部资料给 URL；
> 取不到就写「未取到（原因）」。**不编造**规范版本号、字段名、端点、能力清单。
> 需要真机验证才能定的事，一律进 §8.3「不确定项」，不用推断冒充事实。

---

## 0. 一句话结论

**连接器 = 一个跨平台内核（能力模型 + 网络类适配器 + 发现 + 策略/同意 + 审计）+ 一张按平台实现的宿主能力面 + 一套企业侧账本；
它对用户只呈现「连接」一个概念，对官方只呈现「一个 bundle/plugin」一种交付形态。**

- **能今天开工的部分很大**：网络类六类连接（MCP · HTTP/OpenAPI · A2A · ACP · IM · 邮件）全部落在**平台无关层**，
  其中 MCP 有官方运行时可直接复用、IM 入站有官方原语 `ctx.webhookRuntime`、凭据有官方引用式保管面（§2、§4）。
- **必须自己补的部分明确**：官方**没有** A2A 实现、**没有** OpenAPI→工具适配器、**没有**邮件包、**没有**入站去重（§4、§8.3）。
- **今天做不到的能力也明确**：宿主（手机/桌面）**不能**作为公网入站端点；近场能力（蓝牙/NFC/USB/串口）在无 GUI 服务器宿主上
  只能是「本平台不支持」；A2A 在 0.2.0-rc.2 上需自建适配器（§7 已单列）。
- **唯一的合规交付形态**：官方 bundle/plugin + `dsh.bundle.patch` + `cordis.patch.yml`，走官方 `plugin_manager` 安装面；
  出站能力**优先生成官方 MCP 配置**；对自己的适配器框架**不对用户暴露第二套概念**（§2.4）。

---

## 1. 公理与推导（第一性原理）

> 本节给 7 条公理，每条直接推出**一条设计约束**。后文任何设计都能回指到这里；无法回指的条目视为无依据。

### 公理 1 · 能力 = 可读写状态集合

**表述**：一个"能力"不是一段代码、不是一个端点、也不是一个工具名，而是**一组可被寻址、可被读或写的状态**。
"查天气"是一组只读状态；"开会议室的门"是一个只写、且改变物理世界状态的写入。

**推出约束 C1**：任何能力的描述必须同时给出**状态寻址**与**效果声明**；
只登记一个 URL 或一个工具名，**不构成**一个可治理的能力。

**依据**：`docs/notes/connector-vision.md:38`（每个能力都要声明：读什么 · 写什么 · 会不会动物理世界）。

### 公理 2 · 信任不能来自扫描

**表述**：我们无法审查第三方内容的语义，也不打算假装能审。信任不可能是"扫出来的"，
只能是**看得见的清单 + 装前告知 + 装后可撤回 + 权限约束**四件事的乘积。

**推出约束 C2**：装前逐项列出"它能读/写/发什么"（含物理世界影响）+ 免责说明 + 装后可停用/卸载；
**禁止**任何"已通过安全检测"类文案。

**依据**：`docs/notes/connector-vision.md:60`（我们不做内容安全扫描，社区事实标准同样如此）；
`docs/notes/connector-vision.md:58`（装前可见 + 免责 + 可撤回）。

### 公理 3 · 传输是可替换细节

**表述**：同一个能力（"读这个温度"）可以经 MQTT、经 HTTP、经本机蓝牙到达。
传输变、能力语义不变；因此传输**不该**出现在能力模型的核心，也不该决定权限。

**推出约束 C3**：适配器只做"能力 ↔ 传输"的双向映射，不拥有策略、不拥有 UI、不拥有审计语义；
出站能力**优先生成官方 MCP 配置**而不是新造一个运行时。

**依据**：`docs/notes/connector-vision.md:26`（加一个协议 = 写一个适配器，上层不变）；
`docs/notes/connector-vision.md:48`（出站优先官方 MCP/工具配置，不另造运行时）。

### 公理 4 · 权限的真实轴是「不可逆性 × 影响半径」

**表述**：权限的真实分界**不是**"读 vs 写"。一个可撤销的写（改自己的通知开关）与一个不可撤销的写
（给客户群发短信）在"写"这个字面上完全一样，但风险差了几个数量级。真正的两个轴是：
**① 可逆性**（能不能撤回/补偿）与 **② 影响半径**（只影响自己 / 影响组织内 / 影响组织外的第三方或物理世界）。

**推出约束 C4**：L1/L2/L3 必须是这两个轴的**计算结果**，而不是按协议、按厂商、按"是不是 MCP"来贴标签；
不可逆或影响外部第三方的动作，**绝不允许"装一次就永久放行"**。

**依据**：`docs/notes/connector-vision.md:40-44`（L1 只读 / L2 可逆写 / L3 不可逆物理动作；
"不可逆动作绝不允许装一次就永久放行"）。

### 公理 5 · 企业要的是策略，而不是开关

**表述**：管理员面对 N 个部门 × M 个平台 × K 个连接，手工拨开关必然失效且无法审计。
企业真正需要的是**一条可裁决的规则**（谁能连什么、在什么条件下、到什么程度），
员工侧只看到"已接好的系统"这一个结果。

**推出约束 C5**：连接的允许/拒绝必须是**策略求值**（角色 × 可见范围 × 平台 × 能力等级 × 额度），
不是"启用/禁用"两个态；策略对管理员可见、对员工隐形。

**依据**：`docs/notes/product-charter.md:20-24`（核心张力与解法：治理对管理员可见、对员工隐形；
企业级 = 可控、可审计、可治理、可撤回）。

### 公理 6 · 发现优于配置

**表述**："开箱即用"的来源是**自动发现**，不是让用户填地址、填端口、填 token。
要求用户先理解端点，就已经违反了产品宪法。

**推出约束 C6**：每条连接器上线必须同时交付**发现方式**（局域网 mDNS/SSDP/网段探测 · 近场扫描 · 云端内置目录）；
内部清单把认证与端点包好，用户侧只做"选择 + 同意"。

**依据**：`docs/notes/connector-vision.md:29-35`（开箱即用来自自动发现；UI 上必须先"看得见"再决定连不连）；
`docs/notes/product-charter.md:28-30`（默认即最佳 · 一步即达）。

### 公理 7 · 内核必须无平台

**表述**：网络类能力天然平台无关（TCP 在哪都一样）；近场能力**天然带平台**（BLE 在 Android 是 Android API、
在 Windows 是 WinRT、在 Linux 是 BlueZ）。把两者放进同一层，就等于把内核绑死在一个操作系统上。

**推出约束 C7**：核心层 **100% 平台无关**、条件加载平台模块（禁止静态 import）；平台专有能力一律走统一抽象
`HostCapability` 之后的按平台实现，且每个能力必须回答**三态**：**可用 / 需用户手动确认 / 本平台不支持**；
"不支持"必须显式呈现，**不允许静默失败**。

**依据**：`docs/notes/connector-vision.md:90-108`（第一层禁止 import 平台专有模块 · 第二层 `HostCapability` · 三态）；
`docs/notes/connector-vision.md:106`（核心层必须在没有平台垫片的情况下也能编译与运行）。

### 公理 → 约束对照表

| # | 公理 | 推出的设计约束 | 落到本文哪一节 |
|---|---|---|---|
| 1 | 能力 = 可读写状态集合 | C1 必须声明状态寻址 + 效果，不只登记端点/工具名 | §3.1 |
| 2 | 信任不能来自扫描 | C2 装前清单 + 告知 + 可撤回，禁止"已检测"话术 | §2.3、§6.5 |
| 3 | 传输是可替换细节 | C3 适配器只做映射；出站优先官方 MCP 运行时 | §2.1、§4.1 |
| 4 | 权限 = 不可逆性 × 影响半径 | C4 L1/L2/L3 由两轴计算；不可逆动作不得永久放行 | §3.2、§3.3 |
| 5 | 企业要策略而非开关 | C5 策略求值替代二态开关；治理对员工隐形 | §2.3、§6.3 |
| 6 | 发现优于配置 | C6 每条连接器必须交付发现方式 + 内置目录 | §2.1、§5 |
| 7 | 内核必须无平台 | C7 内核零平台依赖；HostCapability 三态显式呈现 | §2.2、§7 |

---

## 2. 架构：三层

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ 第三层 · 企业侧（服务端 / 控制台）                                         │
│   凭据保管 · 授权范围 · 观测与审计 · 目录与市场条目                          │
│   ← 公理 5（策略）、公理 2（信任）                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ 第二层 · 主机能力面（HostCapability 抽象 + 按平台实现 + 三态）               │
│   Android / Windows / macOS / Linux / 无 GUI 服务器宿主                    │
│   ← 公理 7（内核无平台）                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ 第一层 · 跨平台内核（100% 平台无关，禁止 import 平台专有模块）               │
│   能力模型 · 网络类适配器 · 网络发现 · 策略/同意 · 审计与观测                │
│   ← 公理 1、3、4、6                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 第一层 · 跨平台内核

**包含什么**

| 部件 | 内容 |
|---|---|
| 能力模型 | §3.1 的能力描述、能力注册表、能力 → 传输的解析（公理 1） |
| 网络类适配器 | MCP 客户端方向 · HTTP/OpenAPI · A2A · ACP · IM/webhook · 邮件 ·（后续）MQTT/SSE/WebSocket（公理 3） |
| 网络发现 | mDNS/DNS-SD · SSDP/UPnP 广播 · 网段探测 · 云端服务商目录读取（公理 6） |
| 策略与同意 | 策略求值器（§3.2/§3.3）+ 首次同意与变更重确认（公理 4、5） |
| 审计与观测 | 统一事件出口：谁连了什么、读了什么、写了什么、谁同意的、失败码（公理 2） |

**由哪条公理推出**：公理 1（能力模型）· 公理 3（适配器与传输解耦）· 公理 4（策略判据）· 公理 6（发现）。

**与官方规范如何对齐**

1. **交付形态 = 官方 bundle/plugin**：内核自己就是一个 bundle —— `package.json` 声明 `dsh.bundle.patch`，
   patch 文件插入插件行；"a bundle is a package whose `package.json` declares `dsh.bundle.patch`"
   （官方技能 `references/host-plugin.md:3`）；manifest 样例见同文件 `:9-18`，patch 方言样例见 `:20-27`。
2. **只用官方生命周期与 `ctx.*` 服务**：Host 插件导出 `export function apply(ctx, config)`
   或默认导出 service class，资源必须 `ctx.effect`/`ctx.on` 注册并返回清理
   （`references/host-plugin.md:47-54`）。**不私改官方包、不 fork、不做影子注册**。
3. **出站优先复用官方 MCP 运行时**：不写第二个 MCP 客户端；连接 = 生成一份官方 MCP 连接配置
   （配置型 bundle，`references/mcp-bundle.md:3`：插入已安装的 `@deepseek-ai/dsh-mcp-client`，字段
   `serverName` / `transport` / `url` / `failOnStartupError`）。
4. **`@deepseek-ai/*` 一律 peer 依赖**：仓库既有先例是 `peerDependencies` 上写显式区间
   `>=0.1.5-rc.2 <0.3.0`（`plugin/packages/bundle/package.json:58-66`，`plugin/packages/bundle/CLAUDE.md:8`）。
5. **发现层是自研的、但对外仍是"一个官方插件"**：我们的发现/能力注册代码只是插件内部实现，
   对外表现 = "一个官方插件 + 它声明的能力"（`docs/notes/connector-vision.md:77-78`）。
6. **内核层禁止 import 平台专有模块**：平台模块只能条件加载；官方 patch 方言已支持条件表达式
   （`disabled` 接受布尔/null/`!!js`）——`docs/plan/enterprise-presets.md:173` 记录了这一方言；本机实证用法
   `disabled: !!js process.platform === 'win32'` 见 `docs/plan/enterprise-presets.md:179`。

### 2.2 第二层 · 主机能力面

**包含什么**

| 项 | 内容 |
|---|---|
| 统一抽象 | `HostCapability`：一个能力在**本宿主**上是否可用的唯一问询面 |
| 三态 | **可用** / **需用户手动确认**（权限、配对、弹窗）/ **本平台不支持**（显式呈现，不静默失败） |
| 首期能力族 | 蓝牙/BLE · NFC · USB/串口 · 通知 · 传感器 · 摄像头 · 麦克风 · 定位 · 剪贴板 · 短信/电话 |
| 平台实现 | Android：宿主 API / Shizuku / 无障碍（本机已有先例）· Windows：WinRT/WinUSB/Bluetooth API · macOS：CoreBluetooth/IOKit · Linux：BlueZ/udev · **无 GUI 服务器宿主：逐项声明不支持** |

**由哪条公理推出**：公理 7（内核必须无平台）。近场能力天然带平台，必须隔离在这一层之后。

**与官方规范如何对齐**

1. **不引入第二套安装器**：宿主能力面同样是一个（或多个）官方 bundle，安装只走官方
   `plugin_manager` 的 `install_bundle`；官方明确 "`install_bundle` performs package installation and bundle selection;
   do not reproduce those steps with shell commands"（`references/host-plugin.md:58`）。
2. **平台差异用官方条件加载表达**，不用"两份代码分叉"：同一份 patch 里用 `!!js` 判断 `process.platform`
   决定该行是否挂载（方言见 `docs/plan/enterprise-presets.md:173`；实证用法见 `:179`）。
3. **安装后果要如实上报**：官方安装结果区分 `failed` / `overridden` / `restart-required`
   （`references/host-plugin.md:60`）—— 连接器 UI 必须把这三种结果翻译成人话，不得把"未生效"说成"已连上"。
4. **⚠️ 官方 manifest 没有"平台要求"字段（真缺口）**：官方显示的元数据只有 `meta.title` / `meta.description` / `icon`
   （`references/host-plugin.md:29-45`）；`@deepseek-ai/dsh-package-manifest` 里出现的 `platform: 'web'`
   指的是 Client 运行目标，**不是**操作系统要求（`dsh-package-manifest/README.md:33`）。
   因此 connector-vision.md:107 要求的"市场条目声明平台要求、按平台过滤"，**只能落在我们自己的目录库与商城条目上**，
   不能指望官方 manifest 帮我们过滤 —— 这一条直接进 §3.1 的字段草案与 §6.6。

### 2.3 第三层 · 企业侧

**包含什么**

| 部件 | 内容 | 仓库既有地基（可复用） |
|---|---|---|
| 凭据保管 | 员工侧**永远拿不到密钥**；只存**引用**，值只在服务端/宿主凭据面 | 官方 `@deepseek-ai/dsh-credentials`（§下方 3）；仓库先例 = 品牌资产的服务端独占校验 + CAS + revision 回滚（`console/src/features/branding/CLAUDE.md:7`） |
| 授权范围 | 谁可见/可用：全组织 / 指定成员；**禁增量补丁，全量原子替换 + CAS** | 配方可见范围同构实现见 `docs/plan/enterprise-presets.md:71` |
| 观测与审计 | 连接建立/同意/读/写/拒绝/失败；动作必须进**封闭枚举**，不能是任意字符串 | `AuditAction.java:12-58`（枚举真源）；DDL check 约束同构，见 `V30__enterprise_preset_square.sql:96-108` |
| 目录与市场条目 | 每条连接器 = 一个可发布/可下架/可分配的条目，带平台要求与能力清单 | 三行组件清单 `plugin/packages/ui/src/marketplace-entry.tsx:36-40`；管理端纵向路由模式 `console/src/app/product-routes.ts:21-24` |

**由哪条公理推出**：公理 5（策略而非开关）· 公理 2（信任靠清单与可撤回，不靠扫描）。

**与官方规范如何对齐**

1. **凭据引用化是官方机制，不是我们的发明**：`dsh-credentials` 让 settings 与 `cordis.yml` 只写**键名**（如 `DEEPSEEK_API_KEY`），
   `describe()` 只回 `{ configured, source?, writable }` 且**永不返回值**（`dsh-credentials/README.md:12`、`:56`、`:97`）；
   `resolve(ref)` 才在需要时取值（`:55`）。这正好是 "员工侧永远拿不到密钥" 的官方落点。
2. **凭据记录（grant）也是官方的**：插件按 `<scope>/<id>` 持自己的记录，`modifyRecord` 是唯一写路径
   （`dsh-credentials/README.md:65-81`）；"配置 UI 只能列出你被授权了什么、不能列出值"（`:75-77`）——
   这正是"观测面可展示、密钥面不可展示"的规范依据。
3. **一个反直觉但重要的官方约束**：启动环境注入的键**不可被覆盖**，会被报告为只读
   （`dsh-credentials/README.md:95`）。企业侧下发凭据时必须先分辨"这个键是不是被环境锁死了"，
   否则会得到"改了没生效"的幽灵问题 —— 这条进 §6.2 的操作步骤。
4. **审计动作封闭枚举**与仓库既有 **45 条**动作完全同构（`AuditAction.java:12-58`）；新增连接器动作 = 扩枚举 + 扩 DDL check
   （先例 `V30__enterprise_preset_square.sql:96-108`），**不允许**写自由字符串。
5. **安装面唯一**：企业侧**不提供**第二种安装器；员工侧"连上一个系统"最终仍落到官方 `plugin_manager` 安装面
   （`references/host-plugin.md:58`），与配方二期 §M 第 1 条同一个未验证前提（`docs/plan/enterprise-presets.md:818-821`）。

### 2.4 合规对照（cordis-plugin-development 七条，逐条落地）

> 对照 `docs/notes/connector-vision.md:69-78` 的七条合规清单，逐条给出**在本方案里落在哪**。

| # | 官方规范要点 | 本方案落点 | 出处 |
|---|---|---|---|
| 1 | 交付形态 = 官方 bundle/plugin（`dsh.bundle.patch` + `cordis.patch.yml`） | 内核、每个适配器、宿主能力面**各是一个 bundle** | `references/host-plugin.md:3`、`:9-27` |
| 2 | 能力注册走官方 Cordis 生命周期与 `ctx.*` | 只导出 `apply(ctx, config)` 或 service class，资源 `ctx.effect`/`ctx.on` | `references/host-plugin.md:47-54` |
| 3 | UI 只用官方 slots 与 primitives | 连接器页面进官方面板/槽位体系；既有企业市场已注册到官方 `plugins.item` + `plugins.detail.badge`（`plugin/packages/ui/CLAUDE.md:36`；`plugin/packages/ui/src/marketplace-entry.tsx:5`） | `references/host-plugin.md:31` |
| 4 | MCP 出站生成官方连接配置 | 配置型 bundle 插 `@deepseek-ai/dsh-mcp-client`，字段 `serverName`/`transport`/`url`/`failOnStartupError` | `references/mcp-bundle.md:3`；`dsh-mcp-client/README.md:57-63` |
| 5 | 遵从官方 preset 语义 | 连接器**只声明自己挂哪些 row**；模型路由/沙箱/审批栈留 Host 组合，连接器不越权拥有 | `docs/plan/enterprise-presets.md:188`、`:194` |
| 6 | `@deepseek-ai/*` 一律 peer 依赖 | 显式区间 `>=0.1.5-rc.2 <0.3.0` | `plugin/packages/bundle/package.json:58-66` |
| 7 | 适配器框架是插件内部细节 | 对外只有"一个官方插件 + 它声明的能力"；用户侧看不到第二套概念（术语降维见 §6.6） | `docs/notes/connector-vision.md:77-78` |

---

## 3. 能力的形式化描述（字段级草案）

> ⚠️ **本节字段是本方案自有的描述模型（草案），不是官方字段。**
> 官方真实存在的 MCP 连接字段只有 `transport` / `serverName` / `command` / `args` / `env` / `cwd` / `url` / `headers` /
> `failOnStartupError`（`dsh-mcp-client/README.md:57-63`）。我们的能力描述是**架在这些官方字段之上的我们自己的元数据**，
> 落地形态是连接器包里的声明文件 + 企业目录库的列。

### 3.1 能力最少要声明什么（草案）

| 字段 | 含义 | 类型/取值（草案） | 为什么必需（公理） |
|---|---|---|---|
| `capabilityId` | 稳定标识，进会话历史与权限规则 | 小写字母/数字/连字符，全局唯一 | C1：能力要可被引用 |
| `title` / `summary` | 人话名与一句话说明（员工侧只出现这两个） | 字符串 | C2：装前看得见；宪法术语降维 |
| `stateAddress` | **状态寻址**：读/写的到底是哪个状态 | 结构化地址（对象/设备/字段/资源路径） | **C1 核心**：没有寻址就没有能力 |
| `effects` | **效果类型**：`read` / `observe` / `write` / `send` / `actuate` | 枚举集合（可多选） | C1、C4 |
| `reversibility` | **可逆性**：`reversible` / `compensable` / `irreversible` | 枚举 | **C4 第一轴** |
| `blastRadius` | **影响半径**：`self` / `org` / `external`（含物理世界） | 枚举 | **C4 第二轴** |
| `transport` | 传输：`mcp` / `http` / `openapi` / `a2a` / `acp` / `im-webhook` / `smtp` / `imap` / `mqtt` / … | 枚举 | C3：传输是可替换细节 |
| `authRef` | **认证引用**：只写凭据**键名**，不写值 | 凭据引用串（官方 `ctx.credentials` ref） | C2；官方 `dsh-credentials/README.md:12`。★**2026-10-06 更正**：对 **MCP 传输**，只有 `env`/`project-env`/`user-env` 三层能真正到达子进程；保管文件（`source: 'file'`）**到不了** —— 见 §4.1 约束 ⑤ |
| `egressAllowlist` | **出站白名单**：能访问的域名/网段，显式声明 | 域名/网段列表 | 硬约束 §2（防 SSRF 与横向移动）；`docs/notes/connector-vision.md:56` |
| `quota` | 限额：次数/窗口/并发/字节 | 结构化 | C5：策略要能约束程度 |
| `inbound` | 是否支持入站及入口种类 | `none` / `webhook` / `long-poll` / `callback` | §4.7 拓扑 |
| `auditEvents` | 会产生哪些审计事件（必须在封闭枚举内） | action 名列表（进 `AuditAction`） | C2；`AuditAction.java:12-58` |
| `platformRequired` | **平台要求**：在哪些宿主上可用，哪些上"不支持" | 平台 × 三态 | **C7**；官方 manifest 无此字段，见 §2.2 第 4 点 |
| `discovery` | **发现方式** | `mdns` / `ssdp` / `netscan` / `ble-scan` / `nfc-tap` / `catalog` / `manual` | **C6**：没有发现方式不许上线 |

**最少必填集（硬性）**：`capabilityId` · `title` · `stateAddress` · `effects` · `reversibility` · `blastRadius` ·
`transport` · `platformRequired` · `discovery`。其余可缺省，但缺省必须**可见**（宪法「默认值必须可见」，
`docs/notes/product-charter.md:28`）。

### 3.2 权限三层（L1/L2/L3）的可执行判据

> 判据必须**只依赖两个轴**（`reversibility` × `blastRadius`）与效果种类，**不允许**依赖协议、厂商或"是不是 MCP"。

| 层级 | 可执行判据（布尔表达式） | 默认处置 | 员工侧表述 |
|---|---|---|---|
| **L1 只读** | `effects ⊆ {read, observe}` **且** `reversibility = reversible` | **可默认放行**（仍留审计） | 「查看」 |
| **L2 可逆写** | `effects ∩ {write, send, actuate} ≠ ∅` **且** `reversibility ∈ {reversible, compensable}` **且** `blastRadius ∈ {self, org}` | **授权即可**（一次授权、后续免打扰，集合变化重确认） | 「操作」 |
| **L3 不可逆 / 影响外部** | `reversibility = irreversible` **或** `blastRadius = external` | **每次显式确认，或由管理员策略锁死**；无策略时一律不可用 | 「需要你确认」 |

**三条硬纪律（可断言、可测试）**

1. **L3 不允许"装一次就永久放行"**：任何 `reversibility = irreversible` 或 `blastRadius = external` 的能力，
   在策略未显式锁死时，**每次调用都要一次显式确认**（`docs/notes/connector-vision.md:44`、`:62`）。
2. **层级由两轴计算，不由声明方自贴**：声明里给的是 `effects`/`reversibility`/`blastRadius` 三个**原始事实**，
   L1/L2/L3 是**求值器算出来的**。声明方不能直接声明"我是 L1" —— 否则就等于让被治理方自己发许可。
3. **宽严就近取严**：当两个来源给出不同层级时（例如能力声明 vs 企业策略），**取更严的那个**；
   且"本平台不支持"必须显式呈现，**不得降级成静默跳过**（C7）。

### 3.3 决策函数（伪代码，不是实现）

```text
level(cap) =
    if cap.effects ⊆ {read, observe} and cap.reversibility == reversible      -> L1
    elif cap.reversibility == irreversible or cap.blastRadius == external     -> L3
    else                                                                     -> L2

decide(actor, cap, host):
    if !host.support(cap)              -> DENY(UNSUPPORTED_ON_PLATFORM)   # 三态里的第三态，显式
    if !policy.visible(actor, cap)      -> DENY(NOT_IN_SCOPE)              # C5：策略求值，不是开关
    if !policy.allowed(actor, cap)      -> DENY(POLICY_BLOCKED)
    if !quota.available(actor, cap)     -> DENY(QUOTA_EXCEEDED)
    if !consent.granted(actor, cap)     -> REQUIRE_CONSENT                 # 首次同意 / 集合变化重确认
    if level(cap) == L3                 -> REQUIRE_CONSENT_PER_CALL        # 除非策略锁死
    -> ALLOW + AUDIT(cap.auditEvents)
```

**与官方的关系**：这个决策函数**不替换**官方沙箱与审批栈（那是 Host 组合的职责，
`docs/plan/enterprise-presets.md:194`），它只决定**连接器自己**是否发起这次出站/入站动作；
调用官方工具时仍受官方审批栈约束（两道门，不是一道）。

---

## 4. 六类连接的适配规格

> 每类 5–10 行，固定回答：**它是什么 · 我们怎么接 · 入站还是出站 · 权限层级 · 已知约束**。

### 4.1 MCP（Model Context Protocol）

- **它是什么**：把外部 MCP 服务器的工具与资源接进模型，工具名形如 `mcp__<serverName>__<tool>`
  （`dsh-mcp-client/README.md:5`、`:75`）。
- **我们怎么接**：**优先生成官方 MCP 配置**（配置型 bundle，不写第二套 MCP 客户端）。
  字段真源：`transport`（必填，`stdio` 或 `streamable-http`）· `serverName`（必填，
  命名空间 `[A-Za-z0-9_-]{1,32}` 且同作用域内唯一）· `command`/`args`/`env`/`cwd` · `url`/`headers` ·
  `failOnStartupError`（`dsh-mcp-client/README.md:57-63`）。
- **方向**：**出站**（宿主主动连服务端）。
- **权限层级**：**不能按"是 MCP"定级** —— 同一台 MCP 服务器可能同时提供只读查询与不可逆下单；
  按 §3.2 对**每个工具**分别算层级（官方工具身份是 `(serverName, rawName)`，稳定，
  `dsh-mcp-client/README.md:107-108`）。
- **已知约束**：① `serverName` 在一个注册作用域内唯一，重复会在加载时失败（`:58`、`:128`）；
  ② stdio 的 `env` 会与**被清洗过的**环境合并（`:59`、`:136`）—— 密钥不能靠裸环境变量传，走凭据引用；
   ★★ **第十八刀补（实现级发现的真 bug）**：凭据**键名的语法**当时写成了 `^[A-Za-z_][A-Za-z0-9_.-]{0,63}$`
   （允许 `-` 与 `.`），而官方 `dsh-credentials/lib/index.js:13` 的 `REF_PATTERN` 是 `^[A-Za-z_][A-Za-z0-9_]*$`
   （"POSIX-style environment-variable name"）。这不是风格问题：我们的配置型 bundle 写的是
   `env: { KEY: !!js process.env.<键名> }`，键名带 `-` 时 **JS 把 `process.env.a-b` 解析成减法**（`NaN`/ReferenceError），
   http 头那条 `` `Bearer ${process.env.a-b}` `` 会送出 `Bearer NaN` —— 也就是**旧语法能生成一份坏配置**。
   已在宿主侧（`CONNECTOR_CREDENTIAL_KEY_PATTERN`）与服务端闸门（`ConnectorDescriptorGate.CREDENTIAL_KEY`）**同步收紧**到官方同一把尺，
   并加了 26 格矩阵门禁（13 种"把值抄进配置"的形状 × 2 传输，逐格断言确切拒绝码）。
   **残留（如实登记）**：不带连字符的密钥形状（如 `sklive1234`）仍可能被当作"名字"通过；根治要加一条语义约束——
   **描述符里的引用必须出现在该连接的能力声明的 `authRef` 里**（声明是被审阅与审计的那一面），属后续刀。
  ③ 启动失败默认不阻断宿主，但该服务器的工具**一个都不出现**（`:71`）；要强约束才开 `failOnStartupError: true`；
  ④ 官方 SDK 选用 2026-07-28 协议、不可用时回落旧修订（`:28`）—— 兼容性差异是真实风险，不要承诺"任意 MCP 服务器都行"；
  ⑤ ★**（2026-10-06 新取证）凭据只到得了"环境层"，到不了"保管层"** —— 三条官方依据：
     `cordis-plugin-loader/lib/index.js:233` 的 `!!js` 求值器是**同步**的（`new Function("ctx","expr","with (ctx) { return eval(expr) }")`），
     而官方凭据面的 `resolve`/`describe` 是 **async**；`dsh-mcp-client/lib/types/index.d.ts:39` 的 `env` 只收
     `Record<string, string>`；`dsh-credentials-local/README.md:115` 逐字 "**never loads the file into the environment**"。
     ⇒ 配置里能写的只有 `!!js process.env.<键>`，故只有**启动环境 / 两个 `.env` 层**的值能进子进程；
     **保管文件里的键（恰是 `writable: true` 的那一类）送不到**。★这条**推翻了 §7 P0-3 原来的写法**
     （"`authRef` → 官方 `ctx.credentials`"对 MCP 不可实现），并让"管理端最容易做的动作（在设置里存一个键）"
     成为**对 MCP 无效**的那一个 ⇒ 必须做成显式判据而不是静默零工具（实现见 P0-3 那一行的登记）。
     ★ **实现级复核三处（2026-10-06 第十二刀，把上面那三条从 README/类型级升到实现级）**：
     ① `dsh-app-boot/lib/index.js` 的 `loadLayeredEnv` 里逐字 `for (const [name,value] of Object.entries(layer.values))
     if (process.env[name] === void 0) process.env[name] = value;` ⇒ **两个 `.env` 层确实被写进 `process.env`**（不覆盖已有值），
     同一函数构造快照时的层 id 逐字是 `process` / `project-env` / `user-env`；
     ② `dsh-credentials-local/lib/index.js:437-438` 的 `dotenvFallback(ref)` 取的就是 `['project-env','user-env']`，
     `:477` 把 `process` 层报成 source `'env'` ⇒ 实现里"可送达"的那三个 id 与我们代码里的常量**逐一对应**；
     同一文件全文**零** `process.env` 写操作 ⇒ 保管层永不进环境。
     ③ `dsh-mcp-client/lib/*.js` **零**引用 `credentials`/`readRecord`/`credentialKey` ⇒ 官方 MCP 客户端根本不读凭据面；
     反向核对 `readRecord` 的消费者是 `dsh-llm-pi-ai` / `dsh-deepseek-account-platform` / `dsh-storage-json`
     这类**进程内自调凭据面**的适配器（记录里的 `env` 值服务的是它们，不是子进程）。
     ⇒ 结论不变，但现在是**实现级已验**：`env`/`project-env`/`user-env` 三层的值在 `process.env` 里现成有、
     `file` 层的值永远到不了子进程。取证写进了 `plugin/packages/bundle/src/connector/credentials.ts` 的两个常量注释。

### 4.2 HTTP / OpenAPI

- **它是什么**：把 HTTP 端点（含 OpenAPI 描述的整套 API）变成 Agent 可用的能力。
- **我们怎么接**：两条路，**优先第一条**：
  ①若厂商/网关提供 MCP 端点 → 走 §4.1，零自研；
  ②否则**自带一个适配器插件**：读 OpenAPI 文档 → 把 operation 映射成能力描述（§3.1）→ 生成工具。
  ⚠️ **官方没有 OpenAPI→工具的适配器**：本机 `node_modules/@deepseek-ai/*` 全量列举中，
  与 openapi/swagger 相关的包 **零命中**（未取到，故不能引用任何官方 OpenAPI 适配器）。
- **方向**：**出站为主**（宿主调外部 API）。
- **权限层级**：按 HTTP 方法与语义分：`GET` → 通常 L1；幂等 `PUT` → 通常 L2；
  **支付/下单/群发/删除** → L3（`blastRadius = external` 或 `reversibility = irreversible`）。
- **已知约束**：① **出站 allowlist 是硬要求**（防 SSRF），端点域名必须显式声明（`docs/notes/connector-vision.md:56`）；
  ② 官方 `@deepseek-ai/dsh-http-proxy` 只影响走 Node `fetch` 的出站流量（含 LLM、web-search、HTTP MCP），
  且 **loopback 流量保持直连**（`dsh-http-proxy/README.md:12`）—— 企业代理策略要按这个边界设计；
  ③ 官方 `dsh-web-fetch-http` 是**匿名公网抓取**通道（不发凭据、拒非公网目标，`dsh-web-fetch-http/README.md:12`），
  **不能**当企业内网 API 客户端用。

### 4.3 A2A（Agent2Agent）

- **它是什么**：智能体与智能体之间的互操作协议（A2A / Agent2Agent），用途是让不同厂商的 Agent 互相委派与协作。
- **我们怎么接**：**今天没有官方实现可复用**。本机 `node_modules/@deepseek-ai/*` 全量包名中，
  `a2a` / `agent2` 相关 **零命中**（本会话实测，包名枚举无匹配）。因此只有两条路：
  ①用 §4.1 接对端 Agent **暴露的 MCP 面**（能立刻做，但那是 MCP 不是 A2A）；
  ②**自建 A2A 适配器插件**（真实成本项，进 §7）。
- **方向**：**双向**（我们既可作 A2A 服务端被别的 Agent 调用，也可作客户端去调别的 Agent）。
- **权限层级**：**必须按被委派的具体动作定级**，不能按"这是 A2A"放行 —— 委派链会放大影响半径
  （上游 Agent 一次不可逆动作，可能由下游 Agent 执行）。建议：跨组织 A2A 委派**默认 L3**。
- **已知约束**：① 规范版本号 **未取到**（本次只取到 Linux Foundation 的 A2A 项目新闻页
  <https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year>，
  未取到逐字段规范正文，**故本文不写任何 A2A 字段名或版本号**）；
  ② **不可冒充 ACP**：官方 ACP 是另一件事（§4.4），协议名不同、包不同，不许在文案与代码里互换。

### 4.4 ACP（Agent Client Protocol）

- **它是什么**：官方 `@deepseek-ai/dsh-acp` 是"面向程序化客户端的 ACP 服务端"，通过 JSON-RPC stdio
  让你创建/续接会话、选模型与推理档、挂 MCP 服务器、提交/取消任务、收语义更新（`dsh-acp/README.md:5`、`:12`）。
- **我们怎么接**：**官方已提供两端**，我们只做配置与治理，不写协议实现：
  ①**入站**：以 `--profile acp` 起 ACP 服务端，让可信程序驱动我们的 Agent（`dsh-acp/README.md:12`）；
  ②**出站委派**：用 `@deepseek-ai/dsh-subagent-acp` 把任务交给 ACP 兼容的子 Agent，
  子进程有独立 runtime/会话/模型/工具，只共享工作目录（`dsh-subagent-acp/README.md:12`）。
- **方向**：**双向**（入站 = 被驱动；出站 = 委派子 Agent）。
- **权限层级**：子 Agent 的权限提示由**配置策略**回答，**不经过人**（`dsh-subagent-acp/README.md:12`）——
  所以**不能**把 ACP 委派当成"有人审核"，必须由策略层（§3.3）先行约束。
- **已知约束**：① 官方明说它**故意省略 DSH 专属展示数据与交互 UI**（`dsh-acp/README.md:12`），
  所以 ACP 入站链路里没有审批 UI —— L3 动作在 ACP 路径上**必须**靠策略锁死，不能指望弹窗；
  ② ACP 服务端的持久化**不支持**删除/分叉/转录回放/额外目录（`:12`），产品文案不得承诺这些。

### 4.5 IM / 聊天机器人

- **它是什么**：把企业 IM（群机器人、自建应用、客服消息）变成 Agent 的入口与出口。
- **我们怎么接**：出站 = 适配器插件按厂商 API 发消息（HTTP，凭据走引用）；
  入站 = **官方原语 + 我们的服务端桥接**，见 §4.7。
- **方向**：**双向，且入站是主战场**（用户是在 IM 里 @ 机器人的，不是在 dsh 界面里）。
- **权限层级**：读消息 / 读频道 → L1；发消息给**自己或本会话** → L2；**给组织外的人或大群发消息** → L3
  （`blastRadius = external`）。
- **已知约束**：① 官方 `ctx.webhookRuntime` **明确没有内置去重** ——
  "No built-in deduplication — repeated provider deliveries may create repeated Sessions; rules that need idempotency own it"
  （`dsh-webhook/README.md:72`）。这与连接器硬约束"入站必须验签 + 去重 + 幂等"直接冲突，
  因此**去重、验签、幂等必须由我们的适配器承担**，不能假设官方原语给了；② 外部文本是**不可信**的：
  官方说明通用 runtime 不加任何私有框定，"a rule incorporating external text owns its trust labeling"
  （`dsh-webhook/README.md:57`）—— 群成员发的指令必须按不可信内容处理。

### 4.6 邮件

- **它是什么**：把企业邮箱变成 Agent 的收发渠道（发通知/回执/工单，收邮件触发任务）。
- **我们怎么接**：**自带适配器插件**（官方无邮件包：本机 `node_modules/@deepseek-ai/*` 包名枚举中
  smtp/imap/mail/email 相关 **零命中**，未取到任何官方邮件能力）。
  出站用 SMTP（凭据 `authRef`）；入站优先服务商 webhook，无 webhook 则 IMAP 轮询。
- **方向**：**双向**（出站 SMTP + 入站 webhook/IMAP）。
- **权限层级**：读收件箱 → L1；**给自己或本组织内部地址**发 → L2；
  **发给组织外收件人 / 批量群发** → **L3**（不可逆 + 外部半径，两个轴同时命中）。
- **已知约束**：① 无官方原语 → 轮询策略、去重、附件边界全是我们自己的成本与责任；
  ② 邮件正文是**不可信外部内容**，与 §4.5 同一条纪律；
  ③ 收件箱读取涉及**企业合规与隐私**，必须走企业策略（C5）而不是员工个人开关。

### 4.7 ★IM / 邮件的入站链路（拓扑）

**问题（必须正面回答）**：事件发生在**公网服务商**那一侧，而 Agent 跑在**宿主**上（手机 / 桌面机 / 内网服务器）。
宿主没有稳定公网入口 —— 手机切网、桌面休眠、内网无端口映射。所以**不能**让服务商直接推给宿主。

**推荐拓扑（服务端桥接，宿主只做出站）**：

```text
① 服务商（企微/钉钉/飞书/邮件服务商）
      │  公网入站：HTTPS 回调 / webhook
      ▼
② 企业服务端桥接层  ←── 唯一公网出口，唯一持有凭据与签名密钥
      │  1) 验签（服务商签名 / token）
      │  2) 去重（delivery id 幂等键）+ 幂等
      │  3) 审计（入站事件必须进封闭枚举动作）
      │  4) 路由（哪个租户 / 哪个用户 / 哪个连接 → 哪个会话）
      ▼
③ 宿主主动发起的长连接（SSE / long-poll / WebSocket，方向 = 宿主 → 服务端）
      │  ★ 宿主不监听任何公网端口；断线重连由宿主负责
      ▼
④ 宿主上的连接器插件 → dispatch 给官方 webhookRuntime 规则
      │  官方规则签名：WebhookRule { id, kind, run(delivery, signal) }
      │  官方内置动作：在 Web Workspace 里创建一条普通根会话
      ▼
⑤ 会话：WebhookSessionRequest 要求
      workspacePath / title / prompt / agentPreset / permissionPreset
      （可选 model 指定 provider/model 路由 + 输出上限）
      → 成功 followup() 即为提交点
```

**官方依据**：`dsh-webhook/README.md:12`（`ctx.webhookRuntime` = 可信 webhook 规则注册表
+ 唯一内置动作"在 Web Workspace 里创建一条普通根会话"；**服务商认证属于适配器包**）；
`:28`（`WebhookRule` 结构）；`:37`（`WebhookSessionRequest` 必填五字段）；`:39`（先校验 preset 再创建）；
`:41`（`followup()` 是提交点，之后不干预）；`:57`（外部文本的信任标注由规则自己负责）；`:72`（**无内置去重**）。

**由此推出的四条硬性设计结论**

1. **公网出口只有一个**：在企业服务端，不在宿主。宿主侧连接器**永不**监听公网端口。
2. **验签 + 去重 + 幂等由桥接层承担**（官方原语不提供，`:72`）—— 这正是硬约束 §3 的落点。
3. **"哪条入站消息进哪个会话"是路由问题，不是协议问题**：路由表属于企业侧（§6.3），
   宿主只执行"把这个事件交给哪条已同意过的规则"。
4. **入站与出站共用同一套能力描述**：入站规则里的"能读消息/能回消息"同样按 §3.1 声明、
   按 §3.2 定级 —— 入站不是治理的盲区。

---

## 5. 中国开箱即用清单

> **纪律**：能否"真做通"以**开放 API 是否存在**为准；没有逐字段规范就拿不到结论的，写「待核实」并给出原因，**不编**。
> 本次只取到部分厂商文档**入口页**（URL 见"依据"列），**未取到**逐字段规范、配额表与计费口径，故下表多处为「待核实」。
> 列含义：**能不能做通** = 出站可做（O）/ 双向可做（B）/ 待核实（?）。

| # | 名称 | 能不能做通 | 认证方式 | 支持入站 | 前置条件 | 风险 | 优先级 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 1 | **企业微信 · 群机器人** | O（出站可做） | Webhook key（URL 自带 key） | 否（纯推送） | 需在企业微信内建群并添加机器人 | 配额与频率上限**待核实**；key 泄露 = 任何人可发 | **P0**（最快能演示的一条） | [消息推送配置说明](https://developer.work.weixin.qq.com/document/path/91770) |
| 2 | **企业微信 · 自建应用消息/回调** | ?（双向**待核实**） | 应用 Secret + 回调签名（AES/token） | 是（回调需公网入口） | 需**企业认证**；回调需**可信域名/公网 IP**；管理员授权 | 逐字段加密协议**未取到**；合规与备案要求**待核实** | **P0**（最有价值的一条） | 同上入口页；逐字段规范**未取到** |
| 3 | **钉钉 · 自定义机器人** | O（出站可做） | Webhook + 加签（可选） | 否 | 需在群内添加自定义机器人 | 频率限制与内容安全策略**待核实**；key 泄露即公开 | **P0** | [机器人回复与发送消息（帮助中心）](https://help.dingtalk.io/ja/open/dingstart/robot-reply-and-send-messages)（**日文页，中文逐字段规范未取到**） |
| 4 | **钉钉 · 企业内部应用 / 事件订阅** | ?（双向**待核实**） | AppKey/AppSecret + 事件回调 | 是（需公网回调） | 需企业认证与管理员开通应用 | 事件订阅协议细节**未取到**；配额**待核实** | **P1** | 同上；事件订阅规范**未取到** |
| 5 | **飞书 / Lark · 自建应用 + 事件订阅** | ?（双向**待核实**） | App ID/Secret + 事件订阅校验（challenge） | 是（事件推送需公网地址） | 需企业管理员创建自建应用并授权权限范围 | 审批范围与租户策略**待核实** | **P0**（文档结构最清晰的一条） | [事件订阅概览](https://open.feishu.cn/document/server-docs/event-subscription-guide/overview) |
| 6 | **微信公众号 / 服务号 · 客服消息 + 服务器配置** | ?（双向**待核实**） | AppID/AppSecret + 服务器 token 校验 | 是（服务器配置指向我方 URL） | **需主体认证**（服务号）；服务器 URL 需可达 | 消息加解密细节**未取到**；订阅号无客服消息权限 | **P2** | 本次**未取到**官方入口页（搜索未命中权威文档首页） |
| 7 | **企业邮箱（SMTP 发送 / IMAP 收取）** | O（出站可做；入站需轮询或服务商 webhook） | 邮箱账号 + 授权码/应用专用密码 | 部分（IMAP 轮询可，真正推入站取决于服务商） | 需企业邮箱管理员开通 SMTP/IMAP | 轮询成本、附件边界、**企业合规审查** | **P0** | 无官方包；本次**未取到**统一标准（各家实现差异大） |
| 8 | **阿里云短信** | ?（出站**待核实**） | AccessKey/Secret + 签名与模板审核 | 否 | **短信签名与模板必须先审核通过**；实名认证 | **真金白银 + 不可逆（L3）**；模板违规会被封 | **P2**（L3 高风险，先不做） | 本次**未取到**权威文档页 |
| 9 | **腾讯云短信** | ?（出站**待核实**） | SecretId/Key + 签名与模板审核 | 否 | 同上：签名/模板审核 + 实名 | 同上（费用 + 不可逆 + 合规） | **P2** | 本次**未取到**权威文档页 |
| 10 | **高德/百度地图 · 天气（和风）等只读 API** | O（出站可做，凡有开放 API 者） | API Key | 否 | 需注册开发者账号并申请配额 | 配额与商用授权**待核实**；免费额度有限 | **P1**（L1 只读，最适合做"第一条连上的系统"） | 本次**未取到**（未逐个核实各家开发者条款） |
| 11 | **企业审批/工单类（钉钉审批、企微审批）** | ?（双向**待核实**） | 应用 Secret + 事件回调 | 是 | 需企业认证与管理员授权范围 | 审批写操作影响组织流程 → 至少 L2，涉外部则 L3；细节**未取到** | **P2** | 逐字段规范**未取到** |
| 12 | **支付类（支付宝/微信支付 企业）** | ?（**待核实**；且**本轮明确不进 P0/P1**） | 商户号 + 证书/密钥 | 是（支付回调） | 需**商户资质审核**、备案、签约 | **L3 极端案例**：不可逆 + 外部 + 涉资金；合规与风控门槛最高 | **不做（见 §8.2）** | 本次**未取到**权威文档页 |

**前三条的真实前置条件（一句话）**

1. **企业微信群机器人**：只要有一个企业微信群 + 管理员允许添加机器人即可跑通出站；**不需要**备案与可信域名 —— 这是它排 P0 第一的原因。
2. **企业微信自建应用回调 / 飞书自建应用事件订阅**：**需要企业管理员授权 + 一个公网可达的回调地址**（意味着**必须有服务端桥接**，§4.7），
   且企业认证与合规要求**待逐项核实**。
3. **企业邮箱 SMTP**：需要企业邮箱管理员开放 SMTP 并拿到授权码/应用专用密码；**出站今天可做，入站要看服务商是否给推送**。

---

## 6. 企业端：配置 / 集成 / 部署

### 6.1 管理员"三步接一个系统"

| 步 | 管理员做什么 | 系统替他做什么 | 员工侧看到什么 |
|---|---|---|---|
| **1 选** | 从**内置目录**里选一个系统（不是填地址、不是填协议）；目录条目带平台要求与能力清单 | 自动填充端点、认证类型、能力清单；平台不满足的条目标"本平台不支持" | 无 |
| **2 授权** | 填/绑**凭据引用**（值只在服务端），勾选**授权范围**（全组织 / 指定成员），设定能力等级上限与额度 | 引用式保存（不落值到配置）；写审计 | 无 |
| **3 发布** | 一键发布并分配到范围 | 策略生效；员工侧出现"已接好的系统 · 由企业统一管理" | 「连接」列表里出现一项，点一下就能用 |

**纪律**：三步里**不出现** MCP / OpenAPI / webhook / OAuth / BLE / 证书 / YAML 任一词（宪法术语降维，
`docs/notes/product-charter.md:41`、`docs/notes/connector-vision.md:50-51`）。

### 6.2 凭据保管（参考管理端品牌资产的做法）

**仓库先例（品牌资产）**：服务端**独占**校验（位图在服务端验，控制台只收集产品语义）、
**CAS + revision 历史 + 可回滚**、资产"只增不删"因此回滚总能命中旧 hash
（`console/src/features/branding/CLAUDE.md:7`；`BrandingAssetStore.java:2-5` 头部自述
"branding/artifact 的唯一文件系统边界；品牌资产只增不删，回滚因此总能命中旧 hash"）。

**连接器照搬的四条口径 + 一条官方补充**：

| # | 口径 | 落点 |
|---|---|---|
| 1 | **值只在服务端/宿主凭据面，员工侧永远拿不到** | 官方 `ctx.credentials`：配置只写键名（`dsh-credentials/README.md:12`） |
| 2 | **观测面能说"设没设 / 从哪来 / 能不能改"，永不说值** | 官方 `describe()` 返回 `{ configured, source?, writable }`（`:56`、`:61`） |
| 3 | **授权记录（grant）是持久记录，按 `<scope>/<id>` 归属** | 官方 `modifyRecord` 唯一写路径（`:65-81`） |
| 4 | **变更要可追溯、可回滚** | 沿用品牌资产的 CAS + revision + 回滚范式（`console/src/features/branding/CLAUDE.md:7`） |
| 5 | **⚠️ 环境已注入的键不可覆盖，会报只读** | 官方明确（`dsh-credentials/README.md:95`）—— 管理员界面必须先分辨这一点再报"改了没生效" |
| 6 | ★**（2026-10-06 新取证）"能不能改"与"送不送得到"是两件事，且方向相反** | 对 **MCP 传输**：`writable: true`（存在保管文件里）恰恰是**送不到**子进程的那一类；`writable: false`（启动环境供的）反而送得到。依据见 §4.1 约束 ⑤。⇒ 管理端**不能**把"可写"当成"可用"，必须先判层再判送达 |

### 6.3 授权范围与策略求值

- **范围**（可见性）：沿用仓库既有 assignment 口径 —— **全组织 / 指定成员，全量原子替换、禁增量补丁、CAS 冲突**
  （配方侧同构实现见 `docs/plan/enterprise-presets.md:71`）。
- **策略**（可用性）：`角色 × 范围 × 平台 × 能力等级上限 × 额度`（C5）。管理员设定的是**上限**，
  员工不能自行放宽；员工只能进一步**收紧自己的同意**。
- **失败一律 fail-closed**：引用不到（未配置）/**凭据送不到子进程**（见 §6.2 第 6 行）/ 平台不支持 / 未被分配
  → **不可用并给可行动提示**，绝不静默降级（与配方侧同口径，`docs/plan/enterprise-presets.md:268`）。
  ★注意这里**不是**"凭据不可写就拒"——按 §6.2 第 6 行，对 MCP 恰恰相反。

### 6.4 部署形态

| 形态 | 公网入站在哪 | 凭据在哪 | 适合 | 今天能不能做 |
|---|---|---|---|---|
| **服务端托管**（推荐，入站唯一可行） | 企业服务端（容器化，OS 无关） | 服务端凭据面 | 有公网入口、要接 IM/邮件的企业 | **能**（§4.7 拓扑） |
| **宿主本地** | **无**（宿主不监听公网） | 宿主凭据面 | 纯出站：本地设备、局域网、桌面工具 | **能**（出站类） |
| **混合**（服务端管入站与策略，宿主管出站与近场） | 服务端 | 服务端（企业级）+ 宿主（本地设备） | 大多数企业 | **能**，但需双层审计关联 |

**纪律**：企业服务端必须**保持操作系统无关**、容器化交付（`docs/notes/connector-vision.md:109`）。

### 6.5 观测与审计

- **封闭枚举**：所有连接器动作进 `AuditAction` 枚举 + DDL check（先例 `AuditAction.java:12-58`、
  `V30__enterprise_preset_square.sql:96-108`）。**不允许**自由字符串。
- **必须记录的六类事件**（建议命名，需在实现前与既有枚举风格对齐）：连接授权授予 / 连接授权撤销 /
  入站事件接收（含验签结果）/ 出站动作发起 / 动作被策略拒绝 / 平台不支持被命中。
- **信任话术纪律**：只承诺"管理员审过 + sha256 完整 + 装的时候官方要你确认 + 可撤回"，
  **任何**"已通过安全检测"的文案都是说谎（C2；`docs/notes/connector-vision.md:60`）。

### 6.6 术语降维（员工侧）

| 内部说法 | 员工侧必须说 |
|---|---|
| MCP / OpenAPI / webhook / A2A / ACP / SMTP / IMAP / BLE / GATT / Modbus / ONVIF / OAuth | **不出现** |
| connector / 连接器 | **连接**（「连接到 XX 系统」） |
| 已发布的连接配置 / assignment | **已接好的系统** · **可见范围** |
| 附近设备（发现结果） | **附近设备** |
| 凭据 / API Key / token | **需要配置 1 项凭据**（键名只在管理员侧） |
| 平台不支持 / unsupported | **这台设备暂不支持** + 下一步（换设备 / 联系管理员） |

出处：`docs/notes/product-charter.md:37-46`；`docs/notes/connector-vision.md:50-51`。

---

## 7. 分期与人日

> 人日口径沿用仓库既有调研：**1 人日 = 1 名熟悉本仓库的工程师有效工作 6 小时，含实现 + 测试 + 文档**，
> 不含排期等待与跨团队协调（`docs/plan/enterprise-presets.md:724`）。
> 迁移号参考（★**2026-10-06 实测更正**：原写"现有迁移到 `V37`、`V39` 被预定、故连接器从 `V40` 起"——**三条全已过期**）：
> 实测 `server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/` 现有 **`V0`–`V37`、`V39`–`V43`**
> （`V43__enterprise_library.sql` 是当前最大；**`V38` 仍是空号**，`skill-ingest-center` 当年预定的那一枚尚未落地）。
> `V39`（`V39__enterprise_preset_dependencies.sql`）与 `V40`（`V40__enterprise_plugin_description.sql`）**都已实际存在**，
> 不是"被预定"。⇒ **连接器取 `V44`**（已核：V44 零命中）；**开工那一刻必须再核一次**（本段是快照，不是承诺）。

### P0 — 最小可用：**"一条真能连上的出站 + 一套能管住的策略/审计"**（**12–20 人日**）

> ★ 标题原写 **11–18**，与本节明细合计（`12–20`，逐项相加的算式就在下面）矛盾；**以明细为准**
> （`docs/plan/mcp-conformance.md` §8.3 第 3 条已判定应改此处）。

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P0-1 | 能力描述模型 + 注册表 + 策略求值器（§3.1/§3.2/§3.3）：纯内核、零平台依赖 | 2–3 | — |
| P0-2 | **MCP 出站连接器**：生成官方 MCP 配置的配置型 bundle（不写第二套客户端） | 1.5–2.5 | ⚠️ 官方安装面可达性（同 §8.3 第 1 条） |
| P0-3 | **凭据引用接入（2026-10-06 按取证改写）**：`authRef` → 官方 `ctx.credentials.describe` 的**只读观测面**（设没设/从哪来/能不能改，**永不说值**）＋**送达判定**（对 MCP 只有 `env`/`project-env`/`user-env` 三层真到得了子进程；保管文件那一层报「配了但送不到」并给「镜像进 `.env`/启动环境」的可行动指引）。★原写法「`authRef` → 官方 `ctx.credentials`」对 MCP **不可实现**，依据 §4.1 约束 ⑤ | 1.5–2.5 | P0-1 |
| P0-4 | 企业侧最小账本：连接条目 + 可见范围（全量原子替换 + CAS）+ 迁移 **`V44`** + 审计 6 事件扩枚举 | 2.5–4 | P0-1；✅ **迁移号已对齐（2026-10-06 实测：取 `V44`，`V40` 已被 `enterprise_plugin_description` 占用）** |
| P0-5 | 员工侧最小呈现：连接列表（三态：可用/需确认/不支持）+ 首次同意 + 可撤回；术语降维。★**细化方案见 `docs/plan/mcp-marketplace-tab.md`，人日以那边 §13 为准**（把它展开成与既有四枚页签同构的界面是 **8–12 人日** ⇒ 本行 `2–3` 是"只算最小列表"的历史口径，已被顶替） | 2–3 | P0-3、P0-4 |
| P0-6 | 第一条**中国开箱即用**出站连接：企业微信群机器人 **或** 钉钉自定义机器人 **或** 只读 API（§5 第 1/3/10 行） | 1–2 | ⚠️ 需真机/真租户验证（§8.3 第 2 条） |
| P0-7 | 联调 + 验收（三态呈现、L3 每次确认、策略拒绝可行动、审计逐条覆盖） | 1.5–3 | P0-1…P0-6 |

**P0 合计 = 12–20 人日**（逐项区间相加：min 2+1.5+1.5+2.5+2+1+1.5 = 12.0；max 3+2.5+2.5+4+3+2+3 = 20.0）。
★ **但这个合计没有算 P0-5 的细化**：P0-5 那一行按"最小列表"估的 2–3 人日，在
`docs/plan/mcp-marketplace-tab.md` §13 里展开成与既有四枚页签同构的界面后是 8–12 人日
⇒ **修正后的 P0 ≈ 17–29 人日**（差额 5–9 是新增的，不悄悄吃掉）。**P0 的硬前置（"尚不存在"的能力）**：
① 官方安装面在**客户端侧**发起是否与会话内 `plugin_manager` 同一条面 —— **已验证**（`docs/notes/preset-bundle-spike.md` §3/§4 与
`docs/notes/preset-approval-spike.md` §2/§4/§5；`mcp-conformance.md` §8.1 已判定取值 —— 本行原写"未验证"是过期口径，
剩下唯一未验证项收窄见 §8.3 第 1 条）；
② ~~迁移号 `V38`/`V39` 已被预定，连接器须确认 `V40` 可用~~ ⇒ ✅ **已确认（2026-10-06 实测）**：
`V40` **已被占用**（`V40__enterprise_plugin_description.sql`），当前最大是 `V43`，**连接器取 `V44`**（零命中）。
本条从"硬前置"降级为"开工时再核一次"（§7 开头那段是快照，迁移号是共享资源，落刀当天必须重数一遍）。

> ★ **落地登记（2026-10-06，本仓）**：P0-1（能力描述模型 + 注册表 + 策略求值器）与 P0-2 的**合成段**已落地，
> 落点 `plugin/packages/bundle/src/connector/`（`capability.ts` / `policy.ts` / `bundle.ts` / `errors.ts` / `index.ts`），
> 门禁 `plugin/packages/bundle/tests/connector-{capability,policy,bundle}.spec.ts`（73 条，含与官方 `templates/mcp/` 正文
> "只差 row id 一行"的逐字节对照）。**纯内核：尚未接任何路由、安装面或企业目录**（`../index.ts` 一行 import 都没有）。
> 落地时发现本节 §3.2 的表与 §3.3 的伪代码**互相矛盾两处**，实现按纪律 3「宽严就近取严」取严并逐条写在 `policy.ts` 文件头：
> ① 「只读 + 可逆 + `blastRadius=external`」——伪代码的行序（L1 先判）会判 **L1 且"可默认放行"**，正是纪律 1 与 §8.2 第 5 条要堵的洞，
> 本实现判 **L3**；② 「只读 + `compensable`」——表判成**三层皆不命中**，本实现判 **L2**。**两处都建议回写本节。**
> ★ **第三处（2026-10-06 第十六刀补登记）**：§3.3 伪代码的同意步是无条件 `if !consent.granted -> REQUIRE_CONSENT`，而 §3.2 表 L1 行写"**可默认放行**"——两者冲突。本实现按**表**走：L1 在支持平台上免同意，仅本平台 `needs-confirm` 时要求，reason = `platform-needs-confirm`。（此前只写在 `connectorDecide` 的注释里，未进本节偏差清单。）⇒ 本节与 §3.3 的分歧**共三处**，均已逐条登记并有测试锁定。
> ★ **P0-1 现有的三道穷举门禁**（都在 `plugin/packages/bundle/tests/connector-{policy,capability}.spec.ts`，断言里都带计数，方案回写后会红并提醒同步）：
> ① **层级判据 279 格**（第十七刀前的第十五刀）：表唯一命中的 270 格与实现零不一致，3 格歧义取 L3、6 格未覆盖取 L2；
> ② **决策顺序 1200 格**（第十六刀）：按"支配性"断言——被前一步挡住的格子，后面的步骤不许翻盘；
> ③ **声明读取器变异 255 格**（第十七刀）：15 字段 × 16 畸形值 + 逐键删除，被接受的**恰为 12 个合法情形**，
> ★ **双实现审计的覆盖面（第二十五刀收口）** —— 说清哪些是自动的、哪些只能人工逐条对，免得下一个人以为"没红就是同尺"：
> · **自动**（`scripts/connector-parity.mjs`，**27 项**，不需要 JVM/DB）：传输词表 · 必填九枚 · 关闭键集 · 明文键名正则 ·
>   自贴层级判据 · 三枚形状正则 · 另外八组取值域词表。有阳性对照。
> · **只能人工逐条对**（本刀**无法**机械化，因为服务端跑不起来）：**"宿主查的每一条，服务端是否也查了"** 与
>   **"同一份输入两侧的接受/拒绝是否一致"**。三刀的人工对照抓到三处（层级判据写法、取值域整片缺失、静默丢弃），
>   故后来者动任一侧时，**必须重做一遍这张人工对照表**（清单见 `ConnectorDescriptorGate` 与 `capability.ts` 的校验段）。
> ★★ **第二十四刀：同一维度（规则覆盖）再逐条对完，抓到第三处同源分歧 —— "静默丢弃"**
> `{summary: 42}` 在宿主被拒（`optionalText` 走 `requireText`，非字符串**抛**），在服务端却被**当成"没写"悄悄丢掉**
> （调用方先 `asString(...)`，非字符串变 null）。这正是本仓明令禁止的一类行为（"静默丢 = 悄悄少装能力"）。修法：
> 两个文本 helper 改成**吃原始值并自己判类型**（`requireText`/`optionalText` 均 `Object` 入参），删掉 `asString` 这一层转换
> （11 处调用点不再可能静默转换）；并把六处 `containsKey && != null` 守卫改成"**present 就校验**"——
> 宿主侧"只有 `undefined` 算没写"，显式 `null`/空串一律走到校验里被拒；长度界也改成按**原始串**判（与宿主 `value.length > max` 同界）。
> **残留（如实登记，未在本刀消除）**：宿主 `requireText` 返回**未 trim** 的原值，服务端返回 `trim()` 后的值
> ⇒ 两边对"带前后空格"的声明**落库字节**会不同（接受/拒绝的判定已一致）。统一哪一侧是产品口径问题，
> 留待下次动任一侧时一并裁定，不在这里单方面改。
> ★★ **第二十三刀：同一门禁换维度查"规则覆盖"，抓到第二处实质缺口** —— 第二十二刀比的是**词表**（传输/键集/正则），这一刀问的是"**宿主查的每一条，服务端是不是也查了**"。结论：服务端闸门原来对 `effects` 只查"是不是非空数组"，而 `effects` 成员、`reversibility`、`blastRadius`、`transport`（声明侧）、`discovery`、`platformRequired`、`stateAddress`、`inbound`、`auditEvents`、`quota`、`egressAllowlist` 的**取值域一个都没查** ⇒ 库里能存进
> `{effects:["frobnicate"], reversibility:"maybe", blastRadius:"galaxy"}` 这种**没人能求值**的声明 —— 而服务端正是台账与下发目录的**权威侧**（宿主的 `capability.ts` 一直查得很严）。已在 `ConnectorDescriptorGate` 补齐：
> 6 组词表常量（其中声明侧传输词表**从 `ConnectorEntry.Transport` 派生**，保证枚举与闸门不会各说一套）+ 7 个校验方法 + 11 处调用；
> 并把 8 组词表比对**并入** `scripts/connector-parity.mjs`（8 项 → **16 项**，有阳性对照：截断 `DISCOVERIES` ⇒ 报 ✗ 且 exit 1）。
> ★ **跨语言一致性门禁（`scripts/connector-parity.mjs`，第二十二刀）**：连接器刻意做了**双实现**（宿主内核保护"本机生成的 bundle"、服务端闸门保护"库里那一行 + 下发的目录"，输入来源不同、不能互相代替），代价是**可能漂移**。这个脚本比对 8 项（传输词表 · 必填九枚 · 关闭键集 · 明文键名正则 · 自贴层级判据 · 三枚形状正则），不需要 JVM/DB ⇒ 本机可跑。**它已经抓到一次真实漂移**：层级自贴判据宿主按"键名**含** level/permission/tier"、服务端按"**精确相等**"⇒ 同一份声明两侧给出不同稳定码（`LEVEL_DECLARED` vs `DECLARATION_INVALID`）；已按宿主侧对齐，并做了**阳性对照**（注入漂移 ⇒ 报 ✗ 且 exit 1；还原 ⇒ 8/8 exit 0）。建议接进 CI 的 `plugin-check` 之后。
> ★ **P0-2 输入面的三道穷举/锚定门禁**（`tests/connector-bundle.spec.ts`）：
> ① **凭据引用矩阵 26 格**（第十八刀）：13 种"把值抄进配置"的形状 × 2 传输，逐格断言确切拒绝码；
> ② **描述符变异 130 格**（第十九刀）：被接受的**恰为 2 个合法情形**（单字符 `command`、相对 `cwd`），
>   其余一律拒 —— 含"`url` 无 http(s) scheme""`args` 里放非字符串""任何未知键"；
> ③ **官方模板锚定**（第十四刀）：测试里抄录的官方 `templates/mcp/` 正文已与真文件逐字节/逐字段核对。
> ⑤ **随机序列审计 120 种子 × 8 步 = 960 次操作**（第二十一刀，`tests/connector-install.spec.ts`）：
>   单格枚举只能证明"每个分支单独对"，状态机的错常在**乱序**里。随机交错 install(三种变体)/uninstall/status 并随机让端口
>   成功·抛错·`failed`·`cancelled`，每步查四条记账不变量：同一 id 至多一条记录 · `status` 与账一致 ·
>   **失败的 install 不许改动账**（含"覆盖已有记录时失败"，旧记录必须原样留着）· 账里的摘要 = 最后一次成功装的那份。
>   种子固定 ⇒ 可复现；违例为空与 960 都写进断言。
> ④ **摘要敏感性矩阵 14 点**（第二十刀）：摘要对**每一个**字段敏感 ⇒ 渲染器没有"被静默忽略的字段"（有的话改它不换摘要、安装段就会跳过本该做的重装）。同配置同摘要另有独立用例。
>    ★ 设计后果（不是 bug，已知即可）：展示名 `displayName` 会作为 `package.json.description` 进产物，**故纯改名也会产生新摘要、新落点目录、并触发一次重装**；内容寻址目录只增不删，改名会留旧目录。
>   必需字段上一个畸形值都不接受（含 `effects` 空集、`platformRequired`/`discovery` 空集、`stateAddress` 空对象）。
> ★ **第十五刀穷举审计（279 格）**：表唯一命中的 **270 格**（279 − 3 − 6）里本实现与表**零不一致**；表**自身歧义 3 格**（只读+可逆+`external`，L1/L3 两行都命中）、**未覆盖 6 格**（只读+`compensable`+`self`/`org`）—— 正是上面两处，本实现分别取 **L3 / L2**；与 §3.3 伪代码的差异恰为那 3 格，**无第三处未登记分歧**。⇒ "两处偏差"的准确说法是 **9 格（3+6）**，且登记完备。
> 另有**一处方案未定、实现取严（待用户裁决）**：L3 被管理员 `preAuthorized` 锁死时，员工侧那次**首次同意仍然要**
> （P0-5 那句"首次同意 + 可撤回"是员工自己的门，管理员预授权替代不了它）。
> ★ **落地登记（2026-10-06，第二刀：P0-2 安装段）**：P0-2 的**安装段**已落地，落点
> `plugin/packages/bundle/src/connector/install.ts`（+ 新增横切层 `src/plugin-install-port.ts`），门禁
> `plugin/packages/bundle/tests/connector-install.spec.ts`（28 条，包内合计 43 文件 / 571 项）。要点：
> ① **与配方纵深共用同一份官方面描述**——按 §8.2 第 1 条「不做第二个安装器」，把"端口契约的官方面 / `ChangeResult`
> 投影 / 两个 ctx 取值器"从 `preset/install.ts` 抽到 `plugin-install-port.ts`，preset 侧按原名再导出
> （对外 API 与行为一字未改，`preset-install.spec.ts` 16 条为锁）；
> ② 编排语义：幂等（同连接器同内容摘要且 link 在 ⇒ 不重装）、并发拒绝、官方裁定三态原样透出、失败不禁用、
> 本机已装清单 `<dshHome>/enterprise/connector-installs/installed.json`（逐字九键、损坏 fail-closed）、
> `node_modules/<pkg>` 残壳清理（三道 fail-closed）；
> ③ ★**§8.3 第 1 条那后半句在代码里现身说法，并在本刀期间被拆成两半登记**：
> `CONNECTOR_TOOL_AVAILABILITY_AFTER_INSTALL` 恒 `unmeasured`（② 工具何时可调：**已由官方实现判明**，见 §8.3 第 1 条；该常量登记的是"尚无真机端到端读数"这一层）；
> 而 ① 「行会不会进运行中的会话」**本刀已判明**——官方 `dsh-plugin-manager/lib/index.js:2042` 逐字
> `application: this.ownerContext.get("hmr") !== void 0 ? "applied" : "restart-required"`，`:1801` 的 enable 分支
> **新装**才走 `reload()` ⇒ `reconcileProfilePatches` 对运行中的 Loader 树现场和解，README `:67` 同义；
> 本机 `dsh --profile web --dump-config` 第 10 行即有 `- id: hmr` ⇒ 我们这条安装回 `applied` ⇒ **首次安装不需要重启**；
> 反过来，**换端点**（包名已在 manifest 里）官方直接回 `restart-required` ⇒ 要重启。两种都由官方裁定、我们原样透出。
> 故 `needsNewSession` 现在**只**跟官方裁定走（`hot` ⇒ false），未验证的那半收敛为界面措辞：**「已接入，正在连接…」**
> ——既不说"可以用了"（要 ② 的读数），也不说"请重启"（① 已判明）。全文取证见 `mcp-conformance.md` §9 第 1 条的
> 「追加取证（第五条例证）」。**仍未消除的是 ② 的时间窗（本机无读数）。**
>
> ★ **落地登记（2026-10-06，第三刀：P0-3 凭据段）**：落点 `plugin/packages/bundle/src/connector/credentials.ts`
> （+ 错误码两枚），门禁 `plugin/packages/bundle/tests/connector-credentials.spec.ts`（17 条）。交付：
> ① 官方凭据面的**只读**端口（只声明 `describe`，**刻意不碰** `set`/`unset`/记录）与 `{configured, source?, writable}`
> 的逐字段投影——测试里给描述塞了 `value` 也过不去（「值不过界」是锁住的，不是靠自觉）；
> ② **送达判定** `deliverable`/`store-only`/`unknown-source`/`unconfigured`（provider 自定层 fail-closed 当送不到）；
> ③ 预检闸门两枚稳定码 `ENT_CONNECTOR_CREDENTIAL_MISSING` 与 `ENT_CONNECTOR_CREDENTIAL_NOT_DELIVERABLE`
> （**后者优先于前者**：同时「没配」与「配了送不到」时报后者，因为前者会把人引向「去设置里存一个」——那对 MCP 无效）；
> ④ `connectorEndpointCredentialRefs` 从 stdio 的 `env[].key` / http 的 `headers[].key` 取待检清单（去重排序）。
> ★ 顺带把「凭据键名规则」收敛成**唯一一份**（`capability.ts` 导出，`bundle.ts` 与 `credentials.ts` 共用）。
> **本刀不写值、不读值、不桥接**：真要支持「保管面 → 子进程」只有上游给凭据感知取值、或我们自写桥接插件两条路，
> 后者要让密钥物化进环境并自持重载，属 **P1 候选**，本刀**刻意不偷偷做掉**（见 `credentials.ts` 文件头的四条登记）。
>
> ★ **落地登记（2026-10-06，第四刀：P0-4 服务端账本·第一段）**：P0-4 的**迁移 + 审计枚举 + 声明闸门 + 管理编排**已落盘：
> 迁移 `server/owndsh-modules/owndsh-enterprise/src/main/resources/db/migration/V44__enterprise_connector_catalog.sql`，
代码 `.../java/com/owndsh/enterprise/connector/`（**9 个主文件**：application 6〔CatalogService · DescriptorGate · DeclarationException · AuditMetadata · MutationContext · ResourceNotFoundException〕· domain 2〔Entry · Assignment〕· persistence 1〔Store 端口〕），
> 测试 `.../src/test/java/com/owndsh/enterprise/connector/`（2 个测试类，均带 `@Tag("dev")`）。要点：
> ① 两张表 `ent_connector` / `ent_connector_assignment`（**全量原子替换 + CAS** 与配方/技能同构；`server_name` 租户内唯一，
> 因为它是官方 MCP 命名空间、决定模型看到的工具名）；② 权限 `ent:connector:read|write`（id 1028/1029，已核全仓唯一）挂两个内置角色；
> ③ `AuditAction` 扩**六枚**连接器动作，与 V44 的 check 白名单**逐字一致**；④ `ConnectorDescriptorGate` 是 bundle 侧
> `ENT_CONNECTOR_SECRET_INLINE` / `ENT_CONNECTOR_LEVEL_DECLARED` 的**服务端同一份实现**（服务端不信任宿主侧校验过的输入）。
>
> ⚠️ **本段完全未编译、未执行 —— 如实登记，别当验过**：本机**没有 JDK、没有 Docker**，`mvnw` 门禁一次都没跑过；
> 本机做过的只有**跨层一致性自检**（临时脚本、非仓库门禁）：审计枚举 52 ↔ V44 白名单 52 两向零差；传输词表 DDL/Java/TS
> 三方 9/9/9 一致；权限 id 全仓唯一；两表不撞名；包名↔目录、类名↔文件名、括号平衡全过。
> **电脑端必须补跑**（按 `server/CLAUDE.md` 的 Docker 口径；漏 `@Tag("dev")` 会被整类静默排除；Testcontainers 记得预拉 `postgres:17-alpine`）：
>
> ⚠️ **⚠️ 既有红（与本次连接器工作无关，先知道免得误判）：`plugin/` 根门禁 `pnpm run check` / `pnpm run test` 目前必红在**
> **`client-plugin` 的 build 一步** —— 它的 `scripts/build.mjs` 与 `package.json`（`main: lib/index.js`）都要求 Host 半入口
> `plugin/packages/client-plugin/src/index.ts`，但该文件**从未入过库**（`git cat-file -e HEAD:…` 失败、`git ls-files` 空、
> 全历史无删除记录、未被 gitignore；`src/` 下只有 8 个子目录、无任何顶层源文件）。`release.yml` 的 `plugin-check` 任务
> 正是 `pnpm --dir plugin run check`，故那条 CI 也会红。**该包自身的 `typecheck` 与 143 条测试都是绿的**，只有 esbuild
> 那一步解析不到入口。⇒ 在它被修好之前，请**按包**跑门禁（`packages/*/` 逐个 `npx tsc -p tsconfig.json --noEmit` + `npx vitest run tests`，
> 本次 9 包全绿），或由该包负责人补齐 Host 半入口 / 删掉遗留的 Host 构建段（二选一，属该纵深自己的裁决）。
> `mvn -B -ntp -Pdev -pl owndsh-modules/owndsh-enterprise -am test -Dtest='Connector*'`，
> 以及**迁移执行那一趟** —— 那是 V44 唯一能证明"建得起来"的方式。
>
> ★ **第九刀补（把"未验证"说得更准）**：V44 的 SQL 已用 `sql-parser-cst`（`dialect: 'postgresql'`）**解析通过**，
> 且**对照组是仓库既有的 43 个迁移**（44/44 全部解析通过 ⇒ 该解析器对本仓这个方言/写法是够用的，失败才有意义）。
> 另用同一份 SQL 做了三层跨迁移自检：**表名 69 个 / 索引名 82 个 / 触发器名 4 个跨迁移零重名**（索引名在 PG 里是 schema 级全局，
> 这是真不变量）；约束名有 19 处跨迁移同名，但**约束名在各表内独立、且全部是既有文件**（V44 自身无重名）⇒ 非问题。
> ⇒ 结论收窄为：**V44 语法无错、命名不撞车、语句清单与自述一致（2 表 + 4 索引 + 2 处审计 alter + 2 处 trigger alter + 权限/角色插入，
> 白名单 52 枚）**；**仍未执行的只有"跑一遍 Postgres 建起来"**。
>
> ★ **第十刀补（同一手法用到 Java 上）**：`java-parser`（纯 JS，Chevrotain）解析本模块**全部 567 个 `.java`**，
> **零失败** —— 其中既有 554 个文件本来就过 Maven 编译，故「解析器吃得住本仓的 Java 21 特性（record / sealed /
> text block / switch 表达式 / 模式匹配）」这条前提是被**对照组**证明的，不是假设。
> 我改/新增的 **13 个**（9 主文件 + 4 测试类）全部解析通过 ⇒ **Java 侧现在是「语法已验证、类型与执行未验证」**：
> 括号/泛型/记录体这一类语法错已被排除；剩下的类型错（签名/可见性/泛型推断）与行为错，仍只有 `javac` + Postgres 能答。
>
> ★ **同轮补记（收尾刀）：发现并修掉五处「必红门禁」**——五处都是本刀自己引入的，如实登记成教训，供后面扩枚举/加迁移的人照抄：
> 1. `AuditMetadataPolicyTest#everyFrozenActionHasOneConcreteMetadataSample` 要求**封闭枚举的每一枚**都有可序列化的 metadata DTO
>    ⇒ 扩六枚动作就必须同步六枚 DTO/样本。★ 四枚**宿主侧**运行时事件（入站接收/出站发起/被拒绝/平台不支持）的 DTO
>    **也必须**在服务端定义（否则该门禁红），但**不要**因此就在服务端补发那四类事件——那是伪造观测。
>    另注该测试的敏感 key 正则禁 `tool`/`message`/`token` 等词，DTO 字段名不能踩。
> 2. `RuntimeProjectionContractDriftTest#auditActionEnumEqualsContract` 断言 **Java 枚举 == `contracts/generated/enterprise-openapi.json` 的 enum**
>    ⇒ 扩枚必须同步 `contracts/components/audit.yaml` 并**重生成**：`node plugin/packages/contracts/scripts/generate.mjs`
>    （连带更新 `plugin/packages/contracts/src/generated/{types,zod,enterprise-meta}.gen.ts`、`fixtures-manifest.json`、`protocol-sha256.txt`）。
>    ★★ 漂移门禁 `check:generated` 挂在 `@dshent/contracts` 的 **`typecheck`/`build` 脚本**里——直接跑 `npx tsc` 会**绕过**它
>    （本会话前几轮的"9 包 tsc 全绿"就是这样漏掉的）；复跑用 `pnpm -C plugin --filter @dshent/contracts typecheck`。
> 3. `EnterpriseMigrationTest` 有 **4 处**「迁移到最新后 `flyway.info().current()`」断言 + 1 处 `ent_*` 表数断言（43），
>    `LibraryMigrationTest` 有 1 处同类 ⇒ 加一枚迁移就要全部推进：本次 **43 → 44**、表数 **43 → 45**（V44 两张表）。
>    （`sys_menu`/`sys_role_menu` 的计数断言按 id/type 过滤，本次逐条核过、不受影响。）
> 4. 新增审计动作还要看一眼 console：本次确认 `console/src` **不穷尽** `AuditAction`（活动页原样打印动作码），故无字典要补；
>    但 `console/src/api/generated/*` 是**独立** generator（明确不在 `check:generated` 覆盖内），属已知陈旧面，
>    电脑端可按需 `node console/scripts/generate-openapi.mjs`。
> 6. ★（第七刀补）**RBAC 种子也是穷举门禁**：`RbacSeedTest#seedsFixedRolesAndEveryFrozenPermissionCode` 用 `perms like 'ent:%' and menu_type='F'`
>    穷举**全部**权限码（本次 25 → 27），`#grantsSpecializedRolesOnlyTheirFrozenPermissionSets` 又逐角色穷举集合
>    ⇒ V44 给 `plugin_admin`（role_id …003）授了 `ent:connector:read|write`（与 V30 把 preset/skill 给同一角色的先例一致），
>    两处断言都必须同步。**权限码因此有三处真源**：迁移里的 `sys_menu` 行、`RbacSeedTest` 的两条断言、
>    以及 `enterprise/help/facts/role-permissions.json`（后者是从运行实例采集的**快照**、本次已确认**早已过期且不被门禁读取**，
>    故**不改**——改它就等于伪造采集来源；需要时在有库的机器上重新采集）。
>
> 5. **口径**：审计动作的"真源"现在是**四处**——`AuditAction.java`、V44 的 check 白名单、契约 `audit.yaml` 的 enum、
>    以及生成物 JSON。任何一处漏改都是红，故扩枚按这份清单走。
>
> ⚠️ **写 `AdminConnectorController` 时的必读陷阱（第二十五刀实测确认）**：本仓**没有**任何关闭 Jackson 标量强转的配置
> （`grep MapperFeature|ALLOW_COERCION|CoercionConfig` 零命中；企业模块里只有两处内部客户端自建 `JsonMapper`），
> 而 Spring Boot 默认映射**会**把 `{"connectorId": 42}` 强转成 `"42"` —— `"42"` 又恰好通过 kebab 形状闸 ⇒
> **服务端会收下一个宿主侧（TS）会拒的输入**，两侧再次不一致。可选的落法（按推荐序）：
> ① 控制器**别直接吃强类型 DTO**，改吃 `Map<String,Object>`/`JsonNode`，把原始 token 交给闸门判类型
>    （第二十四刀已把闸门的文本 helper 改成"吃原始值自己判类型"，正是为这条路准备的）；
> ② 或为该端点显式关掉标量强转；③ 无论走哪条，都要**补一条**"数字/布尔当字符串传进来必须被拒"的测试。
> **P0-4 仍缺**：`JdbcConnectorStore`（端口已定义，实现未写）、`EnterpriseConnectorConfiguration`（Spring 装配）、
>
> ### 下一刀照做清单（第二十八刀整理；这一段的**代码**我没写，理由见下）
>
> **为什么停在这里**：这三件都是**纯 Java**，而本机没有 JDK/Docker ⇒ 我只能做语法级验证，写了就是"不可编译验证的新代码"。
> 与其再堆一层未验证面，不如把"该写什么、按什么形状写、验什么"写死，让有 JDK 的一侧照着填 —— 那是确定性的活。
>
> **① `persistence/JdbcConnectorStore.java`**（照 `JdbcPresetStore` 的既有写法：`JdbcTemplate` + `RowMapper` + `JsonMapper`）
>   - 实现 `ConnectorStore` 的**全部十个方法**（接口已定稿，逐个都有注释说明语义：`findByConnectorId` / `findById` /
>     `findByIdForUpdate`（`for update`，CAS 之外的第二道并发闸）/ `list`（`id > afterId order by id asc limit`）/ `insert` /
>     `update(entry, expectedRevision)`（`where tenant_id=? and id=? and revision=?`，返回受影响行数是否 >0）/
>     `incrementRevision` / `listAssignments` / `deleteAssignments` / `insertAssignment` / `subjectExists`）；
>   - 三列 jsonb（`descriptor`/`capabilities`/`policy`）以**正文**存取（域对象持字符串，序列化在 application 层，与 preset 的 dependencies 同法）；
>   - 传输列存**大写枚举名**（V44 的 check 与之同形），下发时用 `ConnectorEntry.Transport.wireValue()` 换回小写词表；
>   - **别忘 `subjectExists`**：USER 可见范围必须命中真实成员（application 层已经会调它）。
>
> **② `EnterpriseConnectorConfiguration.java`**（照 `EnterprisePresetConfiguration`）：装配 `ConnectorStore`（注入 `JdbcTemplate`/`JsonMapper`）、
>   `ConnectorDescriptorGate`（无状态）、`ConnectorCatalogService`（注入 `TransactionOperations`/`AuditSink`/雪花 `LongSupplier`/`Clock`），
>   以及 web 层的 `IdentityAdminRequestContextResolver`/`EnterpriseCursorCodec` 由既有基础设施提供、这里不重复声明。
>
> **③ `web/AdminConnectorController.java` + DTO/view**（照 `AdminPresetController`）：`GET` 列表（cursor 分页，scope 取 `connector_entries`）、
>   `POST` 新建、`POST /{id}/actions/activate|disable`（`If-Match: expectedRevision`）、`POST /{id}/assignments/batch`
>   （`Idempotency-Key` + `If-Match`，全量原子替换）；权限用 V44 已种的 `ent:connector:read|write`；
>   响应投影**关闭键集**（绝不吐 `descriptorJson`/`capabilitiesJson`/`policyJson` 正文以外的宿主信息，也不吐任何凭据值）；
>   ★★ **必须处理第二十五刀实测确认的 Jackson 标量强转陷阱**（`{"connectorId": 42}` 会被默认映射转成 `"42"` 而通过 kebab 闸）：
>   推荐控制器吃 `Map<String,Object>`/`JsonNode` 并把**原始 token** 交给闸门判类型（闸门的文本 helper 第二十四刀已改成"吃原始值自己判类型"）；
>   并**补一条测试**："数字/布尔当字符串传进来必须被拒"。
>
> **④ 两道测试**：`JdbcConnectorStoreIntegrationTest`（真 PostgreSQL，照 `LibraryDraftServiceIntegrationTest` 的 `@Tag("dev")` 写法）与
>   `ConnectorMigrationTest`（空库迁到 latest，**断言 `flyway.info().current()` 的版本号 == "44"** —— 与 `EnterpriseMigrationTest` 那三处同类断言保持一致的口径）。
>
> **⑤ 收口验收**：见本文件 §7 的"到电脑端的最短路径"（`scripts/connector-parity.mjs` → Docker 里的 `mvn -Pdev … -Dtest='Connector*'` → contracts `typecheck`）。
> `AdminConnectorController` 与 web DTO（投影 / 关闭键集 / `If-Match` / `Idempotency-Key`）。
>
> **仍未做**：§8.3 第 1 条那条 spike 的**真机端到端复核**（「契约结论」已成立，该条第 ① ② 两半都已判明；
> 缺的是独立复核与耗时测量）、P0-4 企业账本与 `V40`（迁移号仍未确认）、P0-5 员工侧呈现（含 `mcp-marketplace-tab.md` 的 C0–C5）、
> P0-6 第一条中国出站连接，以及 P0-3 里那枚**刻意留出的 P1 候选**（保管面 → 子进程的桥接）。
> **安装段仍未被任何路由或界面调用**（`../index.ts` 依旧零 import 本目录）⇒ 运行时行为与本刀之前完全相同。

### P1 — 治理与入站（**16–25 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P1-1 | **服务端桥接层**：唯一公网入站出口 + 验签 + 去重 + 幂等 + 审计（§4.7 ②） | 4–6 | P0-4 |
| P1-2 | **宿主侧入站通道**：宿主主动出站的长连接（SSE/long-poll/WS）+ 断线重连 + 事件投递到官方 `webhookRuntime` | 3–5 | P1-1；⚠️ 需真机验证宿主休眠/切网行为 |
| P1-3 | **IM 入站连接器（1 家）**：飞书或企业微信自建应用（§5 第 2/5 行） | 2.5–4 | P1-1、P1-2；⚠️ 依赖企业认证与公网域名（**待核实**） |
| P1-4 | **邮件连接器**：SMTP 出站 + IMAP 轮询入站（无官方包，全自研） | 2–3 | P0-3 |
| P1-5 | **HTTP/OpenAPI 适配器**：OpenAPI → 能力映射 + 出站 allowlist 强制（无官方适配器） | 2.5–4 | P0-1 |
| P1-6 | 管理端控制台纵向页（连接目录 / 凭据状态 / 范围 / 失效标）+ 审计只读视图 | 2–3 | P0-4 |

**P1 合计 = 16–25 人日**（min 4+3+2.5+2+2.5+2 = 16.0；max 6+5+4+3+4+3 = 25.0）。

### P2 — 生态与跨平台扩展（**16.5–26.5 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P2-1 | **A2A 适配器（自建）**：⚠️ 官方**无** A2A 实现；规范版本号**未取到**，开工前必须先取到逐字段规范 | 4–7 | ⚠️ **依赖"尚不存在"的官方能力 + 未取到的外部规范** |
| P2-2 | 局域网发现：mDNS/DNS-SD + SSDP/UPnP + 网段探测 | 3–5 | P0-1 |
| P2-3 | **Android 宿主能力面**：蓝牙/BLE · NFC · USB/串口 · 通知 · 定位（经 Shizuku/无障碍，本机已有先例） | 4–6 | ⚠️ 需真机验证每种三态 |
| P2-4 | **桌面宿主能力面**：Windows（WinRT/WinUSB/Bluetooth API）· macOS（CoreBluetooth/IOKit）· Linux（BlueZ/udev） | 4–6 | P2-3（先抽象后实现） |
| P2-5 | 发现结果与商城的**平台过滤**（官方 manifest 无平台字段 → 须落在我们自己的目录库，§2.2 第 4 点） | 1.5–2.5 | P0-4 |

**P2 合计 = 16.5–26.5 人日**（min 4+3+4+4+1.5 = 16.5；max 7+5+6+6+2.5 = 26.5）。
**三期相加（P0+P1+P2）≈ 44.5–71.5 人日**；**P0 是唯一可以立刻开工的部分**，P1 的整条入站链路
依赖"企业已有服务端"这个前提（开放问题 8.1 第 1 条）。

### ★"某平台今天做不到"的能力（必须显式标注，不许静默）

| 能力 | 哪个平台今天做不到 | 为什么 | 怎么呈现 |
|---|---|---|---|
| **宿主任公网入站端点（IM/邮件直推）** | **所有宿主**（含桌面与手机） | 手机切网、桌面休眠、内网无端口映射；无稳定公网入口 | 走 §4.7 服务端桥接；宿主侧**永不**监听公网 |
| **ACP 入站链路里的 L3 审批弹窗** | **所有平台** | 官方 ACP 服务端**故意省略**交互 UI（`dsh-acp/README.md:12`） | L3 在 ACP 路径上只能靠**策略锁死**，UI 不承诺弹窗 |
| **A2A 对端互操作** | **所有平台** | 0.2.0-rc.2 **无** A2A 实现（包名枚举零命中）；规范正文未取到 | 标"本版本不支持 A2A"，先给 MCP 替代路径 |
| **蓝牙 / NFC / USB / 串口等近场能力** | **无 GUI 服务器宿主**（Linux 服务器、容器） | 无设备栈、无用户确认面 | 第三态「**本平台不支持**」，显式呈现，不静默失败（C7） |
| **Windows / macOS 宿主能力面** | **今天全部未做** | 本轮只规划；实现需按平台各写一遍（WinRT/CoreBluetooth） | 商城条目按平台过滤，未实现的平台**不出现**在列表里 |
| **入站去重 / 幂等** | **官方原语不提供**（`dsh-webhook/README.md:72`） | 官方明确"rules that need idempotency own it" | 由桥接层与适配器承担；**不得**假设框架已去重 |
| **平台要求过滤** | **官方 manifest 无该字段**（`references/host-plugin.md:29-45`） | 官方只显示 title/description/icon | 落在我们自己的目录库与商城条目（§2.2 第 4 点） |

---

## 交叉引用:两处"未验证"已被配方线 spike 解决

本文原列的两条不确定项,在本仓库另两条 spike 中已取得实证,实施时可直接采信、不必重做:

1. **「客户端侧发起装 bundle 是否与会话内 `plugin_manager` 同一条面」——已验证**
   证据:`docs/notes/preset-bundle-spike.md`(§3/§4)与 `docs/notes/preset-approval-spike.md`(§2/§4/§5):
   - CLI 面与服务面**完全不在授权闸门内**(全树 `approveEscalation` 仅 6 个调用点,服务本体与 Web UI 零命中)
   - **普通 Host 插件可达 `ctx.pluginManager`**(官方 `dsh-plugin-manager` 自己即 `inject=['tools','pluginManager','sandboxPolicy']`)
   - 服务面自带 `install-log` / `install-state` / `waitForInstall` / `cancelInstall`,**任意权限档位都可跑、不必逼用户提权**
   - 仅 Agent 工具面会弹授权,且**每次调用都弹、只能"允许一次"**(官方无 always)
   ⇒ 连接器的"一次安装/启用"若需装 bundle,应走**我们自己的插件直调服务面**,而不是让 Agent 工具代做。

2. **「宿主主动发起的长连接在 Android 后台/桌面休眠时的存活」——仍未验证**(保持为不确定项),
   但可复用配方线 spike 建立的验证方法:另起临时 profile + 独立进程现场取证,不修改当前会话档位、不重启。


## 8. 开放问题 · 明确不做 · 不确定项

### 8.1 开放问题（5 条）

1. **连接器要不要有独立的"公网入站"服务端部署形态？** §4.7 推荐服务端桥接，但这要求企业**已经**部署了服务端
   （有容器、有公网入口、有 TLS 证书）。对于只有宿主、没有服务端的小客户，**入站类连接器是否直接不做**、
   只提供出站类？（影响 P1 的整个前置：P1-1 的前提）。
2. **策略的粒度停在哪一层？** 最小可用是"组织级默认上限 + 成员可见范围"（§6.3）；
   是否要做到**部门级**与**逐能力级**？仓库已把部门资源**移除**（`docs/plan/enterprise-presets.md:767` 记录
   "已被产品移除"），做连接器部门策略等于逆着既有收敛走 —— **需要用户拍板**。
3. **L3"每次确认"的确认面放在哪？** 官方审批栈属于 **Host 组合**、不是连接器能改的
   （`docs/plan/enterprise-presets.md:194`）。那么连接器的 L3 确认是：①走官方审批栈（免费但受其语义限制）；
   ②连接器自己弹一次确认（可控但要自己保证不被绕过）。**两者混用会出现两道门不一致**。
4. **"发现"的结果要不要持久化？** 局域网设备/附近设备是**易变**的（离开范围即消失）。
   持久化会积累幽灵条目，不持久化则"上次连过的设备"找不到。**产品语义未定**。
5. **A2A 到底做不做？** 若上游近期会出官方 A2A 支持，我们自建就是重复投资；
   若不会出，P2-1 的 4–7 人日就必须先**取到规范正文**才能开工。**需要用户决策 + 需要取到规范**。

### 8.2 明确不做（6 条 + 理由）

1. **不做第二个安装器 / 第二套运行时。** 官方规范明确安装只有一个面（`references/host-plugin.md:58`）；
   自建安装器必然产生"哪份配置真的生效"的两个真相（同口径先例 `docs/plan/enterprise-presets.md:789-790`）。
2. **不做内容安全扫描，也不声称做了。** 我们无法审查第三方语义（C2；`docs/notes/connector-vision.md:60`）；
   任何"已检测"文案都是说谎，会直接摧毁信任模型。
3. **不做支付类连接器的第一轮实现。** 支付 = `irreversible` + `external` + 涉资金 + 商户资质审核，
   四个最高风险叠加；在 L3 判据与确认面（8.1 第 3 条）未定之前不碰（§5 第 12 行）。
4. **不做"宿主监听公网"的入站方案。** 手机/桌面没有稳定公网入口，这条路在产品上是伪需求、
   在安全上是把企业内网暴露给公网（§4.7、§7 表格）。
5. **不做"装一次永久放行"的 L3 快捷通道。** 这是 C4 的直接禁止项，
   也是"万能连接"与"出事故"的唯一分界线（`docs/notes/connector-vision.md:44`）。
6. **不把连接器做成能改沙箱/权限/审批栈的东西。** 官方 composition 明确这些留在 Host 组合
   （`docs/plan/enterprise-presets.md:194`）；连接器若声称能改，就是**假装有安全能力**——比没有更危险。

### 8.3 不确定项（8 条，逐条写"为什么不确定"）

1. **客户端侧发起装 bundle 是否与会话内 `plugin_manager` 同一条面 —— 已验证（本条原写"未验证"，是过期口径）。**
   证据：`docs/notes/preset-bundle-spike.md` §3/§4 与 `docs/notes/preset-approval-spike.md` §2/§4/§5
   （CLI 面与服务面完全不在授权闸门内、普通 Host 插件可达 `ctx.pluginManager`、服务面自带
   `install-log`/`install-state`/`waitForInstall`/`cancelInstall`）；`docs/plan/mcp-conformance.md` §8.1 已判定取值。
   ★ **收窄后剩下的唯一未验证项**：装完一条 mcp-client 配置后，**工具是否当场（无需重启）进 `ctx.tools`** ——
   官方 `references/host-plugin.md:60` 分开判了两种情况（**新装 bundle 可经 HMR 激活**；替换已装包换 JS 模块代才需重启），
   `dsh-mcp-client/README:93` 也说改配置行是"原地重载连接"，但**没有**确证"HMR 已生效"与"工具已可用"是同一时刻。
   **需要的验证**：临时 profile + 独立进程，装一条后立即查工具注册面，再重启复看。
   **它决定**：连接器详情里那句落地交代是"已接入"还是"需要重新打开客户端"。
   ★ **2026-10-06 追加取证：本条已拆成两半，前半已判明、后半仍缺读数。**
   **① 行会不会进运行中的会话 —— 已判明（不需要重启）。** 判据来自官方安装面自己的代码，不是我们的推断：
   `dsh-plugin-manager/lib/index.js:2042` 逐字 `application: this.ownerContext.get("hmr") !== void 0 ? "applied" : "restart-required"`
   ⇒ **`applied` 的定义就是"现场有 HMR"**；`:1801` 的 enable 分支里**新装**（包名不在 manifest）才走
   `await this.reload()`，而 `reload()` 就是 `reconcileProfilePatches(ownerContext.root, …)`——对**运行中的** Loader 树现场和解；
   README `:67` 同义（"A live profile recomposes … reports `applied`"）。**本机实测**：`dsh --profile web --dump-config`
   第 10 行即 `- id: hmr / name: '@deepseek-ai/dsh-hmr'` ⇒ 本机 web profile 有 HMR ⇒ 这类安装回 `applied`。
   ★ 反向的一半同样由官方裁定：**改配置**（同一包名已在 manifest 里）走 `:1801` 的 `return "restart-required"`
   ⇒ **换端点要重启**。两种都原样透出，我们不自造判断。
   **② 工具何时可调 —— 也已判明（2026-10-06，由官方契约推出）。** 三条官方代码串起来正好锁死这一格：
   `dsh-app-boot/lib/index.js:3468` 的 `reconcileProfilePatches` 在 `entry.update()` 之后 **`await ctx.loader.await()`**
   （等整棵 Loader 树），随后 `inactiveEntries(ctx)` 把 **`FIBER_PENDING` 也算未就绪**，只要**新引入**的行在其中就
   **当场抛**；而 `dsh-mcp-client/lib/types/index.d.ts:89` 逐字写它的 `apply` "Connect one MCP server and **publish its
   initial tool generation before activation**"（`ctx.tools.register` 在 `lib/index.js:153`），`failOnStartupError`
   决定初始连接/工具同步失败要不要让 activation 失败——我们在 P0-2 里把 `failOnStartupError` **恒设 `true`**。
   ⇒ **`applied` 只会在「新行 ACTIVE」之后返回，而该行 ACTIVE 的定义里就包含「初始工具代已发布」**
   ⇒ 「HMR 已生效」与「工具已可用」在这次安装的**返回时刻**是同一件事；服务器连不上时回的是
   `application: 'failed'`（`reconcileProfilePatches` 抛 → `change()` 捕获），不是 `applied`。
   ★ 两条实作后果：① 安装调用会**阻塞到握手结束**，服务器卡住则安装也卡住（由连接超时兜底）；
   ② 这条结论**依赖** `failOnStartupError: true` 那个 P0-2 决定，两者配对，改一个必须复核另一个。
   ⇒ 界面措辞据此定为「**已接入**」（`applied` 时工具已注册）；代码侧由 `src/connector/install.ts` 的
   `ConnectorToolAvailability` 登记为 `proven-by-contract`（真机读数到手后改 `measured`）。
   **仍未做的**是独立复核与耗时测量（临时 profile + 独立进程），它是复核、不是结论的前提。
   完整取证见 `mcp-conformance.md` §9 第 1 条的「追加取证」。
2. **中国 IM 厂商的逐字段回调协议与配额 —— 未取到。**
   不确定的原因：本次只取到**文档入口页**（§5 依据列），**未取到**逐字段加密/验签规范、频率上限表、计费口径。
   **需要的验证**：逐个厂商取到官方文档正文，并在真实租户里跑一次发送 + 一次回调。
3. **A2A 规范版本与字段 —— 未取到。**
   不确定的原因：本次只取到 Linux Foundation 的 A2A 项目新闻页（URL 见 §4.3），
   **未取到**规范正文；本机官方包**无** A2A 实现。**故本文不写任何 A2A 字段名或版本号。**
   **需要的验证**：取到规范正文 + 决定自建还是等官方。
4. **官方 `ctx.webhookRuntime` 在生产级投递语义下的可靠性 —— 未验证。**
   不确定的原因：官方 README 说明了提交点与失败回滚，但**没有**给出投递重试、乱序、并发同规则的量化承诺
   （可从 `dsh-webhook/README.md:28`「Rules of the same kind start independently」与 `:72`「no built-in deduplication」推断风险，
   但**推断不是事实**）。**需要的验证**：真机压测重复投递与并发投递。
5. **宿主长连接（SSE/long-poll/WS）在 Android 后台与桌面休眠下的存活 —— 未验证。**
   不确定的原因：本会话没有真机跑过；Android 后台限制、Doze、桌面休眠都会断连。
   **需要的验证**：真机切后台/锁屏/休眠各 30 分钟，测重连时延与事件丢失率。
6. **`HostCapability` 三态在 Android 上的真实基线 —— 未验证。**
   不确定的原因："可用 / 需确认 / 不支持"在纸面上清楚，但**每个**设备能力（蓝牙、NFC、USB）的确认面
   分别是系统权限弹窗、配对流程还是 Shizuku 授权，本会话**没有逐项实测**。
   **需要的验证**：逐能力真机走一遍，把"需确认"的真实交互录下来。
7. **企业策略求值在万级成员 × 千级连接的规模下的成本 —— 未测。**
   不确定的原因：本文设计的是"每次动作求值"，但没做过规模压测；若成本高，需要引入策略缓存或快照。
   **需要的验证**：造数据压测求值路径。
8. **邮件的"入站"是否成立取决于服务商 —— 待核实。**
   不确定的原因：SMTP 出站是通用能力，但**入站推送**没有任何跨厂商标准；IMAP 轮询是保底方案，
   其成本与延迟**未测**。**需要的验证**：确认目标企业邮箱是否提供推送式入站；否则按轮询设计并公开延迟。
   ★ **第十三刀把这一格从"契约级"升到"实现级"**：`dsh-mcp-client` 的 `apply` 实现（`lib/index.js:809`）在
   `:831` `await connection.ready`，而 `ready`（`:679` 构造）只在 `:657` 的 `await enqueueSync(generation, startupOpts)`
   成功后才 resolve —— 工具正是在那里注册（`:518` 的 `enqueueSync` → `:153` `ctx.tools.register(definition)`）；
   失败时 `ready` 回 `{error}`，`:832` 在 `failOnStartupError` 为真时**抛**（"initial connection or tool synchronization failed"）。
   与 `lib/types/index.d.ts:89` 的类型注释（"publish its initial tool generation before activation"）逐字一致：
   类型注释是承诺、上面这三行是实现 —— **`applied` ⇒ 该行 ACTIVE ⇒ 初始工具代已注册**，现在两侧都核过。

---

## 附录 · 取证索引（供复核）

**仓库内（只读，本次未改一字）**
- `docs/notes/connector-vision.md`（120 行，目标条文）· `docs/notes/product-charter.md`（60 行，产品宪法）
- `docs/plan/enterprise-presets.md`（886 行；本文引用 `:71`、`:173`、`:179`、`:188`、`:194`、`:268`、`:724`、`:730`、`:767`、`:789-790`、`:809`、`:818-821`）
- `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/audit/AuditAction.java`（`:15-59`，封闭枚举）
- `.../branding/artifact/BrandingAssetStore.java`（`:2-5` 头部：唯一文件系统边界 + 只增不删 + 原子 CAS）
- `.../db/migration/V2__enterprise_plugin.sql`（`:6-40`）、`V30__enterprise_preset_square.sql`（`:96-108` 审计 check）、`V37__enterprise_skill_category.sql`
- `console/src/app/product-routes.ts`（`:12`、`:21-24`、`:47-48`）· `console/src/features/branding/CLAUDE.md`（`:7`）
- `plugin/packages/ui/src/marketplace-entry.tsx`（`:36-40`）· `plugin/packages/bundle/package.json`（`:58-66`）· `plugin/packages/bundle/CLAUDE.md`（`:8`、`:13`、`:21`）
- `plugin/packages/platform-client/src/local-api.ts`（`:26`、`:49`）· `plugin/packages/plugin-distribution/`（`cli.ts`/`verification.ts`/`state-store.ts`）

**官方安装目录（只读，`/data/data/com.deepcode.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/`，版本 `0.2.0-rc.2`）**
- 技能 `node_modules/@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/`：
  `SKILL.md`（主文）· `references/host-plugin.md`（`:3`、`:9-27`、`:29-45`、`:47-54`、`:58`、`:60`）· `references/mcp-bundle.md`（`:3`）
- `node_modules/@deepseek-ai/dsh-mcp-client/README.md`（`:5`、`:28`、`:57-63`、`:71`、`:75`、`:107-108`、`:128`、`:136`）
- `node_modules/@deepseek-ai/dsh-webhook/README.md`（`:12`、`:28`、`:37`、`:39`、`:41`、`:57`、`:72`）
- `node_modules/@deepseek-ai/dsh-credentials/README.md`（`:12`、`:55-56`、`:61`、`:65-81`、`:95`、`:97`、`:113-117`）
- `node_modules/@deepseek-ai/dsh-acp/README.md`（`:5`、`:12`）· `node_modules/@deepseek-ai/dsh-subagent-acp/README.md`（`:12`）
- `node_modules/@deepseek-ai/dsh-http-proxy/README.md`（`:12`）· `node_modules/@deepseek-ai/dsh-web-fetch-http/README.md`（`:12`）
- `node_modules/@deepseek-ai/dsh-mcp-resources/README.md`（`:12`）· `node_modules/@deepseek-ai/dsh-package-manifest/README.md`（`:33`）
- **负面取证（"官方没有"的依据）**：对 `node_modules/@deepseek-ai/*` 做全量包名枚举与 grep，
  `a2a` / `agent2` / `openapi` / `swagger` / `smtp` / `imap` / `mail` / `email` / `grpc` / `mqtt` / `socket` **零命中**。

**外部资料**
- A2A 项目存在性：[Linux Foundation 新闻页](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)（**仅取到新闻页，规范正文未取到**）
- 企业微信：[消息推送配置说明](https://developer.work.weixin.qq.com/document/path/91770)（入口页已取到，逐字段规范未取到）
- 钉钉：[机器人回复与发送消息](https://help.dingtalk.io/ja/open/dingstart/robot-reply-and-send-messages)（**日文页**；中文逐字段规范未取到）
- 飞书/Lark：[事件订阅概览](https://open.feishu.cn/document/server-docs/event-subscription-guide/overview)（入口页已取到，权限与配额细则未取到）
- 微信公众号/服务号、阿里云短信、腾讯云短信、支付类、地图/天气 API：**未取到**权威文档页（本次搜索未命中官网文档首页，故 §5 相应行标"待核实"）
