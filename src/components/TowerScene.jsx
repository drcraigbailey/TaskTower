import towerRaceArt from '../assets/game-art/screens/tower/tower-day.webp'

export default function TowerScene({ members = [], height = 20, compact = false, zoomed = false }) {
  const visibleMembers = members.slice(0, 2)

  return (
    <div className={`illustrated-tower ${compact ? 'illustrated-tower--compact' : ''} ${zoomed ? 'illustrated-tower--zoomed' : ''}`}>
      <img src={towerRaceArt} alt="Household awards and badges display" />
      <div className="illustrated-tower__shade" aria-hidden="true" />
      {visibleMembers.map((member, index) => {
        const progress = Math.max(8, Math.min(92, (member.floors / Math.max(height, 1)) * 100))
        return (
          <div
            className={`illustrated-tower__score illustrated-tower__score--${index === 0 ? 'left' : 'right'}`}
            style={{ '--floor-progress': `${progress}%` }}
            key={member.id}
          >
            <small>{index === 0 ? 'You' : member.username}</small>
            <strong>{member.floors}</strong>
            <span>badges</span>
          </div>
        )
      })}
    </div>
  )
}
