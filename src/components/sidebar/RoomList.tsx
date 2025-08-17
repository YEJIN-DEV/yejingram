import type { Character } from '../../entities/character/types';
import { Trash2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import { selectAllRooms } from '../../entities/room/selectors';
import type { Room } from '../../entities/room/types';
import { selectMessagesByRoomId } from '../../entities/message/selectors';

interface RoomListProps {
    character: Character;
    room: Room;
    unreadCount: number;
    setRoom: (room: Room | null) => void;
}

function RoomList({
    character,
    room,
    unreadCount,
    setRoom
}: RoomListProps) {
    const lastMessage = useSelector((state: RootState) => selectMessagesByRoomId(state, room.id))[-1];

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

    return (
        <div className="chat-room-item group p-2 rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? 'bg-blue-600' : 'hover:bg-gray-700'} relative" data-chat-id="${chatRoom.id}">
            <div className="flex items-center justify-between">
                <div onClick={() => setRoom(room)} className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-white truncate">{room.name}</h4>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 ? <span className="bg-red-500 text-white text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full leading-none">{unreadCount}</span> : ''}
                            {/* <span className="text-xs text-gray-400 shrink-0">${postMessage?.time || ''}</span> */}
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{lastMessageContent}</p>
                </div>
            </div>
            <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-red-600 hover:bg-red-700 rounded text-white" title="채팅방 삭제">
                <Trash2 className="w-3 h-3" />
            </button>
        </div >
    );
};

export default RoomList;
