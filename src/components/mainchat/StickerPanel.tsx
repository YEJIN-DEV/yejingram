
import type { Character, Sticker } from '../../entities/character/types';
import { Plus, X, Edit3, Music, Smile } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { charactersActions } from '../../entities/character/slice';
import { useRef } from 'react';

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
                    id: Math.random().toString(36).slice(2),
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
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-gray-800 rounded-xl shadow-lg border border-gray-700 animate-fadeIn">
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">페르소나 스티커</h3>
                <div className="flex gap-2">
                    <button onClick={handleAddStickerClick} className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded" title="스티커 추가">
                        <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={onClose} className="p-1 bg-gray-600 hover:bg-gray-500 text-white rounded" title="닫기">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>
            <div className="p-3">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <span>jpg, gif, png, bmp, webp 지원</span>
                    <span>스티커: {stickers.length}개</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>총 용량: {formatBytes(totalSize)}</span>
                </div>
                {stickers.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <Smile className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">스티커를 추가해보세요</p>
                        <button onClick={handleAddStickerClick} className="mt-2 text-xs text-blue-400 hover:text-blue-300">스티커 추가하기</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                        {stickers.map(sticker => {
                            const isVideo = sticker.type.startsWith('video/');
                            const isAudio = sticker.type.startsWith('audio/');
                            let content;
                            if (isAudio) {
                                content = <div className="w-full h-full flex items-center justify-center bg-gray-600"><Music className="w-6 h-6 text-gray-300" /></div>;
                            } else if (isVideo) {
                                content = <video className="w-full h-full object-cover" muted src={sticker.data} />;
                            } else {
                                content = <img src={sticker.data} alt={sticker.name} className="w-full h-full object-cover" />;
                            }

                            return (
                                <div key={sticker.id} className="relative group">
                                    <button onClick={() => onSelectSticker(sticker)}
                                        className="w-full aspect-square bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 transition-colors">
                                        {content}
                                    </button>
                                    <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); handleEditStickerName(sticker.id, sticker.name); }}
                                            className="w-5 h-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center text-xs" title="이름 변경">
                                            <Edit3 className="w-2 h-2" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSticker(sticker.id); }}
                                            className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs" title="삭제">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate rounded-b-lg">
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
