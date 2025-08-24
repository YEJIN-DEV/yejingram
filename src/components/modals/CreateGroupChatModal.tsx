import { useState } from 'react';
import { X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllCharacters } from '../../entities/character/selectors';
import { roomsActions } from '../../entities/room/slice';
import type { Character } from '../../entities/character/types';
import { Avatar } from '../../utils/Avatar';
import { nanoid } from '@reduxjs/toolkit';

interface CreateGroupChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function CreateGroupChatModal({ isOpen, onClose }: CreateGroupChatModalProps) {
    const dispatch = useDispatch();
    const characters = useSelector(selectAllCharacters);
    const [groupName, setGroupName] = useState('');
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);

    if (!isOpen) {
        return null;
    }

    const handleParticipantSelect = (characterId: number) => {
        setSelectedParticipantIds(prev =>
            prev.includes(characterId)
                ? prev.filter(id => id !== characterId)
                : [...prev, characterId]
        );
    };

    const handleCreateGroupChat = () => {
        if (groupName.trim() && selectedParticipantIds.length >= 2) {
            const newRoom = {
                id: nanoid(),
                name: groupName.trim(),
                memberIds: selectedParticipantIds,
                type: 'Group' as const,
                lastMessageId: null,
                unreadCount: 0,
                groupSettings: { // Default settings
                    responseFrequency: 0.8,
                    maxRespondingCharacters: 2,
                    responseDelay: 800,
                    participantSettings: {},
                }
            };
            dispatch(roomsActions.upsertOne(newRoom));
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl w-full max-w-md mx-4" style={{ maxHeight: '90vh' }}>
                <div className="p-6 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">단톡방 만들기</h3>
                        <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">단톡방 이름</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="단톡방 이름을 입력하세요"
                            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">참여할 캐릭터 선택 (최소 2명)</label>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {characters.map((char: Character) => (
                                <label key={char.id} className="flex items-center p-3 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        value={char.id}
                                        checked={selectedParticipantIds.includes(char.id)}
                                        onChange={() => handleParticipantSelect(char.id)}
                                        className="group-chat-participant mr-3 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
                                    />
                                    <div className="flex items-center gap-3 flex-1">
                                        <Avatar char={char} size="md" />
                                        <div>
                                            <div className="font-medium text-white">{char.name}</div>
                                            {/* <div className="text-sm text-gray-400 truncate">{char.description}</div> */}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-gray-700 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
                        취소
                    </button>
                    <button onClick={handleCreateGroupChat} className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:bg-gray-500" disabled={!groupName.trim() || selectedParticipantIds.length < 2}>
                        만들기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupChatModal;