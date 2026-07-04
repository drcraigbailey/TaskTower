import fs from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import {
  ArrowLeft, Bath, BedDouble, Bell, Car, Castle, ChefHat, CircleAlert,
  CircleCheckBig, Clock3, CookingPot, Edit3, House, HousePlus, KeyRound,
  LogOut, Medal, PawPrint, Plus, Save, Settings, Share2, Sofa, Sparkles,
  Sprout, Trash2, UserRound, Users, WashingMachine,
} from 'lucide-react'

const root = path.resolve('TaskTower_Assets')
const C = {
  purple: '#7C5CFF', purpleDeep: '#5A38D6', pink: '#FF6B8B', cream: '#FFF8ED',
  peach: '#FFCB97', mint: '#58BF96', blue: '#6EA6FF', success: '#4C9D62',
  warning: '#F4AF42', overdue: '#E75E72', fullClean: '#8B5CF6', navy: '#172244',
  muted: '#74748A', card: '#FFFDFB', border: '#EBE6EF', shadow: '#3F2D561F',
  darkBackground: '#141222', darkCard: '#25213A', darkBorder: '#39334F',
  darkText: '#F5EFFF', darkMuted: '#AAA5BB',
}

const dirs = [
  'logos', 'app-icon', 'splash', 'characters/idle', 'characters/climbing',
  'characters/celebrations', 'characters/accessories', 'tower', 'backgrounds',
  'icons', 'effects', 'branding',
]

async function write(file, content) {
  const target = path.join(root, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content)
}

const svg = (viewBox, label, body, extra = '') => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}" ${extra}>
${body}
</svg>
`

const defs = (id) => `<defs>
  <linearGradient id="${id}-purple" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9B7BFF"/><stop offset="1" stop-color="#6545DA"/></linearGradient>
  <linearGradient id="${id}-pink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FF8EA7"/><stop offset="1" stop-color="#E64E75"/></linearGradient>
  <linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFD76A"/><stop offset="1" stop-color="#F0A52D"/></linearGradient>
  <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#3F2D56" flood-opacity=".18"/></filter>
</defs>`

const crown = (x, y, scale = 1, id = 'logo', color = `url(#${id}-gold)`) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="${color}" stroke="#D58A1D" stroke-width="2" stroke-linejoin="round">
  <path d="M4 28 0 6l17 12L28 0l11 18L56 6l-4 22Z"/><rect x="4" y="27" width="48" height="10" rx="4"/>
  <circle cx="0" cy="6" r="4"/><circle cx="28" cy="1" r="4"/><circle cx="56" cy="6" r="4"/>
</g>`

const towerMark = (x, y, scale = 1, id = 'logo') => `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#${id}-shadow)">
  <path d="M12 128V40Q12 28 24 28h48v100Z" fill="url(#${id}-purple)"/>
  <path d="M72 128V28h48q12 0 12 12v88Z" fill="url(#${id}-pink)"/>
  <path d="M68 28h8v100h-8Z" fill="#FFF" opacity=".86"/>
  <g fill="#FFE3A5" stroke="#292553" stroke-width="4"><path d="M30 53h22v28H30z"/><path d="M30 93h22v28H30z"/><path d="M92 53h22v28H92z"/><path d="M92 93h22v28H92z"/></g>
</g>`

// Brand-logo tower: a taller, friendlier split building that rises through the
// TASK/TOWER join in the supplied concept boards. Keep towerMark for small icons.
const logoTower = (x, y, scale = 1, id = 'logo', mono = '') => {
  const purple = mono || `url(#${id}-purple)`
  const pink = mono || `url(#${id}-pink)`
  const ink = mono || '#3B2866'
  const window = mono ? (mono === '#FFFFFF' ? '#FFFFFF' : mono) : '#30265D'
  const panes = [
    [29, 60], [29, 101], [29, 142], [99, 60], [99, 101], [99, 142],
  ].map(([wx, wy]) => `<g><rect x="${wx}" y="${wy}" width="23" height="29" rx="4" fill="${window}" stroke="${ink}" stroke-width="3"/><path d="M${wx + 11.5} ${wy + 3}v23M${wx + 3} ${wy + 14.5}h17" stroke="${mono ? (mono === '#FFFFFF' ? '#FFFFFF' : mono) : '#927BD5'}" stroke-width="2" opacity="${mono ? '.35' : '.8'}"/></g>`).join('')
  return `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#${id}-shadow)">
    <path d="M12 178V54h18V38h35V22h20v156Z" fill="${purple}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M85 178V22h20v16h35v16h18v124Z" fill="${pink}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M80 20h10v158H80Z" fill="${mono || '#FFFFFF'}" opacity="${mono ? '.22' : '.92'}"/>
    <path d="M24 51h54M92 51h54M12 94h66M92 94h66M12 135h66M92 135h66" stroke="${mono || '#FFFFFF'}" stroke-width="5" opacity=".2"/>
    ${panes}
    <path d="M0 179q17-27 34-10 8-29 27-4 12-17 24 8 13-25 29-7 16-22 30 4 15-15 27 9Z" fill="${mono || '#557768'}" stroke="${ink}" stroke-width="3"/>
    <path d="M-5 178h180v16H-5Z" rx="8" fill="${mono || '#48316E'}"/>
  </g>`
}

function logo(kind = 'primary') {
  const monoDark = kind === 'monochrome-dark'
  const monoLight = kind === 'monochrome-light'
  const mono = monoDark || monoLight
  const task = monoLight ? '#FFFFFF' : C.navy
  const towerWord = mono ? task : 'url(#logo-word)'
  const d = `${defs('logo')}<defs><linearGradient id="logo-word"><stop stop-color="${C.purple}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient></defs>`
  const font = 'Fredoka,Arial Rounded MT Bold,DejaVu Sans,sans-serif'
  const taglineFill = monoLight ? '#FFFFFF' : (monoDark ? C.navy : C.muted)
  const wordmark = (y, size, join = 486) => `<text x="${join}" y="${y}" text-anchor="end" font-family="${font}" font-size="${size}" font-weight="800" letter-spacing="-5" fill="${task}">TASK</text><text x="${join - 5}" y="${y}" font-family="${font}" font-size="${size}" font-weight="800" letter-spacing="-7" fill="${towerWord}" stroke="${mono ? 'none' : '#FFFFFF'}" stroke-width="${mono ? 0 : 12}" paint-order="stroke fill">TOWER</text>`
  const sparkleSet = mono ? '' : `<g fill="${C.warning}"><path d="m377 50 5 10 10 5-10 5-5 10-5-10-10-5 10-5Z"/><path d="m642 70 4 8 8 4-8 4-4 8-4-8-8-4 8-4Z" fill="${C.pink}"/><circle cx="355" cy="104" r="5" fill="${C.purple}"/><circle cx="663" cy="116" r="4" fill="${C.blue}"/></g>`

  if (kind === 'stacked') return svg('0 0 640 440', 'TaskTower stacked logo', `${d}<rect width="640" height="440" rx="58" fill="${C.cream}"/>${sparkleSet}${logoTower(235, 44, .98, 'logo')}${crown(291, 12, .78)}${wordmark(330, 82, 310)}<path d="M8 390h35m554 0h35" stroke="${C.purple}" stroke-width="4" stroke-linecap="round"/><text x="320" y="397" text-anchor="middle" font-family="Nunito,Arial,DejaVu Sans,sans-serif" font-size="16" font-weight="800" letter-spacing="2.3" fill="${C.muted}">DO CHORES. CLIMB TOGETHER. WIN THE MONTH.</text>`)
  if (kind === 'wordmark') return svg('0 0 900 220', 'TaskTower wordmark', `${d}${crown(474, 18, .62)}${wordmark(154, 122, 448)}`)

  const compact = kind === 'horizontal'
  const towerX = compact ? 432 : 425
  const towerY = compact ? 8 : 18
  const towerScale = compact ? .82 : 1
  const textY = compact ? 205 : 260
  const fontSize = compact ? 112 : 128
  const taglineY = compact ? 254 : 322
  const crownX = compact ? 480 : 481
  const crownY = compact ? -4 : -7
  const crownScale = compact ? .7 : .86
  const box = compact ? '0 0 1000 280' : '0 0 1000 350'
  return svg(box, `TaskTower ${kind} logo`, `${d}${sparkleSet}${logoTower(towerX, towerY, towerScale, 'logo', mono ? task : '')}${crown(crownX, crownY, crownScale, 'logo', mono ? task : 'url(#logo-gold)')}${wordmark(textY, fontSize)}<path d="M72 ${taglineY - 7}h96m664 0h96" stroke="${mono ? task : C.purple}" stroke-width="4" stroke-linecap="round"/><text x="500" y="${taglineY}" text-anchor="middle" font-family="Nunito,Arial,DejaVu Sans,sans-serif" font-size="18" font-weight="800" letter-spacing="3" fill="${taglineFill}">DO CHORES. CLIMB TOGETHER. WIN THE MONTH.</text>`)
}

const skins = { fair: '#F4C7A1', light: '#E6AD7E', medium: '#CB8557', tan: '#A76542', dark: '#70412D' }
const outfits = { purple: C.purple, pink: C.pink, blue: C.blue, green: C.mint, yellow: C.warning }

function character({ skin = skins.medium, outfit = C.purple, hair = '#4B2817', style = 'neutral', pose = 'idle', frame = 1 } = {}) {
  const climbing = pose === 'climb'
  const raised = ['arms-up', 'fist-pump', 'jump'].includes(pose)
  const leftY = climbing ? 90 - frame * 4 : raised ? 67 : pose === 'trophy' ? 95 : 145
  const rightY = climbing ? 118 + frame * 2 : (raised || pose === 'wave') ? 64 : pose === 'trophy' ? 95 : 145
  const leftFoot = climbing ? 218 - frame * 5 : pose === 'jump' ? 203 : 221
  const rightFoot = climbing ? 186 + frame * 5 : pose === 'jump' ? 204 : 221
  const hairBack = style === 'female' ? `<path d="M37 76Q28 26 80 23q55 2 46 58l-5 48-22-14 5-54q-28-24-55 1l8 53-22 14Z" fill="${hair}"/>` : ''
  const hairTop = style === 'male' ? `<path d="M40 57q8-38 45-36 33 2 38 31l-19-7-11-14-14 12-17-8-13 21Z" fill="${hair}"/>` : `<path d="M40 59q4-37 40-38 38 0 43 37-13-8-21-21-15 17-31 3-8 13-31 19Z" fill="${hair}"/>`
  return svg('0 0 160 240', `TaskTower character ${pose}`, `${defs('char')}${climbing ? '<path d="M145 25v205" stroke="#6B5E83" stroke-width="5" stroke-linecap="round" stroke-dasharray="4 10"/>' : ''}<g filter="url(#char-shadow)" ${pose === 'jump' ? 'transform="translate(0 -10) rotate(-3 80 130)"' : ''}>${hairBack}<path d="M64 153 58 ${leftFoot}" stroke="${outfit}" stroke-width="22" stroke-linecap="round"/><path d="M96 153 102 ${rightFoot}" stroke="${outfit}" stroke-width="22" stroke-linecap="round"/><path d="M45 ${leftFoot}h27" stroke="#29314E" stroke-width="13" stroke-linecap="round"/><path d="M90 ${rightFoot}h27" stroke="#29314E" stroke-width="13" stroke-linecap="round"/><path d="M50 118q0-23 30-25 30 2 30 25v55H50Z" fill="${outfit}"/><path d="M57 119 38 ${leftY}" stroke="${outfit}" stroke-width="18" stroke-linecap="round"/><path d="M103 119 122 ${rightY}" stroke="${outfit}" stroke-width="18" stroke-linecap="round"/><circle cx="38" cy="${leftY}" r="9" fill="${skin}"/><circle cx="122" cy="${rightY}" r="9" fill="${skin}"/><rect x="69" y="83" width="22" height="25" rx="8" fill="${skin}"/><ellipse cx="80" cy="66" rx="38" ry="42" fill="${skin}" stroke="#8B5038" stroke-opacity=".16" stroke-width="2"/>${hairTop}<ellipse cx="66" cy="67" rx="4" ry="6" fill="${C.navy}"/><ellipse cx="95" cy="67" rx="4" ry="6" fill="${C.navy}"/><path d="M68 82q12 12 25 0" fill="none" stroke="#9A4050" stroke-width="4" stroke-linecap="round"/>${pose === 'silly' ? '<path d="M78 87q7 13 15 2" fill="#E75E72" stroke="#9A4050" stroke-width="2"/>' : ''}<path d="M58 113q22 13 44 0" fill="none" stroke="#FFF" stroke-opacity=".55" stroke-width="5"/>${pose === 'trophy' ? `<g transform="translate(54 72)"><path d="M12 0h28v24q0 18-14 18T12 24Z" fill="url(#char-gold)"/><path d="M12 7H2q0 19 14 20M40 7h10q0 19-14 20" fill="none" stroke="#D58A1D" stroke-width="5"/><path d="M26 42v12m-14 0h28" stroke="#D58A1D" stroke-width="7" stroke-linecap="round"/></g>` : ''}</g>`)
}

function accessory(kind) {
  const shapes = {
    cap: `<path d="M42 57q4-29 39-29 34 1 38 27l-77 2Z" fill="${C.purple}"/><path d="M77 55h56q-8 13-35 13Z" fill="#6545DA"/>`,
    beanie: `<path d="M44 61q0-40 36-40t36 40Z" fill="${C.mint}"/><path d="M40 56h80v18H40Z" rx="9" fill="#3A9B75"/><circle cx="80" cy="18" r="9" fill="${C.mint}"/>`,
    glasses: `<g fill="none" stroke="${C.navy}" stroke-width="5"><circle cx="62" cy="70" r="17"/><circle cx="99" cy="70" r="17"/><path d="M79 70h4m-38-2-12-5m83 5 12-5"/></g>`,
    headphones: `<path d="M44 72q0-45 36-45t36 45" fill="none" stroke="${C.purple}" stroke-width="10"/><rect x="34" y="63" width="20" height="38" rx="9" fill="#2C3156"/><rect x="106" y="63" width="20" height="38" rx="9" fill="#2C3156"/>`,
    crown: crown(53, 15, .95, 'acc'),
    'party-hat': `<path d="m80 15-30 62h60Z" fill="${C.pink}" stroke="#C43E62" stroke-width="3"/><path d="M60 55h39M70 35h19" stroke="#FFD76A" stroke-width="7"/><circle cx="80" cy="12" r="8" fill="#FFD76A"/>`,
    'wizard-hat': `<path d="M48 69 80 8l34 61Z" fill="${C.purpleDeep}"/><path d="M30 68h100q-5 18-50 18T30 68Z" fill="#45269A"/><path d="m78 32 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#FFD76A"/>`,
    backpack: `<path d="M35 112q0-31 30-31h30q30 0 30 31v61H35Z" fill="#F05B5F" stroke="#B93D4C" stroke-width="4"/><path d="M53 86q3-19 27-19t27 19M38 125h84" fill="none" stroke="#733344" stroke-width="6"/><rect x="55" y="131" width="50" height="25" rx="10" fill="#FF8B80"/>`,
  }
  return svg('0 0 160 240', `TaskTower ${kind} accessory`, `${defs('acc')}<g filter="url(#acc-shadow)">${shapes[kind]}</g>`)
}

function fullTower() {
  const floors = Array.from({ length: 8 }, (_, i) => {
    const y = 590 - i * 70
    return `<path d="M28 ${y}h304" stroke="#FFF" stroke-opacity=".28" stroke-width="4"/><rect x="72" y="${y - 47}" width="42" height="45" rx="9" fill="#FFE6A8" stroke="#3B316C" stroke-width="5"/><rect x="246" y="${y - 47}" width="42" height="45" rx="9" fill="#FFE6A8" stroke="#71334D" stroke-width="5"/>`
  }).join('')
  return svg('0 0 360 720', 'TaskTower full split tower', `${defs('tower')}<g filter="url(#tower-shadow)"><path d="M32 650V86q0-20 20-20h128v584Z" fill="url(#tower-purple)"/><path d="M180 650V66h128q20 0 20 20v564Z" fill="url(#tower-pink)"/><path d="M174 66h12v584h-12Z" fill="#FFF" opacity=".88"/>${floors}<path d="M16 650h328v42H16Z" rx="18" fill="#41306D"/>${crown(146, 10, 1.2, 'tower')}</g>`)
}

function floor(side) {
  const left = side === 'left'
  return svg('0 0 180 110', `TaskTower tower floor ${side}`, `${defs('floor')}<path d="M8 105V18Q8 8 20 8h152v97Z" fill="${left ? 'url(#floor-purple)' : 'url(#floor-pink)'}"/><rect x="61" y="28" width="58" height="60" rx="12" fill="#FFE4A6" stroke="${left ? '#3D3473' : '#753049'}" stroke-width="6"/><path d="M8 97h164" stroke="#FFF" stroke-opacity=".42" stroke-width="6"/>`)
}

function marker(kind) {
  const fill = kind === 'winner' ? 'url(#marker-gold)' : kind === 'current' ? C.purple : '#FFF'
  return svg('0 0 96 96', `TaskTower ${kind} floor marker`, `${defs('marker')}<circle cx="48" cy="48" r="38" fill="${fill}" stroke="${kind === 'winner' ? '#D58A1D' : C.purple}" stroke-width="6" filter="url(#marker-shadow)"/>${kind === 'winner' ? crown(29, 30, .68, 'marker') : `<text x="48" y="58" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="29" font-weight="700" fill="${kind === 'current' ? '#FFF' : C.navy}">12</text>`}`)
}

function background(kind) {
  const dark = ['evening', 'night', 'winner'].includes(kind)
  const top = kind === 'night' ? '#11172F' : kind === 'evening' ? '#49356F' : kind === 'winner' ? '#27134E' : kind === 'day' ? '#B9D6FF' : '#F3E8FF'
  const bottom = dark ? '#6A3A78' : '#FFF0DA'
  const houses = Array.from({ length: 5 }, (_, i) => `<g transform="translate(${70 + i * 215} ${1300 + (i % 2) * 80})"><path d="M0 180V55L75 0l75 55v125Z" fill="${i % 2 ? '#FFB7C6' : '#C5B4FF'}" opacity=".8"/><rect x="58" y="105" width="35" height="75" rx="8" fill="#6C4C75"/><rect x="20" y="72" width="30" height="35" rx="6" fill="#FFE9A9"/></g>`).join('')
  const empty = kind.startsWith('empty-state')
  const emptyBody = kind.includes('chores') ? '<path d="M165 180h90m-90 45h90m-90 45h70" stroke="#58BF96" stroke-width="16" stroke-linecap="round"/>' : '<path d="m165 200 45 45 75-90" fill="none" stroke="#FF6B8B" stroke-width="22" stroke-linecap="round"/>'
  return svg('0 0 1080 1920', `TaskTower ${kind} background`, `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient><filter id="bg-shadow"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#3F2D56" flood-opacity=".16"/></filter></defs><rect width="1080" height="1920" fill="url(#bg)"/><g fill="#FFF" opacity=".66"><ellipse cx="170" cy="270" rx="150" ry="66"/><ellipse cx="300" cy="250" rx="100" ry="52"/><ellipse cx="850" cy="390" rx="170" ry="74"/></g><path d="M0 1530q220-210 430 0 220-260 650-40v430H0Z" fill="${dark ? '#23365B' : '#B7D4A1'}" opacity=".72"/>${houses}<g fill="#416B5F"><circle cx="95" cy="1570" r="92"/><circle cx="970" cy="1510" r="115"/><circle cx="820" cy="1630" r="84"/></g>${empty ? `<g transform="translate(330 650)" filter="url(#bg-shadow)"><path d="M0 360V120L210 0l210 120v240Z" fill="#FFF" opacity=".9"/><path d="M150 360V220h120v140" fill="${C.purple}"/><path d="M0 120 210 0l210 120" fill="none" stroke="${C.navy}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>${emptyBody}</g>` : ''}${kind === 'winner' ? `<g fill="#FFD76A"><circle cx="190" cy="560" r="12"/><circle cx="890" cy="720" r="15"/><path d="m290 430 14 29 32 5-23 22 5 32-28-15-29 15 6-32-24-22 32-5Z"/><path d="m800 520 14 29 32 5-23 22 5 32-28-15-29 15 6-32-24-22 32-5Z"/></g>` : ''}`)
}

function iconSvg(Icon, name, tone = 'purple') {
  const raw = renderToStaticMarkup(React.createElement(Icon, { strokeWidth: 2, 'aria-hidden': true }))
  const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const tones = { purple: [C.purpleDeep, '#F0EBFF'], pink: ['#C83E62', '#FFE9EF'], mint: ['#347C60', '#E7F7EF'], blue: ['#3E72B7', '#E9F1FF'], yellow: ['#A96916', '#FFF0CD'], red: ['#B53E54', '#FFE8ED'] }
  const [stroke, fill] = tones[tone]
  return svg('0 0 24 24', `TaskTower ${name} icon`, `<rect x=".75" y=".75" width="22.5" height="22.5" rx="6.5" fill="${fill}"/><g color="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`, 'width="64" height="64"')
}

function effect(kind) {
  const bodies = {
    confetti: Array.from({ length: 28 }, (_, i) => `<rect x="${20 + (i * 37) % 470}" y="${15 + (i * 61) % 460}" width="10" height="22" rx="4" fill="${[C.purple, C.pink, C.warning, C.blue][i % 4]}" transform="rotate(${i * 17} ${20 + (i * 37) % 470} ${15 + (i * 61) % 460})"/>`).join(''),
    fireworks: `<g fill="none" stroke-linecap="round"><g stroke="${C.purple}" stroke-width="8">${Array.from({ length: 12 }, (_, i) => `<path d="M160 160 160 35" transform="rotate(${i * 30} 160 160)"/>`).join('')}</g><g transform="translate(270 260) scale(.65)" stroke="${C.pink}" stroke-width="9">${Array.from({ length: 10 }, (_, i) => `<path d="M160 160 160 35" transform="rotate(${i * 36} 160 160)"/>`).join('')}</g></g>`,
    sparkles: '<g fill="url(#fx-gold)"><path d="m100 25 22 53 53 22-53 22-22 53-22-53-53-22 53-22Z"/><path d="m360 210 16 38 38 16-38 16-16 38-16-38-38-16 38-16Z"/><path d="m210 330 11 27 27 11-27 11-11 27-11-27-27-11 27-11Z"/></g>',
    'level-up-burst': '<path d="m256 18 38 125 113-67-68 112 126 39-126 38 68 113-113-68-38 126-39-126-112 68 67-113-125-38 125-39-67-112 112 67Z" fill="url(#fx-gold)" opacity=".9"/><circle cx="256" cy="227" r="104" fill="#FFF8D9"/>',
    'trophy-shine': '<circle cx="256" cy="256" r="90" fill="none" stroke="url(#fx-gold)" stroke-width="18" stroke-dasharray="20 28"/><path d="M256 25v75M256 412v75M25 256h75M412 256h75" stroke="#FFD76A" stroke-width="14" stroke-linecap="round"/>',
    'floor-glow': '<defs><radialGradient id="glow"><stop stop-color="#FFD76A" stop-opacity=".9"/><stop offset="1" stop-color="#FFD76A" stop-opacity="0"/></radialGradient></defs><ellipse cx="256" cy="300" rx="210" ry="100" fill="url(#glow)"/>',
    'soft-cloud': '<g fill="#FFF" opacity=".92"><ellipse cx="170" cy="280" rx="125" ry="90"/><ellipse cx="285" cy="235" rx="145" ry="120"/><ellipse cx="390" cy="295" rx="105" ry="78"/><rect x="80" y="285" width="370" height="92" rx="46"/></g>',
    'dust-puff': '<g fill="#D9D2E5" opacity=".75"><circle cx="120" cy="300" r="55"/><circle cx="190" cy="255" r="80"/><circle cx="285" cy="280" r="98"/><circle cx="390" cy="310" r="62"/><circle cx="260" cy="370" r="55"/></g>',
  }
  return svg('0 0 512 512', `TaskTower ${kind} effect`, `${defs('fx')}${bodies[kind]}`)
}

async function pngFromSvg(content, file, width) {
  const target = path.join(root, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await sharp(Buffer.from(content)).resize({ width }).png({ compressionLevel: 9 }).toFile(target)
}

async function buildVisualAssets() {
  await Promise.all(dirs.map((dir) => fs.mkdir(path.join(root, dir), { recursive: true })))
  const logoSet = {
    'tasktower-logo-primary.svg': logo('primary'),
    'tasktower-logo-horizontal.svg': logo('horizontal'),
    'tasktower-logo-stacked.svg': logo('stacked'),
    'tasktower-logo-monochrome-dark.svg': logo('monochrome-dark'),
    'tasktower-logo-monochrome-light.svg': logo('monochrome-light'),
    'tasktower-wordmark.svg': logo('wordmark'),
  }
  for (const [name, content] of Object.entries(logoSet)) await write(`logos/${name}`, content)
  await pngFromSvg(logoSet['tasktower-logo-primary.svg'], 'logos/tasktower-logo-primary.png', 1800)
  await pngFromSvg(logoSet['tasktower-logo-horizontal.svg'], 'logos/tasktower-logo-horizontal.png', 1800)
  await pngFromSvg(logoSet['tasktower-logo-stacked.svg'], 'logos/tasktower-logo-stacked.png', 1200)
  await pngFromSvg(logoSet['tasktower-wordmark.svg'], 'logos/tasktower-wordmark.png', 1800)

  await write('app-icon/icon-foreground.svg', svg('0 0 432 432', 'TaskTower adaptive icon foreground', `${defs('icon')}${towerMark(108, 135, 1.5, 'icon')}${crown(174, 78, 1.5, 'icon')}`))
  await write('app-icon/icon-background.svg', svg('0 0 432 432', 'TaskTower adaptive icon background', '<defs><linearGradient id="icon-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#191249"/><stop offset=".55" stop-color="#35217B"/><stop offset="1" stop-color="#5A2C88"/></linearGradient></defs><rect width="432" height="432" fill="url(#icon-bg)"/><g fill="#FFD76A"><circle cx="72" cy="105" r="7"/><circle cx="354" cy="120" r="5"/><path d="m340 286 8 18 18 8-18 8-8 18-8-18-18-8 18-8Z"/></g>'))
  for (const size of [1024, 512, 192]) await sharp(path.resolve('resources/icon.png')).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(path.join(root, `app-icon/icon-${size}.png`))

  const splashLogo = logo('stacked')
  await write('splash/splash-logo.svg', splashLogo)
  await write('splash/splash-background.svg', svg('0 0 1080 1920', 'TaskTower splash background', '<defs><linearGradient id="splash-bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#F6ECFF"/><stop offset=".55" stop-color="#FFF8ED"/><stop offset="1" stop-color="#FFE6EC"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#splash-bg)"/><g fill="#FFF" opacity=".7"><ellipse cx="175" cy="430" rx="190" ry="90"/><ellipse cx="920" cy="570" rx="220" ry="105"/></g><path d="M0 1700q270-240 540 0 300-300 540-40v260H0Z" fill="#C9DEB6" opacity=".65"/>'))
  const splash = (dark) => svg('0 0 1080 1920', `TaskTower ${dark ? 'dark' : 'light'} splash`, `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${dark ? '#181334' : '#F4ECFF'}"/><stop offset="1" stop-color="${dark ? '#35234D' : '#FFF1E7'}"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#s)"/>${towerMark(432, 510, 1.65, 'logo')}${crown(503, 448, 1.35)}<text x="540" y="930" text-anchor="middle" font-family="Fredoka,Arial Rounded MT Bold,DejaVu Sans,sans-serif" font-size="116" font-weight="700" letter-spacing="-6"><tspan fill="${dark ? '#FFF' : C.navy}">TASK</tspan><tspan fill="${C.purple}">TOWER</tspan></text><text x="540" y="1010" text-anchor="middle" font-family="Nunito,Arial,DejaVu Sans,sans-serif" font-size="30" font-weight="700" fill="${dark ? '#D9D0EA' : C.muted}">Make home life more fun.</text>`)
  await pngFromSvg(splash(false), 'splash/splash-light.png', 1080)
  await pngFromSvg(splash(true), 'splash/splash-dark.png', 1080)

  for (const [name, style] of Object.entries({ male: 'male', female: 'female', neutral: 'neutral' })) await write(`characters/idle/character-base-${name}.svg`, character({ style }))
  for (const [name, skin] of Object.entries(skins)) await write(`characters/idle/skin-${name}.svg`, character({ skin }))
  for (const [name, outfit] of Object.entries(outfits)) await write(`characters/idle/outfit-${name}.svg`, character({ outfit }))
  for (let i = 1; i <= 5; i += 1) await write(`characters/climbing/climb-frame-${String(i).padStart(2, '0')}.svg`, character({ pose: 'climb', frame: i }))
  for (const pose of ['arms-up', 'fist-pump', 'jump', 'trophy', 'wave', 'silly']) await write(`characters/celebrations/celebrate-${pose}.svg`, character({ pose }))
  for (const item of ['cap', 'beanie', 'glasses', 'headphones', 'crown', 'party-hat', 'wizard-hat', 'backpack']) await write(`characters/accessories/${item}.svg`, accessory(item))
}

async function buildGameAssets() {
  await write('tower/tower-split-full.svg', fullTower())
  const zoomFloors = Array.from({ length: 6 }, (_, i) => `<path d="M32 ${70 + i * 85}h296" stroke="#FFF" stroke-opacity=".28" stroke-width="4"/><rect x="72" y="${15 + i * 85}" width="42" height="45" rx="9" fill="#FFE6A8"/><rect x="246" y="${15 + i * 85}" width="42" height="45" rx="9" fill="#FFE6A8"/>`).join('')
  await write('tower/tower-split-zoom-section.svg', svg('0 0 360 520', 'TaskTower zoomed split tower', `${defs('zoom')}<path d="M32 540V0h148v540Z" fill="url(#zoom-purple)"/><path d="M180 540V0h148v540Z" fill="url(#zoom-pink)"/><path d="M174 0h12v540h-12Z" fill="#FFF" opacity=".88"/>${zoomFloors}`))
  await write('tower/tower-floor-left.svg', floor('left'))
  await write('tower/tower-floor-right.svg', floor('right'))
  await write('tower/tower-floor-center-divider.svg', svg('0 0 32 120', 'TaskTower tower divider', '<rect x="10" width="12" height="120" rx="6" fill="#FFF" opacity=".9"/>'))
  await write('tower/tower-roof-celebration.svg', svg('0 0 360 180', 'TaskTower roof celebration platform', `${defs('roof')}<path d="M30 145h300v30H30Z" rx="15" fill="#4C396D"/><path d="M80 145V75h200v70Z" fill="url(#roof-purple)"/>${crown(152, 15, 1, 'roof')}`))
  await write('tower/tower-base.svg', svg('0 0 360 150', 'TaskTower tower base', '<path d="M16 60h328v72H16Z" rx="22" fill="#49396C"/><path d="M0 130h360v20H0Z" fill="#2F284D"/><circle cx="42" cy="72" r="38" fill="#5F8A71"/><circle cx="320" cy="80" r="44" fill="#7EA17D"/>'))
  await write('tower/floor-marker-default.svg', marker('default'))
  await write('tower/floor-marker-current.svg', marker('current'))
  await write('tower/floor-marker-winner.svg', marker('winner'))

  const backgroundSet = { 'main-menu-background.svg': 'menu', 'house-page-background.svg': 'house', 'tower-background-day.svg': 'day', 'tower-background-evening.svg': 'evening', 'tower-background-night.svg': 'night', 'empty-state-house.svg': 'empty-state-house', 'empty-state-chores.svg': 'empty-state-chores', 'winner-background.svg': 'winner' }
  for (const [file, kind] of Object.entries(backgroundSet)) await write(`backgrounds/${file}`, background(kind))

  const icons = {
    'icon-home.svg': [House, 'home', 'purple'], 'icon-add-house.svg': [HousePlus, 'add house', 'pink'], 'icon-join-house.svg': [KeyRound, 'join house', 'yellow'], 'icon-settings.svg': [Settings, 'settings', 'purple'], 'icon-back.svg': [ArrowLeft, 'back', 'blue'], 'icon-chores.svg': [CircleCheckBig, 'chores', 'mint'], 'icon-tower.svg': [Castle, 'tower', 'purple'], 'icon-leaderboard.svg': [Medal, 'leaderboard', 'yellow'], 'icon-profile.svg': [UserRound, 'profile', 'pink'], 'icon-notifications.svg': [Bell, 'notifications', 'yellow'], 'icon-logout.svg': [LogOut, 'logout', 'red'], 'icon-add.svg': [Plus, 'add', 'purple'], 'icon-edit.svg': [Edit3, 'edit', 'blue'], 'icon-delete.svg': [Trash2, 'delete', 'red'], 'icon-save.svg': [Save, 'save', 'mint'], 'icon-share.svg': [Share2, 'share', 'blue'], 'icon-invite.svg': [Users, 'invite', 'pink'],
    'chore-kitchen.svg': [CookingPot, 'kitchen chore', 'yellow'], 'chore-bathroom.svg': [Bath, 'bathroom chore', 'blue'], 'chore-laundry.svg': [WashingMachine, 'laundry chore', 'blue'], 'chore-living-room.svg': [Sofa, 'living room chore', 'pink'], 'chore-bedroom.svg': [BedDouble, 'bedroom chore', 'purple'], 'chore-garden.svg': [Sprout, 'garden chore', 'mint'], 'chore-bins.svg': [Trash2, 'bins chore', 'red'], 'chore-pet-care.svg': [PawPrint, 'pet care chore', 'yellow'], 'chore-car.svg': [Car, 'car chore', 'blue'], 'chore-general.svg': [ChefHat, 'general chore', 'purple'],
    'status-done.svg': [CircleCheckBig, 'done status', 'mint'], 'status-due-soon.svg': [Clock3, 'due soon status', 'yellow'], 'status-overdue.svg': [CircleAlert, 'overdue status', 'red'], 'status-full-clean.svg': [Sparkles, 'full clean status', 'purple'],
  }
  for (const [file, [Icon, name, tone]] of Object.entries(icons)) await write(`icons/${file}`, iconSvg(Icon, name, tone))
  for (const name of ['confetti', 'fireworks', 'sparkles', 'level-up-burst', 'trophy-shine', 'floor-glow', 'soft-cloud', 'dust-puff']) await write(`effects/${name}.svg`, effect(name))
}

async function buildDocumentation() {
  const tokens = {
    meta: { name: 'TaskTower cosy pastel', version: '1.0.0' },
    color: C,
    radius: { sm: '14px', md: '20px', lg: '28px', pill: '999px' },
    shadow: { sm: '0 8px 24px rgba(63,45,86,.07)', md: '0 18px 45px rgba(63,45,86,.12)', glow: '0 0 28px rgba(124,92,255,.28)' },
    gradient: { primary: 'linear-gradient(135deg,#7C5CFF,#FF6B8B)', purple: 'linear-gradient(135deg,#9B7BFF,#6545DA)', warm: 'linear-gradient(180deg,#F4ECFF,#FFF1E7)' },
    motion: { quick: '160ms', standard: '240ms', climb: '650ms', celebration: '1100ms' },
  }
  await write('branding/colour-tokens.json', `${JSON.stringify(tokens, null, 2)}\n`)
  const swatches = Object.entries(C).map(([name, value], i) => {
    const x = 50 + (i % 4) * 260
    const y = 70 + Math.floor(i / 4) * 150
    return `<g transform="translate(${x} ${y})"><rect width="220" height="92" rx="24" fill="${value}" stroke="#DAD4E1"/><text y="120" font-family="Arial,DejaVu Sans,sans-serif" font-size="20" font-weight="800" fill="${C.navy}">${name}</text><text y="145" font-family="DejaVu Sans Mono,monospace" font-size="16" fill="${C.muted}">${value}</text></g>`
  }).join('')
  const palette = svg('0 0 1080 800', 'TaskTower colour palette', `<rect width="1080" height="800" rx="42" fill="#FFFDFB"/><text x="50" y="42" font-family="Arial,DejaVu Sans,sans-serif" font-size="27" font-weight="700" fill="${C.navy}">TaskTower colour system</text>${swatches}`)
  await write('branding/colour-palette.svg', palette)
  await pngFromSvg(palette, 'branding/colour-palette.png', 1080)

  await write('app-icon/adaptive-icon-notes.md', ['# Adaptive icon notes', '', '- Foreground safe zone: central 66% of the 432×432 viewBox.', '- Background is full bleed.', '- Android package: `app.tasktower.home`.', '- Use `icon-1024.png` as the Capacitor source, or the separate foreground/background SVGs in an adaptive-icon pipeline.', '- Never add the tagline to launcher icons.'].join('\n'))
  await write('splash/splash-notes.md', ['# Splash notes', '', 'The PNGs are 1080×1920 and ready for `@capacitor/splash-screen`.', 'Keep the logo within the middle 60% so Android portrait and landscape crops remain safe.', 'Use light or dark according to the app theme; do not animate the native launch screen.'].join('\n'))
  await write('characters/climbing/climb-sequence-notes.md', ['# Climb sequence', '', 'All frames use `viewBox="0 0 160 240"`.', 'Render at one fixed CSS size and advance frames every 110–140 ms while easing the character container upward over 650 ms.', 'For `prefers-reduced-motion`, display frame 05 without animation.'].join('\n'))
  await write('tower/tower-component-guide.md', ['# Tower component guide', '', 'The complete tower uses `viewBox="0 0 360 720"`; floor modules use `0 0 180 110`.', 'Repeat left and right floor modules behind the centre divider for configurable heights, then add one base and roof.', 'Position a player marker with `bottom = 8% + (floors / towerHeight) * 82%`.', 'Use the zoom section as a clipped viewport around nearby players.'].join('\n'))

  await write('branding/typography-guide.md', ['# Typography', '', '## Recommended pairing', '', '- **Heading:** Fredoka 600–700. Rounded, confident and friendly without feeling childish.', '- **Body/UI:** Nunito 400–800. Highly legible on compact Android screens.', '- Both are free under the SIL Open Font License.', '', '| Role | Family | Size | Weight | Line height |', '|---|---|---:|---:|---:|', '| Display | Fredoka | 40 | 700 | 1.05 |', '| Page title | Fredoka | 24 | 650 | 1.15 |', '| Section title | Fredoka | 18 | 650 | 1.2 |', '| Body | Nunito | 15 | 500 | 1.5 |', '| Label | Nunito | 12 | 800 | 1.25 |', '| Microcopy | Nunito | 10 | 700 | 1.35 |'].join('\n'))
  await write('branding/design-system.md', ['# TaskTower design system', '', 'TaskTower is warm, capable and gently competitive. Use cream surfaces, navy copy and purple/pink emphasis.', 'Green celebrates completion; yellow signals approaching work; overdue red is always paired with a soft tint.', '', '## Shape and depth', '', 'Cards use 20–28 px radii, buttons 14–16 px and pills 999 px. Use one soft shadow per elevation.', 'Illustration outlines use translucent navy rather than hard black.', '', '## Mobile layout', '', 'Design at 390×844 first. Keep important illustration content inside the central 72% and maintain 24 px safe padding.'].join('\n'))
  await write('branding/asset-usage-guide.md', ['# Asset usage guide', '', '- SVG is the source of truth; PNG is a delivery export.', '- Preserve all SVG viewBoxes and never stretch characters non-uniformly.', '- Backgrounds may crop with `object-fit: cover`; logos and characters may not.', '- Decorative effects should use `aria-hidden="true"`.', '- Names are lowercase, kebab-case and semantic.', '- Copy this folder to `src/assets/tasktower` or expose it from `public/tasktower`.'].join('\n'))
  await write('branding/icon-style-guide.md', ['# Icon style guide', '', 'Icons derive from Lucide under the MIT License: https://lucide.dev/', 'They use a 24×24 viewBox, 2 px rounded strokes and a soft rounded-square tint.', 'Use at 20–24 CSS px for controls and 40–64 px for category tiles.', 'Do not mix filled glyphs into the navigation family.'].join('\n'))
  await write('branding/character-style-guide.md', ['# Character style guide', '', 'Every character uses `viewBox="0 0 160 240"`, the same baseline, head size, eye style and torso proportions.', 'Skin, hair, outfit and accessory layers align across poses.', 'Use one accessory at a time unless a celebration explicitly adds a crown or trophy.'].join('\n'))
  await write('branding/tower-style-guide.md', ['# Tower style guide', '', 'The tower is always purple-left and pink-right with a bright centre divider.', 'Windows glow warm cream and structure outlines use translucent navy.', 'Reserve the gold crown for the roof or current winner.'].join('\n'))

  const reactExamples = [
    '# React usage examples', '', '## Public URL', '', '```jsx', '<img src="/tasktower/characters/idle/outfit-purple.svg" alt="Your TaskTower character" />', '```', '',
    '## Vite source import', '', '```jsx', "import towerUrl from './assets/tasktower/tower/tower-split-full.svg'", 'export function Tower() { return <img src={towerUrl} alt="Monthly split tower" /> }', '```', '',
    '## SVGR component (optional)', '', '```jsx', "import Character from './assets/tasktower/characters/idle/character-base-neutral.svg?react'", 'export function Player() { return <Character className="h-40 w-auto" aria-label="Player" /> }', '```', '',
    '## Theme tokens', '', '```js', "import tokens from './assets/tasktower/branding/colour-tokens.json' with { type: 'json' }", "document.documentElement.style.setProperty('--tt-primary', tokens.color.purple)", '```', '',
    '## Celebration overlay', '', '```jsx', '{celebrating && <img aria-hidden src="/tasktower/effects/confetti.svg" className="pointer-events-none absolute inset-0" />}', '```', '',
    'Use the five climbing frames as CSS backgrounds or timed React state. For reduced motion, render frame 05 only.',
  ]
  await write('branding/react-usage-examples.md', reactExamples.join('\n'))
  await write('branding/tailwind-theme-extension.js', `export const taskTowerTheme = {
  colors: ${JSON.stringify(C, null, 2)},
  fontFamily: { display: ['Fredoka', 'ui-rounded', 'sans-serif'], body: ['Nunito', 'system-ui', 'sans-serif'] },
  borderRadius: { ttSm: '14px', tt: '20px', ttLg: '28px' },
  boxShadow: { ttSm: '0 8px 24px rgba(63,45,86,.07)', tt: '0 18px 45px rgba(63,45,86,.12)', ttGlow: '0 0 28px rgba(124,92,255,.28)' },
  backgroundImage: { 'tt-primary': 'linear-gradient(135deg,#7C5CFF,#FF6B8B)', 'tt-warm': 'linear-gradient(180deg,#F4ECFF,#FFF1E7)' },
  transitionDuration: { ttQuick: '160ms', tt: '240ms', ttClimb: '650ms' },
}
`)
  await write('README.md', ['# TaskTower Asset Library', '', 'A production-ready SVG-first UI and game-art system for the TaskTower React/Vite/Capacitor app.', '', '- Source format: SVG', '- Delivery raster format: PNG', '- Icon source: Lucide, MIT License', '- Recommended fonts: Fredoka + Nunito', '- Generator: `npm run assets:build` from the TaskTower repository', '', 'See `ASSET_INDEX.md` and the guides under `branding/`.'].join('\n'))
}

async function buildPreview() {
  const raster = async (file, width, height) => sharp(path.join(root, file)).resize({ width, height, fit: 'contain' }).png().toBuffer()
  const label = (text, x, y) => ({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="50"><text x="0" y="34" font-family="Arial,DejaVu Sans,sans-serif" font-size="25" font-weight="700" fill="#172244">${text}</text></svg>`), left: x, top: y })
  const composites = [
    { input: await raster('logos/tasktower-logo-horizontal.svg', 900, 250), left: 50, top: 25 },
    label('Modular characters', 70, 280),
    { input: await raster('characters/idle/character-base-male.svg', 150, 225), left: 55, top: 330 },
    { input: await raster('characters/idle/character-base-female.svg', 150, 225), left: 205, top: 330 },
    { input: await raster('characters/idle/skin-dark.svg', 150, 225), left: 355, top: 330 },
    { input: await raster('characters/celebrations/celebrate-trophy.svg', 150, 225), left: 505, top: 330 },
    label('Split tower system', 700, 280),
    { input: await raster('tower/tower-split-full.svg', 270, 540), left: 700, top: 330 },
    label('Icon family', 1010, 280),
  ]
  const previewIcons = ['icon-home.svg', 'icon-chores.svg', 'icon-tower.svg', 'icon-leaderboard.svg', 'chore-kitchen.svg', 'chore-laundry.svg', 'status-done.svg', 'status-overdue.svg']
  for (let i = 0; i < previewIcons.length; i += 1) composites.push({ input: await raster(`icons/${previewIcons[i]}`, 100, 100), left: 1010 + (i % 3) * 120, top: 340 + Math.floor(i / 3) * 120 })
  await sharp({ create: { width: 1400, height: 920, channels: 4, background: '#F8F5FB' } }).composite(composites).png({ compressionLevel: 9 }).toFile(path.join(root, 'branding/asset-library-preview.png'))
}

async function buildIndex() {
  const list = []
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(absolute)
      else list.push(path.relative(root, absolute).replaceAll('\\', '/'))
    }
  }
  await walk(root)
  list.sort()
  await write('branding/asset-manifest.json', `${JSON.stringify({ version: '1.0.0', files: list }, null, 2)}\n`)
  await write('ASSET_INDEX.md', ['# TaskTower Asset Library v1.0', '', `${list.length} production files generated from one token system.`, '', '## Full folder tree', '', ...list.map((file) => `- \`${file}\``)].join('\n'))
}

await buildVisualAssets()
await buildGameAssets()
await buildDocumentation()
await buildPreview()
await buildIndex()
console.log(`TaskTower asset library built at ${root}`)
