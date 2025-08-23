import { Users, Edit3, Trash2 } from 'lucide-react';
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

    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    let lastMessageContent = '채팅을 시작해보세요';
    if (lastMessage) {
        if (lastMessage.type === 'IMAGE') {
            lastMessageContent = '이미지를 보냈습니다';
        } else if (lastMessage.type === 'STICKER') {
            lastMessageContent = '스티커를 보냈습니다';
        } else {
            lastMessageContent = lastMessage.content;
        }
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`'${room.name}' 단톡방을 삭제하시겠습니까?`)) {
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
            className={`relative group cursor-pointer rounded-xl transition-all duration-200 ${isSelected ? 'bg-blue-600/20' : 'hover:bg-gray-800/50'}`}
            onClick={() => setRoomId(room.id)}
        >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
                <button onClick={handleEdit} className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors" title="수정">
                    <Edit3 className="w-3 h-3" />
                </button>
                <button onClick={handleDelete} className="p-1 bg-gray-700 hover:bg-red-600 rounded text-gray-300 hover:text-white transition-colors" title="삭제">
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
            <div className="flex items-center gap-3 p-3">
                <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    {room.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                            {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-white truncate">{room.name}</h4>
                        {lastMessage && <span className="text-xs text-gray-500 ml-2">{lastMessage?.createdAt ? new Date(lastMessage?.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>}
                    </div>
                    <p className="text-sm text-gray-400 truncate">{participants.map(p => p?.name).filter(Boolean).join(', ')}</p>
                    <p className="text-xs text-gray-500 truncate mt-1">{lastMessageContent}</p>
                </div>
            </div>
        </div>
    );
}

export default GroupChatItem;