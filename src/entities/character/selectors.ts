import { charactersAdapter } from "./slice";
import type { RootState } from "../../app/store";

export const {
    selectAll: selectAllCharacters,
    selectById: selectCharacterById,
} = charactersAdapter.getSelectors((state: RootState) => state.characters);
