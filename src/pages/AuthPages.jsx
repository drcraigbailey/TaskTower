import { useState } from 'react'
import { Eye, EyeOff, Mail, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import splashArt from '../assets/game-art/screens/main-menu/main-menu-day.webp'
import BrandLogo from '../components/BrandLogo.jsx'
import { AppShell, ThemeToggle } from '../components/AppShell.jsx'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

function AuthLayout({ mode }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const { login, register, loading, isSupabaseConfigured } = useTaskTower()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (isRegister && form.password !== form.confirm) {
      setError('Those passwords do not match yet.')
      return
    }
    const result = isRegister ? await register(form) : await login(form)
    if (result.ok) navigate('/menu')
    else setError(result.error)
  }

  return (
    <AppShell className="auth-shell">
      <div className="auth-visual" style={{ backgroundImage: `url(${splashArt})` }}>
        <div className="auth-brand-panel">
          <BrandLogo light />
          <h2>Do chores. Climb together.</h2>
          <p>A friendly little race to make home life lighter.</p>
        </div>
      </div>
      <section className="auth-panel">
        <div className="auth-panel__top">
          <BrandLogo compact />
          <ThemeToggle />
        </div>
        <div className="auth-copy">
          <span className="eyebrow"><Sparkles size={14} /> {isRegister ? 'Your tower awaits' : 'Welcome home'}</span>
          <h1>{isRegister ? 'Create your account' : 'Welcome back!'}</h1>
          <p>{isRegister ? "Let's get your first home ready." : "Let's keep the tower climbing."}</p>
        </div>

        <form className="form-stack" onSubmit={submit}>
          {isRegister && (
            <label className="field">
              <span>Username</span>
              <input name="username" value={form.username} onChange={update} placeholder="What should we call you?" required />
            </label>
          )}
          <label className="field">
            <span>Email address</span>
            <div className="field-control">
              <Mail size={18} />
              <input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" required />
            </div>
          </label>
          <label className="field">
            <span>Password</span>
            <div className="field-control">
              <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} placeholder="At least 8 characters" minLength="8" required />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Show password">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {isRegister && (
            <label className="field">
              <span>Confirm password</span>
              <input name="confirm" type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={update} placeholder="One more time" required />
            </label>
          )}
          {error && <div className="inline-message inline-message--error">{error}</div>}
          <button className="primary-button" disabled={loading}>
            {loading ? 'Opening the door…' : isRegister ? 'Create account' : 'Log in'}
          </button>
        </form>

        {!isSupabaseConfigured && (
          <div className="demo-note">
            <span>Demo mode</span>
            <p>Use any email and an 8-character password. Add Supabase keys later for live accounts.</p>
          </div>
        )}

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Register'}</Link>
        </p>
      </section>
    </AppShell>
  )
}

export const LoginPage = () => <AuthLayout mode="login" />
export const RegisterPage = () => <AuthLayout mode="register" />
