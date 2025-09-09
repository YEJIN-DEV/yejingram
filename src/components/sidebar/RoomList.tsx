import { Trash2, Copy } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useCallback, memo } from 'react';
import type { RootState } from '../../app/store';
import type { Room } from '../../entities/room/types';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import { roomsActions } from '../../entities/room/slice';
import { messagesActions } from '../../entities/message/slice';
import { getMessageDisplayText } from '../../utils/message';

interface RoomListProps {
    room: Room;
    unreadCount: number;
    setRoomId: (id: string | null) => void;
    isSelected: boolean;
    useDoubleClick?: boolean;
}

function RoomList({
    room,
    unreadCount,
    setRoomId,
    isSelected,
    useDoubleClick = false
}: RoomListProps) {
    const dispatch = useDispatch();
    const lastMessage = useSelector((state: RootState) => {
        const messages = selectMessagesByRoomId(state, room.id);
        return messages[messages.length - 1];
    });
    const formatTime = useCallback((timestamp: string) => {
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
    }, []);

    const handleRoomSelect = () => {
        dispatch(roomsActions.resetUnread(room.id));
        setRoomId(room.id);
    };

    const duplicateRoom = () => {
        const newRoomId = `${room.id.split('-')[0]}-${Date.now()}`;
        dispatch(roomsActions.duplicateRoom({ originalId: room.id, newId: newRoomId }));
        dispatch(messagesActions.duplicateMessages({ originalId: room.id, newId: newRoomId }));
    };

    return (
        <div
            className={`chat-room-item group relative cursor-pointer transition-all duration-200 select-none ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                }`}
            data-chat-id={room.id}
        >
            <div
                {...(useDoubleClick ? { onDoubleClick: handleRoomSelect } : { onClick: handleRoomSelect })}
                className="flex items-center justify-between p-3"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {room.name}
                        </h4>
                        <div className="flex items-center space-x-2 ml-2">
                            {lastMessage?.createdAt && (
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                    {formatTime(lastMessage.createdAt)}
                                </span>
                            )}
                            {unreadCount > 0 && (
                                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[18px] text-center">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                        {getMessageDisplayText(lastMessage)}
                    </p>
                </div>
            </div>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
                <button
                    onClick={duplicateRoom}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-blue-100 hover:bg-blue-200 rounded-full text-blue-600"
                    title="채팅방 복제"
                >
                    <Copy className="w-3 h-3" />
                </button>

                <button
                    onClick={() => {
                        if (confirm('채팅방을 삭제하시겠습니까?')) {
                            dispatch(roomsActions.removeOne(room.id));
                        }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-red-100 hover:bg-red-200 rounded-full text-red-600"
                    title="채팅방 삭제"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

export default memo(RoomList);
