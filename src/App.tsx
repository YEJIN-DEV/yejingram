import { useState, useEffect, useRef } from 'react'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import MainChat from './components/mainchat/MainChat'
import AnnouncementsPanel from './components/sidebar/AnnouncementsPanel'
import SettingsPanel from './components/settings/SettingsPanel'
import PromptModal from './components/settings/PromptModal'
import CharacterPanel from './components/character/CharacterPanel'
import CreateGroupChatModal from './components/modals/CreateGroupChatModal'
import EditGroupChatModal from './components/modals/EditGroupChatModal'
import SyncModal from './components/modals/SyncModal'
import SyncCornerIndicator from './components/modals/SyncCornerIndicator'
import { useDispatch, useSelector } from 'react-redux'
import { selectRoomById } from './entities/room/selectors'
import { selectEditingCharacterId } from './entities/character/selectors'
import { selectAllSettings, selectColorTheme, selectUILanguage } from './entities/setting/selectors'
import { type RootState } from './app/store'
import { setActiveRoomId } from './utils/activeRoomTracker'
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from 'react-hot-toast';
import { useSyncOnChange } from './utils/useSyncOnChange';
import { selectForceShowSyncModal, selectIsSyncing } from './entities/ui/selectors';
import i18n from './i18n/i18n'
import { settingsActions } from './entities/setting/slice'
import { charactersActions } from './entities/character/slice'

function App() {
  const dispatch = useDispatch();
  const [roomId, setRoomId] = useState<string | null>(null)
  const room = useSelector((state: RootState) => roomId ? selectRoomById(state, roomId) : null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAnnouncementsPanelOpen, setIsAnnouncementsPanelOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isCharacterPanelOpen, setIsCharacterPanelOpen] = useState(false);
  const [isCreateGroupChatModalOpen, setIsCreateGroupChatModalOpen] = useState(false);
  const [isEditGroupChatModalOpen, setIsEditGroupChatModalOpen] = useState(false);
  const colorTheme = useSelector(selectColorTheme);
  const settings = useSelector(selectAllSettings);
  const isSyncing = useSelector(selectIsSyncing);
  const forceShowSyncModal = useSelector(selectForceShowSyncModal);
  const uiLanguage = useSelector(selectUILanguage);

  const editingCharacterId = useSelector(selectEditingCharacterId);

  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')

    const listener = (e: MediaQueryListEvent) => setPrefersDark(e.matches)

    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (uiLanguage !== null) {
      i18n.changeLanguage(uiLanguage);
      document.title = i18n.t('pageTitle');
    } else { // Only run on very first load when uiLanguage is null
      const lang = i18n.resolvedLanguage as 'ko' | 'en' | 'ja';
      dispatch(settingsActions.setUILanguage(lang));
      dispatch(settingsActions.updatePromptNamesToLocale(lang));
      dispatch(charactersActions.updateDefaultCharacterNameToLocale(lang));
    }
  }, [uiLanguage, dispatch]);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark', 'custom-theme');
    if (colorTheme === 'dark' || (colorTheme === 'system' && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else if (colorTheme === 'light' || (colorTheme === 'system' && !prefersDark)) {
      document.documentElement.classList.add('light');
    } else if (colorTheme === 'custom') {
      // Apply base class as well for fallback variables
      if (settings.customThemeBase === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add('light');
      }
      document.documentElement.classList.add('custom-theme');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [colorTheme, settings.customThemeBase, prefersDark]);

  // Apply custom variable overrides when using custom theme
  const appliedCustomKeysRef = useRef<string[]>([]);
  useEffect(() => {
    // Clear previously applied overrides
    for (const key of appliedCustomKeysRef.current) {
      document.documentElement.style.removeProperty(key);
    }
    appliedCustomKeysRef.current = [];

    if (colorTheme !== 'custom') {
      return;
    }
    const baseKey = settings.customThemeBase === 'light' ? 'light' : 'dark';
    const overrides = settings.customTheme ? settings.customTheme[baseKey] : {};
    for (const [name, value] of Object.entries(overrides)) {
      if (name.startsWith('--color-') && value) {
        document.documentElement.style.setProperty(name, value);
        appliedCustomKeysRef.current.push(name);
      }
    }
  }, [colorTheme, settings.customThemeBase, settings.customTheme]);

  useEffect(() => {
    setActiveRoomId(roomId);
  }, [roomId]);

  // Sync on state changes (debounced, minimal deltas)
  useSyncOnChange();

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

  const toggleAnnouncementsPanel = () => {
    setIsAnnouncementsPanelOpen(!isAnnouncementsPanelOpen);
  };

  const toggleSettingsPanel = () => {
    setIsSettingsPanelOpen(!isSettingsPanelOpen);
  };

  const Backdrop = ({ onClick, className }: { onClick: () => void; className?: string; }) => (
    <div onClick={onClick} className={`fixed inset-0 ${className}`} />
  );

  // Show global sync modal ONLY on initial state: no room selected and no modal/panel open
  const shouldShowGlobalSyncModal = (forceShowSyncModal || (isSyncing && !roomId &&
    !isAnnouncementsPanelOpen && !isSettingsPanelOpen && !isPromptModalOpen && !isCharacterPanelOpen &&
    !isCreateGroupChatModalOpen && !isEditGroupChatModalOpen));

  return (
    <>
      <div id="app" className="relative flex overflow-hidden bg-[var(--color-bg-main)] w-full h-dvh">

        <Sidebar
          roomId={roomId}
          isMobileSidebarOpen={isMobileSidebarOpen}
          setRoomId={(id) => { setRoomId(id); setIsMobileSidebarOpen(false); }}
          toggleAnnouncementsPanel={() => {
            toggleAnnouncementsPanel()
            if (isSettingsPanelOpen) toggleSettingsPanel()
          }}
          toggleSettingsPanel={() => {
            toggleSettingsPanel()
            if (isAnnouncementsPanelOpen) toggleAnnouncementsPanel()
          }}
          toggleCharacterPanel={toggleCharacterPanel}
          openCreateGroupChatModal={() => setIsCreateGroupChatModalOpen(true)}
          openEditGroupChatModal={() => setIsEditGroupChatModalOpen(true)}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Announcements Panel - Next to sidebar */}
        {isAnnouncementsPanelOpen && (
          <>
            <AnnouncementsPanel
              onClose={() => setIsAnnouncementsPanelOpen(false)}
            />
            {/* Announcements Panel Backdrop (mobile only) */}
            <Backdrop onClick={() => setIsAnnouncementsPanelOpen(false)} className="z-30 bg-[var(--color-bg-shadow)]/20 backdrop-blur-sm md:hidden" />
          </>
        )}

        {/* Settings Panel - Next to sidebar */}
        {isSettingsPanelOpen && (
          <>
            <SettingsPanel
              openPromptModal={() => setIsPromptModalOpen(true)}
              onClose={() => setIsSettingsPanelOpen(false)}
            />
            {/* Settings Panel Backdrop (mobile only) */}
            <Backdrop onClick={() => setIsSettingsPanelOpen(false)} className="z-30 bg-[var(--color-bg-shadow)]/20 backdrop-blur-sm md:hidden" />
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

        {/* Sync indicators: show modal only for pristine initial state, else corner indicator */}
        {shouldShowGlobalSyncModal ? <SyncModal /> : <SyncCornerIndicator />}

        {/* Mobile Sidebar Backdrop */}
        {isMobileSidebarOpen && (
          <Backdrop onClick={() => setIsMobileSidebarOpen(false)} className="z-20 bg-[var(--color-bg-shadow)]/50 md:hidden" />
        )}
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