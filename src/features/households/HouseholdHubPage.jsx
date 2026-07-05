import { ArrowRight, Home, KeyRound, Plus, Settings, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell, ThemeToggle, UserGreeting } from '../../components/AppShell.jsx'
import BrandLogo from '../../components/BrandLogo.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

export default function HouseholdHubPage() {
  const navigate = useNavigate()
  const { activeHouse, houses, householdsReady, selectHouse } = useTaskTower()

  const openHouse = async (houseId) => {
    await selectHouse(houseId)
    navigate(`/house/${houseId}`)
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-household-hub">
        <header className="adult-hub-header"><BrandLogo compact /><ThemeToggle /></header>
        <UserGreeting onNotifications={() => navigate('/notifications')} />
        <div className="household-card-list">
          {houses.map((house) => (
            <button className="current-house-card" key={house.id} onClick={() => openHouse(house.id)}>
              <span><Home size={23} /></span>
              <div><small>{activeHouse?.id === house.id ? 'Current household' : 'Open household'}</small><strong>{house.name}</strong><p>{house.role === 'owner' ? 'Owner' : 'Member'} · Synced</p></div>
              <ArrowRight size={20} />
            </button>
          ))}
        </div>
        {householdsReady && houses.length === 0 && <section className="adult-hub-info"><Home size={21} /><div><strong>No household yet</strong><p>Create one or use an invitation code. New household data is saved to your account.</p></div></section>}
        <div className="adult-hub-actions"><button onClick={() => navigate('/house/new')}><span><Plus size={22} /></span><strong>Create household</strong><small>Start a new shared home.</small></button><button onClick={() => navigate('/house/join')}><span><KeyRound size={22} /></span><strong>Join household</strong><small>Use an invitation code.</small></button></div>
        <section className="adult-hub-info"><Users size={21} /><div><strong>Designed for shared homes</strong><p>Manage tasks, shopping, notices and messages in one calm workspace.</p></div></section>
        <button className="adult-hub-settings" onClick={() => navigate(activeHouse ? `/house/${activeHouse.id}/settings` : '/settings')}><Settings size={19} /> Account settings <ArrowRight size={18} /></button>
      </section>
    </AppShell>
  )
}
