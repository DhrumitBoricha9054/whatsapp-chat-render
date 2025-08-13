import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { parseWhatsAppText, inferMediaType } from '../lib/whatsappParser'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [globalUserName, setGlobalUserName] = useState(() => {
    // Load from localStorage on initialization
    return localStorage.getItem('whatsapp-viewer-username') || ''
  })
  const [myNameByChatId, setMyNameByChatId] = useState({})
  const [viewer, setViewer] = useState({ open: false, chatId: null, index: 0, mediaList: [] })
  const [importStats, setImportStats] = useState(null)

  const importFromZip = useCallback(async (file) => {
    if (!file) return
    const zip = await JSZip.loadAsync(file)

    const chatTextFiles = Object.values(zip.files).filter((f) => /(^|\/)_(?:chat|chat\.txt)$|\.txt$/i.test(f.name))
    if (chatTextFiles.length === 0) throw new Error('No chat .txt file found in ZIP')

    const updatedChats = []
    const newChats = []
    let skippedCount = 0
    let updatedCount = 0
    let addedCount = 0
    
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
        const fileNameMatch = msg.content.match(/([^\s]+\.(?:png|jpe?g|gif|webp|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|pdf))/i)
        const isOmitted = /<attachment omitted>/i.test(msg.content)
        const base = fileNameMatch?.[1]
        const mediaFile = base ? mediaByBase.get(base) : undefined
        if (mediaFile) {
          const rawBlob = await mediaFile.async('blob')
          const isPdf = /\.pdf$/i.test(base || '')
          const blob = isPdf ? new Blob([rawBlob], { type: 'application/pdf' }) : rawBlob
          const objectUrl = URL.createObjectURL(blob)
          msg.media = { type: inferMediaType(base), name: base, url: objectUrl }
        } else if (isOmitted) {
          msg.media = { type: 'file', name: 'attachment', url: null }
        }
      }

      const chatName = chatFile.name.replace(/\.txt$/i, '').split('/').pop()
      
      // Check if chat with same name already exists
      const existingChat = chats.find((c) => c.name === chatName)
      
      if (existingChat) {
        // Prefer fast-path: find the index of the last existing message in the new import
        const idOf = (m) => `${m.author}||${m.content}||${m.timestamp}`
        const lastExisting = existingChat.messages[existingChat.messages.length - 1]
        let newMessages = []
        if (lastExisting) {
          const lastIdxInImport = messages.findIndex((m) => idOf(m) === idOf(lastExisting))
          if (lastIdxInImport >= 0) {
            newMessages = messages.slice(lastIdxInImport + 1)
          }
        }

        if (newMessages.length === 0) {
          // Fallback: compute set difference to dedupe
          const existingMessageIds = new Set(existingChat.messages.map((m) => idOf(m)))
          newMessages = messages.filter((msg) => !existingMessageIds.has(idOf(msg)))
        }

        if (newMessages.length > 0) {
          const updatedChat = {
            ...existingChat,
            messages: [...existingChat.messages, ...newMessages],
            participants: Array.from(new Set([...existingChat.participants, ...messages.map((m) => m.author)])).slice(0, 5),
          }
          updatedChats.push(updatedChat)
          updatedCount++
        } else {
          // No new messages detected → duplicate import
          skippedCount++
        }
      } else {
        // New chat, add it
        newChats.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: chatName,
          participants: Array.from(new Set(messages.map((m) => m.author))).slice(0, 5),
          messages,
        })
        addedCount++
      }
    }

    // Update existing chats and add new ones
    setChats((prev) => {
      let updatedChatsList = [...prev]
      
      // Update existing chats
      updatedChats.forEach(updatedChat => {
        const index = updatedChatsList.findIndex(c => c.id === updatedChat.id)
        if (index !== -1) {
          updatedChatsList[index] = updatedChat
        }
      })
      
      // Add new chats
      return [...newChats, ...updatedChatsList]
    })
    
    if (!activeChatId && (newChats[0] || updatedChats[0])) {
      setActiveChatId((newChats[0] || updatedChats[0]).id)
    }
    
    // Show import statistics
    setImportStats({
      skipped: skippedCount,
      updated: updatedCount,
      added: addedCount,
      timestamp: Date.now()
    })
    
    // Clear stats after 5 seconds
    setTimeout(() => setImportStats(null), 5000)
  }, [chats, activeChatId])

  const toggleSidebar = useCallback(() => setIsSidebarOpen((v) => !v), [])
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), [])

  const setMyName = useCallback((chatId, name) => {
    setMyNameByChatId((prev) => ({ ...prev, [chatId]: name }))
  }, [])

  const setGlobalName = useCallback((name) => {
    setGlobalUserName(name)
    // Save to localStorage
    localStorage.setItem('whatsapp-viewer-username', name)
    // Clear individual chat names when setting global name
    setMyNameByChatId({})
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
    globalUserName,
    setGlobalName,
    myNameByChatId,
    setMyName,
    viewer,
    openMedia,
    closeMedia,
    stepMedia,
    importStats,
  }), [chats, activeChatId, importFromZip, isSidebarOpen, toggleSidebar, closeSidebar, globalUserName, setGlobalName, myNameByChatId, setMyName, viewer, openMedia, closeMedia, stepMedia, importStats])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}


