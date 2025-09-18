import type { Sticker } from "../character/types";

export type MessageType = "TEXT" | "IMAGE" | "STICKER" | "SYSTEM" | "AUDIO" | "VIDEO" | "FILE";

export type FileToSend = {
    dataUrl: string;
    mimeType: string;
    name?: string;
};

export type Message = {
    id: string;
    roomId: string;
    authorId: number;
    createdAt: string;
    leaveCharId?: number;
} & (
        | { type: "TEXT"; content: string; sticker?: never; file?: never }
        | { type: "IMAGE"; content?: never; sticker?: never; file: FileToSend }
        | { type: "STICKER"; content?: never; sticker: Sticker; file?: never }
        | { type: "SYSTEM"; content?: string; sticker?: never; file?: never }
        | { type: "AUDIO"; content?: never; sticker?: never; file: FileToSend }
        | { type: "VIDEO"; content?: never; sticker?: never; file: FileToSend }
        | { type: "FILE"; content?: never; sticker?: never; file: FileToSend }
    );