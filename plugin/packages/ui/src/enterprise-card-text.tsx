/**
 * [INPUT]: 依赖官方 `Tag` 原语（`@deepseek-ai/dsh-client-ui-primitives`）；零本地依赖（叶子模块）。
 * [OUTPUT]: 提供「企业」签的唯一文案与唯一渲染（`ENTERPRISE_MARKET_BADGE_TEXT` / `EnterpriseMarketBadgeTag`）、
 *           版本短号签的唯一字面（`enterpriseMarketVersionTag`）与插件描述缺失时的统一降级
 *           （`ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY` / `enterprisePluginDescriptionText`）。
 * [POS]: ui 的**卡片标识/文案叶子**——`marketplace-entry.tsx`（插件市场页的技能行·插件行·详情徽章）与
 *        `plugin-market.tsx`（企业设置 → 插件卡片）共用同一枚词、同一个组件、同一个降级句，
 *        两侧因此不可能漂成两个词或两套字面。**本文件不含任何 CSS**：类名一律沿用两个消费侧既有声明，
 *        故本刀不新增任何 CSS 类、样式字节级判据一字未动。
 *
 * 「企业」徽章**与官方「实验性」签的对齐口径**（可验证的三件）：同一枚官方 `Tag` 原语本体、
 * 同一个 `tone="info"`、props 除 `tone`/`className`/`children` 外一个都不给（官方 `Tag` 的公开面就这三件）。
 * **为什么拿不到官方那个 `statusTag` 类（已取证）**：它是官方包内 CSS module 的哈希类名，
 * `@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js:1692` 里 `statusTag: "X_2TxG_statusTag"`，
 * 而该包的公开出口只有 `NS`/`PANEL_ID`/`apply`/`inject`（同文件末尾），类名不外露；该包的 `./src/*` 出口
 * 指向的 `src/` 目录并未随包发布（安装树里没有 `src/`）；哈希名还会随官方构建变化。故按「不新增 CSS 类、
 * 样式一字不改」的纪律，React 实体退到官方 primitives 的公开面（`Tag` + `tone="info"`），
 * 只用既有定位类 `.own-market-tag` 参与 flex 布局（列表标题行那一枚走 DOM 克隆官方签实物，见
 * `market-entry-badge.ts`）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'

/**
 * 「企业」标签文案：官方插件页列表卡标题行的 DOM 装饰签、详情页标题行的官方 `plugins.detail.badge` 槽，
 * 以及「企业设置 → 插件」卡片的标题行说的是同一枚词，故只有这一份常量（漂成两个词是 bug）。
 */
export const ENTERPRISE_MARKET_BADGE_TEXT = '企业'

/**
 * 「企业」徽章的**唯一** React 渲染：官方 `plugins.detail.badge` 槽（详情页 `titleRow` 里 `h3` 正后方）与
 * 「企业设置 → 插件」卡片标题行都用它（后者原本只有一句「企业发布 · v…」的第二行文字，没有这枚签）。
 * @returns 官方 `Tag` 原语 + `tone="info"` + 既有定位类 `.own-market-tag`。
 */
export function EnterpriseMarketBadgeTag(): ReactNode {
  return <Tag className="own-market-tag" tone="info">{ENTERPRISE_MARKET_BADGE_TEXT}</Tag>
}

/**
 * 版本签文案，照官方 `versionTag: 'v{version}'` 口径；缺版本时返回 undefined（不渲染版本签）。
 *
 * 技能的 `sourceDshVersion` 是完整来源坐标（`skillhub.cn/dev-expert@2.0.3`），靠 `@` 取短号
 * （`enterpriseMarketSkillVersionLabel`）；插件的 `version` 本身就是裸 SemVer，故这里只补 `v` 前缀——
 * 与详情页 badge 槽同一枚字面，**原卡片第二行那句「v{version}」一字未改**，只是从第二行搬到了标题签。
 * @param bundleVersion - 版本号（缺失/空串即没有版本签）。
 * @returns `v{version}`；没有可显示版本时返回 undefined。
 */
export function enterpriseMarketVersionTag(bundleVersion: string | undefined): string | undefined {
  return bundleVersion === undefined || bundleVersion === '' ? undefined : `v${bundleVersion}`
}

/** 插件**没有描述**时卡片第二行如实说的那一句（不空白、不编造、不拿版本充数）。 */
export const ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY = '暂无描述'

/**
 * 插件卡片第二行的取值（纯投影，测试直调）：**有描述就原样说**，没有（缺席 / null / 空串 / 纯空白）
 * 就如实降级成 `暂无描述`。描述一律不改写、不截断、不猜。
 *
 * 「为缺失设计」：服务端不会为没有描述的包发空串（契约里 `description` 是可选键，读不到就整个键缺席），
 * 这里再把 `undefined`/`null`/纯空白一并兜住，使「直接构造行」的调用方也不会画出空白第二行。
 * @param description - 卡片数据里的描述（可缺席）。
 * @returns 可渲染的描述文案；缺失时为统一降级句。
 */
export function enterprisePluginDescriptionText(description: string | null | undefined): string {
  if (description === undefined || description === null) return ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY
  return description.trim() === '' ? ENTERPRISE_PLUGIN_DESCRIPTION_EMPTY : description
}
