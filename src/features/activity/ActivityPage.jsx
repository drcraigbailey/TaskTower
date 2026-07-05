import { Activity, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { MemberAvatar } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useAdultHousehold } from '../../context/AdultHouseholdContext.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const filters = [['all', 'All'], ['task', 'Tasks'], ['shopping', 'Shopping'], ['notice', 'Notices']]

export default function ActivityPage() {
  const { activeHouse } = useTaskTower()
  const { activity, dataLoading } = useAdultHousehold()
  const [filter, setFilter] = useState('all')
  const visible = useMemo(() => activity.filter((item) => filter === 'all' || item.event_type?.includes(filter) || item.tone === (filter === 'shopping' ? 'amber' : filter === 'notice' ? 'blue' : 'green')), [activity, filter])

  if (!activeHouse) return <Navigate to="/menu" replace />

  return (
    <AppShell>
      <section className="mobile-screen adult-activity-page with-bottom-space">
        <ScreenHeader title="Household activity" subtitle={activeHouse.name} back={`/house/${activeHouse.id}`} actions={<button className="icon-button icon-button--soft" aria-label="Filter activity"><SlidersHorizontal size={19} /></button>} />
        <div className="adult-filter-chips">{filters.map(([value, label]) => <button className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>
        <section className="adult-panel">
          <div className="activity-title"><Activity size={20} /><h2>Recent updates</h2></div>
          {dataLoading ? <p className="adult-loading-copy">Updating household activity…</p> : visible.length ? visible.map((item) => <article className="activity-detail-row" key={item.id}><MemberAvatar name={item.member} size="sm" /><p><strong>{item.member}</strong> {item.action}{item.subject && <> <b>{item.subject}</b></>}<small>{item.time}</small></p></article>) : <div className="adult-empty-copy"><Activity size={25} /><h2>No matching activity</h2><p>Household changes will build a shared timeline here.</p></div>}
        </section>
        <BottomNav />
      </section>
    </AppShell>
  )
}
