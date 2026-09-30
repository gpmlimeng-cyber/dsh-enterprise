/**
 * [INPUT]: 接收管理端状态流转的目标状态与可选备注。
 * [OUTPUT]: 对外提供转换为 FeedbackStatus 的严格请求 DTO。
 * [POS]: feedback/web 的状态流转请求边界，不接受 actor、revision 或任意扩展字段。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.feedback.web;

import com.owndsh.enterprise.feedback.domain.FeedbackStatus;

public record FeedbackStatusChangeRequest(FeedbackStatus status, String note) {
}
