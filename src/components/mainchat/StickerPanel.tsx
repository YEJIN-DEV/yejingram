
import type { Sticker } from '../../entities/character/types';
import { Plus, X, Edit3, Music, Smile } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { charactersActions } from '../../entities/character/slice';
import { useRef } from 'react';
import { nanoid } from '@reduxjs/toolkit';

interface StickerPanelProps {
    characterId: number;
    stickers: Sticker[];
    onSelectSticker: (sticker: Sticker) => void;
    onClose: () => void;
}

export function StickerPanel({ characterId, stickers, onSelectSticker, onClose }: StickerPanelProps) {
    const dispatch = useDispatch();
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                dispatch(charactersActions.addSticker({ characterId, sticker: newSticker }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteSticker = (stickerId: string) => {
        if (confirm('정말로 스티커를 삭제하시겠습니까?')) {
            dispatch(charactersActions.deleteSticker({ characterId, stickerId }));
        }
    };

    const handleEditStickerName = (stickerId: string, currentName: string) => {
        const newName = prompt('새 스티커 이름을 입력하세요:', currentName);
        if (newName && newName.trim() !== '') {
            dispatch(charactersActions.editStickerName({ characterId, stickerId, newName: newName.trim() }));
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    const totalSize = stickers.reduce((acc, sticker) => acc + (sticker.data.length * 0.75), 0); // Base64 approx size

    return (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-[var(--color-bg-main)] rounded-2xl shadow-xl border border-[var(--color-border)] animate-fadeIn">
            <div className="p-4 border-b border-[var(--color-border-secondary)] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">페르소나 스티커</h3>
                <div className="flex gap-2">
                    <button onClick={handleAddStickerClick} className="p-2 bg-blue-500 hover:bg-blue-600 text-[var(--color-text-accent)] rounded-full transition-colors shadow-sm" title="스티커 추가">
                        <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-2 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-icon-primary)] rounded-full transition-colors" title="닫기">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="p-4">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-4">
                    <span>jpg, gif, png, bmp, webp 지원</span>
                    <span className="bg-[var(--color-bg-input-primary)] px-2 py-1 rounded-full">스티커: {stickers.length}개</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-4">
                    <span>총 용량: {formatBytes(totalSize)}</span>
                </div>
                {stickers.length === 0 ? (
                    <div className="text-center text-[var(--color-icon-tertiary)] py-8">
                        <Smile className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-medium mb-2">스티커를 추가해보세요</p>
                        <button onClick={handleAddStickerClick} className="text-sm text-[var(--color-icon-accent)] hover:text-[var(--color-icon-accent-secondary)] font-medium">스티커 추가하기</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                        {stickers.map(sticker => {
                            const isVideo = sticker.type.startsWith('video/');
                            const isAudio = sticker.type.startsWith('audio/');
                            let content;
                            if (isAudio) {
                                content = <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-input-primary)]"><Music className="w-6 h-6 text-[var(--color-icon-secondary)]" /></div>;
                            } else if (isVideo) {
                                content = <video className="w-full h-full object-cover" muted src={sticker.data} />;
                            } else {
                                content = <img src={sticker.data} alt={sticker.name} className="w-full h-full object-cover" />;
                            }

                            return (
                                <div key={sticker.id} className="relative group">
                                    <button onClick={() => onSelectSticker(sticker)}
                                        className="w-full aspect-square bg-[var(--color-bg-secondary)] rounded-xl overflow-hidden hover:bg-[var(--color-bg-hover)] transition-all duration-200 shadow-sm hover:shadow-md border border-[var(--color-border-secondary)]">
                                        {content}
                                    </button>
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); handleEditStickerName(sticker.id, sticker.name); }}
                                            className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-[var(--color-text-accent)] rounded-full flex items-center justify-center transition-colors shadow-lg" title="이름 변경">
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSticker(sticker.id); }}
                                            className="w-6 h-6 bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative)] text-[var(--color-text-accent)] rounded-full flex items-center justify-center transition-colors shadow-lg" title="삭제">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-[var(--color-text-accent)] text-xs p-2 truncate rounded-b-xl">
                                        {sticker.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <input type="file" accept="image/jpg,image/gif,image/png,image/bmp,image/webp" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
        </div>
    );
}
