import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectCharacterById } from '../../entities/character/selectors';
import { charactersActions } from '../../entities/character/slice';
import { roomsActions } from '../../entities/room/slice';
import type { RootState } from '../../app/store';
import type { Lore } from '../../entities/lorebook/types';
import { nanoid } from '@reduxjs/toolkit';
import type { Character } from '../../entities/character/types';

export interface LorebookEditorProps {
    characterId?: number;
    roomId?: string;
    draft?: Character;
    onDraftChange?: (character: Character) => void;
    roomLorebook?: Lore[];
}

const emptyLore = (nextOrder: number, characterId?: number, roomId?: string): Lore => ({
    id: nanoid(),
    name: '',
    activationKeys: [''],
    order: nextOrder,
    prompt: '',
    alwaysActive: false,
    multiKey: false,
    characterId,
    roomId
});

export function LorebookEditor({ characterId, roomId, draft, onDraftChange, roomLorebook }: LorebookEditorProps) {
    const dispatch = useDispatch();
    const characterFromStore = useSelector((state: RootState) => characterId ? selectCharacterById(state, characterId) : undefined);
    const character = draft && draft.id === characterId ? draft : characterFromStore;
    if (!character && !roomLorebook) return null;
    const lores = useMemo(() => {
        const baseLores = roomLorebook || character?.lorebook || [];
        return baseLores.map(l => ({ ...l, characterId: l.characterId ?? characterId, roomId: l.roomId ?? roomId }));
    }, [roomLorebook, character?.lorebook, characterId]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const sorted = useMemo(() => [...lores].sort((a, b) => a.order - b.order), [lores]);
    const renumber = (items: Lore[]) => items.map((l, i) => ({ ...l, order: i }));

    const onChange = (newLores: Lore[]) => {
        const processedLores = roomId ? newLores.map(l => ({ ...l, characterId: -1 })) : newLores;
        if (draft && onDraftChange) {
            onDraftChange({ ...draft, lorebook: processedLores });
        } else if (roomId) {
            dispatch(roomsActions.updateRoomLorebook({ roomId, lorebook: processedLores }));
        } else {
            // keep for compatibility if we ever need bulk replace
            if (characterId !== undefined) {
                dispatch(charactersActions.updateLorebook({ characterId, lorebook: processedLores }));
            }
        }
    };

    const addLore = () => {
        const next = emptyLore(sorted.length, characterId, roomId);
        if (draft && onDraftChange) {
            onChange(renumber([...sorted, next]));
        } else if (roomId) {
            dispatch(roomsActions.addRoomLore({ roomId, lore: next }));
        } else {
            if (characterId !== undefined) {
                dispatch(charactersActions.addLore({ characterId, lore: next }));
            }
        }
        setExpandedId(next.id);
    };

    const updateLore = (id: string, patch: Partial<Lore>) => {
        if (draft && onDraftChange) {
            const next = sorted.map(l => l.id === id ? { ...l, ...patch } : l);
            onChange(next);
        } else if (roomId) {
            dispatch(roomsActions.updateRoomLore({ roomId, id, patch }));
        } else {
            if (characterId !== undefined) {
                dispatch(charactersActions.updateLore({ characterId, id, patch }));
            }
        }
    };

    const removeLore = (id: string) => {
        if (draft && onDraftChange) {
            const next = sorted.filter(l => l.id !== id);
            onChange(renumber(next));
        } else if (roomId) {
            dispatch(roomsActions.removeRoomLore({ roomId, id }));
        } else {
            if (characterId !== undefined) {
                dispatch(charactersActions.removeLore({ characterId, id }));
            }
        }
        if (expandedId === id) setExpandedId(null);
    };

    const moveLore = (id: string, dir: -1 | 1) => {
        if (draft && onDraftChange) {
            const idx = sorted.findIndex(l => l.id === id);
            const j = idx + dir;
            if (idx < 0 || j < 0 || j >= sorted.length) return;
            const next = [...sorted];
            [next[idx], next[j]] = [next[j], next[idx]];
            onChange(renumber(next));
        } else if (roomId) {
            dispatch(roomsActions.moveRoomLore({ roomId, id, direction: dir }));
        } else {
            if (characterId !== undefined) {
                dispatch(charactersActions.moveLore({ characterId, id, direction: dir }));
            }
        }
    };

    // multiKey 토글과 activationKeys 길이를 동기화
    const setMultiKey = (id: string, value: boolean) => {
        if (draft && onDraftChange) {
            const lore = sorted.find(x => x.id === id);
            if (!lore) return;
            let keys = [...(lore.activationKeys || [''])];
            if (value) {
                while (keys.length < 2) keys.push('');
                keys = keys.slice(0, 2);
            } else {
                keys = [keys[0] ?? ''];
            }
            updateLore(id, { multiKey: value, activationKeys: keys });
        } else if (roomId) {
            dispatch(roomsActions.setRoomLoreMultiKey({ roomId, id, value }));
        } else {
            if (characterId !== undefined) {
                dispatch(charactersActions.setLoreMultiKey({ characterId, id, value }));
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-[var(--color-text-secondary)]">로어 {sorted.length}개</h5>
                <button onClick={addLore} className="py-2 px-3 bg-blue-500 hover:bg-blue-600 text-[var(--color-text-accent)] rounded-lg text-sm inline-flex items-center gap-2 transition-colors">
                    <Plus className="w-4 h-4" /> 추가
                </button>
            </div>

            {sorted.map((l, i) => (
                <div key={l.id} className="bg-[var(--color-bg-main)] border border-[var(--color-border)] rounded-lg shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 p-4">
                        <GripVertical className="w-4 h-4 text-[var(--color-icon-secondary)]" />
                        <span className="text-xs text-[var(--color-text-tertiary)] w-8 font-medium">#{i + 1}</span>
                        <input
                            value={l.name}
                            onChange={e => updateLore(l.id, { name: e.target.value })}
                            placeholder="이름"
                            className="min-w-0 flex-1 basis-full sm:basis-auto px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
                        />
                        <div className="flex gap-1 w-full justify-end sm:w-auto">
                            <button onClick={() => moveLore(l.id, -1)} className="p-2 rounded-lg bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-icon-primary)] disabled:opacity-40 transition-colors" disabled={i === 0} title="위로">
                                <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveLore(l.id, 1)} className="p-2 rounded-lg bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-icon-primary)] disabled:opacity-40 transition-colors" disabled={i === sorted.length - 1} title="아래로">
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-[var(--color-text-accent)] transition-colors" title={expandedId === l.id ? '접기' : '편집'}>
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeLore(l.id)} className="p-2 rounded-lg bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative)] text-[var(--color-text-accent)] transition-colors" title="삭제">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {expandedId === l.id && (
                        <div className="p-4 pt-0 space-y-4 border-t border-[var(--color-border)]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">활성화 키</label>
                                    <div className="flex flex-col gap-2">
                                        <input
                                            value={l.activationKeys[0] ?? ''}
                                            onChange={e => {
                                                const keys = [...l.activationKeys];
                                                keys[0] = e.target.value;
                                                updateLore(l.id, { activationKeys: keys });
                                            }}
                                            placeholder="키워드1, 키워드2 (쉼표로 구분)"
                                            className={`w-full min-w-0 px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm ${l.alwaysActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={l.alwaysActive}
                                        />
                                        {l.multiKey && (
                                            <input
                                                value={l.activationKeys[1] ?? ''}
                                                onChange={e => {
                                                    const keys = [...l.activationKeys];
                                                    keys[1] = e.target.value;
                                                    updateLore(l.id, { activationKeys: keys });
                                                }}
                                                placeholder="키워드1, 키워드2 (쉼표로 구분)"
                                                className={`w-full min-w-0 px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm ${l.alwaysActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={l.alwaysActive}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">프롬프트</label>
                                <textarea
                                    value={l.prompt}
                                    onChange={e => updateLore(l.id, { prompt: e.target.value })}
                                    rows={10}
                                    placeholder="로어 내용"
                                    className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
                                />
                            </div>

                            <div className="flex flex-col gap-3 mt-2">
                                <label className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)] cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" checked={!!l.alwaysActive} onChange={e => updateLore(l.id, { alwaysActive: e.target.checked })} className="sr-only peer" />
                                        <div className="w-5 h-5 bg-[var(--color-button-secondary-accent)] border border-gray-300 rounded peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors"></div>
                                        <svg className="absolute top-0.5 left-0.5 w-3 h-3 text-[var(--color-text-accent)] opacity-0 peer-checked:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    항상 활성화
                                </label>
                                <label className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)] cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={!!l.multiKey}
                                            onChange={e => setMultiKey(l.id, e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-5 h-5 bg-[var(--color-button-secondary-accent)] border border-gray-300 rounded peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors"></div>
                                        <svg className="absolute top-0.5 left-0.5 w-3 h-3 text-[var(--color-text-accent)] opacity-0 peer-checked:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    두 키 모두 일치 시 활성화
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {sorted.length === 0 && (
                <div className="text-center text-sm text-[var(--color-icon-tertiary)] border-2 border-dashed border-[var(--color-border)] rounded-lg p-8 bg-[var(--color-bg-secondary)]">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-[var(--color-button-secondary-accent)] rounded-full flex items-center justify-center">
                            <Plus className="w-6 h-6 text-[var(--color-icon-secondary)]" />
                        </div>
                        <p className="font-medium">아직 로어가 없습니다</p>
                        <p className="text-xs text-gray-400">상단의 추가 버튼으로 생성하세요</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LorebookEditor;
