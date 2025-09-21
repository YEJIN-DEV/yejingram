import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

export const selectUI = (state: RootState) => state.ui;

export const selectIsSyncing = createSelector(selectUI, (ui) => ui.syncInFlight > 0);
export const selectSyncDeterminate = createSelector(selectUI, (ui) => !!ui.syncDeterminate);
export const selectSyncProgress = createSelector(selectUI, (ui) => ui.syncProgress ?? 0);
export const selectIsUploading = createSelector(selectUI, (ui) => (ui.uploadInFlight ?? 0) > 0);
export const selectForceShowSyncModal = createSelector(selectUI, (ui) => !!ui.forceShowSyncModal);
