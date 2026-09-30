/**
 * [INPUT]: 依赖 FeedbackService、enterprise-admin 可信上下文、认证 cursor 与 ent:feedback 权限码。
 * [OUTPUT]: 提供状态筛选的 keyset 列表、详情、状态流转与鉴权附件流。
 * [POS]: feedback/web 的管理入口；cursor AAD 绑定状态筛选，附件只在该 tenant 的该反馈下可读。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.web;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.owndsh.enterprise.auth.web.EnterpriseRequestContext;
import com.owndsh.enterprise.auth.web.IdentityAdminRequestContextResolver;
import com.owndsh.enterprise.common.api.CursorPageData;
import com.owndsh.enterprise.common.api.CursorPageMetadata;
import com.owndsh.enterprise.common.api.EnterpriseApiValidation;
import com.owndsh.enterprise.common.api.EnterpriseCursorCodec;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.feedback.application.FeedbackMutationContext;
import com.owndsh.enterprise.feedback.application.FeedbackService;
import com.owndsh.enterprise.feedback.domain.FeedbackAttachment;
import com.owndsh.enterprise.feedback.domain.FeedbackRecord;
import com.owndsh.enterprise.feedback.domain.FeedbackStatus;
import com.owndsh.enterprise.feedback.domain.FeedbackValidationException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/enterprise/admin/v1/feedback")
public final class AdminFeedbackController {
    private static final String CURSOR_SCOPE_PREFIX = "feedback:";

    private final FeedbackService feedback;
    private final IdentityAdminRequestContextResolver contexts;
    private final EnterpriseCursorCodec cursors;

    public AdminFeedbackController(
        FeedbackService feedback,
        IdentityAdminRequestContextResolver contexts,
        EnterpriseCursorCodec cursors
    ) {
        this.feedback = feedback;
        this.contexts = contexts;
        this.cursors = cursors;
    }

    @GetMapping
    @SaCheckPermission("ent:feedback:read")
    public EnterpriseResponse<CursorPageData<FeedbackViews.Item>> list(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(required = false) FeedbackStatus status,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        int pageLimit = EnterpriseApiValidation.requirePageLimit(limit);
        String scope = CURSOR_SCOPE_PREFIX + (status == null ? "" : status.wireValue());
        long afterId = cursors.decode(cursor, context.tenantId(), scope);
        FeedbackService.FeedbackPage page = feedback.list(context.tenantId(), status, afterId, pageLimit);
        List<FeedbackRecord> items = page.items();
        String nextCursor = page.hasMore() && !items.isEmpty()
            ? cursors.encode(context.tenantId(), scope, items.getLast().id())
            : null;
        return new EnterpriseResponse<>(
            new CursorPageData<>(
                items.stream().map(FeedbackViews::item).toList(),
                new CursorPageMetadata(page.hasMore(), pageLimit, nextCursor)
            ),
            context.requestId()
        );
    }

    @GetMapping("/{feedbackId}")
    @SaCheckPermission("ent:feedback:read")
    public EnterpriseResponse<FeedbackViews.Detail> detail(
        @PathVariable long feedbackId,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        return new EnterpriseResponse<>(
            FeedbackViews.detail(feedback.detail(context.tenantId(), feedbackId)), context.requestId()
        );
    }

    @PostMapping("/{feedbackId}/status")
    @SaCheckPermission("ent:feedback:write")
    public EnterpriseResponse<FeedbackViews.Detail> changeStatus(
        @PathVariable long feedbackId,
        @RequestHeader("If-Match") long expectedRevision,
        @RequestBody FeedbackStatusChangeRequest body,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        if (body == null || body.status() == null) {
            throw new FeedbackValidationException("缺少目标状态");
        }
        FeedbackRecord updated = feedback.changeStatus(
            new FeedbackMutationContext(
                context.tenantId(), context.actorId(), context.requestId(),
                context.sourceIp(), context.userAgentHash()
            ),
            feedbackId, expectedRevision, body.status(), body.note()
        );
        return new EnterpriseResponse<>(FeedbackViews.detail(updated), context.requestId());
    }

    @GetMapping("/{feedbackId}/attachments/{attachmentId}/content")
    @SaCheckPermission("ent:feedback:read")
    public ResponseEntity<StreamingResponseBody> attachmentContent(
        @PathVariable long feedbackId,
        @PathVariable long attachmentId,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        FeedbackAttachment attachment = feedback.requireAttachment(
            context.tenantId(), feedbackId, attachmentId
        );
        Path path = feedback.contentPath(attachment);
        StreamingResponseBody body = output -> stream(path, output);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(attachment.contentType()))
            .contentLength(attachment.sizeBytes())
            .cacheControl(CacheControl.noStore())
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                "inline; filename=\"" + attachment.sha256() + "." + attachment.extension() + "\""
            )
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "default-src 'none'; sandbox")
            .body(body);
    }

    private static void stream(Path path, OutputStream output) throws IOException {
        try (InputStream input = Files.newInputStream(path)) {
            input.transferTo(output);
        }
    }
}
