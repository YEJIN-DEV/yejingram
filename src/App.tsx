import { useState, useEffect, useRef } from 'react'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import MainChat from './components/mainchat/MainChat'
import SettingsPanel from './components/settings/SettingsPanel'
import PromptModal from './components/settings/PromptModal'
import CharacterPanel from './components/character/CharacterPanel'
import CreateGroupChatModal from './components/modals/CreateGroupChatModal'
import EditGroupChatModal from './components/modals/EditGroupChatModal'
import { MessageCircle, Menu } from 'lucide-react'
import { useSelector } from 'react-redux'
import { selectRoomById } from './entities/room/selectors'
import { selectEditingCharacterId } from './entities/character/selectors'
import { selectIsDarkMode } from './entities/setting/selectors'
import { type RootState } from './app/store'
import { setActiveRoomId } from './utils/activeRoomTracker'
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from 'react-hot-toast';

function App() {
  const [roomId, setRoomId] = useState<string | null>(null)
  const room = useSelector((state: RootState) => roomId ? selectRoomById(state, roomId) : null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isCharacterPanelOpen, setIsCharacterPanelOpen] = useState(false);
  const [isCreateGroupChatModalOpen, setIsCreateGroupChatModalOpen] = useState(false);
  const [isEditGroupChatModalOpen, setIsEditGroupChatModalOpen] = useState(false);
  const isDarkMode = useSelector(selectIsDarkMode);

  const editingCharacterId = useSelector(selectEditingCharacterId);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
      <div id="app" className="relative flex h-dvh overflow-hidden bg-[var(--color-bg-main)]">
        {/* Instagram DM Style Layout */}
        <div className="flex w-full h-full">
          {/* Left Sidebar - Chat List (Instagram DM Style) */}
          <aside id="sidebar"
            className={`${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              } md:translate-x-0 fixed md:relative inset-y-0 left-0 z-30 w-full md:w-96 lg:w-[400px] bg-[var(--color-bg-main)] border-r border-[var(--color-border)] flex flex-col transition-transform duration-300 ease-in-out`}>

            <div id="sidebar-content" className="flex h-full flex-col">
              <Sidebar
                setRoomId={(id) => { setRoomId(id); setIsMobileSidebarOpen(false); }}
                roomId={roomId}
                openSettingsModal={() => setIsSettingsPanelOpen(true)}
                toggleCharacterPanel={toggleCharacterPanel}
                openCreateGroupChatModal={() => setIsCreateGroupChatModalOpen(true)}
                openEditGroupChatModal={() => setIsEditGroupChatModalOpen(true)}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </aside>

          {/* Settings Panel - Next to sidebar */}
          {isSettingsPanelOpen && (
            <>
              <div className="fixed md:relative top-0 bottom-0 z-40 min-w-fit max-w-lg left-0 md:left-auto bg-[var(--color-bg-main)] border-r border-[var(--color-border)]">
                <SettingsPanel
                  openPromptModal={() => setIsPromptModalOpen(true)}
                  onClose={() => setIsSettingsPanelOpen(false)}
                />
              </div>
              {/* Settings Panel Backdrop (mobile only) */}
              <div
                onClick={() => setIsSettingsPanelOpen(false)}
                className="fixed inset-0 z-30 bg-[var(--color-bg-shadow)]/20 backdrop-blur-sm md:hidden"
              />
            </>
          )}

          {/* Character Panel - Floating on right side */}
          {isCharacterPanelOpen && (
            <div className="fixed right-0 top-0 bottom-0 z-40 w-96">
              <CharacterPanel onClose={() => setIsCharacterPanelOpen(false)} />
            </div>
          )}

          {/* Main Chat Area */}
          <main id="main-chat"
            className={`flex-1 flex flex-col bg-[var(--color-bg-main)] ${isMobileSidebarOpen ? 'hidden md:flex' : 'flex'}`}>
            {!room ? (
              <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-secondary)] relative">
                {/* Mobile: Sidebar toggle button (when no room selected) */}
                <button
                  id="mobile-sidebar-toggle"
                  className="absolute top-4 left-4 p-2 rounded-full hover:bg-[var(--color-bg-hover)] md:hidden"
                  onClick={toggleMobileSidebar}
                >
                  <Menu className="h-5 w-5 text-[var(--color-icon-primary)]" />
                </button>
                <div className="text-center">
                  <div className="w-24 h-24 bg-[var(--color-button-secondary-accent)] rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-12 h-12 text-[var(--color-icon-secondary)]" />
                  </div>
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">메시지를 보내세요</h2>
                  <p className="text-[var(--color-text-secondary)]">친구나 그룹과 개인 사진 및 메시지를 공유하세요.</p>
                </div>
              </div>
            ) : (
              <MainChat room={room} onToggleMobileSidebar={toggleMobileSidebar} onToggleCharacterPanel={toggleCharacterPanel} onToggleGroupchatSettings={() => setIsEditGroupChatModalOpen(true)} />
            )}
          </main>
        </div>

        {/* Global Modals (rendered above sidebar/main) */}
        <PromptModal
          isOpen={isPromptModalOpen}
          onClose={() => setIsPromptModalOpen(false)}
        />
        <CreateGroupChatModal
          isOpen={isCreateGroupChatModalOpen}
          onClose={() => setIsCreateGroupChatModalOpen(false)}
        />
        <EditGroupChatModal
          isOpen={isEditGroupChatModalOpen}
          onClose={() => setIsEditGroupChatModalOpen(false)}
        />

        {/* Mobile Sidebar Backdrop */}
        <div
          id="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          className={`fixed inset-0 z-20 bg-[var(--color-bg-shadow)]/50 md:hidden ${isMobileSidebarOpen ? 'block' : 'hidden'}`}
        />
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--color-bg-main)',
            color: 'var(--color-toaster-text)',
            border: '1px solid var(--color-toaster-border)',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-toaster-icon-primary)',
              secondary: 'var(--color-toaster-icon-secondary)',
            },
          },
        }}
      />
      <SpeedInsights />
      <Analytics />
    </>
  )
}

export default App