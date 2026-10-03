/**
 * [INPUT]: 依赖真 PostgreSQL（`PostgresTestDatabase`）、V43 五张表、`JdbcLibraryStore` 与 `LibraryDraftService`、一个只记内存的对象写入替身。
 * [OUTPUT]: 草稿生命周期的**逐条读数**：创建 → 更新（CAS 换 token）→ 发布（`number = 上一版 + 1`、指针移动、草稿消失）→ **发布后不可变**；以及四条拒绝路径（token 不匹配 / 基准过期 / 停用 / 非 markdown·text）、8 MiB 上限、跨租户不可见、级联删除顺序。
 * [POS]: library 的 application 行为门禁（本刀服务端的核心验收）。用真库而不是 mock：CAS 与唯一索引冲突只在真 SQL 上才看得见。
 * [PROTOCOL]: 变更时同步 bundle 侧 `manager.ts` 的同一批语义与 `library-drafts.spec.ts` 的用例名，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library;

import com.owndsh.enterprise.library.application.LibraryAccessException;
import com.owndsh.enterprise.library.application.LibraryDraftService;
import com.owndsh.enterprise.library.application.LibraryRevisionObjectWriter;
import com.owndsh.enterprise.library.application.LibraryRevisionObjects;
import com.owndsh.enterprise.library.domain.LibraryAsset;
import com.owndsh.enterprise.library.domain.LibraryDraft;
import com.owndsh.enterprise.library.domain.LibraryNode;
import com.owndsh.enterprise.library.domain.LibraryRevision;
import com.owndsh.enterprise.library.domain.LibraryScope;
import com.owndsh.enterprise.library.persistence.JdbcLibraryStore;
import com.owndsh.enterprise.test.PostgresTestDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class LibraryDraftServiceIntegrationTest {
    private static final String TENANT = "000000";
    private static final String OWNER = "7001";
    private static final String OTHER_TENANT = "000001";
    private static final Instant NOW = Instant.parse("2026-10-03T09:00:00Z");
    private static final long AUTHOR = 7001L;

    private static PostgresTestDatabase.Database database;
    private static JdbcLibraryStore store;

    private LibraryDraftService service;
    private RecordingObjects objects;

    @BeforeAll
    static void migrateOnce() {
        database = PostgresTestDatabase.create("library_drafts");
        PostgresTestDatabase.migrate(database, null);
        long departmentId = database.jdbc().queryForObject(
            "select dept_id from sys_dept where status='0' order by dept_id limit 1", Long.class
        );
        PostgresTestDatabase.insertActiveUser(database, AUTHOR, departmentId, "library.draft.author", "草稿作者");
        store = new JdbcLibraryStore(database.jdbc(), JsonMapper.builder().build());
    }

    @BeforeEach
    void reset() {
        // asset 与 revision 互指（循环外键），清库顺序必须先把指针断开再删行——顺序错了外键就会拒。
        database.jdbc().update("delete from ent_library_reference");
        database.jdbc().update("delete from ent_library_draft");
        database.jdbc().update("update ent_library_asset set current_revision_id=null");
        database.jdbc().update("delete from ent_library_revision");
        database.jdbc().update("delete from ent_library_asset");
        database.jdbc().update("delete from ent_library_node");
        objects = new RecordingObjects();
        service = new LibraryDraftService(
            store,
            objects,
            new TransactionTemplate(new DataSourceTransactionManager(database.dataSource())),
            new AtomicLong(9_000_000L)::incrementAndGet,
            Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }

    @Test
    void runsTheWholeDraftLifecycleAndFreezesThePublishedRevision() {
        Seeded seeded = seedMarkdownAsset("# 发布规范\n第一版正文\n");

        // ① 创建：正文取自基准修订，token 是新的，草稿不改动正式修订。
        LibraryDraft created = service.createDraft(TENANT, OWNER, AUTHOR, seeded.assetId(), null, seeded.content());
        step(1, "创建草稿", "draftId=" + created.id() + " baseRevisionId=" + created.baseRevisionId()
            + " token=" + created.revisionToken() + " 字节=" + created.contentByteLength()
            + " 资产当前修订=" + store.findAsset(TENANT, OWNER, seeded.assetId()).orElseThrow().currentRevisionId());
        assertThat(created.baseRevisionId()).isEqualTo(seeded.revisionId());
        assertThat(created.content()).isEqualTo(seeded.content());
        assertThat(created.contentByteLength()).isEqualTo(seeded.content().getBytes(StandardCharsets.UTF_8).length);
        assertThat(store.findAsset(TENANT, OWNER, seeded.assetId()).orElseThrow().currentRevisionId())
            .isEqualTo(seeded.revisionId());

        // ② 更新：token 换新；旧 token 再用一次必被拒（CAS）。
        String second = "# 发布规范\n第二版正文\n";
        LibraryDraft updated = service.updateDraft(TENANT, OWNER, created.id(), second, created.revisionToken());
        step(2, "更新草稿", "token " + created.revisionToken() + " → " + updated.revisionToken()
            + " 字节=" + updated.contentByteLength());
        assertThat(updated.revisionToken()).isNotEqualTo(created.revisionToken());
        assertThat(updated.content()).isEqualTo(second);
        assertThatThrownBy(() -> service.updateDraft(TENANT, OWNER, created.id(), "x", created.revisionToken()))
            .isInstanceOf(LibraryAccessException.class)
            .extracting(exception -> ((LibraryAccessException) exception).code())
            .isEqualTo("library/revision-conflict");

        // ③ 发布：number 递增、指针移动、草稿消失、对象写入恰好一次。
        LibraryRevision published = service.publishDraft(TENANT, OWNER, created.id(), updated.revisionToken(), "md");
        step(3, "发布", "revisionId=" + published.id() + " number=" + published.number()
            + " conversionStatus=" + published.conversionStatus()
            + " 资产当前修订=" + store.findAsset(TENANT, OWNER, seeded.assetId()).orElseThrow().currentRevisionId()
            + " 修订数=" + store.listRevisions(TENANT, OWNER, seeded.assetId()).size()
            + " 草稿还在=" + store.findDraft(TENANT, OWNER, created.id()).isPresent()
            + " 对象写入次数=" + objects.writes.size());
        assertThat(published.number()).isEqualTo(2);
        assertThat(published.conversionStatus()).isEqualTo(LibraryRevision.ConversionStatus.READY);
        assertThat(published.contentObjectRef()).isEqualTo("objects/" + seeded.assetId() + "/" + published.id() + "/content.md");
        assertThat(store.findAsset(TENANT, OWNER, seeded.assetId()).orElseThrow().currentRevisionId())
            .isEqualTo(published.id());
        assertThat(store.listRevisions(TENANT, OWNER, seeded.assetId())).hasSize(2);
        assertThat(store.findDraft(TENANT, OWNER, created.id())).isEmpty();
        assertThat(objects.writes).hasSize(1);

        // ④ 发布后不可变：同一草稿再发一次 ⇒ not-found（草稿已随发布消失）；旧修订的行内容一字未动。
        assertThatThrownBy(() -> service.publishDraft(TENANT, OWNER, created.id(), updated.revisionToken(), "md"))
            .isInstanceOf(LibraryAccessException.class)
            .extracting(exception -> ((LibraryAccessException) exception).code())
            .isEqualTo("library/not-found");
        assertThat(store.findRevision(TENANT, OWNER, seeded.revisionId()).orElseThrow())
            .isEqualTo(seeded.revision());
    }

    @Test
    void refusesStaleBasesDisabledAssetsAndForeignFormats() {
        Seeded seeded = seedMarkdownAsset("# 基准\n");
        LibraryDraft draft = service.createDraft(TENANT, OWNER, AUTHOR, seeded.assetId(), null, seeded.content());

        // 别人在这中间发布了新版本（手工落一条 + 挪指针，等价于另一次发布），草稿的基准就过期了。
        long otherRevision = 8_100_000L;
        store.insertRevision(new LibraryRevision(
            otherRevision, TENANT, OWNER, LibraryScope.PERSONAL, seeded.assetId(), 2,
            "a".repeat(64), 3, "objects/x/original.md", "b".repeat(64), 3, "objects/x/content.md",
            LibraryRevision.ConversionStatus.READY, List.of(), NOW
        ));
        assertThat(store.moveAssetCurrentRevision(TENANT, OWNER, seeded.assetId(), seeded.revisionId(), otherRevision, 3, NOW))
            .isEqualTo(1);
        assertThatThrownBy(() -> service.publishDraft(TENANT, OWNER, draft.id(), draft.revisionToken(), "md"))
            .isInstanceOf(LibraryAccessException.class)
            .extracting(exception -> ((LibraryAccessException) exception).code())
            .isEqualTo("library/base-revision-conflict");
        // 拒绝后草稿原样留着（不是"发了一半"）。
        assertThat(store.findDraft(TENANT, OWNER, draft.id())).isPresent();

        // 非 markdown/text：建一份 pdf 形状的资产，创建草稿必须被拒。
        long pdfNode = 7_100_000L;
        long pdfAsset = 8_100_001L;
        store.insertNode(new LibraryNode(pdfNode, TENANT, OWNER, LibraryScope.PERSONAL, null,
            LibraryNode.Kind.ASSET, "手册.pdf", 0, pdfAsset, NOW, NOW));
        store.insertAsset(new LibraryAsset(pdfAsset, TENANT, OWNER, LibraryScope.PERSONAL, pdfNode, "手册.pdf",
            LibraryAsset.Kind.PDF, "application/pdf", 0, null, LibraryAsset.Status.ACTIVE,
            LibraryAsset.Source.UPLOAD, NOW, NOW));
        assertThatThrownBy(() -> service.createDraft(TENANT, OWNER, AUTHOR, pdfAsset, null, ""))
            .isInstanceOf(LibraryAccessException.class)
            .extracting(exception -> ((LibraryAccessException) exception).code())
            .isEqualTo("library/draft-format");

        // 停用即隔离：停用后创建与发布两侧都拒。
        database.jdbc().update("update ent_library_asset set status='DISABLED' where id=?", seeded.assetId());
        assertThatThrownBy(() -> service.createDraft(TENANT, OWNER, AUTHOR, seeded.assetId(), null, "x"))
            .isInstanceOf(LibraryAccessException.class)
            .extracting(exception -> ((LibraryAccessException) exception).code())
            .isEqualTo("library/disabled");
        assertThatThrownBy(() -> service.publishDraft(TENANT, OWNER, draft.id(), draft.revisionToken(), "md"))
            .isInstanceOf(LibraryAccessException.class)
            .extracting(exception -> ((LibraryAccessException) exception).code())
            .isEqualTo("library/disabled");
    }

    @Test
    void capsTheDraftBodyAtEightMebibytesAndHidesDraftsFromOtherTenants() {
        Seeded seeded = seedMarkdownAsset("正文\n");
        LibraryDraft draft = service.createDraft(TENANT, OWNER, AUTHOR, seeded.assetId(), null, seeded.content());

        String tooBig = "x".repeat(8 * 1024 * 1024 + 1);
        assertThatThrownBy(() -> service.updateDraft(TENANT, OWNER, draft.id(), tooBig, draft.revisionToken()))
            .isInstanceOf(LibraryAccessException.class)
            .extracting(exception -> ((LibraryAccessException) exception).code())
            .isEqualTo("library/file-too-large");
        // 被拒的更新零副作用：token 还是旧的、正文一字未动。
        assertThat(store.findDraft(TENANT, OWNER, draft.id()).orElseThrow().revisionToken())
            .isEqualTo(draft.revisionToken());

        // 跨租户：同一个草稿 id 在别的租户视角下"不存在"。
        assertThat(store.findDraft(OTHER_TENANT, OWNER, draft.id())).isEmpty();
        assertThatThrownBy(() -> service.updateDraft(OTHER_TENANT, OWNER, draft.id(), "x", draft.revisionToken()))
            .isInstanceOf(LibraryAccessException.class)
            .extracting(exception -> ((LibraryAccessException) exception).code())
            .isEqualTo("library/not-found");
    }

    @Test
    void listsDraftsNewestFirstAndCascadesInForeignKeySafeOrder() {
        Seeded seeded = seedMarkdownAsset("正文\n");
        LibraryDraft first = service.createDraft(TENANT, OWNER, AUTHOR, seeded.assetId(), null, seeded.content());
        LibraryDraft second = service.createDraft(TENANT, OWNER, AUTHOR, seeded.assetId(), null, seeded.content());
        // 先建的先被改 ⇒ 它排到最前（updatedAt 降序）。
        service.updateDraft(TENANT, OWNER, first.id(), "改过\n", first.revisionToken());
        assertThat(service.listDrafts(TENANT, OWNER, seeded.assetId()).stream().map(LibraryDraft::id).toList())
            .containsExactly(first.id(), second.id());

        // 级联删除：外键全是 restrict，顺序错了这里就会抛。
        service.removeAsset(TENANT, OWNER, seeded.assetId(), seeded.nodeId());
        assertThat(store.findAsset(TENANT, OWNER, seeded.assetId())).isEmpty();
        assertThat(store.listRevisions(TENANT, OWNER, seeded.assetId())).isEmpty();
        assertThat(store.listDraftsOfAsset(TENANT, OWNER, seeded.assetId())).isEmpty();
        assertThat(store.findNode(TENANT, OWNER, seeded.nodeId())).isEmpty();
    }

    /** 一条最小事实：node + asset + 第一版修订。 */
    private record Seeded(long nodeId, long assetId, long revisionId, String content, LibraryRevision revision) {
    }

    /**
     * 打一行**实际读数**（不是"应当"）：与 bundle 侧 `library-*.spec.ts` 的 `step(n, …)` 同一手法，
     * 让 Surefire 日志里能直接看到每一步的真实值（验收时不必再进容器查库）。
     */
    private static void step(int index, String title, String reading) {
        System.out.println("[library-draft-step " + index + "] " + title + " ⇒ " + reading);
    }

    private static Seeded seedMarkdownAsset(String content) {
        long nodeId = 7_000_001L;
        long assetId = 8_000_001L;
        long revisionId = 8_500_001L;
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        store.insertNode(new LibraryNode(nodeId, TENANT, OWNER, LibraryScope.PERSONAL, null,
            LibraryNode.Kind.ASSET, "发布规范.md", 0, assetId, NOW, NOW));
        // asset 与 revision 互指：先落"尚无修订"的资产、再落修订、最后把指针 CAS 过去（真实发布走的是同一条路）。
        store.insertAsset(new LibraryAsset(assetId, TENANT, OWNER, LibraryScope.PERSONAL, nodeId, "发布规范.md",
            LibraryAsset.Kind.MARKDOWN, "text/markdown", 0, null, LibraryAsset.Status.ACTIVE,
            LibraryAsset.Source.UPLOAD, NOW, NOW));
        LibraryRevision revision = new LibraryRevision(
            revisionId, TENANT, OWNER, LibraryScope.PERSONAL, assetId, 1,
            "c".repeat(64), bytes.length, "objects/" + assetId + "/" + revisionId + "/original.md",
            "d".repeat(64), bytes.length, "objects/" + assetId + "/" + revisionId + "/content.md",
            LibraryRevision.ConversionStatus.READY, List.of(), NOW
        );
        store.insertRevision(revision);
        if (store.moveAssetCurrentRevision(TENANT, OWNER, assetId, null, revisionId, bytes.length, NOW) != 1) {
            throw new IllegalStateException("测试夹具无法把资产指针移到第一版修订");
        }
        return new Seeded(nodeId, assetId, revisionId, content, revision);
    }

    /** 对象写入替身：只记账（本刀没有生产实现，见 `LibraryRevisionObjectWriter` 的注释）。 */
    private static final class RecordingObjects implements LibraryRevisionObjectWriter {
        private final List<String> writes = new ArrayList<>();

        @Override
        public LibraryRevisionObjects write(long assetId, long revisionId, String extension, byte[] original, String content) {
            writes.add(assetId + "/" + revisionId + "." + extension);
            byte[] body = content.getBytes(StandardCharsets.UTF_8);
            return new LibraryRevisionObjects(
                "objects/" + assetId + "/" + revisionId + "/original." + extension,
                "e".repeat(64), original.length,
                "objects/" + assetId + "/" + revisionId + "/content.md",
                "f".repeat(64), body.length
            );
        }

        @Override
        public void remove(long assetId, long revisionId) {
            writes.add("removed:" + assetId + "/" + revisionId);
        }
    }
}
