import { charactersAdapter } from "./slice";
import type { RootState } from "../../app/store";

export const {
    selectAll: selectAllCharacters,
    selectById: selectCharacterById,
} = charactersAdapter.getSelectors((state: RootState) => state.characters);

export const selectIsCharacterPanelOpen = (state: RootState) => state.characters.isCharacterPanelOpen;
export const selectEditingCharacterId = (state: RootState) => state.characters.editingCharacterId;