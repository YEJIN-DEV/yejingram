import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SettingsState, ApiProvider, ApiConfig, Prompts, Persona, ThemeOverrides, Sync, Proactive } from './types';
import type { ImageApiConfig, ImageApiProvider, ArtStyle } from './image/types';
import { initialState as imageSettingsInitialState, initialImageApiConfigs } from './image/slice';
import { nanoid } from '@reduxjs/toolkit';
import defaultPrompts from './defaultPrompts.json';

export const initialApiConfigs: Record<ApiProvider, ApiConfig> = {
    gemini: { apiKey: '', model: 'gemini-2.5-pro', customModels: [] },
    vertexai: { apiKey: '', model: 'gemini-2.5-pro', customModels: [], projectId: '', location: 'global', accessToken: '' },
    claude: { apiKey: '', model: 'claude-opus-4-1-20250805', customModels: [] },
    openai: { apiKey: '', model: 'gpt-5', customModels: [] },
    grok: { apiKey: '', model: 'grok-4-0709', customModels: [] },
    deepseek: { apiKey: '', model: 'deepseek-chat', customModels: [] },
    openrouter: { apiKey: '', model: '', customModels: [], tokenizer: '', providers: [], providerAllowFallbacks: true },
    custom: { apiKey: '', baseUrl: '', model: '', customModels: [], tokenizer: '', payloadTemplate: '' },
};

export const initialSyncSettings: Sync = {
    syncEnabled: false,
    syncClientId: '',
    syncBaseUrl: '',
};

export const initialProactiveSettings: Proactive = {
    proactiveChatEnabled: false,
    proactiveServerBaseUrl: '',
};


export const initialState: SettingsState = {
    colorTheme: 'light',
    customThemeBase: 'light',
    customTheme: { light: {}, dark: {} },
    uiLanguage: null,
    isModalOpen: false,
    isPromptModalOpen: false,
    isCreateGroupChatModalOpen: false,
    isEditGroupChatModalOpen: false,
    editingRoomId: null,
    prompts: defaultPrompts as Prompts,
    apiProvider: 'gemini',
    apiConfigs: initialApiConfigs,
    imageSettings: imageSettingsInitialState,
    fontScale: 1.0,
    userName: '',
    userDescription: '',
    randomFirstMessageEnabled: false,
    randomCharacterCount: 1,
    randomMessageFrequencyMin: 10,
    randomMessageFrequencyMax: 60,
    useStructuredOutput: true,
    useResponseFormat: true,
    speedup: 2,
    personas: [],
    selectedPersonaId: null,
    syncSettings: initialSyncSettings,
    proactiveSettings: initialProactiveSettings,
};

export const settingsAdapter = createEntityAdapter<SettingsState, string>({
    selectId: () => 'settings', // There will only be one settings object
})

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setColorTheme: (state, action: PayloadAction<'light' | 'dark' | 'system' | 'custom'>) => {
            state.colorTheme = action.payload;
        },
        setCustomThemeBase: (state, action: PayloadAction<'light' | 'dark'>) => {
            state.customThemeBase = action.payload;
        },
        setCustomTheme: (state, action: PayloadAction<ThemeOverrides>) => {
            state.customTheme = action.payload;
        },
        setUILanguage: (state, action: PayloadAction<'ko' | 'en' | 'ja'>) => {
            state.uiLanguage = action.payload;
        },
        setEditingRoomId: (state, action: PayloadAction<string>) => {
            state.editingRoomId = action.payload;
        },
        resetEditingRoomId: (state) => {
            state.editingRoomId = null;
        },
        setSettings: (_state, action: PayloadAction<SettingsState>) => {
            return action.payload;
        },
        setApiProvider: (state, action: PayloadAction<ApiProvider>) => {
            state.apiProvider = action.payload;
        },
        setApiConfig: (state, action: PayloadAction<{ provider: ApiProvider; config: Partial<ApiConfig> }>) => {
            const { provider, config } = action.payload;
            state.apiConfigs[provider] = { ...state.apiConfigs[provider], ...config };
        },
        setUseStructuredOutput: (state, action: PayloadAction<boolean>) => {
            state.useStructuredOutput = action.payload;
        },
        setUseImageResponse: (state, action: PayloadAction<boolean>) => {
            state.useImageResponse = action.payload;
        },
        setUseResponseFormat: (state, action: PayloadAction<boolean>) => {
            state.useResponseFormat = action.payload;
        },
        setPrompts: (state, action: PayloadAction<Prompts>) => {
            state.prompts = action.payload;
        },
        resetPrompts: (state) => {
            state.prompts = initialState.prompts;
        },
        updatePromptNamesToLocale: (state, action: PayloadAction<'ko' | 'en' | 'ja'>) => {
            const locale = action.payload;
            const nameMap: Record<string, Record<'ko' | 'en' | 'ja', string>> = {
                '정보 소개': { ko: '정보 소개', en: 'Information Intro', ja: '情報紹介' },
                '사용자 지시': { ko: '사용자 지시', en: 'User Instructions', ja: 'ユーザー指示' },
                '사용자 설명': { ko: '사용자 설명', en: 'User Description', ja: 'ユーザー説明' },
                '캐릭터 지시': { ko: '캐릭터 지시', en: 'Character Instructions', ja: 'キャラクター指示' },
                '캐릭터 설명': { ko: '캐릭터 설명', en: 'Character Description', ja: 'キャラクター説明' },
                '메모리 지시': { ko: '메모리 지시', en: 'Memory Instructions', ja: 'メモリ指示' },
                '메모리': { ko: '메모리', en: 'Memory', ja: 'メモリ' },
                '로어북 섹션': { ko: '로어북 섹션', en: 'Lorebook Section', ja: 'ロアブックセクション' },
                '성격 슬라이더': { ko: '성격 슬라이더', en: 'Personality Sliders', ja: '性格スライダー' },
                '가이드라인 리마인더': { ko: '가이드라인 리마인더', en: 'Guidelines Reminder', ja: 'ガイドラインリマインダー' },
                '대화 규칙': { ko: '대화 규칙', en: 'Conversation Rules', ja: '会話ルール' },
                '시스템 규칙': { ko: '시스템 규칙', en: 'System Rules', ja: 'システムルール' },
                '캐릭터 연기': { ko: '캐릭터 연기', en: 'Character Acting', ja: 'キャラクター演技' },
                '메시지 작성(구조화)': { ko: '메시지 작성(구조화)', en: 'Message Composition (Structured)', ja: 'メッセージ作成（構造化）' },
                '메시지 작성(비구조화)': { ko: '메시지 작성(비구조화)', en: 'Message Composition (Unstructured)', ja: 'メッセージ作成（非構造化）' },
                '이미지 응답 생성(구조화)': { ko: '이미지 응답 생성(구조화)', en: 'Image Response Generation (Structured)', ja: '画像応答生成（構造化）' },
                '메모리 생성(구조화)': { ko: '메모리 생성(구조화)', en: 'Memory Creation (Structured)', ja: 'メモリ生成（構造化）' },
                '출력 형식(구조화)': { ko: '출력 형식(구조화)', en: 'Output Format (Structured)', ja: '出力形式（構造化）' },
                '출력 형식(비구조화)': { ko: '출력 형식(비구조화)', en: 'Output Format (Unstructured)', ja: '出力形式（非構造化）' },
                '언어': { ko: '언어', en: 'Language', ja: '言語' },
                '탈옥': { ko: '탈옥', en: 'Jailbreak', ja: 'ジョールブレイク' },
                '스티커 사용법': { ko: '스티커 사용법', en: 'Sticker Usage', ja: 'ステッカーの使い方' },
                '그룹챗 컨텍스트': { ko: '그룹챗 컨텍스트', en: 'Group Chat Context', ja: 'グループチャットコンテキスト' },
                '추가 시스템 지시': { ko: '추가 시스템 지시', en: 'Additional System Instructions', ja: '追加システム指示' },
                '작가의 노트': { ko: '작가의 노트', en: "Author's Note", ja: '著者のノート' },
                '채팅 기록': { ko: '채팅 기록', en: 'Chat History', ja: 'チャット履歴' },
            };
            state.prompts.main = state.prompts.main.map(prompt => {
                if (nameMap[prompt.name]) {
                    return { ...prompt, name: nameMap[prompt.name][locale] };
                }
                return prompt;
            });
        },
        importSettings: (_state, action: PayloadAction<SettingsState>) => {
            return action.payload;
        },
        addPersona: (state, action: PayloadAction<Omit<Persona, 'id'>>) => {
            // personas 배열이 없으면 초기화
            if (!state.personas) {
                state.personas = [];
            }

            const newPersona: Persona = {
                ...action.payload,
                id: nanoid(),
            };
            state.personas.push(newPersona);
            // If it's the only persona now, auto-select it
            if (state.personas.length === 1) {
                state.selectedPersonaId = newPersona.id;
            }
        },
        updatePersona: (state, action: PayloadAction<Persona>) => {
            if (!state.personas) {
                state.personas = [];
                return;
            }

            const index = state.personas.findIndex(p => p.id === action.payload.id);
            if (index !== -1) {
                state.personas[index] = action.payload;
            }
        },
        deletePersona: (state, action: PayloadAction<string>) => {
            if (!state.personas) {
                return;
            }

            const index = state.personas.findIndex(p => p.id === action.payload);
            if (index !== -1) {
                state.personas.splice(index, 1);
                // 선택값 보정: 유일한 페르소나가 되면 자동 선택, 아니면 선택 무효화만 처리
                const remaining = state.personas;
                const hasOnlyOne = remaining.length === 1;
                const exists = state.selectedPersonaId ? remaining.some(p => p.id === state.selectedPersonaId) : false;
                if (hasOnlyOne && (!state.selectedPersonaId || !exists)) {
                    state.selectedPersonaId = remaining[0].id;
                } else if (!exists) {
                    // 선택된 것이 삭제로 인해 사라졌지만 여러 개 남아있는 경우 첫 번째로 대체
                    state.selectedPersonaId = remaining[0]?.id ?? null;
                }
            }
        },
        selectPersona: (state, action: PayloadAction<string>) => {
            if (!state.personas) {
                return;
            }

            const personaExists = state.personas.some(p => p.id === action.payload);
            if (personaExists) {
                state.selectedPersonaId = action.payload;
            }
        },
        // Image settings actions
        setImageSettings: (state, action: PayloadAction<typeof imageSettingsInitialState>) => {
            state.imageSettings = action.payload;
        },
        setImageApiConfigForImageSettings: (state, action: PayloadAction<{ provider: ImageApiProvider; config: Partial<ImageApiConfig> }>) => {
            const { provider, config } = action.payload;
            const typedProvider = provider as keyof typeof state.imageSettings.config;
            if (!state.imageSettings.config[typedProvider]) {
                state.imageSettings.config[typedProvider] = { ...initialImageApiConfigs[provider as keyof typeof initialImageApiConfigs] };
            }
            state.imageSettings.config[typedProvider] = { ...state.imageSettings.config[typedProvider], ...config };
        },
        addArtStyleToImageSettings: (state, action: PayloadAction<Omit<ArtStyle, 'id'>>) => {
            const newArtStyle = {
                ...action.payload,
                id: nanoid(),
            };
            state.imageSettings.artStyles.push(newArtStyle);
            // If it's the only art style now, auto-select it
            if (state.imageSettings.artStyles.length === 1) {
                state.imageSettings.selectedArtStyleId = newArtStyle.id;
            }
        },
        updateArtStyleInImageSettings: (state, action: PayloadAction<{ id: string; name?: string; prompt?: string; negativePrompt?: string; description?: string }>) => {
            const { id, ...updates } = action.payload;
            const index = state.imageSettings.artStyles.findIndex(style => style.id === id);
            if (index !== -1) {
                state.imageSettings.artStyles[index] = { ...state.imageSettings.artStyles[index], ...updates };
            }
        },
        deleteArtStyleFromImageSettings: (state, action: PayloadAction<string>) => {
            const index = state.imageSettings.artStyles.findIndex(style => style.id === action.payload);
            if (index !== -1) {
                state.imageSettings.artStyles.splice(index, 1);
                // 선택값 보정
                const remaining = state.imageSettings.artStyles;
                const hasOnlyOne = remaining.length === 1;
                const exists = state.imageSettings.selectedArtStyleId ? remaining.some(style => style.id === state.imageSettings.selectedArtStyleId) : false;
                if (hasOnlyOne && (!state.imageSettings.selectedArtStyleId || !exists)) {
                    state.imageSettings.selectedArtStyleId = remaining[0].id;
                } else if (!exists) {
                    state.imageSettings.selectedArtStyleId = remaining[0]?.id ?? '';
                }
            }
        },
        selectArtStyleInImageSettings: (state, action: PayloadAction<string>) => {
            const styleExists = state.imageSettings.artStyles.some(style => style.id === action.payload);
            if (styleExists) {
                state.imageSettings.selectedArtStyleId = action.payload;
            }
        },
    }
});

export const settingsActions = settingsSlice.actions
export default settingsSlice.reducer;
