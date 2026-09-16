/**
 * [INPUT]: 依赖 JDBC/事务、设备/用户、revision/audit、ID 与 artifact root 配置。
 * [OUTPUT]: 装配 ZIP inspector、CAS store、JDBC ports、catalog 与 runtime 服务 Beans。
 * [POS]: preset 纵向模块的 Spring composition root。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.device.application.DeviceService;
import com.owndsh.enterprise.model.persistence.BootstrapUserStore;
import com.owndsh.enterprise.preset.application.PresetCatalogService;
import com.owndsh.enterprise.preset.application.PresetRuntimeService;
import com.owndsh.enterprise.preset.artifact.PresetArtifactInspector;
import com.owndsh.enterprise.preset.artifact.PresetArtifactStore;
import com.owndsh.enterprise.preset.persistence.JdbcPresetStore;
import com.owndsh.enterprise.preset.persistence.PresetStore;
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
import java.util.function.LongSupplier;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(EnterprisePresetProperties.class)
public class EnterprisePresetConfiguration {
    @Bean
    PresetStore enterprisePresetStore(JdbcTemplate jdbcTemplate) {
        return new JdbcPresetStore(jdbcTemplate);
    }

    @Bean
    PresetArtifactStore enterprisePresetArtifactStore(EnterprisePresetProperties properties) {
        Path root = properties.getArtifactRoot();
        if (root == null) throw new IllegalStateException("enterprise.preset.artifact-root 必须配置");
        if (properties.getMaxArchiveBytes() <= 0 || properties.getMaxArchiveBytes() > 1_073_741_824L) {
            throw new IllegalStateException("enterprise.preset.max-archive-bytes 超出范围");
        }
        return new PresetArtifactStore(root, properties.getMaxArchiveBytes());
    }

    @Bean
    PresetArtifactInspector enterprisePresetArtifactInspector(
        JsonMapper jsonMapper,
        EnterprisePresetProperties properties
    ) {
        if (properties.getMaxExpandedBytes() < properties.getMaxArchiveBytes()
            || properties.getMaxExpandedBytes() > 4_294_967_296L) {
            throw new IllegalStateException("enterprise.preset.max-expanded-bytes 超出范围");
        }
        if (properties.getMaxEntries() < 1 || properties.getMaxEntries() > 100_000) {
            throw new IllegalStateException("enterprise.preset.max-entries 超出范围");
        }
        return new PresetArtifactInspector(
            jsonMapper, properties.getMaxExpandedBytes(), properties.getMaxEntries()
        );
    }

    @Bean
    PresetCatalogService enterprisePresetCatalogService(
        PlatformTransactionManager transactionManager,
        PresetStore presetStore,
        PresetArtifactStore artifactStore,
        PresetArtifactInspector inspector,
        BootstrapRevisionStore revisionStore,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new PresetCatalogService(
            new TransactionTemplate(transactionManager), presetStore, artifactStore, inspector,
            revisionStore, auditSink, ids
        );
    }

    @Bean
    PresetRuntimeService enterprisePresetRuntimeService(
        PlatformTransactionManager transactionManager,
        DeviceService deviceService,
        BootstrapUserStore userStore,
        PresetStore presetStore,
        PresetArtifactStore artifactStore,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new PresetRuntimeService(
            new TransactionTemplate(transactionManager), deviceService, userStore, presetStore,
            artifactStore, auditSink, ids
        );
    }
}
