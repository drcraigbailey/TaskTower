// oxlint-disable react/only-export-components
import { createContext, useContext, useEffect, useState } from 'react'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'
import {
  defaultProfile,
  demoChores,
  demoHouse,
  demoNotifications,
} from '../data/demoData.js'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { initialisePushNotifications } from '../lib/pushNotifications.js'

const TaskTowerContext = createContext(null)
const ACTIVE_HOUSE_KEY = 'tasktower.activeHouse'
const PROFILE_KEY = 'tasktower.profile'
const CHORES_KEY = 'tasktower.chores'
const THEME_KEY = 'tasktower.theme'

const readStored = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const friendlyError = (error) => error?.message || 'Something wobbled. Please try that once more.'

const frequencyLabel = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  custom_days: 'Custom days',
  custom_interval: 'Custom interval',
}

const toUiProfile = (row, fallback = defaultProfile) => ({
  ...fallback,
  username: row?.username || fallback.username,
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

const toUiChore = (row) => {
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
    status,
    dueLabel: paused ? 'Paused' : fullCleanNeeded ? 'Full clean needed' : overdue ? 'Overdue' : row.last_completed_at ? 'Done' : 'Due soon',
    sortOrder: row.sort_order,
    lastCompletedAt: row.last_completed_at,
    nextDueAt: row.next_due_at,
  }
}

export function TaskTowerProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [profile, setProfileState] = useState(() => readStored(PROFILE_KEY, defaultProfile))
  const [activeHouse, setActiveHouse] = useState(() => readStored(ACTIVE_HOUSE_KEY, null))
  const [chores, setChores] = useState(() => readStored(CHORES_KEY, demoChores))
  const [notifications, setNotifications] = useState(demoNotifications)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    localStorage.setItem(CHORES_KEY, JSON.stringify(chores))
  }, [chores])

  useEffect(() => {
    if (!supabase) return undefined
    let mounted = true
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error
        if (mounted) setUser(data.session?.user || null)
      })
      .catch((error) => console.warn('Could not restore the Dwellio session', error))
      .finally(() => { if (mounted) setAuthReady(true) })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      setAuthReady(true)
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !user?.id) return undefined
    let cancelled = false
    supabase.from('player_profiles').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error
        if (!cancelled && data) setProfileState((current) => toUiProfile(data, current))
      })
      .catch((error) => console.warn('Could not load the user profile', error))
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    Preferences.get({ key: ACTIVE_HOUSE_KEY }).then(({ value }) => {
      if (cancelled || !value) return
      try {
        const storedHouse = JSON.parse(value)
        setActiveHouse((current) => current || storedHouse)
      } catch {
        Preferences.remove({ key: ACTIVE_HOUSE_KEY })
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cleanup = () => {}
    initialisePushNotifications(user?.id)
      .then((nextCleanup) => { cleanup = nextCleanup })
      .catch((error) => console.warn('Push notification setup was skipped', error))
    return () => cleanup()
  }, [user?.id])

  const haptic = async (kind = 'light') => {
    try {
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success })
      else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
    } catch {
      // Haptics are a progressive enhancement on web and unsupported devices.
    }
  }

  const showToast = (message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3000)
  }

  const persistActiveHouse = (house) => {
    setActiveHouse(house)
    if (house) {
      localStorage.setItem(ACTIVE_HOUSE_KEY, JSON.stringify(house))
      Preferences.set({ key: ACTIVE_HOUSE_KEY, value: JSON.stringify(house) })
    } else {
      localStorage.removeItem(ACTIVE_HOUSE_KEY)
      Preferences.remove({ key: ACTIVE_HOUSE_KEY })
    }
  }

  const activateHouse = (house, withHaptic = true) => {
    persistActiveHouse(house)
    if (withHaptic) haptic('success')
  }

  useEffect(() => {
    if (!supabase || !user || !activeHouse?.id || activeHouse.id === 'demo-house') return undefined
    let cancelled = false
    const houseId = activeHouse.id

    const refreshHouse = async () => {
      try {
        const [houseResult, membersResult, choresResult, gameResult, codeResult, notificationsResult] = await Promise.all([
          supabase.from('households').select('id, name, owner_id, tower_height, monthly_reset_day').eq('id', houseId).maybeSingle(),
          supabase.from('household_members').select('user_id, role, joined_at').eq('household_id', houseId),
          supabase.from('chores').select('*').eq('household_id', houseId).eq('is_active', true).order('sort_order'),
          supabase.from('monthly_game_state').select('user_id, points, floors_climbed, is_winner').eq('household_id', houseId).eq('month_start', new Date().toISOString().slice(0, 7) + '-01'),
          supabase.from('household_join_codes').select('code').eq('household_id', houseId).eq('active', true).limit(1).maybeSingle(),
          supabase.from('notifications').select('*').eq('household_id', houseId).order('created_at', { ascending: false }).limit(40),
        ])

        if (cancelled) return
        if (houseResult.error || !houseResult.data) {
          persistActiveHouse(null)
          setToast({ message: 'That household is no longer available, so we brought you safely home.', tone: 'neutral' })
          return
        }

        const firstError = [membersResult, choresResult, gameResult, codeResult, notificationsResult].find((result) => result.error)?.error
        if (firstError) throw firstError

        const memberIds = (membersResult.data || []).map((member) => member.user_id)
        const profilesResult = memberIds.length
          ? await supabase.from('player_profiles').select('*').in('user_id', memberIds)
          : { data: [], error: null }
        if (profilesResult.error) throw profilesResult.error
        if (cancelled) return

        const profileById = Object.fromEntries((profilesResult.data || []).map((item) => [item.user_id, item]))
        const gameById = Object.fromEntries((gameResult.data || []).map((item) => [item.user_id, item]))
        const members = (membersResult.data || []).map((member) => {
          const memberProfile = profileById[member.user_id] || {}
          const score = gameById[member.user_id] || {}
          return {
            id: member.user_id,
            username: memberProfile.username || (member.user_id === user.id ? profile.username : 'Housemate'),
            role: member.role,
            joinedAt: member.joined_at,
            floors: score.floors_climbed || 0,
            points: score.points || 0,
            isWinner: Boolean(score.is_winner),
            avatar: toUiProfile(memberProfile, defaultProfile).avatar,
          }
        })

        const nextHouse = {
          id: houseResult.data.id,
          name: houseResult.data.name,
          ownerId: houseResult.data.owner_id,
          towerHeight: houseResult.data.tower_height,
          monthlyResetDay: houseResult.data.monthly_reset_day,
          resetIn: 12,
          streak: 0,
          joinCode: codeResult.data?.code || activeHouse.joinCode || 'OWNER ONLY',
          members,
        }
        persistActiveHouse(nextHouse)
        setChores((choresResult.data || []).map(toUiChore))
        setNotifications((notificationsResult.data || []).map((item) => ({
          id: item.id,
          type: item.type === 'chore_completed' ? 'success' : item.type.includes('due') ? 'due' : 'house',
          title: item.title,
          body: item.body,
          time: new Date(item.created_at).toLocaleDateString(),
          unread: !item.read_at,
        })))
      } catch (error) {
        if (!cancelled) console.warn('Could not refresh household data', error)
      }
    }

    refreshHouse()
    const channel = supabase
      .channel(`house-${houseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${houseId}` }, refreshHouse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_completions', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_game_state', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id, activeHouse?.id, activeHouse?.joinCode, profile.username])

  const restoreFirstHouseForUser = async (signedInUser) => {
    if (!supabase || !signedInUser) return activeHouse
    try {
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id, role, joined_at')
        .eq('user_id', signedInUser.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (membershipError) throw membershipError
      if (!membership?.household_id) {
        persistActiveHouse(null)
        return null
      }

      const [{ data: household, error: householdError }, { data: joinCode }] = await Promise.all([
        supabase.from('households').select('id, name, owner_id, tower_height, monthly_reset_day').eq('id', membership.household_id).maybeSingle(),
        supabase.from('household_join_codes').select('code').eq('household_id', membership.household_id).eq('active', true).limit(1).maybeSingle(),
      ])
      if (householdError) throw householdError
      if (!household) return null

      const restoredHouse = {
        ...demoHouse,
        id: household.id,
        name: household.name,
        ownerId: household.owner_id,
        towerHeight: household.tower_height,
        monthlyResetDay: household.monthly_reset_day,
        joinCode: joinCode?.code || 'OWNER ONLY',
        members: [{
          id: signedInUser.id,
          username: profile.username || signedInUser.user_metadata?.username || 'You',
          role: membership.role,
          floors: 0,
          points: 0,
          avatar: profile.avatar,
        }],
      }
      activateHouse(restoredHouse, false)
      return restoredHouse
    } catch (error) {
      console.warn('Dwellio could not restore the household after sign-in', error)
      return null
    }
  }

  const login = async ({ email, password }) => {
    setLoading(true)
    try {
      let signedInUser
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        signedInUser = data.user
        setUser(signedInUser)
      } else {
        signedInUser = { id: 'demo-user', email: email || 'hello@dwellio.app' }
        setUser(signedInUser)
      }
      const restoredHouse = await restoreFirstHouseForUser(signedInUser)
      sessionStorage.setItem('tasktower.justLoggedIn', 'true')
      await haptic('success')
      return { ok: true, houseId: restoredHouse?.id || null }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    } finally {
      setLoading(false)
    }
  }

  const register = async ({ username, email, password }) => {
    setLoading(true)
    try {
      let registeredUser
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } })
        if (error) throw error
        registeredUser = data.user
        if (!data.session) {
          setProfileState((current) => ({ ...current, username }))
          return { ok: true, needsConfirmation: true }
        }
        setUser(data.user)
      } else {
        registeredUser = { id: 'demo-user', email }
        setUser(registeredUser)
      }
      setProfileState((current) => ({ ...current, username }))
      sessionStorage.setItem('tasktower.justLoggedIn', 'true')
      await haptic('success')
      return { ok: true, houseId: null }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    persistActiveHouse(null)
    setProfileState(defaultProfile)
    setChores(demoChores)
    setNotifications(demoNotifications)
  }

  const createHouse = async (name) => {
    if (supabase && user) {
      const { data, error } = await supabase.rpc('create_house', { p_name: name })
      if (error) throw error
      const result = Array.isArray(data) ? data[0] : data
      const house = {
        ...demoHouse,
        id: result.household_id,
        name: name.trim(),
        ownerId: user.id,
        joinCode: result.join_code,
        members: [{ id: user.id, username: profile.username, role: 'owner', floors: 0, points: 0, avatar: profile.avatar }],
      }
      activateHouse(house)
      return house
    }
    const house = { ...demoHouse, name: name?.trim() || 'Our Home' }
    activateHouse(house)
    return house
  }

  const joinHouse = async (code) => {
    if (supabase && user) {
      const { data, error } = await supabase.rpc('join_house', { p_code: code.trim() })
      if (error) throw error
      const result = Array.isArray(data) ? data[0] : data
      const house = {
        ...demoHouse,
        id: result.household_id,
        name: result.household_name,
        members: [{ id: user.id, username: profile.username, role: 'member', floors: 0, points: 0, avatar: profile.avatar }],
      }
      activateHouse(house)
      return house
    }
    const house = { ...demoHouse, joinCode: code.trim().toUpperCase() || demoHouse.joinCode }
    activateHouse(house)
    return house
  }

  const leaveHouse = async () => {
    try {
      if (supabase && activeHouse?.id && activeHouse.id !== 'demo-house') {
        const { error } = await supabase.rpc('leave_house', { p_household_id: activeHouse.id })
        if (error) throw error
      }
      persistActiveHouse(null)
      setChores(demoChores)
      haptic()
      showToast('You left the household.', 'neutral')
      return true
    } catch (error) {
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const updateHousehold = async (patch) => {
    if (!activeHouse) return false
    try {
      const nextPatch = {}
      if (patch.name !== undefined) nextPatch.name = patch.name.trim()
      if (supabase && activeHouse.id !== 'demo-house') {
        const { error } = await supabase.from('households').update(nextPatch).eq('id', activeHouse.id)
        if (error) throw error
      }
      activateHouse({ ...activeHouse, ...nextPatch }, false)
      showToast('Household updated.')
      return true
    } catch (error) {
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const saveChore = async (nextChore) => {
    try {
      let savedChore = nextChore
      if (supabase && user && activeHouse?.id && activeHouse.id !== 'demo-house') {
        const frequencyType = Object.entries(frequencyLabel).find(([, label]) => label === nextChore.frequency)?.[0] || 'custom_interval'
        const payload = {
          household_id: activeHouse.id,
          display_name: nextChore.name.trim(),
          description: nextChore.description || '',
          category: nextChore.category || 'Housework',
          room: nextChore.room || null,
          urgency: nextChore.urgency || 'normal',
          assigned_to: nextChore.assignedTo || null,
          responsibility: nextChore.assignedTo ? 'assigned' : nextChore.responsibility || 'shared',
          frequency_type: frequencyType,
          difficulty: Number(nextChore.difficulty) || 1,
          points: Number(nextChore.points) || 1,
          full_clean_threshold: Number(nextChore.fullCleanThreshold) || 1,
          quick_clean_count: Number(nextChore.quickCount) || 0,
          estimated_minutes: nextChore.estimatedMinutes ? Number(nextChore.estimatedMinutes) : null,
          photo_required: Boolean(nextChore.photoRequired),
          notes: nextChore.notes || '',
        }
        const exists = chores.some((chore) => chore.id === nextChore.id)
        const request = exists
          ? supabase.from('chores').update(payload).eq('id', nextChore.id).eq('household_id', activeHouse.id).select().single()
          : supabase.from('chores').insert({ ...payload, created_by: user.id, sort_order: chores.length }).select().single()
        const { data, error } = await request
        if (error) throw error
        savedChore = toUiChore(data)
      }
      setChores((current) => {
        const exists = current.some((chore) => chore.id === savedChore.id)
        return exists
          ? current.map((chore) => (chore.id === savedChore.id ? savedChore : chore))
          : [...current, { ...savedChore, id: savedChore.id || globalThis.crypto?.randomUUID?.() || String(Date.now()) }]
      })
      showToast('Task saved.')
      haptic('success')
      return true
    } catch (error) {
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const deleteChore = async (id) => {
    try {
      if (supabase && activeHouse?.id && activeHouse.id !== 'demo-house') {
        const { error } = await supabase.from('chores').delete().eq('id', id).eq('household_id', activeHouse.id)
        if (error) throw error
      }
      setChores((current) => current.filter((chore) => chore.id !== id))
      showToast('Task removed.', 'neutral')
      return true
    } catch (error) {
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const reorderChore = async (id, direction) => {
    const index = chores.findIndex((chore) => chore.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= chores.length) return false
    const previous = [...chores]
    const next = [...chores]
    ;[next[index], next[target]] = [next[target], next[index]]
    setChores(next)
    try {
      if (supabase && activeHouse?.id && activeHouse.id !== 'demo-house') {
        const results = await Promise.all([
          supabase.from('chores').update({ sort_order: index }).eq('id', next[index].id).eq('household_id', activeHouse.id),
          supabase.from('chores').update({ sort_order: target }).eq('id', next[target].id).eq('household_id', activeHouse.id),
        ])
        const error = results.find((result) => result.error)?.error
        if (error) throw error
      }
      haptic()
      return true
    } catch (error) {
      setChores(previous)
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const completeChore = async (id, type = 'quick') => {
    try {
      if (supabase && activeHouse?.id && activeHouse.id !== 'demo-house') {
        const { error } = await supabase.rpc('complete_chore', { p_chore_id: id, p_completion_type: type })
        if (error) throw error
      }
      setChores((current) => current.map((chore) => {
        if (chore.id !== id) return chore
        const quickCount = type === 'full' ? 0 : chore.quickCount + 1
        return {
          ...chore,
          quickCount,
          status: quickCount >= chore.fullCleanThreshold ? 'overdue' : 'done',
          dueLabel: quickCount >= chore.fullCleanThreshold ? 'Full clean needed' : 'Done today',
          lastCompletedAt: new Date().toISOString(),
        }
      }))
      showToast(type === 'full' ? 'Full clean complete. Fresh start!' : 'Task completed.')
      haptic('success')
      return true
    } catch (error) {
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const markNotificationsRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })))
    if (supabase && user) {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
      if (error) showToast(friendlyError(error), 'error')
    }
  }

  const saveProfile = async (nextProfile) => {
    const merged = {
      ...profile,
      ...nextProfile,
      avatar: { ...profile.avatar, ...(nextProfile.avatar || {}) },
    }
    setProfileState(merged)
    if (supabase && user) {
      const { error } = await supabase.from('player_profiles').upsert({
        user_id: user.id,
        username: merged.username,
        skin_tone: merged.avatar.skin,
        hair_style: merged.avatar.hairStyle,
        hair_color: merged.avatar.hair,
        outfit_color: merged.avatar.outfit,
        accessory: merged.avatar.accessory,
        celebration: merged.avatar.celebration,
      })
      if (error) {
        showToast(friendlyError(error), 'error')
        return false
      }
    }
    return true
  }

  const value = {
    user,
    authReady,
    profile,
    setProfile: saveProfile,
    activeHouse,
    chores,
    notifications,
    theme,
    setTheme,
    loading,
    toast,
    isSupabaseConfigured,
    login,
    register,
    logout,
    createHouse,
    joinHouse,
    leaveHouse,
    updateHousehold,
    saveChore,
    deleteChore,
    reorderChore,
    completeChore,
    markNotificationsRead,
    showToast,
    haptic,
  }

  return <TaskTowerContext.Provider value={value}>{children}</TaskTowerContext.Provider>
}

export const useTaskTower = () => {
  const context = useContext(TaskTowerContext)
  if (!context) throw new Error('useTaskTower must be used inside TaskTowerProvider')
  return context
}
