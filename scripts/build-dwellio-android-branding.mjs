import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve('.')
const sourceDir = path.join(root, 'source-assets', 'branding')
const assetsDir = path.join(root, 'assets')
const appBrandingDir = path.join(root, 'src', 'assets', 'branding')
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res')
const iconReference = path.join(sourceDir, 'dwellio-app-icon-reference.jpg')
const splashReference = path.join(sourceDir, 'dwellio-splash-reference.jpg')
const ivory = { r: 251, g: 249, b: 244, alpha: 1 }

// Prefer the checked-in PNG outputs. The JPEGs are retained as portable source
// references, but older clones may contain truncated copies from an earlier commit.
const iconCandidates = [
  path.join(assetsDir, 'icon-only.png'),
  iconReference,
]

const splashCandidates = [
  path.join(assetsDir, 'splash-portrait.png'),
  path.join(androidRes, 'drawable', 'splash.png'),
  splashReference,
]

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true })

const decodeFirstValidImage = async (candidates, label) => {
  const failures = []

  for (const candidate of candidates) {
    try {
      const input = await fs.readFile(candidate)
      // metadata() can succeed on a truncated JPEG. Force a complete decode so
      // a damaged candidate is rejected here instead of exploding later.
      return await sharp(input).png().toBuffer()
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`)
    }
  }

  throw new Error(`No valid ${label} image was found.\n${failures.join('\n')}`)
}

await Promise.all([
  ensureDir(sourceDir),
  ensureDir(assetsDir),
  ensureDir(appBrandingDir),
  ensureDir(path.join(androidRes, 'drawable')),
  ensureDir(path.join(androidRes, 'mipmap-anydpi-v26')),
])

const [iconInput, splashInput] = await Promise.all([
  decodeFirstValidImage(iconCandidates, 'Dwellio app icon'),
  decodeFirstValidImage(splashCandidates, 'Dwellio splash screen'),
])

const iconBuffer = await sharp(iconInput)
  .resize(1024, 1024, { fit: 'cover' })
  .png()
  .toBuffer()

const adaptiveArtwork = await sharp(iconBuffer)
  .resize(760, 760, { fit: 'contain' })
  .png()
  .toBuffer()

const iconForegroundBuffer = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: adaptiveArtwork, left: 132, top: 132 }])
  .png()
  .toBuffer()

const iconBackgroundBuffer = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: ivory },
})
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

const repairedIconReference = await sharp(iconBuffer).jpeg({ quality: 95 }).toBuffer()
const repairedSplashReference = await sharp(splashPortraitBuffer).jpeg({ quality: 95 }).toBuffer()

await Promise.all([
  fs.writeFile(iconReference, repairedIconReference),
  fs.writeFile(splashReference, repairedSplashReference),
  fs.writeFile(path.join(assetsDir, 'icon-only.png'), iconBuffer),
  fs.writeFile(path.join(assetsDir, 'icon-foreground.png'), iconForegroundBuffer),
  fs.writeFile(path.join(assetsDir, 'icon-background.png'), iconBackgroundBuffer),
  fs.writeFile(
    path.join(assetsDir, 'play-store-icon-512.png'),
    await sharp(iconBuffer).resize(512, 512).png().toBuffer(),
  ),
  fs.writeFile(path.join(assetsDir, 'splash-portrait.png'), splashPortraitBuffer),
  fs.writeFile(path.join(assetsDir, 'splash.png'), squareSplashBuffer),
  fs.writeFile(path.join(appBrandingDir, 'dwellio-splash-screen.png'), splashPortraitBuffer),
  fs.writeFile(path.join(androidRes, 'drawable', 'splash.png'), splashPortraitBuffer),
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
    sharp(iconBuffer).resize(legacySizes[density], legacySizes[density]).png().toFile(path.join(output, 'ic_launcher.png')),
    sharp(iconBuffer).resize(legacySizes[density], legacySizes[density]).png().toFile(path.join(output, 'ic_launcher_round.png')),
    sharp(iconForegroundBuffer).resize(adaptiveSizes[density], adaptiveSizes[density]).png().toFile(path.join(output, 'ic_launcher_foreground.png')),
    sharp(iconBackgroundBuffer).resize(adaptiveSizes[density], adaptiveSizes[density]).png().toFile(path.join(output, 'ic_launcher_background.png')),
  ])
}

const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`

await Promise.all([
  fs.writeFile(path.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIcon),
  fs.writeFile(path.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIcon),
])

console.log('Generated the approved Dwellio app icon and illustrated splash screen.')
