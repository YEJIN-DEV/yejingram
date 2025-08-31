import { createSlice, createEntityAdapter, type PayloadAction } from '@reduxjs/toolkit'
import type { Room } from './types'
import type { Lore } from '../lorebook/types'

export const roomsAdapter = createEntityAdapter<Room, string>({
    selectId: (room: Room) => room.id,
})
const initialState = roomsAdapter.getInitialState()

const roomsSlice = createSlice({
    name: 'rooms',
    initialState,
    reducers: {
        upsertOne: roomsAdapter.upsertOne,
        upsertMany: roomsAdapter.upsertMany,
        removeOne: roomsAdapter.removeOne,
        setRoomMemory: (state, action: PayloadAction<{ roomId: string; index: number; value: string }>) => {
            const { roomId, index, value } = action.payload;
            const room = state.entities[roomId];
            if (room) {
                const memories = room.memories ?? (room.memories = []);
                if (index >= 0 && index < memories.length) {
                    memories[index] = value;
                }
            }
        },
        addRoomMemory: (state, action: PayloadAction<{ roomId: string; value?: string }>) => {
            const { roomId, value = '' } = action.payload;
            const room = state.entities[roomId];
            if (room) {
                const memories = room.memories ?? (room.memories = []);
                memories.push(value);
            }
        },
        removeRoomMemory: (state, action: PayloadAction<{ roomId: string; index: number }>) => {
            const { roomId, index } = action.payload;
            const room = state.entities[roomId];
            if (room && room.memories && index >= 0 && index < room.memories.length) {
                room.memories.splice(index, 1);
            }
        },
        updateRoomLorebook: (state, action: PayloadAction<{ roomId: string; lorebook: Lore[] }>) => {
            const { roomId, lorebook } = action.payload;
            const room = state.entities[roomId];
            if (room) {
                room.lorebook = lorebook;
            }
        },
        addRoomLore: (state, action: PayloadAction<{ roomId: string; lore: Lore }>) => {
            const { roomId, lore } = action.payload;
            const room = state.entities[roomId];
            if (room) {
                const lores = room.lorebook ?? (room.lorebook = []);
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
        updateRoomLore: (state, action: PayloadAction<{ roomId: string; id: string; patch: Partial<Lore> }>) => {
            const { roomId, id, patch } = action.payload;
            const room = state.entities[roomId];
            if (room && room.lorebook) {
                const lore = room.lorebook.find(l => l.id === id);
                if (lore) {
                    Object.assign(lore, patch);
                }
            }
        },
        removeRoomLore: (state, action: PayloadAction<{ roomId: string; id: string }>) => {
            const { roomId, id } = action.payload;
            const room = state.entities[roomId];
            if (room && room.lorebook) {
                const filtered = room.lorebook.filter(l => l.id !== id);
                room.lorebook = filtered.map((l, i) => ({ ...l, order: i }));
            }
        },
        moveRoomLore: (state, action: PayloadAction<{ roomId: string; id: string; direction: -1 | 1 }>) => {
            const { roomId, id, direction } = action.payload;
            const room = state.entities[roomId];
            if (room && room.lorebook && room.lorebook.length > 1) {
                const sorted = [...room.lorebook].sort((a, b) => a.order - b.order);
                const idx = sorted.findIndex(l => l.id === id);
                const j = idx + direction;
                if (idx >= 0 && j >= 0 && j < sorted.length) {
                    [sorted[idx], sorted[j]] = [sorted[j], sorted[idx]];
                    room.lorebook = sorted.map((l, i) => ({ ...l, order: i }));
                }
            }
        },
        setRoomLoreMultiKey: (state, action: PayloadAction<{ roomId: string; id: string; value: boolean }>) => {
            const { roomId, id, value } = action.payload;
            const room = state.entities[roomId];
            if (room && room.lorebook) {
                const lore = room.lorebook.find(l => l.id === id);
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
        incrementUnread: (state, action: { payload: string }) => {
            const room = state.entities[action.payload];
            if (room) {
                room.unreadCount = (room.unreadCount || 0) + 1;
            }
        },
        resetUnread: (state, action: { payload: string }) => {
            const room = state.entities[action.payload];
            if (room) {
                room.unreadCount = 0;
            }
        },
        addMembers(state, action: { payload: { roomId: string, memberIds: number[] } }) {
            const { roomId, memberIds } = action.payload
            const room = state.entities[roomId]
            if (room) {
                const set = new Set([...(room.memberIds ?? []), ...memberIds])
                room.memberIds = [...set]
            }
        },
        importRooms: (state, action: PayloadAction<Room[]>) => {
            roomsAdapter.upsertMany(state, action); // 호출만
        },
        duplicateRoom: (state, action: { payload: { originalId: string, newId: string } }) => {
            const room = state.entities[action.payload.originalId];
            if (room) {
                const newRoom = { ...room, id: action.payload.newId };
                roomsAdapter.upsertOne(state, newRoom);
            }
        }
    }
})
export const roomsActions = roomsSlice.actions
export default roomsSlice.reducer
