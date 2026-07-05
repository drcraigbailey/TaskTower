// oxlint-disable react/only-export-components
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { defaultProfile } from '../data/defaults.js'
import { initialisePushNotifications } from '../lib/pushNotifications.js'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { friendlyError, loadProfile, requireDatabase, saveTask } from '../lib/liveDataService.js'
import {
  addShoppingRecord,
  completeTaskRecord,
  createHouseRecord,
  createNoticeRecord,
  deleteNoticeRecord,
  deleteShoppingRecord,
  deleteTaskRecord,
  joinHouseRecord,
  leaveHouseRecord,
  markNotificationsReadRecord,
  purchaseShoppingRecord,
  reorderTaskRecords,
  saveProfileRecord,
  sendMessageRecord,
  updateHouseRecord,
} from '../lib/liveMutations.js'
import useLiveHouseholds from './useLiveHouseholds.js'

const TaskTowerContext = createContext(null)
const PROFILE_KEY = 'tasktower.profile'
const THEME_KEY = 'tasktower.theme'

const storedProfile = () => {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') || defaultProfile
  } catch {
    return defaultProfile
  }
}

export function TaskTowerProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfileState] = useState(storedProfile)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3000)
  }, [])

  const haptic = useCallback(async (kind = 'light') => {
    try {
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success })
      else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
    } catch {
      // Native feedback is optional on web.
    }
  }, [])

  const household = useLiveHouseholds(user, profile, showToast, haptic)

  const requireUser = useCallback(() => {
    requireDatabase()
    if (!user) throw new Error('Please sign in before changing household data.')
    return user
  }, [user])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return undefined
    }
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) showToast(friendlyError(error), 'error')
      setUser(data?.session?.user || null)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user || null)
      setAuthReady(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [showToast])

  useEffect(() => {
    if (!user) {
      setProfileState(defaultProfile)
      return
    }
    let cancelled = false
    loadProfile(user)
      .then((nextProfile) => {
        if (cancelled) return
        setProfileState(nextProfile)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))
      })
      .catch((error) => !cancelled && showToast(friendlyError(error), 'error'))
    return () => { cancelled = true }
  }, [showToast, user?.id])

  useEffect(() => {
    let cleanup = () => {}
    initialisePushNotifications(user?.id)
      .then((nextCleanup) => { cleanup = nextCleanup })
      .catch((error) => console.warn('Push notification setup was skipped', error))
    return () => cleanup()
  }, [user?.id])

  const login = async ({ email, password }) => {
    setLoading(true)
    try {
      const db = requireDatabase()
      const { data, error } = await db.auth.signInWithPassword({ email, password })
      if (error) throw error
      setUser(data.user)
      const nextProfile = await loadProfile(data.user)
      setProfileState(nextProfile)
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))
      const nextHouses = await household.refreshHouses(data.user)
      await haptic('success')
      return { ok: true, houseId: nextHouses.find((house) => house.id === household.storedHouseId())?.id || nextHouses[0]?.id || null }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    } finally {
      setLoading(false)
    }
  }

  const register = async ({ username, email, password }) => {
    setLoading(true)
    try {
      const db = requireDatabase()
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim() } },
      })
      if (error) throw error
      if (!data.session) return { ok: true, needsEmailConfirmation: true }
      setUser(data.session.user)
      const nextProfile = await loadProfile(data.session.user)
      setProfileState(nextProfile)
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))
      await household.refreshHouses(data.session.user)
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
    setProfileState(defaultProfile)
    localStorage.removeItem(PROFILE_KEY)
    household.clearHouseData()
  }

  const createHouse = async (name) => {
    const signedInUser = requireUser()
    const result = await createHouseRecord(name)
    const nextHouses = await household.refreshHouses(signedInUser, result.household_id)
    const house = nextHouses.find((item) => item.id === result.household_id)
      || { id: result.household_id, name: result.name, role: 'owner', members: [] }
    const selected = { ...house, joinCode: result.join_code || null }
    household.setActiveHouse(selected)
    household.persistHouseId(selected.id)
    showToast(`${selected.name} is ready.`)
    await haptic('success')
    return selected
  }

  const joinHouse = async (code) => {
    const signedInUser = requireUser()
    const result = await joinHouseRecord(code)
    const nextHouses = await household.refreshHouses(signedInUser, result.household_id)
    const house = nextHouses.find((item) => item.id === result.household_id)
    if (!house) throw new Error('The household was joined but could not be loaded.')
    household.setActiveHouse(house)
    household.persistHouseId(house.id)
    showToast(`Joined ${house.name}.`)
    await haptic('success')
    return house
  }

  const leaveHouse = async (houseId = household.activeHouse?.id) => {
    const signedInUser = requireUser()
    if (!houseId) return
    await leaveHouseRecord(houseId)
    await household.refreshHouses(signedInUser)
    showToast('You left the household.', 'neutral')
  }

  const updateHouse = async (changes) => {
    requireUser()
    if (!household.activeHouse?.id) throw new Error('Choose a household first.')
    const data = await updateHouseRecord(household.activeHouse.id, changes)
    const next = {
      ...household.activeHouse,
      name: data.name,
      towerHeight: data.tower_height,
      monthlyResetDay: data.monthly_reset_day,
    }
    household.setActiveHouse(next)
    household.setHouses((current) => current.map((house) => house.id === next.id ? { ...house, ...next } : house))
    showToast('Household changes saved.')
    return next
  }

  const saveChore = async (task) => {
    const signedInUser = requireUser()
    if (!household.activeHouse?.id) throw new Error('Choose a household first.')
    const saved = await saveTask(household.activeHouse.id, signedInUser.id, household.chores, task)
    await household.refreshActiveHouse()
    showToast('Task saved. Nice and tidy.')
    return saved
  }

  const deleteChore = async (id) => {
    requireUser()
    await deleteTaskRecord(id)
    await household.refreshActiveHouse()
  }

  const reorderChore = async (id, direction) => {
    requireUser()
    const next = await reorderTaskRecords(household.chores, id, direction)
    household.setChores(next)
  }

  const completeChore = async (id, type = 'quick') => {
    requireUser()
    await completeTaskRecord(id, type)
    await household.refreshActiveHouse()
    await haptic('success')
  }

  const addShoppingItem = async (item) => {
    const signedInUser = requireUser()
    await addShoppingRecord(household.activeHouse.id, signedInUser.id, item)
    await household.refreshActiveHouse()
  }

  const markShoppingPurchased = async (id) => {
    const signedInUser = requireUser()
    await purchaseShoppingRecord(id, signedInUser.id)
    await household.refreshActiveHouse()
  }

  const deleteShoppingItem = async (id) => {
    requireUser()
    await deleteShoppingRecord(id)
    await household.refreshActiveHouse()
  }

  const sendMessage = async (body) => {
    const signedInUser = requireUser()
    await sendMessageRecord(household.activeHouse.id, signedInUser.id, body)
    await household.refreshActiveHouse()
  }

  const createNotice = async (notice) => {
    const signedInUser = requireUser()
    await createNoticeRecord(household.activeHouse.id, signedInUser.id, notice)
    await household.refreshActiveHouse()
  }

  const deleteNotice = async (id) => {
    requireUser()
    await deleteNoticeRecord(id)
    await household.refreshActiveHouse()
  }

  const markNotificationsRead = async () => {
    household.setNotifications((current) => current.map((item) => ({ ...item, unread: false })))
    if (!user) return
    try {
      await markNotificationsReadRecord(user.id)
    } catch (error) {
      showToast(friendlyError(error), 'error')
    }
  }

  const saveProfile = async (nextProfile) => {
    const signedInUser = requireUser()
    const cleanProfile = await saveProfileRecord(signedInUser.id, nextProfile)
    setProfileState(cleanProfile)
    localStorage.setItem(PROFILE_KEY, JSON.stringify(cleanProfile))
    await household.refreshActiveHouse()
    showToast('Profile saved.')
    return cleanProfile
  }

  const value = {
    user,
    authReady,
    householdsReady: household.householdsReady,
    profile,
    setProfile: saveProfile,
    houses: household.houses,
    activeHouse: household.activeHouse,
    chores: household.chores,
    shoppingItems: household.shoppingItems,
    messages: household.messages,
    notices: household.notices,
    activity: household.activity,
    notifications: household.notifications,
    theme,
    setTheme,
    loading,
    dataLoading: household.dataLoading,
    toast,
    isSupabaseConfigured,
    login,
    register,
    logout,
    selectHouse: household.selectHouse,
    createHouse,
    joinHouse,
    leaveHouse,
    updateHouse,
    saveChore,
    deleteChore,
    reorderChore,
    completeChore,
    addShoppingItem,
    markShoppingPurchased,
    deleteShoppingItem,
    sendMessage,
    createNotice,
    deleteNotice,
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
