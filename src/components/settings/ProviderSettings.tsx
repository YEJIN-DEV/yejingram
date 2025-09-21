import React, { useState } from 'react';
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
    // openrouter: [],
    customOpenAI: []
};
export type ProviderModel = typeof providerModels[keyof typeof providerModels][number];

export function ProviderSettings({ settings, setSettings }: ProviderSettingsProps) {
    const { t } = useTranslation();
    const [customModelInput, setCustomModelInput] = useState('');
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

    const handleModelSelect = (model: string) => {
        handleConfigChange('model', model);
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

            {provider === 'customOpenAI' && (
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
            )}

            <div>
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
        </div>
    );
}
