import { Bell, ChevronRight, Home, LogOut, MessageCircle, Moon, Save, ShieldCheck, ShoppingBasket, SlidersHorizontal, UserRound, Users } from 'lucide-react'
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
  const { activeHouse, profile, logout, theme, setTheme } = useTaskTower()
  const { householdSettings, membershipRole, canManageHousehold, saveHouseholdSettings } = useAdultHousehold()
  const [draft, setDraft] = useState(householdSettings)

  useEffect(() => setDraft(householdSettings), [householdSettings])
  if (!activeHouse) return <Navigate to="/menu" replace />

  const signOut = async () => { await logout(); navigate('/login') }
  const setPermission = (name, value) => setDraft((current) => ({ ...current, permissions: { ...current.permissions, [name]: value } }))
  const save = async () => { await saveHouseholdSettings(draft) }

  return (
    <AppShell>
      <section className="mobile-screen adult-settings with-bottom-space">
        <ScreenHeader title="Settings" subtitle={activeHouse.name} />
        <section className="adult-profile-card"><MemberAvatar name={profile.username} size="lg" online /><div><small>Your profile</small><h1>{profile.username}</h1><p>{membershipRole.charAt(0).toUpperCase() + membershipRole.slice(1)} · {activeHouse.name}</p></div><button onClick={() => navigate('/settings')} aria-label="Edit profile"><UserRound size={18} /></button></section>

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

        {canManageHousehold ? <button className="primary-button settings-save-button" onClick={save}><Save size={18} /> Save household settings</button> : <div className="adult-owner-note"><ShieldCheck size={19} /><span><strong>Managed by household admins</strong><small>You can view these settings, but only an owner or admin can change them.</small></span></div>}

        <button className="adult-hub-settings" onClick={() => navigate('/settings')}><UserRound size={19} /> Personal account settings <ChevronRight size={18} /></button>
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
  const signOut = async () => { await logout(); navigate('/login') }
  const saveProfile = (event) => {
    event.preventDefault()
    const cleanName = username.trim()
    if (!cleanName) return
    setProfile({ ...profile, username: cleanName })
    showToast('Profile updated.')
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-settings">
        <ScreenHeader title="Account settings" back="/menu" />
        <section className="adult-profile-card"><MemberAvatar name={username || profile.username} size="lg" online /><div><small>Your profile</small><h1>{username || profile.username}</h1><p>Personal account</p></div><UserRound size={18} /></section>
        <form className="adult-panel adult-profile-form" onSubmit={saveProfile}>
          <label className="field"><span>Display name</span><input value={username} onChange={(event) => setUsername(event.target.value)} maxLength="40" required /></label>
          <button className="primary-button"><Save size={18} /> Save profile</button>
        </form>
        <section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode on this device</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section>
        <button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button>
      </section>
    </AppShell>
  )
}
