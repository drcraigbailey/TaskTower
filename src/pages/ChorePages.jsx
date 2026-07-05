import { ArrowDown, ArrowUp, Bath, Check, CircleAlert, CookingPot, Home, ImagePlus, Plus, RotateCcw, Save, Sofa, Sparkles, Trash2, WashingMachine, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import { AppShell, ScreenHeader } from '../components/AppShell.jsx'
import { useAdultHousehold } from '../context/AdultHouseholdContext.jsx'
import { useTaskTower } from '../context/TaskTowerContext.jsx'
import { categoryMeta } from '../data/demoData.js'

function useImagePreview(file) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) { setUrl(''); return undefined }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

function ChoreCard({ chore, onOpen, onMove, first, last, canReorder }) {
  const progress = Math.min(100, (chore.quickCount / chore.fullCleanThreshold) * 100)
  const meta = categoryMeta[chore.category] || categoryMeta.Housework
  return (
    <article className={`chore-card chore-card--${chore.status}`}>
      <button className={`category-icon category-icon--${meta.tone}`} onClick={onOpen} aria-label={`Open ${chore.name}`}>{chore.imageUrl ? <img src={chore.imageUrl} alt="" /> : <CategoryGlyph category={chore.category} />}</button>
      <button className="chore-card__main" onClick={onOpen}>
        <span className="chore-card__title"><strong>{chore.name}</strong><small>{[chore.room, chore.category].filter(Boolean).join(' · ')}</small></span>
        <div className="chore-progress"><span style={{ width: `${progress}%` }} /></div>
        <span className="chore-card__foot"><small>{chore.quickCount} / {chore.fullCleanThreshold} quick cleans</small><em>{chore.dueLabel}</em></span>
      </button>
      {canReorder && <div className="reorder-buttons"><button disabled={first} onClick={() => onMove(-1)} aria-label="Move task up"><ArrowUp size={15} /></button><button disabled={last} onClick={() => onMove(1)} aria-label="Move task down"><ArrowDown size={15} /></button></div>}
    </article>
  )
}

export function ChoreDashboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { activeHouse, chores, reorderChore } = useTaskTower()
  const { householdSettings, canManageHousehold } = useAdultHousehold()
  const requestedFilter = searchParams.get('status')
  const [filter, setFilter] = useState(['due', 'overdue', 'done'].includes(requestedFilter) ? requestedFilter : 'all')

  if (!activeHouse) return <Navigate to="/menu" replace />
  const canEdit = canManageHousehold || householdSettings.permissions.members_add_tasks
  const filtered = chores.filter((chore) => filter === 'all' || chore.status === filter)

  return (
    <AppShell>
      <section className="mobile-screen chores-screen with-bottom-space">
        <ScreenHeader title="Tasks" subtitle={activeHouse.name} back={`/house/${activeHouse.id}`} actions={canEdit ? <button className="add-button" onClick={() => navigate(`/house/${activeHouse.id}/chores/new`)}><Plus size={20} /></button> : null} />
        <div className="segmented-control">{['all', 'due', 'overdue', 'done'].map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item === 'all' ? 'All' : item === 'due' ? 'Due soon' : item === 'overdue' ? 'Overdue' : 'Done'}</button>)}</div>
        <div className="chore-list">
          {filtered.map((chore, index) => <ChoreCard key={chore.id} chore={chore} first={index === 0} last={index === filtered.length - 1} canReorder={canEdit && filter === 'all'} onOpen={() => navigate(`/house/${activeHouse.id}/chores/${chore.id}`)} onMove={(direction) => reorderChore(chore.id, direction)} />)}
          {filtered.length === 0 && <div className="empty-list"><span>✨</span><h2>Nothing here</h2><p>That is the nicest possible kind of empty.</p></div>}
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
  room: '',
  urgency: 'normal',
  assignedTo: '',
  responsibility: 'shared',
  frequency: 'Daily',
  difficulty: 2,
  points: 2,
  quickCount: 0,
  fullCleanThreshold: 5,
  estimatedMinutes: '',
  photoRequired: false,
  notes: '',
  imagePath: '',
  imageUrl: '',
  imageFile: null,
  removeImage: false,
  status: 'due',
  dueLabel: 'Due soon',
}

export function ChoreEditorPage() {
  const navigate = useNavigate()
  const { houseId, choreId } = useParams()
  const { activeHouse, chores, saveChore, deleteChore } = useTaskTower()
  const { householdSettings, canManageHousehold } = useAdultHousehold()
  const existing = chores.find((chore) => chore.id === choreId)
  const [form, setForm] = useState(existing ? { ...emptyChore, ...existing } : emptyChore)
  const [saving, setSaving] = useState(false)
  const preview = useImagePreview(form.imageFile)
  const taskImage = form.removeImage ? '' : preview || form.imageUrl || ''
  const editing = Boolean(existing)
  const canEdit = canManageHousehold || householdSettings.permissions.members_add_tasks

  if (!activeHouse) return <Navigate to="/menu" replace />
  if (!canEdit) return <Navigate to={`/house/${houseId}/chores`} replace />

  const update = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value }))
  }
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const saved = await saveChore(form)
    setSaving(false)
    if (saved) navigate(`/house/${houseId}/chores`)
  }
  const remove = async () => {
    setSaving(true)
    const removed = await deleteChore(existing.id)
    setSaving(false)
    if (removed) navigate(`/house/${houseId}/chores`)
  }

  return (
    <AppShell>
      <section className="mobile-screen editor-screen">
        <ScreenHeader title={editing ? 'Edit task' : 'Add task'} back={`/house/${houseId}/chores`} actions={<button className="text-button" form="chore-form" disabled={saving}><Save size={17} /> Save</button>} />
        <form id="chore-form" className="form-stack editor-form" onSubmit={submit}>
          <label className="field"><span>Name</span><input name="name" value={form.name} onChange={update} placeholder="Kitchen surfaces" required maxLength="100" /></label>
          <label className="field"><span>Description</span><textarea name="description" value={form.description} onChange={update} placeholder="What does a finished job look like?" rows="3" /></label>
          <label className="image-picker task-image-picker"><span className="image-picker__preview">{taskImage ? <img src={taskImage} alt="Task preview" /> : <ImagePlus size={24} />}</span><span><strong>Add a task picture</strong><small>Show the room, item or finished result.</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setForm((current) => ({ ...current, imageFile: event.target.files?.[0] || null, removeImage: false }))} /></label>
          {taskImage && <button type="button" className="secondary-button image-remove-action" onClick={() => setForm((current) => ({ ...current, imageFile: null, removeImage: true }))}><X size={16} /> Remove task picture</button>}
          <div className="form-grid">
            <label className="field"><span>Category</span><select name="category" value={form.category} onChange={update}>{Object.keys(categoryMeta).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span>Room</span><input name="room" value={form.room} onChange={update} placeholder="Kitchen" maxLength="60" /></label>
            <label className="field"><span>Urgency</span><select name="urgency" value={form.urgency} onChange={update}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
            <label className="field"><span>Assigned to</span><select name="assignedTo" value={form.assignedTo} onChange={update}><option value="">Everyone</option>{activeHouse.members.map((member) => <option value={member.id} key={member.id}>{member.username}</option>)}</select></label>
            <label className="field"><span>Frequency</span><select name="frequency" value={form.frequency} onChange={update}><option>Daily</option><option>Weekly</option><option>Fortnightly</option><option>Monthly</option><option>Custom interval</option></select></label>
            <label className="field"><span>Quick clean limit</span><input type="number" name="fullCleanThreshold" value={form.fullCleanThreshold} onChange={update} min="1" max="99" /></label>
            <label className="field"><span>Estimated minutes</span><input type="number" name="estimatedMinutes" value={form.estimatedMinutes} onChange={update} min="1" max="1440" /></label>
            <label className="field"><span>Points</span><input type="number" name="points" value={form.points} onChange={update} min="1" max="100" /></label>
          </div>
          <fieldset className="difficulty-picker"><legend>Difficulty</legend><div>{[1, 2, 3, 4, 5].map((item) => <button type="button" className={form.difficulty === item ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, difficulty: item }))} key={item}>{item}</button>)}</div><small>{form.difficulty} point{form.difficulty === 1 ? '' : 's'} of effort</small></fieldset>
          <label className="field"><span>Private notes</span><textarea name="notes" value={form.notes} onChange={update} placeholder="Products, access or useful reminders" rows="3" /></label>
          <label className="adult-check-row"><input type="checkbox" name="photoRequired" checked={form.photoRequired} onChange={update} /><span><strong>Require a completion photo</strong><small>Members will be reminded that a completion picture is expected.</small></span></label>
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
  const { activeHouse, chores, completeChore } = useTaskTower()
  const { householdSettings, canManageHousehold } = useAdultHousehold()
  const chore = chores.find((item) => item.id === choreId)
  const [celebrating, setCelebrating] = useState(false)
  const [completing, setCompleting] = useState(false)
  const canComplete = canManageHousehold || householdSettings.permissions.members_complete_tasks
  const canEdit = canManageHousehold || householdSettings.permissions.members_add_tasks
  const progress = useMemo(() => chore ? Math.min(100, (chore.quickCount / chore.fullCleanThreshold) * 100) : 0, [chore])

  if (!chore) return <Navigate to={`/house/${houseId}/chores`} replace />
  const meta = categoryMeta[chore.category] || categoryMeta.Housework
  const complete = async (type) => {
    if (!canComplete || completing) return
    setCompleting(true)
    const completed = await completeChore(chore.id, type)
    setCompleting(false)
    if (!completed) return
    setCelebrating(true)
    window.setTimeout(() => setCelebrating(false), 1500)
  }

  return (
    <AppShell>
      <section className={`mobile-screen chore-detail-screen ${celebrating ? 'is-celebrating' : ''}`}>
        <ScreenHeader title={chore.name} back={`/house/${houseId}/chores`} actions={canEdit ? <button className="text-button" onClick={() => navigate(`/house/${houseId}/chores/${chore.id}/edit`)}>Edit</button> : null} />
        {chore.imageUrl && <img className="task-detail-media" src={chore.imageUrl} alt={chore.name} />}
        <div className={`chore-hero chore-hero--${meta.tone}`}><span className="adult-detail-icon"><CategoryGlyph category={chore.category} /></span><div><small>{[chore.room, chore.category].filter(Boolean).join(' · ')}</small><strong>{chore.dueLabel}</strong></div></div>
        <div className="clean-gauge" style={{ '--progress': `${progress * 3.6}deg` }}><div><strong>{chore.quickCount} / {chore.fullCleanThreshold}</strong><span>quick cleans used</span></div></div>
        {chore.quickCount >= chore.fullCleanThreshold && <div className="full-clean-banner"><CircleAlert size={21} /><span><strong>Full clean needed</strong><small>A fresh start resets the quick-clean counter.</small></span></div>}
        {chore.photoRequired && <div className="adult-disabled-note"><ImagePlus size={18} /> This task expects a completion picture.</div>}
        <div className="completion-buttons"><button className="complete-button complete-button--quick" onClick={() => complete('quick')} disabled={!canComplete || completing}><Check size={21} />Quick clean completed</button><button className="complete-button complete-button--full" onClick={() => complete('full')} disabled={!canComplete || completing}><Sparkles size={21} />Full clean completed</button></div>
        {!canComplete && <div className="adult-disabled-note">Your household permissions do not allow task completion.</div>}
        <dl className="detail-list">
          <div><dt>Description</dt><dd>{chore.description || 'No extra description.'}</dd></div><div><dt>Frequency</dt><dd>{chore.frequency}</dd></div><div><dt>Urgency</dt><dd>{chore.urgency}</dd></div><div><dt>Assigned to</dt><dd>{activeHouse?.members.find((member) => member.id === chore.assignedTo)?.username || 'Everyone'}</dd></div><div><dt>Estimated time</dt><dd>{chore.estimatedMinutes ? `${chore.estimatedMinutes} minutes` : 'Not set'}</dd></div><div><dt>Difficulty</dt><dd>{chore.difficulty} / 5</dd></div><div><dt>Points</dt><dd>{chore.points} points</dd></div><div><dt>Notes</dt><dd>{chore.notes || 'No private notes.'}</dd></div>
          {canComplete && <button onClick={() => complete('full')} disabled={completing}><RotateCcw size={17} />Reset with full clean</button>}
        </dl>
      </section>
    </AppShell>
  )
}

function CategoryGlyph({ category }) {
  const Icon = category === 'Kitchen' ? CookingPot : category === 'Bathroom' ? Bath : category === 'Laundry' ? WashingMachine : category === 'Living room' ? Sofa : category === 'Outdoor' ? Home : Sparkles
  return <Icon size={22} aria-hidden="true" />
}
