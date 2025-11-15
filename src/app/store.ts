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
import settingsReducer, { initialSyncSettings, initialState as settingsInitialState, initialApiConfigs as settingsInitialApiConfigs } from '../entities/setting/slice';
import { initialState as imageSettingsInitialState } from '../entities/setting/image/slice';
import { applyRules } from '../utils/migration';
import uiReducer from '../entities/ui/slice';
import lastSavedReducer from '../entities/lastSaved/slice';

// Enable localforage only in browser environments
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

if (isBrowser) {
    localforage.config({
        name: 'yejingram',
        storeName: 'persist',
    });
}

const memoryStore = new Map<string, string>();

const blobStorage = {
    async getItem(key: string): Promise<string | null> {
        if (!isBrowser) {
            return memoryStore.has(key) ? memoryStore.get(key)! : null;
        }

        const data = await localforage.getItem(key);
        if (data == null) return null;

        if (data instanceof Blob) {
            try {
                return await data.text();
            } catch {
                // Fallback: try to read as ArrayBuffer -> string
                const buf = await data.arrayBuffer();
                return new TextDecoder().decode(new Uint8Array(buf));
            }
        }

        // Backward compatibility
        if (typeof data === 'string') return data;
        try {
            await this.setItem(key, JSON.stringify(data)); // Migrate to Blob storage
            return JSON.stringify(data);
        } catch {
            return null;
        }
    },
    async setItem(key: string, value: string): Promise<void> {
        if (!isBrowser) {
            memoryStore.set(key, value);
            return;
        }
        const blob = new Blob([value], { type: 'application/json' });
        await localforage.setItem(key, blob);
    },
    removeItem(key: string): Promise<void> {
        if (!isBrowser) {
            memoryStore.delete(key);
            return Promise.resolve();
        }
        return localforage.removeItem(key);
    },
} as const;

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
                    path: 'settings.apiConfigs',
                    keys: ['deepseek', 'custom'],
                    defaults: { deepseek: settingsInitialApiConfigs.deepseek, custom: settingsInitialApiConfigs.custom }
                },
                {
                    path: 'settings.apiConfigs.openrouter',
                    keys: ['providers', 'providerAllowFallbacks', 'tokenizer'],
                    defaults: settingsInitialApiConfigs.openrouter
                },
            ],
            move: [
                {
                    from: 'settings.apiConfigs.customOpenAI',
                    to: 'settings.apiConfigs.custom',
                    keys: ['apiKey', 'baseUrl', 'model', 'customModels'],
                    overwrite: true,
                    keepSource: false
                }
            ]

        });

        if (state?.settings?.apiProvider === 'customOpenAI') {
            state.settings.apiProvider = 'custom';
        }
        return state;
    },
    4: (state: any) => {
        // 1) Remove orphan rooms: rooms whose memberIds, after filtering by existing characters, become empty
        const characterEntities = state?.characters?.entities ?? {};
        const validCharacterIds = new Set(
            Object.entries(characterEntities)
                .filter(([, ch]) => !!ch)
                // character keys are numbers (stored as strings in object keys)
                .map(([id]) => Number(id))
        );

        const roomState = state?.rooms;
        if (roomState && roomState.entities && roomState.ids) {
            const roomEntitiesMap = roomState.entities as Record<string, any>;
            const roomsToDelete = new Set<string>();

            for (const [roomId, room] of Object.entries(roomEntitiesMap)) {
                if (!room) continue;
                const memberIds: number[] = Array.isArray(room.memberIds) ? room.memberIds : [];
                const filteredMembers = memberIds.filter((id) => validCharacterIds.has(id));

                if (filteredMembers.length === 0) {
                    roomsToDelete.add(roomId);
                } else if (filteredMembers.length !== memberIds.length) {
                    room.memberIds = filteredMembers;
                }
            }

            if (roomsToDelete.size > 0) {
                roomState.ids = (roomState.ids as string[]).filter((id) => !roomsToDelete.has(id));
                const newEntities: Record<string, unknown> = {};
                for (const id of roomState.ids as string[]) {
                    newEntities[id] = roomEntitiesMap[id];
                }
                roomState.entities = newEntities;
            }
        }

        // 2) After rooms cleanup, drop orphaned messages that reference non-existent rooms
        const roomEntities = state.rooms.entities as Record<string, any>;
        const messageState = state.messages as { ids: string[]; entities: Record<string, any> };

        const validRoomIds = new Set(
            Object.entries(roomEntities)
                .filter(([, room]) => !!room)
                .map(([roomId]) => roomId)
        );

        const filteredIds = messageState.ids.filter((messageId: string) => {
            const message = messageState.entities[messageId];
            return message && (!message.roomId || validRoomIds.has(message.roomId));
        });

        if (filteredIds.length !== messageState.ids.length) {
            const filteredEntities: Record<string, unknown> = {};
            for (const id of filteredIds) {
                filteredEntities[id] = messageState.entities[id];
            }
            state.messages.ids = filteredIds;
            state.messages.entities = filteredEntities;
        }

        return state;
    }
} as MigrationManifest;


export const persistConfig = {
    key: 'yejingram',
    storage: blobStorage as any,
    version: 4,
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
