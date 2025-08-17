export type ApiProvider = 'gemini' | 'claude' | 'openai' | 'grok' | 'openrouter' | 'customOpenAI';

export interface ApiConfig {
    apiKey: string;
    baseUrl?: string;
    model: string;
    customModels: string[];
}

export interface SettingsState {
    isModalOpen: boolean;
    apiProvider: ApiProvider;
    apiConfigs: Record<ApiProvider, ApiConfig>;
    fontScale: number;
    userName: string;
    userDescription: string;
    proactiveChatEnabled: boolean;
    randomFirstMessageEnabled: boolean;
    randomCharacterCount: number;
    randomMessageFrequencyMin: number;
    randomMessageFrequencyMax: number;
}
