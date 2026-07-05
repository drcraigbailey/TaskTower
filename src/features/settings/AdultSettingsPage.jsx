import { Accessibility, Bell, ChevronRight, Download, Home, LogOut, MessageCircle, Moon, ShieldCheck, ShoppingBasket, SlidersHorizontal, UserRound, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MemberAvatar } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const rows = [
  [Home, 'Household details', 'Name, icon and invitation settings'],
  [Users, 'Members and permissions', 'Roles for up to 10 household members'],
  [SlidersHorizontal, 'Task defaults', 'Schedules, urgency and full-clean rules'],
  [ShoppingBasket, 'Shopping settings', 'Categories, assignments and favourites'],
  [MessageCircle, 'Messages and notices', 'Communication and acknowledgement rules'],
  [Bell, 'Notifications', 'Quiet hours and per-household alerts'],
  [Accessibility, 'Accessibility', 'Text size, motion and contrast'],
  [Download, 'Data and export', 'Activity export and account data'],
]

export default function AdultSettingsPage() {
  const navigate = useNavigate()
  const { activeHouse, profile, logout, theme, setTheme, showToast } = useTaskTower()
  if (!activeHouse) return null
  const signOut = async () => { await logout(); navigate('/login') }
  return (
    <AppShell>
      <section className="mobile-screen adult-settings with-bottom-space">
        <ScreenHeader title="Settings" subtitle={activeHouse.name} />
        <section className="adult-profile-card"><MemberAvatar name={profile.username} size="lg" online /><div><small>Your profile</small><h1>{profile.username}</h1><p>Owner · {activeHouse.name}</p></div><button onClick={() => navigate('/settings')}><UserRound size={18} /></button></section>
        <section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section>
        <div className="adult-settings-list">{rows.map(([Icon, title, text]) => <button key={title} onClick={() => showToast(`${title} settings will use the shared household permissions service.`)}><span><Icon size={20} /></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={18} /></button>)}</div>
        <div className="adult-owner-note"><ShieldCheck size={19} /><span><strong>Household owner</strong><small>You can manage roles, permissions and ownership transfer.</small></span></div>
        <button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button>
        <BottomNav />
      </section>
    </AppShell>
  )
}

export function AdultProfileSettingsPage() {
  const navigate = useNavigate()
  const { profile, logout, theme, setTheme, showToast } = useTaskTower()
  const signOut = async () => { await logout(); navigate('/login') }
  return <AppShell><section className="mobile-screen adult-settings"><ScreenHeader title="Account settings" back="/menu" /><section className="adult-profile-card"><MemberAvatar name={profile.username} size="lg" online /><div><small>Your profile</small><h1>{profile.username}</h1><p>Personal account</p></div><button onClick={() => showToast('Profile editing is ready for the existing profile service.')}><UserRound size={18} /></button></section><section className="adult-panel settings-preference"><div><span className="settings-icon"><Moon size={19} /></span><span><strong>Appearance</strong><small>Use dark mode</small></span></div><button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}><i /></button></section><div className="adult-settings-list"><button onClick={() => showToast('Notification preferences opened.')}><span><Bell size={20} /></span><div><strong>Notifications</strong><small>Push alerts and quiet hours</small></div><ChevronRight size={18} /></button><button onClick={() => showToast('Accessibility preferences opened.')}><span><Accessibility size={20} /></span><div><strong>Accessibility</strong><small>Text size, motion and contrast</small></div><ChevronRight size={18} /></button><button onClick={() => showToast('Data export opened.')}><span><Download size={20} /></span><div><strong>Privacy and data</strong><small>Export or delete account data</small></div><ChevronRight size={18} /></button></div><button className="danger-button" onClick={signOut}><LogOut size={18} /> Log out</button></section></AppShell>
}
