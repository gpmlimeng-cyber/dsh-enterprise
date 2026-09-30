/**
 * [INPUT]: 依赖同源公开品牌接口 GET /enterprise/api/v1/branding，与 login.html 的 #brand-logo/#brand-name-text/#brand-headline/#brand-edition 品牌节点。
 * [OUTPUT]: 无导出成员；载入后按当前发布 revision 改写 document.title、品牌名与品牌图，并在字段非空时显示 headline 与版本标识。
 * [POS]: 公开登录页的品牌装饰层，先于 login.js 执行且不参与认证状态机；缺字段/超时/非 2xx/图片失败一律保留 DSH Enterprise 静态回退形态，不阻断登录。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const BRANDING_ENDPOINT = '/enterprise/api/v1/branding'
const BRANDING_TIMEOUT_MS = 3000
const BRANDING_LABEL_LIMIT = 120
/** 接口不可用时的位图，与页面静态骨架同源同样式。 */
const FALLBACK_LOGO = '/enterprise/auth/owndsh-whale-mono-m2-animated.png'

const logoNode = document.querySelector('#brand-logo')
const nameNode = document.querySelector('#brand-name-text')
const headlineNode = document.querySelector('#brand-headline')
const editionNode = document.querySelector('#brand-edition')

/** 只接受非空有界字符串，其余（null/数字/超长）按缺字段处理。 */
function readText(value) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return text === '' || text.length > BRANDING_LABEL_LIMIT ? '' : text
}

/** 只接受同源绝对路径的位图地址；远端 URL 与协议相对地址一律回落。 */
function readAsset(value) {
  const path = readText(value)
  return path.startsWith('/') && !path.startsWith('//') ? path : ''
}

function showText(node, value) {
  if (!node || value === '') return
  node.textContent = value
  node.hidden = false
}

function showLogo(source) {
  if (!logoNode || source === '') return
  const restore = () => {
    logoNode.removeEventListener('error', restore)
    logoNode.src = FALLBACK_LOGO
  }
  logoNode.addEventListener('error', restore)
  logoNode.src = source
}

/** 逐字段回落：与客户端登录弹窗同一优先级 light → dark → square，缺失字段保留页面静态值。 */
function applyBranding(branding) {
  const name = readText(branding.name)
  const shortName = readText(branding.shortName)
  const title = name || shortName
  if (title !== '') document.title = title
  showText(nameNode, shortName || name)

  const welcome = branding.welcome ?? {}
  showText(headlineNode, readText(welcome.headline))
  showText(editionNode, readText(welcome.editionLabel))

  const logo = branding.logo ?? {}
  showLogo(readAsset(logo.light?.url) || readAsset(logo.dark?.url) || readAsset(logo.square?.url))
}

async function loadBranding() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BRANDING_TIMEOUT_MS)
  try {
    const response = await fetch(BRANDING_ENDPOINT, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return
    const payload = await response.json()
    if (payload?.data && typeof payload.data === 'object') applyBranding(payload.data)
  } catch {
    // 品牌是纯装饰：接口不存在、超时或解析失败都保持静态回退，不触碰登录表单与状态行。
  } finally {
    clearTimeout(timer)
  }
}

void loadBranding()
