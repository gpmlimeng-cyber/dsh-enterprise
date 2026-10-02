/**
 * [INPUT]: 依赖 lib/utils 的 cn（差异后缀由调用方叠加）。
 * [OUTPUT]: 提供后台原生表单控件的唯一类名真源 fieldClass。
 * [POS]: lib 的表单样式单点；后台所有原生 input/select/textarea 都从这里取基线，禁止再本地复制同一串 Tailwind。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 后台表单控件基线（含禁用态）：36px 高度、圆角、边框、内边距、正文色，去掉原生 outline 并给统一焦点环。
 * 差异（placeholder 色、只读底、宽度/换行）必须由调用方 `cn(fieldClass, '…')` 显式叠加，
 * 不得整串复制——复制会让圆角、内边距与禁用态在副本之间各自漂移。
 */
export const fieldClass = 'h-9 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint disabled:cursor-not-allowed disabled:opacity-60';
