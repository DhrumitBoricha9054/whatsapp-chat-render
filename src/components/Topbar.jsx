import { useRef } from 'react'
import { useChat } from '../state/ChatContext'

export default function Topbar() {
  const inputRef = useRef(null)
  const { importFromZip, toggleSidebar } = useChat()

  return (
    <div className="topbar">
      <button className="icon-button" aria-label="Open sidebar" onClick={toggleSidebar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="#cfd8dc" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <div className="title">WhatsApp Chat Viewer</div>
      <div className="actions">
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            try {
              await importFromZip(file)
            } catch (err) {
              alert(err.message || 'Failed to import ZIP')
            }
          }}
          style={{ display: 'none' }}
        />
        <button onClick={() => inputRef.current?.click()}>Import ZIP</button>
      </div>
    </div>
  )
}


