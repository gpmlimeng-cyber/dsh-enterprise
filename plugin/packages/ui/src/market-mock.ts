import type { EnterpriseMarketSkillRow } from './marketplace-entry.js'

/**
 * [INPUT]: 只依赖自己的常量数组 + 一条**类型**导入（`import type`，编译期擦除、不产生运行时环）。
 * [OUTPUT]: 对外提供 `enterpriseMarketMockEnabled()`（读本机开关）、`ENTERPRISE_MARKET_MOCK_TOGGLE_KEY`（开关键名）、
 *   七类的**演示行**投影 `enterpriseMarketMockSkills()` / `enterpriseMarketMockPlugins()` / `enterpriseMarketMockPresets()`
 *   与它们的首行 id `ENTERPRISE_MARKET_MOCK_IDS`（供 Host 层过滤「只保留演示行」）。
 * [POS]: ui 的**临时演示数据叶**——只为让用户在没有真实分类下发时也能看到「七类分组」的排版效果。
 *
 * ★★ **这是临时的，不是产品功能** ★★
 * 背景：真实服务端的 `category` 是自由字符串，按用户裁决 A（严格七类）绝大多数会落进「其他」，
 * 于是分组页只有一组、看不出分组效果。用户要求「模拟更多分组，我要看效果」⇒ 这里造一份演示目录。
 *
 * 三条自我约束（避免它悄悄变成产品的一部分）：
 *   ① **默认关**：只有本机把 `localStorage[ENTERPRISE_MARKET_MOCK_TOGGLE_KEY]` 设成 `'1'` 才生效
 *      （`enterpriseMarketMockEnabled()` 是唯一读开关的地方）；没设过就整段不进任何渲染路径。
 *   ② **只替换目录、不碰行为**：演示行走的是**同一套行模型与同一批回调**（装/卸/启用/卸载都还是真 store
 *      写入口），故看到的排版、悬停、菜单、禁用口径与真实行逐字相同；只是「有哪些行」被换掉了。
 *   ③ **可一键删除**：本文件 + `marketplace-entry.tsx` 里三处 `mock*` 调用点，删掉即彻底消失
 *      （没有任何生产代码依赖它）。
 *
 * 分类取值刻意覆盖**七类全部**（含「其他」由**未命中**的 'unknown-thing' 与**缺席**两条路径各出一条），
 * 用来同时验证「命中七类」与「未命中归其他」两种归一行为。
 */

/** 演示数据的本机开关键（`localStorage`）。设成 `'1'` 才生效；别处不许再读它。 */
export const ENTERPRISE_MARKET_MOCK_TOGGLE_KEY = 'dshent.market.mock'

/** 演示行的固定 id 前缀：Host 层据此只保留演示行（避免与真实目录混排）。 */
export const ENTERPRISE_MARKET_MOCK_IDS = {
  skillPrefix: 'mock-skill-',
  pluginPrefix: 'mock-plugin-',
  presetPrefix: 'mock-preset-',
} as const

/** 演示行的分类取值：前六个真实命中七类，最后两条走「未命中」与「缺席」两条归一路径。 */
const MOCK_CATEGORIES = ['精选', '效率', '研究', '编程', '商业', '创意', 'unknown-thing', undefined] as const

const MOCK_SKILL_NAMES = [
  '会议纪要技能组', '文档速读', '论文精读助手', '代码审查规则', '报价单生成', '海报文案改写',
  '零散工具合集', '未分类的旧技能',
] as const

const MOCK_PLUGIN_NAMES = [
  'Playwright MCP', 'Notion MCP', 'Feishu MCP', 'data-analytics', 'websearch', 'docx-official',
  'pdf-official', 'xlsx-official',
] as const

const MOCK_PRESET_NAMES = [
  '前端联调一条龙', '周报流水线', '客服知识库', '数据周报模板', '合同审阅链', '海报批量出图',
  '杂项预设', '历史遗留预设',
] as const

/**
 * 本机开关是否打开。**唯一读开关的地方**；任何异常（隐私模式禁用 localStorage 等）一律当**关**，
 * 绝不因为读不到开关就把演示数据放出去。
 */
export function enterpriseMarketMockEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(ENTERPRISE_MARKET_MOCK_TOGGLE_KEY) === '1'
  } catch {
    return false
  }
}

/** 演示行与真实行**形状完全一致**的最小字段集（缺的字段一律不产出该键，照行模型的「为缺失设计」）。 */
export interface EnterpriseMarketMockRow {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category?: string
}

function rowsOf(prefix: string, names: readonly string[]): readonly EnterpriseMarketMockRow[] {
  return names.map((name, index) => {
    const category = MOCK_CATEGORIES[index]
    return {
      id: `${prefix}${index}`,
      name,
      description: `${name} · 演示数据（分类落在「${category ?? '未下发分类'}」）`,
      ...(category === undefined ? {} : { category }),
    }
  })
}

/** 技能演示行（8 条：覆盖七类 + 未命中 + 缺席）。 */
export function enterpriseMarketMockSkills(): readonly EnterpriseMarketMockRow[] {
  return rowsOf(ENTERPRISE_MARKET_MOCK_IDS.skillPrefix, MOCK_SKILL_NAMES)
}

/** 插件演示行（8 条，同上）。 */
export function enterpriseMarketMockPlugins(): readonly EnterpriseMarketMockRow[] {
  return rowsOf(ENTERPRISE_MARKET_MOCK_IDS.pluginPrefix, MOCK_PLUGIN_NAMES)
}

/** 配方演示行（8 条，同上）。 */
export function enterpriseMarketMockPresets(): readonly EnterpriseMarketMockRow[] {
  return rowsOf(ENTERPRISE_MARKET_MOCK_IDS.presetPrefix, MOCK_PRESET_NAMES)
}

/**
 * 演示行 → **真实行模型**（`EnterpriseMarketSkillRow`）：字段与 `enterpriseMarketSkillRows()` 的产出逐项同形
 * （`displayName` / `description` / `sourceDshVersion` / 可选 `category` / `builtin` / `latestVersionId`），
 * 故分组、排版、facts、动作与真实行**逐字同路径**——这就是「只替换目录」的含义。
 */
export function enterpriseMarketMockSkillRows(): readonly EnterpriseMarketSkillRow[] {
  return enterpriseMarketMockSkills().map(row => ({
    id: row.id,
    skillId: row.id,
    displayName: row.name,
    description: row.description,
    sourceDshVersion: '0.1.7-rc.2',
    ...(row.category === undefined ? {} : { category: row.category }),
    // 演示行恒按**非内置**处理（演示数据里没有内置包这一说；`builtin` 的真实用途是
    // 「已安装」分组只显示非内置的已装行，属排队中的 task-5）。
    builtin: false,
    // 演示行不参与「有更新」判定（没有中心详情可比）⇒ 恒空串，与「取不到就少说一句」的既有口径一致。
    latestVersionId: '',
  }))
}
