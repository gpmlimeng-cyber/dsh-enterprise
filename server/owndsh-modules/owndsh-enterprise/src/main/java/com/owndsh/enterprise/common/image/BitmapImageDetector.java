/**
 * [INPUT]: 依赖调用方已读取的位图头部字节，不做 IO、不依赖 Spring 或任何纵向错误码。
 * [OUTPUT]: 对外提供 PNG/JPEG/WebP 三类位图的魔数判定与宽高提取，其余格式一律拒绝。
 * [POS]: common/image 的唯一字节级格式解析器；像素上限、体积上限与稳定错误码由品牌/反馈各自 inspector 决定。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.common.image;

import java.util.Objects;

/**
 * 只识别 PNG/JPEG/WebP 的位图头部解析器。SVG 是脚本面，永远不在白名单内。
 */
public final class BitmapImageDetector {
    private static final byte[] PNG_SIGNATURE = {
        (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
    };

    private BitmapImageDetector() {
    }

    /**
     * @throws BitmapImageException 非 PNG/JPEG/WebP、头部截断或尺寸不可解析
     */
    public static BitmapImage detect(byte[] header) {
        Objects.requireNonNull(header, "header");
        for (Detector detector : Detector.values()) {
            BitmapImage image = detector.read(header);
            if (image != null) {
                if (image.width() <= 0 || image.height() <= 0) break;
                return image;
            }
        }
        throw new BitmapImageException("只允许 PNG/JPEG/WebP 位图且尺寸必须可解析");
    }

    private enum Detector {
        PNG {
            @Override
            BitmapImage read(byte[] bytes) {
                if (bytes.length < 24 || !startsWith(bytes, PNG_SIGNATURE)) return null;
                if (bytes[12] != 'I' || bytes[13] != 'H' || bytes[14] != 'D' || bytes[15] != 'R') return null;
                return new BitmapImage("image/png", "png", u32be(bytes, 16), u32be(bytes, 20));
            }
        },
        JPEG {
            @Override
            BitmapImage read(byte[] bytes) {
                if (bytes.length < 4 || (bytes[0] & 0xFF) != 0xFF || (bytes[1] & 0xFF) != 0xD8) return null;
                int index = 2;
                while (index + 3 < bytes.length) {
                    if ((bytes[index] & 0xFF) != 0xFF) {
                        index++;
                        continue;
                    }
                    int marker = bytes[index + 1] & 0xFF;
                    if (marker == 0xFF) {
                        index++;
                        continue;
                    }
                    if (marker == 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker == 0x01) {
                        index += 2;
                        continue;
                    }
                    if (marker == 0xDA || marker == 0xD9) return null;
                    int length = u16be(bytes, index + 2);
                    if (length < 2 || index + 2 + length > bytes.length) return null;
                    if (isStartOfFrame(marker)) {
                        if (length < 7) return null;
                        int height = u16be(bytes, index + 5);
                        int width = u16be(bytes, index + 7);
                        return new BitmapImage("image/jpeg", "jpg", width, height);
                    }
                    index += 2 + length;
                }
                return null;
            }

            private static boolean isStartOfFrame(int marker) {
                return switch (marker) {
                    case 0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF -> true;
                    default -> false;
                };
            }
        },
        WEBP {
            @Override
            BitmapImage read(byte[] bytes) {
                if (bytes.length < 30) return null;
                if (!ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) return null;
                if (ascii(bytes, 12, "VP8X")) {
                    return new BitmapImage(
                        "image/webp", "webp", u24le(bytes, 24) + 1, u24le(bytes, 27) + 1
                    );
                }
                if (ascii(bytes, 12, "VP8L")) {
                    if ((bytes[20] & 0xFF) != 0x2F) return null;
                    int width = (bytes[21] & 0xFF) | ((bytes[22] & 0x3F) << 8);
                    int height = ((bytes[22] & 0xC0) >> 6) | ((bytes[23] & 0xFF) << 2)
                        | ((bytes[24] & 0x0F) << 10);
                    return new BitmapImage("image/webp", "webp", width + 1, height + 1);
                }
                if (ascii(bytes, 12, "VP8 ")) {
                    if ((bytes[23] & 0xFF) != 0x9D || (bytes[24] & 0xFF) != 0x01 || (bytes[25] & 0xFF) != 0x2A) {
                        return null;
                    }
                    int width = u16le(bytes, 26) & 0x3FFF;
                    int height = u16le(bytes, 28) & 0x3FFF;
                    return new BitmapImage("image/webp", "webp", width, height);
                }
                return null;
            }
        };

        abstract BitmapImage read(byte[] bytes);
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) return false;
        for (int index = 0; index < prefix.length; index++) {
            if (bytes[index] != prefix[index]) return false;
        }
        return true;
    }

    private static boolean ascii(byte[] bytes, int offset, String value) {
        if (offset + value.length() > bytes.length) return false;
        for (int index = 0; index < value.length(); index++) {
            if ((bytes[offset + index] & 0xFF) != value.charAt(index)) return false;
        }
        return true;
    }

    private static int u32be(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xFF) << 24) | ((bytes[offset + 1] & 0xFF) << 16)
            | ((bytes[offset + 2] & 0xFF) << 8) | (bytes[offset + 3] & 0xFF);
    }

    private static int u16be(byte[] bytes, int offset) {
        return ((bytes[offset] & 0xFF) << 8) | (bytes[offset + 1] & 0xFF);
    }

    private static int u16le(byte[] bytes, int offset) {
        return (bytes[offset] & 0xFF) | ((bytes[offset + 1] & 0xFF) << 8);
    }

    private static int u24le(byte[] bytes, int offset) {
        return (bytes[offset] & 0xFF) | ((bytes[offset + 1] & 0xFF) << 8) | ((bytes[offset + 2] & 0xFF) << 16);
    }

    public record BitmapImage(String contentType, String extension, int width, int height) {
    }
}
