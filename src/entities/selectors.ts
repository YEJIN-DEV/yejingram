// features/selectors.ts
import { createSelector } from '@reduxjs/toolkit'
import { charactersAdapter } from './character/slice'
import { roomsAdapter } from './room/slice'
import { messagesAdapter } from './message/slice'
import type { RootState } from '../app/store'

const charsSel = charactersAdapter.getSelectors((s: RootState) => s.characters)
const roomsSel = roomsAdapter.getSelectors((s: RootState) => s.rooms)
const msgsSel = messagesAdapter.getSelectors((s: RootState) => s.messages)

// 1) 특정 방의 메시지들(시간순)
export const selectMessagesByRoom = (roomId: string) => createSelector(
    [msgsSel.selectAll],
    (all) => all.filter(m => m.roomId === roomId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
)

// 2) 방의 멤버 캐릭터 목록
export const selectRoomMembers = (roomId: string) => createSelector(
    [(state: RootState) => roomsSel.selectById(state, roomId), (state: RootState) => charsSel.selectEntities(state)],
    (room, charMap) => {
        if (!room?.memberIds) return []
        return room.memberIds.map(id => charMap[id]).filter(Boolean)
    }
)

// 3) 메시지에 author(캐릭터) 붙이기(denormalize)
export const selectMessageWithAuthor = (messageId: string) => createSelector(
    [(state: RootState) => msgsSel.selectById(state, messageId), (state: RootState) => charsSel.selectEntities(state)],
    (msg, charMap) => (msg ? { ...msg, author: charMap[msg.authorId] } : undefined)
)

// 4) 방의 마지막 메시지(rooms.lastMessageId 활용)
export const selectRoomLastMessage = (roomId: string) => createSelector(
    [(state: RootState) => roomsSel.selectById(state, roomId), (state: RootState) => msgsSel.selectEntities(state)],
    (room, msgMap) => (room?.lastMessageId ? msgMap[room.lastMessageId] : undefined)
)
