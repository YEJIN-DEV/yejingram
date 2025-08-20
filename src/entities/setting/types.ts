export type ApiProvider = 'gemini' | 'vertexai' | 'claude' | 'openai' | 'grok' | 'openrouter' | 'customOpenAI';

export interface ApiConfig {
    apiKey: string;
    baseUrl?: string;
    model: string;
    customModels: string[];
    projectId?: string;
    location?: string;
    accessToken?: string;
}

export interface MainPrompts {
    system_rules: string;
    role_and_objective: string;
    memory_generation: string;
    character_acting: string;
    message_writing: string;
    language: string;
    additional_instructions: string;
    sticker_usage: string;
    group_chat_context: string;
    open_chat_context: string;
}

export interface Prompts {
    main: MainPrompts;
    profile_creation: string;
    character_sheet_generation: string;
}

export interface SettingsState {
    isModalOpen: boolean;
    isPromptModalOpen: boolean;
    isCreateGroupChatModalOpen: boolean;
    isCreateOpenChatModalOpen: boolean;
    isEditGroupChatModalOpen: boolean;
    editingRoomId: string | null;
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
    prompts: Prompts;
}
