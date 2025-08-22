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
    isSelected: boolean;
}

function getLastMessageContent(state: RootState, roomId: string) {
    const messages = selectMessagesByRoomId(state, roomId);
    return messages[messages.length - 1];
}

function RoomList({
    room,
    unreadCount,
    setRoomId,
    isSelected
}: RoomListProps) {
    const dispatch = useDispatch();
    const lastMessage = useSelector((state: RootState) => getLastMessageContent(state, room.id));

    return (
        <div className={`chat-room-item group p-2 rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? 'bg-blue-600' : 'hover:bg-gray-700'} relative`} data-chat-id={room.id}>
            <div className="flex items-center justify-between">
                <div onClick={() => {
                    dispatch(roomsActions.resetUnread(room.id));
                    setRoomId(room.id)
                }} className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-white truncate">{room.name}</h4>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && <span className="bg-red-500 text-white text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full leading-none">{unreadCount}</span>}
                            <span className="text-xs text-gray-400 shrink-0">{lastMessage?.createdAt ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{
                        lastMessage?.type === 'IMAGE' ? '이미지를 보냈습니다' :
                            lastMessage?.type === 'STICKER' ? '스티커를 보냈습니다' :
                                lastMessage?.content || '채팅을 시작해보세요'
                    }</p>
                </div>
            </div>
            <button onClick={() => dispatch(roomsActions.removeOne(room.id))} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-red-600 hover:bg-red-700 rounded text-white" title="채팅방 삭제">
                <Trash2 className="w-3 h-3" />
            </button>
        </div >
    );
};

export default RoomList;
