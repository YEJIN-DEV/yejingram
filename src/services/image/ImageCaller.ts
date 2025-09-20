import { store } from "../../app/store";
import type { Character } from "../../entities/character/types";
import { selectCurrentArtStyle, selectCurrentImageApiConfig, selectStyleAware } from "../../entities/setting/image/selectors";
import { unzipToDataUrls } from "../../utils/zip2png";
import { GEMINI_API_BASE_URL, NAI_DIFFUSION_API_BASE_URL } from "../URLs";
import { buildGeminiImagePayload, buildNovelAIImagePayload } from "./ImagePromptBuilder";

export async function callImageGeneration(imageGenerationSetting: { prompt: string; isSelfie: boolean }, char: Character) {
    const imageConfig = selectCurrentImageApiConfig(store.getState());
    const artStyle = selectCurrentArtStyle(store.getState());

    if (!artStyle) {
        throw new Error('현재 그림체가 선택되지 않았습니다.');
    }

    const positivePrompt = imageGenerationSetting.prompt + ',' + artStyle.positivePrompt;
    const negativePrompt = artStyle.negativePrompt;

    const provider = imageConfig.provider;
    const model = imageConfig.model;

    let url: string = '';
    let headers: { 'Content-Type': string; 'Authorization'?: string } = { 'Content-Type': 'application/json' };
    let payload: object = {};

    if (provider === 'novelai') {
        if (!imageConfig.apiKey) throw new Error('NovelAI API Key가 설정되지 않았습니다.');
        url = NAI_DIFFUSION_API_BASE_URL;
        headers = { ...headers, 'Authorization': `Bearer ${imageConfig.apiKey}` };
        const styleAware = selectStyleAware(store.getState());
        payload = await buildNovelAIImagePayload(positivePrompt, negativePrompt, model, imageGenerationSetting.isSelfie, char, styleAware);
    } else if (provider === 'gemini') {
        if (!imageConfig.apiKey) throw new Error('Gemini API Key가 설정되지 않았습니다.');
        url = `${GEMINI_API_BASE_URL}${model}:generateContent?key=${imageConfig.apiKey}`;
        payload = buildGeminiImagePayload(positivePrompt, imageGenerationSetting.isSelfie, char);
    } else if (provider === 'comfy') {
        const customCfg = imageConfig.custom;
        if (!customCfg?.baseUrl) {
            throw new Error('Comfy 서버 주소가 설정되지 않았습니다.');
        }
        try {
            let baseJson = customCfg.json ? JSON.parse(customCfg.json) : {};

            function replacePlaceholders(obj: any, positive: string, negative: string): any {
                if (typeof obj === 'string') {
                    return obj.replace(/\{\{positive\}\}/g, positive).replace(/\{\{negative\}\}/g, negative);
                } else if (Array.isArray(obj)) {
                    return obj.map(item => replacePlaceholders(item, positive, negative));
                } else if (obj && typeof obj === 'object') {
                    const newObj: any = {};
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            newObj[key] = replacePlaceholders(obj[key], positive, negative);
                        }
                    }
                    return newObj;
                }
                return obj;
            }

            baseJson = replacePlaceholders(baseJson, positivePrompt, negativePrompt);

            url = `${customCfg.baseUrl}/prompt`;
            payload = {
                "prompt": baseJson
            };
        } catch (e) {
            throw new Error('Comfy JSON 파싱 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    } else {
        throw new Error(`지원되지 않는 이미지 Provider: ${provider}`);
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (provider === 'gemini') {
            const data = await response.json();
            if (!response.ok) {
                console.error('Gemini Image API Error:', data);
                const errorMessage = (data as any)?.error?.message || `API 요청 실패: ${response.statusText}`;
                throw new Error(errorMessage);
            }
            return data;
        } else if (provider === 'novelai') {
            if (!response.ok) {
                const errorData = await response.json();
                console.error('NovelAI API Error:', errorData);
                const errorMessage = errorData?.message || `API 요청 실패: ${response.statusText}`;
                throw new Error(errorMessage);
            }
            const imageData = await unzipToDataUrls(await response.arrayBuffer());
            return {
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                mimeType: imageData.mimeType,
                                data: imageData.data
                            }
                        }]
                    },
                    finishReason: 'stop'
                }]
            };
        } else {
            const promptID = (await response.json())['prompt_id'];

            const customCfg = imageConfig.custom;

            let generatedImageInfo: {
                filename: string;
                subfolder: string,
                type: string
            } | null = null;
            while (true) {
                const response = await fetch(`${customCfg!.baseUrl}/history/${promptID}`, {
                    method: 'GET',
                });
                const data = (await response.json())[promptID];
                if (data) {
                    generatedImageInfo = Object.values(data['outputs']).flatMap((output: any) => output.images)[0];
                    break;
                }
                await new Promise(r => setTimeout(r, 1000))
            }
            generatedImageInfo = generatedImageInfo!;

            const imageResponse = await fetch(`${customCfg!.baseUrl}/view?filename=${encodeURIComponent(generatedImageInfo.filename)}&subfolder=${encodeURIComponent(generatedImageInfo.subfolder)}&type=${encodeURIComponent(generatedImageInfo.type)}`, {
                method: 'GET',
            });

            async function imageUrlToBase64(blob: Blob): Promise<string> {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        const base64 = result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }

            return {
                candidates: [{
                    content: {
                        parts: [{
                            inlineData: {
                                mimeType: imageResponse.headers.get('Content-Type'),
                                data: await imageUrlToBase64(await imageResponse.blob())
                            }
                        }]
                    },
                    finishReason: 'stop'
                }]
            };
        }
    } catch (error: unknown) {
        console.error('이미지 생성 API 호출 중 오류 발생:', error);
        throw error;
    }
}