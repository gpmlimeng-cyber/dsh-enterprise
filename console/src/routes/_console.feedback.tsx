/**
 * [INPUT]: 依赖 TanStack pathless 文件路由与 features/feedback 的反馈处置工作台。
 * [OUTPUT]: 提供问题反馈产品路由。
 * [POS]: _console 到员工反馈分诊纵向功能的薄入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createFileRoute } from '@tanstack/react-router';
import { FeedbackManagementPage } from '@/features/feedback/feedback-management-page';

export const Route = createFileRoute('/_console/feedback')({
  component: FeedbackManagementPage
});
