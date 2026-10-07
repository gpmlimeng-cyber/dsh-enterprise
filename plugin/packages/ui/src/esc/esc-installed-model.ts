/**
 * [INPUT]: 无运行时依赖（纯类型 + 纯函数 + 文案常量）——只读 `skill-api-decode` 的两份记录形状、`esc-copy` 的文案与 `esc-types` 的 `ResourceItem`
 * [OUTPUT]: 对外提供「已安装技能」页的**纯投影**：分组顺序 `ENTERPRISE_ESC_INSTALLED_KINDS`、组名取值 `enterpriseEscInstalledTitleOf`、两张卡投影 `enterpriseEscSelfInstalledCard` / `enterpriseEscCenterInstalledCard`（各自含 key / 卡片数据 / 那枚开关**能不能拨**）
 * [POS]: 口径 46/47 的**事实层**（与 `esc-card`/`esc-installed.tsx` 那种"带 hook 的视图"分开）。
 *   为什么非要拆出来：本仓的 vitest **没有 DOM、也跑不了 hook**（`useState` 一在组件本体里出现，用例就没法直调它）
 *   —— 于是"分组顺序对不对 / 卡片标题取哪个字段 / 哪一组那枚开关该置灰"这些**判定**必须住在能直调的纯函数里，
 *   否则它们只能靠"看代码"保证。视图那一层因此只剩「把模型画出来」这一件事。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { EnterpriseInstalledSkill, EnterpriseSelfInstalledSkill } from '../skill-api-decode.js'
import { ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import type { ResourceItem } from './esc-types.js'

/** 两个分组的身份（用户那张参考图就是这两组）。 */
export type EnterpriseEscInstalledKind = 'self' | 'center'

/**
 * 分组顺序：**用户自定义在前**（参考图里本机自己导入的那批排在「来自市场」上面）。
 *
 * 这一个数组是顺序的唯一真源——视图按它铺，用例按它比。
 */
export const ENTERPRISE_ESC_INSTALLED_KINDS: readonly EnterpriseEscInstalledKind[] = ['self', 'center']

/** 组名（含"括号里的数"由视图补，这里只给名字）。 */
export function enterpriseEscInstalledTitleOf(kind: EnterpriseEscInstalledKind): string {
  return kind === 'self' ? ENTERPRISE_ESC_LOCAL_COPY.installedGroupSelf : ENTERPRISE_ESC_LOCAL_COPY.installedGroupCenter
}

/** 一张已安装卡片的**渲染数据** + 它那枚开关的**可拨性**（`locked` = 拨不动，且原因由视图写成 title）。 */
export interface EnterpriseEscInstalledCard {
  /** React key：**按组前缀**（两组的 id 命名空间不同，同名技能也不会撞 key）。 */
  readonly key: string
  /** 卡片数据（标题＝显示名、描述＝包内技能目录名；记录里没有的字段一律**不编**）。 */
  readonly item: ResourceItem
  /**
   * 这一组的开关能不能拨。
   *
   * ★`true` 只有一种来由（口径 47 的如实缺口）：**本机自装包没有中心雪花 id ⇒ 宿主侧没有卸载路由**。
   *   企业已装包（`来自市场`）恒可拨 —— 它走的是既有 `POST …/skills/uninstall`。
   */
  readonly locked: boolean
}

/**
 * 标题与描述的唯一取法（两组共用，故不可能一组取 `displayName`、另一组取 `skillId`）。
 *
 * ★`displayName` 为空串时回落 `skillId`：那是 Host 的显示名真的缺（不是我们不读），
 *   而 `skillId` 是**一定在**的那件事实（两份记录都必有）——回落比画一张空标题诚实。
 * ★描述＝包内**技能目录名**（`names`）。两份记录里**没有**平台那种介绍文案，
 *   所以这里不向卡片要一个它没有的字段，也不编一句"来自本机"这类话去填满那一行。
 */
function cardFactsOf(
  key: string,
  record: { readonly skillId: string; readonly displayName: string; readonly names: readonly string[] },
  locked: boolean,
): EnterpriseEscInstalledCard {
  return {
    key,
    item: {
      id: key,
      name: record.displayName === '' ? record.skillId : record.displayName,
      description: record.names.join('、'),
    },
    locked,
  }
}

/** 「用户自定义」那一组的卡片投影（本机自装记录；那枚开关**恒拨不动**，原因写在视图的 title 里）。 */
export function enterpriseEscSelfInstalledCard(record: EnterpriseSelfInstalledSkill): EnterpriseEscInstalledCard {
  return cardFactsOf(`self-${record.skillId}`, record, true)
}

/** 「来自市场」那一组的卡片投影（企业已装记录；那枚开关能拨 —— 拨下去就是卸载）。 */
export function enterpriseEscCenterInstalledCard(record: EnterpriseInstalledSkill): EnterpriseEscInstalledCard {
  return cardFactsOf(`installed-${record.packageId}`, record, false)
}
