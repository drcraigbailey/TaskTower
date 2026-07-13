import { Bell, CheckCircle2, Clock3, Home, ShoppingBasket, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

export default function NotificationsPage() {
  const { deleteAllNotifications, deleteNotification, markNotificationsRead, notifications, showToast } = useTaskTower()
  const [deletingId, setDeletingId] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const [error, setError] = useState('')
  const icon = (type) => type === 'success' ? CheckCircle2 : type === 'due' ? Clock3 : type === 'shopping' ? ShoppingBasket : type === 'house' ? Users : Home
  const visibleNotifications = notifications.filter((item) => !hiddenIds.has(item.id))

  const remove = async (id) => {
    if (deletingId || clearing) return
    const nextHiddenIds = new Set(hiddenIds)
    nextHiddenIds.add(id)
    setDeletingId(id)
    setHiddenIds(nextHiddenIds)
    setError('')
    try {
      await deleteNotification(id)
      showToast?.('Notification deleted.', 'neutral')
    } catch (err) {
      setHiddenIds((current) => {
        const restored = new Set(current)
        restored.delete(id)
        return restored
      })
      setError(err.message || 'The notification could not be deleted.')
    } finally {
      setDeletingId(null)
    }
  }

  const removeAll = async () => {
    if (clearing || deletingId || visibleNotifications.length === 0) return
    const previousHiddenIds = hiddenIds
    setClearing(true)
    setHiddenIds(new Set(notifications.map((item) => item.id)))
    setError('')
    try {
      await deleteAllNotifications()
      showToast?.('Notifications deleted.', 'neutral')
    } catch (err) {
      setHiddenIds(previousHiddenIds)
      setError(err.message || 'The notifications could not be deleted.')
    } finally {
      setClearing(false)
    }
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-notifications">
        <ScreenHeader
          title="Notifications"
          back
          actions={(
            <div className="notification-header-actions">
              <button className="adult-text-action" onClick={markNotificationsRead} disabled={clearing || visibleNotifications.length === 0}>Mark all read</button>
              <button className="adult-text-action adult-text-action--danger" onClick={removeAll} disabled={clearing || visibleNotifications.length === 0}>{clearing ? 'Deleting...' : 'Delete all'}</button>
            </div>
          )}
        />
        {error && <div className="inline-message inline-message--error">{error}</div>}
        <div className="adult-notification-list">
          {visibleNotifications.map((item) => {
            const Icon = icon(item.type)
            return (
              <article className={item.unread ? 'unread' : ''} key={item.id}>
                <span><Icon size={19} /></span>
                <div><strong>{item.title}</strong><p>{item.body}</p><small>{item.time} ago</small></div>
                <div className="notification-card-actions">
                  {item.unread && <i aria-label="Unread" />}
                  <button type="button" onClick={() => remove(item.id)} disabled={deletingId === item.id} aria-label={`Delete notification: ${item.title}`}>
                    {deletingId === item.id ? '...' : <Trash2 size={16} />}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        {visibleNotifications.length === 0 && <div className="adult-empty"><span><Bell size={26} /></span><h2>You are all caught up</h2><p>New household updates will appear here.</p></div>}
      </section>
    </AppShell>
  )
}
