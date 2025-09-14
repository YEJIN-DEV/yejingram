import { useState } from 'react';
import { X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllCharacters } from '../../entities/character/selectors';
import { roomsActions } from '../../entities/room/slice';
import type { Character } from '../../entities/character/types';
import { Avatar } from '../../utils/Avatar';
import { nanoid } from '@reduxjs/toolkit';
import type { ParticipantSettings } from '../../entities/room/types';

interface CreateGroupChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function CreateGroupChatModal({ isOpen, onClose }: CreateGroupChatModalProps) {
    const dispatch = useDispatch();
    const characters = useSelector(selectAllCharacters);
    const [groupName, setGroupName] = useState('');
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
    const [participantSettings, setParticipantSettings] = useState<Record<number, ParticipantSettings>>({});

    if (!isOpen) {
        return null;
    }

    const initializeState = () => {
        setGroupName('');
        setSelectedParticipantIds([]);
        setParticipantSettings({});
    };

    const handleParticipantSelect = (characterId: number) => {
        setSelectedParticipantIds(prev =>
            prev.includes(characterId)
                ? prev.filter(id => id !== characterId)
                : [...prev, characterId]
        );
        setParticipantSettings(prev => ({
            ...prev,
            [characterId]: prev[characterId] || { isActive: true, responseProbability: 0.9 }
        }));
    };

    const handleCreateGroupChat = () => {
        if (groupName.trim() && selectedParticipantIds.length >= 1) {
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
                    participantSettings: participantSettings,
                }
            };
            dispatch(roomsActions.upsertOne(newRoom));
            initializeState();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-xl" style={{ maxHeight: '90vh' }}>
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">그룹 채팅 만들기</h3>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">그룹 채팅 이름</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="그룹 채팅 이름을 입력하세요"
                            className="w-full px-3 py-2 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">캐릭터 초대</label>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {characters.map((char: Character) => (
                                <label key={char.id} className="flex items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors border border-gray-100">
                                    <input
                                        type="checkbox"
                                        value={char.id}
                                        checked={selectedParticipantIds.includes(char.id)}
                                        onChange={() => handleParticipantSelect(char.id)}
                                        className="group-chat-participant mr-3 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <div className="flex items-center gap-3 flex-1">
                                        <Avatar char={char} size="md" />
                                        <div>
                                            <div className="font-medium text-gray-900">{char.name}</div>
                                            {/* <div className="text-sm text-gray-500 truncate">{char.description}</div> */}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button onClick={() => {
                        initializeState();
                        onClose();
                    }} className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium">
                        취소
                    </button>
                    <button onClick={handleCreateGroupChat} className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors disabled:bg-gray-300 disabled:text-gray-500 font-medium" disabled={!groupName.trim() || selectedParticipantIds.length < 1}>
                        만들기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupChatModal;