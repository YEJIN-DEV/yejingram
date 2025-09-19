import { useState, useEffect, useRef } from 'react'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import MainChat from './components/mainchat/MainChat'
import SettingsPanel from './components/settings/SettingsPanel'
import PromptModal from './components/settings/PromptModal'
import CharacterPanel from './components/character/CharacterPanel'
import CreateGroupChatModal from './components/modals/CreateGroupChatModal'
import EditGroupChatModal from './components/modals/EditGroupChatModal'
import { useSelector } from 'react-redux'
import { selectRoomById } from './entities/room/selectors'
import { selectEditingCharacterId } from './entities/character/selectors'
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

  const Backdrop = ({ onClick, className }: { onClick: () => void; className?: string; }) => (
    <div onClick={onClick} className={`fixed inset-0 ${className}`} />
  );


  return (
    <>
      <div id="app" className="relative flex overflow-hidden bg-white w-full h-dvh">
        {/* Left Sidebar */}

        <Sidebar
          roomId={roomId}
          isMobileSidebarOpen={isMobileSidebarOpen}
          setRoomId={(id) => { setRoomId(id); setIsMobileSidebarOpen(false); }}
          openSettingsModal={() => setIsSettingsPanelOpen(true)}
          toggleCharacterPanel={toggleCharacterPanel}
          openCreateGroupChatModal={() => setIsCreateGroupChatModalOpen(true)}
          openEditGroupChatModal={() => setIsEditGroupChatModalOpen(true)}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Settings Panel - Next to sidebar */}
        {isSettingsPanelOpen && (
          <>
            <SettingsPanel
              openPromptModal={() => setIsPromptModalOpen(true)}
              onClose={() => setIsSettingsPanelOpen(false)}
            />
            {/* Settings Panel Backdrop (mobile only) */}
            <Backdrop onClick={() => setIsSettingsPanelOpen(false)} className="z-30 bg-black/20 backdrop-blur-sm md:hidden" />
          </>
        )}

        {/* Character Panel - Floating on right side */}
        {isCharacterPanelOpen && (
          <CharacterPanel onClose={() => setIsCharacterPanelOpen(false)} />
        )}

        {/* Main Chat Area */}
        <MainChat room={room} isMobileSidebarOpen={isMobileSidebarOpen} onToggleMobileSidebar={toggleMobileSidebar} onToggleCharacterPanel={toggleCharacterPanel} onToggleGroupchatSettings={() => setIsEditGroupChatModalOpen(true)} />

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
        {isMobileSidebarOpen && (
          <Backdrop onClick={() => setIsMobileSidebarOpen(false)} className="z-20 bg-black/50 md:hidden" />
        )}
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#1f2937',
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