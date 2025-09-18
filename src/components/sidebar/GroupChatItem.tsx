import { Edit3, Trash2 } from 'lucide-react';
import { GroupChatAvatar } from '../../utils/Avatar';
import type { Room } from '../../entities/room/types';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCharacters } from '../../entities/character/selectors';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import { roomsActions } from '../../entities/room/slice';
import { settingsActions } from '../../entities/setting/slice';

interface GroupChatItemProps {
    room: Room;
    setRoomId: (id: string | null) => void;
    isSelected: boolean;
    openEditGroupChatModal: () => void;
}

function GroupChatItem({ room, setRoomId, isSelected, openEditGroupChatModal }: GroupChatItemProps) {
    const dispatch = useDispatch();
    const allCharacters = useSelector(selectAllCharacters);
    const messages = useSelector((state: any) => selectMessagesByRoomId(state, room.id));
    const participants = room.memberIds.map(id => allCharacters.find(c => c.id === id)).filter(Boolean);

    const handleRoomSelect = () => {
        dispatch(roomsActions.resetUnread(room.id));
        setRoomId(room.id);
    };

    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    let lastMessageContent = '채팅을 시작해보세요';
    if (lastMessage) {
        if (lastMessage.type === 'IMAGE') {
            lastMessageContent = '이미지를 보냈습니다';
        } else if (lastMessage.type === 'STICKER') {
            lastMessageContent = '스티커를 보냈습니다';
        } else if (lastMessage.type === 'TEXT') {
            lastMessageContent = lastMessage.content;
        }
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`'${room.name}' 그룹을 삭제하시겠습니까?`)) {
            dispatch(roomsActions.removeOne(room.id));
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(settingsActions.setEditingRoomId(room.id));
        openEditGroupChatModal();
    };

    return (
        <div
            className={`relative group cursor-pointer transition-all duration-200 px-4 py-3 select-none ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                }`}
            onDoubleClick={handleRoomSelect}
        >
            <div className="absolute top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
                <button
                    onClick={handleEdit}
                    className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 hover:text-gray-800 transition-colors"
                    title="수정"
                >
                    <Edit3 className="w-3 h-3" />
                </button>
                <button
                    onClick={handleDelete}
                    className="p-1 bg-gray-100 hover:bg-red-100 rounded-full text-gray-600 hover:text-red-600 transition-colors"
                    title="삭제"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>

            <div className="flex items-center space-x-3">
                <div className="relative">
                    <GroupChatAvatar participants={participants} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <h4 className={`font-semibold truncate text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                            {room.name}
                        </h4>
                        <div className="flex items-center space-x-2 ml-2">
                            {lastMessage?.createdAt && (
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                    {new Date(lastMessage.createdAt).toLocaleTimeString('ko-KR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            )}
                            {room.unreadCount > 0 && (
                                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[18px] text-center">
                                    {room.unreadCount > 99 ? '99+' : room.unreadCount}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                        {participants.map(p => p?.name).filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                        {lastMessageContent}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default GroupChatItem;