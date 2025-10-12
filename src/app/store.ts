import { configureStore, combineReducers, type Action } from '@reduxjs/toolkit';
import { syncMiddleware } from '../services/syncMiddleware';
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
    type MigrationManifest,
} from 'redux-persist';

import characterReducer from '../entities/character/slice';
import roomReducer from '../entities/room/slice';
import messageReducer from '../entities/message/slice';
import settingsReducer, { initialSyncSettings, initialState as settingsInitialState } from '../entities/setting/slice';
import { initialState as imageSettingsInitialState } from '../entities/setting/image/slice';
import { applyRules } from '../utils/migration';
import uiReducer from '../entities/ui/slice';
import lastSavedReducer from '../entities/lastSaved/slice';

localforage.config({
    name: 'yejingram',
    storeName: 'persist',
});

export const migrations = {
    2: (state: any) => {
        state = applyRules(state, {
            add: [
                {
                    path: 'settings',
                    keys: ['imageSettings', 'colorTheme', 'customThemeBase', 'customTheme', 'syncSettings'],
                    defaults: { imageSettings: imageSettingsInitialState, colorTheme: 'light', customThemeBase: 'light', customTheme: { light: {}, dark: {} }, syncSettings: initialSyncSettings }
                },
                {
                    path: '',
                    keys: ['lastSaved'],
                    defaults: { lastSaved: { value: new Date().getTime() } }
                },
                {
                    path: 'settings.prompts',
                    keys: ['maxContextTokens', 'maxResponseTokens', 'temperature', 'topP', 'topK'],
                    defaults: settingsInitialState.prompts
                },
            ],
            move: [
                {
                    from: 'settings.imageApiConfigs',
                    to: 'settings.imageSettings.config',
                    keys: ['gemini', 'novelai'],
                    overwrite: true,
                    keepSource: false
                },
                {
                    from: 'settings',
                    to: 'settings.imageSettings',
                    keys: ['imageApiProvider'],
                    rename: { imageApiProvider: 'imageProvider' },
                    overwrite: true,
                    keepSource: false
                }
            ],
            delete: [
                {
                    path: 'settings.prompts',
                    keys: ['image_response_generation']
                },
                {
                    path: 'settings.apiConfigs.*',
                    keys: ['temperature', 'maxTokens', 'topP', 'topK']
                }
            ]
        });
        return state;
    },
    3: (state: any) => {
        // Ensure new fields exist after introducing OpenRouter provider routing and tokenizer settings
        state = applyRules(state, {
            add: [
                {
                    path: 'settings.apiConfigs.openrouter',
                    keys: ['providerOrder', 'providerAllowFallbacks', 'tokenizer'],
                    defaults: { providerOrder: [], providerAllowFallbacks: true, tokenizer: '' }
                },
                {
                    path: 'settings.apiConfigs.customOpenAI',
                    keys: ['tokenizer'],
                    defaults: { tokenizer: '' }
                }
            ]
        });
        return state;
    }
} as MigrationManifest;


export const persistConfig = {
    key: 'yejingram',
    storage: localforage as any, // localForage는 getItem/setItem/removeItem을 제공하므로 호환됩니다.
    version: 3,
    whitelist: ['characters', 'rooms', 'messages', 'settings', 'lastSaved'],
    migrate: createMigrate(migrations, { debug: true }),
};

const appReducer = combineReducers({
    characters: characterReducer,
    rooms: roomReducer,
    settings: settingsReducer,
    messages: messageReducer,
    ui: uiReducer,
    lastSaved: lastSavedReducer,
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
        }).concat(syncMiddleware as any),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
