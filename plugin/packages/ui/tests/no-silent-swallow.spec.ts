/**
 * [INPUT]: 只依赖 `node:fs/promises` 与 vitest；扫描 `src/**` 的**源码文本**（剥掉注释后再判）
 * [OUTPUT]: 本刀的**反向锁**——① 全包禁止「把失败变成默认值」的静默吞模式（`.catch(() => [])` / `catch(() => undefined)` 之类）； **本刀**：例外清单新增 `library-gate.ts`（本机设置读失败 → 按默认关 + 摆出 `ENT_LIBRARY_SETTING_READ_FAILED` 由组件行显示并可重试，不是静默回落）。
 *          ② 禁止空 catch 块；③ 每个含 catch 的源文件都必须在**已声明的例外清单**里且写明理由（新增一处 catch 就会先红）；
 *          ④ 四个列表页必须把失败接到显式失败态 + 重试（不许退回静默清空） **本刀（本地导入）**：`marketplace-entry.tsx` 那条理由补齐「本地上传失败投影成稳定码 + 上传成功后次级读取（自装清单）失败只记 `listed=false` 并由界面那句如实交代」
 * [POS]: 「静默吞失败」这一类体验债的机械门禁：本仓没有 DOM 渲染测试，这条源码级不变量是**唯一**能在 CI 里拦住
 *        「又有人把一次取数失败 catch 成空数组」的地方
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

/**
 * **允许存在的 catch 例外清单**（file → 为什么它不是「静默吞失败」）。
 *
 * 口径：允许的是「失败被**显式**处理」或「这次异常与『取数失败』无关」两类；
 * 把取数失败变成 `[]` / `undefined` / `null` / `''` 这类默认值的写法**一律不允许**（下面的断言逐条禁止）。
 * 新加一处 catch 必须在这里补一行理由——这就是这张清单的意义。
 */
const ALLOWED_CATCH_FILES: Readonly<Record<string, string>> = {
  'account-origin.tsx': '地址解析门禁：非法 URL 落到「就地提示」分支（有可见反馈），不是把取数失败变成默认值',
  'account-store.ts': '取数/动作失败一律写进脱敏快照的错误码字段（errorCode / pluginErrorCode / sessionErrorCode），由界面出显式失败态',
  'desktop-runtime.ts': '桌面能力面的探测与回落（打开快捷键面板、reload/restart 的 fork 回落）：失败由调用方的可见反馈承担，属行为边界外',
  'feedback-dialog.tsx': '附件魔数采样（前 16 字节）失败只影响这条可选预检，提交正文的失败仍走显式失败态',
  'help-link.ts': '帮助中心打开链的兜底：Host 打开失败 → window 兜底 → 返回 failed 这个**结果值**给调用方',
  'library-gate.ts': '本机设置（资料库管理开关）的读/写失败**不吞**：读不到按产品默认（关）处理并把 ENT_LIBRARY_SETTING_READ_FAILED 摆进快照、写失败摆 ENT_LIBRARY_SETTING_SAVE_FAILED，由组件行显示 + 重试；catch 里返回 undefined 的那处只是「本机存储区取不到」的形状探测',
  'library-selection.ts': '会话选中集合 store：catch 里**先把失败写进快照**（status=failed + `enterpriseLocalErrorCode` 的稳定码 + 留痕），返回的 `undefined` 是这一趟操作的**结果值**（`Promise<T | undefined>`，调用方据此不写集合），不是"没有数据"；`items` 清空是刻意的（宁可知情地空着，也不拿过期清单冒充现状）。最要紧的一条：读不到时**绝不写**——一次"加入"的点击不会把用户原先选的一堆资料覆盖掉',
  'library-selection-trigger.ts': '`@` 触发源取候选失败**原样重抛**（不返回 `[]`、不返回 undefined）：官方管线把这一组标成 failed 并打 console.error，本文件另加一条宿主 logger 留痕；catch 里唯一的分支判断只是"请求已被取消"，取消不抛（官方在换查询/关菜单时会 abort）',
  'list-state.ts': '`enterpriseDegradedRead` 的显式降级：捕获后**交出稳定错误码**（code 字段），界面据此如实说明 + 可重试',
  'local-api-decode.ts': 'URL/形状门禁：非法输入返回 false 这个**判定结果**（解码布尔），与取数失败无关',
  'local-api.ts': '响应体 JSON 解析失败被**重抛**成 ENT_LOCAL_RESPONSE_INVALID（兜底是显式失败，不是静默默认值）',
  'login-dialog.tsx': '登录发起失败 → 就地渲染 ENT_LOCAL_UNAVAILABLE 的显式失败态',
  'login-page.tsx': '登录轮询/凭证校验失败 → setError(人话) 的显式失败态',
  'marketplace-entry.tsx': '详情文件树 / 文件正文取数失败 → 记稳定码 + 渲染失败态与重试（本轮改后不再有静默分支）；**本刀（本地导入）**：本地上传失败同样把错误投影成稳定码（`uploadSkill` 的 catch）落进导入反馈；上传成功后的**次级**读取（本机自装清单）读不到时只把 `listed` 记成 false —— 界面那句 `ENTERPRISE_SKILL_IMPORT_UNLISTED` 会说出来（导入本身仍如实报成功），不是静默吞',
  'market-mock.ts': '**临时演示数据的开关读取**（见该文件头：默认关、可一键删除）：读 localStorage 在隐私模式/被禁用时会抛，catch 里返回 false = 「开关没打开」这个**判定结果**，即按关闭处理——绝不允许「读不到开关」被当成「打开演示数据」',
  'preset-launch.ts': '降级链第二级（跳新会话并填入指令）的官方结构面调用：`openWorkspace` 抛错时返回 `false` 这个**结果值**给调用方（UI 据此出 ENT_PRESET_LAUNCH_FAILED 的显式行内提示 + 下一步），不是把取数失败变成默认值',
  'preset-market.tsx': '配方详情取数失败 → 记稳定码 + 渲染「列表级信息」+ 重试（本轮改后不再静默回落列表投影）',
  'shortcuts-open.ts': '快捷键能力探测：探测失败返回 "threw" 这个**结果值**给调用方',
  'skill-market.tsx': '技能详情取数失败 → 记稳定码 + 渲染「列表级信息」+ 重试（本轮改后不再静默回落列表投影）',
  'usage-panel.tsx': '用量取数失败 → state.kind = failed（显式失败态）',
}

/** 把注释剥掉：文档里引用 `catch(() => [])` 这类**反例**不该被算成一次真实的 catch。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const at = line.indexOf('//')
      return at === -1 ? line : line.slice(0, at)
    })
    .join('\n')
}

/** 读全部 ui 源码（文件名 → 代码文本）。 */
async function uiSources(): Promise<Readonly<Record<string, string>>> {
  const names = (await readdir(new URL('../src/', import.meta.url))).filter(name => /\.tsx?$/.test(name))
  const entries = await Promise.all(names.map(async name => [
    name,
    stripComments(await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')),
  ] as const))
  return Object.fromEntries(entries)
}

describe('no silent failure swallowing anywhere in the ui package', () => {
  it('never turns a failure into a default value (empty list / undefined / null / empty string)', async () => {
    const sources = await uiSources()
    // ① **绝对禁止**：把失败吞成空列表 `.catch(() => [] as readonly X[])`——
    //    这正是本刀消灭的那个模式（用户看到「企业技能 0」+ 一片空白，以为公司没给自己技能）。
    const fakeEmptyList = /\.catch\(\s*(?:\(\s*\)\s*)?=>\s*\[\]/
    // ② 次一档：catch 成其它默认值（`undefined`/`null`/空串/0/false）——**非清单文件**里一律禁止；
    //    清单里那几处是桌面能力面探测回落、附件魔数采样之类的**非取数**失败，逐条有理由。
    const fakeDefault = /\.catch\(\s*(?:\(\s*\)\s*)?=>\s*(?:undefined|null|''|""|0|false)\b/
    // ③ **绝对禁止**：catch 块里返回空列表 / 空串（把失败写成「没有数据」）。
    const caughtEmptyReturn = /catch\s*(?:\([^)]*\))?\s*\{[^{}]*\breturn\s*(?:\[\]|''|"")\b/
    // ④ 非清单文件禁止：catch 块里返回 `undefined`/`null`。
    const caughtDefaultReturn = /catch\s*(?:\([^)]*\))?\s*\{[^{}]*\breturn\s+(?:undefined|null)\b/
    //（没有「不许空 catch」这一条：本仓有几处**只写注释**的 catch（注释被剥掉后看起来是空块），
    //  它们由下面的清单逐文件给理由——清单是双向比对，新增一处 catch 仍然会先红。）
    for (const [name, source] of Object.entries(sources)) {
      expect(source.match(fakeEmptyList) ?? [], `${name} 把失败吞成空列表`).toEqual([])
      expect(source.match(caughtEmptyReturn) ?? [], `${name} 在 catch 里返回空列表/空串`).toEqual([])
      if (!(name in ALLOWED_CATCH_FILES)) {
        expect(source.match(fakeDefault) ?? [], `${name} 把失败吞成默认值`).toEqual([])
        expect(source.match(caughtDefaultReturn) ?? [], `${name} 在 catch 里返回默认值`).toEqual([])
      }
    }
  })

  it('keeps the catch inventory closed: every file with a catch is documented with a reason', async () => {
    const sources = await uiSources()
    const withCatch = Object.entries(sources)
      .filter(([, source]) => /\bcatch\b/.test(source))
      .map(([name]) => name)
      .sort()
    // 清单**双向**比对：多了（新 catch 没写理由）少了（理由过期）都会先红。
    expect(withCatch).toEqual(Object.keys(ALLOWED_CATCH_FILES).sort())
    for (const reason of Object.values(ALLOWED_CATCH_FILES)) {
      expect(reason.length).toBeGreaterThan(10)
    }
  })

  it('routes every directory list failure to an explicit failed state with a retry', async () => {
    const sources = await uiSources()
    // ① 企业技能页签（官方插件页里的插件市场）：目录取数搬进共享取数源，失败态由外壳渲染。
    expect(sources['marketplace-entry.tsx']).toContain('createEnterpriseSkillCatalogSource')
    expect(sources['marketplace-entry.tsx']).toContain('loadEnterpriseSkillCatalog')
    expect(sources['marketplace-entry.tsx']).toContain('EnterpriseMarketListHint')
    expect(sources['marketplace-entry.tsx']).toContain('EnterpriseMarketDegradedNotice')
    expect(sources['marketplace-entry.tsx']).toContain('catalogSource.retry()')
    expect(sources['marketplace-entry.tsx']).toContain('refreshPlugins()')
    // ② 设置页技能 tab：目录走取数源 + 失败态带重试 + 详情失败可见。
    expect(sources['skill-market.tsx']).toContain('createEnterpriseSkillListSource')
    expect(sources['skill-market.tsx']).toContain('listSource.retry()')
    expect(sources['skill-market.tsx']).toContain('ENTERPRISE_SKILL_DETAIL_LIST_LEVEL')
    // 改前那句静默回落（详情失败 → 拿列表投影冒充详情）真的没了。
    expect(sources['skill-market.tsx']).not.toContain('setDetail(selected)')
    // ③ 设置页配方 tab：同上。
    expect(sources['preset-market.tsx']).toContain('createEnterprisePresetListSource')
    expect(sources['preset-market.tsx']).toContain('listSource.retry()')
    expect(sources['preset-market.tsx']).toContain('ENTERPRISE_DETAIL_LIST_LEVEL')
    expect(sources['preset-market.tsx']).not.toContain('setDetail(selected)')
    // ④ 设置页插件 tab：目录四态由纯投影给出，失败态带真的重发（store.refreshPlugins）。
    expect(sources['plugin-market.tsx']).toContain('enterprisePluginCatalogState')
    expect(sources['plugin-market.tsx']).toContain('ENTERPRISE_PLUGIN_LIST_FAILED')
    expect(sources['plugin-market.tsx']).toContain('store.refreshPlugins()')
    // 品牌：未配置仍静默回落（resolveEnterpriseBranding(null)），取数失败显式可见（unavailable + 重试）。
    expect(sources['branding.ts']).toContain('enterpriseBrandingReadState')
    expect(sources['account-view.tsx']).toContain('ENTERPRISE_BRANDING_READ_FAILED')
    expect(sources['account-view.tsx']).toContain('branding.retry()')
  })

  it('keeps the shared list state machine as the single source of retry semantics', async () => {
    const sources = await uiSources()
    // 三个列表页都用同一个取数源（`createEnterpriseListSource`）与同一句重试文案，不各造一套状态机。
    expect(sources['list-state.ts']).toContain('export function createEnterpriseListSource')
    expect(sources['list-state.ts']).toContain("readonly kind: 'loading'")
    expect(sources['list-state.ts']).toContain("readonly kind: 'empty'")
    expect(sources['list-state.ts']).toContain("readonly kind: 'ready'")
    expect(sources['list-state.ts']).toContain("readonly kind: 'failed'")
    for (const name of ['marketplace-entry.tsx', 'skill-market.tsx', 'preset-market.tsx']) {
      expect(sources[name], name).toContain("from './list-state.js'")
    }
  })
})
