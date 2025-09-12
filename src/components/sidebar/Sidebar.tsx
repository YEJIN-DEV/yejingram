import { useState } from 'react';
import { Settings, Bot, Plus, X, User, Moon, Sun } from 'lucide-react';
import { selectAllCharacters } from '../../entities/character/selectors';
import { useDispatch, useSelector } from 'react-redux';
import CharacterList from './CharacterList';
import { charactersActions } from '../../entities/character/slice';
import { selectAllRooms } from '../../entities/room/selectors';
import GroupChatList from './GroupChatList';
import type { Room } from '../../entities/room/types';
import { selectIsDarkMode } from '../../entities/theme/selectors';
import { themeActions } from '../../entities/theme/slice';

interface SidebarProps {
    setRoomId: (id: string | null) => void;
    roomId: string | null;
    openSettingsModal: () => void;
    toggleCharacterPanel: () => void;
    openCreateGroupChatModal: () => void;
    openEditGroupChatModal: () => void;
    onCloseMobile?: () => void;
}

function Sidebar({ setRoomId, roomId, openSettingsModal, toggleCharacterPanel, openCreateGroupChatModal, openEditGroupChatModal, onCloseMobile }: SidebarProps) {
    const dispatch = useDispatch();
    const characters = useSelector(selectAllCharacters);
    const rooms = useSelector(selectAllRooms);
    const isDarkMode = useSelector(selectIsDarkMode);
    const [searchQuery, setSearchQuery] = useState('');

    const groupChats = rooms.filter((r: Room) => r.type === 'Group');

    const filteredCharacters = characters.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleNewCharacter = () => {
        dispatch(charactersActions.setEditingCharacterId(null));
        toggleCharacterPanel();
    }

    // 다크 모드 토글 핸들러
    const handleToggleDarkMode = () => {
        dispatch(themeActions.toggleDarkMode());
    }

    return (
        <>
            {/* Instagram DM Style Header */}
            <header className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        {/* Mobile close button */}
                        <button
                            id="close-sidebar-mobile"
                            onClick={onCloseMobile}
                            className={`p-2 -ml-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} md:hidden`}
                            title="닫기"
                        >
                            <X className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                        </button>
                        <h1 className={`text-2xl font-light ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} tracking-wide`}>예진그램</h1>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            id="open-new-character-modal"
                            onClick={handleNewCharacter}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="새 채팅"
                        >
                            <Plus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                        </button>
                        <button
                            id="toggle-dark-mode"
                            onClick={handleToggleDarkMode}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title={isDarkMode ? "라이트 모드" : "다크 모드"}
                        >
                            {isDarkMode ? (
                                <Sun className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                            ) : (
                                <Moon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                            )}
                        </button>
                        <button
                            id="open-settings-modal"
                            onClick={openSettingsModal}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="설정"
                        >
                            <Settings className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Bot className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} w-4 h-4`} />
                    <input
                        id="search-input"
                        type="text"
                        placeholder="검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 ${isDarkMode ? 'bg-gray-700 text-gray-100 focus:bg-gray-600 placeholder-gray-400' : 'bg-gray-100 text-gray-900 focus:bg-gray-50 placeholder-gray-500'} rounded-full border-0 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm`}
                    />
                </div>
            </header>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {/* Quick Actions */}
                <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                    <div className="flex space-x-4">
                        <button
                            onClick={openCreateGroupChatModal}
                            className={`flex items-center text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'} font-medium`}
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
                    <div className={`group flex items-center justify-between px-4 py-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className="flex items-center space-x-2">
                            <User className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>연락처</h3>
                            <span className={`text-xs ${isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'} px-2 py-0.5 rounded-full`}>
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
        </>
    );
}

export default Sidebar;
