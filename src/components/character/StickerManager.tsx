import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckSquare, CheckCircle, Trash2, Smile } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { selectCharacterById } from '../../entities/character/selectors';
import { charactersActions } from '../../entities/character/slice';
import type { RootState } from '../../app/store';
import type { Sticker, Character } from '../../entities/character/types';
import { filesToStickers } from '../../utils/sticker';
import { StickerGrid } from '../common/StickerGrid';

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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const newStickers = await filesToStickers(files);
        if (draft && onDraftChange) {
            onStickersChange([...stickers, ...newStickers]);
        } else {
            for (const sticker of newStickers) {
                dispatch(charactersActions.addSticker({ characterId, sticker }));
            }
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
            {/* 상단 액션 버튼 영역 */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <button
                    onClick={handleAddStickerClick}
                    className="py-2.5 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                    <Plus className="w-5 h-5" />
                    <span>{t('characterPanel.stickersManager.addLine1')} {t('characterPanel.stickersManager.addLine2')}</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*" />

                {stickers.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => {
                                setSelectionMode(!selectionMode);
                                if (selectionMode) setSelectedStickers([]);
                            }}
                            className={`py-2.5 px-4 rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow-md ${selectionMode
                                ? 'bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)]'
                                : 'bg-[var(--color-button-neutral)] hover:bg-[var(--color-button-neutral-hover)] text-[var(--color-text-accent)]'
                                }`}
                        >
                            <CheckSquare className="w-5 h-5" />
                            <span>{selectionMode ? t('characterPanel.stickersManager.selectCancel') : `${t('characterPanel.stickersManager.selectLine1')} ${t('characterPanel.stickersManager.selectMode')}`}</span>
                        </button>

                        {selectionMode && (
                            <>
                                <button
                                    onClick={selectAll}
                                    className="py-2.5 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow-md"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    <span>{t('characterPanel.stickersManager.selectAllLine1')} {t('characterPanel.stickersManager.selectAllLine2')}</span>
                                </button>
                                <button
                                    onClick={handleDeleteSelected}
                                    disabled={selectedStickers.length === 0}
                                    className="py-2.5 px-4 bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative-accent)] text-[var(--color-text-accent)] rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
                                >
                                    <Trash2 className="w-5 h-5" />
                                    <span>{t('characterPanel.stickersManager.deleteLine1')} ({selectedStickers.length})</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--color-text-informative-secondary)] mb-3">
                <span>{t('characterPanel.stickersManager.supportedFormats')}</span>
                <span>{t('characterPanel.stickersManager.count', { count: stickers.length })}</span>
            </div>

            {/* 스티커 그리드 */}
            {stickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center text-[var(--color-text-informative-secondary)] py-16">
                    <Smile className="w-12 h-12 mx-auto mb-3 text-[var(--color-icon-primary)]/50" />
                    <p className="text-base font-medium mb-2">{t('characterPanel.stickersManager.emptyTitle')}</p>
                    <p className="text-sm opacity-75">{t('characterPanel.stickersManager.emptyDesc')}</p>
                    <button
                        onClick={handleAddStickerClick}
                        className="mt-6 py-2.5 px-6 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                        <Plus className="w-5 h-5" />
                        <span>{t('characterPanel.stickersManager.addLine1')} {t('characterPanel.stickersManager.addLine2')}</span>
                    </button>
                </div>
            ) : (
                <StickerGrid
                    stickers={stickers}
                    mode={selectionMode ? 'select' : 'manage'}
                    selectedIds={selectedStickers}
                    onToggleSelection={toggleSelection}
                    onEdit={handleEditName}
                    gridCols="grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3"
                />
            )}
        </div>
    );
}