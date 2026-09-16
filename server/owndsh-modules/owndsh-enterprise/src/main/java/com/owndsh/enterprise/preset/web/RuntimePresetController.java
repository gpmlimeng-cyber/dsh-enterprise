/**
 * [INPUT]: 依赖 PresetRuntimeService 与可信 DeviceRequestContextResolver。
 * [OUTPUT]: 提供 runtime 可见配方列表/详情与带 nosniff 的授权下载。
 * [POS]: preset/web 的 ACTIVE Harness 设备入口，Range 只改变字节窗口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.web;

import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.device.application.DeviceCallContext;
import com.owndsh.enterprise.device.web.DeviceRequestContextResolver;
import com.owndsh.enterprise.preset.application.PresetRuntimeService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.util.List;

@RestController
@RequestMapping("/enterprise/api/v1/presets")
public final class RuntimePresetController {
    private static final MediaType PRESET_ZIP = MediaType.parseMediaType("application/vnd.dsh.preset+zip");

    private final PresetRuntimeService runtime;
    private final DeviceRequestContextResolver contexts;

    public RuntimePresetController(PresetRuntimeService runtime, DeviceRequestContextResolver contexts) {
        this.runtime = runtime;
        this.contexts = contexts;
    }

    @GetMapping
    public EnterpriseResponse<List<PresetViews.RuntimeSummaryView>> list(HttpServletRequest request) {
        DeviceCallContext context = contexts.resolve(request);
        return new EnterpriseResponse<>(
            runtime.list(context).stream().map(PresetViews::runtime).toList(),
            context.requestId()
        );
    }

    @GetMapping("/{packageId}")
    public EnterpriseResponse<PresetViews.RuntimeDetailView> detail(
        @PathVariable long packageId,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        return new EnterpriseResponse<>(PresetViews.runtimeDetail(runtime.detail(context, packageId)), context.requestId());
    }

    @GetMapping("/versions/{versionId}/download")
    public ResponseEntity<StreamingResponseBody> download(
        @PathVariable long versionId,
        @RequestHeader(value = "Range", required = false) String rangeHeader,
        HttpServletRequest request
    ) {
        DeviceCallContext context = contexts.resolve(request);
        PresetRuntimeService.AuthorizedDownload download = runtime.authorizeDownload(context, versionId);
        ByteRange range = ByteRange.parse(rangeHeader, download.sizeBytes());
        StreamingResponseBody body = output -> stream(download, range, output);
        ResponseEntity.BodyBuilder response = ResponseEntity
            .status(range.partial() ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK)
            .contentType(PRESET_ZIP)
            .contentLength(range.length())
            .header(HttpHeaders.ACCEPT_RANGES, "bytes")
            .header(HttpHeaders.ETAG, "\"" + download.sha256() + "\"")
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + download.sha256() + ".dshpreset\"");
        if (range.partial()) {
            response.header(
                HttpHeaders.CONTENT_RANGE,
                "bytes " + range.start() + "-" + range.end() + "/" + download.sizeBytes()
            );
        }
        return response.body(body);
    }

    private static void stream(
        PresetRuntimeService.AuthorizedDownload download,
        ByteRange range,
        OutputStream output
    ) throws IOException {
        try (InputStream input = Files.newInputStream(download.path())) {
            input.skipNBytes(range.start());
            byte[] buffer = new byte[8192];
            long remaining = range.length();
            while (remaining > 0) {
                int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                if (read == -1) throw new IOException("artifact 在流式读取期间被截断");
                output.write(buffer, 0, read);
                remaining -= read;
            }
        }
    }

    record ByteRange(long start, long end, boolean partial) {
        static ByteRange parse(String header, long size) {
            if (size <= 0) throw new IllegalArgumentException("artifact 大小非法");
            if (header == null || header.isBlank()) return new ByteRange(0, size - 1, false);
            if (!header.matches("^bytes=[0-9]*-[0-9]*$") || "bytes=-".equals(header)) {
                throw new IllegalArgumentException("只支持单一 bytes Range");
            }
            String[] values = header.substring("bytes=".length()).split("-", -1);
            long start;
            long end;
            if (values[0].isEmpty()) {
                long suffix = Long.parseLong(values[1]);
                if (suffix <= 0) throw new IllegalArgumentException("Range suffix 非法");
                start = Math.max(0, size - suffix);
                end = size - 1;
            } else {
                start = Long.parseLong(values[0]);
                end = values[1].isEmpty() ? size - 1 : Long.parseLong(values[1]);
            }
            if (start < 0 || end < start || start >= size) throw new IllegalArgumentException("Range 越界");
            end = Math.min(end, size - 1);
            return new ByteRange(start, end, start > 0 || end < size - 1);
        }

        long length() {
            return end - start + 1;
        }
    }
}
