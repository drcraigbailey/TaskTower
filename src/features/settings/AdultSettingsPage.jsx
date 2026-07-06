import { BellRing, CheckCircle2, ClipboardList, Copy, Home, LogOut, MessageCircle, Moon, RotateCcw, Save, ShieldCheck, ShoppingBasket, Trophy, UserRound, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MemberAvatar } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import ImagePicker from '../../components/ImagePicker.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'
import { resetHouseholdProgressRecord } from '../../lib/liveMutations.js'
import {
  getNotificationPermissionStatus,
  loadNotificationPreferences,
  saveNotificationPreferences,
  setNativeNotificationsEnabled,
} from '../../lib/pushNotifications.js'

const notificationRows = [
  ['messages', 'Household messages', 'New messages from housemates', MessageCircle],
  ['notices', 'Notices and urgent updates', 'Shared household announcements', BellRing],
  ['shopping', 'Shopping-list changes', 'Items added, purchased or removed', ShoppingBasket],
  ['taskReminders', 'Task reminders', 'Tasks due soon or overdue', ClipboardList],
  ['taskCompletions', 'Task completions', 'When another member completes a task', CheckCircle2],
  ['monthlyResults', 'Progress results', 'Winners and household summaries', Trophy],
]

function NotificationSettingsPanel({ showToast }) {
  const [preferences, setPreferences] = useState(null)
  const [permission, setPermission] = useState('checking')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([loadNotificationPreferences(), getNotificationPermissionStatus()]).then(([nextPreferences, nextPermission]) => {
      if (!active) return
      setPreferences(nextPreferences)
      setPermission(nextPermission)
    })
    return () => { active = false }
  }, [])

  if (!preferences) return null

  const toggleMaster = async () => {
    if (saving) return
    setSaving(true)
    try {
      const next = await setNativeNotificationsEnabled(!preferences.enabled)
      setPreferences((current) => ({ ...current, ...next }))
      setPermission(next.permission || await getNotificationPermissionStatus())
      if (next.enabled) showToast?.('Notifications enabled on this device.')
      else if (next.permission === 'denied') showToast?.('Notifications are blocked in Android settings.', 'neutral')
      else showToast?.('Notifications disabled on this device.', 'neutral')
    } catch (error) {
      showToast?.(error.message || 'Notification settings could not be changed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const togglePreference = async (key) => {
    const next = { ...preferences, [key]: !preferences[key] }
    setPreferences(next)
    try {
      await saveNotificationPreferences(next)
    } catch (error) {
      setPreferences(preferences)
      showToast?.(error.message || 'Notification preference could not be saved.', 'error')
    }
  }

  const statusText = permission === 'granted'
    ? 'Notifications allowed on this device'
    : permission === 'denied'
      ? 'Notifications are blocked in Android settings'
      : permission === 'web'
        ? 'Preferences will apply in the Android app'
        : preferences.enabled
          ? 'Android will ask for permission when required'
          : 'Notifications are disabled on this device'

  return (
    <section className="adult-panel notification-settings-panel">
      <div className="notification-master-row">
        <div><span className="settings-icon"><BellRing size={19} /></span><span><strong>Allow notifications</strong><small>{statusText}</small></span></div>
        <button type="button" className={`toggle ${preferences.enabled && permission !== 'denied' ? 'active' : ''}`} onClick={toggleMaster} disabled={saving} aria-pressed={preferences.enabled && permission !== 'denied'}><i /></button>
      </div>
      <div className={`notification-preference-list ${preferences.enabled ? '' : 'disabled'}`}>
        {notificationRows.map(([key, title, description, Icon]) => (
          <div className="notification-preference-row" key={key}>
            <Icon size={17} />
            <span><strong>{title}</strong><small>{description}</small></span>
            <button type="button" className={`toggle toggle--small ${preferences[key] ? 'active' : ''}`} onClick={() => togglePreference(key)} disabled={!preferences.enabled} aria-pressed={preferences[key]}><i /></button>
          </div>
        ))}
      </div>
      {permission === 'denied' && <p className="notification-settings-note">Android has blocked notification permission. Open Dwellio in Android Settings → Notifications to allow it again.</p>}
    </section>
  )
}

export default function AdultSettingsPage() {
  const navigate = useNavigate()
  const { activeHouse, leaveHouse, logout, profile, refreshActiveHouse, showToast, theme, setTheme, updateHouse } = useTaskTower()
  const [form, setForm] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [error, setError] = useState('')
  const [pictureFile, setPictureFile] = useState(null)
  const [removePicture, setRemovePicture] = useState(false)

  useEffect(() => {
    if (!activeHouse) return
    setForm({ name: activeHouse.name })
    setPictureFile(null)
    setRemovePicture(false)
  }, [activeHouse])

  if (!activeHouse) return null
  const signOut = async () => { await logout(); navigate('/login') }
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateHouse({ ...form, pictureFile, removePicture })
      setPictureFile(null)
      setRemovePicture(false)
    }
    catch (err) { setError(err.message || 'The household changes could not be saved.') }
    finally { setSaving(false) }
  }

  const copyCode = async () => {
    if (!activeHouse.joinCode) return
    try { await navigator.clipboard.writeText(activeHouse.joinCode); showToast('Invite code copied.') }
    catch { showToast(`Invite code: ${activeHouse.joinCode}`, 'neutral') }
  }

  const leave = async () => {
    setLeaving(true)
    setError('')
    try { await leaveHouse(activeHouse.id); setConfirmLeave(false); navigate('/menu') }
    catch (err) { setError(err.message || 'The household could not be left.') }
    finally { setLeaving(false) }
  }

  const resetProgress = async () => {
    setResetting(true)
    setError('')
    try {
      await resetHouseholdProgressRecord(activeHouse.id)
      await refreshActiveHouse()
      setConfirmReset(false)
      showToast('Household progress has been reset.')
    } catch (err) {
      setError(err.message || 'Household progress could not be reset.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-settings with-bottom-space">
        <ScreenHeader title="Settings" subtitle={activeHouse.name} />
        <section className="adult-profile-card"><MemberAvatar name={profile.username} image={profile.picture} size="lg" online /><div><small>Your profile</small><h1>{profile.username}</h1><p>{activeHouse.role === 'owner' ? 'Owner' : 'Member'} · {activeHouse.name}</p></div><button onClick={() => navigate('/settings')} aria-label="Edit profile and profile picture"><UserRound size={18} /></button></section>
        <form className="form-stack editor-form" onSubmit={save}>
          <div className="activity-title"><Home size={20} /><h2>Household details</h2></div>
          <ImagePicker
            label="Household picture"
            value={removePicture ? null : activeHouse.picture}
            fallback={<Home size={28} />}
            file={pictureFile}
            onFileChange={(file) => { setPictureFile(file); setRemovePicture(false) }}
            onRemove={() => { setPictureFile(null); setRemovePicture(true) }}
            disabled={activeHouse.role !== 'owner'}
            shape="square"
          />
          <label className="field"><span>Household name</span><input name="name" value={form.name} onChange={update} minLength="2" maxLength="80" required disabled={activeHouse.role !== 'owner'} /></label>
          {activeHouse.joinCode && <label className="field"><span>Invite code</span><div className="field-control"><input value={activeHouse.joinCode} readOnly /><button type="button" onClick={copyCode} aria-label="Copy invite code"><Copy size={18} /></button></div></label>}
          {error && <div className="inline-message inline-message--error">{error}</div>}
          {activeHouse.role === 'owner' && <button className="primary-button" disabled={saving}><Save size={18} /> {saving ? 'Saving…' : 'Save household changes'}</button>}
        </form>
        {activeHouse.role === 'owner' && (
          <section className="adult-panel manual-reset-panel">
            <div className="activity-title"><RotateCcw size={20} /><h2>Reset progress</h2></div>
            <p>Start a fresh household competition whenever you choose. Previous task completions remain in the activity history, but everyone’s current points and floors return to zero.</p>
            <button type="button" className="danger-button" onClick={() => setConfirmReset(true)} disabled={resetting}><RotateCcw size={18} /> Reset household progress</button>
          </section>
        )}
        <section className="adult-panel"><div className="activity-title"><Users size={20} /><h2>Members</h2></div><div className="adult-member-row">{activeHouse.members.map((member) => <div key={member.id}><MemberAvatar name={member.username} image={member.profileImage} online /><strong>{member.username}</strong><small>{member.role}</small></div>)}</div></section>
        <section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section>
        <NotificationSettingsPanel showToast={showToast} />
        <div className="adult-owner-note"><ShieldCheck size={19} /><span><strong>{activeHouse.role === 'owner' ? 'Household owner' : 'Household member'}</strong><small>{activeHouse.role === 'owner' ? 'Household changes are saved for everyone.' : 'Only the owner can change shared household details.'}</small></span></div>
        {activeHouse.role !== 'owner' && <button className="danger-button" onClick={() => setConfirmLeave(true)}>Leave household</button>}
        <button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button>
        <BottomNav />
      </section>
      <ConfirmDialog open={confirmLeave} title="Leave this household?" message={`You will lose access to ${activeHouse.name} until you are invited again.`} confirmLabel="Leave household" busy={leaving} onConfirm={leave} onCancel={() => setConfirmLeave(false)} />
      <ConfirmDialog open={confirmReset} title="Reset everyone’s progress?" message="Current points and floors will return to zero for every household member. Completed-task history will not be deleted." confirmLabel="Reset progress" busy={resetting} onConfirm={resetProgress} onCancel={() => setConfirmReset(false)} />
    </AppShell>
  )
}

export function AdultProfileSettingsPage() {
  const navigate = useNavigate()
  const { logout, profile, saveProfileSettings, showToast, theme, setTheme } = useTaskTower()
  const [username, setUsername] = useState(profile.username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pictureFile, setPictureFile] = useState(null)
  const [removePicture, setRemovePicture] = useState(false)

  useEffect(() => setUsername(profile.username), [profile.username])
  const signOut = async () => { await logout(); navigate('/login') }
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await saveProfileSettings({ username, pictureFile, removePicture })
      setPictureFile(null)
      setRemovePicture(false)
    }
    catch (err) { setError(err.message || 'The profile could not be saved.') }
    finally { setSaving(false) }
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-settings">
        <ScreenHeader title="Account settings" back="/menu" />
        <section className="adult-profile-card">
          <MemberAvatar name={profile.username} image={profile.picture} size="lg" online />
          <div><small>Your profile</small><h1>{profile.username}</h1><p>Personal account</p></div>
          <UserRound size={18} />
        </section>
        <form className="form-stack editor-form" onSubmit={save}>
          <ImagePicker
            label="Profile picture"
            value={removePicture ? null : profile.picture}
            fallback={profile.username.slice(0, 2).toUpperCase()}
            file={pictureFile}
            onFileChange={(file) => { setPictureFile(file); setRemovePicture(false) }}
            onRemove={() => { setPictureFile(null); setRemovePicture(true) }}
          />
          <label className="field"><span>Display name</span><input value={username} onChange={(event) => setUsername(event.target.value)} minLength="1" maxLength="40" required /></label>
          {error && <div className="inline-message inline-message--error">{error}</div>}
          <button className="primary-button" disabled={saving}><Save size={18} /> {saving ? 'Saving…' : 'Save profile'}</button>
        </form>
        <section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section>
        <NotificationSettingsPanel showToast={showToast} />
        <button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button>
      </section>
    </AppShell>
  )
}
