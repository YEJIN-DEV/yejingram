import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState, useMemo } from 'react';
import { X, ChevronDown, RotateCcw, Download, Upload, ArrowUp, ArrowDown, AlertTriangle, Thermometer, Percent, ArrowUpToLine } from 'lucide-react';
import { selectAllSettings, selectPrompts } from '../../entities/setting/selectors';
import { settingsActions, initialState } from '../../entities/setting/slice';
import type { Prompts, PromptItem, PromptRole, PromptType } from '../../entities/setting/types';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function PromptModal({ isOpen, onClose }: PromptModalProps) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const settings = useSelector(selectAllSettings);
    const prompts = useSelector(selectPrompts);

    const currentApiProvider = settings.apiProvider;
    const [localPrompts, setLocalPrompts] = useState<Prompts>(prompts);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // 타입 라벨 매핑
    const typeLabelMap: Record<PromptType, string> = {
        'image-generation': t('settings.prompts.types.imageGeneration'),
        'plain': t('settings.prompts.types.plain'),
        'plain-structured': t('settings.prompts.types.plainStructured'),
        'plain-unstructured': t('settings.prompts.types.plainUnstructured'),
        'plain-group': t('settings.prompts.types.plainGroup'),
        'extraSystemInstruction': t('settings.prompts.types.extraSystemInstruction'),
        'userDescription': t('settings.prompts.types.userDescription'),
        'characterPrompt': t('settings.prompts.types.characterPrompt'),
        'lorebook': t('settings.prompts.types.lorebook'),
        'authornote': t('settings.prompts.types.authornote'),
        'memory': t('settings.prompts.types.memory'),
        'chat': t('settings.prompts.types.chat'),
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
            name: t('settings.prompts.newPromptName'),
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
        if (confirm(t('settings.prompts.confirmReset'))) {
            if (typeof key === 'number') {
                setLocalPrompts(prev => {
                    const main = [...prev.main];
                    main[key] = initialState.prompts.main[key] || { name: t('settings.prompts.newPromptName'), type: 'plain', role: 'system', content: '' };
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
        } catch {
            alert(t('settings.prompts.alerts.downloadError'));
        }
    };

    const handleBackup = () => {
        downloadJson(localPrompts, 'prompts_backup');
    };

    type AnyRecord = Record<string, unknown>;

    const isPromptItem = (obj: any): obj is PromptItem => {
        return obj && typeof obj.name === 'string' && typeof obj.type === 'string';
    }

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
            ...p
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
                alert(t('settings.prompts.alerts.invalidFile'));
                return;
            }
            setLocalPrompts(parsed);
            alert(t('settings.prompts.alerts.imported'));
        } catch (err) {
            alert(t('settings.prompts.alerts.importError'));
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
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('settings.ai.editPrompts')}</h3>
                        {missingTypes.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-alert-bg)] text-[var(--color-alert-text)] border border-[var(--color-alert-border)]" title={t('settings.prompts.missingTypesBadge', { count: missingTypes.length })}>
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
                                <div className="font-medium">{t('settings.prompts.missingTypes.title')}</div>
                                <div className="mt-1 text-[var(--color-alert-text)]/90">{t('settings.prompts.missingTypes.desc')}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {missingTypes.map((t) => (
                                        <span key={t} className="px-2 py-0.5 rounded border border-[var(--color-alert-border)] bg-[var(--color-alert-bg)]/70 text-[var(--color-alert-text)] text-xs">{getTypeLabel(t)}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-b border-[var(--color-mainprompt)]/50 pb-2">
                        <h4 className="text-base font-semibold text-[var(--color-mainprompt)]">{t('settings.prompts.main.title')}</h4>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={resetOrder} className="py-1 px-2 text-xs bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] border border-[var(--color-border)] rounded">{t('themeSettings.reset')}</button>
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
                                            title={t('settings.prompts.item.moveUp')}
                                            aria-label={t('settings.prompts.item.moveUp')}
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); moveIndex(index, 1); }}
                                            className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-primary)]"
                                            title={t('settings.prompts.item.moveDown')}
                                            aria-label={t('settings.prompts.item.moveDown')}
                                        >
                                            <ArrowDown className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={(e) => { e.preventDefault(); removeIndex(index); }} className="text-xs px-2 py-1 border rounded text-[var(--color-textual-button-negative)]">{t('settings.prompts.item.delete')}</button>
                                        <ChevronDown className="w-5 h-5 text-[var(--color-icon-secondary)] transition-transform duration-300 group-open:rotate-180" />
                                    </div>
                                </summary>
                                <div className="content-wrapper">
                                    <div className="content-inner p-4 border-t border-[var(--color-border)]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <button onClick={() => setPromptToDefault(index)} className="py-1 px-3 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded text-xs flex items-center gap-1 border border-[var(--color-border)]">
                                                <RotateCcw className="w-3 h-3" /> {t('settings.prompts.resetToDefault')}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                            <div className="flex flex-col">
                                                <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{t('settings.prompts.fields.name')}</label>
                                                <input value={item.name}
                                                    onChange={e => handleMainPromptChange(index, { name: e.target.value })}
                                                    className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm" placeholder={t('settings.prompts.fields.namePlaceholder')} />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{t('settings.prompts.fields.type')}</label>
                                                <select
                                                    value={item.type}
                                                    onChange={e => handleMainPromptChange(index, { type: e.target.value as PromptType })}
                                                    className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm"
                                                >
                                                    {typeOptions.length === 0 && (
                                                        <option value="" disabled>{t('settings.prompts.fields.typeNone')}</option>
                                                    )}
                                                    {typeOptions.map((opt) => (
                                                        <option key={opt} value={opt}>{getTypeLabel(opt)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {item.type !== 'chat' && item.type !== 'extraSystemInstruction' && (
                                                <div className="flex flex-col">
                                                    <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{t('settings.prompts.fields.role')}</label>
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
                                                <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1 block">{t('settings.prompts.fields.content')}</label>
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
                        <button type="button" onClick={addNewPrompt} className="py-2 px-4 text-sm bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] rounded-lg text-[var(--color-text-accent)]">+ {t('settings.prompts.addNew')}</button>
                    </div>

                    <h4 className="text-base font-semibold text-[var(--color-image-response)] border-b border-[var(--color-image-response)]/50 pb-2 mt-6">{t('settings.prompts.image.title')}</h4>
                    <details className="group bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
                        <summary className="flex items-center justify-between cursor-pointer list-none p-4">
                            <span className="text-base font-medium text-[var(--color-text-primary)]">{localPrompts.image_response_generation.name || t('settings.prompts.image.fallbackTitle')}</span>
                            <ChevronDown className="w-5 h-5 text-[var(--color-icon-secondary)] transition-transform duration-300 group-open:rotate-180" />
                        </summary>
                        <div className="content-wrapper">
                            <div className="content-inner p-4 border-t border-[var(--color-border)]">
                                <div className="flex items-center gap-2 mb-3">
                                    <button onClick={() => setPromptToDefault('image_response_generation')} className="py-1 px-3 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded text-xs flex items-center gap-1 border border-[var(--color-border)]">
                                        <RotateCcw className="w-3 h-3" /> {t('settings.prompts.resetToDefault')}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{t('settings.prompts.fields.name')}</label>
                                        <input value={localPrompts.image_response_generation.name}
                                            onChange={e => setLocalPrompts(prev => ({ ...prev, image_response_generation: { ...prev.image_response_generation, name: e.target.value } }))}
                                            className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm" placeholder={t('settings.prompts.fields.namePlaceholder')} />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{t('settings.prompts.fields.type')} <span className="text-[11px] text-[var(--color-text-informative-secondary)]">{t('settings.prompts.fields.typeFixed')}</span></label>
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
                                        <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{t('settings.prompts.fields.role')}</label>
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
                                    <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1 block">{t('settings.prompts.fields.content')}</label>
                                    <textarea
                                        value={localPrompts.image_response_generation.content}
                                        onChange={e => setLocalPrompts(prev => ({ ...prev, image_response_generation: { ...prev.image_response_generation, content: e.target.value } }))}
                                        className="w-full h-64 p-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg text-sm font-mono border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)]" />
                                </div>
                            </div>
                        </div>
                    </details>
                    <h4 className="text-base font-semibold text-[var(--color-preview-accent-from)] border-b border-[var(--color-preview-border)]/40 pb-2 mt-6">{t('settings.prompts.tokens.title')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{t('settings.prompts.tokens.maxContext')}</label>
                            <input
                                type="number"
                                value={localPrompts.maxContextTokens}
                                onChange={e => setLocalPrompts(prev => ({ ...prev, maxContextTokens: parseInt(e.target.value) || -1 }))}
                                className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm"
                                placeholder={t('settings.prompts.tokens.maxContext')}
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">{t('settings.prompts.tokens.maxResponse')}</label>
                            <input
                                type="number"
                                value={localPrompts.maxResponseTokens}
                                onChange={e => setLocalPrompts(prev => ({ ...prev, maxResponseTokens: parseInt(e.target.value) || -1 }))}
                                className="w-full p-2 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] text-sm"
                                placeholder={t('settings.prompts.tokens.maxResponse')}
                            />
                        </div>
                    </div>
                    <h4 className="text-base font-semibold text-[var(--color-preview-accent-to)] border-b border-[var(--color-preview-border)]/40 pb-2 mt-6">{t('settings.prompts.generation.title')}</h4>
                    <div className="space-y-4 mt-4">
                        <div className="flex flex-col">
                            <label className="flex items-center justify-between text-xs font-medium text-[var(--color-text-tertiary)] mb-2">
                                <span className="flex items-center gap-1"><Thermometer className="w-4 h-4" /> {t('settings.prompts.generation.temperature')}</span>
                                <span className="text-[var(--color-preview-accent-to)] font-semibold">{localPrompts.temperature?.toFixed(2) ?? 'N/A'}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max={currentApiProvider === 'claude' ? 1 : 2}
                                step="0.01"
                                value={localPrompts.temperature || 1.25}
                                onChange={e => setLocalPrompts(prev => ({ ...prev, temperature: parseFloat(parseFloat(e.target.value).toFixed(2)) ?? -1 }))}

                                className="w-full accent-[var(--color-button-primary)]"
                            />
                            <div className="flex justify-between text-xs text-[var(--color-text-informative-primary)] mt-1">
                                <span>0</span>
                                <span>{currentApiProvider === 'claude' ? 1 : 2}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className="flex items-center justify-between text-xs font-medium text-[var(--color-text-tertiary)] mb-2">
                                <span className="flex items-center gap-1"><Percent className="w-4 h-4" /> {t('settings.prompts.generation.topP')}</span>
                                <span className="text-[var(--color-preview-accent-to)] font-semibold">{localPrompts.topP?.toFixed(2) ?? 'N/A'}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={localPrompts.topP || 0.95}
                                onChange={e => setLocalPrompts(prev => ({ ...prev, topP: parseFloat(parseFloat(e.target.value).toFixed(2)) ?? -1 }))}
                                className="w-full accent-[var(--color-button-primary)]"
                            />
                            <div className="flex justify-between text-xs text-[var(--color-text-informative-primary)] mt-1">
                                <span>0</span>
                                <span>1</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <label className="flex items-center justify-between text-xs font-medium text-[var(--color-text-tertiary)] mb-2">
                                <span className="flex items-center gap-1"><ArrowUpToLine className="w-4 h-4" /> {t('settings.prompts.generation.topK')}</span>
                                <span className="text-[var(--color-preview-accent-to)] font-semibold">{localPrompts.topK ?? 'N/A'}</span>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                step="1"
                                value={localPrompts.topK || 40}
                                onChange={e => setLocalPrompts(prev => ({ ...prev, topK: parseInt(e.target.value) ?? -1 }))}
                                className="w-full accent-[var(--color-button-primary)]"
                            />
                            <div className="flex justify-between text-xs text-[var(--color-text-informative-primary)] mt-1">
                                <span>1</span>
                                <span>100</span>
                            </div>
                        </div>
                    </div>
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
                        <Download className="w-4 h-4" /> {t('settings.prompts.actions.backup')}
                    </button>
                    <button onClick={handleImportClick} className="py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors text-sm flex items-center gap-2 border border-[var(--color-border)]">
                        <Upload className="w-4 h-4" /> {t('settings.prompts.actions.import')}
                    </button>
                    <div className="flex-grow"></div>
                    <button onClick={onClose} className="py-2.5 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                    <button onClick={handleSave} className="py-2.5 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors">{t('common.save')}</button>
                </div>
            </div>
        </div>
    );
}

export default PromptModal;
