import { messagesAdapter } from "./slice";
import type { RootState } from "../../app/store";
import { createSelector } from "@reduxjs/toolkit";

export const {
    selectAll: selectAllMessages,
    selectById: selectMessageById,
} = messagesAdapter.getSelectors((state: RootState) => state.messages);

export const selectMessagesByRoomId = createSelector(
    [selectAllMessages, (state: RootState, roomId: string) => roomId],
    (messages, roomId) => {
        return messages.filter(message => message.roomId === roomId);
    }
);
