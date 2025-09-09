import { useState } from 'react';
import type { RootState } from '../../app/store';
import type { Character } from '../../entities/character/types';
import type { Message } from '../../entities/message/types';
import { Plus, Edit3, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllRooms } from '../../entities/room/selectors';
import { roomsActions } from '../../entities/room/slice';
import { charactersActions } from '../../entities/character/slice';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import { selectIsDarkMode } from '../../entities/theme/selectors';
import RoomList from './RoomList';
import { Avatar } from '../../utils/Avatar';
import { useCharacterOnlineStatus } from '../../utils/simulateOnline';
import { getMessageDisplayText } from '../../utils/message';

interface CharacterListProps {
    character: Character;
    setRoomId: (id: string | null) => void;
    selectedRoomId: string | null;
    toggleCharacterPanel: () => void;
}

function CharacterList({
    character,
    setRoomId,
    selectedRoomId,
    toggleCharacterPanel
}: CharacterListProps) {
    const chatRooms = useSelector(selectAllRooms).filter(r => r.memberIds?.includes(character.id) && r.type === 'Direct') || [];
    const [isExpanded, setIsExpanded] = useState(false);
    const dispatch = useDispatch();
    const isDarkMode = useSelector(selectIsDarkMode);

    let lastMessage: Message | null = null as Message | null;
    let totalUnreadCount = 0;
    const state = useSelector((state: RootState) => state);

    chatRooms.forEach(room => {
        const last = selectMessagesByRoomId(state, room.id).slice(-1)[0] as Message | undefined;
        if (last && (!lastMessage || last.createdAt > lastMessage.createdAt)) lastMessage = last;
        totalUnreadCount += room.unreadCount || 0;
    });

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return '방금';
        if (diffMins < 60) return `${diffMins}분`;
        if (diffHours < 24) return `${diffHours}시간`;
        if (diffDays < 7) return `${diffDays}일`;
        return date.toLocaleDateString();
    };

    return (
        <div className="character-group">
            {/* Instagram DM Style Character Item */}
            <div
                onClick={() => setIsExpanded(prev => !prev)}
                className={`character-header group px-4 py-3 cursor-pointer transition-all duration-200 relative ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} select-none`}
            >
                <div className="absolute top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            dispatch(roomsActions.upsertOne({
                                id: `${character.id}-${Date.now()}`,
                                name: '새 채팅',
                                memberIds: [character.id],
                                lastMessageId: null,
                                type: "Direct",
                                unreadCount: 0,
                            }));
                        }}
                        className={`p-1 ${isDarkMode ? 'bg-gray-600 hover:bg-blue-500' : 'bg-gray-100 hover:bg-blue-500'} rounded-full ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} hover:text-white transition-colors`}
                        title="새 채팅방"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            dispatch(charactersActions.setEditingCharacterId(character.id));
                            toggleCharacterPanel();
                        }}
                        className={`p-1 ${isDarkMode ? 'bg-gray-600 hover:bg-gray-400' : 'bg-gray-100 hover:bg-gray-400'} rounded-full ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} hover:text-white transition-colors`}
                        title="수정"
                    >
                        <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`'${character.name}' 캐릭터를 삭제하시겠습니까? 관련된 모든 채팅방과 메시지도 삭제됩니다.`)) {
                                dispatch(charactersActions.removeOne(character.id));
                            }
                        }}
                        className={`p-1 ${isDarkMode ? 'bg-gray-600 hover:bg-red-500' : 'bg-gray-100 hover:bg-red-500'} rounded-full ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} hover:text-white transition-colors`}
                        title="삭제"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Avatar char={character} size="md" />
                        {/* Online indicator */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${useCharacterOnlineStatus(character.id) ? 'bg-green-500' : 'bg-gray-500'} border-2 ${isDarkMode ? 'border-gray-800' : 'border-white'} rounded-full`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                    <h3 className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} text-sm truncate`}>{character.name}</h3>
                                    {totalUnreadCount > 0 && (
                                        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[18px] text-center">
                                            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-sm truncate flex-1 mr-2`}>
                                        {getMessageDisplayText(lastMessage)}
                                        {chatRooms.length > 1 && (
                                            <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}> · {chatRooms.length}개 채팅</span>
                                        )}
                                    </p>
                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                        {lastMessage && typeof lastMessage === 'object' && 'createdAt' in lastMessage && (lastMessage as Message).createdAt && (
                                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {formatTime((lastMessage as Message).createdAt)}
                                            </span>
                                        )}
                                        {isExpanded ?
                                            <ChevronDown className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} /> :
                                            <ChevronRight className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Rooms List - Instagram DM Style */}
            {isExpanded && (
                <div className={`${isDarkMode ? 'bg-gray-700 border-t border-gray-600' : 'bg-gray-50 border-t border-gray-100'}`}>
                    {chatRooms.map((room, index) => (
                        <div
                            key={room.id}
                            className={`pl-16 pr-4 py-2 ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'} cursor-pointer select-none ${index !== chatRooms.length - 1 ? (isDarkMode ? 'border-b border-gray-600' : 'border-b border-gray-100') : ''
                                }`}
                        >
                            <RoomList
                                room={room}
                                unreadCount={room.unreadCount || 0}
                                setRoomId={setRoomId}
                                isSelected={selectedRoomId === room.id}
                                useDoubleClick={true}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CharacterList;
