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
        updateMany: messagesAdapter.updateMany,
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
    removeOne:
        (message: Message): AppThunk =>
            (dispatch) => {
                if (message.thoughtSignature)
                    dispatch(messagesActions.removethoughtSignatures(message.thoughtSignature));

                dispatch(messagesSlice.actions.removeOne(message.id));
            },
    updateOne:
        (payload: { id: string; changes: Partial<Message> }): AppThunk =>
            (dispatch) => {
                dispatch(messagesSlice.actions.updateOne(payload));
                if (payload.changes.content && payload.changes.thoughtSignature)
                    dispatch(messagesActions.removethoughtSignatures(payload.changes.thoughtSignature));
            },
    removethoughtSignatures: (thoughtSignature: string): AppThunk =>
        (dispatch, getState) => {
            const state = getState() as any;
            const updates = messagesAdapter.getSelectors().selectAll(state.messages)
                .filter(msg => msg.thoughtSignature === thoughtSignature)
                .map(msg => ({
                    id: msg.id,
                    changes: { thoughtSignature: undefined }
                }));
            dispatch(messagesSlice.actions.updateMany(updates));
        },
    clearAllThoughtSignatures: (): AppThunk =>
        (dispatch, getState) => {
            const state = getState() as RootState;
            const updates = messagesAdapter.getSelectors().selectAll(state.messages)
                .filter(msg => msg.thoughtSignature !== undefined)
                .map(msg => ({
                    id: msg.id,
                    changes: { thoughtSignature: undefined }
                }));

            if (updates.length > 0) {
                dispatch(messagesSlice.actions.updateMany(updates));
            }
        }
}
export default messagesSlice.reducer
