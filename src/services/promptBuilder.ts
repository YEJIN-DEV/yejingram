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
    parts: ({ text: string; } | { inline_data: { mime_type: string; data: string; }; } | { file_data: { file_uri: string; }; })[];
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

    // Add messages
    const messageContents = buildMessageContents(messages, persona, currentRoom, (msg, _speaker, header, role) => {
        const baseText = msg.content ? `${header}${msg.content}` : (header ? header : '');
        const parts: ({ text: string; } | { inline_data: { mime_type: string; data: string; }; } | { file_data: { file_uri: string; }; })[] = [{ text: baseText }];
        if (msg.file) {
            const mimeType = msg.file.mimeType;
            const dataUrl = msg.file.dataUrl;
            const base64Data = dataUrl.split(',')[1];
            if (mimeType && base64Data) {
                parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                });
            }
        }
        // Check for YouTube links in content
        const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+)/g;
        const matches = msg.content?.match(youtubeRegex);
        if (matches) {
            matches.forEach(url => {
                parts.push({
                    file_data: {
                        file_uri: url
                    }
                });
            });
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
        if (msg.file && model !== "grok-3") {
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

export function buildClaudeApiPayload(
    model: string,
    room: Room,
    persona: Persona,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    extraSystemInstruction?: string
): ClaudeApiPayload {
    const systemPrompt = buildSystemPrompt(persona, character, extraSystemInstruction, room, messages, useStructuredOutput);
    const contents = buildClaudeContents(messages, isProactive, persona, model, character, extraSystemInstruction, room, useStructuredOutput);

    return {
        model: model,
        messages: contents,
        system: [{
            type: "text",
            text: systemPrompt
        }],
        temperature: selectCurrentApiConfig(store.getState()).temperature || 1,
        top_k: selectCurrentApiConfig(store.getState()).topK || 40,
        ...(model.startsWith("claude-opus-4-1") ? {} : { top_p: selectCurrentApiConfig(store.getState()).topP || 0.95 }),
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

export function buildGeminiImagePayload(prompt: string, isSelfie: boolean, char: Character) {
    return {
        contents: [{
            parts: [
                { "text": `${prompt}${isSelfie && char.avatar ? `IMPORTANT: PROVIDED PICTURE IS THE TOP PRIORITY. 1) IF THE APPEARANCE OF PROMPT IS NOT MATCHING WITH THE PICTURE, IGNORE ALL OF THE PROMPT RELATED TO ${char.name}'S APPEARANCE FEATURES. 2) FOLLOW THE STYLE OF PROVIDED PICTURE STRICTLY.` : ''}` },
                ...(isSelfie && char.avatar ? [{ "inline_data": { "mime_type": char.avatar.split(',')[0].split(':')[1].split(';')[0], "data": char.avatar.split(',')[1] } }] : []),
            ]
        }],
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
    };
    
}

export function buildNovelAIImagePayload(prompt: string, model: string) {
    function random(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return {
        "input": prompt,
        "model": model,
        "action": "generate",
        "parameters": {
            "params_version": 3,
            "add_original_image": true,
            "cfg_rescale": 0,
            "controlnet_strength": 1,
            "dynamic_thresholding": false,
            "n_samples": 1,
            "width": 512,
            "height": 768,
            "sampler": "k_dpmpp_sde",
            "steps": 28,
            "scale": 5,
            "negative_prompt": "",
            "noise_schedule": "native",
            "normalize_reference_strength_multiple": true,
            "ucPreset": 3,
            "uncond_scale": 1,
            "qualityToggle": false,
            "legacy_v3_extend": false,
            "legacy": false,
            "autoSmea": false,
            "use_coords": false,
            "legacy_uc": false,
            "v4_prompt":{
                "caption":{
                    "base_caption": prompt,
                    "char_captions": []
                },
                "use_coords": false,
                "use_order": true
            },
            "v4_negative_prompt":{
                "caption":{
                    "base_caption": "",
                    "char_captions": []
                },
                "legacy_uc": false
            },
            "reference_image_multiple" : [],
            "reference_strength_multiple" : [],
            //add reference image
            // "image": undefined, 
            // "strength": undefined,
            // "noise": undefined,
            "seed": random(0, 2**32-1),
            "extra_noise_seed": random(0, 2**32-1),
            "prefer_brownian": true,
            "deliberate_euler_ancestral_bug": false,
            "skip_cfg_above_sigma": null
        }
    }
}

export function buildComfyUIPayload(prompt: string, workflowJson: string, artStylePrompt?: string) {
    // Clean the workflow JSON string from any potential control characters
    let cleanedWorkflowJson = workflowJson
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\r?\n/g, '') // Remove line breaks
        .trim();
    
    console.log('Original workflow JSON length:', workflowJson.length);
    console.log('Cleaned workflow JSON length:', cleanedWorkflowJson.length);
    
    // Parse the workflow JSON template
    let workflow;
    try {
        workflow = JSON.parse(cleanedWorkflowJson);
    } catch (error) {
        console.error('Failed to parse workflow JSON:', error);
        console.error('Workflow JSON around error position:', cleanedWorkflowJson.substring(Math.max(0, 2014-50), 2014+50));
        
        // Fallback to a basic working workflow
        console.log('Using fallback workflow...');
        workflow = {
            "3": {
                "inputs": {
                    "seed": Math.floor(Math.random() * 1000000000),
                    "steps": 20,
                    "cfg": 8,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "v1-5-pruned-emaonly.ckpt"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": 512,
                    "height": 512,
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": "beautiful scenery",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "text, watermark",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        };
    }

    // Find text nodes and inject the prompt
    // ComfyUI workflows typically have CLIPTextEncode nodes for positive/negative prompts
    let promptInjected = false;
    for (const nodeId in workflow) {
        const node = workflow[nodeId];
        if (node.class_type === 'CLIPTextEncode' || node.class_type === 'CLIPTextEncodeSDXL') {
            // Look for positive prompt nodes (usually have "positive" in inputs or connected to sampler's positive)
            if (node.inputs && typeof node.inputs.text === 'string') {
                // If this looks like a positive prompt node (not containing negative terms)
                const currentText = node.inputs.text.toLowerCase();
                if (!currentText.includes('negative') && !currentText.includes('bad') && !currentText.includes('worst') && !currentText.includes('watermark') && !promptInjected) {
                    // 프롬프트 조합: 그림체 프롬프트 + 변환된 프롬프트 + 기존 텍스트
                    const existingText = node.inputs.text;
                    const parts = [];
                    
                    // 1. 기존 텍스트 (품질 태그 등)
                    if (existingText) {
                        parts.push(existingText);
                    }
                    
                    // 2. 변환된 프롬프트 (대화 내용 기반)
                    if (prompt) {
                        parts.push(prompt);
                    }
                    
                    // 3. 그림체 프롬프트 (선택된 그림체)
                    if (artStylePrompt) {
                        parts.push(artStylePrompt);
                    }
                    
                    node.inputs.text = parts.join(', ');
                    promptInjected = true;
                    console.log(`프롬프트 삽입됨 (노드 ${nodeId}):`, node.inputs.text);
                    console.log('그림체 프롬프트:', artStylePrompt || '없음');
                }
            }
        }
    }
    
    if (!promptInjected) {
        console.warn('프롬프트를 삽입할 CLIPTextEncode 노드를 찾을 수 없습니다');
    }

    // Generate a random seed for reproducible but varied results
    const randomSeed = Math.floor(Math.random() * 2**32);
    
    // Find KSampler nodes and set random seed
    for (const nodeId in workflow) {
        const node = workflow[nodeId];
        if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
            if (node.inputs && typeof node.inputs.seed === 'number') {
                node.inputs.seed = randomSeed;
            }
        }
    }

    return {
        prompt: workflow,
        client_id: Math.random().toString(36).substring(2, 15)
    };
}

// 한글 대화 내용을 단부루 스타일 영어 태그로 변환하는 함수
export async function convertKoreanToImageTags(koreanText: string, characterName?: string): Promise<string> {
    try {
        // Gemini API를 사용해서 한글을 영어 이미지 태그로 변환
        const apiConfig = selectCurrentApiConfig(store.getState());
        if (!apiConfig.apiKey) {
            // API 키가 없으면 기본 변환 로직 사용
            return convertKoreanToImageTagsBasic(koreanText, characterName);
        }

        // 다양한 스타일과 구도를 위한 랜덤 요소 추가
        const styles = ['anime style', 'manga style', 'light novel illustration', 'visual novel art', 'cel shading'];
        const angles = ['close-up', 'medium shot', 'full body', 'upper body', 'from above', 'from below', 'from side'];
        const moods = ['cheerful', 'gentle', 'dramatic', 'soft lighting', 'warm lighting', 'cool lighting'];
        
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        const randomAngle = angles[Math.floor(Math.random() * angles.length)];
        const randomMood = moods[Math.floor(Math.random() * moods.length)];

        const prompt = `Convert the following Korean conversation to structured Danbooru-style image tags using the lightboard-ComfyUI format.

STRICT FORMAT REQUIRED:
[Char1] label (girl/boy), basic_pose, facial_expression, hair_tags, body_tags, specific_pose, clothing_tags, action_tags
[Scene] overall_composition, interaction_summary, mood_tags
[Place] environment, background, lighting
[Angle] viewpoint, framing, shot_type

RULES:
- Use ONLY common Danbooru tags (no names, no abstract concepts)
- Follow exact tag order: Label → Basic Pose → Facial → Hair → Body → Specific Pose → Clothing → Action
- Be objective and specific (e.g., "white shirt, black skirt" not "casual clothes")
- Invent missing visual details as needed
- Focus on the frozen moment being captured

Korean text: "${koreanText}"
Character name: ${characterName || "girl"} (use as generic label like 'girl', 'boy')
Style suggestion: ${randomStyle}
Angle suggestion: ${randomAngle}
Mood suggestion: ${randomMood}

Generate structured tags in the exact format above:`;

        const response = await fetch(`${GEMINI_API_BASE_URL}gemini-1.5-flash:generateContent?key=${apiConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.9,  // 높은 창의성을 위해 증가
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 200
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            const generatedTags = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (generatedTags) {
                console.log('AI 생성 이미지 태그:', generatedTags);
                return generatedTags.trim();
            }
        }
    } catch (error) {
        console.warn('AI 태그 변환 실패, 기본 로직 사용:', error);
    }

    // AI 변환 실패시 기본 로직 사용
    return convertKoreanToImageTagsBasic(koreanText, characterName);
}

// 기본 규칙 기반 한글->영어 태그 변환 (맥락 분석 강화)
function convertKoreanToImageTagsBasic(koreanText: string, characterName?: string): string {
    const text = koreanText.toLowerCase();
    console.log('분석할 원본 텍스트:', koreanText);
    
    // 상황별 시나리오 분석
    let scenario = analyzeScenario(text);
    console.log('감지된 시나리오:', scenario);
    
    // 캐릭터 태그 구성
    let charTags: string[] = [];
    let sceneTags: string[] = [];
    let placeTags: string[] = [];
    let angleTags: string[] = [];

    // [Char1] 태그 생성
    charTags.push('1girl');
    
    // 시나리오별 태그 생성
    switch (scenario.type) {
        case 'bedtime':
            charTags.push('lying down', 'sleepy, tired', 'long hair', 'brown hair', 'medium breasts', 'holding phone', 'pajamas, nightwear', 'looking at phone');
            sceneTags.push('1girl, solo', 'late night, sleepy atmosphere');
            placeTags.push('bedroom, indoors', 'dim lighting, night');
            angleTags.push('medium shot', 'from above');
            break;
            
        case 'phone_conversation':
            charTags.push('sitting', 'smiling, happy', 'medium hair', 'black hair', 'medium breasts', 'holding phone', 'casual clothes', 'talking on phone');
            sceneTags.push('1girl, solo', 'phone conversation, cheerful');
            placeTags.push('indoors, room', 'soft lighting');
            angleTags.push('upper body', 'from front');
            break;
            
        case 'video_call':
            charTags.push('sitting', 'gentle expression', 'long hair', 'blonde hair', 'medium breasts', 'hand gesture', 'casual top', 'looking at camera');
            sceneTags.push('1girl, solo', 'video call setup');
            placeTags.push('indoors, room', 'screen lighting');
            angleTags.push('close-up', 'from front');
            break;
            
        case 'eating':
            charTags.push('sitting', 'happy, enjoying', 'short hair', 'brown hair', 'medium breasts', 'holding utensils', 'casual dress', 'eating');
            sceneTags.push('1girl, solo', 'mealtime, happy');
            placeTags.push('dining room, kitchen', 'natural lighting');
            angleTags.push('medium shot', 'from side');
            break;
            
        case 'study_work':
            charTags.push('sitting', 'focused, concentrated', 'medium hair', 'black hair', 'medium breasts', 'hand on chin', 'shirt, casual', 'reading, writing');
            sceneTags.push('1girl, solo', 'studying, focused');
            placeTags.push('desk, room', 'desk lamp lighting');
            angleTags.push('upper body', 'from side');
            break;
            
        case 'exercise':
            charTags.push('standing', 'energetic, determined', 'ponytail', 'brown hair', 'athletic build', 'stretching pose', 'sports wear, gym clothes', 'exercising');
            sceneTags.push('1girl, solo', 'exercise, active');
            placeTags.push('gym, outdoors', 'bright lighting');
            angleTags.push('full body', 'from front');
            break;
            
        default: // 'casual_chat'
            charTags.push('sitting', 'gentle expression', 'medium hair', 'brown hair', 'medium breasts', 'relaxed pose', 'casual dress', 'looking at viewer');
            sceneTags.push('1girl, solo', 'casual, relaxed');
            placeTags.push('indoors, room', 'soft lighting');
            angleTags.push('medium shot', 'from front');
    }

    // 추가 키워드 기반 보정
    applyKeywordCorrections(text, charTags, sceneTags, placeTags, angleTags);

    // 라이트보드 구조로 결합
    const result = `[Char1] ${charTags.join(', ')}, [Scene] ${sceneTags.join(', ')}, [Place] ${placeTags.join(', ')}, [Angle] ${angleTags.join(', ')}`;
    
    console.log('맥락 분석 기반 태그 변환 결과:', result);
    return result;
}

// 텍스트 시나리오 분석 함수
function analyzeScenario(text: string): { type: string, confidence: number } {
    const scenarios = [
        {
            type: 'bedtime',
            keywords: ['자겠다', '잘래', '졸려', '4시', '새벽', '피곤', '잠', '자기 전'],
            weight: 1.0
        },
        {
            type: 'video_call', 
            keywords: ['영상통화', '화상통화', '얼굴 보고', '카메라', '영상', '화면'],
            weight: 1.0
        },
        {
            type: 'phone_conversation',
            keywords: ['전화', '통화', '폰', '핸드폰', '전화해', '받아'],
            weight: 0.8
        },
        {
            type: 'eating',
            keywords: ['먹', '밥', '음식', '식사', '배고', '맛있', '요리'],
            weight: 0.9
        },
        {
            type: 'study_work', 
            keywords: ['공부', '과제', '일', '업무', '공부해', '열심히', '집중'],
            weight: 0.8
        },
        {
            type: 'exercise',
            keywords: ['운동', '헬스', '달리기', '요가', '스트레칭', '땀'],
            weight: 0.7
        }
    ];

    let bestMatch = { type: 'casual_chat', confidence: 0 };

    for (const scenario of scenarios) {
        let score = 0;
        for (const keyword of scenario.keywords) {
            if (text.includes(keyword)) {
                score += scenario.weight;
            }
        }
        
        if (score > bestMatch.confidence) {
            bestMatch = { type: scenario.type, confidence: score };
        }
    }

    return bestMatch;
}

// 추가 키워드 기반 보정
function applyKeywordCorrections(text: string, charTags: string[], sceneTags: string[], placeTags: string[], angleTags: string[]) {
    // 시간대 보정
    if (text.includes('새벽') || text.includes('4시') || text.includes('밤')) {
        const placeIndex = placeTags.findIndex(tag => tag.includes('lighting'));
        if (placeIndex !== -1) {
            placeTags[placeIndex] = 'dim lighting, night';
        }
    }

    // 감정 보정
    if (text.includes('ㅋㅋ') || text.includes('ㅎㅎ')) {
        const faceIndex = charTags.findIndex(tag => tag.includes('expression') || tag.includes('smile'));
        if (faceIndex !== -1) {
            charTags[faceIndex] = 'smile, cheerful';
        }
    }

    // 사진/이미지 관련
    if (text.includes('사진') || text.includes('이미지') || text.includes('pic')) {
        if (!charTags.some(tag => tag.includes('phone'))) {
            charTags.push('holding phone');
        }
    }
}