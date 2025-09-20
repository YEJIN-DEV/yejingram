import { useState } from 'react';
import { Settings, Bot, Plus, X, User } from 'lucide-react';
import { selectAllCharacters } from '../../entities/character/selectors';
import { useDispatch, useSelector } from 'react-redux';
import CharacterList from './CharacterList';
import { charactersActions } from '../../entities/character/slice';
import { selectAllRooms } from '../../entities/room/selectors';
import GroupChatList from './GroupChatList';
import type { Room } from '../../entities/room/types';

interface SidebarProps {
    roomId: string | null;
    isMobileSidebarOpen: boolean;
    setRoomId: (id: string | null) => void;
    openSettingsModal: () => void;
    toggleCharacterPanel: () => void;
    openCreateGroupChatModal: () => void;
    openEditGroupChatModal: () => void;
    onCloseMobile?: () => void;
}

function Sidebar({ roomId, isMobileSidebarOpen, setRoomId, openSettingsModal, toggleCharacterPanel, openCreateGroupChatModal, openEditGroupChatModal, onCloseMobile }: SidebarProps) {
    const dispatch = useDispatch();
    const characters = useSelector(selectAllCharacters);
    const rooms = useSelector(selectAllRooms);
    const [searchQuery, setSearchQuery] = useState('');

    const groupChats = rooms.filter((r: Room) => r.type === 'Group');

    const filteredCharacters = characters.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleNewCharacter = () => {
        dispatch(charactersActions.setEditingCharacterId(null));
        toggleCharacterPanel();
    }

    return (
        <div className={`flex h-full flex-col ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative inset-y-0 left-0 z-30 w-full md:w-96 lg:w-[400px] bg-[var(--color-bg-main)] border-r border-[var(--color-border)] flex flex-col transition-transform duration-300 ease-in-out`}>
            {/* Instagram DM Style Header */}
            <header className="p-4 border-b border-[var(--color-border-secondary)] bg-[var(--color-bg-main)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        {/* Mobile close button */}
                        <button
                            id="close-sidebar-mobile"
                            onClick={onCloseMobile}
                            className="p-2 -ml-2 rounded-full hover:bg-[var(--color-bg-hover)] md:hidden"
                            title="닫기"
                        >
                            <X className="w-5 h-5 text-[var(--color-icon-primary)]" />
                        </button>
                        <h1 className="text-2xl font-light text-[var(--color-text-primary)] tracking-wide">예진그램</h1>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            id="open-new-character-modal"
                            onClick={handleNewCharacter}
                            className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] transition-colors"
                            title="새 채팅"
                        >
                            <Plus className="w-6 h-6 text-[var(--color-icon-primary)]" />
                        </button>
                        <button
                            id="open-settings-modal"
                            onClick={openSettingsModal}
                            className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] transition-colors"
                            title="설정"
                        >
                            <Settings className="w-6 h-6 text-[var(--color-icon-primary)]" />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Bot className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-icon-secondary)] w-4 h-4" />
                    <input
                        id="search-input"
                        type="text"
                        placeholder="검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-input-primary)] text-[var(--color-text-primary)] rounded-full border-0 focus:bg-[var(--color-bg-input-secondary)] focus:ring-2 focus:ring-[var(--color-focus-border)]/20 transition-transform duration-200 text-sm placeholder-[var(--color-text-secondary)]"
                    />
                </div>
            </header>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {/* Quick Actions */}
                <div className="px-4 py-2 border-b border-[var(--color-border-secondary)]">
                    <div className="flex space-x-4">
                        <button
                            onClick={openCreateGroupChatModal}
                            className="flex items-center text-sm text-[var(--color-button-primary)] hover:text-[var(--color-button-primary-accent)] font-medium"
                        >
                            그룹 채팅 만들기
                        </button>
                    </div>
                </div>

                {/* Chat Items */}
                <div className="space-y-0">
                    <GroupChatList
                        rooms={groupChats}
                        setRoomId={setRoomId}
                        selectedRoomId={roomId}
                        openCreateGroupChatModal={openCreateGroupChatModal}
                        openEditGroupChatModal={openEditGroupChatModal}
                    />
                    <div className="group flex items-center justify-between px-4 py-2 bg-[var(--color-bg-secondary)]">
                        <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-[var(--color-icon-tertiary)]" />
                            <h3 className="text-sm font-semibold text-[var(--color-text-interface)]">연락처</h3>
                            <span className="text-xs bg-[var(--color-bg-secondary-accent)] text-[var(--color-text-tertiary)] px-2 py-0.5 rounded-full">
                                {filteredCharacters.length}
                            </span>
                        </div>
                    </div>
                    {filteredCharacters.map((char) => (
                        <CharacterList
                            key={char.id}
                            character={char}
                            setRoomId={setRoomId}
                            selectedRoomId={roomId}
                            toggleCharacterPanel={toggleCharacterPanel}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
