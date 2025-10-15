import React, { useEffect, useState } from 'react';
import type { SettingsState, ApiConfig } from '../../entities/setting/types';
import { Key, Cpu, Link, Plus, X, Briefcase, Globe } from 'lucide-react';
import { initialApiConfigs } from '../../entities/setting/slice';
import { Toggle } from '../Toggle';

import { useTranslation } from 'react-i18next';

interface ProviderSettingsProps {
    settings: SettingsState;
    setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
}

const providerModels: Record<string, string[]> = {
    gemini: [
        'gemini-2.5-pro',
        'gemini-2.5-flash'
    ],
    vertexai: [
        'gemini-2.5-pro',
        'gemini-2.5-flash'
    ],
    claude: [
        'claude-sonnet-4-5',
        'claude-opus-4-1-20250805',
        'claude-opus-4-20250514',
        'claude-sonnet-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-haiku-20241022',
        'claude-3-haiku-20240307'
    ],
    openai: [
        'gpt-5',
        'gpt-5-chat-latest',
        'gpt-4o',
        'chatgpt-4o-latest',
    ],
    grok: [
        'grok-4-0709',
        'grok-3'
    ],
    deepseek: [
        'deepseek-chat',
        'deepseek-reasoner'
    ],
    openrouter: [],
    customOpenAI: []
};

export type ProviderModel = typeof providerModels[keyof typeof providerModels][number];

export function ProviderSettings({ settings, setSettings }: ProviderSettingsProps) {
    const { t } = useTranslation();
    const [customModelInput, setCustomModelInput] = useState('');
    type OpenRouterModel = { id: string; name: string; price: number; context_length?: number; tokenizer?: string };
    const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
    const [openRouterLoading, setOpenRouterLoading] = useState(false);
    const [openRouterError, setOpenRouterError] = useState<string | null>(null);
    const [openRouterSearch, setOpenRouterSearch] = useState('');
    const [endpointOptions, setEndpointOptions] = useState<string[]>([]); // provider endpoints for selected model
    const [endpointLoading, setEndpointLoading] = useState(false);
    const [endpointError, setEndpointError] = useState<string | null>(null);
    const provider = settings.apiProvider;
    const rawConfig = settings?.apiConfigs?.[provider];
    const config = {
        ...rawConfig,
        customModels: rawConfig.customModels || []
    };
    const models = providerModels[provider] || [];

    const handleConfigChange = (key: keyof ApiConfig, value: any) => {
        setSettings(prev => {
            const currentProviderConfig = prev.apiConfigs[provider] ?? initialApiConfigs[provider]; // Use initial config as fallback
            return {
                ...prev,
                apiConfigs: {
                    ...prev.apiConfigs,
                    [provider]: { ...currentProviderConfig, [key]: value }
                }
            };
        });
    };

    const handleModelSelect = async (model: string) => {
        handleConfigChange('model', model);
        if (provider === 'openrouter') {
            const selected = openRouterModels.find(m => m.id === model);
            handleConfigChange('tokenizer', selected?.tokenizer || '');
            await loadModelEndpoints(model, true);
        }
    };

    const handleAddCustomModel = () => {
        if (customModelInput && !config.customModels.includes(customModelInput)) {
            const newCustomModels = [...config.customModels, customModelInput];
            handleConfigChange('customModels', newCustomModels);
            setCustomModelInput('');
        }
    };

    const handleRemoveCustomModel = (index: number) => {
        const newCustomModels = [...config.customModels];
        newCustomModels.splice(index, 1);
        handleConfigChange('customModels', newCustomModels);
    };

    async function openRouterModel(): Promise<OpenRouterModel[]> {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/models");

            if (!response.ok) {
                console.error("Failed to fetch models:", response.status, response.statusText);
                return [] as OpenRouterModel[];
            }

            const data: { data?: any[] } = await response.json();

            if (!Array.isArray(data?.data)) {
                console.error("Invalid response format:", data);
                return [] as OpenRouterModel[];
            }

            const models: OpenRouterModel[] = data.data
                .map((model: any) => {
                    const { id, name, pricing, context_length, architecture } = model;

                    // 기본값 처리
                    const promptPrice = Number(pricing?.prompt) || 0;
                    const completionPrice = Number(pricing?.completion) || 0;

                    // 단가 계산
                    const avgPrice = ((promptPrice * 3) + completionPrice) / 4;

                    let displayName = name;
                    if (avgPrice > 0) {
                        displayName += ` - $${(avgPrice * 1000).toFixed(5)}/1k`;
                    } else {
                        displayName += " - Free";
                    }

                    return {
                        id,
                        name: displayName,
                        price: avgPrice,
                        context_length,
                        tokenizer: architecture?.tokenizer,
                    };
                })
                .filter((m: any) => m.price >= 0)
                .sort((a: any, b: any) => a.price - b.price);

            return models;
        } catch (error) {
            console.error("Error loading OpenRouter models:", error);
            return [] as OpenRouterModel[];
        }
    }

    // Fetch list endpoints for a selected model (OpenRouter specific)
    async function loadModelEndpoints(modelId: string, resetOrder: boolean = false) {
        setEndpointError(null);
        setEndpointLoading(true);
        try {
            const url = `https://openrouter.ai/api/v1/models/${modelId}/endpoints`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const entries: Array<{ tag: string; supportsResponseFormat: boolean }> = Array.isArray(data.data.endpoints)
                ? data.data.endpoints.map((ep: any) => {
                    const tag = ep.tag;
                    const supported: string[] = Array.isArray(ep.supported_parameters) ? ep.supported_parameters : [];
                    const supports = supported.includes('response_format') || supported.includes('structured_outputs');
                    return (typeof tag === 'string') ? { tag, supportsResponseFormat: supports } : null;
                }).filter(Boolean) as any
                : [];
            const unique = entries.map(e => e.tag).filter((v, i, a) => a.indexOf(v) === i);
            setEndpointOptions(unique);
            if (resetOrder || !Array.isArray(config.providers) || config.providers.length === 0) {
                handleConfigChange('providers', entries as any);
            } else {
                const supportMap: Record<string, boolean> = Object.fromEntries(entries.map(e => [e.tag, e.supportsResponseFormat]));
                const updated = (config.providers || []).map((p: any) => ({ tag: p.tag, supportsResponseFormat: supportMap[p.tag] ?? p.supportsResponseFormat }));
                handleConfigChange('providers', updated as any);
            }
        } catch (e: any) {
            console.error('Failed to load endpoints:', e);
            setEndpointError(t('settings.ai.openrouter.endpointsLoadFailed'));
            setEndpointOptions([]);
        } finally {
            setEndpointLoading(false);
        }
    }

    // Load OpenRouter models when provider switches to openrouter
    useEffect(() => {
        if (provider !== 'openrouter') return;
        let ignore = false;
        (async () => {
            try {
                setOpenRouterError(null);
                setOpenRouterLoading(true);
                const models = await openRouterModel();
                if (!ignore) setOpenRouterModels(models);
                // If a model is already selected, load its endpoints
                if (!ignore && config.model) {
                    await loadModelEndpoints(config.model);
                }
            } catch (e) {
                if (!ignore) setOpenRouterError(t('settings.ai.openrouter.modelsLoadFailed'));
            } finally {
                if (!ignore) setOpenRouterLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [provider]);

    const refreshOpenRouterModels = async () => {
        try {
            setOpenRouterError(null);
            setOpenRouterLoading(true);
            const models = await openRouterModel();
            setOpenRouterModels(models);
        } catch (e) {
            setOpenRouterError(t('settings.ai.openrouter.modelsLoadFailed'));
        } finally {
            setOpenRouterLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Toggle
                id="structured-output-toggle"
                label={t('settings.ai.structuredOutput.label')}
                description={t('settings.ai.structuredOutput.help')}
                checked={settings.useStructuredOutput || false}
                onChange={checked => setSettings(prev => ({ ...prev, useStructuredOutput: checked, useImageResponse: checked ? prev.useImageResponse : false }))}
                additionalDescription={
                    provider === 'claude' && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('settings.ai.structuredOutput.warnClaude')}</p>
                    )
                }
            />
            {settings.useStructuredOutput && provider === 'customOpenAI' && (
                <Toggle
                    id="response-format-toggle"
                    label={t('settings.ai.responseFormat.label')}
                    description={t('settings.ai.responseFormat.help')}
                    checked={settings.useResponseFormat ?? true}
                    onChange={checked => setSettings(prev => ({ ...prev, useResponseFormat: checked }))}
                />
            )}
            {settings.useStructuredOutput && (
                <Toggle
                    id="image-response-toggle"
                    label={t('settings.ai.imageResponse.label')}
                    description={t('settings.ai.imageResponse.help')}
                    checked={settings.useImageResponse || false}
                    onChange={checked => setSettings(prev => ({ ...prev, useImageResponse: checked }))}
                />
            )}
            {provider !== 'vertexai' && (
                <div>
                    <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Key className="w-4 h-4 mr-2" />{t('settings.ai.apiKeyLabel')}</label>
                    <input
                        type="password"
                        value={config.apiKey}
                        onChange={e => handleConfigChange('apiKey', e.target.value)}
                        placeholder={t('settings.ai.apiKeyPlaceholder')}
                        className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-transform duration-200 text-sm"
                    />
                </div>
            )}

            {provider === 'vertexai' && (
                <>
                    <div>
                        <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Briefcase className="w-4 h-4 mr-2" />{t('settings.ai.vertex.projectIdLabel')}</label>
                        <input
                            type="text"
                            value={config.projectId || ''}
                            onChange={e => handleConfigChange('projectId', e.target.value)}
                            placeholder={t('settings.ai.vertex.projectIdPlaceholder')}
                            className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-transform duration-200 text-sm"
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Globe className="w-4 h-4 mr-2" />{t('settings.ai.vertex.locationLabel')}</label>
                        <input
                            type="text"
                            value={config.location || ''}
                            onChange={e => handleConfigChange('location', e.target.value)}
                            placeholder="global"
                            className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-transform duration-200 text-sm"
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Key className="w-4 h-4 mr-2" />{t('settings.ai.vertex.accessTokenLabel')}</label>
                        <input
                            type="password"
                            value={config.accessToken || ''}
                            onChange={e => handleConfigChange('accessToken', e.target.value)}
                            placeholder="gcloud auth print-access-token"
                            className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-transform duration-200 text-sm"
                        />
                    </div>
                </>
            )}

            {provider === 'openrouter' && (
                <div className="space-y-2">
                    <div>
                        <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Cpu className="w-4 h-4 mr-2" />{t('settings.ai.openrouter.modelLabel')}</label>
                        <div className="flex gap-2 items-center mb-2">
                            <input
                                type="text"
                                value={openRouterSearch}
                                onChange={e => setOpenRouterSearch(e.target.value)}
                                placeholder={t('settings.ai.openrouter.searchPlaceholder')}
                                className="flex-1 px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm"
                            />
                            <button
                                type="button"
                                onClick={refreshOpenRouterModels}
                                className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-interface)] text-sm"
                            >
                                {t('settings.ai.openrouter.refresh')}
                            </button>
                        </div>
                        {openRouterLoading && (
                            <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.ai.openrouter.loading')}</p>
                        )}
                        {openRouterError && (
                            <p className="text-xs text-[var(--color-button-negative)]">{openRouterError}</p>
                        )}
                        {!openRouterLoading && !openRouterError && (
                            <div>
                                {openRouterModels.length === 0 ? (
                                    <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.ai.openrouter.noModels')}</p>
                                ) : (
                                    <select
                                        value={config.model || ''}
                                        onChange={(e) => handleModelSelect(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm"
                                    >
                                        <option value="" disabled>{config.model ? t('settings.ai.openrouter.selectAnotherModel') : t('settings.ai.openrouter.selectModel')}</option>
                                        {openRouterModels
                                            .filter(m => {
                                                const q = openRouterSearch.trim().toLowerCase();
                                                if (!q) return true;
                                                return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
                                            })
                                            .map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name}
                                                </option>
                                            ))}
                                    </select>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Provider endpoints for the selected model */}
                    {config.model && (
                        <div className="mt-3">
                            <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Link className="w-4 h-4 mr-2" />{t('settings.ai.openrouter.providerPriority')}</label>
                            {endpointLoading && <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.ai.openrouter.endpointsLoading')}</p>}
                            {endpointError && <p className="text-xs text-[var(--color-button-negative)]">{endpointError}</p>}
                            {!endpointLoading && !endpointError && (
                                endpointOptions.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.ai.openrouter.priorityHelp')}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {endpointOptions.map(tag => {
                                                const orderList = (config.providers || []).map((p: any) => p.tag);
                                                const active = orderList.includes(tag);
                                                const orderIndex = orderList.indexOf(tag);
                                                return (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = (config.providers || []) as Array<{ tag: string; supportsResponseFormat: boolean }>;
                                                            if (active) {
                                                                // toggle off
                                                                handleConfigChange('providers', current.filter(x => x.tag !== tag));
                                                            } else {
                                                                handleConfigChange('providers', [...current, { tag, supportsResponseFormat: false }] as any);
                                                            }
                                                        }}
                                                        className={`px-3 py-1 rounded-full border text-xs ${active ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-focus-border)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-interface)] hover:bg-[var(--color-bg-hover)] border-[var(--color-border)]'}`}
                                                        title={active ? t('settings.ai.openrouter.selectedWithOrder', { order: orderIndex + 1 }) : t('settings.ai.openrouter.clickToAdd')}
                                                    >
                                                        {tag}{active ? ` · ${orderIndex + 1}` : ''}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {(config.providers || []).length > 0 && (
                                            <div className="mt-2">
                                                <label className="text-xs text-[var(--color-icon-tertiary)]">{t('settings.ai.openrouter.currentPriority')}</label>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {(config.providers || []).map((p: any, idx: number) => (
                                                        <span key={p.tag} className="px-2 py-1 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text-interface)] border border-[var(--color-border)] text-xs">
                                                            {idx + 1}. {p.tag}{p.supportsResponseFormat ? ' · JSON' : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <Toggle
                                            id="allow-fallbacks-toggle"
                                            label={t('settings.ai.openrouter.allowFallbacksLabel')}
                                            description={t('settings.ai.openrouter.allowFallbacksHelp')}
                                            checked={config.providerAllowFallbacks ?? true}
                                            onChange={(checked) => handleConfigChange('providerAllowFallbacks', checked)}
                                        />
                                    </div>
                                ) : (
                                    <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.ai.openrouter.noEndpoints')}</p>
                                )
                            )}
                        </div>
                    )}
                </div>
            )}

            {provider === 'customOpenAI' && (
                <div className="space-y-3">
                    <div>
                        <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Link className="w-4 h-4 mr-2" />{t('settings.ai.customOpenAI.baseUrlLabel')}</label>
                        <input
                            type="text"
                            value={config.baseUrl || ''}
                            onChange={e => handleConfigChange('baseUrl', e.target.value)}
                            placeholder="https://api.openai.com/v1"
                            className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-transform duration-200 text-sm"
                        />
                    </div>

                    {/* Tokenizer selection for customOpenAI (used by web-tokenizers in countTokens) */}
                    <div>
                        <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Cpu className="w-4 h-4 mr-2" />{t('settings.ai.customOpenAI.tokenizerLabel')}</label>
                        {(() => {
                            // Display labels while saving normalized values. OpenAI variants should store bare algorithm ids.
                            const tokenizerOptions = [
                                { label: 'OpenAI (o200k_base)', value: 'o200k_base' },
                                { label: 'OpenAI (cl100k_base)', value: 'cl100k_base' },
                                { label: 'DeepSeek', value: 'DeepSeek' },
                                { label: 'Llama2', value: 'Llama2' },
                                { label: 'Llama3', value: 'Llama3' },
                                { label: 'Llama4', value: 'Llama4' },
                                { label: 'Mistral', value: 'Mistral' },
                                { label: 'Qwen', value: 'Qwen' },
                                { label: 'Qwen3', value: 'Qwen3' },
                            ];
                            const normalizedValue = (() => {
                                const v = config.tokenizer || '';
                                if (v === 'OpenAI (o200k_base)') return 'o200k_base';
                                if (v === 'OpenAI (cl100k_base)') return 'cl100k_base';
                                return v;
                            })();
                            return (
                                <select
                                    value={normalizedValue}
                                    onChange={(e) => handleConfigChange('tokenizer', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm"
                                >
                                    <option value="" disabled>{t('settings.ai.customOpenAI.selectTokenizer')}</option>
                                    {/* Keep this list in sync with CustomTokenizer and supported algorithms in src/utils/token.ts */}
                                    {tokenizerOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            );
                        })()}
                    </div>
                </div>
            )}

            {provider !== 'openrouter' && (<div>
                <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Cpu className="w-4 h-4 mr-2" />{t('settings.ai.modelLabel')}</label>

                {models.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 mb-3">
                        {models.map(model => (
                            <button
                                key={model}
                                type="button"
                                onClick={() => handleModelSelect(model)}
                                className={`model-select-btn px-3 py-2 text-left text-sm rounded-lg transition-colors border ${config.model === model ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-focus-border)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-interface)] hover:bg-[var(--color-bg-hover)] border-[var(--color-border)]'}`}>
                                {model}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={customModelInput}
                        onChange={e => setCustomModelInput(e.target.value)}
                        placeholder={t('settings.ai.customModelPlaceholder')}
                        className="flex-1 px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm"
                    />
                    <button
                        type="button"
                        onClick={handleAddCustomModel}
                        className="px-4 py-2 bg-[var(--color-button-positive)] hover:bg-[var(--color-button-positive)] text-[var(--color-text-accent)] rounded-lg text-sm flex items-center gap-1">
                        <Plus className="w-4 h-4" />{t('settings.ai.add')}
                    </button>
                </div>

                {config.customModels.length > 0 && (
                    <div className="mt-3 space-y-1">
                        <label className="text-xs text-[var(--color-icon-tertiary)]">{t('settings.ai.customModelsLabel')}</label>
                        {config.customModels.map((model, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleModelSelect(model)}
                                    className={`model-select-btn flex-1 px-3 py-2 text-left text-sm rounded-lg transition-colors border ${config.model === model ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-focus-border)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-interface)] hover:bg-[var(--color-bg-hover)] border-[var(--color-border)]'}`}>
                                    {model}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCustomModel(index)}
                                    className="remove-custom-model-btn px-2 py-2 bg-[var(--color-button-negative)] hover:bg-[var(--color-button-negative)] text-[var(--color-text-accent)] rounded-lg text-sm">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            )}
        </div>
    );
}
