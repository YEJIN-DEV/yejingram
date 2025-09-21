import { store } from "../../app/store";
import type { Character } from "../../entities/character/types";
import type { Message } from "../../entities/message/types";
import { selectPrompts } from "../../entities/setting/selectors";
import type { GeminiApiPayload, ClaudeApiPayload, OpenAIApiPayload, GeminiStructuredSchema as GeminiStructuredSchema, GeminiGenerationConfig, OpenAIStructuredSchema as OpenAIStructuredSchema } from "./type";
import { getActiveRoomId } from "../../utils/activeRoomTracker";
import { selectRoomById } from "../../entities/room/selectors";
import { selectCharacterById } from "../../entities/character/selectors";
import type { Persona } from "../../entities/setting/types";
import { replacePlaceholders } from "../../utils/placeholder";
import type { PlaceholderValues } from "../../utils/placeholder";
import type { Room } from "../../entities/room/types";
import type { PromptItem } from "../../entities/setting/types";
import type { Lore } from "../../entities/lorebook/types";
import { CountTokens } from "../../utils/token";

export type GeminiContent = {
    role: string;
    parts: ({ text: string; } | { inline_data: { mime_type: string; data: string; }; } | { file_data: { file_uri: string; }; })[];
};

export type ClaudeContent = {
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

export type OpenAIContent = {
    role: 'system' | 'user' | 'assistant' | string;
    content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
};

const GeminiStructuredOutputSchema: GeminiStructuredSchema = {
    type: 'OBJECT',
    properties: {
        reactionDelay: { type: 'INTEGER' },
        messages: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    delay: { type: 'INTEGER' },
                    content: { type: 'STRING' },
                    sticker: { type: 'STRING' },
                },
                required: ['delay'],
            },
        },
        newMemory: { type: 'STRING' },
    },
    required: ['reactionDelay', 'messages'],
};

const OpenAIStructuredOutputSchema: OpenAIStructuredSchema = {
    type: 'json_schema',
    json_schema: {
        name: 'chat_response',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                reactionDelay: { type: 'integer' },
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            delay: { type: 'integer' },
                            content: { type: 'string' },
                            sticker: { type: ['string', 'null'] }
                        },
                        required: ['delay', 'content', 'sticker'],
                        additionalProperties: false
                    }
                },
                newMemory: { type: ['string', 'null'] }
            },
            required: ['reactionDelay', 'messages', 'newMemory'],
            additionalProperties: false
        }
    }
};

function shouldIncludePromptItem(item: PromptItem, useStructuredOutput: boolean, room?: Room | null): boolean {
    if (item.type === 'plain-structured' && !useStructuredOutput) {
        return false;
    } else if (item.type === 'plain-unstructured' && useStructuredOutput) {
        return false;
    } else if (item.type === 'plain-group' && room?.type !== 'Group') {
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

export function getActivatedLoresForGroup(room: Room | null | undefined, messages: Message[]): { lore: Lore; characterName: string; characterId: number }[] {
    const allLores: { lore: Lore; characterName: string; characterId: number }[] = [];

    // Add room lorebook if exists
    if (room?.lorebook) {
        const activatedRoomLores = getActivatedLores(room.lorebook, messages);
        activatedRoomLores.forEach(lore => allLores.push({ lore, characterName: 'Room', characterId: -1 }));
    }

    // Add member character lorebooks
    room?.memberIds.forEach(id => {
        const char = selectCharacterById(store.getState(), id);
        if (char && char.lorebook) {
            const activated = getActivatedLores(char.lorebook, messages);
            activated.forEach(lore => allLores.push({ lore, characterName: char.name, characterId: id }));
        }
    });
    return allLores.sort((a, b) => a.lore.order - b.lore.order);
}

function getPromptItemContent(item: PromptItem, character: Character | undefined, room: Room | null | undefined, messages: Message[], persona?: Persona | null): string | null {
    if (item.type === 'lorebook') {
        if (room && room.type !== 'Direct' && room.memberIds) {
            const activatedLores = getActivatedLoresForGroup(room, messages);
            return activatedLores.map(item => `[${item.characterName}'s Lore: ${item.lore.name}]\n${item.lore.prompt}`).join('\n\n') || null;
        } else {
            const activatedLores = getActivatedLores(character?.lorebook || [], messages);
            return activatedLores.map(lore => lore.prompt).join('\n\n') || null;
        }
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

    // Add messages with lookahead merge for next user TEXT message
    const buildGeminiMessageContentsWithMerge = (
        msgs: Message[],
        personaLocal: Persona | null | undefined,
        roomLocal: Room | null | undefined
    ): GeminiContent[] => {
        const result: GeminiContent[] = [];
        const useSpeakerTag = roomLocal?.type !== 'Direct';

        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            const role = msg.authorId === 0 ? 'user' : 'assistant';
            const speaker = msg.authorId === 0
                ? (personaLocal?.name || 'User')
                : (selectCharacterById(store.getState(), msg.authorId)?.name || `Char#${msg.authorId}`);
            const header = useSpeakerTag ? `[From: ${speaker}] ` : '';

            const baseText = msg.content ? `${header}${msg.content}` : (header ? header : '');
            const parts: ({ text: string } | { inline_data: { mime_type: string; data: string } } | { file_data: { file_uri: string } })[] = [{ text: baseText }];

            if (msg.file) {
                const mimeType = msg.file.mimeType;
                const dataUrl = msg.file.dataUrl;
                const base64Data = dataUrl.split(',')[1];
                if (mimeType && base64Data) {
                    parts.push({
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data,
                        },
                    });
                }
            }

            // Check for YouTube links in content
            const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+)/g;
            const matches = msg.content?.match(youtubeRegex);
            if (matches) {
                matches.forEach((url) => {
                    parts.push({
                        file_data: {
                            file_uri: url,
                        },
                    });
                });
            }

            if (msg.sticker) {
                parts.push({ text: `${header}[Sent a sticker: "${(msg as any).sticker?.name || (msg as any).sticker}"]` });
            }

            // Lookahead: if next message is from user(authorId=0) and TEXT, merge its content and skip it
            const next = msgs[i + 1];
            if (next && next.authorId === 0 && next.type === 'TEXT') {
                if (next.content) {
                    parts[0] = { text: next.content };
                }
                i++; // Skip the next message by advancing the loop index one extra time
            }

            result.push({ role: role === 'assistant' ? 'model' : 'user', parts });
        }
        return result;
    };

    const messageContents = buildGeminiMessageContentsWithMerge(messages, persona, currentRoom);

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

export async function buildGeminiApiPayload(
    provider: 'gemini' | 'vertexai',
    room: Room,
    persona: Persona,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    useImageResponse: boolean | undefined,
    model: string,
    auth: {
        apiKey: string;
        location?: string;
        projectId?: string;
    },
    extraSystemInstruction?: string
): Promise<GeminiApiPayload> {
    const maxTokens = selectPrompts(store.getState()).maxContextTokens;
    let trimmedMessages = [...messages];

    while (true) {
        const systemPrompt = buildSystemPrompt(persona, character, extraSystemInstruction, room, trimmedMessages, useStructuredOutput);
        const contents = buildGeminiContents(trimmedMessages, isProactive, persona, character, room, useStructuredOutput);

        const generationConfig: GeminiGenerationConfig = {
            temperature: selectPrompts(store.getState()).temperature,
            topP: selectPrompts(store.getState()).topP,
        };

        const topK = selectPrompts(store.getState()).topK;

        if (topK) {
            generationConfig.topK = topK;
        }

        if (useStructuredOutput) {
            generationConfig.responseMimeType = "application/json";
            generationConfig.responseSchema = structuredClone(GeminiStructuredOutputSchema);
            if (useImageResponse) {
                const schema = generationConfig.responseSchema!;
                const items = schema.properties!.messages.items!;
                if (items.properties) {
                    items.properties.imageGenerationSetting = {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING" },
                            isSelfie: { type: "BOOLEAN" }
                        },
                        required: ["prompt", "isSelfie"]
                    };
                }
            }
        }

        const payload: GeminiApiPayload = {
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

        const tokenCount = await CountTokens({ payload }, provider, model, auth);
        console.debug("Total tokens after trimming:", tokenCount);

        if (tokenCount <= maxTokens) {
            return payload;
        } else if (trimmedMessages.length <= 1) {
            throw new Error("Cannot trim messages further to meet token limit.");
        } else {
            trimmedMessages.shift(); // Remove the oldest message
        }
    }
}

function buildClaudeContents(messages: Message[], isProactive: boolean, persona?: Persona, model?: string, character?: Character, extraSystemInstruction?: string, room?: Room, useStructuredOutput?: boolean) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const currentRoom = room || (activeRoomId ? selectRoomById(state, activeRoomId) : null);
    const { main } = selectPrompts(state);
    const { userName, userDescription, groupValues, roomMemories } = getCommonPromptData(persona, character, currentRoom);

    const messagesPart: ClaudeContent[] = [];

    // Add messages
    const messageContents = buildMessageContents(messages, persona, currentRoom, (msg, _speaker, header, role) => {
        const content: ({ type: string; text: string; } |
        { type: 'image'; source: { data: string; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; type: 'base64'; }; })[] = [{ type: 'text', text: msg.content ? `${header}${msg.content}` : (header ? header : '') }];
        if (msg.file && model !== "grok-3") {
            if (model?.startsWith("claude") && role === 'assistant') {
                content.push({ type: 'text', text: `${header}[Sent an image]` });
            } else {
                const mimeType = msg.file.mimeType;
                if (mimeType.startsWith('image')) {
                    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/gif' && mimeType !== 'image/webp') {
                        throw new Error(`Unsupported image type: ${mimeType} `);
                    }
                    const base64Data = msg.file.dataUrl.split(',')[1];
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
            }
        }
        if (msg.sticker) {
            content.push({ type: 'text', text: `${header}[Sent a sticker: "${(msg as any).sticker?.name || (msg as any).sticker}"]` });
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
                role: 'assistant',
                content: [{ type: 'text', text: replacePlaceholders(extraSystemInstruction, { userName, userDescription, character, roomMemories, ...groupValues }) }]
            });
        } else if (item && item.type === 'chat') {
            // Insert messages when 'chat' type is encountered
            messagesPart.push(...messageContents);
        } else if (item && (item.type === 'lorebook' || item.type === 'authornote' || item.type === 'memory' || item.type === 'userDescription' || item.type === 'characterPrompt')) {
            const content = getPromptItemContent(item, character, currentRoom, messages, persona);
            if (content && content.trim().length > 0 && shouldIncludePromptItem(item, useStructuredOutput || false, currentRoom)) {
                const role = item.role === 'system' ? 'assistant' : item.role || 'assistant';
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

export async function buildClaudeApiPayload(
    provider: 'claude' | 'grok',
    room: Room,
    persona: Persona,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    model: string,
    apiKey: string,
    extraSystemInstruction?: string
): Promise<ClaudeApiPayload> {
    const maxTokens = selectPrompts(store.getState()).maxContextTokens;
    let trimmedMessages = [...messages];

    while (true) {
        const systemPrompt = buildSystemPrompt(persona, character, extraSystemInstruction, room, trimmedMessages, useStructuredOutput);
        const contents = buildClaudeContents(trimmedMessages, isProactive, persona, model, character, extraSystemInstruction, room, useStructuredOutput);

        const payload: ClaudeApiPayload = {
            model: model,
            messages: contents,
            system: [{
                type: "text",
                text: systemPrompt
            }],
            temperature: selectPrompts(store.getState()).temperature > 1 ? 1 : selectPrompts(store.getState()).temperature,
            top_k: selectPrompts(store.getState()).topK,
            ...(model.startsWith("claude-opus-4-1") ? {} : { top_p: selectPrompts(store.getState()).topP }),
            max_tokens: selectPrompts(store.getState()).maxResponseTokens,
        };

        const tokenCount = await CountTokens({ payload }, provider, model, { apiKey });
        console.debug("Total tokens after trimming:", tokenCount);

        if (tokenCount <= maxTokens) {
            return payload;
        } else if (trimmedMessages.length <= 1) {
            throw new Error("Cannot trim messages further to meet token limit.");
        } else {
            trimmedMessages.shift(); // Remove the oldest message
        }
    }
}

// OpenAI (Chat Completions) payload builders
async function buildOpenAIContents(messages: Message[], isProactive: boolean, model: string, persona?: Persona | null, character?: Character, extraSystemInstruction?: string, room?: Room, useStructuredOutput?: boolean) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const currentRoom = room || (activeRoomId ? selectRoomById(state, activeRoomId) : null);
    const { main } = selectPrompts(state);
    const { userName, userDescription, groupValues, roomMemories } = getCommonPromptData(persona, character, currentRoom);

    const items: OpenAIContent[] = [];

    // Add messages
    const messageContents = buildMessageContents(messages, persona, currentRoom, (msg, _speaker, header, role) => {
        let text = (msg.content ? `${header}${msg.content}` : (header ? header : ''));
        if (msg.sticker) {
            text = `[User sent a sticker "${msg.sticker}"]` + (text ? ` ${text}` : '');
        }

        const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
        if (text) {
            parts.push({ type: 'text', text });
        }
        if (msg.file?.dataUrl) {
            if (msg.file.mimeType.startsWith('image')) {
                parts.push({ type: 'image_url', image_url: { url: msg.file.dataUrl } });
            }
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

    console.debug("Total tokens", await CountTokens({ content: items }, 'openai', model));
    return items;
}

export async function buildOpenAIApiPayload(
    room: Room,
    persona: Persona,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    useImageResponse: boolean | undefined,
    model: string,
    extraSystemInstruction?: string
): Promise<OpenAIApiPayload> {
    const maxTokens = selectPrompts(store.getState()).maxContextTokens;
    let trimmedMessages = [...messages];

    while (true) {
        const history = await buildOpenAIContents(trimmedMessages, isProactive, model, persona, character, extraSystemInstruction, room, useStructuredOutput);
        const JSONSchema = structuredClone(OpenAIStructuredOutputSchema);

        if (useImageResponse) {
            const items = JSONSchema.json_schema.schema?.properties?.messages?.items;
            if (items?.properties && items?.required) {
                items.properties.imageGenerationSetting = {
                    type: ['object', 'null'],
                    properties: {
                        prompt: { type: 'string' },
                        isSelfie: { type: 'boolean' }
                    },
                    required: ['prompt', 'isSelfie'],
                    additionalProperties: false
                };
                items.required.push('imageGenerationSetting');
            }
        }

        const response_format: OpenAIApiPayload['response_format'] = useStructuredOutput
            ? JSONSchema
            : { type: 'text' };

        const payload: OpenAIApiPayload = {
            model,
            messages: history,
            temperature: model == 'gpt-5' ? 1 : selectPrompts(store.getState()).temperature,
            top_p: model == 'gpt-5' ? undefined : selectPrompts(store.getState()).topP,
            max_completion_tokens: selectPrompts(store.getState()).maxResponseTokens,
            response_format,
        };

        const tokenCount = await CountTokens({ content: history }, 'openai', model);
        console.debug("Total tokens after trimming:", tokenCount);

        if (tokenCount <= maxTokens) {
            return payload;
        } else if (trimmedMessages.length <= 1) {
            throw new Error("Cannot trim messages further to meet token limit.");
        } else {
            trimmedMessages.shift(); // Remove the oldest message
        }
    }
}