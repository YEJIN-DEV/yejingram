import { Trash2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import type { Room } from '../../entities/room/types';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import { roomsActions } from '../../entities/room/slice';

interface RoomListProps {
    room: Room;
    unreadCount: number;
    setRoomId: (id: string | null) => void;
}

function getLastMessageContent(state: RootState, roomId: string) {
    const messages = selectMessagesByRoomId(state, roomId);
    if (messages.length === 0) return '채팅을 시작해보세요';

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.type === 'IMAGE') return '이미지를 보냈습니다';
    if (lastMessage.type === 'STICKER') return '스티커를 보냈습니다';
    return lastMessage.content;
}

function RoomList({
    room,
    unreadCount,
    setRoomId
}: RoomListProps) {
    const dispatch = useDispatch();
    const lastMessage = useSelector((state: RootState) => getLastMessageContent(state, room.id));

    return (
        <div className="chat-room-item group p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-700 relative" data-chat-id={room.id}>
            <div className="flex items-center justify-between">
                <div onClick={() => {
                    dispatch(roomsActions.resetUnread(room.id));
                    setRoomId(room.id)
                }} className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-white truncate">{room.name}</h4>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && <span className="bg-red-500 text-white text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full leading-none">{unreadCount}</span>}
                            {/* <span className="text-xs text-gray-400 shrink-0">${postMessage?.time || ''}</span> */}
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{lastMessage}</p>
                </div>
            </div>
            <button onClick={() => dispatch(roomsActions.removeOne(room.id))} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-red-600 hover:bg-red-700 rounded text-white" title="채팅방 삭제">
                <Trash2 className="w-3 h-3" />
            </button>
        </div >
    );
};

export default RoomList;
