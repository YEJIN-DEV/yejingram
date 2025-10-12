import { ChevronDown, Forward, Globe, PlusCircle, Trash2, X } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../app/store';
import { selectRoomById } from '../../entities/room/selectors';
import { roomsActions } from '../../entities/room/slice';
import { useCallback, useMemo, useState } from 'react';
import type { Room } from '../../entities/room/types';
import { Avatar } from '../../utils/Avatar';
import { getMessageDisplayText } from '../../utils/message';
import { selectMessagesByRoomId } from '../../entities/message/selectors';

interface MemoryManagerProps {
    roomId: string;
}

export function MemoryManager({ roomId }: MemoryManagerProps) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const state = useSelector((state: RootState) => state) as RootState;
    const [isTransferMemoryModalOpen, setIsTransferMemoryModalOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const room = useSelector((state: RootState) => selectRoomById(state, roomId));
    const rooms = useSelector((state: RootState) => state.rooms);
    const characterEntities = useSelector((state: RootState) => state.characters.entities);
    const memories = room?.memories || [];

    const getCharacterName = useCallback((characterId: number) => {
        const character = characterEntities?.[characterId];
        const name = character?.name?.trim();
        return name && name.length > 0 ? name : t('main.roomMemory.unknownCharacter');
    }, [characterEntities, t]);

    const otherRooms = useMemo(() => (
        Object.values(rooms.entities)
            .filter((r): r is Room => Boolean(r) && r.id !== roomId)
    ), [rooms.entities, roomId]);

    const groupedSections = useMemo(() => {
        interface Section {
            key: string;
            label: string;
            rooms: Room[];
        }

        const sections: Section[] = [];
        const groupRooms: Room[] = [];
        const roomsByCharacter = new Map<number, Room[]>();

        const pushSorted = (list: Room[]) => [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true }));

        otherRooms.forEach((candidate) => {
            if (candidate.type === 'Group') {
                groupRooms.push(candidate);
                return;
            }

            const primaryMemberId = candidate.memberIds?.[0];
            const isIndividualChat = candidate.type === 'Direct' || (candidate.memberIds?.length ?? 0) === 1;

            if (isIndividualChat && typeof primaryMemberId === 'number') {
                const existing = roomsByCharacter.get(primaryMemberId) ?? [];
                existing.push(candidate);
                roomsByCharacter.set(primaryMemberId, existing);
                return;
            }

            groupRooms.push(candidate);
        });

        if (groupRooms.length > 0) {
            sections.push({
                key: 'group-chat',
                label: t('main.roomMemory.groupChatLabel'),
                rooms: pushSorted(groupRooms),
            });
        }

        const characterSections = Array.from(roomsByCharacter.entries())
            .sort((a, b) => getCharacterName(a[0]).localeCompare(getCharacterName(b[0]), undefined, { sensitivity: 'base', numeric: true }))
            .map(([characterId, characterRooms]) => ({
                key: `character-${characterId}`,
                label: getCharacterName(characterId),
                rooms: pushSorted(characterRooms),
            }));

        sections.push(...characterSections);

        return sections;
    }, [getCharacterName, otherRooms, t]);

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    if (!room) return null;

    const handleMemoryChange = (index: number, value: string) => {
        dispatch(roomsActions.setRoomMemory({ roomId, index, value }));
    };

    const handleTransferCancel = () => {
        setIsTransferMemoryModalOpen(false);
    }

    const handleTransferMemory = (targetRoom: Room) => {
        if (!confirm(t('main.roomMemory.transferMemoryConfirm', { targetRoomName: targetRoom.name }))) return;
        memories.forEach(mem => {
            dispatch(roomsActions.addRoomMemory({ roomId: targetRoom.id, value: mem }));
        });
        setIsTransferMemoryModalOpen(false);
    };

    const getLastMessagePreview = (targetRoomId: string) => {
        const messages = selectMessagesByRoomId(state, targetRoomId);
        const lastMessage = messages[messages.length - 1];
        return getMessageDisplayText(lastMessage, t);
    };

    const addMemory = () => {
        dispatch(roomsActions.addRoomMemory({ roomId }));
    };

    const clearMemory = () => {
        if (!confirm(t('main.roomMemory.clearMemoriesConfirm'))) return;
        dispatch(roomsActions.clearRoomMemories({ roomId }));
    };

    const transferMemory = () => {
        setIsTransferMemoryModalOpen(true);
    };

    const deleteMemory = (index: number) => {
        dispatch(roomsActions.removeRoomMemory({ roomId, index }));
    };
    return (
        <>
            <div className="content-inner pt-4 space-y-3 h-96 flex flex-col">
                <div id="memory-container" className="space-y-3 flex-1 overflow-y-auto pr-2">
                    {memories.map((mem, index) => (
                        <div key={index} className="memory-item flex items-start gap-3 p-3 bg-[var(--color-bg-input-secondary)] rounded-lg border border-[var(--color-border)]">
                            <textarea
                                className="memory-input flex-1 px-3 py-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm leading-relaxed resize-y min-h-[44px] max-h-[300px] whitespace-pre-wrap"
                                value={mem}
                                rows={2}
                                ref={(el) => {
                                    if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = Math.min(el.scrollHeight, 300) + 'px';
                                    }
                                }}
                                onChange={(e) => {
                                    handleMemoryChange(index, e.target.value);
                                    e.currentTarget.style.height = 'auto';
                                    e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 300) + 'px';
                                }}
                                placeholder={t('main.roomMemory.placeholder')}
                                aria-label={t('main.roomMemory.memoryAriaLabel', { index: index + 1 })}
                            />
                            <button onClick={() => deleteMemory(index)} className="p-2 mt-1 text-[var(--color-icon-secondary)] hover:text-[var(--color-button-negative)] rounded-full hover:bg-[var(--color-button-negative)]/10 transition-colors">
                                <Trash2 className="w-4 h-4 pointer-events-none" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex flex-shrink-0 pt-2 border-t border-[var(--color-border)]">
                    <button onClick={clearMemory} id="clear-memories-btn" className="text-sm text-[var(--color-button-negative)] hover:text-[var(--color-button-negative-accent)] flex items-center gap-2 py-2 px-3 hover:bg-[var(--color-button-negative)]/10 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" /> {t('main.roomMemory.clearMemories')}
                    </button>
                    <button onClick={transferMemory} id="transfer-memories-btn" className="text-sm text-[var(--color-button-primary)] hover:text-[var(--color-button-primary-accent)] flex items-center gap-2 py-2 px-3 hover:bg-[var(--color-button-primary)]/10 rounded-lg transition-colors">
                        <Forward className="w-4 h-4" /> {t('main.roomMemory.transferMemories')}
                    </button>
                    <button onClick={addMemory} id="add-memory-btn" className="ml-auto text-sm text-[var(--color-button-primary)] hover:text-[var(--color-button-primary-accent)] flex items-center gap-2 py-2 px-3 hover:bg-[var(--color-button-primary)]/10 rounded-lg transition-colors">
                        <PlusCircle className="w-4 h-4" /> {t('main.roomMemory.addMemory')}
                    </button>
                </div>
            </div>
            {isTransferMemoryModalOpen && (
                <div className="fixed inset-0 bg-[var(--color-bg-shadow)]/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--color-bg-main)] rounded-2xl w-full max-w-md mx-4 shadow-xl max-h-[80vh] flex flex-col">
                        <div className="space-y-1 border-b border-[var(--color-border)] p-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('main.roomMemory.transferMemories')}</h3>
                                <button onClick={handleTransferCancel} className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors">
                                    <X className="w-5 h-5 text-[var(--color-icon-tertiary)]" />
                                </button>
                            </div>
                            <p className="text-sm text-[var(--color-text-secondary)]">{t('main.roomMemory.transferMemoryHelp')}</p>
                        </div>
                        <div className="p-6 space-y-2 overflow-y-auto flex-1">
                            {groupedSections.length > 0 ? (
                                groupedSections.map((section) => {
                                    const isExpanded = expandedSections[section.key] ?? false;
                                    return (
                                        <div key={section.key} className="space-y-2">

                                            <button
                                                type="button"
                                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-bg-input-secondary)] p-3 text-left font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
                                                onClick={() => toggleSection(section.key)}
                                                aria-expanded={isExpanded}
                                            >
                                                {section.key === 'group-chat' ? (
                                                    <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-group-from)] to-[var(--color-group-to)] rounded-full flex items-center justify-center">
                                                        <Globe className='w-5 h-5 text-[var(--color-text-accent)]' />
                                                    </div>
                                                ) : (
                                                    <Avatar size='xs' char={characterEntities[section.rooms[0].memberIds[0]]} />
                                                )}
                                                <span>{section.label}</span>
                                                <ChevronDown className={`ml-auto h-4 w-4 text-[var(--color-icon-tertiary)] transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                            </button>
                                            {isExpanded && (
                                                <div className="space-y-2 pl-4">
                                                    {section.rooms.map((targetRoom) => (
                                                        <>
                                                            <div
                                                                key={targetRoom.id}
                                                                className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-bg-input-secondary)] p-3 transition-colors hover:bg-[var(--color-bg-hover)] cursor-pointer"
                                                                onClick={() => handleTransferMemory(targetRoom)}
                                                            >
                                                                <span className="truncate">{targetRoom.name || t('main.room.untitledRoom')}</span>
                                                                <span className="ml-auto max-w-[60%] pl-4 text-sm text-[var(--color-text-secondary)] truncate whitespace-nowrap">
                                                                    {getLastMessagePreview(targetRoom.id)}
                                                                </span>
                                                            </div>
                                                        </>))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-sm text-[var(--color-text-secondary)]">{t('main.roomMemory.noOtherRooms')}</p>
                            )}
                        </div>
                    </div>
                </div >
            )
            }
        </>
    );
}
