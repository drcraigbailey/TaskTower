import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase.js'

const PREFERENCES_KEY = 'dwellio.notificationPreferences'
const TOKEN_KEY = 'dwellio.pushToken'

export const defaultNotificationPreferences = {
  enabled: true,
  messages: true,
  notices: true,
  shopping: false,
  taskReminders: true,
  taskCompletions: false,
  monthlyResults: true,
}

export async function loadNotificationPreferences() {
  try {
    const { value } = await Preferences.get({ key: PREFERENCES_KEY })
    return value
      ? { ...defaultNotificationPreferences, ...JSON.parse(value) }
      : defaultNotificationPreferences
  } catch {
    return defaultNotificationPreferences
  }
}

export async function saveNotificationPreferences(preferences) {
  const next = { ...defaultNotificationPreferences, ...preferences }
  await Preferences.set({ key: PREFERENCES_KEY, value: JSON.stringify(next) })
  return next
}

export async function getNotificationPermissionStatus() {
  if (!Capacitor.isNativePlatform()) return 'web'
  try {
    const permission = await PushNotifications.checkPermissions()
    return permission.receive
  } catch {
    return 'unavailable'
  }
}

export async function setNativeNotificationsEnabled(enabled) {
  const current = await loadNotificationPreferences()

  if (!Capacitor.isNativePlatform()) {
    return saveNotificationPreferences({ ...current, enabled })
  }

  if (enabled) {
    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions()
    }
    if (permission.receive !== 'granted') {
      await saveNotificationPreferences({ ...current, enabled: false })
      return { ...current, enabled: false, permission: permission.receive }
    }
    await PushNotifications.register()
    const saved = await saveNotificationPreferences({ ...current, enabled: true })
    return { ...saved, permission: 'granted' }
  }

  try {
    await PushNotifications.unregister()
  } catch {
    // Some Android builds may already be unregistered.
  }

  try {
    const { value: token } = await Preferences.get({ key: TOKEN_KEY })
    if (token && supabase) await supabase.from('push_tokens').delete().eq('token', token)
    await Preferences.remove({ key: TOKEN_KEY })
  } catch {
    // Local preference still disables notification registration.
  }

  const saved = await saveNotificationPreferences({ ...current, enabled: false })
  return { ...saved, permission: await getNotificationPermissionStatus() }
}

const openNotificationDestination = (notification = {}) => {
  const data = notification.data || {}
  const householdId = data.household_id || data.householdId
  const destination = data.destination || data.route

  if (destination) {
    window.location.hash = destination.startsWith('#') ? destination.slice(1) : destination
    return
  }

  if (householdId) {
    const type = data.type || data.notification_type
    if (type === 'shopping' || type === 'shopping_broadcast') {
      window.location.hash = `/house/${householdId}/shopping`
      return
    }
    if (type === 'task' || type === 'task_reminder') {
      window.location.hash = data.chore_id
        ? `/house/${householdId}/chores/${data.chore_id}`
        : `/house/${householdId}/chores`
      return
    }
    const tab = type === 'notice' || type === 'household_notice' ? '?tab=notices' : ''
    window.location.hash = `/house/${householdId}/messages${tab}`
    return
  }

  window.location.hash = '/notifications'
}

export async function initialisePushNotifications(userId) {
  if (!Capacitor.isNativePlatform() || !userId) return () => {}

  const preferences = await loadNotificationPreferences()
  if (!preferences.enabled) return () => {}

  try {
    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({
        id: 'dwellio-household',
        name: 'Household updates',
        description: 'Messages, notices and shared household updates',
        importance: 5,
        visibility: 1,
        vibration: true,
      })
    }

    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions()
    }
    if (permission.receive !== 'granted') return () => {}

    const listeners = []

    listeners.push(
      await PushNotifications.addListener('registration', async ({ value: token }) => {
        if (!supabase || !token) return
        await Preferences.set({ key: TOKEN_KEY, value: token })
        const { error } = await supabase.from('push_tokens').upsert(
          {
            user_id: userId,
            token,
            platform: Capacitor.getPlatform(),
            device_name: navigator.userAgent.slice(0, 180),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'token' },
        )
        if (error) console.warn('Dwellio could not save the push token', error)
      }),
    )

    listeners.push(
      await PushNotifications.addListener('registrationError', (error) => {
        console.warn('Dwellio push registration failed. Check google-services.json and Firebase package name.', error)
      }),
    )

    listeners.push(
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        window.dispatchEvent(new CustomEvent('dwellio:push-received', { detail: notification }))
      }),
    )

    listeners.push(
      await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        openNotificationDestination(notification)
      }),
    )

    await PushNotifications.register()
    return () => listeners.forEach((listener) => listener.remove())
  } catch (error) {
    console.warn('Dwellio push notifications are unavailable', error)
    return () => {}
  }
}
