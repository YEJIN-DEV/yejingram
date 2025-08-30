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
    }
    return true;
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

function buildSystemPrompt(persona?: Persona | null, character?: Character, extraSystemInstruction?: string, room?: Room, useStructuredOutput?: boolean): string {
    // Keep only prompts whose role is 'system', in main array sequence.
    const { main } = selectPrompts(store.getState());
    const lines: string[] = [];
    const userName = persona?.name || 'Not specified.You can ask.';
    const userDescription = persona?.description || 'No specific information provided about the user.';
    let groupValues: Partial<PlaceholderValues> = {};
    if (room && room.type === 'Group' && character) {
        const groupDesc = buildGroupDescription(character, room);
        groupValues.participantDetails = groupDesc.participantDetails;
        groupValues.participantCount = groupDesc.participantCount;
    }
    const roomMemories = room?.memories?.join('\n') || '';
    for (const item of main) {
        if (item && item.role === 'system' && typeof item.content === 'string' && item.content.trim().length > 0) {
            if (shouldIncludePromptItem(item, useStructuredOutput || false, room)) {
                lines.push(replacePlaceholders(item.content, { userName, userDescription, character, roomMemories, ...groupValues }));
            }
        } else if (item && item.type === 'extraSystemInstruction' && extraSystemInstruction) {
            lines.push(replacePlaceholders(extraSystemInstruction, { userName, userDescription, character, roomMemories, ...groupValues }));
        }
    }
    return lines.join('\n\n');
}

function buildGeminiContents(messages: Message[], isProactive: boolean, persona: Persona, character: Character, room: Room, useStructuredOutput?: boolean) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const currentRoom = room || (activeRoomId ? selectRoomById(state, activeRoomId) : null);
    const useSpeakerTag = currentRoom?.type !== 'Direct';
    const { main } = selectPrompts(state);
    const userName = persona?.name || 'User';
    const userDescription = persona?.description || 'No specific information provided about the user.';
    let groupValues: Partial<PlaceholderValues> = {};
    if (currentRoom && currentRoom.type === 'Group' && character) {
        const groupDesc = buildGroupDescription(character, currentRoom);
        groupValues.participantDetails = groupDesc.participantDetails;
        groupValues.participantCount = groupDesc.participantCount;
    }
    const roomMemories = currentRoom?.memories?.join('\n') || '';

    const contents: GeminiContent[] = [];

    // Add messages
    const messageContents = messages.map(msg => {
        const role = msg.authorId === 0 ? "user" : "model";
        const speaker = msg.authorId === 0
            ? (persona?.name || 'User')
            : (selectCharacterById(state, msg.authorId)?.name || `Char#${msg.authorId}`);

        const header = useSpeakerTag ? `[From: ${speaker}] ` : '';
        const baseText = msg.content ? `${header}${msg.content}` : (useSpeakerTag ? header : '');

        const parts: ({ text: string; } |
        { inline_data: { mime_type: string; data: string; }; })[] = [{ text: msg.content }];

        // Replace first text part with speaker-tagged text
        if (parts.length > 0 && 'text' in parts[0]) {
            (parts[0] as any).text = baseText;
        }

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
            parts.push({ text: `${useSpeakerTag ? header : ''}[스티커 전송: "${(msg as any).sticker?.name || (msg as any).sticker}"]` });
        }
        return { role, parts };
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
    const systemPrompt = buildSystemPrompt(persona, character, extraSystemInstruction, room, useStructuredOutput);
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
    const useSpeakerTag = currentRoom?.type !== 'Direct';
    const { main } = selectPrompts(state);
    const userName = persona?.name || 'User';
    const userDescription = persona?.description || 'No specific information provided about the user.';
    let groupValues: Partial<PlaceholderValues> = {};
    if (currentRoom && currentRoom.type === 'Group' && character) {
        const groupDesc = buildGroupDescription(character, currentRoom);
        groupValues.participantDetails = groupDesc.participantDetails;
        groupValues.participantCount = groupDesc.participantCount;
    }
    const roomMemories = currentRoom?.memories?.join('\n') || '';

    const messagesPart: ClaudeMessage[] = [];

    // Add messages
    const messageContents = messages.map(msg => {
        const role = msg.authorId === 0 ? "user" : "assistant";
        const speaker = msg.authorId === 0
            ? (userName || 'User')
            : (selectCharacterById(state, msg.authorId)?.name || `Char#${msg.authorId}`);
        const header = useSpeakerTag ? `[From: ${speaker}] ` : '';
        const content: ({ type: string; text: string; } |
        { type: 'image'; source: { data: string; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; type: 'base64'; }; })[]
            = [{ type: 'text', text: msg.content ? `${header}${msg.content}` : (useSpeakerTag ? header : '') }];

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
            content.push({ type: 'text', text: `${useSpeakerTag ? header : ''}[스티커 전송: "${(msg as any).sticker?.name || (msg as any).sticker}"]` });
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
    const systemPrompt = buildSystemPrompt(persona, character, extraSystemInstruction, room, false);
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
    const useSpeakerTag = currentRoom?.type !== 'Direct';
    const { main } = selectPrompts(state);
    const userName = persona?.name || 'User';
    const userDescription = persona?.description || 'No specific information provided about the user.';
    let groupValues: Partial<PlaceholderValues> = {};
    if (currentRoom && currentRoom.type === 'Group' && character) {
        const groupDesc = buildGroupDescription(character, currentRoom);
        groupValues.participantDetails = groupDesc.participantDetails;
        groupValues.participantCount = groupDesc.participantCount;
    }
    const roomMemories = currentRoom?.memories?.join('\n') || '';

    const items: OpenAIMessage[] = [];

    // Add messages
    const messageContents = messages.map(msg => {
        const role = msg.authorId === 0 ? 'user' : 'assistant';

        const speaker = msg.authorId === 0
            ? (userName || 'User')
            : (selectCharacterById(state, msg.authorId)?.name || `Char#${msg.authorId}`);
        const header = useSpeakerTag ? `[From: ${speaker}] ` : '';

        let text = (msg.content ? `${header}${msg.content}` : (useSpeakerTag ? header : ''));
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