import React from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';

interface MemoryManagerProps {
    memories: string[];
    handleMemoryChange: (index: number, value: string) => void;
    addMemory: () => void;
    deleteMemory: (index: number) => void;
}

export function MemoryManager({ memories, handleMemoryChange, addMemory, deleteMemory }: MemoryManagerProps) {
    return (
        <div className="content-inner pt-4 space-y-2">
            <div id="memory-container" className="space-y-2">
                {memories.map((mem, index) => (
                    <div key={index} className="memory-item flex items-center gap-2">
                        <input 
                            type="text" 
                            className="memory-input flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border-0 focus:ring-2 focus:ring-blue-500/50 text-sm"
                            value={mem}
                            onChange={(e) => handleMemoryChange(index, e.target.value)}
                            placeholder="기억할 내용을 입력하세요..."
                        />
                        <button onClick={() => deleteMemory(index)} className="p-2 text-gray-400 hover:text-red-400">
                            <Trash2 className="w-4 h-4 pointer-events-none" />
                        </button>
                    </div>
                ))}
            </div>
            <button onClick={addMemory} id="add-memory-btn" className="mt-3 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> 메모리 추가
            </button>
        </div>
    );
}
