import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve('.')
const output = path.join(root, 'src', 'assets', 'art')

await fs.mkdir(output, { recursive: true })

const webp = async (input, name, options = {}) => {
  const { width = 960, height, position = 'centre' } = options
  let pipeline = sharp(input)
  if (height) pipeline = pipeline.resize({ width, height, fit: 'cover', position })
  else pipeline = pipeline.resize({ width, withoutEnlargement: true })
  await pipeline.webp({ quality: 88, effort: 6 }).toFile(path.join(output, name))
}

await webp(path.join(output, 'home-tower-race.png'), 'home-tower-race.webp', { width: 900 })
await webp(path.join(output, 'winner-celebration.png'), 'winner-celebration.webp', { width: 900 })
await webp(path.join(output, 'chores-teamwork.png'), 'chores-teamwork.webp', { width: 960, height: 520, position: 'centre' })

const sheet = path.join(root, 'source-assets', 'generated', 'chore-icons-transparent.png')
const crops = {
  'chore-kitchen.webp': [0, 0, 512, 512],
  'chore-bathroom.webp': [512, 0, 512, 512],
  'chore-laundry.webp': [1024, 0, 512, 512],
  'chore-living-room.webp': [0, 512, 512, 512],
  'chore-outdoor.webp': [512, 512, 512, 512],
  'chore-housework.webp': [1024, 512, 512, 512],
}

for (const [name, [left, top, width, height]] of Object.entries(crops)) {
  await sharp(sheet)
    .extract({ left, top, width, height })
    .resize({ width: 240, height: 240, fit: 'contain' })
    .webp({ quality: 90, effort: 6, alphaQuality: 100 })
    .toFile(path.join(output, name))
}

console.log(`Prepared supplied TaskTower artwork in ${output}`)
