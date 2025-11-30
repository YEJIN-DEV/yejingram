import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ImageApiConfig, ImageApiProvider, ImageGenerationSettingsState, ArtStyle } from './types';
import { nanoid } from '@reduxjs/toolkit';

export const initialImageApiConfigs: Record<ImageApiProvider, ImageApiConfig> = {
    gemini: {
        apiKey: '',
        model: 'gemini-3-pro-image-preview'
    },
    novelai: {
        apiKey: '',
        model: 'nai-diffusion-4-5-full',
        naiConfig: {
            cfgRescale: 0,
            width: 512,
            height: 768,
            sampler: 'k_dpmpp_2m_sde',
            steps: 28,
            scale: 5,
            noiseSchedule: 'native',
            varietyPlus: false,
        }
    },
    comfy: {
        custom: {
            baseUrl: '',
            json: '',
            timeout: 60
        }
    }
};

export const initialState: ImageGenerationSettingsState = {
    config: initialImageApiConfigs,
    artStyles: [
        { id: '0', name: 'Anime', description: 'Anime style art generation', positivePrompt: 'masterpiece, best quality, 1girl, solo, dynamic angle, intricate details, sharp focus, vibrant colors', negativePrompt: 'lowres, bad anatomy, error body, error arm, error hand, error fingers, error legs, error feet, error face, deformed, blurry, fuzzy' },
    ],
    imageProvider: 'gemini',
    model: 'gemini-2.5-flash-image-preview',
    selectedArtStyleId: '0',
    styleAware: true,
};

export const imageSettingsAdapter = createEntityAdapter<ImageGenerationSettingsState, string>({
    selectId: () => 'imageSettings', // There will only be one image settings object
});

const imageSettingsSlice = createSlice({
    name: 'imageSettings',
    initialState,
    reducers: {
        setImageSettings: (_state, action: PayloadAction<ImageGenerationSettingsState>) => {
            return action.payload;
        },
        setImageApiConfig: (state, action: PayloadAction<{ provider: ImageApiProvider; config: Partial<ImageApiConfig> }>) => {
            const { provider, config } = action.payload;
            if (!state.config[provider]) {
                state.config[provider] = { ...initialImageApiConfigs[provider] };
            }
            state.config[provider] = { ...state.config[provider], ...config };
        },
        addArtStyle: (state, action: PayloadAction<Omit<ArtStyle, 'id'>>) => {
            const newArtStyle: ArtStyle = {
                ...action.payload,
                id: nanoid(),
            };
            state.artStyles.push(newArtStyle);
            // If it's the only art style now, auto-select it
            if (state.artStyles.length === 1) {
                state.selectedArtStyleId = newArtStyle.id;
            }
        },
        updateArtStyle: (state, action: PayloadAction<ArtStyle>) => {
            const index = state.artStyles.findIndex(style => style.id === action.payload.id);
            if (index !== -1) {
                state.artStyles[index] = action.payload;
            }
        },
        deleteArtStyle: (state, action: PayloadAction<string>) => {
            const index = state.artStyles.findIndex(style => style.id === action.payload);
            if (index !== -1) {
                state.artStyles.splice(index, 1);
                // 선택값 보정: 유일한 스타일이 되면 자동 선택, 아니면 선택 무효화만 처리
                const remaining = state.artStyles;
                const hasOnlyOne = remaining.length === 1;
                const exists = state.selectedArtStyleId ? remaining.some(style => style.id === state.selectedArtStyleId) : false;
                if (hasOnlyOne && (!state.selectedArtStyleId || !exists)) {
                    state.selectedArtStyleId = remaining[0].id;
                } else if (!exists) {
                    // 선택된 것이 삭제로 인해 사라졌지만 여러 개 남아있는 경우 첫 번째로 대체
                    state.selectedArtStyleId = remaining[0]?.id ?? '';
                }
            }
        },
        selectArtStyle: (state, action: PayloadAction<string>) => {
            const styleExists = state.artStyles.some(style => style.id === action.payload);
            if (styleExists) {
                state.selectedArtStyleId = action.payload;
            }
        },
        importImageSettings: (_state, action: PayloadAction<ImageGenerationSettingsState>) => {
            return action.payload;
        },
        resetImageSettings: () => {
            return initialState;
        },
        toggleStyleAware: (state) => {
            state.styleAware = !state.styleAware;
        },
    }
});

export const imageSettingsActions = imageSettingsSlice.actions;
export default imageSettingsSlice.reducer;