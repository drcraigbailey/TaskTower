import { defaultProfile } from '../data/demoData.js'
import { supabase } from '../lib/supabase.js'
import { createSignedMediaMap, createSignedMediaUrl } from '../lib/media.js'

export const ACTIVE_HOUSE_KEY = 'tasktower.activeHouse'
export const PROFILE_KEY = 'tasktower.profile'
export const CHORES_KEY = 'tasktower.chores'
export const THEME_KEY = 'tasktower.theme'

export const readStored = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export const friendlyError = (error) => error?.message || 'Something wobbled. Please try that once more.'

export const frequencyLabel = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  custom_days: 'Custom days',
  custom_interval: 'Custom interval',
}

export const emptyLiveProfile = () => ({ ...defaultProfile, image: '', imagePath: '' })

export const toUiProfile = (row, fallback = defaultProfile, image = '') => ({
  ...fallback,
  username: row?.username || fallback.username,
  image: image || '',
  imagePath: row?.avatar_path || '',
  avatar: {
    ...fallback.avatar,
    skin: row?.skin_tone || fallback.avatar.skin,
    hair: row?.hair_color || fallback.avatar.hair,
    hairStyle: row?.hair_style || fallback.avatar.hairStyle,
    outfit: row?.outfit_color || fallback.avatar.outfit,
    accessory: row?.accessory || fallback.avatar.accessory || 'none',
    celebration: row?.celebration || fallback.avatar.celebration || 'confetti',
  },
})

export const toUiChore = (row, imageUrl = '') => {
  const paused = Boolean(row.paused_at)
  const fullCleanNeeded = row.quick_clean_count >= row.full_clean_threshold
  const overdue = row.next_due_at && new Date(row.next_due_at) < new Date()
  const status = paused ? 'paused' : fullCleanNeeded || overdue ? 'overdue' : row.last_completed_at ? 'done' : 'due'
  return {
    id: row.id,
    name: row.display_name,
    description: row.description,
    category: row.category,
    room: row.room || '',
    urgency: row.urgency || 'normal',
    assignedTo: row.assigned_to || '',
    responsibility: row.responsibility || 'shared',
    frequency: frequencyLabel[row.frequency_type] || 'Custom interval',
    difficulty: row.difficulty,
    points: row.points,
    quickCount: row.quick_clean_count,
    fullCleanThreshold: row.full_clean_threshold,
    estimatedMinutes: row.estimated_minutes || '',
    photoRequired: Boolean(row.photo_required),
    notes: row.notes || '',
    imagePath: row.image_path || '',
    imageUrl,
    status,
    dueLabel: paused ? 'Paused' : fullCleanNeeded ? 'Full clean needed' : overdue ? 'Overdue' : row.last_completed_at ? 'Done' : 'Due soon',
    sortOrder: row.sort_order,
    lastCompletedAt: row.last_completed_at,
    nextDueAt: row.next_due_at,
  }
}

export const blankLiveHouse = (row, joinCode = 'OWNER ONLY') => ({
  id: row.id,
  name: row.name,
  ownerId: row.owner_id,
  towerHeight: row.tower_height,
  monthlyResetDay: row.monthly_reset_day,
  resetIn: 0,
  streak: 0,
  joinCode,
  members: [],
})

export const loadOwnProfile = async (userId) => {
  if (!supabase || !userId) return emptyLiveProfile()
  const { data, error } = await supabase.from('player_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return emptyLiveProfile()
  return toUiProfile(data, defaultProfile, await createSignedMediaUrl(data.avatar_path))
}

export const restoreLatestHouse = async (userId) => {
  if (!supabase || !userId) return null
  const { data: membership, error } = await supabase
    .from('household_members')
    .select('household_id, role, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!membership?.household_id) return null
  const [{ data: household, error: householdError }, { data: code }] = await Promise.all([
    supabase.from('households').select('id, name, owner_id, tower_height, monthly_reset_day').eq('id', membership.household_id).maybeSingle(),
    supabase.from('household_join_codes').select('code').eq('household_id', membership.household_id).eq('active', true).limit(1).maybeSingle(),
  ])
  if (householdError) throw householdError
  return household ? blankLiveHouse(household, code?.code || 'OWNER ONLY') : null
}

export const loadHouseSnapshot = async ({ houseId, userId, fallbackJoinCode = 'OWNER ONLY' }) => {
  const [houseResult, membersResult, choresResult, gameResult, codeResult, notificationsResult] = await Promise.all([
    supabase.from('households').select('id, name, owner_id, tower_height, monthly_reset_day').eq('id', houseId).maybeSingle(),
    supabase.from('household_members').select('user_id, role, joined_at').eq('household_id', houseId),
    supabase.from('chores').select('*').eq('household_id', houseId).eq('is_active', true).order('sort_order'),
    supabase.from('monthly_game_state').select('user_id, points, floors_climbed, is_winner').eq('household_id', houseId).eq('month_start', `${new Date().toISOString().slice(0, 7)}-01`),
    supabase.from('household_join_codes').select('code').eq('household_id', houseId).eq('active', true).limit(1).maybeSingle(),
    supabase.from('notifications').select('*').eq('household_id', houseId).order('created_at', { ascending: false }).limit(40),
  ])
  if (houseResult.error || !houseResult.data) return null
  const firstError = [membersResult, choresResult, gameResult, codeResult, notificationsResult].find((result) => result.error)?.error
  if (firstError) throw firstError
  const memberIds = (membersResult.data || []).map((member) => member.user_id)
  const profilesResult = memberIds.length
    ? await supabase.from('player_profiles').select('*').in('user_id', memberIds)
    : { data: [], error: null }
  if (profilesResult.error) throw profilesResult.error
  const mediaMap = await createSignedMediaMap([
    ...(profilesResult.data || []).map((item) => item.avatar_path),
    ...(choresResult.data || []).map((item) => item.image_path),
  ])
  const profileById = Object.fromEntries((profilesResult.data || []).map((item) => [item.user_id, item]))
  const gameById = Object.fromEntries((gameResult.data || []).map((item) => [item.user_id, item]))
  const members = (membersResult.data || []).map((member) => {
    const row = profileById[member.user_id] || {}
    const score = gameById[member.user_id] || {}
    return {
      id: member.user_id,
      username: row.username || (member.user_id === userId ? 'You' : 'Housemate'),
      role: member.role,
      joinedAt: member.joined_at,
      floors: score.floors_climbed || 0,
      points: score.points || 0,
      isWinner: Boolean(score.is_winner),
      image: mediaMap[row.avatar_path] || '',
      imagePath: row.avatar_path || '',
      avatar: toUiProfile(row, defaultProfile).avatar,
    }
  })
  return {
    house: { ...blankLiveHouse(houseResult.data, codeResult.data?.code || fallbackJoinCode), members },
    chores: (choresResult.data || []).map((row) => toUiChore(row, mediaMap[row.image_path] || '')),
    notifications: (notificationsResult.data || []).map((item) => ({
      id: item.id,
      type: item.type === 'chore_completed' ? 'success' : item.type.includes('due') ? 'due' : 'house',
      title: item.title,
      body: item.body,
      time: new Date(item.created_at).toLocaleDateString(),
      unread: !item.read_at,
    })),
    ownProfile: profileById[userId] ? toUiProfile(profileById[userId], defaultProfile, mediaMap[profileById[userId].avatar_path] || '') : null,
  }
}
