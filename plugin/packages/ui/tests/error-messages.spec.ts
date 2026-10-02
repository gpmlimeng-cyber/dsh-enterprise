/**
 * [INPUT]: 依赖 error-messages 的唯一码 → 人话映射（含兜底）、error-notice 的「技术信息」钩子常量，以及 src 下全部界面源码里的 `ENT_*` 字面量
 * [OUTPUT]: 验证映射是**纯投影**且处处一致：逐码给出非空的「发生了什么 + 下一步」、文案里不出现裸码、未映射/空串/畸形形状一律落兜底人话、码原样保留可取；并锁死「ui src 里出现的每个码都在唯一映射里」 **本刀（企业插件真取消）**：码清单加 `ENT_PLUGIN_INSTALL_CANCELLED`（并逐字锁它的文案与 `retryable: true`）
 * [POS]: 失败自愈的机械门禁——宪法「禁止把技术码砸给用户」与「一处定义、处处复用」的可执行版本
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  ENTERPRISE_ERROR_ACTIONS,
  ENTERPRISE_ERROR_CODES,
  ENTERPRISE_ERROR_FALLBACK_ACTION,
  ENTERPRISE_ERROR_FALLBACK_MESSAGE,
  enterpriseErrorAction,
  enterpriseErrorMessage,
  enterpriseErrorPresentation,
  enterpriseErrorRetryable,
} from '../src/error-messages.js'
import { ENTERPRISE_ERROR_TECH_ATTR, ENTERPRISE_ERROR_TECH_CONTAINER_ATTR, ENTERPRISE_ERROR_TECH_SUMMARY } from '../src/error-notice.js'

/** 员工侧可达的码族（技能 / 插件 / 配方 / 账号 / 反馈 / 品牌 / 更新 / 会话）必须逐个在表里。 */
const REQUIRED_CODES = [
  // 技能链（bundle/skill-errors.ts 的全集 + 只读正文两枚）
  'ENT_SKILL_DOWNLOAD_FAILED', 'ENT_SKILL_SIZE_MISMATCH', 'ENT_SKILL_HASH_MISMATCH', 'ENT_SKILL_ARCHIVE_INVALID',
  'ENT_SKILL_PACKAGE_MISMATCH', 'ENT_SKILL_INVALID_PACKAGE', 'ENT_SKILL_NAME_CONFLICT', 'ENT_SKILL_STATE_INVALID',
  'ENT_SKILL_INSTALL_FAILED', 'ENT_SKILL_CONTENT_TOO_LARGE', 'ENT_SKILL_CONTENT_INVALID', 'ENT_SKILL_TOO_LARGE',
  'ENT_SKILL_NOT_PUBLISHED', 'ENT_SKILL_VISIBILITY_DENIED',
  // 插件链
  'ENT_PLUGIN_DOWNLOAD_FAILED', 'ENT_PLUGIN_HASH_MISMATCH', 'ENT_PLUGIN_SIZE_MISMATCH', 'ENT_PLUGIN_ARTIFACT_INVALID',
  'ENT_PLUGIN_ARCHIVE_TOO_LARGE', 'ENT_PLUGIN_SIGNATURE_INVALID', 'ENT_PLUGIN_INCOMPATIBLE', 'ENT_PLUGIN_BUSY',
  'ENT_PLUGIN_CLI_FAILED', 'ENT_PLUGIN_COMMAND_FAILED', 'ENT_PLUGIN_LOADER_INACTIVE', 'ENT_PLUGIN_STATE_INVALID',
  'ENT_PLUGIN_NOT_ASSIGNED', 'ENT_PLUGIN_CORE_PROTECTED',
  // 取消在途安装（员工自己按下的取消**不是**失败：本机什么都没变 ⇒ 下一步就是再试一次）
  'ENT_PLUGIN_INSTALL_CANCELLED',
  // 配方
  'ENT_PRESET_INVALID_PACKAGE', 'ENT_PRESET_NOT_PUBLISHED', 'ENT_PRESET_TOO_LARGE', 'ENT_PRESET_VISIBILITY_DENIED',
  // 本地路由 / 会话 / 账号 / 反馈 / 品牌 / 更新
  'ENT_LOCAL_UNAVAILABLE', 'ENT_LOCAL_RESPONSE_INVALID', 'ENT_PLATFORM_UNAVAILABLE', 'ENT_RESOURCE_NOT_FOUND',
  'ENT_PERMISSION_DENIED', 'ENT_AUTH_REQUIRED', 'ENT_AUTH_SESSION_EXPIRED', 'ENT_AUTH_TIMEOUT', 'ENT_DEVICE_REVOKED',
  'ENT_FEEDBACK_INVALID', 'ENT_FEEDBACK_ATTACHMENT_INVALID', 'ENT_FEEDBACK_ATTACHMENT_TOO_LARGE',
  'ENT_BRANDING_ASSET_INVALID', 'ENT_BRANDING_ASSET_TOO_LARGE',
  'ENT_ARTIFACT_INTEGRITY_FAILED', 'ENT_ARTIFACT_UNSIGNED', 'ENT_ARTIFACT_CORE_PACKAGE',
  'ENT_INVALID_ACCOUNT_ORIGIN', 'ENT_ACCOUNT_ORIGIN_WRITE_FAILED', 'ENT_ACCOUNT_REMOUNT_FAILED',
] as const

describe('enterprise error vocabulary (single projection)', () => {
  it('keeps every employee-reachable code in the one and only table', () => {
    for (const code of REQUIRED_CODES) {
      expect(ENTERPRISE_ERROR_CODES, code).toContain(code)
      expect(enterpriseErrorPresentation(code).known, code).toBe(true)
    }
    // 表里没有重复项（Map 语义靠唯一性成立）。
    expect(new Set(ENTERPRISE_ERROR_CODES).size).toBe(ENTERPRISE_ERROR_CODES.length)
  })

  it('gives every mapped code a non-empty human message and an explicit next step', () => {
    for (const code of ENTERPRISE_ERROR_CODES) {
      const view = enterpriseErrorPresentation(code)
      expect(view.message.length, code).toBeGreaterThan(0)
      expect(view.action.length, code).toBeGreaterThan(0)
      expect(view.code, code).toBe(code)
      expect(view.known, code).toBe(true)
      // 人话里**绝不**出现裸码（码只在「技术信息」里）。
      expect(view.message, code).not.toContain('ENT_')
      expect(view.action, code).not.toContain('ENT_')
      // 下一步动作以动词/祈使句结尾的句号收束，读得出「我现在能做什么」。
      expect(view.action.endsWith('。'), code).toBe(true)
      expect(typeof view.retryable, code).toBe('boolean')
    }
    // 取消在途安装那一枚：员工自己按下的取消**不是**失败（Host 已把记录回到安装前），
    // 故文案就是「这次安装被取消了。请重试。」——人话 + 下一步，且按语义可重试。
    expect(enterpriseErrorMessage('ENT_PLUGIN_INSTALL_CANCELLED')).toBe('这次安装被取消了。')
    expect(enterpriseErrorAction('ENT_PLUGIN_INSTALL_CANCELLED')).toBe('请重试。')
    expect(enterpriseErrorRetryable('ENT_PLUGIN_INSTALL_CANCELLED')).toBe(true)
  })

  it('keeps the same sentence per code no matter which accessor is used', () => {
    for (const code of ENTERPRISE_ERROR_CODES) {
      const view = enterpriseErrorPresentation(code)
      expect(enterpriseErrorMessage(code), code).toBe(view.message)
      expect(enterpriseErrorAction(code), code).toBe(view.action)
      expect(enterpriseErrorRetryable(code), code).toBe(view.retryable)
    }
  })

  it('falls back to a human sentence for unmapped, malformed, empty and missing codes', () => {
    for (const unknown of ['ENT_SOMETHING_NEW', 'ENT_X', 'NOT_A_CODE', '<img src=x onerror=alert(1)>', '', '   ', undefined, null]) {
      const view = enterpriseErrorPresentation(unknown)
      expect(view.known, String(unknown)).toBe(false)
      expect(view.message, String(unknown)).toBe(ENTERPRISE_ERROR_FALLBACK_MESSAGE)
      expect(view.action, String(unknown)).toBe(ENTERPRISE_ERROR_FALLBACK_ACTION)
      expect(view.message).not.toContain('ENT_')
      expect(view.action).not.toContain('ENT_')
      // 码本身不被吞掉：受控形状原样回传，畸形形状归一成空串（界面也不回显它）。
      expect(view.code, String(unknown)).toBe(typeof unknown === 'string' ? unknown.trim() : '')
    }
    // 兜底也是「可重试」的那一档（未知失败的默认建议：再试一次，仍然失败找人）。
    expect(enterpriseErrorRetryable('ENT_SOMETHING_NEW')).toBe(true)
  })

  it('marks terminal failures as non-retryable (no retry drawn on a sure-to-fail path)', () => {
    for (const terminal of [
      'ENT_SKILL_HASH_MISMATCH', 'ENT_SKILL_ARCHIVE_INVALID', 'ENT_SKILL_CONTENT_TOO_LARGE', 'ENT_SKILL_CONTENT_INVALID',
      'ENT_PLUGIN_INCOMPATIBLE', 'ENT_PERMISSION_DENIED', 'ENT_RESOURCE_NOT_FOUND', 'ENT_AUTH_REQUIRED',
    ]) {
      expect(enterpriseErrorRetryable(terminal), terminal).toBe(false)
    }
    for (const transient of [
      'ENT_PLATFORM_UNAVAILABLE', 'ENT_LOCAL_UNAVAILABLE', 'ENT_NETWORK_ERROR', 'ENT_PLUGIN_BUSY',
      'ENT_SKILL_DOWNLOAD_FAILED', 'ENT_SKILL_INSTALL_FAILED', 'ENT_UPSTREAM_TIMEOUT',
      'ENT_PLUGIN_INSTALL_CANCELLED',
    ]) {
      expect(enterpriseErrorRetryable(transient), transient).toBe(true)
    }
  })

  it('exposes the raw code only through the dedicated technical-info hooks', () => {
    // 码要「仍可取到」：技术信息钩子是唯一的取证点（界面把它折叠在「技术信息」里）。
    expect(ENTERPRISE_ERROR_TECH_ATTR).toBe('data-enterprise-error-code')
    expect(ENTERPRISE_ERROR_TECH_CONTAINER_ATTR).toBe('data-enterprise-error-tech')
    expect(ENTERPRISE_ERROR_TECH_SUMMARY).toBe('技术信息')
    expect(ENTERPRISE_ERROR_ACTIONS.retry).toBe('重试')
    expect(ENTERPRISE_ERROR_ACTIONS.login).toBe('去登录')
    expect(ENTERPRISE_ERROR_ACTIONS.admin).toBe('联系企业管理员')
  })

  it('keeps every ENT_ code that appears in the ui sources inside the single table', async () => {
    const names = (await readdir(new URL('../src/', import.meta.url))).filter(name => /\.tsx?$/.test(name))
    expect(names.length).toBeGreaterThan(0)
    const found = new Set<string>()
    for (const name of names) {
      const source = await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')
      for (const match of source.matchAll(/'(ENT_[A-Z0-9_]+)'/g)) found.add(match[1]!)
    }
    expect(found.size).toBeGreaterThan(0)
    // ui 里出现的每个码都必须能被翻成人话——「一处定义、处处复用」的机械门禁。
    expect([...found].filter(code => !ENTERPRISE_ERROR_CODES.includes(code))).toEqual([])
  })
})
