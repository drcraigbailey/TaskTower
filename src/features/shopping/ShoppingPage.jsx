import { ArrowRight, Check, Package, Plus, Search, ShoppingBasket, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AdultSectionHeader, EmptyState, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useAdultHousehold } from '../../context/AdultHouseholdContext.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const tabs = [['running_low', 'Running low'], ['out', 'Out'], ['shopping_list', 'Shopping list']]
const emptyForm = { name: '', category: 'Other', state: 'shopping_list', quantity: '', unit: '', note: '' }

export default function ShoppingPage() {
  const { activeHouse } = useTaskTower()
  const { shoppingItems, dataLoading, addShoppingItem, updateShoppingItem, markShoppingPurchased, deleteShoppingItem } = useAdultHousehold()
  const [itemForm, setItemForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState('running_low')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => shoppingItems.filter((item) => (
    item.state === tab
    && `${item.name} ${item.category || ''} ${item.note || ''}`.toLowerCase().includes(query.toLowerCase())
  )), [query, shoppingItems, tab])

  if (!activeHouse) return <Navigate to="/menu" replace />

  const updateForm = (event) => {
    const { name, value } = event.target
    setItemForm((current) => ({ ...current, [name]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextTab = itemForm.state
    const saved = await addShoppingItem(itemForm)
    if (!saved) return
    setItemForm(emptyForm)
    setShowForm(false)
    setTab(nextTab)
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-shopping with-bottom-space">
        <ScreenHeader title="Shopping" subtitle={activeHouse.name} actions={<button className="add-button" onClick={() => setShowForm((current) => !current)} aria-label="Add shopping item">{showForm ? <X size={20} /> : <Plus size={20} />}</button>} />

        {showForm && (
          <form className="adult-inline-form" onSubmit={submit}>
            <div className="adult-inline-form__header"><div><small>New item</small><h2>Add to the household list</h2></div><button type="button" className="icon-button icon-button--soft" onClick={() => setShowForm(false)} aria-label="Close add item form"><X size={18} /></button></div>
            <label className="field"><span>Item</span><input name="name" value={itemForm.name} onChange={updateForm} placeholder="Washing-up liquid" required maxLength="100" /></label>
            <div className="form-grid">
              <label className="field"><span>Category</span><input name="category" value={itemForm.category} onChange={updateForm} placeholder="Kitchen" maxLength="60" /></label>
              <label className="field"><span>Status</span><select name="state" value={itemForm.state} onChange={updateForm}><option value="shopping_list">Shopping list</option><option value="running_low">Running low</option><option value="out">Out</option><option value="stocked">Stocked</option></select></label>
              <label className="field"><span>Quantity</span><input type="number" min="0" step="0.01" name="quantity" value={itemForm.quantity} onChange={updateForm} placeholder="1" /></label>
              <label className="field"><span>Unit</span><input name="unit" value={itemForm.unit} onChange={updateForm} placeholder="bottle" maxLength="30" /></label>
            </div>
            <label className="field"><span>Note</span><input name="note" value={itemForm.note} onChange={updateForm} placeholder="Preferred brand or shop" maxLength="200" /></label>
            <button className="primary-button"><Plus size={18} /> Add item</button>
          </form>
        )}

        <label className="adult-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shopping items" /></label>
        <div className="adult-tabs" role="tablist">{tabs.map(([value, label]) => <button type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}>{label}<span>{shoppingItems.filter((item) => item.state === value).length}</span></button>)}</div>
        <section className="adult-panel shopping-panel">
          <AdultSectionHeader eyebrow={tabs.find(([value]) => value === tab)?.[1]} title={tab === 'shopping_list' ? 'Items to buy' : 'Household stock'} />
          {dataLoading ? <p className="adult-loading-copy">Updating the household list…</p> : visible.length ? <div className="shopping-list">{visible.map((item) => (
            <article className="shopping-row shopping-row--actions" key={item.id}>
              <span className="shopping-item-icon"><Package size={19} /></span>
              <div><strong>{item.name}</strong><small>{[item.detail, item.category].filter(Boolean).join(' · ')}</small></div>
              {tab === 'shopping_list' ? (
                <div className="row-actions"><button className="purchase-button" onClick={() => markShoppingPurchased(item.id)} aria-label={`Mark ${item.name} purchased`}><Check size={18} /></button><button className="row-delete-button" onClick={() => deleteShoppingItem(item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={17} /></button></div>
              ) : (
                <div className="row-actions"><StatusBadge status={tab === 'out' ? 'overdue' : 'attention'} label={tab === 'out' ? 'Out' : 'Low'} /><button className="row-move-button" onClick={() => updateShoppingItem(item.id, { state: 'shopping_list' })} aria-label={`Add ${item.name} to shopping list`}><ArrowRight size={17} /></button><button className="row-delete-button" onClick={() => deleteShoppingItem(item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={17} /></button></div>
              )}
            </article>
          ))}</div> : <EmptyState icon={ShoppingBasket} title="Nothing here" text="There are no matching items in this section." action={<button className="secondary-button" onClick={() => setQuery('')}>Clear search</button>} />}
        </section>
        <button className="primary-button shopping-add" onClick={() => setShowForm(true)}><Plus size={18} /> Add item</button>
        <BottomNav />
      </section>
    </AppShell>
  )
}
