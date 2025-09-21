import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../app/store';
import { buildClientSummary, sendDeltaToServer, stripSyncSettings } from './backup';
import { uiActions } from '../entities/ui/slice';

type Id = string | number;

type HashMap = Record<string, string>;

function stableStringify(obj: unknown): string {
    const seen = new WeakSet<object>();
    const walk = (v: any): string => {
        if (v === null || typeof v !== 'object') return JSON.stringify(v);
        if (seen.has(v)) return '"[Circular]"';
        seen.add(v);
        if (Array.isArray(v)) return '[' + v.map(walk).join(',') + ']';
        const keys = Object.keys(v).sort();
        return '{' + keys.map((k) => JSON.stringify(k) + ':' + walk((v as any)[k])).join(',') + '}';
    };
    return walk(obj);
}

function fnv1a(str: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h >>> 0) + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24));
    }
    return (h >>> 0).toString(16);
}

function hashObject(obj: unknown): string {
    return fnv1a(stableStringify(obj));
}

export function useSyncOnChange() {
    const dispatch = useDispatch();
    const characters = useSelector((s: RootState) => s.characters);
    const rooms = useSelector((s: RootState) => s.rooms);
    const messages = useSelector((s: RootState) => s.messages);
    const settings = useSelector((s: RootState) => s.settings);

    const prevCharHashesRef = useRef<HashMap>({});
    const prevRoomHashesRef = useRef<HashMap>({});
    const prevMsgHashesRef = useRef<HashMap>({});
    const prevSettingsHashRef = useRef<string>('');

    const upsertsRef = useRef<{ characters: any[]; rooms: any[]; messages: any[]; settings?: RootState['settings'] }>({ characters: [], rooms: [], messages: [] });
    const deletesRef = useRef<{ characters: Id[]; rooms: string[]; messages: string[] }>({ characters: [], rooms: [], messages: [] });
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const schedule = () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(async () => {
                const state = { settings } as RootState; // settings from closure is up-to-date in React
                if (!state.settings?.syncSettings.syncEnabled) {
                    // reset buffers if sync disabled
                    upsertsRef.current = { characters: [], rooms: [], messages: [] };
                    deletesRef.current = { characters: [], rooms: [], messages: [] };
                    return;
                }
                const clientId = state.settings.syncSettings.syncClientId.trim() || 'default-client';
                const base = state.settings.syncSettings.syncBaseUrl.trim();
                const payload = {
                    clientSummary: buildClientSummary(),
                    upserts: {
                        characters: upsertsRef.current.characters,
                        rooms: upsertsRef.current.rooms,
                        messages: upsertsRef.current.messages,
                        // Do not upload client-only syncSettings
                        settings: upsertsRef.current.settings ? stripSyncSettings(upsertsRef.current.settings) : undefined,
                    },
                    deletes: deletesRef.current,
                };
                // reset before sending to coalesce bursts
                upsertsRef.current = { characters: [], rooms: [], messages: [] };
                deletesRef.current = { characters: [], rooms: [], messages: [] };
                dispatch(uiActions.syncStart());
                try {
                    await sendDeltaToServer(clientId, payload as any, base);
                } catch (e) {
                    // swallow; next change will retry
                    // console.error('sync(send) error', e);
                } finally {
                    dispatch(uiActions.syncEnd());
                }
            }, 500);
        };

        // characters diff
        {
            const prev = prevCharHashesRef.current;
            const next: HashMap = {};
            const ids = characters.ids as Id[];
            for (const id of ids) {
                const obj = (characters.entities as any)[id];
                if (!obj) continue;
                const h = hashObject(obj);
                next[String(id)] = h;
                if (prev[String(id)] !== h) upsertsRef.current.characters.push(obj);
            }
            // deletions
            for (const idStr of Object.keys(prev)) {
                if (!(idStr in next)) deletesRef.current.characters.push(idStr);
            }
            prevCharHashesRef.current = next;
        }

        // rooms diff
        {
            const prev = prevRoomHashesRef.current;
            const next: HashMap = {};
            const ids = rooms.ids as string[];
            for (const id of ids) {
                const obj = (rooms.entities as any)[id];
                if (!obj) continue;
                const h = hashObject(obj);
                next[id] = h;
                if (prev[id] !== h) upsertsRef.current.rooms.push(obj);
            }
            for (const idStr of Object.keys(prev)) {
                if (!(idStr in next)) deletesRef.current.rooms.push(idStr);
            }
            prevRoomHashesRef.current = next;
        }

        // messages diff
        {
            const prev = prevMsgHashesRef.current;
            const next: HashMap = {};
            const ids = messages.ids as string[];
            for (const id of ids) {
                const obj = (messages.entities as any)[id];
                if (!obj) continue;
                const h = hashObject(obj);
                next[id] = h;
                if (prev[id] !== h) upsertsRef.current.messages.push(obj);
            }
            for (const idStr of Object.keys(prev)) {
                if (!(idStr in next)) deletesRef.current.messages.push(idStr);
            }
            prevMsgHashesRef.current = next;
        }

        // settings diff (single object)
        {
            // Hash settings excluding client-only syncSettings to match server-side comparison
            const h = hashObject(stripSyncSettings(settings));
            if (prevSettingsHashRef.current !== h) {
                upsertsRef.current.settings = stripSyncSettings(settings);
                prevSettingsHashRef.current = h;
            }
        }

        // schedule flush if anything recorded
        if (
            upsertsRef.current.characters.length ||
            upsertsRef.current.rooms.length ||
            upsertsRef.current.messages.length ||
            upsertsRef.current.settings ||
            deletesRef.current.characters.length ||
            deletesRef.current.rooms.length ||
            deletesRef.current.messages.length
        ) {
            schedule();
        }

        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [characters, rooms, messages, settings]);
}
