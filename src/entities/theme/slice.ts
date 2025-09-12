// Redux slice for theme management
import { createSlice } from '@reduxjs/toolkit';
import type { ThemeState } from './types';

// 초기 상태 정의 - 기본값은 라이트 모드
const initialState: ThemeState = {
  isDarkMode: false,
};

// 테마 관리를 위한 Redux slice 생성
export const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    // 다크 모드 토글 액션
    toggleDarkMode: (state) => {
      state.isDarkMode = !state.isDarkMode;
      // HTML 요소에 다크 모드 클래스 추가/제거
      if (state.isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },
    // 특정 테마 모드 설정 액션
    setDarkMode: (state, action) => {
      state.isDarkMode = action.payload;
      // HTML 요소에 다크 모드 클래스 추가/제거
      if (state.isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },
  },
});

// 액션들을 export
export const { toggleDarkMode, setDarkMode } = themeSlice.actions;

// 액션들을 하나의 객체로 묶어서 export (기존 패턴과 일치)
export const themeActions = themeSlice.actions;

// reducer를 export
export default themeSlice.reducer;