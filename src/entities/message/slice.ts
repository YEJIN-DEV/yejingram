// features/messages/slice.ts
import { createSlice, createEntityAdapter, createAsyncThunk } from '@reduxjs/toolkit'
import type { Message } from './types'

export const messagesAdapter = createEntityAdapter<Message>({
    sortComparer: (a, b) => a.createdAt.localeCompare(b.createdAt),
})
const initialState = messagesAdapter.getInitialState()

// 예: 메시지 전송(서버 저장 후 돌아오는 형태)
export const sendMessage = createAsyncThunk(
    'messages/sendMessage',
    async (input: { roomId: string; authorId: string; text: string }) => {
        // const res = await api.post('/messages', input)
        // return res.data as Message
        const fake: Message = {
            id: crypto.randomUUID(),
            roomId: input.roomId,
            authorId: input.authorId,
            content: input.text,
            createdAt: new Date().toISOString()
        }
        return fake
    }
)

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        upsertMany: messagesAdapter.upsertMany,
    },
    extraReducers: (builder) => {
        builder.addCase(sendMessage.fulfilled, (state, action) => {
            messagesAdapter.upsertOne(state, action.payload)
        })
    }
})

export const messagesActions = messagesSlice.actions
export default messagesSlice.reducer
