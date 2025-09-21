import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, X } from 'lucide-react';
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
import { inviteCharacter } from '../../utils/inviteCharacter';

interface EditGroupChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function EditGroupChatModal({ isOpen, onClose }: EditGroupChatModalProps) {
    const { t } = useTranslation();
    const dispatch = useDispatch<AppDispatch>();
    const editingRoomId = useSelector(selectEditingRoomId);
    const room = useSelector((state: RootState) => editingRoomId ? selectRoomById(state, editingRoomId) : null);
    const allCharacters = useSelector(selectAllCharacters);

    const [name, setName] = useState('');
    const [settings, setSettings] = useState<GroupChatSettings | undefined>(undefined);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [selectedInviteId, setSelectedInviteId] = useState<number | null>(null);
    const uninvitedCharacters = allCharacters.filter(c => !room?.memberIds.includes(c.id));

    // State for leave modal
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [leavingCharId, setLeavingCharId] = useState<number | null>(null);
    const [leaveReason, setLeaveReason] = useState(t('main.group.editModal.leave.reason.defaultLeaveReason'));
    const [customLeaveReason, setCustomLeaveReason] = useState('');

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
        inviteCharacter(selectedInviteId, room, allCharacters.find(c => c.id === selectedInviteId)?.name || t('main.group.editModal.unknown'), dispatch, t);
    };

    const handleInviteCancel = () => {
        setInviteDialogOpen(false);
        setSelectedInviteId(null);
    };

    // Handle leave button click
    const handleLeave = (charId: number) => {
        setLeavingCharId(charId);
        setLeaveReason(t('main.group.editModal.leave.reason.left'));
        setCustomLeaveReason('');
        setLeaveDialogOpen(true);
    };

    // Confirm leave
    const handleLeaveConfirm = () => {
        if (leavingCharId == null || !room || !settings) return;
        // Remove from memberIds
        const updatedMemberIds = room.memberIds.filter(id => id !== leavingCharId);
        // Remove from participantSettings
        const { [leavingCharId]: _, ...updatedParticipantSettings } = settings.participantSettings;
        dispatch(roomsActions.upsertOne({
            ...room,
            memberIds: updatedMemberIds,
            groupSettings: {
                ...settings,
                participantSettings: updatedParticipantSettings,
            },
        }));
        // Add system message
        const leavingUserName = allCharacters.find(c => c.id === leavingCharId)?.name || t('main.group.editModal.unknown');
        let reasonText = leaveReason;
        if (leaveReason === t('main.group.editModal.customInput')) {
            reasonText = customLeaveReason.trim() ? customLeaveReason : t('main.group.editModal.leftRoom');
        }
        const leaveMessage = {
            id: nanoid(),
            roomId: room.id,
            authorId: 0,
            content: t('main.group.editModal.leaveMessage', { name: leavingUserName, reason: reasonText }),
            createdAt: new Date().toISOString(),
            type: 'SYSTEM',
            leaveCharId: leavingCharId,
        } as Message;
        dispatch(messagesActions.upsertOne(leaveMessage));
        setLeaveDialogOpen(false);
        setLeavingCharId(null);
        setLeaveReason(t('main.group.editModal.leave.reason.left'));
        setCustomLeaveReason('');
    };

    const handleLeaveCancel = () => {
        setLeaveDialogOpen(false);
        setLeavingCharId(null);
        setLeaveReason(t('main.group.editModal.leave.reason.left'));
        setCustomLeaveReason('');
    };

    return (
        <>
            <div className="fixed inset-0 bg-[var(--color-bg-shadow)]/50 flex items-center justify-center z-50 p-4">
                <div className="bg-[var(--color-bg-main)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                    <div className="sticky top-0 bg-[var(--color-bg-main)] px-6 py-4 border-b border-[var(--color-border)] rounded-t-2xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{t('main.group.editModal.title')}</h2>
                            <button onClick={handleClose} className="p-2 text-[var(--color-icon-tertiary)] hover:text-[var(--color-icon-primary)] hover:bg-[var(--color-bg-hover)] rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-interface)] mb-2">{t('main.group.editModal.nameLabel')}</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                className="w-full p-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:border-[var(--color-focus-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:outline-none" />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('main.group.editModal.response.title')}</h3>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-interface)] mb-2">
                                    <span>{t('main.group.editModal.response.roomFreq', { value: Math.round(settings.responseFrequency * 100) })}</span>
                                    <span className="text-xs text-[var(--color-text-secondary)] ml-2">{t('main.group.editModal.response.freqHelp')}</span>
                                </label>
                                <input type="range" min="0" max="100" value={Math.round(settings.responseFrequency * 100)}
                                    onChange={e => handleSettingChange('responseFrequency', parseInt(e.target.value) / 100)}
                                    className="w-full h-2 bg-[var(--color-bg-secondary-accent)] rounded-lg appearance-none cursor-pointer slider-thumb" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-interface)] mb-2">{t('main.group.editModal.response.maxLabel')}</label>
                                <div className="relative">
                                    <input type="number" min="1" max={participants.length} value={settings.maxRespondingCharacters}
                                        onChange={e => handleSettingChange('maxRespondingCharacters', parseInt(e.target.value))}
                                        className="w-full p-3 pr-10 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:border-[var(--color-focus-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:outline-none" />
                                    <span className="absolute inset-y-0 right-3 flex items-center text-[var(--color-text-secondary)]">{t('units.peopleSuffix')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('main.group.editModal.participants.title')}</h3>
                            <div className="space-y-4">
                                {participants.map(participant => (
                                    <div key={participant.id} className="space-y-2 max-h-60 overflow-y-auto">
                                        <label className="flex flex-col p-3 bg-[var(--color-bg-input-secondary)] rounded-xl hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors border border-[var(--color-border-secondary)]">
                                            <div className="flex items-center flex-1 mb-2">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <Avatar char={participant} size="md" />
                                                    <div>
                                                        <div className="font-medium text-[var(--color-text-primary)]">{participant.name}</div>
                                                    </div>
                                                </div>
                                                <input
                                                    id={`active-${participant.id}`}
                                                    type="checkbox"
                                                    checked={settings.participantSettings[participant.id]?.isActive !== false}
                                                    onChange={e => handleParticipantSettingChange(participant.id, 'isActive', e.target.checked)}
                                                    className="group-chat-participant mr-3 text-[var(--color-button-primary-accent)] bg-[var(--color-bg-main)] border-[var(--color-border-strong)] rounded focus:ring-[var(--color-focus-border)]"
                                                />
                                                {t('main.group.editModal.participants.activate')}
                                                <button
                                                    type="button"
                                                    className="ml-2 opacity-100 transition-opacity duration-200 p-1 bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative-accent)] rounded-full text-[var(--color-text-accent)]"
                                                    title={t('main.group.editModal.participants.kick')}
                                                    onClick={() => handleLeave(participant.id)}
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-[var(--color-text-interface)]">
                                                    <span>{t('main.group.editModal.participants.probLabel', { value: Math.round(settings.participantSettings[participant.id]?.responseProbability * 100) })}</span>
                                                    <span className="text-xs text-[var(--color-text-secondary)] ml-2">{t('main.group.editModal.participants.probHelp')}</span>
                                                </label>
                                                <input type="range" min="0" max="100" value={Math.round(settings.participantSettings[participant.id]?.responseProbability * 100)}
                                                    onChange={e => handleParticipantSettingChange(participant.id, 'responseProbability', parseInt(e.target.value) / 100)}
                                                    className="w-full h-2 bg-[var(--color-bg-secondary-accent)] rounded-lg appearance-none cursor-pointer slider-thumb" />
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                            <button onClick={handleInvite} className="px-6 py-2 bg-[var(--color-button-positive)] hover:bg-[var(--color-button-positive-accent)] text-[var(--color-text-accent)] rounded-xl transition-colors font-medium mr-auto">{t('main.group.editModal.actions.invite')}</button>
                            <button onClick={handleClose} className="px-6 py-2 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-xl transition-colors font-medium">{t('common.cancel')}</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-xl transition-colors font-medium">{t('common.save')}</button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Invite Dialog */}
            {inviteDialogOpen && (
                <div className="fixed inset-0 bg-[var(--color-bg-shadow)]/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--color-bg-main)] rounded-2xl w-full max-w-md mx-4 shadow-xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('main.group.editModal.invite.title')}</h3>
                            <button onClick={handleInviteCancel} className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors">
                                <X className="w-5 h-5 text-[var(--color-icon-tertiary)]" />
                            </button>
                        </div>
                        <div className="p-6 space-y-2 overflow-y-auto flex-1">
                            {uninvitedCharacters.length === 0 ? (
                                <div className="text-[var(--color-text-secondary)] text-center">{t('main.group.editModal.invite.empty')}</div>
                            ) : (
                                uninvitedCharacters.map(char => (
                                    <label key={char.id} className={`flex items-center p-3 bg-[var(--color-bg-input-secondary)] rounded-xl hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors border border-[var(--color-border-secondary)] ${selectedInviteId === char.id ? 'ring-2 ring-[var(--color-focus-border)]' : ''}`}>
                                        <input
                                            type="radio"
                                            name="invite-character"
                                            value={char.id}
                                            checked={selectedInviteId === char.id}
                                            onChange={() => setSelectedInviteId(char.id)}
                                            className="mr-3 text-[var(--color-button-primary-accent)] bg-[var(--color-bg-main)] border-[var(--color-border-strong)] rounded focus:ring-[var(--color-focus-border)]"
                                        />
                                        <div className="flex items-center gap-3 flex-1">
                                            <Avatar char={char} size="md" />
                                            <div>
                                                <div className="font-medium text-[var(--color-text-primary)]">{char.name}</div>
                                            </div>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
                            <button onClick={handleInviteCancel} className="flex-1 py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-xl transition-colors font-medium">{t('common.cancel')}</button>
                            <button
                                onClick={handleInviteConfirm}
                                className="flex-1 py-2 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-xl transition-colors disabled:bg-[var(--color-button-disabled)] disabled:text-[var(--color-icon-tertiary)] font-medium"
                                disabled={selectedInviteId === null}
                            >
                                {t('main.group.editModal.invite.submit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Leave Dialog */}
            {leaveDialogOpen && (
                <div className="fixed inset-0 bg-[var(--color-bg-shadow)]/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--color-bg-main)] rounded-2xl w-full max-w-md mx-4 shadow-xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('main.group.editModal.leave.title')}</h3>
                            <button onClick={handleLeaveCancel} className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors">
                                <X className="w-5 h-5 text-[var(--color-icon-tertiary)]" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <label className="block text-m font-medium text-[var(--color-text-interface)] mb-5">{t('main.group.editModal.leave.whoLabel', { name: allCharacters.find(c => c.id === leavingCharId)?.name || t('main.group.editModal.unknown') })}</label>
                            <select
                                className="w-full p-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:border-[var(--color-focus-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:outline-none"
                                value={leaveReason}
                                onChange={e => setLeaveReason(e.target.value)}
                            >
                                <option value={t('main.group.editModal.leave.reason.left')}>{t('main.group.editModal.leave.reason.left')}</option>
                                <option value={t('main.group.editModal.leave.reason.leftRoom')}>{t('main.group.editModal.leave.reason.leftRoom')}</option>
                                <option value={t('main.group.editModal.leave.reason.exited')}>{t('main.group.editModal.leave.reason.exited')}</option>
                                <option value={t('main.group.editModal.leave.reason.forciblyRemoved')}>{t('main.group.editModal.leave.reason.forciblyRemoved')}</option>
                                <option value={t('main.group.editModal.leave.reason.blocked')}>{t('main.group.editModal.leave.reason.blocked')}</option>
                                <option value={t('main.group.editModal.leave.reason.customInput')}>{t('main.group.editModal.leave.reason.customInput')}</option>
                            </select>
                            {leaveReason === t('main.group.editModal.customInput') && (
                                <>
                                    <textarea
                                        className="w-full p-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:border-[var(--color-focus-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:outline-none min-h-[80px]"
                                        placeholder={t('main.group.editModal.leave.customPlaceholder')}
                                        value={customLeaveReason}
                                        onChange={e => setCustomLeaveReason(e.target.value)}
                                    />
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
                            <button onClick={handleLeaveCancel} className="flex-1 py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-xl transition-colors font-medium">{t('common.cancel')}</button>
                            <button
                                onClick={handleLeaveConfirm}
                                className="flex-1 py-2 px-4 bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative)] text-[var(--color-text-accent)] rounded-xl transition-colors font-medium"
                                disabled={leaveReason === t('main.group.editModal.customInput') && !customLeaveReason.trim()}
                            >
                                {t('main.group.editModal.leave.submit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default EditGroupChatModal;