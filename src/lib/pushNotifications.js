import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Preferences } from '@capacitor/preferences'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase.js'

const PREFERENCES_KEY = 'dwellio.notificationPreferences'
const TOKEN_KEY = 'dwellio.pushToken'
const DEFAULT_CHANNEL_ID = 'dwellio-household'
const NOTIFICATION_GROUP = 'dwellio-household-updates'

const channelDefinitions = [
  {
    id: DEFAULT_CHANNEL_ID,
    name: 'Household updates',
    description: 'General shared household activity',
  },
  {
    id: 'dwellio-messages',
    name: 'Messages',
    description: 'Household and direct messages',
  },
  {
    id: 'dwellio-tasks',
    name: 'Tasks and chores',
    description: 'Task assignments, reminders and completions',
  },
  {
    id: 'dwellio-shopping',
    name: 'Shopping list',
    description: 'Shopping-list additions and stock status changes',
  },
  {
    id: 'dwellio-notices',
    name: 'Household notices',
    description: 'Important notices and invitations',
  },
]

const channelByType = {
  direct_message: 'dwellio-messages',
  household_message: 'dwellio-messages',
  task: 'dwellio-tasks',
  task_reminder: 'dwellio-tasks',
  chore_completed: 'dwellio-tasks',
  due_soon: 'dwellio-tasks',
  overdue: 'dwellio-tasks',
  shopping: 'dwellio-shopping',
  shopping_added: 'dwellio-shopping',
  shopping_low: 'dwellio-shopping',
  shopping_out: 'dwellio-shopping',
  shopping_broadcast: 'dwellio-shopping',
  notice: 'dwellio-notices',
  urgent_notice: 'dwellio-notices',
  household_notice: 'dwellio-notices',
  invitation: 'dwellio-notices',
  member_joined: 'dwellio-notices',
}

export const defaultNotificationPreferences = {
  enabled: true,
  messages: true,
  notices: true,
  shopping: false,
  taskReminders: true,
  taskCompletions: false,
  monthlyResults: true,
}

const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const notificationData = (notification = {}) => notification.data || notification.extra || {}

const channelForType = (type) => channelByType[type] || DEFAULT_CHANNEL_ID

const notificationId = (notification = {}) => {
  const data = notificationData(notification)
  const basis = data.notification_id || data.message_id || data.chore_id || data.task_id || data.shopping_item_id || data.notice_id || `${Date.now()}`
  return String(basis).split('').reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 17) & 0x7fffffff
}

const createAndroidChannels = async () => {
  if (!isAndroid()) return
  await Promise.all(channelDefinitions.map((channel) => PushNotifications.createChannel({
    ...channel,
    importance: 5,
    visibility: 1,
    vibration: true,
  })))
  await Promise.all(channelDefinitions.map((channel) => LocalNotifications.createChannel({
    ...channel,
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#3C8D83',
  })))
}

const localDisplayPermission = async ({ request = false } = {}) => {
  if (!Capacitor.isNativePlatform()) return 'web'
  try {
    let permission = await LocalNotifications.checkPermissions()
    if (request && (permission.display === 'prompt' || permission.display === 'prompt-with-rationale')) {
      permission = await LocalNotifications.requestPermissions()
    }
    return permission.display
  } catch {
    return 'unavailable'
  }
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
    const [pushPermission, displayPermission] = await Promise.all([
      PushNotifications.checkPermissions(),
      localDisplayPermission(),
    ])
    if (pushPermission.receive === 'denied' || displayPermission === 'denied') return 'denied'
    if (pushPermission.receive === 'granted' && (displayPermission === 'granted' || displayPermission === 'web')) return 'granted'
    if (pushPermission.receive === 'prompt-with-rationale' || displayPermission === 'prompt-with-rationale') return 'prompt-with-rationale'
    if (displayPermission === 'prompt') return 'prompt'
    return pushPermission.receive
  } catch {
    return 'unavailable'
  }
}

export async function openAndroidNotificationSettings() {
  if (!isAndroid()) return false
  try {
    const plugin = window.Capacitor?.Plugins?.DwellioNotificationSettings
    if (!plugin?.open) return false
    await plugin.open()
    return true
  } catch {
    return false
  }
}

export async function setNativeNotificationsEnabled(enabled) {
  const current = await loadNotificationPreferences()

  if (!Capacitor.isNativePlatform()) {
    return saveNotificationPreferences({ ...current, enabled })
  }

  if (enabled) {
    await createAndroidChannels()
    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions()
    }
    const displayPermission = await localDisplayPermission({ request: true })
    if (permission.receive !== 'granted' || displayPermission === 'denied') {
      await saveNotificationPreferences({ ...current, enabled: false })
      return { ...current, enabled: false, permission: permission.receive === 'denied' ? 'denied' : displayPermission }
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
    if (token && supabase) {
      await supabase.from('push_tokens').update({ enabled: false, last_seen_at: new Date().toISOString() }).eq('token', token)
    }
    await Preferences.remove({ key: TOKEN_KEY })
  } catch {
    // Local preference still disables notification registration.
  }

  const saved = await saveNotificationPreferences({ ...current, enabled: false })
  return { ...saved, permission: await getNotificationPermissionStatus() }
}

const openNotificationDestination = (notification = {}) => {
  const data = notificationData(notification)
  const householdId = data.household_id || data.householdId
  const destination = data.destination || data.route

  if (destination) {
    window.location.hash = destination.startsWith('#') ? destination.slice(1) : destination
    return
  }

  if (householdId) {
    const type = data.type || data.notification_type
    if (type?.startsWith('shopping')) {
      window.location.hash = `/house/${householdId}/shopping`
      return
    }
    if (type === 'task' || type === 'task_reminder' || type === 'chore_completed' || type === 'due_soon' || type === 'overdue') {
      window.location.hash = data.chore_id || data.task_id
        ? `/house/${householdId}/chores/${data.chore_id || data.task_id}`
        : `/house/${householdId}/chores`
      return
    }
    const tab = type === 'notice' || type === 'urgent_notice' || type === 'household_notice' ? '?tab=notices' : ''
    window.location.hash = `/house/${householdId}/messages${tab}`
    return
  }

  window.location.hash = '/notifications'
}

const showForegroundNativeNotification = async (notification = {}) => {
  if (!Capacitor.isNativePlatform()) return
  const data = notificationData(notification)
  const title = notification.title || data.title || 'Dwellio'
  const body = notification.body || data.body || 'New household update'
  if (!title && !body) return

  try {
    await createAndroidChannels()
    const displayPermission = await localDisplayPermission()
    if (displayPermission !== 'granted') return
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(notification),
        title,
        body,
        largeBody: body,
        channelId: channelForType(data.type || data.notification_type),
        smallIcon: 'ic_stat_dwellio',
        iconColor: '#3C8D83',
        group: NOTIFICATION_GROUP,
        autoCancel: true,
        extra: data,
      }],
    })
  } catch (error) {
    console.warn('Dwellio could not display the foreground notification', error)
  }
}

export async function initialisePushNotifications(userId) {
  if (!Capacitor.isNativePlatform() || !userId) return () => {}

  const preferences = await loadNotificationPreferences()
  if (!preferences.enabled) return () => {}

  try {
    await createAndroidChannels()

    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions()
    }
    const displayPermission = await localDisplayPermission({ request: true })
    if (permission.receive !== 'granted' || displayPermission === 'denied') return () => {}

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
            enabled: true,
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
      await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        window.dispatchEvent(new CustomEvent('dwellio:push-received', { detail: notification }))
        await showForegroundNativeNotification(notification)
      }),
    )

    listeners.push(
      await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        openNotificationDestination(notification)
      }),
    )

    listeners.push(
      await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
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
