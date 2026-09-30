/**
 * [INPUT]: 依赖 JDBC/事务、审计、ID 与 feedback artifact root 配置。
 * [OUTPUT]: 装配位图 inspector、CAS 附件库、JDBC 端口与 FeedbackService Bean。
 * [POS]: feedback 纵向模块的 Spring composition root。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback;

import com.owndsh.enterprise.audit.AuditSink;
import com.owndsh.enterprise.feedback.application.FeedbackService;
import com.owndsh.enterprise.feedback.artifact.FeedbackAttachmentStore;
import com.owndsh.enterprise.feedback.artifact.FeedbackImageInspector;
import com.owndsh.enterprise.feedback.persistence.FeedbackStore;
import com.owndsh.enterprise.feedback.persistence.JdbcFeedbackStore;
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
@EnableConfigurationProperties(EnterpriseFeedbackProperties.class)
public class EnterpriseFeedbackConfiguration {
    @Bean
    FeedbackStore enterpriseFeedbackStore(JdbcTemplate jdbcTemplate) {
        return new JdbcFeedbackStore(jdbcTemplate);
    }

    @Bean
    FeedbackAttachmentStore enterpriseFeedbackAttachmentStore(EnterpriseFeedbackProperties properties) {
        Path root = properties.getArtifactRoot();
        if (root == null) throw new IllegalStateException("enterprise.feedback.artifact-root 必须配置");
        if (properties.getMaxAttachmentBytes() <= 0 || properties.getMaxAttachmentBytes() > 10_485_760L) {
            throw new IllegalStateException("enterprise.feedback.max-attachment-bytes 超出范围");
        }
        return new FeedbackAttachmentStore(root, properties.getMaxAttachmentBytes());
    }

    @Bean
    FeedbackImageInspector enterpriseFeedbackImageInspector(EnterpriseFeedbackProperties properties) {
        if (properties.getMaxDimension() <= 0 || properties.getMaxDimension() > 16_384) {
            throw new IllegalStateException("enterprise.feedback.max-dimension 超出范围");
        }
        return new FeedbackImageInspector(properties.getMaxDimension());
    }

    @Bean
    FeedbackService enterpriseFeedbackService(
        PlatformTransactionManager transactionManager,
        FeedbackStore feedbackStore,
        FeedbackAttachmentStore attachmentStore,
        FeedbackImageInspector inspector,
        AuditSink auditSink,
        @Qualifier("enterpriseIdSupplier") LongSupplier ids
    ) {
        return new FeedbackService(
            new TransactionTemplate(transactionManager), feedbackStore, attachmentStore, inspector, auditSink, ids
        );
    }
}
