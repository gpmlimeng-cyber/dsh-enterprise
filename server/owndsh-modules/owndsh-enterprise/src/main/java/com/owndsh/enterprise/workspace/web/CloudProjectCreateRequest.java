/**
 * [INPUT]: 接收项目创建写请求。
 * [OUTPUT]: 对外提供 name 与可选 description 的严格 DTO。
 * [POS]: workspace/web 的 runtime 写边界，不含用户身份或路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.workspace.web;

public record CloudProjectCreateRequest(String name, String description) {
}
