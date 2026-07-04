export default function Avatar({ avatar = {}, size = 'md', label, celebrating = false }) {
  const {
    skin = '#C98252',
    hair = '#4B2817',
    hairStyle = 'wave',
    outfit = '#7C5CFF',
    accessory = 'none',
  } = avatar

  return (
    <div className={`avatar avatar--${size} ${celebrating ? 'avatar--celebrating' : ''}`} aria-label={label || 'Character'}>
      <span className={`avatar-hair avatar-hair--${hairStyle}`} style={{ backgroundColor: hair }} />
      <span className="avatar-ear avatar-ear--left" style={{ backgroundColor: skin }} />
      <span className="avatar-ear avatar-ear--right" style={{ backgroundColor: skin }} />
      <span className="avatar-head" style={{ backgroundColor: skin }}>
        <span className="avatar-brow avatar-brow--left" />
        <span className="avatar-brow avatar-brow--right" />
        <span className="avatar-eye avatar-eye--left" />
        <span className="avatar-eye avatar-eye--right" />
        <span className="avatar-nose" />
        <span className="avatar-smile" />
        {accessory === 'glasses' && <span className="avatar-glasses">○—○</span>}
      </span>
      <span className="avatar-neck" style={{ backgroundColor: skin }} />
      <span className="avatar-body" style={{ backgroundColor: outfit }}>
        <span className="avatar-collar" />
      </span>
      <span className="avatar-arm avatar-arm--left" style={{ backgroundColor: outfit }} />
      <span className="avatar-arm avatar-arm--right" style={{ backgroundColor: outfit }} />
      {accessory === 'cap' && <span className="avatar-cap" style={{ backgroundColor: outfit }} />}
      {accessory === 'crown' && <span className="avatar-mini-crown">♛</span>}
      {celebrating && <span className="avatar-confetti">✦</span>}
    </div>
  )
}
