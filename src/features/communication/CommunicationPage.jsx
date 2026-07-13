import { ArrowLeft, BellRing, CheckCircle2, Inbox, MessageCircle, Plus, Send, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MemberAvatar, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'
import { useNativeBackAction } from '../../lib/nativeBack.js'
import './CommunicationPage.css'

const HOUSEHOLD_THREAD = 'household'
const emptyNotice = { title: '', body: '', priority: 'normal', expiresInDays: '7' }

export default function CommunicationPage() {
  const {
    activeHouse,
    createNotice,
    dataLoading,
    deleteNotice,
    hideHouseholdChatThread,
    hideMessageThread,
    householdThread,
    markHouseholdChatRead,
    markMessageThreadRead,
    messageThreads,
    messages,
    notices,
    refreshActiveHouse,
    sendMessage,
    showToast,
    user,
  } = useTaskTower()
  const query = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const initialThread = query.get('thread')
  const [tab, setTab] = useState(query.get('tab') === 'notices' ? 'notices' : 'messages')
  const [selectedThread, setSelectedThread] = useState(initialThread)
  const [text, setText] = useState('')
  const [recipientId, setRecipientId] = useState('household')
  const [noticeForm, setNoticeForm] = useState(emptyNotice)
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingNoticeRemoval, setPendingNoticeRemoval] = useState(null)
  const [pendingThreadRemoval, setPendingThreadRemoval] = useState(null)
  const markHouseholdChatReadRef = useRef(markHouseholdChatRead)
  const markMessageThreadReadRef = useRef(markMessageThreadRead)
  const refreshActiveHouseRef = useRef(refreshActiveHouse)

  const recipientOptions = activeHouse?.members.filter((member) => member.id !== user?.id) || []
  const memberById = Object.fromEntries(recipientOptions.map((member) => [member.id, member]))
  const householdMessages = messages.filter((message) => !message.direct)
  const visibleHouseholdThread = householdThread?.visible !== false
  const latestHouseholdMessage = householdMessages.at(-1)
  const selectedMember = selectedThread && selectedThread !== HOUSEHOLD_THREAD ? memberById[selectedThread] : null
  const selectedRecipient = recipientOptions.find((member) => member.id === recipientId)
  const threadCount = messageThreads.length + (visibleHouseholdThread ? 1 : 0)
  const messagePlaceholder = selectedThread
    ? selectedThread === HOUSEHOLD_THREAD
      ? 'Message the household'
      : `Message ${selectedMember?.username || 'this member'}`
    : selectedRecipient
      ? `Message ${selectedRecipient.username}`
    : 'Message the household'

  useNativeBackAction(() => {
    if (!selectedThread) return false
    setSelectedThread(null)
    return true
  }, Boolean(selectedThread), 20)

  useNativeBackAction(() => {
    if (!showNoticeForm) return false
    if (!busy) setShowNoticeForm(false)
    return true
  }, showNoticeForm, 20)

  const visibleMessages = useMemo(() => {
    if (!selectedThread) return []
    if (selectedThread === HOUSEHOLD_THREAD) return householdMessages
    return messages.filter((message) => (
      message.direct
      && (
        (message.authorId === user.id && message.recipientId === selectedThread)
        || (message.authorId === selectedThread && message.recipientId === user.id)
      )
    ))
  }, [householdMessages, messages, selectedThread, user?.id])

  useEffect(() => {
    markHouseholdChatReadRef.current = markHouseholdChatRead
    markMessageThreadReadRef.current = markMessageThreadRead
    refreshActiveHouseRef.current = refreshActiveHouse
  })

  useEffect(() => {
    if (selectedThread !== HOUSEHOLD_THREAD) return undefined
    let cancelled = false
    markHouseholdChatReadRef.current?.()
      .then(() => {
        if (!cancelled) return refreshActiveHouseRef.current?.()
        return null
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'The household chat could not be marked as read.')
      })
    return () => { cancelled = true }
  }, [selectedThread])

  useEffect(() => {
    if (!selectedThread || selectedThread === HOUSEHOLD_THREAD) return undefined
    let cancelled = false
    markMessageThreadReadRef.current(selectedThread)
      .then(() => {
        if (!cancelled) return refreshActiveHouseRef.current?.()
        return null
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'The conversation could not be marked as read.')
      })
    return () => { cancelled = true }
  }, [selectedThread])

  if (!activeHouse) return null

  const openThread = (threadId) => {
    setError('')
    setSelectedThread(threadId)
    setRecipientId(threadId === HOUSEHOLD_THREAD ? 'household' : threadId)
  }

  const send = async () => {
    if (!text.trim() || busy) return
    const target = selectedThread
      ? selectedThread === HOUSEHOLD_THREAD ? null : selectedThread
      : recipientId === 'household' ? null : recipientId
    setBusy(true)
    setError('')
    try {
      await sendMessage(text, target)
      setText('')
      if (!selectedThread) openThread(target || HOUSEHOLD_THREAD)
      await refreshActiveHouse?.()
    } catch (err) {
      setError(err.message || 'The message could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const removeThread = async () => {
    if (!pendingThreadRemoval) return
    setBusy(true)
    setError('')
    try {
      if (pendingThreadRemoval.id === HOUSEHOLD_THREAD) {
        await hideHouseholdChatThread()
      } else {
        await hideMessageThread(pendingThreadRemoval.id)
      }
      setPendingThreadRemoval(null)
      if (selectedThread === pendingThreadRemoval.id) setSelectedThread(null)
      await refreshActiveHouse?.()
      showToast?.(`${pendingThreadRemoval.id === HOUSEHOLD_THREAD ? 'Household chat' : 'Conversation'} removed from your inbox.`, 'neutral')
    } catch (err) {
      setError(err.message || 'The conversation could not be removed.')
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

  const removeNotice = async () => {
    if (!pendingNoticeRemoval) return
    setBusy(true)
    setError('')
    try {
      await deleteNotice(pendingNoticeRemoval.id)
      setPendingNoticeRemoval(null)
    } catch (err) {
      setError(err.message || 'The notice could not be removed.')
    } finally {
      setBusy(false)
    }
  }

  const updateNoticeForm = (event) => setNoticeForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  return (
    <AppShell>
      <section className="mobile-screen adult-communication with-bottom-space">
        <ScreenHeader
          title="Household"
          subtitle={activeHouse.name}
          actions={<button className="add-button" onClick={() => { setTab('notices'); setShowNoticeForm((value) => !value) }} aria-label="Create notice">{showNoticeForm ? <X size={20} /> : <Plus size={20} />}</button>}
        />
        <div className="adult-tabs adult-tabs--two" role="tablist">
          <button className={tab === 'messages' ? 'active' : ''} onClick={() => { setTab('messages'); setSelectedThread(null) }}>Messages<span>{threadCount}</span></button>
          <button className={tab === 'notices' ? 'active' : ''} onClick={() => setTab('notices')}>Notices<span>{notices.length}</span></button>
        </div>
        {error && <div className="inline-message inline-message--error">{error}</div>}
        {tab === 'notices' ? (
          <div className="communication-scroll-area">
            {showNoticeForm && (
              <form className="form-stack editor-form" onSubmit={submitNotice}>
                <label className="field"><span>Title</span><input name="title" value={noticeForm.title} onChange={updateNoticeForm} placeholder="Bin collection changed" required /></label>
                <label className="field"><span>Notice</span><textarea name="body" value={noticeForm.body} onChange={updateNoticeForm} rows="3" placeholder="Share the details with everyone..." required /></label>
                <div className="form-grid">
                  <label className="field"><span>Priority</span><select name="priority" value={noticeForm.priority} onChange={updateNoticeForm}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
                  <label className="field"><span>Expires after</span><select name="expiresInDays" value={noticeForm.expiresInDays} onChange={updateNoticeForm}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="">No expiry</option></select></label>
                </div>
                <button className="primary-button" disabled={busy}>{busy ? 'Posting...' : 'Post notice'}</button>
              </form>
            )}
            <div className="notice-list">
              {notices.map((notice) => {
                const canDelete = notice.authorId === user.id || activeHouse.role === 'owner'
                return (
                  <article className={`adult-notice-card adult-notice-card--${notice.priority}`} key={notice.id}>
                    <span><BellRing size={19} /></span>
                    <div>
                      <div><StatusBadge status={notice.priority === 'urgent' ? 'overdue' : notice.priority === 'important' ? 'attention' : 'current'} label={notice.priority} /><small>{notice.expiresAt ? `Expires in ${notice.expires}` : 'No expiry'}</small></div>
                      <h2>{notice.title}</h2>
                      <p>{notice.body}</p>
                      <footer><MemberAvatar name={notice.author} image={notice.authorImage} size="sm" /><span>Posted by {notice.author}</span>{canDelete && <button onClick={() => setPendingNoticeRemoval(notice)} aria-label="Delete notice"><Trash2 size={17} /></button>}</footer>
                    </div>
                  </article>
                )
              })}
            </div>
            {notices.length === 0 && <div className="empty-list"><span>Notice</span><h2>No notices</h2><p>Post an update when the household needs to know something.</p></div>}
          </div>
        ) : selectedThread ? (
          <div className="messages-layout">
            <div className="message-thread-header">
              <button type="button" onClick={() => setSelectedThread(null)} aria-label="Back to inbox"><ArrowLeft size={18} /></button>
              {selectedThread === HOUSEHOLD_THREAD ? <span className="message-thread-icon"><MessageCircle size={19} /></span> : <MemberAvatar name={selectedMember?.username || 'Housemate'} image={selectedMember?.profileImage} size="sm" online />}
              <div><strong>{selectedThread === HOUSEHOLD_THREAD ? 'Household chat' : selectedMember?.username || 'Housemate'}</strong><small>{selectedThread === HOUSEHOLD_THREAD ? activeHouse.name : 'Direct message'}</small></div>
              <button type="button" className="message-thread-delete" onClick={() => setPendingThreadRemoval(selectedThread === HOUSEHOLD_THREAD ? { id: HOUSEHOLD_THREAD, participantName: 'Household chat' } : messageThreads.find((thread) => thread.id === selectedThread) || { id: selectedThread, participantName: selectedMember?.username || 'this member' })} aria-label="Remove conversation"><Trash2 size={17} /></button>
            </div>
            <div className="message-thread">
              {visibleMessages.map((message) => (
                <article className={`message-row ${message.mine ? 'message-row--mine' : ''} ${message.direct ? 'message-row--direct' : ''}`} key={message.id}>
                  {!message.mine && <MemberAvatar name={message.author} image={message.authorImage} size="sm" online />}
                  <div>
                    <small>{message.author}{message.direct ? ` to ${message.recipient}` : ''} - {message.time}</small>
                    <p>{message.body}</p>
                    {message.mine && <span><CheckCircle2 size={12} /> Sent{message.direct ? ` to ${message.recipient}` : ''}</span>}
                  </div>
                </article>
              ))}
              {visibleMessages.length === 0 && <div className="empty-list message-empty"><span>Chat</span><h2>No messages yet</h2><p>Start the conversation below.</p></div>}
            </div>
            <div className="message-composer">
              <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); send() } }} placeholder={messagePlaceholder} aria-label={messagePlaceholder} />
              <button onClick={send} disabled={busy || !text.trim()} aria-label="Send message"><Send size={18} /></button>
            </div>
          </div>
        ) : (
          <div className="messages-layout">
            <div className="message-inbox">
              {dataLoading && <div className="message-inbox-state"><Inbox size={22} /><span>Loading conversations...</span></div>}
              {visibleHouseholdThread && (
                <article className={`message-inbox-row message-inbox-row--household ${householdThread?.unread ? 'message-inbox-row--unread' : ''}`}>
                  <button type="button" className="message-inbox-row__main" onClick={() => openThread(HOUSEHOLD_THREAD)}>
                    <span className="message-thread-icon"><MessageCircle size={19} /></span>
                    <span><strong>Household chat</strong><small>{householdThread?.preview || latestHouseholdMessage?.body || 'Message everyone in the household'}</small></span>
                    <em>{householdThread?.time || latestHouseholdMessage?.time || ''}</em>
                    {householdThread?.unread && <i>{householdThread.unreadCount > 1 ? householdThread.unreadCount : ''}</i>}
                  </button>
                  <button type="button" className="message-inbox-row__delete" onClick={() => setPendingThreadRemoval({ id: HOUSEHOLD_THREAD, participantName: 'Household chat' })} aria-label="Remove household chat"><Trash2 size={17} /></button>
                </article>
              )}
              {messageThreads.map((thread) => (
                <article className={`message-inbox-row ${thread.unread ? 'message-inbox-row--unread' : ''}`} key={thread.id}>
                  <button type="button" className="message-inbox-row__main" onClick={() => openThread(thread.id)}>
                    <MemberAvatar name={thread.participantName} image={thread.participantImage} size="md" online />
                    <span><strong>{thread.participantName}</strong><small>{thread.previewMine ? 'You: ' : ''}{thread.preview}</small></span>
                    <em>{thread.time}</em>
                    {thread.unread && <i>{thread.unreadCount > 1 ? thread.unreadCount : ''}</i>}
                  </button>
                  <button type="button" className="message-inbox-row__delete" onClick={() => setPendingThreadRemoval(thread)} aria-label={`Remove conversation with ${thread.participantName}`}><Trash2 size={17} /></button>
                </article>
              ))}
              {!dataLoading && threadCount === 0 && <div className="empty-list message-empty"><span>Inbox</span><h2>No conversations</h2><p>Send a message to start a thread.</p></div>}
            </div>
            <div className="message-target-picker message-target-picker--inbox">
              <label>
                <span>To</span>
                <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} aria-label="Choose message recipient">
                  <option value="household">Everyone in {activeHouse.name}</option>
                  {recipientOptions.map((member) => <option value={member.id} key={member.id}>{member.username}</option>)}
                </select>
              </label>
            </div>
            <div className="message-composer">
              <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); send() } }} placeholder={messagePlaceholder} aria-label={messagePlaceholder} />
              <button onClick={send} disabled={busy || !text.trim()} aria-label="Send message"><Send size={18} /></button>
            </div>
          </div>
        )}
        <BottomNav />
      </section>
      <ConfirmDialog open={Boolean(pendingNoticeRemoval)} title="Delete this notice?" message={pendingNoticeRemoval ? `${pendingNoticeRemoval.title} will be permanently removed for the household.` : ''} confirmLabel="Delete notice" busy={busy} onConfirm={removeNotice} onCancel={() => setPendingNoticeRemoval(null)} />
      <ConfirmDialog open={Boolean(pendingThreadRemoval)} title="Remove conversation?" message="Remove this conversation from your inbox? This will not delete it for the other participant." confirmLabel="Remove" busy={busy} onConfirm={removeThread} onCancel={() => setPendingThreadRemoval(null)} />
    </AppShell>
  )
}
