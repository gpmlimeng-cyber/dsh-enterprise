/**
 * [INPUT]: 只依赖可选的浏览器本机设置（`globalThis.localStorage`，经形状门禁可选取到）；不依赖 React、不发网络请求、不碰账号与令牌
 * [OUTPUT]: 资料库**管理开关**的唯一真源——非 React 薄外部 store `createEnterpriseLibraryGate`（`getSnapshot`/`subscribe`/`setEnabled`/`retry`）、持久化端口 `EnterpriseLibraryGateStorage` 与默认实现 `createEnterpriseLibraryLocalStorage`、快照类型 `EnterpriseLibraryGateSnapshot`（enabled／saving／persisted／errorCode）、默认值 `ENTERPRISE_LIBRARY_GATE_DEFAULT`（**关**）与三个存取口径 `enterpriseLibraryGateValue`／`enterpriseLibraryGateEnabled`／`ENTERPRISE_LIBRARY_GATE_STORAGE_KEY`
 * [POS]: ui 的「本地设置」层（资料库管理门）。开关是**本机**设置：只写本机，不上企业服务端、不进任何接口；写入**立刻生效**（快照先变、订阅者随即看到），写失败把稳定码留在快照里由界面显示并提供重试，绝不静默失败。侧栏一级入口与 main 面板两处座位的注册/注销都由这份快照驱动（见 library-entry.tsx），组件行那枚 Switch 也读它
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/** 本机设置里保存「资料库管理开关」的那一条键；值只有 `on` / `off` 两种。 */
export const ENTERPRISE_LIBRARY_GATE_STORAGE_KEY = 'dshent.library.enabled'

/** 保存值：开。 */
export const ENTERPRISE_LIBRARY_GATE_ON = 'on'

/** 保存值：关。 */
export const ENTERPRISE_LIBRARY_GATE_OFF = 'off'

/**
 * 产品默认：**关**（默认即最佳）。
 * 资料库这一刀还没有可接入的宿主面，默认开着只会给每位员工多一个进不去的入口；
 * 默认值本身必须可见——组件行的状态词就是「未开启」（见 `enterpriseMarketComponentState`）。
 */
export const ENTERPRISE_LIBRARY_GATE_DEFAULT = false

/**
 * 本机设置的读写端口（唯一依赖注入点）。
 * 读：没保存过返回 `undefined`；**读不到就抛**（由本源收成「读取失败」的稳定码，不是静默回落）。
 * 写：**写不进去就抛**（由本源收成「保存失败」的稳定码，界面据此显示并给重试）。
 */
export interface EnterpriseLibraryGateStorage {
  read(): string | undefined
  write(value: string): void
}

/** 布尔 → 本机设置里的保存值。 */
export function enterpriseLibraryGateValue(enabled: boolean): string {
  return enabled ? ENTERPRISE_LIBRARY_GATE_ON : ENTERPRISE_LIBRARY_GATE_OFF
}

/**
 * 保存值 → 布尔（唯一解析口径）。
 * 没保存过（`undefined`）与任何不认识的值（被别的程序写坏、旧版本写的别的形状）一律按默认**关**处理——
 * 门的默认方向必须是「不占用户界面」，而不是「猜一个开」。
 */
export function enterpriseLibraryGateEnabled(value: string | undefined): boolean {
  return value === ENTERPRISE_LIBRARY_GATE_ON
}

/**
 * 取本机设置区；取不到（Node、隐私模式、沙箱禁 storage）返回 `undefined`，
 * 由端口决定「抛还是不抛」——这一处只做一次形状探测，绝不把异常漏到界面。
 */
function localStorageArea(): Storage | undefined {
  try {
    const area = (globalThis as { localStorage?: Storage }).localStorage
    return area === undefined ? undefined : area
  } catch {
    // 某些环境里连**读** `localStorage` 属性都会抛（SecurityError）；这一处只用来判定「本机设置不可用」，
    // 抛出与否交给上面的端口口径（读/写端口会把它翻成显式失败码）。
    return undefined
  }
}

/**
 * 默认端口：浏览器本机设置（`localStorage`）里的那一条件。
 *
 * 本机设置不可用时**读与写都抛**——不是静默回落：一个拨了却永远不生效的开关就是死按钮，
 * 必须由组件行把「没有保存到本机」说出来（见 `EnterpriseErrorNotice` 的 `ENT_LIBRARY_SETTING_*`）。
 */
export function createEnterpriseLibraryLocalStorage(): EnterpriseLibraryGateStorage {
  return {
    read(): string | undefined {
      const area = localStorageArea()
      if (area === undefined) throw new Error('本机设置不可用')
      const value = area.getItem(ENTERPRISE_LIBRARY_GATE_STORAGE_KEY)
      return value === null ? undefined : value
    },
    write(value: string): void {
      const area = localStorageArea()
      if (area === undefined) throw new Error('本机设置不可用')
      area.setItem(ENTERPRISE_LIBRARY_GATE_STORAGE_KEY, value)
    },
  }
}

/**
 * 管理门在任何时刻的事实（引用稳定：变了才换对象，可直接喂 `useSyncExternalStore`）。
 *
 * `enabled` 是**已经生效**的值（拨动即变，侧栏入口随之出现/撤下）；
 * `persisted` 说它有没有真的落到本机设置里；`errorCode` 是读/写失败时的稳定码（由界面翻成人话）。
 */
export interface EnterpriseLibraryGateSnapshot {
  /** 当前生效的门状态（乐观：拨动后立刻是用户要的那个方向）。 */
  readonly enabled: boolean
  /** 正在写本机设置（官方 `Switch` 的口径：在途时应禁用，避免连点）。 */
  readonly saving: boolean
  /** 当前值是否已经保存到本机设置（写失败或从未保存过都是 false）。 */
  readonly persisted: boolean
  /** 读/写失败的稳定码；没有失败就没有这个键。 */
  readonly errorCode?: string | undefined
}

/** 资料库管理门：状态 + 写入 + 重试，全部只碰本机设置。 */
export interface EnterpriseLibraryGate {
  /** 当前快照；引用恒稳定，变了才换对象。 */
  getSnapshot(): EnterpriseLibraryGateSnapshot
  /** 订阅（返回注销）；每次快照变化都通知一次。 */
  subscribe(listener: () => void): () => void
  /** 拨动开关：**先立刻生效**，再写本机设置；写失败把稳定码摆进快照（不抛给界面）。 */
  setEnabled(next: boolean): void
  /** 重试：读失败就重读一次本机设置，写失败就重写当前值；都**真的**再发一次。 */
  retry(): void
}

/**
 * 建一份管理门。
 *
 * 三条硬口径：
 *  ① **默认关**：没有保存过、保存值不认识、读不出来，一律按关（门的方向是「不占用户界面」）；
 *  ② **立刻生效**：`setEnabled` 先在快照里改 `enabled` 并通知订阅者（侧栏入口随之出现/撤下），
 *     这一步与「有没有写成功」无关——写失败要能看见，但用户的这个动作本身不能被吞掉；
 *  ③ **失败可见可重试**：读/写失败各给一个稳定码留在快照里，`retry()` **真的**再读/再写一次。
 *
 * @param storage - 本机设置端口；默认走浏览器本机设置，测试可注入假实现。
 * @returns 管理门（非 React）。
 */
export function createEnterpriseLibraryGate(
  storage: EnterpriseLibraryGateStorage = createEnterpriseLibraryLocalStorage(),
): EnterpriseLibraryGate {
  let snapshot: EnterpriseLibraryGateSnapshot = {
    enabled: ENTERPRISE_LIBRARY_GATE_DEFAULT,
    persisted: false,
    saving: false,
  }
  const listeners = new Set<() => void>()

  // 逐个复制：订阅者在回调里注销自己也不影响本轮派发。
  const emit = (): void => {
    for (const listener of [...listeners]) listener()
  }

  /** 读一次本机设置：读到了就采用（含「没保存过」＝默认关）；读不到就留下读取失败码。 */
  const load = (): void => {
    try {
      const value = storage.read()
      const enabled = enterpriseLibraryGateEnabled(value)
      snapshot = {
        enabled,
        // 「已保存」＝本机存的就是当前这个值；没保存过、或存的是不认识的值（会被归一成默认关）都不算已保存。
        persisted: value === enterpriseLibraryGateValue(enabled),
        saving: false,
      }
    } catch {
      // 读不出来不是「用户没开」，而是「我们不知道」：按默认关处理，但**说出来**（组件行显示 + 可重试）。
      snapshot = {
        enabled: ENTERPRISE_LIBRARY_GATE_DEFAULT,
        persisted: false,
        saving: false,
        errorCode: 'ENT_LIBRARY_SETTING_READ_FAILED',
      }
    }
    emit()
  }

  /** 写一次本机设置：值已经在快照里生效了，这里只负责落盘与把失败摆出来。 */
  const persist = (): void => {
    const enabled = snapshot.enabled
    snapshot = { enabled, persisted: false, saving: true }
    emit()
    try {
      storage.write(enterpriseLibraryGateValue(enabled))
      snapshot = { enabled, persisted: true, saving: false }
    } catch {
      snapshot = { enabled, persisted: false, saving: false, errorCode: 'ENT_LIBRARY_SETTING_SAVE_FAILED' }
    }
    emit()
  }

  // 建源即读一次：默认关在源创建时就已经成立，不需要等界面挂载。
  load()

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setEnabled(next: boolean): void {
      // 值没变且确实已保存、也没有失败要清：这不是一次改动，什么都不用做。
      if (next === snapshot.enabled && snapshot.persisted && snapshot.errorCode === undefined) return
      // 先立刻生效（新的快照不带旧失败码——用户重新拨一次就是重试）。
      snapshot = { enabled: next, persisted: false, saving: false }
      emit()
      persist()
    },
    retry(): void {
      if (snapshot.errorCode === 'ENT_LIBRARY_SETTING_READ_FAILED') load()
      else persist()
    },
  }
}
