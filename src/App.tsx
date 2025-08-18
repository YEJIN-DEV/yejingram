import { useState } from 'react'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import MainChat from './components/mainchat/MainChat'
import SettingsModal from './components/settings/SettingsModal'
import PromptModal from './components/settings/PromptModal'
import CharacterModal from './components/character/CharacterModal'
import { ChevronLeft } from 'lucide-react'

function App() {
  const [room, setRoom] = useState(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <>
      <div id="app" className="relative flex h-screen overflow-hidden">
        <aside id="sidebar"
          className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-gray-900 transition-all duration-300 ease-in-out md:relative md:border-r md:border-gray-800 ${isSidebarCollapsed ? 'w-0' : 'w-80'
            }`}>
          <button id="desktop-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute top-1/2 -translate-y-1/2 -right-4 hidden h-8 w-8 items-center justify-center rounded-full border border-gray-600 bg-gray-700 transition-colors hover:bg-gray-600 md:flex z-20">
            <ChevronLeft className={`h-4 w-4 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>

          <div id="sidebar-content" className={`flex h-full flex-col overflow-hidden ${isSidebarCollapsed ? 'hidden' : ''}`}>
            <Sidebar setRoom={setRoom} />
          </div>
        </aside>

        <main id="main-chat" className="flex-1 flex flex-col bg-gray-950">
          <MainChat room={room} />
          <SettingsModal />
          <PromptModal />
          <CharacterModal />
        </main>

        <div id="sidebar-backdrop" className="fixed inset-0 z-20 hidden bg-black/50 md:hidden"></div>
      </div>
    </>
  )
}

export default App
