import type { Message } from "../entities/message/types";

export function getMessageDisplayText(lastMessage: Message | null): string {
    if (!lastMessage) return '새로운 메시지를 보내보세요';

    return lastMessage.content ||
        (lastMessage.type === 'STICKER' ? '스티커' :
            lastMessage.type === 'IMAGE' ? '파일' :
                lastMessage.type === 'AUDIO' ? '파일' :
                    lastMessage.type === 'VIDEO' ? '파일' :
                        lastMessage.type === 'FILE' ? '파일' :
                            '새로운 메시지를 보내보세요')
}