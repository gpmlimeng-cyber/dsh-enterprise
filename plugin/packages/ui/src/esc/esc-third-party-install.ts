/**
 * [INPUT]: 只依赖一个注入的 `run(target, signal)` 回调（真正发请求的那一步）与 `AbortSignal`；不依赖 React、不发请求、不认识任何路由
 * [OUTPUT]: 对外提供「本地三方 Agent 技能源」安装动作的**唯一一次一条执行器** `createEnterpriseThirdPartyInstaller`——`isBusy()` / `target()` 供渲染层投影（在途时其余按钮禁用并写明原因）、`run(target)` **拒绝**并发（第二枚在途请求被挡下，不静默排队、不静默丢弃）、`requests()` 供请求计数取证、`subscribe()` 供渲染订阅
 * [POS]: esc 技能页第三枚维度「本地三方」的**动作闸**（口径 62）。
 *   ★为什么它必须是一个独立对象而不是组件里的一个 `useState`：本仓的 vitest **没有 DOM**，
 *   「一次只允许一条在途、第二条被拒」这条纪律如果只活在 hook 里，就**没有任何机械判据**能证明它
 *   ——只能靠肉眼读代码。把它抽成不依赖渲染的对象之后，测试对同一个对象连调两次 `run()`，
 *   数的就是"真的发了几条请求"，与真机上连点两次是同一件事。
 *   ★与既有通路二（系统搜索的纳入）**同一条口径**（那边是 `onAdoptSystemSkill` 里一句
 *   `if (systemAdopt !== undefined) return`）：宿主侧的落盘是"读—改—写一份记录"，两条并发会互相覆盖。
 *   ★它**不**中止在途的那一条：安装是**写**动作（宿主可能已经把目录复制过去了），中止 fetch 并不会
 *   撤销它，只会让界面**不知道**结果 ⇒ 让它跑完（结算后照旧如实刷新，下次进来就看得到）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 一次在途安装的目标：`id` 是回传给宿主的那枚不透明值，`title` 是行上要念出来的技能名。 */
export interface EnterpriseThirdPartyInstallTarget {
  /** 上次扫描响应里那枚**原样回传**的候选标识（界面从不拼、从不改）。 */
  readonly id: string
  /** 行上可见的技能名（进行中那一句里念它，员工才知道"现在在装哪一枚"）。 */
  readonly title: string
}

/** 一次安装的结果：成功携自装记录（**只用来念一句结果**），失败携稳定码。 */
export type EnterpriseThirdPartyInstallSettlement =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string }

/** 入参：真正的发请求那一步与"异常 → 稳定码"的投影。 */
export interface EnterpriseThirdPartyInstallerOptions {
  /** 发请求；失败**原样抛出**（由本源收敛成 `ok:false` + 稳定码，而不是静默）。 */
  readonly run: (target: EnterpriseThirdPartyInstallTarget, signal: AbortSignal) => Promise<unknown>
  /** 异常 → 稳定错误码（默认交给调用方；本对象不 import 任何错误码表，保持零依赖可测）。 */
  readonly errorCode: (error: unknown) => string
  /** 结算后的通知（成功/失败各一条；在途态在 `finally` 里**先**清掉，故结算时 `isBusy()` 已是假）。 */
  readonly onSettled?: ((target: EnterpriseThirdPartyInstallTarget, settlement: EnterpriseThirdPartyInstallSettlement) => void) | undefined
}

/**
 * 一次一条的安装执行器。
 *
 * 三条硬口径（逐条都有 `tests/esc-third-party.spec.ts` 的机械复核）：
 *  ① **一次只允许一条在途**：`run()` 在途中被再次调用时**返回 `false`** 且**一条请求都不发**
 *     （不是排队、不是替换、不是静默丢弃——调用方据此走"这次没发"的如实路径）；
 *  ② **结算即解锁**（无论成败），且解锁发生在通知**之前**（通知里读到的已是"没有在途"）；
 *  ③ **在途不中止**（见文件头那段：中止写动作只会让界面不知道结果）。
 */
export interface EnterpriseThirdPartyInstaller {
  /** 现在有没有在途的一条（渲染层据此禁用**其余**按钮并写可见原因）。 */
  isBusy(): boolean
  /** 在途的那一条是谁（页面据此渲染"正在安装「X」…"那一句与那一行的按钮文案）。 */
  target(): EnterpriseThirdPartyInstallTarget | undefined
  /** 已发出的请求轮次（取证：被并发挡下的那一次**不许**让它 +1）。 */
  requests(): number
  /**
   * 发起一次安装。
   *
   * @returns `true` = 这一次真的发出去了；`false` = 被"一次一条"挡下（**没有**发请求）。
   */
  run(target: EnterpriseThirdPartyInstallTarget): boolean
  /** 订阅在途态变化（切面/卸载时退订；`run` 的同步段就会派发一次）。 */
  subscribe(listener: () => void): () => void
}

/**
 * 造一枚"一次一条"安装执行器。
 *
 * @param options - 发请求、异常→码、结算通知。
 * @returns 执行器（见 `EnterpriseThirdPartyInstaller` 的三条口径）。
 */
export function createEnterpriseThirdPartyInstaller(
  options: EnterpriseThirdPartyInstallerOptions,
): EnterpriseThirdPartyInstaller {
  let current: EnterpriseThirdPartyInstallTarget | undefined
  let attempts = 0
  const listeners = new Set<() => void>()

  const emit = (): void => {
    for (const listener of [...listeners]) listener()
  }

  return {
    isBusy: () => current !== undefined,
    target: () => current,
    requests: () => attempts,
    run: (target) => {
      // ★唯一的闸：在途即拒绝。这里**不**记 attempts（没发出去的请求不许被算成一次尝试），
      //   也**不**动 current（在途的那一条照旧是它，界面不会因为一次被挡下的点击而闪烁）。
      if (current !== undefined) return false
      current = target
      attempts += 1
      emit()
      // 这一次请求**不**持有 AbortController：它是写动作，中止不会撤销宿主那一侧的任何事
      // （见文件头那段）⇒ 拿一枚不会被 abort 的信号，语义上比"存一个没人会调的句柄"更诚实。
      const signal = new AbortController().signal
      void options.run(target, signal).then(
        () => options.onSettled?.(target, { ok: true }),
        (error: unknown) => options.onSettled?.(target, { ok: false, code: options.errorCode(error) }),
      ).finally(() => {
        /**
         * ★解锁发生在**结算通知之后**（`onSettled` 在上面那两个分支里已经调过了）：调用方在结算里
         *   要做的是"重新扫描 + 请计数重读"（不发第二次安装），它与这把锁无关；而"解锁"必须发生在
         *   这一次结算的可见反馈都铺完之后，否则界面会先闪回"没有在途"再显示失败行。
         *   两者都不影响"第二条在途被拒"这条判据：那一条只发生在**请求还没收束**的窗口里。
         */
        if (current === target) {
          current = undefined
          emit()
        }
      })
      return true
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
