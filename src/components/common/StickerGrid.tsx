import { Edit3, CheckCircle, Music, X } from 'lucide-react';
import type { Sticker } from '../../entities/character/types';

interface StickerGridProps {
    stickers: Sticker[];
    // Display mode
    mode: 'panel' | 'select' | 'manage'; // panel: click to select (StickerPanel), select: multi-select mode, manage: edit mode (StickerManager)

    // Selection related (used in select mode)
    selectedIds?: string[];
    onToggleSelection?: (stickerId: string) => void;

    // Action handlers
    onStickerClick?: (sticker: Sticker) => void;
    onEdit?: (stickerId: string, currentName: string) => void;
    onDelete?: (stickerId: string) => void;

    // Style customization
    gridCols?: string;
    className?: string;
    maxHeight?: string;
}

export function StickerGrid({
    stickers,
    mode,
    selectedIds = [],
    onToggleSelection,
    onStickerClick,
    onEdit,
    onDelete,
    gridCols = 'grid-cols-4',
    className = '',
    maxHeight,
}: StickerGridProps) {

    const renderStickerContent = (sticker: Sticker) => {
        const isVideo = sticker.type.startsWith('video/');
        const isAudio = sticker.type.startsWith('audio/');

        if (isAudio) {
            return (
                <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-input-primary)]">
                    <Music className="w-6 h-6 text-[var(--color-icon-secondary)]" />
                </div>
            );
        } else if (isVideo) {
            return <video className="w-full h-full object-cover" muted src={sticker.data} />;
        } else {
            return <img src={sticker.data} alt={sticker.name} className="w-full h-full object-cover" />;
        }
    };

    const handleContainerClick = (sticker: Sticker) => {
        if (mode === 'select' && onToggleSelection) {
            onToggleSelection(sticker.id);
        } else if (mode === 'panel' && onStickerClick) {
            onStickerClick(sticker);
        }
    };

    return (
        <div
            className={`grid ${gridCols} gap-3 ${maxHeight ? `overflow-y-auto` : ''} ${className}`}
            style={maxHeight ? { maxHeight } : undefined}
        >
            {stickers.map(sticker => {
                const isSelected = selectedIds.includes(sticker.id);

                return (
                    <div
                        key={sticker.id}
                        className={`relative group aspect-square rounded-xl overflow-hidden transition-all duration-200 ${mode === 'manage'
                            ? `bg-[var(--color-bg-shadow)]/20 border-2 ${isSelected
                                ? 'border-[var(--color-button-primary)] shadow-lg scale-95'
                                : 'border-transparent hover:border-[var(--color-button-primary)]/30 hover:shadow-md'
                            }`
                            : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] hover:bg-[var(--color-bg-hover)] shadow-sm hover:shadow-md'
                            }`}
                    >
                        {/* Sticker content */}
                        <button
                            onClick={() => handleContainerClick(sticker)}
                            className="w-full h-full"
                            disabled={mode === 'manage' && !mode}
                        >
                            {renderStickerContent(sticker)}
                        </button>

                        {/* Checkbox for select mode */}
                        {mode === 'select' && (
                            <div className="absolute top-2 right-2 z-10">
                                <button
                                    onClick={() => onToggleSelection?.(sticker.id)}
                                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shadow-md"
                                    style={{
                                        backgroundColor: isSelected
                                            ? 'var(--color-button-primary)'
                                            : 'rgba(255, 255, 255, 0.9)'
                                    }}
                                >
                                    {isSelected && (
                                        <CheckCircle className="w-4 h-4 text-[var(--color-text-accent)]" />
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Hover actions in manage mode (edit button) */}
                        {mode === 'manage' && !mode.includes('select') && (
                            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-shadow)]/80 via-[var(--color-bg-shadow)]/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
                                <button
                                    onClick={() => onEdit?.(sticker.id, sticker.name)}
                                    className="p-3 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] rounded-full text-[var(--color-text-accent)] transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110"
                                >
                                    <Edit3 className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Hover actions in panel mode (edit + delete) */}
                        {mode === 'panel' && (onEdit || onDelete) && (
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                {onEdit && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(sticker.id, sticker.name);
                                        }}
                                        className="w-6 h-6 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-full flex items-center justify-center transition-colors shadow-lg"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(sticker.id);
                                        }}
                                        className="w-6 h-6 bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative-accent)] text-[var(--color-text-accent)] rounded-full flex items-center justify-center transition-colors shadow-lg"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Display sticker name */}
                        <div className={`absolute bottom-0 left-0 right-0 text-xs p-1 truncate ${mode === 'panel'
                            ? 'bg-gradient-to-t from-[var(--color-bg-shadow)]/60 to-transparent text-[var(--color-text-accent)]'
                            : 'bg-[var(--color-bg-shadow)]/60 text-[var(--color-text-accent)]'
                            }`}>
                            {sticker.name}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
