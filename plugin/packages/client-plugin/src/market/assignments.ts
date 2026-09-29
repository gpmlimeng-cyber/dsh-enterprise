/**
 * [INPUT]: 依赖 protocol 的插件分配类型与 error-codes；依赖 core-packages 的保护名单判定
 * [OUTPUT]: 对外提供 InstalledPluginFact/MarketEntry/planMarketActions 期望状态调和计划
 * [POS]: market 的纯函数决策层：把「中心期望」与「本机事实」折算成单一动作，供 UI 展示与 installer 执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterprisePluginAssignment } from '../protocol/types.js';
import { isCorePackage } from './core-packages.js';

/** 本机已安装事实；sha256 由宿主安装记录提供，缺失时视作与中心不一致（宁可升级）。 */
export interface InstalledPluginFact {
  readonly version: string;
  readonly sha256: string;
}

export type MarketAction = 'INSTALL' | 'UPGRADE' | 'UNINSTALL' | 'NONE';

/** 市场一行：中心分配 + 本机事实 + 调和结论；blockedReason 存在时动作必为 NONE。 */
export interface MarketEntry {
  readonly assignment: EnterprisePluginAssignment;
  readonly installed: InstalledPluginFact | null;
  readonly action: MarketAction;
  readonly blockedReason?: string;
}

const CORE_BLOCKED_REASON =
  '企业核心包由安装层拥有，市场不受理安装、升级或卸载';
const NO_DOWNLOAD_REASON = '中心未提供下载地址，无法获取制品';

/**
 * 期望状态调和计划。
 *
 * 规则（与 dshent 语义一致）：
 * - `desiredState === 'ABSENT'` 且本机已装 → `UNINSTALL`（只有中心**显式** ABSENT 才撤回；
 *   从分配范围里消失不等于撤回，见下一条）；
 * - `desiredState === 'INSTALLED'` 且本机未装 → `INSTALL`；
 * - 已装但 version 或 sha256 与中心不同 → `UPGRADE`；
 * - 完全一致 → `NONE`；
 * - **不在 assignments 里的本地包一律不动**：中心不远程撤回历史安装，用户自装的第三方插件
 *   不受企业市场管辖；
 * - 核心包，或「确实需要下载字节（INSTALL/UPGRADE）而 `downloadUrl === null`」→ 给
 *   `blockedReason` 并降级 `NONE`。已经与中心一致的包即使没有下载地址也保持 `NONE` 且不报阻塞，
 *   避免用无关噪声掩盖真实问题。
 *
 * 纯函数：不读文件、不发网络、不看 `required`（历史 required 不强制安装），输出顺序与入参一致。
 */
export function planMarketActions(
  assignments: readonly EnterprisePluginAssignment[],
  installed: ReadonlyMap<string, InstalledPluginFact>
): MarketEntry[] {
  return assignments.map((assignment) => {
    const fact = installed.get(assignment.packageName) ?? null;

    if (isCorePackage(assignment.packageName)) {
      return {
        assignment,
        installed: fact,
        action: 'NONE',
        blockedReason: CORE_BLOCKED_REASON,
      };
    }

    if (assignment.desiredState === 'ABSENT') {
      if (fact === null) {
        return { assignment, installed: null, action: 'NONE' };
      }
      // 撤回不需要制品：即使中心未给下载地址，也必须能卸下已被显式撤回的包。
      return { assignment, installed: fact, action: 'UNINSTALL' };
    }

    if (fact === null) {
      return assignment.downloadUrl === null
        ? {
            assignment,
            installed: null,
            action: 'NONE',
            blockedReason: NO_DOWNLOAD_REASON,
          }
        : { assignment, installed: null, action: 'INSTALL' };
    }

    const sameArtifact =
      fact.version === assignment.version && fact.sha256 === assignment.sha256;
    if (sameArtifact) {
      return { assignment, installed: fact, action: 'NONE' };
    }
    return assignment.downloadUrl === null
      ? {
          assignment,
          installed: fact,
          action: 'NONE',
          blockedReason: NO_DOWNLOAD_REASON,
        }
      : { assignment, installed: fact, action: 'UPGRADE' };
  });
}
