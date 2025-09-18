import React, { useState, useRef } from 'react';
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
    const dispatch = useDispatch();
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedStickers, setSelectedStickers] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const characterFromStore = useSelector((state: RootState) => selectCharacterById(state, characterId));
    const character = draft && draft.id === characterId ? draft : characterFromStore;
    if (!character) {
        return (
            <div className="content-inner pt-4 space-y-4 text-sm text-gray-400">
                선택된 캐릭터가 없습니다.
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
        if (confirm(`선택한 스티커 ${selectedStickers.length}개를 삭제하시겠습니까?`)) {
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
        const newName = prompt('새 스티커 이름을 입력하세요:', currentName);
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
                    <button onClick={handleAddStickerClick} className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex flex-col items-center justify-center gap-1">
                        <Plus className="w-4 h-4" />
                        <span className="text-xs">스티커<br />추가</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*" />
                </div>
                {stickers.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSelectionMode(!selectionMode)} className="py-2 px-3 bg-gray-700 hover:bg-gray-600 text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex flex-col items-center gap-1">
                            <CheckSquare className="w-4 h-4" />
                            <span className="text-xs">선택<br />{selectionMode ? '해제' : '모드'}</span>
                        </button>
                        {selectionMode && (
                            <button onClick={selectAll} className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex flex-col items-center gap-1">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs">전체<br />선택</span>
                            </button>
                        )}
                        <button onClick={handleDeleteSelected} disabled={selectedStickers.length === 0} className="py-2 px-3 bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs">삭제<br />(<span id="selected-count">{selectedStickers.length}</span>)</span>
                        </button>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>jpg, gif, png, bmp, webp 지원</span>
                <span>스티커 개수: {stickers.length}개</span>
            </div>
            <div id="sticker-container" className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2">
                {stickers.map(sticker => (
                    <div key={sticker.id} className="relative group aspect-square bg-gray-800 rounded-lg overflow-hidden">
                        <img src={sticker.data} alt={sticker.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-[var(--color-bg-shadow)]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            {selectionMode ? (
                                <button onClick={() => toggleSelection(sticker.id)} className="w-full h-full flex items-center justify-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedStickers.includes(sticker.id) ? 'bg-blue-500' : 'bg-gray-900/50'}`}>
                                        <CheckCircle className="w-4 h-4 text-[var(--color-text-accent)]" />
                                    </div>
                                </button>
                            ) : (
                                <button onClick={() => handleEditName(sticker.id, sticker.name)} className="p-2 bg-gray-900/50 rounded-full text-[var(--color-text-accent)] hover:bg-blue-600">
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
                    <div className="col-span-full text-center text-gray-400 text-sm py-8">
                        <p>아직 스티커가 없습니다.</p>
                        <p className="text-xs mt-1">스티커 추가 버튼을 눌러 추가해보세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}