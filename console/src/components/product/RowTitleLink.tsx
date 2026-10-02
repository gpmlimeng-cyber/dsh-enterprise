/**
 * [INPUT]: 依赖 React 的 KeyboardEvent / ReactNode 类型、库工具 cn 与控制台既定视觉 token（ink / accent-ink / focus-visible）。
 * [OUTPUT]: 提供台账行标题的可访问入口 RowTitleLink —— 有详情时渲染可聚焦 button（含 hover 与 focus-visible 态、Enter/Space 键盘激活），无详情时只渲染纯文本 span。
 * [POS]: components/product 的列表行标题原语，供各台账列表的"标题即详情入口"共用；只表达标题可点与否，不持有领域查询、路由或 mutation。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { cn } from '@/lib/utils';
import type { KeyboardEvent, ReactNode } from 'react';

/**
 * 行标题入口。
 *
 * 设计取舍：
 * - 用 button 而不是 a：控制台是单页应用，详情以对话框（ProductDialog）呈现，没有可分享的详情 URL，
 *   用 <a href> 就得伪造 href 或拦截跳转；button 天然具备 Enter/Space 激活、聚焦与禁用语义。
 *   这也沿用控制台既有写法——DataTable 工具栏、各列表行内动作、产品对话框动作都是 button。
 * - 只包标题，不包整行：行内还有复选框、排序表头与其它行内动作，把整行做成按钮会破坏文本选择并制造嵌套交互。
 * - 无详情时返回纯文本 span：没有死按钮，也没有"看着能点"的鼠标指针与 hover 反馈。
 */
export function RowTitleLink({
  ariaLabel,
  children,
  className,
  onOpen
}: {
  /** 屏幕阅读器可读名；必须带上该行主体名，例如「查看 周报技能包 的详情」。 */
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  /** 省略即表示该行没有详情，标题保持纯文本不可点。 */
  onOpen?: () => void;
}) {
  if (!onOpen) return <span className={className}>{children}</span>;

  const activate = () => onOpen();
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    // 显式接管按键：preventDefault 同时挡住浏览器对 Enter/Space 的原生点击合成，避免 onOpen 被触发两次。
    event.preventDefault();
    activate();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        // max-w-full + text-left：按钮自适应单元格宽度，长标题仍由内层 truncate 截断。
        // 悬停换色 + 下划线沿用控制台既有链接交互（records-company-name.has-link 的同一套 token）。
        'inline-block max-w-full cursor-pointer text-left font-medium text-ink',
        'transition-colors duration-100 hover:text-accent-ink hover:underline hover:underline-offset-3',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className
      )}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      {children}
    </button>
  );
}
