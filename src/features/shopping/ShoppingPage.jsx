import { Check, Package, Plus, Search, ShoppingBasket, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdultSectionHeader, EmptyState, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const tabs = [['low', 'Running low'], ['out', 'Out'], ['list', 'Shopping list']]
const emptyForm = { name: '', detail: '', category: 'General', state: 'list' }

export default function ShoppingPage() {
  const { activeHouse, addShoppingItem, deleteShoppingItem, purchaseShoppingItem, shoppingItems } = useTaskTower()
  const [tab, setTab] = useState('low')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [purchasingId, setPurchasingId] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState(null)
  const [error, setError] = useState('')
  const formRef = useRef(null)
  const visible = useMemo(() => shoppingItems.filter((item) => item.state === tab && item.name.toLowerCase().includes(query.toLowerCase())), [shoppingItems, query, tab])

  useEffect(() => {
    if (!showForm) return
    const frame = window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [showForm])

  if (!activeHouse) return null

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await addShoppingItem(form)
      setTab(form.state)
      setForm(emptyForm)
      setShowForm(false)
    } catch (err) {
      setError(err.message || 'The shopping item could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const purchase = async (id) => {
    if (purchasingId) return
    setPurchasingId(id)
    setError('')
    try {
      await purchaseShoppingItem(id)
    } catch (err) {
      setError(err.message || 'The item could not be updated.')
    } finally {
      setPurchasingId(null)
    }
  }

  const remove = async () => {
    if (!pendingRemoval) return
    setRemoving(true)
    setError('')
    try {
      await deleteShoppingItem(pendingRemoval.id)
      setPendingRemoval(null)
    } catch (err) {
      setError(err.message || 'The item could not be removed.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-shopping with-bottom-space">
        <ScreenHeader title="Shopping" subtitle={activeHouse.name} actions={<button className="add-button" onClick={() => setShowForm((value) => !value)} aria-label="Add shopping item">{showForm ? <X size={20} /> : <Plus size={20} />}</button>} />
        {showForm && <form ref={formRef} className="form-stack editor-form shopping-item-form" onSubmit={submit}>
          <div className="editor-form__heading"><span>New item</span><h2>Add to the household list</h2></div>
          <label className="field"><span>Item</span><input name="name" value={form.name} onChange={update} placeholder="Milk" required /></label>
          <label className="field"><span>Details</span><input name="detail" value={form.detail} onChange={update} placeholder="2 litres, semi-skimmed" /></label>
          <div className="form-grid">
            <label className="field"><span>Category</span><input name="category" value={form.category} onChange={update} placeholder="Groceries" /></label>
            <label className="field"><span>Status</span><select name="state" value={form.state} onChange={update}><option value="low">Running low</option><option value="out">Out</option><option value="list">Shopping list</option></select></label>
          </div>
          <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Add to household list'}</button>
        </form>}
        {error && <div className="inline-message inline-message--error">{error}</div>}
        <label className="adult-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shopping items" /></label>
        <div className="adult-tabs" role="tablist">{tabs.map(([value, label]) => <button className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}>{label}<span>{shoppingItems.filter((item) => item.state === value).length}</span></button>)}</div>
        <section className="adult-panel shopping-panel">
          <AdultSectionHeader eyebrow={tabs.find(([value]) => value === tab)?.[1]} title={tab === 'list' ? 'Items to buy' : 'Household stock'} />
          {visible.length ? <div className="shopping-list">{visible.map((item) => (
            <article className="shopping-row" key={item.id}>
              <span className="shopping-item-icon"><Package size={19} /></span>
              <div><strong>{item.name}</strong><small>{item.detail || 'No extra details'} · {item.category}</small></div>
              {tab === 'list'
                ? <button className="purchase-button" onClick={() => purchase(item.id)} disabled={purchasingId === item.id} aria-label={`Mark ${item.name} purchased`}>{purchasingId === item.id ? '…' : <Check size={18} />}</button>
                : <><StatusBadge status={tab === 'out' ? 'overdue' : 'attention'} label={tab === 'out' ? 'Out' : 'Low'} /><button className="purchase-button" onClick={() => setPendingRemoval(item)} aria-label={`Remove ${item.name}`}><Trash2 size={16} /></button></>}
            </article>
          ))}</div> : <EmptyState icon={ShoppingBasket} title="Nothing here" text="There are no matching items in this section." action={<button className="secondary-button" onClick={() => setQuery('')}>Clear search</button>} />}
        </section>
        <button className="primary-button shopping-add" onClick={() => setShowForm(true)}><Plus size={18} /> Add item</button>
        <BottomNav />
      </section>
      <ConfirmDialog open={Boolean(pendingRemoval)} title="Remove this item?" message={pendingRemoval ? `${pendingRemoval.name} will be removed from the household list.` : ''} confirmLabel="Remove item" busy={removing} onConfirm={remove} onCancel={() => setPendingRemoval(null)} />
    </AppShell>
  )
}
