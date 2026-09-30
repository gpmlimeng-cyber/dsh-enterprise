/**
 * [INPUT]: 依赖 BrandingService、可信 enterprise-admin 上下文、认证 cursor 与 ent:branding 权限码。
 * [OUTPUT]: 提供当前发布、revision 历史、multipart 资产上传、未发布资产预览与发布/回滚动作。
 * [POS]: branding/web 的管理 HTTP 入口；预览走管理鉴权，未发布品牌永不进入公开路由。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.web;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.owndsh.enterprise.auth.web.EnterpriseRequestContext;
import com.owndsh.enterprise.auth.web.IdentityAdminRequestContextResolver;
import com.owndsh.enterprise.branding.application.BrandingMutationContext;
import com.owndsh.enterprise.branding.application.BrandingService;
import com.owndsh.enterprise.branding.domain.BrandingAsset;
import com.owndsh.enterprise.branding.domain.BrandingDocument;
import com.owndsh.enterprise.common.api.CursorPageData;
import com.owndsh.enterprise.common.api.CursorPageMetadata;
import com.owndsh.enterprise.common.api.EnterpriseApiValidation;
import com.owndsh.enterprise.common.api.EnterpriseCursorCodec;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/enterprise/admin/v1/branding")
public final class AdminBrandingController {
    private static final String REVISIONS_CURSOR_SCOPE = "branding_revisions";

    private final BrandingService branding;
    private final IdentityAdminRequestContextResolver contexts;
    private final EnterpriseCursorCodec cursors;

    public AdminBrandingController(
        BrandingService branding,
        IdentityAdminRequestContextResolver contexts,
        EnterpriseCursorCodec cursors
    ) {
        this.branding = branding;
        this.contexts = contexts;
        this.cursors = cursors;
    }

    @GetMapping
    @SaCheckPermission("ent:branding:read")
    public EnterpriseResponse<BrandingViews.AdminBranding> current(HttpServletRequest request) {
        EnterpriseRequestContext context = contexts.resolve(request);
        return response(admin(context), context);
    }

    @GetMapping("/revisions")
    @SaCheckPermission("ent:branding:read")
    public EnterpriseResponse<CursorPageData<BrandingViews.AdminRevision>> revisions(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "50") int limit,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        int pageLimit = EnterpriseApiValidation.requirePageLimit(limit);
        long afterId = cursors.decode(cursor, context.tenantId(), REVISIONS_CURSOR_SCOPE);
        BrandingService.ListRevisions fetched = branding.listRevisions(context.tenantId(), afterId, pageLimit);
        List<BrandingDocument> items = fetched.documents();
        long currentRevision = admin(context).revision();
        String nextCursor = fetched.hasMore() && !items.isEmpty()
            ? cursors.encode(context.tenantId(), REVISIONS_CURSOR_SCOPE, items.getLast().id())
            : null;
        return response(
            new CursorPageData<>(
                items.stream().map(item -> BrandingViews.adminRevision(item, currentRevision)).toList(),
                new CursorPageMetadata(fetched.hasMore(), pageLimit, nextCursor)
            ),
            context
        );
    }

    @PostMapping(path = "/assets", consumes = "multipart/form-data")
    @SaCheckPermission("ent:branding:write")
    public ResponseEntity<EnterpriseResponse<BrandingViews.AdminBrandingAsset>> uploadAsset(
        @RequestHeader("Idempotency-Key") UUID idempotencyKey,
        @RequestPart("asset") MultipartFile asset,
        HttpServletRequest request
    ) {
        EnterpriseApiValidation.requireUuidV4(idempotencyKey, "Idempotency-Key");
        EnterpriseRequestContext context = contexts.resolve(request);
        try {
            BrandingAsset uploaded = branding.uploadAsset(
                mutation(context), idempotencyKey, asset.getInputStream()
            );
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(response(BrandingViews.adminAsset(uploaded), context));
        } catch (IOException exception) {
            throw new IllegalStateException("品牌资源 multipart 无法读取", exception);
        }
    }

    @GetMapping("/assets/{assetId}/content")
    @SaCheckPermission("ent:branding:read")
    public ResponseEntity<StreamingResponseBody> assetContent(
        @PathVariable long assetId,
        @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        BrandingAsset asset = branding.requireAsset(context.tenantId(), assetId);
        String etag = "\"" + asset.sha256() + "\"";
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }
        StreamingResponseBody body = output -> stream(branding.requireContent(asset), output);
        return ResponseEntity.ok()
            .contentType(org.springframework.http.MediaType.parseMediaType(asset.contentType()))
            .contentLength(asset.sizeBytes())
            .eTag(etag)
            .cacheControl(CacheControl.noStore())
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                "inline; filename=\"" + asset.sha256() + "." + asset.extension() + "\""
            )
            .header("X-Content-Type-Options", "nosniff")
            .body(body);
    }

    @PostMapping("/actions/publish")
    @SaCheckPermission("ent:branding:write")
    public EnterpriseResponse<BrandingViews.AdminBranding> publish(
        @RequestHeader("If-Match") long expectedRevision,
        @RequestBody BrandingPublishRequest body,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        branding.publish(mutation(context), expectedRevision, body.draft());
        return response(admin(context), context);
    }

    @PostMapping("/actions/rollback")
    @SaCheckPermission("ent:branding:write")
    public EnterpriseResponse<BrandingViews.AdminBranding> rollback(
        @RequestHeader("If-Match") long expectedRevision,
        @RequestBody BrandingRollbackRequest body,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        branding.rollback(mutation(context), expectedRevision, body.requireTargetRevision());
        return response(admin(context), context);
    }

    private BrandingViews.AdminBranding admin(EnterpriseRequestContext context) {
        return BrandingViews.adminBranding(branding.current(context.tenantId()));
    }

    private static void stream(Path path, OutputStream output) throws IOException {
        try (InputStream input = Files.newInputStream(path)) {
            input.transferTo(output);
        }
    }

    private static BrandingMutationContext mutation(EnterpriseRequestContext context) {
        return new BrandingMutationContext(
            context.tenantId(), context.actorId(), context.requestId(), context.sourceIp(), context.userAgentHash()
        );
    }

    private static <T> EnterpriseResponse<T> response(T data, EnterpriseRequestContext context) {
        return new EnterpriseResponse<>(data, context.requestId());
    }
}
