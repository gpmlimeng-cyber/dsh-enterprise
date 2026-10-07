/**
 * [INPUT]: 依赖 React 的 createElement、lucide-react 的图标、官方原语 `Button`/`Switch`（`@deepseek-ai/dsh-client-ui-primitives`）、`esc-copy` 的文案与 `esc-types` 的 `ResourceItem`
 * [OUTPUT]: 对外提供 `EnterpriseEscCard`——专家/技能/连接器共用的聚合卡片（图标 + 标题 + 发布者 + 两行描述 + 统计页脚 + hover 动作位）
 * [POS]: esc 页面的**卡片层**，同时移植了 NUWAX 的 `CardWrapper`（容器版式）与 `ResourceCard`（业务内容与动作位）两个组件。
 *   ★`CardWrapper` 的版式逐条照抄：170px（无统计行时 130px）高、16px 内衬、12px 圆角、0.5px 边、
 *   48px 图标（专家裁圆、技能/连接器方形）、标题 16/20、发布者行 12px、描述两行截断、页脚 24px。
 *   ★动作位按 A 档**置灰**（本刀口径：看得见的那一页先搬，动作诚实置灰并写明原因）：召唤 / 立即使用 /
 *   连接 / 断开 / 启用开关 / 收藏 全部 `disabled` + `title=「该动作尚未在 DSH 侧接入」`；位置、几何与
 *   hover 浮现行为与原文一致——**不是**把它们删掉（删掉版式就与线上不同了）。
 *   ★两处 DSH 体系替换：① 图标兜底（原文 `agent_image.png`）→ lucide 中性图标 + token 底色；
 *   ② 发布者头像兜底（原文 `avatar.png`）→ 昵称首字字母头像。
 *   ★**口径 35③**：页脚（24px 统计行）只在 `showStats` 时渲染（官方 `{showStats && <footer/>}`），
 *   动作位/连接位/收藏位（绝对定位、不参与流布局）直接挂在卡片下——与官方渲染树一致。
 *   ★**图片地址一律先过 `enterpriseEscImageSrc`**（图标与头像两处）：平台给的是**要票据的绝对地址**，
 *   浏览器直连必破图（实测技能图标 401、头像 200+`{"code":"4010"}`）——换不出来的地址就落到上面两条兜底，
 *   于是这一层**永远不会画出一个破图**。
 *   ★付费角标**不做**：它的唯一用途是引到"订阅"这条本刀未移植的动作链，连它依赖的租户配置
 *   （`enableSubscription`）一起留给 B 档；故本文件没有付费相关的 prop。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Button, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { Bot, MessageSquare, Star, User } from 'lucide-react'
import { createElement, useState, type ReactNode } from 'react'
import { enterpriseEscImageSrc } from './esc-api.js'
import { ENTERPRISE_ESC_COPY, ENTERPRISE_ESC_LOCAL_COPY } from './esc-copy.js'
import type { ResourceItem, ResourceStatType } from './esc-types.js'

/** 统计项图标（原文的三枚 svg 组件 → lucide 同义图标）。 */
const STAT_ICON: Readonly<Record<ResourceStatType, () => ReactNode>> = {
  user: () => createElement(User, { size: 12, 'aria-hidden': true }),
  link: () => createElement(MessageSquare, { size: 12, 'aria-hidden': true }),
  star: () => createElement(Star, { size: 12, 'aria-hidden': true }),
}

/** 卡片入参。 */
export interface EnterpriseEscCardProps {
  readonly item: ResourceItem
  /** 图标形态：专家/专家团按「人」形资源裁圆，技能与连接器保持方形。 */
  readonly iconShape?: 'square' | 'circle' | undefined
  /** 是否显示底部统计行（原页面仅专家卡片展示）。 */
  readonly showStats?: boolean | undefined
  /** 是否显示「召唤」动作位（专家卡片）。 */
  readonly showSummon?: boolean | undefined
  /** 是否显示「立即使用」动作位与启用开关（技能卡片）。 */
  readonly showUse?: boolean | undefined
  /** 是否按连接器卡片展示（分类 + 连接状态行、连接/断开动作位）。 */
  readonly showConnect?: boolean | undefined
}

/**
 * 一张资源卡片。
 *
 * 本刀所有动作位都是置灰占位（见文件头），故本组件**没有** `onSummon`/`onSelect`/`onConnect` 这类回调——
 * 加一个不接线的回调只会让"这动作能用"看起来像真的。
 */
export function EnterpriseEscCard({
  item,
  iconShape = 'square',
  showStats = true,
  showSummon,
  showUse,
  showConnect,
}: EnterpriseEscCardProps): ReactNode {
  const notPorted = ENTERPRISE_ESC_LOCAL_COPY.actionNotPorted
  const connected = item.connected === true
  const publishName = item.publishUser?.nickName || item.publishUser?.userName || ''

  const authorRow = createElement(
    'div',
    { className: 'esc-card-author-row' },
    item.publishUser ? createElement(AuthorRow, { avatar: item.publishUser.avatar, name: publishName }) : null,
    // 连接器卡片：分类 + 连接状态（原文口径：分类为空时不画状态点）
    showConnect === true
      ? createElement(
          'div',
          { className: 'esc-extra-box' },
          createElement(
            'span',
            { className: 'esc-connect-info' },
            hasText(item.category) ? createElement('span', { className: 'esc-connect-category' }, item.category) : null,
            createElement(
              'span',
              {
                className: `esc-connect-status ${connected ? 'esc-status-connected' : 'esc-status-disconnected'}`,
              },
              hasText(item.category) ? createElement('span', { className: 'esc-status-dot' }) : null,
              connected ? ENTERPRISE_ESC_COPY.connected : ENTERPRISE_ESC_COPY.disconnected,
            ),
          ),
        )
      : null,
  )

  /**
   * 统计行图标。
   *
   * ★原文口径（`ResourceCard/index.tsx:186`）：星形图标**跟随收藏态切实心**（与广场卡片一致），
   * 其余两枚恒用线框图标；这一格是"同一份 collected 在两处都生效"的第二处，别只改角标那处。
   */
  const statIconOf = (type: ResourceStatType): ReactNode =>
    type === 'star' && item.collected === true
      ? createElement(Star, { size: 12, 'aria-hidden': true, fill: 'currentColor' })
      : (STAT_ICON[type] ?? STAT_ICON.user)()

  const statsRow =
    showStats === true
      ? createElement(
          'div',
          { className: 'esc-count-box' },
          (item.stats ?? []).map(stat =>
            createElement(
              'span',
              { key: stat.type, className: 'esc-count-text' },
              statIconOf(stat.type),
              createElement('span', null, String(stat.value)),
            ),
          ),
        )
      : null

  // 专家「召唤」/ 技能「立即使用」：技能那一档容器常驻（开关一直看得见），**按钮单独 hover 浮现**
  // （原文 `.hover-reveal-btn` 的口径）。dsh 的 `Button` 自带 `:disabled { opacity: .4 }`（0,2,0）会压过
  // 单类（0,1,0），故那枚类挂不上按钮 —— 改由**外层 `<span>`** 承载（span 上没有竞争规则，稳）。
  const summonOrUseBox =
    showSummon === true || showUse === true
      ? createElement(
          'div',
          { className: showUse === true ? 'esc-action-box esc-action-box-pinned' : 'esc-action-box' },
          showUse === true
            ? createElement(
                'span',
                { className: 'esc-hover-reveal' },
                createElement(Button, {
                  variant: 'primary',
                  size: 'sm',
                  disabled: true,
                  className: 'esc-action-solid',
                  // ★用户裁决：「技能选中的『立即使用』太长了，改成一个机器人聊天的图标即可」→ 曾经 icon-only；
                  // 之后用户又判「使用图标有点丑还是换成使用俩字」⇒ **回到文字**，且只要两个字。
                  // 文字写在可见 children 上（不再借 `aria-label` 承担文案 —— 可见名与无障碍名同源，
                  // 不会出现"读屏念四字、眼睛看两字"的 label-in-name 偏差）；两字也比原来的四字窄 24px 左右，
                  // 窄列里对标题的挤压比第一版小。悬停提示仍说明 A 档置灰的理由。
                  title: notPorted,
                  children: ENTERPRISE_ESC_COPY.useNowDisplay,
                }),
              )
            : createElement(Button, {
                variant: 'primary',
                size: 'sm',
                disabled: true,
                className: 'esc-action-solid',
                title: notPorted,
                children: ENTERPRISE_ESC_COPY.summon,
              }),
          showUse === true
            ? createElement(Switch, {
                checked: item.skillEnabled === true,
                onChange: () => undefined,
                disabled: true,
                label: item.name,
                title: notPorted,
              })
            : null,
        )
      : null

  // 连接器：已连接 = 常驻启用开关 + hover 浮现的「断开」；未连接 = hover 浮现的「连接」（原文口径，同上）
  const connectBox =
    showConnect === true
      ? createElement(
          'div',
          { className: connected ? 'esc-action-box esc-action-box-pinned' : 'esc-action-box' },
          connected
            ? createElement(
                'span',
                { className: 'esc-hover-reveal' },
                createElement(Button, {
                  variant: 'primary',
                  size: 'sm',
                  disabled: true,
                  className: 'esc-action-solid',
                  title: notPorted,
                  children: '断开',
                }),
              )
            : createElement(Button, {
                variant: 'primary',
                size: 'sm',
                disabled: true,
                className: 'esc-action-solid',
                title: notPorted,
                children: '连接',
              }),
          connected
            ? createElement(Switch, {
                checked: item.connectionEnabled === true,
                onChange: () => undefined,
                disabled: true,
                label: item.name,
                title: notPorted,
              })
            : null,
        )
      : null

  const collectBox =
    showSummon === true
      ? createElement(
          'div',
          { className: 'esc-corner-box' },
          createElement(
            'button',
            {
              type: 'button',
              className: 'esc-star-box esc-hover-reveal',
              disabled: true,
              title: notPorted,
              'aria-label': item.collected === true ? ENTERPRISE_ESC_COPY.cancelCollect : ENTERPRISE_ESC_COPY.collect,
            },
            createElement(Star, {
              size: 16,
              'aria-hidden': true,
              fill: item.collected === true ? 'currentColor' : 'none',
            }),
          ),
        )
      : null

  // 卡片根类名与官方一致：有统计行 = 170px，无统计行 = 紧凑 130px（`esc-card-compact`）。
  //
  // ★口径 35③：**页脚元素只在有统计行时才渲染**——官方是 `{showStats && <footer/>}`
  //   （`ResourceCard/index.tsx:178-196`），技能/连接器卡片根本没有这个 24px 元素。
  //   原先本页恒渲染它，于是紧凑卡片的内容 48+32+24+32=136 超出 130 的内容盒 6px，
  //   flex-shrink 就近把**描述**压扁 ⇒ 描述第二行被切掉半截（实测缺口 9px ≈ 3.3 CSS px）。
  //   动作位/连接位/收藏位本来就是绝对定位（不参与流布局、不产生间隙），故与官方一样**直接挂在卡片下**。
  return createElement(
    'div',
    { className: showStats === true ? 'esc-card' : 'esc-card esc-card-compact' },
    createElement(
      'header',
      { className: 'esc-card-header' },
      createElement(CardIcon, { icon: item.icon, shape: iconShape }),
      createElement(
        'div',
        { className: 'esc-card-headmain' },
        createElement('h3', { className: 'esc-card-title', title: item.name, children: item.name }),
        authorRow,
      ),
    ),
    createElement('div', { className: 'esc-card-content', children: item.description ?? '' }),
    showStats === true ? createElement('div', { className: 'esc-card-footer' }, statsRow) : null,
    summonOrUseBox,
    connectBox,
    collectBox,
  )
}

/** 卡片图标：有可用地址就画图；没有就画中性图标（原文是固定 PNG 兜底图）。 */
function CardIcon({
  icon,
  shape,
}: {
  readonly icon?: string | undefined
  readonly shape: 'square' | 'circle'
}): ReactNode {
  const cls = shape === 'circle' ? 'esc-card-image esc-card-image-circle' : 'esc-card-image'
  // ★平台给的绝对地址要经宿主代理（那张图要票据，浏览器直连必破图）；换不出来的地址照样走兜底图标。
  // ★`broken` 这一格是**活体取证补上的**：平台数据里确实存在**跨域**图标（如 `https://s3.nuwax.com:9443/…`、
  //   `https://nuwax.nat300.top/api/f/…`），宿主的图片代理按红线只认**与会话同一台 origin** ⇒ 回 400，
  //   `<img>` 就画成一个破图（此前没有 onError 兜底，文件头那句"永远不会画出破图"只对"换不出来的地址"成立）。
  //   现在加载失败一次就切回兜底图标——"破图"这条路不再成立。
  const [broken, setBroken] = useState(false)
  const src = broken ? undefined : enterpriseEscImageSrc(icon)
  if (src !== undefined)
    return createElement('img', { className: cls, src, alt: '', loading: 'lazy', onError: () => setBroken(true) })
  return createElement(
    'span',
    { className: cls, style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
    createElement(Bot, { size: 20, 'aria-hidden': true }),
  )
}

/** 发布者的头像 + 昵称（原 `AuthorInfo`）：头像缺席时用首字字母头像（原文是固定 PNG 兜底图）。 */
function AuthorRow({ avatar, name }: { readonly avatar?: string | undefined; readonly name: string }): ReactNode {
  // 同图标那条：跨域头像会被宿主如实拒掉 ⇒ 加载失败一次就换成首字字母头像，不留破图。
  const [broken, setBroken] = useState(false)
  const src = broken ? undefined : enterpriseEscImageSrc(avatar)
  const picture = src !== undefined
    ? createElement('img', { className: 'esc-author-avatar', src, alt: '', loading: 'lazy', onError: () => setBroken(true) })
    : createElement(
        'span',
        {
          className: 'esc-author-avatar',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            // ★口径 36 修：这里原本写着 `--dsw-alias-background-secondary` —— 主题里**不存在**这枚 token
            //   （真实名见 esc-style.ts 头部的映射表），整条声明计算期无效 ⇒ 首字字母头像一直没有底色。
            //   按那张映射表换成 `bg-skeleton`（与缺图占位同一格灰）。
            background: 'var(--dsw-alias-bg-skeleton)',
            color: 'var(--dsw-alias-label-tertiary)',
            fontSize: 10,
          },
          'aria-hidden': true,
        },
        name.slice(0, 1) || '·',
      )
  return createElement(
    'span',
    { className: 'esc-author' },
    picture,
    createElement('span', { className: 'esc-author-name', children: name }),
  )
}

/** 非空白字符串判据（空串与全空白都当"没有"）。 */
function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
