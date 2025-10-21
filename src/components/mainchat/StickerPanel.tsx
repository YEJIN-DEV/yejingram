
import type { Sticker } from '../../entities/character/types';
import { Plus, X, Smile } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { charactersActions } from '../../entities/character/slice';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { filesToStickers, formatBytes, estimateBase64Size } from '../../utils/sticker';
import { StickerGrid } from '../common/StickerGrid';

interface StickerPanelProps {
    characterId: number;
    stickers: Sticker[];
    onSelectSticker: (sticker: Sticker) => void;
    onClose: () => void;
}

export function StickerPanel({ characterId, stickers, onSelectSticker, onClose }: StickerPanelProps) {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddStickerClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const newStickers = await filesToStickers(files);
        for (const sticker of newStickers) {
            dispatch(charactersActions.addSticker({ characterId, sticker }));
        }
    };

    const handleDeleteSticker = (stickerId: string) => {
        if (confirm(t('main.stickerPanel.deleteConfirm'))) {
            dispatch(charactersActions.deleteSticker({ characterId, stickerId }));
        }
    };

    const handleEditStickerName = (stickerId: string, currentName: string) => {
        const newName = prompt(t('main.stickerPanel.renamePrompt'), currentName);
        if (newName && newName.trim() !== '') {
            dispatch(charactersActions.editStickerName({ characterId, stickerId, newName: newName.trim() }));
        }
    };

    const totalSize = stickers.reduce((acc, sticker) => acc + estimateBase64Size(sticker.data), 0);

    return (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-[var(--color-bg-main)] rounded-2xl shadow-xl border border-[var(--color-border)] animate-fadeIn">
            <div className="p-4 border-b border-[var(--color-border-secondary)] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('main.stickerPanel.title')}</h3>
                <div className="flex gap-2">
                    <button onClick={handleAddStickerClick} className="p-2 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-full transition-colors shadow-sm" title={t('main.stickerPanel.addTitle')}>
                        <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-2 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-icon-primary)] rounded-full transition-colors" title={t('common.close')}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="p-4">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-4">
                    <span>{t('main.stickerPanel.supportedFormats')}</span>
                    <span className="bg-[var(--color-bg-input-primary)] px-2 py-1 rounded-full">{t('main.stickerPanel.count', { count: stickers.length })}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-4">
                    <span>{t('main.stickerPanel.totalSize', { size: formatBytes(totalSize) })}</span>
                </div>
                {stickers.length === 0 ? (
                    <div className="text-center text-[var(--color-icon-tertiary)] py-8">
                        <Smile className="w-12 h-12 mx-auto mb-3 text-[var(--color-icon-primary)]/50" />
                        <p className="text-sm font-medium mb-2">{t('main.stickerPanel.emptyTitle')}</p>
                        <button onClick={handleAddStickerClick} className="text-sm text-[var(--color-button-primary)] hover:text-[var(--color-button-primary-accent)] font-medium">{t('main.stickerPanel.emptyCta')}</button>
                    </div>
                ) : (
                    <StickerGrid
                        stickers={stickers}
                        mode="panel"
                        onStickerClick={onSelectSticker}
                        onEdit={handleEditStickerName}
                        onDelete={handleDeleteSticker}
                        gridCols="grid-cols-3"
                        maxHeight="12rem"
                    />
                )}
            </div>
            <input type="file" accept="image/jpg,image/gif,image/png,image/bmp,image/webp" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
        </div>
    );
}
