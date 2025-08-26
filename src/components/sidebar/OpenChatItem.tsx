import { Globe, Trash2, Edit2, Check, XCircle } from 'lucide-react';
import type { Room } from '../../entities/room/types';
import { useSelector, useDispatch } from 'react-redux';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import { roomsActions } from '../../entities/room/slice';
import { useState } from 'react';

interface OpenChatItemProps {
    room: Room;
    setRoomId: (id: string | null) => void;
    isSelected: boolean;
}

function OpenChatItem({ room, setRoomId, isSelected }: OpenChatItemProps) {
    const dispatch = useDispatch();
    const messages = useSelector((state: any) => selectMessagesByRoomId(state, room.id));
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(room.name);

    let lastMessageContent = '새로운 메시지를 보내보세요';
    if (lastMessage) {
        if (lastMessage.type === 'IMAGE') {
            lastMessageContent = '사진';
        } else if (lastMessage.type === 'STICKER') {
            lastMessageContent = '스티커';
        } else {
            lastMessageContent = lastMessage.content;
        }
    }

    const currentParticipants = room.currentParticipants || [];

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`'${room.name}' 오픈톡방을 삭제하시겠습니까?`)) {
            dispatch(roomsActions.removeOne(room.id));
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleSave = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        if (newName.trim()) {
            dispatch(roomsActions.upsertOne({ ...room, name: newName.trim() }));
        }
        setIsEditing(false);
    };

    const handleCancel = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        setIsEditing(false);
        setNewName(room.name);
    };

    const formatTime = (timestamp: string) => {
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
    };

    return (
        <div
            className={`relative group cursor-pointer transition-all duration-200 px-4 py-3 select-none ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                }`}
            onDoubleClick={() => !isEditing && setRoomId(room.id)}
        >
            <div className="absolute top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
                <button
                    onClick={handleEdit}
                    className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 hover:text-gray-800 transition-colors"
                    title="수정"
                >
                    <Edit2 className="w-3 h-3" />
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
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                        <Globe className="w-6 h-6 text-white" />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="flex-1 bg-gray-100 text-gray-900 text-sm font-semibold rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave(e);
                                    if (e.key === 'Escape') handleCancel(e);
                                }}
                            />
                            <button onClick={handleSave} className="p-1 text-green-600 hover:text-green-700">
                                <Check className="w-3 h-3" />
                            </button>
                            <button onClick={handleCancel} className="p-1 text-red-600 hover:text-red-700">
                                <XCircle className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between">
                                <h4 className={`font-semibold truncate text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'
                                    }`}>
                                    {room.name}
                                </h4>
                                <div className="flex items-center space-x-2 ml-2">
                                    {lastMessage?.createdAt && (
                                        <span className="text-xs text-gray-500 flex-shrink-0">
                                            {formatTime(lastMessage.createdAt)}
                                        </span>
                                    )}
                                    {room.unreadCount > 0 && (
                                        <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[18px] text-center">
                                            {room.unreadCount > 99 ? '99+' : room.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-1 space-y-1">
                                <p className="text-sm text-gray-500 truncate">
                                    {currentParticipants.length > 0
                                        ? `${currentParticipants.length}명 활성 · 오픈 채팅`
                                        : '오픈 채팅'
                                    }
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                    {lastMessageContent}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default OpenChatItem;