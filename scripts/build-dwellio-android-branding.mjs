import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve('.')
const sourceDir = path.join(root, 'source-assets', 'branding')
const assetsDir = path.join(root, 'assets')
const appBrandingDir = path.join(root, 'src', 'assets', 'branding')
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res')
const logoPng = path.join(sourceDir, 'dwellio-logo.png')
const iconSvg = path.join(sourceDir, 'dwellio-app-icon.svg')
const iconReference = path.join(sourceDir, 'dwellio-app-icon-reference.jpg')
const splashReferencePng = path.join(sourceDir, 'dwellio-splash-reference.png')
const splashReferenceJpg = path.join(sourceDir, 'dwellio-splash-reference.jpg')
const ivory = { r: 251, g: 249, b: 244, alpha: 1 }

const iconCandidates = [
  logoPng,
  iconSvg,
  iconReference,
  path.join(assetsDir, 'icon-only.png'),
]

// Always prefer the master splash artwork. Generated outputs must never become
// their own source, otherwise a bad or partial image is repeatedly recycled.
const splashCandidates = [
  splashReferencePng,
  splashReferenceJpg,
  path.join(assetsDir, 'splash-portrait.png'),
  path.join(androidRes, 'drawable', 'splash.png'),
]

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true })

const decodeFirstValidImage = async (candidates, label) => {
  const failures = []

  for (const candidate of candidates) {
    try {
      const input = await fs.readFile(candidate)
      return await sharp(input).png().toBuffer()
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`)
    }
  }

  throw new Error(`No valid ${label} image was found.\n${failures.join('\n')}`)
}

const extractLauncherArtwork = async (input) => {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const columns = new Array(info.width).fill(0)
  let minX = info.width
  let minY = info.height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3]
      if (alpha <= 16) continue
      columns[x] += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (minX > maxX || minY > maxY) return input

  let bestGap = null
  let gapStart = null
  const minGapStart = minX + Math.round((maxX - minX) * 0.16)

  for (let x = minGapStart; x <= maxX; x += 1) {
    if (columns[x] === 0) {
      gapStart ??= x
      continue
    }

    if (gapStart !== null) {
      const gap = { start: gapStart, end: x - 1, width: x - gapStart }
      if (!bestGap || gap.width > bestGap.width) bestGap = gap
      gapStart = null
    }
  }

  if (gapStart !== null) {
    const gap = { start: gapStart, end: maxX, width: maxX - gapStart + 1 }
    if (!bestGap || gap.width > bestGap.width) bestGap = gap
  }

  const cropMaxX = bestGap && bestGap.width >= Math.round(info.width * 0.035)
    ? bestGap.start - 1
    : minX + Math.round((maxX - minX) * 0.31)

  const padding = Math.round(Math.max(cropMaxX - minX + 1, maxY - minY + 1) * 0.07)
  const left = Math.max(0, minX - padding)
  const top = Math.max(0, minY - padding)
  const right = Math.min(info.width - 1, cropMaxX + padding)
  const bottom = Math.min(info.height - 1, maxY + padding)

  return sharp(input)
    .extract({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
    })
    .png()
    .toBuffer()
}

await Promise.all([
  ensureDir(sourceDir),
  ensureDir(assetsDir),
  ensureDir(appBrandingDir),
  ensureDir(path.join(appBrandingDir, 'dwellio')),
  ensureDir(path.join(androidRes, 'drawable')),
  ensureDir(path.join(androidRes, 'mipmap-anydpi')),
  ensureDir(path.join(androidRes, 'mipmap-anydpi-v26')),
  ensureDir(path.join(androidRes, 'mipmap-anydpi-v33')),
])

const [iconInput, splashInput] = await Promise.all([
  decodeFirstValidImage(iconCandidates, 'Dwellio app icon'),
  decodeFirstValidImage(splashCandidates, 'Dwellio splash screen'),
])

const launcherArtworkInput = await extractLauncherArtwork(iconInput)
const launcherArtwork = await sharp(launcherArtworkInput)
  .resize(760, 760, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

const iconForegroundBuffer = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: launcherArtwork, left: 132, top: 132 }])
  .png()
  .toBuffer()

const iconBackgroundBuffer = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: ivory },
})
  .png()
  .toBuffer()

const legacyIconBuffer = await sharp(iconBackgroundBuffer)
  .composite([{ input: launcherArtwork, left: 132, top: 132 }])
  .png()
  .toBuffer()

const splashPortraitBuffer = await sharp(splashInput)
  .resize(1440, 3200, { fit: 'cover', position: 'centre' })
  .png()
  .toBuffer()

const squareSplashArtwork = await sharp(splashPortraitBuffer)
  .resize({ height: 2732 })
  .png()
  .toBuffer()

const squareSplashMeta = await sharp(squareSplashArtwork).metadata()
const squareSplashBuffer = await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: ivory },
})
  .composite([{
    input: squareSplashArtwork,
    left: Math.round((2732 - squareSplashMeta.width) / 2),
    top: 0,
  }])
  .png()
  .toBuffer()

const splashResourceTargets = {
  'drawable-land-hdpi': [800, 480],
  'drawable-land-ldpi': [320, 240],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-night-hdpi': [800, 480],
  'drawable-land-night-ldpi': [320, 240],
  'drawable-land-night-mdpi': [480, 320],
  'drawable-land-night-xhdpi': [1280, 720],
  'drawable-land-night-xxhdpi': [1600, 960],
  'drawable-land-night-xxxhdpi': [1920, 1280],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-night': [320, 240],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-ldpi': [240, 320],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-night-hdpi': [480, 800],
  'drawable-port-night-ldpi': [240, 320],
  'drawable-port-night-mdpi': [320, 480],
  'drawable-port-night-xhdpi': [720, 1280],
  'drawable-port-night-xxhdpi': [960, 1600],
  'drawable-port-night-xxxhdpi': [1280, 1920],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
}

await Promise.all([
  fs.writeFile(path.join(assetsDir, 'icon-only.png'), legacyIconBuffer),
  fs.writeFile(path.join(assetsDir, 'icon-foreground.png'), iconForegroundBuffer),
  fs.writeFile(path.join(assetsDir, 'icon-background.png'), iconBackgroundBuffer),
  fs.writeFile(
    path.join(assetsDir, 'play-store-icon-512.png'),
    await sharp(legacyIconBuffer).resize(512, 512).png().toBuffer(),
  ),
  fs.writeFile(path.join(assetsDir, 'splash-portrait.png'), splashPortraitBuffer),
  fs.writeFile(path.join(assetsDir, 'splash.png'), squareSplashBuffer),
  fs.writeFile(path.join(appBrandingDir, 'dwellio', 'logo.png'), iconInput),
  fs.writeFile(path.join(appBrandingDir, 'dwellio-splash-screen.png'), splashPortraitBuffer),
  fs.writeFile(path.join(androidRes, 'drawable', 'splash.png'), splashPortraitBuffer),
  ...Object.entries(splashResourceTargets).map(async ([folder, [width, height]]) => {
    const output = path.join(androidRes, folder)
    await ensureDir(output)
    return sharp(splashInput)
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(path.join(output, 'splash.png'))
  }),
])

const legacySizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

const adaptiveSizes = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
}

for (const density of Object.keys(legacySizes)) {
  const output = path.join(androidRes, `mipmap-${density}`)
  await ensureDir(output)

  await Promise.all([
    sharp(legacyIconBuffer).resize(legacySizes[density], legacySizes[density]).png().toFile(path.join(output, 'ic_launcher.png')),
    sharp(legacyIconBuffer).resize(legacySizes[density], legacySizes[density]).png().toFile(path.join(output, 'ic_launcher_round.png')),
    sharp(iconForegroundBuffer).resize(adaptiveSizes[density], adaptiveSizes[density]).png().toFile(path.join(output, 'ic_launcher_foreground.png')),
    sharp(iconBackgroundBuffer).resize(adaptiveSizes[density], adaptiveSizes[density]).png().toFile(path.join(output, 'ic_launcher_background.png')),
  ])
}

const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`

const legacyLayerIcon = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@mipmap/ic_launcher_background" />
    <item
        android:width="76dp"
        android:height="76dp"
        android:gravity="center"
        android:drawable="@mipmap/ic_launcher_foreground" />
</layer-list>
`

await Promise.all([
  fs.writeFile(path.join(androidRes, 'mipmap-anydpi', 'ic_launcher.xml'), legacyLayerIcon),
  fs.writeFile(path.join(androidRes, 'mipmap-anydpi', 'ic_launcher_round.xml'), legacyLayerIcon),
  fs.writeFile(path.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIcon),
  fs.writeFile(path.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIcon),
  fs.writeFile(path.join(androidRes, 'mipmap-anydpi-v33', 'ic_launcher.xml'), adaptiveIcon),
  fs.writeFile(path.join(androidRes, 'mipmap-anydpi-v33', 'ic_launcher_round.xml'), adaptiveIcon),
])

console.log('Generated Dwellio Android icons and splash assets from the master branding artwork.')
