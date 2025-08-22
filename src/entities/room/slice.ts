import { createSlice, createEntityAdapter, type PayloadAction } from '@reduxjs/toolkit'
import type { Room } from './types'

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
        }
    }
})
export const roomsActions = roomsSlice.actions
export default roomsSlice.reducer
