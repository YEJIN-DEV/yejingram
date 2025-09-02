import { Globe, Plus } from 'lucide-react';
import type { Room } from '../../entities/room/types';
import OpenChatItem from './OpenChatItem';

interface OpenChatListProps {
    rooms: Room[];
    setRoomId: (id: string | null) => void;
    selectedRoomId: string | null;
    openCreateOpenChatModal: () => void;
}

function OpenChatList({ rooms, setRoomId, selectedRoomId, openCreateOpenChatModal }: OpenChatListProps) {
    if (rooms.length === 0) return null;

    return (
        <div className="border-b border-gray-100">
            <div className="group flex items-center justify-between px-4 py-2 bg-gray-50">
                <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-700">오픈 채팅</h3>
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {rooms.length}
                    </span>
                </div>
                <button
                    onClick={openCreateOpenChatModal}
                    className="opacity-0 group-hover:opacity-100 transition-all p-1 bg-green-100 hover:bg-green-200 rounded-full text-green-600"
                    title="새 오픈 채팅"
                >
                    <Plus className="w-3 h-3" />
                </button>
            </div>
            <div>
                {rooms.map(room => (
                    <OpenChatItem
                        key={room.id}
                        room={room}
                        setRoomId={setRoomId}
                        isSelected={selectedRoomId === room.id}
                    />
                ))}
            </div>
        </div>
    );
}

export default OpenChatList;