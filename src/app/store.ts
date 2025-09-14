import { configureStore, combineReducers, type Action } from '@reduxjs/toolkit';
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
    createMigrate,
} from 'redux-persist';

import characterReducer from '../entities/character/slice';
import roomReducer from '../entities/room/slice';
import messageReducer from '../entities/message/slice';
import settingsReducer, { initialState as settingsInitialState } from '../entities/setting/slice';
import { applyRules } from '../utils/migration';

localforage.config({
    name: 'yejingram',
    storeName: 'persist',
});

const migrations = {
    1: (state: any) => {
        state = applyRules(state, {
            add: [
                {
                    path: 'settings.prompts',
                    keys: ['maxContextTokens', 'maxResponseTokens', 'temperature', 'topP', 'topK'],
                    defaults: settingsInitialState.prompts
                },
                {
                    path: 'settings',
                    keys: ['isDarkMode', 'autoImageGeneration', 'artStyles', 'selectedArtStyleId', 'comfyUIConfig'],
                    defaults: settingsInitialState
                }
            ],
            delete: [
                {
                    path: 'settings.apiConfigs.*',
                    keys: ['temperature', 'maxTokens', 'topP', 'topK']
                }
            ]
        });

        return state;
    },
};


const persistConfig = {
    key: 'yejingram',
    storage: localforage as any, // localForage는 getItem/setItem/removeItem을 제공하므로 호환됩니다.
    version: 1,
    whitelist: ['characters', 'rooms', 'messages', 'settings'],
    migrate: createMigrate(migrations, { debug: true }),
};

const appReducer = combineReducers({
    characters: characterReducer,
    rooms: roomReducer,
    settings: settingsReducer,
    messages: messageReducer,
});

export const RESET_ALL = 'app/resetAll' as const;
export const resetAll = () => ({ type: RESET_ALL } as const);

const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: Action) => {
    if (action.type === RESET_ALL) {
        state = undefined;                 // ← 모든 slice가 initialState로
    }
    return appReducer(state, action);
};

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
