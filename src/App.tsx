import { useState, useEffect, useRef } from 'react'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import MainChat from './components/mainchat/MainChat'
import SettingsModal from './components/settings/SettingsModal'
import PromptModal from './components/settings/PromptModal'
import CharacterPanel from './components/character/CharacterPanel'
import CreateGroupChatModal from './components/modals/CreateGroupChatModal'
import CreateOpenChatModal from './components/modals/CreateOpenChatModal'
import EditGroupChatModal from './components/modals/EditGroupChatModal'
import { MessageCircle, Menu } from 'lucide-react'
import { useSelector } from 'react-redux'
import { selectRoomById } from './entities/room/selectors'
import { selectEditingCharacterId } from './entities/character/selectors'
import { type RootState } from './app/store'
import { setActiveRoomId } from './utils/activeRoomTracker'
import { SpeedInsights } from '@vercel/speed-insights/react';

function App() {
  const [roomId, setRoomId] = useState<string | null>(null)
  const room = useSelector((state: RootState) => roomId ? selectRoomById(state, roomId) : null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isCharacterPanelOpen, setIsCharacterPanelOpen] = useState(false);
  const [isCreateGroupChatModalOpen, setIsCreateGroupChatModalOpen] = useState(false);
  const [isCreateOpenChatModalOpen, setIsCreateOpenChatModalOpen] = useState(false);
  const [isEditGroupChatModalOpen, setIsEditGroupChatModalOpen] = useState(false);

  const editingCharacterId = useSelector(selectEditingCharacterId);

  useEffect(() => {
    setActiveRoomId(roomId);
  }, [roomId]);

  // 패널 자동 닫힘: "편집 중이었다가" editingCharacterId가 null이 될 때만 닫기
  const prevEditingIdRef = useRef<number | null>(editingCharacterId);
  useEffect(() => {
    const prev = prevEditingIdRef.current;
    if (isCharacterPanelOpen && prev !== null && editingCharacterId === null) {
      setIsCharacterPanelOpen(false);
    }
    prevEditingIdRef.current = editingCharacterId;
  }, [editingCharacterId, isCharacterPanelOpen]);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const toggleCharacterPanel = () => {
    setIsCharacterPanelOpen(!isCharacterPanelOpen);
  };

  return (
    <>
      <div id="app" className="relative flex h-dvh overflow-hidden bg-white">
        {/* Instagram DM Style Layout */}
        <div className="flex w-full h-full">
          {/* Left Sidebar - Chat List (Instagram DM Style) */}
          <aside id="sidebar"
            className={`${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              } md:translate-x-0 fixed md:relative inset-y-0 left-0 z-30 w-full md:w-96 lg:w-[400px] bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out`}>

            <div id="sidebar-content" className="flex h-full flex-col">
              <Sidebar
                setRoomId={(id) => { setRoomId(id); setIsMobileSidebarOpen(false); }}
                roomId={roomId}
                openSettingsModal={() => setIsSettingsModalOpen(true)}
                toggleCharacterPanel={toggleCharacterPanel}
                openCreateGroupChatModal={() => setIsCreateGroupChatModalOpen(true)}
                openCreateOpenChatModal={() => setIsCreateOpenChatModalOpen(true)}
                openEditGroupChatModal={() => setIsEditGroupChatModalOpen(true)}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </aside>

          {/* Character Panel - Floating on right side */}
          {isCharacterPanelOpen && (
            <div className="fixed right-0 top-0 bottom-0 z-40 w-96 lg:w-[450px]">
              <CharacterPanel onClose={() => setIsCharacterPanelOpen(false)} />
            </div>
          )}

          {/* Main Chat Area */}
          <main id="main-chat"
            className={`flex-1 flex flex-col bg-white ${isMobileSidebarOpen ? 'hidden md:flex' : 'flex'
              } ${isCharacterPanelOpen ? 'md:mr-96 lg:mr-[450px]' : ''}`}>

            {!room ? (
              <div className="flex-1 flex items-center justify-center bg-gray-50 relative">
                {/* Mobile: Sidebar toggle button (when no room selected) */}
                <button
                  id="mobile-sidebar-toggle"
                  className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-100 md:hidden"
                  onClick={toggleMobileSidebar}
                >
                  <Menu className="h-5 w-5 text-gray-600" />
                </button>
                <div className="text-center">
                  <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-12 h-12 text-gray-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">메시지를 보내세요</h2>
                  <p className="text-gray-500">친구나 그룹과 개인 사진 및 메시지를 공유하세요.</p>
                </div>
              </div>
            ) : (
              <MainChat room={room} onToggleMobileSidebar={toggleMobileSidebar} />
            )}

            {/* Modals */}
            <SettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              openPromptModal={() => setIsPromptModalOpen(true)}
            />
            <PromptModal
              isOpen={isPromptModalOpen}
              onClose={() => setIsPromptModalOpen(false)}
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
        </div>

        {/* Mobile Sidebar Backdrop */}
        <div
          id="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          className={`fixed inset-0 z-20 bg-black/50 md:hidden ${isMobileSidebarOpen ? 'block' : 'hidden'}`}
        />
      </div>
      <SpeedInsights />
    </>
  )
}

export default App