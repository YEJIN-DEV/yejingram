import { store } from "../app/store";
import type { Character } from "../entities/character/types";
import type { Message } from "../entities/message/types";
import { selectPrompts } from "../entities/setting/selectors";
import type { GeminiApiPayload } from "./type";

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

    const guidelines = [
        prompts.main.memory_generation,
        prompts.main.character_acting,
        messageWritingStyle,
        prompts.main.language,
        prompts.main.additional_instructions,
        prompts.main.sticker_usage?.replace('{availableStickers}', availableStickers) || ''
    ].join('\n\n');

    return guidelines.replace(/{character.name}/g, character.name).replace('{timeContext}', buildTimeContext(messages, isProactive));
}

function buildMasterPrompt(
    userName: string,
    userDescription: string,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean
): string {
    const prompts = selectPrompts(store.getState());
    const guidelines = buildGuidelinesPrompt(prompts, character, messages, isProactive, useStructuredOutput);

    return `# System Rules
${prompts.main.system_rules}

## Role and Objective of Assistant
${prompts.main.role_and_objective.replace(/{character.name}/g, character.name)}

## Informations
The information is composed of the settings and memories of ${character.name}, <user>, and the worldview in which they live.

# User Profile
Information of <user> that user will play.
- User's Name: ${userName || 'Not specified. You can ask.'}
- User's Description: ${userDescription || 'No specific information provided about the user.'}

# Character Profile & Additional Information
This is the information about the character, ${character.name}, you must act.
Settings of Worldview, features, and Memories of ${character.name} and <user>, etc.
${character.prompt}

# Memory
This is a list of key memories the character has. Use them to maintain consistency and recall past events.
${character.memories && character.memories.length > 0 ? character.memories.map(mem => `- ${mem}`).join('\n') : 'No specific memories recorded yet.'}

# Character Personality Sliders (1=Left, 10=Right)
- 응답시간 (${character.responseTime}/10): "거의 즉시" <-> "전화를 걸어야함". This is the character's general speed to check the user's message. This MUST affect your 'reactionDelay' value. A low value means very fast replies (e.g., 50-2000ms). A high value means very slow replies (e.g., 30000-180000ms), as if busy.
- 생각 시간 (${character.thinkingTime}/10): "사색에 잠김" <-> "메시지를 보내고 생각". This is how long the character thinks before sending messages. This MUST affect the 'delay' value in the 'messages' array. A low value (e.g., 1) means longer, more thoughtful delays (e.g., 30000-90000ms, as if deep in thought). A high value (e.g., 10) means short, impulsive delays (e.g., 500-2000ms, as if sending messages without much thought).
- 반응성 (${character.reactivity}/10): "활발한 JK 갸루" <-> "무뚝뚝함". This is how actively the character engages in conversation. This affects your energy level, engagement, and tendency to start a conversation (proactive chat).
- 어조/말투 (${character.tone}/10): "공손하고 예의바름" <-> "싸가지 없음". This is the character's politeness and language style. A low value means polite and gentle. A high value means rude and blunt.
*These are general tendencies. Adapt to the situation.*

${character.name} has access to the following stickers that can be used to express emotions and reactions:

I read all Informations carefully. First, let's remind my Guidelines again.

[## Guidelines]
${guidelines}
`;
}

function buildContents(messages: Message[], isProactive: boolean, image?: string, sticker?: string) {
    const contents = messages.map(msg => {
        const role = msg.authorId === 0 ? "user" : "model";
        const parts: ({ text: string; } | { inline_data: { mime_type: string; data: string; }; })[] = [{ text: msg.content || "(No content provided)" }];
        return { role, parts };
    });

    if (image || sticker) {
        const lastUserMessage = contents.slice().reverse().find(c => c.role === 'user');
        if (lastUserMessage) {
            if (image) {
                const mimeType = image.match(/data:(.*);base64,/)?.[1];
                const base64Data = image.split(',')[1];
                if (mimeType && base64Data) {
                    lastUserMessage.parts.push({
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    });
                }
            }
            if (sticker) {
                if ('text' in lastUserMessage.parts[0]) {
                    const lastText = lastUserMessage.parts[0].text;
                    if (lastText == "(No content provided)") {
                        lastUserMessage.parts[0].text = `[사용자가 "${sticker}" 스티커를 보냄]`;
                    } else {
                        lastUserMessage.parts[0].text = `[사용자가 "${sticker}" 스티커를 보냄] ` + lastText;
                    }
                }
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
    userName: string,
    userDescription: string,
    character: Character,
    messages: Message[],
    isProactive: boolean,
    useStructuredOutput: boolean,
    image?: string,
    sticker?: string
): GeminiApiPayload {
    const masterPrompt = buildMasterPrompt(userName, userDescription, character, messages, isProactive, useStructuredOutput);
    const contents = buildContents(messages, isProactive, image, sticker);

    const generationConfig: any = {
        temperature: 1.25,
        topK: 40,
        topP: 0.95,
    };

    if (useStructuredOutput) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = {
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
        };
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
