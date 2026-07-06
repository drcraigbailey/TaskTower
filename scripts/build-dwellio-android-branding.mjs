import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve('.')
const sourceLogo = path.join(root, 'source-assets', 'branding', 'dwellio-logo.svg')
const assetsDir = path.join(root, 'assets')
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res')

const colours = {
  mint: '#67BFA7',
  charcoal: '#26333A',
  ivory: '#FBF9F4',
  ivoryEdge: '#F1EDE5',
  text: '#4B5357',
}

const logoSource = await fs.readFile(sourceLogo, 'utf8')
const paths = [...logoSource.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g)].map((match) => match[1])

if (paths.length !== 15) {
  throw new Error(`Expected 15 paths in the Dwellio logo, found ${paths.length}`)
}

const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
const pathNode = (index, fill) => `<path fill="${fill}" d="${esc(paths[index])}"/>`

const markNodes = [
  pathNode(0, colours.mint),
  pathNode(1, colours.mint),
  pathNode(2, colours.charcoal),
  pathNode(10, colours.mint),
  pathNode(11, colours.mint),
  pathNode(12, colours.mint),
  pathNode(13, colours.mint),
].join('\n')

const logoNodes = paths.map((_, index) => {
  const mint = [0, 1, 10, 11, 12, 13, 14].includes(index)
  return pathNode(index, mint ? colours.mint : colours.charcoal)
}).join('\n')

const markSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="55 55 270 285">
  ${markNodes}
</svg>`

const logoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 432">
  ${logoNodes}
</svg>`

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true })
const writeText = async (file, content) => {
  await ensureDir(path.dirname(file))
  await fs.writeFile(file, content)
}

await ensureDir(assetsDir)
await writeText(path.join(assetsDir, 'dwellio-mark.svg'), markSvg)
await writeText(path.join(assetsDir, 'dwellio-logo-colour.svg'), logoSvg)

const iconBackgroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="48%" cy="40%" r="78%">
      <stop offset="0" stop-color="#FFFEFA"/>
      <stop offset="1" stop-color="#F3EEE5"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>`

const iconOnlySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="page" cx="48%" cy="40%" r="78%">
      <stop offset="0" stop-color="#FFFEFA"/>
      <stop offset="1" stop-color="#F4EFE7"/>
    </radialGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFDF9"/>
      <stop offset="1" stop-color="#FAF7F1"/>
    </linearGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="200%">
      <feDropShadow dx="0" dy="27" stdDeviation="25" flood-color="#26333A" flood-opacity="0.19"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#page)"/>
  <rect x="80" y="72" width="864" height="864" rx="190" fill="url(#card)" stroke="#EEE9E0" stroke-width="3" filter="url(#shadow)"/>
  <g transform="translate(222 205) scale(2.15)">
    ${markNodes}
  </g>
</svg>`

const iconForegroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(222 205) scale(2.15)">
    ${markNodes}
  </g>
</svg>`

const roomScene = (width, height, logoY, logoWidth, taglineSize) => {
  const logoScale = logoWidth / 1024
  const logoHeight = 432 * logoScale
  const logoX = (width - logoWidth) / 2
  const taglineY = logoY + logoHeight + taglineSize * 0.75
  const floorY = height * 0.88
  return `
  <defs>
    <radialGradient id="roomBg" cx="48%" cy="38%" r="80%">
      <stop offset="0" stop-color="#FFFEFA"/>
      <stop offset="1" stop-color="#F5F1E9"/>
    </radialGradient>
    <linearGradient id="furn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E9E4DB"/>
      <stop offset="1" stop-color="#DCD5CA"/>
    </linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="180%" height="190%">
      <feGaussianBlur stdDeviation="15"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#roomBg)"/>

  <!-- hanging lamp -->
  <g opacity="0.58" fill="#DDD7CD" stroke="#D7D1C7">
    <line x1="${width * 0.85}" y1="0" x2="${width * 0.85}" y2="${height * 0.19}" stroke-width="5"/>
    <rect x="${width * 0.83}" y="${height * 0.18}" width="${width * 0.04}" height="${height * 0.025}" rx="12"/>
    <path d="M ${width * 0.74} ${height * 0.245} Q ${width * 0.85} ${height * 0.16} ${width * 0.96} ${height * 0.245} Z"/>
    <ellipse cx="${width * 0.85}" cy="${height * 0.246}" rx="${width * 0.11}" ry="${height * 0.012}" fill="#E7E1D8"/>
  </g>

  <!-- plant -->
  <g opacity="0.53" fill="#DED8CD" stroke="#D3CCC1" stroke-width="3">
    <path d="M ${width * 0.12} ${floorY} Q ${width * 0.13} ${height * 0.72} ${width * 0.17} ${height * 0.61}" fill="none" stroke-width="7"/>
    ${[
      [0.13,0.75,-40],[0.16,0.71,38],[0.12,0.69,-42],[0.18,0.66,42],
      [0.14,0.63,-30],[0.19,0.60,36],[0.16,0.56,-8],
    ].map(([x,y,r]) => `<ellipse cx="${width*x}" cy="${height*y}" rx="${width*0.035}" ry="${height*0.022}" transform="rotate(${r} ${width*x} ${height*y})"/>`).join('')}
    <path d="M ${width * 0.075} ${floorY - height * 0.04} Q ${width * 0.13} ${floorY - height * 0.065} ${width * 0.185} ${floorY - height * 0.04} L ${width * 0.17} ${floorY + height * 0.035} Q ${width * 0.13} ${floorY + height * 0.06} ${width * 0.09} ${floorY + height * 0.035} Z" fill="#E9E4DB"/>
  </g>

  <!-- sofa and rug -->
  <g opacity="0.56">
    <ellipse cx="${width * 0.72}" cy="${height * 0.93}" rx="${width * 0.32}" ry="${height * 0.035}" fill="#D8D1C6" opacity="0.38" filter="url(#softShadow)"/>
    <path d="M ${width * 0.33} ${height * 0.91} L ${width * 0.97} ${height * 0.91} L ${width} ${height} L ${width * 0.27} ${height} Z" fill="#E4DED4" opacity="0.56"/>
    <rect x="${width * 0.42}" y="${height * 0.72}" width="${width * 0.57}" height="${height * 0.13}" rx="${width * 0.055}" fill="url(#furn)"/>
    <rect x="${width * 0.37}" y="${height * 0.79}" width="${width * 0.62}" height="${height * 0.12}" rx="${width * 0.045}" fill="#ECE7DF" stroke="#DCD5CA" stroke-width="4"/>
    <rect x="${width * 0.31}" y="${height * 0.77}" width="${width * 0.12}" height="${height * 0.14}" rx="${width * 0.04}" fill="#E7E1D8"/>
    <rect x="${width * 0.52}" y="${height * 0.76}" width="${width * 0.17}" height="${height * 0.10}" rx="${width * 0.025}" fill="#E1DBD1" transform="rotate(-5 ${width * 0.605} ${height * 0.81})"/>
    <path d="M ${width * 0.39} ${height * 0.90} L ${width * 0.37} ${height * 0.96} L ${width * 0.40} ${height * 0.96} L ${width * 0.42} ${height * 0.90} Z" fill="#CFC7BB"/>
    <path d="M ${width * 0.87} ${height * 0.90} L ${width * 0.89} ${height * 0.96} L ${width * 0.92} ${height * 0.96} L ${width * 0.90} ${height * 0.90} Z" fill="#CFC7BB"/>
  </g>

  <!-- exact supplied logo -->
  <g transform="translate(${logoX} ${logoY}) scale(${logoScale})">
    ${logoNodes}
  </g>
  <text x="${width / 2}" y="${taglineY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${taglineSize}" fill="${colours.text}">A cleaner home.</text>
  <text x="${width / 2}" y="${taglineY + taglineSize * 1.38}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${taglineSize}" fill="${colours.text}">A happier home.</text>
  `
}

const portraitSplashSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="3200" viewBox="0 0 1440 3200">
  ${roomScene(1440, 3200, 1210, 980, 66)}
</svg>`

const squareSplashSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  ${roomScene(2732, 2732, 820, 1500, 92)}
</svg>`

await sharp(Buffer.from(iconBackgroundSvg)).png().toFile(path.join(assetsDir, 'icon-background.png'))
await sharp(Buffer.from(iconForegroundSvg)).png().toFile(path.join(assetsDir, 'icon-foreground.png'))
await sharp(Buffer.from(iconOnlySvg)).png().toFile(path.join(assetsDir, 'icon-only.png'))
await sharp(Buffer.from(iconOnlySvg)).resize(512, 512).png().toFile(path.join(assetsDir, 'play-store-icon-512.png'))
await sharp(Buffer.from(squareSplashSvg)).png().toFile(path.join(assetsDir, 'splash.png'))
await sharp(Buffer.from(portraitSplashSvg)).png().toFile(path.join(assetsDir, 'splash-portrait.png'))

const densitySizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

const iconOnlyBuffer = await sharp(Buffer.from(iconOnlySvg)).png().toBuffer()
const iconForegroundBuffer = await sharp(Buffer.from(iconForegroundSvg)).png().toBuffer()
const iconBackgroundBuffer = await sharp(Buffer.from(iconBackgroundSvg)).png().toBuffer()

for (const [density, size] of Object.entries(densitySizes)) {
  const dir = path.join(androidRes, `mipmap-${density}`)
  await ensureDir(dir)
  await sharp(iconOnlyBuffer).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'))
  await sharp(iconOnlyBuffer).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_round.png'))
  await sharp(iconForegroundBuffer).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_foreground.png'))
  await sharp(iconBackgroundBuffer).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_background.png'))
}

const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`

await writeText(path.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIcon)
await writeText(path.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIcon)
await ensureDir(path.join(androidRes, 'drawable'))
await sharp(Buffer.from(portraitSplashSvg)).png().toFile(path.join(androidRes, 'drawable', 'splash.png'))

console.log('Generated Dwellio Android icon and splash assets from the supplied SVG.')
