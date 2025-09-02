// features/messages/slice.ts
import { createSlice, createEntityAdapter, type Action, type PayloadAction, nanoid } from '@reduxjs/toolkit'
import type { Message } from './types'
import type { ThunkAction } from 'redux-thunk';
import type { RootState } from '../../app/store';
import { getActiveRoomId } from '../../utils/activeRoomTracker';
import { roomsActions } from '../room/slice';

export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action<string>>

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
        removeMany: messagesAdapter.removeMany,
        importMessages: (state, action: PayloadAction<Message[]>) => {
            messagesAdapter.upsertMany(state, action.payload);
        },
        duplicateMessages: (state, action: { payload: { originalId: string, newId: string } }) => {
            const messages = messagesAdapter.getSelectors().selectAll(state);
            const messagesToDuplicate = messages.filter(msg => msg.roomId === action.payload.originalId);
            const newMessages = messagesToDuplicate.map(msg => ({ ...msg, id: nanoid(), roomId: action.payload.newId }));
            messagesAdapter.upsertMany(state, newMessages);
        }
    }
})

export const messagesActions = {
    ...messagesSlice.actions,
    upsertOne:
        (message: Message): AppThunk =>
            (dispatch) => {
                dispatch(messagesSlice.actions.upsertOne(message));

                const activeRoomId = getActiveRoomId();
                if (message.roomId && message.roomId !== activeRoomId) {
                    dispatch(roomsActions.incrementUnread(message.roomId));
                }
            },
}
export default messagesSlice.reducer
