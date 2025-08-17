import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { sendMessage } from './message/slice'
import { roomsActions } from './room/slice'

export const listener = createListenerMiddleware()

listener.startListening({
    matcher: isAnyOf(sendMessage.fulfilled),
    effect: async (action, api) => {
        const msg = action.payload
        api.dispatch(roomsActions.setLastMessage({ roomId: msg.roomId, messageId: msg.id }))
    }
})
