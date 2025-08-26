import { PlusCircle, Trash2 } from 'lucide-react';

interface MemoryManagerProps {
    memories: string[];
    handleMemoryChange: (index: number, value: string) => void;
    addMemory: () => void;
    deleteMemory: (index: number) => void;
}

export function MemoryManager({ memories, handleMemoryChange, addMemory, deleteMemory }: MemoryManagerProps) {
    return (
        <div className="content-inner pt-4 space-y-3">
            <div id="memory-container" className="space-y-3">
                {memories.map((mem, index) => (
                    <div key={index} className="memory-item flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <textarea
                            className="memory-input flex-1 px-3 py-2 bg-white text-gray-900 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm leading-relaxed resize-y min-h-[44px] max-h-[300px] whitespace-pre-wrap"
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
                        <button onClick={() => deleteMemory(index)} className="p-2 mt-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4 pointer-events-none" />
                        </button>
                    </div>
                ))}
            </div>
            <button onClick={addMemory} id="add-memory-btn" className="mt-3 text-sm text-blue-500 hover:text-blue-600 flex items-center gap-2 py-2 px-3 hover:bg-blue-50 rounded-lg transition-colors">
                <PlusCircle className="w-4 h-4" /> 메모리 추가
            </button>
        </div>
    );
}
