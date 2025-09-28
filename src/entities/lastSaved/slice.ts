import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { LastSavedState } from './types';

export const initialState: LastSavedState = {
    value: new Date().getTime()
};

const lastSavedSlice = createSlice({
    name: 'lastSaved',
    initialState,
    reducers: {
        markSaved: (state, action: PayloadAction<number | undefined>) => {
            // allow explicit timestamp injection, otherwise use now
            state.value = action.payload ?? Date.now();
        },
        importLastSaved: (_state, action: PayloadAction<LastSavedState>) => {
            return action.payload ?? initialState;
        }
    }
});

export const lastSavedReducer = lastSavedSlice.reducer;
export const lastSavedActions = lastSavedSlice.actions;

export default lastSavedReducer;
