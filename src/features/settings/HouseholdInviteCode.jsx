import { Copy, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'
import { requireDatabase } from '../../lib/liveDataService.js'
import './household-invite-code.css'

export default function HouseholdInviteCode() {
  const { activeHouse, showToast } = useTaskTower()
  const [code, setCode] = useState(activeHouse?.joinCode || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setCode(activeHouse?.joinCode || '')
    setError('')

    if (!activeHouse?.id || activeHouse.role !== 'owner') return undefined

    const ensureCode = async () => {
      setLoading(true)
      try {
        const db = requireDatabase()
        const { data, error: rpcError } = await db.rpc('ensure_household_invite_code', {
          p_household_id: activeHouse.id,
          p_rotate: false,
        })
        if (rpcError) throw rpcError
        if (!cancelled) setCode(data || '')
      } catch (err) {
        if (!cancelled) setError(err.message || 'The invite code could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    ensureCode()
    return () => { cancelled = true }
  }, [activeHouse?.id, activeHouse?.joinCode, activeHouse?.role])

  if (!activeHouse) return null
  if (!code && activeHouse.role !== 'owner') return null

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      showToast('Invite code copied.')
    } catch {
      showToast(`Invite code: ${code}`, 'neutral')
    }
  }

  const rotateCode = async () => {
    if (loading || activeHouse.role !== 'owner') return
    setLoading(true)
    setError('')

    try {
      const db = requireDatabase()
      const { data, error: rpcError } = await db.rpc('ensure_household_invite_code', {
        p_household_id: activeHouse.id,
        p_rotate: true,
      })
      if (rpcError) throw rpcError
      setCode(data || '')
      showToast('A new invite code is ready.')
    } catch (err) {
      setError(err.message || 'A new invite code could not be created.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="household-invite-control">
      <label className="field">
        <span>Invite code</span>
        <div className="field-control">
          <input value={loading && !code ? 'Loading…' : code} readOnly />
          <button type="button" onClick={copyCode} disabled={!code || loading} aria-label="Copy invite code">
            <Copy size={18} />
          </button>
        </div>
      </label>
      {activeHouse.role === 'owner' && (
        <button type="button" className="invite-code-refresh" onClick={rotateCode} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
          {loading ? 'Checking code…' : 'Create a new invite code'}
        </button>
      )}
      {error && <div className="inline-message inline-message--error">{error}</div>}
    </div>
  )
}
