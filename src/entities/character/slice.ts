import { createSlice, createEntityAdapter } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Character, Sticker } from "./types";
import type { Lore } from "../lorebook/types";
import { defaultCharacters } from "./types";

export const charactersAdapter = createEntityAdapter<Character>()
const initialState = charactersAdapter.getInitialState({
  isCharacterPanelOpen: false,
  editingCharacterId: null as number | null,
})

const charactersSlice = createSlice({
  name: 'characters',
  initialState: charactersAdapter.upsertMany(initialState, defaultCharacters),
  reducers: {
    upsertMany: charactersAdapter.upsertMany,
    upsertOne: charactersAdapter.upsertOne,
    removeOne: charactersAdapter.removeOne,
    setEditingCharacterId: (state, action: PayloadAction<number | null>) => {
      state.editingCharacterId = action.payload;
    },
    resetEditingCharacterId: (state) => {
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
    // Lorebook granular actions
    addLore: (state, action: PayloadAction<{ characterId: number; lore: Lore }>) => {
      const { characterId, lore } = action.payload;
      const character = state.entities[characterId];
      if (character) {
        const lores = character.lorebook ?? (character.lorebook = []);
        const nextLore: Lore = {
          ...lore,
          order: lores.length,
          activationKeys: (lore.activationKeys && lore.activationKeys.length > 0) ? lore.activationKeys : [''],
          alwaysActive: !!lore.alwaysActive,
          multiKey: !!lore.multiKey,
        };
        lores.push(nextLore);
      }
    },
    updateLore: (state, action: PayloadAction<{ characterId: number; id: string; patch: Partial<Lore> }>) => {
      const { characterId, id, patch } = action.payload;
      const character = state.entities[characterId];
      if (character && character.lorebook) {
        const lore = character.lorebook.find(l => l.id === id);
        if (lore) {
          Object.assign(lore, patch);
        }
      }
    },
    removeLore: (state, action: PayloadAction<{ characterId: number; id: string }>) => {
      const { characterId, id } = action.payload;
      const character = state.entities[characterId];
      if (character && character.lorebook) {
        const filtered = character.lorebook.filter(l => l.id !== id);
        character.lorebook = filtered.map((l, i) => ({ ...l, order: i }));
      }
    },
    moveLore: (state, action: PayloadAction<{ characterId: number; id: string; direction: -1 | 1 }>) => {
      const { characterId, id, direction } = action.payload;
      const character = state.entities[characterId];
      if (character && character.lorebook && character.lorebook.length > 1) {
        const sorted = [...character.lorebook].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(l => l.id === id);
        const j = idx + direction;
        if (idx >= 0 && j >= 0 && j < sorted.length) {
          [sorted[idx], sorted[j]] = [sorted[j], sorted[idx]];
          character.lorebook = sorted.map((l, i) => ({ ...l, order: i }));
        }
      }
    },
    setLoreMultiKey: (state, action: PayloadAction<{ characterId: number; id: string; value: boolean }>) => {
      const { characterId, id, value } = action.payload;
      const character = state.entities[characterId];
      if (character && character.lorebook) {
        const lore = character.lorebook.find(l => l.id === id);
        if (lore) {
          let keys = Array.isArray(lore.activationKeys) ? [...lore.activationKeys] : [''];
          if (value) {
            while (keys.length < 2) keys.push('');
            keys = keys.slice(0, 2);
          } else {
            keys = [keys[0] ?? ''];
          }
          lore.multiKey = value;
          lore.activationKeys = keys;
        }
      }
    },
    updateLorebook: (state, action: PayloadAction<{ characterId: number; lorebook: any[] }>) => {
      const { characterId, lorebook } = action.payload;
      const character = state.entities[characterId];
      if (character) {
        character.lorebook = lorebook;
      }
    },
    updateStickers: (state, action: PayloadAction<{ characterId: number; stickers: Sticker[] }>) => {
      const { characterId, stickers } = action.payload;
      const character = state.entities[characterId];
      if (character) {
        character.stickers = stickers;
      }
    },
    importCharacters: (state, action: PayloadAction<Character[]>) => {
      charactersAdapter.upsertMany(state, action.payload); // 호출만
    },
  },
})

export const charactersActions = charactersSlice.actions
export default charactersSlice.reducer
