import { store } from "../app/store";
import { selectCharacterById } from "../entities/character/selectors";
import type { Message } from "../entities/message/types";
import type { Room } from "../entities/room/types";
import { selectAllSettings, selectCurrentApiConfig, selectPrompts } from "../entities/setting/selectors";
import { buildTimeContext } from "./prompt";
import { messagesActions } from "../entities/message/slice";
import type { ChatResponse } from "./type";
import { selectMessagesByRoomId } from "../entities/message/selectors";
import type { Character } from "../entities/character/types";

export async function SendMessage(room: Room, setTypingCharacterId: (id: number | null) => void) {
    const memberChars = room.memberIds.map(id => selectCharacterById(store.getState(), id));

    for (const char of memberChars) {
        if (char) {
            await LLMSend(room, char, setTypingCharacterId);
        }
    }
}

export async function LLMSend(room: Room, char: Character, setTypingCharacterId: (id: number | null) => void) {
    const dispatch = store.dispatch;
    const api = selectCurrentApiConfig(store.getState());
    const settings = selectAllSettings(store.getState());
    
    try {
        const res = await callGeminiAPI(api.apiKey, api.model, settings.userName, settings.userDescription, char, selectMessagesByRoomId(store.getState(), room.id), false, false, null);

        if (res && res.messages && Array.isArray(res.messages) && res.messages.length > 0) {
            await sleep(res.reactionDelay || 1000);
            setTypingCharacterId(char.id);
            
            for (const messagePart of res.messages) {
                await sleep(messagePart.delay || 1000);

                const message: Message = {
                    id: crypto.randomUUID(),
                    roomId: room.id,
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
                
                dispatch(messagesActions.upsertOne(message));
            }
        } else if (res && res.error) {
            dispatch(messagesActions.upsertOne({
                id: crypto.randomUUID(),
                roomId: room.id,
                authorId: char.id,
                content: `Error: ${res.error}`,
                createdAt: new Date().toISOString(),
                type: 'TEXT',
            }));
        }
    } catch (error) {
        console.error("Error in LLMSend:", error);
        dispatch(messagesActions.upsertOne({
            id: crypto.randomUUID(),
            roomId: room.id,
            authorId: char.id,
            content: "An unexpected error occurred.",
            createdAt: new Date().toISOString(),
            type: 'TEXT',
        }));
    } finally {
        setTypingCharacterId(null);
    }
}

export async function callGeminiAPI(apiKey: string, model: string, userName: string, userDescription: string, character: Character, messages: Message[], isProactive = false, forceSummary = false, customSystemPrompt = null): Promise<ChatResponse | null> {
    let contents = [];
    for (const msg of messages) {
        const role = msg.authorId == 0 ? "user" : "model";
        let parts = [];

        // if (msg.authorId == 0 && msg.type === 'IMAGE' && msg.imageId) {
        //     const imageData = character?.media?.find(m => m.id === msg.imageId);
        //     if (imageData) {
        //         let textContent = msg.content || "(User sent an image with no caption)";
        //         parts.push({ text: textContent });
        //         parts.push({
        //             inlineData: {
        //                 mimeType: imageData.mimeType || 'image/jpeg',
        //                 data: imageData.dataUrl.split(',')[1]
        //             }
        //         });
        //     } else {
        //         parts.push({ text: msg.content || "(User sent an image that is no longer available)" });
        //     }
        // } else if (msg.authorId == 0 && msg.type === 'STICKER' && msg.stickerData) {
        //     // 페르소나 스티커: 스티커 이름만 AI에게 전송 (파일 데이터는 전송하지 않음)
        //     const stickerName = msg.stickerData.stickerName || 'Unknown Sticker';
        //     let stickerText = `[사용자가 "${stickerName}" 스티커를 보냄]`;
        //     if (msg.content && msg.content.trim()) {
        //         stickerText += ` ${msg.content}`;
        //     }
        //     parts.push({ text: stickerText });
        // } else if (msg.content) {
        //     parts.push({ text: msg.content });
        // }

        parts.push({ text: msg.content || "(No content provided)" });

        if (parts.length > 0) {
            contents.push({ role, parts });
        }
    }

    if (isProactive && contents.length === 0) {
        contents.push({
            role: "user",
            parts: [{ text: "(SYSTEM: You are starting this conversation. Please begin.)" }]
        });
    }
    const prompts = selectPrompts(store.getState())

    // // 스티커 정보 준비
    // const availableStickers = character.stickers?.map(sticker => `${sticker.id} (${sticker.name})`).join(', ') || 'none';

    const guidelines = [
        prompts.main.memory_generation,
        prompts.main.character_acting,
        prompts.main.message_writing,
        prompts.main.language,
        prompts.main.additional_instructions,
        // prompts.main.sticker_usage?.replace('{availableStickers}', availableStickers) || ''
    ].join('\n\n');

    const masterPrompt = `
# System Rules
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
${guidelines.replace(/{character.name}/g, character.name).replace('{timeContext}', buildTimeContext(messages, isProactive))}
`;

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: masterPrompt }]
        },
        generationConfig: {
            temperature: 1.25,
            topK: 40,
            topP: 0.95,
            responseMimeType: "application/json",
            responseSchema: {
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
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
            throw new Error(`답변이 생성되지 않았습니다. (이유: ${reason})`);
        }

    } catch (error: any) {
        console.error("Gemini API 호출 중 오류 발생:", error);
        return { error: `응답 처리 중 오류가 발생했습니다: ${error.message}` };
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
