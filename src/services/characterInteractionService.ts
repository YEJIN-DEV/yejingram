// 캐릭터 간 상호톡 서비스
import type { Room } from '../entities/room/types';
import type { Character } from '../entities/character/types';
import type { AppDispatch } from '../app/store';
import { SendGroupChatMessage } from './LLMcaller';
import { store } from '../app/store';
import { selectMessagesByRoomId } from '../entities/message/selectors';
import { selectAllCharacters } from '../entities/character/selectors';
import { selectSelectedPersona } from '../entities/setting/selectors';

// 활성화된 상호톡 세션을 추적하는 Map (roomId -> interaction state)
const activeInteractionSessions = new Map<string, {
    isActive: boolean;
    currentCount: number;
    maxCount: number;
    lastMessageTime: number;
}>();

/**
 * 그룹 채팅에서 캐릭터 상호톡을 시작합니다
 * @param room 그룹 채팅 룸
 * @param dispatch Redux dispatch 함수
 */
export const startCharacterInteraction = async (room: Room, dispatch: AppDispatch): Promise<void> => {
    if (room.type !== 'Group' || !room.groupSettings) {
        console.log(`[Character Interaction] Room ${room.id}는 그룹 채팅이 아니거나 설정이 없습니다.`);
        return;
    }

    const { characterInteractionEnabled, characterInteractionCount } = room.groupSettings;
    
    if (!characterInteractionEnabled || !characterInteractionCount) {
        console.log(`[Character Interaction] Room ${room.id}에서 상호톡이 비활성화되거나 횟수가 설정되지 않았습니다.`);
        return;
    }

    // 이미 진행 중인 세션이 있는지 확인
    const existingSession = activeInteractionSessions.get(room.id);
    if (existingSession?.isActive) {
        console.log(`[Character Interaction] Room ${room.id}에서 이미 상호톡이 진행 중입니다.`);
        return;
    }

    console.log(`[Character Interaction] Room ${room.id}에서 상호톡을 시작합니다. 최대 ${characterInteractionCount}회 대화`);
    
    // 토스트로 사용자에게 알림 (선택사항)
    // toast.info(`캐릭터들이 ${characterInteractionCount}번의 대화를 나눕니다.`, { duration: 2000 });

    // 새 상호톡 세션 등록
    activeInteractionSessions.set(room.id, {
        isActive: true,
        currentCount: 0,
        maxCount: characterInteractionCount,
        lastMessageTime: Date.now()
    });

    // 상호톡 실행
    await executeCharacterInteraction(room, dispatch);
};

/**
 * 캐릭터 간 상호톡을 실행합니다
 * @param room 그룹 채팅 룸
 * @param dispatch Redux dispatch 함수
 */
const executeCharacterInteraction = async (room: Room, dispatch: AppDispatch): Promise<void> => {
    const session = activeInteractionSessions.get(room.id);
    if (!session || !session.isActive) {
        return;
    }

    try {
        // 그룹 채팅 메시지 전송 (기존 로직 재사용)
        await SendGroupChatMessage(room, () => {});

        // 카운트 증가
        session.currentCount++;
        session.lastMessageTime = Date.now();

        console.log(`[Character Interaction] Room ${room.id} - 상호톡 진행: ${session.currentCount}/${session.maxCount}`);

        // 최대 횟수에 도달했는지 확인
        if (session.currentCount >= session.maxCount) {
            console.log(`[Character Interaction] Room ${room.id} - 상호톡 완료 (${session.maxCount}회 달성)`);
            stopCharacterInteraction(room.id);
            return;
        }

        // 다음 상호톡을 위한 대기 시간 설정 (2-4초 랜덤, 좀 더 자연스러운 간격)
        const delay = 2000 + Math.random() * 2000;
        
        setTimeout(() => {
            // 세션이 여전히 활성화되어 있는지 다시 확인
            const currentSession = activeInteractionSessions.get(room.id);
            if (currentSession && currentSession.isActive) {
                executeCharacterInteraction(room, dispatch);
            }
        }, delay);

    } catch (error) {
        console.error(`[Character Interaction] Room ${room.id}에서 오류 발생:`, error);
        stopCharacterInteraction(room.id);
    }
};

/**
 * 특정 룸의 상호톡을 중지합니다
 * @param roomId 룸 ID
 */
export const stopCharacterInteraction = (roomId: string): void => {
    const session = activeInteractionSessions.get(roomId);
    if (session) {
        session.isActive = false;
        activeInteractionSessions.delete(roomId);
        console.log(`[Character Interaction] Room ${roomId}의 상호톡이 중지되었습니다.`);
    }
};

/**
 * 모든 활성 상호톡 세션을 정리합니다
 */
export const cleanupCharacterInteractionService = (): void => {
    console.log(`[Character Interaction] ${activeInteractionSessions.size}개의 활성 세션을 정리합니다.`);
    activeInteractionSessions.clear();
};

/**
 * 첫 응답 후 캐릭터 간 상호톡을 시작합니다
 * @param room 그룹 채팅 룸  
 * @param dispatch Redux dispatch 함수
 */
export const checkAndTriggerCharacterInteraction = async (room: Room, dispatch: AppDispatch): Promise<void> => {
    if (room.type !== 'Group' || !room.groupSettings?.characterInteractionEnabled) {
        return;
    }

    // 기존 상호톡 세션이 있는지 확인
    const existingSession = activeInteractionSessions.get(room.id);
    if (existingSession?.isActive) {
        console.log(`[Character Interaction] Room ${room.id}에서 이미 상호톡이 진행 중입니다.`);
        return;
    }

    console.log(`[Character Interaction] Room ${room.id}에서 상호톡 트리거 - 첫 응답 후 캐릭터 간 대화 시작`);
    
    // 상호톡 직접 시작 (MainChat에서 이미 첫 응답을 받은 후 호출되므로)
    await startCharacterInteraction(room, dispatch);
};

/**
 * 현재 활성화된 상호톡 세션 정보를 반환합니다
 * @param roomId 룸 ID
 * @returns 세션 정보 또는 null
 */
export const getInteractionSessionInfo = (roomId: string) => {
    return activeInteractionSessions.get(roomId) || null;
};

/**
 * 사용자가 새 메시지를 보낼 때 진행 중인 상호톡을 중단합니다
 * @param roomId 룸 ID
 */
export const interruptCharacterInteraction = (roomId: string): void => {
    const session = activeInteractionSessions.get(roomId);
    if (session && session.isActive) {
        console.log(`[Character Interaction] 사용자 메시지로 인해 Room ${roomId}의 상호톡이 중단되었습니다.`);
        stopCharacterInteraction(roomId);
    }
};