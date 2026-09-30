/**
 * [INPUT]: 依赖 TanStack pathless 文件路由与 features/skills 的技能目录管理工作台。
 * [OUTPUT]: 提供技能产品路由。
 * [POS]: _console 到企业 .dshskill 技能目录纵向功能的薄入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createFileRoute } from '@tanstack/react-router';
import { SkillManagementPage } from '@/features/skills/skill-management-page';

export const Route = createFileRoute('/_console/skills')({
  component: SkillManagementPage
});
