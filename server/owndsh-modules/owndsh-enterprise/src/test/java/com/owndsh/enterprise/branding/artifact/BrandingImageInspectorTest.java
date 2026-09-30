/**
 * [INPUT]: 依赖 BrandingImageInspector 与手工构造的位图头部字节。
 * [OUTPUT]: 验证 PNG/JPEG/WebP 宽高提取、SVG/GIF/未知格式拒绝、超大单边拒绝与截断拒绝。
 * [POS]: branding/artifact 的纯 JVM 输入闸门，不需要 PostgreSQL 或文件系统之外的依赖。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.artifact;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Tag("dev")
class BrandingImageInspectorTest {
    @TempDir
    Path directory;

    private final BrandingImageInspector inspector = new BrandingImageInspector(8192);

    @Test
    void readsPngDimensions() throws IOException {
        byte[] header = new byte[24];
        System.arraycopy(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, 0, header, 0, 8);
        header[8] = 0;
        header[9] = 0;
        header[10] = 0;
        header[11] = 13;
        System.arraycopy(new byte[] {'I', 'H', 'D', 'R'}, 0, header, 12, 4);
        writeInt(header, 16, 512);
        writeInt(header, 20, 256);

        BrandingImageInspector.InspectedImage image = inspector.inspect(file("logo.png", header));

        assertThat(image.contentType()).isEqualTo("image/png");
        assertThat(image.extension()).isEqualTo("png");
        assertThat(image.width()).isEqualTo(512);
        assertThat(image.height()).isEqualTo(256);
    }

    @Test
    void readsJpegDimensionsFromStartOfFrame() throws IOException {
        byte[] header = new byte[33];
        header[0] = (byte) 0xFF;
        header[1] = (byte) 0xD8;
        header[2] = (byte) 0xFF;
        header[3] = (byte) 0xE0;
        header[4] = 0;
        header[5] = 16;
        header[20] = (byte) 0xFF;
        header[21] = (byte) 0xC0;
        header[22] = 0;
        header[23] = 11;
        header[24] = 8;
        header[25] = 0;
        header[26] = 64;
        header[27] = 1;
        header[28] = 44;

        BrandingImageInspector.InspectedImage image = inspector.inspect(file("logo.jpg", header));

        assertThat(image.contentType()).isEqualTo("image/jpeg");
        assertThat(image.width()).isEqualTo(300);
        assertThat(image.height()).isEqualTo(64);
    }

    @Test
    void readsWebpCanvasDimensions() throws IOException {
        byte[] vp8x = new byte[30];
        System.arraycopy("RIFF".getBytes(), 0, vp8x, 0, 4);
        System.arraycopy("WEBP".getBytes(), 0, vp8x, 8, 4);
        System.arraycopy("VP8X".getBytes(), 0, vp8x, 12, 4);
        writeU24le(vp8x, 24, 1023);
        writeU24le(vp8x, 27, 511);
        BrandingImageInspector.InspectedImage extended = inspector.inspect(file("a.webp", vp8x));
        assertThat(extended.contentType()).isEqualTo("image/webp");
        assertThat(extended.width()).isEqualTo(1024);
        assertThat(extended.height()).isEqualTo(512);

        byte[] vp8l = new byte[30];
        System.arraycopy("RIFF".getBytes(), 0, vp8l, 0, 4);
        System.arraycopy("WEBP".getBytes(), 0, vp8l, 8, 4);
        System.arraycopy("VP8L".getBytes(), 0, vp8l, 12, 4);
        vp8l[20] = 0x2F;
        vp8l[21] = (byte) 0xFF;
        vp8l[22] = 0x03;
        BrandingImageInspector.InspectedImage lossless = inspector.inspect(file("b.webp", vp8l));
        assertThat(lossless.width()).isEqualTo(1024);
        assertThat(lossless.height()).isEqualTo(1);
    }

    @Test
    void rejectsSvgGifAndTruncatedHeaders() throws IOException {
        assertThatThrownBy(() -> inspector.inspect(file("logo.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes())))
            .isInstanceOf(BrandingAssetException.class)
            .hasMessageContaining("PNG/JPEG/WebP");
        assertThatThrownBy(() -> inspector.inspect(file("logo.gif", "GIF89a".getBytes())))
            .isInstanceOf(BrandingAssetException.class);
        assertThatThrownBy(() -> inspector.inspect(file("logo.png", new byte[] {(byte) 0x89, 'P', 'N'})))
            .isInstanceOf(BrandingAssetException.class);
    }

    @Test
    void rejectsOversizedSingleEdge() throws IOException {
        byte[] header = new byte[24];
        System.arraycopy(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, 0, header, 0, 8);
        System.arraycopy(new byte[] {'I', 'H', 'D', 'R'}, 0, header, 12, 4);
        writeInt(header, 16, 9000);
        writeInt(header, 20, 9000);

        assertThatThrownBy(() -> inspector.inspect(file("huge.png", header)))
            .isInstanceOf(BrandingAssetException.class)
            .hasMessageContaining("单边像素超过上限");
    }

    private Path file(String name, byte[] content) throws IOException {
        Path path = directory.resolve(name);
        Files.write(path, content);
        return path;
    }

    private static void writeInt(byte[] target, int offset, int value) {
        target[offset] = (byte) (value >>> 24);
        target[offset + 1] = (byte) (value >>> 16);
        target[offset + 2] = (byte) (value >>> 8);
        target[offset + 3] = (byte) value;
    }

    private static void writeU24le(byte[] target, int offset, int value) {
        target[offset] = (byte) value;
        target[offset + 1] = (byte) (value >>> 8);
        target[offset + 2] = (byte) (value >>> 16);
    }
}
