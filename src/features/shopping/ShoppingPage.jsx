import { Check, MoreHorizontal, Package, Plus, Search, ShoppingBasket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AdultSectionHeader, EmptyState, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { shoppingSeed } from '../../data/adultDemoData.js'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const tabs = [['low', 'Running low'], ['out', 'Out'], ['list', 'Shopping list']]

export default function ShoppingPage() {
  const { activeHouse, showToast } = useTaskTower()
  const [items, setItems] = useState(shoppingSeed)
  const [tab, setTab] = useState('low')
  const [query, setQuery] = useState('')
  const visible = useMemo(() => items.filter((item) => item.state === tab && item.name.toLowerCase().includes(query.toLowerCase())), [items, query, tab])
  if (!activeHouse) return null
  const purchase = (id) => {
    setItems((current) => current.filter((item) => item.id !== id))
    showToast('Marked as purchased.')
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-shopping with-bottom-space">
        <ScreenHeader title="Shopping" subtitle={activeHouse.name} actions={<button className="add-button" onClick={() => showToast('Add-item form is ready for Supabase wiring.')} aria-label="Add shopping item"><Plus size={20} /></button>} />
        <label className="adult-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shopping items" /></label>
        <div className="adult-tabs" role="tablist">{tabs.map(([value, label]) => <button className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}>{label}<span>{items.filter((item) => item.state === value).length}</span></button>)}</div>
        <section className="adult-panel shopping-panel">
          <AdultSectionHeader eyebrow={tabs.find(([value]) => value === tab)?.[1]} title={tab === 'list' ? 'Items to buy' : 'Household stock'} action={<MoreHorizontal size={19} />} />
          {visible.length ? <div className="shopping-list">{visible.map((item) => (
            <article className="shopping-row" key={item.id}>
              <span className="shopping-item-icon"><Package size={19} /></span>
              <div><strong>{item.name}</strong><small>{item.detail} · {item.category}</small></div>
              {tab === 'list' ? <button className="purchase-button" onClick={() => purchase(item.id)} aria-label={`Mark ${item.name} purchased`}><Check size={18} /></button> : <StatusBadge status={tab === 'out' ? 'overdue' : 'attention'} label={tab === 'out' ? 'Out' : 'Low'} />}
            </article>
          ))}</div> : <EmptyState icon={ShoppingBasket} title="Nothing here" text="There are no matching items in this section." action={<button className="secondary-button" onClick={() => setQuery('')}>Clear search</button>} />}
        </section>
        <button className="primary-button shopping-add" onClick={() => showToast('Add-item form is ready for Supabase wiring.')}><Plus size={18} /> Add item</button>
        <BottomNav />
      </section>
    </AppShell>
  )
}
