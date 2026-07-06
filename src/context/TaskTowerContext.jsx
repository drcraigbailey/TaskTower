// oxlint-disable react/only-export-components
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { defaultProfile } from '../data/defaults.js'
import { initialisePushNotifications } from '../lib/pushNotifications.js'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { friendlyError, loadProfile, requireDatabase, saveTask } from '../lib/liveDataService.js'
import { deleteMedia, uploadHouseholdImage, uploadProfileImage } from '../lib/mediaStorage.js'
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

const confirmationRedirectUrl = () => {
  const configuredUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  if (configuredUrl) return configuredUrl

  return `${window.location.origin}/login`
}

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
      if (kind === 'success') {
        await Haptics.notification({ type: NotificationType.Success })
      } else {
        await Haptics.impact({
          style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
        })
      }
    } catch {
      // Native feedback is optional on web.
    }
  }, [])

  const household = useLiveHouseholds(user, profile, showToast, haptic)

  const requireUser = useCallback(() => {
    requireDatabase()

    if (!user) {
      throw new Error('Please sign in before changing household data.')
    }

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

      if (error) {
        showToast(friendlyError(error), 'error')
      }

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
      .catch((error) => {
        if (!cancelled) {
          showToast(friendlyError(error), 'error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [showToast, user?.id])

  useEffect(() => {
    let cleanup = () => {}

    initialisePushNotifications(user?.id)
      .then((nextCleanup) => {
        cleanup = nextCleanup
      })
      .catch((error) => {
        console.warn('Push notification setup was skipped', error)
      })

    return () => cleanup()
  }, [user?.id])

  const login = async ({ email, password }) => {
    setLoading(true)

    try {
      const db = requireDatabase()

      const { data, error } = await db.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      setUser(data.user)

      const nextProfile = await loadProfile(data.user)

      setProfileState(nextProfile)
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))

      const nextHouses = await household.refreshHouses(data.user)

      await haptic('success')

      return {
        ok: true,
        houseId:
          nextHouses.find(
            (house) => house.id === household.storedHouseId(),
          )?.id ||
          nextHouses[0]?.id ||
          null,
      }
    } catch (error) {
      return {
        ok: false,
        error: friendlyError(error),
      }
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
        options: {
          emailRedirectTo: confirmationRedirectUrl(),
          data: {
            username: username.trim(),
          },
        },
      })

      if (error) throw error

      if (!data.session) {
        return {
          ok: true,
          needsEmailConfirmation: true,
        }
      }

      setUser(data.session.user)

      const nextProfile = await loadProfile(data.session.user)

      setProfileState(nextProfile)
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))

      await household.refreshHouses(data.session.user)
      await haptic('success')

      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: friendlyError(error),
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }

    setUser(null)
    setProfileState(defaultProfile)
    localStorage.removeItem(PROFILE_KEY)
    household.clearHouseData()
  }

  const createHouse = async (name) => {
    const signedInUser = requireUser()
    const result = await createHouseRecord(name)

    const nextHouses = await household.refreshHouses(
      signedInUser,
      result.household_id,
    )

    const house =
      nextHouses.find((item) => item.id === result.household_id) || {
        id: result.household_id,
        name: result.name,
        role: 'owner',
        members: [],
      }

    const selected = {
      ...house,
      joinCode: result.join_code || null,
    }

    household.setActiveHouse(selected)
    household.persistHouseId(selected.id)

    showToast(`${selected.name} is ready.`)
    await haptic('success')

    return selected
  }

  const joinHouse = async (code) => {
    const signedInUser = requireUser()
    const result = await joinHouseRecord(code)

    const nextHouses = await household.refreshHouses(
      signedInUser,
      result.household_id,
    )

    const house = nextHouses.find(
      (item) => item.id === result.household_id,
    )

    if (!house) {
      throw new Error('The household was joined but could not be loaded.')
    }

    household.setActiveHouse(house)
    household.persistHouseId(house.id)

    showToast(`Joined ${house.name}.`)
    await haptic('success')

    return house
  }

  const leaveHouse = async (
    houseId = household.activeHouse?.id,
  ) => {
    const signedInUser = requireUser()

    if (!houseId) return

    await leaveHouseRecord(houseId)
    await household.refreshHouses(signedInUser)

    showToast('You left the household.', 'neutral')
  }

  const updateHouse = async (changes) => {
    const signedInUser = requireUser()

    if (!household.activeHouse?.id) {
      throw new Error('Choose a household first.')
    }

    const pictureChanged = Boolean(changes.pictureFile) || Boolean(changes.removePicture)
    const previousImagePath = household.activeHouse.imagePath || null
    let uploadedImage = null
    let nextImagePath = previousImagePath

    if (changes.pictureFile) {
      uploadedImage = await uploadHouseholdImage(household.activeHouse.id, signedInUser.id, changes.pictureFile)
      nextImagePath = uploadedImage.path
    } else if (changes.removePicture) {
      nextImagePath = null
    }

    let data
    try {
      data = await updateHouseRecord(
        household.activeHouse.id,
        { ...changes, imagePath: nextImagePath },
        { includeImagePath: pictureChanged },
      )
    } catch (error) {
      if (uploadedImage?.path) await deleteMedia(uploadedImage.path).catch(() => {})
      throw error
    }

    if (pictureChanged && previousImagePath && previousImagePath !== nextImagePath) {
      await deleteMedia(previousImagePath).catch(() => {})
    }

    const next = {
      ...household.activeHouse,
      name: data.name,
      imagePath: pictureChanged ? nextImagePath : household.activeHouse.imagePath,
      picture: pictureChanged ? uploadedImage?.url || null : household.activeHouse.picture,
      towerHeight: data.tower_height,
      monthlyResetDay: data.monthly_reset_day,
    }

    household.setActiveHouse(next)

    household.setHouses((current) =>
      current.map((house) =>
        house.id === next.id
          ? {
              ...house,
              ...next,
            }
          : house,
      ),
    )

    showToast('Household settings saved.')

    return next
  }

  const setProfile = async (updater) => {
    const signedInUser = requireUser()

    const next =
      typeof updater === 'function'
        ? updater(profile)
        : updater

    const saved = await saveProfileRecord(
      signedInUser.id,
      next,
    )

    setProfileState(saved)
    localStorage.setItem(PROFILE_KEY, JSON.stringify(saved))

    return saved
  }

  const saveProfileSettings = async ({ username, pictureFile, removePicture = false }) => {
    const signedInUser = requireUser()
    const pictureChanged = Boolean(pictureFile) || Boolean(removePicture)
    const previousAvatarPath = profile.avatarPath || null
    let uploadedImage = null
    let nextAvatarPath = previousAvatarPath

    if (pictureFile) {
      uploadedImage = await uploadProfileImage(signedInUser.id, pictureFile)
      nextAvatarPath = uploadedImage.path
    } else if (removePicture) {
      nextAvatarPath = null
    }

    let saved
    try {
      saved = await saveProfileRecord(
        signedInUser.id,
        {
          ...profile,
          username,
          avatarPath: nextAvatarPath,
          picture: pictureChanged ? uploadedImage?.url || null : profile.picture,
        },
        { includeAvatarPath: pictureChanged },
      )
    } catch (error) {
      if (uploadedImage?.path) await deleteMedia(uploadedImage.path).catch(() => {})
      throw error
    }

    if (pictureChanged && previousAvatarPath && previousAvatarPath !== nextAvatarPath) {
      await deleteMedia(previousAvatarPath).catch(() => {})
    }

    setProfileState(saved)
    localStorage.setItem(PROFILE_KEY, JSON.stringify(saved))
    showToast('Profile saved.')
    return saved
  }

  const value = {
    ...household,
    user,
    authReady,
    profile,
    theme,
    loading,
    toast,
    isSupabaseConfigured,
    setTheme,
    setProfile,
    saveProfileSettings,
    login,
    register,
    logout,
    createHouse,
    joinHouse,
    leaveHouse,
    updateHouse,

    saveTask: (task) =>
      saveTask(
        household.activeHouse?.id,
        requireUser().id,
        household.chores,
        task,
      ),

    deleteTask: deleteTaskRecord,

    reorderTask: (id, direction) =>
      reorderTaskRecords(
        household.chores,
        id,
        direction,
      ),

    completeTask: completeTaskRecord,

    addShoppingItem: (item) =>
      addShoppingRecord(
        household.activeHouse?.id,
        requireUser().id,
        item,
      ),

    purchaseShoppingItem: (id) =>
      purchaseShoppingRecord(
        id,
        requireUser().id,
      ),

    deleteShoppingItem: deleteShoppingRecord,

    sendMessage: (body) =>
      sendMessageRecord(
        household.activeHouse?.id,
        requireUser().id,
        body,
      ),

    createNotice: (notice) =>
      createNoticeRecord(
        household.activeHouse?.id,
        requireUser().id,
        notice,
      ),

    deleteNotice: deleteNoticeRecord,

    markNotificationsRead: () =>
      markNotificationsReadRecord(
        requireUser().id,
      ),

    showToast,
    haptic,
  }

  return (
    <TaskTowerContext.Provider value={value}>
      {children}
    </TaskTowerContext.Provider>
  )
}

export const useTaskTower = () => useContext(TaskTowerContext)
