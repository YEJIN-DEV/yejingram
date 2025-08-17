import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SettingsState, ApiProvider, ApiConfig, Prompts } from './types';

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
    isPromptModalOpen: false,
    prompts: {
        main: {
            system_rules: '',
            role_and_objective: '',
            memory_generation: '',
            character_acting: '',
            message_writing: '',
            language: '',
            additional_instructions: '',
            sticker_usage: '',
            group_chat_context: '',
            open_chat_context: '',
        },
        profile_creation: '',
        character_sheet_generation: '',
    },
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
        openPromptModal: (state) => {
            state.isPromptModalOpen = true;
        },
        closePromptModal: (state) => {
            state.isPromptModalOpen = false;
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
        },
        setPrompts: (state, action: PayloadAction<Prompts>) => {
            state.prompts = action.payload;
        },
        resetPrompts: (state) => {
            state.prompts = initialState.prompts;
        },
    },
});

export const {
    openSettingsModal,
    closeSettingsModal,
    openPromptModal,
    closePromptModal,
    setSettings,
    setApiProvider,
    setApiConfig,
    setPrompts,
    resetPrompts,
} = settingsSlice.actions;

export default settingsSlice.reducer;
