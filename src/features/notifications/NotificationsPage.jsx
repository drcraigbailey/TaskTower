import { Bell, CheckCircle2, Clock3, Home, Users } from 'lucide-react'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

export default function NotificationsPage() {
  const { notifications, markNotificationsRead } = useTaskTower()
  const icon = (type) => type === 'success' ? CheckCircle2 : type === 'due' ? Clock3 : type === 'house' ? Users : Home
  return <AppShell><section className="mobile-screen adult-notifications"><ScreenHeader title="Notifications" back actions={<button className="adult-text-action" onClick={markNotificationsRead}>Mark all read</button>} /><div className="adult-notification-list">{notifications.map((item) => { const Icon = icon(item.type); return <article className={item.unread ? 'unread' : ''} key={item.id}><span><Icon size={19} /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{item.time} ago</small></div>{item.unread && <i aria-label="Unread" />}</article> })}</div>{notifications.length === 0 && <div className="adult-empty"><span><Bell size={26} /></span><h2>You’re all caught up</h2><p>New household updates will appear here.</p></div>}</section></AppShell>
}
