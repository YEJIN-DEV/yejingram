import { useState } from 'react';
import { Settings, Bot, Plus, X } from 'lucide-react';
import { selectAllCharacters } from '../../entities/character/selectors';
import { useDispatch, useSelector } from 'react-redux';
import CharacterList from './CharacterList';
import { charactersActions } from '../../entities/character/slice';
import { selectAllRooms } from '../../entities/room/selectors';
import GroupChatList from './GroupChatList';
import OpenChatList from './OpenChatList';
import type { Room } from '../../entities/room/types';

interface SidebarProps {
    setRoomId: (id: string | null) => void;
    roomId: string | null;
    openSettingsModal: () => void;
    toggleCharacterPanel: () => void;
    openCreateGroupChatModal: () => void;
    openCreateOpenChatModal: () => void;
    openEditGroupChatModal: () => void;
    onCloseMobile?: () => void;
}

function Sidebar({ setRoomId, roomId, openSettingsModal, toggleCharacterPanel, openCreateGroupChatModal, openCreateOpenChatModal, openEditGroupChatModal, onCloseMobile }: SidebarProps) {
    const dispatch = useDispatch();
    const characters = useSelector(selectAllCharacters);
    const rooms = useSelector(selectAllRooms);
    const [searchQuery, setSearchQuery] = useState('');

    const groupChats = rooms.filter((r: Room) => r.type === 'Group');
    const openChats = rooms.filter((r: Room) => r.type === 'Open');

    const filteredCharacters = characters.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleNewCharacter = () => {
        dispatch(charactersActions.setEditingCharacterId(null));
        toggleCharacterPanel();
    }

    return (
        <>
            {/* Instagram DM Style Header */}
            <header className="p-4 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        {/* Mobile close button */}
                        <button
                            id="close-sidebar-mobile"
                            onClick={onCloseMobile}
                            className="p-2 -ml-2 rounded-full hover:bg-gray-100 md:hidden"
                            title="닫기"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                        <h1 className="text-2xl font-light text-gray-900 tracking-wide">예진그램</h1>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            id="open-new-character-modal"
                            onClick={handleNewCharacter}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            title="새 채팅"
                        >
                            <Plus className="w-6 h-6 text-gray-600" />
                        </button>
                        <button
                            id="open-settings-modal"
                            onClick={openSettingsModal}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            title="설정"
                        >
                            <Settings className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Bot className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        id="search-input"
                        type="text"
                        placeholder="검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 text-gray-900 rounded-full border-0 focus:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm placeholder-gray-500"
                    />
                </div>
            </header>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {/* Quick Actions */}
                <div className="px-4 py-2 border-b border-gray-100">
                    <div className="flex space-x-4">
                        <button
                            onClick={openCreateOpenChatModal}
                            className="flex items-center text-sm text-blue-500 hover:text-blue-600 font-medium"
                        >
                            오픈 채팅 만들기
                        </button>
                        <button
                            onClick={openCreateGroupChatModal}
                            className="flex items-center text-sm text-blue-500 hover:text-blue-600 font-medium"
                        >
                            그룹 채팅 만들기
                        </button>
                    </div>
                </div>

                {/* Chat Items */}
                <div className="space-y-0">
                    <OpenChatList
                        rooms={openChats}
                        setRoomId={setRoomId}
                        selectedRoomId={roomId}
                        openCreateOpenChatModal={openCreateOpenChatModal}
                    />
                    <GroupChatList
                        rooms={groupChats}
                        setRoomId={setRoomId}
                        selectedRoomId={roomId}
                        openCreateGroupChatModal={openCreateGroupChatModal}
                        openEditGroupChatModal={openEditGroupChatModal}
                    />
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
