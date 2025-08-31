import { store } from "../app/store";
import type { Character } from "../entities/character/types";
import type { Message } from "../entities/message/types";
import { selectPrompts } from "../entities/setting/selectors";
import type { GeminiApiPayload, ClaudeApiPayload, OpenAIApiPayload } from "./type";
import { getActiveRoomId } from "../utils/activeRoomTracker";
import { selectRoomById } from "../entities/room/selectors";
import { selectCurrentApiConfig } from "../entities/setting/selectors";
import { selectCharacterById } from "../entities/character/selectors";
import type { Persona } from "../entities/setting/types";
import { replacePlaceholders } from "../utils/placeholder";
import type { PlaceholderValues } from "../utils/placeholder";
import type { Room } from "../entities/room/types";
import type { PromptItem } from "../entities/setting/types";
import type { Lore } from "../entities/lorebook/types";

type GeminiContent = {
    role: string;
    parts: ({ text: string; } | { inline_data: { mime_type: string; data: string; }; })[];
};

type ClaudeMessage = {
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
};

type OpenAIMessage = {
    role: 'system' | 'user' | 'assistant' | string;
    content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
};

const structuredOutputSchema = {
    type: "OBJECT",
    properties: {
        "reactionDelay": { "type": "INTEGER" },
        "messages": {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    "delay": { "type": "INTEGER" },
                    "content": { "type": "STRING" },
                    "sticker": { "type": "STRING" }
                },
                required: ["delay"]
            }
        },
        "characterState": {
            type: "OBJECT",
            properties: {
                "mood": { "type": "NUMBER" },
                "energy": { "type": "NUMBER" },
                "socialBattery": { "type": "NUMBER" },
                "personality": {
                    type: "OBJECT",
                    properties: {
                        "extroversion": { "type": "NUMBER" },
                        "openness": { "type": "NUMBER" },
                        "conscientiousness": { "type": "NUMBER" },
                        "agreeableness": { "type": "NUMBER" },
                        "neuroticism": { "type": "NUMBER" }
                    },
                    required: ["extroversion", "openness", "conscientiousness", "agreeableness", "neuroticism"]
                }
            },
            required: ["mood", "energy", "socialBattery", "personality"]
        },
        "newMemory": { "type": "STRING" }
    },
    required: ["reactionDelay", "messages"]
}

function shouldIncludePromptItem(item: PromptItem, useStructuredOutput: boolean, room?: Room | null): boolean {
    if (item.type === 'plain-structured' && !useStructuredOutput) {
        return false;
    } else if (item.type === 'plain-unstructured' && useStructuredOutput) {
        return false;
    } else if (item.type === 'plain-group' && room?.type !== 'Group') {
        return false;
    } else if (item.type === 'plain-open' && room?.type !== 'Open') {
        return false;
    } else if (item.type === 'lorebook' || item.type === 'authornote' || item.type === 'memory' || item.type === 'userDescription' || item.type === 'characterPrompt') {
        // 새로운 타입들은 항상 포함 (또는 특정 조건 추가 가능)
        return true;
    }
    return true;
}

function getCommonPromptData(persona: Persona | null | undefined, character: Character | undefined, room: Room | null | undefined) {
    const userName = persona?.name || 'User';
    const userDescription = persona?.description || 'No specific information provided about the user.';
    let groupValues: Partial<PlaceholderValues> = {};
    if (room && room.type === 'Group' && character) {
        const groupDesc = buildGroupDescription(character, room);
        groupValues.participantDetails = groupDesc.participantDetails;
        groupValues.participantCount = groupDesc.participantCount;
    }
    const roomMemories = room?.memories?.join('\n') || '';
    return { userName, userDescription, groupValues, roomMemories };
}

function getActivatedLores(lorebook: Lore[], messages: Message[]): Lore[] {
    if (!lorebook || lorebook.length === 0) return [];
    const messageText = messages.map(msg => msg.content || '').join(' ').toLowerCase();
    return lorebook.filter(lore => {
        if (lore.alwaysActive) return true;
        const keys = lore.activationKeys.map(key => key.toLowerCase());
        if (lore.multiKey) {
            return keys.every(key => messageText.includes(key));
        } else {
            return keys.some(key => messageText.includes(key));
        }
    }).sort((a, b) => a.order - b.order); // order로 정렬
}

function getPromptItemContent(item: PromptItem, character: Character | undefined, room: Room | null | undefined, messages: Message[], persona?: Persona | null): string | null {
    if (item.type === 'lorebook') {
        const activatedLores = getActivatedLores(character?.lorebook || [], messages);
        return activatedLores.map(lore => lore.prompt).join('\n\n') || null;
    } else if (item.type === 'authornote') {
        return room?.authorNote || null;
    } else if (item.type === 'memory') {
        return room?.memories?.join('\n') || null;
    } else if (item.type === 'userDescription') {
        return persona?.description || null;
    } else if (item.type === 'characterPrompt') {
        return character?.prompt || null;
    } else if (item.content) {
        return item.content;
    }
    return null;
}

function buildMessageContents<T>(
    messages: Message[],
    persona: Persona | null | undefined,
    room: Room | null | undefined,
    transform: (msg: Message, speaker: string, header: string, role: string) => T
): T[] {
    const useSpeakerTag = room?.type !== 'Direct';
    return messages.map(msg => {
        const role = msg.authorId === 0 ? "user" : "assistant";
        const speaker = msg.authorId === 0
            ? (persona?.name || 'User')
            : (selectCharacterById(store.getState(), msg.authorId)?.name || `Char#${msg.authorId}`);
        const header = useSpeakerTag ? `[From: ${speaker}] ` : '';
        return transform(msg, speaker, header, role);
    });
}

function buildGroupDescription(
    character: Character,
    room: Room
) {
    const getParticipantDetails = () => {
        return room.memberIds
            .filter(id => id !== character.id)
            .map(id => {
                const participant = selectCharacterById(store.getState(), id);
                const basicInfo = participant?.prompt;
                return `- ${participant?.name}: ${basicInfo || 'Character'}`;
            })
            .join('\n');
    };

    return { participantDetails: getParticipantDetails(), participantCount: room.memberIds.length + 1 }; // Include the current user
}

function buildSystemPrompt(persona?: Persona | null, character?: Character, extraSystemInstruction?: string, room?: Room, messages?: Message[], useStructuredOutput?: boolean): string {
    // Keep only prompts whose role is 'system', in main array sequence.
    const { main } = selectPrompts(store.getState());
    const lines: string[] = [];
    const { userName, userDescription, groupValues, roomMemories } = getCommonPromptData(persona, character, room);
    for (const item of main) {
        if (item && item.role === 'system' && typeof item.content === 'string' && item.content.trim().length > 0) {
            if (shouldIncludePromptItem(item, useStructuredOutput || false, room)) {
                lines.push(replacePlaceholders(item.content, { userName, userDescription, character, roomMemories, ...groupValues }));
            }
        } else if (item && item.type === 'extraSystemInstruction' && extraSystemInstruction) {
            lines.push(replacePlaceholders(extraSystemInstruction, { userName, userDescription, character, roomMemories, ...groupValues }));
        } else if (item && (item.type === 'lorebook' || item.type === 'authornote' || item.type === 'memory' || item.type === 'userDescription' || item.type === 'characterPrompt')) {
            const content = getPromptItemContent(item, character, room, messages || [], persona);
            if (content && content.trim().length > 0 && shouldIncludePromptItem(item, useStructuredOutput || false, room)) {
                lines.push(replacePlaceholders(content, { userName, userDescription, character, roomMemories, ...groupValues }));
            }
        }
    }
    return lines.join('\n\n');
}

function buildGeminiContents(messages: Message[], isProactive: boolean, persona: Persona, character: Character, room: Room, useStructuredOutput?: boolean) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const currentRoom = room || (activeRoomId ? selectRoomById(state, activeRoomId) : null);
    const { main } = selectPrompts(state);
    const { userName, userDescription, groupValues, roomMemories } = getCommonPromptData(persona, character, currentRoom);

    const contents: GeminiContent[] = [];

    // Add messages
    const messageContents = buildMessageContents(messages, persona, currentRoom, (msg, _speaker, header, role) => {
        const baseText = msg.content ? `${header}${msg.content}` : (header ? header : '');
        const parts: ({ text: string; } | { inline_data: { mime_type: string; data: string; }; })[] = [{ text: baseText }];
        if (msg.image) {
            const mimeType = msg.image.dataUrl.match(/data:(.*);base64,/)?.[1];
            const base64Data = msg.image.dataUrl.split(',')[1];
            if (mimeType && base64Data) {
                parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                });
            }
        }
        if (msg.sticker) {
            parts.push({ text: `${header}[스티커 전송: "${(msg as any).sticker?.name || (msg as any).sticker}"]` });
        }
        return { role: role === 'assistant' ? 'model' : 'user', parts };
    });

    for (const item of main) {
        if (item && item.role !== 'system' && item.content && item.content.trim().length > 0) {
            if (shouldIncludePromptItem(item, useStructuredOutput || false, currentRoom)) {
                const role = item.role == 'assistant' ? 'model' : 'user';
                if (role) {
                    contents.push({
                        role,
                        parts: [{ text: replacePlaceholders(item.content, { userName, userDescription, character, roomMemories, ...groupValues }) }]
                    });
                }
            }
        } else if (item && item.type === 'chat') {
            contents.push(...messageContents);
        } else if (item && (item.type === 'lorebook' || item.type === 'authornote' || item.type === 'memory' || item.type === 'userDescription' || item.type === 'characterPrompt')) {
            const content = getPromptItemContent(item, character, currentRoom, messages, persona);
            if (content && content.trim().length > 0 && shouldIncludePromptItem(item, useStructuredOutput || false, currentRoom)) {
                const role = item.role || 'user';
                const geminiRole = role === 'assistant' ? 'model' : 'user';
                contents.push({
                    role: geminiRole,
                    parts: [{ text: replacePlaceholders(content, { userName, userDescription, character, roomMemories, ...groupValues }) }]
                });
            }
        }
    }

    if (isProactive && contents.length === 0) {
        contents.push({
            role: "user",
            parts: [{ text: "(SYSTEM: You are starting this conversation. Please begin.)" }]
        });
    }

    return contents;
}

export function buildGeminiApiPayload(
    room: Room,
    persona: Persona,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    useImageResponse: boolean | undefined,
    extraSystemInstruction?: string
): GeminiApiPayload {
    const systemPrompt = buildSystemPrompt(persona, character, extraSystemInstruction, room, messages, useStructuredOutput);
    const contents = buildGeminiContents(messages, isProactive, persona, character, room, useStructuredOutput);

    const generationConfig: any = {
        temperature: selectCurrentApiConfig(store.getState()).temperature || 1.25,
        topP: selectCurrentApiConfig(store.getState()).topP || 0.95,
    };

    const topK = selectCurrentApiConfig(store.getState()).topK;

    if (topK) {
        generationConfig.topK = topK;
    }

    if (useStructuredOutput) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = structuredOutputSchema;
        if (useImageResponse) {
            generationConfig.responseSchema.properties.messages.items.properties.imageGenerationSetting = {
                type: "OBJECT",
                properties: {
                    "prompt": { "type": "STRING" },
                    "isSelfie": { "type": "BOOLEAN" }
                },
                required: ["prompt", "isSelfie"]
            };
        }
    }

    return {
        contents: contents,
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: generationConfig,
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
    };
}

function buildClaudeContents(messages: Message[], isProactive: boolean, persona?: Persona, model?: string, character?: Character, extraSystemInstruction?: string, room?: Room, useStructuredOutput?: boolean) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const currentRoom = room || (activeRoomId ? selectRoomById(state, activeRoomId) : null);
    const { main } = selectPrompts(state);
    const { userName, userDescription, groupValues, roomMemories } = getCommonPromptData(persona, character, currentRoom);

    const messagesPart: ClaudeMessage[] = [];

    // Add messages
    const messageContents = buildMessageContents(messages, persona, currentRoom, (msg, _speaker, header, role) => {
        const content: ({ type: string; text: string; } |
        { type: 'image'; source: { data: string; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; type: 'base64'; }; })[] = [{ type: 'text', text: msg.content ? `${header}${msg.content}` : (header ? header : '') }];
        if (msg.image && model !== "grok-3") {
            const mimeType = msg.image.dataUrl.match(/data:(.*);base64,/)?.[1];
            if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/gif' && mimeType !== 'image/webp') {
                throw new Error(`Unsupported image type: ${mimeType} `);
            }
            const base64Data = msg.image.dataUrl.split(',')[1];
            if (mimeType && base64Data) {
                content.push({
                    type: 'image',
                    source: {
                        data: base64Data,
                        media_type: mimeType,
                        type: 'base64'
                    }
                });
            }
        }
        if (msg.sticker) {
            content.push({ type: 'text', text: `${header}[스티커 전송: "${(msg as any).sticker?.name || (msg as any).sticker}"]` });
        }
        return { role, content };
    });

    for (const item of main) {
        if (item && item.role !== 'system' && item.content && item.content.trim().length > 0) {
            if (shouldIncludePromptItem(item, useStructuredOutput || false, currentRoom)) {
                const role = item.role;

                if (role) {
                    messagesPart.push({
                        role,
                        content: [{ type: 'text', text: replacePlaceholders(item.content, { userName, userDescription, character, roomMemories, ...groupValues }) }]
                    });
                }
            }
        } else if (item && item.type === 'extraSystemInstruction' && extraSystemInstruction) {
            messagesPart.push({
                role: 'system',
                content: [{ type: 'text', text: replacePlaceholders(extraSystemInstruction, { userName, userDescription, character, roomMemories, ...groupValues }) }]
            });
        } else if (item && item.type === 'chat') {
            // Insert messages when 'chat' type is encountered
            messagesPart.push(...messageContents);
        } else if (item && (item.type === 'lorebook' || item.type === 'authornote' || item.type === 'memory' || item.type === 'userDescription' || item.type === 'characterPrompt')) {
            const content = getPromptItemContent(item, character, currentRoom, messages, persona);
            if (content && content.trim().length > 0 && shouldIncludePromptItem(item, useStructuredOutput || false, currentRoom)) {
                const role = item.role || 'system';
                messagesPart.push({
                    role,
                    content: [{ type: 'text', text: replacePlaceholders(content, { userName, userDescription, character, roomMemories, ...groupValues }) }]
                });
            }
        }
    }

    if (isProactive && messagesPart.length === 0) {
        messagesPart.push({
            role: "user",
            content: [{
                type: 'text',
                text: "(SYSTEM: You are starting this conversation. Please begin.)"
            }]
        });
    }

    return messagesPart;
}

export function buildClaudeApiPayload(
    model: string,
    room: Room,
    persona: Persona,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    extraSystemInstruction?: string
): ClaudeApiPayload {
    const systemPrompt = buildSystemPrompt(persona, character, extraSystemInstruction, room, messages, false);
    const contents = buildClaudeContents(messages, isProactive, persona, model, character, extraSystemInstruction, room, false);

    return {
        model: model,
        messages: contents,
        system: [{
            type: "text",
            text: systemPrompt
        }],
        temperature: selectCurrentApiConfig(store.getState()).temperature || 1,
        top_k: selectCurrentApiConfig(store.getState()).topK || 40,
        top_p: selectCurrentApiConfig(store.getState()).topP || 0.95,
        max_tokens: selectCurrentApiConfig(store.getState()).maxTokens || 8192,
    };
}

// OpenAI (Chat Completions) payload builders
function buildOpenAIContents(messages: Message[], isProactive: boolean, persona?: Persona | null, character?: Character, extraSystemInstruction?: string, room?: Room, useStructuredOutput?: boolean) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const currentRoom = room || (activeRoomId ? selectRoomById(state, activeRoomId) : null);
    const { main } = selectPrompts(state);
    const { userName, userDescription, groupValues, roomMemories } = getCommonPromptData(persona, character, currentRoom);

    const items: OpenAIMessage[] = [];

    // Add messages
    const messageContents = buildMessageContents(messages, persona, currentRoom, (msg, _speaker, header, role) => {
        let text = (msg.content ? `${header}${msg.content}` : (header ? header : ''));
        if (msg.sticker) {
            text = `[사용자가 "${msg.sticker}" 스티커를 보냄]` + (text ? ` ${text}` : '');
        }

        const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
        if (text) {
            parts.push({ type: 'text', text });
        }
        if (msg.image?.dataUrl) {
            parts.push({ type: 'image_url', image_url: { url: msg.image.dataUrl } });
        }

        // Use array content when we have image or want multimodal; otherwise plain string
        const content = parts.length > 1 || (parts.length === 1 && 'image_url' in parts[0])
            ? parts
            : (parts[0]?.type === 'text' ? parts[0].text : '');

        return { role, content };
    });

    for (const item of main) {
        if (item && item.role === 'system' && item.content && item.content.trim().length > 0) {
            if (shouldIncludePromptItem(item, useStructuredOutput || false, currentRoom)) {
                items.push({
                    role: 'system',
                    content: replacePlaceholders(item.content, { userName, userDescription, character, roomMemories, ...groupValues })
                });
            }
        } else if (item && item.role !== 'system' && item.content && item.content.trim().length > 0) {
            if (shouldIncludePromptItem(item, useStructuredOutput || false, currentRoom)) {
                const role = item.role;

                if (role) {
                    items.push({
                        role,
                        content: replacePlaceholders(item.content, { userName, userDescription, character, roomMemories, ...groupValues })
                    });
                }
            }
        } else if (item && item.type === 'extraSystemInstruction' && extraSystemInstruction) {
            items.push({
                role: 'system',
                content: replacePlaceholders(extraSystemInstruction, { userName, userDescription, character, roomMemories, ...groupValues })
            });
        } else if (item && item.type === 'chat') {
            // Insert messages when 'chat' type is encountered
            items.push(...messageContents);
        } else if (item && (item.type === 'lorebook' || item.type === 'authornote' || item.type === 'memory' || item.type === 'userDescription' || item.type === 'characterPrompt')) {
            const content = getPromptItemContent(item, character, currentRoom, messages, persona);
            if (content && content.trim().length > 0 && shouldIncludePromptItem(item, useStructuredOutput || false, currentRoom)) {
                const role = item.role || 'system';
                items.push({
                    role,
                    content: replacePlaceholders(content, { userName, userDescription, character, roomMemories, ...groupValues })
                });
            }
        }
    }

    if (isProactive && items.length === 0) {
        items.push({ role: 'user', content: '(SYSTEM: You are starting this conversation. Please begin.)' });
    }
    return items;
}

export function buildOpenAIApiPayload(
    model: string,
    room: Room,
    persona: Persona,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    extraSystemInstruction?: string
): OpenAIApiPayload {
    const history = buildOpenAIContents(messages, isProactive, persona, character, extraSystemInstruction, room, useStructuredOutput);

    const payload: OpenAIApiPayload = {
        model,
        messages: history,
        temperature: model == "gpt-5" ? 1 : selectCurrentApiConfig(store.getState()).temperature || 1.25,
        top_p: model == "gpt-5" ? undefined : selectCurrentApiConfig(store.getState()).topP || 0.95,
        max_completion_tokens: selectCurrentApiConfig(store.getState()).maxTokens || 8192,
        response_format: useStructuredOutput ? { type: 'json_object' } : { type: 'text' },
    };
    return payload;
}