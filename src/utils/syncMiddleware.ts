import type { Dispatch, MiddlewareAPI, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '../app/store';
import { buildClientSummary, sendDeltaToServer, stripSyncSettings } from './backup';
import { uiActions } from '../entities/ui/slice';

type CollectionKey = 'characters' | 'rooms' | 'messages';

type BufferState = {
    upserts: { characters: Record<string | number, any>; rooms: Record<string, any>; messages: Record<string, any>; settings?: any };
    deletes: { characters: Array<string | number>; rooms: Array<string>; messages: Array<string> };
};

function createEmptyBuffer(): BufferState {
    return {
        upserts: { characters: {}, rooms: {}, messages: {} },
        deletes: { characters: [], rooms: [], messages: [] },
    };
}

function isSyncIgnoredAction(type: string): boolean {
    // Ignore self-applied delta and persistence lifecycle
    return (
        type.startsWith('persist/') ||
        type === 'sync/applyDeltaStart' ||
        type === 'sync/applyDeltaEnd' ||
        type === 'app/resetAll'
    );
}

function recordUpsert(buf: BufferState, key: CollectionKey, items: any | any[]) {
    const arr = Array.isArray(items) ? items : [items];
    for (const it of arr) {
        if (!it) continue;
        const id = (it.id as string | number) ?? '';
        if (id === '' || id === undefined || id === null) continue;
        (buf.upserts[key] as any)[id] = it;
    }
}

function recordDelete(buf: BufferState, key: CollectionKey, ids: any | any[]) {
    const arr = Array.isArray(ids) ? ids : [ids];
    for (const id of arr) {
        if (id === undefined || id === null) continue;
        (buf.deletes[key] as any).push(id as any);
    }
}

export const syncMiddleware = (api: MiddlewareAPI<Dispatch<UnknownAction>, RootState>) => {
    let timer: number | null = null;
    let buf: BufferState = createEmptyBuffer();
    let applyingDelta = false;

    const scheduleFlush = () => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(flush, 500);
    };

    const flush = async () => {
        if (timer) {
            window.clearTimeout(timer);
            timer = null;
        }
        // no-op if buffer empty
        const hasUpserts = Object.keys(buf.upserts.characters).length || Object.keys(buf.upserts.rooms).length || Object.keys(buf.upserts.messages).length || buf.upserts.settings;
        const hasDeletes = buf.deletes.characters.length || buf.deletes.rooms.length || buf.deletes.messages.length;
        if (!hasUpserts && !hasDeletes) return;

        const state = api.getState();
        const settings = state.settings;
        if (!settings?.syncSettings.syncEnabled) {
            buf = createEmptyBuffer();
            return;
        }
        const clientId = settings.syncSettings.syncClientId.trim() || 'default-client';
        const base = settings.syncSettings.syncBaseUrl.trim();

        const payload = {
            clientSummary: buildClientSummary(),
            upserts: {
                characters: Object.values(buf.upserts.characters),
                rooms: Object.values(buf.upserts.rooms),
                messages: Object.values(buf.upserts.messages),
                settings: buf.upserts.settings,
            },
            deletes: buf.deletes,
        };
        // reset buffer before send to avoid duplication in case of quick successive actions
        buf = createEmptyBuffer();
        // Reflect in-flight sync state in UI
        api.dispatch(uiActions.syncStart());
        try {
            await sendDeltaToServer(clientId, payload, base);
        } catch (e) {
            // swallow errors; next actions will retry
            console.error('sync failed', e);
        } finally {
            api.dispatch(uiActions.syncEnd());
        }
    };

    return (next: Dispatch<UnknownAction>) => (action: UnknownAction) => {
        // mark applying delta window (prevents echo)
        if (action.type === 'sync/applyDeltaStart') applyingDelta = true;
        if (action.type === 'sync/applyDeltaEnd') applyingDelta = false;
        if (applyingDelta || isSyncIgnoredAction(action.type)) return next(action);

        const result = next(action);

        try {
            const { type, payload } = action as any;
            // Always watch settings changes to sync settings
            if (type.startsWith('settings/')) {
                // Send entire settings object on change (small size)
                buf.upserts.settings = stripSyncSettings(api.getState().settings);
                scheduleFlush();
                return result;
            }

            // characters
            if (type === 'characters/upsertOne') recordUpsert(buf, 'characters', payload);
            else if (type === 'characters/upsertMany' || type === 'characters/importCharacters') recordUpsert(buf, 'characters', payload);
            else if (type === 'characters/removeOne') recordDelete(buf, 'characters', payload);
            else if (type.startsWith('characters/')) {
                // other character mutations (stickers, lore, etc.) -> send the whole entity
                const id = (payload?.characterId ?? payload?.id) as number | undefined;
                if (id != null) {
                    const ent = api.getState().characters.entities[id];
                    if (ent) recordUpsert(buf, 'characters', ent);
                }
            }

            // rooms
            if (type === 'rooms/upsertOne') recordUpsert(buf, 'rooms', payload);
            else if (type === 'rooms/upsertMany' || type === 'rooms/importRooms' || type === 'rooms/duplicateRoom') recordUpsert(buf, 'rooms', payload);
            else if (type === 'rooms/removeOne') recordDelete(buf, 'rooms', payload);
            else if (type.startsWith('rooms/')) {
                const rid = (payload?.roomId ?? payload?.id) as string | undefined;
                if (rid) {
                    const ent = api.getState().rooms.entities[rid];
                    if (ent) recordUpsert(buf, 'rooms', ent);
                }
            }

            // messages
            if (type === 'messages/upsertOne') recordUpsert(buf, 'messages', payload);
            else if (type === 'messages/upsertMany' || type === 'messages/importMessages') recordUpsert(buf, 'messages', payload);
            else if (type === 'messages/removeOne') recordDelete(buf, 'messages', payload);
            else if (type === 'messages/removeMany') recordDelete(buf, 'messages', payload);
            else if (type === 'messages/updateOne') {
                const id = payload?.id as string | undefined;
                const ent = id ? api.getState().messages.entities[id] : undefined;
                if (ent) recordUpsert(buf, 'messages', ent);
            }

            // if anything recorded, schedule flush
            scheduleFlush();
        } catch (e) {
            // Avoid breaking the app on middleware errors
            console.error('sync middleware error', e);
        }

        return result;
    };
};
