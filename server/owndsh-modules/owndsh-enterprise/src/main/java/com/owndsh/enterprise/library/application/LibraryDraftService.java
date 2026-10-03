/**
 * [INPUT]: 依赖 `JdbcLibraryStore`（权威存储）、`LibraryRevisionObjectWriter`（对象层 seam）、一个 id 分配器与一个时钟；语义逐条对齐 bundle 侧 `manager.ts` 的 `createDraft`/`updateDraft`/`publishDraft`/`listDrafts`。
 * [OUTPUT]: 草稿的创建 / 更新 / 发布 / 列出四个用例，以及"发布 = 落一条**不可变**修订并把资产指针移过去、草稿随发布消失"的事务编排与补偿。
 * [POS]: library/application 的服务层（方案 §4.4「C. 服务」C8 的服务端形态）。四条与 bundle 侧**逐条同形**的判定：只允许 markdown/text（`library/draft-format`）、停用即隔离（`library/disabled`）、token 不匹配（`library/revision-conflict`）、基准修订过期（`library/base-revision-conflict`）；草稿正文 8 MiB（`library/file-too-large`）。
 * [PROTOCOL]: 变更时同步 bundle 侧 `manager.ts` 的同一批语义，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.application;

import com.owndsh.enterprise.library.domain.LibraryAsset;
import com.owndsh.enterprise.library.domain.LibraryDraft;
import com.owndsh.enterprise.library.domain.LibraryRevision;
import com.owndsh.enterprise.library.domain.LibraryScope;
import com.owndsh.enterprise.library.persistence.JdbcLibraryStore;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.LongSupplier;

/**
 * 资料库草稿服务（服务端权威侧）。
 *
 * <p>并发语义与 bundle 侧同样如实：**进程内**由调用方的事务保证编排原子；**跨进程**没有锁——"同一草稿同时被两次更新"
 * 由 `updateDraftContent` 的 CAS（`revision_token` 必须没变）挡下，输的那次拿 `library/revision-conflict`；
 * "两个发布同时算出同一个版本号"由 `ux_ent_library_revision_number` 挡下（唯一约束冲突同样转成 `library/revision-conflict`）。
 */
public final class LibraryDraftService {
    /** 草稿正文上限 8 MiB（§4.4 C8/F14；与 bundle 侧 `LIBRARY_MAX_TEXT_BYTES` 同值）。 */
    public static final long MAX_DRAFT_BYTES = 8L * 1024 * 1024;

    private final JdbcLibraryStore store;
    private final LibraryRevisionObjectWriter objects;
    private final TransactionTemplate transactions;
    private final LongSupplier idGenerator;
    private final Clock clock;

    /**
     * 构造。
     *
     * @param store 权威存储
     * @param objects 对象层写入端口（本刀只有测试替身，见该类注释）
     * @param transactions 事务模板（发布的多步写必须原子）
     * @param idGenerator id 分配器（生产传雪花/序列，测试传确定性计数器）
     * @param clock 时钟（测试传固定时钟）
     */
    public LibraryDraftService(
        JdbcLibraryStore store,
        LibraryRevisionObjectWriter objects,
        TransactionTemplate transactions,
        LongSupplier idGenerator,
        Clock clock
    ) {
        this.store = store;
        this.objects = objects;
        this.transactions = transactions;
        this.idGenerator = idGenerator;
        this.clock = clock;
    }

    /**
     * 建一份待审草稿。
     *
     * <p>`baseContent` 是基准修订的正文：本刀服务端**还没有接对象存储**，应用层读不到既有修订的正文，
     * 于是由调用方（下一刀的 HTTP/对象层）把基准正文交进来；接上对象存储之后这个参数应当由本方法自己读出来
     * （bundle 侧就是这么做的），届时签名收窄而不改语义。
     *
     * @param tenantId 租户
     * @param ownerId 主体
     * @param actorUserId 发起人（写进 `created_by`）
     * @param assetId 要改的资料
     * @param baseRevisionId 基准修订；null = 资产的当前修订
     * @param baseContent 基准修订的正文（本刀由调用方提供）
     * @return 新草稿
     * @throws LibraryAccessException `library/not-found`（资产/基准修订不在）、`library/disabled`（资产已停用）、
     *   `library/draft-format`（非 markdown/text）、`library/file-too-large`（基准正文超过 8 MiB）
     */
    public LibraryDraft createDraft(
        String tenantId,
        String ownerId,
        long actorUserId,
        long assetId,
        Long baseRevisionId,
        String baseContent
    ) {
        LibraryAsset asset = requireAsset(tenantId, ownerId, assetId);
        if (asset.status() != LibraryAsset.Status.ACTIVE) {
            throw new LibraryAccessException("library/disabled", "资料库资产已停用，不能创建草稿");
        }
        if (asset.kind() != LibraryAsset.Kind.MARKDOWN && asset.kind() != LibraryAsset.Kind.TEXT) {
            throw new LibraryAccessException("library/draft-format", "资料库草稿只支持 markdown/text");
        }
        Long requested = baseRevisionId == null ? asset.currentRevisionId() : baseRevisionId;
        if (requested == null) {
            throw new LibraryAccessException("library/not-found", "资料库资产还没有可作基准的修订");
        }
        LibraryRevision base = store.findRevision(tenantId, ownerId, requested)
            .filter(revision -> revision.assetId() == asset.id())
            .orElseThrow(() -> new LibraryAccessException("library/not-found", "资料库基准修订不存在"));
        String content = baseContent == null ? "" : baseContent;
        long bytes = content.getBytes(StandardCharsets.UTF_8).length;
        if (bytes > MAX_DRAFT_BYTES) {
            throw new LibraryAccessException("library/file-too-large", "资料库草稿正文超过 8 MiB");
        }
        Instant now = clock.instant();
        LibraryDraft draft = new LibraryDraft(
            idGenerator.getAsLong(), tenantId, ownerId, LibraryScope.PERSONAL, asset.id(), base.id(),
            token(), content, bytes, actorUserId, now, now
        );
        store.insertDraft(draft);
        return draft;
    }

    /**
     * 改一份草稿的正文（乐观锁 CAS）。
     *
     * @param expectedRevision 上一次拿到的 token
     * @return 更新后的草稿（token 已换新）
     * @throws LibraryAccessException `library/not-found`（草稿不在/跨主体）、`library/file-too-large`、
     *   `library/revision-conflict`（token 不匹配）
     */
    public LibraryDraft updateDraft(
        String tenantId,
        String ownerId,
        long draftId,
        String content,
        String expectedRevision
    ) {
        store.findDraft(tenantId, ownerId, draftId)
            .orElseThrow(() -> new LibraryAccessException("library/not-found", "资料库草稿不存在"));
        String body = content == null ? "" : content;
        long bytes = body.getBytes(StandardCharsets.UTF_8).length;
        if (bytes > MAX_DRAFT_BYTES) {
            throw new LibraryAccessException("library/file-too-large", "资料库草稿正文超过 8 MiB");
        }
        Instant now = clock.instant();
        String next = token();
        int affected = store.updateDraftContent(tenantId, ownerId, draftId, expectedRevision, body, bytes, next, now);
        if (affected == 0) {
            // CAS 失败 = 有人在这中间改过（或草稿已被发布删掉）：两种情况都**绝不覆盖**。
            throw new LibraryAccessException("library/revision-conflict", "资料库草稿已被改过，token 不匹配");
        }
        return store.findDraft(tenantId, ownerId, draftId)
            .orElseThrow(() -> new LibraryAccessException("library/not-found", "资料库草稿不存在"));
    }

    /**
     * 把草稿发布成一条**不可变**新修订。
     *
     * <p>顺序（与 bundle 侧 `publishDraft` 逐条同形）：①token CAS 判定 ②资产必须未停用 ③资产的当前修订必须
     * 仍是草稿的基准修订（否则 `library/base-revision-conflict`）④写对象 → 落修订行（`number = max+1`）→
     * 移资产指针（CAS）⑤删掉草稿。任何一步失败都回滚事务并删掉刚写的对象，草稿**原样留着**。
     *
     * @param extension 原件扩展名（调用方由基准修订的引用推出；本刀不猜）
     * @return 新修订
     * @throws LibraryAccessException `library/not-found`、`library/disabled`、`library/revision-conflict`、
     *   `library/base-revision-conflict`
     */
    public LibraryRevision publishDraft(
        String tenantId,
        String ownerId,
        long draftId,
        String expectedRevision,
        String extension
    ) {
        LibraryDraft draft = store.findDraft(tenantId, ownerId, draftId)
            .orElseThrow(() -> new LibraryAccessException("library/not-found", "资料库草稿不存在"));
        if (!draft.revisionToken().equals(expectedRevision)) {
            throw new LibraryAccessException("library/revision-conflict", "资料库草稿已被改过，token 不匹配");
        }
        LibraryAsset asset = requireAsset(tenantId, ownerId, draft.assetId());
        if (asset.status() != LibraryAsset.Status.ACTIVE) {
            throw new LibraryAccessException("library/disabled", "资料库资产已停用，不能发布草稿");
        }
        if (asset.currentRevisionId() == null || asset.currentRevisionId() != draft.baseRevisionId()) {
            throw new LibraryAccessException("library/base-revision-conflict", "资料库草稿的基准修订已不是当前修订");
        }
        LibraryRevision base = store.findRevision(tenantId, ownerId, draft.baseRevisionId())
            .orElseThrow(() -> new LibraryAccessException("library/not-found", "资料库基准修订不存在"));

        byte[] original = draft.content().getBytes(StandardCharsets.UTF_8);
        long revisionId = idGenerator.getAsLong();
        Instant now = clock.instant();
        LibraryRevisionObjects written = objects.write(asset.id(), revisionId, extension, original, draft.content());
        try {
            LibraryRevision revision = transactions.execute(status -> {
                int number = store.nextRevisionNumber(asset.id());
                LibraryRevision inserted = new LibraryRevision(
                    revisionId, tenantId, ownerId, LibraryScope.PERSONAL, asset.id(), number,
                    written.originalSha256(), written.originalByteLength(), written.originalObjectRef(),
                    written.contentSha256(), written.contentByteLength(), written.contentObjectRef(),
                    LibraryRevision.ConversionStatus.READY, List.of(), now
                );
                store.insertRevision(inserted);
                int moved = store.moveAssetCurrentRevision(
                    tenantId, ownerId, asset.id(), base.id(), revisionId, written.originalByteLength(), now
                );
                if (moved == 0) {
                    // 指针 CAS 失败：期间有人发布了别的版本 ⇒ 整笔回滚（抛出去让 TransactionTemplate 回滚）。
                    throw new LibraryAccessException("library/base-revision-conflict", "资料库资产当前修订已被改动");
                }
                store.deleteDraft(tenantId, ownerId, draft.id());
                return inserted;
            });
            return revision;
        } catch (RuntimeException failure) {
            // 补偿：事务已回滚（没有修订行、指针没动），把刚写的对象删掉——最坏留一份不可达的垃圾，绝不留下"行指向不存在的对象"。
            safeRemove(asset.id(), revisionId);
            throw failure;
        }
    }

    /**
     * 列草稿（最近改动在前）。
     *
     * @param tenantId 租户
     * @param ownerId 主体
     * @param assetId 只看某份资料；null = 全部
     * @return 草稿列表
     */
    public List<LibraryDraft> listDrafts(String tenantId, String ownerId, Long assetId) {
        return assetId == null
            ? store.listDrafts(tenantId, ownerId)
            : store.listDraftsOfAsset(tenantId, ownerId, assetId);
    }

    /**
     * 级联删除一份资料时要清掉的东西（方案 §4.4 C11 的服务端形态）。
     *
     * <p>顺序固定，因为两个外键都是 restrict 且 asset ↔ revision **互指成环**：
     * 引用 → 草稿 → **断掉资产的当前修订指针** → 修订 → 资产 → 节点。少任何一步库里就会拒（这不是"防御性顺序"，
     * 是唯一能走通的顺序，集成测试 `listsDraftsNewestFirstAndCascadesInForeignKeySafeOrder` 锁着它）。
     * 对象存储的清理由对象层负责（它有自己的幂等删除），这里只保证元数据不留孤儿。
     *
     * @param tenantId 租户
     * @param ownerId 主体
     * @param assetId 资产
     * @param nodeId 该资产的树节点
     */
    public void removeAsset(String tenantId, String ownerId, long assetId, long nodeId) {
        transactions.executeWithoutResult(status -> {
            store.deleteReferencesOfNode(tenantId, ownerId, nodeId);
            store.deleteDraftsOfAsset(tenantId, ownerId, assetId);
            store.clearAssetCurrentRevision(tenantId, ownerId, assetId, clock.instant());
            store.deleteRevisionsOfAsset(tenantId, ownerId, assetId);
            store.deleteAsset(tenantId, ownerId, assetId);
            store.deleteNode(tenantId, ownerId, nodeId);
        });
    }

    private LibraryAsset requireAsset(String tenantId, String ownerId, long assetId) {
        return store.findAsset(tenantId, ownerId, assetId)
            .orElseThrow(() -> new LibraryAccessException("library/not-found", "资料库资产不存在"));
    }

    private void safeRemove(long assetId, long revisionId) {
        try {
            objects.remove(assetId, revisionId);
        } catch (RuntimeException ignored) {
            // 对象删除是尽力而为：它失败不该把"这次发布失败"的原因覆盖成另一个异常。
        }
    }

    private static String token() {
        return UUID.randomUUID().toString();
    }
}
