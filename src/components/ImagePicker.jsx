import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export default function ImagePicker({ label, value, fallback, file, onFileChange, onRemove, disabled = false, shape = 'round' }) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const image = preview || value

  return (
    <section className="image-picker">
      <div className={`image-picker__preview image-picker__preview--${shape}`}>
        {image ? <img src={image} alt="" /> : <span>{fallback}</span>}
        <i aria-hidden="true"><Camera size={17} /></i>
      </div>
      <div className="image-picker__copy">
        <strong>{label}</strong>
        <small>JPEG, PNG or WebP. Large photos are resized automatically.</small>
        <div className="image-picker__actions">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null
              if (nextFile) onFileChange(nextFile)
              event.target.value = ''
            }}
          />
          <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <ImagePlus size={17} /> {image ? 'Change picture' : 'Add picture'}
          </button>
          {image && <button type="button" className="image-picker__remove" onClick={onRemove} disabled={disabled} aria-label={`Remove ${label.toLowerCase()}`}><Trash2 size={17} /></button>}
        </div>
      </div>
    </section>
  )
}
