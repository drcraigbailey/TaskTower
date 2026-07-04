import { ArrowDown, ArrowUp, Check, ChevronRight, CircleAlert, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { AppShell, ScreenHeader } from '../components/AppShell.jsx'
import choresTeamwork from '../assets/game-art/screens/chores/chores-teamwork.webp'
import { categoryMeta } from '../data/demoData.js'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

function ChoreCard({ chore, onOpen, onMove, first, last }) {
  const progress = Math.min(100, (chore.quickCount / chore.fullCleanThreshold) * 100)
  const meta = categoryMeta[chore.category] || categoryMeta.Housework
  return (
    <article className={`chore-card chore-card--${chore.status}`}>
      <button className={`category-icon category-icon--${meta.tone}`} onClick={onOpen} aria-label={`Open ${chore.name}`}><img src={meta.icon} alt="" /></button>
      <button className="chore-card__main" onClick={onOpen}>
        <span className="chore-card__title"><strong>{chore.name}</strong><small>{chore.category}</small></span>
        <div className="chore-progress"><span style={{ width: `${progress}%` }} /></div>
        <span className="chore-card__foot"><small>{chore.quickCount} / {chore.fullCleanThreshold} quick cleans</small><em>{chore.dueLabel}</em></span>
      </button>
      <div className="reorder-buttons">
        <button disabled={first} onClick={() => onMove(-1)} aria-label="Move chore up"><ArrowUp size={15} /></button>
        <button disabled={last} onClick={() => onMove(1)} aria-label="Move chore down"><ArrowDown size={15} /></button>
      </div>
    </article>
  )
}

export function ChoreDashboardPage() {
  const navigate = useNavigate()
  const { activeHouse, chores, reorderChore } = useTaskTower()
  const [filter, setFilter] = useState('all')
  if (!activeHouse) return null
  const filtered = chores.filter((chore) => filter === 'all' || chore.status === filter)

  return (
    <AppShell>
      <section className="mobile-screen chores-screen with-bottom-space">
        <ScreenHeader
          title="Chores"
          subtitle={activeHouse.name}
          back={`/house/${activeHouse.id}`}
          actions={<button className="add-button" onClick={() => navigate(`/house/${activeHouse.id}/chores/new`)}><Plus size={20} /></button>}
        />
        <div className="chores-art-banner" aria-hidden="true"><img src={choresTeamwork} alt="" /></div>
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
              onMove={(direction) => reorderChore(chore.id, direction)}
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
  const { chores, saveChore, deleteChore } = useTaskTower()
  const existing = chores.find((chore) => chore.id === choreId)
  const [form, setForm] = useState(existing || emptyChore)
  const editing = Boolean(existing)
  const update = (event) => {
    const { name, value, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'number' ? Number(value) : value }))
  }

  const submit = (event) => {
    event.preventDefault()
    saveChore(form)
    navigate(`/house/${houseId}/chores`)
  }

  const remove = () => {
    deleteChore(existing.id)
    navigate(`/house/${houseId}/chores`)
  }

  return (
    <AppShell>
      <section className="mobile-screen editor-screen">
        <ScreenHeader title={editing ? 'Edit chore' : 'Add chore'} back={`/house/${houseId}/chores`} actions={<button className="text-button" form="chore-form"><Save size={17} /> Save</button>} />
        <form id="chore-form" className="form-stack editor-form" onSubmit={submit}>
          <label className="field"><span>Name</span><input name="name" value={form.name} onChange={update} placeholder="Kitchen surfaces" required /></label>
          <label className="field"><span>Description</span><textarea name="description" value={form.description} onChange={update} placeholder="What does a lovely finished job look like?" rows="3" /></label>
          <div className="form-grid">
            <label className="field"><span>Category</span><select name="category" value={form.category} onChange={update}>{Object.keys(categoryMeta).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span>Frequency</span><select name="frequency" value={form.frequency} onChange={update}><option>Daily</option><option>Weekly</option><option>Fortnightly</option><option>Monthly</option><option>Custom interval</option></select></label>
            <label className="field"><span>Quick clean limit</span><input type="number" name="fullCleanThreshold" value={form.fullCleanThreshold} onChange={update} min="1" max="99" /></label>
            <label className="field"><span>Points</span><input type="number" name="points" value={form.points} onChange={update} min="1" max="20" /></label>
          </div>
          <fieldset className="difficulty-picker">
            <legend>Difficulty</legend>
            <div>{[1, 2, 3, 4, 5].map((item) => <button type="button" className={form.difficulty === item ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, difficulty: item }))} key={item}>{item}</button>)}</div>
            <small>{form.difficulty} point{form.difficulty === 1 ? '' : 's'} of effort</small>
          </fieldset>
          <button className="primary-button"><Save size={18} /> {editing ? 'Save changes' : 'Add chore'}</button>
          {editing && <button type="button" className="danger-button" onClick={remove}><Trash2 size={18} /> Delete chore</button>}
        </form>
      </section>
    </AppShell>
  )
}

export function ChoreDetailsPage() {
  const navigate = useNavigate()
  const { houseId, choreId } = useParams()
  const { chores, completeChore } = useTaskTower()
  const chore = chores.find((item) => item.id === choreId)
  const [celebrating, setCelebrating] = useState(false)

  const progress = useMemo(() => chore ? Math.min(100, (chore.quickCount / chore.fullCleanThreshold) * 100) : 0, [chore])
  if (!chore) return null
  const meta = categoryMeta[chore.category] || categoryMeta.Housework
  const complete = (type) => {
    completeChore(chore.id, type)
    setCelebrating(true)
    window.setTimeout(() => setCelebrating(false), 1500)
  }

  return (
    <AppShell>
      <section className={`mobile-screen chore-detail-screen ${celebrating ? 'is-celebrating' : ''}`}>
        <ScreenHeader title={chore.name} back={`/house/${houseId}/chores`} actions={<button className="text-button" onClick={() => navigate(`/house/${houseId}/chores/${chore.id}/edit`)}>Edit</button>} />
        {celebrating && <div className="completion-confetti" aria-hidden="true">✦ ● ✧ ★ ✦</div>}
        <div className={`chore-hero chore-hero--${meta.tone}`}><img src={meta.icon} alt="" /><div><small>{chore.category}</small><strong>{chore.dueLabel}</strong></div></div>
        <div className="clean-gauge" style={{ '--progress': `${progress * 3.6}deg` }}>
          <div><strong>{chore.quickCount} / {chore.fullCleanThreshold}</strong><span>quick cleans used</span></div>
        </div>
        {chore.quickCount >= chore.fullCleanThreshold && <div className="full-clean-banner"><CircleAlert size={21} /><span><strong>Full clean needed</strong><small>A fresh start resets the quick-clean counter.</small></span></div>}
        <div className="completion-buttons">
          <button className="complete-button complete-button--quick" onClick={() => complete('quick')}><Check size={21} />Quick clean completed</button>
          <button className="complete-button complete-button--full" onClick={() => complete('full')}><Sparkles size={21} />Full clean completed</button>
        </div>
        <dl className="detail-list">
          <div><dt>Description</dt><dd>{chore.description || 'No extra notes.'}</dd></div>
          <div><dt>Frequency</dt><dd>{chore.frequency}</dd></div>
          <div><dt>Difficulty</dt><dd>{chore.difficulty} / 5</dd></div>
          <div><dt>Points</dt><dd>{chore.points} points</dd></div>
          <button onClick={() => complete('full')}><RotateCcw size={17} />Reset with full clean<ChevronRight size={17} /></button>
        </dl>
      </section>
    </AppShell>
  )
}
