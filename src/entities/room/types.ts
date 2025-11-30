import type { Lore } from '../lorebook/types';

export interface ParticipantSettings {
    isActive: boolean;
    responseProbability: number;
}

export interface GroupChatSettings {
    responseFrequency: number;
    maxRespondingCharacters: number;
    responseDelay: number;
    participantSettings: Record<number, ParticipantSettings>;
}

type RoomType = "Group" | "Open" | "Direct";
export interface Room {
    id: string
    name: string
    memberIds: number[]
    lastMessageId: string | null
    type: RoomType
    unreadCount: number
    groupSettings?: GroupChatSettings
    currentParticipants?: number[]
    authorNote?: string
    memories?: string[]
    lorebook?: Lore[]
    proactiveEnabled?: boolean // Whether proactive chat is enabled for this room
}