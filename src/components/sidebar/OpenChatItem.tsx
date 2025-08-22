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

    let lastMessageContent = '대화를 시작해보세요';
    if (lastMessage) {
        if (lastMessage.type === 'IMAGE') {
            lastMessageContent = '이미지를 보냈습니다';
        } else if (lastMessage.type === 'STICKER') {
            lastMessageContent = '스티커를 보냈습니다';
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

    return (
        <div
            className={`relative group cursor-pointer rounded-xl transition-all duration-200 ${isSelected ? 'bg-blue-600/20' : 'hover:bg-gray-800/50'}`}
            onClick={() => !isEditing && setRoomId(room.id)}
        >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
                <button onClick={handleEdit} className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors" title="수정">
                    <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={handleDelete} className="p-1 bg-gray-700 hover:bg-red-600 rounded text-gray-300 hover:text-white transition-colors" title="삭제">
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
            <div className="flex items-center gap-3 p-3">
                <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Globe className="w-6 h-6 text-white" />
                    </div>
                    {room.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                            {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="flex items-center gap-2 mb-1">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="bg-gray-700 text-white text-sm font-semibold rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(e); } if (e.key === 'Escape') handleCancel(e); }}
                            />
                            <button onClick={handleSave} className="p-1 text-green-400 hover:text-green-300">
                                <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancel} className="p-1 text-red-400 hover:text-red-300">
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-white truncate">{room.name}</h4>
                            {lastMessage && <span className="text-xs text-gray-500 ml-2">{lastMessage?.createdAt ? new Date(lastMessage?.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>}
                        </div>
                    )}
                    <p className="text-sm text-gray-400 truncate">{currentParticipants.length}명 접속중</p>
                    <p className="text-xs text-gray-500 truncate mt-1">{lastMessageContent}</p>
                </div>
            </div>
        </div>
    );
}

export default OpenChatItem;