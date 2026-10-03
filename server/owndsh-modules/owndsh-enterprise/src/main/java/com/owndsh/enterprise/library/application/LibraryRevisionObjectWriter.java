/**
 * [INPUT]: 依赖 `LibraryRevisionObjects`。
 * [OUTPUT]: 应用层需要的对象存储端口：写一条修订的两个对象、在失败/回滚时删掉它们。
 * [POS]: library/application 的**对象层 seam**。★本刀**没有生产实现**：服务端的对象存储（配额、副本、生命周期）是方案 §5.3 P2 的独立议题，本刀只把 seam 定死并用测试替身验证"发布 = 写对象 → 落行 → 移指针"的顺序与补偿。谁下一刀接上对象存储，谁实现这个接口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.library.application;

/**
 * 修订对象的写入端口。
 *
 * <p>实现必须保证：`write` 要么完整写入两个对象、要么抛；`remove` 是幂等的尽力删除（对象删除失败不该让一次发布"看起来失败"）。
 */
public interface LibraryRevisionObjectWriter {
    /**
     * 写一条修订的原件与派生正文。
     *
     * @param assetId 资产 ID
     * @param revisionId 修订 ID
     * @param extension 原件扩展名（由基准修订的引用推出）
     * @param original 原件字节
     * @param content 派生正文（发布路径上就是草稿正文）
     * @return 两个引用与摘要
     */
    LibraryRevisionObjects write(long assetId, long revisionId, String extension, byte[] original, String content);

    /**
     * 删掉一条修订的对象（补偿路径；幂等）。
     *
     * @param assetId 资产 ID
     * @param revisionId 修订 ID
     */
    void remove(long assetId, long revisionId);
}
