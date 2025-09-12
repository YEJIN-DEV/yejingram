// 선톡(First Message) 기능을 위한 커스텀 훅
import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { selectAllSettings } from '../entities/setting/selectors';
import { selectAllCharacters } from '../entities/character/selectors';
// import { selectAllRooms } from '../entities/room/selectors'; // 미래 사용을 위해 주석 처리
import { scheduleFirstMessage, scheduleGroupFirstMessage, cancelFirstMessageSchedule } from '../utils/firstMessageScheduler';
import type { Room } from '../entities/room/types';
import type { Character } from '../entities/character/types';
import type { AppDispatch } from '../app/store';

/**
 * 선톡 기능을 관리하는 커스텀 훅
 * 설정에 따라 자동으로 선톡을 스케줄링하고 관리합니다
 */
export const useFirstMessage = () => {
    const dispatch = useDispatch() as AppDispatch;
    const settings = useSelector(selectAllSettings);
    const characters = useSelector(selectAllCharacters);
    // const rooms = useSelector(selectAllRooms); // 미래 사용을 위해 남겨둘 수 있음

    /**
     * 새로운 방이 생성될 때 선톡을 스케줄링합니다
     * @param room 새로 생성된 방
     */
    const scheduleForNewRoom = useCallback((room: Room) => {
        console.log(`[First Message] 방 생성 감지: ${room.name}, 연락처 내 선톡 활성화: ${settings.proactiveChatEnabled}`);
        
        // 연락처 내 선톡이 비활성화된 경우 스케줄링 안함
        if (!settings.proactiveChatEnabled) {
            console.log('[First Message] 연락처 내 선톡이 비활성화되어 스케줄링하지 않습니다.');
            return;
        }

        if (room.type === 'Direct') {
            // Direct 채팅의 경우
            const character = characters.find(char => room.memberIds.includes(char.id));
            if (character) {
                console.log(`[First Message] Direct 채팅 선톡 스케줄링: ${character.name}`);
                scheduleFirstMessage(
                    character, 
                    room, 
                    dispatch,
                    settings.randomMessageFrequencyMin || 30,
                    settings.randomMessageFrequencyMax || 120
                );
            }
        } else if (room.type === 'Group') {
            // 그룹 채팅의 경우
            const roomCharacters = characters.filter(char => room.memberIds.includes(char.id));
            
            // 그룹 설정에서 선톡 또는 상호톡이 활성화되었는지 확인
            const groupSettings = room.groupSettings;
            const isGroupFirstMessageEnabled = groupSettings?.firstMessageEnabled || groupSettings?.characterInteractionEnabled;
            console.log(`[First Message] 그룹 채팅 선톡 설정 확인: firstMessageEnabled=${groupSettings?.firstMessageEnabled}, characterInteractionEnabled=${groupSettings?.characterInteractionEnabled}`);
            
            if (isGroupFirstMessageEnabled && settings.proactiveChatEnabled) {
                const minTime = groupSettings.firstMessageFrequencyMin || 30;
                const maxTime = groupSettings.firstMessageFrequencyMax || 120;
                
                console.log(`[First Message] 그룹 채팅 선톡 스케줄링: ${room.name}, 시간 범위: ${minTime}-${maxTime}분`);
                scheduleGroupFirstMessage(
                    roomCharacters,
                    room,
                    dispatch,
                    minTime,
                    maxTime
                );
            }
        }
    }, [dispatch, settings, characters]);

    /**
     * 랜덤 선톡을 스케줄링합니다 (설정에서 활성화된 경우)
     */
    const scheduleRandomFirstMessages = useCallback(() => {
        // 랜덤 선톡이 비활성화된 경우 리턴
        if (!settings.randomFirstMessageEnabled) {
            return;
        }

        // 생성할 인원 수만큼 랜덤 캐릭터 선택
        const availableCharacters = [...characters];
        const selectedCharacters: Character[] = [];
        
        for (let i = 0; i < settings.randomCharacterCount && availableCharacters.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availableCharacters.length);
            selectedCharacters.push(availableCharacters.splice(randomIndex, 1)[0]);
        }

        // 선택된 캐릭터들로 Direct 채팅 생성 및 선톡 스케줄링
        selectedCharacters.forEach(character => {
            const roomId = `random-${character.id}-${Date.now()}`;
            
            // 임시 방 객체 생성 (실제로는 방을 생성하지 않고 선톡만 스케줄링)
            const tempRoom: Room = {
                id: roomId,
                name: character.name,
                memberIds: [character.id],
                lastMessageId: null,
                type: 'Direct',
                unreadCount: 0
            };

            scheduleFirstMessage(
                character, 
                tempRoom, 
                dispatch,
                settings.randomMessageFrequencyMin || 30,
                settings.randomMessageFrequencyMax || 120
            );
        });
    }, [dispatch, settings, characters]);

    /**
     * 특정 방의 선톡 스케줄을 취소합니다
     * @param roomId 방 ID
     * @param characterId 캐릭터 ID (선택사항)
     */
    const cancelScheduleForRoom = useCallback((roomId: string, characterId?: number) => {
        cancelFirstMessageSchedule(roomId, characterId);
    }, []);

    /**
     * 방 설정이 변경될 때 스케줄을 업데이트합니다
     * @param room 변경된 방
     */
    const updateScheduleForRoom = useCallback((room: Room) => {
        // 기존 스케줄 취소
        cancelFirstMessageSchedule(room.id);

        // 새 설정에 따라 다시 스케줄링 (선톡 또는 상호톡이 활성화된 경우)
        if (room.type === 'Group' && (room.groupSettings?.firstMessageEnabled || room.groupSettings?.characterInteractionEnabled)) {
            const roomCharacters = characters.filter(char => room.memberIds.includes(char.id));
            const minTime = room.groupSettings.firstMessageFrequencyMin || 30;
            const maxTime = room.groupSettings.firstMessageFrequencyMax || 120;
            
            scheduleGroupFirstMessage(
                roomCharacters,
                room,
                dispatch,
                minTime,
                maxTime
            );
        }
    }, [dispatch, characters]);

    return {
        scheduleForNewRoom,
        scheduleRandomFirstMessages,
        cancelScheduleForRoom,
        updateScheduleForRoom,
        isProactiveChatEnabled: settings.proactiveChatEnabled,
        isRandomFirstMessageEnabled: settings.randomFirstMessageEnabled
    };
};