# 配方 P0 切片 A —— 服务端验证报告(只验证,未部署)

执行时间:2026-10-02 17:0x–17:2x CST(服务器 UTC 09:0x–09:1x)
结论一句话:**切片 A 的"本机改动"在这台设备与构建源上都不存在,所以 ② 同步与 ③ 针对 V39 的编译/迁移验证无法执行**;其余可独立完成的验证我已全部做完并留证(基线编译通过、V0–V37 迁移链跑通、V39 三类 DDL 机制用合成探针证明可行、Testcontainers 环境可用)。**线上未被触碰。**

---

## 0. 阻塞(最重要)

本机与服务器**都找不到切片 A 的任何文件**。证据(原始命令与输出):

| 排查 | 命令 | 结果 |
|---|---|---|
| 本机全盘 | `find / -xdev -name 'PresetArtifactInspector.java'` | 无输出(0 命中) |
| 本机内容 | `grep -rl 'EnterprisePresetConfiguration\|PresetDependencyResolution\|V39__enterprise_preset' /storage/emulated/0 /data` | 无输出(0 命中) |
| 本机模块 | `find /storage /data -name 'owndsh-modules' -type d` | 无命中 |
| 本机工作区 | `~/.dsh/storages/workspace.json` 三个工作区 (`/storage/emulated/0/DSH/DSH-ENT`、`/storage/emulated/0/DSH`、`~/.dsh/workspaces/incoming`) | 均无 `server/` 工作树 |
| 服务器 | `find / -xdev -name 'V39*'` | 0 命中 |
| 服务器 | `/opt/work/src/.../preset/domain/PresetDependency.java` 等 5 个新增文件 | `No such file or directory` |

`/opt/work/src` 现有 preset 目录里**只有基线文件**(PresetVersion / PresetArtifactInspector / PresetStore / JdbcPresetStore / PresetCatalogService / PresetViews / EnterprisePresetConfiguration / EnterpriseExceptionHandler),最新迁移是 **V37**,没有 V38/V39。

→ 已就此单独发消息请上级裁决(A:发内容给我,或 B:只验证基线)。**在你给出文件前,②③④中的 V39 本体部分无法完成,不会用"应该没问题"糊过去。**

---

## 1. `/opt/work/src` 基线情况

| 项 | 事实 |
|---|---|
| 是否 git 仓库 | **否**。`git rev-parse --is-inside-work-tree` → `fatal: not a git repository`;`git log` 同样 fatal。**因此没有 HEAD 可记录** |
| 目录结构 | `/opt/work/src/{server,contracts,deploy,console}`(无根 pom/mvnw) |
| 构建入口 | `server/mvnw` + `server/pom.xml`(Maven 多模块,21 个 module) |
| JDK | `pom.xml`: `<java.version>21</java.version>`;Spring Boot 4.1.0 |
| 宿主机 java/mvn | **都没有**:`which java mvn` → no java/mvn;`java -version` → `command not found` |
| 真实构建方式 | `deploy/compose/Dockerfile.server`:基础镜像 `maven:3.9.11-eclipse-temurin-21-alpine`,工作目录 `/workspace/server`(`COPY server/ ./`),命令<br>`mvn -B -ntp -Pprod -DskipTests -pl owndsh-server -am package`<br>产物 `owndsh-server/target/owndsh-server.jar` |
| 镜像入口 | `deploy/scripts/build-release.sh` 实际调用 `docker build --platform linux/amd64 -f /opt/work/src/deploy/compose/Dockerfile.server -t dshent-server:<tag> /opt/work/src`;上一轮 category 部署即用此式(据 `/opt/work/cat-deploy/RECIPE-category-deploy.md`) |
| 依赖缓存 | **原本没有 `/root/.m2`**;但 `maven:3.9.11-eclipse-temurin-21-alpine`(582MB)与 `eclipse-temurin:21.0.8_9-jre-jammy` 镜像**已在服务器本地**;docker volume 里只有 `src_artifacts/src_postgres_data/src_redis_data` + mms_*,**没有 maven 缓存卷** |
| 现有 target | `/opt/work/src` 下已有 19 个 `target/` 目录(上一轮构建残留) |

构建源基线 sha256(**本次验证前后完全一致**):

```
39544466083062af6c6830eef10b6a0ac1da98d53f27bca5a9a655f2a3fdc593  preset/domain/PresetVersion.java
66d660e478e70e85866f4808ce35674ef5953af06dca4c0f69ee6131e389fdbc  preset/artifact/PresetArtifactInspector.java
24768e489b65d618353fbfa8ddb513971dff140d096d035423c9de7b41e6e77f  preset/persistence/PresetStore.java
dbc191b54c7cfef801a1630e45df5c7fc11c269a4dba3e3bf6dbc6af034995e7  preset/persistence/JdbcPresetStore.java
dba4b759ea6f57affba0cb56870b456e226a76e8263eee3eb5227d98a5c35b84  preset/application/PresetCatalogService.java
90eeaeeb77e6e5e68b8d06b9d57988827766df643397fb27b9aa141a5d64f3ec  preset/web/PresetViews.java
89ef66aaa2d01aedfda82341806ec3dca7adae08ab6d3372b69e82035f7aaaea  preset/EnterprisePresetConfiguration.java
296832a04292f5c83d3b95907256b2f1fed27bb9ab9461b54a59a1c1045b9e5a  common/api/EnterpriseExceptionHandler.java
a85f6fe713728912fecd3f25c999e39c0694780c0156da2a94d97a99f900cf7b  test/preset/artifact/PresetArtifactInspectorTest.java
ec58d4a233773720c19e7773a51fa99b3387a9c3dc49dfdf814f9b039d04c030  test/database/EnterpriseMigrationTest.java
```
(路径前缀 `.../owndsh-enterprise/src/main/java/com/owndsh/enterprise/`,测试为 `.../src/test/java/com/owndsh/enterprise/`)

迁移链:`V0__host_baseline.sql … V37__enterprise_skill_category.sql`,共 **38 个**,全部位于唯一迁移目录 `owndsh-enterprise/src/main/resources/db/migration`;Flyway 配置 `locations: classpath:db/migration`(`owndsh-server/src/main/resources/application.yml:126-130`)。

---

## 2. 同步了哪些文件 / 逐文件 sha256 对照

**同步文件数 = 0。** 无源可同步,因此:
- **没有**创建 `/opt/work/slice-a-backup-<时间戳>/`(无对象可备份);
- **没有**任何双向 sha256 对照表可列(不存在"本机侧"文件);
- 作为替代证明:`/opt/work/src` 的 10 个基线文件 sha256 在我全部操作**前后逐字节一致**(见 §1 表),且 `PresetDependency.java`、`V39__enterprise_preset_dependencies.sql` 在操作后仍报 `No such file or directory` —— 即我**没有伪造/新增任何源文件**。

**唯一实际的文件通道验证**:我用 base64-over-SSH 通道把两个探针 SQL 从本机送到服务器,双向 sha256 完全一致,证明"一旦拿到切片 A 文件,这条通道可用":

```
d61816255d5dedc0230f82c91116d14225dd8282c90924a75f30b21fa1f5eee8  slice-a-v39-probe.sql      (本机 = 服务器)
43d5860d4d61b7c0b54c210a76cf914da84df9143bad41224f74fbfae0df3164  slice-a-v39-probe-neg.sql  (本机 = 服务器)
```

---

## 3. 编译结果

**基线编译:通过(BUILD SUCCESS)。** 已知的构建方式原样复用,只是把 `package` 换成 `compile` 以省时:

```sh
docker run --rm --name slice-a-mvn-baseline \
  -v /opt/work/src:/w -v /opt/work/slice-a-m2:/root/.m2 -w /w/server \
  maven:3.9.11-eclipse-temurin-21-alpine \
  mvn -B -ntp -Pprod -DskipTests -pl owndsh-server -am compile
```

原始片段(完整日志 `/opt/work/slice-a-baseline-build.log`,391 行,`grep -c '^\[ERROR\]'` = **0**):

```
[INFO] owndsh-system ...................................... SUCCESS [  7.524 s]
[INFO] owndsh-enterprise .................................. SUCCESS [  7.253 s]
[INFO] owndsh-server ...................................... SUCCESS [  0.864 s]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:03 min
```

⚠️ **这只证明"基线能编译",不证明"切片 A 能编译"** —— 切片 A 的 Java 文件根本不在树上,无从编译。

---

## 4. 迁移与 SQL 执行结果

### 4.1 一次性库(严格隔离)

```
docker run -d --name slice-a-pg --network none \
  -e POSTGRES_DB=owndsh -e POSTGRES_USER=owndsh -e POSTGRES_PASSWORD=<随机14位> \
  postgres:17-alpine
```
- `--network none`,**无端口发布**(`Ports=map[]`),**不与 src_backend 同网络**,密码随机,只通过 `docker exec` 访问。
- 版本:`PostgreSQL 17.11 on x86_64-pc-linux-musl`。
- **已销毁**:`docker rm -f slice-a-pg` → `slice-a-pg removed`;`docker ps -a | grep slice-a` → 无残留。

### 4.2 真实迁移链 V0–V37:全部通过

逐文件 `psql -v ON_ERROR_STOP=1 -f -`(日志 `/opt/work/slice-a-migrate-baseline.log`):

```
OK V0 … OK V37   (38/38 OK,rc=0)
```
结果:public schema **62 张表**;`ent_preset_package` / `ent_preset_version` / `ent_preset_assignment` 三表就位。
(线上是 63 —— 差 1 张是因为线上有 Flyway 的 `flyway_schema_history`,我这里是手工按顺序执行的。)

### 4.3 V39 本体:**无法验证(文件不存在)**

没有 `V39__enterprise_preset_dependencies.sql`,所以**"V39 的列/约束/索引是否建成"这一问没有答案**,我不会编。

### 4.4 替代验证:三类 DDL 机制在 PG17 上确实可行(合成探针)

我用 **`ent_preset_version`(V30 真实表)**,按任务描述的形状写了合成探针(明确标注"不是 V39 本体"),脚本 `/opt/work/slice-a-v39-probe.sql`:

```sql
alter table ent_preset_version add column dependencies jsonb not null default '[]'::jsonb;
alter table ent_preset_version add constraint ck_ent_preset_version_dependencies
    check (jsonb_typeof(dependencies) = 'array' and jsonb_array_length(dependencies) <= 200);
create index ix_ent_preset_version_dependencies
    on ent_preset_version using gin (dependencies jsonb_path_ops);
```

**三条数据面验证(全绿):**

| # | 断言 | 结果 |
|---|---|---|
| 1 | `dependencies` 默认值 | `T1_DEFAULT_IS_EMPTY_ARRAY \| []` ✅ 落 `'[]'::jsonb` |
| 2 | 恰好 200 条 | `T2_EXACTLY_200_ACCEPTED \| 200` ✅ 接受 |
| 3 | `@>` containment | `T3_CONTAINMENT_@> \| 1` ✅ 命中 |

**负例(全部被正确拒绝):**

| 用例 | 原始结果 |
|---|---|
| 字符串 `'"not-an-array"'::jsonb` | `ERROR: new row … violates check constraint "ck_ent_preset_version_dependencies"` ✅ |
| 对象 `'{"a":1}'::jsonb` | 同上 check violation ✅ |
| 数字 `'123'::jsonb` | 同上 check violation ✅ |
| `null` | `ERROR: … violates not-null constraint` ✅ |
| 201 条 | `ERROR: new row … violates check constraint "ck_ent_preset_version_dependencies"` ✅ |

> 有价值的细节:这套写法在非数组时给出的是**干净的 check violation**,而不是 `jsonb_array_length` 的 "cannot get array length of a non-array" 运行错误 —— 说明 PG 先算了 `jsonb_typeof`。若 V39 用了别的写法(例如先 `jsonb_array_length`),错误类别会不同,值得对照。

**索引确实可用:**
```
set enable_seqscan=off;
Bitmap Heap Scan on ent_preset_version
  Recheck Cond: (dependencies @> '[{"id": "p7"}]'::jsonb)
  ->  Bitmap Index Scan on ix_ent_preset_version_dependencies
        Index Cond: (dependencies @> '[{"id": "p7"}]'::jsonb)
```
(不加 `enable_seqscan=off` 时规划器选 Seq Scan,因为表里只有 2 行 —— 属正常成本选择。)
**边界**:`dependencies ? 'p7'` 用不上 `jsonb_path_ops`(该 opclass 只支持 `@>`/`@?`/`@@`),若 V39 需要 `?` 必须建 `jsonb_ops` 默认 GIN。

---

## 5. Java 测试:跑了,可以跑

**环境结论:Testcontainers 在这台服务器上可用**(`DockerClientProviderStrategy -- Resolved dockerHost=unix:///var/run/docker.sock`)。跑法(关键点:`pom.xml` 里 `maven.test.skip=true` 是默认值,必须显式打开;`<groups>${profiles.active}</groups>`,dev 标签要走默认 `dev` profile 而非 `-Pprod`;过滤器不匹配的模块要加 `-Dsurefire.failIfNoSpecifiedTests=false`):

```sh
docker run --rm --name slice-a-mvn-test --network host \
  -v /opt/work/src:/w -v /opt/work/slice-a-m2:/root/.m2 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e DOCKER_HOST=unix:///var/run/docker.sock \
  -e TESTCONTAINERS_HOST_OVERRIDE=localhost -e TESTCONTAINERS_RYUK_DISABLED=true \
  -w /w/server maven:3.9.11-eclipse-temurin-21-alpine \
  mvn -B -ntp -Dmaven.test.skip=false -DskipTests=false -Dprofiles.active=dev \
      -Dtest=PresetArtifactInspectorTest,EnterpriseMigrationTest \
      -Dsurefire.failIfNoSpecifiedTests=false \
      -pl owndsh-modules/owndsh-enterprise -am test
```

本次实际执行了 **2 个类 / 12 个用例**(日志 `/opt/work/slice-a-test-baseline.log`):

| 测试类 | 结果 |
|---|---|
| `preset.artifact.PresetArtifactInspectorTest` | **4/4 通过** ✅ |
| `database.EnterpriseMigrationTest` | **8 跑,5 失败**(见下) |

`EnterpriseMigrationTest` 的 5 个失败**全部是基线自带的陈旧断言,与我无关**:
- `EnterpriseMigrationTest.java:161` ×4 —— `expected: "34" but was: "37"`(第 161 行仍写死"最新 = 34");
- `EnterpriseMigrationTest.java:82` ×1 —— 期望 `sys_menu` 里多一个 `"技能"` C 型菜单,但**任何迁移都没有插入这个菜单**(`grep 技能 db/migration/*.sql` 只命中 V35 的说明注释与两条 `F` 型权限行)。

**决定性佐证(已存在的历史)**:`/opt/work/cat-test.exit` = `1`,且 11:46 的旧日志 `/opt/work/cat-test.log` 第 1936–1975 行**是同样这 5 条、同样的行号(82/161)**。也就是说这条测试在我动手之前就是红的。

**没跑的:** 切片 A 新增的 `test/.../preset/domain/(新)`、`test/.../preset/application/(新)`、被改的 `PresetArtifactInspectorTest`、被改的 `EnterpriseMigrationTest` —— **它们在本机与服务器上都不存在**。

---

## 6. 线上容器/数据库未受影响的对照证据

| 指标 | 操作前基线 | 操作后 | 判定 |
|---|---|---|---|
| `src-postgres-1` 启动时刻 | `2026-09-22T07:43:57.095027844Z` | **完全相同** | 未重启 ✅ |
| `src-postgres-1` Health / Restarts | `healthy` / `0` | `healthy` / `0` | ✅ |
| `pg_postmaster_start_time()` | `2026-09-22 07:43:58.144174+00` | **完全相同** | 进程未重启 ✅ |
| Flyway 头 | `37\|enterprise skill category\|2026-10-02 12:17:24.649486` | **完全相同(含 installed_on 时间戳)** | 无迁移入账 ✅ |
| public 表数 | 63 | 63 | ✅ |
| 容器镜像 | `src-server-1=dshent-server:category-build`、`src-console-1=dshent-console:logo-fix`、`src-postgres-1=postgres:17.6-alpine3.22`、`src-redis-1=redis:7.4.5` | **完全相同** | 未换镜像 ✅ |
| `/opt/owndsh/src` | mtime `2026-10-02 15:53:49`(早于我 16:58 开工) | 未变 | 未触碰 ✅ |
| `/opt/owndsh/src/.env` | `OWNDSH_SERVER_IMAGE=dshent-server:category-build` | **未变** | ✅ |

> 说明:`information_schema.columns where column_name='dependencies'` 线上查出 1 条,是 `pg_catalog.pg_stats_ext.pg_dependencies`(PostgreSQL 系统目录自带),与本次无关;线上一律只执行过 `SELECT`。
> 另:所有写入都发生在 `--network none` 的一次性容器里,**线上库没有收到任何一条写语句**。

---

## 7. `/opt/work/src` 最终状态与建议

**源文件:一个字节都没改**(§1 十个 sha256 前后一致;新增目标文件仍不存在)。
**唯一的副作用是构建产物**(正常编译行为,非源码改动,无需还原):
- 19 个 `target/` 目录被刷新(原本就存在);
- `target/surefire-reports/` 写入本次测试报告(注意:**其中 11:46 的旧报告仍在同目录**,靠 mtime 区分)。
- 我新建的辅助物(可随时删):
  - `/opt/work/slice-a-m2/`(208MB,maven 本地仓库缓存,**建议保留**,后续真构建能省 60s+)
  - `/opt/work/slice-a-baseline-build.log`、`slice-a-migrate-baseline.log`、`slice-a-test-baseline.log`
  - `/opt/work/slice-a-v39-probe.sql`、`slice-a-v39-probe-neg.sql`
  - `/opt/work/slice-a-backup-*/` **未创建**(无对象可备份)

**后续部署口径建议**(等切片 A 真到手后):
1. 先按 §2 的 base64 通道逐个文件送过去,**并立刻建 `/opt/work/slice-a-backup-<ts>/` 备份同名旧文件**;
2. 用 §3 的 maven 命令(带 `-v /opt/work/slice-a-m2:/root/.m2`)做 `compile`,日志落 `/opt/work/slice-a-build.log`;
3. **V39 上树后必须同步把 `EnterpriseMigrationTest.java:161` 的 `"34"` 改成 `"39"`、并补 `:82` 期望里的 `"技能"`**(或确认切片 A 的版本已修),否则测试继续红;`tableCount == 38` 若 V39 加表也要跟着改;
4. 迁移验证继续用 `--network none` 的一次性 PG17;
5. 镜像构建(`Dockerfile.server`)**留给你显式下令**——本次未构建任何镜像、未 `compose up`、未碰 `/opt/owndsh`。

---

## 8. 其他不确定项

1. **本轮唯一硬阻塞**:切片 A 文件不存在(既不在本机也不在服务器)。②③(V39 本体)因此未完成。
2. `/opt/work/src` **不是 git 仓库**,无法用 HEAD/diff 证明"改动前长什么样";我只能用 sha256 快照做前后对照。
3. 我引用的一处疑点:任务描述里把 `EnterprisePresetConfiguration.java` 写成 `preset/web/PresetViews.java · preset/EnterprisePresetConfiguration.java`,实际基线文件确在 `preset/EnterprisePresetConfiguration.java`(不在 web 包),同步时别放错位置。
4. 本机文件通道:`remote.mjs` **不支持 stdin 管道**,我走的是 base64 内联 + 远端 `base64 -d`。单文件几十 KB 没问题,整目录建议先 tar+base64。
5. `EnterpriseMigrationTest` 是 `@Tag("dev")` 且 `<groups>${profiles.active}</groups>` —— 构建镜像用的 `-Pprod` 会把 dev 测试**整体跳过**,所以"镜像构建成功"不等于"测试通过"。
6. Testcontainers 我用 `TESTCONTAINERS_RYUK_DISABLED=true` 跑;本次运行结束后**没有残留容器**(已 `docker ps -a` 核对)。若后续要跑整套测试,建议保留 Ryuk 以获得自动清理。
7. 本机 `dsh-enterprise-main.zip`(9/30 快照)不含 `preset/` 目录,不是切片 A 的来源,已排除。
