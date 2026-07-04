import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase.js'

const pushNotificationsEnabled =
  import.meta.env.VITE_PUSH_NOTIFICATIONS_ENABLED === 'true'

// Native token registration only. Sending belongs in a Supabase Edge Function
// so Firebase credentials and the Supabase service key stay server-side.
export async function initialisePushNotifications(userId) {
  // Calling Firebase Messaging before google-services.json is installed can
  // terminate the Android activity. Keep this opt-in until FCM is configured.
  if (!pushNotificationsEnabled || !Capacitor.isNativePlatform() || !userId) {
    return () => {}
  }

  try {
    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt') permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') return () => {}

    const listeners = []
    listeners.push(
      await PushNotifications.addListener('registration', async ({ value: token }) => {
        if (!supabase) return
        await supabase.from('push_tokens').upsert(
          {
            user_id: userId,
            token,
            platform: Capacitor.getPlatform(),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'token' },
        )
      }),
    )
    listeners.push(
      await PushNotifications.addListener('registrationError', (error) => {
        console.warn('TaskTower push registration failed', error)
      }),
    )

    await PushNotifications.register()
    return () => listeners.forEach((listener) => listener.remove())
  } catch (error) {
    console.warn('TaskTower push notifications are unavailable', error)
    return () => {}
  }
}
