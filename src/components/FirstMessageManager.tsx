// 전역 선톡 관리 컴포넌트
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { selectAllSettings } from '../entities/setting/selectors';
import { selectAllCharacters } from '../entities/character/selectors';
import { selectAllRooms } from '../entities/room/selectors';
import { updateFirstMessageService, cleanupFirstMessageService } from '../services/firstMessageService';
import { cleanupCharacterInteractionService } from '../services/characterInteractionService';
import type { AppDispatch } from '../app/store';

/**
 * 선톡 기능을 전역적으로 관리하는 컴포넌트
 * 설정 변경을 감지하고 그에 따라 선톡 서비스를 업데이트합니다
 */
function FirstMessageManager() {
    const dispatch = useDispatch() as AppDispatch;
    const settings = useSelector(selectAllSettings);
    const characters = useSelector(selectAllCharacters);
    const rooms = useSelector(selectAllRooms);

    // 설정, 캐릭터, 방이 변경될 때마다 선톡 서비스 업데이트
    useEffect(() => {
        updateFirstMessageService(settings, characters, rooms, dispatch);
    }, [settings, characters, rooms, dispatch]);

    // 컴포넌트 언마운트 시에만 정리
    useEffect(() => {
        return () => {
            cleanupFirstMessageService();
            cleanupCharacterInteractionService();
        };
    }, []); // 빈 dependency 배열로 언마운트 시에만 실행

    // 이 컴포넌트는 UI를 렌더링하지 않습니다 (서비스 관리 전용)
    return null;
}

export default FirstMessageManager;