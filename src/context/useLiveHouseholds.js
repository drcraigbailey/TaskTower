import { useCallback, useEffect, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import { loadHouses, loadHouseSnapshot, friendlyError } from '../lib/liveDataService.js'
import { supabase } from '../lib/supabase.js'

const ACTIVE_HOUSE_KEY = 'tasktower.activeHouseId'
const LEGACY_ACTIVE_HOUSE_KEY = 'tasktower.activeHouse'

const storedHouseId = () => {
  const current = localStorage.getItem(ACTIVE_HOUSE_KEY)
  if (current) return current
  try {
    return JSON.parse(localStorage.getItem(LEGACY_ACTIVE_HOUSE_KEY) || 'null')?.id || null
  } catch {
    return null
  }
}

const persistHouseId = (houseId) => {
  if (houseId) {
    localStorage.setItem(ACTIVE_HOUSE_KEY, houseId)
    Preferences.set({ key: ACTIVE_HOUSE_KEY, value: houseId })
  } else {
    localStorage.removeItem(ACTIVE_HOUSE_KEY)
    Preferences.remove({ key: ACTIVE_HOUSE_KEY })
  }
  localStorage.removeItem(LEGACY_ACTIVE_HOUSE_KEY)
  Preferences.remove({ key: LEGACY_ACTIVE_HOUSE_KEY })
}

export default function useLiveHouseholds(user, profile, showToast, haptic) {
  const [householdsReady, setHouseholdsReady] = useState(false)
  const [houses, setHouses] = useState([])
  const [activeHouse, setActiveHouse] = useState(null)
  const [chores, setChores] = useState([])
  const [shoppingItems, setShoppingItems] = useState([])
  const [messages, setMessages] = useState([])
  const [notices, setNotices] = useState([])
  const [activity, setActivity] = useState([])
  const [notifications, setNotifications] = useState([])
  const [dataLoading, setDataLoading] = useState(false)

  const clearHouseData = useCallback(() => {
    setHouses([])
    setActiveHouse(null)
    setChores([])
    setShoppingItems([])
    setMessages([])
    setNotices([])
    setActivity([])
    setNotifications([])
    persistHouseId(null)
  }, [])

  const applySnapshot = useCallback((snapshot) => {
    setActiveHouse(snapshot.house)
    setHouses((current) => current.map((house) => house.id === snapshot.house.id ? { ...house, ...snapshot.house } : house))
    setChores(snapshot.chores)
    setShoppingItems(snapshot.shoppingItems)
    setMessages(snapshot.messages)
    setNotices(snapshot.notices)
    setActivity(snapshot.activity)
    setNotifications(snapshot.notifications)
    persistHouseId(snapshot.house.id)
  }, [])

  const refreshHouses = useCallback(async (signedInUser, requestedId = null) => {
    setHouseholdsReady(false)
    const nextHouses = await loadHouses(signedInUser.id)
    setHouses(nextHouses)
    const preferredId = requestedId || storedHouseId()
    const nextId = requestedId
      || (preferredId && nextHouses.some((house) => house.id === preferredId) ? preferredId : null)
      || nextHouses[0]?.id
      || null
    const selected = nextHouses.find((house) => house.id === nextId) || null
    setActiveHouse((current) => selected && current?.id === selected.id
      ? { ...selected, joinCode: current.joinCode, members: current.members }
      : selected)
    persistHouseId(selected?.id || null)
    setHouseholdsReady(true)
    return nextHouses
  }, [])

  const refreshActiveHouse = useCallback(async () => {
    if (!user || !activeHouse?.id) return null
    setDataLoading(true)
    try {
      const snapshot = await loadHouseSnapshot(activeHouse.id, user, profile)
      applySnapshot(snapshot)
      return snapshot
    } finally {
      setDataLoading(false)
    }
  }, [activeHouse?.id, applySnapshot, profile, user])

  const selectHouse = useCallback(async (houseId, options = {}) => {
    const house = houses.find((item) => item.id === houseId)
    if (!house) throw new Error('That household is not available to this account.')
    setActiveHouse(house)
    persistHouseId(houseId)
    if (options.withHaptic !== false) await haptic('success')
    return house
  }, [houses, haptic])

  useEffect(() => {
    if (!user) {
      clearHouseData()
      setHouseholdsReady(true)
      return
    }
    let cancelled = false
    setDataLoading(true)
    refreshHouses(user)
      .catch((error) => !cancelled && showToast(friendlyError(error), 'error'))
      .finally(() => !cancelled && setDataLoading(false))
    return () => { cancelled = true }
  }, [clearHouseData, refreshHouses, showToast, user?.id])

  useEffect(() => {
    if (!user || !activeHouse?.id) return undefined
    let cancelled = false
    const refresh = () => refreshActiveHouse().catch((error) => {
      if (!cancelled) showToast(friendlyError(error), 'error')
    })
    refresh()
    if (!supabase) return undefined
    const houseId = activeHouse.id
    const channel = supabase
      .channel(`live-house-${houseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${houseId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${houseId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `household_id=eq.${houseId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_completions', filter: `household_id=eq.${houseId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_game_state', filter: `household_id=eq.${houseId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_shopping_items', filter: `household_id=eq.${houseId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_messages', filter: `household_id=eq.${houseId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_notices', filter: `household_id=eq.${houseId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `household_id=eq.${houseId}` }, refresh)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [activeHouse?.id, refreshActiveHouse, showToast, user?.id])

  return {
    householdsReady,
    houses,
    activeHouse,
    setActiveHouse,
    setHouses,
    chores,
    setChores,
    shoppingItems,
    messages,
    notices,
    activity,
    notifications,
    setNotifications,
    dataLoading,
    clearHouseData,
    refreshHouses,
    refreshActiveHouse,
    selectHouse,
    persistHouseId,
    storedHouseId,
  }
}
