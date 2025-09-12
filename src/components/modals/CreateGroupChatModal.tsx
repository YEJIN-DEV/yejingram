import { useState } from 'react';
import { X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllCharacters } from '../../entities/character/selectors';
import { selectIsDarkMode } from '../../entities/theme/selectors';
import { roomsActions } from '../../entities/room/slice';
import type { Character } from '../../entities/character/types';
import { Avatar } from '../../utils/Avatar';
import { nanoid } from '@reduxjs/toolkit';
import type { ParticipantSettings } from '../../entities/room/types';
import { useFirstMessage } from '../../hooks/useFirstMessage';

interface CreateGroupChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function CreateGroupChatModal({ isOpen, onClose }: CreateGroupChatModalProps) {
    const dispatch = useDispatch();
    const characters = useSelector(selectAllCharacters);
    const isDarkMode = useSelector(selectIsDarkMode);
    const { scheduleForNewRoom } = useFirstMessage();
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
    const [participantSettings, setParticipantSettings] = useState<Record<number, ParticipantSettings>>({});

    if (!isOpen) {
        return null;
    }

    const initializeState = () => {
        setGroupName('');
        setGroupDescription('');
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
                description: groupDescription.trim() || undefined,
                memberIds: selectedParticipantIds,
                type: 'Group' as const,
                lastMessageId: null,
                unreadCount: 0,
                groupSettings: { // Default settings
                    responseFrequency: 0.8,
                    maxRespondingCharacters: 2,
                    responseDelay: 800,
                    participantSettings: participantSettings,
                    firstMessageEnabled: false, // 기본값: 비활성화
                    firstMessageFrequencyMin: 30,
                    firstMessageFrequencyMax: 120,
                    characterInteractionEnabled: false, // 기본값: 비활성화
                    characterInteractionCount: 3        // 기본값: 3회
                }
            };
            dispatch(roomsActions.upsertOne(newRoom));
            
            // 새로운 그룹 채팅에 대해 선톡 스케줄링
            scheduleForNewRoom(newRoom);
            
            initializeState();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-md mx-4 shadow-xl`} style={{ maxHeight: '90vh' }}>
                <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>그룹 채팅 만들기</h3>
                        <button onClick={onClose} className={`p-2 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-full transition-colors`}>
                            <X className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                    <div>
                        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>그룹 채팅 이름</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="그룹 채팅 이름을 입력하세요"
                            className={`w-full px-3 py-2 ${isDarkMode ? 'bg-gray-700 text-gray-100 border-gray-600 focus:border-blue-400' : 'bg-gray-50 text-gray-900 border-gray-200 focus:border-blue-500'} rounded-xl border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`}
                        />
                    </div>
                    
                    <div>
                        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>그룹 설명</label>
                        <textarea
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            placeholder="채팅 목적이나 분위기를 설명해주세요 (예: 일상 대화, 게임 토론, 스터디 등)"
                            rows={3}
                            className={`w-full px-3 py-2 ${isDarkMode ? 'bg-gray-700 text-gray-100 border-gray-600 focus:border-blue-400 placeholder-gray-400' : 'bg-gray-50 text-gray-900 border-gray-200 focus:border-blue-500 placeholder-gray-500'} rounded-xl border focus:ring-2 focus:ring-blue-500/50 focus:outline-none resize-none`}
                        />
                        <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>설정은 작성하면 캐릭터들이 이 내용을 고려하여 대화에 참여합니다.</p>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>참여할 캐릭터 선택</label>
                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                {selectedParticipantIds.length}명 선택됨
                            </span>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {characters.map((char: Character) => (
                                <label key={char.id} className={`flex items-center p-3 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 border-gray-600' : 'bg-gray-50 hover:bg-gray-100 border-gray-100'} rounded-xl cursor-pointer transition-colors border`}>
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
                                            <div className={`font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{char.name}</div>
                                            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                                                {char.prompt.substring(0, 50) + (char.prompt.length > 50 ? '...' : '') || `${char.name}과 함께 채팅하기`}
                                            </div>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {selectedParticipantIds.length > 0 && (
                            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mt-2`}>
                                선택된 캐릭터들이 대화에 참여합니다.
                            </p>
                        )}
                    </div>
                </div>
                <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex gap-3`}>
                    <button onClick={() => {
                        initializeState();
                        onClose();
                    }} className={`flex-1 py-2 px-4 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} rounded-xl transition-colors font-medium`}>
                        취소
                    </button>
                    <button onClick={handleCreateGroupChat} className={`flex-1 py-2 px-4 ${
                        !groupName.trim() || selectedParticipantIds.length < 1
                            ? (isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-300 text-gray-500')
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                    } rounded-xl transition-colors font-medium`} disabled={!groupName.trim() || selectedParticipantIds.length < 1}>
                        만들기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupChatModal;