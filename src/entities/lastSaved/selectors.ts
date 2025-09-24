import type { RootState } from '../../app/store';

export const selectLastSaved = (state: RootState) => state.lastSaved.value;
