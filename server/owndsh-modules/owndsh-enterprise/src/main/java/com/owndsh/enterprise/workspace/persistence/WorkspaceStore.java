/**
 * [INPUT]: 接收 V31 项目与成员的 JDBC 读写需求。
 * [OUTPUT]: 对外提供 tenant 限定的创建、成员解析、slug 唯一与 keyset 列表端口。
 * [POS]: workspace/persistence 的 DIP；实现只服务 PostgreSQL，不含 Git 或 HTTP。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.persistence;

import com.owndsh.enterprise.workspace.domain.CloudProject;
import com.owndsh.enterprise.workspace.domain.CloudProjectMember;

import java.util.List;
import java.util.Optional;

public interface WorkspaceStore {
    boolean slugExists(String tenantId, String slug);

    void insert(CloudProject project);

    void insertMember(CloudProjectMember member);

    Optional<CloudProject> findById(String tenantId, long projectId);

    Optional<CloudProjectMember> findMembership(String tenantId, long projectId, long userId);

    List<CloudProjectMember> listMembers(String tenantId, long projectId);

    List<CloudProject> listByUser(String tenantId, long userId, long afterId, int limit);

    int countOwners(String tenantId, long projectId);

    int deleteMember(String tenantId, long projectId, long userId);

    /** 创建补偿：删除项目行（成员随 FK 级联）。 */
    int deleteProject(String tenantId, long projectId);

    boolean userExists(long userId);
}
