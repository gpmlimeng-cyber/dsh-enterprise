# auth/

> L2 | 父级: ../../../../../../CLAUDE.md

成员清单

login.html: 公开认证页面骨架，以左上品牌与居中卡片互斥承载初始凭据与一次性 challenge，分离密码源 Tab 与 OIDC 入口，并预置 DSH Enterprise 静态回退品牌节点与版本徽标/欢迎语挂点。
login.css: 公开认证页对齐 Console Beautiful UI 与客户端登录弹窗的冷灰 token、单列居中卡片、8px 控件、11px 版本徽标 pill、欢迎语副题、身份源 Tab、首次改密提示、验证码稳定尺寸与焦点状态。
branding.js: 公开登录页唯一的品牌取数层，以 3 秒截止的同源只读 `/enterprise/api/v1/branding` 改写 `document.title`、品牌名、品牌图并按需显示 headline/版本标识；字段为空、超时、非 2xx 或图片加载失败时逐项回落静态品牌，只用 `textContent`/`src` 赋值且拒绝非相对路径地址。
login.js: 只在页面内存持有 transaction/CSRF/captcha/challenge，以默认密码源和可切换 Tab 驱动既有认证状态机，清空初始凭据、轮换弱密码 challenge 并导航精确回调；不参与品牌取数。
owndsh-whale-mono-m2-animated.png: 复用插件登录页的 512×512 循环 APNG，作为品牌接口不可用或未配置位图时的公开登录页回退标识。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
