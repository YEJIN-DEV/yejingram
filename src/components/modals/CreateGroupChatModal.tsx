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
        <div className="fixed inset-0 bg-[var(--color-bg-shadow)]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-bg-main)] rounded-2xl w-full max-w-md mx-4 shadow-xl" style={{ maxHeight: '90vh' }}>
                <div className="p-6 border-b border-[var(--color-border)]">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">그룹 채팅 만들기</h3>
                        <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors">
                            <X className="w-5 h-5 text-[var(--color-icon-tertiary)]" />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-interface)] mb-2">그룹 채팅 이름</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="그룹 채팅 이름을 입력하세요"
                            className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:border-[var(--color-focus-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-interface)] mb-2">캐릭터 초대</label>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {characters.map((char: Character) => (
                                <label key={char.id} className="flex items-center p-3 bg-[var(--color-bg-input-secondary)] rounded-xl hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors border border-[var(--color-border-secondary)]">
                                    <input
                                        type="checkbox"
                                        value={char.id}
                                        checked={selectedParticipantIds.includes(char.id)}
                                        onChange={() => handleParticipantSelect(char.id)}
                                        className="group-chat-participant mr-3 text-[var(--color-button-primary-accent)] bg-[var(--color-bg-main)] border-[var(--color-border-strong)] rounded focus:ring-[var(--color-focus-border)]"
                                    />
                                    <div className="flex items-center gap-3 flex-1">
                                        <Avatar char={char} size="md" />
                                        <div>
                                            <div className="font-medium text-[var(--color-text-primary)]">{char.name}</div>
                                            {/* <div className="text-sm text-[var(--color-icon-tertiary)] truncate">{char.description}</div> */}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
                    <button onClick={() => {
                        initializeState();
                        onClose();
                    }} className="flex-1 py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-xl transition-colors font-medium">
                        취소
                    </button>
                    <button onClick={handleCreateGroupChat} className="flex-1 py-2 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-xl transition-colors disabled:bg-[var(--color-button-disabled)] disabled:text-[var(--color-icon-tertiary)] font-medium" disabled={!groupName.trim() || selectedParticipantIds.length < 1}>
                        만들기
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupChatModal;