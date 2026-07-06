import { Copy, Home, LogOut, Moon, Save, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MemberAvatar } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

export default function AdultSettingsPage() {
  const navigate = useNavigate()
  const { activeHouse, leaveHouse, logout, profile, showToast, theme, setTheme, updateHouse } = useTaskTower()
  const [form, setForm] = useState({ name: '', towerHeight: 20, monthlyResetDay: 1 })
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeHouse) return
    setForm({
      name: activeHouse.name,
      towerHeight: activeHouse.towerHeight || 20,
      monthlyResetDay: activeHouse.monthlyResetDay || 1,
    })
  }, [activeHouse])

  if (!activeHouse) return null
  const signOut = async () => { await logout(); navigate('/login') }
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.type === 'number' ? Number(event.target.value) : event.target.value }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateHouse(form)
    } catch (err) {
      setError(err.message || 'The household changes could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const copyCode = async () => {
    if (!activeHouse.joinCode) return
    try {
      await navigator.clipboard.writeText(activeHouse.joinCode)
      showToast('Invite code copied.')
    } catch {
      showToast(`Invite code: ${activeHouse.joinCode}`, 'neutral')
    }
  }

  const leave = async () => {
    setLeaving(true)
    setError('')
    try {
      await leaveHouse(activeHouse.id)
      setConfirmLeave(false)
      navigate('/menu')
    } catch (err) {
      setError(err.message || 'The household could not be left.')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-settings with-bottom-space">
        <ScreenHeader title="Settings" subtitle={activeHouse.name} />
        <section className="adult-profile-card"><MemberAvatar name={profile.username} size="lg" online /><div><small>Your profile</small><h1>{profile.username}</h1><p>{activeHouse.role === 'owner' ? 'Owner' : 'Member'} · {activeHouse.name}</p></div><button onClick={() => navigate('/settings')}><UserRound size={18} /></button></section>

        <form className="form-stack editor-form" onSubmit={save}>
          <div className="activity-title"><Home size={20} /><h2>Household details</h2></div>
          <label className="field"><span>Household name</span><input name="name" value={form.name} onChange={update} minLength="2" maxLength="80" required disabled={activeHouse.role !== 'owner'} /></label>
          <div className="form-grid">
            <label className="field"><span>Tower height</span><input name="towerHeight" type="number" value={form.towerHeight} onChange={update} min="5" max="100" disabled={activeHouse.role !== 'owner'} /></label>
            <label className="field"><span>Monthly reset day</span><input name="monthlyResetDay" type="number" value={form.monthlyResetDay} onChange={update} min="1" max="28" disabled={activeHouse.role !== 'owner'} /></label>
          </div>
          {activeHouse.joinCode && <label className="field"><span>Invite code</span><div className="field-control"><input value={activeHouse.joinCode} readOnly /><button type="button" onClick={copyCode} aria-label="Copy invite code"><Copy size={18} /></button></div></label>}
          {error && <div className="inline-message inline-message--error">{error}</div>}
          {activeHouse.role === 'owner' && <button className="primary-button" disabled={saving}><Save size={18} /> {saving ? 'Saving…' : 'Save household changes'}</button>}
        </form>

        <section className="adult-panel">
          <div className="activity-title"><Users size={20} /><h2>Members</h2></div>
          <div className="adult-member-row">{activeHouse.members.map((member) => <div key={member.id}><MemberAvatar name={member.username} online /><strong>{member.username}</strong><small>{member.role}</small></div>)}</div>
        </section>

        <section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section>
        <div className="adult-owner-note"><ShieldCheck size={19} /><span><strong>{activeHouse.role === 'owner' ? 'Household owner' : 'Household member'}</strong><small>{activeHouse.role === 'owner' ? 'Household changes are saved for everyone.' : 'Only the owner can change shared household details.'}</small></span></div>
        {activeHouse.role !== 'owner' && <button className="danger-button" onClick={() => setConfirmLeave(true)}>Leave household</button>}
        <button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button>
        <BottomNav />
      </section>
      <ConfirmDialog open={confirmLeave} title="Leave this household?" message={`You will lose access to ${activeHouse.name} until you are invited again.`} confirmLabel="Leave household" busy={leaving} onConfirm={leave} onCancel={() => setConfirmLeave(false)} />
    </AppShell>
  )
}

export function AdultProfileSettingsPage() {
  const navigate = useNavigate()
  const { logout, profile, setProfile, theme, setTheme } = useTaskTower()
  const [username, setUsername] = useState(profile.username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setUsername(profile.username), [profile.username])
  const signOut = async () => { await logout(); navigate('/login') }
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await setProfile({ ...profile, username })
    } catch (err) {
      setError(err.message || 'The profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <AppShell><section className="mobile-screen adult-settings"><ScreenHeader title="Account settings" back="/menu" /><section className="adult-profile-card"><MemberAvatar name={profile.username} size="lg" online /><div><small>Your profile</small><h1>{profile.username}</h1><p>Personal account</p></div><UserRound size={18} /></section><form className="form-stack editor-form" onSubmit={save}><label className="field"><span>Display name</span><input value={username} onChange={(event) => setUsername(event.target.value)} minLength="1" maxLength="40" required /></label>{error && <div className="inline-message inline-message--error">{error}</div>}<button className="primary-button" disabled={saving}><Save size={18} /> {saving ? 'Saving…' : 'Save profile'}</button></form><section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section><button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button></section></AppShell>
}
