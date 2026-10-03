/**
 * [INPUT]: 依赖 PluginStore（跨租户找 readme 为空的行 + CAS 写回）、PluginArtifactStore（按 SHA-256 解析已存 tgz）与 PluginArtifactInspector（同一个验包器解 README）。
 * [OUTPUT]: 对外提供 `run(limit)`：把存量版本行的 README 按**已存制品**补齐，返回实际补上的条数；逐条失败只记 warning、绝不抛出。
 * [POS]: plugin/application 的**一次性维护动作**（启动时跑、也可被测试直接调用）：口径 20 上线时既有 6 条插件没有 README，而重传同一个 tgz 会被 `findExistingVersion` 判为幂等、根本不会重新验包——所以回填是唯一能把存量补齐的路径（也是唯一一次读回自己写出去的制品）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.application;

import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactStore;
import com.owndsh.enterprise.plugin.domain.PluginVersion;
import com.owndsh.enterprise.plugin.persistence.PluginStore;

import org.slf4j.Logger;

import java.nio.file.Path;
import java.util.List;
import java.util.Objects;

public final class PluginReadmeBackfill {
    /**
     * 单次启动最多回填多少条：**有界**是硬要求——启动路径上不能做无上限的全表扫描，
     * 剩下的留给下一次启动（本动作幂等，跑几次都能收敛）。
     */
    public static final int MAX_BACKFILL_PER_RUN = 500;

    private final PluginStore plugins;
    private final PluginArtifactStore artifacts;
    private final PluginArtifactInspector inspector;
    private final Logger logger;

    public PluginReadmeBackfill(
        PluginStore plugins,
        PluginArtifactStore artifacts,
        PluginArtifactInspector inspector,
        Logger logger
    ) {
        this.plugins = Objects.requireNonNull(plugins, "plugins");
        this.artifacts = Objects.requireNonNull(artifacts, "artifacts");
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.logger = Objects.requireNonNull(logger, "logger");
    }

    /** 便捷入口：用固定的 {@link #MAX_BACKFILL_PER_RUN} 跑一次。 */
    public int run() {
        return run(MAX_BACKFILL_PER_RUN);
    }

    /**
     * 跑一轮回填，返回真的写进去的条数。
     *
     * <p><b>绝不抛出</b>：这是启动路径上的维护动作，一条坏制品（文件在库里丢了、归档损坏、包名与
     * descriptor 不符）绝不能拦住整个服务启动——那一条只记 warning，下一轮/下一次启动再试。
     *
     * <p>逐条做三件事：① 用 `(artifactRef, sha256)` 从 CAS 目录取回**当初验过的那份 tgz**；
     * ② 用**同一个** `inspector.inspect` 解出 README（与上传时同一条代码路径，不存在第二套解析实现）；
     * ③ 按读到的 `revision` 做 CAS 写回（`updateVersionReadme` 里还有 `readme is null` 这道幂等闸）。
     * 解不出 README 的（正常制品没有 README）**不是失败**：它保持 NULL，员工端如实回落短描述。
     */
    public int run(int limit) {
        if (limit < 1 || limit > MAX_BACKFILL_PER_RUN) throw new IllegalArgumentException("README 回填上限非法");
        List<PluginVersion> pending;
        try {
            pending = plugins.findVersionsMissingReadme(limit);
        } catch (RuntimeException exception) {
            logger.warn("owndsh: plugin readme backfill scan failed, skipped this run", exception);
            return 0;
        }
        if (pending.isEmpty()) return 0;
        int filled = 0;
        for (PluginVersion version : pending) {
            try {
                Path archive = artifacts.resolve(version.artifactRef(), version.sha256());
                String readme = inspector.inspect(archive).readme();
                if (readme == null) continue;
                if (plugins.updateVersionReadme(version.tenantId(), version.id(), readme, version.revision())) {
                    filled++;
                }
            } catch (RuntimeException exception) {
                // 只记包名/版本/稳定事实，不记 README 正文（它是内容，不是日志素材）。
                logger.warn(
                    "owndsh: plugin readme backfill skipped one version"
                        + " [packageName=" + version.packageName() + " version=" + version.version()
                        + " versionId=" + version.id() + "]",
                    exception
                );
            }
        }
        if (filled > 0) {
            logger.info("owndsh: plugin readme backfill filled " + filled + " version(s)"
                + " (scanned " + pending.size() + ")");
        }
        return filled;
    }
}
