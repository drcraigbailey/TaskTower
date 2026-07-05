import { Bell, ChevronRight, CircleAlert, ListTodo, Megaphone, ShoppingBasket, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AdultSectionHeader, MemberAvatar, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ThemeToggle } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { activitySeed, noticeSeed, shoppingSeed } from '../../data/adultDemoData.js'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const uiStatus = (status) => status === 'overdue' ? 'overdue' : status === 'due' ? 'attention' : status === 'done' ? 'current' : 'paused'

export default function HouseholdDashboard() {
  const navigate = useNavigate()
  const { activeHouse, chores, notifications, profile } = useTaskTower()
  if (!activeHouse) return null
  const urgentTasks = chores.filter((task) => task.status === 'overdue')
  const dueTasks = chores.filter((task) => task.status === 'due')
  const currentTasks = chores.filter((task) => task.status === 'done')
  const urgentNotice = noticeSeed[0]
  const unread = notifications.filter((item) => item.unread).length
  const id = activeHouse.id

  return (
    <AppShell>
      <section className="mobile-screen adult-dashboard with-bottom-space">
        <header className="adult-topbar">
          <button className="household-switcher" onClick={() => navigate('/menu')}><span>{activeHouse.name.slice(0, 1)}</span><div><small>Household</small><strong>{activeHouse.name}</strong></div><ChevronRight size={17} /></button>
          <div><button className="icon-button icon-button--soft" onClick={() => navigate('/notifications')} aria-label="Notifications"><Bell size={19} />{unread > 0 && <span className="notification-dot">{unread}</span>}</button><ThemeToggle /></div>
        </header>

        <div className="adult-greeting"><span>Good morning, {profile.username || 'Alex'}</span><h1>Here’s what needs attention.</h1></div>

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
          </div>
        </section>

        <section className="adult-summary-grid">
          <button className="adult-summary-card" onClick={() => navigate(`/house/${id}/shopping`)}><ShoppingBasket size={20} /><span><small>Shopping</small><strong>{shoppingSeed.filter((item) => item.state === 'low').length} running low</strong><em>{shoppingSeed.filter((item) => item.state === 'out').length} out</em></span></button>
          <button className="adult-summary-card" onClick={() => navigate(`/house/${id}/messages`)}><Megaphone size={20} /><span><small>Messages</small><strong>2 unread</strong><em>1 urgent notice</em></span></button>
        </section>

        <section className="adult-notice adult-notice--urgent">
          <span><CircleAlert size={19} /></span><div><small>Urgent notice</small><strong>{urgentNotice.title}</strong><p>{urgentNotice.body}</p></div><button onClick={() => navigate(`/house/${id}/messages?tab=notices`)}><ChevronRight size={19} /></button>
        </section>

        <section className="adult-panel">
          <AdultSectionHeader eyebrow="This week" title="Household contribution" action={<Users size={19} />} />
          <div className="adult-member-row">
            {activeHouse.members.slice(0, 4).map((member, index) => <div key={member.id}><MemberAvatar name={member.username} online={index < 2} /><strong>{member.username}</strong><small>{Math.max(3, Math.round(member.points / 7))} tasks</small></div>)}
          </div>
        </section>

        <section className="adult-panel adult-activity-preview">
          <AdultSectionHeader eyebrow="Recently" title="Household activity" action={<button className="adult-text-action" onClick={() => navigate(`/house/${id}/activity`)}>View all</button>} />
          {activitySeed.slice(0, 2).map((item) => <div className="activity-row" key={item.id}><span className={`activity-dot activity-dot--${item.tone}`} /><p><strong>{item.member}</strong> {item.action} <b>{item.subject}</b><small>{item.time}</small></p></div>)}
        </section>
        <BottomNav />
      </section>
    </AppShell>
  )
}
