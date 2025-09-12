// 선톡(First Message) 스케줄링 시스템
import { nanoid } from '@reduxjs/toolkit';
import type { Character } from '../entities/character/types';
import type { Room } from '../entities/room/types';
import type { Message } from '../entities/message/types';
import type { AppDispatch } from '../app/store';
import { messagesActions } from '../entities/message/slice';
import { store } from '../app/store';
import { selectMessagesByRoomId } from '../entities/message/selectors';
import { selectAllSettings, selectCurrentApiConfig, selectSelectedPersona } from '../entities/setting/selectors';
import { buildGeminiApiPayload, buildClaudeApiPayload, buildOpenAIApiPayload } from '../services/promptBuilder';

// 활성 스케줄러들을 관리하는 맵
const activeSchedulers = new Map<string, number>();

// 선톡 메시지 템플릿들
const firstMessageTemplates = [
    "안녕하세요! 오늘 어떻게 지내고 계세요?",
    "좋은 하루네요~ 무엇을 하고 계신가요?",
    "안녕하세요! 근황이 어떠신지 궁금하네요 😊",
    "혹시 시간 괜찮으시면 잠깐 대화 나누실래요?",
    "오늘 날씨가 좋네요! 기분은 어떠세요?",
    "안녕하세요! 요즘 어떤 일들을 하고 계시나요?",
    "반가워요~ 오늘 하루는 어땠나요?",
    "Hi! 무엇을 생각하고 계시는지 궁금해요",
    "안녕하세요! 함께 이야기해요 ✨",
    "좋은 시간이네요~ 대화 나누고 싶어서요!"
];

// 그룹 채팅 전용 선톡 템플릿들
const groupFirstMessageTemplates = [
    "안녕하세요 여러분! 모두 어떻게 지내고 계세요?",
    "좋은 하루네요~ 다들 뭐 하고 계신가요?",
    "안녕하세요! 오늘 날씨가 정말 좋네요 😊",
    "여러분과 함께 대화하고 싶어서 먼저 인사드려요!",
    "혹시 모두 괜찮으시면 잠깐 수다 떨어요~",
    "안녕하세요 여러분! 요즘 근황이 어떠신지 궁금해요",
    "좋은 시간이네요! 함께 이야기해요 ✨",
    "다들 안녕하세요~ 오늘 하루는 어땠나요?",
    "반가워요! 여러분과 대화 나누고 싶어요",
    "Hi 여러분! 무엇을 하고 계시는지 궁금하네요"
];

/**
 * 랜덤한 선톡 메시지를 생성합니다 (템플릿 기반)
 * @param _character 메시지를 보낼 캐릭터 (미래 확장을 위해 보존)
 * @param isGroup 그룹 채팅 여부
 * @returns 생성된 메시지 템플릿
 */
function generateFirstMessage(_character: Character, isGroup: boolean = false): string {
    const templates = isGroup ? groupFirstMessageTemplates : firstMessageTemplates;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // 캐릭터의 특성을 반영한 메시지로 변환할 수 있음
    // 예: character.personality에 따라 다른 스타일의 메시지 생성
    return template;
}

/**
 * AI를 사용하여 컨텍스트를 고려한 선톡 메시지를 생성합니다
 * @param character 메시지를 보낼 캐릭터
 * @param room 대상 채팅방
 * @returns 생성된 메시지 내용 (Promise)
 */
async function generateContextualFirstMessage(character: Character, room: Room): Promise<string> {
    try {
        const state = store.getState();
        const settings = selectAllSettings(state);
        const apiConfig = selectCurrentApiConfig(state);
        const persona = selectSelectedPersona(state);
        const messages = selectMessagesByRoomId(state, room.id);
        
        if (!persona) {
            console.warn('[First Message] 페르소나가 설정되지 않아 템플릿 메시지를 사용합니다.');
            return generateFirstMessage(character, room.type === 'Group');
        }

        // 선톡 전용 시스템 프롬프트
        const firstMessageSystemInstruction = `당신은 ${character.name}입니다. 현재 채팅방에서 자연스럽게 대화를 시작하려고 합니다.

다음 상황을 고려해서 자연스러운 첫 메시지를 작성해주세요:
- 이전 대화 내용과 맥락을 참고하되, 너무 갑작스럽지 않게 화제를 이어가거나 새로운 주제를 제시하세요
- ${room.type === 'Group' ? '그룹 채팅' : '개인 채팅'}의 분위기에 맞게 대화하세요
- 캐릭터의 성격과 말투를 충실히 반영하세요
- 로어북이나 방 설정이 있다면 그 내용을 고려하세요
- 자연스럽고 대화를 이어갈 수 있는 메시지를 작성하세요

메시지는 1-2문장으로 간결하게 작성하고, 마치 친구에게 말하듯이 자연스럽게 해주세요.`;

        // API 호출용 페이로드 생성
        let payload: any;
        const { apiProvider } = settings;
        
        switch (apiProvider) {
            case 'gemini':
            case 'vertexai':
                payload = buildGeminiApiPayload(room, persona, character, messages, true, false, false, firstMessageSystemInstruction);
                break;
            case 'claude':
            case 'grok':
                payload = buildClaudeApiPayload(apiConfig.model, room, persona, character, messages, true, false, firstMessageSystemInstruction);
                break;
            case 'openai':
            case 'customOpenAI':
                payload = buildOpenAIApiPayload(apiConfig.model, room, persona, character, messages, true, false, firstMessageSystemInstruction);
                break;
            default:
                throw new Error(`지원되지 않는 API 제공자: ${apiProvider}`);
        }

        // API 호출
        const response = await callFirstMessageApi(apiConfig, settings, payload);
        
        if (response && response.length > 0) {
            return response.trim();
        } else {
            console.warn('[First Message] AI 응답이 비어있어 템플릿 메시지를 사용합니다.');
            return generateFirstMessage(character, room.type === 'Group');
        }
        
    } catch (error) {
        console.error('[First Message] AI 메시지 생성 중 오류 발생:', error);
        return generateFirstMessage(character, room.type === 'Group');
    }
}

/**
 * 선톡 생성을 위한 API 호출
 */
async function callFirstMessageApi(apiConfig: any, settings: any, payload: any): Promise<string> {
    const { apiProvider } = settings;
    let url: string;
    let headers: HeadersInit;

    // API 엔드포인트 및 헤더 설정
    if (apiProvider === 'vertexai') {
        const VERTEX_AI_API_BASE_URL = "https://aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:generateContent";
        url = VERTEX_AI_API_BASE_URL
            .replace(/{location}/g, apiConfig.location || 'us-central1')
            .replace("{projectId}", apiConfig.projectId || '')
            .replace("{model}", apiConfig.model);
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.accessToken}`
        };
    } else if (apiProvider === 'gemini') {
        const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
        url = `${GEMINI_API_BASE_URL}${apiConfig.model}:generateContent?key=${apiConfig.apiKey}`;
        headers = { 'Content-Type': 'application/json' };
    } else if (apiProvider === 'claude') {
        const CLAUDE_API_BASE_URL = "https://api.anthropic.com/v1/messages";
        url = CLAUDE_API_BASE_URL;
        headers = {
            "x-api-key": apiConfig.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "anthropic-dangerous-direct-browser-access": "true"
        };
    } else { // openai, customOpenAI, grok
        const OPENAI_API_BASE_URL = "https://api.openai.com/v1/chat/completions";
        const GROK_API_BASE_URL = "https://api.x.ai/v1/chat/completions";
        const baseUrl = (apiProvider === 'customOpenAI' && apiConfig.baseUrl) ? apiConfig.baseUrl : 
                       (apiProvider === 'grok' ? GROK_API_BASE_URL : OPENAI_API_BASE_URL);
        url = baseUrl;
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("First Message API Error:", data);
        throw new Error(data?.error?.message || `API 요청 실패: ${response.statusText}`);
    }

    // API 응답 파싱
    if (apiProvider === 'gemini' || apiProvider === 'vertexai') {
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error(data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || '알 수 없는 이유');
        }
    } else if (apiProvider === 'claude') {
        if (data.content && data.content.length > 0 && data.content[0]?.text) {
            return data.content[0].text;
        } else {
            throw new Error(data.stop_reason || '알 수 없는 이유');
        }
    } else { // OpenAI-compatible
        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
            throw new Error('응답 본문이 비어있습니다.');
        }
        return text;
    }
}

/**
 * 지정된 시간 범위 내에서 랜덤한 지연 시간을 생성합니다
 * @param minMinutes 최소 시간 (분)
 * @param maxMinutes 최대 시간 (분)
 * @returns 지연 시간 (밀리초)
 */
function getRandomDelay(minMinutes: number, maxMinutes: number): number {
    const min = Math.max(1, minMinutes); // 최소 1분
    const max = Math.max(min, maxMinutes); // 최대값이 최소값보다 작을 경우 보정
    const randomMinutes = Math.random() * (max - min) + min;
    return Math.floor(randomMinutes * 60 * 1000); // 밀리초로 변환
}

/**
 * 개별 채팅방에서 선톡을 스케줄링합니다
 * @param character 선톡을 보낼 캐릭터
 * @param room 대상 채팅방
 * @param dispatch Redux dispatch 함수
 * @param minMinutes 최소 대기 시간 (분)
 * @param maxMinutes 최대 대기 시간 (분)
 */
export function scheduleFirstMessage(
    character: Character,
    room: Room,
    dispatch: AppDispatch,
    minMinutes: number = 30,
    maxMinutes: number = 120
): void {
    const schedulerId = `${room.id}-${character.id}`;
    
    // 이미 스케줄된 선톡이 있다면 취소
    if (activeSchedulers.has(schedulerId)) {
        clearTimeout(activeSchedulers.get(schedulerId)!);
    }
    
    const delay = getRandomDelay(minMinutes, maxMinutes);
    
    const timeout = setTimeout(async () => {
        try {
            // AI 기반 또는 템플릿 기반 선톡 메시지 생성
            const content = await generateContextualFirstMessage(character, room);
            
            const firstMessage: Message = {
                id: nanoid(),
                roomId: room.id,
                authorId: character.id,
                content,
                createdAt: new Date().toISOString(),
                type: 'TEXT',
                isFirstMessage: true // 선톡임을 표시하는 플래그
            };
            
            // 메시지 전송
            dispatch(messagesActions.upsertOne(firstMessage));
            
            console.log(`[First Message] ${character.name}이(가) ${room.name}에서 선톡을 보냈습니다: ${firstMessage.content}`);
        } catch (error) {
            console.error(`[First Message] ${character.name}의 선톡 생성 중 오류:`, error);
            
            // 오류 발생 시 템플릿 메시지로 대체
            const fallbackMessage: Message = {
                id: nanoid(),
                roomId: room.id,
                authorId: character.id,
                content: generateFirstMessage(character, room.type === 'Group'),
                createdAt: new Date().toISOString(),
                type: 'TEXT',
                isFirstMessage: true
            };
            
            dispatch(messagesActions.upsertOne(fallbackMessage));
            console.log(`[First Message] ${character.name}이(가) ${room.name}에서 대체 선톡을 보냈습니다: ${fallbackMessage.content}`);
        } finally {
            // 스케줄러에서 제거
            activeSchedulers.delete(schedulerId);
        }
    }, delay);
    
    // 스케줄러 등록
    activeSchedulers.set(schedulerId, timeout);
    
    console.log(`[First Message] ${character.name}의 선톡이 ${Math.round(delay / (60 * 1000))}분 후 ${room.name}에서 예약되었습니다.`);
}

/**
 * 그룹 채팅에서 선톡을 스케줄링합니다
 * @param characters 선톡을 보낼 수 있는 캐릭터들
 * @param room 대상 그룹 채팅방
 * @param dispatch Redux dispatch 함수
 * @param minMinutes 최소 대기 시간 (분)
 * @param maxMinutes 최대 대기 시간 (분)
 */
export function scheduleGroupFirstMessage(
    characters: Character[],
    room: Room,
    dispatch: AppDispatch,
    minMinutes: number = 30,
    maxMinutes: number = 120
): void {
    if (characters.length === 0) return;
    
    // 랜덤하게 캐릭터 선택
    const randomCharacter = characters[Math.floor(Math.random() * characters.length)];
    
    scheduleFirstMessage(randomCharacter, room, dispatch, minMinutes, maxMinutes);
}

/**
 * 특정 채팅방의 선톡 스케줄을 취소합니다
 * @param roomId 채팅방 ID
 * @param characterId 캐릭터 ID (선택사항, 지정하지 않으면 해당 방의 모든 스케줄 취소)
 */
export function cancelFirstMessageSchedule(roomId: string, characterId?: number): void {
    if (characterId) {
        const schedulerId = `${roomId}-${characterId}`;
        if (activeSchedulers.has(schedulerId)) {
            clearTimeout(activeSchedulers.get(schedulerId)!);
            activeSchedulers.delete(schedulerId);
            console.log(`[First Message] ${roomId}의 ${characterId} 선톡 스케줄이 취소되었습니다.`);
        }
    } else {
        // 해당 방의 모든 스케줄 취소
        const keysToDelete: string[] = [];
        for (const [key] of activeSchedulers) {
            if (key.startsWith(`${roomId}-`)) {
                clearTimeout(activeSchedulers.get(key)!);
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => activeSchedulers.delete(key));
        console.log(`[First Message] ${roomId}의 모든 선톡 스케줄이 취소되었습니다.`);
    }
}

/**
 * 모든 선톡 스케줄을 취소합니다
 */
export function cancelAllFirstMessageSchedules(): void {
    for (const timeout of activeSchedulers.values()) {
        clearTimeout(timeout);
    }
    activeSchedulers.clear();
    console.log('[First Message] 모든 선톡 스케줄이 취소되었습니다.');
}

/**
 * 현재 활성화된 선톡 스케줄 수를 반환합니다
 */
export function getActiveScheduleCount(): number {
    return activeSchedulers.size;
}

/**
 * 특정 채팅방의 활성 스케줄 목록을 반환합니다
 * @param roomId 채팅방 ID
 * @returns 활성 스케줄 ID 배열
 */
export function getActiveSchedulesForRoom(roomId: string): string[] {
    const schedules: string[] = [];
    for (const [key] of activeSchedulers) {
        if (key.startsWith(`${roomId}-`)) {
            schedules.push(key);
        }
    }
    return schedules;
}