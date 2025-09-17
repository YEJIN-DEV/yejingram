import type { RootState } from '../../../app/store';
import { createSelector } from '@reduxjs/toolkit';
import type { ArtStyle } from './types';

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

export const selectArtStyles = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings.artStyles
);

export const selectSelectedArtStyleId = createSelector(
    [selectImageSettingsState],
    (imageSettings) => imageSettings.selectedArtStyleId
);

export const selectSelectedArtStyle = createSelector(
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
