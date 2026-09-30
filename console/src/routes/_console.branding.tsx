/**
 * [INPUT]: 依赖 TanStack pathless 文件路由与 features/branding 的品牌工作台。
 * [OUTPUT]: 提供品牌产品路由。
 * [POS]: _console 到企业品牌配置纵向功能的薄入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createFileRoute } from '@tanstack/react-router';
import { BrandingManagementPage } from '@/features/branding/branding-management-page';

export const Route = createFileRoute('/_console/branding')({
  component: BrandingManagementPage
});
