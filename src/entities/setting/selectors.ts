import type { RootState } from '../../app/store';
import { createSelector } from '@reduxjs/toolkit';

const selectSettingsState = (state: RootState) => state.settings;

export const selectIsSettingsPanelOpen = createSelector(
    [selectSettingsState],
    (settings) => settings.isModalOpen
);

export const selectIsPromptModalOpen = createSelector(
    [selectSettingsState],
    (settings) => settings.isPromptModalOpen
);

export const selectIsCreateGroupChatModalOpen = createSelector(
    [selectSettingsState],
    (settings) => settings.isCreateGroupChatModalOpen
);

export const selectIsCreateOpenChatModalOpen = createSelector(
    [selectSettingsState],
    (settings) => settings.isCreateOpenChatModalOpen
);

export const selectIsEditGroupChatModalOpen = createSelector(
    [selectSettingsState],
    (settings) => settings.isEditGroupChatModalOpen
);

export const selectEditingRoomId = createSelector(
    [selectSettingsState],
    (settings) => settings.editingRoomId
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
