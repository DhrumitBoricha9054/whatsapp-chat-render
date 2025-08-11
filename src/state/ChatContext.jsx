import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { parseWhatsAppText, inferMediaType } from '../lib/whatsappParser'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [myNameByChatId, setMyNameByChatId] = useState({})
  const [viewer, setViewer] = useState({ open: false, chatId: null, index: 0, mediaList: [] })

  const importFromZip = useCallback(async (file) => {
    if (!file) return
    const zip = await JSZip.loadAsync(file)

    const chatTextFiles = Object.values(zip.files).filter((f) => /(^|\/)_(?:chat|chat\.txt)$|\.txt$/i.test(f.name))
    if (chatTextFiles.length === 0) throw new Error('No chat .txt file found in ZIP')

    const newChats = []
    for (const chatFile of chatTextFiles) {
      const textContent = await chatFile.async('string')
      const messages = parseWhatsAppText(textContent)

      const mediaEntries = Object.values(zip.files).filter((f) => !f.dir && !/\.txt$/i.test(f.name))
      const mediaByBase = new Map()
      for (const m of mediaEntries) {
        const base = m.name.split('/').pop()
        mediaByBase.set(base, m)
      }

      for (const msg of messages) {
        const fileNameMatch = msg.content.match(/([^\s]+\.(?:png|jpe?g|gif|webp|mp4|webm|mov|m4v|mp3|wav|ogg|m4a))/i)
        const isOmitted = /<attachment omitted>/i.test(msg.content)
        const base = fileNameMatch?.[1]
        const mediaFile = base ? mediaByBase.get(base) : undefined
        if (mediaFile) {
          const blob = await mediaFile.async('blob')
          const objectUrl = URL.createObjectURL(blob)
          msg.media = { type: inferMediaType(base), name: base, url: objectUrl }
        } else if (isOmitted) {
          msg.media = { type: 'file', name: 'attachment', url: null }
        }
      }

      const chatName = chatFile.name.replace(/\.txt$/i, '')
      newChats.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: chatName.split('/').pop(),
        participants: Array.from(new Set(messages.map((m) => m.author))).slice(0, 5),
        messages,
      })
    }

    setChats((prev) => [...newChats, ...prev])
    if (!activeChatId && newChats[0]) setActiveChatId(newChats[0].id)
  }, [activeChatId])

  const toggleSidebar = useCallback(() => setIsSidebarOpen((v) => !v), [])
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), [])

  const setMyName = useCallback((chatId, name) => {
    setMyNameByChatId((prev) => ({ ...prev, [chatId]: name }))
  }, [])

  const openMedia = useCallback((chatId, url) => {
    if (!chatId || !url) return
    const chat = chats.find((c) => c.id === chatId)
    const list = chat ? chat.messages
      .filter((m) => m.media && m.media.url)
      .map((m) => ({ type: m.media.type, url: m.media.url, name: m.media.name || '' })) : []
    const idx = list.findIndex((item) => item.url === url)
    if (idx >= 0) setViewer({ open: true, chatId, index: idx, mediaList: list })
  }, [chats])

  const closeMedia = useCallback(() => {
    setViewer({ open: false, chatId: null, index: 0, mediaList: [] })
  }, [])

  const stepMedia = useCallback((direction) => {
    setViewer((prev) => {
      if (!prev.open || !prev.mediaList || prev.mediaList.length === 0) return prev
      const count = prev.mediaList.length
      const nextIndex = (prev.index + direction + count) % count
      return { ...prev, index: nextIndex }
    })
  }, [])

  const value = useMemo(() => ({
    chats,
    activeChatId,
    setActiveChatId,
    importFromZip,
    isSidebarOpen,
    toggleSidebar,
    closeSidebar,
    myNameByChatId,
    setMyName,
    viewer,
    openMedia,
    closeMedia,
    stepMedia,
  }), [chats, activeChatId, importFromZip, isSidebarOpen, toggleSidebar, closeSidebar, myNameByChatId, setMyName, viewer, openMedia, closeMedia, stepMedia])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}


