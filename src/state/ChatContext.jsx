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
        mediaByBase.set(base.toLowerCase(), m)
      }

      for (const msg of messages) {
        // Build list of filename candidates. Prefer those inside the <attached: ...> section first.
        const filenameRegex = /([\w\s()\-.,@!$%#&+~=^`'\[\]]+\.(?:png|jpe?g|gif|webp|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|pdf))/ig
        const candidates = []

        const attachedBlock = msg.content.match(/<\s*attached:\s*([^>]+)\s*>/i)
        if (attachedBlock && attachedBlock[1]) {
          let m
          while ((m = filenameRegex.exec(attachedBlock[1])) !== null) {
            candidates.push(m[1])
          }
        }
        // Then add any other filenames in the entire message
        let match
        while ((match = filenameRegex.exec(msg.content)) !== null) {
          const name = match[1]
          if (!candidates.includes(name)) candidates.push(name)
        }

        const isOmitted = /<attachment omitted>/i.test(msg.content)

        let chosenBase = null
        for (const cand of candidates) {
          const b = cand.split('/').pop()
          if (mediaByBase.has(b)) { chosenBase = b; break }
          if (mediaByBase.has(b.toLowerCase())) { chosenBase = b.toLowerCase(); break }
        }

        const mediaFile = chosenBase ? mediaByBase.get(chosenBase) : undefined
        if (mediaFile) {
          const rawBlob = await mediaFile.async('blob')
          const isPdf = /\.pdf$/i.test(chosenBase || '')
          const blob = isPdf ? new Blob([rawBlob], { type: 'application/pdf' }) : rawBlob
          const objectUrl = URL.createObjectURL(blob)
          msg.media = { type: inferMediaType(chosenBase), name: chosenBase, url: objectUrl }
        } else if (candidates.length > 0) {
          // We detected a filename but could not find the file in ZIP; still expose it to UI
          const fallbackName = candidates[0].split('/').pop()
          msg.media = { type: inferMediaType(fallbackName), name: fallbackName, url: null }
        } else if (isOmitted) {
          msg.media = { type: 'file', name: 'attachment', url: null }
        }
      }

      const chatName = chatFile.name.replace(/\.txt$/i, '').split('/').pop()
      
      // Extract participants from messages to identify the actual chat
      const chatParticipants = Array.from(new Set(messages.map(m => m.author))).sort()
      const participantKey = chatParticipants.join('|')
      
      // Find existing chat by participants (not just filename)
      const existingChat = chats.find((c) => {
        // Check if participants match (this is the real identifier)
        const existingParticipants = Array.from(new Set(c.participants)).sort()
        const existingKey = existingParticipants.join('|')
        
        return existingKey === participantKey
      })
      
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
            // Preserve the original chat name
            name: existingChat.name
          }
          updatedChats.push(updatedChat)
          updatedCount++
        } else {
          // No new messages detected → duplicate import
          skippedCount++
        }
      } else {
        // New chat, add it
        // Create a meaningful chat name based on participants
        let finalChatName = chatName
        
        // If it's a generic name like "_chat", create a better name
        if (chatName === '_chat' || chatName === 'chat' || chatName === 'Chat') {
          if (chatParticipants.length === 2) {
            // Individual chat: use the other person's name
            const otherPerson = chatParticipants.find(p => p !== globalUserName)
            finalChatName = otherPerson || chatParticipants[0]
          } else if (chatParticipants.length > 2) {
            // Group chat: use first few participant names
            const displayParticipants = chatParticipants.slice(0, 3).join(', ')
            finalChatName = `${displayParticipants}${chatParticipants.length > 3 ? '...' : ''}`
          }
        }
        
        // Ensure the name is unique
        let uniqueName = finalChatName
        let counter = 1
        while (chats.some(c => c.name === uniqueName)) {
          uniqueName = `${finalChatName} (${counter})`
          counter++
        }
        
        newChats.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: uniqueName,
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

  // Delete single chat
  const deleteChat = useCallback((chatId) => {
    if (!chatId) return
    
    setChats(prev => prev.filter(chat => chat.id !== chatId))
    
    // If deleted chat was active, switch to first available chat
    if (activeChatId === chatId) {
      const remainingChats = chats.filter(chat => chat.id !== chatId)
      if (remainingChats.length > 0) {
        setActiveChatId(remainingChats[0].id)
      } else {
        setActiveChatId(null)
      }
    }
  }, [activeChatId, chats])

  // Delete multiple chats
  const deleteMultipleChats = useCallback((chatIds) => {
    if (!chatIds || chatIds.length === 0) return
    
    setChats(prev => prev.filter(chat => !chatIds.includes(chat.id)))
    
    // If active chat was deleted, switch to first available chat
    if (activeChatId && chatIds.includes(activeChatId)) {
      const remainingChats = chats.filter(chat => !chatIds.includes(chat.id))
      if (remainingChats.length > 0) {
        setActiveChatId(remainingChats[0].id)
      } else {
        setActiveChatId(null)
      }
    }
  }, [activeChatId, chats])

  // Clear all chats
  const clearAllChats = useCallback(() => {
    setChats([])
    setActiveChatId(null)
    setViewer({ open: false, chatId: null, index: 0, mediaList: [] })
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
    deleteChat,
    deleteMultipleChats,
    clearAllChats,
  }), [chats, activeChatId, importFromZip, isSidebarOpen, toggleSidebar, closeSidebar, globalUserName, setGlobalName, myNameByChatId, setMyName, viewer, openMedia, closeMedia, stepMedia, importStats, deleteChat, deleteMultipleChats, clearAllChats])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}


