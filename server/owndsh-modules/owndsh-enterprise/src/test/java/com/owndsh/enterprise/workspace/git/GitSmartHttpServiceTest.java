/**
 * [INPUT]: 依赖 GitSmartHttpService、GitRepositoryService 与真实 JGit bare 仓库。
 * [OUTPUT]: 验证 Smart HTTP 广告帧/内容类型、非法 service 403、缺失仓库失败与非 fast-forward 拒绝策略。
 * [POS]: workspace/git 的协议与授权策略单测，不替代真实 HTTP 客户端压测。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.git;

import jakarta.servlet.http.HttpServletResponse;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceivePack;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class GitSmartHttpServiceTest {
    @TempDir
    Path tempDir;

    @Test
    void advertisesUploadPackAndReceivePackWithServiceFrames() throws Exception {
        GitRepositoryService repositories = new GitRepositoryService(tempDir);
        GitSmartHttpService service = new GitSmartHttpService(repositories);
        repositories.initBare(7L, "main");
        long id = 7L;

        MockHttpServletResponse upload = new MockHttpServletResponse();
        service.handleInfoRefs(id, "git-upload-pack", upload);
        String uploadBody = upload.getContentAsString(StandardCharsets.UTF_8);
        assertThat(upload.getContentType()).isEqualTo("application/x-git-upload-pack-advertisement");
        assertThat(uploadBody).startsWith("001e# service=git-upload-pack\n");

        MockHttpServletResponse receive = new MockHttpServletResponse();
        service.handleInfoRefs(id, "git-receive-pack", receive);
        assertThat(receive.getContentType()).isEqualTo("application/x-git-receive-pack-advertisement");
        assertThat(receive.getContentAsString(StandardCharsets.UTF_8))
            .startsWith("001f# service=git-receive-pack\n");
    }

    @Test
    void rejectsUnsupportedServiceWithForbidden() throws Exception {
        GitRepositoryService repositories = new GitRepositoryService(tempDir);
        GitSmartHttpService service = new GitSmartHttpService(repositories);
        repositories.initBare(8L, "main");

        MockHttpServletResponse response = new MockHttpServletResponse();
        service.handleInfoRefs(8L, "git-evil-pack", response);

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_FORBIDDEN);
    }

    @Test
    void failsClosedWhenRepositoryIsMissing() throws Exception {
        GitRepositoryService repositories = new GitRepositoryService(tempDir);
        GitSmartHttpService service = new GitSmartHttpService(repositories);

        MockHttpServletResponse response = new MockHttpServletResponse();
        assertThatThrownBy(() -> service.handleInfoRefs(999L, "git-upload-pack", response))
            .isInstanceOf(CloudWorkspaceGitException.class);
    }

    @Test
    void receivePackPolicyRejectsNonFastForwardButAllowsFirstPush() throws Exception {
        GitRepositoryService repositories = new GitRepositoryService(tempDir);
        repositories.initBare(9L, "main");
        try (Repository repository = repositories.open(9L)) {
            ReceivePack receivePack = GitSmartHttpService.createReceivePack(repository);
            assertThat(receivePack.isAllowNonFastForwards()).isFalse();
            assertThat(receivePack.isAllowCreates()).isTrue();
            assertThat(receivePack.isAllowDeletes()).isFalse();
        }
    }

    @Test
    void initializesHeadOnConfiguredBranch() throws Exception {
        GitRepositoryService repositories = new GitRepositoryService(tempDir);
        repositories.initBare(11L, "main");
        try (Repository repository = repositories.open(11L)) {
            assertThat(repository.getFullBranch()).isEqualTo("refs/heads/main");
        }
    }
}
