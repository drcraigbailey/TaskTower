import { supabase } from './supabase.js'

export const HOUSEHOLD_MEDIA_BUCKET = 'household-media'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const extensionFor = (file) => {
  const fromName = file?.name?.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  const type = file?.type || ''
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

export const validateImageFile = (file) => {
  if (!file) return null
  if (!file.type?.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 5 MB or smaller.')
  return file
}

const randomId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const uploadProfileImage = async ({ file, userId }) => {
  validateImageFile(file)
  if (!supabase || !userId) throw new Error('Image upload is not available.')
  const path = `profiles/${userId}/${randomId()}.${extensionFor(file)}`
  const { error } = await supabase.storage.from(HOUSEHOLD_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

export const uploadHouseholdImage = async ({ file, householdId, userId, kind }) => {
  validateImageFile(file)
  if (!supabase || !householdId || !userId) throw new Error('Image upload is not available.')
  if (!['tasks', 'notices', 'messages'].includes(kind)) throw new Error('Unsupported image type.')
  const path = `households/${householdId}/${kind}/${userId}/${randomId()}.${extensionFor(file)}`
  const { error } = await supabase.storage.from(HOUSEHOLD_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

export const removeMediaPath = async (path) => {
  if (!supabase || !path) return
  const { error } = await supabase.storage.from(HOUSEHOLD_MEDIA_BUCKET).remove([path])
  if (error) console.warn('Could not remove old household media', error)
}

export const createSignedMediaUrl = async (path) => {
  if (!supabase || !path) return ''
  const { data, error } = await supabase.storage.from(HOUSEHOLD_MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error) {
    console.warn('Could not sign household media URL', error)
    return ''
  }
  return data?.signedUrl || ''
}

export const createSignedMediaMap = async (paths = []) => {
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return {}
  const pairs = await Promise.all(unique.map(async (path) => [path, await createSignedMediaUrl(path)]))
  return Object.fromEntries(pairs)
}

export const readImageAsDataUrl = (file) => new Promise((resolve, reject) => {
  validateImageFile(file)
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('That image could not be read.'))
  reader.readAsDataURL(file)
})
