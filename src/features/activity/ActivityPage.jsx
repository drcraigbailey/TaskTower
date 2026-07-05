import { Activity, SlidersHorizontal } from 'lucide-react'
import { MemberAvatar } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { activitySeed } from '../../data/adultDemoData.js'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

export default function ActivityPage() {
  const { activeHouse } = useTaskTower()
  if (!activeHouse) return null
  return <AppShell><section className="mobile-screen adult-activity-page with-bottom-space"><ScreenHeader title="Household activity" subtitle={activeHouse.name} back={`/house/${activeHouse.id}`} actions={<button className="icon-button icon-button--soft" aria-label="Filter activity"><SlidersHorizontal size={19} /></button>} /><div className="adult-filter-chips"><button className="active">All</button><button>Tasks</button><button>Shopping</button><button>Notices</button></div><section className="adult-panel"><div className="activity-title"><Activity size={20} /><h2>Recent updates</h2></div>{[...activitySeed, ...activitySeed].map((item, index) => <article className="activity-detail-row" key={`${item.id}-${index}`}><MemberAvatar name={item.member} size="sm" /><p><strong>{item.member}</strong> {item.action} <b>{item.subject}</b><small>{index > 2 ? 'Earlier this week' : item.time}</small></p></article>)}</section><BottomNav /></section></AppShell>
}
