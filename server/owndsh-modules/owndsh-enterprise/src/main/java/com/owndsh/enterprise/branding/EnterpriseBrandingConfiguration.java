/**
 * [INPUT]: 依赖 JDBC/事务、审计、ID 与 artifact root 配置。
 * [OUTPUT]: 装配位图 inspector、CAS 资产库、JDBC 端口与 BrandingService Bean。
 * [POS]: branding 纵向模块的 Spring composition root。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.branding.application.BrandingService;
import com.owndsh.enterprise.branding.artifact.BrandingAssetStore;
import com.owndsh.enterprise.branding.artifact.BrandingImageInspector;
import com.owndsh.enterprise.branding.persistence.BrandingStore;
import com.owndsh.enterprise.branding.persistence.JdbcBrandingStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Path;
import java.util.function.LongSupplier;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(EnterpriseBrandingProperties.class)
public class EnterpriseBrandingConfiguration {
    @Bean
    BrandingStore enterpriseBrandingStore(JdbcTemplate jdbcTemplate) {
        return new JdbcBrandingStore(jdbcTemplate);
    }

    @Bean
    BrandingAssetStore enterpriseBrandingAssetStore(EnterpriseBrandingProperties properties) {
        Path root = properties.getArtifactRoot();
        if (root == null) throw new IllegalStateException("enterprise.branding.artifact-root 必须配置");
        if (properties.getMaxAssetBytes() <= 0 || properties.getMaxAssetBytes() > 10_485_760L) {
            throw new IllegalStateException("enterprise.branding.max-asset-bytes 超出范围");
        }
        return new BrandingAssetStore(root, properties.getMaxAssetBytes());
    }

    @Bean
    BrandingImageInspector enterpriseBrandingImageInspector(EnterpriseBrandingProperties properties) {
        if (properties.getMaxDimension() <= 0 || properties.getMaxDimension() > 16_384) {
            throw new IllegalStateException("enterprise.branding.max-dimension 超出范围");
        }
        return new BrandingImageInspector(properties.getMaxDimension());
    }

    @Bean
    BrandingService enterpriseBrandingService(
        PlatformTransactionManager transactionManager,
        BrandingStore brandingStore,
        BrandingAssetStore artifactStore,
        BrandingImageInspector inspector,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new BrandingService(
            new TransactionTemplate(transactionManager), brandingStore, artifactStore, inspector, auditSink, ids
        );
    }
}
