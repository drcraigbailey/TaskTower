import { requireDatabase } from './liveDataService.js'

export async function createHouseRecord(name) {
  const db = requireDatabase()
  const trimmedName = name.trim()
  if (trimmedName.length < 2) throw new Error('House name must be at least two characters.')
  const { data, error } = await db.rpc('create_house', { p_name: trimmedName })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.household_id) throw new Error('The household was not created correctly.')
  return { ...result, name: trimmedName }
}

export async function joinHouseRecord(code) {
  const db = requireDatabase()
  const cleanCode = code.trim().toUpperCase()
  if (cleanCode.length < 4) throw new Error('Enter the full household invite code.')
  const { data, error } = await db.rpc('join_house', { p_code: cleanCode })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.household_id) throw new Error('The household could not be joined.')
  return result
}

export async function leaveHouseRecord(houseId) {
  const db = requireDatabase()
  const { error } = await db.rpc('leave_house', { p_household_id: houseId })
  if (error) throw error
}

export async function updateHouseRecord(houseId, changes) {
  const db = requireDatabase()
  const payload = {
    name: changes.name.trim(),
    tower_height: Number(changes.towerHeight),
    monthly_reset_day: Number(changes.monthlyResetDay),
  }
  if (payload.name.length < 2) throw new Error('House name must be at least two characters.')
  const { data, error } = await db
    .from('households')
    .update(payload)
    .eq('id', houseId)
    .select('id, name, tower_height, monthly_reset_day')
    .single()
  if (error) throw error
  return data
}

export async function deleteTaskRecord(id) {
  const db = requireDatabase()
  const { error } = await db.from('chores').delete().eq('id', id)
  if (error) throw error
}

export async function reorderTaskRecords(chores, id, direction) {
  const db = requireDatabase()
  const index = chores.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= chores.length) return chores
  const next = [...chores]
  ;[next[index], next[target]] = [next[target], next[index]]
  const results = await Promise.all([
    db.from('chores').update({ sort_order: index }).eq('id', next[index].id),
    db.from('chores').update({ sort_order: target }).eq('id', next[target].id),
  ])
  const error = results.find((result) => result.error)?.error
  if (error) throw error
  return next
}

export async function completeTaskRecord(id, type) {
  const db = requireDatabase()
  const { error } = await db.rpc('complete_chore', { p_chore_id: id, p_completion_type: type })
  if (error) throw error
}

export async function addShoppingRecord(houseId, userId, item) {
  const db = requireDatabase()
  const { error } = await db.from('household_shopping_items').insert({
    household_id: houseId,
    name: item.name.trim(),
    detail: item.detail?.trim() || '',
    category: item.category?.trim() || 'General',
    state: item.state || 'list',
    created_by: userId,
  })
  if (error) throw error
}

export async function purchaseShoppingRecord(id, userId) {
  const db = requireDatabase()
  const { error } = await db
    .from('household_shopping_items')
    .update({ purchased_at: new Date().toISOString(), purchased_by: userId })
    .eq('id', id)
  if (error) throw error
}

export async function deleteShoppingRecord(id) {
  const db = requireDatabase()
  const { error } = await db.from('household_shopping_items').delete().eq('id', id)
  if (error) throw error
}

export async function sendMessageRecord(houseId, userId, body) {
  const db = requireDatabase()
  const cleanBody = body.trim()
  if (!cleanBody) return
  const { error } = await db.from('household_messages').insert({ household_id: houseId, author_id: userId, body: cleanBody })
  if (error) throw error
}

export async function createNoticeRecord(houseId, userId, notice) {
  const db = requireDatabase()
  const expiresAt = notice.expiresInDays
    ? new Date(Date.now() + Number(notice.expiresInDays) * 86400000).toISOString()
    : null
  const { error } = await db.from('household_notices').insert({
    household_id: houseId,
    author_id: userId,
    title: notice.title.trim(),
    body: notice.body.trim(),
    priority: notice.priority || 'normal',
    expires_at: expiresAt,
  })
  if (error) throw error
}

export async function deleteNoticeRecord(id) {
  const db = requireDatabase()
  const { error } = await db.from('household_notices').delete().eq('id', id)
  if (error) throw error
}

export async function markNotificationsReadRecord(userId) {
  const db = requireDatabase()
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

export async function saveProfileRecord(userId, profile) {
  const db = requireDatabase()
  const cleanProfile = { ...profile, username: profile.username.trim() }
  const { error } = await db.from('player_profiles').upsert({
    user_id: userId,
    username: cleanProfile.username,
    skin_tone: cleanProfile.avatar.skin,
    hair_style: cleanProfile.avatar.hairStyle,
    hair_color: cleanProfile.avatar.hair,
    outfit_color: cleanProfile.avatar.outfit,
    accessory: cleanProfile.avatar.accessory,
    celebration: cleanProfile.avatar.celebration,
  })
  if (error) throw error
  return cleanProfile
}
