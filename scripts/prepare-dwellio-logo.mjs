import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const sourceUrl = new URL('../src/assets/branding/dwellio/logo-source.svg', import.meta.url)
const outputUrl = new URL('../src/assets/branding/dwellio/logo.svg', import.meta.url)
const source = await readFile(sourceUrl, 'utf8')

const greenPaths = new Set([0, 1, 10, 11, 12, 13, 14])
let pathIndex = 0

const coloured = source
  .replace('<svg ', '<svg role="img" aria-label="Dwellio" ')
  .replace(/fill="#000000"/g, () => {
    const colour = greenPaths.has(pathIndex) ? '#35B89F' : '#1F2D3D'
    pathIndex += 1
    return `fill="${colour}"`
  })
  .split(/\r?\n/)
  .map((line) => line.trimEnd())
  .join('\n')

await writeFile(outputUrl, coloured)

const paths = coloured.match(/<path[\s\S]*?\/>/g) || []
const iconPaths = [0, 1, 2, 10, 11, 12, 13].map((index) => paths[index]).join('\n')
const icon = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dwellio app icon" viewBox="65 65 255 265">${iconPaths}</svg>`
const iconUrl = new URL('../src/assets/branding/dwellio/icon.svg', import.meta.url)
await writeFile(iconUrl, icon)
await writeFile(new URL('../public/favicon.svg', import.meta.url), icon)

const iconBuffer = Buffer.from(icon)
const makeSquareIcon = async (size, destination, background = '#F4F8F6', scale = 0.76) => {
  const artworkSize = Math.round(size * scale)
  if (!artworkSize) {
    await sharp({ create: { width: size, height: size, channels: 4, background } }).png().toFile(fileURLToPath(destination))
    return
  }
  const artwork = await sharp(iconBuffer).resize(artworkSize, artworkSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer()
  const offset = Math.round((size - artworkSize) / 2)
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: artwork, left: offset, top: offset }])
    .png()
    .toFile(fileURLToPath(destination))
}

await makeSquareIcon(1024, new URL('../public/assets/app-icon.png', import.meta.url), '#F4F8F6', 0.78)

const densities = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
for (const [density, launcherSize] of Object.entries(densities)) {
  const folder = new URL(`../android/app/src/main/res/mipmap-${density}/`, import.meta.url)
  await makeSquareIcon(launcherSize, new URL('ic_launcher.png', folder))
  await makeSquareIcon(launcherSize, new URL('ic_launcher_round.png', folder))
  await makeSquareIcon(Math.round(launcherSize * 2.25), new URL('ic_launcher_background.png', folder), '#F4F8F6', 0)
  await makeSquareIcon(Math.round(launcherSize * 2.25), new URL('ic_launcher_foreground.png', folder), { r: 0, g: 0, b: 0, alpha: 0 }, 0.84)
}

console.log(`Prepared the Dwellio wordmark and app icons from ${pathIndex} vector paths.`)
