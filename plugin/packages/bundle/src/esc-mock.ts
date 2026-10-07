/**
 * [INPUT]: 只依赖 `node:fs` 的 `readFileSync`、`node:path` 的 `join` 与自身常量（无网络、无会话、无宿主上下文）
 * [OUTPUT]: 对外提供 `ENTERPRISE_ESC_MOCK_CONNECTORS`（连接器提供方演示数据，**逐字段对齐** NUWAX `ConnectorProviderInfo`）、
 *   `ENTERPRISE_ESC_MOCK_CATEGORY_TREE`、纯函数 `resolveEscMockPayload(path, params)`
 *   （按平台同一套查询参数筛出**平台信封**，未模拟的路径回 `undefined`）与开关读取 `readEscMockSwitch(env)`
 *   （回一个**显式结果**：`{enabled:true,file}` 或 `{enabled:false,reason}`，绝不把"读不到"说成"开着"）
 * [POS]: 「专家·技能·连接器」页面的**演示数据面**（口径 32）。
 *   ★为什么需要它：线上部署的后端（NUWAX 3.0.2）**没有连接器域**——`GET /api/connector/providers` 回
 *   Spring 的 `No static resource api/connector/providers`（同一份反编译接口清单里也只有 `/api/model/providers`），
 *   故"连接器"这一栏对着真平台**永远**画失败态。用户要按接口字段看这一栏的真实排版与交互，
 *   于是在宿主侧造一份**字段齐全**的演示目录。
 *   ★三条自我约束（与 `ui/src/market-mock.ts` 那份临时演示数据同纪律）：
 *   ① **默认关**：只有开关文件在且写着 `{"enabled":true}` 才生效（`readEscMockSwitch` 是唯一读开关的地方）；
 *      文件缺席/畸形/读不到**一律当关**——绝不允许"读不到开关"被当成"打开演示数据"。
 *   ② **只替换被模拟的那两个端点的响应**：路径逐字命中才生效，其余端点（含专家/技能的全部取数、
 *      以及**空间列表**——用户裁决空间要用平台真实数据）**一个字节都不碰**；
 *      交给页面的仍是**平台信封本身**（`{code,message,data,success}`），故页面的归一化、分页、
 *      分类筛选、卡片渲染**全走真实代码路径**——看到的排版就是真平台的排版。
 *   ③ **不冒充平台数据**：响应在本机信封上多一枚 `mock: true`，且 `GET …/esc/mock` 照实报开关态
 *      （页面侧那条「模拟数据」横幅已按用户裁决**整条撤下**——机器可读的事实仍在，只是不再占页面）。
 *
 * 数据字段**逐条**出自 NUWAX `src/types/interfaces/systemManage.ts:1043-1092` 的 `ConnectorProviderInfo`
 * （`id`/`spaceId`/`service`/`displayName`/`description`/`icon`/`category`/`tags`/`authType`/`baseUrl`/
 * `authConfig`/`oauthAppMode`/`source`/`providerVersion`/`managedBy`/`proxyEnabled`/`status`/`sortOrder`/
 * `connected`/`connectionId`/`connectionEnabled`/`actionCount`/`modified`/`created`），分页壳出自
 * `ConnectorProviderPageResult`（`records`/`total`/`pageNum`/`pageSize`），鉴权方式取值出自 `ConnectorAuthType`。
 *
 * 覆盖清单（造数据时刻意铺开，好让每一格都有真实渲染路径可看）：
 *  · `authType` **七个取值全覆盖**：`''`（最小字段那条）/ `no_auth` / `api_key` / `bearer` / `oauth2` /
 *    `oauth2_device` / `custom`；
 *  · `connected` 真/假、`connectionId` 有/无、`connectionEnabled` 真/假（"已连接的"卡片右上角那枚开关的两态）；
 *  · `status` 的 `enabled` / `disabled`（停用提供方在"系统广场"里仍应看得见、且与启用项**同版式**）；
 *  · `spaceId` 有/无（官方目录 vs 团队空间两条口径，官方 **24** 条 / 空间 **4** 条）；
 *  · `tags` 有 / 空数组 / 完全缺席三条路径；`description` 有 / 缺席 / 超长（含中英混排与超长不可断词）；
 *  · `baseUrl`/`authConfig`/`oauthAppMode`/`source`/`providerVersion`/`managedBy`/`proxyEnabled`/
 *    `actionCount`/`modified`/`created` 逐格至少有一条数据带上（**`icon` 与 `sortOrder` 两格是刻意的例外**，
 *    理由见下面那节——故"逐格至少一次"这句话只对**其余**可选格成立，别把它读成全 24 格）；
 *  · 条数 **24 + 4 = 28**，而页面 `pageSize` 默认 **20** ⇒ 官方目录（`scope=official`）第一页 20 条、
 *    第二页 4 条，**触底加载与"取不满就没了"两条判据都能真跑一遍**。
 *
 * ★三条**刻意**的取值（不是随手写的）：
 *  · **`icon` 一条都不给**。平台图标（`/api/logo/…`）要票据、头像（`/api/f/…`）回 `200+4010`，
 *    而演示数据里的地址**平台并不存在**：填了只会让图片代理如实失败、卡片的 `onError` 兜底接手
 *    （口径 33 起卡片已有兜底：失败一次换中性图标/首字头像）。故一律缺席，走兜底那条路径——它本来也该看一眼。
 *  · **`sortOrder` 一条都不写**：官方目录的先后由**数组顺序**表达（页面侧也没有客户端排序，
 *    见 `esc-list.ts` 的适配器），逐条编一个数字只会多出一份**可能与顺序打架的第二真源**。
 *    ★这一格是"可选项缺席"的**合法路径**本身，不是漏做——测试里那条覆盖率断言对它显式放行。
 *  · **分类的 `key` 与 `label` 取同一个中文串**。页面点二级分类时把**子节点的 key** 当 `category` 参数发给平台，
 *    故演示数据里每条记录的 `category` 必须与那个 key 逐字相同、筛选才连得上；用英文 key 会让卡片标题下方
 *    显示英文、用中文 key 则两处都是中文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 连接器提供方的鉴权方式（逐字对齐 NUWAX `ConnectorAuthType`，`systemManage.ts:1016-1023`）。 */
export type EscMockConnectorAuthType =
  | ''
  | 'no_auth'
  | 'api_key'
  | 'bearer'
  | 'oauth2'
  | 'oauth2_device'
  | 'custom'

/**
 * 一条连接器提供方（**逐字段**对齐 NUWAX `ConnectorProviderInfo`）。
 *
 * 只有 `id`/`service`/`displayName`/`authType` 在平台契约里是必填，其余一律可选——演示数据因此
 * 可以合法地"缺席"某些格（用户要看的是**缺字段时页面怎么画**，不是一份理想化的满编数据）。
 */
export interface EscMockConnectorProvider {
  /** 主键。 */
  readonly id: number
  /** 所属空间 ID（官方目录的提供方没有这一格）。 */
  readonly spaceId?: number
  /** 服务标识（如 `aliyun_oss`）。 */
  readonly service: string
  /** 显示名。 */
  readonly displayName: string
  /** 描述。 */
  readonly description?: string
  /** 图标 URL（演示数据**一律不给**，理由见文件头）。 */
  readonly icon?: string
  /** 主分类（取值与 {@link ENTERPRISE_ESC_MOCK_CATEGORY_TREE} 里连接器分支的子节点 key 逐字相同）。 */
  readonly category?: string
  /** 标签。 */
  readonly tags?: readonly string[]
  /** 鉴权方式。 */
  readonly authType: EscMockConnectorAuthType
  /** baseUrl。 */
  readonly baseUrl?: string
  /** 鉴权配置对象（自定义鉴权用 `fields[]` 描述要填哪几格）。 */
  readonly authConfig?: Readonly<Record<string, unknown>>
  /** OAuth 应用模式。 */
  readonly oauthAppMode?: string
  /** 来源。 */
  readonly source?: string
  /** 提供方版本。 */
  readonly providerVersion?: string
  /** 管理方。 */
  readonly managedBy?: string
  /** 是否启用代理。 */
  readonly proxyEnabled?: boolean
  /** 启用状态（小写英文 `enabled`/`disabled`）。 */
  readonly status?: 'enabled' | 'disabled'
  /** 排序值。 */
  readonly sortOrder?: number
  /** 是否已连接。 */
  readonly connected?: boolean
  /** 当前用户连接 id（已连接时有值）。 */
  readonly connectionId?: number
  /** 当前用户该连接的启用状态（已连接卡片右上角那枚开关）。 */
  readonly connectionEnabled?: boolean
  /** 工具/动作数量。 */
  readonly actionCount?: number
  /** 更新时间。 */
  readonly modified?: string
  /** 创建时间。 */
  readonly created?: string
}

/**
 * 演示用的连接器提供方目录（**官方目录**：`spaceId` 缺席）。
 *
 * 顺序即列表顺序（宿主不排序；页面的适配器也没有客户端排序），故这里的先后就是卡片网格里的先后。
 */
export const ENTERPRISE_ESC_MOCK_CONNECTORS: readonly EscMockConnectorProvider[] = [
  {
    id: 101,
    service: 'aliyun_oss',
    displayName: '阿里云 OSS',
    description: '把对象存储的读写、列举与签名地址生成接进智能体',
    category: '存储与文件',
    tags: ['存储', '对象存储'],
    authType: 'api_key',
    baseUrl: 'https://oss-cn-hangzhou.aliyuncs.com',
    authConfig: {
      fields: [
        { name: 'accessKeyId', label: 'AccessKey ID', secret: false },
        { name: 'accessKeySecret', label: 'AccessKey Secret', secret: true },
      ],
    },
    source: 'official',
    providerVersion: '1.4.2',
    managedBy: 'nuwax',
    proxyEnabled: true,
    status: 'enabled',
    connected: true,
    connectionId: 9001,
    connectionEnabled: true,
    actionCount: 8,
    modified: '2026-09-18 11:02:14',
    created: '2026-08-02 09:41:00',
  },
  {
    id: 102,
    service: 'aws_s3',
    displayName: 'Amazon S3',
    description: 'S3 桶列举、对象上传与下载',
    category: '存储与文件',
    tags: ['存储'],
    authType: 'api_key',
    baseUrl: 'https://s3.amazonaws.com',
    status: 'enabled',
    connected: false,
    actionCount: 6,
    created: '2026-08-02 09:41:00',
  },
  {
    id: 103,
    service: 'tencent_cos',
    displayName: '腾讯云 COS',
    description: '腾讯云对象存储（演示数据：这一条当前为停用状态）',
    category: '存储与文件',
    tags: ['存储', '对象存储'],
    authType: 'api_key',
    status: 'disabled',
    connected: false,
    actionCount: 5,
  },
  {
    id: 104,
    service: 'github',
    displayName: 'GitHub',
    description: '仓库、Issue、Pull Request 与 Actions 的读写',
    category: '开发工具',
    tags: ['代码托管', '开发者工具'],
    authType: 'oauth2',
    oauthAppMode: 'service',
    baseUrl: 'https://api.github.com',
    source: 'official',
    providerVersion: '2.0.0',
    status: 'enabled',
    connected: true,
    connectionId: 9002,
    connectionEnabled: true,
    actionCount: 21,
    modified: '2026-09-30 08:15:02',
    created: '2026-07-21 14:03:19',
  },
  {
    id: 105,
    service: 'gitlab',
    displayName: 'GitLab',
    description: 'SaaS 与自建两套 GitLab 都能接（自建需填 baseUrl）',
    category: '开发工具',
    tags: ['代码托管'],
    authType: 'oauth2',
    status: 'enabled',
    connected: false,
    actionCount: 17,
  },
  {
    id: 106,
    service: 'jira',
    displayName: 'Jira',
    description: '缺陷、迭代与看板管理（演示数据：这条已连接但开关是关的）',
    category: '开发工具',
    tags: ['项目管理'],
    authType: 'api_key',
    status: 'enabled',
    connected: true,
    connectionId: 9003,
    connectionEnabled: false,
    actionCount: 12,
  },
  {
    id: 107,
    service: 'feishu',
    displayName: '飞书',
    description: '消息、群组、云文档与多维表格',
    category: '通讯协作',
    tags: ['IM', '办公套件'],
    authType: 'oauth2',
    status: 'enabled',
    connected: true,
    connectionId: 9004,
    connectionEnabled: true,
    actionCount: 19,
  },
  {
    id: 108,
    service: 'dingtalk_robot',
    displayName: '钉钉机器人',
    description: '群机器人消息推送',
    category: '通讯协作',
    tags: ['IM', '机器人'],
    authType: 'custom',
    baseUrl: 'https://oapi.dingtalk.com',
    authConfig: {
      fields: [
        { name: 'webhook', label: 'Webhook 地址', secret: false },
        { name: 'secret', label: '加签密钥', secret: true },
      ],
    },
    status: 'enabled',
    connected: false,
    actionCount: 3,
  },
  {
    id: 109,
    service: 'wecom',
    displayName: '企业微信',
    description: '应用消息、通讯录与客户联系（演示数据：已连接、开关关）',
    category: '通讯协作',
    tags: ['IM'],
    authType: 'oauth2',
    status: 'enabled',
    connected: true,
    connectionId: 9005,
    connectionEnabled: false,
    actionCount: 14,
  },
  {
    id: 110,
    service: 'slack',
    displayName: 'Slack',
    description: '频道消息与工作流触发',
    category: '通讯协作',
    tags: ['IM'],
    authType: 'oauth2',
    status: 'enabled',
    connected: false,
    actionCount: 11,
  },
  {
    id: 111,
    service: 'gmail',
    displayName: 'Gmail',
    description: '邮件读取、发送与标签管理',
    category: '内容与办公',
    tags: ['邮件'],
    authType: 'oauth2_device',
    status: 'enabled',
    connected: true,
    connectionId: 9006,
    connectionEnabled: true,
    actionCount: 9,
  },
  {
    id: 112,
    service: 'google_calendar',
    displayName: 'Google 日历',
    description: '日程查询、创建与改期',
    category: '内容与办公',
    tags: ['日程'],
    authType: 'oauth2',
    status: 'enabled',
    connected: false,
    actionCount: 7,
  },
  {
    id: 113,
    service: 'notion',
    displayName: 'Notion',
    description: '页面、数据库与块级内容的读写',
    category: '内容与办公',
    tags: ['文档', '知识库'],
    authType: 'bearer',
    baseUrl: 'https://api.notion.com/v1',
    status: 'enabled',
    connected: true,
    connectionId: 9007,
    connectionEnabled: true,
    actionCount: 13,
  },
  {
    id: 114,
    service: 'confluence',
    displayName: 'Confluence',
    description: '空间与页面读写',
    category: '内容与办公',
    tags: ['文档'],
    authType: 'bearer',
    status: 'enabled',
    connected: false,
    actionCount: 10,
  },
  {
    id: 115,
    service: 'elasticsearch',
    displayName: 'Elasticsearch',
    description: '索引查询与聚合（内网免鉴权部署，无连接概念）',
    category: '数据与检索',
    tags: ['检索', '数据库'],
    authType: 'no_auth',
    baseUrl: 'http://es.internal:9200',
    managedBy: 'tenant',
    status: 'enabled',
    actionCount: 4,
  },
  {
    id: 116,
    service: 'postgres',
    displayName: 'PostgreSQL',
    description: '只读 SQL 查询（连接串自带凭据）',
    category: '数据与检索',
    tags: ['数据库'],
    authType: 'custom',
    authConfig: { fields: [{ name: 'dsn', label: '连接串', secret: true }] },
    status: 'enabled',
    connected: false,
    actionCount: 5,
  },
  {
    id: 117,
    service: 'redis',
    displayName: 'Redis',
    description: '键值读取（演示数据：这一条当前为停用状态）',
    category: '数据与检索',
    tags: ['数据库', '缓存'],
    authType: 'custom',
    status: 'disabled',
    connected: false,
    actionCount: 3,
  },
  {
    id: 118,
    service: 'tavily',
    displayName: 'Tavily 搜索',
    description: '面向智能体的联网检索',
    category: '数据与检索',
    tags: ['搜索', '工具'],
    authType: 'api_key',
    baseUrl: 'https://api.tavily.com',
    status: 'enabled',
    connected: true,
    connectionId: 9008,
    connectionEnabled: true,
    actionCount: 2,
  },
  {
    id: 119,
    service: 'zapier',
    displayName: 'Zapier',
    description: '把 6000+ 应用的自动化流程接进来',
    category: '自动化',
    tags: ['自动化', '工作流'],
    authType: 'api_key',
    status: 'enabled',
    connected: true,
    connectionId: 9009,
    connectionEnabled: true,
    actionCount: 6,
  },
  {
    id: 120,
    service: 'n8n',
    displayName: 'n8n',
    description: '自建工作流的触发与查询',
    category: '自动化',
    tags: ['自动化', '工作流'],
    authType: 'api_key',
    status: 'enabled',
    connected: false,
    actionCount: 4,
  },
  {
    // 最小字段那条：平台契约里的四个必填格只给三个半（`authType` 是空串这个合法取值），
    // 其余一律缺席 —— 用来看"卡片缺描述/缺分类/缺标签时"是不是仍然版式稳定。
    id: 121,
    service: 'minimal_provider',
    displayName: '最小字段示例',
    authType: '',
  },
  {
    // 超长文本那条：标题与描述都超长（含中英混排 + 不可断的英文长串），用来压两行省略。
    id: 122,
    service: 'long_text_provider',
    displayName: '超长名称示例：这是一个用来压版的连接器提供方名称，长到足以触发卡片标题的省略号',
    description:
      '这条演示数据刻意把名称与描述都写到很长，用来观察卡片标题与描述的两行省略是否按预期截断；描述里同时混排英文 Long English Words 与一段不可断的长串 VeryLongUnbrokenTokenThatShouldNotBreakTheLayout_0123456789，以及数字 1234567890。',
    category: '存储与文件',
    tags: ['压版', '长文本'],
    authType: 'api_key',
    status: 'enabled',
    connected: false,
    actionCount: 1,
  },
  {
    // 表情 + 空标签数组那条（`tags` 缺席与 `tags: []` 是两条不同的路径）。
    id: 123,
    service: 'emoji_provider',
    displayName: '🚀 表情与空标签示例',
    description: '带 emoji 的名称，以及一个空标签数组',
    category: '自动化',
    tags: [],
    authType: 'bearer',
    status: 'enabled',
    connected: false,
  },
  {
    // 标签/描述/图标全缺那条（标题下方的分类行仍在）。
    id: 124,
    service: 'no_tags_provider',
    displayName: '缺字段示例（无描述、无标签、无图标）',
    category: '数据与检索',
    authType: 'no_auth',
    status: 'enabled',
    connected: false,
  },
  // —— 以下四条带 `spaceId`：只出现在"团队空间"维度（`scope=space`），官方目录（`scope=official`）看不到。
  //    ★`spaceId` 一律指向**本机真机**的空间 id —— 用户裁决「空间要使用后台真实的空间，显示登录用户所属空间」
  //    之后，空间列表已改由平台提供（见下方"空间列表不再由演示数据提供"那处说明），
  //    故这四条挂的是真空间：2 个人空间 / 3 数智化 / 248 营销通空间 —— 这样连接器栏的「团队空间」
  //    点进真空间时不是空的。换部署要跟着改这两个数字。 ——
  {
    id: 201,
    spaceId: 3,
    service: 'space_oss_sync',
    displayName: '空间对象存储同步',
    description: '数智化空间里的对象存储连接器',
    category: '存储与文件',
    tags: ['空间内'],
    authType: 'api_key',
    status: 'enabled',
    connected: false,
    actionCount: 3,
  },
  {
    id: 202,
    spaceId: 3,
    service: 'space_mysql',
    displayName: '空间 MySQL 只读',
    description: '数智化空间里的数据库连接器（已连接且开关打开）',
    category: '数据与检索',
    tags: ['空间内', '数据库'],
    authType: 'custom',
    status: 'enabled',
    connected: true,
    connectionId: 9101,
    connectionEnabled: true,
    actionCount: 4,
  },
  {
    id: 203,
    spaceId: 2,
    service: 'space_kb_search',
    displayName: '空间知识库检索',
    description: '个人空间里的知识库检索连接器（已连接、开关关）',
    category: '数据与检索',
    tags: ['空间内', '检索'],
    authType: 'bearer',
    status: 'enabled',
    connected: true,
    connectionId: 9102,
    connectionEnabled: false,
    actionCount: 2,
  },
  {
    id: 204,
    spaceId: 248,
    service: 'space_im_bot',
    displayName: '空间群机器人',
    description: '营销通空间里的群机器人连接器（停用状态）',
    category: '通讯协作',
    tags: ['空间内', '机器人'],
    authType: 'custom',
    status: 'disabled',
    connected: false,
    actionCount: 1,
  },
]

/**
 * ★空间列表**不再由演示数据提供**（用户裁决：「空间要使用后台真实的空间，显示登录用户所属空间」）。
 *
 * 于是这里**没有**"演示空间"这一份数据：`GET /api/space/list` 走真平台，界面上的空间就是登录账号
 * 真正所属的空间（本机实测：2 个人空间 / 3 数智化 / 248 营销通空间，其中 248 的角色是 Admin）。
 * 上面那四条 `spaceId` 因此只是**真实空间 id 的字面量**（见它们的注释），不再有第二张"空间表"可对账。
 *
 * ★仍然保留演示数据的是**分类树**（`ENTERPRISE_ESC_MOCK_CATEGORY_TREE`）：平台那份的根节点是
 * Agent / PageApp / Plugin / Workflow / Template / Skill，**没有 `Connector` 根**，而连接器栏的
 * 二级分类正是从 `Connector` 根下取的（口径 32 的三处刻意取值之一）。要让连接器栏恢复真分类，
 * 前提是平台补上连接器域——那与第 32 条是同一件事。
 */

/** 演示用的连接器二级分类（`key` 与 `label` 取同一个中文串，理由见文件头）。 */
export const ENTERPRISE_ESC_MOCK_CONNECTOR_CATEGORIES: readonly {
  readonly key: string
  readonly label: string
}[] = [
  { key: '存储与文件', label: '存储与文件' },
  { key: '通讯协作', label: '通讯协作' },
  { key: '开发工具', label: '开发工具' },
  { key: '数据与检索', label: '数据与检索' },
  { key: '内容与办公', label: '内容与办公' },
  { key: '自动化', label: '自动化' },
]

/**
 * 演示用的广场分类树（`GET /api/published/category/list`）。
 *
 * ★这是**要补进真树的那一根**（口径 34 起）：分类树不再整棵替换——宿主把**平台真树**取回来再拼上这一根
 * （见 `esc-route.ts` 的 `mergeMockCategoryTree`）。平台 3.0.2 没有连接器域，真树里没有 `Connector` 根，
 * 而连接器栏的二级分类正是按 `key === 'Connector'` 取子节点，所以这一根只能由演示数据补。
 * 于是**专家/技能两栏不再降级**：它们读真树里的 `Agent`（本机实测 7 个子分类）/`Skill`（12 个）。
 * 只有在"没有会话 / 平台取不到"时才会退回这棵只剩连接器一份的树（`resolveEscMockPayload` 的兜底）。
 */
export const ENTERPRISE_ESC_MOCK_CATEGORY_TREE: readonly {
  readonly key: string
  readonly label: string
  readonly type: string
  readonly children: readonly { readonly key: string; readonly label: string }[]
}[] = [
  {
    key: 'Connector',
    label: '连接器',
    type: 'Connector',
    children: ENTERPRISE_ESC_MOCK_CONNECTOR_CATEGORIES,
  },
]

/**
 * 演示数据模拟的**平台路径闭集**（与宿主只读闭集的取数口径同一批参数）。
 *
 * ★只剩**两条**：连接器目录（平台 3.0.2 没有这个域）与分类树（平台那份没有 `Connector` 根，
 * 连接器栏的二级分类要靠它）。**空间列表已移出这份清单**——用户裁决空间要用平台真实数据
 * （见"空间列表不再由演示数据提供"那处说明）。
 */
export const ENTERPRISE_ESC_MOCK_ENDPOINTS: readonly string[] = [
  '/api/connector/providers',
  '/api/published/category/list',
]

/** 分类树那条平台路径（宿主拼装真树时要用；与 {@link ENTERPRISE_ESC_MOCK_ENDPOINTS} 里那条逐字一致）。 */
export const ENTERPRISE_ESC_MOCK_CATEGORY_PATH = '/api/published/category/list'

/** 平台统一信封（`code === '0000'` 为成功，与 `ui/src/esc/esc-constants.ts` 的 `ESC_SUCCESS_CODE` 同值）。 */
interface EscMockEnvelope {
  readonly code: '0000'
  readonly message: string
  readonly success: true
  readonly data: unknown
}

/** 造一枚**成功**的平台信封（页面照旧读 `code`/`data`，与真平台那条路径逐字同形）。 */
function envelope(data: unknown): EscMockEnvelope {
  return { code: '0000', message: 'success', success: true, data }
}

/** 取一个标量查询参数（缺席/形状不对一律 `undefined`，不猜）。 */
function scalarParam(params: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = params[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

/** 取一个正整数查询参数（`pageNum`/`pageSize`/`spaceId`）。 */
function positiveIntParam(params: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const raw = scalarParam(params, key)
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : undefined
}

/**
 * 按平台同一套查询参数筛出连接器目录（纯函数，**不看会话、不发网络**）。
 *
 * 参数口径取自 `ui/src/esc/esc-list.ts` 的四个连接器适配器：
 *  · 系统广场：`{pageNum, pageSize, scope:'official', category?, keyword?}`；
 *  · 团队空间：`{pageNum, pageSize, scope:'space', spaceId?, keyword?}`；
 *  · 已连接的：`{connected:'true', category?, keyword?}`（**不带分页**，一次性全量）；
 *  · 我启用的：`{connectionEnabled:'true', category?, keyword?}`（同上）。
 *
 * 故"带不带 `pageSize`"就是**服务端分页 vs 一次交回全部**的那条分界：与页面 `extract`/`extractAll`
 * 两条路径一一对应，分页时 `pageNum` 原样回给页面（`extractConnectorPage` 会拿它判 `hasMore`）。
 */
function connectorEnvelope(params: Readonly<Record<string, unknown>>): EscMockEnvelope {
  const scope = scalarParam(params, 'scope')
  const spaceId = positiveIntParam(params, 'spaceId')
  const category = scalarParam(params, 'category')
  const keyword = scalarParam(params, 'keyword')?.trim().toLowerCase()
  const status = scalarParam(params, 'status')
  const connectedOnly = scalarParam(params, 'connected') === 'true'
  const enabledOnly = scalarParam(params, 'connectionEnabled') === 'true'

  let records = [...ENTERPRISE_ESC_MOCK_CONNECTORS]
  // 官方目录 = 没有所属空间的提供方；团队空间 = 有所属空间的提供方（与平台两条口径同义）
  if (scope === 'official') records = records.filter(item => item.spaceId === undefined)
  if (scope === 'space') records = records.filter(item => item.spaceId !== undefined)
  if (spaceId !== undefined) records = records.filter(item => item.spaceId === spaceId)
  if (connectedOnly) records = records.filter(item => item.connected === true)
  if (enabledOnly) records = records.filter(item => item.connectionEnabled === true)
  if (category !== undefined && category.length > 0) {
    records = records.filter(item => item.category === category)
  }
  if (status !== undefined && status.length > 0) records = records.filter(item => item.status === status)
  if (keyword !== undefined && keyword.length > 0) {
    records = records.filter(item =>
      [item.displayName, item.service, item.description ?? '', ...(item.tags ?? [])].some(
        value => value.toLowerCase().includes(keyword),
      ),
    )
  }

  const pageSize = positiveIntParam(params, 'pageSize')
  if (pageSize === undefined) {
    // 「已连接的」/「我启用的」两条口径不带分页：一次交回全部（页面的 `extractAll` 两种壳都认）
    return envelope({ records, total: records.length, pageNum: 1, pageSize: records.length })
  }
  const pageNum = positiveIntParam(params, 'pageNum') ?? 1
  const start = (pageNum - 1) * pageSize
  return envelope({
    records: records.slice(start, start + pageSize),
    total: records.length,
    pageNum,
    pageSize,
  })
}

/**
 * 解析一次取数的**演示数据**响应。
 *
 * @param path - 已过宿主只读闭集的平台路径。
 * @param params - 已过形状门禁的扁平查询参数。
 * @returns 平台信封；**未被模拟的路径回 `undefined`**（调用方据此照常走真平台那条路）。
 */
export function resolveEscMockPayload(
  path: string,
  params: Readonly<Record<string, unknown>>,
): unknown | undefined {
  switch (path) {
    case '/api/connector/providers':
      return connectorEnvelope(params)
    case '/api/published/category/list':
      return envelope(ENTERPRISE_ESC_MOCK_CATEGORY_TREE)
    default:
      return undefined
  }
}

/** 开关文件的**环境变量覆盖**（给测试与"文件在别处"的部署用）。 */
export const ENTERPRISE_ESC_MOCK_FILE_ENV = 'DSHENT_ESC_MOCK_FILE'

/** 开关文件相对 `DSH_HOME` 的路径（DSH 的企业数据目录，与 `managed-plugins.json` 同级）。 */
export const ENTERPRISE_ESC_MOCK_RELATIVE_FILE = 'enterprise/esc-mock.json'

/** 开关没打开的原因（进日志/进本机状态路由，便于"为什么没生效"一眼可查）。 */
export type EscMockOffReason = 'no-home' | 'absent' | 'unreadable' | 'malformed' | 'disabled'

/** 开关读取结果（**显式结果**，不是"读不到就当关"的静默回落：每一种没打开都有名字）。 */
export type EscMockSwitch =
  | { readonly enabled: true; readonly file: string }
  | { readonly enabled: false; readonly reason: EscMockOffReason }

/**
 * 决议开关文件的位置。
 *
 * 优先 `DSHENT_ESC_MOCK_FILE`（部署可把它指到别处），否则 `${DSH_HOME}/enterprise/esc-mock.json`；
 * `DSH_HOME` 也没有 ⇒ `undefined`（回 `no-home`——**绝不**去猜一个绝对路径）。
 */
export function resolveEscMockFilePath(env: Readonly<Record<string, string | undefined>>): string | undefined {
  const explicit = env[ENTERPRISE_ESC_MOCK_FILE_ENV]
  if (explicit !== undefined && explicit.trim().length > 0) return explicit
  const home = env['DSH_HOME']
  if (home === undefined || home.trim().length === 0) return undefined
  return join(home, ENTERPRISE_ESC_MOCK_RELATIVE_FILE)
}

/**
 * 读开关：文件存在且正文是 `{"enabled":true}` 才算**开**。
 *
 * 五种"没开"各有名字：`no-home`（`DSH_HOME`/环境变量都没给）/ `absent`（文件不在）/
 * `unreadable`（读了抛——权限、目录当文件…）/ `malformed`（不是 JSON 对象）/ `disabled`（写着 `enabled:false`）。
 * ★这是**演示数据**的开关：任何一种读不出来都必须当**关**，绝不因为"读不到"而把演示数据放出去。
 */
export function readEscMockSwitch(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EscMockSwitch {
  const file = resolveEscMockFilePath(env)
  if (file === undefined) return { enabled: false, reason: 'no-home' }
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    // 读不到 = 开关文件不在（这是**正常的常态**，不是异常）：回一个显式的"没打开"。
    return { enabled: false, reason: 'absent' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { enabled: false, reason: 'malformed' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { enabled: false, reason: 'malformed' }
  }
  return (parsed as Record<string, unknown>)['enabled'] === true
    ? { enabled: true, file }
    : { enabled: false, reason: 'disabled' }
}
