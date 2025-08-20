import type { Sticker } from "../character/types";

export type MessageType = "TEXT" | "IMAGE" | "STICKER" | "SYSTEM";

export type ImageToSend = {
    dataUrl: string;
};

export interface Message {
    id: string;
    roomId: string;
    authorId: number;
    content: string;
    type: MessageType;
    createdAt: string;
    sticker?: Sticker;
    image?: ImageToSend;
}