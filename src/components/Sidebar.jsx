import { useChat } from '../state/ChatContext'

export default function Sidebar() {
  const { chats, activeChatId, setActiveChatId, isSidebarOpen, closeSidebar } = useChat()
  return (
    <>
      <div className={`overlay ${isSidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        {chats.length === 0 && (
          <div className="empty-state">Import a chat ZIP to begin</div>
        )}
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
            onClick={() => {
              setActiveChatId(chat.id)
              closeSidebar()
            }}
          >
            <div style={{ fontWeight: 600 }}>{chat.name}</div>
            <div style={{ fontSize: 12, color: '#8696a0' }}>
              {chat.participants.join(', ')}
            </div>
            <div style={{ fontSize: 11, color: '#667781', marginTop: 4 }}>
              {chat.messages.length} message{chat.messages.length !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </aside>
    </>
  )
}


