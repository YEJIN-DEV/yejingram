export interface MessagePart {
    delay: number;      // 밀리초 단위 지연시간
    content: string;    // 메시지 내용
    sticker?: string;   // 스티커 (옵션)
}

export interface ChatResponse {
    messages: MessagePart[];
    reactionDelay: number; // 반응 지연시간 (ms)
    characterState?: {
        energy: number;     // 에너지 수준 (0~1)
        mood: number;       // 기분 (0~1)
        personality: {
            agreeableness: number;      // 친화성
            conscientiousness: number;  // 성실성
            extroversion: number;       // 외향성
            neuroticism: number;        // 신경성
            openness: number;           // 개방성
        };
        socialBattery: number; // 사회적 배터리 (0~1)
    };
    // 모델이 구조화된 출력으로 제공하는 신규 메모리(선택)
    newMemory?: string;
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
        })[];
    }[];
    systemInstruction: {
        parts: {
            text: string;
        }[];
    };
    generationConfig: {
        temperature: number;
        topK: number;
        topP: number;
        responseMimeType: string;
        responseSchema: any;
    };
    safetySettings: {
        category: string;
        threshold: string;
    }[];
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
    system: {
        type: string;
        text: string;
    }[];
    temperature: number;
    top_k: number;
    top_p: number;
    max_tokens: number;
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
    // Supported by Chat Completions for JSON-mode on modern models
    response_format?: { type: 'json_object' } | { type: 'text' };
}