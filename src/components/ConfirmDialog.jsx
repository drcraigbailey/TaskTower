import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => confirmRef.current?.focus())
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [busy, onCancel, open])

  if (!open) return null

  return createPortal(
    <div className="app-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section className="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message">
        <button className="app-dialog__close" type="button" onClick={onCancel} disabled={busy} aria-label="Close confirmation"><X size={19} /></button>
        <span className="app-dialog__icon"><AlertTriangle size={23} /></span>
        <h2 id="app-dialog-title">{title}</h2>
        <p id="app-dialog-message">{message}</p>
        <div className="app-dialog__actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={busy} ref={confirmRef}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
