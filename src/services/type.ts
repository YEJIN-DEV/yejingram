export interface MessagePart {
    delay: number;      // 밀리초 단위 지연시간
    content: string;    // 메시지 내용
    sticker?: string;   // 스티커 (옵션)
}

export interface ChatResponse {
    messages: MessagePart[];
    reactionDelay: number; // 반응 지연시간 (ms)
    characterState: {
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
}

export interface GeminiApiPayload {
    contents: {
        role: string;
        parts: {
            text: string;
        }[];
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
