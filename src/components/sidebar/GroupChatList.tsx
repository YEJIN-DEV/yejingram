import { Users, Plus } from 'lucide-react';
import type { Room } from '../../entities/room/types';
import GroupChatItem from './GroupChatItem';
import { useSelector } from 'react-redux';
import { selectIsDarkMode } from '../../entities/theme/selectors';

interface GroupChatListProps {
    rooms: Room[];
    setRoomId: (id: string | null) => void;
    selectedRoomId: string | null;
    openCreateGroupChatModal: () => void;
    openEditGroupChatModal: () => void;
}

function GroupChatList({ rooms, setRoomId, selectedRoomId, openCreateGroupChatModal, openEditGroupChatModal }: GroupChatListProps) {
    const isDarkMode = useSelector(selectIsDarkMode);
    if (rooms.length === 0) return null;

    return (
        <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className={`group flex items-center justify-between px-4 py-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center space-x-2">
                    <Users className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>그룹 채팅</h3>
                    <span className={`text-xs ${isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'} px-2 py-0.5 rounded-full`}>
                        {rooms.length}
                    </span>
                </div>
                <button
                    onClick={openCreateGroupChatModal}
                    className={`opacity-0 group-hover:opacity-100 transition-all p-1 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-blue-200' : 'bg-blue-100 hover:bg-blue-200 text-blue-600'} rounded-full`}
                    title="새 그룹 채팅"
                >
                    <Plus className="w-3 h-3" />
                </button>
            </div>
            <div>
                {rooms.map(room => (
                    <GroupChatItem
                        key={room.id}
                        room={room}
                        setRoomId={setRoomId}
                        isSelected={selectedRoomId === room.id}
                        openEditGroupChatModal={openEditGroupChatModal}
                    />
                ))}
            </div>
        </div>
    );
}

export default GroupChatList;