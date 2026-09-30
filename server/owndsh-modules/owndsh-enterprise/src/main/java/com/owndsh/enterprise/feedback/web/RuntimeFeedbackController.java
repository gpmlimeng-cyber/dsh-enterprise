/**
 * [INPUT]: 依赖可信 DeviceRequestContextResolver、FeedbackService 与 multipart metadata/attachments。
 * [OUTPUT]: 提供 `POST /enterprise/api/v1/feedback` 登录提交入口，返回 201 与提交通知投影。
 * [POS]: feedback/web 的员工入口；提交者与 installation 取自已认证会话，diagnostics 只接受白名单键。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.web;

import com.owndsh.enterprise.common.api.EnterpriseApiValidation;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.web.DeviceRequestContextResolver;
import com.owndsh.enterprise.feedback.application.FeedbackService;
import com.owndsh.enterprise.feedback.domain.FeedbackRecord;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/enterprise/api/v1/feedback")
public final class RuntimeFeedbackController {
    private final FeedbackService feedback;
    private final DeviceRequestContextResolver contexts;

    public RuntimeFeedbackController(FeedbackService feedback, DeviceRequestContextResolver contexts) {
        this.feedback = feedback;
        this.contexts = contexts;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EnterpriseResponse<FeedbackViews.Submission>> submit(
        @RequestPart("metadata") FeedbackSubmissionRequest metadata,
        @RequestPart(value = "attachments", required = false) List<MultipartFile> attachments,
        @RequestHeader(value = "Idempotency-Key", required = false) UUID idempotencyKey,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        if (idempotencyKey != null) {
            EnterpriseApiValidation.requireUuidV4(idempotencyKey, "Idempotency-Key");
        }
        FeedbackRecord submitted = feedback.submit(
            context,
            metadata.toSubmission(),
            idempotencyKey == null ? null : idempotencyKey.toString(),
            streams(attachments)
        );
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(new EnterpriseResponse<>(FeedbackViews.submission(submitted), context.requestId()));
    }

    private static List<InputStream> streams(List<MultipartFile> attachments) {
        if (attachments == null) return List.of();
        List<InputStream> streams = new ArrayList<>(attachments.size());
        for (MultipartFile attachment : attachments) {
            try {
                streams.add(attachment.getInputStream());
            } catch (IOException exception) {
                throw new IllegalStateException("反馈附件 multipart 无法读取", exception);
            }
        }
        return streams;
    }
}
