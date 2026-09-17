/**
 * [INPUT]: 依赖 GitSmartHttpController、CloudWorkspaceService 替身、DeviceRequestContextResolver 替身与 MockMvc。
 * [OUTPUT]: 验证非成员 403、项目不存在 404、缺失仓库 404，以及授权先于 Git 流读取。
 * [POS]: workspace/web 的 Git 协议入口鉴权与错误映射测试。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

import jakarta.servlet.http.HttpServletRequest;
import com.owndsh.enterprise.auth.application.PlatformSession;
import com.owndsh.enterprise.auth.domain.PlatformClient;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.web.DeviceRequestContextResolver;
import com.owndsh.enterprise.workspace.application.CloudWorkspaceException;
import com.owndsh.enterprise.workspace.application.CloudWorkspaceService;
import com.owndsh.enterprise.workspace.git.GitRepositoryService;
import com.owndsh.enterprise.workspace.git.GitSmartHttpService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.file.Path;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("dev")
class GitSmartHttpControllerTest {
    @TempDir
    Path tempDir;

    private MockMvc mvc(CloudWorkspaceService workspace) {
        GitRepositoryService repositories = new GitRepositoryService(tempDir);
        DeviceRequestContextResolver contexts = request -> context();
        GitSmartHttpController controller = new GitSmartHttpController(
            new GitSmartHttpService(repositories), workspace, contexts
        );
        return MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new com.owndsh.enterprise.common.api.EnterpriseExceptionHandler())
            .build();
    }

    @Test
    void returnsForbiddenWhenCallerIsNotAMember() throws Exception {
        CloudWorkspaceService workspace = mock(CloudWorkspaceService.class);
        when(workspace.authorizeGit(anyString(), anyLong(), anyLong()))
            .thenThrow(new CloudWorkspaceException(CloudWorkspaceException.Kind.FORBIDDEN));

        mvc(workspace).perform(get("/enterprise/api/v1/git/42/info/refs").param("service", "git-upload-pack"))
            .andExpect(status().isForbidden());
    }

    @Test
    void returnsNotFoundWhenProjectIsUnknown() throws Exception {
        CloudWorkspaceService workspace = mock(CloudWorkspaceService.class);
        when(workspace.authorizeGit(anyString(), anyLong(), anyLong()))
            .thenThrow(new CloudWorkspaceException(CloudWorkspaceException.Kind.NOT_FOUND));

        mvc(workspace).perform(get("/enterprise/api/v1/git/42/info/refs").param("service", "git-upload-pack"))
            .andExpect(status().isNotFound());
    }

    @Test
    void returnsNotFoundWhenBareRepositoryIsMissing() throws Exception {
        CloudWorkspaceService workspace = mock(CloudWorkspaceService.class);
        when(workspace.authorizeGit(anyString(), anyLong(), anyLong())).thenReturn(null);

        mvc(workspace).perform(get("/enterprise/api/v1/git/42/info/refs").param("service", "git-upload-pack"))
            .andExpect(status().isNotFound());
    }

    private static DeviceCallContext context() {
        return new DeviceCallContext(
            "000000",
            new PlatformSession(
                1L, PlatformClient.DSH_DESKTOP, PlatformClient.DSH_DESKTOP.deviceType(), "device-1"
            ),
            "req_test",
            "127.0.0.1",
            new byte[32]
        );
    }
}
