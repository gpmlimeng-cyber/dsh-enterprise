/**
 * [INPUT]: 建项目与邀请/转让的严格请求体。
 * [OUTPUT]: 对外提供 name/userId 写 DTO。
 * [POS]: collab/web 输入边界，校验仍在 application。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.collab.web;

public record ProjectWriteRequest(String name) {
}
