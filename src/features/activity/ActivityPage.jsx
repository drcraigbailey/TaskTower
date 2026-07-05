import { Activity } from 'lucide-react'
import { MemberAvatar } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

export default function ActivityPage() {
  const { activeHouse, activity } = useTaskTower()
  if (!activeHouse) return null
  return (
    <AppShell>
      <section className="mobile-screen adult-activity-page with-bottom-space">
        <ScreenHeader title="Household activity" subtitle={activeHouse.name} back={`/house/${activeHouse.id}`} />
        <section className="adult-panel">
          <div className="activity-title"><Activity size={20} /><h2>Recent updates</h2></div>
          {activity.map((item) => <article className="activity-detail-row" key={item.id}><MemberAvatar name={item.member} size="sm" /><p><strong>{item.member}</strong> {item.action} <b>{item.subject}</b><small>{item.time}</small></p></article>)}
          {activity.length === 0 && <div className="empty-list"><h2>No activity yet</h2><p>Updates will appear here as the household uses the app.</p></div>}
        </section>
        <BottomNav />
      </section>
    </AppShell>
  )
}
