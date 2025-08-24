import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, RotateCcw, Download, Upload } from 'lucide-react';
import { selectPrompts } from '../../entities/setting/selectors';
import { settingsActions, initialState } from '../../entities/setting/slice';
import type { Prompts } from '../../entities/setting/types';

const mainPromptSections = {
    '# 시스템 규칙 (System Rules)': 'system_rules',
    '# AI 역할 및 목표 (Role and Objective)': 'role_and_objective',
    '## 메모리 생성 (Memory Generation)': 'memory_generation',
    '## 캐릭터 연기 (Character Acting)': 'character_acting',
    '## 메시지 작성 스타일 (Message Writing Style)': 'message_writing_style',
    '## 언어 (Language)': 'language',
    '## 추가 지시사항 (Additional Instructions)': 'additional_instructions',
    '## 스티커 사용법 (Sticker Usage)': 'sticker_usage',
    '## 그룹챗 컨텍스트 (Group Chat Context)': 'group_chat_context',
    '## 오픈챗 컨텍스트 (Open Chat Context)': 'open_chat_context',
};

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function PromptModal({ isOpen, onClose }: PromptModalProps) {
    const dispatch = useDispatch();
    const prompts = useSelector(selectPrompts);

    const [localPrompts, setLocalPrompts] = useState<Prompts>(prompts);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    const handleMainPromptChange = (key: keyof Prompts['main'], value: string) => {
        setLocalPrompts(prev => ({ ...prev, main: { ...prev.main, [key]: value } }));
    };

    const setPromptToDefault = (key: keyof Prompts['main'] | "message_writing_style" | "profile_creation" | "character_sheet_generation") => {
        if (confirm('기본값으로 되돌리시겠습니까?')) {
            if (key === "message_writing_style") {
                setLocalPrompts(prev => ({
                    ...prev,
                    main: {
                        ...prev.main,
                        message_writing_structured: initialState.prompts.main.message_writing_structured,
                        message_writing_unstructured: initialState.prompts.main.message_writing_unstructured
                    }
                }));
            } else if (key === "profile_creation" || key === "character_sheet_generation") {
                setLocalPrompts(prev => ({
                    ...prev,
                    [key]: initialState.prompts[key]
                }));
            } else {
                setLocalPrompts(prev => ({
                    ...prev,
                    main: {
                        ...prev.main,
                        [key]: initialState.prompts.main[key]
                    }
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

    const extractPrompts = (data: unknown): Prompts | null => {
        const obj = data as AnyRecord | null;
        const maybe = (obj && (obj as AnyRecord).prompts) ? (obj as AnyRecord).prompts : obj;
        if (!maybe || typeof maybe !== 'object') return null;
        const p = maybe as any;

        if (!p.main || typeof p.profile_creation !== 'string' || typeof p.character_sheet_generation !== 'string') {
            return null;
        }
        return p as Prompts;
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
            <div className="bg-gray-800 rounded-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>
                <div className="flex items-center justify-between p-6 border-b border-gray-700 shrink-0">
                    <h3 className="text-lg font-semibold text-white">프롬프트 수정</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <h4 className="text-base font-semibold text-blue-300 border-b border-blue-300/20 pb-2">메인 채팅 프롬프트</h4>
                    {Object.entries(mainPromptSections).map(([title, key]) => {
                        if (key === 'message_writing_style') {
                            return (
                                <details key={key} className="group bg-gray-900/50 rounded-lg">
                                    <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                                        <span className="text-base font-medium text-gray-200">{title}</span>
                                        <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                                    </summary>
                                    <div className="content-wrapper">
                                        <div className="content-inner p-4 border-t border-gray-700">
                                            <div className="flex items-center gap-2 mb-3">
                                                <button onClick={() => {
                                                    setPromptToDefault('message_writing_style');
                                                }} className="py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs flex items-center gap-1">
                                                    <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                                </button>
                                            </div>
                                            <h5 className="text-sm font-semibold text-gray-300 mb-2">Structured</h5>
                                            <textarea
                                                value={localPrompts.main.message_writing_structured}
                                                onChange={e => handleMainPromptChange('message_writing_structured', e.target.value)}
                                                className="w-full h-64 p-3 bg-gray-700 text-white rounded-lg text-sm font-mono mb-4" />

                                            <h5 className="text-sm font-semibold text-gray-300 mb-2">Unstructured</h5>
                                            <textarea
                                                value={localPrompts.main.message_writing_unstructured}
                                                onChange={e => handleMainPromptChange('message_writing_unstructured', e.target.value)}
                                                className="w-full h-64 p-3 bg-gray-700 text-white rounded-lg text-sm font-mono" />
                                        </div>
                                    </div>
                                </details>
                            );
                        }

                        return (
                            <details key={key} className="group bg-gray-900/50 rounded-lg">
                                <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                                    <span className="text-base font-medium text-gray-200">{title}</span>
                                    <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                                </summary>
                                <div className="content-wrapper">
                                    <div className="content-inner p-4 border-t border-gray-700">
                                        <div className="flex items-center gap-2 mb-3">
                                            <button onClick={() => setPromptToDefault(key as keyof Prompts['main'])} className="py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs flex items-center gap-1">
                                                <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                            </button>
                                        </div>
                                        <textarea
                                            value={localPrompts.main[key as keyof Prompts['main']]}
                                            onChange={e => handleMainPromptChange(key as keyof Prompts['main'], e.target.value)}
                                            className="w-full h-64 p-3 bg-gray-700 text-white rounded-lg text-sm font-mono" />
                                    </div>
                                </div>
                            </details>
                        );
                    })}

                    <h4 className="text-base font-semibold text-blue-300 border-b border-blue-300/20 pb-2 mt-6">랜덤 선톡 캐릭터 생성 프롬프트</h4>
                    <details className="group bg-gray-900/50 rounded-lg">
                        <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                            <span className="text-base font-medium text-gray-200"># 캐릭터 생성 규칙 (Profile Creation Rules)</span>
                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                        </summary>
                        <div className="content-wrapper">
                            <div className="content-inner p-4 border-t border-gray-700">
                                <div className="flex items-center gap-2 mb-3">
                                    <button onClick={() => setPromptToDefault('profile_creation')} className="py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs flex items-center gap-1">
                                        <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                    </button>
                                </div>
                                <textarea
                                    value={localPrompts.profile_creation}
                                    onChange={e => setLocalPrompts(prev => ({ ...prev, profile_creation: e.target.value }))}
                                    className="w-full h-64 p-3 bg-gray-700 text-white rounded-lg text-sm font-mono" />
                            </div>
                        </div>
                    </details>

                    <h4 className="text-base font-semibold text-green-300 border-b border-green-300/20 pb-2 mt-6">초대하기 AI 캐릭터 시트 생성 프롬프트</h4>
                    <details className="group bg-gray-900/50 rounded-lg">
                        <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                            <span className="text-base font-medium text-gray-200"># 캐릭터 시트 생성 규칙 (Character Sheet Generation Rules)</span>
                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                        </summary>
                        <div className="content-wrapper">
                            <div className="content-inner p-4 border-t border-gray-700">
                                <div className="flex items-center gap-2 mb-3">
                                    <button onClick={() => setPromptToDefault('character_sheet_generation')} className="py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs flex items-center gap-1">
                                        <RotateCcw className="w-3 h-3" /> 기본값으로 되돌리기
                                    </button>
                                </div>
                                <textarea
                                    value={localPrompts.character_sheet_generation}
                                    onChange={e => setLocalPrompts(prev => ({ ...prev, character_sheet_generation: e.target.value }))}
                                    className="w-full h-64 p-3 bg-gray-700 text-white rounded-lg text-sm font-mono" />
                            </div>
                        </div>
                    </details>
                </div>
                <div className="p-6 mt-auto border-t border-gray-700 shrink-0 flex flex-wrap justify-end gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button onClick={handleBackup} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors text-sm flex items-center gap-2">
                        <Download className="w-4 h-4" /> 프롬프트 백업
                    </button>
                    <button onClick={handleImportClick} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors text-sm flex items-center gap-2">
                        <Upload className="w-4 h-4" /> 프롬프트 불러오기
                    </button>
                    <div className="flex-grow"></div>
                    <button onClick={onClose} className="py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">취소</button>
                    <button onClick={handleSave} className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">저장</button>
                </div>
            </div>
        </div>
    );
}

export default PromptModal;
