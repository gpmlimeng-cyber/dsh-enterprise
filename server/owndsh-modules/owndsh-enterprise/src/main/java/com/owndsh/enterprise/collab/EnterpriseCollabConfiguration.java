/**
 * [INPUT]: 依赖 JDBC/事务、AuditSink、enterpriseIdSupplier 与 EnterpriseCollabProperties。
 * [OUTPUT]: 装配 CollabStore 与 CollabService Beans。
 * [POS]: collab 纵向模块的 Spring composition root。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.collab.application.CollabService;
import com.owndsh.enterprise.collab.persistence.CollabStore;
import com.owndsh.enterprise.collab.persistence.JdbcCollabStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.function.LongSupplier;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(EnterpriseCollabProperties.class)
public class EnterpriseCollabConfiguration {
    @Bean
    CollabStore enterpriseCollabStore(JdbcTemplate jdbcTemplate) {
        return new JdbcCollabStore(jdbcTemplate);
    }

    @Bean
    CollabService enterpriseCollabService(
        PlatformTransactionManager transactionManager,
        CollabStore store,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids,
        EnterpriseCollabProperties properties
    ) {
        return new CollabService(transactionManager, store, auditSink, ids, properties.isEnabled());
    }
}
