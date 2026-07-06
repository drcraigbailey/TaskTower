import { ArrowLeft, Bell, ChevronLeft, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTaskTower } from '../context/TaskTowerContext.jsx'
import { MemberAvatar } from './adult/AdultUi.jsx'

export function AppShell({ children, className = '' }) {
  const { toast } = useTaskTower()
  return (
    <main className={`app-shell ${className}`}>
      <div className="app-canvas">{children}</div>
      {toast && <div className={`toast toast--${toast.tone}`}>{toast.message}</div>}
    </main>
  )
}

export function ScreenHeader({ title, subtitle, back, actions, transparent = false }) {
  const navigate = useNavigate()
  return (
    <header className={`screen-header ${transparent ? 'screen-header--transparent' : ''}`}>
      <div className="screen-header__side">
        {back && (
          <button className="icon-button" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))} aria-label="Go back">
            <ChevronLeft size={22} />
          </button>
        )}
      </div>
      <div className="screen-header__title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="screen-header__side screen-header__side--end">{actions}</div>
    </header>
  )
}

export function UserGreeting({ onNotifications }) {
  const { profile, notifications } = useTaskTower()
  const unread = notifications.filter((item) => item.unread).length
  return (
    <div className="user-greeting">
      <MemberAvatar name={profile.username} image={profile.picture} online />
      <div>
        <strong>Hi {profile.username}! <span aria-hidden="true">👋</span></strong>
        <p>What would you like to do?</p>
      </div>
      <button className="icon-button icon-button--soft" onClick={onNotifications} aria-label="Notifications">
        <Bell size={20} />
        {unread > 0 && <span className="notification-dot">{unread}</span>}
      </button>
    </div>
  )
}

export function ThemeToggle() {
  const { theme, setTheme } = useTaskTower()
  return (
    <button
      className="icon-button icon-button--soft"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  )
}

export function PageIntro({ eyebrow, title, text }) {
  return (
    <section className="page-intro">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </section>
  )
}

export function BackToMenuButton({ onClick }) {
  return (
    <button className="dock-button" onClick={onClick}>
      <ArrowLeft size={21} />
      <span>Back</span>
    </button>
  )
}
