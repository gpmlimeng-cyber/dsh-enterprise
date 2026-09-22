/**
 * [INPUT]: 依赖 JDBC/Jackson/事务、设备/用户、revision/audit、ID 与 artifact root/环境 Ed25519/企业核心包清单配置。
 * [OUTPUT]: 装配 T13 带配置化核心包名单的 inspector、与 inspector 同上限的 zip/tgz 归一化器、默认关闭且开启时严格校验私钥的 JCS signer、CAS store、plugin persistence、catalog 与 runtime 服务 Beans。
 * [POS]: plugin 纵向模块的 Spring composition root，领域/application 不使用静态容器或请求路径；核心包真源在此从配置流入验包器。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.device.application.DeviceService;
import com.owndsh.enterprise.model.persistence.BootstrapUserStore;
import com.owndsh.enterprise.plugin.application.EffectivePluginResolver;
import com.owndsh.enterprise.plugin.application.PluginCatalogService;
import com.owndsh.enterprise.plugin.application.PluginRuntimeService;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactInspector;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactNormalizer;
import com.owndsh.enterprise.plugin.artifact.PluginArtifactStore;
import com.owndsh.enterprise.plugin.artifact.PluginManifestSigner;
import com.owndsh.enterprise.plugin.persistence.JdbcPluginStore;
import com.owndsh.enterprise.plugin.persistence.PluginStore;
import com.owndsh.enterprise.revision.BootstrapRevisionStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Path;
import java.util.Set;
import java.util.function.LongSupplier;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(EnterprisePluginProperties.class)
public class EnterprisePluginConfiguration {
    @Bean
    PluginStore enterprisePluginStore(JdbcTemplate jdbcTemplate, JsonMapper jsonMapper) {
        return new JdbcPluginStore(jdbcTemplate, jsonMapper);
    }

    @Bean
    PluginArtifactStore enterprisePluginArtifactStore(EnterprisePluginProperties properties) {
        Path root = properties.getArtifactRoot();
        if (root == null) throw new IllegalStateException("enterprise.plugin.artifact-root 必须配置");
        if (properties.getMaxArchiveBytes() <= 0 || properties.getMaxArchiveBytes() > 1_073_741_824L) {
            throw new IllegalStateException("enterprise.plugin.max-archive-bytes 超出范围");
        }
        return new PluginArtifactStore(root, properties.getMaxArchiveBytes());
    }

    @Bean
    PluginArtifactInspector enterprisePluginArtifactInspector(
        JsonMapper jsonMapper,
        EnterprisePluginProperties properties
    ) {
        if (properties.getMaxExpandedBytes() < properties.getMaxArchiveBytes()
            || properties.getMaxExpandedBytes() > 4_294_967_296L) {
            throw new IllegalStateException("enterprise.plugin.max-expanded-bytes 超出范围");
        }
        if (properties.getMaxEntries() < 1 || properties.getMaxEntries() > 100_000) {
            throw new IllegalStateException("enterprise.plugin.max-entries 超出范围");
        }
        properties.validate();
        return new PluginArtifactInspector(
            jsonMapper, properties.getMaxExpandedBytes(), properties.getMaxEntries(),
            Set.copyOf(properties.getCorePackages())
        );
    }

    /**
     * 归一化器的上限与 inspector 取同一组配置值：两者在"归一化 → 验包"链路上串联处理同一份内容，
     * 若各用一套上限，就会出现归一化放行、验包拒绝（或反之）的自相矛盾配置。
     */
    @Bean
    PluginArtifactNormalizer enterprisePluginArtifactNormalizer(EnterprisePluginProperties properties) {
        if (properties.getMaxExpandedBytes() < properties.getMaxArchiveBytes()
            || properties.getMaxExpandedBytes() > 4_294_967_296L) {
            throw new IllegalStateException("enterprise.plugin.max-expanded-bytes 超出范围");
        }
        if (properties.getMaxEntries() < 1 || properties.getMaxEntries() > 100_000) {
            throw new IllegalStateException("enterprise.plugin.max-entries 超出范围");
        }
        return new PluginArtifactNormalizer(properties.getMaxExpandedBytes(), properties.getMaxEntries());
    }

    @Bean
    PluginManifestSigner enterprisePluginManifestSigner(
        JsonMapper jsonMapper,
        EnterprisePluginProperties properties
    ) {
        return properties.isSigningEnabled()
            ? PluginManifestSigner.fromPkcs8(jsonMapper, properties.getSigningPrivateKey())
            : new PluginManifestSigner(jsonMapper, null);
    }

    @Bean
    EffectivePluginResolver enterpriseEffectivePluginResolver(
        PluginStore pluginStore,
        BootstrapRevisionStore revisionStore
    ) {
        return new EffectivePluginResolver(pluginStore, revisionStore);
    }

    @Bean
    PluginCatalogService enterprisePluginCatalogService(
        PlatformTransactionManager transactionManager,
        PluginStore pluginStore,
        PluginArtifactStore artifactStore,
        PluginArtifactNormalizer normalizer,
        PluginArtifactInspector inspector,
        PluginManifestSigner signer,
        BootstrapRevisionStore revisionStore,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new PluginCatalogService(
            new TransactionTemplate(transactionManager), pluginStore, artifactStore, normalizer, inspector, signer,
            revisionStore, auditSink, ids
        );
    }

    @Bean
    PluginRuntimeService enterprisePluginRuntimeService(
        PlatformTransactionManager transactionManager,
        DeviceService deviceService,
        BootstrapUserStore userStore,
        EffectivePluginResolver resolver,
        PluginStore pluginStore,
        PluginArtifactStore artifactStore,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new PluginRuntimeService(
            new TransactionTemplate(transactionManager), deviceService, userStore, resolver,
            pluginStore, artifactStore, auditSink, ids
        );
    }
}
