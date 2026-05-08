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
import settingsReducer, { initialSyncSettings, initialState as settingsInitialState, initialApiConfigs as settingsInitialApiConfigs, initialProactiveSettings, initialState } from '../entities/setting/slice';
import { initialState as imageSettingsInitialState } from '../entities/setting/image/slice';
import { applyRules } from '../utils/migration';
import uiReducer from '../entities/ui/slice';
import lastSavedReducer from '../entities/lastSaved/slice';
import { dataUrlToBlob, makeAvatarBinaryKey, makeMessageBinaryKey, makeStickerBinaryKey, saveBlob } from '../services/binaryStore';
import syncReducer from '../entities/sync/slice';

// Enable localforage only in browser environments
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

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
    },
    5: (state: any) => {
        state = applyRules(state, {
            add: [
                {
                    path: 'settings.apiConfigs.custom',
                    keys: ['maxRetries'],
                    defaults: { maxRetries: settingsInitialApiConfigs.custom.maxRetries }
                },
            ]
        });
        return state;
    },
    6: (state: any) => {
        state = applyRules(state, {
            add: [
                {
                    path: 'settings',
                    keys: ['proactiveSettings'],
                    defaults: { proactiveSettings: initialProactiveSettings }
                },
            ]
        });
        return state;
    },
    7: (state: any) => {
        if (!state) return state;
        if (!isBrowser) return state;

        const runWithConcurrency = async (jobs: Array<() => Promise<void>>, limit: number) => {
            const pending = new Set<Promise<void>>();
            for (const job of jobs) {
                const p = (async () => {
                    try {
                        await job();
                    } catch (e) {
                        console.warn('Binary migration job failed (continuing):', e);
                    }
                })().finally(() => pending.delete(p));
                pending.add(p);
                if (pending.size >= limit) {
                    await Promise.race(pending);
                }
            }
            await Promise.all(pending);
        };

        const isDataUrlString = (value: unknown): value is string => {
            return typeof value === 'string' && value.startsWith('data:') && value.includes(',');
        };

        const mimeTypeFromDataUrl = (dataUrl: string): string => {
            try {
                return dataUrl.split(',')[0].split(':')[1].split(';')[0] || 'application/octet-stream';
            } catch {
                return 'application/octet-stream';
            }
        };

        return (async () => {
            const jobs: Array<() => Promise<void>> = [];

            // Messages: attachments + sticker messages
            const msgEntities: Record<string, any> | undefined = state?.messages?.entities;
            if (msgEntities) {
                for (const [id, msg] of Object.entries(msgEntities)) {
                    if (!msg) continue;

                    if (msg.file?.dataUrl && isDataUrlString(msg.file.dataUrl)) {
                        const dataUrl = msg.file.dataUrl;
                        const storageKey = makeMessageBinaryKey(id);
                        const mimeType = msg.file.mimeType;
                        const name = msg.file.name;
                        jobs.push(async () => {
                            await saveBlob(storageKey, await dataUrlToBlob(dataUrl));
                            msg.file = { storageKey, mimeType, name };
                        });
                    }

                    if (msg.type === 'STICKER' && msg.sticker && !msg.sticker.storageKey && isDataUrlString(msg.sticker.data)) {
                        const dataUrl = msg.sticker.data;
                        const stickerId = msg.sticker.id;
                        if (typeof stickerId !== 'string' || stickerId.length === 0) continue;
                        const storageKey = makeStickerBinaryKey(stickerId);
                        const mimeType = mimeTypeFromDataUrl(dataUrl);
                        const name = typeof msg.sticker.name === 'string' ? msg.sticker.name : '';
                        jobs.push(async () => {
                            await saveBlob(storageKey, await dataUrlToBlob(dataUrl));
                            msg.sticker = { id: stickerId, name, storageKey, mimeType };
                        });
                    }
                }
            }

            // Characters: avatar + stickers
            const charEntities: Record<string, any> | undefined = state?.characters?.entities;
            if (charEntities) {
                for (const [id, ch] of Object.entries(charEntities)) {
                    if (!ch) continue;

                    if (isDataUrlString(ch.avatar)) {
                        const dataUrl = ch.avatar;
                        const storageKey = makeAvatarBinaryKey(id);
                        const mimeType = dataUrl.split(',')[0].split(':')[1].split(';')[0] || 'application/octet-stream';
                        jobs.push(async () => {
                            await saveBlob(storageKey, await dataUrlToBlob(dataUrl));
                            ch.avatar = { storageKey, mimeType };
                        });
                    }

                    if (Array.isArray(ch.stickers)) {
                        for (const st of ch.stickers) {
                            if (!st || st.storageKey) continue;
                            if (!isDataUrlString(st.data)) continue;
                            const dataUrl = st.data;
                            const stickerId = st.id;
                            if (typeof stickerId !== 'string' || stickerId.length === 0) continue;
                            const storageKey = makeStickerBinaryKey(stickerId);
                            const mimeType = mimeTypeFromDataUrl(dataUrl);
                            jobs.push(async () => {
                                await saveBlob(storageKey, await dataUrlToBlob(dataUrl));
                                const name = typeof st.name === 'string' ? st.name : '';
                                st.id = stickerId;
                                st.name = name;
                                st.storageKey = storageKey;
                                st.mimeType = mimeType;
                                delete st.data;
                            });
                        }
                    }
                }
            }

            // Limit concurrency to avoid spiking memory during migration.
            await runWithConcurrency(jobs, 4);
            return state;
        })();
    },
    8: (state: any) => {
        state = applyRules(state, {
            delete: [{
                path: 'settings.apiConfigs.custom',
                keys: ['includeImagesDescription']
            }],
            add: [{
                path: 'settings',
                keys: ['useThoughtSignature', 'usePayloadImage'],
                defaults: { useThoughtSignature: initialState.useThoughtSignature, usePayloadImage: initialState.usePayloadImage }
            }]
        });

        return state;
    },
    9: (state: any) => {
        state = applyRules(state, {
            add: [{
                path: 'settings',
                keys: ['lastAnnouncementCommitTime'],
                defaults: { lastAnnouncementCommitTime: null }
            }]
        });
        return state;
    },
    10: (state: any) => {
        state = applyRules(state, {
            add: [{
                path: 'settings.prompts',
                keys: ['useTemperature', 'useTopP', 'useTopK'],
                defaults: { useTemperature: true, useTopP: true, useTopK: true }
            }]
        });
        return state;
    }
} as MigrationManifest;


export const persistConfig = {
    key: 'yejingram',
    storage: blobStorage as any,
    version: 10,
    whitelist: ['characters', 'rooms', 'messages', 'settings', 'lastSaved', 'sync'],
    migrate: createMigrate(migrations, { debug: true }),
};

const appReducer = combineReducers({
    characters: characterReducer,
    rooms: roomReducer,
    settings: settingsReducer,
    messages: messageReducer,
    ui: uiReducer,
    lastSaved: lastSavedReducer,
    sync: syncReducer
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
