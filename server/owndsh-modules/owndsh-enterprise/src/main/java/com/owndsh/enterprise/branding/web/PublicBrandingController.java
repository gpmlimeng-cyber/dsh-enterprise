/**
 * [INPUT]: 依赖 BrandingService、固定部署 tenant 与不可信 If-None-Match/Range 之外的最小请求面。
 * [OUTPUT]: 提供免登录只读品牌 JSON（ETag + 短 TTL）与带 revision 的不可变位图资源路由。
 * [POS]: branding/web 的公开边界；只回白名单字段，且资源必须被当前发布 revision 引用才可读。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.branding.web;

import com.owndsh.enterprise.auth.EnterpriseIdentityProperties;
import com.owndsh.enterprise.branding.application.BrandingResourceNotFoundException;
import com.owndsh.enterprise.branding.application.BrandingService;
import com.owndsh.enterprise.branding.domain.BrandingAsset;
import com.owndsh.enterprise.common.api.EnterpriseResponse;
import com.owndsh.enterprise.common.api.EnterpriseRequestIds;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
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
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/enterprise/api/v1/branding")
public final class PublicBrandingController {
    private final BrandingService branding;
    private final String tenantId;

    public PublicBrandingController(BrandingService branding, EnterpriseIdentityProperties properties) {
        this.branding = branding;
        this.tenantId = properties.getTenantId();
    }

    @GetMapping
    public ResponseEntity<EnterpriseResponse<BrandingViews.PublicBranding>> current(
        @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch,
        HttpServletRequest request
    ) {
        BrandingService.PublishedBranding current = branding.current(tenantId);
        String etag = etag(current.revision());
        CacheControl cacheControl = CacheControl.maxAge(60, TimeUnit.SECONDS).cachePublic();
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).cacheControl(cacheControl).build();
        }
        return ResponseEntity.ok()
            .eTag(etag)
            .cacheControl(cacheControl)
            .body(new EnterpriseResponse<>(
                BrandingViews.publicBranding(current), EnterpriseRequestIds.current(request)
            ));
    }

    @GetMapping("/assets/{revision}/{fileName}")
    public ResponseEntity<StreamingResponseBody> asset(
        @PathVariable long revision,
        @PathVariable String fileName,
        @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch
    ) {
        AssetPath path = AssetPath.parse(fileName);
        BrandingService.PublishedAsset located = branding.locatePublishedAsset(tenantId, revision, path.sha256());
        BrandingAsset asset = located.asset();
        String etag = "\"" + asset.sha256() + "\"";
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }
        StreamingResponseBody body = output -> stream(located, output);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(asset.contentType()))
            .contentLength(asset.sizeBytes())
            .eTag(etag)
            .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + asset.sha256() + "." + asset.extension() + "\"")
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "default-src 'none'; sandbox")
            .header("Cross-Origin-Resource-Policy", "same-origin")
            .body(body);
    }

    private static String etag(long revision) {
        return "\"branding-" + revision + "\"";
    }

    private static void stream(BrandingService.PublishedAsset located, OutputStream output) throws IOException {
        try (InputStream input = Files.newInputStream(located.path())) {
            input.transferTo(output);
        }
    }

    /**
     * 资源文件名是 `{sha256}.{ext}`；扩展名必须与内容寻址的一致，未知后缀直接 404。
     */
    record AssetPath(String sha256) {
        static AssetPath parse(String fileName) {
            int separator = fileName.lastIndexOf('.');
            if (separator <= 0) throw new BrandingResourceNotFoundException();
            String sha256 = fileName.substring(0, separator);
            String extension = fileName.substring(separator + 1);
            if (!sha256.matches("^[0-9a-f]{64}$")) throw new BrandingResourceNotFoundException();
            if (!extension.equals("png") && !extension.equals("jpg") && !extension.equals("webp")) {
                throw new BrandingResourceNotFoundException();
            }
            return new AssetPath(sha256);
        }
    }
}
