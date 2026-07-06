import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'
import { requireDatabase } from '../../lib/liveDataService.js'
import './household-invite-code.css'

export default function HouseholdInviteRepair() {
  const { activeHouse, setActiveHouse, setHouses, showToast } = useTaskTower()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const applyCode = (code) => {
    if (!code || !activeHouse?.id) return
    setActiveHouse((current) => current?.id === activeHouse.id ? { ...current, joinCode: code } : current)
    setHouses((current) => current.map((house) => house.id === activeHouse.id ? { ...house, joinCode: code } : house))
  }

  useEffect(() => {
    let cancelled = false
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
        if (!cancelled) applyCode(data)
      } catch (err) {
        if (!cancelled) setError(err.message || 'The invite code could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    ensureCode()
    return () => { cancelled = true }
  }, [activeHouse?.id, activeHouse?.role])

  if (!activeHouse || activeHouse.role !== 'owner') return null

  const rotateCode = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const db = requireDatabase()
      const { data, error: rpcError } = await db.rpc('ensure_household_invite_code', {
        p_household_id: activeHouse.id,
        p_rotate: true,
      })
      if (rpcError) throw rpcError
      applyCode(data)
      showToast('A new invite code is ready.')
    } catch (err) {
      setError(err.message || 'A new invite code could not be created.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="household-invite-control">
      <button type="button" className="invite-code-refresh" onClick={rotateCode} disabled={loading}>
        <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
        {loading ? 'Checking invite code…' : 'Create a new invite code'}
      </button>
      {error && <div className="inline-message inline-message--error">{error}</div>}
    </div>
  )
}
