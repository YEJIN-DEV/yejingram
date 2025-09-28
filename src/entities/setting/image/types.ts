export type ImageApiProvider = 'gemini' | 'novelai' | 'comfy';

export interface ImageApiConfig {
    apiKey?: string;
    model?: string;
    naiConfig?: NAIConfig;
    custom?: {
        baseUrl: string;
        json: string;
        timeout: number;
    }
}

export interface ArtStyle {
    id: string;
    name: string;
    description: string;
    positivePrompt: string;
    negativePrompt: string;
}

export interface ImageGenerationSettingsState {
    config: Record<ImageApiProvider, ImageApiConfig>;
    artStyles: ArtStyle[];
    imageProvider: ImageApiProvider;
    model: string;
    selectedArtStyleId: string;
    styleAware: boolean;
}

export interface NAIConfig {
    cfgRescale: number;
    width: number;
    height: number;
    sampler: 'k_euler' | 'k_euler_ancestral' | 'k_dpmpp_2s_ancestral' | 'k_dpmpp_2m_sde' | 'k_dpmpp_2m' | 'k_dpmpp_sde';
    steps: number;
    scale: number;
    noiseSchedule: 'native' | 'karras' | 'exponential' | 'polyexponential';
    varietyPlus: boolean;
}
