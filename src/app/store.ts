import { configureStore, combineReducers } from '@reduxjs/toolkit';
import localforage from 'localforage';
import {
    persistReducer,
    persistStore,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
} from 'redux-persist';

import characterReducer from '../entities/character/slice';
import roomReducer from '../entities/room/slice';
import messageReducer from '../entities/message/slice';
import settingsReducer from '../entities/setting/slice';

localforage.config({
    name: 'yejingram',
    storeName: 'persist',
});

const persistConfig = {
    key: 'yejingram',
    storage: localforage as any, // localForage는 getItem/setItem/removeItem을 제공하므로 호환됩니다.
    version: 1,
    whitelist: ['characters', 'rooms', 'messages', 'settings'],
};

const rootReducer = combineReducers({
    characters: characterReducer,
    rooms: roomReducer,
    settings: settingsReducer,
    messages: messageReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        // redux-persist가 직렬화 불가능한 액션을 쓰므로 검사 무시 목록을 지정
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
