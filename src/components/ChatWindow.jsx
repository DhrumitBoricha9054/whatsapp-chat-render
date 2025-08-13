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
            <ClickableImage src={message.media.url} alt={message.media.name} />
          )}
          {message.media.type === 'video' && message.media.url && (
            <ClickableVideo src={message.media.url} />
          )}
          {message.media.type === 'audio' && message.media.url && (
            <ClickableAudio src={message.media.url} />
          )}
          {message.media.type === 'pdf' && message.media.url && (
            <ClickablePdf src={message.media.url} name={message.media.name} />
          )}
          {(!message.media.url || message.media.type === 'file') && (
            <div>
              <a href={message.media.url || '#'} download={message.media.name} style={{ color: '#53bdeb' }}>
                {message.media.name || 'attachment'}
              </a>
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
  const { chats, activeChatId, globalUserName, openMedia } = useChat()
  const activeChat = chats.find((c) => c.id === activeChatId)

  return (
    <main className="chat-window" role="main">
      {!activeChat && (
        <div className="empty-state">Select a chat to view messages</div>
      )}
      {activeChat && (
        <div className="messages" tabIndex={0} style={{ outline: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          {activeChat.messages.length === 0 && (
            <div className="empty-state">No messages parsed from this export</div>
          )}
          {activeChat.messages.map((m) => (
            <MessageBubble key={m.id} message={m} meName={globalUserName} />
          ))}
        </div>
      )}
    </main>
  )
}

function ClickableImage({ src, alt }) {
  const { openMedia, activeChatId } = useChat()
  return <img src={src} alt={alt} onClick={() => openMedia(activeChatId, src)} style={{ cursor: 'zoom-in' }} />
}

function ClickableVideo({ src }) {
  const { openMedia, activeChatId } = useChat()
  return (
    <div onClick={() => openMedia(activeChatId, src)} style={{ cursor: 'zoom-in' }}>
      <video src={src} controls />
    </div>
  )
}

function ClickableAudio({ src }) {
  const { openMedia, activeChatId } = useChat()
  return (
    <div onClick={() => openMedia(activeChatId, src)}>
      <audio src={src} controls />
    </div>
  )
}

function ClickablePdf({ src, name }) {
  const { openMedia, activeChatId } = useChat()
  return (
    <div onClick={() => openMedia(activeChatId, src)} style={{ cursor: 'zoom-in', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ background: '#1f2c33', color: '#cfe2ea', padding: '6px 8px', borderRadius: 6 }}>PDF</span>
      <span style={{ color: '#53bdeb', textDecoration: 'underline' }}>{name || 'document.pdf'}</span>
    </div>
  )
}


