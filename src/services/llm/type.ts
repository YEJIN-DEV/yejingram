export interface MessagePart {
    delay: number;      // 밀리초 단위 지연시간
    content: string;    // 메시지 내용
    sticker?: string;   // 스티커 (옵션)
    imageGenerationSetting?: {
        prompt: string;   // 프롬프트
        isSelfie: boolean; // 셀카 여부
    }; // 이미지 생성 설정 (옵션)
}

export interface ChatResponse {
    messages: MessagePart[];
    reactionDelay: number; // 반응 지연시간 (ms)
    newMemory?: string; // 모델이 구조화된 출력으로 제공하는 신규 메모리(선택)
}

export interface GeminiApiPayload {
    contents: {
        role: string;
        parts: ({
            text: string;
        } | {
            inline_data: {
                mime_type: string;
                data: string;
            };
        } | {
            file_data: {
                file_uri: string;
            };
        })[];
    }[];
    systemInstruction?: {
        parts: {
            text: string;
        }[];
    };
    generationConfig: GeminiGenerationConfig;
    safetySettings: {
        category: string;
        threshold: string;
    }[];
}

// ---------- Gemini ----------
type GeminiSchemaType = 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';

export interface GeminiStructuredSchema {
    type: GeminiSchemaType;
    properties?: Record<string, GeminiStructuredSchema>;
    items?: GeminiStructuredSchema | {
        type: GeminiSchemaType;
        properties?: Record<string, GeminiStructuredSchema>;
        items?: GeminiStructuredSchema;
        required?: string[];
    };
    required?: string[];
}

export interface GeminiGenerationConfig {
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    responseMimeType?: string; // e.g., 'application/json'
    responseSchema?: GeminiStructuredSchema;
}

export interface ClaudeApiPayload {
    model: string;
    messages: {
        role: string;
        content: ({
            type: string;
            text: string;
        } | {
            type: 'image';
            source: {
                data: string;
                media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
                type: 'base64';
            };
        })[];
    }[];
    system?: {
        type: string;
        text: string;
    }[];
    temperature: number;
    top_k: number;
    top_p?: number;
    max_tokens: number;
}

// ---------- OpenAI ----------
interface OpenAIJSONSchema {
    name?: string;
    strict?: boolean;
    type?: string | string[];
    schema?: {
        type: string | string[];
        properties?: Record<string, OpenAIJSONSchema>;
        required?: string[];
        additionalProperties?: boolean;
    };
    items?: OpenAIJSONSchema;
    properties?: Record<string, OpenAIJSONSchema>;
    additionalProperties?: boolean;
    required?: string[];
}

export interface OpenAIStructuredSchema {
    type: 'json_schema';
    json_schema: OpenAIJSONSchema;
    required?: string[];
    additionalProperties?: boolean;
}

export interface OpenAIApiPayload {
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant' | string;
        content:
        | string
        | Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
        >;
    }>;
    temperature?: number;
    top_p?: number;
    max_completion_tokens?: number;

    response_format?:
    | { type: 'json_object' }
    | { type: 'text' }
    | OpenAIStructuredSchema;
}