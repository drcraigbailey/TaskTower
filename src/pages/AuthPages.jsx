import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo.jsx'
import { AppShell, ThemeToggle } from '../components/AppShell.jsx'
import { useTaskTower } from '../context/TaskTowerContext.jsx'
import './AuthPages.css'

function AuthLayout({ mode }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const { login, register, resendConfirmation, loading, isSupabaseConfigured } = useTaskTower()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!isSupabaseConfigured) {
      setError('This build is not connected to Supabase. Add the live environment values and rebuild the app.')
      return
    }
    if (isRegister && form.password !== form.confirm) {
      setError('Those passwords do not match yet.')
      return
    }
    const result = isRegister ? await register(form) : await login(form)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.needsEmailConfirmation) {
      setConfirmationEmail(form.email)
      setMessage('Account created. Open the verification email on this device; the confirmation link will return you to Dwellio.')
      return
    }
    navigate(result.houseId ? `/house/${result.houseId}` : '/menu')
  }

  const resendEmail = async () => {
    if (!confirmationEmail || resending) return
    setError('')
    setResending(true)
    const result = await resendConfirmation(confirmationEmail)
    setResending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMessage('A fresh verification email has been sent. Use the newest link.')
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
              <input name="username" value={form.username} onChange={update} placeholder="What should we call you?" required />
            </label>
          )}
          <label className="field">
            <span>Email address</span>
            <div className="field-control auth-input-control">
              <Mail size={20} aria-hidden="true" />
              <input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" autoComplete="email" required />
            </div>
          </label>
          <label className="field">
            <span>Password</span>
            <div className="field-control auth-input-control">
              <LockKeyhole size={20} aria-hidden="true" />
              <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} placeholder="At least 8 characters" minLength="8" autoComplete={isRegister ? 'new-password' : 'current-password'} required />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>
          {isRegister && (
            <label className="field">
              <span>Confirm password</span>
              <div className="field-control auth-input-control">
                <LockKeyhole size={20} aria-hidden="true" />
                <input name="confirm" type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={update} placeholder="One more time" autoComplete="new-password" required />
              </div>
            </label>
          )}
          {!isSupabaseConfigured && <div className="inline-message inline-message--error">Live accounts are unavailable because this build has no Supabase environment values.</div>}
          {error && <div className="inline-message inline-message--error">{error}</div>}
          {message && <div className="inline-message inline-message--success auth-confirmation-message"><span>{message}</span>{confirmationEmail && <button type="button" onClick={resendEmail} disabled={resending}>{resending ? 'Sending…' : 'Resend verification email'}</button>}</div>}
          <button className="primary-button" disabled={loading || !isSupabaseConfigured}>
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
