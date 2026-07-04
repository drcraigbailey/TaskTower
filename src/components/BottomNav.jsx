import { Bell, Castle, ClipboardCheck, Home, MoreHorizontal } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { activeHouse } = useTaskTower()
  const houseId = activeHouse?.id || 'demo-house'
  const items = [
    { label: 'Home', icon: Home, path: `/house/${houseId}` },
    { label: 'Chores', icon: ClipboardCheck, path: `/house/${houseId}/chores` },
    { label: 'Tower', icon: Castle, path: `/house/${houseId}/tower` },
    { label: 'Alerts', icon: Bell, path: '/notifications' },
    { label: 'More', icon: MoreHorizontal, path: `/house/${houseId}/settings` },
  ]

  return (
    <nav className="bottom-nav" aria-label="House navigation">
      {items.map((item) => {
        const Icon = item.icon
        const active = item.path === `/house/${houseId}` ? pathname === item.path : pathname.startsWith(item.path)
        return (
          <button className={active ? 'active' : ''} onClick={() => navigate(item.path)} key={item.label}>
            <Icon size={20} strokeWidth={active ? 2.6 : 2} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
