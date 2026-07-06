import { Trash2, UserMinus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MemberAvatar } from '../../components/adult/AdultUi.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'
import { deleteHouseholdRecord, removeHouseholdMemberRecord } from '../../lib/liveMutations.js'
import './household-owner-controls.css'

export default function HouseholdOwnerControls() {
  const navigate = useNavigate()
  const {
    activeHouse,
    refreshActiveHouse,
    refreshHouses,
    showToast,
    user,
  } = useTaskTower()
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [removingMemberId, setRemovingMemberId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const removableMembers = useMemo(
    () => (activeHouse?.members || []).filter((member) => member.role !== 'owner'),
    [activeHouse?.members],
  )

  if (!activeHouse || activeHouse.role !== 'owner') return null

  const removeMember = async () => {
    if (!memberToRemove) return
    setRemovingMemberId(memberToRemove.id)
    setError('')

    try {
      await removeHouseholdMemberRecord(activeHouse.id, memberToRemove.id)
      await refreshActiveHouse()
      showToast(`${memberToRemove.username} was removed from ${activeHouse.name}.`, 'neutral')
      setMemberToRemove(null)
    } catch (err) {
      setError(err.message || 'That member could not be removed.')
    } finally {
      setRemovingMemberId(null)
    }
  }

  const deleteHousehold = async () => {
    setDeleting(true)
    setError('')

    try {
      const deletedName = activeHouse.name
      await deleteHouseholdRecord(activeHouse.id)
      await refreshHouses(user)
      setConfirmDelete(false)
      showToast(`${deletedName} was permanently deleted.`, 'neutral')
      navigate('/menu', { replace: true })
    } catch (err) {
      setError(err.message || 'The household could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <section className="adult-panel household-management-panel">
        <div className="activity-title"><Users size={20} /><h2>Manage members</h2></div>
        <p className="household-management-copy">Removed members immediately lose access. Their previous task activity remains in the household history.</p>
        {removableMembers.length ? (
          <div className="household-member-management-list">
            {removableMembers.map((member) => (
              <div className="household-member-management-row" key={member.id}>
                <MemberAvatar name={member.username} image={member.profileImage} online />
                <span>
                  <strong>{member.username}</strong>
                  <small>{member.role || 'member'}</small>
                </span>
                <button
                  type="button"
                  className="member-remove-button"
                  onClick={() => setMemberToRemove(member)}
                  disabled={Boolean(removingMemberId)}
                  aria-label={`Remove ${member.username} from household`}
                >
                  <UserMinus size={17} />
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="household-management-empty">There are no other members to remove.</p>
        )}
      </section>

      <section className="adult-panel household-danger-zone">
        <div className="activity-title"><Trash2 size={20} /><h2>Delete household</h2></div>
        <p>Permanently deletes the household and removes access for every member. This cannot be undone.</p>
        {error && <div className="inline-message inline-message--error">{error}</div>}
        <button type="button" className="danger-button" onClick={() => setConfirmDelete(true)} disabled={deleting}>
          <Trash2 size={18} /> Delete household
        </button>
      </section>

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        title={`Remove ${memberToRemove?.username || 'this member'}?`}
        message={`They will immediately lose access to ${activeHouse.name}. Their previous completed-task history will remain.`}
        confirmLabel="Remove member"
        busy={Boolean(removingMemberId)}
        onConfirm={removeMember}
        onCancel={() => !removingMemberId && setMemberToRemove(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${activeHouse.name}?`}
        message="This permanently deletes the household, its tasks, messages, notices, shopping list and progress for everyone. This action cannot be undone."
        confirmLabel="Delete permanently"
        busy={deleting}
        onConfirm={deleteHousehold}
        onCancel={() => !deleting && setConfirmDelete(false)}
      />
    </>
  )
}
