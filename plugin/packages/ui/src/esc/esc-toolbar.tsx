/**
 * [INPUT]: 依赖 React 的 createElement、lucide-react 的 `Search`、官方原语 `Input`/`Pill`（`@deepseek-ai/dsh-client-ui-primitives`）、`esc-constants` 的「更多」原地址、`esc-copy` 的文案与 `esc-types` 的类型
 * [OUTPUT]: 对外提供 `EnterpriseEscToolbar`——主 tab（系统广场/团队空间/已连接的/我启用的）+ 二级分类页签 + 搜索 + 「更多」
 * [POS]: esc 页面的**工具栏**，移植自 NUWAX `components/ResourceToolbar/index.tsx`（145 行）。
 *   ★四处注入点替换：① antd `Segmented` → 官方原语 `Pill` 组（DSH 体系里没有 Segmented，而 Pill 就是同一件事：
 *   一枚可选中态的小胶囊）；② antd `Input` + `@ant-design/icons` 的 `SearchOutlined` → 官方 `Input` + lucide `Search`；
 *   ③ 二级分类页签的 antd-less 自绘胶囊 → 同一个 `Pill`；④ umi `history.push` 跳广场 → **真超链接**指向
 *   外部技能广场 `https://skillhub.cn/`（**用户裁决**「更多超链接到 https://skillhub.cn/」，新开标签页 +
 *   `rel="noreferrer noopener"`；口径 31 那版是置灰写"未接入"，已被这条裁决取代）。
 *   ★版式与行为照抄：主行左右分置、搜索框 214px、「更多」用 `visibility` 隐藏**保留占位**（避免切主 tab 时右侧宽度跳动）、
 *   分类行 8px 间距 14px 上边距、页签胶囊 3px/12px 内衬 + 999px 圆角。
 *   ★antd Input 的 `allowClear` **没有**对应实现（官方 Input 不带清空钮）：这是本刀已知的一处小缺口，
 *   搜索框内容仍可全选删除，但少了那枚 × 按钮。
 *   ★用户裁决：药丸**不要描边**——本文件给每枚 `Pill` 都挂上 `esc-pill`（`esc-style` 用它压掉官方选中态自带的
 *   1px inset 环），于是资源类型 / 主 tab / 二级分类三行是同一套"无描边药丸"视觉。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Input, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { Search } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { ESC_RESOURCE_MORE_HREF, ESC_RESOURCE_MORE_SQUARE_PATH } from './esc-constants.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import type { ResourceCategoryInfo, ResourceSourceEnum, ResourceTypeEnum } from './esc-types.js'

/** 工具栏入参。 */
export interface EnterpriseEscToolbarProps {
  readonly resourceType: ResourceTypeEnum
  readonly source: ResourceSourceEnum
  readonly onSourceChange: (source: ResourceSourceEnum) => void
  /** 二级分类列表（首位为「全部」）。 */
  readonly categories: readonly ResourceCategoryInfo[]
  /** 当前分类 key，空串表示全部。 */
  readonly activeCategory: string
  readonly onCategoryChange: (key: string) => void
  /** 搜索关键字（输入框受控值）。 */
  readonly keyword: string
  readonly onKeywordChange: (keyword: string) => void
  /** 是否显示「更多」入口（连接器页为 false，与原页面一致）。 */
  readonly showMore?: boolean | undefined
  /** 分类字典读不到时的降级提示（本页新增：原页面静默）。 */
  readonly categoriesUnavailable?: boolean | undefined
}

/**
 * 主 tab 选项（逐条照抄原文件的构造顺序与显隐口径：
 * 「已连接的」仅连接器页、「我启用的」仅技能页，其余两枚恒在）。
 */
function sourceOptionsOf(resourceType: ResourceTypeEnum): readonly { readonly label: string; readonly value: ResourceSourceEnum }[] {
  return [
    { label: ENTERPRISE_ESC_COPY.mainTabSystem, value: 'system' },
    { label: ENTERPRISE_ESC_COPY.mainTabTeam, value: 'team' },
    ...(resourceType === 'connector'
      ? [{ label: ENTERPRISE_ESC_COPY.mainTabConnected, value: 'connected' as const }]
      : []),
    ...(resourceType === 'skill'
      ? [{ label: ENTERPRISE_ESC_COPY.mainTabEnabled, value: 'enabled' as const }]
      : []),
  ]
}

/** 资源聚合页顶部工具栏。 */
export function EnterpriseEscToolbar({
  resourceType,
  source,
  onSourceChange,
  categories,
  activeCategory,
  onCategoryChange,
  keyword,
  onKeywordChange,
  showMore = true,
  categoriesUnavailable,
}: EnterpriseEscToolbarProps): ReactNode {
  return createElement(
    'div',
    { className: 'esc-toolbar' },
    createElement(
      'div',
      { className: 'esc-toolbar-main' },
      createElement(
        'div',
        // 用户裁决（移动端）：这枚容器**不参与压缩**（`.esc-source-tabs { flex: none }`）——宽度不够时先缩搜索框、
        // 再整行换行，从而标签的四个字永远不会被压成两行。
        { className: 'esc-source-tabs' },
        sourceOptionsOf(resourceType).map(option =>
          createElement(
            Pill,
            {
              key: option.value,
              className: 'esc-pill',
              active: option.value === source,
              onClick: () => onSourceChange(option.value),
              children: option.label,
            },
          ),
        ),
      ),
      createElement(
        'div',
        { className: 'esc-toolbar-right' },
        showMore === true
          ? createElement('a', {
              className:
                source === 'system' ? 'esc-more' : 'esc-more esc-more-hidden',
              // 用户裁决：「更多」超链接到公开技能广场（官方那枚跳的是 NUWAX 自己的广场分类页）
              href: ESC_RESOURCE_MORE_HREF,
              target: '_blank',
              rel: 'noreferrer noopener',
              title: ENTERPRISE_ESC_LOCAL_COPY.moreExternal,
              children: ENTERPRISE_ESC_COPY.more,
            })
          : null,
        createElement(Input, {
          className: 'esc-search',
          icon: createElement(Search, { size: 14, 'aria-hidden': true }),
          placeholder: ENTERPRISE_ESC_COPY.searchPlaceholder,
          value: keyword,
          'aria-label': ENTERPRISE_ESC_COPY.searchPlaceholder,
          onChange: (event: { target: { value: string } }) => onKeywordChange(event.target.value),
        }),
      ),
    ),
    categories.length > 0
      ? createElement(
          'div',
          { className: 'esc-category-tabs' },
          categories.map(item =>
            createElement(Pill, {
              key: item.key === '' ? '__all__' : item.key,
              className: 'esc-pill',
              active: item.key === activeCategory,
              onClick: () => onCategoryChange(item.key),
              children: item.label,
            }),
          ),
        )
      : null,
    categoriesUnavailable === true
      ? createElement('div', {
          className: 'esc-toolbar-note',
          children: ENTERPRISE_ESC_LOCAL_COPY.categoriesUnavailable,
        })
      : null,
  )
}

/**
 * 「更多」的原跳转地址（只用于置灰提示里的说明，不参与跳转）。
 *
 * 单独导出是为了让测试盯住"这条地址没被误接成跳转"——它是本文件唯一还在引用它的地方。
 */
export const ENTERPRISE_ESC_MORE_PATH = ESC_RESOURCE_MORE_SQUARE_PATH
