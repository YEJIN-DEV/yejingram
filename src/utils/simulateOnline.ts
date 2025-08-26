import { useMemo } from 'react';
import type { Message } from '../entities/message/types';
import { useSelector } from 'react-redux';
import { selectAllRooms } from '../entities/room/selectors';
import { selectMessagesByRoomId } from '../entities/message/selectors';
import type { RootState } from '../app/store';


export function useCharacterOnlineStatus(characterId: number) {
    const state = useSelector((state: RootState) => state);
    const allRooms = useSelector(selectAllRooms);
    const chatRooms = useMemo(() => (
        allRooms.filter(r => r.memberIds?.includes(characterId) && r.type === 'Direct') || []
    ), [allRooms, characterId]);

    // Gather all messages sent by this character
    const allCharacterMessages = useMemo(() => {
        const messages: Message[] = [];
        chatRooms.forEach(room => {
            const roomMessages: Message[] = selectMessagesByRoomId(state, room.id);
            messages.push(...roomMessages);
        });
        return messages;
    }, [chatRooms, state]);

    const lastMessage = useMemo(() => {
        if (!allCharacterMessages.length) return null;
        return allCharacterMessages[allCharacterMessages.length - 1];
    }, [allCharacterMessages]);

    // Find the hour with the most messages (active hour)
    const mostActiveHour = useMemo(() => {
        if (!allCharacterMessages.length) return null;
        const hourCounts: Record<number, number> = {};
        allCharacterMessages.forEach(msg => {
            const date = new Date(msg.createdAt);
            const hour = date.getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        let maxHour = 0, maxCount = 0;
        for (const hour in hourCounts) {
            if (hourCounts[hour] > maxCount) {
                maxCount = hourCounts[hour];
                maxHour = Number(hour);
            }
        }
        return maxHour;
    }, [allCharacterMessages]);

    return useMemo(() => {
        // 1. Recent message within 5 min
        if (lastMessage?.createdAt && (new Date().getTime() - new Date(lastMessage.createdAt).getTime() <= 5 * 60 * 1000)) {
            return true;
        }

        // 2. Current time within ±1 hours of most active hour
        if (mostActiveHour !== null) {
            const nowHour = new Date().getHours();
            let inActiveWindow = false;
            for (let offset = -1; offset <= 1; offset++) {
                const testHour = (mostActiveHour + offset + 24) % 24;
                if (nowHour === testHour) {
                    inActiveWindow = true;
                    break;
                }
            }
            if (inActiveWindow) return true;
        }

        // 3. Otherwise, random chance (fixed per 30-min slot, per character, per page load)
        // Use a seeded random based on character.id and current 30-min slot
        const now = new Date();
        const slot = Math.floor(now.getTime() / (1000 * 60 * 30));
        // Simple hash for seed
        const charIdStr = String(characterId);
        let seed = 0;
        for (let i = 0; i < charIdStr.length; i++) seed += charIdStr.charCodeAt(i);
        seed += slot;
        // Linear congruential generator
        const rand = (seed * 9301 + 49297) % 233280;
        const random = rand / 233280;
        return random < 0.50; // 50% chance
    }, [lastMessage, mostActiveHour, characterId]);
}