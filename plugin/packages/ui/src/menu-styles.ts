/**
 * [INPUT]: 不依赖任何模块与运行时状态，只承载菜单视觉的取值与出处标注
 * [OUTPUT]: 对外提供个人中心菜单的唯一注入样式表 ENTERPRISE_MENU_STYLES（触发按钮、账号头部、发丝线、外观分段、更新行右侧状态控件，以及「我的用量」行内折叠块的三列清单）
 * [POS]: dsh-ui 菜单视觉的唯一真源，由 account-menu 以 `<style>` 注入、theme-options 的外观分段与 maintenance-view 的更新状态控件共用同一份类规则。三条硬约束：触发按钮的 `background` 只在这里声明（元素上不得再有内联同名属性，否则压掉 :hover）；悬停兜底一律主题中性；每一条数值都标注官方 0.2.0-rc.2 实物出处、官方没有的段落显式标 `自定`。卡片与行项不在这里——它们由官方 Menu/MenuItemButton 渲染，几何/悬停/危险色全归官方
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 菜单视觉的唯一真源，由组件以 `<style>` 注入。三条硬约束：
 * 1. 触发按钮的 `background` 只在这里声明，元素上不得再有内联同名属性；
 * 2. 悬停兜底一律主题中性——官方 token 缺席时用 `color-mix(in srgb, currentColor …)` 叠加，
 *    深浅主题都可见；深色硬编码兜底（如 rgba(9, 9, 11, .05)）在深色主题上等于没有反馈；
 * 3. 每一条数值都标注官方 0.2.0-rc.2 实物出处，官方没有的段落显式标 `自定`。
 * 卡片与行项不在这里：它们由官方 Menu/MenuItemButton 渲染，几何、悬停、危险色与禁用态全归官方。
 */
export const ENTERPRISE_MENU_STYLES = `
      /* 官方向导 A：@deepseek-ai/dsh-client-ui-settings-account/lib/client.js:1612 的 AccountMenu.module.css
         官方向导 B：@deepseek-ai/dsh-client-ui-settings-general/lib/client.js:60 的 SettingsRoot trigger/triggerRow
         官方向导 C：@deepseek-ai/dsh-client-ui-primitives/lib/SegmentedControl.module.css（分段几何）
         官方向导 D：@deepseek-ai/dsh-client-ui-theme/lib/client.js:1148（--dsw-* token 值表） */

      /* A .root{flex:1;min-width:0} + .anchor{width:100%}：官方那两个盒子的合体，Menu 的锚点 span。 */
      .own-menu-anchor { flex: 1; min-width: 0; width: 100%; }

      /* A .trigger：44px 整行、radius-md、6px 内衬、gap 8、14px 字号。 */
      .own-menu-trigger {
        user-select: none;
        border-radius: var(--dsw-radius-md, 12px);
        width: 100%;
        height: 44px;
        color: var(--dsw-alias-label-primary, #101828);
        font: inherit;
        cursor: pointer;
        background: none;
        border: 0;
        align-items: center;
        gap: 8px;
        padding: 6px;
        font-size: 14px;
        display: flex;
      }
      /* A .trigger[data-collapsed=true]：窄栏是 36×36 的居中方块。 */
      .own-menu-trigger[data-collapsed='true'] { box-sizing: border-box; justify-content: center; gap: 0; width: 36px; height: 36px; padding: 0; }
      /* A .trigger[data-signed-out=true]:not([data-collapsed=true])：未登录行矮到 32px、行高 20px。 */
      .own-menu-trigger[data-signed-out='true']:not([data-collapsed='true']) { height: 32px; padding: 6px 2px 6px 6px; line-height: 20px; }
      /* A .trigger:hover：官方唯一的悬停底色；active 官方不画。 */
      .own-menu-trigger:hover { background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent)); }
      /* A .label：超长昵称省略。 */
      .own-menu-trigger-label { text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
      /* A .avatar：24px 圆、bg-skeleton 底、label-tertiary 字、corner-shape 取官方同款。 */
      .own-menu-avatar {
        corner-shape: round;
        background: var(--dsw-alias-bg-skeleton, color-mix(in srgb, currentColor 6%, transparent));
        width: 24px;
        height: 24px;
        color: var(--dsw-alias-label-tertiary, #667085);
        border-radius: 50%;
        flex: none;
        justify-content: center;
        align-items: center;
        display: flex;
        font-size: 12px;
        font-weight: 500;
        line-height: 1;
      }
      /* 自定（官方菜单没有头部）：排版对齐官方行——padding 6px 8px 同 C，gap 8 同 A .trigger，
         标题 14px/22px 同 A .signedOutMenu [role=menuitem]，副行 12px/18px + label-secondary 同
         B 的 .description，字重 500 同 B 的 .navTitle。 */
      .own-menu-header { align-items: center; display: flex; gap: 8px; padding: 6px 8px; }
      .own-menu-header-text { display: flex; flex-direction: column; min-width: 0; }
      .own-menu-header-title { color: var(--dsw-alias-label-primary, #101828); font-size: 14px; font-weight: 500; line-height: 22px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .own-menu-header-detail { color: var(--dsw-alias-label-secondary, #475467); font-size: 12px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      /* 我们的发丝线：几何照官方 Menu.module.css .separator（0.5px / 3px 2px），
         颜色**调浅**到官方 border-l1（浅色 #0000000a、深色 #ffffff0f，均比官方 .separator 用的
         border-l2 更浅）；官方那份 l2 由 ui-primitives 内部持有，我们不去覆盖它的 CSS。 */
      .own-menu-separator { height: 0.5px; margin: 3px 2px; background: var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 8%, transparent)); }
      /* 行内左侧文案 + 右侧状态控件/提示：文案过长省略，右侧不被压缩。 */
      .own-menu-row { align-items: center; display: flex; gap: 8px; justify-content: space-between; min-width: 0; width: 100%; }
      .own-menu-row-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      /* 行右侧的弱化提示（帮助与文档的「需登录」/「请先配置企业 Server 地址」）：次要色、可省略。 */
      .own-menu-row-hint { color: var(--dsw-alias-label-tertiary, #667085); flex: none; font-size: 12px; line-height: 18px; }
      /* 行内可见反馈（帮助打开失败）：警示色，就摆在那一行下面，菜单不关。 */
      .own-menu-notice { color: var(--dsw-alias-status-warning, #b54708); font-size: 12px; line-height: 18px; margin: 2px 8px 6px; overflow-wrap: anywhere; }
      /* 右侧动作入口：品牌蓝 + 悬停下划线；它是行内的 pointer 入口，键盘由行本身承担。 */
      .own-update-action { color: var(--dsw-alias-state-business-primary, #4d6bfe); cursor: pointer; flex: none; font-size: 13px; line-height: 20px; }
      .own-update-action:hover { text-decoration: underline; }
      /* 右侧只读状态：百分比/检查中/失败原因，用等宽数字避免逐帧抖动并允许省略。 */
      .own-update-state { color: var(--dsw-alias-label-tertiary, #667085); flex: none; font-size: 13px; font-variant-numeric: tabular-nums; line-height: 20px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      /* 状态标签 + 快捷按钮的组合位：两个都是行内元素，按钮排在标签右侧。 */
      .own-update-trailing { align-items: center; display: flex; flex: none; gap: 8px; min-width: 0; }
      /* 自定（官方菜单没有行内折叠块）：折叠箭头——次要色，与行图标同几何。 */
      .own-usage-chevron { align-items: center; color: var(--dsw-alias-label-tertiary, #667085); display: inline-flex; flex: none; height: 14px; justify-content: center; width: 14px; }
      /* 自定：展开区排版。三列表头与每一行共用同一个轨道模板，列才对得齐（周期｜剩余额度｜详情）。 */
      .own-usage-panel { border-top: 0.5px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 8%, transparent)); display: flex; flex-direction: column; gap: 8px; margin: 2px 8px 6px; padding-top: 8px; }
      .own-usage-policy { display: flex; flex-direction: column; gap: 6px; }
      .own-usage-policy + .own-usage-policy { border-top: 0.5px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 8%, transparent)); margin-top: 6px; padding-top: 6px; }
      .own-usage-policy-title { color: var(--dsw-alias-label-primary, #101828); font-size: 12px; font-weight: 500; line-height: 18px; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .own-usage-head, .own-usage-item { align-items: center; display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr) 64px auto; }
      .own-usage-head-cell { color: var(--dsw-alias-label-tertiary, #667085); font-size: 11px; line-height: 16px; }
      .own-usage-head-cell:nth-child(2) { text-align: right; }
      .own-usage-period { color: var(--dsw-alias-label-secondary, #475467); font-size: 12px; line-height: 18px; }
      /* 剩余额度百分比：等宽数字、右对齐；耗尽（0%）走警示色。 */
      .own-usage-percent { color: var(--dsw-alias-label-primary, #101828); font-size: 12px; font-variant-numeric: tabular-nums; line-height: 18px; text-align: right; }
      .own-usage-percent[data-exhausted='true'] { color: var(--dsw-alias-status-error, #c4320a); font-weight: 500; }
      /* 详情：本期预留，aria-disabled 只是「还没有详情页」的可见态，点击给出「即将上线」提示。 */
      .own-usage-details { background: none; border: 0; color: var(--dsw-alias-label-tertiary, #667085); cursor: default; font: inherit; font-size: 12px; line-height: 18px; padding: 0; text-align: right; }
      .own-usage-hint { align-items: center; color: var(--dsw-alias-label-secondary, #475467); display: flex; font-size: 12px; gap: 6px; line-height: 18px; margin: 0; }
      .own-usage-error { color: var(--dsw-alias-status-error, #c4320a); font-size: 12px; line-height: 18px; margin: 0; }
      .own-usage-notice { color: var(--dsw-alias-label-tertiary, #667085); font-size: 12px; line-height: 18px; margin: 0; }
      .own-usage-refresh { align-self: flex-end; background: none; border: 0; color: var(--dsw-alias-state-business-primary, #4d6bfe); cursor: pointer; font: inherit; font-size: 12px; line-height: 18px; padding: 0; }
      .own-usage-refresh:hover { text-decoration: underline; }
      /* 自定（官方菜单没有外观组）：容器几何照 C 分段控件——轨道 = hover 填充 + radius-md + 4px 内衬 + 2px 缝，
         等宽 1fr 轨道、28px 标签、13px/20px/500、label-secondary → 选中与 hover 只换 label-primary，
         选中格承担 bg-layer-1 + elevation-soft + radius-sm。官方用滑动指示器；菜单里不引动画，
         让选中格直接持有那层抬升，静置外观与官方一致。 */
      /* 官方 Menu 的 .list 是 min 144 / max 360 的 max-content：内容多宽菜单就多宽。
         我们自定的头部与外观组会把它撑得明显宽于官方占用者，故给内容一个确定宽度，
         并让长文本的 ellipsis 真正生效（max-content 下 ellipsis 不减少固有宽度）。 */
      .own-menu-content { width: 200px; }   /* 测量前的回落值；实测宽度由内联 style 覆盖 */
      .own-theme-row { align-items: stretch; display: flex; flex-direction: column; gap: 6px; min-height: 34px; padding: 6px 8px; }
      .own-theme-label { align-items: center; color: var(--dsw-alias-label-primary, #101828); display: flex; font-size: 13px; gap: 6px; line-height: 20px; min-width: 0; }
      .own-theme-icon { align-items: center; color: var(--dsw-alias-menu-icon, var(--dsw-alias-label-primary, #101828)); display: inline-flex; flex: none; height: 14px; justify-content: center; width: 14px; }
      .own-theme-icon svg { width: 14px; height: 14px; }
      .own-theme-seg { background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 8%, transparent)); border-radius: var(--dsw-radius-md, 12px); display: inline-grid; flex: none; gap: 2px; width: 100%; grid-auto-columns: 1fr; grid-auto-flow: column; padding: 4px; }
      .own-theme-seg-btn { background: transparent; border: 0; border-radius: var(--dsw-radius-sm, 8px); color: var(--dsw-alias-label-secondary, #475467); cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; height: 28px; line-height: 20px; padding: 0 4px; transition: color 120ms ease; white-space: nowrap; }
      .own-theme-seg-btn:hover:not(:disabled), .own-theme-seg-btn[aria-checked='true'] { color: var(--dsw-alias-label-primary, #101828); }
      .own-theme-seg-btn[aria-checked='true'] { background: var(--dsw-alias-bg-layer-1, #ffffff); box-shadow: var(--dsw-elevation-soft, 0 1px 3px rgba(0, 0, 0, 0.12)); }
      .own-theme-seg-btn:disabled { cursor: not-allowed; opacity: 0.4; }
      /* D 的全局 :focus-visible 两颗粒子；官方 trigger 无模块规则，这里照抄同一对 token 让样式表自洽。 */
      .own-menu-trigger:focus-visible, .own-theme-seg-btn:focus-visible { outline-color: var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe)); outline-width: var(--dsw-focus-ring-width, 2px); }
      .own-menu-spin { animation: own-menu-rotate 1s linear infinite; }
      @keyframes own-menu-rotate { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .own-menu-spin, .own-theme-seg-btn { animation: none; transition: none; } }
`
