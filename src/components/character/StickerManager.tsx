import React, { useState } from 'react';
import { Plus, CheckSquare, CheckCircle, Trash2 } from 'lucide-react';

interface StickerManagerProps {
    stickers: any[]; // Replace with actual sticker type
    // Add functions for sticker management as props
}

export function StickerManager({ stickers }: StickerManagerProps) {
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedStickers, setSelectedStickers] = useState<number[]>([]);

    const stickerCount = stickers.length;

    return (
        <div className="content-inner pt-4 space-y-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <button id="add-sticker-btn" className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm flex flex-col items-center justify-center gap-1">
                        <Plus className="w-4 h-4" /> 
                        <span className="text-xs">스티커<br/>추가</span>
                    </button>
                    <input type="file" id="sticker-input" className="hidden" multiple />
                </div>
                {stickerCount > 0 && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSelectionMode(!selectionMode)} className="py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex flex-col items-center gap-1">
                            <CheckSquare className="w-4 h-4" /> 
                            <span className="text-xs">{selectionMode ? '선택<br/>해제' : '선택<br/>모드'}</span>
                        </button>
                        {selectionMode && (
                            <button id="select-all-stickers" className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm flex flex-col items-center gap-1">
                                <CheckCircle className="w-4 h-4" /> 
                                <span className="text-xs">전체<br/>선택</span>
                            </button>
                        )}
                        <button id="delete-selected-stickers" className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm flex flex-col items-center gap-1 opacity-50 cursor-not-allowed" disabled>
                            <Trash2 className="w-4 h-4" /> 
                            <span className="text-xs">삭제<br/>(<span id="selected-count">{selectedStickers.length}</span>)</span>
                        </button>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>jpg, gif, png, bmp, webp, webm, mp4, mp3 지원</span>
                <span>스티커 개수: {stickerCount}개</span>
            </div>
            <div id="sticker-container" className="grid grid-cols-4 gap-2">
                {/* Sticker grid will be rendered here */}
                {stickers.length === 0 && (
                    <div className="col-span-4 text-center text-gray-400 text-sm py-4">아직 스티커가 없습니다.</div>
                )}
            </div>
        </div>
    );
}
