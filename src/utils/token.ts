import type { ApiConfig, ApiProvider } from "../entities/setting/types";
import type { OpenAIContent } from "../services/llm/promptBuilder";
import { encoding_for_model, get_encoding, type TiktokenModel } from "tiktoken";
import type { ClaudeApiPayload, GeminiApiPayload } from "../services/llm/type";
import { Tokenizer } from "@mlc-ai/web-tokenizers";

export type Prompts =
    | {
        content: OpenAIContent[];
        payload?: undefined;
    }
    | {
        content?: undefined;
        payload?: GeminiApiPayload | ClaudeApiPayload;
    };


type CustomTokenizer = 'DeepSeek' | 'Llama2' | 'Llama3' | 'Llama4' | 'Mistral' | 'Qwen' | 'Qwen3'
async function tokenizeWebTokenizers(text: string, tokenizer: CustomTokenizer) {
    try {
        let tokenizersTokenizer = await Tokenizer.fromJSON(
            await (await fetch(`/token/${tokenizer}.json`)
            ).arrayBuffer())

        return tokenizersTokenizer.encode(text);
    } catch (error) {
        console.error('Failed to load tokenizer');
        return null;
    }
}

export async function countTokens(prompts: Prompts, provider: ApiProvider, apiConfig: ApiConfig): Promise<number> {
    switch (provider) {
        default:
        case 'openai':
            {
                return countOpenAI(true);
            }
        case 'claude':
            {
                if (!apiConfig.apiKey) {
                    return 0;
                }
                try {
                    const url = "https://api.anthropic.com/v1/messages/count_tokens";
                    const payload = {
                        'model': apiConfig.model,
                        'system': (prompts.payload as ClaudeApiPayload)?.system,
                        'messages': (prompts.payload as ClaudeApiPayload)?.messages,
                    };
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'x-api-key': apiConfig.apiKey,
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
                if (!apiConfig.apiKey) {
                    return 0;
                }
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiConfig.model}:countTokens?key=${apiConfig.apiKey}`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            generateContentRequest: {
                                model: `models/${apiConfig.model}`,
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
                if (!apiConfig.apiKey) {
                    return 0;
                }
                try {
                    const url = `https://aiplatform.googleapis.com/v1/projects/${apiConfig.projectId}/locations/${apiConfig.location}/publishers/google/models/${apiConfig.model}:countTokens`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiConfig.apiKey}`
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
                if (!apiConfig.apiKey) {
                    return 0;
                }
                try {
                    const url = "https://api.x.ai/v1/tokenize-text";
                    const claudePayload = prompts.payload as ClaudeApiPayload;
                    // Extract system message as a string, if present
                    let systemMessage = '';
                    if (claudePayload.system) {
                        if (typeof claudePayload.system === 'string') {
                            systemMessage = `System: ${claudePayload.system}<|separator|>\n`;
                        } else {
                            const textParts = claudePayload.system
                                .filter(c => c.type === 'text')
                                .map(c => (c as { type: 'text', text: string }).text)
                                .join('')
                                .trim();
                            systemMessage = `System: ${textParts}<|separator|>\n`;
                        }
                    }
                    const serialized = [
                        systemMessage,
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
                        model: apiConfig.model,
                        text: serialized
                    };
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiConfig.apiKey}`,
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
        case 'openrouter':
        case 'customOpenAI':
            {
                const serialized = [
                    ...(prompts.content as OpenAIContent[]).map(({ role, content }) => {
                        return `<|im_start|>${role}<|im_sep|>${content}<|im_end|>`;
                    }),
                    "<|im_start|>assistant",
                ].join('');
                const tokens = await tokenizeWebTokenizers(serialized, apiConfig.tokenizer! as CustomTokenizer);
                return tokens ? tokens.length : countOpenAI(false);
            }
    }

    function countOpenAI(realOpenAIModel: boolean) {
        const encoding = realOpenAIModel ? encoding_for_model(apiConfig.model as TiktokenModel) : get_encoding('o200k_base');
        const serialized = [
            ...(prompts.content as OpenAIContent[]).map(({ role, content }) => {
                return `<|im_start|>${role}<|im_sep|>${content}<|im_end|>`;
            }),
            "<|im_start|>assistant",
        ].join('');

        return encoding.encode(serialized).length;
    }
}