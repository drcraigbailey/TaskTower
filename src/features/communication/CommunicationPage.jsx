import { BellRing, CheckCircle2, MoreVertical, Plus, Send } from 'lucide-react'
import { useState } from 'react'
import { MemberAvatar, StatusBadge } from '../../components/adult/AdultUi.jsx'
import { AppShell, ScreenHeader } from '../../components/AppShell.jsx'
import BottomNav from '../../components/BottomNav.jsx'
import { messageSeed, noticeSeed } from '../../data/adultDemoData.js'
import { useTaskTower } from '../../context/TaskTowerContext.jsx'

export default function CommunicationPage() {
  const { activeHouse, showToast } = useTaskTower()
  const [tab, setTab] = useState(new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') === 'notices' ? 'notices' : 'messages')
  const [text, setText] = useState('')
  const [messages, setMessages] = useState(messageSeed)
  if (!activeHouse) return null
  const send = () => {
    if (!text.trim()) return
    setMessages((current) => [...current, { id: Date.now(), author: 'You', body: text.trim(), time: 'Now', mine: true }])
    setText('')
    showToast('Message sent.')
  }

  return (
    <AppShell>
      <section className="mobile-screen adult-communication with-bottom-space">
        <ScreenHeader title="Household" subtitle={activeHouse.name} actions={<button className="add-button" onClick={() => setTab('notices')} aria-label="Create notice"><Plus size={20} /></button>} />
        <div className="adult-tabs adult-tabs--two" role="tablist"><button className={tab === 'messages' ? 'active' : ''} onClick={() => setTab('messages')}>Messages<span>2</span></button><button className={tab === 'notices' ? 'active' : ''} onClick={() => setTab('notices')}>Notices<span>{noticeSeed.length}</span></button></div>
        {tab === 'notices' ? (
          <div className="notice-list">{noticeSeed.map((notice) => <article className={`adult-notice-card adult-notice-card--${notice.priority}`} key={notice.id}><span><BellRing size={19} /></span><div><div><StatusBadge status={notice.priority === 'urgent' ? 'overdue' : notice.priority === 'important' ? 'attention' : 'current'} label={notice.priority} /><small>Expires in {notice.expires}</small></div><h2>{notice.title}</h2><p>{notice.body}</p><footer><MemberAvatar name={notice.author} size="sm" /><span>Posted by {notice.author}</span><button aria-label="Notice options"><MoreVertical size={18} /></button></footer></div></article>)}</div>
        ) : (
          <div className="messages-layout">
            <div className="message-thread">{messages.map((message) => <article className={`message-row ${message.mine ? 'message-row--mine' : ''}`} key={message.id}>{!message.mine && <MemberAvatar name={message.author} size="sm" online />}<div><small>{message.author} · {message.time}</small><p>{message.body}</p>{message.mine && <span><CheckCircle2 size={12} /> Sent</span>}</div></article>)}</div>
            <div className="message-composer"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} placeholder="Message the household" aria-label="Message the household" /><button onClick={send} aria-label="Send message"><Send size={18} /></button></div>
          </div>
        )}
        <BottomNav />
      </section>
    </AppShell>
  )
}
