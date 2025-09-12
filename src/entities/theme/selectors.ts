// 테마 상태 선택자들
import type { RootState } from '../../app/store';

// 다크 모드 여부를 선택하는 selector
export const selectIsDarkMode = (state: RootState) => state.theme.isDarkMode;

// 현재 테마 모드를 문자열로 반환하는 selector
export const selectThemeMode = (state: RootState) => 
  state.theme.isDarkMode ? 'dark' : 'light';