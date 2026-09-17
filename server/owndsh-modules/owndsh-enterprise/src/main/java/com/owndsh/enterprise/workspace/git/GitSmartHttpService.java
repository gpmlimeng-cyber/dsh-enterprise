/**
 * [INPUT]: 依赖 bare 仓库打开、HttpServletRequest/Response 流与 JGit Upload/ReceivePack/RefAdvertiser。
 * [OUTPUT]: 对外提供 Smart HTTP 的 info/refs 与 upload-pack/receive-pack 流式处理，并默认拒绝非 fast-forward。
 * [POS]: workspace/git 的协议服务；鉴权在 GitBasicAuthFilter，此处只做仓库级 pack 流。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.git;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.PacketLineOut;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.RefAdvertiser;
import org.eclipse.jgit.transport.UploadPack;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;

public final class GitSmartHttpService {
    private static final Set<String> SERVICES = Set.of("git-upload-pack", "git-receive-pack");

    private final GitRepositoryService repositories;

    public GitSmartHttpService(GitRepositoryService repositories) {
        this.repositories = java.util.Objects.requireNonNull(repositories, "repositories");
    }

    public void handleInfoRefs(
        long projectId,
        String service,
        HttpServletResponse response
    ) throws IOException {
        String normalized = service == null ? "" : service.trim();
        if (!SERVICES.contains(normalized)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "unsupported git service");
            return;
        }
        applyCommonHeaders(response);
        try (Repository repository = repositories.open(projectId);
             OutputStream out = response.getOutputStream()) {
            if ("git-upload-pack".equals(normalized)) {
                response.setContentType("application/x-git-upload-pack-advertisement");
                writeServiceHeader(out, "git-upload-pack");
                new UploadPack(repository).sendAdvertisedRefs(new PacketRefAdvertiser(out));
            } else {
                response.setContentType("application/x-git-receive-pack-advertisement");
                writeServiceHeader(out, "git-receive-pack");
                ReceivePack receivePack = createReceivePack(repository);
                receivePack.sendAdvertisedRefs(new PacketRefAdvertiser(out));
            }
        }
    }

    public void handleUploadPack(long projectId, HttpServletRequest request, HttpServletResponse response)
        throws IOException {
        applyCommonHeaders(response);
        response.setContentType("application/x-git-upload-pack-result");
        try (Repository repository = repositories.open(projectId)) {
            new UploadPack(repository).upload(
                request.getInputStream(), response.getOutputStream(), response.getOutputStream()
            );
        }
    }

    public void handleReceivePack(long projectId, HttpServletRequest request, HttpServletResponse response)
        throws IOException {
        applyCommonHeaders(response);
        response.setContentType("application/x-git-receive-pack-result");
        try (Repository repository = repositories.open(projectId)) {
            createReceivePack(repository).receive(
                request.getInputStream(), response.getOutputStream(), response.getOutputStream()
            );
        }
    }

    private static void applyCommonHeaders(HttpServletResponse response) {
        response.setHeader("Expires", "Fri, 01 Jan 1980 00:00:00 GMT");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Cache-Control", "no-cache, max-age=0, must-revalidate");
    }

    private static void writeServiceHeader(OutputStream raw, String service) throws IOException {
        PacketLineOut out = new PacketLineOut(raw);
        out.writeString("# service=" + service + "\n");
        out.end();
        raw.flush();
    }

    private static ReceivePack createReceivePack(Repository repository) {
        ReceivePack receivePack = new ReceivePack(repository);
        receivePack.setAllowCreates(true);
        receivePack.setAllowDeletes(false);
        receivePack.setAllowNonFastForwards(false);
        return receivePack;
    }

    private static final class PacketRefAdvertiser extends RefAdvertiser {
        private final PacketLineOut out;
        private final OutputStream raw;

        private PacketRefAdvertiser(OutputStream raw) {
            this.raw = raw;
            this.out = new PacketLineOut(raw);
        }

        @Override
        protected void writeOne(CharSequence line) throws IOException {
            out.writeString(line.toString());
        }

        @Override
        protected void end() throws IOException {
            out.end();
            raw.flush();
        }
    }
}
