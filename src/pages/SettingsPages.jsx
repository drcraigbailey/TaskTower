import { Bell, ChevronRight, ClipboardList, Copy, Gamepad2, Home, LogOut, Palette, Save, ShieldCheck, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { AppShell, ScreenHeader } from '../components/AppShell.jsx'
import { categoryMeta } from '../data/demoData.js'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

const skinOptions = ['#F1C7A5', '#D99A70', '#C98252', '#A96843', '#70432D']
const hairOptions = ['#241710', '#4B2817', '#6B3D22', '#A86232', '#D6AF7A']
const outfitOptions = ['#7C5CFF', '#FF6B8B', '#5C9CF6', '#55BE92', '#F0A53A']
const celebrations = [
  ['confetti', 'Confetti', '✦'],
  ['fireworks', 'Fireworks', '🎆'],
  ['dance', 'Dancing', '♪'],
  ['trophy', 'Trophy pose', '🏆'],
  ['wave', 'Waving', '👋'],
  ['silly', 'Silly', '😜'],
]

export function PersonalSettingsPage() {
  const navigate = useNavigate()
  const { profile, setProfile, logout, showToast } = useTaskTower()
  const [draft, setDraft] = useState(profile)
  const updateAvatar = (key, value) => setDraft((current) => ({ ...current, avatar: { ...current.avatar, [key]: value } }))
  const save = () => {
    setProfile(draft)
    showToast('Your character looks brilliant.')
  }
  const signOut = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <AppShell>
      <section className="mobile-screen settings-screen">
        <ScreenHeader title="Personal settings" back="/menu" actions={<button className="text-button" onClick={save}><Save size={17} /> Save</button>} />
        <div className="character-preview">
          <div className="character-halo" />
          <Avatar avatar={draft.avatar} size="xl" celebrating />
          <span className="preview-name">{draft.username || 'Your character'}</span>
        </div>
        <div className="settings-form">
          <label className="field"><span>Username</span><input value={draft.username} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))} /></label>
          <SettingSwatches label="Skin tone" values={skinOptions} selected={draft.avatar.skin} onChange={(value) => updateAvatar('skin', value)} />
          <div className="settings-row"><span><strong>Hair style</strong><small>Pick a silhouette</small></span><div className="mini-segments">{['wave', 'long', 'curls'].map((item) => <button className={draft.avatar.hairStyle === item ? 'active' : ''} onClick={() => updateAvatar('hairStyle', item)} key={item}>{item}</button>)}</div></div>
          <SettingSwatches label="Hair colour" values={hairOptions} selected={draft.avatar.hair} onChange={(value) => updateAvatar('hair', value)} />
          <SettingSwatches label="Outfit colour" values={outfitOptions} selected={draft.avatar.outfit} onChange={(value) => updateAvatar('outfit', value)} />
          <div className="settings-row"><span><strong>Accessory</strong><small>A tiny bit of flair</small></span><select value={draft.avatar.accessory} onChange={(event) => updateAvatar('accessory', event.target.value)}><option value="none">None</option><option value="glasses">Glasses</option><option value="cap">Cap</option><option value="crown">Crown</option></select></div>
        </div>
        <section className="celebration-picker">
          <div className="section-heading"><div><span className="eyebrow">At the next floor</span><h2>Celebration</h2></div><Sparkles size={20} /></div>
          <div>{celebrations.map(([value, label, emoji]) => <button className={draft.avatar.celebration === value ? 'active' : ''} onClick={() => updateAvatar('celebration', value)} key={value}><span>{emoji}</span><small>{label}</small></button>)}</div>
        </section>
        <button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button>
      </section>
    </AppShell>
  )
}

function SettingSwatches({ label, values, selected, onChange }) {
  return (
    <div className="settings-row settings-row--swatches">
      <strong>{label}</strong>
      <div className="swatches">{values.map((value) => <button className={selected === value ? 'active' : ''} style={{ backgroundColor: value }} onClick={() => onChange(value)} key={value} aria-label={`${label} ${value}`} />)}</div>
    </div>
  )
}

export function SharedSettingsPage() {
  const navigate = useNavigate()
  const { activeHouse, showToast } = useTaskTower()
  if (!activeHouse) return null
  const id = activeHouse.id

  return (
    <AppShell>
      <section className="mobile-screen shared-settings-screen with-bottom-space">
        <ScreenHeader title="House settings" subtitle={activeHouse.name} back={`/house/${id}`} />
        <div className="invite-card">
          <div><span className="eyebrow">Invite housemates</span><h2>{activeHouse.joinCode}</h2><p>Share this code with people you trust.</p></div>
          <button onClick={() => { navigator.clipboard?.writeText(activeHouse.joinCode); showToast('Invite code copied.') }}><Copy size={19} />Copy</button>
        </div>
        <div className="settings-link-list">
          <SettingsLink icon={ClipboardList} tone="peach" title="Chore settings" text="Categories, limits and frequencies" onClick={() => navigate(`/house/${id}/chores`)} />
          <SettingsLink icon={Gamepad2} tone="purple" title="Game settings" text="Tower height, points and bonuses" onClick={() => navigate(`/house/${id}/settings/game`)} />
          <SettingsLink icon={Users} tone="rose" title="Members" text={`${activeHouse.members.length} people in this house`} />
          <SettingsLink icon={Home} tone="mint" title="House info" text="Name, reset day and invite code" />
          <SettingsLink icon={Bell} tone="blue" title="Notifications" text="Shared in-app alert preferences" onClick={() => navigate('/notifications')} />
        </div>
        <div className="owner-note"><ShieldCheck size={19} /><span><strong>You’re the house owner</strong><small>Only owners can change shared game rules.</small></span></div>
        <BottomNav />
      </section>
    </AppShell>
  )
}

function SettingsLink({ icon: Icon, tone, title, text, onClick }) {
  return (
    <button className="settings-link" onClick={onClick}>
      <span className={`settings-link__icon settings-link__icon--${tone}`}><Icon size={21} /></span>
      <span><strong>{title}</strong><small>{text}</small></span>
      <ChevronRight size={19} />
    </button>
  )
}

export function GameSettingsPage() {
  const { activeHouse, showToast } = useTaskTower()
  const [settings, setSettings] = useState({
    height: activeHouse?.towerHeight || 20,
    resetDay: 1,
    difficultyScaling: true,
    overdueBonus: true,
    winnerCelebration: 'confetti',
    basePoints: 1,
    fullCleanDefault: 5,
  })
  if (!activeHouse) return null
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }))

  return (
    <AppShell>
      <section className="mobile-screen game-settings-screen">
        <ScreenHeader title="Game settings" subtitle="Friendly rules for everyone" back={`/house/${activeHouse.id}/settings`} actions={<button className="text-button" onClick={() => showToast('Shared game settings saved.')}><Save size={17} /> Save</button>} />
        <section className="setting-section">
          <div className="section-heading"><div><span className="eyebrow">Monthly tower</span><h2>Race setup</h2></div><Gamepad2 size={20} /></div>
          <div className="settings-row"><span><strong>Tower height</strong><small>Floors to reach the roof</small></span><select value={settings.height} onChange={(event) => update('height', Number(event.target.value))}><option value="10">10 floors</option><option value="20">20 floors</option><option value="30">30 floors</option><option value="40">Custom: 40</option></select></div>
          <div className="settings-row"><span><strong>Monthly reset day</strong><small>Start a fresh race each month</small></span><input type="number" min="1" max="28" value={settings.resetDay} onChange={(event) => update('resetDay', Number(event.target.value))} /></div>
          <div className="settings-row"><span><strong>Winner celebration</strong><small>The big rooftop moment</small></span><select value={settings.winnerCelebration} onChange={(event) => update('winnerCelebration', event.target.value)}>{celebrations.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
        </section>
        <section className="setting-section">
          <div className="section-heading"><div><span className="eyebrow">Scoring</span><h2>Climb rules</h2></div><SlidersHorizontal size={20} /></div>
          <ToggleSetting title="Difficulty scaling" text="Harder chores climb more floors" value={settings.difficultyScaling} onChange={(value) => update('difficultyScaling', value)} />
          <ToggleSetting title="Overdue bonus" text="A gentle bonus for rescuing overdue chores" value={settings.overdueBonus} onChange={(value) => update('overdueBonus', value)} />
          <div className="settings-row"><span><strong>Points per chore</strong><small>Base points before scaling</small></span><input type="number" min="1" max="10" value={settings.basePoints} onChange={(event) => update('basePoints', Number(event.target.value))} /></div>
          <div className="settings-row"><span><strong>Default full-clean limit</strong><small>Quick cleans before a reset</small></span><input type="number" min="1" max="20" value={settings.fullCleanDefault} onChange={(event) => update('fullCleanDefault', Number(event.target.value))} /></div>
        </section>
        <section className="category-summary"><div className="section-heading"><div><span className="eyebrow">Household</span><h2>Chore categories</h2></div><Palette size={20} /></div><div>{Object.entries(categoryMeta).map(([name, meta]) => <span key={name}><img src={meta.icon} alt="" /> {name}</span>)}</div></section>
        <button className="primary-button" onClick={() => showToast('Shared game settings saved.')}><Save size={18} /> Save game settings</button>
      </section>
    </AppShell>
  )
}

function ToggleSetting({ title, text, value, onChange }) {
  return (
    <div className="settings-row"><span><strong>{title}</strong><small>{text}</small></span><button className={`toggle ${value ? 'active' : ''}`} onClick={() => onChange(!value)} aria-pressed={value}><i /></button></div>
  )
}
