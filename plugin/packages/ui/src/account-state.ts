/**
 * [INPUT]: 依赖 React 的 useSyncExternalStore/createElement、Lucide 图标、local-api 的连接状态联合与 EnterpriseAccountStore 的脱敏 snapshot 类型
 * [OUTPUT]: 对外提供共享脱敏订阅 useAccount、状态文案、**委托给 error-messages 唯一映射**的错误码文案、状态图标投影 enterpriseStateIcon、经形状校验的错误呈现 enterpriseErrorDisplay、会话可用/登录中/Server 可编辑判定，以及账号信息投影 enterpriseAccountIdentity
 * [POS]: dsh-ui 的账号语义真源，被账号设置视图、登录弹窗与侧栏入口共同消费，只读投影且不持有网络或 Host Context
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Building2,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  ShieldAlert,
} from 'lucide-react'
import { createElement, useSyncExternalStore, type ReactNode } from 'react'
import type { EnterpriseAccountSnapshot, EnterpriseAccountStore } from './account-store.js'
import { enterpriseErrorMessage as errorMessageOf } from './error-messages.js'
import type { EnterpriseConnectionState } from './local-api.js'

/** 官方 slot 与弹窗共用同一份脱敏快照；订阅即触发 store 的按需状态读取。 */
export function useAccount(store: EnterpriseAccountStore): EnterpriseAccountSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export interface StatePresentation {
  readonly title: string
  readonly description: string
  readonly color: string
  readonly icon: 'building' | 'success' | 'progress' | 'warning' | 'error'
}

export const CONNECTION_PRESENTATION: Record<EnterpriseConnectionState, StatePresentation> = {
  UNCONFIGURED: {
    title: '配置企业服务',
    description: '设置 DSH Enterprise Server 地址后即可登录',
    color: 'var(--dsw-alias-accent-primary, #2563eb)',
    icon: 'building',
  },
  SIGNED_OUT: {
    title: '未登录',
    description: '尚未连接企业服务',
    color: 'var(--dsw-alias-label-tertiary, #667085)',
    icon: 'building',
  },
  AUTHORIZING: {
    title: '等待授权',
    description: '请在系统浏览器中完成企业登录',
    color: 'var(--dsw-alias-accent-primary, #2563eb)',
    icon: 'progress',
  },
  ENROLLING: {
    title: '正在注册设备',
    description: '正在建立此设备的独立企业会话',
    color: 'var(--dsw-alias-accent-primary, #2563eb)',
    icon: 'progress',
  },
  BOOTSTRAPPING: {
    title: '正在同步配置',
    description: '正在读取账号与设备策略',
    color: 'var(--dsw-alias-accent-primary, #2563eb)',
    icon: 'progress',
  },
  READY: {
    title: '已登录',
    description: '企业账号和设备会话均可用',
    color: 'var(--dsw-alias-state-success-primary, #16803c)',
    icon: 'success',
  },
  CANCELLED: {
    title: '登录已取消',
    description: '本次授权未产生企业会话',
    color: 'var(--dsw-alias-label-tertiary, #667085)',
    icon: 'building',
  },
  FAILED: {
    title: '登录失败',
    description: '企业服务未能完成本次登录',
    color: 'var(--dsw-alias-status-error, #c4320a)',
    icon: 'error',
  },
  REFRESHING: {
    title: '正在刷新',
    description: '现有会话可用，正在同步最新策略',
    color: 'var(--dsw-alias-status-warning, #b54708)',
    icon: 'progress',
  },
  AUTH_EXPIRED: {
    title: '登录已过期',
    description: '企业会话已失效，请重新登录',
    color: 'var(--dsw-alias-status-warning, #b54708)',
    icon: 'warning',
  },
  DEVICE_REVOKED: {
    title: '设备已撤销',
    description: '此设备不再具有企业访问权限',
    color: 'var(--dsw-alias-status-error, #c4320a)',
    icon: 'error',
  },
}

/** 本地状态尚未取到时的统一文案；账号区与登录弹窗共用，避免两处各写一份。 */
export const ENTERPRISE_LOADING_PRESENTATION: StatePresentation = {
  title: '正在连接',
  description: '正在读取本地企业服务状态',
  color: 'var(--dsw-alias-label-tertiary, #667085)',
  icon: 'progress',
}

/**
 * 员工可读的错误文案**不再在本文件维护**：唯一一份码 → 人话映射在 `error-messages.ts`
 * （技能/插件/配方/账号/反馈共用同一句，未映射的码有兜底人话、绝不漏出裸码）。
 */
export function enterpriseErrorMessage(code: string): string {
  return errorMessageOf(code)
}

/**
 * 错误呈现的唯一入口：中文文案始终来自唯一映射；原始错误码只在符合受控标识符形状时附带回显，
 * 未知或不合法形状一律丢弃，Host 返回的任意字符串不进入界面。
 * 文案与「接下来做什么」分两句给（人话在 `message`，下一步在 `error-messages` 的 action），
 * 界面统一经 `EnterpriseErrorNotice` 渲染。
 */
export function enterpriseErrorDisplay(code: string): { readonly message: string; readonly code?: string } {
  const message = enterpriseErrorMessage(code)
  return ERROR_CODE_SHAPE.test(code) ? { message, code } : { message }
}

const LOGIN_TRANSITIONS: readonly EnterpriseConnectionState[] = ['AUTHORIZING', 'ENROLLING', 'BOOTSTRAPPING']

/** 状态文案是固定产品词汇，不透传服务端 message。 */
export function enterpriseStatePresentation(state: EnterpriseConnectionState): StatePresentation {
  return CONNECTION_PRESENTATION[state]
}

/**
 * 状态图标与状态文案同源：图标判别字段属于 StatePresentation，因此渲染映射和文案表放在一起，
 * 账号设置与登录弹窗共用一份，避免两处各自维护一套状态图形。
 */
export function enterpriseStateIcon(presentation: StatePresentation, size = 20, className?: string): ReactNode {
  const props = { 'aria-hidden': true, color: presentation.color, size, strokeWidth: 2, ...(className === undefined ? {} : { className }) }
  const icons = { success: CircleCheck, progress: LoaderCircle, warning: ShieldAlert, error: CircleAlert, building: Building2 }
  return createElement(icons[presentation.icon], props)
}

/** 受控错误码形状门禁：只有这个形状的码才带回显，Host 塞进来的任意字符串不作数。 */
const ERROR_CODE_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/

/** 企业会话是否已可用；这是功能可见性的判定，不再是任何全屏阻断的依据。 */
export function enterpriseSessionUsable(state?: EnterpriseConnectionState): boolean {
  return state === 'READY' || state === 'REFRESHING'
}

/** 是否处于登录进行中（浏览器授权、设备注册或配置同步），用于进度呈现与禁用重复提交。 */
export function enterpriseLoginInFlight(state?: EnterpriseConnectionState): boolean {
  return state !== undefined && LOGIN_TRANSITIONS.includes(state)
}

/** Server 地址只在没有活动企业会话、也不在登录迁移中时可编辑，保存与登录互斥。 */
export function enterpriseServerEditable(state?: EnterpriseConnectionState): boolean {
  return state !== undefined && ['UNCONFIGURED', 'SIGNED_OUT', 'CANCELLED', 'FAILED', 'AUTH_EXPIRED', 'DEVICE_REVOKED'].includes(state)
}

/** 账号信息在官方账号区缺席时仍可读的完整投影；字段缺失回落到员工可理解的占位。 */
export interface EnterpriseAccountIdentity {
  readonly displayName: string
  readonly loginName: string
  readonly department: string
  readonly isDepartmentKnown: boolean
  readonly platformUrl: string
  readonly isPlatformConfigured: boolean
  readonly deviceId: string | null
  readonly installationId: string | null
  readonly deviceLabel: string
  readonly versionLabel: string
}

/**
 * 无需 React 的账号信息推导：官方账号区被停用后，本投影是唯一的信息来源。
 * 优先使用带 device 的 bootstrap，未登录或未取到时回落到 status.user。
 */
export function enterpriseAccountIdentity(snapshot: EnterpriseAccountSnapshot): EnterpriseAccountIdentity {
  const status = snapshot.status
  const user = snapshot.bootstrap?.user ?? status?.user
  const displayName = user?.displayName ?? ''
  const loginName = user?.username ?? ''
  const departmentId = user?.departmentId ?? null
  return {
    displayName: displayName === '' ? '企业账号' : displayName,
    loginName,
    department: departmentId ?? '未设置部门',
    isDepartmentKnown: departmentId !== null,
    platformUrl: status?.platformUrl ?? '未配置',
    isPlatformConfigured: status?.platformUrl != null,
    deviceId: snapshot.bootstrap?.device.id ?? null,
    installationId: snapshot.bootstrap?.device.installationId ?? null,
    deviceLabel: snapshot.bootstrap === undefined
      ? '登录后可用'
      : `${snapshot.bootstrap.device.id} · ${snapshot.bootstrap.device.installationId}`,
    versionLabel: status?.bundleVersion ?? '正在读取',
  }
}
