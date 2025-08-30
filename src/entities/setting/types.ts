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

export type PromptRole = 'system' | 'assistant' | 'user';

export type PromptType = 'memory' | 'style-structured' | 'style-unstructured' | 'sticker' | 'context-group' | 'context-open' | 'generation' | 'image-generation' | 'output-structured' | 'output-unstructured' | 'plain' | 'chat' | 'lorebook' | 'extraSystemInstruction';

export interface PromptItem {
    name: string; // 표시용 이름
    type: PromptType; // 프롬프트 분류(예: rule, guideline, style, language, context, generation 등)
    role?: PromptRole; // 적용 역할
    content?: string; // 실제 프롬프트 내용
}

export interface Prompts {
    main: PromptItem[];
    profile_creation: PromptItem;
    image_response_generation: PromptItem;
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
