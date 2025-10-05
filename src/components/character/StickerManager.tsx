import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckSquare, CheckCircle, Trash2, Edit3 } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { selectCharacterById } from '../../entities/character/selectors';
import { charactersActions } from '../../entities/character/slice';
import type { RootState } from '../../app/store';
import type { Sticker, Character } from '../../entities/character/types';
import { nanoid } from '@reduxjs/toolkit';

interface StickerManagerProps {
    characterId: number;
    draft?: Character;
    onDraftChange?: (character: Character) => void;
}

export function StickerManager({ characterId, draft, onDraftChange }: StickerManagerProps) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedStickers, setSelectedStickers] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const characterFromStore = useSelector((state: RootState) => selectCharacterById(state, characterId));
    const character = draft && draft.id === characterId ? draft : characterFromStore;
    if (!character) {
        return (
            <div className="content-inner pt-4 space-y-4 text-sm text-[var(--color-text-informative-secondary)]">
                {t('characterPanel.stickersManager.noCharacter')}
            </div>
        );
    }

    const stickers = character.stickers || [];

    const onStickersChange = (newStickers: Sticker[]) => {
        if (draft && onDraftChange) {
            onDraftChange({ ...draft, stickers: newStickers });
        }
    };

    const handleAddStickerClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result as string;
                const newSticker: Sticker = {
                    id: nanoid(),
                    name: file.name,
                    data,
                    type: file.type,
                };
                if (draft && onDraftChange) {
                    onStickersChange([...stickers, newSticker]);
                } else {
                    dispatch(charactersActions.addSticker({ characterId, sticker: newSticker }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteSelected = () => {
    if (selectedStickers.length === 0) return;
    if (confirm(t('characterPanel.stickersManager.deleteConfirm', { count: selectedStickers.length }))) {
            if (draft && onDraftChange) {
                const newStickers = stickers.filter(s => !selectedStickers.includes(s.id));
                onStickersChange(newStickers);
            } else {
                for (const id of selectedStickers) {
                    dispatch(charactersActions.deleteSticker({ characterId, stickerId: id }));
                }
            }
            setSelectedStickers([]);
            setSelectionMode(false);
        }
    };

    const handleEditName = (stickerId: string, currentName: string) => {
    const newName = prompt(t('characterPanel.stickersManager.renamePrompt'), currentName);
        if (newName && newName.trim() !== '') {
            if (draft && onDraftChange) {
                const newStickers = stickers.map(s =>
                    s.id === stickerId ? { ...s, name: newName.trim() } : s
                );
                onStickersChange(newStickers);
            } else {
                dispatch(charactersActions.editStickerName({ characterId, stickerId, newName: newName.trim() }));
            }
        }
    };

    const toggleSelection = (stickerId: string) => {
        setSelectedStickers(prev =>
            prev.includes(stickerId) ? prev.filter(id => id !== stickerId) : [...prev, stickerId]
        );
    };

    const selectAll = () => {
        setSelectedStickers(stickers.map(s => s.id));
    };

    return (
        <div className="content-inner pt-4 space-y-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <button onClick={handleAddStickerClick} className="py-2 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex flex-col items-center justify-center gap-1">
                        <Plus className="w-4 h-4" />
                        <span className="text-xs">{t('characterPanel.stickersManager.addLine1')}<br />{t('characterPanel.stickersManager.addLine2')}</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*" />
                </div>
                {stickers.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSelectionMode(!selectionMode)} className="py-2 px-3 bg-[var(--color-button-neutral)] hover:bg-[var(--color-button-neutral-hover)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex flex-col items-center gap-1">
                            <CheckSquare className="w-4 h-4" />
                            <span className="text-xs">{t('characterPanel.stickersManager.selectLine1')}<br />{selectionMode ? t('characterPanel.stickersManager.selectCancel') : t('characterPanel.stickersManager.selectMode')}</span>
                        </button>
                        {selectionMode && (
                            <button onClick={selectAll} className="py-2 px-3 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex flex-col items-center gap-1">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs">{t('characterPanel.stickersManager.selectAllLine1')}<br />{t('characterPanel.stickersManager.selectAllLine2')}</span>
                            </button>
                        )}
                        <button onClick={handleDeleteSelected} disabled={selectedStickers.length === 0} className="py-2 px-3 bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs">{t('characterPanel.stickersManager.deleteLine1')}<br />(<span id="selected-count">{selectedStickers.length}</span>)</span>
                        </button>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-informative-secondary)] mb-3">
                <span>{t('characterPanel.stickersManager.supportedFormats')}</span>
                <span>{t('characterPanel.stickersManager.count', { count: stickers.length })}</span>
            </div>
            <div id="sticker-container" className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2">
                {stickers.map(sticker => (
                    <div key={sticker.id} className="relative group aspect-square bg-[var(--color-bg-shadow)]/20 rounded-lg overflow-hidden">
                        <img src={sticker.data} alt={sticker.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-[var(--color-bg-shadow)]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            {selectionMode ? (
                                <button onClick={() => toggleSelection(sticker.id)} className="w-full h-full flex items-center justify-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedStickers.includes(sticker.id) ? 'bg-[var(--color-button-primary)]' : 'bg-[var(--color-button-tertiary)]/50'}`}>
                                        <CheckCircle className="w-4 h-4 text-[var(--color-text-accent)]" />
                                    </div>
                                </button>
                            ) : (
                                <button onClick={() => handleEditName(sticker.id, sticker.name)} className="p-2 bg-[var(--color-button-tertiary)]/50 rounded-full text-[var(--color-text-accent)] hover:bg-[var(--color-button-primary-accent)]">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-bg-shadow)]/60 text-[var(--color-text-accent)] text-xs p-1 truncate">
                            {sticker.name}
                        </div>
                    </div>
                ))}
                {stickers.length === 0 && (
                    <div className="col-span-full text-center text-[var(--color-text-informative-secondary)] text-sm py-8">
                        <p>{t('characterPanel.stickersManager.emptyTitle')}</p>
                        <p className="text-xs mt-1">{t('characterPanel.stickersManager.emptyDesc')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}