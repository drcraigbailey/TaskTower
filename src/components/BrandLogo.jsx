import dwellioLogo from '../assets/branding/dwellio/logo.png'

export default function BrandLogo({ compact = false, light = false, tagline = false }) {
  return (
    <div className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${light ? 'brand-logo--light' : ''}`}>
      <img className="brand-logo__image" src={dwellioLogo} alt="Dwellio" />
      {tagline && <span className="brand-logo__tagline">Your home, organised.</span>}
    </div>
  )
}
