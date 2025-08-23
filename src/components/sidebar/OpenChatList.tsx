import { Globe, Plus } from 'lucide-react';
import type { Room } from '../../entities/room/types';
import OpenChatItem from './OpenChatItem';
import { useDispatch } from 'react-redux';
import { settingsActions } from '../../entities/setting/slice';

interface OpenChatListProps {
    rooms: Room[];
    setRoomId: (id: string | null) => void;
    selectedRoomId: string | null;
    openCreateOpenChatModal: () => void;
}

function OpenChatList({ rooms, setRoomId, selectedRoomId, openCreateOpenChatModal }: OpenChatListProps) {
    const dispatch = useDispatch();
    // const handleCreateOpenChat = () => dispatch(settingsActions.openCreateOpenChatModal());

    return (
        <div className="mb-4">
            <div className="group flex items-center justify-between px-1 mb-2 relative">
                <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-medium text-gray-300">오픈톡방</h3>
                </div>
                <button onClick={openCreateOpenChatModal} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-gray-700 hover:bg-green-600 rounded text-gray-300 hover:text-white transition-colors" title="새 오픈톡방">
                    <Plus className="w-3 h-3" />
                </button>
            </div>
            {rooms.map(room => (
                <OpenChatItem key={room.id} room={room} setRoomId={setRoomId} isSelected={selectedRoomId === room.id} />
            ))}
        </div>
    );
}

export default OpenChatList;