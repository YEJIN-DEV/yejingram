import type { ApiConfig, ApiProvider } from "../entities/setting/types";
import type { OpenAIContent } from "../services/llm/promptBuilder";
import type { TiktokenEncoding, TiktokenModel } from "tiktoken";
import type { ClaudeApiPayload, GeminiApiPayload } from "../services/llm/type";

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
const customTokenizers: CustomTokenizer[] = ['DeepSeek', 'Llama2', 'Llama3', 'Llama4', 'Mistral', 'Qwen', 'Qwen3'];

async function tokenizeWebTokenizers(text: string, tokenizer: CustomTokenizer) {
    try {
        const { Tokenizer } = await loadWebTokenizers();
        let tokenizersTokenizer = await Tokenizer.fromJSON(
            await (await fetch(`/token/${tokenizer}.json`)
            ).arrayBuffer())

        return tokenizersTokenizer.encode(text);
    } catch (error) {
        console.error('Failed to load tokenizer');
        return null;
    }
}

// ---------- Tokenizer lazy loader ----------
let tiktokenModulePromise: Promise<typeof import("tiktoken")> | null = null;
let webTokenizersModulePromise: Promise<typeof import("@mlc-ai/web-tokenizers")> | null = null;
async function loadTiktoken() {
    if (!tiktokenModulePromise) {
        tiktokenModulePromise = import("tiktoken");
    }
    return tiktokenModulePromise;
}

async function loadWebTokenizers() {
    if (!webTokenizersModulePromise) {
        webTokenizersModulePromise = import("@mlc-ai/web-tokenizers");
    }
    return webTokenizersModulePromise;
}

export async function countTokens(prompts: Prompts, provider: ApiProvider, apiConfig: ApiConfig): Promise<number> {
    if (apiConfig.tokenizer) {
        switch (apiConfig.tokenizer) {
            case 'o200k_base':
            case 'cl100k_base':
                return await countTokensOpenRouterOrCustom(prompts, apiConfig);
            default:
                return await countTokensOpenRouterOrCustom(prompts, apiConfig);
        }
    }
    else {
        switch (provider) {
            default:
            case 'openai':
                return await countTokensOpenAI(prompts, apiConfig);
            case 'claude':
                return await countTokensClaude(prompts, apiConfig);
            case 'gemini':
                return await countTokensGemini(prompts, apiConfig);
            case 'vertexai':
                return await countTokensVertexAI(prompts, apiConfig);
            case 'grok':
                return await countTokensGrok(prompts, apiConfig);
            case 'deepseek':
                return await countTokensDeepSeek(prompts);
            case 'openrouter':
            case 'custom':
                return await countTokensOpenRouterOrCustom(prompts, apiConfig);
        }
    }
}

// ---------- Helper utilities ----------
function serializeOpenAIContent(content: OpenAIContent[]): string {
    return [
        ...content.map(({ role, content }) => `<|im_start|>${role}<|im_sep|>${content}<|im_end|>`),
        "<|im_start|>assistant",
    ].join('');
}

function serializeClaudeContent(content: ClaudeApiPayload): string {
    const segments: string[] = [];

    const systemText = (content.system ?? [])
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('')
        .trim();

    if (systemText) {
        segments.push(`System: ${systemText}<|separator|>`);
    }

    for (const message of content.messages) {
        const textContent = message.content
            .map(part => {
                if ('source' in part) return `[image:${part.source.media_type}]`;
                if ('text' in part) return part.text;
                return '';
            })
            .join('')
            .trim();

        segments.push(`${message.role}: ${textContent}<|separator|>`);
    }

    segments.push("Assistant: ");
    return segments.join('');
}

function serializeGeminiContent(content: GeminiApiPayload): string {
    const segments: string[] = [];

    const systemText = content.systemInstruction?.parts
        ?.map(part => part.text)
        .join('')
        .trim();

    if (systemText) {
        segments.push(`System: ${systemText}<|separator|>`);
    }

    for (const { role, parts } of content.contents) {
        const textContent = parts
            .map(part => {
                if ('text' in part) return part.text;
                if ('inline_data' in part) return `[inline_data:${part.inline_data.mime_type}]`;
                if ('file_data' in part) return `[file:${part.file_data.file_uri}]`;
                return '';
            })
            .join('')
            .trim();

        segments.push(`${role}: ${textContent}<|separator|>`);
    }

    segments.push("Assistant: ");
    return segments.join('');
}

async function encodeWithOpenAIModel(serialized: string, model: string): Promise<number> {
    const { encoding_for_model } = await loadTiktoken();
    const encoding = encoding_for_model(model as TiktokenModel);
    const length = encoding.encode(serialized).length;
    return length;
}

async function encodeWithBaseModel(serialized: string, algorithm: TiktokenEncoding = 'o200k_base'): Promise<number> {
    const { get_encoding } = await loadTiktoken();
    const encoding = get_encoding(algorithm);
    const length = encoding.encode(serialized).length;
    return length;
}

// ---------- Per-provider counters ----------
async function countTokensOpenAI(prompts: Prompts, apiConfig: ApiConfig): Promise<number> {
    const serialized = serializeOpenAIContent(prompts.content as OpenAIContent[]);
    return await encodeWithOpenAIModel(serialized, apiConfig.model);
}

async function countTokensClaude(prompts: Prompts, apiConfig: ApiConfig): Promise<number> {
    if (!apiConfig.apiKey) return 0;
    try {
        const url = "https://api.anthropic.com/v1/messages/count_tokens";
        const payload = {
            model: apiConfig.model,
            system: (prompts.payload as ClaudeApiPayload)?.system,
            messages: (prompts.payload as ClaudeApiPayload)?.messages,
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
        if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
        const data = await response.json();
        return data.input_tokens || 0;
    } catch (error) {
        console.error('Error counting Claude tokens:', error);
        return 0;
    }
}

async function countTokensGemini(prompts: Prompts, apiConfig: ApiConfig): Promise<number> {
    if (!apiConfig.apiKey) return 0;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiConfig.model}:countTokens?key=${apiConfig.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                generateContentRequest: {
                    model: `models/${apiConfig.model}`,
                    ...(prompts.payload as GeminiApiPayload)
                }
            })
        });
        if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
        const data = await response.json();
        return data.totalTokens || 0;
    } catch (error) {
        console.error('Error counting Gemini tokens:', error);
        return 0;
    }
}

async function countTokensVertexAI(prompts: Prompts, apiConfig: ApiConfig): Promise<number> {
    if (!apiConfig.apiKey) return 0;
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
        if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
        const data = await response.json();
        return data.totalTokens || 0;
    } catch (error) {
        console.error('Error counting Gemini tokens:', error);
        return 0;
    }
}

async function countTokensGrok(prompts: Prompts, apiConfig: ApiConfig): Promise<number> {
    if (!apiConfig.apiKey) return 0;
    try {
        const url = "https://api.x.ai/v1/tokenize-text";
        const claudePayload = prompts.payload as ClaudeApiPayload;
        let systemMessage = '';
        if (claudePayload?.system) {
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
                const textContent = typeof content === 'string'
                    ? content
                    : content.filter(c => c.type === 'text').map(c => (c as { type: 'text', text: string }).text).join('');
                return `${rolePrefix}${textContent.trim()}<|separator|>\n`;
            }),
            "Assistant:",
        ].join('');
        const payload = { model: apiConfig.model, text: serialized };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiConfig.apiKey}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);
        const data = await response.json();
        return data.token_ids.length || 0;
    } catch (error) {
        console.error('Error counting Grok tokens:', error);
        return 0;
    }
}

async function countTokensDeepSeek(prompts: Prompts): Promise<number> {
    const serialized = serializeOpenAIContent(prompts.content as OpenAIContent[]);
    const tokens = await tokenizeWebTokenizers(serialized, 'DeepSeek');
    return tokens ? tokens.length : 0;
}

async function countTokensOpenRouterOrCustom(prompts: Prompts, apiConfig: ApiConfig): Promise<number> {
    let serialized = '';
    switch (apiConfig?.payloadTemplate) { // PayloadTemplate only exists for 'custom' provider
        case 'anthropic':
            serialized = serializeClaudeContent((prompts.payload as ClaudeApiPayload) || []);
            break;
        case 'gemini':
            serialized = serializeGeminiContent((prompts.payload as GeminiApiPayload) || []);
            break;
        case 'openai':
        default: // When OpenRouter
            serialized = serializeOpenAIContent(prompts.content as OpenAIContent[]);
    }

    if (apiConfig.tokenizer) {
        if (customTokenizers.includes(apiConfig.tokenizer as CustomTokenizer)) {
            const tokens = await tokenizeWebTokenizers(serialized, apiConfig.tokenizer as CustomTokenizer);
            if (tokens) return tokens.length;
        } else {
            return await encodeWithBaseModel(serialized, 'o200k_base');
        }
    }

    return 0;
}