import type { Character } from "../../entities/character/types";
import type { NAIConfig } from "../../entities/setting/image/types";
import { loadImage } from "../../utils/imageStego";

export function buildGeminiImagePayload(positivePrompt: string, isIncludingChar: boolean, char: Character) {
    return {
        contents: [{
            parts: [
                { "text": `${positivePrompt}${isIncludingChar && char.avatar ? `IMPORTANT: PROVIDED PICTURE IS THE TOP PRIORITY. 1) IF THE APPEARANCE OF PROMPT IS NOT MATCHING WITH THE PICTURE, IGNORE ALL OF THE PROMPT RELATED TO ${char.name}'S APPEARANCE FEATURES. 2) FOLLOW THE STYLE OF PROVIDED PICTURE STRICTLY.` : ''}` },
                ...(isIncludingChar && char.avatar ? [{ "inline_data": { "mime_type": char.avatar.split(',')[0].split(':')[1].split(';')[0], "data": char.avatar.split(',')[1] } }] : []),
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

export async function buildNovelAIImagePayload(positivePrompt: string, negativePrompt: string, model: string, isIncludingChar: boolean, char: Character, styleAware: boolean, naiConfig: NAIConfig | undefined) {
    function random(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    let skipCfgAboveSigma = null;
    if (naiConfig?.varietyPlus) {
        if (model === 'nai-diffusion-4-5-full' || model === 'nai-diffusion-4-5-curated') {
            skipCfgAboveSigma = Math.sqrt(naiConfig?.width || 512 * naiConfig?.height || 768) * 0.05766;
        } else {
            skipCfgAboveSigma = Math.sqrt(naiConfig?.width || 512 * naiConfig?.height || 768) * 0.01889;
        }
    }

    let payload: any = {
        "input": positivePrompt,
        "model": model,
        "action": "generate",
        "parameters": {
            "params_version": 3,
            "add_original_image": true,
            "cfg_rescale": naiConfig?.cfgRescale || 0,
            "controlnet_strength": 1,
            "dynamic_thresholding": false,
            "n_samples": 1,
            "width": naiConfig?.width || 512,
            "height": naiConfig?.height || 768,
            "sampler": naiConfig?.sampler || "k_dpmpp_2m_sde",
            "steps": naiConfig?.steps || 28,
            "scale": naiConfig?.scale || 5,
            "negative_prompt": "",
            "noise_schedule": naiConfig?.noiseSchedule || "native",
            "normalize_reference_strength_multiple": true,
            "ucPreset": 3,
            "uncond_scale": 1,
            "qualityToggle": false,
            "legacy_v3_extend": false,
            "legacy": false,
            "autoSmea": false,
            "use_coords": false,
            "legacy_uc": false,
            "v4_prompt": {
                "caption": {
                    "base_caption": positivePrompt,
                    "char_captions": []
                },
                "use_coords": false,
                "use_order": true
            },
            "v4_negative_prompt": {
                "caption": {
                    "base_caption": negativePrompt,
                    "char_captions": []
                },
                "legacy_uc": false
            },
            "reference_image_multiple": [],
            "reference_strength_multiple": [],
            "seed": random(0, 2 ** 32 - 1),
            "extra_noise_seed": random(0, 2 ** 32 - 1),
            "prefer_brownian": true,
            "deliberate_euler_ancestral_bug": false,
            "skip_cfg_above_sigma": skipCfgAboveSigma,
        }
    }
    if (isIncludingChar && char.avatar) {
        const resized = await resizeToNAI(char.avatar, "#ffffff");
        payload.parameters['director_reference_descriptions'] = [
            {
                caption: {
                    base_caption: `character${styleAware ? '&style' : ''}`,
                    char_captions: []
                },
                legacy_uc: false
            }
        ];
        payload.parameters['director_reference_images'] = [resized.split(',')[1]];
        payload.parameters['director_reference_information_extracted'] = [1];
        payload.parameters['director_reference_strength_values'] = [1];
    }

    return payload;
}


type FitResult = {
    targetW: number;
    targetH: number;
    drawW: number;
    drawH: number;
    offsetX: number;
    offsetY: number;
};

function chooseBestFit(srcW: number, srcH: number): FitResult {
    const targets = [
        { targetW: 1024, targetH: 1536 },
        { targetW: 1536, targetH: 1024 },
        { targetW: 1472, targetH: 1472 },
    ];

    let best:
        | (FitResult & { paddingArea: number })
        | null = null;

    for (const { targetW, targetH } of targets) {
        const scale = Math.min(targetW / srcW, targetH / srcH);
        const drawW = Math.round(srcW * scale);
        const drawH = Math.round(srcH * scale);
        const offsetX = Math.round((targetW - drawW) / 2);
        const offsetY = Math.round((targetH - drawH) / 2);
        const paddingArea = targetW * targetH - drawW * drawH;

        if (!best || paddingArea < best.paddingArea) {
            best = { targetW, targetH, drawW, drawH, offsetX, offsetY, paddingArea };
        }
    }
    const { paddingArea, ...result } = best!;
    return result;
}

export async function resizeToNAI(
    imageURL: string,
    background: string
): Promise<string> {
    const img = await loadImage(imageURL);

    const fit = chooseBestFit(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const canvas = document.createElement("canvas");
    canvas.width = fit.targetW;
    canvas.height = fit.targetH;

    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    // 이미지 그리기
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
        img,
        fit.offsetX,
        fit.offsetY,
        fit.drawW,
        fit.drawH
    );

    return canvas.toDataURL('image/png');
}
