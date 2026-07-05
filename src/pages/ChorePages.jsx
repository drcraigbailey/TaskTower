import { ArrowDown, ArrowUp, Bath, Check, ChevronRight, CircleAlert, CookingPot, Home, Plus, RotateCcw, Save, Sofa, Sparkles, Trash2, WashingMachine } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { AppShell, ScreenHeader } from '../components/AppShell.jsx'
import { categoryMeta } from '../data/defaults.js'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

function ChoreCard({ chore, onOpen, onMove, first, last }) {
  const progress = Math.min(100, (chore.quickCount / chore.fullCleanThreshold) * 100)
  const meta = categoryMeta[chore.category] || categoryMeta.Housework
  return (
    <article className={`chore-card chore-card--${chore.status}`}>
      <button className={`category-icon category-icon--${meta.tone}`} onClick={onOpen} aria-label={`Open ${chore.name}`}><CategoryGlyph category={chore.category} /></button>
      <button className="chore-card__main" onClick={onOpen}>
        <span className="chore-card__title"><strong>{chore.name}</strong><small>{chore.category}</small></span>
        <div className="chore-progress"><span style={{ width: `${progress}%` }} /></div>
        <span className="chore-card__foot"><small>{chore.quickCount} / {chore.fullCleanThreshold} quick cleans</small><em>{chore.dueLabel}</em></span>
      </button>
      <div className="reorder-buttons">
        <button disabled={first} onClick={() => onMove(-1)} aria-label="Move task up"><ArrowUp size={15} /></button>
        <button disabled={last} onClick={() => onMove(1)} aria-label="Move task down"><ArrowDown size={15} /></button>
      </div>
    </article>
  )
}

export function ChoreDashboardPage() {
  const navigate = useNavigate()
  const { activeHouse, chores, reorderChore } = useTaskTower()
  const initialFilter = new URLSearchParams(window.location.hash.split('?')[1] || '').get('status') || 'all'
  const [filter, setFilter] = useState(initialFilter)
  const [error, setError] = useState('')
  if (!activeHouse) return null
  const filtered = chores.filter((chore) => filter === 'all' || chore.status === filter)

  const move = async (id, direction) => {
    setError('')
    try {
      await reorderChore(id, direction)
    } catch (err) {
      setError(err.message || 'The task order could not be saved.')
    }
  }

  return (
    <AppShell>
      <section className="mobile-screen chores-screen with-bottom-space">
        <ScreenHeader
          title="Tasks"
          subtitle={activeHouse.name}
          back={`/house/${activeHouse.id}`}
          actions={<button className="add-button" onClick={() => navigate(`/house/${activeHouse.id}/chores/new`)}><Plus size={20} /></button>}
        />
        {error && <div className="inline-message inline-message--error">{error}</div>}
        <div className="segmented-control">
          {['all', 'due', 'overdue', 'done'].map((item) => (
            <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>
              {item === 'all' ? 'All' : item === 'due' ? 'Due soon' : item === 'overdue' ? 'Overdue' : 'Done'}
            </button>
          ))}
        </div>
        <div className="chore-list">
          {filtered.map((chore, index) => (
            <ChoreCard
              key={chore.id}
              chore={chore}
              first={index === 0}
              last={index === filtered.length - 1}
              onOpen={() => navigate(`/house/${activeHouse.id}/chores/${chore.id}`)}
              onMove={(direction) => move(chore.id, direction)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="empty-list"><span>✨</span><h2>Nothing here</h2><p>That is the nicest possible kind of empty.</p></div>
          )}
        </div>
        <BottomNav />
      </section>
    </AppShell>
  )
}

const emptyChore = {
  name: '',
  description: '',
  category: 'Kitchen',
  frequency: 'Daily',
  difficulty: 2,
  points: 2,
  quickCount: 0,
  fullCleanThreshold: 5,
  status: 'due',
  dueLabel: 'Due soon',
}

export function ChoreEditorPage() {
  const navigate = useNavigate()
  const { houseId, choreId } = useParams()
  const { chores, dataLoading, saveChore, deleteChore } = useTaskTower()
  const existing = chores.find((chore) => chore.id === choreId)
  const [form, setForm] = useState(existing || emptyChore)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editing = Boolean(choreId)

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  const update = (event) => {
    const { name, value, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'number' ? Number(value) : value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await saveChore(form)
      navigate(`/house/${houseId}/chores`)
    } catch (err) {
      setError(err.message || 'The task could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    setSaving(true)
    setError('')
    try {
      await deleteChore(existing.id)
      navigate(`/house/${houseId}/chores`)
    } catch (err) {
      setError(err.message || 'The task could not be removed.')
      setSaving(false)
    }
  }

  if (editing && !existing && dataLoading) return <div className="route-loading" role="status">Loading task…</div>
  if (editing && !existing && !dataLoading) return <AppShell><section className="mobile-screen editor-screen"><ScreenHeader title="Task not found" back={`/house/${houseId}/chores`} /><div className="empty-list"><span>?</span><h2>That task is unavailable</h2><p>It may have been removed by another household member.</p></div></section></AppShell>

  return (
    <AppShell>
      <section className="mobile-screen editor-screen">
        <ScreenHeader title={editing ? 'Edit task' : 'Add task'} back={`/house/${houseId}/chores`} actions={<button className="text-button" form="chore-form" disabled={saving}><Save size={17} /> Save</button>} />
        <form id="chore-form" className="form-stack editor-form" onSubmit={submit}>
          <label className="field"><span>Name</span><input name="name" value={form.name} onChange={update} placeholder="Kitchen surfaces" required /></label>
          <label className="field"><span>Description</span><textarea name="description" value={form.description} onChange={update} placeholder="What does a lovely finished job look like?" rows="3" /></label>
          <div className="form-grid">
            <label className="field"><span>Category</span><select name="category" value={form.category} onChange={update}>{Object.keys(categoryMeta).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span>Frequency</span><select name="frequency" value={form.frequency} onChange={update}><option>Daily</option><option>Weekly</option><option>Fortnightly</option><option>Monthly</option><option>Custom interval</option></select></label>
            <label className="field"><span>Quick clean limit</span><input type="number" name="fullCleanThreshold" value={form.fullCleanThreshold} onChange={update} min="1" max="99" /></label>
            <label className="field"><span>Points</span><input type="number" name="points" value={form.points} onChange={update} min="1" max="100" /></label>
          </div>
          <fieldset className="difficulty-picker">
            <legend>Difficulty</legend>
            <div>{[1, 2, 3, 4, 5].map((item) => <button type="button" className={form.difficulty === item ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, difficulty: item }))} key={item}>{item}</button>)}</div>
            <small>{form.difficulty} point{form.difficulty === 1 ? '' : 's'} of effort</small>
          </fieldset>
          {error && <div className="inline-message inline-message--error">{error}</div>}
          <button className="primary-button" disabled={saving}><Save size={18} /> {saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}</button>
          {editing && <button type="button" className="danger-button" onClick={remove} disabled={saving}><Trash2 size={18} /> Delete task</button>}
        </form>
      </section>
    </AppShell>
  )
}

export function ChoreDetailsPage() {
  const navigate = useNavigate()
  const { houseId, choreId } = useParams()
  const { chores, completeChore, dataLoading } = useTaskTower()
  const chore = chores.find((item) => item.id === choreId)
  const [celebrating, setCelebrating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const progress = useMemo(() => chore ? Math.min(100, (chore.quickCount / chore.fullCleanThreshold) * 100) : 0, [chore])
  if (!chore && dataLoading) return <div className="route-loading" role="status">Loading task…</div>
  if (!chore) return <AppShell><section className="mobile-screen chore-detail-screen"><ScreenHeader title="Task not found" back={`/house/${houseId}/chores`} /><div className="empty-list"><span>?</span><h2>That task is unavailable</h2><p>It may have been removed by another household member.</p></div></section></AppShell>
  const meta = categoryMeta[chore.category] || categoryMeta.Housework

  const complete = async (type) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await completeChore(chore.id, type)
      setCelebrating(true)
      window.setTimeout(() => setCelebrating(false), 1500)
    } catch (err) {
      setError(err.message || 'The task completion could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <section className={`mobile-screen chore-detail-screen ${celebrating ? 'is-celebrating' : ''}`}>
        <ScreenHeader title={chore.name} back={`/house/${houseId}/chores`} actions={<button className="text-button" onClick={() => navigate(`/house/${houseId}/chores/${chore.id}/edit`)}>Edit</button>} />
        <div className={`chore-hero chore-hero--${meta.tone}`}><span className="adult-detail-icon"><CategoryGlyph category={chore.category} /></span><div><small>{chore.category}</small><strong>{chore.dueLabel}</strong></div></div>
        <div className="clean-gauge" style={{ '--progress': `${progress * 3.6}deg` }}>
          <div><strong>{chore.quickCount} / {chore.fullCleanThreshold}</strong><span>quick cleans used</span></div>
        </div>
        {chore.quickCount >= chore.fullCleanThreshold && <div className="full-clean-banner"><CircleAlert size={21} /><span><strong>Full clean needed</strong><small>A fresh start resets the quick-clean counter.</small></span></div>}
        {error && <div className="inline-message inline-message--error">{error}</div>}
        <div className="completion-buttons">
          <button className="complete-button complete-button--quick" onClick={() => complete('quick')} disabled={busy}><Check size={21} />Quick clean completed</button>
          <button className="complete-button complete-button--full" onClick={() => complete('full')} disabled={busy}><Sparkles size={21} />Full clean completed</button>
        </div>
        <dl className="detail-list">
          <div><dt>Description</dt><dd>{chore.description || 'No extra notes.'}</dd></div>
          <div><dt>Frequency</dt><dd>{chore.frequency}</dd></div>
          <div><dt>Difficulty</dt><dd>{chore.difficulty} / 5</dd></div>
          <div><dt>Points</dt><dd>{chore.points} points</dd></div>
          <button onClick={() => complete('full')} disabled={busy}><RotateCcw size={17} />Reset with full clean<ChevronRight size={17} /></button>
        </dl>
      </section>
    </AppShell>
  )
}

function CategoryGlyph({ category }) {
  const Icon = category === 'Kitchen' ? CookingPot : category === 'Bathroom' ? Bath : category === 'Laundry' ? WashingMachine : category === 'Living room' ? Sofa : category === 'Outdoor' ? Home : Sparkles
  return <Icon size={22} aria-hidden="true" />
}
