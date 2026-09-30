/**
 * [INPUT]: 依赖已落盘待校验的反馈附件文件、common/image 的字节级格式解析与单边像素上限配置。
 * [OUTPUT]: 对外提供 PNG/JPEG/WebP 魔数判定、MIME 白名单与宽高提取。
 * [POS]: feedback/artifact 的第二道闸门；与 branding 共用解析器，但错误码与像素上限属于反馈纵向。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.artifact;

import com.owndsh.enterprise.common.image.BitmapImageDetector;
import com.owndsh.enterprise.common.image.BitmapImageException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

/**
 * 只接受位图的反馈附件校验器。员工截图场景不需要矢量格式，SVG 一律拒绝。
 */
public final class FeedbackImageInspector {
    private static final int HEADER_BYTES = 65_536;

    private final int maxDimension;

    public FeedbackImageInspector(int maxDimension) {
        if (maxDimension <= 0) throw new IllegalArgumentException("maxDimension 必须为正数");
        this.maxDimension = maxDimension;
    }

    public InspectedImage inspect(Path path) {
        Objects.requireNonNull(path, "path");
        BitmapImageDetector.BitmapImage image;
        try {
            image = BitmapImageDetector.detect(readHeader(path));
        } catch (BitmapImageException exception) {
            throw new FeedbackAttachmentException(FeedbackAttachmentException.Kind.INVALID, exception.getMessage());
        }
        if (image.width() > maxDimension || image.height() > maxDimension) {
            throw new FeedbackAttachmentException(
                FeedbackAttachmentException.Kind.INVALID, "附件图片单边像素超过上限"
            );
        }
        return new InspectedImage(image.contentType(), image.extension(), image.width(), image.height());
    }

    private static byte[] readHeader(Path path) {
        try (InputStream input = Files.newInputStream(path)) {
            return input.readNBytes(HEADER_BYTES);
        } catch (IOException exception) {
            throw new IllegalStateException("反馈附件头部读取失败", exception);
        }
    }

    public record InspectedImage(String contentType, String extension, int width, int height) {
    }
}
