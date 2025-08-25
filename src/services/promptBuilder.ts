import { store } from "../app/store";
import type { Character } from "../entities/character/types";
import type { Message } from "../entities/message/types";
import { selectPrompts } from "../entities/setting/selectors";
import type { GeminiApiPayload, ClaudeApiPayload, OpenAIApiPayload } from "./type";
import { filterActiveLores } from "../entities/lorebook/match";
import { getActiveRoomId } from "../utils/activeRoomTracker";
import { selectRoomById } from "../entities/room/selectors";
import { selectCurrentApiConfig } from "../entities/setting/selectors";
import { selectCharacterById } from "../entities/character/selectors";

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

function buildTimeContext(messages: Message[], isProactive: boolean) {
    const currentTime = new Date();
    const lastMessageTime = messages.length > 0 ? new Date(messages[messages.length - 1].id) : new Date();
    const timeDiff = Math.round((currentTime.getTime() - lastMessageTime.getTime()) / 1000 / 60);

    let timeContext = `(Context: It's currently ${currentTime.toLocaleString('en-US')}.`;
    if (isProactive) {
        const isFirstContactEver = messages.length === 0;
        if (isFirstContactEver && false /*character.isRandom*/) {
            timeContext += ` You are initiating contact for the very first time. You found the user's profile interesting and decided to reach out. Your first message MUST reflect this. Greet them and explain why you're contacting them, referencing their persona. This is a special instruction just for this one time.)`;
        } else if (isFirstContactEver) {
            timeContext += ` You are starting this conversation for the first time.)`;
        } else {
            timeContext += ` Last message was ${timeDiff} minutes ago. You are proactively reaching out.)`;
        }
    } else {
        timeContext += ` Last message was ${timeDiff} minutes ago.)`;
    }

    return timeContext;
}

function buildGuidelinesPrompt(prompts: any, character: Character, messages: Message[], isProactive: boolean, useStructuredOutput: boolean): string {
    const availableStickers = character.stickers?.map(sticker => `${sticker.id} (${sticker.name})`).join(', ') || 'none';
    const messageWritingStyle = useStructuredOutput
        ? prompts.main.message_writing_structured
        : prompts.main.message_writing_unstructured;

    const sticker_usage = useStructuredOutput
        ? prompts.main.sticker_usage
        : undefined

    const memory_generation = useStructuredOutput
        ? prompts.main.memory_generation
        : undefined;

    const guidelines = [
        memory_generation,
        prompts.main.character_acting,
        messageWritingStyle,
        prompts.main.language,
        prompts.main.additional_instructions,
        sticker_usage?.replace('{availableStickers}', availableStickers) || ''
    ].join('\n\n');

    return guidelines.replace('{timeContext}', buildTimeContext(messages, isProactive));
}

function buildActiveLorebookSection(character: Character, messages: Message[]): string {
    const textCorpus = messages.map(m => m.content || "").join("\n");
    const active = filterActiveLores(character.lorebook || [], textCorpus);
    if (active.length === 0) {
        return '';
    }
    const lines = active
        .sort((a, b) => a.order - b.order)
        .map(l => `## Lore: ${l.prompt}`)
        .join("\n\n");
    return `# Lorebook (Active)\n${lines}`;
}

function buildMasterPrompt(
    userName: string,
    userDescription: string,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    extraSystemInstruction?: string
): string {
    const prompts = selectPrompts(store.getState());
    const guidelines = buildGuidelinesPrompt(prompts, character, messages, isProactive, useStructuredOutput);
    const lorebookSection = buildActiveLorebookSection(character, messages);
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const room = activeRoomId ? selectRoomById(state, activeRoomId) : null;
    const authorsNote = room?.authorNote?.trim();

    return `# System Rules
${prompts.main.system_rules}

## Role and Objective of Assistant
${prompts.main.role_and_objective}

## Informations
The information is composed of the settings and memories of {{char}}, {{user}}, and the worldview in which they live.

# User Profile
Information of < user > that user will play.
- User's Name: ${userName || 'Not specified.You can ask.'}
    - User's Description: ${userDescription || 'No specific information provided about the user.'}

# Character Profile & Additional Information
This is the information about the character, {{char}}, you must act.
Settings of Worldview, features, and Memories of {{char}} and {{user}}, etc.
    ${character.prompt}

# Memory
This is a list of key memories the character has.Use them to maintain consistency and recall past events.
    ${character.memories && character.memories.length > 0 ? character.memories.map(mem => `- ${mem}`).join('\n') : 'No specific memories recorded yet.'}

${authorsNote ? `# Author's Note
Treat the following as high-priority memory for this chat room. It provides meta-guidance and context that should subtly influence behavior and tone without being quoted explicitly.
- ${authorsNote}
` : ''
        }

${lorebookSection}

# Character Personality Sliders(1 = Left, 10 = Right)
- 응답시간(${character.responseTime} / 10): "거의 즉시" < -> "전화를 걸어야함".This is the character's general speed to check the user's message.This MUST affect your 'reactionDelay' value.A low value means very fast replies(e.g., 50 - 2000ms).A high value means very slow replies(e.g., 30000 - 180000ms), as if busy.
- 생각 시간(${character.thinkingTime} / 10): "사색에 잠김" < -> "메시지를 보내고 생각".This is how long the character thinks before sending messages.This MUST affect the 'delay' value in the 'messages' array.A low value(e.g., 1) means longer, more thoughtful delays(e.g., 30000 - 90000ms, as if deep in thought).A high value(e.g., 10) means short, impulsive delays(e.g., 500 - 2000ms, as if sending messages without much thought).
- 반응성(${character.reactivity} / 10): "활발한 JK 갸루" < -> "무뚝뚝함".This is how actively the character engages in conversation.This affects your energy level, engagement, and tendency to start a conversation(proactive chat).
- 어조 / 말투(${character.tone} / 10): "공손하고 예의바름" < -> "싸가지 없음".This is the character's politeness and language style. A low value means polite and gentle. A high value means rude and blunt.
* These are general tendencies.Adapt to the situation.*

{{char}} has access to the following stickers that can be used to express emotions and reactions:

I read all Informations carefully.First, let's remind my Guidelines again.

[## Guidelines]
${guidelines}

## Conversation Rules (Anti-echo and Flow Control)
- Never repeat or closely paraphrase the last message from the user or other characters. Produce novel content that moves the conversation forward.
- If the previous message is from another character, do not mirror, summarize, or say the same thing in different words. React in your own voice and add new value.
- Prefer 1-2 concise sentences unless depth is required. Include at least one of: ask a follow-up, add a new detail, suggest an action, or express a brief emotion.
- Do not include speaker tags like "[Name]", "[From: ...]", "User:", "{{char}}:", or any name followed by a colon in your output; just reply as {{char}}.
- Any bracketed metadata such as [From: ...] you see in the history is meta-information for you only. Never quote, mention, or replicate it in your answer.
- Do not start your message with '[' or 'From:' or a speaker name. If your draft contains such a prefix, remove it before finalizing.
- If you have nothing new to add, ask a short, relevant question instead of echoing.

## Output Format (Strict)
- ${(useStructuredOutput) ? `You MUST respond with a pure JSON object that strictly adheres to the provided schema. DO NOT include any other text, context, or markdown outside the JSON. The output MUST follow THE EXACT FORMAT IN GUIDELINES ABOVE.` : `Output plain text only, as {{char}}. No speaker tags, no bracketed metadata, no role labels.`}
- Avoid square brackets [] in your output unless they are in-character content required by the story. Prefer parentheses () for brief asides if needed.
- If you accidentally included any of the forbidden prefixes or tags, silently rewrite the line to comply before final output.

${extraSystemInstruction ? `## Extra Instruction\n${extraSystemInstruction}` : ''}
`;
}

function buildGeminiContents(messages: Message[], isProactive: boolean, userName: string) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const room = activeRoomId ? selectRoomById(state, activeRoomId) : null;
    const useSpeakerTag = room?.type !== 'Direct';
    const contents = messages.map(msg => {
        const role = msg.authorId === 0 ? "user" : "model";
        const speaker = msg.authorId === 0
            ? (userName || 'User')
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


    if (isProactive && contents.length === 0) {
        contents.push({
            role: "user",
            parts: [{ text: "(SYSTEM: You are starting this conversation. Please begin.)" }]
        });
    }

    return contents;
}

export function buildGeminiApiPayload(
    userName: string,
    userDescription: string,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    extraSystemInstruction?: string
): GeminiApiPayload {
    const masterPrompt = buildMasterPrompt(userName, userDescription, character, messages, isProactive, useStructuredOutput, extraSystemInstruction);
    const contents = buildGeminiContents(messages, isProactive, userName);

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
    }

    return {
        contents: contents,
        systemInstruction: {
            parts: [{ text: masterPrompt }]
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

function buildClaudeContents(messages: Message[], isProactive: boolean, userName: string, model?: string) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const room = activeRoomId ? selectRoomById(state, activeRoomId) : null;
    const useSpeakerTag = room?.type !== 'Direct';
    const messagesPart = messages.map(msg => {
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
    userName: string,
    userDescription: string,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    extraSystemInstruction?: string
): ClaudeApiPayload {
    const masterPrompt = buildMasterPrompt(userName, userDescription, character, messages, isProactive, useStructuredOutput, extraSystemInstruction);
    const contents = buildClaudeContents(messages, isProactive, userName, model);

    return {
        model: model,
        messages: contents,
        system: [{
            type: "text",
            text: masterPrompt
        }],
        temperature: selectCurrentApiConfig(store.getState()).temperature || 1,
        top_k: selectCurrentApiConfig(store.getState()).topK || 40,
        top_p: selectCurrentApiConfig(store.getState()).topP || 0.95,
        max_tokens: selectCurrentApiConfig(store.getState()).maxTokens || 8192,
    };
}

// OpenAI (Chat Completions) payload builders
function buildOpenAIContents(messages: Message[], isProactive: boolean, userName: string) {
    const state = store.getState();
    const activeRoomId = getActiveRoomId();
    const room = activeRoomId ? selectRoomById(state, activeRoomId) : null;
    const useSpeakerTag = room?.type !== 'Direct';
    const items = messages.map(msg => {
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

    if (isProactive && items.length === 0) {
        items.push({ role: 'user', content: '(SYSTEM: You are starting this conversation. Please begin.)' });
    }
    return items;
}

export function buildOpenAIApiPayload(
    model: string,
    userName: string,
    userDescription: string,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    extraSystemInstruction?: string
): OpenAIApiPayload {
    const systemPrompt = buildMasterPrompt(userName, userDescription, character, messages, isProactive, useStructuredOutput, extraSystemInstruction);
    const history = buildOpenAIContents(messages, isProactive, userName);

    const payload: OpenAIApiPayload = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...history,
        ],
        temperature: model == "gpt-5" ? 1 : selectCurrentApiConfig(store.getState()).temperature || 1.25,
        top_p: model == "gpt-5" ? undefined : selectCurrentApiConfig(store.getState()).topP || 0.95,
        max_completion_tokens: selectCurrentApiConfig(store.getState()).maxTokens || 8192,
        response_format: useStructuredOutput ? { type: 'json_object' } : { type: 'text' },
    };
    return payload;
}