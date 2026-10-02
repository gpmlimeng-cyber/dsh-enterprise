<!--
[INPUT]: 依赖用户方向指令（「如果不需要，我们的也不需要」→ operatingSystems 退出决策面；「优化后台和客户端」）、
         产品宪法 docs/notes/product-charter.md、方向台账 docs/notes/direction-decisions.md（第 9/10 条）、
         既有债单 docs/notes/ux-debt-audit.md 与 docs/feedback-feature-spec.md（只用于去重）。
[OUTPUT]: 后台 console/** 与客户端 plugin/packages/ui/** 的取证式只读审计——P0/P1/P2 优化清单、
         【不要动】清单、与既有债单的去重说明、不确定项、按收益/风险/依赖排序的执行顺序。
[POS]: docs/notes 下的优化审计台账；本文件是**唯一产出**，不含任何代码改动。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 后台（console）与客户端（plugin/packages/ui）优化审计 · 只读取证

> **本文件是本次审计的唯一产出。未改动任何代码、未改其它文档、未 git 提交、未部署、未重启 DSH、未使用 `/tmp`。**
> 临时取证文件全部落在 `/data/data/com.deepcode.shell/files/home/.sshwork/ccaudit/`。
> 版本锚点：`HEAD = 6fc61f5`（`docs: 方向决策——平台区分我们也不做；后台与客户端进入优化（先审计后动手）`）。
> 人日口径沿用仓库既有约定（`docs/plan/skill-install-sources.md:878-879`）：**1 人日 = 1 名熟悉本仓库的工程师有效工作 6 小时**，含实现 + 测试 + 文档。

---

## 0 一句话结论（最值得先做的三件事）

**两边都不是"烂"，而是"同一件事被抄了很多遍 + 少数几条关键路径的失败信息被丢掉了"。**
后台 4 个从不被任何生产代码 import 的组件、8 张共 5.4 MB 从不引用的品牌图、16 份同义错误取消息函数、4 份字节格式化、12 份同一串 Tailwind 输入框样式；
客户端死导出只有 4 个、四态覆盖与 a11y 结构都相当扎实，但有一份**文档声称存在、实际上从未存在过**的测试文件，而它声称守住的那个视图（会话同步）真的零测试。
最刺眼的单点缺陷是：**后台 21 张表格的失败态永远只说「暂时无法读取数据」**——生成客户端抛的是 JSON 对象而不是 `Error`，`DataTable` 的判断条件因此恒假，服务端给的可行动原因被静默丢弃。

最该先做的三件事：

1. **修后台表格失败态丢消息（`C-P0-1`）**——`console/src/components/product/DataTable.tsx:128-131` 只认 `instanceof Error`，而 `console/src/api/generated/client/client.gen.ts:200` 抛的是 `{error:{code,message}}` 纯对象 ⇒ 21 处 `ProductDataTable` 的失败全部退化成同一句兜底。0.5 人日，改成复用唯一一份 `errorMessage` 即可，立刻把管理员看不到原因的 21 张列表全部救回来。
2. **把 `operatingSystems` 从"决策面"降成"仅展示"（`C-P0-2`）**——`docs/notes/direction-decisions.md` 第 9/10 条已经把口径拍死（"平台字段只用于展示，永不作为拦截依据"），但后台上传向导仍然把它放在 legend 写着「操作系统」的 `fieldset` 里、归属"兼容性"，并且硬校验「至少选择一个操作系统」。0.5–1 人日，只改文案与那条无用必填，不碰契约。
3. **给 `ProductDialog` 补焦点管理（`C-P0-3`）**——`console/src/components/product/Dialog.tsx:33-44` 声明了 `aria-modal="true"`，却既不移动焦点也不关焦点，Escape 监听挂在 `section` 上；没有 `autoFocus` 字段的对话框（版本退休、删除确认）**按 Esc 没有任何反应**，Tab 会跑到遮罩后的页面上。1–1.5 人日，一处改动覆盖 10 个编辑器。

---

## 1 审计范围与方法（逐维度说明"怎么查的、查了什么"）

### 1.1 范围

| 面 | 路径 | 规模（工作区实测） |
|---|---|---|
| 后台 | `console/**` | `src` **137** 个 `.ts/.tsx`；`components/{atoms,primitives}` 共 **33** 个文件（**8,292** 行）；`public/` 10 个文件；26 个 `CLAUDE.md` |
| 客户端 | `plugin/packages/ui/**` | `src` **44** 个文件（**15,315** 行，其中 `marketplace-entry.tsx` 4,340 行、`local-api-decode.ts` 1,359 行）；`tests` 工作区 31 个 spec（`HEAD` 为 30 个 / **395** 条用例，第 31 个 `plugin-install-gate.spec.ts` 是并行新增）；1 个 `CLAUDE.md` |

**不在范围**：`server/**`、`contracts/**`、`plugin/packages/` 下除 `ui` 以外的包、`apps/**`、`website/**`、其它文档。

### 1.2 逐维度的查法（可复现）

| 维 | 怎么查的 | 查了什么 |
|---|---|---|
| 1 死代码 | 用 Node 脚本对 `src` 抽取全部 `export function/const/class/type/interface/enum` 与 `export {…}` 名字，再在全仓（排除 `node_modules`/`dist`/`lib`）做词边界计数：**0 次命中 = 死导出**；仅测试命中 = "仅测试使用"。另用"文件级零 importer"扫描（同时匹配单双引号与 `@/` 别名）找整模块死代码。 | 客户端 4 个死导出、5 个仅测试导出；后台 1 个死导出、1 个仅测试导出；后台 4 个组件文件零生产引用 |
| 2 重复实现 | 按"同一语义的多个定义"搜：`function errorMessage` / `function message` / `tableErrorMessage`、`formatBytes` / `bytes`、`inputClass`、OS 标签表 (`macOS`/`Windows` 字面量) | 16 份错误取消息（4 种文本、2 种行为）、5 份字节格式化（两端口径不同）、12 份 `inputClass`、3 份 OS 标签表 |
| 3 四态覆盖 | 逐文件统计 `isLoading/isPending/pendingComponent/正在载入`、`isError/errorMessage/role="alert"/加载失败`、`暂无/空/empty` 三类标记的命中数，再对"三类中缺一类"的文件单独读源码确认 | 后台 26 个 features/routes 文件；`MemberSelect`、`DataTable` 两条共享路径单独精读 |
| 4 死控件 | `grep -n "disabled=" \| grep "title="` 找"禁用 + 只挂 title"；再找"禁用了但连 title 都没有"的分支；逐个读源码判断"有没有下一步动作" | 后台 `disabled=` 87 处无 `title`；客户端已由既有 `plugin-install-gate.spec.ts` 反向锁（只挂 title 一律判红）覆盖 |
| 5 无障碍/键盘 | `grep -n "aria-current\|onClick="` 找"可点非 button/link"与"当前项是否被读屏宣告"；统计 `aria-*` 家族用量；找 `autoFocus` / `.focus()` 判断对话框焦点归属 | 后台 `aria-current` = **0 处**；可点非 button 仅 1 处（在上游 `RecordsTable` 里，不属产品面）；客户端 `aria-current` 仅出现在注释里 |
| 6 术语一致性 | 用宪法术语表逐词反查两端源码：`退休`/`下架`、`分配`/`可见范围`、`平台`/`系统`；再搜 `android`/`darwin`/`win32` 是否作为**文案**上屏 | `退休`/`已退休` 在后台 8 处、客户端 0 处；`下架` 在客户端 5 处、后台 0 处（同状态两个词）；`分配` 与 `可见范围` 在**同一个文件同一次对话**里并存 |
| 7 性能 | 读 `useSyncExternalStore` 的每个调用点看有没有 selector；读 `account-store` 的 `#set` 判断快照是否整对象替换；读 `member-select` 的取数循环；量 `console/dist/assets/*` 的真实体积并回查来源 | `account-store` 8 处消费者均为整快照订阅；`loadMembers()` 全目录游标遍历；`examples.index-*.js` 372 KB（含 21 份源码原文）、`examples.harness-*.js` 248 KB、`ToolChips-*.js` 220 KB |
| 8 陈旧文档 | 写脚本从每个 `CLAUDE.md` 抽"成员清单"条目，与 `ls`/`git ls-tree` 的真实文件集做双向差集；对声称的计数逐个数；再用 `git show HEAD:` 把**本次并行改动造成的差异**排除掉 | 后台 26 个 `CLAUDE.md` 成员清单**全部准确**（唯一差集是构造性的 `dist/`、`node_modules`）；客户端 `CLAUDE.md` 有 1 条幽灵条目 + 2 条漏登记 |
| 9 样式纪律 | `grep -c -- "--dsw-"` 统计 token 家族；统计 `--*` 自定义属性名分布；找字节级 CSS 长度/FNV 校验和断言；找同一工具栏内焦点环取值不一致 | 后台 `--dsw-*` = **0 处**（符合约束）；后台 CSS 自定义属性 40+ 个非 `--dsw-` 家族；客户端 238 处 `--dsw-*`；`marketplace-entry.spec.ts:264-265` 锁死 CSS 长度与校验和 |

> 上表"3 四态覆盖"一行里"后台 26 个 features/routes 文件"的实测结果：绝大多数后台页面的加载/空/失败三态**都是齐的**（`DataTable` 把三态收在一处，`:298-327`），缺口集中在两条共享路径（`MemberSelect`、`DataTable` 的页脚数字）与一处死灰按钮（`access-policy-page.tsx`），已分别立为 `C-P1-5`、`C-P2-3`、`C-P2-2`。

### 1.3 本次**没有**做的（声明）

- **没有跑过一次真实浏览器**。任务要求不重启、不部署；本机 GUI 需登录，故"焦点是否真的跑出遮罩""Esc 是否真的没反应"是**从源码控制流推导**的结论（我把推导链写进了每条证据里），未做人工复现。
- **没有执行任何测试/类型检查/build**（只读 + 并行改动中）。
- **没有改任何代码/文档**。
- 与工作区并行改动的边界：`plugin/packages/ui/src/{marketplace-entry.tsx,plugin-market.tsx}`、`plugin/packages/ui/src/plugin-install-gate.ts`、`plugin/packages/ui/tests/plugin-install-gate.spec.ts`、`plugin/packages/ui/CLAUDE.md` 在本次审计期间**正被另一路修改**（`git status` 在审计过程中从 4 条变成 5 条）。凡涉及这些文件的判断，一律以 `git show HEAD:` 或"明确标注为 in-flight"处理，**不把"它正在改"记成缺陷**。相关事实集中在 §5。

---

## 2 ★P0 / P1 / P2 清单

> 每条 = 现象（文件:行号）· 证据 · 影响（对员工/对管理员）· 建议改法 · 人日 · 风险 · 是否建议做。
> 编号规则：`C-` 后台、`U-` 客户端、`X-` 两端共因。

### P0（5 条：方向性错误 / 用户与管理员高频撞上的功能缺陷 / 生产暴露）

#### C-P0-1 后台 21 张表格的失败态**恒定丢掉服务端 message**，只显示一句兜底

- **现象**：任何列表取数失败，表格体只渲染「暂时无法读取数据」+ 一枚「重试」；服务端返回的可行动原因（revision 冲突、可见范围冲突、校验失败明细）一律不出现。
- **证据**：
  - 兜底实现在 `console/src/components/product/DataTable.tsx:128-131`：`tableErrorMessage` 只在 `error instanceof Error && error.message !== ''` 时返回消息，否则返回 `'暂时无法读取数据'`；渲染点 `:318-322`。
  - 生成客户端**抛的不是 `Error`**：`console/src/api/generated/client/client.gen.ts:189-200` 把响应体 `JSON.parse` 后 `throw jsonError ?? textError` —— 企业端的错误信封是纯对象 `{ error: { code, message, … } }`（`console/src/api/generated/types.gen.ts:700-702` `EnterpriseErrorResponse = { error: EnterpriseError }`），既不是 `Error` 实例、也没有顶层 `message`。
  - 结论：`tableErrorMessage` 的 `instanceof` 判断对企业端错误**恒假** ⇒ 21 处 `ProductDataTable` 全部退化成兜底。
  - 对照实现（写对了的）：`console/src/features/skills/skill-management-page.tsx:44-50`、`console/src/features/plugins/plugin-management-page.tsx:57-63` 等 11 处 `errorMessage()` 都走 `'error' in error` → `payload.message`。
  - 21 处调用点：`grep -rn "<ProductDataTable" console/src --include=*.tsx | grep -v "\.test\."` 共 21 条（access ×2、activity ×3、usage-analytics ×2、feedback ×1、members ×3、models ×3、plugins ×3、presets ×2、skills ×1、members/member-management ×1）。
- **影响**：**对管理员**——"保存失败""加载失败"变成零信息量的一句话，管理员只能截图报障或盲试；服务端团队精心写的中文 `message` 白写。**对员工**——间接：管理员拿不到原因 ⇒ 排障 SLA 变长。
- **建议改法**：把 `errorMessage` 抽成 `console/src/lib/errors.ts` 的**唯一一份**（`console/src/lib/utils.ts` 目前只有 `cn`，是自然落点），`tableErrorMessage` 删除、`DataTable` 直接 `import { errorMessage }`。补一条回归用例：`error={ { error: { message: '可见范围冲突' } } }` 时表格体必须渲染出 `可见范围冲突` 而不是兜底。
- **人日**：0.5（抽函数 + 21 处复用是机械改动 + 1 条用例）。
- **风险**：**低**。会改到 `console/src/components/product/DataTable.test.tsx` 的既有断言（当前只 1 条用例）。
- **是否建议做**：**是，第一优先**。

#### C-P0-2 后台把 `operatingSystems` 继续当"兼容性/必填"的决策面，与刚拍板的方向相反

- **现象**：上传插件版本时，向导里有一个 `legend` 写着「操作系统」的 `fieldset`，三个复选框归属"兼容性"，并且**硬校验至少选一个**；版本列表另有一整列「操作系统」。
- **证据**：
  - OS 真源表：`console/src/features/plugins/plugin-editors.tsx:48-52`（`OPERATING_SYSTEMS` = macOS/darwin、Linux/linux、Windows/win32）。
  - 默认值：同文件 `:132` `useState<PluginOperatingSystem[]>(['darwin','linux','win32'])`。
  - 硬校验：同文件 `:153-154` `if (operatingSystems.length === 0) { setValidationError('至少选择一个操作系统'); return; }`。
  - 界面语义：同文件 `:193-207` `<fieldset>` + `<legend>操作系统</legend>`，位于「兼容性」这一组（`:165` 的 `enterpriseBundleRange`、`:157` 的 Harness commits 同组），提交时并入 `compatibility`（`:158-164`）。
  - 列表列：`console/src/features/plugins/plugin-management-page.tsx:165-170` `{ id: 'operatingSystems', header: '操作系统' }`。
  - **方向依据**：`docs/notes/direction-decisions.md` 第 9 条 —— "平台字段只用于展示，**永不作为拦截依据**"；第 10 条 —— "数据面 `operatingSystems` 保留但**不再参与任何决定**；界面面不出现平台词"。
- **影响**：**对管理员**——每次上传都要在一个此刻已无判定意义的字段上做一次"选择"，而界面把它命名为"兼容性"、还报错"至少选择一个操作系统"，持续强化"平台会拦安装"的错误心智；下一个接手的人会照抄这个语义。**对员工**——间接：一旦有下游实现照抄"按平台拦"，员工会看到已被明确否定的平台提示。
- **建议改法**（只改界面语义，**不动契约、不动上行载荷**）：
  1. 删掉 `:153-154` 那条必填校验（默认全选已保证非空，不必再拿报错拦人）；
  2. `legend` 改「支持系统（上架元数据 · 仅展示，不拦截安装）」，并在 fieldset 内加一句人话说明（例「这里只是登记这个包面向哪些系统发布，安装不会因系统不同被拦下」）；
  3. `plugin-management-page.tsx:167` 的列头改「支持系统（仅展示）」；
  4. **保留** `PluginCompatibility.operatingSystems` 字段本身与提交路径（`contracts/plugin.yaml` 的 `PluginOperatingSystem` 与服务端仍要求非空数组，删字段会破契约与验签）。
- **人日**：0.5–1（3 处文案 + 1 处校验删除 + 同步 `console/src/features/plugins/plugin-editors.test.tsx`、`plugin-management-page.test.ts` 与 `console/src/features/plugins/CLAUDE.md`）。
- **风险**：**低**。唯一风险是产品口径要确认"管理员侧是否也要撤掉平台词"——我按 `direction-decisions.md` "界面面不出现平台词"取"改成信息性登记"这一档（完全删除列会丢上架元数据）。
- **是否建议做**：**是**。这是本任务的前提（用户原话"operatingSystems 退出决策面"）在后台侧的落地。

#### C-P0-3 `ProductDialog` 无焦点管理：Esc 对多数对话框无效，`aria-modal` 是空头承诺

- **现象**：打开对话框后焦点仍留在遮罩后的触发按钮上；按 Escape 无反应；Tab 会走到遮罩后的页面元素。
- **证据**：
  - `console/src/components/product/Dialog.tsx:27-32` 遮罩是一个普通 `<div>`（只处理 `onMouseDown` 点外关闭），`:33-36` 内容 `section role="dialog" aria-modal="true" aria-labelledby={titleId}`，`:41-43` Escape 处理挂在 **section 的 `onKeyDown`**。
  - **没有任何地方把焦点移进对话框**：全 `console/src`（排除测试）的 `.focus()` / `autoFocus` 只出现在**表单字段**上——`console/src/features/members/access-group-management.tsx:76`、`console/src/features/members/ldap-group-mapping.tsx:82`、`console/src/features/models/model-editors.tsx:165`、`:470`、`console/src/features/models/model-set-management.tsx:90`、`console/src/routes/login.tsx:285`；用 `grep -rn "\.focus()\|autoFocus" console/src --include=*.tsx | grep -v "\.test\."` 逐条确认，**没有一处是为对话框本身做的**。
  - 因此：焦点还留在遮罩后的触发按钮上 ⇒ keydown 事件不经过 `section` ⇒ **Esc 不关闭**；`aria-modal="true"` 宣告了惰性但页面其余部分仍可 Tab 聚焦。
  - 受影响的具体对话框（无 `autoFocus` 字段的那些）：版本退休确认 `console/src/features/plugins/plugin-editors.tsx:386-393`、`console/src/features/presets/preset-editors.tsx:223-231`、`console/src/features/skills/skill-editors.tsx:577-585`；删除确认 `console/src/features/members/access-group-management.tsx:185`、`console/src/features/models/model-set-management.tsx:208`、`console/src/features/access/policy-editors.tsx:286`。
- **影响**：**对管理员**——键盘用户（无障碍法务上也覆盖 RPA/读屏用户）打开"确认退休"后按 Esc 关不掉、Tab 会掉到背后的表格与工具栏上；读屏被告知"模态"从而不会再报背后的内容，实际焦点却在背后 ⇒ 方向感丢失。
- **建议改法**：在 `ProductDialog` 内加四件（一处改动覆盖全部 10 个使用点）：① 打开时把焦点移到对话框容器（给 `section` 加 `tabIndex={-1}`）或首个可聚焦元素；② Escape 监听从 `section` 挪到 `section` 的 `onKeyDownCapture` **或** `document` 级（且只在挂载期间注册）；③ 关闭时把焦点还给打开它的元素（`document.activeElement` 在挂载时记下）；④ Tab 在对话框内循环。`console/src/components/product/RowTitleLink.tsx` 已经证明本仓愿意为键盘语义写显式代码，这与此一致。
- **人日**：1–1.5（含窄屏与真机键盘验证、`Dialog` 的用例）。
- **风险**：**中**。会碰所有编辑器的既有用例（当前 `console/src` 里只有 `SidebarNav.test.tsx` / `-index.test.tsx` / `DataTable.test.tsx` / `RowTitleLink.test.tsx` 等少量 DOM 用例，面可控）；焦点还给触发元素需要调用方保证触发元素仍挂载（列表重渲染后可能消失 ⇒ 要兜底 `document.body`）。
- **是否建议做**：**是**。

#### X-P0-4 `/examples` 组件画廊在**生产构建里未鉴权**，并把 21 份组件源码原文打进产物

- **现象**：`/examples` 与 `/examples/harness` 是两个真实存在的 SPA 路由，**不经过 `_console` 的登录守卫**；其中 `/examples` 会把 21 个 primitive 的**源文件全文**当字符串渲染出来。
- **证据**：
  - 路由挂根、不受守卫：`console/src/routeTree.gen.ts:41-44` `ExamplesRoute = …({ id: '/examples', path: '/examples', getParentRoute: () => rootRouteImport })`；守卫只在 `console/src/routes/_console.tsx:16-32` 的 `beforeLoad`（`loadConsoleBootstrap()` + 角色过滤），`_console.tsx` 文件头自述"**不包裹 examples**"；`console/src/routes/__root.tsx` 也不做任何认证。
  - 源码原文入包：`console/src/examples/component-examples-page.tsx:14-21` `import.meta.glob('../components/primitives/*.tsx', { eager: true, import: 'default', query: '?raw' })`。
  - 产物实测：`console/dist/assets/examples.index-DUmVWJGz.js` = **372 KB**，且逐字命中原文件内容——在产物里能搜到 `console/src/components/primitives/PromptBar.tsx:545` 的 JSX 注释原文 `rainbow glimm sweep — plays across the interior on model change.`；`console/dist/assets/examples.harness-DiG1zXK5.js` = **248 KB**；两者合计 **620 KB**（占 `console/dist/assets` JS 总量 2.3 MB 的约 27%）。
  - 只服务画廊的生产依赖 4 个：`dialkit`（`console/src/components/site/IceCreamHarness.tsx:11`、`console/src/examples/harness-example-page.tsx:8-9`）、`glimm`（`console/src/components/primitives/PromptBar.tsx:11`）、`iconoir-react`（`console/src/components/primitives/SelectionActions.tsx:29`）、`liveline`（`console/src/components/primitives/InsightCards.tsx:10`）——全部写在 `console/package.json` 的 `dependencies` 里。
- **影响**：**对管理员/企业**——任何未登录访问者只要猜中 `/examples`，就拿走一份内部组件画廊 + 21 份 primitive 源码全文（含实现细节、注释里的设计取舍），这是一个匿名信息暴露面；生产 JS +620 KB 与 4 个额外供应链包则是纯成本。
- **建议改法**（三档，可叠加）：
  1. **最小**：给 `console/src/routes/examples.tsx` 加 `beforeLoad`，复用 `loadConsoleBootstrap()` 做与 `_console` 同口径的登录校验（未登录 `redirect({ to: '/login' })`）。**0.3 人日**。
  2. **推荐**：把源码视图做成**仅开发构建**存在——`component-examples-page.tsx:14-21` 改成按 `import.meta.env.PROD` 判空（`const sourceFiles = import.meta.env.PROD ? {} : import.meta.glob(…)`），生产不内联任何源码。**0.5 人日**。
  3. **彻底**：把 `examples/` + `components/{site,primitives,atoms}` 从产品构建里拆出去（独立 vite 配置或独立包），并从 `console/package.json` 的 `dependencies` 移除那 4 个画廊专用包（同时要处理 `console-shell.tsx:16`/`login.tsx:14` 复用的 `ThemeToggle`、`main.tsx:15` 的 `ThemeSync` 这两个真实产品依赖）。**1.5–2 人日**。
- **人日**：①+② 合计 **0.8**；③ 另计 1.5–2。
- **风险**：**低**（①②）/ **中**（③ 会动构建入口与既有 `examples` 用例与 `console/src/lib/{meta,registry}.tsx` 的迁移）。
- **是否建议做**：**是**，先做①②。

#### X-P0-5 同一状态两端两个词：后台说「退休/已退休」，客户端说「已下架」；且「分配」与「可见范围」在**同一个对话框**里并存

- **现象 A（宪法术语表违背 + 两端分叉）**：版本下架这个动作与状态，后台叫「退休」，客户端叫「下架」。
  - **证据（后台 = 退休）**：状态文案 `console/src/features/plugins/plugin-management-page.tsx:110` `RETIRED: { label: '已退休' }`；`console/src/features/presets/preset-management-page.tsx:104` 同；`console/src/features/skills/skill-editors.tsx:36` 同；`console/src/features/skills/skill-management-page.tsx:322` `{ label: '已退休', value: 'RETIRED' }`；动作与确认文案 `console/src/features/plugins/plugin-editors.tsx:386`（标题「退休插件版本」）、`:388`（「确认退休 …」）、`:393`（按钮「确认退休」）、`console/src/features/presets/preset-editors.tsx:223/225/226/231`、`console/src/features/skills/skill-editors.tsx:577/579/580/585`；无障碍名 `plugin-management-page.tsx:209`、`preset-management-page.tsx:168`、`skill-management-page.tsx:200`。
  - **证据（客户端 = 下架）**：`plugin/packages/ui/src/plugin-market.tsx:56` `export const ENTERPRISE_PLUGIN_VERSION_DELISTED = '已下架'`（`:53-61` 还专门讨论"不谎称已下架"）；`plugin/packages/ui/src/marketplace-entry.tsx:423` `/** 企业目录是否仍提供（false = 已下架但本机仍装着）。 */`。
  - **证据（宪法）**：`docs/notes/product-charter.md` 术语降维表 —— 「退休 / RETIRED」→「**下架**」（该表标注为"界面文案强制"）。
- **现象 B（同文件内两说）**：插件可见范围的对话框标题是「配置可见范围」，但同一个对话框里校验错误说「分配」。
  - **证据**：`console/src/features/plugins/plugin-editors.tsx:295` `<ProductDialog title="配置可见范围">`、`:64` 注释「ALL/USER 是控制台可编辑的可见范围」 vs `:265` `setValidationError('每条分配必须选择已发布版本')`、`:274` `setValidationError('同一分配对象只能存在一条规则')`、`:351` `aria-label={\`删除分配 ${index + 1}\`}`。宪法术语表：「分配 / assignment / subject_type」→「**可见范围**」。同样问题在 `console/src/features/plugins/plugin-management-page.tsx:427`（`searchPlaceholder="搜索插件或分配对象"`）。
- **影响**：**对管理员**——从后台看到"已退休"，到客户端看到"已下架"，同一个东西两个名字；"分配"与"可见范围"在同一个对话框里并存会让人以为是两件事（一个是"分配规则"，一个是"谁能看到"），实际上服务端只有一个 `subjectType` 维度。**对员工**——员工侧目前是对的，但后台管理员与员工沟通时会用不同词，违反"一处一致"。
- **建议改法**：① 后台 8 处 `退休`/`已退休` 全量改「下架」/「已下架」（含对话框标题、正文、按钮、`aria-label`、状态标签、筛选选项、以及三个 `console/src/features/*/CLAUDE.md` 的描述）；② `plugin-editors.tsx:265/274/351` 与 `plugin-management-page.tsx:427` 的 `分配` 改「可见范围」（错误文案建议「每条可见范围必须选择已发布版本」「同一可见范围对象只能存在一条规则」「删除第 N 条可见范围」）。③ 建议顺手加一条机械门禁（像客户端 `tests/employee-copy.spec.ts` 那样）：在 `console/src` 里反向断言 `退休` 不出现。
- **人日**：0.5（改文案 + 同步 3 个 `*.test.ts` 的断言 + 1 条反向锁）。
- **风险**：**低**。唯一要注意的是 `RETIRED` 这个**枚举值**不动（只动中文 label），以及 `docs/notes/ux-debt-audit.md` 里已讨论过的"退休"历史口径不需要回改（它记的是当时状态）。
- **是否建议做**：**是**。

---

### P1（14 条：显著影响，值得排在下一个迭代）

#### C-P1-1 `errorMessage()` 在同包里被抄了 16 份（2 种行为、2 个名字）

- **现象**：同一个"从服务端错误信封里取出人话、否则回落 fallback"的函数，在 `console/src` 里存在 16 份定义，其中 15 份行为等价、**1 份行为不同且是错的**。
- **证据**：
  - `errorMessage()` ×11：`console/src/features/access/access-policy-page.tsx:59`、`console/src/features/activity/activity-page.tsx:45`、`console/src/features/activity/usage-analytics-panel.tsx:35`、`console/src/features/branding/branding-management-page.tsx:39`、`console/src/features/feedback/feedback-management-page.tsx:53`、`console/src/features/members/identity-source-management.tsx:34`、`console/src/features/members/member-management-page.tsx:156`、`console/src/features/models/model-catalog.tsx:84`、`console/src/features/plugins/plugin-management-page.tsx:57`、`console/src/features/presets/preset-management-page.tsx:55`、`console/src/features/skills/skill-management-page.tsx:44`。
  - `message()` ×4（同一函数换了个名字）：`console/src/features/members/access-group-management.tsx:33`、`console/src/features/members/ldap-group-mapping.tsx:35`、`console/src/features/members/ldap-member-import.tsx:26`、`console/src/features/models/model-set-management.tsx:35`。
  - 行为分型（对函数体做 md5 分组）：`8f00673d…`（三元式）×4、`d1f984ab…`（if/return 式）×7、`d92f0ed2…`（三元式、名为 `message`）×4 —— **这三组语义完全相同**；`console/src/components/product/DataTable.tsx:128` 的 `tableErrorMessage` 是第 4 种，且**漏掉 `error.error.message` 分支**（见 `C-P0-1`）。
- **影响**：**对管理员**——修一处 bug 要改 16 个地方；`tableErrorMessage` 这一份已经落后于其余 15 份并造成 `C-P0-1` 的可见缺陷。**对员工**——间接。
- **建议改法**：新建 `console/src/lib/errors.ts` 导出唯一 `errorMessage(error, fallback)`；16 处删除本地定义、改 import。同时把 `console/src/features/*/CLAUDE.md` 里"本文件自持 X 文案映射"式描述收口。
- **人日**：0.3。
- **风险**：**低**（纯搬运；`EnterpriseErrorResponse` 的 import 可随之从 11 个文件移除）。
- **是否建议做**：**是**（与 `C-P0-1` 同一刀）。

#### C-P1-2 `formatBytes()` 4 份重复，客户端还有第 5 份且**口径不同** ⇒ 同一个数字两端显示不一样

- **现象**：字节大小格式化在后台有 4 份、客户端有 1 份；后台与客户端在 <1024 B 与 KiB 进位上是两种算法。
- **证据**：
  - 后台 4 份：`console/src/features/feedback/feedback-editors.tsx:50-54`、`console/src/features/plugins/plugin-management-page.tsx:96-100`、`console/src/features/presets/preset-management-page.tsx:91-95`、`console/src/features/skills/skill-editors.tsx:44-48`（4 份逐字节等价：`<1024 ? 'N B' : <1MiB ? (n/1024).toFixed(1) KiB : (n/1024/1024).toFixed(1) MiB`）。
  - 客户端第 5 份（**唯一一份**，`plugin/packages/ui/src/display-format.ts:6` 的 `formatByteSize`；此处是被 `plugin-market.tsx` 旧代码路径引用的一份旧写法 `plugin/packages/ui/src/plugin-market.tsx:212`）：`const bytes = (value) => value < 1024*1024 ? \`${Math.ceil(value/1024)} KiB\` : \`${(value/1024/1024).toFixed(1)} MiB\`` —— **没有 B 档、KiB 用 `Math.ceil`**。
  - 差异实例：**100 字节** → 后台「100 B」，客户端「1 KiB」；**1500 字节** → 后台「1.5 KiB」，客户端「2 KiB」。同一个插件包在管理员列表与员工列表里大小不同。
- **影响**：**对管理员**——"员工说 2 KiB，我这边写 1.5 KiB"这类对不上号的沟通；**对员工**——两个界面报不同大小，削弱"一处一致"。
- **建议改法**：① 后台 4 份合并成 `console/src/lib/format.ts` 的 `formatBytes`；② 客户端把 `plugin-market.tsx` 里那份旧 `bytes` 改成复用已存在的唯一口径 `formatByteSize`（`plugin/packages/ui/src/display-format.ts`，`marketplace-entry.tsx` 已经在用它）；③ 用一条纯投影用例在两端各锁一组边界值（0/1023/1024/1500/1048575/1048576）。
  **注意**：`plugin-market.tsx` 正在被另一路修改，这条要**排在那一刀之后**做。
- **人日**：0.3（后台）+ 0.2（客户端，需等 in-flight 落地）。
- **风险**：**低**。会改到 `plugin-market` 既有断言（若 in-flight 未覆盖）。
- **是否建议做**：**是**（后台部分可立刻做）。

#### C-P1-3 `inputClass` 同一串 Tailwind 在 12 个文件里各写一遍

- **现象**：`h-9 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] text-ink outline-none …` 这一串被复制到 12 个功能文件里，其中还各自加了不同的后缀（`disabled:…`、`min-h-20 resize-y py-2 font-mono text-[12px]`…）。
- **证据**：`grep -rn "h-9 w-full rounded-lg border border-line bg-canvas px-3" console/src --include=*.tsx` 命中 12 个文件：`console/src/features/access/policy-editors.tsx`、`console/src/features/account-page.tsx`、`console/src/features/branding/branding-editors.tsx`、`console/src/features/branding/branding-management-page.tsx`、`console/src/features/member-select.tsx`、`console/src/features/members/access-group-management.tsx`、`console/src/features/members/identity-source-editor.tsx`、`console/src/features/models/model-editors.tsx`、`console/src/features/models/model-set-management.tsx`、`console/src/features/plugins/plugin-editors.tsx`、`console/src/features/presets/preset-editors.tsx`、`console/src/features/skills/skill-editors.tsx`。
- **影响**：**对管理员**——输入框的圆角/内边距/焦点环会在 12 份副本上各自漂移（例如 `console/src/features/member-select.tsx:14` 那份多了 `disabled:cursor-not-allowed disabled:opacity-60`，`plugin-editors.tsx:54` 那份没有 ⇒ 禁用态的视觉不一致）。
- **建议改法**：抽 `console/src/lib/styles.ts` 导出 `fieldClass`（含禁用态），12 处复用；差异后缀用 `cn(fieldClass, '…')` 表达。
- **人日**：0.3。
- **风险**：**低**。
- **是否建议做**：**是**（顺手做，不单独立项）。

#### C-P1-4 后台侧栏当前项**没有 `aria-current`**，读屏不知道"你在哪一页"

- **现象**：全 `console/src` 里 `aria-current` 出现 **0 次**；当前导航项只靠 CSS 类高亮。
- **证据**：
  - `grep -rn "aria-current" console/src` → 无输出。
  - 当前项的判定与渲染：`console/src/app/console-shell.tsx:135` `activeNav={activeRoute}` → `console/src/components/primitives/SidebarNav.tsx:300-306` `active={currentNav === item.key}` → `console/src/components/primitives/SidebarNav.tsx:159-190` 的 `RailButton`：`active` 只用于 `${active ? "bg-hover-2 …" : ""}`（`:176`）与字色（`:180`、`:183`），**没有 `aria-current`**。
  - 对照：客户端 `plugin/packages/ui/src/library-entry.tsx:29` 的注释明确说"当前项高亮 `aria-current=page` **全归官方侧栏那一行**"（即官方侧的座位替客户端承担了这件事）；后台的侧栏是自有的 `SidebarNav`，没有人为它承担。
- **影响**：**对管理员**——读屏用户浏览四个导航分组时听到一串平铺按钮，无法知道当前在哪一页；键盘用户只能靠肉眼找高亮底色。
- **建议改法**：`SidebarNav.tsx:159-190` 的 `RailButton` 在 `active` 时加 `aria-current="page"`（该组件的页签条已经在用 `aria-pressed`，口径一致）；`SidebarNav.test.tsx` 补一条断言。
- **人日**：0.2。
- **风险**：**低**（`SidebarNav.test.tsx` 有 10 条用例，需同步）。
- **是否建议做**：**是**。

#### C-P1-5 `MemberSelect` 的失败只写进一个 `<option>` 文案里：无重试、服务端原因被丢、控件同时被禁用

- **现象**：成员目录加载失败时，下拉框变成"只有一个选项写着『成员加载失败』的禁用 select"，没有任何重试入口，且 `loadMemberPage` 已经取到的服务端 message 被丢弃。
- **证据**：
  - `console/src/features/member-select.tsx:18-24` `loadMemberPage` 在失败时 `throw new Error(error?.error.message ?? '成员目录加载失败')`（**取到了**人话）。
  - 同文件 `:49-60` `MemberSelect`：`disabled={disabled || members.isLoading || members.isError}`；失败时选项文案 `:60` `{members.isLoading ? '正在加载成员' : members.isError ? '成员加载失败' : '选择成员'}` —— **`loadMemberPage` 取到的那句 message 从未被读出**；没有 `role="alert"`、没有重试按钮、没有下一步动作。
- **影响**：**对管理员**——"配置可见范围"对话框里，成员下拉永远是"成员加载失败"且不可点，用户不知道是权限问题、网络问题还是服务端问题，也没有"再试一次"。
- **建议改法**：失败的 `message` 取出来渲染在 select 上方（`role="alert"`），并给一枚「重试」= `members.refetch()`；select 保持禁用但要有可见原因与出路。
- **人日**：0.3。
- **风险**：**低**。
- **是否建议做**：**是**。

#### C-P1-6 Vite 会把 `console/public/CLAUDE.md` 原样复制进构建产物 —— 部署后 `/CLAUDE.md` 可匿名下载

- **现象**：仓库内部的文档文件放在了 Vite 的 `public/` 目录里，因而被原样复制到 `console/dist/`，而 nginx 的 SPA 兜底规则会优先命中真实文件。
- **证据**：
  - 源文件被 git 跟踪：`git ls-files console/public/CLAUDE.md` → `console/public/CLAUDE.md`。
  - 已被复制进产物：`console/dist/CLAUDE.md` 存在，且与 `console/public/CLAUDE.md` **`diff` 结果为空（逐字节相同）**——包括它那行写错的标题 `# public/`（文件实际在 `dist/` 根）。
  - 会被直接服务：`deploy/nginx/nginx.conf:98-100` `location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; }` —— `/CLAUDE.md` 是一个真实存在的文件 ⇒ `try_files $uri` 命中 ⇒ 按静态文件返回（不是落到 `index.html`）。
  - 该文件内容包含内部成员清单（`console/public/CLAUDE.md` 逐条描述 10 个资源，其中 8 个是"历史保留稿"）。
  - 旁证：`console/dist/` 已在 `.gitignore:29` 里，`git ls-files` 确认 `console/dist/CLAUDE.md` **未被跟踪**（所以这不是提交物，而是构建/复制产物）。
- **影响**：**对管理员/企业**——部署后的控制台对外暴露一份内部文档；同类问题还会随 `public/` 里任何新增的非静态资源文件复发。
- **建议改法**：把 `console/public/CLAUDE.md` 移到 `console/`（与它的父级 `CLAUDE.md` 同级，目录地图本来就应该在那里），并在 `console/public/CLAUDE.md` 的位置放一份最小占位或直接删除；`public/` 只留真正的静态资源。可选加一条构建后断言：`dist/` 里不得出现 `.md`。
- **人日**：0.1。
- **风险**：**低**（`console/CLAUDE.md` 的成员清单已含"public/ 局部地图见 public/CLAUDE.md"这句引用，需要同步改路径）。
- **是否建议做**：**是**。

#### U-P1-7 客户端 `CLAUDE.md` 声称存在 `tests/session-view.spec.ts`，该文件**从未存在**；而 `src/session-view.tsx` 真的零测试

- **现象**：文档里有一条完整的成员条目描述这个测试文件守住了什么，但仓库里没有这个文件、git 历史里也没有过；同时它声称守住的那个视图（会话同步）在 31 个 spec 里**没有任何一条测试**。
- **证据**：
  - 文档条目：`plugin/packages/ui/CLAUDE.md:78` `tests/session-view.spec.ts: 锁定十一种同步状态文案、删除不重传与分叉停止语义。`
  - 文件不存在：`ls plugin/packages/ui/tests/` 无 `session-view.spec.ts`；`git ls-files plugin/packages/ui/tests/ | grep session` 为空；`git log --oneline -- plugin/packages/ui/tests/session-view.spec.ts` 为空（**从未被提交过**）。
  - 双向差集（对 `git show HEAD:plugin/packages/ui/CLAUDE.md` 与 `git ls-tree HEAD plugin/packages/ui/tests/` 做的，排除并行改动影响）确认：**GHOST = `session-view.spec.ts`**。
  - 零覆盖：`grep -rlE "十一种|同步状态|sessionSync|restoreSession" plugin/packages/ui/tests/` **无任何命中**；`grep -rn "session-view" plugin/packages/ui/tests/` 无命中；该组件确实在生产路径上（`plugin/packages/ui/src/account-view.tsx:68` `import { EnterpriseSessionSyncView } from './session-view.js'`、`plugin/packages/ui/src/client.tsx:63` `export * from './session-view.js'`），源码 88 行，内含三种同步状态分支、目录确认对话框与恢复结果呈现（`plugin/packages/ui/src/session-view.tsx:39/42` 的加载态、`:53` 的 `aria-label="会话同步"`、`:76` 的本地工作目录输入）。
- **影响**：**对员工**——会话同步的恢复/删除行为没有回归网，改动靠肉眼；**对维护者**——文档声称的守卫不存在，会让人误以为有覆盖。
- **建议改法**：① **立刻**把 `plugin/packages/ui/CLAUDE.md:78` 那一条删掉或改成"（待补）"（0.1 人日）；② 补 `tests/session-view.spec.ts`：锁三种同步状态的文案、`aria-label`、恢复流程要填绝对路径、删除不重传、恢复结果回执（1–1.5 人日，§6 排期）。
- **人日**：0.1（删幽灵条目）+ 1–1.5（补测试，可另排）。
- **风险**：**低**（删条目零风险）；补测试需要构造 store 快照 double，参考既有 `tests/account-store.spec.ts` 的手法。
- **是否建议做**：**是**（删条目必须先做；补测试建议做）。

#### C-P1-8 `loadMembers()` 把**整个成员目录**按游标顺序翻完：7 个消费点各自触发，5000 人 = 25 次串行请求

- **现象**：任何一个用成员下拉的表单，都会串行把企业全部成员拉完再渲染下拉。
- **证据**：
  - `console/src/features/member-select.tsx:29-33` `loadMembers()`：`do { const page = await loadMemberPage(cursor); items.push(...page.items); cursor = page.page.hasMore ? … : undefined } while (cursor)` —— **顺序串行**、逐页追加。
  - 页大小 `:19` `listMembers({ query: { limit: 200, … } })`；服务端上限 `server/owndsh-modules/owndsh-enterprise/src/main/java/com/owndsh/enterprise/common/api/EnterpriseApiValidation.java:26-31` `if (limit < 1 || limit > 200) throw …` ⇒ 200 是允许的最大页，无法再放大。
  - 消费点 7 处：`console/src/features/access/policy-editors.tsx:22`、`console/src/features/activity/usage-analytics-panel.tsx:21`（`<MemberSelect>`）、`console/src/features/plugins/plugin-editors.tsx:20`、`console/src/features/presets/preset-editors.tsx:18`、`console/src/features/skills/skill-editors.tsx:22`（`<MemberSelect>`），`console/src/features/feedback/feedback-management-page.tsx:171`、`console/src/features/members/access-group-management.tsx:63`、`console/src/features/plugins/plugin-management-page.tsx:308`、`console/src/features/presets/preset-management-page.tsx:215`、`console/src/features/skills/skill-management-page.tsx:228`（`useMembers(...)`）。
  - 缓存 60 秒：`:39` `staleTime: 60_000` ⇒ 超过一分钟后再次打开表单会**整套重拉**。
- **影响**：**对管理员**——成员规模上千后，"配置可见范围"对话框要等好几秒（且下拉里铺几千个 `<option>`）；弱网/移动端上体感更差。
- **建议改法**（不必一次做完）：① 短期——把 `MemberSelect` 换成"按关键字搜索 + 分页取前 N"（服务端已有 `cursor` 与 `limit`，另加一个搜索入口即可），或把 `limit: 200` 的**首屏**与"加载更多"分开，不阻塞对话框打开；② 中期——把成员目录做成带 `queryKey` 的**已加载缓存**（当前 `queryKey: ['members','directory']` 已经是共享 key，但 `staleTime` 60s 太短，可提到 10–30 分钟并加显式失效）；③ 长期——服务端提供"按关键字查成员"的轻接口（**必须等服务端先动**）。
- **人日**：1–1.5（①+②）。
- **风险**：**中**。会改到 5 个编辑器的表单行为与既有用例；`MemberSelect` 的"不允许手填 ID"这条约束（`console/src/features/member-select.tsx:4` 的 `[POS]`）必须保持。
- **是否建议做**：**是**（②先做，成本最低）。

#### X-P1-9 8 张共约 5.4 MB 的品牌图**零引用**，但每次构建都进产物

- **现象**：`console/public/` 里 8 个 PNG（6 张背景 + 1 张动态稿 + 1 张基准稿）在任何源码/HTML 里都引用不到，但因为是 `public/` 资源会被原样复制到 `dist/`。
- **证据**：
  - 逐个资源做引用计数（`grep -rn "$f" console/src console/index.html`）：`beautiful-ui-logo.png` 1 次、`dshent-whale.png` 8 次、**其余 8 个全部为 0**：`owndsh-whale-bg-{aubergine,burgundy,forest,navy,royal,teal}.png`、`owndsh-whale-mono-m2-animated.png`、`owndsh-whale-mono-m2.png`。
  - 体积（`ls -la console/dist/`）：6 张背景各约 893–928 KB、动态稿 641 KB、基准稿 587 KB ⇒ **合计约 5.4 MB**；整个 `console/dist/` 8.7 MB ⇒ 它们占约 **62%**。
  - `console/public/CLAUDE.md` 自己把这 8 张描述为"历史…基准稿/背景版本"（即已知的留档）。
- **影响**：**对管理员/企业**——每次部署多传 5.4 MB、静态站点多占 5.4 MB 磁盘与带宽；容器镜像/静态包体积无谓膨胀。**对员工**——无直接影响。
- **建议改法**：把 8 张图移出 `public/`（放到仓库内的 `docs/assets/` 或 `console/design/` 之类**不参与构建**的目录，作为设计留档），`public/` 只留 `dshent-whale.png` 与 `beautiful-ui-logo.png`；同步改 `console/public/CLAUDE.md` 的成员清单。
- **人日**：0.2。
- **风险**：**低**。唯一风险是某人的本地流程依赖这些路径（`grep` 已证明产品代码不依赖）。
- **是否建议做**：**是**。

#### C-P1-10 后台 4 个组件文件（约 150 行）**从未被任何生产代码 import**

- **现象**：`components/atoms` 下 4 个组件在整个仓库里没有任何 import 语句（含测试）。
- **证据**（`grep -rn "\bNAME\b" console/src --include=*.ts --include=*.tsx`，排除自身文件后计数）：
  - `console/src/components/atoms/ProgressRing.tsx` → **0 次**（连 `console/src/lib/meta.ts` 的注册表与 `component-examples-page.tsx` 的源码 glob 都不含它）。
  - `console/src/components/atoms/TextRow.tsx` → **0 次**。
  - `console/src/components/atoms/Chip.tsx` → **0 次 import**（仅在 `console/src/components/atoms/EntityChip.tsx:32`、`console/src/components/atoms/ValuePill.tsx:19` 的注释里被提到，以及若干 demo 数据里的 `"Mint Chip"` 字符串）。
  - `console/src/components/atoms/Switch.tsx` → **0 次 import**（`console/src/components/primitives/RecommendationCard.tsx:68/71` 命中的只是散文里的英文单词 "Switch"）。
- **影响**：**对管理员**——无直接可见影响；**对维护者**——4 个看起来是"产品原子"的文件其实只服务（或已不再服务）画廊，容易被误当作可复用基座去 import（`Switch` 尤其危险：它和一个真实的"插件开关"概念同名）。
- **建议改法**：确认它们不再需要后删除（连同 `console/src/components/atoms/CLAUDE.md` 的对应条目）；若判断为"画廊留档"，则移到被 `examples/` 独占的目录并加一行注释说明"不属产品面"。**必须与 `X-P0-4` 的第 ③ 档一起决定**（若把画廊整体拆出去，这 4 个文件自然迁移）。
- **人日**：0.3。
- **风险**：**低**（删前用一次 `tsc --noEmit` 确认）。
- **是否建议做**：**是**（与 `X-P0-4` 合并处理）。

#### X-P1-11 客户端 4 个死导出 + 5 个"仅测试使用"的导出

- **现象**：`plugin/packages/ui/src` 里有 4 个导出符号在整个仓库（含测试）零引用，另有 5 个只有测试引用。
- **证据**（对 `src` 抽取全部导出符号后在**全仓**做词边界计数，排除自身声明行）：
  - **死导出（全仓 0 引用）**：`plugin/packages/ui/src/marketplace-entry.tsx:907` `enterpriseMarketComponents`（它只是 `ENTERPRISE_MARKET_COMPONENTS` 的一层 getter，测试直接用后者）；`plugin/packages/ui/src/preset-launch.ts:48` `EnterprisePresetWorkspacesSnapshot`；`plugin/packages/ui/src/preset-launch.ts:57` `EnterprisePresetSessionsSnapshot`；`plugin/packages/ui/src/skill-market.tsx:205` `EnterpriseSkillDetailState`（只是 `EnterpriseDetailState` 的别名再导出，判定真有唯一一份 `enterpriseDetailState`）。
  - **仅测试使用（生产 0 引用）**：`plugin/packages/ui/src/marketplace-entry.tsx:901` `enterpriseMarketEntrySummary`、`:904` `enterpriseMarketEntryPlan`、`:916` `enterpriseMarketComponentGate`、`plugin/packages/ui/src/usage-panel.tsx:158` `enterpriseUsageResetText`。
- **影响**：**对维护者**——这 9 个符号扩大了公开 API 面，且都是"看起来是给产品用的"，会让下一个改动者以为有别的消费者；`:907` 尤其会让人以为组件清单有第二份读取路径。
- **建议改法**：4 个死导出直接删；4 个仅测试使用的导出**要么删（同时把测试改成直连被代理的真源）、要么降级为非导出**——建议前三个纯投影（`:901/:904/:916`）保留导出但加一行注释说明"出口给用例取证用，产品面不消费"，因为删掉会让 `tests/marketplace-entry.spec.ts` 的全量断言失去可直调的纯函数。
- **人日**：0.3。
- **风险**：**低**（`plugin/packages/ui/src/marketplace-entry.tsx` 正在被并行改动 ⇒ 要排在那一刀之后）。
- **是否建议做**：**是**（先删 4 个死导出，风险最低）。

#### C-P1-12 `DataTable` 的「每页行数」下拉没有焦点环，与同一工具栏的其他控件不一致

- **现象**：同一个表格工具栏里，搜索框与状态筛选都有 `focus:ring-2 focus:ring-accent-tint`，只有「每页行数」的 `<select>` 没有。
- **证据**：`console/src/components/product/DataTable.tsx:214`（搜索框）与 `:225`（状态筛选）都带 `focus:border-accent focus:ring-2 focus:ring-accent-tint`；`:360-368` 的每页行数 `<select className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12px] text-ink-2 outline-none focus:border-accent">` **没有 ring**（而且 `outline-none` + 无 ring ⇒ 键盘聚焦时看不出焦点在哪）。
- **影响**：**对管理员**——键盘用户 Tab 到"每页行数"时看不到焦点落点。
- **建议改法**：给 `:366` 的 className 补 `focus:ring-2 focus:ring-accent-tint`。
- **人日**：0.1。
- **风险**：**低**。
- **是否建议做**：**是**（顺手做）。

#### U-P1-13 `account-store` 的订阅**没有 selector**：任一字段变化都会让 8 处消费者全量重渲染

- **现象**：所有消费者都订阅"整份快照"，而 store 每次变更都会换一个新对象 ⇒ 任何一个无关字段（如 `sessionLoading`、`pluginBusy`、`restoreResult`）都会让整棵企业 UI 重渲染。
- **证据**：
  - 快照是整对象替换：`plugin/packages/ui/src/account-store.ts:31-48`（`EnterpriseAccountSnapshot` 有 14 个字段）与 `:64` `readonly getSnapshot = (): EnterpriseAccountSnapshot => this.#snapshot`；每次 `#set({ ...this.#snapshot, <一个字段> })` 都产生新引用（例 `:78` `this.#set({ ...this.#snapshot, sessionLoading: true })`，`plugin/packages/ui/src/account-store.ts:76-83`）。
  - 订阅端一律无 selector，直接吃整快照：`plugin/packages/ui/src/account-state.ts:22`、`plugin/packages/ui/src/plugin-market.tsx:239`、`plugin/packages/ui/src/preset-market.tsx:98`、`plugin/packages/ui/src/session-view.tsx:24`、`plugin/packages/ui/src/skill-market.tsx:213`、`plugin/packages/ui/src/marketplace-entry.tsx:3741`/`:3795`（后两个订阅的是取数源，其 `getSnapshot` 由 `plugin/packages/ui/src/list-state.ts:50` 明确保证"引用恒稳定、变了才换对象"，所以**这两处没问题**）；`plugin/packages/ui/src/library-panel.tsx:220`（同样订阅取数源，也没问题）。受影响的整快照订阅点是前 5 处。
  - 举一个真实触发链：`console` 侧无关的 `refreshSessions()`（`plugin/packages/ui/src/account-store.ts:74-83`）会先 `set({sessionLoading:true})` 再 `set({sessionSync})` 再 `set({remoteSessions})` ⇒ 在这期间**插件市场、配方市场、技能市场、会话视图、账号区**都各自重渲染 3 次。
- **影响**：**对员工**——会话同步刷新/插件状态轮询期间，企业设置页里正在看的市场列表会反复重渲染（长列表 + 无虚拟化时肉眼可见卡顿）；**对管理员**——间接（员工报"卡"）。
- **建议改法**：给订阅加**选择器**：把 `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)` 换成 `useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()), () => selector(store.getSnapshot()))`，`selector` 用 `useCallback` 稳定，只取该组件真正要用的字段子集（例如 `plugin-market` 只取 `status/pluginsLoading/pluginStatus/pluginErrorCode/pluginBusy`）。或给 store 加 `subscribeWithSelector` 形状。
- **人日**：0.5–1（5 个订阅点 + 各自的用例；`list-state` 那三处不动）。
- **风险**：**中**。选择器返回新对象会触发 React 的 `useSyncExternalStore` 自激警告（`plugin/packages/ui/src/shortcuts-view.tsx:92` 已经踩过这个坑并写了注释），所以选择器必须返回**原语或引用稳定的子对象**，要么加浅比较。
- **是否建议做**：**是**（可以先只改最重的 `plugin-market.tsx` 与 `skill-market.tsx` 两处）。

#### U-P1-14 `plugin/packages/ui/CLAUDE.md` 已达 **141 KB**（单行最长 26,011 字符），且漏登记 2 个 spec

- **现象**：一个"成员清单"文档膨胀成了每次改动都往里追加的叙事长文；单行长度超过 2.6 万字符；同时有两个真实存在的 spec 不在清单里。
- **证据**：
  - 体积：`wc -lc` → **84 行 / 141,464 字节**；最长行 `awk '{print length": "NR}'` → 第 37 行 **26,011 字符**、第 71 行 11,367 字符。
  - 漏登记（对 `HEAD` 双向差集）：`plugin/packages/ui/tests/feedback-preview.spec.ts`（1 条用例）与 `plugin/packages/ui/tests/preset-decode.spec.ts`（19 条用例）**在 `CLAUDE.md` 里 0 命中**（`grep -c` 均为 0）。其中 `preset-decode.spec.ts` 是 19 条用例的一大块，只字未提。
  - 对照：`src/` 与其它 `tests/` 条目的覆盖是**完整**的（44/44 与其余 29 条），所以这是两处遗漏，不是整体失修。
- **影响**：**对维护者**——每次改动都要在这一行里再追加一段（本仓的 `[PROTOCOL]` 要求同步），单行 26 KB 让 diff/review 几乎不可读；遗漏的两个 spec 会让人低估配方解码与反馈附件预览的覆盖。
- **建议改法**：① 立刻补两行成员条目；② 把"逐刀叙事"从成员清单里剥离——`CLAUDE.md` 只保留"这个文件是什么、出口有哪些"，历史沿革移到独立的 `docs/notes/ui-slices-log.md`（或直接不进文档）；③ 给 `CLAUDE.md` 加一个软上限约定（例如单行 ≤ 500 字符、全文 ≤ 20 KB）。
- **人日**：0.5（补条目 0.1 + 拆分叙事 0.4）。
- **风险**：**低**（纯文档；同一文件正被并行改动 ⇒ 排在那一刀之后）。
- **是否建议做**：**是**（①必做，②建议做）。

---

### P2（6 条：打磨）

#### C-P2-1 `ProductUtilityItem` 死类型 + `decodeAdminSessionEvents` 仅测试使用

- **现象与证据**：`console/src/app/product-routes.ts:102` `export type ProductUtilityItem = (typeof PRODUCT_UTILITY_ROUTES)[number]` —— 全仓 0 引用（`ProductUtilityDefinition` 才是被使用的那个；两者只差一个有 `placement` 字段）。`console/src/features/activity/session-content.ts:46` `decodeAdminSessionEvents` 生产 0 引用、仅 `session-content.test.ts` 引用。
- **影响**：维护者面；`ProductUtilityItem` 与 `ProductUtilityDefinition` 长得极像，会误导。
- **建议**：删 `ProductUtilityItem`；`decodeAdminSessionEvents` 保留导出并注释"测试取证用"，或降级为内部函数。
- **人日**：0.1。**风险**：低。**建议做**：是。

#### C-P2-2 「新建授权 / 新建配额」在选项取数失败时被禁用，但按钮本身没有任何说明

- **现象与证据**：`console/src/features/access/access-policy-page.tsx:344-345` 算出 `optionsLoading` / `optionsError`；`:362` 与 `:379` 的 `toolbarAction` 用 `disabled={optionsLoading || optionsError !== null}`；原因是渲染在**表格之外的上方**（`:387` `{optionsError && canWrite ? <p role="alert">…</p> : null}`），按钮自身既没有 `title` 也没有 `aria-describedby`。管理员要往回读一整屏才能对上"为什么这个按钮是灰的"。
- **影响**：对管理员——死灰按钮无就近解释（比"只挂 title"好，但离"可见原因"还差一步）。
- **建议**：给这两枚按钮加 `title={optionsError ? '策略选项加载失败，请先重试' : undefined}` 与 `aria-describedby` 指向 `:387` 那条 `role="alert"` 的 id。
- **人日**：0.2。**风险**：低。**建议做**：是。

#### C-P2-3 表格加载中时页脚已经是「0 项」

- **现象与证据**：`console/src/components/product/DataTable.tsx:348` 页脚固定 `{filteredCount} 项{hasMore ? '，仍有更多' : ''}`，而 `filteredCount` 来自 `:181` `table.getPrePaginatedRowModel().rows.length` —— 首帧正在读取时它就是 `0`；表格体同时在 `:300-303` 说「正在读取」。同一个表格里两句话互相矛盾。
- **影响**：对管理员——"0 项"会让人以为"这家公司没有插件"，随后数字跳变（与 `ux-debt-audit.md` P0-4 记的"计数从 0 跳 N"是同一类现象，但那是**客户端页签计数**，这里是**后台表格页脚**，属新发现）。
- **建议**：`isLoading` 时页脚显示 `—` 或不显示数字（`{isLoading ? '—' : \`${filteredCount} 项\`}`）。
- **人日**：0.1。**风险**：低（`DataTable.test.tsx` 需同步）。**建议做**：是。

#### C-P2-4 `console/dist/CLAUDE.md` 是 `public/CLAUDE.md` 的字节复制且标题写错

- **现象与证据**：`diff console/public/CLAUDE.md console/dist/CLAUDE.md` 无输出（**逐字节相同**），两份文件第一行都是 `# public/`，但后者位于 `console/dist/`；`console/dist/` 已被 `.gitignore:29` 忽略（`git ls-files` 确认未跟踪）。
- **影响**：维护者面；这是 `C-P1-6` 的同一根因的产物侧表现（`public/` 被复制），修掉 `C-P1-6` 后它会随下一次构建消失。
- **建议**：与 `C-P1-6` 同批；不要单独"修" `dist/` 里的副本（那是构建产物）。
- **人日**：0（含在 `C-P1-6`）。**风险**：无。**建议做**：随 `C-P1-6`。

#### X-P2-5 `docs/notes/ux-debt-audit.md` 里的 CSS 长度/校验和数字已与当前基线不符

- **现象与证据**：该文档 `:432` 记「长度 8178→7975 / 校验和 2058624246→555768760」、`:485` 记「`style 7975 → 8462 chars`、校验和 `555768760 → 2395543646`」；而当前代码里的基线是 `plugin/packages/ui/tests/marketplace-entry.spec.ts:264-265` `LEGACY_STYLE_LENGTH = 10507` / `LEGACY_STYLE_CHECKSUM = 3008014743`（`plugin/packages/ui/CLAUDE.md:71` 也记了后来那次 `8462 → 10507` 的再基线化）。
- **影响**：维护者拿旧审计文档对当前代码会对不上（"文档说的 8462 是哪一版？"）。
- **建议**：**不要**去改那两个历史数字（它们是 append-only 的当时记录，改了反而破坏台账）。只在该文档相应小节加一个 `（as-of 6fc61f5：当前基线为 10507 / 3008014743）` 的标注。
- **人日**：0.1。**风险**：**无**——但按本次硬约束我**没有改**这份文档，只登记。
- **是否建议做**：是（低优先）。

#### U-P2-6 客户端 `marketplace-entry.spec.ts` 的**字节级** CSS 长度/FNV 校验和断言是最脆的一处

- **现象与证据**：`plugin/packages/ui/tests/marketplace-entry.spec.ts:264-265` 锁死 `LEGACY_STYLE_LENGTH = 10507` 与 `LEGACY_STYLE_CHECKSUM = 3008014743`，断言点 `:2038-2039`（`collectStyleText(skillsTree).length`、`styleChecksum(...)`）。历史上已因每次改样式"再基线化"至少 5 次（`plugin/packages/ui/CLAUDE.md:71` 记录了 `6880→7840→8178→7975→8462→10507` 的完整升级链）。
- **影响**：任何一行共用 CSS 的改动（哪怕只是加一个 `gap`）都会让用例变红并要求人工重算两个魔法数；它是"防上游视觉漂移"的**有意设计**，但代价是每次业务改动都要做一次无信息量的重算。
- **建议**：**不建议现在动**——见 §3 的【不要动】。若将来要降脆性，稳妥做法是保留长度断言的**区间**（`toBeGreaterThan/toBeLessThan`）或改成"关键规则原文逐条存在"的断言，且必须先有视觉回归兜底。**不要在没想清楚前顺手改。**
- **人日**：0（现在不动）。**风险**：改它 = 高（会丢掉对上游视觉漂移的唯一机械防线）。**建议做**：**否**（登记为已知脆弱点）。

---

## 3 明确【不要动】清单（看起来能"优化"但代价 > 收益）

> 逐条给理由。凡涉及契约、签名、关闭键集、快照断言、上游派生的东西，一律不做。

| # | 看起来可以"优化" | 为什么**不要**动 |
|---|---|---|
| N-1 | **删掉 `PluginCompatibility.operatingSystems` 字段/契约条目**（"反正不用了"） | ① 它在**签名清单**里，硬拆会触发验签失败（`docs/notes/direction-decisions.md` 第 10 条明确写了这一点）；② `contracts/plugin.yaml` 的 `PluginOperatingSystem` 与服务端校验（非空数组）都在用；③ `console/src/api/generated/*` 与 `plugin/packages/ui/src/local-api-decode.ts:717-720` 的解码门禁是按"三值枚举 + 键集封闭"设计的，删字段等于同时改三层。**口径是"降成仅展示"，不是"删掉数据"。** |
| N-2 | **删掉后台的 4 个"死"组件（`ProgressRing`/`TextRow`/`Chip`/`Switch`）而不先决定 `examples/` 的去留** | 它们目前是"画廊留档"的一部分（`console/src/lib/meta.ts` + `component-examples-page.tsx` 的 `?raw` glob 与 `INTERNAL` 注册表共同构成一套"可复制出仓"的上游参考）。先删组件、后又决定保留画廊，会破坏 `console/src/lib/meta.ts:19-26` 的 `INTERNAL` 引用（那里逐条列了 `EntityChip`/`ValuePill`/`Shimmer`/`StreamText` 的路径）。**先定 `X-P0-4` 的档位，再删。** |
| N-3 | **改 `plugin/packages/ui/tests/marketplace-entry.spec.ts` 的 CSS 长度/FNV 校验和断言**（"太脆了"） | 这是全包唯一一条**字节级防上游视觉漂移**的机械防线（`plugin/packages/ui/CLAUDE.md:71` 记录了 6 次有意的再基线化，每次都是"我知道我在改视觉"）。改宽成区间或删掉，等于把"样式被顺手改动"从红变绿，而本包装在官方 UI 上、没有视觉回归测试。**要降脆性必须先有截图/视觉回归兜底，不能反向先削弱断言。** |
| N-4 | **在客户端删掉"关闭键集"（`hasExactKeys`）的严格判定**（"太严了，Host 多给一个字段就整条失败"） | 这正是本会话踩到的"关闭键集契约漂移（服务端发字段/客户端不认）"的**正确应对**：严格拒收让漂移在测试里立刻可见，而不是静默忽略后在界面上少显示一个字段。`plugin/packages/ui/src/decode-primitives.ts` 的 `hasExactKeys` + `plugin/packages/ui/tests/preset-enable-decode.spec.ts` 的"每个键位都试一遍多一个/少一个"的用例是同一套设计。**放宽它 = 把契约漂移从红变绿。** |
| N-5 | **把 `plugin/packages/ui/tests/no-silent-swallow.spec.ts` 的"例外清单双向一致"改成单向** | 该用例要求"含 `catch` 的源文件必须与声明的例外清单逐文件双向一致"（新增一处 `catch` 先红）。改成单向（只查清单里的文件）会让新增的静默吞失败永远不被发现。这与 `ux-debt-audit.md` §8 的 P0-3 修复是同一个机制。 |
| N-6 | **把 `console/src/api/generated/**` 当"死代码"清理**（它体量最大：`types.gen.ts` 8,629 行、`index.ts` 的巨型 re-export） | 全部是 `@hey-api/openapi-ts` 生成物，`console/package.json:19` 的 `generate` 脚本每次 `predev`/`build` 都会重写。任何手工"瘦身"会在下一次构建被覆盖，且会让派生的类型与 server 契约失同步。**要瘦，改 `console/scripts/generate-openapi.mjs` 的过滤规则，不是改产物。** |
| N-7 | **合并 `console/src/components/{atoms,primitives}` 与产品组件，或"顺手删掉没人用的 primitives"** | 这 33 个组件是从**锁定的 Beautiful UI commit（3ea4c181）**派生的（`console/BEAUTIFUL_UI_LICENSE` 就是为它们准备的），`console/src/lib/meta.ts` 是它们的元数据真源，`component-examples-page.tsx` 是"可运行参考"的产品意图。按 `X-P1-10` 只处理**连画廊都不引用**的 4 个，其余保留。 |
| N-8 | **在 `plugin/packages/ui` 里删掉 `marketplace-entry.tsx` 的单行 4,340 行/巨型 [OUTPUT] 头，或拆分该文件** | 该文件正被并行改动（`git status` 显示 `M`），且它的"一份逻辑 + 两个外壳 + 一个详情子页面"结构被 `tests/marketplace-entry.spec.ts`（66 条）与 `tests/preset-market-tab.spec.ts`（27 条）以**源码级计数**锁着（`<EnterpriseMarketInlineRows ` 恰 3 处、`api.skills(` 恰 1 处、`enterpriseLocalErrorCode(error)` 恰 7 处、`controller.abort()` 恰 4 处、`className="own-market-rows"` 恰 5 处）。拆文件会同时打破几十条断言且与并行改动冲突。**要拆必须单开一刀，先补结构断言再搬。** |
| N-9 | **给后台的 87 处 `disabled=` 全部补 `title`**（机械扫地） | 大部分禁用是"提交中"（`disabled={saving}`）这类**自解释**状态；机械补 `title` 会造出一堆噪音提示，反而违反"零死按钮"的本意（死按钮的定义是**点了没反应且没说为什么**，不是"禁用"）。真正需要修的是**有分支语义**的那几处（已在 `C-P2-2`/`C-P1-5` 单列）。 |
| N-10 | **把后台 `--dsw-*` 计数从 0 改成与客户端一致（统一 token 家族）** | 后台是**独立 Vite SPA + 自有 token 家族**（`console/src/styles/beautiful-ui.css` 的 `--surface/--ink/--accent/…` 40+ 个），客户端跑在官方 Harness 里、只能用 `--dsw-*`。两套 token 是**两个运行时的客观差异**，不是纪律问题。`--dsw-* = 0` 正是后台该有的结果（本次已核实：`grep -rn -- "--dsw-" console/src console/index.html | wc -l` = 0）。 |

---

## 4 与既有债单的去重说明

**结论：本次新发现 25 条（P0 5 + P1 14 + P2 6），与 `ux-debt-audit.md` / `feedback-feature-spec.md` 无一条重复。**

已记在既有债单、本次**不重复记**的条目（逐条对照）：

| 既有编号 | 内容 | 出处 | 本次处置 |
|---|---|---|---|
| P0-1 | 失败只有一个 `ENT_*` 码，没有人话 | `ux-debt-audit.md` §3 / §7.1 | 已由 §7 的 `error-messages.ts` + `error-notice.tsx` 修复；不重记 |
| P0-2 | 未进映射表的码落到 503 | 同上 §3 / §7.2 | 属 `platform-client`，不在本次范围；不重记 |
| P0-3 / P0-4 | 列表取数失败被静默吞 / 无加载态、计数 0→N | 同上 §3 / §8.1 | 客户端已由 `list-state.ts` 四态修复；**后台表格页脚的"0 项"是另一处**，另立 `C-P2-3` |
| P0-5 | 文件树不可折叠 / 无虚拟化 / 大文件预览 | 同上 §3 / §8.2 | 未修；不重记 |
| P0-6 | 品牌首帧先出官方鱼标再切换 | 同上 §3 / §8.1-8.2 | 部分修复；不重记 |
| P0-7 | 必然失败的点击仍可点、仍给「重试」 | 同上 §3 / §8.2 | 未修；不重记 |
| P1-8 / P1-9 | 并发静默 no-op / 卸载无确认、不可取消 | 同上 §3 / §8.2 | 未修；不重记 |
| P1-10 / P1-11 | 搜索缺失 + 同一目录两套界面 / 「有更新」迟到与 N+1 | 同上 §3 / §8.2 | 未修；不重记 |
| P1-12 | 详情无焦点管理 + 硬件返回键不回列表 | 同上 §3 / §8.2-8.3 | **客户端市场详情页**的聚焦问题；`C-P0-3` 是**后台 `ProductDialog`**，不同组件、不同代码，属新发现 |
| P1-13 | 企业分发行缺「来源 / 许可 / sha256」 | 同上 §3 / §8.2 | 未修；不重记 |
| P2-14 ~ P2-18 | 硬编码颜色 / 搜索框只有 placeholder / 全局单类 `<style>` / 控制台上传无进度无预览 / 目录取数无超时 | 同上 §3 / §8.2 | 未修；不重记（`P2-17` 讲的是**上传进度与确认前预览**，与本审计的 `C-P0-2`（OS 决策面）无关） |
| §7.3 术语未采纳项 | `plugin`→「能力」、`preset`→「智能体」未采纳 | 同上 §7.3 | 不重开；`X-P0-5` 只针对宪法**强制表**里已有明确对应词的「退休→下架」「分配→可见范围」，不碰这两个未采纳项 |
| §8.4 用例数字 | ui 包 281→314 条 | 同上 §8.4 | 数字已过期（当前 416 条），归入 `X-P2-5` 的同类问题，不单列 |
| feedback 债务 1-7 | V34 未真实执行 / 跨语言 schema 分歧 / contracts CLAUDE.md 计数 / 附件 CAS / 管理端不能按 type 筛选 / 畸形 multipart 落 500 / 无 DOM 级集成测试 | `feedback-feature-spec.md` §7 | 均在后台/server 边界，本次范围外；不重记 |
| `plugin/packages/contracts/CLAUDE.md` 计数过期 | 45 fixture / 38 错误码 | 同上 §7 债务 3 | 不属本次两个子树；不重记 |

**本次新发现相对既有债单的"新面"**：既有债单几乎全部落在**客户端员工侧体验**与**服务端错误投影**；本次的 25 条里有 **16 条是后台 `console/**` 的内部质量**（重复实现、死组件、焦点、术语、产物体积、成员目录遍历、文档），这块此前从未被系统审计过（`ux-debt-audit.md` §1.1 只读了 console 的 6 个文件，且都已修完）。

---

## 5 不确定项（拿不准的，如实列出）

1. **in-flight 改动**：审计进行中 `git status` 从 4 条变成 5 条 —— `plugin/packages/ui/CLAUDE.md` 在两次 `git status` 之间被修改（`git diff --numstat` = `3 insertions / 2 deletions`，内容是新增 `src/plugin-install-gate.ts` 条目与重写 `src/marketplace-entry.tsx` 条目）。**我不对 `plugin-install-gate.ts` 的 OS 判定做任何评价**（它是否"用 `operatingSystems` 做拦截"取决于那一刀最终形态；`docs/notes/direction-decisions.md` 第 10 条要求"行为面任何地方不再因平台声明不含当前设备而拦"，我在工作区版本里读到了相反方向的实现意图，但既然文件正被改、口径也可能正在被修正，我把它列为不确定项而不是缺陷）。**同理**：`plugin/packages/ui/src/plugin-market.tsx` 与 `src/marketplace-entry.tsx` 的行号会随那一刀漂移，我在 `C-P1-2`/`X-P1-11` 里已标注"排在那一刀之后做"。
2. **`/examples` 是否真的对外暴露**：我证明了①路由不在 `_console` 守卫下、②`public/CLAUDE.md` 会被复制进 `dist/`、③nginx 的 `try_files $uri` 会优先命中真实文件。但**我没有实际发过一个匿名 HTTP 请求**（不部署、不重启）。若生产另有前置（例如外层还有一层 SSO/网关对所有路径鉴权），则 `X-P0-4` 的"匿名可访问"一档证据需要重估；**但"21 份源码原文进生产包 + 620 KB"这一半不受影响**。
3. **`MemberSelect` 的真实成员规模**：我按 `limit: 200` 与顺序翻页推算了"5000 人 ⇒ 25 次串行请求"，但本机没有企业成员数据，不知道典型企业的成员量级。若实际只有几百人，`C-P1-8` 的收益要下调（我已把它排 P1 而不是 P0）。
4. **`C-P0-3` 的"Esc 真的没反应"是从控制流推导的**：`onKeyDown` 挂在 `<section>` 上、而焦点不在 section 内时，React 的合成事件不会经过它 —— 这一点我有把握；但**浏览器是否会在某些情况下自动把焦点移入新出现的模态元素**（例如无障碍实现里的 `aria-modal` 处理）我没有实测。若某个浏览器会自动聚焦，则受影响范围会缩小到"Tab 逃逸 + 焦点不归还"。
5. **`console/dist/` 是否是真实交付物**：`console/dist/` 被 gitignore，我据此判断它是构建产物；但我没有读部署脚本确认前端产物是否**从这个目录**打包（`deploy/compose/Dockerfile.console` 在 `ux-debt-audit.md` 里被标为"另一路正在改"）。若部署时另做一次干净构建，`X-P1-9`（5.4 MB 图）与 `C-P1-6`（`/CLAUDE.md`）的影响依然成立，但"当前 dist 里的具体字节"只是旁证。
6. **`ProductUtilityItem` 是否被外部（仓库外）消费**：我只能证明**本仓** 0 引用。`console` 是独立 SPA、不对外发包，所以我按死代码处理；若有未入库的脚本引用它，删掉会破。同类不确定性适用于 `X-P1-11` 的 4 个客户端死导出（客户端包是私有的、只在企业仓库内消费，我按全仓扫描为准）。
7. **后台 `-index.test.tsx` 有 37 条用例、单个文件占了 console 测试的绝大多数**（45 条中的 37 条）。我没有逐条读完这个文件来确认它是否覆盖了本次提到的失败路径——**所以我不能断言"后台这些缺陷没有测试覆盖"**，只能说"我在测试目录里没有找到针对 `tableErrorMessage` / `ProductDialog` 焦点 / `aria-current` 的断言"。这条会直接影响 `C-P0-1`/`C-P0-3`/`C-P1-4` 的"人日"估算（若要新增用例，工作量在给出的区间上半段）。
8. **`console/public/CLAUDE.md` 是否有意发布**：该文件内容对终端用户无价值也无害（只是资源清单），所以"有意发布"也说不通；但我找不到任何注释说明它的意图，只能按"文档错放了位置"处理。

---

## 6 建议的执行顺序（按收益 / 风险 / 依赖排）

### 第 0 波（半天内，零依赖，立刻做）

| 顺序 | 条目 | 理由 |
|---|---|---|
| 0.1 | `C-P1-6` 把 `console/public/CLAUDE.md` 移出 `public/` | 0.1 人日、零风险，且它是"生产暴露"里最容易修的一条 |
| 0.2 | `C-P2-3` 表格页脚加载中显示 `—` | 0.1 人日，消除同一表格里"正在读取 / 0 项"的自相矛盾 |
| 0.3 | `C-P1-12` 每页行数补焦点环 | 0.1 人日 |
| 0.4 | `C-P2-1` 删 `ProductUtilityItem` | 0.1 人日 |
| 0.5 | `U-P1-7` ① 删掉 `plugin/packages/ui/CLAUDE.md:78` 的幽灵 `session-view.spec.ts` 条目 | 0.1 人日；**先删，别让假守卫继续误导** |

### 第 1 波（1–2 人日，仍需零外部依赖，但互相合并）

| 顺序 | 条目 | 依赖 |
|---|---|---|
| 1.1 | `C-P0-1` + `C-P1-1`（抽 `console/src/lib/errors.ts`，删 16 份重复，修 `tableErrorMessage`） | 一刀做完，`C-P0-1` 才有回归锁 |
| 1.2 | `C-P1-2` 后台 4 份 `formatBytes` 合并进 `console/src/lib/format.ts`；`C-P1-3` 抽 `fieldClass` | 与 1.1 共用新 `lib/` 文件，同一刀更省 |
| 1.3 | `C-P0-5` 术语：后台 8 处「退休」→「下架」、4 处「分配」→「可见范围」+ 1 条反向锁 | 与 1.2 不冲突 |
| 1.4 | `C-P1-4` 侧栏补 `aria-current` | 独立 |
| 1.5 | `C-P1-5` + `C-P2-2`（两处"禁用但没就近说原因"） | 独立 |

### 第 2 波（3–5 人日，**方向确认后**才能动）

| 顺序 | 条目 | 必须先有 |
|---|---|---|
| 2.1 | `C-P0-2` OS 降级为"仅展示" | **产品口径确认**：管理员侧是否也要撤平台词（我按"改成信息性登记 + 去掉无用必填"提，最小改动）。**不碰契约。** |
| 2.2 | `C-P0-3` `ProductDialog` 焦点管理 | 无外部依赖；但会改到 10 个编辑器的用例，建议单独一刀、先补焦点用例 |
| 2.3 | `X-P0-4` ① 给 `/examples` 加登录守卫 ② 源码 glob 限 DEV | 无外部依赖，可先做①②；**③ 拆构建入口建议延后**（与 `C-P1-10` 同批） |
| 2.4 | `X-P1-9` 8 张 5.4 MB 图移出 `public/` | 无依赖 |
| 2.5 | `C-P1-8` ② 提高 `useMembers` 的 `staleTime` | 低风险的一半先做；①（改下拉为搜索）与③（服务端轻接口）在第 3 波 |

### 第 3 波（需要并行改动落地 / 需要服务端或契约先动）

| 顺序 | 条目 | 阻塞在哪 |
|---|---|---|
| 3.1 | `U-P1-13` account-store 加 selector | 改到 `plugin-market.tsx` 的快照读取 ⇒ **等 in-flight 那一刀落地** |
| 3.2 | `C-P1-2`（客户端部分）`plugin-market.tsx:212` 的旧 `bytes` 改复用 `formatByteSize` | 同上 |
| 3.3 | `X-P1-11` 删 4 个客户端死导出 | 触及 `marketplace-entry.tsx` / `skill-market.tsx` ⇒ **等 in-flight 落地** |
| 3.4 | `U-P1-7` ② 补 `tests/session-view.spec.ts` | 无外部依赖，但要新造 store 快照 double，单独一刀 |
| 3.5 | `U-P1-14` ② 把 `ui/CLAUDE.md` 的逐刀叙事剥离（141 KB → 目标 ≤20 KB） | 该文件正被并行改动 ⇒ 等落地 |
| 3.6 | `C-P1-8` ①（成员下拉改搜索式）+ ③（服务端按关键字查成员） | ③ **必须等服务端先动**：`listMembers` 目前只有 cursor + limit（`server/.../EnterpriseApiValidation.java:26-31`），没有关键字参数 |
| 3.7 | `X-P2-5` 给 `ux-debt-audit.md` 加 as-of 标注 | 纯文档，低优先；本次未改 |

### 明确不进队列

- §3 的 10 条【不要动】。
- `ux-debt-audit.md` 里已记且已明确"本轮不动"的 P0-5 / P0-6 / P0-7 / P1-8 ~ P1-13 / P2-14 ~ P2-18（不在本审计的处置范围，交叉引用即可）。

### 总计

| 波次 | 条目数 | 人日（区间） |
|---|---|---|
| 第 0 波 | 5 | 0.5 |
| 第 1 波 | 6（含合并） | 1.5–2 |
| 第 2 波 | 5 | 4.8–6.9 |
| 第 3 波 | 7 | 4.4–7.4（其中 3.6③ 含服务端另计） |
| **合计** | **25** | **11.2–16.8 人日** |

> 其中**建议先做**（第 0 + 第 1 波，共 11 条）合计 **2.0–2.5 人日**，且全部零外部依赖、零契约风险 —— 这半天到一天的投入能消掉后台 16 份重复实现、4 个零引用组件之外的绝大部分"同一件事被抄很多遍"、以及那条最刺眼的"失败永远只说一句话"。

---

## 附：本次核实过的两条"看起来像缺陷、其实不是"

| 事项 | 核实结论 |
|---|---|
| `@fontsource-variable/inter` / `@fontsource-variable/jetbrains-mono` 在 `console/src` 里 `grep` 不到 import，疑似死依赖 | **不是**。它们在 `console/src/main.tsx:12-13` 被 import，`console/src/styles/global.css:9-10` 引用 `"Inter Variable"` / `"JetBrains Mono Variable"` 两个字体族名。 |
| `plugin/packages/ui/CLAUDE.md` 的 `aria-current=page` 描述看起来像"文档写了但代码没写" | **不是**。`plugin/packages/ui/src/library-entry.tsx:29` 明确说明键盘可达与 `aria-current=page` **全归官方侧栏那一行**（客户端只提供座位身份，不自己画按钮），该文件也确实没有 `<button>`/`tabIndex`/`onKeyDown`（由 `tests/library-entry.spec.ts` 反向锁）。所以客户端缺 `aria-current` 是**官方承担**，后台的缺失（`C-P1-4`）才是真的缺口。 |
