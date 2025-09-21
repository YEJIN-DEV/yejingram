import type { Message } from "../entities/message/types";

export function getMessageDisplayText(lastMessage: Message | null, t: (key: string) => string): string {
    if (!lastMessage) return t('messages.new');

    return lastMessage.content ||
        (lastMessage.type === 'STICKER' ? t('messages.sticker') :
            lastMessage.type === 'IMAGE' ? t('messages.file') :
                lastMessage.type === 'AUDIO' ? t('messages.file') :
                    lastMessage.type === 'VIDEO' ? t('messages.file') :
                        lastMessage.type === 'FILE' ? t('messages.file') :
                            t('messages.new'));
}