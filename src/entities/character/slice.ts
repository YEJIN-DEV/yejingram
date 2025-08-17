import { createSlice, createEntityAdapter } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Character } from "./types";
import { defaultCharacters } from "./types";

export const charactersAdapter = createEntityAdapter<Character>()
const initialState = charactersAdapter.getInitialState({
  isCharacterModalOpen: false,
  editingCharacterId: null as string | number | null,
})

const charactersSlice = createSlice({
  name: 'characters',
  initialState: charactersAdapter.upsertMany(initialState, defaultCharacters),
  reducers: {
    upsertMany: charactersAdapter.upsertMany,
    upsertOne: charactersAdapter.upsertOne,
    openCharacterModal: (state, action: PayloadAction<string | number | null>) => {
      state.isCharacterModalOpen = true;
      state.editingCharacterId = action.payload;
    },
    closeCharacterModal: (state) => {
      state.isCharacterModalOpen = false;
      state.editingCharacterId = null;
    },
  },
})
export const charactersActions = charactersSlice.actions
export default charactersSlice.reducer