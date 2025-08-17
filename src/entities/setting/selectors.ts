import type { RootState } from '../../app/store';
import { createSelector } from '@reduxjs/toolkit';

const selectSettingsState = (state: RootState) => state.settings;

export const selectIsSettingsModalOpen = createSelector(
    [selectSettingsState],
    (settings) => settings.isModalOpen
);

export const selectIsPromptModalOpen = createSelector(
    [selectSettingsState],
    (settings) => settings.isPromptModalOpen
);

export const selectPrompts = createSelector(
    [selectSettingsState],
    (settings) => settings.prompts
);

export const selectAllSettings = createSelector(
    [selectSettingsState],
    (settings) => settings
);

export const selectApiProvider = createSelector(
    [selectSettingsState],
    (settings) => settings.apiProvider
);

export const selectApiConfigs = createSelector(
    [selectSettingsState],
    (settings) => settings.apiConfigs
);

export const selectCurrentApiConfig = createSelector(
    [selectApiProvider, selectApiConfigs],
    (provider, configs) => configs[provider]
);
