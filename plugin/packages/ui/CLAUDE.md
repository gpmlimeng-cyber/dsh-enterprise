# ui/

> L2 | 父级: ../../CLAUDE.md

成员清单

README.md: 员工 Client 边界说明，记录官方 UI 零分叉、个人中心菜单与登录弹窗、整包卸载与 V1 Session 停用。
package.json: 私有双入口 package 清单，Host 空入口与 Client React 入口分离；官方 ui-primitives 只用于开发类型检查，发行时使用 Harness 共享实例。
tsconfig.json: React 18 Client TypeScript 构建边界，生成 ESM、声明和 sourcemap。
src/account-state.ts: 账号语义真源，提供共享脱敏订阅 `useAccount`、十一种连接状态与错误码文案映射、状态图标投影 `enterpriseStateIcon`（与状态文案同源，账号区与登录弹窗共用一份图形映射）、经形状校验的错误呈现 `enterpriseErrorDisplay`、会话可用/登录中/Server 可编辑判定和账号信息投影；不含网络与 Host Context，被账号设置、登录弹窗与侧栏入口共同消费。
src/account-store.ts: 官方 slot 共享的状态控制器，串行处理 Server、账号和插件动作并返回地址保存结果；服务/账号或连接边界变化时取消旧事实请求，防止迟到数据与错误跨会话回填；登录查询有截止时间；只读 `api` 端口让设置页复用同一同源网络实例。
src/account-menu.tsx: 官方 `settings.launcher` 个人中心座位上的唯一入口，照官方占用者语义：`enterpriseMenuEntryPath` 在任何登录态（含未配置与六个未登录终态）都返回菜单，未登录不再直开登录弹窗，弹窗只由菜单行项打开；菜单头部按登录态显示昵称加登录名/部门或「未登录」加状态引导语（登录中同样按账号信息呈现），`enterpriseMenuSections` 锁定分区顺序——账号动作（未登录首项「登录」/登录中「查看登录进度」）→ 外观选项组 → 设置（交还宿主 `openSettings()`）→ 确认退出，外观与设置与登录态无关始终在列；未登录触发按钮照官方 `t('more')` 显示「更多」与省略号图标，`aria-haspopup` 恒为 `menu`；纯状态机 `enterpriseMenuTransition`/`enterpriseMenuKeyEvent`/`applyEnterpriseMenuEffects` 锁定菜单开关、外部点击与 Esc/Tab 关闭并归还触发按钮焦点、与登录弹窗互斥；菜单卡片 270px/16px 圆角/宿主 menu token，不用 UI 库也不读官方 DOM。
src/theme-options.tsx: 菜单内的外观选项组，把官方 `ui-theme` 的 `getTheme()`/`setTheme()` 与 `theme/change` 事件包成只读源 `createEnterpriseThemeSource`（偏好读回、写入与订阅都直连官方运行时，服务缺席时整组禁用而非落本地状态）；`enterpriseThemeRow` 暴露「浅色/深色/跟随系统」三个官方偏好的选中态，分段样式照 jingyun 胶囊几何但颜色全取宿主 token。
src/account-origin.tsx: 账户设置里的账户后台地址编辑器，两个 origin 输入框回显 Host 默认值、保存中就地进行中、成功后按 `remounted` 提示「已生效/重启后生效」；`resolveAccountOrigin` 在浏览器侧按 Host 同款 loopback 白名单预校验并归一化，非法即就地拦截不发请求，地址不进任何浏览器存储。
src/account-view.tsx: 复用宿主 Button/tokens 呈现账号信息投影（登录名/部门/平台地址/设备/插件版本，字段缺失固定占位）、账户后台地址编辑器（store 忙时禁用）、明确的「登录」按钮（未登录与登录中打开同一弹窗）、插件/配方 tabs，并从 account-actions/brand 取共享登出确认与品牌位图；没有企业会话时只保留账号 tab，登录状态变化不再关闭设置页；已按产品决策删除全屏门禁，保留窄屏导航适配。
src/account-actions.tsx: 账号危险动作的共享确认，`LogoutConfirmation` 与 `UninstallAction`（quiet 档）由个人中心菜单、账号设置与登录弹窗三处共用，取消时不触发任何认证状态变更。
src/brand.ts: 唯一的品牌资源真源，提供静态 `DSHENT_ICON` 与动图 `DSHENT_ANIMATED_ICON` 数据 URI，被账号设置标题与登录弹窗品牌区共用，不含运行时逻辑。
src/login-page.tsx: 登录弹窗正文，照搬原全屏登录页的内容与信息架构（品牌动图、状态与说明、错误、Server 地址编辑器或登录/取消/登出动作、页脚 Server 与版本、刷新与卸载、重启提示），把两个原件规则固化为纯投影 `enterpriseLoginServerEditorVisible`/`enterpriseLoginPageAction`；自身不含遮罩、焦点陷阱或任何阻断宿主的效果。
src/confirm-action.tsx: 复用 Harness 共享 Modal/Button 的页面确认，封闭焦点并隔离外层 Escape，只有明确确认才调用业务动作，供账号与卸载入口共用。
src/plugin-market.tsx: DSH Enterprise 设置内的插件管理视图，分离目录和本机库存并承载显式安装/卸载；校验状态统一描述完整性与兼容性，适配可选验签；详情弹窗管理焦点并隔离外层 Settings 的 Escape。
src/preset-market.tsx: DSH Enterprise 设置内的企业配方广场，列表/详情并复制 Desktop 导入指令；一期不自动下载或 import，安全提示覆盖可执行配置风险。
src/assets.d.ts: 声明官方 ui-primitives 类型入口的 KaTeX CSS 副作用导入，保持依赖严格类型检查，不打入运行包。
src/client.tsx: Client 组合根，只通过 `settings.section` 与 `settings.launcher` 两个官方 slot 注册账号/插件设置与个人中心菜单，两个入口共享脱敏 store，个人中心座位另注入官方主题只读源（`ctx.get('theme')` 按需解析 + `ctx.inject(['theme'])` 等一次服务出现补发通知，不硬注入 ui-theme，服务缺席时账号入口照常可用）；已退场 `shell.overlay` 与 `sidebar.footer.action`，复用官方 remote 事件与连接恢复通知，不建立新连接。
src/index.ts: 无运行行为的 Host 占位入口，使官方 scanner 从 Loader row 发现 Client half。
src/login-dialog.tsx: 唯一登录弹窗的壳与入口语义，纯状态机锁定「初始关闭/触发打开/会话可用自动关闭」和「关闭即在登录中调用既有取消路径」，提交计划锁定「留空沿用已保存地址、地址变化先保存再登录、都没有则拒绝」；壳自持 440px 卡片尺寸与内容区滚动、地址字段状态、焦点封闭与归还（嵌套确认让位 `data-enterprise-confirmation`）、Esc/遮罩/取消三条关闭路径与页脚主按钮（正文已有登录入口时不重复），正文交给 login-page，不引入新 UI 库。
src/local-api.ts: 固定同源路径的严格 Server/账号/卸载/插件/Session DTO 与显式刷新解码，删除 SHA/hash/marker 并拒绝 Token、正文和执行细节；含 sessionSyncStatus/listSessions/restoreSession；`accountOrigin`/`setAccountOrigin` 只接受 HTTPS 或 loopback HTTP origin，非法地址与结构不符一律抛 `ENT_LOCAL_RESPONSE_INVALID`。
src/session-view.tsx: 会话同步 tab 的远端列表、恢复目录确认与新 ID 恢复结果呈现。
tests/account-menu.spec.ts: 锁定入口在任何登录态都返回菜单（未登录七态不再直开弹窗）、菜单分区顺序与项集合（未登录首项「登录」、外观与设置恒在列、已连接才有退出登录、登录中为「查看登录进度」且头部按账号信息呈现）、点「登录」先关菜单再开弹窗、菜单路径的切换与弹窗互斥、外部点击与 Esc/Tab 关闭并归还焦点、设置项触发宿主面板切换调用。
tests/theme-options.spec.ts: 锁定外观选项组正好覆盖官方 light/dark/system、选中态来自官方 `getTheme()` 回读且随 `theme/change` 更新、主题服务晚到 provide 后补发一次通知、点击经官方 `setTheme()` 写入并可回读、重复点击不重复写、主题服务缺席或取值非法时整组禁用且不落本地状态。
tests/account-store.spec.ts: 保存成败与动作串行、退出错误后的本地状态收敛、服务/账号切换的迟到数据与错误隔离，以及有界登录查询与 Session 零请求测试。
tests/account-gate.spec.ts: 锁定全屏门禁退场（slot 注册不含 `shell.overlay` 且改为 `settings.launcher`、断连态不再是阻断态）、未登录账号区的开弹窗入口、弹窗开/关与关即取消语义、登录成功自动关闭、提交计划与账号投影回落、含 `ENT_SETTINGS_UNAVAILABLE` 的错误码中文文案及无秘密字段。
tests/login-page.spec.ts: 锁定登录弹窗正文的原件规则（Server 编辑器只在未配置或显式修改时展开、登录/取消/登出动作覆盖全部连接状态）与共享状态图标随状态文案取色。
tests/account-view.spec.ts: 锁定会话可用判定、Server 编辑状态白名单、受管插件和重启/失败员工语义。
tests/client.spec.ts: Settings/个人中心两个官方 slot 的注册身份与共享注入测试，并断言外观选项组的官方主题源只挂在个人中心座位上、不再注册 `shell.overlay`、`sidebar.footer.action` 与额外市场入口。
tests/local-api.spec.ts: Server/账号/卸载/插件/Session DTO、固定路径、脱敏投影、显式刷新与秘密字段拒绝测试。
tests/session-view.spec.ts: 锁定十一种同步状态文案、删除不重传与分叉停止语义。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
