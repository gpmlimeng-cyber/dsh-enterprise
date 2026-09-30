/**
 * [INPUT]: 依赖已落盘待校验的品牌位图文件、common/image 的字节级格式解析与单边像素上限配置。
 * [OUTPUT]: 对外提供 PNG/JPEG/WebP 魔数判定、MIME 白名单与宽高提取。
 * [POS]: branding/artifact 的第二道闸门；格式解析复用 common/image，品牌只负责像素上限与 ENT_BRANDING_ASSET_* 语义。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.artifact;

import com.owndsh.enterprise.common.image.BitmapImageDetector;
import com.owndsh.enterprise.common.image.BitmapImageException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

/**
 * 只接受位图的品牌资源校验器。消毒 SVG 不在 B1 范围内，因此 SVG 一律拒绝。
 */
public final class BrandingImageInspector {
    private static final int HEADER_BYTES = 65_536;

    private final int maxDimension;

    public BrandingImageInspector(int maxDimension) {
        if (maxDimension <= 0) throw new IllegalArgumentException("maxDimension 必须为正数");
        this.maxDimension = maxDimension;
    }

    public InspectedImage inspect(Path path) {
        Objects.requireNonNull(path, "path");
        BitmapImageDetector.BitmapImage image;
        try {
            image = BitmapImageDetector.detect(readHeader(path));
        } catch (BitmapImageException exception) {
            throw new BrandingAssetException(BrandingAssetException.Kind.INVALID, exception.getMessage());
        }
        if (image.width() > maxDimension || image.height() > maxDimension) {
            throw new BrandingAssetException(
                BrandingAssetException.Kind.INVALID, "品牌图片单边像素超过上限"
            );
        }
        return new InspectedImage(image.contentType(), image.extension(), image.width(), image.height());
    }

    private static byte[] readHeader(Path path) {
        try (InputStream input = Files.newInputStream(path)) {
            return input.readNBytes(HEADER_BYTES);
        } catch (IOException exception) {
            throw new IllegalStateException("品牌资源头部读取失败", exception);
        }
    }

    public record InspectedImage(String contentType, String extension, int width, int height) {
    }
}
