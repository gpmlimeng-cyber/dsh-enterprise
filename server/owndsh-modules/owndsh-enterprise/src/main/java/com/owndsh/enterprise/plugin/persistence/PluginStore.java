/**
 * [INPUT]: 接收 tenant、catalog/version CAS、完整 assignment 集合和 ACTIVE 设备 inventory 事实。
 * [OUTPUT]: 提供自然键幂等、USER→DEPT→ALL 生效查询、主体存在性、inventory replace 端口与 **README 存量回填的两条有界/CAS 端口**。
 * [POS]: plugin application 的 PostgreSQL DIP 边界，隐藏 JSONB/bytea/窗口函数和 SQL 锁细节。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.plugin.persistence;

import com.owndsh.enterprise.plugin.domain.DevicePluginInventory;
import com.owndsh.enterprise.plugin.domain.PluginAssignment;
import com.owndsh.enterprise.plugin.domain.PluginPackage;
import com.owndsh.enterprise.plugin.domain.PluginVersion;
import com.owndsh.enterprise.plugin.domain.RuntimePluginAssignment;

import java.util.List;
import java.util.Optional;

public interface PluginStore {
    Optional<PluginPackage> findPackageByNameForUpdate(String tenantId, String packageName);

    Optional<PluginPackage> findPackageById(String tenantId, long packageId);

    Optional<PluginPackage> findPackageByIdForUpdate(String tenantId, long packageId);

    List<PluginPackage> listPackages(String tenantId, long afterId, int limit);

    void insertPackage(PluginPackage pluginPackage);

    boolean incrementPackageRevision(String tenantId, long packageId, long expectedRevision);

    Optional<PluginVersion> findExistingVersion(
        String tenantId,
        String packageName,
        String version,
        String sha256
    );

    Optional<PluginVersion> findVersion(String tenantId, long versionId);

    List<PluginVersion> listVersions(String tenantId, long packageId);

    void insertVersion(PluginVersion version);

    boolean transitionVersion(
        String tenantId,
        long versionId,
        PluginVersion.Status from,
        PluginVersion.Status to,
        long expectedRevision
    );

    /**
     * README 回填用的**跨租户**扫描（口径 20）：找出 `readme is null` 的版本行（有制品引用的那些）。
     *
     * <p>这是**系统级维护**查询、不是请求路径的一部分，故不带 tenant 参数（回填要把所有租户的存量行补齐）。
     * 有界：调用方给 limit，服务端启动时只处理前 limit 条，剩下的留给下一次启动，绝不一次扫全库。
     */
    List<PluginVersion> findVersionsMissingReadme(int limit);

    /**
     * 回填一条版本行的 README（CAS：`revision` 必须仍然等于读到的那个值，回填绝不覆盖并发写入）。
     *
     * @return 真的改到那一行（1 条）时为 true；CAS 失败（并发改了状态/其它写入）为 false，调用方跳过即可
     */
    boolean updateVersionReadme(String tenantId, long versionId, String readme, long expectedRevision);

    List<PluginAssignment> listAssignments(String tenantId, long packageId);

    void deleteAssignments(String tenantId, long packageId);

    void insertAssignment(PluginAssignment assignment);

    boolean subjectExists(PluginAssignment.SubjectType subjectType, long subjectId);

    List<RuntimePluginAssignment> findEffectiveAssignments(
        String tenantId,
        long userId,
        Long departmentId
    );

    void replaceInventory(String tenantId, long deviceId, List<DevicePluginInventory> inventory);

    List<DevicePluginInventory> listInventory(String tenantId, long afterId, int limit);
}
