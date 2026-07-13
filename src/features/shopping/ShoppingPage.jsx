import { Check, Package, Plus, Search, Send, ShoppingBasket, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdultSectionHeader, EmptyState, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'
import { useNativeBackAction } from '../../lib/nativeBack.js'

const tabs = [['in_stock', 'In stock'], ['low', 'Running low'], ['out', 'Out'], ['list', 'Shopping list']]
const stockStates = [['in_stock', 'In stock'], ['low', 'Running low'], ['out', 'Out']]
<<<<<<< HEAD
const urgencyStates = [['list_low', 'Running low'], ['list_out', 'Out']]
const shoppingListStates = new Set(['list', 'list_low', 'list_out'])
const emptyForm = { name: '', detail: '', category: 'General', urgency: 'list_low' }

const isShoppingListItem = (item) => shoppingListStates.has(item.state)
const listUrgency = (item) => item.state === 'list_out' ? 'list_out' : 'list_low'
=======
const emptyForm = { name: '', detail: '', category: 'General', state: 'list' }
const sentMessage = (result) => {
  const members = `${result.memberCount} member${result.memberCount === 1 ? '' : 's'}`
  if (result.pushDelivered && result.pushSent > 0) return `Sent to ${members} and ${result.pushSent} Android device${result.pushSent === 1 ? '' : 's'}.`
  if (result.pushDelivered) return `Sent in-app to ${members}. No Android devices are registered yet.`
  return `Sent in-app to ${members}. Android push failed: ${result.pushError || 'check Firebase secrets and the Edge Function.'}`
}
>>>>>>> e0d27b8 (Update TaskTower app)

export default function ShoppingPage() {
  const {
    activeHouse,
    addShoppingItem,
    deleteShoppingItem,
    purchaseShoppingItem,
    sendHouseholdNotification,
    shoppingItems,
    showToast,
    updateShoppingItemStatus,
  } = useTaskTower()
  const [tab, setTab] = useState('list')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [purchasingId, setPurchasingId] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState(null)
  const [statusBusy, setStatusBusy] = useState(null)
  const [error, setError] = useState('')
  const formRef = useRef(null)
  const visible = useMemo(
    () => shoppingItems.filter((item) => {
      const matchesTab = tab === 'list' ? isShoppingListItem(item) : item.state === tab
      return matchesTab && item.name.toLowerCase().includes(query.toLowerCase())
    }),
    [shoppingItems, query, tab],
  )
  const listItems = useMemo(() => shoppingItems.filter(isShoppingListItem), [shoppingItems])

  useNativeBackAction(() => {
    if (!showForm) return false
    if (!busy) setShowForm(false)
    return true
  }, showForm, 20)

  useEffect(() => {
    if (!showForm) return
    const frame = window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [showForm])

  if (!activeHouse) return null

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const countForTab = (value) => value === 'list'
    ? listItems.length
    : shoppingItems.filter((item) => item.state === value).length

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await addShoppingItem({ ...form, state: form.urgency })
      setTab('list')
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

  const changeStatus = async (item, state) => {
    if (statusBusy || item.state === state) return
    setStatusBusy(`${item.id}:${state}`)
    setError('')
    try {
      await updateShoppingItemStatus(item.id, state)
      if (state === 'low' || state === 'out') {
        showToast(`${item.name} was added to the shopping list.`)
      } else {
        showToast(`${item.name} is marked in stock.`, 'neutral')
      }
    } catch (err) {
      setError(err.message || 'The stock status could not be updated.')
    } finally {
      setStatusBusy(null)
    }
  }

  const changeUrgency = async (item, state) => {
    if (statusBusy || listUrgency(item) === state) return
    setStatusBusy(`${item.id}:${state}`)
    setError('')
    try {
      await updateShoppingItemStatus(item.id, state)
      showToast(`${item.name} is now marked ${state === 'list_out' ? 'out' : 'running low'}.`)
    } catch (err) {
      setError(err.message || 'The item urgency could not be updated.')
    } finally {
      setStatusBusy(null)
    }
  }

  const sendToMembers = async () => {
    if (broadcasting) return
    setBroadcasting(true)
    setError('')
    try {
      const names = listItems.map((item) => `${item.name} (${listUrgency(item) === 'list_out' ? 'out' : 'running low'})`)
      const summary = names.length
        ? `${names.slice(0, 6).join(', ')}${names.length > 6 ? ` and ${names.length - 6} more` : ''}`
        : 'Shopping list needs attention!'
      const result = await sendHouseholdNotification({
        type: 'shopping_broadcast',
        title: 'Shopping list needs attention!',
        body: names.length ? `Current list: ${summary}` : summary,
        data: {
          type: 'shopping_broadcast',
          destination: `/house/${activeHouse.id}/shopping`,
          item_count: names.length,
          items: names.slice(0, 12),
        },
      })
      showToast(sentMessage(result))
    } catch (err) {
      setError(err.message || 'The shopping alert could not be sent.')
    } finally {
      setBroadcasting(false)
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
            <label className="field"><span>Urgency</span><select name="urgency" value={form.urgency} onChange={update}><option value="list_low">Running low</option><option value="list_out">Out</option></select></label>
          </div>
          <button className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Add to shopping list'}</button>
        </form>}
        {error && <div className="inline-message inline-message--error">{error}</div>}
        <section className="shopping-broadcast-card">
          <div><small>Shopping broadcast</small><strong>{listItems.length} item{listItems.length === 1 ? '' : 's'} on the list</strong></div>
          <button type="button" className="secondary-button" onClick={sendToMembers} disabled={broadcasting}><Send size={17} /> {broadcasting ? 'Sending...' : 'Send to members'}</button>
        </section>
        <label className="adult-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shopping items" /></label>
        <div className="adult-tabs" role="tablist">{tabs.map(([value, label]) => <button className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}>{label}<span>{countForTab(value)}</span></button>)}</div>
        <section className="adult-panel shopping-panel">
          <AdultSectionHeader eyebrow={tabs.find(([value]) => value === tab)?.[1]} title={tab === 'list' ? 'Items to buy' : 'Household stock'} />
          {visible.length ? <div className="shopping-list">{visible.map((item) => (
            <article className="shopping-row" key={item.id}>
              <span className="shopping-item-icon"><Package size={19} /></span>
              <div className="shopping-row__main">
                <strong>{item.name}</strong>
                <small>{item.detail || 'No extra details'} - {item.category}</small>
                <div className="stock-state-control" aria-label={tab === 'list' ? `${item.name} urgency` : `${item.name} stock status`}>
                  {(tab === 'list' ? urgencyStates : stockStates).map(([value, label]) => (
                    <button
                      type="button"
                      className={(tab === 'list' ? listUrgency(item) : item.state) === value ? 'active' : ''}
                      onClick={() => tab === 'list' ? changeUrgency(item, value) : changeStatus(item, value)}
                      disabled={statusBusy === `${item.id}:${value}`}
                      aria-pressed={(tab === 'list' ? listUrgency(item) : item.state) === value}
                      key={value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="shopping-row__actions">
                {tab === 'list'
                  ? <>
                    <StatusBadge status={listUrgency(item) === 'list_out' ? 'overdue' : 'attention'} label={listUrgency(item) === 'list_out' ? 'Out' : 'Low'} />
                    <button className="purchase-button" onClick={() => purchase(item.id)} disabled={purchasingId === item.id} aria-label={`Mark ${item.name} purchased`}>{purchasingId === item.id ? '...' : <Check size={18} />}</button>
                  </>
                  : <StatusBadge status={tab === 'out' ? 'overdue' : tab === 'low' ? 'attention' : 'current'} label={tab === 'out' ? 'Out' : tab === 'low' ? 'Low' : 'In'} />}
                <button className="purchase-button purchase-button--danger" onClick={() => setPendingRemoval(item)} aria-label={`Remove ${item.name}`}><Trash2 size={16} /></button>
              </div>
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
