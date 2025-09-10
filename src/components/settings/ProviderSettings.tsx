import React, { useState } from 'react';
import type { SettingsState, ApiConfig, ImageApiConfig, ImageApiProvider } from '../../entities/setting/types';
import { Key, Cpu, Link, Plus, X, Briefcase, Globe, Image } from 'lucide-react';
import { initialApiConfigs, initialImageApiConfigs } from '../../entities/setting/slice';

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

const imageModels: string[] = [
    'gemini-2.5-flash-image-preview',
    'gemini-2.0-flash-preview-image-generation',
    'nai-diffusion-4-5-curated',
    'nai-diffusion-4-full',
    'nai-diffusion-4-curated-preview',
];

export function ProviderSettings({ settings, setSettings }: ProviderSettingsProps) {
    const [customModelInput, setCustomModelInput] = useState('');
    const provider = settings.apiProvider;
    const imageProvider = settings.imageApiProvider;
    const rawConfig = settings?.apiConfigs?.[provider] ?? initialApiConfigs[provider];
    const imageConfig = settings?.imageApiConfigs?.[imageProvider] ?? initialImageApiConfigs[imageProvider];
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

    const handleImageModelConfigChange = (provider: ImageApiProvider, key: keyof ImageApiConfig, value: any) => {
        setSettings(prev => {
            const currentImageProviderConfig = prev.imageApiConfigs[provider] ?? initialImageApiConfigs[provider]; // Use initial config as fallback
            return {
                ...prev,
                imageApiProvider: provider,
                imageApiConfigs: {
                    ...prev.imageApiConfigs,
                    [provider]: { ...currentImageProviderConfig, [key]: value }
                }
            };
        });
    };

    const handleModelSelect = (model: string) => {
        handleConfigChange('model', model);
    };

    const handleImageModelSelect = (model: string) => {
        const provider = model.startsWith('nai-') ? 'novelai' : 'gemini';
        handleImageModelConfigChange(provider, 'model', model);
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
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-col">
                    <label htmlFor="structured-output-toggle" className="font-medium text-gray-900 cursor-pointer">
                        구조화된 출력 사용
                    </label>
                    <p className="text-xs text-gray-500">LLM이 응답 시간과 메시지를 직접 제어합니다. (권장)</p>
                    {provider === 'claude' && (
                        <p className="text-xs text-gray-500 mt-1">주의: Claude의 경우 요청에 실패할 가능성이 있습니다.</p>
                    )}
                </div>
                <label htmlFor="structured-output-toggle" className="relative flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        id="structured-output-toggle"
                        className="sr-only peer"
                        checked={settings.useStructuredOutput}
                        onChange={e => setSettings(prev => ({ ...prev, useStructuredOutput: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-200 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
            </div>
            {settings.useStructuredOutput && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-col">
                        <label htmlFor="image-response-toggle" className="font-medium text-gray-900 cursor-pointer">
                            이미지 응답 허용
                        </label>
                        <p className="text-xs text-gray-500">대화 컨텍스트에 따라서 이미지 응답을 허용합니다.</p>
                    </div>
                    <label htmlFor="image-response-toggle" className="relative flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            id="image-response-toggle"
                            className="sr-only peer"
                            checked={settings.useImageResponse}
                            onChange={e => setSettings(prev => ({ ...prev, useImageResponse: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-200 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                </div>
            )}
            {provider !== 'vertexai' && (
                <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Key className="w-4 h-4 mr-2" />API 키</label>
                    <input
                        type="password"
                        value={config.apiKey}
                        onChange={e => handleConfigChange('apiKey', e.target.value)}
                        placeholder="API 키를 입력하세요"
                        className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                    />
                </div>
            )}

            {provider === 'vertexai' && (
                <>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Briefcase className="w-4 h-4 mr-2" />Project ID</label>
                        <input
                            type="text"
                            value={config.projectId || ''}
                            onChange={e => handleConfigChange('projectId', e.target.value)}
                            placeholder="Vertex AI Project ID"
                            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Globe className="w-4 h-4 mr-2" />Location</label>
                        <input
                            type="text"
                            value={config.location || ''}
                            onChange={e => handleConfigChange('location', e.target.value)}
                            placeholder="global"
                            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Key className="w-4 h-4 mr-2" />Access Token</label>
                        <input
                            type="password"
                            value={config.accessToken || ''}
                            onChange={e => handleConfigChange('accessToken', e.target.value)}
                            placeholder="gcloud auth print-access-token"
                            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                        />
                    </div>
                </>
            )}

            {provider === 'customOpenAI' && (
                <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Link className="w-4 h-4 mr-2" />Base URL</label>
                    <input
                        type="text"
                        value={config.baseUrl || ''}
                        onChange={e => handleConfigChange('baseUrl', e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                    />
                </div>
            )}

            <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Cpu className="w-4 h-4 mr-2" />모델</label>

                {models.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 mb-3">
                        {models.map(model => (
                            <button
                                key={model}
                                type="button"
                                onClick={() => handleModelSelect(model)}
                                className={`model-select-btn px-3 py-2 text-left text-sm rounded-lg transition-colors border ${config.model === model ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'}`}>
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
                        className="flex-1 px-3 py-2 bg-gray-50 text-gray-900 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
                    />
                    <button
                        type="button"
                        onClick={handleAddCustomModel}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm flex items-center gap-1">
                        <Plus className="w-4 h-4" />추가
                    </button>
                </div>

                {config.customModels.length > 0 && (
                    <div className="mt-3 space-y-1">
                        <label className="text-xs text-gray-500">커스텀 모델</label>
                        {config.customModels.map((model, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleModelSelect(model)}
                                    className={`model-select-btn flex-1 px-3 py-2 text-left text-sm rounded-lg transition-colors border ${config.model === model ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'}`}>
                                    {model}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCustomModel(index)}
                                    className="remove-custom-model-btn px-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {settings.useImageResponse && (
                <>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Key className="w-4 h-4 mr-2" />이미지 생성용 API 키</label>
                        <input
                            type="password"
                            value={imageConfig.apiKey}
                            onChange={e => handleImageModelConfigChange(imageProvider, 'apiKey', e.target.value)}
                            placeholder="이미지 모델 API 키를 입력하세요"
                            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Image className="w-4 h-4 mr-2" />이미지 생성 모델</label>

                        {imageModels.length > 0 && (
                            <div className="grid grid-cols-1 gap-2">
                                {imageModels.map(model => (
                                    <button
                                        key={model}
                                        type="button"
                                        onClick={() => handleImageModelSelect(model)}
                                        className={`model-select-btn px-3 py-2 text-left text-sm rounded-lg transition-colors border ${imageConfig.model === model ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'}`}>
                                        {model}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {
                        imageProvider === 'gemini' && (
                            <div className="mb-3">
                                <p className="text-xs text-gray-500">참고: Gemini는 이미지 생성이 검열될 수 있습니다.</p>
                            </div>
                        )
                    }
                </>
            )}
        </div>
    );
}
