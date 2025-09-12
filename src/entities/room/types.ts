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
    firstMessageEnabled?: boolean;
    firstMessageFrequencyMin?: number;
    firstMessageFrequencyMax?: number;
    characterInteractionEnabled?: boolean; // 인물들 간 상호톡 활성화
    characterInteractionCount?: number;    // 연속 대화 횟수
}

type RoomType = "Group" | "Open" | "Direct";
export interface Room {
    id: string
    name: string
    description?: string
    memberIds: number[]
    lastMessageId: number | null
    type: RoomType
    unreadCount: number
    groupSettings?: GroupChatSettings
    currentParticipants?: number[]
    authorNote?: string
    memories?: string[]
    lorebook?: Lore[]
}