/**
 * [INPUT]: 无外部依赖；名单与契约真源 contracts/plugin-core-packages.json（tests/fixtures 同源副本）逐字对齐
 * [OUTPUT]: 对外提供 ENTERPRISE_CORE_PACKAGES 保护名单与大小写不敏感的 isCorePackage 判定
 * [POS]: market 的信任锚第一道闸门，被 verify/assignments/installer 共用；名单漂移等同于安全缺口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 企业核心包保护名单。
 *
 * 语义（与企业契约的 description 一致）：这些包由「企业安装在层」拥有，随产品一同安装，
 * 通用插件分发绝不能上传、安装、覆盖或卸载它们。
 *
 * 组装规则：
 * 1. 前 6 项与 `contracts/plugin-core-packages.json` 的 `packages` **逐字一致且顺序一致**
 *    （服务端上传验包与客户端安装信任锚共用这份真源，任一侧漂移必须被测试拦下）；
 * 2. 第 7 项 `dshent-client-plugin` 是本插件自身：市场绝不能卸载或覆盖正在运行的插件代码，
 *    否则会出现「装完插件后企业入口本体消失」的不可恢复现场。
 *
 * 宿主客户端自己的包（第三方 DSH 客户端的发行版包名）不在此硬编码——本插件是通用客户端插件，
 * 不应耦合某个具体客户端的产品名。需要保护的宿主包由部署方经 `isCorePackage` 的第二参数注入。
 *
 * 注意：`@dshent/*` 六项在本插件里同样列入保护，虽然本包自身不安装它们——中心的
 * 误分配同样不得把服务端产品代码装进员工安装树。
 */
export const ENTERPRISE_CORE_PACKAGES: readonly string[] = [
  'dshent-plugin',
  '@dshent/contracts',
  '@dshent/llm-gateway',
  '@dshent/platform-client',
  '@dshent/plugin-distribution',
  '@dshent/ui',
  'dshent-client-plugin',
];

/**
 * 核心包判定。
 *
 * 比较前统一去空白并折叠大小写：npm 名为小写，但 pnpm spec、URL 片段与手工输入都可能带大写，
 * 逐字比较会留下 `@Dshent/Ui` 这类绕过路径。第二参数只用于测试与注入自定义名单，
 * 默认即企业真源名单。
 */
export function isCorePackage(
  name: string,
  packages: readonly string[] = ENTERPRISE_CORE_PACKAGES
): boolean {
  const target = name.trim().toLowerCase();
  if (target.length === 0) return false;
  return packages.some((entry) => entry.toLowerCase() === target);
}
