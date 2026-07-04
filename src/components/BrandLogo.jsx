export default function BrandLogo({ compact = false, light = false }) {
  return (
    <div className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${light ? 'brand-logo--light' : ''}`}>
      <span className="brand-crown" aria-hidden="true">♛</span>
      <span className="brand-word brand-word--task">TASK</span>
      <span className="brand-word brand-word--tower">TOWER</span>
    </div>
  )
}
