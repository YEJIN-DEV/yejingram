import { useState, useEffect } from 'react'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import MainChat from './components/mainchat/MainChat'
import SettingsModal from './components/settings/SettingsModal'
import PromptModal from './components/settings/PromptModal'
import CharacterModal from './components/character/CharacterModal'
import CreateGroupChatModal from './components/modals/CreateGroupChatModal';
import CreateOpenChatModal from './components/modals/CreateOpenChatModal';
import EditGroupChatModal from './components/modals/EditGroupChatModal';
import { ChevronLeft } from 'lucide-react'
import { useSelector } from 'react-redux'
import { selectRoomById } from './entities/room/selectors'
import { type RootState } from './app/store'
import { setActiveRoomId } from './utils/activeRoomTracker'

function App() {
  const [roomId, setRoomId] = useState<string | null>(null)
  const room = useSelector((state: RootState) => roomId ? selectRoomById(state, roomId) : null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isCreateGroupChatModalOpen, setIsCreateGroupChatModalOpen] = useState(false);
  const [isCreateOpenChatModalOpen, setIsCreateOpenChatModalOpen] = useState(false);
  const [isEditGroupChatModalOpen, setIsEditGroupChatModalOpen] = useState(false);

  useEffect(() => {
    setActiveRoomId(roomId);
  }, [roomId]);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <>
      <div id="app" className="relative flex h-screen overflow-hidden">
        <aside id="sidebar"
          className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-gray-900 transition-all duration-300 ease-in-out md:relative md:border-r md:border-gray-800 w-80 md:transition-all ${isSidebarCollapsed ? 'md:w-0' : 'md:w-80'} ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <button id="desktop-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute top-1/2 -translate-y-1/2 -right-4 hidden h-8 w-8 items-center justify-center rounded-full border border-gray-600 bg-gray-700 transition-colors hover:bg-gray-600 md:flex z-20">
            <ChevronLeft className={`h-4 w-4 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>

          <div id="sidebar-content" className={`flex h-full flex-col overflow-hidden ${isSidebarCollapsed ? 'md:hidden' : ''}`}>
            <Sidebar
              setRoomId={setRoomId}
              roomId={roomId}
              openSettingsModal={() => setIsSettingsModalOpen(true)}
              openCharacterModal={() => setIsCharacterModalOpen(true)}
              openCreateGroupChatModal={() => setIsCreateGroupChatModalOpen(true)}
              openCreateOpenChatModal={() => setIsCreateOpenChatModalOpen(true)}
              openEditGroupChatModal={() => setIsEditGroupChatModalOpen(true)}
            />
          </div>
        </aside>

        <main id="main-chat" className="flex-1 flex flex-col bg-gray-950">
          <MainChat room={room} onToggleMobileSidebar={toggleMobileSidebar} />
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            openPromptModal={() => setIsPromptModalOpen(true)}
          />
          <PromptModal
            isOpen={isPromptModalOpen}
            onClose={() => setIsPromptModalOpen(false)}
          />
          <CharacterModal
            isOpen={isCharacterModalOpen}
            onClose={() => setIsCharacterModalOpen(false)}
          />
          <CreateGroupChatModal
            isOpen={isCreateGroupChatModalOpen}
            onClose={() => setIsCreateGroupChatModalOpen(false)}
          />
          <CreateOpenChatModal
            isOpen={isCreateOpenChatModalOpen}
            onClose={() => setIsCreateOpenChatModalOpen(false)}
          />
          <EditGroupChatModal
            isOpen={isEditGroupChatModalOpen}
            onClose={() => setIsEditGroupChatModalOpen(false)}
          />
        </main>

        <div id="sidebar-backdrop" onClick={() => setIsMobileSidebarOpen(false)} className={`fixed inset-0 z-20 bg-black/50 backdrop-blur-xs md:hidden ${isMobileSidebarOpen ? 'block' : 'hidden'}`}></div>
      </div>
    </>
  )
}

export default App