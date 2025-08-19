import { store, type AppDispatch } from "../app/store";
import { selectCharacterById } from "../entities/character/selectors";
import type { Message } from "../entities/message/types";
import type { Room } from "../entities/room/types";
import { selectAllSettings, selectCurrentApiConfig } from "../entities/setting/selectors";
import { messagesActions } from "../entities/message/slice";
import type { ChatResponse, MessagePart } from "./type";
import { selectMessagesByRoomId } from "../entities/message/selectors";
import type { Character } from "../entities/character/types";
import { buildGeminiApiPayload, buildVertexApiPayload } from "./promptBuilder";
import type { ApiConfig } from "../entities/setting/types";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const VERTEX_AI_API_BASE_URL = "https://aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:generateContent";
async function handleApiResponse(
    res: ChatResponse,
    room: Room,
    char: Character,
    dispatch: AppDispatch,
    setTypingCharacterId: (id: number | null) => void
) {
    if (res && res.messages && Array.isArray(res.messages) && res.messages.length > 0) {
        await sleep(res.reactionDelay || 1000);
        setTypingCharacterId(char.id);

        for (const messagePart of res.messages) {
            await sleep(messagePart.delay || 1000);
            const message = createMessageFromPart(messagePart, room.id, char);
            dispatch(messagesActions.upsertOne(message));
        }
    }
}

function createMessageFromPart(messagePart: MessagePart, roomId: string, char: Character): Message {
    const message: Message = {
        id: crypto.randomUUID(),
        roomId: roomId,
        authorId: char.id,
        content: messagePart.content,
        createdAt: new Date().toISOString(),
        type: messagePart.sticker ? 'STICKER' : 'TEXT',
    };

    if (messagePart.sticker) {
        const foundSticker = char.stickers?.find(s => s.id == messagePart.sticker || s.name === messagePart.sticker);
        if (foundSticker) {
            message.sticker = foundSticker;
        }
    }
    return message;
}

function handleError(error: unknown, roomId: string, charId: number, dispatch: AppDispatch) {
    console.error("Error in LLMSend:", error);
    const errorMessage = `답변이 생성되지 않았습니다. (이유: ${error instanceof Error ? error.message : String(error)})`;
    const errorResponse: Message = {
        id: crypto.randomUUID(),
        roomId: roomId,
        authorId: charId,
        content: errorMessage,
        createdAt: new Date().toISOString(),
        type: 'TEXT',
    };
    dispatch(messagesActions.upsertOne(errorResponse));
}


export async function SendMessage(room: Room, setTypingCharacterId: (id: number | null) => void) {
    const memberChars = room.memberIds.map(id => selectCharacterById(store.getState(), id));

    for (const char of memberChars) {
        if (char) {
            await LLMSend(room, char, setTypingCharacterId);
        }
    }
}

export async function LLMSend(room: Room, char: Character, setTypingCharacterId: (id: number | null) => void) {
    const state = store.getState();
    const dispatch = store.dispatch;

    const api = selectCurrentApiConfig(state);
    const settings = selectAllSettings(state);
    const messages = selectMessagesByRoomId(state, room.id);

    try {
        let res;
        if (settings.apiProvider === 'vertexai') {
            res = await callVertexAPI(
                api,
                settings.userName,
                settings.userDescription,
                char,
                messages
            );
        } else {
            res = await callGeminiAPI(
                api,
                settings.userName,
                settings.userDescription,
                char,
                messages
            );
        }
        await handleApiResponse(res, room, char, dispatch, setTypingCharacterId);
    } catch (error) {
        handleError(error, room.id, char.id, dispatch);
    } finally {
        setTypingCharacterId(null);
    }
}

export async function callGeminiAPI(
    api: ApiConfig,
    userName: string,
    userDescription: string,
    character: Character,
    messages: Message[],
    isProactive = false
): Promise<ChatResponse> {

    const payload = buildGeminiApiPayload(userName, userDescription, character, messages, isProactive);

    try {
        const response = await fetch(`${GEMINI_API_BASE_URL}${api.model}:generateContent?key=${api.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("API Error:", data);
            const errorMessage = (data as any)?.error?.message || `API 요청 실패: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts[0]?.text) {
            const rawResponseText = data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(rawResponseText);
            parsed.reactionDelay = Math.max(0, parsed.reactionDelay || 0);
            return parsed;
        } else {
            const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || '알 수 없는 이유';
            console.warn("API 응답에 유효한 content가 없습니다.", data);
            throw new Error(reason);
        }

    } catch (error: unknown) {
        console.error("Gemini API 호출 중 오류 발생:", error);
        throw error;
    }
}

export async function callVertexAPI(
    api: ApiConfig,
    userName: string,
    userDescription: string,
    character: Character,
    messages: Message[],
    isProactive = false
): Promise<ChatResponse> {

    const payload = buildVertexApiPayload(userName, userDescription, character, messages, isProactive);
    const url = VERTEX_AI_API_BASE_URL
        .replace(/{location}/g, api.location || 'us-central1')
        .replace("{projectId}", api.projectId || '')
        .replace("{model}", api.model);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api.accessToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("API Error:", data);
            const errorMessage = (data as any)?.error?.message || `API 요청 실패: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts[0]?.text) {
            const rawResponseText = data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(rawResponseText);
            parsed.reactionDelay = Math.max(0, parsed.reactionDelay || 0);
            return parsed;
        } else {
            const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || '알 수 없는 이유';
            console.warn("API 응답에 유효한 content가 없습니다.", data);
            throw new Error(reason);
        }

    } catch (error: unknown) {
        console.error("Vertex AI API 호출 중 오류 발생:", error);
        throw error;
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
