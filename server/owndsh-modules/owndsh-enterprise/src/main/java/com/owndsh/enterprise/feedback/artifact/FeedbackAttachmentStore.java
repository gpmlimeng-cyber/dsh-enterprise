/**
 * [INPUT]: 依赖受控 feedback artifact root、单文件字节上限与不可信上传流。
 * [OUTPUT]: 提供 `.part` 有界写入/SHA-256、hash 互斥锁、原子 CAS 终结与受控路径解析。
 * [POS]: feedback/artifact 的唯一文件系统边界；反馈附件只增不删，与 branding/preset 共用同一 artifact 卷但独立子目录。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.artifact;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

public final class FeedbackAttachmentStore {
    private final Path root;
    private final Path temporaryRoot;
    private final Path lockRoot;
    private final long maxAttachmentBytes;
    private final ReentrantLock[] processLocks = new ReentrantLock[64];

    public FeedbackAttachmentStore(Path root, long maxAttachmentBytes) {
        Objects.requireNonNull(root, "root");
        if (maxAttachmentBytes <= 0) throw new IllegalArgumentException("maxAttachmentBytes 必须为正数");
        this.root = root.toAbsolutePath().normalize();
        this.temporaryRoot = this.root.resolve("tmp");
        this.lockRoot = this.root.resolve("locks");
        this.maxAttachmentBytes = maxAttachmentBytes;
        for (int index = 0; index < processLocks.length; index++) processLocks[index] = new ReentrantLock();
        try {
            Files.createDirectories(temporaryRoot);
            Files.createDirectories(lockRoot);
            Files.createDirectories(this.root.resolve("sha256"));
        } catch (IOException exception) {
            throw new IllegalStateException("feedback artifact root 无法初始化", exception);
        }
    }

    public PendingAttachment writePending(UUID uploadId, InputStream input) {
        Objects.requireNonNull(uploadId, "uploadId");
        Objects.requireNonNull(input, "input");
        Path path = temporaryRoot.resolve(uploadId + ".part");
        MessageDigest digest = sha256Digest();
        long size = 0;
        try (OutputStream output = Files.newOutputStream(path, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                size = Math.addExact(size, read);
                if (size > maxAttachmentBytes) {
                    throw new FeedbackAttachmentException(
                        FeedbackAttachmentException.Kind.TOO_LARGE, "反馈附件超过单文件上限"
                    );
                }
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
            }
        } catch (FeedbackAttachmentException exception) {
            deleteQuietly(path);
            throw exception;
        } catch (ArithmeticException exception) {
            deleteQuietly(path);
            throw new FeedbackAttachmentException(
                FeedbackAttachmentException.Kind.TOO_LARGE, "反馈附件字节数溢出", exception
            );
        } catch (IOException exception) {
            deleteQuietly(path);
            throw new IllegalStateException("反馈附件上传临时文件写入失败", exception);
        }
        if (size == 0) {
            deleteQuietly(path);
            throw new FeedbackAttachmentException(FeedbackAttachmentException.Kind.INVALID, "反馈附件不能为空");
        }
        return new PendingAttachment(path, size, HexFormat.of().formatHex(digest.digest()));
    }

    public AttachmentMutationLock lockForMutation(PendingAttachment pending) {
        Objects.requireNonNull(pending, "pending");
        String sha256 = pending.sha256();
        ReentrantLock processLock = processLocks[(sha256.hashCode() & Integer.MAX_VALUE) % processLocks.length];
        processLock.lock();
        FileChannel channel = null;
        try {
            Path lockPath = lockRoot.resolve(sha256 + ".lock");
            channel = FileChannel.open(lockPath, StandardOpenOption.CREATE, StandardOpenOption.WRITE);
            FileLock fileLock = channel.lock();
            return new AttachmentMutationLock(processLock, channel, fileLock);
        } catch (IOException | RuntimeException exception) {
            closeQuietly(channel);
            processLock.unlock();
            throw new IllegalStateException("feedback 附件 hash 锁获取失败", exception);
        }
    }

    public StoredAttachment finalizeAttachment(PendingAttachment pending) {
        Objects.requireNonNull(pending, "pending");
        Path target = pathFor(pending.sha256());
        try {
            Files.createDirectories(target.getParent());
            if (Files.exists(target)) {
                Files.deleteIfExists(pending.path());
                return new StoredAttachment(target, referenceFor(pending.sha256()), pending.sizeBytes(), pending.sha256());
            }
            try {
                Files.move(pending.path(), target, StandardCopyOption.ATOMIC_MOVE);
            } catch (FileAlreadyExistsException exception) {
                Files.deleteIfExists(pending.path());
            } catch (AtomicMoveNotSupportedException exception) {
                Files.move(pending.path(), target, StandardCopyOption.REPLACE_EXISTING);
            }
            return new StoredAttachment(target, referenceFor(pending.sha256()), pending.sizeBytes(), pending.sha256());
        } catch (IOException exception) {
            throw new IllegalStateException("feedback 附件 CAS 落盘失败", exception);
        }
    }

    public void deletePending(PendingAttachment pending) {
        if (pending != null) deleteQuietly(pending.path());
    }

    public Path resolve(String artifactRef) {
        Objects.requireNonNull(artifactRef, "artifactRef");
        if (!artifactRef.startsWith("sha256:")) throw new IllegalArgumentException("artifactRef 非法");
        String sha256 = artifactRef.substring("sha256:".length());
        if (!sha256.matches("^[0-9a-f]{64}$")) throw new IllegalArgumentException("artifactRef 非法");
        Path path = pathFor(sha256).normalize();
        if (!path.startsWith(root)) throw new IllegalArgumentException("artifactRef 逃逸");
        return path;
    }

    private Path pathFor(String sha256) {
        return root.resolve("sha256").resolve(sha256.substring(0, 2)).resolve(sha256);
    }

    private static String referenceFor(String sha256) {
        return "sha256:" + sha256;
    }

    private static MessageDigest sha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // 补偿删除失败不阻断主流程
        }
    }

    private static void closeQuietly(FileChannel channel) {
        if (channel == null) return;
        try {
            channel.close();
        } catch (IOException ignored) {
            // 锁通道关闭失败不阻断
        }
    }

    public record PendingAttachment(Path path, long sizeBytes, String sha256) {
    }

    public record StoredAttachment(Path path, String artifactRef, long sizeBytes, String sha256) {
    }

    public record AttachmentMutationLock(ReentrantLock processLock, FileChannel channel, FileLock fileLock)
        implements AutoCloseable {
        @Override
        public void close() {
            try {
                if (fileLock != null && fileLock.isValid()) fileLock.release();
            } catch (IOException ignored) {
                // 释放失败由进程退出兜底
            }
            closeQuietly(channel);
            processLock.unlock();
        }
    }
}
