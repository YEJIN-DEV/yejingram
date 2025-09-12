// 전역 선톡 서비스
import type { SettingsState } from '../entities/setting/types';
import type { Character } from '../entities/character/types';
import type { Room } from '../entities/room/types';
import type { AppDispatch } from '../app/store';
import { scheduleFirstMessage, scheduleGroupFirstMessage, cancelAllFirstMessageSchedules } from '../utils/firstMessageScheduler';
import { roomsActions } from '../entities/room/slice';

// 랜덤 선톡 타이머를 저장하는 변수
let randomFirstMessageInterval: number | null = null;

/**
 * 설정 변경에 따라 선톡 서비스를 업데이트합니다
 * @param settings 새 설정
 * @param characters 모든 캐릭터 목록
 * @param rooms 모든 방 목록
 * @param dispatch Redux dispatch 함수
 */
export const updateFirstMessageService = (
    settings: SettingsState,
    characters: Character[],
    rooms: Room[],
    dispatch: AppDispatch
) => {
    // 그룹채팅에서 선톡이 활성화된 방들을 찾기 (선톡 활성화 또는 상호톡 활성화)
    const groupRoomsWithFirstMessage = rooms.filter(room => 
        room.type === 'Group' && (
            room.groupSettings?.firstMessageEnabled || 
            room.groupSettings?.characterInteractionEnabled
        )
    );
    
    console.log(`[First Message Service] 서비스 업데이트 - 랜덤 선톡 활성화: ${settings.randomFirstMessageEnabled}, 연락처 내 선톡 활성화: ${settings.proactiveChatEnabled}, 그룹채팅 선톡/상호톡 활성화 방: ${groupRoomsWithFirstMessage.length}개`);
    
    // 기존 랜덤 선톡 타이머 정리
    if (randomFirstMessageInterval) {
        clearInterval(randomFirstMessageInterval);
        randomFirstMessageInterval = null;
        console.log('[First Message Service] 기존 랜덤 선톡 타이머를 정리했습니다.');
    }

    // 다음 중 하나라도 충족되면 서비스 시작:
    // 1. 랜덤 선톡이 활성화되고 연락처 내 선톡이 활성화된 경우
    // 2. 그룹채팅에서 선톡/상호톡이 활성화된 경우
    const shouldStartService = (
        (settings.randomFirstMessageEnabled && settings.proactiveChatEnabled) ||
        groupRoomsWithFirstMessage.length > 0
    ) && characters.length > 0;
    
    if (shouldStartService) {
        console.log('[First Message Service] 선톡 서비스를 시작합니다.');
        scheduleRandomFirstMessages(settings, characters, groupRoomsWithFirstMessage, dispatch);
    } else {
        console.log('[First Message Service] 선톡 조건이 충족되지 않아 서비스를 시작하지 않습니다.');
        console.log(`  - 랜덤 선톡 활성화: ${settings.randomFirstMessageEnabled}`);
        console.log(`  - 연락처 내 선톡 활성화: ${settings.proactiveChatEnabled}`);
        console.log(`  - 그룹채팅 선톡/상호톡 활성화 방: ${groupRoomsWithFirstMessage.length}개`);
        console.log(`  - 캐릭터 수: ${characters.length}`);
    }
};

/**
 * 랜덤 선톡을 스케줄링합니다
 * @param settings 현재 설정
 * @param characters 모든 캐릭터 목록
 * @param groupRoomsWithFirstMessage 선톡이 활성화된 그룹채팅 방 목록
 * @param dispatch Redux dispatch 함수
 */
const scheduleRandomFirstMessages = (
    settings: SettingsState,
    characters: Character[],
    groupRoomsWithFirstMessage: Room[],
    dispatch: AppDispatch
) => {
    // 첫 번째 랜덤 선톡을 즉시 스케줄링
    createRandomFirstMessage(settings, characters, groupRoomsWithFirstMessage, dispatch);

    // 타이머 간격 계산 (Direct 채팅 설정 또는 그룹채팅 설정 중 활성화된 것 사용)
    let averageInterval: number;
    
    if (settings.randomFirstMessageEnabled && settings.proactiveChatEnabled) {
        // Direct 채팅 설정 사용
        averageInterval = (settings.randomMessageFrequencyMin + settings.randomMessageFrequencyMax) / 2;
    } else if (groupRoomsWithFirstMessage.length > 0) {
        // 그룹채팅 설정 사용 (첫 번째 그룹의 설정을 기본값으로)
        const firstGroup = groupRoomsWithFirstMessage[0];
        const minTime = firstGroup.groupSettings?.firstMessageFrequencyMin || 30;
        const maxTime = firstGroup.groupSettings?.firstMessageFrequencyMax || 120;
        averageInterval = (minTime + maxTime) / 2;
    } else {
        averageInterval = 60; // 기본값 60분
    }
    
    const intervalMs = averageInterval * 60 * 1000; // 분을 밀리초로 변환

    randomFirstMessageInterval = setInterval(() => {
        createRandomFirstMessage(settings, characters, groupRoomsWithFirstMessage, dispatch);
    }, intervalMs);

    console.log(`[Random First Message] 선톡이 평균 ${averageInterval}분 간격으로 활성화되었습니다.`);
};

/**
 * 랜덤 캐릭터들로부터 선톡을 생성합니다
 * @param settings 현재 설정
 * @param characters 모든 캐릭터 목록
 * @param groupRoomsWithFirstMessage 선톡이 활성화된 그룹채팅 방 목록
 * @param dispatch Redux dispatch 함수
 */
const createRandomFirstMessage = (
    settings: SettingsState,
    characters: Character[],
    groupRoomsWithFirstMessage: Room[],
    dispatch: AppDispatch
) => {
    if (characters.length === 0) {
        return;
    }

    // 랜덤 선톡이 활성화되고 연락처 내 선톡이 활성화된 경우 Direct 채팅 방 생성
    if (settings.randomFirstMessageEnabled && settings.proactiveChatEnabled) {
        createDirectFirstMessages(settings, characters, dispatch);
    }

    // 그룹채팅 선톡이 활성화된 방들에서 선톡 생성
    if (groupRoomsWithFirstMessage.length > 0) {
        createGroupFirstMessages(groupRoomsWithFirstMessage, characters, dispatch);
    }
};

/**
 * Direct 채팅에서 랜덤 선톡을 생성합니다
 */
const createDirectFirstMessages = (
    settings: SettingsState,
    characters: Character[],
    dispatch: AppDispatch
) => {
    // 생성할 인원 수만큼 랜덤 캐릭터 선택
    const availableCharacters = [...characters];
    const selectedCharacters: Character[] = [];
    
    const maxCount = Math.min(settings.randomCharacterCount, availableCharacters.length);
    
    for (let i = 0; i < maxCount; i++) {
        const randomIndex = Math.floor(Math.random() * availableCharacters.length);
        selectedCharacters.push(availableCharacters.splice(randomIndex, 1)[0]);
    }

    // 선택된 캐릭터들로 Direct 채팅 방 생성 및 선톡 스케줄링
    selectedCharacters.forEach(character => {
        // 새 Direct 채팅방 생성
        const newRoom = {
            id: `random-${character.id}-${Date.now()}-${Math.random()}`,
            name: character.name,
            memberIds: [character.id],
            lastMessageId: null,
            type: 'Direct' as const,
            unreadCount: 0
        };

        // 방 생성
        dispatch(roomsActions.upsertOne(newRoom));

        // 선톡 스케줄링
        scheduleFirstMessage(
            character,
            newRoom,
            dispatch,
            settings.randomMessageFrequencyMin,
            settings.randomMessageFrequencyMax
        );

        console.log(`[Random First Message] ${character.name}의 랜덤 선톡 방이 생성되고 스케줄링되었습니다.`);
    });
};

/**
 * 그룹채팅에서 랜덤 선톡을 생성합니다
 */
const createGroupFirstMessages = (
    groupRoomsWithFirstMessage: Room[],
    characters: Character[],
    dispatch: AppDispatch
) => {
    // 각 그룹채팅 방에서 랜덤하게 선톡을 생성할지 결정
    groupRoomsWithFirstMessage.forEach(room => {
        // 50% 확률로 해당 그룹에서 선톡 생성
        if (Math.random() < 0.5) {
            const roomCharacters = characters.filter(char => room.memberIds.includes(char.id));
            
            if (roomCharacters.length > 0) {
                const minTime = room.groupSettings?.firstMessageFrequencyMin || 30;
                const maxTime = room.groupSettings?.firstMessageFrequencyMax || 120;
                
                console.log(`[Random Group First Message] ${room.name} 그룹채팅에서 선톡을 스케줄링합니다.`);
                scheduleGroupFirstMessage(
                    roomCharacters,
                    room,
                    dispatch,
                    minTime,
                    maxTime
                );
            }
        }
    });
};

/**
 * 선톡 서비스를 완전히 정리합니다
 */
export const cleanupFirstMessageService = () => {
    if (randomFirstMessageInterval) {
        clearInterval(randomFirstMessageInterval);
        randomFirstMessageInterval = null;
    }
    
    // 모든 활성 선톡 스케줄 취소
    cancelAllFirstMessageSchedules();
    
    console.log('[First Message Service] 서비스가 정리되었습니다.');
};