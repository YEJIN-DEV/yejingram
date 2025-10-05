import { createSlice } from '@reduxjs/toolkit';
import type { UIState } from './types';

const initialState: UIState = {
    syncProgress: 0,
    uploadProgress: 0,
    forceShowSyncModal: false,
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        // For edge cases: ensure counter isn't stuck
        resetSync(state) {
            state.syncProgress = 0;
        },
        setSyncProgress(state, action: { payload: number }) {
            // clamp 0..100
            const v = Math.max(0, Math.min(100, Math.floor(action.payload)));
            state.syncProgress = v;
        },
        clearSyncProgress(state) {
            state.syncProgress = 0;
        },
        setUploadProgress(state, action: { payload: number }) {
            const v = Math.max(0, Math.min(100, Math.floor(action.payload)));
            state.uploadProgress = v;
        },
        clearUploadProgress(state) {
            state.uploadProgress = 0;
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
