import { nanoid } from "@reduxjs/toolkit";
import { roomsActions } from "../entities/room/slice";
import { messagesActions } from "../entities/message/slice";
import type { Message } from "../entities/message/types";

const getInitialParticipantSettings = () => ({ isActive: true, responseProbability: 0.9 });

export const inviteCharacter = (selectedInviteId: number | null, room: any, characterName: string, dispatch: any) => {
    if (selectedInviteId && room.groupSettings && room) {
        // Check if the character is already a member
        if (room.memberIds.includes(selectedInviteId)) {
            console.log(`${characterName} is already a member of the room.`);
            return;
        }
        // Add to memberIds and participantSettings
        const updatedMemberIds = [...room.memberIds, selectedInviteId];
        const updatedParticipantSettings = {
            ...room.groupSettings.participantSettings,
            [selectedInviteId]: getInitialParticipantSettings(),
        };
        dispatch(roomsActions.upsertOne({
            ...room,
            memberIds: updatedMemberIds,
            groupSettings: {
                ...room.groupSettings,
                participantSettings: updatedParticipantSettings,
            },
        }));
        // Add system message
        const invitedUsersName = characterName || 'Unknown';
        const invitationMessage = {
            id: nanoid(),
            roomId: room.id,
            authorId: 0,
            content: `${invitedUsersName}님이 초대되었습니다.`,
            createdAt: new Date().toISOString(),
            type: 'SYSTEM'
        } as Message;
        dispatch(messagesActions.upsertOne(invitationMessage));
    }
};
