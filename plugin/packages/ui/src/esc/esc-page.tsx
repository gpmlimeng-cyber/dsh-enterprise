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
 *   ★**口径 46/47**：这一页有**两个视图**（目录 / 已安装技能）——没有真实路由，故用一份视图状态切换
 *   （与商城页的技能详情同一条手法）；`skillPort` 缺席时那一页根本打不开（按钮跟着置灰）。
 *   ★**口径 49**：`main` 的 inject 面再多带一枚 `draftPort`（技能页下拉那两项「查找技能 / 创建技能」
 *   的实现面），由本层原样转交给内容区；它同样**不进** `api`（那一面结构性只读）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createElement, useState, type ReactNode } from 'react'
import { EnterpriseEscAggregation } from './esc-aggregation.js'
import type { EnterpriseEscApi } from './esc-api.js'
import { EnterpriseEscFeatured } from './esc-featured.js'
import { EnterpriseEscInstalledView } from './esc-installed.js'
import { EnterpriseEscResourceTabs } from './esc-resource-tabs.js'
import { EnterpriseEscStyle } from './esc-style.js'
import type { EnterpriseEscDraftPort, EnterpriseEscSkillPort, ResourceTypeEnum } from './esc-types.js'

/** 页面入参（由 `main` 槽的 inject 面给出）。 */
export interface EnterpriseEscPanelProps {
  readonly api: EnterpriseEscApi
  /**
   * ★口径 46：本机技能写入口（可选——纯函数直调 / 没有本机写面时缺席，工具栏那两枚按钮随之置灰写明原因）。
   */
  readonly skillPort?: EnterpriseEscSkillPort | undefined
  /**
   * ★**口径 49**：技能页下拉里「查找技能 / 创建技能」的**草稿端口**（跳新会话 + 预填、不发送）。
   *
   * 与 `skillPort` 同一条注入范式：缺席 ⇒ 那两项置灰写明原因（判据是端口在不在场，不写死 disabled）。
   * ★它**不进** `api`（那一面结构性只读），也不是第二套开会话机制——实现在 `preset-launch.ts`。
   */
  readonly draftPort?: EnterpriseEscDraftPort | undefined
}

/** 「专家·技能·连接器」整页。 */
export function EnterpriseEscPanel({ api, skillPort, draftPort }: EnterpriseEscPanelProps): ReactNode {
  // 当前资源类型（原文由路径推导，这里就是状态）
  const [resourceType, setResourceType] = useState<ResourceTypeEnum>('expert')
  /**
   * ★口径 47：当前是不是「已安装技能」那个视图（本页没有真实路由 ⇒ 一份视图状态，见下面那段注释）。
   */
  const [installedOpen, setInstalledOpen] = useState(false)
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
    /**
     * ★口径 47：这一页有**两个视图** —— 目录（默认）与「已安装技能」。
     *
     * 与商城页的技能/配方详情子页面**同一条手法**：这一页没有真实路由（`main` 槽的一个面板），
     * 故用一份视图状态切换，**不硬造 `history`**；「返回列表」就是把它切回来。
     * 切回来时目录那一支是**重新挂载**的 ⇒ 已装计数与列表都是新读的，不必在卸载时手工通知谁。
     * ★本机写入口缺席（纯函数直调 / 没有本机写面）时这一页**根本打不开**：那一枚「已安装」按钮
     *   跟着置灰写明原因（判据同 `skillPort`），故这里不必造一枚假的写入口去喂给视图。
     */
    installedOpen && skillPort !== undefined
      ? createElement(EnterpriseEscInstalledView, {
          api,
          skillPort,
          onBack: () => setInstalledOpen(false),
        })
      : createElement(
          EnterpriseEscAggregation,
          // ★用户裁决④：**三页签与顶栏右块（更多/搜索/已安装/添加）必须在同一行**。
          //   此前页签住在 `.esc-root`、工具栏住在 `.esc-content`（聚合区）——**两个容器、两行**，
          //   怎么调 CSS 都不可能同排。解法是**结构**而不是样式：把页签交给聚合区，由它排进工具栏**左侧**，
          //   与右块同处那个 `justify-content: space-between` 的主行里 ⇒ 同排由 flex 保证，不靠巧合。
          //   ★「精选」那一行由聚合区经工具栏的**第二栏**（`belowLeading`）挂出——**专家页与技能页都挂**
          //     （两页同一套逻辑，只有 `targetType` 不同：`Agent` / `Skill`），连接器页不挂
          //     （连接器目录走 `/api/connector/providers`，与官方推荐那条取数面无关）。
          {
            key: `${resourceType}-${refreshToken}`,
            api,
            resourceType,
            onResourceTypeChange: code => {
              setResourceType(code)
              setRefreshToken(token => token + 1)
            },
            // ★口径 46：本机写入口（本地导入 + 自装清单 + 卸载），缺席时工具栏那两枚自己置灰写明原因。
            skillPort,
            // ★口径 49：技能页下拉那两项的草稿端口（跳新会话 + 预填、不发送；缺席即置灰写明原因）。
            draftPort,
            // ★口径 47：「已安装」打开已安装技能页（没有真实路由 ⇒ 一份视图状态；缺席即置灰）。
            onOpenInstalled: skillPort === undefined ? undefined : () => setInstalledOpen(true),
          },
        ),
  )
}

