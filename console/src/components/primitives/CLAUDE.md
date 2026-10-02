# primitives/

> L2 | 父级: ../CLAUDE.md

成员清单

ApprovalCard.tsx: 人在回路审批卡，以单选/多选问题和提交状态组织确认流程。
ChatComposer.tsx: 带 tab、推理回复与输入区的紧凑聊天面板。
CodeBlock.tsx: 行号代码与统一 diff 展示组件。
ContextCards.tsx: 检索上下文卡片组，呈现来源和知识片段。
DiffTable.tsx: 表格式 AI 修改建议与应用状态组件。
FilterTable.tsx: 由状态筛选驱动重排的数据表。
FineTuneCard.tsx: 属性微调检查器，以 GlideMenu 组织可编辑选项。
Flowchart.tsx: 点阵画布上的触发器和条件流程图。
GlideMenu.tsx: 单一绝对定位高亮层，在菜单行之间平滑移动。
InsightCards.tsx: 可分页的洞察卡与实时图表展示。
LoadingState.tsx: Drive、Dots、Orbit、Surfer 四种加载状态。
PromptBar.tsx: 支持来源、命令、模型和发送动作的主输入条。
RecommendationCard.tsx: 带置信度、实体和操作的 Agent 推荐卡。
RecordsTable.tsx: CRM/表格工作区，提供排序、关系状态和 AI 列。
SearchList.tsx: 带实时过滤和空状态的命令搜索列表。
SelectionActions.tsx: 针对选中文本的重写与流式回填操作。
SidebarNav.tsx: Harness 工作区下拉、可选品牌图标、主导航（可选的 `navGroups` 分组：组名只作 `role="group"` 可访问性标注，组间用既有 `mx-2 my-1 h-px bg-line` 分割线，整组无可见项时连分割线一起消失；不传分组时按 `navItems` 扁平渲染并保持上游行为）、可选的 `utilityItems` 底部工具条（侧栏最底部一行纯图标，`title` + `aria-label`、原生 button 可聚焦、与主导航之间一条 `border-line` 分割线，展开态 `flex-row`、折叠态由 `group/sidebar` 上的 `data-sidebar-collapsed` 驱动转 `flex-col` 以留在同一 52px 图标轨）、历史搜索、折叠和可省略底部动作侧栏；产品与示例共享。
SidebarNav.test.tsx: 锁定分组顺序与组内顺序、分割线只在组之间出现（首尾不出现）、空组与全空导航不留孤立分割线、navItems 扁平向后兼容，以及底部纯图标工具条（三枚原生可聚焦 button、title 与 aria-label、不渲染文字、不进主导航与分割线、点击按 key 回调、折叠态转纵列）。
StreamingText.tsx: 带来源、动作和后续问题的流式回答展示。
TaskRows.tsx: Agent 任务执行、失败和完成状态行。
ThinkingState.tsx: Steps、Reasoning、Search、Coding 四类可展开思考轨迹。
ToolChips.tsx: 代码修改和工具调用的紧凑状态 chip。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
