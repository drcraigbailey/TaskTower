import { requireDatabase } from './liveDataService.js'

const isMissingBroadcastFunction = (error) => (
  error?.code === 'PGRST202'
  || error?.message?.includes('broadcast_household_notification')
  || error?.message?.includes('schema cache')
)

export async function createHouseRecord(name) {
  const db = requireDatabase()
  const trimmedName = name.trim()
  if (trimmedName.length < 2) throw new Error('House name must be at least two characters.')
  const { data, error } = await db.rpc('create_house', { p_name: trimmedName })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.household_id) throw new Error('The household was not created correctly.')
  return { ...result, name: trimmedName }
}

export async function joinHouseRecord(code) {
  const db = requireDatabase()
  const cleanCode = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleanCode.length < 4) throw new Error('Enter the full household invite code.')
  const { data, error } = await db.rpc('join_house', { p_code: cleanCode })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.household_id) throw new Error('The household could not be joined.')
  return result
}

export async function leaveHouseRecord(houseId) {
  const db = requireDatabase()
  const { error } = await db.rpc('leave_house', { p_household_id: houseId })
  if (error) throw error
}

export async function removeHouseholdMemberRecord(houseId, userId) {
  const db = requireDatabase()
  if (!houseId || !userId) throw new Error('Choose a household member to remove.')
  const { error } = await db.rpc('remove_household_member', {
    p_household_id: houseId,
    p_user_id: userId,
  })
  if (error) throw error
}

export async function deleteHouseholdRecord(houseId) {
  const db = requireDatabase()
  if (!houseId) throw new Error('Choose a household to delete.')
  const { error } = await db.rpc('delete_household', { p_household_id: houseId })
  if (error) throw error
}

export async function updateHouseRecord(houseId, changes, { includeImagePath = false } = {}) {
  const db = requireDatabase()
  const payload = {
    name: changes.name.trim(),
  }
  if (includeImagePath) payload.image_path = changes.imagePath || null
  if (payload.name.length < 2) throw new Error('House name must be at least two characters.')
  const { data, error } = await db
    .from('households')
    .update(payload)
    .eq('id', houseId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function resetHouseholdProgressRecord(houseId) {
  const db = requireDatabase()
  const { data, error } = await db.rpc('reset_household_progress', {
    p_household_id: houseId,
  })
  if (error) throw error
  return data
}

export async function deleteTaskRecord(id) {
  const db = requireDatabase()
  const { error } = await db.from('chores').delete().eq('id', id)
  if (error) throw error
}

export async function reorderTaskRecords(chores, id, direction) {
  const db = requireDatabase()
  const index = chores.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= chores.length) return chores
  const next = [...chores]
  ;[next[index], next[target]] = [next[target], next[index]]
  const results = await Promise.all([
    db.from('chores').update({ sort_order: index }).eq('id', next[index].id),
    db.from('chores').update({ sort_order: target }).eq('id', next[target].id),
  ])
  const error = results.find((result) => result.error)?.error
  if (error) throw error
  return next
}

export async function completeTaskRecord(id, type) {
  const db = requireDatabase()
  const { data: chore } = await db
    .from('chores')
    .select('id, household_id, display_name')
    .eq('id', id)
    .maybeSingle()
  const { error } = await db.rpc('complete_chore', { p_chore_id: id, p_completion_type: type })
  if (error) throw error
  if (chore?.household_id) {
    await invokeHouseholdPush(db, {
      householdId: chore.household_id,
      includeSender: false,
      type: 'chore_completed',
      title: 'Task completed',
      body: `${chore.display_name || 'A task'} was marked complete.`,
      data: {
        type: 'chore_completed',
        chore_id: id,
        destination: `/house/${chore.household_id}/chores/${id}`,
      },
    })
  }
}

export async function addShoppingRecord(houseId, userId, item) {
  const db = requireDatabase()
  const { data, error } = await db.from('household_shopping_items').insert({
    household_id: houseId,
    name: item.name.trim(),
    detail: item.detail?.trim() || '',
    category: item.category?.trim() || 'General',
    state: item.state || 'list_low',
    created_by: userId,
  }).select('id, household_id, name, state').single()
  if (error) throw error
  await invokeHouseholdPush(db, {
    householdId: houseId,
    includeSender: false,
    type: 'shopping_added',
    title: 'Shopping list updated',
    body: `${data.name} was added to the shopping list.`,
    data: {
      type: 'shopping_added',
      shopping_item_id: data.id,
      destination: `/house/${houseId}/shopping`,
    },
  })
}

export async function purchaseShoppingRecord(id, userId) {
  const db = requireDatabase()
  const { error } = await db
    .from('household_shopping_items')
    .update({ purchased_at: new Date().toISOString(), purchased_by: userId })
    .eq('id', id)
  if (error) throw error
}

export async function updateShoppingStatusRecord(id, state) {
  const db = requireDatabase()
<<<<<<< HEAD
  if (!['in_stock', 'low', 'out', 'list_low', 'list_out'].includes(state)) throw new Error('Choose a valid shopping status.')
  const { error } = await db
=======
  if (!['in_stock', 'low', 'out'].includes(state)) throw new Error('Choose a valid stock status.')
  const { data, error } = await db
>>>>>>> e0d27b8 (Update TaskTower app)
    .from('household_shopping_items')
    .update({ state, purchased_at: null, purchased_by: null })
    .eq('id', id)
    .select('id, household_id, name, state')
    .single()
  if (error) throw error
  if (state === 'low' || state === 'out') {
    await invokeHouseholdPush(db, {
      householdId: data.household_id,
      includeSender: false,
      type: state === 'out' ? 'shopping_out' : 'shopping_low',
      title: state === 'out' ? 'Out of stock' : 'Running low',
      body: `${data.name} has been marked as ${state === 'out' ? 'out' : 'running low'}.`,
      data: {
        type: state === 'out' ? 'shopping_out' : 'shopping_low',
        shopping_item_id: data.id,
        destination: `/house/${data.household_id}/shopping`,
      },
    })
  }
}

export async function deleteShoppingRecord(id) {
  const db = requireDatabase()
  const { error } = await db.from('household_shopping_items').delete().eq('id', id)
  if (error) throw error
}

const pushErrorText = async (error) => {
  try {
    const context = error?.context
    if (context?.json) {
      const payload = await context.json()
      return payload?.error || payload?.message || error.message
    }
    if (context?.text) return await context.text()
  } catch {
    // Fall back to the Supabase client error below.
  }
  return error?.message || 'Android push could not be sent.'
}

const invokeHouseholdPush = async (db, body) => {
  try {
    const { data, error } = await db.functions.invoke('send-household-push', { body })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return {
      pushDelivered: true,
      pushSent: Number(data?.sent || 0),
      pushFailed: Number(data?.failed || 0),
    }
  } catch (error) {
    const message = await pushErrorText(error)
    console.warn('Dwellio push fan-out is not available yet', error)
    return { pushDelivered: false, pushSent: 0, pushFailed: 0, pushError: message }
  }
}

export async function sendMessageRecord(houseId, userId, body, recipientId = null) {
  const db = requireDatabase()
  const cleanBody = body.trim()
  if (!cleanBody) return
  const payload = {
    household_id: houseId,
    author_id: userId,
    body: cleanBody,
    recipient_id: recipientId || null,
  }
  const { data, error } = await db
    .from('household_messages')
    .insert(payload)
    .select('id, recipient_id')
    .single()
  if (error) throw error

  const { data: senderProfile } = await db
    .from('player_profiles')
    .select('username')
    .eq('user_id', userId)
    .maybeSingle()
  const senderName = senderProfile?.username || 'A housemate'
  const pushType = recipientId ? 'direct_message' : 'household_message'
  await invokeHouseholdPush(db, {
    householdId: houseId,
    recipientIds: recipientId ? [recipientId] : undefined,
    includeSender: false,
    type: pushType,
    title: recipientId ? `New message from ${senderName}` : `${senderName} sent a household message`,
    body: cleanBody.length > 160 ? `${cleanBody.slice(0, 157)}...` : cleanBody,
    data: {
      type: pushType,
      message_id: data.id,
      destination: recipientId
        ? `/house/${houseId}/messages?thread=${userId}`
        : `/house/${houseId}/messages?thread=household`,
    },
  })
}

export async function markMessageThreadReadRecord(houseId, otherUserId) {
  const db = requireDatabase()
  if (!houseId || !otherUserId) throw new Error('Choose a conversation first.')
  const { error } = await db.rpc('mark_household_message_thread_read', {
    p_household_id: houseId,
    p_other_user_id: otherUserId,
  })
  if (error) throw error
}

export async function markHouseholdChatReadRecord(houseId) {
  const db = requireDatabase()
  if (!houseId) throw new Error('Choose a household first.')
  const { error } = await db.rpc('mark_household_chat_read', {
    p_household_id: houseId,
  })
  if (error) throw error
}

export async function hideMessageThreadRecord(houseId, otherUserId) {
  const db = requireDatabase()
  if (!houseId || !otherUserId) throw new Error('Choose a conversation first.')
  const { error } = await db.rpc('hide_household_message_thread', {
    p_household_id: houseId,
    p_other_user_id: otherUserId,
  })
  if (error) throw error
}

export async function hideHouseholdChatThreadRecord(houseId) {
  const db = requireDatabase()
  if (!houseId) throw new Error('Choose a household first.')
  const { error } = await db.rpc('hide_household_chat_thread', {
    p_household_id: houseId,
  })
  if (error) throw error
}

export async function createNoticeRecord(houseId, userId, notice) {
  const db = requireDatabase()
  const expiresAt = notice.expiresInDays
    ? new Date(Date.now() + Number(notice.expiresInDays) * 86400000).toISOString()
    : null
  const { data, error } = await db.from('household_notices').insert({
    household_id: houseId,
    author_id: userId,
    title: notice.title.trim(),
    body: notice.body.trim(),
    priority: notice.priority || 'normal',
    expires_at: expiresAt,
  }).select('id, title, body, priority').single()
  if (error) throw error
  await invokeHouseholdPush(db, {
    householdId: houseId,
    includeSender: false,
    type: data.priority === 'urgent' ? 'urgent_notice' : 'notice',
    title: data.title,
    body: data.body.length > 160 ? `${data.body.slice(0, 157)}...` : data.body,
    data: {
      type: data.priority === 'urgent' ? 'urgent_notice' : 'notice',
      notice_id: data.id,
      destination: `/house/${houseId}/messages?tab=notices`,
    },
  })
}

export async function deleteNoticeRecord(id) {
  const db = requireDatabase()
  const { error } = await db.from('household_notices').delete().eq('id', id)
  if (error) throw error
}

export async function deleteNotificationRecord(id, userId) {
  const db = requireDatabase()
  const { data, error } = await db
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('That notification could not be removed for this account.')
}

export async function deleteAllNotificationRecords(userId, houseId = null) {
  const db = requireDatabase()
  let request = db
    .from('notifications')
    .delete()
    .eq('user_id', userId)

  if (houseId) request = request.eq('household_id', houseId)

  const { error } = await request
  if (error) throw error
}

export async function markNotificationsReadRecord(userId) {
  const db = requireDatabase()
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

export async function sendHouseholdNotificationRecord(houseId, notification) {
  const db = requireDatabase()
  if (!houseId) throw new Error('Choose a household first.')

  const payload = {
    p_household_id: houseId,
    p_type: notification.type || 'system',
    p_title: notification.title?.trim(),
    p_body: notification.body?.trim() || '',
    p_data: notification.data || {},
    p_include_sender: notification.includeSender !== false,
  }

  if (!payload.p_title) throw new Error('Add a notification title.')

  const { data, error } = await db.rpc('broadcast_household_notification', payload)
  if (error) {
    if (isMissingBroadcastFunction(error)) {
      throw new Error('Member broadcasts need the latest Supabase backend update before they can send.')
    }
    throw error
  }

  let pushDelivered = false
  let pushSent = 0
  let pushFailed = 0
  let pushError = ''
  const pushResult = await invokeHouseholdPush(db, {
    householdId: houseId,
    type: payload.p_type,
    title: payload.p_title,
    body: payload.p_body,
    data: payload.p_data,
  })
  pushDelivered = pushResult.pushDelivered
  pushSent = pushResult.pushSent
  pushFailed = pushResult.pushFailed
  pushError = pushResult.pushError || ''

  return { memberCount: data || 0, pushDelivered, pushSent, pushFailed, pushError }
}

export async function sendPushTestNotificationRecord(houseId, userId) {
  const db = requireDatabase()
  if (!houseId || !userId) throw new Error('Choose a household first.')
  return invokeHouseholdPush(db, {
    householdId: houseId,
    recipientIds: [userId],
    includeSender: true,
    type: 'system',
    title: 'Dwellio test notification',
    body: 'Native Android notifications are connected.',
    data: {
      type: 'system',
      destination: '/notifications',
      test: true,
    },
  })
}

export async function sendTaskSavedPushRecord(houseId, task, { isNew = false } = {}) {
  const db = requireDatabase()
  if (!houseId || !task?.id || !isNew) return { pushDelivered: false, pushSent: 0, pushFailed: 0 }
  return invokeHouseholdPush(db, {
    householdId: houseId,
    includeSender: false,
    type: 'task',
    title: 'New household task',
    body: `${task.name || 'A new task'} was added.`,
    data: {
      type: 'task',
      chore_id: task.id,
      destination: `/house/${houseId}/chores/${task.id}`,
    },
  })
}

export async function saveProfileRecord(userId, profile, { includeAvatarPath = false } = {}) {
  const db = requireDatabase()
  const cleanProfile = { ...profile, username: profile.username.trim() }
  const payload = {
    user_id: userId,
    username: cleanProfile.username,
    skin_tone: cleanProfile.avatar.skin,
    hair_style: cleanProfile.avatar.hairStyle,
    hair_color: cleanProfile.avatar.hair,
    outfit_color: cleanProfile.avatar.outfit,
    accessory: cleanProfile.avatar.accessory,
    celebration: cleanProfile.avatar.celebration,
  }
  if (includeAvatarPath) payload.avatar_path = cleanProfile.avatarPath || null
  const { error } = await db.from('player_profiles').upsert(payload)
  if (error) throw error
  return cleanProfile
}
