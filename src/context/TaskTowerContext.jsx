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

const friendlyError = (error) =>
  error?.message || 'Something wobbled. Please try that once more.'

const frequencyLabel = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  custom_days: 'Custom days',
  custom_interval: 'Custom interval',
}

const toUiChore = (row) => {
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

export function TaskTowerProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(() => readStored(PROFILE_KEY, defaultProfile))
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

    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

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

  useEffect(() => {
    if (!supabase || !user || !activeHouse?.id || activeHouse.id === 'demo-house') return undefined
    let cancelled = false
    const houseId = activeHouse.id

    const refreshHouse = async () => {
      const [houseResult, membersResult, choresResult, gameResult, codeResult, notificationsResult] = await Promise.all([
        supabase.from('households').select('id, name, tower_height, monthly_reset_day').eq('id', houseId).maybeSingle(),
        supabase.from('household_members').select('user_id, role, joined_at').eq('household_id', houseId),
        supabase.from('chores').select('*').eq('household_id', houseId).eq('is_active', true).order('sort_order'),
        supabase.from('monthly_game_state').select('user_id, points, floors_climbed, is_winner').eq('household_id', houseId).eq('month_start', new Date().toISOString().slice(0, 7) + '-01'),
        supabase.from('household_join_codes').select('code').eq('household_id', houseId).eq('active', true).limit(1).maybeSingle(),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40),
      ])

      if (cancelled) return
      if (houseResult.error || !houseResult.data) {
        setActiveHouse(null)
        localStorage.removeItem(ACTIVE_HOUSE_KEY)
        Preferences.remove({ key: ACTIVE_HOUSE_KEY })
        setToast({ message: 'That house is no longer available, so we brought you safely home.', tone: 'neutral' })
        return
      }

      const memberIds = (membersResult.data || []).map((member) => member.user_id)
      const profilesResult = memberIds.length
        ? await supabase.from('player_profiles').select('*').in('user_id', memberIds)
        : { data: [] }
      if (cancelled) return
      const profileById = Object.fromEntries((profilesResult.data || []).map((item) => [item.user_id, item]))
      const gameById = Object.fromEntries((gameResult.data || []).map((item) => [item.user_id, item]))
      const members = (membersResult.data || []).map((member) => {
        const memberProfile = profileById[member.user_id] || {}
        const score = gameById[member.user_id] || {}
        return {
          id: member.user_id,
          username: member.user_id === user.id ? 'You' : memberProfile.username || 'Housemate',
          floors: score.floors_climbed || 0,
          points: score.points || 0,
          avatar: {
            skin: memberProfile.skin_tone || defaultProfile.avatar.skin,
            hair: memberProfile.hair_color || defaultProfile.avatar.hair,
            hairStyle: memberProfile.hair_style || defaultProfile.avatar.hairStyle,
            outfit: memberProfile.outfit_color || defaultProfile.avatar.outfit,
            accessory: memberProfile.accessory || 'none',
            celebration: memberProfile.celebration || 'confetti',
          },
        }
      })

      const nextHouse = {
        id: houseResult.data.id,
        name: houseResult.data.name,
        towerHeight: houseResult.data.tower_height,
        resetIn: 12,
        streak: 0,
        joinCode: codeResult.data?.code || activeHouse.joinCode || 'OWNER ONLY',
        members,
      }
      setActiveHouse(nextHouse)
      localStorage.setItem(ACTIVE_HOUSE_KEY, JSON.stringify(nextHouse))
      Preferences.set({ key: ACTIVE_HOUSE_KEY, value: JSON.stringify(nextHouse) })
      setChores((choresResult.data || []).map(toUiChore))
      setNotifications((notificationsResult.data || []).map((item) => ({
        id: item.id,
        type: item.type === 'chore_completed' ? 'success' : item.type.includes('due') ? 'due' : 'house',
        title: item.title,
        body: item.body,
        time: new Date(item.created_at).toLocaleDateString(),
        unread: !item.read_at,
      })))
    }

    refreshHouse()
    const channel = supabase
      .channel(`house-${houseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_completions', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_game_state', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${houseId}` }, refreshHouse)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user, activeHouse?.id, activeHouse?.joinCode])

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

  const activateHouse = (house, withHaptic = true) => {
    setActiveHouse(house)
    localStorage.setItem(ACTIVE_HOUSE_KEY, JSON.stringify(house))
    Preferences.set({ key: ACTIVE_HOUSE_KEY, value: JSON.stringify(house) })
    if (withHaptic) haptic('success')
  }

  const restoreFirstHouseForUser = async (signedInUser) => {
    if (!supabase || !signedInUser) return activeHouse
    if (activeHouse?.id && activeHouse.id !== 'demo-house') return activeHouse

    try {
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id, role, joined_at')
        .eq('user_id', signedInUser.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (membershipError) throw membershipError
      if (!membership?.household_id) return null

      const { data: household, error: householdError } = await supabase
        .from('households')
        .select('id, name, tower_height, monthly_reset_day')
        .eq('id', membership.household_id)
        .maybeSingle()
      if (householdError) throw householdError
      if (!household) return null

      const restoredHouse = {
        ...demoHouse,
        id: household.id,
        name: household.name,
        towerHeight: household.tower_height,
        members: [{
          id: signedInUser.id,
          username: profile.username || signedInUser.user_metadata?.username || 'You',
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
      return { ok: true, houseId: restoredHouse?.id || activeHouse?.id || null }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    } finally {
      setLoading(false)
    }
  }

  const register = async ({ username, email, password }) => {
    setLoading(true)
    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        })
        if (error) throw error
        setUser(data.user)
      } else {
        setUser({ id: 'demo-user', email })
      }
      setProfile((current) => ({ ...current, username }))
      sessionStorage.setItem('tasktower.justLoggedIn', 'true')
      await haptic('success')
      return { ok: true }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setActiveHouse(null)
    localStorage.removeItem(ACTIVE_HOUSE_KEY)
    Preferences.remove({ key: ACTIVE_HOUSE_KEY })
  }

  const createHouse = async (name) => {
    if (supabase && user) {
      const { data, error } = await supabase.rpc('create_house', { p_name: name })
      if (error) throw error
      const result = Array.isArray(data) ? data[0] : data
      const house = {
        ...demoHouse,
        id: result.household_id,
        name,
        joinCode: result.join_code,
        members: [{ id: user.id, username: 'You', floors: 0, points: 0, avatar: profile.avatar }],
      }
      activateHouse(house)
      return house
    }
    const house = { ...demoHouse, name: name || 'Our Home' }
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
        members: [{ id: user.id, username: 'You', floors: 0, points: 0, avatar: profile.avatar }],
      }
      activateHouse(house)
      return house
    }
    const house = { ...demoHouse, joinCode: code.trim().toUpperCase() || demoHouse.joinCode }
    activateHouse(house)
    return house
  }

  const leaveHouse = () => {
    setActiveHouse(null)
    localStorage.removeItem(ACTIVE_HOUSE_KEY)
    Preferences.remove({ key: ACTIVE_HOUSE_KEY })
    haptic()
  }

  const saveChore = async (nextChore) => {
    let savedChore = nextChore
    if (supabase && user && activeHouse?.id && activeHouse.id !== 'demo-house') {
      const frequencyType = Object.entries(frequencyLabel).find(([, label]) => label === nextChore.frequency)?.[0] || 'custom_interval'
      const payload = {
        household_id: activeHouse.id,
        display_name: nextChore.name,
        description: nextChore.description || '',
        category: nextChore.category,
        frequency_type: frequencyType,
        difficulty: nextChore.difficulty,
        points: nextChore.points,
        full_clean_threshold: nextChore.fullCleanThreshold,
        quick_clean_count: nextChore.quickCount || 0,
        created_by: user.id,
      }
      const exists = chores.some((chore) => chore.id === nextChore.id)
      const request = exists
        ? supabase.from('chores').update(payload).eq('id', nextChore.id).select().single()
        : supabase.from('chores').insert({ ...payload, sort_order: chores.length }).select().single()
      const { data, error } = await request
      if (error) {
        showToast(friendlyError(error), 'error')
        return
      }
      savedChore = toUiChore(data)
    }
    setChores((current) => {
      const exists = current.some((chore) => chore.id === savedChore.id)
      return exists
        ? current.map((chore) => (chore.id === savedChore.id ? savedChore : chore))
        : [...current, { ...savedChore, id: savedChore.id || crypto.randomUUID() }]
    })
    showToast('Chore saved. Nice and tidy.')
    haptic('success')
  }

  const deleteChore = async (id) => {
    if (supabase && activeHouse?.id && activeHouse.id !== 'demo-house') {
      const { error } = await supabase.from('chores').delete().eq('id', id)
      if (error) {
        showToast(friendlyError(error), 'error')
        return
      }
    }
    setChores((current) => current.filter((chore) => chore.id !== id))
    showToast('Chore removed.', 'neutral')
  }

  const reorderChore = (id, direction) => {
    const index = chores.findIndex((chore) => chore.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= chores.length) return
    const next = [...chores]
    ;[next[index], next[target]] = [next[target], next[index]]
    setChores(next)
    if (supabase && activeHouse?.id && activeHouse.id !== 'demo-house') {
      Promise.all([
        supabase.from('chores').update({ sort_order: index }).eq('id', next[index].id),
        supabase.from('chores').update({ sort_order: target }).eq('id', next[target].id),
      ])
    }
    haptic()
  }

  const completeChore = async (id, type = 'quick') => {
    if (supabase && activeHouse?.id && activeHouse.id !== 'demo-house') {
      const { error } = await supabase.rpc('complete_chore', { p_chore_id: id, p_completion_type: type })
      if (error) {
        showToast(friendlyError(error), 'error')
        return
      }
    }
    setChores((current) =>
      current.map((chore) => {
        if (chore.id !== id) return chore
        const quickCount = type === 'full' ? 0 : Math.min(chore.quickCount + 1, chore.fullCleanThreshold)
        return {
          ...chore,
          quickCount,
          status: quickCount >= chore.fullCleanThreshold ? 'overdue' : 'done',
          dueLabel: quickCount >= chore.fullCleanThreshold ? 'Full clean needed' : 'Done today',
        }
      }),
    )
    showToast(type === 'full' ? 'Full clean complete—fresh start!' : 'Done! You climbed a floor.')
    haptic('success')
  }

  const markNotificationsRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })))
    if (supabase && user) {
      supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
    }
  }

  const saveProfile = (nextProfile) => {
    setProfile(nextProfile)
    if (supabase && user) {
      supabase.from('player_profiles').upsert({
        user_id: user.id,
        username: nextProfile.username,
        skin_tone: nextProfile.avatar.skin,
        hair_style: nextProfile.avatar.hairStyle,
        hair_color: nextProfile.avatar.hair,
        outfit_color: nextProfile.avatar.outfit,
        accessory: nextProfile.avatar.accessory,
        celebration: nextProfile.avatar.celebration,
      })
    }
  }

  const value = {
      user,
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
