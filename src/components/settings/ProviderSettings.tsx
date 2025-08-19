import React, { useState } from 'react';
import type { SettingsState, ApiProvider, ApiConfig } from '../../entities/setting/types';
import { Key, Cpu, Link, Plus, X, Briefcase, Globe } from 'lucide-react';
import { initialApiConfigs } from '../../entities/setting/slice';

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
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4.1'
    ],
    grok: [],
    openrouter: [],
    customOpenAI: []
};

export function ProviderSettings({ settings, setSettings }: ProviderSettingsProps) {
    const [customModelInput, setCustomModelInput] = useState('');
    const provider = settings.apiProvider;
    const rawConfig = settings?.apiConfigs?.[provider] ?? initialApiConfigs[provider];
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
            {provider !== 'vertexai' && (
                <div>
                    <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><Key className="w-4 h-4 mr-2" />API 키</label>
                    <input
                        type="password"
                        value={config.apiKey}
                        onChange={e => handleConfigChange('apiKey', e.target.value)}
                        placeholder="API 키를 입력하세요"
                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm"
                    />
                </div>
            )}

            {provider === 'vertexai' && (
                <>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><Briefcase className="w-4 h-4 mr-2" />Project ID</label>
                        <input
                            type="text"
                            value={config.projectId || ''}
                            onChange={e => handleConfigChange('projectId', e.target.value)}
                            placeholder="Vertex AI Project ID"
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm"
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><Globe className="w-4 h-4 mr-2" />Location</label>
                        <input
                            type="text"
                            value={config.location || ''}
                            onChange={e => handleConfigChange('location', e.target.value)}
                            placeholder="global"
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm"
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><Key className="w-4 h-4 mr-2" />Access Token</label>
                        <input
                            type="password"
                            value={config.accessToken || ''}
                            onChange={e => handleConfigChange('accessToken', e.target.value)}
                            placeholder="gcloud auth print-access-token"
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm"
                        />
                    </div>
                </>
            )}

            {provider === 'customOpenAI' && (
                <div>
                    <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><Link className="w-4 h-4 mr-2" />Base URL</label>
                    <input
                        type="text"
                        value={config.baseUrl || ''}
                        onChange={e => handleConfigChange('baseUrl', e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm"
                    />
                </div>
            )}

            <div>
                <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><Cpu className="w-4 h-4 mr-2" />모델</label>

                {models.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 mb-3">
                        {models.map(model => (
                            <button
                                key={model}
                                type="button"
                                onClick={() => handleModelSelect(model)}
                                className={`model-select-btn px-3 py-2 text-left text-sm rounded-lg transition-colors ${config.model === model ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
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
                        placeholder="커스텀 모델명 입력"
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border-0 focus:ring-2 focus:ring-blue-500/50 text-sm"
                    />
                    <button
                        type="button"
                        onClick={handleAddCustomModel}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-1">
                        <Plus className="w-4 h-4" />추가
                    </button>
                </div>

                {config.customModels.length > 0 && (
                    <div className="mt-3 space-y-1">
                        <label className="text-xs text-gray-400">커스텀 모델</label>
                        {config.customModels.map((model, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleModelSelect(model)}
                                    className={`model-select-btn flex-1 px-3 py-2 text-left text-sm rounded-lg transition-colors ${config.model === model ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                    {model}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCustomModel(index)}
                                    className="remove-custom-model-btn px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
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
