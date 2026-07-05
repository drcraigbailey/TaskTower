import { Bell, CalendarDays, ChevronRight, ClipboardCheck, Crown, Flame, Medal, Settings, Sparkles, Trophy, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar.jsx'
import BottomNav from '../components/BottomNav.jsx'
import TowerScene from '../components/TowerScene.jsx'
import { AppShell, BackToMenuButton, ScreenHeader, ThemeToggle } from '../components/AppShell.jsx'
import winnerCelebration from '../assets/game-art/screens/states/winner-celebration.webp'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

export function HousePage() {
  const navigate = useNavigate()
  const { activeHouse, leaveHouse, notifications } = useTaskTower()
  const house = activeHouse

  if (!house) {
    return (
      <AppShell>
        <section className="mobile-screen empty-page">
          <div className="empty-illustration">🏠</div>
          <h1>This house has moved on</h1>
          <p>You may have been removed, or the house no longer exists. Nothing is broken—we’ll take you back safely.</p>
          <button className="primary-button" onClick={() => navigate('/menu')}>Return to main menu</button>
        </section>
      </AppShell>
    )
  }

  const exitHouse = () => {
    leaveHouse()
    navigate('/menu')
  }

  return (
    <AppShell>
      <section className="mobile-screen house-screen with-bottom-space">
        <ScreenHeader
          title={house.name}
          subtitle={`Monthly progress · ${house.resetIn} days left`}
          actions={<div className="header-actions"><button className="icon-button icon-button--soft" onClick={() => navigate('/notifications')}><Bell size={19} />{notifications.some((item) => item.unread) && <span className="notification-dot" />}</button><ThemeToggle /></div>}
        />
        <div className="house-stats">
          <div><Flame size={19} /><span><strong>{house.streak} days</strong><small>household streak</small></span></div>
          <div><CalendarDays size={19} /><span><strong>{house.resetIn} days</strong><small>until reset</small></span></div>
        </div>

        <button className="tower-snapshot" onClick={() => navigate(`/house/${house.id}/tower`)}>
          <div className="tower-snapshot__title">
            <div><span className="eyebrow">Household recognition</span><h2>Awards and badges</h2></div>
            <span className="round-arrow"><ChevronRight size={19} /></span>
          </div>
          <TowerScene members={house.members} height={house.towerHeight} compact />
          <div className="player-progress-row">
            {house.members.slice(0, 2).map((member, index) => (
              <div key={member.id}>
                <Avatar avatar={member.avatar} size="xs" />
                <span><strong>{member.username}</strong><small>{member.floors} of {house.towerHeight} badges</small></span>
                {index === 0 && <Crown className="leader-crown" size={18} />}
              </div>
            ))}
          </div>
        </button>

        <section className="house-members-section">
          <div className="section-heading"><div><span className="eyebrow">At home</span><h2>Household</h2></div><Users size={21} /></div>
          <div className="member-strip">
            {house.members.map((member) => (
              <div className="member-chip" key={member.id}>
                <Avatar avatar={member.avatar} size="xs" />
                <span><strong>{member.username}</strong><small>{member.points} pts</small></span>
              </div>
            ))}
          </div>
        </section>

        <div className="house-dock">
          <button className="dock-button dock-button--chores" onClick={() => navigate(`/house/${house.id}/chores`)}><ClipboardCheck size={21} /><span>Chores</span></button>
          <button className="dock-button" onClick={() => navigate(`/house/${house.id}/settings`)}><Settings size={21} /><span>Settings</span></button>
          <BackToMenuButton onClick={exitHouse} />
        </div>
      </section>
    </AppShell>
  )
}

export function TowerPage() {
  const navigate = useNavigate()
  const { activeHouse } = useTaskTower()
  const house = activeHouse
  if (!house) return null

  return (
    <AppShell>
      <section className="mobile-screen tower-page with-bottom-space">
        <ScreenHeader title="Awards" subtitle={`${house.towerHeight} badges available`} back={`/house/${house.id}`} actions={<button className="icon-button icon-button--soft" onClick={() => navigate(`/house/${house.id}/leaderboard`)}><Medal size={20} /></button>} />
        <div className="tower-race-label"><Sparkles size={17} /><span>You have earned <strong>{house.members[0].floors} badges</strong> this month.</span></div>
        <TowerScene members={house.members} height={house.towerHeight} zoomed />
        <div className="tower-player-cards">
          {house.members.slice(0, 2).map((member, index) => (
            <div className={index === 0 ? 'tower-player-card tower-player-card--purple' : 'tower-player-card tower-player-card--rose'} key={member.id}>
              <Avatar avatar={member.avatar} size="xs" />
              <span><small>{index === 0 ? 'You' : member.username}</small><strong>{member.floors} badges</strong></span>
            </div>
          ))}
        </div>
        <BottomNav />
      </section>
    </AppShell>
  )
}

export function LeaderboardPage() {
  const { activeHouse } = useTaskTower()
  const house = activeHouse
  if (!house) return null
  const members = [...house.members].sort((a, b) => b.floors - a.floors)

  return (
    <AppShell>
      <section className="mobile-screen leaderboard-screen">
        <ScreenHeader title="Awards board" subtitle="This month" back={`/house/${house.id}/tower`} />
        <div className="leader-card">
          <div className="confetti-field" aria-hidden="true">✦ · ✧ · ✦</div>
          <Crown size={38} fill="currentColor" />
          <Avatar avatar={members[0].avatar} size="lg" celebrating />
          <span>Most badges earned</span>
          <h2>{members[0].username}</h2>
          <strong>{members[0].floors} badges</strong>
        </div>
        <div className="rank-list">
          {members.map((member, index) => (
            <div className="rank-row" key={member.id}>
              <span className={`rank-number rank-number--${index + 1}`}>{index + 1}</span>
              <Avatar avatar={member.avatar} size="xs" />
              <span className="rank-name"><strong>{member.username}</strong><small>{member.points} points</small></span>
              <strong>{member.floors} badges</strong>
            </div>
          ))}
        </div>
        <section className="previous-winners">
          <div className="section-heading"><h2>Previous winners</h2><Trophy size={20} /></div>
          <div><span>June</span><strong>Alex · 20 badges</strong></div>
          <div><span>May</span><strong>You · 20 badges</strong></div>
        </section>
      </section>
    </AppShell>
  )
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { notifications, markNotificationsRead } = useTaskTower()
  return (
    <AppShell>
      <section className="mobile-screen notifications-screen">
        <ScreenHeader title="Notifications" back actions={<button className="text-button" onClick={markNotificationsRead}>Mark read</button>} />
        <div className="notification-list">
          {notifications.map((item) => (
            <article className={`notification-card ${item.unread ? 'notification-card--unread' : ''}`} key={item.id}>
              <span className={`notification-icon notification-icon--${item.type}`}>{item.type === 'success' ? <Medal size={20} /> : item.type === 'due' ? <ClipboardCheck size={20} /> : <Users size={20} />}</span>
              <div><strong>{item.title}</strong><p>{item.body}</p><small>{item.time} ago</small></div>
              {item.unread && <span className="unread-pip" />}
            </article>
          ))}
        </div>
        <button className="secondary-button" onClick={() => navigate(-1)}>All caught up</button>
      </section>
    </AppShell>
  )
}

export function WinnerPage() {
  const navigate = useNavigate()
  const { activeHouse } = useTaskTower()
  const winner = activeHouse?.members?.[0]
  if (!winner) return null
  return (
    <AppShell className="winner-shell">
      <section className="mobile-screen winner-screen">
        <img className="winner-art" src={winnerCelebration} alt="Household award winner holding a gold trophy" />
        <div className="winner-copy">
          <span className="eyebrow">Monthly champion</span>
          <h1>You earned the monthly award!</h1>
          <p>{winner.floors} badges, {winner.points} points, and a much happier home.</p>
          <div className="winner-trophy"><Trophy size={24} /><span>July winner</span></div>
          <button className="primary-button" onClick={() => navigate(`/house/${activeHouse.id}`)}>Celebrate at home</button>
        </div>
      </section>
    </AppShell>
  )
}
