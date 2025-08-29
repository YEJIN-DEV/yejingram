import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { type AppDispatch, type RootState } from '../../app/store';
import { selectRoomById } from '../../entities/room/selectors';
import { roomsActions } from '../../entities/room/slice';
import { selectEditingRoomId } from '../../entities/setting/selectors';
import { selectAllCharacters } from '../../entities/character/selectors';
import type { GroupChatSettings, ParticipantSettings } from '../../entities/room/types';
import type { Character } from '../../entities/character/types';
import { settingsActions } from '../../entities/setting/slice';
import { Avatar } from '../../utils/Avatar';
import { messagesActions } from '../../entities/message/slice';
import { nanoid } from '@reduxjs/toolkit';
import type { Message } from '../../entities/message/types';

interface EditGroupChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function EditGroupChatModal({ isOpen, onClose }: EditGroupChatModalProps) {
    const dispatch = useDispatch<AppDispatch>();
    const editingRoomId = useSelector(selectEditingRoomId);
    const room = useSelector((state: RootState) => editingRoomId ? selectRoomById(state, editingRoomId) : null);
    const allCharacters = useSelector(selectAllCharacters);

    const [name, setName] = useState('');
    const [settings, setSettings] = useState<GroupChatSettings | undefined>(undefined);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [selectedInviteId, setSelectedInviteId] = useState<number | null>(null);
    const uninvitedCharacters = allCharacters.filter(c => !room?.memberIds.includes(c.id));
    const getInitialParticipantSettings = () => ({ isActive: true, responseProbability: 0.9 });

    useEffect(() => {
        if (room) {
            setName(room.name);
            setSettings(room.groupSettings);
        }
    }, [room]);

    if (!isOpen) return null;

    if (!room || !settings) return null;

    const participants = room.memberIds.map(id => allCharacters.find(c => c.id === id)).filter((c): c is Character => !!c);

    const handleClose = () => {
        dispatch(settingsActions.resetEditingRoomId());
        onClose();
    };

    const handleSave = () => {
        if (name.trim()) {
            dispatch(roomsActions.upsertOne({ ...room, name: name.trim(), groupSettings: settings }));
            handleClose();
        }
    };

    const handleSettingChange = (key: keyof GroupChatSettings, value: any) => {
        setSettings(prev => prev ? { ...prev, [key]: value } : undefined);
    };

    const handleParticipantSettingChange = (charId: number, key: keyof ParticipantSettings, value: any) => {
        setSettings(prev => {
            if (!prev) return undefined;
            const participantSettings = { ...prev.participantSettings[charId], [key]: value };
            return { ...prev, participantSettings: { ...prev.participantSettings, [charId]: participantSettings } };
        });
    };

    // Handle inviting a new participant
    const handleInvite = () => {
        setInviteDialogOpen(true);
        setSelectedInviteId(null);
    };

    const handleInviteConfirm = () => {
        if (selectedInviteId && settings && room) {
            // Add to memberIds and participantSettings
            const updatedMemberIds = [...room.memberIds, selectedInviteId];
            const updatedParticipantSettings = {
                ...settings.participantSettings,
                [selectedInviteId]: getInitialParticipantSettings(),
            };
            dispatch(roomsActions.upsertOne({
                ...room,
                memberIds: updatedMemberIds,
                groupSettings: {
                    ...settings,
                    participantSettings: updatedParticipantSettings,
                },
            }));
            // Add system message
            const invitedUsersName = allCharacters.find(c => c.id === selectedInviteId)?.name || 'Unknown';
            const invitationMessage = {
                id: nanoid(),
                roomId: room.id,
                authorId: 0,
                content: `${invitedUsersName}님이 초대되었습니다.`,
                createdAt: new Date().toISOString(),
                type: 'SYSTEM'
            } as Message;
            dispatch(messagesActions.upsertOne(invitationMessage));
            setInviteDialogOpen(false);
            setSelectedInviteId(null);
        }
    };

    const handleInviteCancel = () => {
        setInviteDialogOpen(false);
        setSelectedInviteId(null);
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                    <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900">단톡방 설정</h2>
                            <button onClick={handleClose} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">단톡방 이름</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                className="w-full p-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none" />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900">응답 설정</h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <span>채팅방 응답 빈도 ({Math.round(settings.responseFrequency * 100)}%)</span>
                                    <span className="text-xs text-gray-500 ml-2">0%: 입력에 반응하지 않음, 100%: 입력에 항상 반응함</span>
                                </label>
                                <input type="range" min="0" max="100" value={Math.round(settings.responseFrequency * 100)}
                                    onChange={e => handleSettingChange('responseFrequency', parseInt(e.target.value) / 100)}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">최대 동시 응답 캐릭터 수</label>
                                <div className="relative">
                                    <input type="number" min="1" max={participants.length} value={settings.maxRespondingCharacters}
                                        onChange={e => handleSettingChange('maxRespondingCharacters', parseInt(e.target.value))}
                                        className="w-full p-3 pr-10 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none" />
                                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-500">명</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900">개별 캐릭터 설정</h3>
                            <div className="space-y-4">
                                {participants.map(participant => (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        <label key={participant.id} className="flex flex-col p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors border border-gray-100">
                                            <div className="flex items-center flex-1 mb-2">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <Avatar char={participant} size="md" />
                                                    <div>
                                                        <div className="font-medium text-gray-900">{participant.name}</div>
                                                        {/* <div className="text-sm text-gray-500 truncate">{char.description}</div> */}
                                                    </div>
                                                </div>
                                                <input
                                                    id={`active-${participant.id}`}
                                                    type="checkbox"
                                                    checked={settings.participantSettings[participant.id]?.isActive !== false}
                                                    onChange={e => handleParticipantSettingChange(participant.id, 'isActive', e.target.checked)}
                                                    className="group-chat-participant mr-3 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                응답 활성화
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    <span>캐릭터 응답 빈도 ({Math.round(settings.participantSettings[participant.id]?.responseProbability * 100)}%)</span>
                                                    <span className="text-xs text-gray-500 ml-2">0%: 응답하지 않음, 100%: 항상 응답</span>
                                                </label>
                                                <input type="range" min="0" max="100" value={Math.round(settings.participantSettings[participant.id]?.responseProbability * 100)}
                                                    onChange={e => handleParticipantSettingChange(participant.id, 'responseProbability', parseInt(e.target.value) / 100)}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb" />
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <button onClick={handleInvite} className="px-6 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl transition-colors font-medium mr-auto">참여자 추가</button>
                            <button onClick={handleClose} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium">취소</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium">저장</button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Invite Dialog */}
            {inviteDialogOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">참여자 추가</h3>
                            <button onClick={handleInviteCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-2 overflow-y-auto flex-1">
                            {uninvitedCharacters.length === 0 ? (
                                <div className="text-gray-500 text-center">추가할 수 있는 캐릭터가 없습니다.</div>
                            ) : (
                                uninvitedCharacters.map(char => (
                                    <label key={char.id} className={`flex items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors border border-gray-100 ${selectedInviteId === char.id ? 'ring-2 ring-blue-400' : ''}`}>
                                        <input
                                            type="radio"
                                            name="invite-character"
                                            value={char.id}
                                            checked={selectedInviteId === char.id}
                                            onChange={() => setSelectedInviteId(char.id)}
                                            className="mr-3 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex items-center gap-3 flex-1">
                                            <Avatar char={char} size="md" />
                                            <div>
                                                <div className="font-medium text-gray-900">{char.name}</div>
                                            </div>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button onClick={handleInviteCancel} className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium">취소</button>
                            <button
                                onClick={handleInviteConfirm}
                                className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors disabled:bg-gray-300 disabled:text-gray-500 font-medium"
                                disabled={selectedInviteId === null}
                            >
                                초대
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default EditGroupChatModal;