/**
 * [INPUT]: 依赖 SkillCatalogService、可信 enterprise-admin 上下文、认证 cursor 与 ent:skill 权限码。
 * [OUTPUT]: 提供 catalog list、multipart 上传、version publish/retire、visibility batch 与 builtin/featured 标记写入。
 * [POS]: skill/web 的管理 HTTP 入口，artifact 路径与 SKILL.md 正文永不进入响应。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.web;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.owndsh.enterprise.auth.web.EnterpriseRequestContext;
import com.owndsh.enterprise.auth.web.IdentityAdminRequestContextResolver;
import com.owndsh.enterprise.common.api.CursorPageData;
import com.owndsh.enterprise.common.api.CursorPageMetadata;
import com.owndsh.enterprise.common.api.EnterpriseApiValidation;
import com.owndsh.enterprise.common.api.EnterpriseCursorCodec;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.skill.application.SkillCatalogService;
import com.owndsh.enterprise.skill.application.SkillDisplayOverride;
import com.owndsh.enterprise.skill.application.SkillMutationContext;
import jakarta.servlet.http.HttpServletRequest;
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

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/enterprise/admin/v1/skills")
public final class AdminSkillController {
    private static final String CATALOG_CURSOR_SCOPE = "skill_packages";

    private final SkillCatalogService catalog;
    private final IdentityAdminRequestContextResolver contexts;
    private final EnterpriseCursorCodec cursors;

    public AdminSkillController(
        SkillCatalogService catalog,
        IdentityAdminRequestContextResolver contexts,
        EnterpriseCursorCodec cursors
    ) {
        this.catalog = catalog;
        this.contexts = contexts;
        this.cursors = cursors;
    }

    @GetMapping
    @SaCheckPermission("ent:skill:read")
    public EnterpriseResponse<CursorPageData<SkillViews.PackageView>> list(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "50") int limit,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        int pageLimit = EnterpriseApiValidation.requirePageLimit(limit);
        long afterId = cursors.decode(cursor, context.tenantId(), CATALOG_CURSOR_SCOPE);
        List<SkillCatalogService.CatalogItem> fetched = catalog.list(context.tenantId(), afterId, pageLimit + 1);
        boolean hasMore = fetched.size() > pageLimit;
        List<SkillCatalogService.CatalogItem> items = hasMore ? fetched.subList(0, pageLimit) : fetched;
        String nextCursor = hasMore
            ? cursors.encode(context.tenantId(), CATALOG_CURSOR_SCOPE, items.getLast().skillPackage().id())
            : null;
        return response(
            new CursorPageData<>(
                items.stream().map(SkillViews::packageView).toList(),
                new CursorPageMetadata(hasMore, pageLimit, nextCursor)
            ),
            context
        );
    }

    @PostMapping(path = "/versions", consumes = "multipart/form-data")
    @SaCheckPermission("ent:skill:write")
    public ResponseEntity<EnterpriseResponse<SkillViews.VersionView>> upload(
        @RequestHeader("Idempotency-Key") UUID idempotencyKey,
        @RequestPart("artifact") MultipartFile artifact,
        @RequestPart(value = "metadata", required = false) SkillUploadMetadata metadata,
        HttpServletRequest request
    ) {
        EnterpriseApiValidation.requireUuidV4(idempotencyKey, "Idempotency-Key");
        EnterpriseRequestContext context = contexts.resolve(request);
        try {
            SkillCatalogService.UploadResult result = catalog.upload(
                mutation(context), idempotencyKey, artifact.getInputStream(),
                metadata == null ? null : new SkillDisplayOverride(metadata.displayName(), metadata.description())
            );
            HttpStatus status = result.created() ? HttpStatus.CREATED : HttpStatus.OK;
            return ResponseEntity.status(status)
                .body(response(SkillViews.version(result.version()), context));
        } catch (IOException exception) {
            throw new IllegalStateException("技能 multipart 无法读取", exception);
        }
    }

    @PostMapping("/versions/{versionId}/actions/publish")
    @SaCheckPermission("ent:skill:write")
    public EnterpriseResponse<SkillViews.VersionView> publish(
        @PathVariable long versionId,
        @RequestHeader("If-Match") long expectedRevision,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        return response(SkillViews.version(catalog.publish(mutation(context), versionId, expectedRevision)), context);
    }

    @PostMapping("/versions/{versionId}/actions/retire")
    @SaCheckPermission("ent:skill:write")
    public EnterpriseResponse<SkillViews.VersionView> retire(
        @PathVariable long versionId,
        @RequestHeader("If-Match") long expectedRevision,
        HttpServletRequest request
    ) {
        EnterpriseRequestContext context = contexts.resolve(request);
        return response(SkillViews.version(catalog.retire(mutation(context), versionId, expectedRevision)), context);
    }

    @PostMapping("/{packageId}/assignments/batch")
    @SaCheckPermission("ent:skill:write")
    public EnterpriseResponse<List<SkillViews.AssignmentView>> replaceAssignments(
        @PathVariable long packageId,
        @RequestHeader("Idempotency-Key") UUID idempotencyKey,
        @RequestHeader("If-Match") long expectedRevision,
        @RequestBody SkillAssignmentBatchRequest body,
        HttpServletRequest request
    ) {
        EnterpriseApiValidation.requireUuidV4(idempotencyKey, "Idempotency-Key");
        EnterpriseRequestContext context = contexts.resolve(request);
        return response(
            catalog.replaceAssignments(mutation(context), packageId, expectedRevision, body.specs())
                .stream().map(SkillViews::assignment).toList(),
            context
        );
    }

    /**
     * 写入 builtin/featured 标记。
     *
     * <p>与 assignments/batch 同类：包级写操作带 JSON 请求体，故同时要求
     * {@code Idempotency-Key}（v4 幂等键格式门禁）与 {@code If-Match}（包级 revision CAS）；
     * 响应复用列表的 PackageView 投影，标记字段与列表接口同源。</p>
     */
    @PostMapping("/{packageId}/marks")
    @SaCheckPermission("ent:skill:write")
    public EnterpriseResponse<SkillViews.PackageView> updateMarks(
        @PathVariable long packageId,
        @RequestHeader("Idempotency-Key") UUID idempotencyKey,
        @RequestHeader("If-Match") long expectedRevision,
        @RequestBody SkillMarksRequest body,
        HttpServletRequest request
    ) {
        EnterpriseApiValidation.requireUuidV4(idempotencyKey, "Idempotency-Key");
        EnterpriseRequestContext context = contexts.resolve(request);
        return response(
            SkillViews.packageView(catalog.updateMarks(
                mutation(context), packageId, expectedRevision, body.requireBuiltin(), body.requireFeatured()
            )),
            context
        );
    }

    private static SkillMutationContext mutation(EnterpriseRequestContext context) {
        return new SkillMutationContext(
            context.tenantId(), context.actorId(), context.requestId(), context.sourceIp(), context.userAgentHash()
        );
    }

    private static <T> EnterpriseResponse<T> response(T data, EnterpriseRequestContext context) {
        return new EnterpriseResponse<>(data, context.requestId());
    }
}
