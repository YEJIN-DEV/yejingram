import { Users, Edit3, Trash2 } from 'lucide-react';
import { Avatar } from '../../utils/Avatar';
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
    const avatarParticipants = participants.slice(0, 4);
    // Avatar group layout logic
    const renderAvatars = () => {
        const count = avatarParticipants.length;
        if (count === 0) {
            return (
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                </div>
            );
        }
        if (count === 1) {
            return (
                <div className="w-12 h-12 flex items-center justify-center">
                    {avatarParticipants[0] && <Avatar char={avatarParticipants[0]} size="md" />}
                </div>
            );
        }
        if (count === 2) {
            return (
                <div className="w-12 h-12 relative">
                    <div className="absolute left-0 top-0 z-10">
                        {avatarParticipants[0] && <Avatar char={avatarParticipants[0]} size="xs" />}
                    </div>
                    <div className="absolute right-0 bottom-0 z-20">
                        {avatarParticipants[1] && <Avatar char={avatarParticipants[1]} size="xs" />}
                    </div>
                </div>
            );
        }
        if (count === 3) {
            return (
                <div className="w-12 h-12 relative">
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10">
                        {avatarParticipants[0] && <Avatar char={avatarParticipants[0]} size="xs" />}
                    </div>
                    <div className="absolute left-0 bottom-0 z-20">
                        {avatarParticipants[1] && <Avatar char={avatarParticipants[1]} size="xs" />}
                    </div>
                    <div className="absolute right-0 bottom-0 z-30">
                        {avatarParticipants[2] && <Avatar char={avatarParticipants[2]} size="xs" />}
                    </div>
                </div>
            );
        }
        // 4 or more
        return (
            <div className="w-12 h-12 grid grid-cols-2 grid-rows-2 gap-0.5">
                {avatarParticipants.slice(0, 4).map((c) =>
                    c ? (
                        <div
                            key={c.id}
                            className="flex items-center justify-center rounded-full overflow-hidden"
                        >
                            <Avatar char={c} size="xs" />
                        </div>
                    ) : null
                )}
            </div>
        );
    };

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
                    {renderAvatars()}
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