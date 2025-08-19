type RoomType = "Group" | "Open" | "Direct";
export interface Room {
    id: string
    name: string
    memberIds: number[]
    lastMessageId: number | null
    type: RoomType
    unreadCount: number
}