export type MessageType = "TEXT" | "IMAGE" | "STICKER";
export interface Message {
    id: number;
    roomId: string;
    authorId: string;
    content: string;
    type: MessageType;
    createdAt: string;
}