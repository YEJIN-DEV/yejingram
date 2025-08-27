export interface ParticipantSettings {
    isActive: boolean;
    responseProbability: number;
    characterRole: 'normal' | 'leader' | 'quiet' | 'active';
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
    lastMessageId: number | null
    type: RoomType
    unreadCount: number
    groupSettings?: GroupChatSettings
    currentParticipants?: number[]
    authorNote?: string
    memories?: string[]
}