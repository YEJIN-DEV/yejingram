import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useRef, useState, useMemo } from 'react';
import { X, ChevronDown, RotateCcw, Download, Upload, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
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
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // 타입 라벨 한글 매핑
    const typeLabelMap: Record<PromptType, string> = {
        'image-generation': '이미지 생성',
        'plain': '순수 프롬프트',
        'plain-structured': '구조화된 출력',
        'plain-unstructured': '비구조화된 출력',
        'plain-group': '그룹 컨텍스트',
        'extraSystemInstruction': '추가 시스템 지시문',
        'userDescription': '사용자 설명',
        'characterPrompt': '캐릭터 설명',
        'lorebook': '로어북',
        'authornote': '작가의 노트',
        'memory': '메모리',
        'chat': '채팅 기록',
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
        // 이미지 생성 프롬프트는 항상 포함
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
        key: number | "image_response_generation"
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
        if (!isPromptItem(p.image_response_generation)) return null;
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
        <div className="fixed inset-0 bg-[var(--color-bg-shadow)]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-bg-main)] rounded-2xl w-full max-w-2xl mx-4 flex flex-col shadow-2xl" style={{ maxHeight: '90vh' }}>
                <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">프롬프트 수정</h3>
                        {missingTypes.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-alert-bg)] text-[var(--color-alert-text)] border border-[var(--color-alert-border)]" title={`미설정 타입 ${missingTypes.length}개`}>
                                <AlertTriangle className="w-3.5 h-3.5" /> {missingTypes.length}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors"><X className="w-5 h-5 text-[var(--color-icon-tertiary)]" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    {missingTypes.length > 0 && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border text-[var(--color-alert-text)] bg-[var(--color-alert-bg)]/30 border-[var(--color-alert-border)]">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <div className="font-medium">설정되지 않은 타입이 있습니다</div>
                                <div className="mt-1 text-[var(--color-alert-text)]/90">다음 타입이 어떤 프롬프트에도 지정되지 않았습니다:</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {missingTypes.map((t) => (
                                        <span key={t} className="px-2 py-0.5 rounded border border-[var(--color-alert-border)] bg-[var(--color-alert-bg)]/70 text-[var(--color-alert-text)] text-xs">{getTypeLabel(t)}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-b border-[var(--color-mainprompt)]/50 pb-2">
                        <h4 className="text-base font-semibold text-[var(--color-mainprompt)]">메인 채팅 프롬프트</h4>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={resetOrder} className="py-1 px-2 text-xs bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] border border-[var(--color-border)] rounded">초기화</button>
                        </div>
                    </div>
                    {localPrompts.main.map((item, index) => {
                        const title = item.name;

                        return (
                            <details
                                key={index}
                                className="group bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]"
                            >
                                <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                                    <div className="flex items-center">
                                        <span className="text-[var(--color-text-informative-primary)] w-6 text-center mr-2">{index + 1}.</span>
                                        <span className="text-base font-medium text-[var(--color-text-primary)]">{title}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); moveIndex(index, -1); }}
                                            className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-primary)]"
                                            title="위로 이동"
                                            aria-label="위로 이동"
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); moveIndex(index, 1); }}
                                            className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-primary)]"
                                            title="아래로 이동"
                                            aria-label="아래로 이동"
                                        >
                                            <ArrowDown className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={(e) => { e.preventDefault(); removeIndex(index); }} className="text-xs px-2 py-1 border rounded text-[var(--color-textual-button-negative)]">삭제</button>
                                        <ChevronDown className="w-5 h-5 text-[var(--color-icon-secondary)] transition-transform duration-300 group-open:rotate-180" />
                                    </div>
                                </summary>
                                <div className="content-wrapper">
                                    <div className="content-inner p-4 border-t border-[var(--color-border)]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <button onClick={() => setPromptToDefault(index)} className="py-1 px-3 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded text-xs flex items-center gap-1 border border-[var(--color-border)]">
                                                <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                            <div className="flex flex-col">
                                                <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">이름</label>
                                                <input value={item.name}
                                                    onChange={e => handleMainPromptChange(index, { name: e.target.value })}
                                                    className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm" placeholder="이름" />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">타입</label>
                                                <select
                                                    value={item.type}
                                                    onChange={e => handleMainPromptChange(index, { type: e.target.value as PromptType })}
                                                    className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm"
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
                                                    <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">역할</label>
                                                    <select value={item.role}
                                                        onChange={e => handleMainPromptChange(index, { role: e.target.value as PromptRole })}
                                                        className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm">
                                                        <option value="system">system</option>
                                                        <option value="assistant">assistant</option>
                                                        <option value="user">user</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                        {item.type !== 'chat' && item.type !== 'lorebook' && item.type !== 'authornote' && item.type !== 'memory' && item.type !== 'extraSystemInstruction' && item.type !== 'userDescription' && item.type !== 'characterPrompt' && (
                                            <div>
                                                <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1 block">프롬프트 내용</label>
                                                <textarea
                                                    value={item.content}
                                                    onChange={e => handleMainPromptChange(index, { content: e.target.value })}
                                                    className="w-full h-64 p-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg text-sm font-mono border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)]" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </details>
                        );
                    })}

                    <div className="flex justify-center mt-4">
                        <button type="button" onClick={addNewPrompt} className="py-2 px-4 text-sm bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] rounded-lg text-[var(--color-text-accent)]">+ 새 프롬프트 추가</button>
                    </div>

                    <h4 className="text-base font-semibold text-[var(--color-image-response)] border-b border-[var(--color-image-response)]/50 pb-2 mt-6">이미지 응답 생성 프롬프트</h4>
                    <details className="group bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
                        <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                            <span className="text-base font-medium text-[var(--color-text-primary)]">{localPrompts.image_response_generation.name || '# 이미지 응답 생성 규칙 (Image Response Generation Rules)'}</span>
                            <ChevronDown className="w-5 h-5 text-[var(--color-icon-secondary)] transition-transform duration-300 group-open:rotate-180" />
                        </summary>
                        <div className="content-wrapper">
                            <div className="content-inner p-4 border-t border-[var(--color-border)]">
                                <div className="flex items-center gap-2 mb-3">
                                    <button onClick={() => setPromptToDefault('image_response_generation')} className="py-1 px-3 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded text-xs flex items-center gap-1 border border-[var(--color-border)]">
                                        <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">이름</label>
                                        <input value={localPrompts.image_response_generation.name}
                                            onChange={e => setLocalPrompts(prev => ({ ...prev, image_response_generation: { ...prev.image_response_generation, name: e.target.value } }))}
                                            className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm" placeholder="이름" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">타입 <span className="text-[11px] text-[var(--color-text-informative-secondary)]">(고정)</span></label>
                                        <select
                                            value={localPrompts.image_response_generation.type}
                                            disabled
                                            aria-disabled
                                            className="w-full p-2 bg-[var(--color-bg-input-primary)] text-[var(--color-text-interface)] rounded border border-[var(--color-border)] text-sm cursor-not-allowed"
                                        >
                                            <option value={localPrompts.image_response_generation.type}>{getTypeLabel(localPrompts.image_response_generation.type)}</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">역할</label>
                                        <select value={localPrompts.image_response_generation.role}
                                            onChange={e => setLocalPrompts(prev => ({ ...prev, image_response_generation: { ...prev.image_response_generation, role: e.target.value as PromptRole } }))}
                                            className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm">
                                            <option value="system">system</option>
                                            <option value="assistant">assistant</option>
                                            <option value="user">user</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1 block">프롬프트 내용</label>
                                    <textarea
                                        value={localPrompts.image_response_generation.content}
                                        onChange={e => setLocalPrompts(prev => ({ ...prev, image_response_generation: { ...prev.image_response_generation, content: e.target.value } }))}
                                        className="w-full h-64 p-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg text-sm font-mono border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)]" />
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* information_template UI removed; conversation/output format are handled in the main list like others */}
                </div>
                <div className="p-6 mt-auto border-t border-[var(--color-border)] shrink-0 flex flex-wrap justify-end gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button onClick={handleBackup} className="py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors text-sm flex items-center gap-2 border border-[var(--color-border)]">
                        <Download className="w-4 h-4" /> 프롬프트 백업
                    </button>
                    <button onClick={handleImportClick} className="py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors text-sm flex items-center gap-2 border border-[var(--color-border)]">
                        <Upload className="w-4 h-4" /> 프롬프트 불러오기
                    </button>
                    <div className="flex-grow"></div>
                    <button onClick={onClose} className="py-2.5 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors">취소</button>
                    <button onClick={handleSave} className="py-2.5 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors">저장</button>
                </div>
            </div>
        </div>
    );
}

export default PromptModal;
