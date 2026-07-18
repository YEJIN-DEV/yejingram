import type { Sticker } from "../character/types";

export type MessageType = "TEXT" | "IMAGE" | "STICKER" | "SYSTEM" | "AUDIO" | "VIDEO" | "FILE";

// NOTE: Binary payloads should not live in Redux/persist state.
// New format stores only a reference key into binary storage.
export type StoredFileRef = {
    storageKey: string;
    mimeType: string;
    name?: string;
    // Natural pixel size for images; lets the UI reserve layout space before load.
    width?: number;
    height?: number;
};

export type Message = {
    id: string;
    roomId: string;
    authorId: number;
    createdAt: string;
    leaveCharId?: number;
    thoughtSignature?: string;
} & (
        | { type: "TEXT"; content: string; sticker?: never; file?: never }
        | { type: "IMAGE"; content?: never; sticker?: never; file: StoredFileRef; imageGenerationSetting: { prompt: string; isIncludingChar: boolean } }
        | { type: "STICKER"; content?: never; sticker: Sticker; file?: never }
        | { type: "SYSTEM"; content?: string; sticker?: never; file?: never }
        | { type: "AUDIO"; content?: never; sticker?: never; file: StoredFileRef }
        | { type: "VIDEO"; content?: never; sticker?: never; file: StoredFileRef }
        | { type: "FILE"; content?: never; sticker?: never; file: StoredFileRef }
    );