import './App.css'
import { ChatProvider } from './state/ChatContext'
import Topbar from './components/Topbar'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import MediaViewer from './components/MediaViewer'

function App() {
  return (
    <div className="app">
      <Topbar />
      <div className="layout">
        <Sidebar />
        <ChatWindow />
      </div>
      <MediaViewer />
    </div>
  )
}

export default function AppWithProviders() {
  return (
    <ChatProvider>
      <App />
    </ChatProvider>
  )
}
