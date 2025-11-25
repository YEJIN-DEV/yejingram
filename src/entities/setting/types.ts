import type { ImageGenerationSettingsState } from "./image/types";

export type ApiProvider = 'gemini' | 'vertexai' | 'claude' | 'grok' | 'openai' | 'deepseek' | 'openrouter' | 'custom';

export interface ApiConfig {
    apiKey: string;
    baseUrl?: string;
    model: string;
    customModels: string[];
    projectId?: string;
    location?: string;
    accessToken?: string;
    tokenizer?: string;
    // OpenRouter routing preferences (optional)
    // Unified endpoint metadata ordered by priority
    providers?: Array<{
        tag: string; // endpoint tag (e.g., siliconflow/fp8)
        supportsResponseFormat: boolean; // whether endpoint supports response_format or structured_outputs
    }>;
    providerAllowFallbacks?: boolean;
    // Custom endpoint payload template (for 'custom' provider)
    payloadTemplate?: string;
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
    maxContextTokens: number;
    maxResponseTokens: number;
    temperature: number;
    topP: number;
    topK: number;
}

export interface SettingsState {
    colorTheme: 'light' | 'dark' | 'system' | 'custom';
    customThemeBase: 'light' | 'dark';
    customTheme: ThemeOverrides;
    uiLanguage: 'ko' | 'en' | 'ja' | null;
    isModalOpen: boolean;
    isPromptModalOpen: boolean;
    isCreateGroupChatModalOpen: boolean;
    isEditGroupChatModalOpen: boolean;
    editingRoomId: string | null;
    apiProvider: ApiProvider;
    apiConfigs: Record<ApiProvider, ApiConfig>;
    imageSettings: ImageGenerationSettingsState;
    fontScale: number;
    userName: string;
    userDescription: string;
    randomFirstMessageEnabled: boolean;
    randomCharacterCount: number;
    randomMessageFrequencyMin: number;
    randomMessageFrequencyMax: number;
    prompts: Prompts;
    useStructuredOutput: boolean;
    useResponseFormat?: boolean;
    useImageResponse?: boolean | undefined;
    speedup: number;
    personas: Persona[];
    selectedPersonaId: string | null;
    syncSettings: Sync;
    proactiveSettings: Proactive;
}

export interface Persona {
    id: string;
    name: string;
    description: string;
}

export interface ThemeOverrides {
    light: Record<string, string>;
    dark: Record<string, string>;
}

export interface Sync {
    syncEnabled: boolean;
    syncClientId: string;
    syncBaseUrl: string;
}

export interface ProactiveTimeRestriction {
    enabled: boolean;
    startHour: number; // 0-23
    startMinute: number; // 0-59
    endHour: number; // 0-23
    endMinute: number; // 0-59
}

export interface ProactivePeriodicSettings {
    enabled: boolean;
    intervalMinutes: number; // 주기 간격 (분)
}

export interface ProactiveProbabilisticSettings {
    enabled: boolean;
    probability: number; // 0-100 (퍼센트)
    maxTriggersPerDay: number; // 하루 최대 트리거 횟수
    triggeredCountToday: number; // 오늘 트리거된 횟수
    lastTriggeredDate: string | null; // YYYY-MM-DD 형식
}

export interface Proactive {
    proactiveChatEnabled: boolean;
    proactiveServerBaseUrl: string;
    timeRestriction: ProactiveTimeRestriction;
    periodicSettings: ProactivePeriodicSettings;
    probabilisticSettings: ProactiveProbabilisticSettings;
}
