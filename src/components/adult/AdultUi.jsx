import { AlertCircle, CheckCircle2, Clock3, PauseCircle } from 'lucide-react'

const statusConfig = {
  overdue: { label: 'Overdue', icon: AlertCircle, tone: 'red' },
  attention: { label: 'Due soon', icon: Clock3, tone: 'amber' },
  current: { label: 'Up to date', icon: CheckCircle2, tone: 'green' },
  paused: { label: 'Paused', icon: PauseCircle, tone: 'grey' },
}

export function StatusBadge({ status = 'current', label }) {
  const config = statusConfig[status] || statusConfig.current
  const Icon = config.icon
  return <span className={`adult-status adult-status--${config.tone}`} aria-label={label || config.label}><Icon size={13} />{label || config.label}</span>
}

export function MemberAvatar({ name, image, size = 'md', online = false }) {
  const initials = String(name || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className={`adult-avatar adult-avatar--${size}`} aria-label={name}>
      {image ? <img src={image} alt="" /> : initials}
      {online && <i aria-label="Recently active" />}
    </span>
  )
}

export function AdultSectionHeader({ eyebrow, title, action }) {
  return <div className="adult-section-heading"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return <div className="adult-empty"><span><Icon size={26} /></span><h2>{title}</h2><p>{text}</p>{action}</div>
}
