import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { type RootState } from '../../app/store';
import { selectRoomById } from '../../entities/room/selectors';
import { roomsActions } from '../../entities/room/slice';
import { selectEditingRoomId } from '../../entities/setting/selectors';
import { selectAllCharacters } from '../../entities/character/selectors';
import type { GroupChatSettings, ParticipantSettings } from '../../entities/room/types';
import type { Character } from '../../entities/character/types';
import { settingsActions } from '../../entities/setting/slice';

interface EditGroupChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function EditGroupChatModal({ isOpen, onClose }: EditGroupChatModalProps) {
    const dispatch = useDispatch();
    const editingRoomId = useSelector(selectEditingRoomId);
    const room = useSelector((state: RootState) => editingRoomId ? selectRoomById(state, editingRoomId) : null);
    const allCharacters = useSelector(selectAllCharacters);

    const [name, setName] = useState('');
    const [settings, setSettings] = useState<GroupChatSettings | undefined>(undefined);

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

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gray-800 px-6 py-4 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-white">단톡방 설정</h2>
                        <button onClick={handleClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">단톡방 이름</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                            className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">응답 설정</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                <span>전체 응답 빈도 ({Math.round(settings.responseFrequency * 100)}%)</span>
                            </label>
                            <input type="range" min="0" max="100" value={Math.round(settings.responseFrequency * 100)}
                                onChange={e => handleSettingChange('responseFrequency', parseInt(e.target.value) / 100)}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">최대 동시 응답 캐릭터 수</label>
                            <select value={settings.maxRespondingCharacters} onChange={e => handleSettingChange('maxRespondingCharacters', parseInt(e.target.value))}
                                className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600">
                                {[...Array(participants.length).keys()].map(i => (
                                    <option key={i + 1} value={i + 1}>{i + 1}명</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">개별 캐릭터 설정</h3>
                        <div className="space-y-4">
                            {participants.map(participant => (
                                <div key={participant.id} className="bg-gray-700 p-4 rounded-lg">
                                    <h4 className="font-medium text-white mb-3">{participant.name}</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id={`active-${participant.id}`}
                                                checked={settings.participantSettings[participant.id]?.isActive !== false}
                                                onChange={e => handleParticipantSettingChange(participant.id, 'isActive', e.target.checked)} />
                                            <label htmlFor={`active-${participant.id}`} className="text-sm text-gray-300">응답 활성화</label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                        <button onClick={handleClose} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors">취소</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">저장</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EditGroupChatModal;