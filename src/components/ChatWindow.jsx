import { useMemo } from 'react'
import { useChat } from '../state/ChatContext'

function MessageBubble({ message, meName }) {
  const isMe = useMemo(() => {
    if (!meName) return message.author === 'You'
    return message.author.trim().toLowerCase() === meName.trim().toLowerCase()
  }, [message.author, meName])
  return (
    <div className={`bubble ${isMe ? 'me' : 'other'}`}>
      <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
      {message.media && (
        <div className="media">
          {message.media.type === 'image' && message.media.url && (
            <img src={message.media.url} alt={message.media.name} />
          )}
          {message.media.type === 'video' && message.media.url && (
            <video src={message.media.url} controls />
          )}
          {message.media.type === 'audio' && message.media.url && (
            <audio src={message.media.url} controls />
          )}
          {(!message.media.url || message.media.type === 'file') && (
            <div>
              <span>{message.media.name}</span>
            </div>
          )}
        </div>
      )}
      <div className={`meta ${isMe ? 'me' : 'other'}`}>
        <span>{message.author}</span>
        <span>•</span>
        <span>{message.timestamp}</span>
      </div>
    </div>
  )
}

export default function ChatWindow() {
  const { chats, activeChatId, myNameByChatId, setMyName } = useChat()
  const activeChat = chats.find((c) => c.id === activeChatId)
  const meName = activeChat ? myNameByChatId[activeChat.id] : undefined

  return (
    <main className="chat-window" role="main">
      {!activeChat && (
        <div className="empty-state">Select a chat to view messages</div>
      )}
      {activeChat && (
        <div className="messages" tabIndex={0} style={{ outline: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 8px 0' }}>
            <label htmlFor="meName" style={{ color: '#8696a0', fontSize: 12 }}>Your name:</label>
            <input
              id="meName"
              placeholder="Type exactly as it appears in chat"
              value={meName || ''}
              onChange={(e) => setMyName(activeChat.id, e.target.value)}
              style={{
                background: '#0f1b21', border: '1px solid #0e171c', color: '#cfe2ea',
                borderRadius: 8, padding: '6px 8px', fontSize: 12, width: 260
              }}
            />
          </div>
          {activeChat.messages.length === 0 && (
            <div className="empty-state">No messages parsed from this export</div>
          )}
          {activeChat.messages.map((m) => (
            <MessageBubble key={m.id} message={m} meName={meName} />
          ))}
        </div>
      )}
    </main>
  )
}


