# contracts/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: Harness 协议包边界，说明 OpenAPI 生成、品牌 ID、错误解码和禁止手改生成物规则。
package.json: 私有 workspace package 清单，固定 Hey API、Swagger Parser、Zod 和生成漂移门禁版本。
tsconfig.json: contracts TypeScript 构建边界，仅为 Hey API Fetch 生成物局部关闭 exactOptionalPropertyTypes，其余共享严格选项不变。
scripts/generate.mjs: 校验、bundle 并解引用模块化 OpenAPI，在临时目录生成自包含 OpenAPI JSON、Hey API/strict Zod、JSON Schema、完整逻辑协议 hash 与漂移检查。
src/generated/: 从唯一 OpenAPI 真源生成含 code/refresh Token 联合类型的通用、身份/auth/device、model/quota/gateway/plugin/Session/audit DTO、Fetch client、strict Zod 与协议元数据，禁止手工编辑。
src/brands.ts: 把 OpenAPI 字符串 schema 收窄为五类不可互换的品牌 ID，并只通过 Zod 校验后构造。
src/errors.ts: 严格解码统一错误 envelope，并从生成映射返回稳定 HTTP status。
src/index.ts: contracts 公共入口，只暴露品牌 ID、错误契约和身份/设备/模型/配额/插件/bootstrap/gateway 所需生成 DTO/Zod schema。
tests/contracts.spec.ts: 遍历 OpenAPI 声明的 45 个正反 fixture，验证 Zod、38 个错误码映射、P2-03 bootstrap、P2-06 成员身份、gateway facade、空签名/64 字节签名边界、封闭 audit metadata、未知字段拒绝、秘密字段拒绝和品牌隔离；**插件运行时投影的名字/描述两枚键各自成组：`displayName` 必填 1..120（缺席/空串/null/121 一律非法，1 与 120 是合法边界），`description` 可选 ≤1000（缺席合法、空串/null 非法）**。

**本刀（卡片标题 = 插件名称）**：`contracts/components/plugin.yaml` 新增 `PluginDisplayName`（string 1..120，**必填**：服务端由验包器缺省回退包名，永不为空），`PluginPackage.displayName` 改为引用它（等同值、单一真源），`RuntimePluginAssignment` 的 `required` 与 `properties` 都补上 `displayName`；两个正例 fixture（`plugin-assignments-success.json` / `bootstrap-models-success.json`）按接口契约带上它；两端生成物由 `generate.mjs` 产出（`--check` 0 drift）。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
