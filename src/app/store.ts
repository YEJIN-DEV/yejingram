import { configureStore } from '@reduxjs/toolkit'
import characterReducer from '../entities/character/slice'
import roomReducer from '../entities/room/slice'
import messageReducer from '../entities/message/slice'
import settingsReducer from '../entities/setting/slice'

export const store = configureStore({
    reducer: {
        characters: characterReducer,
        rooms: roomReducer,
        settings: settingsReducer,
        messages: messageReducer,
    },
})

// 타입 추론용
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
