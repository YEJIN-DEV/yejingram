// features/messages/slice.ts
import { createSlice, createEntityAdapter } from '@reduxjs/toolkit'
import type { Message } from './types'

export const messagesAdapter = createEntityAdapter<Message>({
    sortComparer: (a, b) => a.createdAt.localeCompare(b.createdAt),
})
const initialState = messagesAdapter.getInitialState()
const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        upsertOne: messagesAdapter.upsertOne,
        upsertMany: messagesAdapter.upsertMany,
        removeOne: messagesAdapter.removeOne,
        updateOne: messagesAdapter.updateOne,
        removeMany: messagesAdapter.removeMany
    }
})

export const messagesActions = messagesSlice.actions
export default messagesSlice.reducer
