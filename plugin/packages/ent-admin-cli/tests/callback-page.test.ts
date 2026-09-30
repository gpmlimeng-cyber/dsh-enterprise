/**
 * [INPUT]: 依赖 ent-admin-cli 回调页纯函数（pickCallbackLocale/escapeHtmlText/renderCallbackPage）
 * [OUTPUT]: 验证 Accept-Language 映射（缺省中文）、品牌文本 HTML 转义、品牌回落与成功/失败态分支
 * [POS]: ent-admin-cli 回环结果页的语言、注入与状态回归测试，不占用任何端口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from 'vitest'
import {
  CALLBACK_DEFAULT_BRAND_NAME,
  CALLBACK_DEFAULT_LOCALE,
  callbackBrandName,
  escapeHtmlText,
  pickCallbackLocale,
  renderCallbackPage,
} from '../src/callback-page.js'

describe('pickCallbackLocale', () => {
  it('maps every zh variant to Chinese', () => {
    for (const header of ['zh', 'zh-CN', 'zh-Hans-CN', 'zh-TW', 'ZH-cn', 'zh-CN,zh;q=0.9,en;q=0.8']) {
      expect(pickCallbackLocale(header)).toBe('zh')
    }
  })

  it('uses English only when the best weighted preference is explicitly English', () => {
    // 产品要求缺省中文：只有 best q 的主标签明确是 en 才用英文。
    for (const header of ['en', 'en-US', 'en-US,en;q=0.9', 'en;q=0.9,zh;q=0.8', 'en-US,zh-CN;q=0.1']) {
      expect(pickCallbackLocale(header)).toBe('en')
    }
  })

  it('defaults to Chinese for missing, empty, malformed and unparsable headers', () => {
    // 产品要求缺省中文（需求变更）：缺失/空串/畸形/无法解析一律中文，不再回落英文。
    for (const header of ['', '   ', null, undefined, '{},;q=x', '*', 'not a language tag', 'en;q=0']) {
      expect(pickCallbackLocale(header)).toBe('zh')
    }
    expect(CALLBACK_DEFAULT_LOCALE).toBe('zh')
    expect(pickCallbackLocale(null)).toBe(CALLBACK_DEFAULT_LOCALE)
  })

  it('defaults to Chinese for languages that are neither zh nor explicitly en', () => {
    // 产品要求缺省中文：fr/de 等没有中文页以外的成品翻译，一律中文而不是英文。
    for (const header of ['fr', 'fr-FR', 'de-DE,de;q=0.9', 'ja', '*;q=1,fr;q=0.8', 'en-GB;q=0']) {
      expect(pickCallbackLocale(header)).toBe('zh')
    }
  })

  it('keeps the q-value rule when zh and en appear together', () => {
    // zh/en 同时出现沿用 q 值规则：q 高者胜，同 q 先出现者胜，q=0 视为不偏好。
    expect(pickCallbackLocale('en;q=0.1,zh;q=0.9')).toBe('zh')
    expect(pickCallbackLocale('zh;q=0.1,en;q=0.9')).toBe('en')
    expect(pickCallbackLocale('en;q=0.9,zh;q=0.9')).toBe('en')
    expect(pickCallbackLocale('zh;q=0.9,en;q=0.9')).toBe('zh')
    expect(pickCallbackLocale('en;q=0,zh;q=0.5')).toBe('zh')
    expect(pickCallbackLocale('zh;q=0,en;q=0.5')).toBe('en')
    expect(pickCallbackLocale('en;q=0,zh;q=0')).toBe('zh')
  })
})

describe('escapeHtmlText', () => {
  it('escapes every character that can open a tag or attribute', () => {
    expect(escapeHtmlText('<script>&"\'')).toBe('&lt;script&gt;&amp;&quot;&#39;')
    expect(escapeHtmlText('plain text')).toBe('plain text')
  })
})

describe('callbackBrandName', () => {
  it('falls back through shortName and welcome headline to the built-in name', () => {
    const welcome = { headline: '', editionLabel: '' }
    expect(callbackBrandName({ name: ' Acme ', shortName: 'AC', welcome })).toBe('Acme')
    expect(callbackBrandName({ name: '  ', shortName: 'AC', welcome })).toBe('AC')
    expect(callbackBrandName({ name: '', shortName: '', welcome: { headline: 'Hello', editionLabel: '' } })).toBe('Hello')
    expect(callbackBrandName(null)).toBe(CALLBACK_DEFAULT_BRAND_NAME)
    expect(callbackBrandName(undefined)).toBe(CALLBACK_DEFAULT_BRAND_NAME)
  })
})

describe('renderCallbackPage', () => {
  it('renders a self-contained Chinese success page without any remote resource', () => {
    const html = renderCallbackPage({ locale: 'zh', outcome: { status: 'success' } })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('<meta name="color-scheme" content="light dark">')
    expect(html).toContain('prefers-color-scheme: dark')
    expect(html).toContain('登录已完成，可以关闭此窗口。')
    expect(html).toContain(CALLBACK_DEFAULT_BRAND_NAME)
    expect(html).toContain('若窗口未自动关闭，请手动关闭并回到客户端。')
    expect(html).toContain('if (true)')
    // 无外部资源：页面里不允许出现任何 http(s) 地址。
    expect(/https?:\/\//.test(html)).toBe(false)
  })

  it('renders the English success copy and never auto-closes a failure page', () => {
    const english = renderCallbackPage({ locale: 'en', outcome: { status: 'success' } })
    expect(english).toContain('<html lang="en">')
    expect(english).toContain('Login completed. You can close this window.')
    expect(english).not.toContain('登录已完成')

    const failed = renderCallbackPage({ locale: 'en', outcome: { status: 'failure', reason: 'code' } })
    expect(failed).toContain('The authorization code was not received.')
    expect(failed).toContain('Please return to the client and try again.')
    expect(failed).toContain('if (false)')
    expect(failed).toContain('class="mark error"')
  })

  it('escapes an untrusted brand name and edition label instead of forming markup', () => {
    const malicious = '<img src=x onerror="alert(1)">'
    const html = renderCallbackPage({
      locale: 'zh',
      outcome: { status: 'success' },
      branding: {
        name: malicious,
        shortName: '',
        welcome: { headline: '', editionLabel: 'A&B"<i>' },
      },
    })
    expect(html).not.toContain('<img')
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).toContain('A&amp;B&quot;&lt;i&gt;')
  })

  it('keeps failure reasons opaque and points back to the client', () => {
    const html = renderCallbackPage({ locale: 'zh', outcome: { status: 'failure', reason: 'error' } })
    expect(html).toContain('身份认证未通过。')
    expect(html).toContain('请回到客户端重试。')
    expect(html).not.toContain('access_denied')
    expect(html).not.toContain('ENT_AUTH')
  })
})
