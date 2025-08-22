import { store, type AppDispatch } from "../app/store";
import { selectCharacterById, selectAllCharacters } from "../entities/character/selectors";
import type { Message } from "../entities/message/types";
import type { Room } from "../entities/room/types";
import { selectAllSettings, selectCurrentApiConfig } from "../entities/setting/selectors";
import { messagesActions } from "../entities/message/slice";
import { roomsActions } from "../entities/room/slice";
import type { ChatResponse, MessagePart } from "./type";
import { selectMessagesByRoomId } from "../entities/message/selectors";
import type { Character } from "../entities/character/types";
import { buildGeminiApiPayload } from "./promptBuilder";
import type { ApiConfig, SettingsState } from "../entities/setting/types";
import { calcReactionDelay, sleep } from "../utils/reactionDelay";

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

async function callApi(
    apiConfig: ApiConfig,
    settings: SettingsState,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    userDescription?: string
): Promise<ChatResponse> {
    const { apiProvider } = settings;
    const payload = buildGeminiApiPayload(settings.userName, userDescription ?? settings.userDescription, character, messages, isProactive, settings.useStructuredOutput);

    let url: string;
    let headers: HeadersInit;

    if (apiProvider === 'vertexai') {
        url = VERTEX_AI_API_BASE_URL
            .replace(/{location}/g, apiConfig.location || 'us-central1')
            .replace("{projectId}", apiConfig.projectId || '')
            .replace("{model}", apiConfig.model);
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.accessToken}`
        };
    } else { // gemini
        url = `${GEMINI_API_BASE_URL}${apiConfig.model}:generateContent?key=${apiConfig.apiKey}`;
        headers = { 'Content-Type': 'application/json' };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("API Error:", data);
            const errorMessage = (data as any)?.error?.message || `API 요청 실패: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        return parseApiResponse(data, settings, messages);

    } catch (error: unknown) {
        console.error(`${apiProvider} API 호출 중 오류 발생:`, error);
        throw error;
    }
}

function parseApiResponse(data: any, settings: SettingsState, messages: Message[]): ChatResponse {
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts[0]?.text) {
        const rawResponseText = data.candidates[0].content.parts[0].text;
        if (settings.useStructuredOutput) {
            const parsed = JSON.parse(rawResponseText);
            parsed.reactionDelay = Math.max(0, parsed.reactionDelay || 0);
            return parsed;
        } else {
            const lines = rawResponseText.split('\n').filter((line: string) => line.trim() !== '');
            const formattedMessages = lines.map((line: string) => ({
                delay: calcReactionDelay({
                    inChars: messages[messages.length - 1]?.content.length || 0,
                    outChars: line.length,
                    device: "mobile",
                }, {
                    speedup: 2
                }),
                content: line,
            }));
            return { reactionDelay: 0, messages: formattedMessages };
        }
    } else {
        const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || '알 수 없는 이유';
        console.warn("API 응답에 유효한 content가 없습니다.", data);
        throw new Error(reason);
    }
}


async function LLMSend(
    room: Room,
    char: Character,
    setTypingCharacterId: (id: number | null) => void,
    allParticipants?: Character[],
) {
    const state = store.getState();
    const dispatch = store.dispatch;

    const api = selectCurrentApiConfig(state);
    const settings = selectAllSettings(state);
    const messages = selectMessagesByRoomId(state, room.id);

    let finalUserDescription = settings.userDescription;

    if (room.type === 'Group' && allParticipants) {
        const otherParticipants = allParticipants.filter(p => p.id !== char.id);
        const participantDetails = otherParticipants.map(p => {
            const basicInfo = p.prompt ? p.prompt.split('\n').slice(0, 3).join(' ').replace(/[#*]/g, '').trim() : '';
            return `- ${p.name}: ${basicInfo || 'Character'}`;
        }).join('\n');

        const groupPrompt = settings.prompts.main.group_chat_context;
        const groupContext = groupPrompt
            .replace(/{participantCount}/g, (allParticipants.length + 1).toString())
            .replace(/{userName}/g, settings.userName)
            .replace(/{participantDetails}/g, participantDetails)
            .replace(/{characterName}/g, char.name);
        finalUserDescription += '\n' + groupContext;
    } else if (room.type === 'Open' && allParticipants) {
        const otherParticipants = allParticipants.filter(p => p.id !== char.id);
        const participantDetails = otherParticipants.map(p => {
            const basicInfo = p.prompt ? p.prompt.split('\n').slice(0, 3).join(' ').replace(/[#*]/g, '').trim() : '';
            return `- ${p.name}: ${basicInfo || 'Character'}`;
        }).join('\n');

        const openPrompt = settings.prompts.main.open_chat_context;
        const openContext = openPrompt
            .replace(/{userName}/g, settings.userName)
            .replace(/{participantDetails}/g, participantDetails)
            .replace(/{characterName}/g, char.name);
        finalUserDescription += '\n' + openContext;
    }


    try {
        const res = await callApi(
            api,
            settings,
            char,
            messages,
            false,
            finalUserDescription
        );
        await handleApiResponse(res, room, char, dispatch, setTypingCharacterId);
    } catch (error) {
        handleError(error, room.id, char.id, dispatch);
    } finally {
        setTypingCharacterId(null);
    }
}


export async function SendMessage(room: Room, setTypingCharacterId: (id: number | null) => void) {
    const memberChars = room.memberIds.map(id => selectCharacterById(store.getState(), id));

    for (const char of memberChars) {
        if (char) {
            await LLMSend(room, char, setTypingCharacterId);
        }
    }
}

export async function SendGroupChatMessage(room: Room, setTypingCharacterId: (id: number | null) => void) {
    const state = store.getState();
    const allCharacters = selectAllCharacters(state);
    const participants = room.memberIds.map(id => allCharacters.find(c => c.id === id)).filter((c): c is Character => !!c);

    if (participants.length === 0) return;

    const settings = room.groupSettings;
    if (!settings) return;

    const { responseFrequency, maxRespondingCharacters, responseDelay } = settings;

    if (Math.random() > responseFrequency) {
        return;
    }

    const activeParticipants = participants.filter(p => {
        const participantSettings = settings.participantSettings?.[p.id];
        if (participantSettings?.isActive === false) return false;
        const responseProbability = participantSettings?.responseProbability || 0.9;
        return Math.random() <= responseProbability;
    });

    if (activeParticipants.length === 0) return;

    const shuffledParticipants = [...activeParticipants].sort(() => 0.5 - Math.random());

    const respondingCount = Math.min(
        Math.floor(Math.random() * maxRespondingCharacters) + 1,
        shuffledParticipants.length
    );
    const respondingCharacters = shuffledParticipants.slice(0, respondingCount);

    for (let i = 0; i < respondingCharacters.length; i++) {
        const character = respondingCharacters[i];
        if (i > 0) {
            await sleep(responseDelay + (Math.random() * 300 - 150));
        }
        await LLMSend(room, character, setTypingCharacterId, participants);
    }
}

export async function SendOpenChatMessage(room: Room, setTypingCharacterId: (id: number | null) => void) {
    const state = store.getState();
    const dispatch = store.dispatch;
    const allCharacters = selectAllCharacters(state);

    const currentParticipantIds = room.currentParticipants || [];
    const remainingParticipantIds: number[] = [];
    for (const participantId of currentParticipantIds) {
        if (Math.random() > 0.1) {
            remainingParticipantIds.push(participantId);
        } else {
            const character = allCharacters.find(c => c.id === participantId);
            if (character) {
                dispatch(messagesActions.upsertOne({
                    id: crypto.randomUUID(),
                    roomId: room.id,
                    authorId: 0,
                    content: `${character.name}님이 나갔습니다.`,
                    createdAt: new Date().toISOString(),
                    type: 'SYSTEM',
                }));
            }
        }
    }

    const newJoinerIds: number[] = [];
    const nonParticipantChars = allCharacters.filter(c => !currentParticipantIds.includes(c.id));
    for (const char of nonParticipantChars) {
        if (Math.random() < 0.1) {
            newJoinerIds.push(char.id);
            dispatch(messagesActions.upsertOne({
                id: crypto.randomUUID(),
                roomId: room.id,
                authorId: 0,
                content: `${char.name}님이 들어왔습니다.`,
                createdAt: new Date().toISOString(),
                type: 'SYSTEM',
            }));
        }
    }

    const finalParticipantIds = [...remainingParticipantIds, ...newJoinerIds];
    dispatch(roomsActions.upsertOne({ ...room, currentParticipants: finalParticipantIds }));

    const participants = finalParticipantIds.map(id => allCharacters.find(c => c.id === id)).filter((c): c is Character => !!c);

    if (participants.length === 0) return;

    const respondingCharacters = participants.filter(() => Math.random() < 0.5).slice(0, 2);

    for (let i = 0; i < respondingCharacters.length; i++) {
        const character = respondingCharacters[i];
        if (i > 0) {
            await sleep(500 + Math.random() * 500);
        }
        await LLMSend(room, character, setTypingCharacterId, participants);
    }
}