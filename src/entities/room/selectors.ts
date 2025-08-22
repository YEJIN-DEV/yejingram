import { roomsAdapter } from "./slice";
import type { RootState } from "../../app/store";
import { createSelector } from "@reduxjs/toolkit";

export const {
    selectAll: selectAllRooms,
    selectById: selectRoomById,
} = roomsAdapter.getSelectors((state: RootState) => state.rooms);

export const selectRoomsByCharacterId = createSelector(
    [selectAllRooms, (_state: RootState, characterId: number) => characterId],
    (rooms, characterId) => {
        return rooms.filter(room => room.memberIds?.includes(characterId));
    }
);
