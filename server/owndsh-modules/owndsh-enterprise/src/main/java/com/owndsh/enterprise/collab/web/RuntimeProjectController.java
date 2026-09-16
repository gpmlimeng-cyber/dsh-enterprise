/**
 * [INPUT]: 依赖 CollabService、DeviceRequestContextResolver、EnterpriseCursorCodec 与严格 DTO。
 * [OUTPUT]: 提供 ACTIVE 设备的项目治理、成员、消息与 SSE stream 入口。
 * [POS]: collab/web 的 runtime 边界；成员关系即 ACL，不读 Session 正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.web;

import com.owndsh.enterprise.collab.application.CollabException;
import com.owndsh.enterprise.collab.application.CollabService;
import com.owndsh.enterprise.collab.persistence.CollabStore.MessageRow;
import com.owndsh.enterprise.collab.persistence.CollabStore.ProjectRow;
import com.owndsh.enterprise.common.api.CursorPageData;
import com.owndsh.enterprise.common.api.CursorPageMetadata;
import com.owndsh.enterprise.common.api.EnterpriseApiValidation;
import com.owndsh.enterprise.common.api.EnterpriseCursorCodec;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.web.DeviceRequestContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/enterprise/api/v1/projects")
public final class RuntimeProjectController {
    private static final long SSE_TIMEOUT_MS = 30 * 60 * 1000L;
    private static final long SSE_POLL_MS = 500L;
    private static final long SSE_HEARTBEAT_MS = 15_000L;

    private final CollabService collab;
    private final DeviceRequestContextResolver contexts;
    private final EnterpriseCursorCodec cursors;
    private final ExecutorService sseWorkers = Executors.newCachedThreadPool(runnable -> {
        Thread thread = new Thread(runnable, "collab-sse");
        thread.setDaemon(true);
        return thread;
    });

    public RuntimeProjectController(
        CollabService collab,
        DeviceRequestContextResolver contexts,
        EnterpriseCursorCodec cursors
    ) {
        this.collab = collab;
        this.contexts = contexts;
        this.cursors = cursors;
    }

    @PostMapping
    public EnterpriseResponse<CollabViews.ProjectView> create(
        @RequestBody ProjectWriteRequest body,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        return response(CollabViews.project(collab.createProject(context, body.name())), context);
    }

    @GetMapping
    public EnterpriseResponse<CursorPageData<CollabViews.ProjectView>> list(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "50") int limit,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        int pageLimit = EnterpriseApiValidation.requirePageLimit(limit);
        String scope = "projects_member:" + context.session().userId();
        long afterId = cursors.decode(cursor, context.tenantId(), scope);
        List<ProjectRow> fetched = collab.listProjects(context, afterId, pageLimit + 1);
        boolean hasMore = fetched.size() > pageLimit;
        List<ProjectRow> items = hasMore ? fetched.subList(0, pageLimit) : fetched;
        String next = hasMore
            ? cursors.encode(context.tenantId(), scope, items.getLast().id())
            : null;
        return response(new CursorPageData<>(
            items.stream().map(CollabViews::project).toList(),
            new CursorPageMetadata(hasMore, pageLimit, next)
        ), context);
    }

    @GetMapping("/{projectId}")
    public EnterpriseResponse<CollabViews.ProjectDetailView> get(
        @PathVariable long projectId,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        CollabService.ProjectDetail detail = collab.getProject(context, projectId);
        return response(CollabViews.detail(detail.project(), detail.members()), context);
    }

    @PostMapping("/{projectId}/members")
    public EnterpriseResponse<CollabViews.MemberView> addMember(
        @PathVariable long projectId,
        @RequestBody ProjectMemberRequest body,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        long userId = parseUserId(body.userId());
        return response(CollabViews.member(collab.addMember(context, projectId, userId)), context);
    }

    @DeleteMapping("/{projectId}/members/{userId}")
    public EnterpriseResponse<CollabViews.ProjectView> removeMember(
        @PathVariable long projectId,
        @PathVariable long userId,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        collab.removeMember(context, projectId, userId);
        return response(CollabViews.project(collab.getProject(context, projectId).project()), context);
    }

    @PostMapping("/{projectId}/owner")
    public EnterpriseResponse<CollabViews.ProjectView> transferOwner(
        @PathVariable long projectId,
        @RequestBody ProjectMemberRequest body,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        long userId = parseUserId(body.userId());
        return response(CollabViews.project(collab.transferOwner(context, projectId, userId)), context);
    }

    @PostMapping("/{projectId}/messages")
    public EnterpriseResponse<CollabViews.MessageView> postMessage(
        @PathVariable long projectId,
        @RequestBody CollabMessageRequest body,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        MessageRow row = collab.postMessage(
            context,
            projectId,
            body.idempotencyKey(),
            body.kind(),
            body.body(),
            body.targetSessionId(),
            body.targetSeq()
        );
        return response(CollabViews.message(row), context);
    }

    @GetMapping("/{projectId}/messages")
    public EnterpriseResponse<CursorPageData<CollabViews.MessageView>> listMessages(
        @PathVariable long projectId,
        @RequestParam(defaultValue = "0") long afterSeq,
        @RequestParam(defaultValue = "50") int limit,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        int pageLimit = EnterpriseApiValidation.requirePageLimit(limit);
        List<MessageRow> fetched = collab.listMessages(context, projectId, afterSeq, pageLimit + 1);
        boolean hasMore = fetched.size() > pageLimit;
        List<MessageRow> items = hasMore ? fetched.subList(0, pageLimit) : fetched;
        String next = hasMore ? Long.toString(items.getLast().serverSeq()) : null;
        return response(new CursorPageData<>(
            items.stream().map(CollabViews::message).toList(),
            new CursorPageMetadata(hasMore, pageLimit, next)
        ), context);
    }

    @GetMapping(value = "/{projectId}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream(
        @PathVariable long projectId,
        @RequestParam(defaultValue = "0") long afterSeq,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        collab.listMessages(context, projectId, afterSeq, 1);
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        sseWorkers.execute(() -> pump(context, projectId, afterSeq, emitter));
        return ResponseEntity.ok(emitter);
    }

    private void pump(
        DeviceCallContext context,
        long projectId,
        long startSeq,
        SseEmitter emitter
    ) {
        long cursor = startSeq;
        long lastHeartbeat = System.currentTimeMillis();
        try {
            while (!Thread.currentThread().isInterrupted()) {
                List<MessageRow> batch = collab.listMessages(context, projectId, cursor, 100);
                if (batch.isEmpty()) {
                    long now = System.currentTimeMillis();
                    if (now - lastHeartbeat >= SSE_HEARTBEAT_MS) {
                        emitter.send(SseEmitter.event().comment("heartbeat"));
                        lastHeartbeat = now;
                    }
                    Thread.sleep(SSE_POLL_MS);
                    continue;
                }
                for (MessageRow row : batch) {
                    emitter.send(SseEmitter.event()
                        .id(Long.toString(row.serverSeq()))
                        .data(CollabViews.message(row)));
                    cursor = row.serverSeq();
                }
                lastHeartbeat = System.currentTimeMillis();
            }
            emitter.complete();
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            emitter.completeWithError(ex);
        } catch (RuntimeException ex) {
            emitter.completeWithError(ex);
        }
    }

    private static long parseUserId(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
        try {
            long value = Long.parseLong(raw.trim());
            if (value <= 0) {
                throw new CollabException(CollabException.Kind.INVALID);
            }
            return value;
        } catch (NumberFormatException ex) {
            throw new CollabException(CollabException.Kind.INVALID);
        }
    }

    private static <T> EnterpriseResponse<T> response(T data, DeviceCallContext context) {
        return new EnterpriseResponse<>(data, context.requestId());
    }
}
