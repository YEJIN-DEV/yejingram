export type ImageApiProvider = 'gemini' | 'novelai' | 'comfy';

export interface ImageApiConfig {
    apiKey?: string;
    model?: string;
    custom?: {
        baseUrl: string;
        json: string;
    }
}

export interface ArtStyle {
    id: string;
    name: string;
    description?: string;
    prompt?: string;
    negativePrompt?: string;
}

export interface ImageGenerationSettingsState {
    config: Record<ImageApiProvider, ImageApiConfig>;
    artStyles: ArtStyle[];
    imageProvider: ImageApiProvider;
    model: string;
    selectedArtStyleId: string;
}
