import { BellRing, CheckCircle2, Plus, Send, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { MemberAvatar, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useAdultHousehold } from '../../context/AdultHouseholdContext.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const emptyNotice = { title: '', body: '', priority: 'normal', expiresAt: '', pinned: false }

export default function CommunicationPage() {
  const { activeHouse, user } = useTaskTower()
  const { messages, notices, householdSettings, canManageHousehold, dataLoading, sendMessage, deleteMessage, addNotice, acknowledgeNotice, deleteNotice } = useAdultHousehold()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'notices' ? 'notices' : 'messages'
  const [text, setText] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [noticeForm, setNoticeForm] = useState(emptyNotice)
  const [showNoticeForm, setShowNoticeForm] = useState(false)

  if (!activeHouse) return <Navigate to="/menu" replace />

  const canMessage = householdSettings.messaging_enabled && (canManageHousehold || householdSettings.permissions.members_message)
  const canPostNotice = householdSettings.notices_enabled && (canManageHousehold || householdSettings.permissions.members_post_notices)
  const directMessagingAvailable = householdSettings.direct_messages_enabled
  const otherMembers = activeHouse.members.filter((member) => member.id !== user?.id)
  const selectedRecipient = otherMembers.find((member) => member.id === recipientId)
  const changeTab = (nextTab) => setSearchParams(nextTab === 'notices' ? { tab: 'notices' } : {})

  const send = async () => {
    if (!canMessage || !text.trim()) return
    const targetRecipientId = directMessagingAvailable ? recipientId || null : null
    const sent = await sendMessage(text, targetRecipientId)
    if (sent) setText('')
  }

  const updateNotice = (event) => {
    const { name, value, checked, type } = event.target
    setNoticeForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const postNotice = async (event) => {
    event.preventDefault()
    if (!canPostNotice) return
    const saved = await addNotice(noticeForm)
    if (!saved) return
    setNoticeForm(emptyNotice)
    setShowNoticeForm(false)
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-communication with-bottom-space">
        <ScreenHeader title="Household" subtitle={activeHouse.name} actions={tab === 'notices' && canPostNotice ? <button className="add-button" onClick={() => setShowNoticeForm((current) => !current)} aria-label="Create notice">{showNoticeForm ? <X size={20} /> : <Plus size={20} />}</button> : null} />
        <div className="adult-tabs adult-tabs--two" role="tablist"><button className={tab === 'messages' ? 'active' : ''} onClick={() => changeTab('messages')}>Messages<span>{messages.length}</span></button><button className={tab === 'notices' ? 'active' : ''} onClick={() => changeTab('notices')}>Notices<span>{notices.length}</span></button></div>

        {tab === 'notices' ? (
          <>
            {showNoticeForm && canPostNotice && (
              <form className="adult-inline-form" onSubmit={postNotice}>
                <div className="adult-inline-form__header"><div><small>Household notice</small><h2>Share an update</h2></div><button type="button" className="icon-button icon-button--soft" onClick={() => setShowNoticeForm(false)} aria-label="Close notice form"><X size={18} /></button></div>
                <label className="field"><span>Title</span><input name="title" value={noticeForm.title} onChange={updateNotice} placeholder="Plumber visiting Tuesday" required maxLength="120" /></label>
                <label className="field"><span>Details</span><textarea name="body" value={noticeForm.body} onChange={updateNotice} placeholder="Add the useful details" rows="3" maxLength="2000" /></label>
                <div className="form-grid">
                  <label className="field"><span>Priority</span><select name="priority" value={noticeForm.priority} onChange={updateNotice}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
                  <label className="field"><span>Expires</span><input type="date" name="expiresAt" value={noticeForm.expiresAt} onChange={updateNotice} /></label>
                </div>
                <label className="adult-check-row"><input type="checkbox" name="pinned" checked={noticeForm.pinned} onChange={updateNotice} /><span><strong>Pin this notice</strong><small>Keep it at the top of the household board.</small></span></label>
                <button className="primary-button"><BellRing size={18} /> Post notice</button>
              </form>
            )}
            {!householdSettings.notices_enabled ? <div className="adult-disabled-note">Notices are disabled in household settings.</div> : dataLoading ? <p className="adult-loading-copy">Updating notices…</p> : (
              <div className="notice-list">{notices.length ? notices.map((notice) => <article className={`adult-notice-card adult-notice-card--${notice.priority}`} key={notice.id}><span><BellRing size={19} /></span><div><div><StatusBadge status={notice.priority === 'urgent' ? 'overdue' : notice.priority === 'important' ? 'attention' : 'current'} label={notice.priority} /><small>{notice.expires === 'No expiry' ? notice.createdLabel : `Expires in ${notice.expires}`}</small></div><h2>{notice.title}</h2><p>{notice.body || 'No extra details.'}</p><footer><MemberAvatar name={notice.author} size="sm" /><span>Posted by {notice.author}</span><div className="notice-actions">{!notice.acknowledged && <button className="notice-ack-button" onClick={() => acknowledgeNotice(notice.id)}><CheckCircle2 size={15} /> Acknowledge</button>}{notice.author === 'You' && <button className="row-delete-button" onClick={() => deleteNotice(notice.id)} aria-label={`Remove ${notice.title}`}><Trash2 size={16} /></button>}</div></footer></div></article>) : <div className="adult-empty-copy"><BellRing size={25} /><h2>No notices yet</h2><p>Important household updates will appear here.</p></div>}</div>
            )}
            {householdSettings.notices_enabled && !canPostNotice && <div className="adult-disabled-note">You can read and acknowledge notices, but your household role cannot post them.</div>}
          </>
        ) : (
          <div className="messages-layout">
            {!householdSettings.messaging_enabled ? <div className="adult-disabled-note">Household messaging is disabled in settings.</div> : <>
              <div className="message-thread">{dataLoading ? <p className="adult-loading-copy">Updating messages…</p> : messages.length ? messages.map((message) => <article className={`message-row ${message.mine ? 'message-row--mine' : ''}`} key={message.id}>{!message.mine && <MemberAvatar name={message.author} size="sm" online />}<div><small>{message.author} · {message.recipient_id ? 'Direct' : 'Household'} · {message.time}</small><p>{message.body}</p>{message.mine && <span><CheckCircle2 size={12} /> Sent <button className="message-remove-button" onClick={() => deleteMessage(message.id)} aria-label="Remove message"><Trash2 size={13} /></button></span>}</div></article>) : <div className="adult-empty-copy"><Send size={25} /><h2>Start the conversation</h2><p>Messages sent here are shared with the household unless you choose a person directly.</p></div>}</div>
              {canMessage ? <>
                {directMessagingAvailable && otherMembers.length > 0 && <label className="field message-target"><span>Send to</span><select value={recipientId} onChange={(event) => setRecipientId(event.target.value)}><option value="">Everyone in the household</option>{otherMembers.map((member) => <option value={member.id} key={member.id}>{member.username}</option>)}</select></label>}
                <div className="message-composer"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} placeholder={selectedRecipient ? `Message ${selectedRecipient.username}` : 'Message the household'} aria-label={selectedRecipient ? `Message ${selectedRecipient.username}` : 'Message the household'} maxLength="4000" /><button onClick={send} disabled={!text.trim()} aria-label="Send message"><Send size={18} /></button></div>
              </> : <div className="adult-disabled-note">You can read messages, but your household role cannot send them.</div>}
            </>}
          </div>
        )}
        <BottomNav />
      </section>
    </AppShell>
  )
}
