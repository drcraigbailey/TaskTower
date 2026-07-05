import { Bell, ChevronRight, Copy, DoorOpen, Home, LogOut, MessageCircle, Moon, Save, ShieldCheck, ShoppingBasket, SlidersHorizontal, UserRound, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MemberAvatar } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useAdultHousehold } from '../../context/AdultHouseholdContext.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

function SettingToggle({ label, text, checked, disabled, onChange, icon: Icon }) {
  return <div className="household-setting-row"><span className="settings-icon"><Icon size={19} /></span><span><strong>{label}</strong><small>{text}</small></span><button type="button" className={`toggle ${checked ? 'active' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked} disabled={disabled}><i /></button></div>
}

export default function AdultSettingsPage() {
  const navigate = useNavigate()
  const { activeHouse, profile, logout, leaveHouse, updateHousehold, theme, setTheme, showToast } = useTaskTower()
  const { householdSettings, membershipRole, canManageHousehold, saveHouseholdSettings } = useAdultHousehold()
  const [draft, setDraft] = useState(householdSettings)
  const [houseName, setHouseName] = useState(activeHouse?.name || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(householdSettings), [householdSettings])
  useEffect(() => setHouseName(activeHouse?.name || ''), [activeHouse?.name])
  if (!activeHouse) return <Navigate to="/menu" replace />

  const canRenameHousehold = membershipRole === 'owner'
  const signOut = async () => { await logout(); navigate('/login') }
  const setPermission = (name, value) => setDraft((current) => ({ ...current, permissions: { ...current.permissions, [name]: value } }))
  const save = async () => {
    setSaving(true)
    const settingsSaved = await saveHouseholdSettings(draft)
    const nameSaved = !canRenameHousehold || houseName.trim() === activeHouse.name
      ? true
      : await updateHousehold({ name: houseName })
    setSaving(false)
    if (!settingsSaved || !nameSaved) return
  }
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(activeHouse.joinCode)
      showToast('Invite code copied.')
    } catch {
      showToast(`Invite code: ${activeHouse.joinCode}`, 'neutral')
    }
  }
  const leave = async () => {
    const left = await leaveHouse()
    if (left) navigate('/menu')
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-settings with-bottom-space">
        <ScreenHeader title="Settings" subtitle={activeHouse.name} />
        <section className="adult-profile-card"><MemberAvatar name={profile.username} size="lg" online /><div><small>Your profile</small><h1>{profile.username}</h1><p>{membershipRole.charAt(0).toUpperCase() + membershipRole.slice(1)} · {activeHouse.name}</p></div><button onClick={() => navigate('/settings')} aria-label="Edit profile"><UserRound size={18} /></button></section>

        <section className="adult-panel household-details-panel">
          <div className="settings-section-heading"><Home size={20} /><div><small>Household</small><h2>Details and invitations</h2></div></div>
          <label className="field"><span>Household name</span><input value={houseName} onChange={(event) => setHouseName(event.target.value)} disabled={!canRenameHousehold} minLength="2" maxLength="80" /></label>
          <div className="invite-code-row"><span><small>Invite code</small><strong>{activeHouse.joinCode}</strong></span><button type="button" onClick={copyInvite}><Copy size={17} /> Copy</button></div>
          <p className="settings-helper-copy">{activeHouse.members.length} of 10 household places are currently in use. Only the owner can rename the household.</p>
        </section>

        <section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode on this device</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section>

        <section className="adult-panel household-settings-panel">
          <div className="settings-section-heading"><SlidersHorizontal size={20} /><div><small>Shared controls</small><h2>Household features</h2></div></div>
          <SettingToggle icon={MessageCircle} label="Household messages" text="Allow members to use the shared conversation." checked={draft.messaging_enabled} disabled={!canManageHousehold} onChange={(value) => setDraft((current) => ({ ...current, messaging_enabled: value }))} />
          <SettingToggle icon={Users} label="Direct messages" text="Allow private messages between household members." checked={draft.direct_messages_enabled} disabled={!canManageHousehold || !draft.messaging_enabled} onChange={(value) => setDraft((current) => ({ ...current, direct_messages_enabled: value }))} />
          <SettingToggle icon={Bell} label="Household notices" text="Allow notices, pinned updates and acknowledgements." checked={draft.notices_enabled} disabled={!canManageHousehold} onChange={(value) => setDraft((current) => ({ ...current, notices_enabled: value }))} />
          <label className="field settings-select"><span>Contribution display</span><select value={draft.contribution_mode} disabled={!canManageHousehold} onChange={(event) => setDraft((current) => ({ ...current, contribution_mode: event.target.value }))}><option value="off">Off</option><option value="neutral">Neutral totals</option><option value="household_total">Household total only</option><option value="private">Private</option><option value="visible">Visible by member</option><option value="ranking">Ranking</option></select></label>
        </section>

        <section className="adult-panel household-settings-panel">
          <div className="settings-section-heading"><ShieldCheck size={20} /><div><small>Member permissions</small><h2>Who can change things</h2></div></div>
          <SettingToggle icon={SlidersHorizontal} label="Add and edit tasks" text="Members can create and maintain household tasks." checked={draft.permissions.members_add_tasks} disabled={!canManageHousehold} onChange={(value) => setPermission('members_add_tasks', value)} />
          <SettingToggle icon={Home} label="Complete tasks" text="Members can record quick and full cleans." checked={draft.permissions.members_complete_tasks} disabled={!canManageHousehold} onChange={(value) => setPermission('members_complete_tasks', value)} />
          <SettingToggle icon={ShoppingBasket} label="Update shopping" text="Members can add, move and purchase shopping items." checked={draft.permissions.members_add_shopping} disabled={!canManageHousehold} onChange={(value) => setPermission('members_add_shopping', value)} />
          <SettingToggle icon={Bell} label="Post notices" text="Members can create household notices." checked={draft.permissions.members_post_notices} disabled={!canManageHousehold || !draft.notices_enabled} onChange={(value) => setPermission('members_post_notices', value)} />
          <SettingToggle icon={MessageCircle} label="Send messages" text="Members can write in the household conversation." checked={draft.permissions.members_message} disabled={!canManageHousehold || !draft.messaging_enabled} onChange={(value) => setPermission('members_message', value)} />
        </section>

        {canManageHousehold ? <button className="primary-button settings-save-button" onClick={save} disabled={saving || (canRenameHousehold && houseName.trim().length < 2)}><Save size={18} /> {saving ? 'Saving…' : 'Save household settings'}</button> : <div className="adult-owner-note"><ShieldCheck size={19} /><span><strong>Managed by household admins</strong><small>You can view these settings, but only an owner or admin can change them.</small></span></div>}

        <button className="adult-hub-settings" onClick={() => navigate('/settings')}><UserRound size={19} /> Personal account settings <ChevronRight size={18} /></button>
        {membershipRole !== 'owner' && <button className="danger-button" onClick={leave}><DoorOpen size={18} /> Leave household</button>}
        <button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button>
        <BottomNav />
      </section>
    </AppShell>
  )
}

export function AdultProfileSettingsPage() {
  const navigate = useNavigate()
  const { profile, setProfile, logout, theme, setTheme, showToast } = useTaskTower()
  const [username, setUsername] = useState(profile.username || '')
  const [saving, setSaving] = useState(false)
  const signOut = async () => { await logout(); navigate('/login') }
  const saveProfile = async (event) => {
    event.preventDefault()
    const cleanName = username.trim()
    if (!cleanName) return
    setSaving(true)
    const saved = await setProfile({ ...profile, username: cleanName })
    setSaving(false)
    if (saved) showToast('Profile updated.')
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-settings">
        <ScreenHeader title="Account settings" back="/menu" />
        <section className="adult-profile-card"><MemberAvatar name={username || profile.username} size="lg" online /><div><small>Your profile</small><h1>{username || profile.username}</h1><p>Personal account</p></div><UserRound size={18} /></section>
        <form className="adult-panel adult-profile-form" onSubmit={saveProfile}>
          <label className="field"><span>Display name</span><input value={username} onChange={(event) => setUsername(event.target.value)} maxLength="40" required /></label>
          <button className="primary-button" disabled={saving}><Save size={18} /> {saving ? 'Saving…' : 'Save profile'}</button>
        </form>
        <section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode on this device</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section>
        <button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button>
      </section>
    </AppShell>
  )
}
