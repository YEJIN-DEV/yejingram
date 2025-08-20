import { Users, Plus } from 'lucide-react';
import type { Room } from '../../entities/room/types';
import GroupChatItem from './GroupChatItem';
import { useDispatch } from 'react-redux';
import { settingsActions } from '../../entities/setting/slice';

interface GroupChatListProps {
    rooms: Room[];
    setRoomId: (id: string | null) => void;
    selectedRoomId: string | null
}

function GroupChatList({ rooms, setRoomId, selectedRoomId }: GroupChatListProps) {
    const dispatch = useDispatch();
    const handleCreateGroupChat = () => dispatch(settingsActions.openCreateGroupChatModal());

    return (
        <div className="mb-4">
            <div className="group flex items-center justify-between px-1 mb-2 relative">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-medium text-gray-300">단톡방</h3>
                </div>
                <button onClick={handleCreateGroupChat} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-gray-700 hover:bg-blue-600 rounded text-gray-300 hover:text-white transition-colors" title="새 단톡방">
                    <Plus className="w-3 h-3" />
                </button>
            </div>
            {rooms.map(room => (
                <GroupChatItem key={room.id} room={room} setRoomId={setRoomId} isSelected={selectedRoomId === room.id} />
            ))}
        </div>
    );
}

export default GroupChatList;