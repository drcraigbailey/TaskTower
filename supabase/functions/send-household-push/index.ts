import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const base64Url = (value: string | Uint8Array) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

const privateKeyBytes = (pem: string) => {
  const clean = pem
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const firebaseAccessToken = async () => {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')
  if (!clientEmail || !privateKey) throw new Error('Firebase service account env vars are missing.')

  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const unsignedToken = `${header}.${claim}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken)))
  const assertion = `${unsignedToken}.${base64Url(signature)}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error_description || result.error || 'Firebase auth failed.')
  return result.access_token as string
}

const fcmData = (data: Record<string, unknown>, householdId: string, type: string) => {
  const next = { ...data, household_id: householdId, type }
  return Object.fromEntries(Object.entries(next).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : JSON.stringify(value),
  ]))
}

const channelByType: Record<string, string> = {
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

const channelForType = (type: string) => channelByType[type] || 'dwellio-household'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID')
    const firebaseAndroidPackage = Deno.env.get('FIREBASE_ANDROID_PACKAGE') || undefined
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !firebaseProjectId) {
      throw new Error('Supabase or Firebase env vars are missing.')
    }

    const authorization = request.headers.get('Authorization') || ''
    const body = await request.json()
    const householdId = body.householdId || body.household_id
    const type = body.type || 'system'
    const title = String(body.title || '').trim()
    const messageBody = String(body.body || '').trim()
    const data = body.data || {}
    const recipientIds = Array.isArray(body.recipientIds || body.recipient_ids)
      ? (body.recipientIds || body.recipient_ids).filter(Boolean)
      : []
    const includeSender = body.includeSender ?? body.include_sender ?? true

    if (!householdId || !title) return jsonResponse({ error: 'Missing householdId or title.' }, 400)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userResult, error: userError } = await userClient.auth.getUser()
    if (userError || !userResult.user) return jsonResponse({ error: 'Authentication required.' }, 401)

    const { data: membership } = await userClient
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)
      .eq('user_id', userResult.user.id)
      .maybeSingle()
    if (!membership) return jsonResponse({ error: 'Not a household member.' }, 403)

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: members, error: memberError } = await adminClient
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)
    if (memberError) throw memberError

    const householdMemberIds = (members || []).map((member) => member.user_id)
    const allowedRecipients = recipientIds.length
      ? recipientIds.filter((id: string) => householdMemberIds.includes(id))
      : householdMemberIds
    const memberIds = allowedRecipients.filter((id: string) => includeSender || id !== userResult.user.id)
    if (!memberIds.length) return jsonResponse({ sent: 0, failed: 0 })

    const { data: tokens, error: tokenError } = await adminClient
      .from('push_tokens')
      .select('id, token')
      .in('user_id', memberIds)
      .eq('platform', 'android')
      .eq('enabled', true)
    if (tokenError) throw tokenError
    if (!tokens?.length) return jsonResponse({ sent: 0, failed: 0 })

    const accessToken = await firebaseAccessToken()
    const endpoint = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`
    const payloadData = fcmData({ ...data, title, body: messageBody }, householdId, type)
    let sent = 0
    let failed = 0
    const invalidTokenIds: string[] = []

    await Promise.all(tokens.map(async ({ id, token }) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body: messageBody },
            data: payloadData,
            android: {
              priority: 'HIGH',
              restricted_package_name: firebaseAndroidPackage,
              ttl: '3600s',
              notification: {
                channel_id: channelForType(type),
                sound: 'default',
                default_sound: true,
                default_vibrate_timings: true,
                notification_priority: 'PRIORITY_HIGH',
                visibility: 'PUBLIC',
              },
            },
          },
        }),
      })

      if (response.ok) {
        sent += 1
        return
      }

      failed += 1
      if ([400, 404].includes(response.status)) invalidTokenIds.push(id)
    }))

    if (invalidTokenIds.length) {
      await adminClient
        .from('push_tokens')
        .update({ enabled: false, updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
        .in('id', invalidTokenIds)
    }

    return jsonResponse({ sent, failed })
  } catch (error) {
    return jsonResponse({ error: error.message || 'Push delivery failed.' }, 500)
  }
})
