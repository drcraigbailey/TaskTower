import { defaultProfile } from '../data/defaults.js'
import { supabase } from './supabase.js'

const frequencyLabel = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  custom_days: 'Custom days',
  custom_interval: 'Custom interval',
}

const frequencyValue = Object.fromEntries(Object.entries(frequencyLabel).map(([key, value]) => [value, key]))

export const requireDatabase = () => {
  if (!supabase) throw new Error('This build is not connected to Supabase. Add the live environment values and rebuild the app.')
  return supabase
}

export const friendlyError = (error) => error?.message || 'Something wobbled. Please try that once more.'

export const relativeTime = (value) => {
  const date = new Date(value)
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${seconds < 172800 ? '' : 's'}`
  return date.toLocaleDateString()
}

const expiryLabel = (value) => {
  if (!value) return 'No expiry'
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
  if (days <= 0) return 'Expired'
  return `${days} day${days === 1 ? '' : 's'}`
}

export const mapProfile = (row, fallbackUsername = defaultProfile.username) => ({
  username: row?.username || fallbackUsername,
  avatar: {
    skin: row?.skin_tone || defaultProfile.avatar.skin,
    hair: row?.hair_color || defaultProfile.avatar.hair,
    hairStyle: row?.hair_style || defaultProfile.avatar.hairStyle,
    outfit: row?.outfit_color || defaultProfile.avatar.outfit,
    accessory: row?.accessory || defaultProfile.avatar.accessory,
    celebration: row?.celebration || defaultProfile.avatar.celebration,
  },
})

export const mapChore = (row) => {
  const fullCleanNeeded = row.quick_clean_count >= row.full_clean_threshold
  const overdue = row.next_due_at && new Date(row.next_due_at) < new Date()
  return {
    id: row.id,
    name: row.display_name,
    description: row.description,
    category: row.category,
    frequency: frequencyLabel[row.frequency_type] || 'Custom interval',
    difficulty: row.difficulty,
    points: row.points,
    quickCount: row.quick_clean_count,
    fullCleanThreshold: row.full_clean_threshold,
    status: fullCleanNeeded || overdue ? 'overdue' : row.last_completed_at ? 'done' : 'due',
    dueLabel: fullCleanNeeded ? 'Full clean needed' : overdue ? 'Overdue' : row.last_completed_at ? 'Done' : 'Due soon',
    sortOrder: row.sort_order,
  }
}

export async function loadProfile(user) {
  const db = requireDatabase()
  const fallbackUsername = user.user_metadata?.username || user.email?.split('@')[0] || defaultProfile.username
  const { data, error } = await db.from('player_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (data) return mapProfile(data, fallbackUsername)
  const { data: created, error: createError } = await db
    .from('player_profiles')
    .upsert({ user_id: user.id, username: fallbackUsername })
    .select()
    .single()
  if (createError) throw createError
  return mapProfile(created, fallbackUsername)
}

export async function loadHouses(userId) {
  const db = requireDatabase()
  const { data: memberships, error: membershipError } = await db
    .from('household_members')
    .select('household_id, role, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (membershipError) throw membershipError
  if (!memberships?.length) return []
  const ids = memberships.map((item) => item.household_id)
  const { data: rows, error } = await db
    .from('households')
    .select('id, name, tower_height, monthly_reset_day')
    .in('id', ids)
  if (error) throw error
  const rowById = Object.fromEntries((rows || []).map((row) => [row.id, row]))
  const memberById = Object.fromEntries(memberships.map((item) => [item.household_id, item]))
  return ids.map((id) => {
    const row = rowById[id]
    const membership = memberById[id]
    return row ? {
      id: row.id,
      name: row.name,
      towerHeight: row.tower_height,
      monthlyResetDay: row.monthly_reset_day,
      role: membership.role,
      joinedAt: membership.joined_at,
      joinCode: null,
      members: [],
      streak: 0,
      resetIn: 0,
    } : null
  }).filter(Boolean)
}

export async function loadHouseSnapshot(houseId, user, ownProfile) {
  const db = requireDatabase()
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`
  const results = await Promise.all([
    db.from('households').select('id, name, tower_height, monthly_reset_day').eq('id', houseId).maybeSingle(),
    db.from('household_members').select('user_id, role, joined_at').eq('household_id', houseId),
    db.from('chores').select('*').eq('household_id', houseId).eq('is_active', true).order('sort_order'),
    db.from('monthly_game_state').select('user_id, points, floors_climbed, is_winner').eq('household_id', houseId).eq('month_start', monthStart),
    db.from('household_join_codes').select('code').eq('household_id', houseId).eq('active', true).limit(1).maybeSingle(),
    db.from('notifications').select('*').eq('household_id', houseId).order('created_at', { ascending: false }).limit(40),
    db.from('household_shopping_items').select('*').eq('household_id', houseId).order('created_at', { ascending: false }).limit(100),
    db.from('household_messages').select('*').eq('household_id', houseId).order('created_at', { ascending: false }).limit(100),
    db.from('household_notices').select('*').eq('household_id', houseId).order('created_at', { ascending: false }).limit(50),
    db.from('chore_completions').select('id, chore_id, user_id, completion_type, completed_at').eq('household_id', houseId).order('completed_at', { ascending: false }).limit(80),
  ])
  const error = results.find((result) => result.error)?.error
  if (error) throw error
  const [houseResult, membersResult, choresResult, gameResult, codeResult, notificationsResult, shoppingResult, messagesResult, noticesResult, completionsResult] = results
  if (!houseResult.data) throw new Error('That household is no longer available.')

  const memberIds = (membersResult.data || []).map((item) => item.user_id)
  const profilesResult = memberIds.length
    ? await db.from('player_profiles').select('*').in('user_id', memberIds)
    : { data: [], error: null }
  if (profilesResult.error) throw profilesResult.error

  const profileById = Object.fromEntries((profilesResult.data || []).map((item) => [item.user_id, item]))
  const gameById = Object.fromEntries((gameResult.data || []).map((item) => [item.user_id, item]))
  const members = (membersResult.data || []).map((item) => {
    const memberProfile = mapProfile(profileById[item.user_id], item.user_id === user.id ? ownProfile.username : 'Housemate')
    const score = gameById[item.user_id] || {}
    return {
      id: item.user_id,
      username: memberProfile.username,
      role: item.role,
      floors: score.floors_climbed || 0,
      points: score.points || 0,
      isWinner: Boolean(score.is_winner),
      avatar: memberProfile.avatar,
    }
  })
  const nameById = Object.fromEntries(members.map((item) => [item.id, item.username]))
  const choreRows = choresResult.data || []
  const choreNameById = Object.fromEntries(choreRows.map((item) => [item.id, item.display_name]))
  const messages = [...(messagesResult.data || [])].reverse().map((item) => ({
    id: item.id,
    authorId: item.author_id,
    author: item.author_id === user.id ? 'You' : nameById[item.author_id] || 'Housemate',
    body: item.body,
    time: relativeTime(item.created_at),
    createdAt: item.created_at,
    mine: item.author_id === user.id,
  }))
  const notices = (noticesResult.data || [])
    .filter((item) => !item.expires_at || new Date(item.expires_at) > new Date())
    .map((item) => ({
      id: item.id,
      authorId: item.author_id,
      author: item.author_id === user.id ? 'You' : nameById[item.author_id] || 'Housemate',
      title: item.title,
      body: item.body,
      priority: item.priority,
      expiresAt: item.expires_at,
      expires: expiryLabel(item.expires_at),
      createdAt: item.created_at,
    }))
  const shoppingItems = (shoppingResult.data || []).filter((item) => !item.purchased_at).map((item) => ({
    id: item.id,
    name: item.name,
    detail: item.detail || '',
    category: item.category || 'General',
    state: item.state,
    createdAt: item.created_at,
    createdBy: item.created_by,
  }))
  const notifications = (notificationsResult.data || []).map((item) => ({
    id: item.id,
    type: item.type === 'chore_completed' ? 'success' : item.type.includes('due') ? 'due' : 'house',
    title: item.title,
    body: item.body,
    time: relativeTime(item.created_at),
    unread: !item.read_at,
  }))
  const activity = [
    ...(completionsResult.data || []).map((item) => ({
      id: `chore-${item.id}`,
      type: 'tasks',
      member: item.user_id === user.id ? 'You' : nameById[item.user_id] || 'Housemate',
      action: item.completion_type === 'full' ? 'completed a full clean for' : 'completed',
      subject: choreNameById[item.chore_id] || 'a task',
      time: relativeTime(item.completed_at),
      createdAt: item.completed_at,
      tone: 'green',
    })),
    ...(shoppingResult.data || []).map((item) => ({
      id: `shopping-${item.id}`,
      type: 'shopping',
      member: item.created_by === user.id ? 'You' : nameById[item.created_by] || 'Housemate',
      action: item.purchased_at ? 'marked as purchased' : 'added to shopping',
      subject: item.name,
      time: relativeTime(item.purchased_at || item.created_at),
      createdAt: item.purchased_at || item.created_at,
      tone: 'amber',
    })),
    ...(noticesResult.data || []).map((item) => ({
      id: `notice-${item.id}`,
      type: 'notices',
      member: item.author_id === user.id ? 'You' : nameById[item.author_id] || 'Housemate',
      action: 'posted a notice',
      subject: item.title,
      time: relativeTime(item.created_at),
      createdAt: item.created_at,
      tone: item.priority === 'urgent' ? 'red' : 'blue',
    })),
    ...(messagesResult.data || []).slice(0, 20).map((item) => ({
      id: `message-${item.id}`,
      type: 'messages',
      member: item.author_id === user.id ? 'You' : nameById[item.author_id] || 'Housemate',
      action: 'sent a message',
      subject: item.body.length > 45 ? `${item.body.slice(0, 45)}…` : item.body,
      time: relativeTime(item.created_at),
      createdAt: item.created_at,
      tone: 'blue',
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 80)

  return {
    house: {
      id: houseResult.data.id,
      name: houseResult.data.name,
      towerHeight: houseResult.data.tower_height,
      monthlyResetDay: houseResult.data.monthly_reset_day,
      role: membersResult.data?.find((item) => item.user_id === user.id)?.role || 'member',
      joinCode: codeResult.data?.code || null,
      members,
      streak: 0,
      resetIn: 0,
    },
    chores: choreRows.map(mapChore),
    shoppingItems,
    messages,
    notices,
    notifications,
    activity,
  }
}

export async function saveTask(houseId, userId, chores, task) {
  const db = requireDatabase()
  const payload = {
    household_id: houseId,
    display_name: task.name.trim(),
    description: task.description || '',
    category: task.category,
    frequency_type: frequencyValue[task.frequency] || 'custom_interval',
    difficulty: Number(task.difficulty),
    points: Number(task.points),
    full_clean_threshold: Number(task.fullCleanThreshold),
    quick_clean_count: Number(task.quickCount || 0),
  }
  const exists = chores.some((item) => item.id === task.id)
  const request = exists
    ? db.from('chores').update(payload).eq('id', task.id).select().single()
    : db.from('chores').insert({ ...payload, created_by: userId, sort_order: chores.length }).select().single()
  const { data, error } = await request
  if (error) throw error
  return mapChore(data)
}
