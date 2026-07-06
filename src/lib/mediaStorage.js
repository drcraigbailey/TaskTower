import { supabase } from './supabase.js'

const MEDIA_BUCKET = 'household-media'
const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const OUTPUT_DIMENSION = 1024
// The upload is inset before being placed on its square canvas. Combined with
// the small display inset, even a square photo stays within a circular mask.
const SAFE_PADDING_RATIO = 0.08

const requireStorage = () => {
  if (!supabase) throw new Error('This build is not connected to Supabase. Add the live environment values and rebuild the app.')
  return supabase
}

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    resolve(image)
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('That image could not be opened. Try a JPEG, PNG or WebP image.'))
  }
  image.src = url
})

const canvasBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('That image could not be prepared.')),
    'image/webp',
    0.88,
  )
})

export async function prepareImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Choose an image smaller than 15 MB.')

  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_DIMENSION
  canvas.height = OUTPUT_DIMENSION

  const context = canvas.getContext('2d')
  context.clearRect(0, 0, OUTPUT_DIMENSION, OUTPUT_DIMENSION)

  const safeSize = OUTPUT_DIMENSION * (1 - SAFE_PADDING_RATIO * 2)
  const scale = Math.min(
    safeSize / image.naturalWidth,
    safeSize / image.naturalHeight,
  )
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const left = Math.round((OUTPUT_DIMENSION - width) / 2)
  const top = Math.round((OUTPUT_DIMENSION - height) / 2)

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, left, top, width, height)

  return canvasBlob(canvas)
}

export async function signedMediaUrl(path) {
  if (!path) return null
  try {
    const db = requireStorage()
    const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(path, 86400)
    if (error) throw error
    return data?.signedUrl || null
  } catch {
    return null
  }
}

export async function signedMediaUrls(paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  const entries = await Promise.all(uniquePaths.map(async (path) => [path, await signedMediaUrl(path)]))
  return Object.fromEntries(entries)
}

async function uploadImage(path, file) {
  const db = requireStorage()
  const prepared = await prepareImage(file)
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, prepared, {
    contentType: 'image/webp',
    upsert: true,
  })
  if (error) throw error
  return { path, url: await signedMediaUrl(path) }
}

export const uploadProfileImage = (userId, file) => uploadImage(`profiles/${userId}/avatar-${Date.now()}.webp`, file)

export const uploadHouseholdImage = (houseId, userId, file) => (
  uploadImage(`households/${houseId}/profile/${userId}/house-${Date.now()}.webp`, file)
)

export async function deleteMedia(path) {
  if (!path) return
  const db = requireStorage()
  const { error } = await db.storage.from(MEDIA_BUCKET).remove([path])
  if (error) throw error
}
