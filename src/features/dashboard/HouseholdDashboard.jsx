import { Bell, ChevronRight, CircleAlert, ListTodo, Megaphone, ShoppingBasket, Users } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AdultSectionHeader, MemberAvatar, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ThemeToggle } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useAdultHousehold } from '../../context/AdultHouseholdContext.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const uiStatus = (status) => status === 'overdue' ? 'overdue' : status === 'due' ? 'attention' : status === 'done' ? 'current' : 'paused'

export default function HouseholdDashboard() {
  const navigate = useNavigate()
  const { activeHouse, chores, notifications, profile } = useTaskTower()
  const { shoppingItems, notices, messages, activity, dataLoading } = useAdultHousehold()

  if (!activeHouse) return <Navigate to="/menu" replace />

  const urgentTasks = chores.filter((task) => task.status === 'overdue')
  const dueTasks = chores.filter((task) => task.status === 'due')
  const currentTasks = chores.filter((task) => task.status === 'done')
  const urgentNotice = notices.find((notice) => notice.priority === 'urgent') || notices[0]
  const unread = notifications.filter((item) => item.unread).length
  const lowCount = shoppingItems.filter((item) => item.state === 'running_low').length
  const outCount = shoppingItems.filter((item) => item.state === 'out').length
  const id = activeHouse.id

  return (
    <AppShell>
      <section className="mobile-screen adult-dashboard with-bottom-space">
        <header className="adult-topbar">
          <button className="household-switcher" onClick={() => navigate('/menu')}><span>{activeHouse.name.slice(0, 1)}</span><div><small>Household</small><strong>{activeHouse.name}</strong></div><ChevronRight size={17} /></button>
          <div><button className="icon-button icon-button--soft" onClick={() => navigate('/notifications')} aria-label="Notifications"><Bell size={19} />{unread > 0 && <span className="notification-dot">{unread}</span>}</button><ThemeToggle /></div>
        </header>

        <div className="adult-greeting"><span>Good morning, {profile.username || 'there'}</span><h1>Here’s what needs attention.</h1></div>

        <section className="attention-overview" aria-label="Task status overview">
          <button onClick={() => navigate(`/house/${id}/chores?status=overdue`)}><strong>{urgentTasks.length}</strong><span>Overdue</span><i className="red" /></button>
          <button onClick={() => navigate(`/house/${id}/chores?status=due`)}><strong>{dueTasks.length}</strong><span>Due soon</span><i className="amber" /></button>
          <button onClick={() => navigate(`/house/${id}/chores?status=done`)}><strong>{currentTasks.length}</strong><span>Up to date</span><i className="green" /></button>
        </section>

        <section className="adult-panel">
          <AdultSectionHeader eyebrow="Priority" title="Tasks needing attention" action={<button className="adult-text-action" onClick={() => navigate(`/house/${id}/chores`)}>View all</button>} />
          <div className="adult-task-stack">
            {[...urgentTasks, ...dueTasks].slice(0, 4).map((task) => (
              <button className="adult-task-row" key={task.id} onClick={() => navigate(`/house/${id}/chores/${task.id}`)}>
                <span className={`adult-task-icon adult-task-icon--${uiStatus(task.status)}`}><ListTodo size={18} /></span>
                <span><strong>{task.name}</strong><small>{task.category} · {task.dueLabel}</small></span>
                <StatusBadge status={uiStatus(task.status)} />
              </button>
            ))}
            {!urgentTasks.length && !dueTasks.length && <div className="adult-empty-inline"><span>✓</span><p><strong>Everything is up to date.</strong><small>No tasks need attention right now.</small></p></div>}
          </div>
        </section>

        <section className="adult-summary-grid">
          <button className="adult-summary-card" onClick={() => navigate(`/house/${id}/shopping`)}><ShoppingBasket size={20} /><span><small>Shopping</small><strong>{dataLoading ? 'Updating…' : `${lowCount} running low`}</strong><em>{outCount} out</em></span></button>
          <button className="adult-summary-card" onClick={() => navigate(`/house/${id}/messages`)}><Megaphone size={20} /><span><small>Messages</small><strong>{messages.length} recent</strong><em>{notices.filter((notice) => notice.priority === 'urgent').length} urgent notice{notices.filter((notice) => notice.priority === 'urgent').length === 1 ? '' : 's'}</em></span></button>
        </section>

        {urgentNotice && <section className={`adult-notice adult-notice--${urgentNotice.priority}`}>
          <span><CircleAlert size={19} /></span><div><small>{urgentNotice.priority === 'urgent' ? 'Urgent notice' : 'Household notice'}</small><strong>{urgentNotice.title}</strong><p>{urgentNotice.body}</p></div><button onClick={() => navigate(`/house/${id}/messages?tab=notices`)}><ChevronRight size={19} /></button>
        </section>}

        <section className="adult-panel">
          <AdultSectionHeader eyebrow="This month" title="Household contribution" action={<Users size={19} />} />
          <div className="adult-member-row">
            {activeHouse.members.slice(0, 4).map((member, index) => <div key={member.id}><MemberAvatar name={member.username} online={index < 2} /><strong>{member.username}</strong><small>{Math.max(0, Math.round(member.points / 2))} tasks</small></div>)}
          </div>
        </section>

        <section className="adult-panel adult-activity-preview">
          <AdultSectionHeader eyebrow="Recently" title="Household activity" action={<button className="adult-text-action" onClick={() => navigate(`/house/${id}/activity`)}>View all</button>} />
          {activity.length ? activity.slice(0, 2).map((item) => <div className="activity-row" key={item.id}><span className={`activity-dot activity-dot--${item.tone}`} /><p><strong>{item.member}</strong> {item.action}{item.subject && <> <b>{item.subject}</b></>}<small>{item.time}</small></p></div>) : <div className="adult-empty-inline"><span>•</span><p><strong>No activity yet.</strong><small>Completed tasks and household updates will appear here.</small></p></div>}
        </section>
        <BottomNav />
      </section>
    </AppShell>
  )
}
