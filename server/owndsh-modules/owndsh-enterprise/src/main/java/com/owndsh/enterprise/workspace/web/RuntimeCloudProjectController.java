/**
 * [INPUT]: 依赖 CloudWorkspaceService、DeviceRequestContextResolver、public base 与严格 DTO。
 * [OUTPUT]: 提供云端项目 create/list/get 与成员 add/remove 的 runtime HTTP 入口。
 * [POS]: workspace/web 的本人资源边界；身份只来自服务端 Token session。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

import jakarta.servlet.http.HttpServletRequest;
import com.owndsh.enterprise.auth.EnterpriseIdentityProperties;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.web.DeviceRequestContextResolver;
import com.owndsh.enterprise.workspace.application.CloudWorkspaceService;
import com.owndsh.enterprise.workspace.domain.CloudProjectMember;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/enterprise/api/v1/cloud-projects")
public final class RuntimeCloudProjectController {
    private final CloudWorkspaceService workspace;
    private final DeviceRequestContextResolver contexts;
    private final EnterpriseIdentityProperties identity;

    public RuntimeCloudProjectController(
        CloudWorkspaceService workspace,
        DeviceRequestContextResolver contexts,
        EnterpriseIdentityProperties identity
    ) {
        this.workspace = workspace;
        this.contexts = contexts;
        this.identity = identity;
    }

    @PostMapping
    public EnterpriseResponse<CloudProjectViews.View> create(
        @RequestBody CloudProjectCreateRequest body,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        CloudWorkspaceService.MemberProject created = new CloudWorkspaceService.MemberProject(
            workspace.create(context, body.name(), body.description()),
            CloudProjectMember.Role.OWNER
        );
        return response(CloudProjectViews.view(created, identity.getPublicBaseUrl()), context);
    }

    @GetMapping
    public EnterpriseResponse<List<CloudProjectViews.View>> list(HttpServletRequest request) {
        DeviceCallContext context = contexts.resolve(request);
        List<CloudProjectViews.View> items = workspace.listMine(context).stream()
            .map(value -> CloudProjectViews.view(value, identity.getPublicBaseUrl()))
            .toList();
        return response(items, context);
    }

    @GetMapping("/{projectId}")
    public EnterpriseResponse<CloudProjectViews.View> get(
        @PathVariable long projectId,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        return response(
            CloudProjectViews.view(workspace.get(context, projectId), identity.getPublicBaseUrl()),
            context
        );
    }

    @GetMapping("/{projectId}/members")
    public EnterpriseResponse<List<CloudProjectViews.MemberView>> members(
        @PathVariable long projectId,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        return response(
            workspace.listMembers(context, projectId).stream().map(CloudProjectViews::member).toList(),
            context
        );
    }

    @PostMapping("/{projectId}/members")
    public EnterpriseResponse<CloudProjectViews.MemberView> addMember(
        @PathVariable long projectId,
        @RequestBody CloudProjectMemberRequest body,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        return response(CloudProjectViews.member(workspace.addMember(context, projectId, body.userId())), context);
    }

    @DeleteMapping("/{projectId}/members/{userId}")
    public EnterpriseResponse<CloudProjectViews.MemberView> removeMember(
        @PathVariable long projectId,
        @PathVariable long userId,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        workspace.removeMember(context, projectId, userId);
        return response(new CloudProjectViews.MemberView(Long.toString(userId), "REMOVED", null), context);
    }

    private static <T> EnterpriseResponse<T> response(T data, DeviceCallContext context) {
        return new EnterpriseResponse<>(data, context.requestId());
    }
}
