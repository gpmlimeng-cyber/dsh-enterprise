# lib/

> L2 | 父级: ../CLAUDE.md

成员清单

crypto.ts: 以 HTTP/HTTPS 均可用的 getRandomValues 生成 UUID v4，供产品写操作统一生成幂等键。
crypto.test.ts: 固定随机字节验证 UUID v4 版本、变体位及编码，锁定无 randomUUID 的 HTTP 兼容性。
errors.ts: 从服务端错误信封（生成客户端抛的是纯对象而非 Error 实例）取出人话的唯一取文函数，后台全部失败文案的单一来源。
errors.test.ts: 锁定取文三级优先序——信封 message > Error 实例消息 > 调用方兜底。
format.ts: 后台唯一的字节大小格式化，B/KiB/MiB 三档一名小数。
format.test.ts: 用 0/1023/1024/1500/1048575/1048576 六个边界锁住后台字节口径。
meta.ts: Beautiful UI 组件目录、变体、内部依赖和 npm 依赖元数据（锁定上游参考留档）。
registry.tsx: 把组件元数据绑定到真实 React demo 的注册表；原先的消费者 `/examples` 画廊页已从生产构建移除，本文件不再有运行时入口。
styles.ts: 后台原生表单控件类名基线 fieldClass（含禁用态与统一焦点环），原先 14 份重复 Tailwind 的单一来源。
terminology.test.ts: 产品宪法术语降维表的机械反向锁，源码里不得再出现 RETIRED 的中文旧译。
utils.ts: 基于 clsx 与 tailwind-merge 的 className 合并函数。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
