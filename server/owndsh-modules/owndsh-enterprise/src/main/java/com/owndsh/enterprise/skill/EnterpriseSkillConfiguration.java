/**
 * [INPUT]: 依赖 JDBC/事务、设备/用户、revision/audit、ID 与 artifact root 配置。
 * [OUTPUT]: 装配 ZIP inspector、CAS store、JDBC ports、catalog 与 runtime 服务 Beans。
 * [POS]: skill 纵向模块的 Spring composition root。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.device.application.DeviceService;
import com.owndsh.enterprise.model.persistence.BootstrapUserStore;
import com.owndsh.enterprise.revision.BootstrapRevisionStore;
import com.owndsh.enterprise.skill.application.SkillCatalogService;
import com.owndsh.enterprise.skill.application.SkillRuntimeService;
import com.owndsh.enterprise.skill.artifact.SkillArtifactInspector;
import com.owndsh.enterprise.skill.artifact.SkillArtifactStore;
import com.owndsh.enterprise.skill.persistence.JdbcSkillStore;
import com.owndsh.enterprise.skill.persistence.SkillStore;
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
@EnableConfigurationProperties(EnterpriseSkillProperties.class)
public class EnterpriseSkillConfiguration {
    @Bean
    SkillStore enterpriseSkillStore(JdbcTemplate jdbcTemplate, JsonMapper jsonMapper) {
        return new JdbcSkillStore(jdbcTemplate, jsonMapper);
    }

    @Bean
    SkillArtifactStore enterpriseSkillArtifactStore(EnterpriseSkillProperties properties) {
        Path root = properties.getArtifactRoot();
        if (root == null) throw new IllegalStateException("enterprise.skill.artifact-root 必须配置");
        if (properties.getMaxArchiveBytes() <= 0 || properties.getMaxArchiveBytes() > 1_073_741_824L) {
            throw new IllegalStateException("enterprise.skill.max-archive-bytes 超出范围");
        }
        return new SkillArtifactStore(root, properties.getMaxArchiveBytes());
    }

    @Bean
    SkillArtifactInspector enterpriseSkillArtifactInspector(
        JsonMapper jsonMapper,
        EnterpriseSkillProperties properties
    ) {
        if (properties.getMaxExpandedBytes() < properties.getMaxArchiveBytes()
            || properties.getMaxExpandedBytes() > 4_294_967_296L) {
            throw new IllegalStateException("enterprise.skill.max-expanded-bytes 超出范围");
        }
        if (properties.getMaxEntries() < 1 || properties.getMaxEntries() > 100_000) {
            throw new IllegalStateException("enterprise.skill.max-entries 超出范围");
        }
        return new SkillArtifactInspector(
            jsonMapper, properties.getMaxExpandedBytes(), properties.getMaxEntries()
        );
    }

    @Bean
    SkillCatalogService enterpriseSkillCatalogService(
        PlatformTransactionManager transactionManager,
        SkillStore skillStore,
        SkillArtifactStore artifactStore,
        SkillArtifactInspector inspector,
        BootstrapRevisionStore revisionStore,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new SkillCatalogService(
            new TransactionTemplate(transactionManager), skillStore, artifactStore, inspector,
            revisionStore, auditSink, ids
        );
    }

    @Bean
    SkillRuntimeService enterpriseSkillRuntimeService(
        PlatformTransactionManager transactionManager,
        DeviceService deviceService,
        BootstrapUserStore userStore,
        SkillStore skillStore,
        SkillArtifactStore artifactStore,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new SkillRuntimeService(
            new TransactionTemplate(transactionManager), deviceService, userStore, skillStore,
            artifactStore, auditSink, ids
        );
    }
}
