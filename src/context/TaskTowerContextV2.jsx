// oxlint-disable react/only-export-components
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'
import { defaultProfile, demoChores, demoHouse, demoNotifications } from '../data/demoData.js'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { createSignedMediaUrl, readImageAsDataUrl, removeMediaPath, uploadHouseholdImage, uploadProfileImage } from '../lib/media.js'
import { initialisePushNotifications } from '../lib/pushNotifications.js'
import {
  ACTIVE_HOUSE_KEY,
  CHORES_KEY,
  PROFILE_KEY,
  THEME_KEY,
  emptyLiveProfile,
  friendlyError,
  frequencyLabel,
  loadHouseSnapshot,
  loadOwnProfile,
  readStored,
  restoreLatestHouse,
  toUiChore,
} from './taskTowerHelpers.js'

const TaskTowerContext = createContext(null)

export function TaskTowerProvider({ children }) {
  const liveMode = Boolean(supabase)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(!liveMode)
  const [profile, setProfileState] = useState(() => liveMode ? emptyLiveProfile() : readStored(PROFILE_KEY, defaultProfile))
  const [activeHouse, setActiveHouse] = useState(() => liveMode ? null : readStored(ACTIVE_HOUSE_KEY, null))
  const [chores, setChores] = useState(() => liveMode ? [] : readStored(CHORES_KEY, demoChores))
  const [notifications, setNotifications] = useState(() => liveMode ? [] : demoNotifications)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const restoredForUser = useRef(null)

  const haptic = useCallback(async (kind = 'light') => {
    try {
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success })
      else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
    } catch {}
  }, [])

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3000)
  }, [])

  const persistActiveHouse = useCallback((house) => {
    setActiveHouse(house)
    if (liveMode) {
      localStorage.removeItem(ACTIVE_HOUSE_KEY)
      Preferences.remove({ key: ACTIVE_HOUSE_KEY })
      return
    }
    if (house) {
      localStorage.setItem(ACTIVE_HOUSE_KEY, JSON.stringify(house))
      Preferences.set({ key: ACTIVE_HOUSE_KEY, value: JSON.stringify(house) })
    } else {
      localStorage.removeItem(ACTIVE_HOUSE_KEY)
      Preferences.remove({ key: ACTIVE_HOUSE_KEY })
    }
  }, [liveMode])

  const activateHouse = useCallback((house, withHaptic = true) => {
    persistActiveHouse(house)
    if (withHaptic) haptic('success')
  }, [haptic, persistActiveHouse])

  const clearLiveState = useCallback(() => {
    setActiveHouse(null)
    setProfileState(emptyLiveProfile())
    setChores([])
    setNotifications([])
    localStorage.removeItem(ACTIVE_HOUSE_KEY)
    localStorage.removeItem(PROFILE_KEY)
    localStorage.removeItem(CHORES_KEY)
    Preferences.remove({ key: ACTIVE_HOUSE_KEY })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!liveMode) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  }, [liveMode, profile])

  useEffect(() => {
    if (!liveMode) localStorage.setItem(CHORES_KEY, JSON.stringify(chores))
  }, [chores, liveMode])

  useEffect(() => {
    if (!supabase) return undefined
    let mounted = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error
      if (mounted) setUser(data.session?.user || null)
    }).catch(console.warn).finally(() => { if (mounted) setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null
      setUser(nextUser)
      if (!nextUser) {
        restoredForUser.current = null
        clearLiveState()
      }
      setAuthReady(true)
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [clearLiveState])

  useEffect(() => {
    if (liveMode) return undefined
    let cancelled = false
    Preferences.get({ key: ACTIVE_HOUSE_KEY }).then(({ value }) => {
      if (cancelled || !value) return
      try { setActiveHouse((current) => current || JSON.parse(value)) }
      catch { Preferences.remove({ key: ACTIVE_HOUSE_KEY }) }
    })
    return () => { cancelled = true }
  }, [liveMode])

  useEffect(() => {
    let cleanup = () => {}
    initialisePushNotifications(user?.id).then((nextCleanup) => { cleanup = nextCleanup }).catch(console.warn)
    return () => cleanup()
  }, [user?.id])

  useEffect(() => {
    if (!supabase || !user?.id) return undefined
    let cancelled = false
    loadOwnProfile(user.id).then((next) => { if (!cancelled) setProfileState(next) }).catch(console.warn)
    return () => { cancelled = true }
  }, [user?.id])

  const restoreHouse = useCallback(async (signedInUser) => {
    if (!supabase || !signedInUser) return null
    try {
      const house = await restoreLatestHouse(signedInUser.id)
      persistActiveHouse(house)
      if (!house) setChores([])
      return house
    } catch (error) {
      console.warn('Could not restore household', error)
      return null
    }
  }, [persistActiveHouse])

  useEffect(() => {
    if (!supabase || !authReady || !user?.id || restoredForUser.current === user.id) return
    restoredForUser.current = user.id
    restoreHouse(user)
  }, [authReady, restoreHouse, user])

  const refreshHousehold = useCallback(async () => {
    if (!supabase || !user?.id || !activeHouse?.id || activeHouse.id === 'demo-house') return false
    try {
      const snapshot = await loadHouseSnapshot({ houseId: activeHouse.id, userId: user.id, fallbackJoinCode: activeHouse.joinCode })
      if (!snapshot) {
        persistActiveHouse(null)
        setChores([])
        showToast('That household is no longer available.', 'neutral')
        return false
      }
      setActiveHouse(snapshot.house)
      setChores(snapshot.chores)
      setNotifications(snapshot.notifications)
      if (snapshot.ownProfile) setProfileState(snapshot.ownProfile)
      return true
    } catch (error) {
      console.warn('Could not refresh household data', error)
      return false
    }
  }, [activeHouse?.id, activeHouse?.joinCode, persistActiveHouse, showToast, user?.id])

  useEffect(() => {
    if (!supabase || !user?.id || !activeHouse?.id || activeHouse.id === 'demo-house') return undefined
    let timer
    const refreshSoon = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(refreshHousehold, 120)
    }
    refreshHousehold()
    const houseId = activeHouse.id
    const channel = supabase.channel(`house-${houseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${houseId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `household_id=eq.${houseId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_completions', filter: `household_id=eq.${houseId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_game_state', filter: `household_id=eq.${houseId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${houseId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `household_id=eq.${houseId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_profiles' }, refreshSoon)
      .subscribe()
    return () => {
      window.clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [activeHouse?.id, refreshHousehold, user?.id])

  const login = async ({ email, password }) => {
    setLoading(true)
    try {
      let signedInUser
      let house
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        signedInUser = data.user
        setUser(signedInUser)
        restoredForUser.current = signedInUser.id
        house = await restoreHouse(signedInUser)
      } else {
        signedInUser = { id: 'demo-user', email: email || 'hello@dwellio.app' }
        setUser(signedInUser)
        house = readStored(ACTIVE_HOUSE_KEY, null)
        setActiveHouse(house)
      }
      sessionStorage.setItem('tasktower.justLoggedIn', 'true')
      await haptic('success')
      return { ok: true, houseId: house?.id || null }
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
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } })
        if (error) throw error
        if (!data.session) {
          setProfileState((current) => ({ ...current, username }))
          return { ok: true, needsConfirmation: true }
        }
        setUser(data.user)
        restoredForUser.current = data.user.id
      } else setUser({ id: 'demo-user', email })
      setProfileState((current) => ({ ...current, username }))
      sessionStorage.setItem('tasktower.justLoggedIn', 'true')
      return { ok: true, houseId: null }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
      restoredForUser.current = null
      clearLiveState()
    } else {
      setUser(null)
      setActiveHouse(null)
    }
  }

  const createHouse = async (name) => {
    if (supabase && user) {
      const { data, error } = await supabase.rpc('create_house', { p_name: name })
      if (error) throw error
      const result = Array.isArray(data) ? data[0] : data
      const house = {
        id: result.household_id, name: name.trim(), ownerId: user.id, towerHeight: 20,
        monthlyResetDay: 1, resetIn: 0, streak: 0, joinCode: result.join_code,
        members: [{ id: user.id, username: profile.username, role: 'owner', floors: 0, points: 0, image: profile.image || '', avatar: profile.avatar }],
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
        id: result.household_id, name: result.household_name, ownerId: '', towerHeight: 20,
        monthlyResetDay: 1, resetIn: 0, streak: 0, joinCode: code.trim().toUpperCase(),
        members: [{ id: user.id, username: profile.username, role: 'member', floors: 0, points: 0, image: profile.image || '', avatar: profile.avatar }],
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
        setChores([])
      } else setChores(demoChores)
      persistActiveHouse(null)
      showToast('You left the household.', 'neutral')
      return true
    } catch (error) {
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const removeHouseholdMember = async (memberId) => {
    if (!activeHouse?.id || memberId === user?.id) return false
    try {
      if (supabase && activeHouse.id !== 'demo-house') {
        const { error } = await supabase.rpc('remove_household_member', { p_household_id: activeHouse.id, p_user_id: memberId })
        if (error) throw error
        await refreshHousehold()
      } else activateHouse({ ...activeHouse, members: activeHouse.members.filter((member) => member.id !== memberId) }, false)
      showToast('Household member removed.', 'neutral')
      return true
    } catch (error) {
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const updateHousehold = async (patch) => {
    if (!activeHouse) return false
    try {
      const nextPatch = patch.name === undefined ? {} : { name: patch.name.trim() }
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
    let uploadedPath = ''
    try {
      let savedChore = nextChore
      if (supabase && user && activeHouse?.id && activeHouse.id !== 'demo-house') {
        const previousPath = nextChore.imagePath || ''
        let imagePath = nextChore.removeImage ? '' : previousPath
        if (nextChore.imageFile) {
          uploadedPath = await uploadHouseholdImage({ file: nextChore.imageFile, householdId: activeHouse.id, userId: user.id, kind: 'tasks' })
          imagePath = uploadedPath
        }
        const payload = {
          household_id: activeHouse.id,
          display_name: nextChore.name.trim(),
          description: nextChore.description || '',
          category: nextChore.category || 'Housework',
          room: nextChore.room || null,
          urgency: nextChore.urgency || 'normal',
          assigned_to: nextChore.assignedTo || null,
          responsibility: nextChore.assignedTo ? 'assigned' : nextChore.responsibility || 'shared',
          frequency_type: Object.entries(frequencyLabel).find(([, label]) => label === nextChore.frequency)?.[0] || 'custom_interval',
          difficulty: Number(nextChore.difficulty) || 1,
          points: Number(nextChore.points) || 1,
          full_clean_threshold: Number(nextChore.fullCleanThreshold) || 1,
          quick_clean_count: Number(nextChore.quickCount) || 0,
          estimated_minutes: nextChore.estimatedMinutes ? Number(nextChore.estimatedMinutes) : null,
          photo_required: Boolean(nextChore.photoRequired),
          notes: nextChore.notes || '',
          image_path: imagePath || null,
        }
        const exists = chores.some((chore) => chore.id === nextChore.id)
        const request = exists
          ? supabase.from('chores').update(payload).eq('id', nextChore.id).eq('household_id', activeHouse.id).select().single()
          : supabase.from('chores').insert({ ...payload, created_by: user.id, sort_order: chores.length }).select().single()
        const { data, error } = await request
        if (error) throw error
        savedChore = toUiChore(data, await createSignedMediaUrl(data.image_path))
        if (previousPath && previousPath !== data.image_path) removeMediaPath(previousPath)
      } else {
        const imageUrl = nextChore.imageFile ? await readImageAsDataUrl(nextChore.imageFile) : nextChore.removeImage ? '' : nextChore.imageUrl || ''
        savedChore = { ...nextChore, imageUrl, imageFile: undefined, removeImage: false }
      }
      setChores((current) => current.some((chore) => chore.id === savedChore.id)
        ? current.map((chore) => chore.id === savedChore.id ? savedChore : chore)
        : [...current, { ...savedChore, id: savedChore.id || globalThis.crypto?.randomUUID?.() || String(Date.now()) }])
      showToast('Task saved.')
      return true
    } catch (error) {
      if (uploadedPath) removeMediaPath(uploadedPath)
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const deleteChore = async (id) => {
    try {
      const existing = chores.find((chore) => chore.id === id)
      if (supabase && activeHouse?.id && activeHouse.id !== 'demo-house') {
        const { error } = await supabase.from('chores').delete().eq('id', id).eq('household_id', activeHouse.id)
        if (error) throw error
        if (existing?.imagePath) removeMediaPath(existing.imagePath)
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
        return { ...chore, quickCount, status: quickCount >= chore.fullCleanThreshold ? 'overdue' : 'done', dueLabel: quickCount >= chore.fullCleanThreshold ? 'Full clean needed' : 'Done today', lastCompletedAt: new Date().toISOString() }
      }))
      showToast(type === 'full' ? 'Full clean complete. Fresh start!' : 'Task completed.')
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
    const { avatarFile, removeAvatar, ...patch } = nextProfile || {}
    const merged = { ...profile, ...patch, avatar: { ...profile.avatar, ...(patch.avatar || {}) } }
    let uploadedPath = ''
    try {
      if (supabase && user) {
        const previousPath = profile.imagePath || ''
        let avatarPath = removeAvatar ? '' : previousPath
        if (avatarFile) {
          uploadedPath = await uploadProfileImage({ file: avatarFile, userId: user.id })
          avatarPath = uploadedPath
        }
        const { error } = await supabase.from('player_profiles').upsert({
          user_id: user.id,
          username: merged.username,
          skin_tone: merged.avatar.skin,
          hair_style: merged.avatar.hairStyle,
          hair_color: merged.avatar.hair,
          outfit_color: merged.avatar.outfit,
          accessory: merged.avatar.accessory,
          celebration: merged.avatar.celebration,
          avatar_path: avatarPath || null,
        })
        if (error) throw error
        const saved = { ...merged, image: await createSignedMediaUrl(avatarPath), imagePath: avatarPath }
        setProfileState(saved)
        setActiveHouse((current) => current ? { ...current, members: current.members.map((member) => member.id === user.id ? { ...member, username: saved.username, image: saved.image, avatar: saved.avatar } : member) } : current)
        if (previousPath && previousPath !== avatarPath) removeMediaPath(previousPath)
      } else {
        const image = avatarFile ? await readImageAsDataUrl(avatarFile) : removeAvatar ? '' : profile.image || ''
        setProfileState({ ...merged, image, imagePath: '' })
      }
      return true
    } catch (error) {
      if (uploadedPath) removeMediaPath(uploadedPath)
      showToast(friendlyError(error), 'error')
      return false
    }
  }

  const value = {
    user, authReady, profile, setProfile: saveProfile, activeHouse, chores, notifications,
    theme, setTheme, loading, toast, isSupabaseConfigured, login, register, logout,
    createHouse, joinHouse, leaveHouse, removeHouseholdMember, updateHousehold,
    refreshHousehold, saveChore, deleteChore, reorderChore, completeChore,
    markNotificationsRead, showToast, haptic,
  }

  return <TaskTowerContext.Provider value={value}>{children}</TaskTowerContext.Provider>
}

export const useTaskTower = () => {
  const context = useContext(TaskTowerContext)
  if (!context) throw new Error('useTaskTower must be used inside TaskTowerProvider')
  return context
}
