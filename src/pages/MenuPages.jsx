import { useState } from 'react'
import { Home, KeyRound, Palette, Plus, Settings2, Sparkles, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import towerRaceArt from '../assets/game-art/screens/main-menu/main-menu-day.webp'
import { AppShell, PageIntro, ScreenHeader, ThemeToggle, UserGreeting } from '../components/AppShell.jsx'
import BrandLogo from '../components/BrandLogo.jsx'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

export function MainMenuPage() {
  const navigate = useNavigate()
  return (
    <AppShell className="menu-shell">
      <section className="mobile-screen main-menu-screen">
        <div className="menu-topbar">
          <BrandLogo compact />
          <ThemeToggle />
        </div>
        <UserGreeting onNotifications={() => navigate('/notifications')} />
        <div className="main-menu-cards">
          <button className="menu-card menu-card--peach" onClick={() => navigate('/house/new')}>
            <span className="menu-card__icon"><Home /></span>
            <span><strong>Add a house</strong><small>Create a new home and invite your people.</small></span>
            <Plus size={20} />
          </button>
          <button className="menu-card menu-card--rose" onClick={() => navigate('/house/join')}>
            <span className="menu-card__icon"><KeyRound /></span>
            <span><strong>Join a house</strong><small>Enter an invite code to join an existing home.</small></span>
            <Users size={20} />
          </button>
          <button className="menu-card menu-card--cream" onClick={() => navigate('/settings')}>
            <span className="menu-card__icon"><Palette /></span>
            <span><strong>Settings</strong><small>Shape your character and celebration.</small></span>
            <Settings2 size={20} />
          </button>
        </div>
        <div className="menu-art" style={{ backgroundImage: `url(${towerRaceArt})` }} aria-hidden="true" />
      </section>
    </AppShell>
  )
}

function HouseFormPage({ mode }) {
  const creating = mode === 'create'
  const navigate = useNavigate()
  const { createHouse, joinHouse } = useTaskTower()
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const house = creating ? await createHouse(value) : await joinHouse(value)
      navigate(`/house/${house.id}`)
    } catch (err) {
      setError(err.message || 'We could not open that house just yet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <section className="mobile-screen">
        <ScreenHeader title={creating ? 'Add a house' : 'Join a house'} back="/menu" />
        <div className={`house-form-hero ${creating ? 'house-form-hero--create' : 'house-form-hero--join'}`}>
          <div className="house-form-icon">{creating ? <Home size={42} /> : <KeyRound size={42} />}</div>
          <PageIntro
            eyebrow={creating ? 'A fresh start' : 'Come on in'}
            title={creating ? 'Name your cosy corner' : 'Enter your invite code'}
            text={creating ? 'You will become the owner and can invite housemates next.' : 'Invite codes are created by a household owner.'}
          />
        </div>
        <form className="form-stack house-form" onSubmit={submit}>
          <label className="field">
            <span>{creating ? 'House name' : 'Join code'}</span>
            <input
              value={value}
              onChange={(event) => setValue(creating ? event.target.value : event.target.value.toUpperCase())}
              placeholder={creating ? 'e.g. Sunshine Home' : 'e.g. SUNNY-12'}
              minLength={creating ? 2 : 4}
              required
            />
          </label>
          {error && <div className="inline-message inline-message--error">{error}</div>}
          <button className="primary-button" disabled={loading}>
            {loading ? 'Just a moment…' : creating ? 'Create house' : 'Join house'}
          </button>
        </form>
        <div className="friendly-tip"><Sparkles size={18} /><p>{creating ? 'A house invite code will be ready as soon as you create it.' : 'Codes ignore capital letters and spaces, so no need to wrestle with the keyboard.'}</p></div>
      </section>
    </AppShell>
  )
}

export const AddHousePage = () => <HouseFormPage mode="create" />
export const JoinHousePage = () => <HouseFormPage mode="join" />
