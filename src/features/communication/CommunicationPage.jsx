import { BellRing, CheckCircle2, Plus, Send, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { MemberAvatar, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

const emptyNotice = { title: '', body: '', priority: 'normal', expiresInDays: '7' }

export default function CommunicationPage() {
  const { activeHouse, createNotice, deleteNotice, messages, notices, sendMessage, user } = useTaskTower()
  const [tab, setTab] = useState(new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') === 'notices' ? 'notices' : 'messages')
  const [text, setText] = useState('')
  const [noticeForm, setNoticeForm] = useState(emptyNotice)
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!activeHouse) return null

  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await sendMessage(text)
      setText('')
    } catch (err) {
      setError(err.message || 'The message could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const submitNotice = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createNotice(noticeForm)
      setNoticeForm(emptyNotice)
      setShowNoticeForm(false)
    } catch (err) {
      setError(err.message || 'The notice could not be posted.')
    } finally {
      setBusy(false)
    }
  }

  const removeNotice = async (id) => {
    setError('')
    try {
      await deleteNotice(id)
    } catch (err) {
      setError(err.message || 'The notice could not be removed.')
    }
  }

  const updateNoticeForm = (event) => setNoticeForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  return (
    <AppShell>
      <section className="mobile-screen adult-communication with-bottom-space">
        <ScreenHeader title="Household" subtitle={activeHouse.name} actions={<button className="add-button" onClick={() => { setTab('notices'); setShowNoticeForm((value) => !value) }} aria-label="Create notice">{showNoticeForm ? <X size={20} /> : <Plus size={20} />}</button>} />
        <div className="adult-tabs adult-tabs--two" role="tablist"><button className={tab === 'messages' ? 'active' : ''} onClick={() => setTab('messages')}>Messages<span>{messages.length}</span></button><button className={tab === 'notices' ? 'active' : ''} onClick={() => setTab('notices')}>Notices<span>{notices.length}</span></button></div>
        {error && <div className="inline-message inline-message--error">{error}</div>}
        {tab === 'notices' ? (
          <>
            {showNoticeForm && <form className="form-stack editor-form" onSubmit={submitNotice}>
              <label className="field"><span>Title</span><input name="title" value={noticeForm.title} onChange={updateNoticeForm} placeholder="Bin collection changed" required /></label>
              <label className="field"><span>Notice</span><textarea name="body" value={noticeForm.body} onChange={updateNoticeForm} rows="3" placeholder="Share the details with everyone…" required /></label>
              <div className="form-grid">
                <label className="field"><span>Priority</span><select name="priority" value={noticeForm.priority} onChange={updateNoticeForm}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
                <label className="field"><span>Expires after</span><select name="expiresInDays" value={noticeForm.expiresInDays} onChange={updateNoticeForm}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="">No expiry</option></select></label>
              </div>
              <button className="primary-button" disabled={busy}>{busy ? 'Posting…' : 'Post notice'}</button>
            </form>}
            <div className="notice-list">{notices.map((notice) => {
              const canDelete = notice.authorId === user.id || activeHouse.role === 'owner'
              return <article className={`adult-notice-card adult-notice-card--${notice.priority}`} key={notice.id}><span><BellRing size={19} /></span><div><div><StatusBadge status={notice.priority === 'urgent' ? 'overdue' : notice.priority === 'important' ? 'attention' : 'current'} label={notice.priority} /><small>{notice.expiresAt ? `Expires in ${notice.expires}` : 'No expiry'}</small></div><h2>{notice.title}</h2><p>{notice.body}</p><footer><MemberAvatar name={notice.author} size="sm" /><span>Posted by {notice.author}</span>{canDelete && <button onClick={() => removeNotice(notice.id)} aria-label="Delete notice"><Trash2 size={17} /></button>}</footer></div></article>
            })}</div>
            {notices.length === 0 && <div className="empty-list"><span>📌</span><h2>No notices</h2><p>Post an update when the household needs to know something.</p></div>}
          </>
        ) : (
          <div className="messages-layout">
            <div className="message-thread">{messages.map((message) => <article className={`message-row ${message.mine ? 'message-row--mine' : ''}`} key={message.id}>{!message.mine && <MemberAvatar name={message.author} size="sm" online />}<div><small>{message.author} · {message.time}</small><p>{message.body}</p>{message.mine && <span><CheckCircle2 size={12} /> Sent</span>}</div></article>)}</div>
            {messages.length === 0 && <div className="empty-list"><span>💬</span><h2>No messages yet</h2><p>Start the household conversation below.</p></div>}
            <div className="message-composer"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); send() } }} placeholder="Message the household" aria-label="Message the household" /><button onClick={send} disabled={busy || !text.trim()} aria-label="Send message"><Send size={18} /></button></div>
          </div>
        )}
        <BottomNav />
      </section>
    </AppShell>
  )
}
