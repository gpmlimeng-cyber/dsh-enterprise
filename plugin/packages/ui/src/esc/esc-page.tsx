/**
 * [INPUT]: 依赖 React 的 createElement/useState、`esc-api` 的取数面、`esc-aggregation`/`esc-resource-tabs`/`esc-style` 三个展示件与 `esc-types` 的类型
 * [OUTPUT]: 对外提供 `EnterpriseEscPanel`——「专家·技能·连接器」整页（左上三个药丸页签 + 内容区），由 `main` 槽经 inject 面拿到 `{api}` 后渲染
 * [POS]: esc 页面的**页面壳**，移植自 NUWAX `pages/ExpertSkillConnector/index.tsx`（48 行）。
 *   ★与原文的对应关系逐条：原文从**路径**解析资源类型（`parseEscPath(location.pathname)`），这里改成组件状态
 *   （DSH 的独立页面没有那三条子路由）；原文那个"重复点击当前项也要刷新"的 `_t` 令牌，这里按下标自增——
 *   两处**都用同一个 `key={`${resourceType}-${refreshToken}`}` 把内容区 remount**，故刷新语义完全一致。
 *   ★**布局改动（用户裁决）**：原来的 200px 左栏整块撤掉，三个菜单（专家&专家团 / 技能 / 连接器）改到内容页
 *   左上角作**药丸页签**（`esc-resource-tabs`，官方 `Pill`）。页签住在这一层、**不在被 remount 的 `key` 子树里**——
 *   切换时只有数据区重建，页签自身不被重置。
 *   ★`styles.container` 的 `flex h-full` → `.esc-root`（竖排：页签行 + 内容区）；样式由 `EnterpriseEscStyle` 注入一次。
 *   ★**演示数据**（口径 32）：原先这里按 `api.escMockStatus()` 挂一条「模拟数据」免责横幅，
 *   **已按用户裁决（本轮）整条撤掉**（原话「模拟数据提示不要」）——组件文件 `esc-mock-banner.tsx` 一并删除。
 *   "这一栏是演示数据"这件事仍可在协议层查到：宿主 `GET …/esc/mock` 报开关态、演示响应多一枚 `mock: true`。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, useState, type ReactNode } from 'react'
import { EnterpriseEscAggregation } from './esc-aggregation.js'
import type { EnterpriseEscApi } from './esc-api.js'
import { EnterpriseEscResourceTabs } from './esc-resource-tabs.js'
import { EnterpriseEscStyle } from './esc-style.js'
import type { ResourceTypeEnum } from './esc-types.js'

/** 页面入参（由 `main` 槽的 inject 面给出）。 */
export interface EnterpriseEscPanelProps {
  readonly api: EnterpriseEscApi
}

/** 「专家·技能·连接器」整页。 */
export function EnterpriseEscPanel({ api }: EnterpriseEscPanelProps): ReactNode {
  // 当前资源类型（原文由路径推导，这里就是状态）
  const [resourceType, setResourceType] = useState<ResourceTypeEnum>('expert')
  /**
   * 刷新令牌：原文的 `location.state._t`。页签每次点击都 +1——**包括重复点击当前项**，
   * 于是 `key` 变化 ⇒ 内容区 remount ⇒ 重拉数据、重置筛选与滚动（与线上行为一致）。
   */
  const [refreshToken, setRefreshToken] = useState<number>(0)
  // ★用户裁决（本轮）：「模拟数据提示不要」——原来这里挂一条常驻免责横幅（读 `api.escMockStatus()`）。
  //   横幅已整条撤掉（组件文件一并删除）；**机器可读的信号仍在**：宿主 `GET …/esc/mock` 照旧报开关态、
  //   演示目录的响应仍多一枚 `mock: true` ⇒ "这一栏是演示数据"这件事在协议层仍可查，只是不再占据页面。
  return createElement(
    'div',
    { className: 'esc-root' },
    createElement(EnterpriseEscStyle),
    createElement(EnterpriseEscResourceTabs, {
      activeKey: resourceType,
      onSelect: code => {
        setResourceType(code)
        setRefreshToken(token => token + 1)
      },
    }),
    createElement(EnterpriseEscAggregation, {
      key: `${resourceType}-${refreshToken}`,
      api,
      resourceType,
    }),
  )
}
