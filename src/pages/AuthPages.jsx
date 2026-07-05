import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo.jsx'
import { AppShell, ThemeToggle } from '../components/AppShell.jsx'
import { useTaskTower } from '../context/TaskTowerContext.jsx'

function AuthLayout({ mode }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const { activeHouse, login, register, loading } = useTaskTower()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (isRegister && form.password !== form.confirm) {
      setError('Those passwords do not match yet.')
      return
    }
    const result = isRegister ? await register(form) : await login(form)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.needsConfirmation) {
      setNotice('Check your email to confirm your account, then come back and log in.')
      return
    }
    navigate(result.houseId ? `/house/${result.houseId}` : activeHouse ? `/house/${activeHouse.id}` : '/menu')
  }

  return (
    <AppShell className="auth-shell">
      <div className="auth-visual">
        <div className="auth-brand-panel">
          <BrandLogo light tagline />
          <h2>Everything at home, in one place.</h2>
          <p>Tasks, shopping, notices and messages for everyone you live with.</p>
          <ul><li><CheckCircle2 size={18} />Clear task priorities</li><li><CheckCircle2 size={18} />Shared updates in real time</li><li><ShieldCheck size={18} />Private to your household</li></ul>
        </div>
      </div>
      <section className="auth-panel">
        <div className="auth-panel__top">
          <BrandLogo compact tagline />
          <ThemeToggle />
        </div>
        <div className="auth-copy">
          <span className="eyebrow"><ShieldCheck size={14} /> {isRegister ? 'Create your account' : 'Welcome back'}</span>
          <h1>{isRegister ? 'Create your account' : 'Welcome back!'}</h1>
          <p>{isRegister ? 'Set up your profile, then create or join a household.' : 'Sign in to see what needs attention at home.'}</p>
        </div>

        <form className="form-stack" onSubmit={submit}>
          {isRegister && (
            <label className="field">
              <span>Username</span>
              <input name="username" value={form.username} onChange={update} placeholder="What should we call you?" required maxLength="40" />
            </label>
          )}
          <label className="field">
            <span>Email address</span>
            <div className="field-control">
              <Mail size={18} />
              <input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" required autoComplete="email" />
            </div>
          </label>
          <label className="field">
            <span>Password</span>
            <div className="field-control">
              <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} placeholder="At least 8 characters" minLength="8" required autoComplete={isRegister ? 'new-password' : 'current-password'} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {isRegister && (
            <label className="field">
              <span>Confirm password</span>
              <input name="confirm" type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={update} placeholder="One more time" required autoComplete="new-password" />
            </label>
          )}
          {error && <div className="inline-message inline-message--error">{error}</div>}
          {notice && <div className="inline-message inline-message--success"><CheckCircle2 size={17} />{notice}</div>}
          <button className="primary-button" disabled={loading || Boolean(notice)}>
            {loading ? 'Opening the door…' : isRegister ? 'Create account' : 'Log in'}
          </button>
        </form>

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
