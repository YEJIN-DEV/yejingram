import type { Sticker } from "../character/types";

export type MessageType = "TEXT" | "IMAGE" | "STICKER" | "SYSTEM" | "AUDIO" | "VIDEO" | "FILE";

export type FileToSend = {
    dataUrl: string;
    mimeType: string;
    name?: string;
};

export interface Message {
    id: string;
    roomId: string;
    authorId: number;
    content: string;
    type: MessageType;
    createdAt: string;
    sticker?: Sticker;
    file?: FileToSend;
    leaveCharId?: number;
    isFirstMessage?: boolean; // 선톡 메시지 여부를 나타내는 플래그
}