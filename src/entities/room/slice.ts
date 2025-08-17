import { createSlice, createEntityAdapter } from '@reduxjs/toolkit'
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
        addMembers(state, action: { payload: { roomId: string, memberIds: number[] } }) {
            const { roomId, memberIds } = action.payload
            const room = state.entities[roomId]
            if (room) {
                const set = new Set([...(room.memberIds ?? []), ...memberIds])
                room.memberIds = [...set]
            }
        }
    }
})
export const roomsActions = roomsSlice.actions
export default roomsSlice.reducer
