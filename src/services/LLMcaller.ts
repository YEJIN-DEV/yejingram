import { store, type AppDispatch } from "../app/store";
import { selectCharacterById, selectAllCharacters } from "../entities/character/selectors";
import type { Message } from "../entities/message/types";
import type { Room } from "../entities/room/types";
import { selectAllSettings, selectCurrentApiConfig, selectCurrentImageApiConfig, selectSelectedPersona } from "../entities/setting/selectors";
import { messagesActions } from "../entities/message/slice";
import { roomsActions } from "../entities/room/slice";
import type { ChatResponse, MessagePart } from "./type";
import { selectMessagesByRoomId } from "../entities/message/selectors";
import type { Character } from "../entities/character/types";
import { buildGeminiApiPayload, buildClaudeApiPayload, buildOpenAIApiPayload, buildGeminiImagePayload, buildNovelAIImagePayload } from "./promptBuilder";
import type { ApiConfig, Persona, SettingsState } from "../entities/setting/types";
import { calcReactionDelay, sleep } from "../utils/reactionDelay";
import { nanoid } from "@reduxjs/toolkit";
import toast from 'react-hot-toast';
import { unzipToDataUrls } from "../utils/zip2png";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const VERTEX_AI_API_BASE_URL = "https://aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:generateContent";
const CLAUDE_API_BASE_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_API_BASE_URL = "https://api.openai.com/v1/chat/completions";
const GROK_API_BASE_URL = "https://api.x.ai/v1/chat/completions";
const NAI_DIFFUSION_API_BASE_URL = "https://image.novelai.net/ai/generate-image";

// Remove leading speaker/meta tags like [From: XXX] or [Name: XXX] from model output
function sanitizeOutputContent(text?: string): string | undefined {
    if (!text) return text;
    const TAG = /\[\s*(?:from|name)\s*:[^\]]*]/gi;
    const PUNCT_TAG = /([.!?…。！？]["')\]]?)[ \t]*\[\s*(?:from|name)\s*:[^\]]*]\s*/gi;

    const clean = (line: string) => {
        let s = line.replace(/^(?:\s*\[\s*(?:from|name)\s*:[^\]]*]\s*)+/i, '');
        let prev: string;
        do {
            prev = s;
            s = s.replace(PUNCT_TAG, '$1 ').replace(TAG, '');
        } while (s !== prev);
        return s.replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
    };

    return text.split(/\r?\n/).map(clean).join('\n').replace(/^\s+/, '');
}

async function handleApiResponse(
    res: ChatResponse,
    room: Room,
    char: Character,
    dispatch: AppDispatch,
    setTypingCharacterId: (id: number | null) => void
) {
    // If structured output included a newMemory field, append it to the character
    if (res && 'newMemory' in res) {
        const mem = res.newMemory;
        if (typeof mem === 'string') {
            const trimmed = mem.trim();
            if (trimmed.length > 0) {
                const exists = room.memories?.some(m => m.trim().toLowerCase() === trimmed.toLowerCase());
                if (!exists) {
                    dispatch(roomsActions.addRoomMemory({ roomId: room.id, value: trimmed }));
                    // Toast 알림으로 새로운 메모리 추가를 알림
                    toast.success(`새로운 기억이 추가되었습니다:\n"${trimmed}"`, {
                        duration: 5000,
                    });
                }
            }
        }
    }
    if (res && res.messages && Array.isArray(res.messages) && res.messages.length > 0) {
        await sleep(res.reactionDelay || 1000);
        setTypingCharacterId(char.id);

        for (let i = 0; i < res.messages.length; i++) {
            const messagePart = res.messages[i];
            if (i > 0) {
                await sleep(messagePart.delay || 1000);
            }
            const message = await createMessageFromPart(messagePart, room.id, char);
            dispatch(messagesActions.upsertOne(message));
        }
    }
}

async function createMessageFromPart(messagePart: MessagePart, roomId: string, char: Character): Promise<Message> {
    let message = {
        id: nanoid(),
        roomId: roomId,
        authorId: char.id,
        content: messagePart.content,
        createdAt: new Date().toISOString(),
        type: messagePart.imageGenerationSetting ? 'IMAGE' : messagePart.sticker ? 'STICKER' : 'TEXT',
    } as Message;

    if (messagePart.sticker) {
        const foundSticker = char.stickers?.find(s => s.id == messagePart.sticker || s.name === messagePart.sticker);
        if (foundSticker) {
            message = {
                ...message,
                sticker: foundSticker
            };
        }
    }

    if (messagePart.imageGenerationSetting) {
        const imageResponse = await callImageGeneration(messagePart.imageGenerationSetting, char);
        const inlineDataBody = imageResponse.candidates[0].content.parts[0].inlineData ?? imageResponse.candidates[0].content.parts[1].inlineData ?? null;
        if (inlineDataBody) {
            message = {
                ...message,
                file: {
                    dataUrl: `data:${inlineDataBody.mimeType};base64,${inlineDataBody.data}`,
                    mimeType: inlineDataBody.mimeType,
                    name: `generated_image.${inlineDataBody.mimeType.split('/')[1] || 'png'}`
                }
            };
        } else {
            throw new Error('이미지 생성에 실패했습니다:', imageResponse.candidates[0].finishReason ?? '');
        }
    }

    return message;
}

async function callImageGeneration(imageGenerationSetting: { prompt: string; isSelfie: boolean }, char: Character) {
    // 이미지 생성 API 호출
    const imageConfig = selectCurrentImageApiConfig(store.getState());
    const imageApiProvider = imageConfig.model.startsWith('nai-') ? 'novelai' : 'gemini';
    let url: string;
    let headers: { 'Content-Type': string; 'Authorization'?: string } = { 'Content-Type': 'application/json' };
    let payload: object = {};
    if (imageApiProvider === 'novelai') {
        url = NAI_DIFFUSION_API_BASE_URL;
        headers = { ...headers, 'Authorization': `Bearer ${imageConfig.apiKey}` };
        payload = buildNovelAIImagePayload(imageGenerationSetting.prompt, imageConfig.model);
    } else { // gemini
        url = `${GEMINI_API_BASE_URL}${imageConfig.model}:generateContent?key=${imageConfig.apiKey}`;
        payload = buildGeminiImagePayload(imageGenerationSetting.prompt, imageGenerationSetting.isSelfie, char);
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (imageApiProvider === 'gemini') {
            const data = await response.json();

            if (!response.ok) {
                console.error("API Error:", data);
                const errorMessage = (data as any)?.error?.message || `API 요청 실패: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            return data;
        } else { // novelai
            if (!response.ok) {
                const errorData = await response.json();
                console.error("NovelAI API Error:", errorData);
                const errorMessage = errorData?.message || `API 요청 실패: ${response.statusText}`;
                throw new Error(errorMessage);
            } else {
                const imageData = await unzipToDataUrls(await response.arrayBuffer());
                return {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: imageData.mimeType,
                                    data: imageData.data
                                }
                            }]
                        },
                        finishReason: 'stop'
                    }]
                };
            }
        }

    } catch (error: unknown) {
        console.error(`이미지 생성 API 호출 중 오류 발생:`, error);
        throw error;
    }
}

function handleError(error: unknown, roomId: string, charId: number, dispatch: AppDispatch) {
    console.error("Error in LLMSend:", error);
    const errorMessage = `답변이 생성되지 않았습니다. (이유: ${error instanceof Error ? error.message : String(error)})`;
    const errorResponse: Message = {
        id: nanoid(),
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
    room: Room,
    persona: Persona,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    extraSystemInstruction?: string,
): Promise<ChatResponse> {
    const { apiProvider } = settings;
    let payload: string | object = '';

    switch (apiProvider) {
        case 'gemini':
            payload = await buildGeminiApiPayload('gemini', room, persona, character, messages, isProactive, settings.useStructuredOutput, settings.useImageResponse, apiConfig.model, { apiKey: apiConfig.apiKey! }, extraSystemInstruction);
            break;
        case 'vertexai':
            payload = await buildGeminiApiPayload('vertexai', room, persona, character, messages, isProactive, settings.useStructuredOutput, settings.useImageResponse, apiConfig.model, {
                apiKey: apiConfig.accessToken!,
                location: apiConfig.location!,
                projectId: apiConfig.projectId!
            }, extraSystemInstruction);
            break;
        case 'claude':
            payload = await buildClaudeApiPayload('claude', room, persona, character, messages, isProactive, settings.useStructuredOutput, apiConfig.model, apiConfig.apiKey, extraSystemInstruction);
            break;
        case 'grok':
            payload = await buildClaudeApiPayload('grok', room, persona, character, messages, isProactive, settings.useStructuredOutput, apiConfig.model, apiConfig.apiKey, extraSystemInstruction);
            break;
        case 'openai':
        case 'customOpenAI':
            payload = await buildOpenAIApiPayload(room, persona, character, messages, isProactive, settings.useStructuredOutput, apiConfig.model, extraSystemInstruction);
            break;
    }
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
    } else if (apiProvider === 'gemini') {
        url = `${GEMINI_API_BASE_URL}${apiConfig.model}:generateContent?key=${apiConfig.apiKey}`;
        headers = { 'Content-Type': 'application/json' };
    } else if (apiProvider === 'claude') {
        url = CLAUDE_API_BASE_URL;
        headers = {
            "x-api-key": apiConfig.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "anthropic-dangerous-direct-browser-access": "true"
        };
    } else { // openai & customOpenAI & grok
        const baseUrl = (apiProvider === 'customOpenAI' && apiConfig.baseUrl) ? apiConfig.baseUrl : (apiProvider === 'grok' ? GROK_API_BASE_URL : OPENAI_API_BASE_URL);
        url = baseUrl;
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`
        };
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
    const apiProvider = settings.apiProvider;

    function processApiMessage(targetData: string): ChatResponse {
        const rawResponseText = sanitizeOutputContent(targetData) ?? '';
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
                    speedup: settings.speedup
                }),
                content: line,
            }));
            return { reactionDelay: 0, messages: formattedMessages };
        }
    }

    if (apiProvider === 'gemini' || apiProvider === 'vertexai') {
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts[0]?.text) {
            return processApiMessage(data.candidates[0].content?.parts[0]?.text);
        } else {
            throw new Error(data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || '알 수 없는 이유');
        }
    } else if (apiProvider === 'claude') { // Claude
        if (data.content && data.content.length > 0 && data.content[0]?.text) {
            return processApiMessage(data.content[0]?.text);
        } else {
            throw new Error(data.stop_reason || '알 수 없는 이유');
        }
    } else { // OpenAI-compatible
        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
            const t2 = data?.choices?.[0]?.delta?.content; // for stream chunks if ever used
            if (!t2) throw new Error('응답 본문이 비어있습니다.');
            return processApiMessage(t2);
        }
        return processApiMessage(text);
    }
}


async function LLMSend(
    room: Room,
    persona: Persona | null,
    char: Character,
    setTypingCharacterId: (id: number | null) => void,
) {
    const state = store.getState();
    const dispatch = store.dispatch;

    const api = selectCurrentApiConfig(state);
    const settings = selectAllSettings(state);
    const messages = selectMessagesByRoomId(state, room.id);

    // --- Anti-echo detection helpers ---
    function normalize(text: string) {
        return (text || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[\p{P}\p{S}]/gu, '')
            .trim();
    }
    function tokenSet(text: string) {
        return new Set(normalize(text).split(' ').filter(Boolean));
    }
    function jaccard(a: Set<string>, b: Set<string>) {
        if (a.size === 0 || b.size === 0) return 0;
        let inter = 0;
        for (const t of a) if (b.has(t)) inter++;
        return inter / (a.size + b.size - inter);
    }
    function isEchoLike(reply: string, refs: string[], threshold = 0.8) {
        const r = tokenSet(reply);
        for (const ref of refs) {
            const refNorm = normalize(ref);
            if (!refNorm) continue;
            if (normalize(reply).includes(refNorm) || refNorm.includes(normalize(reply))) return true;
            const s = tokenSet(ref);
            const score = jaccard(r, s);
            if (score >= threshold) return true;
        }
        return false;
    }

    try {
        if (!persona) {
            return;
        }

        // Build negative references from last few non-self messages
        const recentOthers = [...messages]
            .reverse()
            .filter(m => m.authorId !== char.id && m.type !== 'SYSTEM')
            .slice(0, 3);
        const refTexts = recentOthers.map(m => m.content || '').filter(Boolean);

        let extraInstruction: string | undefined = undefined;
        let attempts = 0;
        let maxAttempts = 3; // initial + 2 retries
        let finalRes: ChatResponse | null = null;

        while (attempts < maxAttempts) {
            const res = await callApi(
                api,
                settings,
                room,
                persona,
                char,
                messages,
                false,
                extraInstruction
            );

            // Concatenate contents to evaluate similarity as a whole
            const combined = (res.messages || []).map(p => p.content || '').join('\n');
            if (room.type !== 'Direct' && refTexts.length > 0 && isEchoLike(combined, refTexts)) {
                // Prepare stronger instruction and retry
                const lastRef = refTexts[0];
                extraInstruction = `Your previous draft was too similar to another participant's last message: "${lastRef.slice(0, 200)}". Do NOT repeat or paraphrase it. Produce a NEW, concise reply that adds value (ask a short follow-up or introduce a new detail). Avoid using the same phrases.`;
                attempts++;
                continue;
            }
            finalRes = res;
            break;
        }

        if (!finalRes) {
            // Fallback: if still echo-like, send a short probing question to move forward
            finalRes = {
                reactionDelay: 500,
                messages: [{ delay: 800, content: '그 얘기 흥미로운데, 너는 어떻게 생각해?' }]
            };
        }

        await handleApiResponse(finalRes, room, char, dispatch, setTypingCharacterId);
    } catch (error) {
        handleError(error, room.id, char.id, dispatch);
    } finally {
        setTypingCharacterId(null);
    }
}


export async function SendMessage(room: Room, setTypingCharacterId: (id: number | null) => void) {
    const state = store.getState();
    const persona = selectSelectedPersona(state);
    const memberChars = room.memberIds.map(id => selectCharacterById(state, id));

    for (const char of memberChars) {
        if (char) {
            await LLMSend(room, persona, char, setTypingCharacterId);
        }
    }
}

export async function SendGroupChatMessage(room: Room, setTypingCharacterId: (id: number | null) => void) {
    const state = store.getState();
    const persona = selectSelectedPersona(state);
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

    const respondingCount = Math.min(maxRespondingCharacters, shuffledParticipants.length);
    const respondingCharacters = shuffledParticipants.slice(0, respondingCount);

    for (let i = 0; i < respondingCharacters.length; i++) {
        const character = respondingCharacters[i];
        if (i > 0) {
            await sleep(responseDelay + (Math.random() * 300 - 150));
        }
        await LLMSend(room, persona, character, setTypingCharacterId);
    }
}