import type { ProviderModel } from "../components/settings/ProviderSettings";
import type { ApiProvider } from "../entities/setting/types";
import type { OpenAIContent } from "../services/promptBuilder";
import { encoding_for_model, type TiktokenModel } from "tiktoken";
import type { ClaudeApiPayload, GeminiApiPayload } from "../services/type";

export type Prompts =
    | {
        content: OpenAIContent[];
        payload?: undefined;
    }
    | {
        content?: undefined;
        payload?: GeminiApiPayload | ClaudeApiPayload;
    };


export async function CountTokens(prompts: Prompts, provider: ApiProvider, model: ProviderModel, auth?: { apiKey?: string; location?: string; projectId?: string }): Promise<number> {
    switch (provider) {
        case 'openai':
            {
                const encoding = encoding_for_model((model ?? "gpt-5") as TiktokenModel);
                const serialized = [
                    ...(prompts.content as OpenAIContent[]).map(({ role, content }) => {
                        return `<|im_start|>${role}<|im_sep|>${content}<|im_end|>`;
                    }),
                    "<|im_start|>assistant",
                ].join('');

                return encoding.encode(serialized).length;
            }
        case 'claude':
            {
                if (!auth?.apiKey) {
                    return 0;
                }
                try {
                    const url = "https://api.anthropic.com/v1/messages/count_tokens";
                    const payload = {
                        'model': model,
                        'system': (prompts.payload as ClaudeApiPayload)?.system,
                        'messages': (prompts.payload as ClaudeApiPayload)?.messages,
                    };
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'x-api-key': auth.apiKey,
                            'content-type': 'application/json',
                            'anthropic-version': '2023-06-01',
                            'anthropic-dangerous-direct-browser-access': 'true'
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.statusText}`);
                    }
                    const data = await response.json();
                    return data.input_tokens || 0;
                } catch (error) {
                    console.error('Error counting Claude tokens:', error);
                    return 0;
                }
            }
        case 'gemini':
            {
                if (!auth?.apiKey) {
                    return 0;
                }
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:countTokens?key=${auth.apiKey}`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            generateContentRequest: {
                                model: `models/${model}`,
                                ...prompts.payload
                            }
                        })
                    });
                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.statusText}`);
                    }
                    const data = await response.json();
                    return data.totalTokens || 0;
                } catch (error) {
                    console.error('Error counting Gemini tokens:', error);
                    return 0;
                }
            }
        case 'vertexai':
            {
                if (!auth?.apiKey) {
                    return 0;
                }
                try {
                    const url = `https://aiplatform.googleapis.com/v1/projects/${auth?.projectId}/locations/${auth?.location}/publishers/google/models/${model}:countTokens`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${auth?.apiKey}`
                        },
                        body: JSON.stringify({
                            system_instruction: (prompts.payload as GeminiApiPayload)?.systemInstruction,
                            contents: (prompts.payload as GeminiApiPayload)?.contents
                        })
                    });
                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.statusText}`);
                    }
                    const data = await response.json();
                    return data.totalTokens || 0;
                } catch (error) {
                    console.error('Error counting Gemini tokens:', error);
                    return 0;
                }
            }
        case 'grok':
            {
                if (!auth?.apiKey) {
                    return 0;
                }
                try {
                    const url = "https://api.x.ai/v1/tokenize-text";
                    const claudePayload = prompts.payload as ClaudeApiPayload;
                    const serialized = [
                        claudePayload.system ? `System: ${typeof claudePayload.system === 'string' ? claudePayload.system : claudePayload.system.filter(c => c.type === 'text').map(c => (c as { type: 'text', text: string }).text).join('').trim()}<|separator|>\n` : '',
                        ...claudePayload.messages.map(({ role, content }) => {
                            let rolePrefix = '';
                            switch (role) {
                                case 'user':
                                    rolePrefix = 'Human: ';
                                    break;
                                case 'assistant':
                                    rolePrefix = 'Assistant: ';
                                    break;
                            }
                            const textContent = typeof content === 'string' ? content : content.filter(c => c.type === 'text').map(c => (c as { type: 'text', text: string }).text).join('');
                            return `${rolePrefix}${textContent.trim()}<|separator|>\n`;
                        }),
                        "Assistant:",
                    ].join('');
                    const payload = {
                        'model': model,
                        'text': serialized
                    };
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${auth.apiKey}`,
                            'content-type': 'application/json',
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.statusText}`);
                    }
                    const data = await response.json();
                    return data.token_ids.length || 0;
                } catch (error) {
                    console.error('Error counting Grok tokens:', error);
                    return 0;
                }
            }
        default:
            return 0;
    }
}