import { PlusCircle, Trash2 } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../app/store';
import { selectRoomById } from '../../entities/room/selectors';
import { roomsActions } from '../../entities/room/slice';

interface MemoryManagerProps {
    roomId: string;
}

export function MemoryManager({ roomId }: MemoryManagerProps) {
    const dispatch = useDispatch();
    const room = useSelector((state: RootState) => selectRoomById(state, roomId));
    if (!room) return null;
    const memories = room.memories || [];

    const handleMemoryChange = (index: number, value: string) => {
        dispatch(roomsActions.setRoomMemory({ roomId, index, value }));
    };

    const addMemory = () => {
        dispatch(roomsActions.addRoomMemory({ roomId }));
    };

    const deleteMemory = (index: number) => {
        dispatch(roomsActions.removeRoomMemory({ roomId, index }));
    };
    return (
        <div className="content-inner pt-4 space-y-3 h-96 flex flex-col">
            <div id="memory-container" className="space-y-3 flex-1 overflow-y-auto pr-2">
                {memories.map((mem, index) => (
                    <div key={index} className="memory-item flex items-start gap-3 p-3 bg-[var(--color-bg-input-secondary)] rounded-lg border border-[var(--color-border)]">
                        <textarea
                            className="memory-input flex-1 px-3 py-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm leading-relaxed resize-y min-h-[44px] max-h-[300px] whitespace-pre-wrap"
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
                            placeholder="기억할 내용을 입력하세요... (여러 줄 입력 가능)"
                            aria-label={`메모리 ${index + 1}`}
                        />
                        <button onClick={() => deleteMemory(index)} className="p-2 mt-1 text-[var(--color-icon-secondary)] hover:text-red-500 rounded-full hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4 pointer-events-none" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="flex-shrink-0 pt-2 border-t border-[var(--color-border)]">
                <button onClick={addMemory} id="add-memory-btn" className="text-sm text-[var(--color-icon-accent)] hover:text-[var(--color-icon-accent-secondary)] flex items-center gap-2 py-2 px-3 hover:bg-blue-50 rounded-lg transition-colors">
                    <PlusCircle className="w-4 h-4" /> 메모리 추가
                </button>
            </div>
        </div>
    );
}
