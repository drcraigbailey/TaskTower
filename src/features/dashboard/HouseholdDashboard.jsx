import { Bell, ChevronRight, CircleAlert, ListTodo, Megaphone, ShoppingBasket, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AdultSectionHeader, MemberAvatar, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ThemeToggle } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const uiStatus = (status) => status === 'overdue' ? 'overdue' : status === 'due' ? 'attention' : status === 'done' ? 'current' : 'paused'

export default function HouseholdDashboard() {
  const navigate = useNavigate()
  const { activeHouse, activity, chores, messages, notices, notifications, profile, shoppingItems } = useTaskTower()
  if (!activeHouse) return null
  const urgentTasks = chores.filter((task) => task.status === 'overdue')
  const dueTasks = chores.filter((task) => task.status === 'due')
  const currentTasks = chores.filter((task) => task.status === 'done')
  const urgentNotice = notices.find((notice) => notice.priority === 'urgent') || notices[0]
  const unread = notifications.filter((item) => item.unread).length
  const id = activeHouse.id
  const runningLow = shoppingItems.filter((item) => item.state === 'low').length
  const outOfStock = shoppingItems.filter((item) => item.state === 'out').length

  return (
    <AppShell>
      <section className="mobile-screen adult-dashboard with-bottom-space">
        <header className="adult-topbar">
          <button className="household-switcher" onClick={() => navigate('/menu')}><span>{activeHouse.picture ? <img src={activeHouse.picture} alt="" /> : activeHouse.name.slice(0, 1)}</span><div><small>Household</small><strong>{activeHouse.name}</strong></div><ChevronRight size={17} /></button>
          <div><button className="icon-button icon-button--soft" onClick={() => navigate('/notifications')} aria-label="Notifications"><Bell size={19} />{unread > 0 && <span className="notification-dot">{unread}</span>}</button><ThemeToggle /></div>
        </header>

        <div className="adult-greeting"><span>Good morning, {profile.username}</span><h1>Here’s what needs attention.</h1></div>

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
            {urgentTasks.length + dueTasks.length === 0 && <div className="empty-list"><span>✓</span><h2>All caught up</h2><p>There are no tasks needing attention right now.</p></div>}
          </div>
        </section>

        <section className="adult-summary-grid">
          <button className="adult-summary-card" onClick={() => navigate(`/house/${id}/shopping`)}><ShoppingBasket size={20} /><span><small>Shopping</small><strong>{runningLow} running low</strong><em>{outOfStock} out</em></span></button>
          <button className="adult-summary-card" onClick={() => navigate(`/house/${id}/messages`)}><Megaphone size={20} /><span><small>Messages</small><strong>{messages.length} recent</strong><em>{notices.length} notice{notices.length === 1 ? '' : 's'}</em></span></button>
        </section>

        {urgentNotice && <button type="button" className={`adult-notice adult-clickable-banner adult-notice--${urgentNotice.priority === 'urgent' ? 'urgent' : 'important'}`} onClick={() => navigate(`/house/${id}/messages?tab=notices`)}>
          <span><CircleAlert size={19} /></span><div><small>{urgentNotice.priority === 'urgent' ? 'Urgent notice' : 'Household notice'}</small><strong>{urgentNotice.title}</strong><p>{urgentNotice.body}</p></div><ChevronRight size={19} />
        </button>}

        <button type="button" className="adult-panel adult-clickable-panel" onClick={() => navigate(`/house/${id}/activity`)}>
          <AdultSectionHeader eyebrow="This month" title="Household contribution" action={<Users size={19} />} />
          <div className="adult-member-row">
            {activeHouse.members.slice(0, 4).map((member) => <div key={member.id}><MemberAvatar name={member.username} image={member.profileImage} online /><strong>{member.username}</strong><small>{member.points} points</small></div>)}
          </div>
        </button>

        <section className="adult-panel adult-activity-preview">
          <AdultSectionHeader eyebrow="Recently" title="Household activity" action={<button className="adult-text-action" onClick={() => navigate(`/house/${id}/activity`)}>View all</button>} />
          {activity.slice(0, 2).map((item) => <div className="activity-row" key={item.id}><span className={`activity-dot activity-dot--${item.tone}`} /><p><strong>{item.member}</strong> {item.action} <b>{item.subject}</b><small>{item.time}</small></p></div>)}
          {activity.length === 0 && <p className="empty-copy">Household activity will appear here as people complete tasks and add shared updates.</p>}
        </section>
        <BottomNav />
      </section>
    </AppShell>
  )
}
