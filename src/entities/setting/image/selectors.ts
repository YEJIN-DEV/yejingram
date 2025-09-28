import type { RootState } from '../../../app/store';
import { createSelector } from '@reduxjs/toolkit';
import type { ArtStyle, ImageApiProvider } from './types';

const selectImageSettingsState = (state: RootState) => state.settings.imageSettings;

export const selectAllImageSettings = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings
);

export const selectImageApiConfigs = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings.config
);

export const selectImageApiConfig = createSelector(
    [selectImageApiConfigs],
    (configs) => (provider: keyof typeof configs) => configs[provider]
);

// 현재 선택된 이미지 생성 provider
export const selectImageProvider = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings.imageProvider
);

// 현재 선택된 이미지 모델
export const selectImageModel = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings.model
);

// 현재 provider 에 해당하는 api config + model 을 종합해서 반환
export const selectCurrentImageApiConfig = createSelector(
    [selectImageProvider, selectImageApiConfigs, selectImageModel],
    (provider, configs, model) => {
        const cfg = configs[provider as ImageApiProvider] || {};
        return { provider, model, ...cfg } as { provider: ImageApiProvider; model: string; apiKey?: string; custom?: { baseUrl: string; json: string } };
    }
);

export const selectArtStyles = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings.artStyles
);

export const selectSelectedArtStyleId = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings.selectedArtStyleId
);

export const selectCurrentArtStyle = createSelector(
    [selectArtStyles, selectSelectedArtStyleId],
    (artStyles, selectedId) => {
        if (!artStyles || artStyles.length === 0) {
            return null;
        }
        if (!selectedId) {
            return artStyles[0];
        }
        return artStyles.find((style: ArtStyle) => style.id === selectedId) || artStyles[0];
    }
);

export const selectArtStyleById = createSelector(
    [selectArtStyles],
    (artStyles) => (id: string) => artStyles.find((style: ArtStyle) => style.id === id)
);

export const selectArtStyleCount = createSelector(
    [selectArtStyles],
    (artStyles) => artStyles.length
);

export const selectStyleAware = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings.styleAware
);

export const selectNAIConfig = createSelector(
    [selectImageApiConfig],
    (getConfig) => getConfig('novelai')?.naiConfig
);
