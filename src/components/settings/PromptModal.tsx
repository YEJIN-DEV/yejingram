import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useRef, useState, useMemo } from 'react';
import { X, ChevronDown, RotateCcw, Download, Upload, ArrowUp, ArrowDown, GripVertical, AlertTriangle } from 'lucide-react';
import { selectPrompts } from '../../entities/setting/selectors';
import { settingsActions, initialState } from '../../entities/setting/slice';
import type { Prompts, PromptItem, PromptRole, PromptType } from '../../entities/setting/types';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function PromptModal({ isOpen, onClose }: PromptModalProps) {
    const dispatch = useDispatch();
    const prompts = useSelector(selectPrompts);

    const [localPrompts, setLocalPrompts] = useState<Prompts>(prompts);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // 타입 라벨 한글 매핑
    const typeLabelMap: Record<PromptType, string> = {
        'memory': '메모리(구조화)',
        'style-structured': '스타일(구조화)',
        'style-unstructured': '스타일(비구조화)',
        'sticker': '스티커',
        'context-group': '그룹 컨텍스트',
        'context-open': '오픈 컨텍스트',
        'generation': '생성(프로필)',
        'image-generation': '이미지 생성',
        'output-structured': '출력(구조화)',
        'output-unstructured': '출력(비구조화)',
        'plain': '순수 프롬프트',
        'chat': '채팅 기록',
        'lorebook': '로어북',
        'extraSystemInstruction': '추가 시스템 지시문',
    };
    const getTypeLabel = (t: PromptType) => typeLabelMap[t] ?? t;

    const typeOptions: PromptType[] = Object.keys(typeLabelMap) as PromptType[];

    // 사용 중인 타입 집합
    const usedTypes = useMemo(() => {
        const set = new Set<PromptType>();
        // main 배열의 프롬프트만 집계
        localPrompts.main.forEach((item) => {
            const t = item?.type?.trim();
            if (t) set.add(t as PromptType);
        });
        // 프로필/이미지 생성 프롬프트는 항상 포함
        const pc = localPrompts.profile_creation?.type?.trim();
        if (pc) set.add(pc as PromptType);
        const ig = localPrompts.image_response_generation?.type?.trim();
        if (ig) set.add(ig as PromptType);
        return set;
    }, [localPrompts]);

    // 드롭다운 옵션 중 설정되지 않은 타입 목록
    const missingTypes = useMemo(() => {
        return typeOptions.filter(t => t !== 'plain' && t !== 'chat' && t !== 'lorebook' && !usedTypes.has(t));
    }, [typeOptions, usedTypes]);

    useEffect(() => {
        setLocalPrompts(prompts);
    }, [prompts, isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleSave = () => {
        dispatch(settingsActions.setPrompts(localPrompts));
        onClose();
    };

    const moveIndex = (index: number, dir: -1 | 1) => {
        setLocalPrompts(prev => {
            const main = [...prev.main];
            const newIndex = index + dir;
            if (newIndex < 0 || newIndex >= main.length) return prev;
            [main[index], main[newIndex]] = [main[newIndex], main[index]];
            return { ...prev, main };
        });
    };

    const removeIndex = (index: number) => {
        setLocalPrompts(prev => ({ ...prev, main: prev.main.filter((_, i) => i !== index) }));
    };

    const resetOrder = () => {
        setLocalPrompts(prev => ({ ...prev, main: initialState.prompts.main }));
    };

    const handleDragStart = (index: number) => setDragIndex(index);
    const handleDragOver: React.DragEventHandler = (e) => { e.preventDefault(); };
    const handleDrop = (targetIndex: number) => {
        setLocalPrompts(prev => {
            if (dragIndex === null || dragIndex === targetIndex) return prev;
            const main = [...prev.main];
            const [removed] = main.splice(dragIndex, 1);
            main.splice(targetIndex, 0, removed);
            return { ...prev, main };
        });
        setDragIndex(null);
    };
    const handleDragEnd = () => setDragIndex(null);
    const addNewPrompt = () => {
        const newPrompt: PromptItem = {
            name: '새 프롬프트',
            type: 'plain',
            role: 'system',
            content: ''
        };
        setLocalPrompts(prev => ({ ...prev, main: [...prev.main, newPrompt] }));
    };

    const handleMainPromptChange = (index: number, patch: Partial<PromptItem>) => {
        setLocalPrompts(prev => {
            const main = [...prev.main];
            main[index] = { ...main[index], ...patch };
            return { ...prev, main };
        });
    };

    const setPromptToDefault = (
        key: number | "profile_creation" | "image_response_generation"
    ) => {
        if (confirm('기본값으로 되돌리시겠습니까?')) {
            if (typeof key === 'number') {
                setLocalPrompts(prev => {
                    const main = [...prev.main];
                    main[key] = initialState.prompts.main[key];
                    return { ...prev, main };
                });
            } else {
                setLocalPrompts(prev => ({
                    ...prev,
                    [key]: initialState.prompts[key]
                }));
            }
        }
    };

    const downloadJson = (data: unknown, filenameBase: string) => {
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const ts = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const fname = `${filenameBase}_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('다운로드 중 오류가 발생했습니다.');
        }
    };

    const handleBackup = () => {
        downloadJson(localPrompts, 'prompts_backup');
    };

    type AnyRecord = Record<string, unknown>;

    const isPromptItem = (obj: any): obj is PromptItem => {
        return obj && typeof obj.name === 'string' && typeof obj.type === 'string' && typeof obj.role === 'string' && typeof obj.content === 'string';
    };

    const extractPrompts = (data: unknown): Prompts | null => {
        const obj = data as AnyRecord | null;
        const maybe = (obj && (obj as AnyRecord).prompts) ? (obj as AnyRecord).prompts : obj;
        if (!maybe || typeof maybe !== 'object') return null;
        const p = maybe as any;

        // basic validation for new structure
        if (!p.main || !Array.isArray(p.main)) return null;
        if (!p.main.every(isPromptItem)) return null;
        if (!isPromptItem(p.profile_creation) || !isPromptItem(p.image_response_generation)) return null;
        // Merge new fields with defaults if missing
        const withDefaults = {
            ...initialState.prompts,
            ...p,
            main: p.main,
        } as Prompts;
        return withDefaults;
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const parsed = extractPrompts(json);
            if (!parsed) {
                alert('유효한 프롬프트 파일이 아닙니다.');
                return;
            }
            setLocalPrompts(parsed);
            alert('프롬프트를 불러왔습니다.');
        } catch (err) {
            alert('불러오기 중 오류가 발생했습니다. JSON 형식을 확인해주세요.');
            console.error(err);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 flex flex-col shadow-2xl" style={{ maxHeight: '90vh' }}>
                <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">프롬프트 수정</h3>
                        {missingTypes.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 border border-amber-200" title={`미설정 타입 ${missingTypes.length}개`}>
                                <AlertTriangle className="w-3.5 h-3.5" /> {missingTypes.length}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    {missingTypes.length > 0 && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border text-amber-800 bg-amber-50 border-amber-200">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <div className="font-medium">설정되지 않은 타입이 있습니다</div>
                                <div className="mt-1 text-amber-900/90">다음 타입이 어떤 프롬프트에도 지정되지 않았습니다:</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {missingTypes.map((t) => (
                                        <span key={t} className="px-2 py-0.5 rounded border border-amber-200 bg-amber-100/70 text-amber-900 text-xs">{getTypeLabel(t)}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                        <h4 className="text-base font-semibold text-blue-600">메인 채팅 프롬프트</h4>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={addNewPrompt} className="py-1 px-2 text-xs bg-blue-100 hover:bg-blue-200 border border-blue-200 rounded">추가</button>
                            <button type="button" onClick={resetOrder} className="py-1 px-2 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded">초기화</button>
                        </div>
                    </div>
                    {localPrompts.main.map((item, index) => {
                        const title = item.name;

                        return (
                            <details
                                key={index}
                                className="group bg-gray-50 rounded-lg border border-gray-200"
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(index)}
                                onDragEnd={handleDragEnd}
                            >
                                <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                                    <div className="flex items-center">
                                        <span className="text-gray-400 w-6 text-center mr-2">{index + 1}.</span>
                                        <span className="text-base font-medium text-gray-900">{title}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span title="드래그로 순서 변경" className="inline-flex">
                                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); moveIndex(index, -1); }}
                                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
                                            title="위로 이동"
                                            aria-label="위로 이동"
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); moveIndex(index, 1); }}
                                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
                                            title="아래로 이동"
                                            aria-label="아래로 이동"
                                        >
                                            <ArrowDown className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={(e) => { e.preventDefault(); removeIndex(index); }} className="text-xs px-2 py-1 border rounded text-red-600">삭제</button>
                                        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                                    </div>
                                </summary>
                                <div className="content-wrapper">
                                    <div className="content-inner p-4 border-t border-gray-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <button onClick={() => setPromptToDefault(index)} className="py-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs flex items-center gap-1 border border-gray-200">
                                                <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                            <div className="flex flex-col">
                                                <label className="text-xs font-medium text-gray-600 mb-1">이름</label>
                                                <input value={item.name}
                                                    onChange={e => handleMainPromptChange(index, { name: e.target.value })}
                                                    className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-sm" placeholder="이름" />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-xs font-medium text-gray-600 mb-1">타입</label>
                                                <select
                                                    value={item.type}
                                                    onChange={e => handleMainPromptChange(index, { type: e.target.value as PromptType })}
                                                    className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-sm"
                                                >
                                                    {typeOptions.length === 0 && (
                                                        <option value="" disabled>타입 없음</option>
                                                    )}
                                                    {typeOptions.map((opt) => (
                                                        <option key={opt} value={opt}>{getTypeLabel(opt)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {item.type !== 'chat' && item.type !== 'extraSystemInstruction' && (
                                                <div className="flex flex-col">
                                                    <label className="text-xs font-medium text-gray-600 mb-1">역할</label>
                                                    <select value={item.role}
                                                        onChange={e => handleMainPromptChange(index, { role: e.target.value as PromptRole })}
                                                        className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-sm">
                                                        <option value="system">system</option>
                                                        <option value="assistant">assistant</option>
                                                        <option value="user">user</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                        {item.type !== 'chat' && item.type !== 'lorebook' && item.type !== 'extraSystemInstruction' && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">프롬프트 내용</label>
                                                <textarea
                                                    value={item.content}
                                                    onChange={e => handleMainPromptChange(index, { content: e.target.value })}
                                                    className="w-full h-64 p-3 bg-gray-50 text-gray-900 rounded-lg text-sm font-mono border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </details>
                        );
                    })}

                    <h4 className="text-base font-semibold text-blue-600 border-b border-blue-100 pb-2 mt-6">랜덤 선톡 캐릭터 생성 프롬프트</h4>
                    <details className="group bg-gray-50 rounded-lg border border-gray-200">
                        <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                            <span className="text-base font-medium text-gray-900">{localPrompts.profile_creation.name || '# 캐릭터 생성 규칙 (Profile Creation Rules)'}</span>
                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                        </summary>
                        <div className="content-wrapper">
                            <div className="content-inner p-4 border-t border-gray-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <button onClick={() => setPromptToDefault('profile_creation')} className="py-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs flex items-center gap-1 border border-gray-200">
                                        <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-gray-600 mb-1">이름</label>
                                        <input value={localPrompts.profile_creation.name}
                                            onChange={e => setLocalPrompts(prev => ({ ...prev, profile_creation: { ...prev.profile_creation, name: e.target.value } }))}
                                            className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-sm" placeholder="이름" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-gray-600 mb-1">타입 <span className="text-[11px] text-gray-400">(고정)</span></label>
                                        <select
                                            value={localPrompts.profile_creation.type}
                                            disabled
                                            aria-disabled
                                            className="w-full p-2 bg-gray-100 text-gray-700 rounded border border-gray-200 text-sm cursor-not-allowed"
                                        >
                                            <option value={localPrompts.profile_creation.type}>{getTypeLabel(localPrompts.profile_creation.type)}</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-gray-600 mb-1">역할</label>
                                        <select value={localPrompts.profile_creation.role}
                                            onChange={e => setLocalPrompts(prev => ({ ...prev, profile_creation: { ...prev.profile_creation, role: e.target.value as PromptRole } }))}
                                            className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-sm">
                                            <option value="system">system</option>
                                            <option value="assistant">assistant</option>
                                            <option value="user">user</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">프롬프트 내용</label>
                                    <textarea
                                        value={localPrompts.profile_creation.content}
                                        onChange={e => setLocalPrompts(prev => ({ ...prev, profile_creation: { ...prev.profile_creation, content: e.target.value } }))}
                                        className="w-full h-64 p-3 bg-gray-50 text-gray-900 rounded-lg text-sm font-mono border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" />
                                </div>
                            </div>
                        </div>
                    </details>

                    <h4 className="text-base font-semibold text-green-600 border-b border-green-100 pb-2 mt-6">이미지 응답 생성 프롬프트</h4>
                    <details className="group bg-gray-50 rounded-lg border border-gray-200">
                        <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                            <span className="text-base font-medium text-gray-900">{localPrompts.image_response_generation.name || '# 이미지 응답 생성 규칙 (Image Response Generation Rules)'}</span>
                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                        </summary>
                        <div className="content-wrapper">
                            <div className="content-inner p-4 border-t border-gray-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <button onClick={() => setPromptToDefault('image_response_generation')} className="py-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs flex items-center gap-1 border border-gray-200">
                                        <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-gray-600 mb-1">이름</label>
                                        <input value={localPrompts.image_response_generation.name}
                                            onChange={e => setLocalPrompts(prev => ({ ...prev, image_response_generation: { ...prev.image_response_generation, name: e.target.value } }))}
                                            className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-sm" placeholder="이름" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-gray-600 mb-1">타입 <span className="text-[11px] text-gray-400">(고정)</span></label>
                                        <select
                                            value={localPrompts.image_response_generation.type}
                                            disabled
                                            aria-disabled
                                            className="w-full p-2 bg-gray-100 text-gray-700 rounded border border-gray-200 text-sm cursor-not-allowed"
                                        >
                                            <option value={localPrompts.image_response_generation.type}>{getTypeLabel(localPrompts.image_response_generation.type)}</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-gray-600 mb-1">역할</label>
                                        <select value={localPrompts.image_response_generation.role}
                                            onChange={e => setLocalPrompts(prev => ({ ...prev, image_response_generation: { ...prev.image_response_generation, role: e.target.value as PromptRole } }))}
                                            className="w-full p-2 bg-white text-gray-900 rounded border border-gray-200 text-sm">
                                            <option value="system">system</option>
                                            <option value="assistant">assistant</option>
                                            <option value="user">user</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">프롬프트 내용</label>
                                    <textarea
                                        value={localPrompts.image_response_generation.content}
                                        onChange={e => setLocalPrompts(prev => ({ ...prev, image_response_generation: { ...prev.image_response_generation, content: e.target.value } }))}
                                        className="w-full h-64 p-3 bg-gray-50 text-gray-900 rounded-lg text-sm font-mono border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" />
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* information_template UI removed; conversation/output format are handled in the main list like others */}
                </div>
                <div className="p-6 mt-auto border-t border-gray-200 shrink-0 flex flex-wrap justify-end gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button onClick={handleBackup} className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm flex items-center gap-2 border border-gray-200">
                        <Download className="w-4 h-4" /> 프롬프트 백업
                    </button>
                    <button onClick={handleImportClick} className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm flex items-center gap-2 border border-gray-200">
                        <Upload className="w-4 h-4" /> 프롬프트 불러오기
                    </button>
                    <div className="flex-grow"></div>
                    <button onClick={onClose} className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">취소</button>
                    <button onClick={handleSave} className="py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">저장</button>
                </div>
            </div>
        </div>
    );
}

export default PromptModal;
