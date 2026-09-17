/**
 * [INPUT]: 依赖 GitSmartHttpService、DeviceRequestContextResolver 与 projectId 路径参数。
 * [OUTPUT]: 提供 /enterprise/api/v1/git/{projectId} 的 Smart HTTP info/refs、upload-pack、receive-pack。
 * [POS]: workspace/web 的 Git 协议入口；Basic→Bearer 由 GitBasicAuthFilter 完成后再解析会话。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.web.DeviceRequestContextResolver;
import com.owndsh.enterprise.workspace.application.CloudWorkspaceService;
import com.owndsh.enterprise.workspace.git.GitSmartHttpService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/enterprise/api/v1/git")
public final class GitSmartHttpController {
    private final GitSmartHttpService git;
    private final CloudWorkspaceService workspace;
    private final DeviceRequestContextResolver contexts;

    public GitSmartHttpController(
        GitSmartHttpService git,
        CloudWorkspaceService workspace,
        DeviceRequestContextResolver contexts
    ) {
        this.git = git;
        this.workspace = workspace;
        this.contexts = contexts;
    }

    @GetMapping("/{projectId}/info/refs")
    public void infoRefs(
        @PathVariable long projectId,
        @RequestParam(name = "service", required = false) String service,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws Exception {
        authorize(projectId, request);
        try {
            git.handleInfoRefs(projectId, service, response);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "git repository unavailable", exception);
        }
    }

    @PostMapping("/{projectId}/git-upload-pack")
    public void uploadPack(
        @PathVariable long projectId,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws Exception {
        authorize(projectId, request);
        try {
            git.handleUploadPack(projectId, request, response);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "git repository unavailable", exception);
        }
    }

    @PostMapping("/{projectId}/git-receive-pack")
    public void receivePack(
        @PathVariable long projectId,
        HttpServletRequest request,
        HttpServletResponse response
    ) throws Exception {
        authorize(projectId, request);
        try {
            git.handleReceivePack(projectId, request, response);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "git repository unavailable", exception);
        }
    }

    private void authorize(long projectId, HttpServletRequest request) {
        DeviceCallContext context = contexts.resolve(request);
        workspace.authorizeGit(context.tenantId(), context.session().userId(), projectId);
    }
}
