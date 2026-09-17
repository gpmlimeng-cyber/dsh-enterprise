# cloud-workspace/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 云端工作空间客户端说明，记录最小同步闭环、Git Smart HTTP 鉴权与本地映射边界。
package.json: 私有 workspace 包清单；不依赖 Harness 真源，Git 子进程与平台请求均经注入端口。
tsconfig.json: strict TypeScript 构建边界，src→lib。
src/types.ts: 云端项目 DTO、本地映射、AccessToken/平台/Git 端口类型。
src/errors.ts: 稳定客户端错误码与 CloudWorkspaceError。
src/slug.ts: 与服务端兼容的 slug 规范化与路径校验。
src/mapping-store.ts: enterprise/cloud-workspace-mappings.json 原子 JSON 映射存储。
src/git-ops.ts: 系统 git + 凭据 GIT_ASKPASS 0700 临时目录（用户名 oauth2）注入，clone/pull/push/commit。
src/service.ts: list/create/clone/pull/commit/push/status 用例与映射合并。
src/index.ts: facade、createCloudWorkspaceHandle 与 createCloudWorkspaceLocalPort。
tests/*: slug/映射、服务行为、GitOps 命令构造/非 FF 错误映射/askpass 凭据清理验收。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
