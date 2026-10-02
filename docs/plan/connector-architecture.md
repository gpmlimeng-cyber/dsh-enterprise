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
| `authRef` | **认证引用**：只写凭据**键名**，不写值 | 凭据引用串（官方 `ctx.credentials` ref） | C2；官方 `dsh-credentials/README.md:12` |
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
  ③ 启动失败默认不阻断宿主，但该服务器的工具**一个都不出现**（`:71`）；要强约束才开 `failOnStartupError: true`；
  ④ 官方 SDK 选用 2026-07-28 协议、不可用时回落旧修订（`:28`）—— 兼容性差异是真实风险，不要承诺"任意 MCP 服务器都行"。

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

### 6.3 授权范围与策略求值

- **范围**（可见性）：沿用仓库既有 assignment 口径 —— **全组织 / 指定成员，全量原子替换、禁增量补丁、CAS 冲突**
  （配方侧同构实现见 `docs/plan/enterprise-presets.md:71`）。
- **策略**（可用性）：`角色 × 范围 × 平台 × 能力等级上限 × 额度`（C5）。管理员设定的是**上限**，
  员工不能自行放宽；员工只能进一步**收紧自己的同意**。
- **失败一律 fail-closed**：引用不到 / 平台不支持 / 凭据不可写 / 未被分配 → **不可用并给可行动提示**，
  绝不静默降级（与配方侧同口径，`docs/plan/enterprise-presets.md:268`）。

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
> 迁移号参考：现有迁移到 `V37`（`.../db/migration/V37__enterprise_skill_category.sql`），
> `V38` 已被 `skill-ingest-center` 预定、`V39` 被配方二期预定（`docs/plan/enterprise-presets.md:730`、`:809`），
> **故连接器从 `V40` 起，且开工前必须重新对齐一次迁移号**。

### P0 — 最小可用：**"一条真能连上的出站 + 一套能管住的策略/审计"**（**11–18 人日**）

| 项 | 内容 | 人日 | 前置依赖 |
|---|---|---|---|
| P0-1 | 能力描述模型 + 注册表 + 策略求值器（§3.1/§3.2/§3.3）：纯内核、零平台依赖 | 2–3 | — |
| P0-2 | **MCP 出站连接器**：生成官方 MCP 配置的配置型 bundle（不写第二套客户端） | 1.5–2.5 | ⚠️ 官方安装面可达性（同 §8.3 第 1 条） |
| P0-3 | **凭据引用接入**：`authRef` → 官方 `ctx.credentials`；管理端"设没设/能不能改"观测面 | 1.5–2.5 | P0-1 |
| P0-4 | 企业侧最小账本：连接条目 + 可见范围（全量原子替换 + CAS）+ 迁移 `V40` + 审计 6 事件扩枚举 | 2.5–4 | P0-1；⚠️ **迁移号须先对齐**（`V38`/`V39` 已占） |
| P0-5 | 员工侧最小呈现：连接列表（三态：可用/需确认/不支持）+ 首次同意 + 可撤回；术语降维 | 2–3 | P0-3、P0-4 |
| P0-6 | 第一条**中国开箱即用**出站连接：企业微信群机器人 **或** 钉钉自定义机器人 **或** 只读 API（§5 第 1/3/10 行） | 1–2 | ⚠️ 需真机/真租户验证（§8.3 第 2 条） |
| P0-7 | 联调 + 验收（三态呈现、L3 每次确认、策略拒绝可行动、审计逐条覆盖） | 1.5–3 | P0-1…P0-6 |

**P0 合计 = 12–20 人日**（逐项区间相加：min 2+1.5+1.5+2.5+2+1+1.5 = 12.0；max 3+2.5+2.5+4+3+2+3 = 20.0）。**P0 的硬前置（"尚不存在"的能力）**：
① 官方安装面在**客户端侧**发起是否与会话内 `plugin_manager` 同一条面 —— **未验证**（同 `docs/plan/enterprise-presets.md:818-821`）；
② 迁移号 `V38`/`V39` 已被预定，连接器须确认 `V40` 可用。

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

1. **客户端侧发起装 bundle 是否与会话内 `plugin_manager` 同一条面 —— 未验证。**
   不确定的原因：这是从官方 skill/README **推出来的**，本会话**没有真机执行过一次**
   （同族未验证前提已记在 `docs/plan/enterprise-presets.md:818-821`）。
   **需要的验证**：从 Web 客户端侧发起一次装 bundle，看官方安装结果里的 `application` 字段是否为 `applied`；
   装完 Host 是否需重启才能生效。**开工第一步必须做这个 spike。**
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
