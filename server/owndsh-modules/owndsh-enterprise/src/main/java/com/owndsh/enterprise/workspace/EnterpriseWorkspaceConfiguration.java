/**
 * [INPUT]: 依赖 JDBC、事务、GitRepositoryService、DeviceService 所需 ID 与 workspace properties。
 * [OUTPUT]: 装配 WorkspaceStore、Git bare 服务、Smart HTTP 服务与 CloudWorkspaceService Beans。
 * [POS]: workspace 纵向模块的 Spring composition root；repo-root 在 enabled 时必填。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.workspace.application.CloudWorkspaceService;
import com.owndsh.enterprise.workspace.git.GitRepositoryService;
import com.owndsh.enterprise.workspace.git.GitSmartHttpService;
import com.owndsh.enterprise.workspace.persistence.JdbcWorkspaceStore;
import com.owndsh.enterprise.workspace.persistence.WorkspaceStore;
import com.owndsh.enterprise.workspace.web.GitBasicAuthFilter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Path;
import java.util.function.LongSupplier;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(EnterpriseWorkspaceProperties.class)
public class EnterpriseWorkspaceConfiguration {
    @Bean
    FilterRegistrationBean<GitBasicAuthFilter> enterpriseGitBasicAuthFilter() {
        FilterRegistrationBean<GitBasicAuthFilter> registration = new FilterRegistrationBean<>(new GitBasicAuthFilter());
        registration.addUrlPatterns("/enterprise/api/v1/git/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 100);
        return registration;
    }

    @Bean
    WorkspaceStore enterpriseWorkspaceStore(JdbcTemplate jdbcTemplate) {
        return new JdbcWorkspaceStore(jdbcTemplate);
    }

    @Bean
    GitRepositoryService enterpriseGitRepositoryService(EnterpriseWorkspaceProperties properties) {
        if (!properties.isEnabled()) {
            return new GitRepositoryService(Path.of(System.getProperty("java.io.tmpdir"), "dshent-workspace-disabled"));
        }
        Path root = properties.getRepoRoot();
        if (root == null) {
            throw new IllegalStateException("enterprise.cloud-workspace.repo-root 必须配置");
        }
        return new GitRepositoryService(root);
    }

    @Bean
    GitSmartHttpService enterpriseGitSmartHttpService(GitRepositoryService repositories) {
        return new GitSmartHttpService(repositories);
    }

    @Bean
    CloudWorkspaceService enterpriseCloudWorkspaceService(
        PlatformTransactionManager transactionManager,
        WorkspaceStore store,
        GitRepositoryService repositories,
        EnterpriseWorkspaceProperties properties,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new CloudWorkspaceService(
            new TransactionTemplate(transactionManager), store, repositories, properties, auditSink, ids
        );
    }
}
