import { createSlice } from '@reduxjs/toolkit';
import type { UIState } from './types';

const initialState: UIState = {
    syncInFlight: 0,
    syncDeterminate: false,
    syncProgress: 0,
    uploadInFlight: 0,
    forceShowSyncModal: false,
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        syncStart(state) {
            state.syncInFlight += 1;
        },
        syncEnd(state) {
            state.syncInFlight = Math.max(0, state.syncInFlight - 1);
        },
        // For edge cases: ensure counter isn't stuck
        resetSync(state) {
            state.syncInFlight = 0;
            state.syncDeterminate = false;
            state.syncProgress = 0;
        },
        setSyncProgress(state, action: { payload: number }) {
            state.syncDeterminate = true;
            // clamp 0..100
            const v = Math.max(0, Math.min(100, Math.floor(action.payload)));
            state.syncProgress = v;
        },
        clearSyncProgress(state) {
            state.syncDeterminate = false;
            state.syncProgress = 0;
        },
        uploadStart(state) {
            state.uploadInFlight = (state.uploadInFlight ?? 0) + 1;
        },
        uploadEnd(state) {
            state.uploadInFlight = Math.max(0, (state.uploadInFlight ?? 0) - 1);
        },
        forceShowSyncModal(state) {
            state.forceShowSyncModal = true;
        },
        clearForceShowSyncModal(state) {
            state.forceShowSyncModal = false;
        }
    },
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;
