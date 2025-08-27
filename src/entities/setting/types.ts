export type ApiProvider = 'gemini' | 'vertexai' | 'claude' | 'openai' | 'grok' | 'openrouter' | 'customOpenAI';

export interface ApiConfig {
    apiKey: string;
    baseUrl?: string;
    model: string;
    imageModel?: string;
    customModels: string[];
    projectId?: string;
    location?: string;
    accessToken?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
}

export interface MainPrompts {
    system_rules: string;
    role_and_objective: string;
    memory_generation: string;
    character_acting: string;
    message_writing_structured: string;
    message_writing_unstructured: string;
    language: string;
    additional_instructions: string;
    sticker_usage: string;
    group_chat_context: string;
    open_chat_context: string;
}

export interface Prompts {
    main: MainPrompts;
    profile_creation: string;
    image_response_generation: string;
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
    useStructuredOutput: boolean;
    useImageResponse?: boolean | undefined;
    speedup: number;
    personas: Persona[];
    selectedPersonaId: string | null;
}

export interface Persona {
    id: string;
    name: string;
    description: string;
}
