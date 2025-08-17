import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SettingsState, ApiProvider, ApiConfig } from './types';

const initialApiConfigs: Record<ApiProvider, ApiConfig> = {
    gemini: { apiKey: '', model: 'gemini-2.5-pro', customModels: [] },
    claude: { apiKey: '', model: 'claude-opus-4-1-20250805', customModels: [] },
    openai: { apiKey: '', model: 'gpt-5', customModels: [] },
    grok: { apiKey: '', model: 'grok-4', customModels: [] },
    openrouter: { apiKey: '', model: '', customModels: [] },
    customOpenAI: { apiKey: '', baseUrl: '', model: '', customModels: [] },
};

const initialState: SettingsState = {
    isModalOpen: false,
    apiProvider: 'gemini',
    apiConfigs: initialApiConfigs,
    fontScale: 1.0,
    userName: '',
    userDescription: '',
    proactiveChatEnabled: true,
    randomFirstMessageEnabled: false,
    randomCharacterCount: 1,
    randomMessageFrequencyMin: 10,
    randomMessageFrequencyMax: 60,
};

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        openSettingsModal: (state) => {
            state.isModalOpen = true;
        },
        closeSettingsModal: (state) => {
            state.isModalOpen = false;
        },
        setSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
            return { ...state, ...action.payload };
        },
        setApiProvider: (state, action: PayloadAction<ApiProvider>) => {
            state.apiProvider = action.payload;
        },
        setApiConfig: (state, action: PayloadAction<{ provider: ApiProvider; config: Partial<ApiConfig> }>) => {
            const { provider, config } = action.payload;
            state.apiConfigs[provider] = { ...state.apiConfigs[provider], ...config };
        }
    },
});

export const {
    openSettingsModal,
    closeSettingsModal,
    setSettings,
    setApiProvider,
    setApiConfig,
} = settingsSlice.actions;

export default settingsSlice.reducer;
