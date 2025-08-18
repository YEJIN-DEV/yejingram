import { createSlice, createEntityAdapter } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Character, Sticker } from "./types";
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
    addSticker: (state, action: PayloadAction<{ characterId: number; sticker: Sticker }>) => {
      const { characterId, sticker } = action.payload;
      const character = state.entities[characterId];
      if (character) {
        character.stickers.push(sticker);
      }
    },
    deleteSticker: (state, action: PayloadAction<{ characterId: number; stickerId: string }>) => {
      const { characterId, stickerId } = action.payload;
      const character = state.entities[characterId];
      if (character) {
        character.stickers = character.stickers.filter(s => s.id !== stickerId);
      }
    },
    editStickerName: (state, action: PayloadAction<{ characterId: number; stickerId: string; newName: string }>) => {
      const { characterId, stickerId, newName } = action.payload;
      const character = state.entities[characterId];
      if (character) {
        const sticker = character.stickers.find(s => s.id === stickerId);
        if (sticker) {
          sticker.name = newName;
        }
      }
    },
  },
})
export const charactersActions = charactersSlice.actions
export default charactersSlice.reducer
