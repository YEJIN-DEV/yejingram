export type ApiProvider = 'gemini' | 'vertexai' | 'claude' | 'openai' | 'grok' | 'openrouter' | 'customOpenAI';
export type ImageApiProvider = 'gemini' | 'novelai';

export interface ApiConfig {
    apiKey: string;
    baseUrl?: string;
    model: string;
    customModels: string[];
    projectId?: string;
    location?: string;
    accessToken?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
}

export interface ImageApiConfig {
    apiKey: string;
    model: string;
}

export type PromptRole = 'system' | 'assistant' | 'user';

export type PromptType =
    | "image-generation" // 이미지 응답 생성
    | "plain"            // 일반 텍스트 기반 시스템/어시스턴트 메시지
    | "plain-structured" // 구조화된 JSON 출력 요구
    | "plain-unstructured" // 비구조화된 텍스트 출력 요구
    | "plain-group"     // 그룹챗 컨텍스트
    | "extraSystemInstruction" // 추가 시스템 지시
    | "userDescription" // 사용자 설명
    | "characterPrompt" // 캐릭터 설명
    | "lorebook"        // 로어북 섹션
    | "authornote"      // 작가의 노트
    | "memory"          // 메모리   
    | "chat";           // 채팅 기록


export interface PromptItem {
    name: string; // 표시용 이름
    type: PromptType; // 프롬프트 분류(예: rule, guideline, style, language, context, generation 등)
    role?: PromptRole; // 적용 역할
    content?: string; // 실제 프롬프트 내용
}

export interface Prompts {
    main: PromptItem[];
    image_response_generation: PromptItem;
}

export interface SettingsState {
    isDarkMode: boolean;
    isModalOpen: boolean;
    isPromptModalOpen: boolean;
    isCreateGroupChatModalOpen: boolean;
    isEditGroupChatModalOpen: boolean;
    editingRoomId: string | null;
    apiProvider: ApiProvider;
    imageApiProvider: ImageApiProvider;
    apiConfigs: Record<ApiProvider, ApiConfig>;
    imageApiConfigs: Record<ImageApiProvider, ImageApiConfig>;
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
