// oxlint-disable react/only-export-components
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { activitySeed, messageSeed, noticeSeed, shoppingSeed } from '../data/adultDemoData.js'
import { supabase } from '../lib/supabase.js'
import { createSignedMediaMap, readImageAsDataUrl, removeMediaPath, uploadHouseholdImage } from '../lib/media.js'
import { useTaskTower } from './TaskTowerContext.jsx'

const AdultHouseholdContext = createContext(null)

const DEFAULT_SETTINGS = {
  permissions: {
    members_add_tasks: true,
    members_complete_tasks: true,
    members_add_shopping: true,
    members_post_notices: true,
    members_message: true,
  },
  notification_defaults: {},
  contribution_mode: 'neutral',
  messaging_enabled: true,
  direct_messages_enabled: true,
  notices_enabled: true,
}

const stateMap = {
  low: 'running_low',
  out: 'out',
  list: 'shopping_list',
  stocked: 'stocked',
  running_low: 'running_low',
  shopping_list: 'shopping_list',
  purchased: 'purchased',
}

const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
const formatWhen = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}
const formatExpiry = (value) => {
  if (!value) return 'No expiry'
  const milliseconds = new Date(value).getTime() - Date.now()
  if (milliseconds <= 0) return 'Expired'
  const days = Math.ceil(milliseconds / 86400000)
  return days === 1 ? '1 day' : `${days} days`
}
const shoppingDetail = (item) => [item.quantity, item.unit].filter((value) => value !== null && value !== undefined && value !== '').join(' ') || item.note || item.preferred_brand || ''
const localSeed = () => ({
  shoppingItems: shoppingSeed.map((item) => ({ ...item, state: stateMap[item.state] || item.state, quantity: null, unit: '', note: item.detail || '' })),
  notices: noticeSeed.map((notice) => ({ ...notice, id: String(notice.id), pinned: notice.priority === 'urgent', acknowledged: false, createdLabel: 'Recently' })),
  messages: messageSeed.map((message) => ({ ...message, id: String(message.id), createdLabel: message.time })),
  activity: activitySeed.map((item) => ({ ...item, id: String(item.id) })),
  settings: DEFAULT_SETTINGS,
  rooms: [],
  categories: [],
  membershipRole: 'owner',
})

export function AdultHouseholdProvider({ children }) {
  const { activeHouse, user, showToast, haptic } = useTaskTower()
  const [shoppingItems, setShoppingItems] = useState([])
  const [notices, setNotices] = useState([])
  const [messages, setMessages] = useState([])
  const [activity, setActivity] = useState([])
  const [householdSettings, setHouseholdSettings] = useState(DEFAULT_SETTINGS)
  const [rooms, setRooms] = useState([])
  const [categories, setCategories] = useState([])
  const [membershipRole, setMembershipRole] = useState('member')
  const [dataLoading, setDataLoading] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [dataError, setDataError] = useState('')
  const live = Boolean(supabase && user && activeHouse?.id && activeHouse.id !== 'demo-house')
  const storageKey = activeHouse?.id ? `dwellio.householdData.${activeHouse.id}` : null

  const applyLocalState = useCallback((next) => {
    setShoppingItems(next.shoppingItems || [])
    setNotices(next.notices || [])
    setMessages(next.messages || [])
    setActivity(next.activity || [])
    setHouseholdSettings({ ...DEFAULT_SETTINGS, ...(next.settings || {}), permissions: { ...DEFAULT_SETTINGS.permissions, ...(next.settings?.permissions || {}) } })
    setRooms(next.rooms || [])
    setCategories(next.categories || [])
    setMembershipRole(next.membershipRole || 'owner')
  }, [])

  const loadLiveData = useCallback(async () => {
    if (!live || !activeHouse?.id || !user?.id) return
    setDataLoading(true)
    setDataError('')
    try {
      const houseId = activeHouse.id
      const [shoppingResult, noticeResult, messageResult, activityResult, settingsResult, roomsResult, categoriesResult, membershipResult] = await Promise.all([
        supabase.from('shopping_items').select('*').eq('household_id', houseId).neq('state', 'purchased').order('created_at', { ascending: false }),
        supabase.from('household_notices').select('*').eq('household_id', houseId).order('pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('household_messages').select('*').eq('household_id', houseId).is('deleted_at', null).order('created_at', { ascending: true }).limit(200),
        supabase.from('household_activity').select('*').eq('household_id', houseId).order('created_at', { ascending: false }).limit(100),
        supabase.from('household_settings').select('*').eq('household_id', houseId).maybeSingle(),
        supabase.from('household_rooms').select('*').eq('household_id', houseId).order('sort_order'),
        supabase.from('task_categories').select('*').eq('household_id', houseId).order('sort_order'),
        supabase.from('household_members').select('role').eq('household_id', houseId).eq('user_id', user.id).maybeSingle(),
      ])
      const firstError = [shoppingResult, noticeResult, messageResult, activityResult, settingsResult, roomsResult, categoriesResult, membershipResult].find((result) => result.error)?.error
      if (firstError) throw firstError

      const actorIds = new Set([user.id])
      for (const item of noticeResult.data || []) actorIds.add(item.author_id)
      for (const item of messageResult.data || []) actorIds.add(item.sender_id)
      for (const item of activityResult.data || []) if (item.actor_id) actorIds.add(item.actor_id)
      const profileResult = actorIds.size
        ? await supabase.from('player_profiles').select('user_id, username, avatar_path').in('user_id', [...actorIds])
        : { data: [], error: null }
      if (profileResult.error) throw profileResult.error
      const mediaMap = await createSignedMediaMap([
        ...(profileResult.data || []).map((row) => row.avatar_path),
        ...(noticeResult.data || []).map((row) => row.image_path),
        ...(messageResult.data || []).map((row) => row.image_path),
      ])
      const profiles = Object.fromEntries((profileResult.data || []).map((row) => [row.user_id, row]))
      const noticeIds = (noticeResult.data || []).map((notice) => notice.id)
      const acknowledgementResult = noticeIds.length
        ? await supabase.from('notice_acknowledgements').select('notice_id, user_id').in('notice_id', noticeIds)
        : { data: [], error: null }
      if (acknowledgementResult.error) throw acknowledgementResult.error
      const acknowledgedByMe = new Set((acknowledgementResult.data || []).filter((row) => row.user_id === user.id).map((row) => row.notice_id))

      setShoppingItems((shoppingResult.data || []).map((item) => ({ ...item, detail: shoppingDetail(item) })))
      setNotices((noticeResult.data || []).map((notice) => ({
        ...notice,
        author: notice.author_id === user.id ? 'You' : profiles[notice.author_id]?.username || 'Housemate',
        authorImage: mediaMap[profiles[notice.author_id]?.avatar_path] || '',
        imageUrl: mediaMap[notice.image_path] || '',
        expires: formatExpiry(notice.expires_at),
        acknowledged: acknowledgedByMe.has(notice.id),
        createdLabel: formatWhen(notice.created_at),
      })))
      setMessages((messageResult.data || []).map((message) => ({
        ...message,
        author: message.sender_id === user.id ? 'You' : profiles[message.sender_id]?.username || 'Housemate',
        authorImage: mediaMap[profiles[message.sender_id]?.avatar_path] || '',
        imageUrl: mediaMap[message.image_path] || '',
        mine: message.sender_id === user.id,
        time: formatWhen(message.created_at),
        createdLabel: formatWhen(message.created_at),
      })))
      setActivity((activityResult.data || []).map((item) => ({
        ...item,
        member: item.actor_id === user.id ? 'You' : profiles[item.actor_id]?.username || 'Household',
        action: item.summary,
        subject: item.metadata?.subject_name || '',
        time: formatWhen(item.created_at),
        tone: item.metadata?.tone || (item.event_type?.includes('shopping') ? 'amber' : item.event_type?.includes('notice') ? 'blue' : 'green'),
      })))
      setHouseholdSettings({ ...DEFAULT_SETTINGS, ...(settingsResult.data || {}), permissions: { ...DEFAULT_SETTINGS.permissions, ...(settingsResult.data?.permissions || {}) } })
      setRooms(roomsResult.data || [])
      setCategories(categoriesResult.data || [])
      setMembershipRole(membershipResult.data?.role || 'member')
      setDataReady(true)
    } catch (error) {
      console.error('Could not load household data', error)
      setDataError(error?.message || 'Could not load household data.')
    } finally {
      setDataLoading(false)
    }
  }, [activeHouse?.id, live, user?.id])

  useEffect(() => {
    if (!activeHouse?.id) {
      applyLocalState({ ...localSeed(), shoppingItems: [], notices: [], messages: [], activity: [] })
      setDataReady(false)
      return undefined
    }
    if (live) {
      loadLiveData()
      let timer
      const refreshSoon = () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(loadLiveData, 120)
      }
      const houseId = activeHouse.id
      const channel = supabase.channel(`adult-household-${houseId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${houseId}` }, refreshSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'household_notices', filter: `household_id=eq.${houseId}` }, refreshSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notice_acknowledgements' }, refreshSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'household_messages', filter: `household_id=eq.${houseId}` }, refreshSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'household_activity', filter: `household_id=eq.${houseId}` }, refreshSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'household_settings', filter: `household_id=eq.${houseId}` }, refreshSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'player_profiles' }, refreshSoon)
        .subscribe()
      return () => {
        window.clearTimeout(timer)
        supabase.removeChannel(channel)
      }
    }
    let next = localSeed()
    try {
      const stored = storageKey ? localStorage.getItem(storageKey) : null
      if (stored) next = { ...next, ...JSON.parse(stored) }
    } catch {}
    applyLocalState(next)
    setDataReady(true)
    setDataLoading(false)
    return undefined
  }, [activeHouse?.id, applyLocalState, live, loadLiveData, storageKey])

  useEffect(() => {
    if (live || !storageKey || !dataReady) return
    localStorage.setItem(storageKey, JSON.stringify({ shoppingItems, notices, messages, activity, settings: householdSettings, rooms, categories, membershipRole }))
  }, [activity, categories, dataReady, householdSettings, live, membershipRole, messages, notices, rooms, shoppingItems, storageKey])

  const fail = useCallback((error) => {
    showToast(error?.message || 'That change could not be saved.', 'error')
    return false
  }, [showToast])

  const addShoppingItem = async (input) => {
    const item = { name: input.name.trim(), category: input.category?.trim() || 'Other', state: stateMap[input.state] || 'shopping_list', quantity: input.quantity === '' || input.quantity === null ? null : Number(input.quantity), unit: input.unit?.trim() || null, note: input.note?.trim() || '' }
    if (!item.name) return false
    try {
      if (live) {
        const { error } = await supabase.from('shopping_items').insert({ ...item, household_id: activeHouse.id, created_by: user.id })
        if (error) throw error
        await loadLiveData()
      } else setShoppingItems((current) => [{ ...item, id: makeId(), detail: shoppingDetail(item), created_at: new Date().toISOString() }, ...current])
      showToast('Shopping item added.')
      haptic('success')
      return true
    } catch (error) { return fail(error) }
  }

  const updateShoppingItem = async (id, patch) => {
    const databasePatch = { ...patch, ...(patch.state ? { state: stateMap[patch.state] || patch.state } : {}) }
    try {
      if (live) {
        const { error } = await supabase.from('shopping_items').update(databasePatch).eq('id', id).eq('household_id', activeHouse.id)
        if (error) throw error
        await loadLiveData()
      } else setShoppingItems((current) => current.map((item) => item.id === id ? { ...item, ...databasePatch, detail: shoppingDetail({ ...item, ...databasePatch }) } : item))
      showToast(databasePatch.state === 'shopping_list' ? 'Added to the shopping list.' : 'Shopping item updated.')
      return true
    } catch (error) { return fail(error) }
  }

  const markShoppingPurchased = async (id) => {
    try {
      if (live) {
        const { error } = await supabase.from('shopping_items').update({ state: 'purchased', purchased_at: new Date().toISOString(), purchased_by: user.id }).eq('id', id).eq('household_id', activeHouse.id)
        if (error) throw error
        await loadLiveData()
      } else setShoppingItems((current) => current.filter((item) => item.id !== id))
      showToast('Marked as purchased.')
      return true
    } catch (error) { return fail(error) }
  }

  const deleteShoppingItem = async (id) => {
    try {
      if (live) {
        const { error } = await supabase.from('shopping_items').delete().eq('id', id).eq('household_id', activeHouse.id)
        if (error) throw error
        await loadLiveData()
      } else setShoppingItems((current) => current.filter((item) => item.id !== id))
      showToast('Shopping item removed.', 'neutral')
      return true
    } catch (error) { return fail(error) }
  }

  const addNotice = async (input) => {
    let uploadedPath = ''
    const notice = { title: input.title.trim(), body: input.body?.trim() || '', priority: input.priority || 'normal', pinned: Boolean(input.pinned), expires_at: input.expiresAt ? new Date(`${input.expiresAt}T23:59:59`).toISOString() : null }
    if (!notice.title) return false
    try {
      if (live) {
        if (input.imageFile) uploadedPath = await uploadHouseholdImage({ file: input.imageFile, householdId: activeHouse.id, userId: user.id, kind: 'notices' })
        const { error } = await supabase.from('household_notices').insert({ ...notice, image_path: uploadedPath || null, household_id: activeHouse.id, author_id: user.id })
        if (error) throw error
        await loadLiveData()
      } else {
        const imageUrl = input.imageFile ? await readImageAsDataUrl(input.imageFile) : ''
        setNotices((current) => [{ ...notice, imageUrl, id: makeId(), author: 'You', expires: formatExpiry(notice.expires_at), acknowledged: false, createdLabel: 'Now' }, ...current])
      }
      showToast('Notice posted.')
      return true
    } catch (error) {
      if (uploadedPath) removeMediaPath(uploadedPath)
      return fail(error)
    }
  }

  const acknowledgeNotice = async (id) => {
    try {
      if (live) {
        const { error } = await supabase.from('notice_acknowledgements').upsert({ notice_id: id, user_id: user.id })
        if (error) throw error
        await loadLiveData()
      } else setNotices((current) => current.map((notice) => notice.id === id ? { ...notice, acknowledged: true } : notice))
      showToast('Notice acknowledged.')
      return true
    } catch (error) { return fail(error) }
  }

  const deleteNotice = async (id) => {
    try {
      const existing = notices.find((notice) => notice.id === id)
      if (live) {
        const { error } = await supabase.from('household_notices').delete().eq('id', id).eq('household_id', activeHouse.id)
        if (error) throw error
        if (existing?.image_path) removeMediaPath(existing.image_path)
        await loadLiveData()
      } else setNotices((current) => current.filter((notice) => notice.id !== id))
      showToast('Notice removed.', 'neutral')
      return true
    } catch (error) { return fail(error) }
  }

  const sendMessage = async (body, recipientId = null, imageFile = null) => {
    let uploadedPath = ''
    const cleanBody = body.trim()
    if ((!cleanBody && !imageFile) || !householdSettings.messaging_enabled) return false
    try {
      if (live) {
        if (imageFile) uploadedPath = await uploadHouseholdImage({ file: imageFile, householdId: activeHouse.id, userId: user.id, kind: 'messages' })
        const { error } = await supabase.from('household_messages').insert({ household_id: activeHouse.id, sender_id: user.id, recipient_id: recipientId, body: cleanBody, image_path: uploadedPath || null })
        if (error) throw error
        await loadLiveData()
      } else {
        const imageUrl = imageFile ? await readImageAsDataUrl(imageFile) : ''
        setMessages((current) => [...current, { id: makeId(), author: 'You', body: cleanBody, imageUrl, time: 'Now', createdLabel: 'Now', mine: true, sender_id: user?.id || 'demo-user', recipient_id: recipientId }])
      }
      return true
    } catch (error) {
      if (uploadedPath) removeMediaPath(uploadedPath)
      return fail(error)
    }
  }

  const deleteMessage = async (id) => {
    try {
      const existing = messages.find((message) => message.id === id)
      if (live) {
        const { error } = await supabase.from('household_messages').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('sender_id', user.id)
        if (error) throw error
        if (existing?.image_path) removeMediaPath(existing.image_path)
        await loadLiveData()
      } else setMessages((current) => current.filter((message) => message.id !== id))
      showToast('Message removed.', 'neutral')
      return true
    } catch (error) { return fail(error) }
  }

  const saveHouseholdSettings = async (patch) => {
    const next = { ...householdSettings, ...patch, permissions: { ...householdSettings.permissions, ...(patch.permissions || {}) } }
    try {
      if (live) {
        const { error } = await supabase.from('household_settings').upsert({ household_id: activeHouse.id, permissions: next.permissions, notification_defaults: next.notification_defaults || {}, contribution_mode: next.contribution_mode, messaging_enabled: next.messaging_enabled, direct_messages_enabled: next.direct_messages_enabled, notices_enabled: next.notices_enabled }, { onConflict: 'household_id' })
        if (error) throw error
        await loadLiveData()
      } else setHouseholdSettings(next)
      showToast('Household settings saved.')
      return true
    } catch (error) { return fail(error) }
  }

  const value = {
    shoppingItems, notices, messages, activity, householdSettings, rooms, categories,
    membershipRole, canManageHousehold: membershipRole === 'owner' || membershipRole === 'admin',
    dataLoading, dataReady, dataError, refreshHouseholdData: loadLiveData,
    addShoppingItem, updateShoppingItem, markShoppingPurchased, deleteShoppingItem,
    addNotice, acknowledgeNotice, deleteNotice, sendMessage, deleteMessage, saveHouseholdSettings,
  }

  return <AdultHouseholdContext.Provider value={value}>{children}</AdultHouseholdContext.Provider>
}

export const useAdultHousehold = () => {
  const context = useContext(AdultHouseholdContext)
  if (!context) throw new Error('useAdultHousehold must be used inside AdultHouseholdProvider')
  return context
}
