/**
 * [INPUT]: 依赖 React 的 hook 原语、`esc-api` 的取数面、`esc-constants` 的分类根映射、`esc-list` 的纯投影 `escCategoryChildrenOf`、`esc-types` 的类型
 * [OUTPUT]: 对外提供 `useEnterpriseEscCategories(resourceType, source, api)` → `{categories, unavailable}`，与清缓存口 `clearEnterpriseEscCategoryCache()`
 * [POS]: esc 页面的**二级分类字典**，逐字移植自 NUWAX `ResourceAggregation/hooks/useResourceCategories.ts`。
 *   ★改动两处注入点（与数据层同款）：`@/services/*` → `EnterpriseEscApi`；umi 的 `useRequest` → 本文件自己的
 *   `useEffect` + 模块级缓存（原代码用 `cacheKey: esc-categories-${resourceType}-${sourceKind}` 做去重，
 *   这里用同一把键做同一件事——键的归一化口径是原文件自己定的：**已连接的/我启用的与系统广场共用内容分类**）。
 *   ★**新增一处如实缺口**：原文件 `onError: () => handleSuccess([])` 是静默降级（分类没了但页面不说），
 *   这里改成"仍降级为仅「全部」、但把 `unavailable` 置真"，由页面在筛选行上说一句。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useMemo, useState } from 'react'
import type { EnterpriseEscApi } from './esc-api.js'
import { ESC_RESOURCE_TYPE_TO_CATEGORY_TYPE } from './esc-constants.js'
import { escCategoryChildrenOf } from './esc-list.js'
import { ENTERPRISE_ESC_COPY } from './esc-copy.js'
import type { EscCategoryNode, ResourceCategoryInfo, ResourceSourceEnum, ResourceTypeEnum } from './esc-types.js'

/** 首位固定的「全部」分类（与原文件同一个字面量）。 */
const ALL_TAB: ResourceCategoryInfo = { key: '', label: ENTERPRISE_ESC_COPY.tabAll }

/**
 * 分类字典缓存：键 = `esc-categories-${resourceType}-${system|team}`（与原文件的 `cacheKey` 同键）。
 *
 * 缓存的**值**是承诺，故并发挂载同一个键只会打一趟平台（原代码靠 umi 的同名 cacheKey 达到同一效果）。
 */
const categoryCache = new Map<string, Promise<readonly { readonly key: string; readonly label: string }[]>>()

/** 清空分类缓存（测试与"换账号后重看"用；页面正常不需要调）。 */
export function clearEnterpriseEscCategoryCache(): void {
  categoryCache.clear()
}

/** 分类字典 key 的归一化：已连接的/我启用的与系统广场共用内容分类（原文件口径）。 */
function cacheKeyOf(resourceType: ResourceTypeEnum, source: ResourceSourceEnum): string {
  return `esc-categories-${resourceType}-${source === 'team' ? 'team' : 'system'}`
}

/**
 * 读二级分类字典。
 *
 * @param resourceType - 专家/技能/连接器（决定按哪个根节点取 children）。
 * @param source - 数据源（`team` 走空间列表，其余走广场分类树）。
 * @param api - 取数面。
 * @returns `categories`（首位恒为「全部」）与 `unavailable`（读失败且已降级为仅「全部」）。
 */
export function useEnterpriseEscCategories(
  resourceType: ResourceTypeEnum,
  source: ResourceSourceEnum,
  api: EnterpriseEscApi,
): { readonly categories: readonly ResourceCategoryInfo[]; readonly unavailable: boolean } {
  const [items, setItems] = useState<readonly { readonly key: string; readonly label: string }[]>([])
  const [unavailable, setUnavailable] = useState<boolean>(false)

  const key = useMemo(() => cacheKeyOf(resourceType, source), [resourceType, source])

  useEffect(() => {
    let active = true
    setUnavailable(false)
    const rootType =
      source === 'team'
        ? undefined
        : resourceType === 'connector'
          ? undefined
          : ESC_RESOURCE_TYPE_TO_CATEGORY_TYPE[resourceType]
    const load = async (): Promise<readonly { readonly key: string; readonly label: string }[]> => {
      if (source === 'team') {
        const res = await api.spaceList()
        if (res.code !== '0000') throw new Error(`space list failed: ${res.code}`)
        return (res.data ?? []).map(space => ({ key: String(space.id), label: space.name }))
      }
      const res = await api.publishedCategoryList()
      if (res.code !== '0000') throw new Error(`category list failed: ${res.code}`)
      // 连接器维度与新建/编辑连接器抽屉同源：按根节点 key=Connector 匹配（`rootType` 为 undefined 即此路）
      return escCategoryChildrenOf(res.data as readonly EscCategoryNode[], rootType)
    }
    let pending = categoryCache.get(key)
    if (pending === undefined) {
      pending = load()
      categoryCache.set(key, pending)
    }
    void pending
      .then(list => {
        if (!active) return
        setItems(list)
      })
      .catch(() => {
        // 缓存里留着这条失败的承诺会让后续挂载一直失败，故失败即从缓存里摘掉（下次重试真的重发）
        categoryCache.delete(key)
        if (!active) return
        setItems([])
        setUnavailable(true)
      })
    return () => {
      active = false
    }
  }, [api, key, resourceType, source])

  const categories = useMemo<readonly ResourceCategoryInfo[]>(
    () => [ALL_TAB, ...items],
    [items],
  )
  return { categories, unavailable }
}
