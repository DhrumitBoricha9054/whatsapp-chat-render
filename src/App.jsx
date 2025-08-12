import './App.css';
import { ChatProvider } from './state/ChatContext';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import MediaViewer from './components/MediaViewer';
import Login from './components/Login';
import './components/Login.css';
import { useState } from 'react';

function MainApp() {
  return (
    <div className="app">
      <Topbar />
      <div className="layout">
        <Sidebar />
        <ChatWindow />
      </div>
      <MediaViewer />
    </div>
  );
}

export default function AppWithProviders() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <ChatProvider>
      {isLoggedIn ? (
        <MainApp />
      ) : (
        <Login onLogin={() => setIsLoggedIn(true)} />
      )}
    </ChatProvider>
  );
}
