import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase.js'

const pushNotificationsDisabled =
  import.meta.env.VITE_PUSH_NOTIFICATIONS_ENABLED === 'false'

const openNotificationDestination = (notification = {}) => {
  const data = notification.data || {}
  const householdId = data.household_id || data.householdId
  const destination = data.destination || data.route

  if (destination) {
    window.location.hash = destination.startsWith('#') ? destination.slice(1) : destination
    return
  }

  if (householdId) {
    const tab = data.type === 'notice' || data.type === 'household_notice' ? '?tab=notices' : ''
    window.location.hash = `/house/${householdId}/messages${tab}`
    return
  }

  window.location.hash = '/notifications'
}

// Registers the device with Firebase Cloud Messaging and stores its token in
// Supabase. Sending remains server-side so Firebase credentials never ship in
// the Android bundle.
export async function initialisePushNotifications(userId) {
  if (pushNotificationsDisabled || !Capacitor.isNativePlatform() || !userId) {
    return () => {}
  }

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
    if (permission.receive !== 'granted') {
      console.warn('Dwellio notification permission was not granted')
      return () => {}
    }

    const listeners = []

    listeners.push(
      await PushNotifications.addListener('registration', async ({ value: token }) => {
        if (!supabase || !token) return

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

    return () => {
      listeners.forEach((listener) => listener.remove())
    }
  } catch (error) {
    console.warn('Dwellio push notifications are unavailable', error)
    return () => {}
  }
}
