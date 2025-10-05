import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

export const selectUI = (state: RootState) => state.ui;

export const selectSyncProgress = createSelector(selectUI, (ui) => ui.syncProgress ?? 0);
export const selectUploadProgress = createSelector(selectUI, (ui) => ui.uploadProgress ?? 0);
export const selectForceShowSyncModal = createSelector(selectUI, (ui) => !!ui.forceShowSyncModal);
