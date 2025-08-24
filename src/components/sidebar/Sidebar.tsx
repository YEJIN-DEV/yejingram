import { useState } from 'react';
import { Settings, Bot, Plus } from 'lucide-react';
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
}

function Sidebar({ setRoomId, roomId, openSettingsModal, toggleCharacterPanel, openCreateGroupChatModal, openCreateOpenChatModal, openEditGroupChatModal }: SidebarProps) {
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
            <header className="p-4 md:p-6 border-b border-gray-800">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-white mb-1">예진그램</h1>
                        <p className="text-xs md:text-sm text-gray-400">상대를 초대/대화 하세요</p>
                    </div>
                    <button id="open-settings-modal" onClick={openSettingsModal} className="p-2 md:p-2.5 rounded-full bg-gray-800 hover:bg-gray-700 transition-all duration-200">
                        <Settings className="w-5 h-5 text-gray-300" />
                    </button>
                </div>
                <div className="relative">
                    <Bot className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                        id="search-input"
                        type="text"
                        placeholder="검색하기..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2 md:py-3 bg-gray-800 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/30 focus:bg-gray-750 transition-all duration-200 text-sm placeholder-gray-500"
                    />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-2">
                    <button id="open-new-character-modal" onClick={handleNewCharacter} className="w-full flex items-center justify-center py-3 md:py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg text-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        초대하기
                    </button>
                </div>

                <div className="space-y-1 px-3 pb-4">
                    <OpenChatList rooms={openChats} setRoomId={setRoomId} selectedRoomId={roomId} openCreateOpenChatModal={openCreateOpenChatModal} />
                    <GroupChatList rooms={groupChats} setRoomId={setRoomId} selectedRoomId={roomId} openCreateGroupChatModal={openCreateGroupChatModal} openEditGroupChatModal={openEditGroupChatModal} />
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
