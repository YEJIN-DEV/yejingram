import type { Sticker } from "../character/types";

export type MessageType = "TEXT" | "IMAGE" | "STICKER";
export interface Message {
    id: string;
    roomId: string;
    authorId: number;
    content: string;
    type: MessageType;
    createdAt: string;
    sticker?: Sticker;
}