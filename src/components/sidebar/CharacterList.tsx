import { useState } from 'react';
import type { RootState } from '../../app/store';
import type { Character } from '../../entities/character/types';
import { Plus, Edit3, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllRooms } from '../../entities/room/selectors';
import { roomsActions } from '../../entities/room/slice';
import { charactersActions } from '../../entities/character/slice';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import RoomList from './RoomList';
import { Avatar } from '../../utils/Avatar';

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

    let lastMessage: any = null;
    let totalUnreadCount = 0;
    const state = useSelector((state: RootState) => state);

    chatRooms.forEach(room => {
        const last = selectMessagesByRoomId(state, room.id).slice(-1)[0];
        if (last && (!lastMessage || last.createdAt > lastMessage.createdAt)) lastMessage = last;
        totalUnreadCount += room.unreadCount || 0;
    });

    const lastMessageContent =
        lastMessage?.type === 'IMAGE' ? '이미지를 보냈습니다' :
            lastMessage?.type === 'STICKER' ? '스티커를 보냈습니다' :
                lastMessage?.content ?? '대화를 시작해보세요';

    return (
        <div className="character-group">
            {/* 캐릭터 헤더 (중복 제거, onClick 단 한 곳) */}
            <div
                onClick={() => setIsExpanded(prev => !prev)}
                className="character-header group p-3 md:p-4 rounded-xl cursor-pointer transition-all duration-200 relative hover:bg-gray-800/50"
            >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
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
                        className="p-1 bg-gray-700 hover:bg-blue-600 rounded text-gray-300 hover:text-white transition-colors"
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
                        className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
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
                        className="p-1 bg-gray-700 hover:bg-red-600 rounded text-gray-300 hover:text-white transition-colors"
                        title="삭제"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>

                <div className="flex items-center space-x-3 md:space-x-4">
                    <Avatar char={character} size="md" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-white text-sm truncate">{character.name}</h3>
                            <div className="flex items-center gap-2">
                                {totalUnreadCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full leading-none">
                                        {totalUnreadCount}
                                    </span>
                                )}
                                <span className="text-xs text-gray-500 shrink-0">{lastMessage?.createdAt ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                {isExpanded ? (
                                    <ChevronDown className={`w-4 h-4 text-gray-400`} />
                                ) : (
                                    <ChevronRight className={`w-4 h-4 text-gray-400`} />
                                )}
                            </div>
                        </div>
                        <p className={`text-xs md:text-sm truncate ${lastMessage?.isError ? 'text-red-400' : 'text-gray-400'}`}>
                            {lastMessageContent}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{chatRooms.length}개 채팅방</p>
                    </div>
                </div>
            </div>

            {/* 채팅방 목록 */}
            {isExpanded && (
                <div className="ml-6 space-y-1 pb-2">
                    {chatRooms.map(room => (
                        <div key={room.id}>
                            <RoomList room={room} unreadCount={room.unreadCount || 0} setRoomId={setRoomId} isSelected={selectedRoomId === room.id} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CharacterList;
