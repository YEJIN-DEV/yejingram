import type { RootState } from "../../app/store";
import type { Lore } from "./types";

export const selectLorebookByCharacterId = (state: RootState, characterId: number): Lore[] => {
    const character = state.characters.entities[characterId] as { lorebook?: Lore[] } | undefined;
    return (character?.lorebook ?? []).slice().sort((a, b) => a.order - b.order);
};
