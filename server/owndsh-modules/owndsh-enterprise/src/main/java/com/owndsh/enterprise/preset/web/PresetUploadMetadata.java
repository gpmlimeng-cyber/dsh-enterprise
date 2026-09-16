/**
 * [INPUT]: 依赖 multipart 可选 JSON part。
 * [OUTPUT]: 提供上传时覆盖 manifest 显示名/描述的可选元数据。
 * [POS]: preset/web 的上传 DTO，不承载 artifact 路径或包内 YAML。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.preset.web;

public record PresetUploadMetadata(String displayName, String description) {
}
