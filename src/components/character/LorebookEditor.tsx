import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Lore } from '../../entities/lorebook/types';

export interface LorebookEditorProps {
    lores: Lore[];
    onChange: (lores: Lore[]) => void;
}

const emptyLore = (nextOrder: number): Lore => ({
    id: crypto.randomUUID(),
    name: '',
    activationKeys: [''],
    order: nextOrder,
    prompt: '',
    alwaysActive: false,
    multiKey: false,
});

export function LorebookEditor({ lores, onChange }: LorebookEditorProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const sorted = useMemo(() => [...(lores || [])].sort((a, b) => a.order - b.order), [lores]);

    const renumber = (items: Lore[]) => items.map((l, i) => ({ ...l, order: i }));

    const addLore = () => {
        const next = emptyLore(sorted.length);
        onChange(renumber([...sorted, next]));
        setExpandedId(next.id);
    };

    const updateLore = (id: string, patch: Partial<Lore>) => {
        const next = sorted.map(l => l.id === id ? { ...l, ...patch } : l);
        onChange(next);
    };

    const removeLore = (id: string) => {
        const next = sorted.filter(l => l.id !== id);
        onChange(renumber(next));
        if (expandedId === id) setExpandedId(null);
    };

    const moveLore = (id: string, dir: -1 | 1) => {
        const idx = sorted.findIndex(l => l.id === id);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= sorted.length) return;
        const next = [...sorted];
        [next[idx], next[j]] = [next[j], next[idx]];
        onChange(renumber(next));
    };

    // multiKey 토글과 activationKeys 길이를 동기화
    const setMultiKey = (id: string, value: boolean) => {
        const lore = sorted.find(x => x.id === id);
        if (!lore) return;
        let keys = [...(lore.activationKeys || [''])];
        if (value) {
            while (keys.length < 2) keys.push('');
            keys = keys.slice(0, 2);
        } else {
            keys = [keys[0] ?? ''];
        }
        updateLore(id, { multiKey: value, activationKeys: keys });
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h5 className="text-sm text-gray-300">로어 {sorted.length}개</h5>
                <button onClick={addLore} className="py-1.5 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-xs inline-flex items-center gap-1">
                    <Plus className="w-4 h-4" /> 추가
                </button>
            </div>

            {sorted.map((l, i) => (
                <div key={l.id} className="bg-gray-800/60 border border-gray-700 rounded-lg">
                    <div className="flex flex-wrap items-center gap-2 p-3">
                        <GripVertical className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-400 w-8">#{i + 1}</span>
                        <input
                            value={l.name}
                            onChange={e => updateLore(l.id, { name: e.target.value })}
                            placeholder="이름"
                            className="min-w-0 flex-1 basis-full sm:basis-auto px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm"
                        />
                        <div className="flex gap-1 w-full justify-end sm:w-auto">
                            <button onClick={() => moveLore(l.id, -1)} className="p-1.5 rounded-md bg-gray-700 text-gray-200 disabled:opacity-40" disabled={i === 0} title="위로">
                                <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveLore(l.id, 1)} className="p-1.5 rounded-md bg-gray-700 text-gray-200 disabled:opacity-40" disabled={i === sorted.length - 1} title="아래로">
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} className="p-1.5 rounded-md bg-gray-700 text-gray-200" title={expandedId === l.id ? '접기' : '편집'}>
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeLore(l.id)} className="p-1.5 rounded-md bg-red-700/80 hover:bg-red-700 text-white" title="삭제">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {expandedId === l.id && (
                        <div className="p-3 pt-0 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="text-xs text-gray-400 mb-1 block">활성화 키</label>
                                    <div className="flex flex-col gap-2">
                                        <input
                                            value={l.activationKeys[0] ?? ''}
                                            onChange={e => {
                                                const keys = [...l.activationKeys];
                                                keys[0] = e.target.value;
                                                updateLore(l.id, { activationKeys: keys });
                                            }}
                                            placeholder="키워드1, 키워드2 (쉼표로 구분)"
                                            className={`w-full min-w-0 px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm ${l.alwaysActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={l.alwaysActive}
                                        />
                                        {l.multiKey && (
                                            <input
                                                value={l.activationKeys[1] ?? ''}
                                                onChange={e => {
                                                    const keys = [...l.activationKeys];
                                                    keys[1] = e.target.value;
                                                    updateLore(l.id, { activationKeys: keys });
                                                }}
                                                placeholder="키워드1, 키워드2 (쉼표로 구분)"
                                                className={`w-full min-w-0 px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm ${l.alwaysActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={l.alwaysActive}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">프롬프트</label>
                                <textarea
                                    value={l.prompt}
                                    onChange={e => updateLore(l.id, { prompt: e.target.value })}
                                    rows={10}
                                    placeholder="로어 내용"
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-md text-sm"
                                />
                            </div>

                            <div className="flex flex-col gap-3 mt-1">
                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                    <input type="checkbox" checked={!!l.alwaysActive} onChange={e => updateLore(l.id, { alwaysActive: e.target.checked })} />
                                    항상 활성화
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={!!l.multiKey}
                                        onChange={e => setMultiKey(l.id, e.target.checked)}
                                    />
                                    두 키 모두 일치 시 활성화
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {sorted.length === 0 && (
                <div className="text-center text-sm text-gray-400 border border-dashed border-gray-700 rounded-md p-6">
                    아직 로어가 없습니다. 상단의 추가 버튼으로 생성하세요.
                </div>
            )}
        </div>
    );
}

export default LorebookEditor;
