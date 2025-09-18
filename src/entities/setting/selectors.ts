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

export const selectPersonas = createSelector(
    [selectSettingsState],
    (settings) => settings.personas || []
);

export const selectSelectedPersonaId = createSelector(
    [selectSettingsState],
    (settings) => settings.selectedPersonaId ?? null
);

export const selectSelectedPersona = createSelector(
    [selectPersonas, selectSelectedPersonaId],
    (personas, selectedId) => {
        if (!personas || personas.length === 0) {
            return null;
        }
        if (!selectedId) {
            return personas[0];
        }
        return personas.find(p => p.id === selectedId) || personas[0];
    }
);

export const selectUserName = createSelector(
    [selectSelectedPersona, selectSettingsState],
    (persona, settings) => persona?.name ?? settings.userName ?? ''
);

export const selectUserDescription = createSelector(
    [selectSelectedPersona, selectSettingsState],
    (persona, settings) => persona?.description ?? settings.userDescription ?? ''
);
