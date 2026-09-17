# @dshent/cloud-workspace

企业云端工作空间客户端：创建云端项目、映射本地目录、经企业 Access Token 做 Git Smart HTTP 同步。

- 真源在服务端 bare Git（`/enterprise/api/v1/git/{projectId}.git`）
- 客户端使用系统 `git` + `GIT_ASKPASS`
- Access Token 仅注入子进程环境，不进入映射 JSON
- 非 fast-forward push 映射为 `ENT_GIT_NON_FAST_FORWARD`
