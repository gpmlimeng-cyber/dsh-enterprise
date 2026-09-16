/**
 * [INPUT]: 依赖 TanStack pathless 文件路由与 features/presets 的配方管理工作台。
 * [OUTPUT]: 提供配方产品路由。
 * [POS]: _console 到企业 .dshpreset 目录纵向功能的薄入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createFileRoute } from '@tanstack/react-router';
import { PresetManagementPage } from '@/features/presets/preset-management-page';

export const Route = createFileRoute('/_console/presets')({
  component: PresetManagementPage
});
