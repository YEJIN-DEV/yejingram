// src/app/stateBackup.ts
import { store, persistor, resetAll, migrations, persistConfig } from '../app/store';
import { uiActions } from '../entities/ui/slice';
import type { RootState } from '../app/store';
import { charactersActions } from '../entities/character/slice';
import { roomsActions } from '../entities/room/slice';
import { messagesActions } from '../entities/message/slice';
import { settingsActions } from '../entities/setting/slice';
import type { EntityState, EntityId } from '@reduxjs/toolkit';

export function entityStateToArray<T>(
  // Id extends PropertyKey 대신 Id extends EntityId를 사용합니다.
  state: Pick<EntityState<T, EntityId>, 'ids' | 'entities'>
): T[] {
  // undefined 안전 처리 (타입·런타임 모두)
  return state.ids
    .map((id) => state.entities[id as EntityId])
    .filter((v): v is T => v !== undefined);
}

async function wipeAllState() {
  persistor.pause();
  await persistor.flush();     // 남은 write 처리
  await persistor.purge();     // ← localforage에 저장된 'yejingram' 스냅샷 제거
  store.dispatch(resetAll());  // ← 메모리상의 Redux 상태 초기화
}

// 백업 파일 스키마
export type BackupFile = {
  app: 'yejingram';
  version: number;         // 우리 스키마 버전 (persist 버전과 별개)
  createdAt: string;       // ISO 문자열
  data: Pick<RootState, 'characters' | 'rooms' | 'messages' | 'settings'>;
};

// ---- Delta Sync shapes ----
type HashMap = Record<string | number, string>;
export type ClientSummary = {
  characters: { hashes: HashMap; deleted: (string | number)[] };
  rooms: { hashes: HashMap; deleted: (string | number)[] };
  messages: { hashes: HashMap; deleted: (string | number)[] };
  settings: { hash?: string };
};

export type ServerSummary = ClientSummary;

export type DeltaPayload = {
  clientSummary: ClientSummary;
  upserts: {
    characters?: any[];
    rooms?: any[];
    messages?: any[];
    settings?: RootState['settings'];
  };
  deletes: {
    characters?: (string | number)[];
    rooms?: (string | number)[];
    messages?: (string | number)[];
  };
};

export type ServerDeltaResponse = {
  ok: boolean;
  delta?: {
    upserts: { characters: any[]; rooms: any[]; messages: any[]; settings?: RootState['settings'] };
    deletes: { characters: (string | number)[]; rooms: (string | number)[]; messages: (string | number)[] };
  };
  summary?: ServerSummary;
  error?: string;
};

// stable stringify to ensure same hash with server
function stableStringify(obj: any): string {
  const seen = new WeakSet();
  const walk = (v: any): string => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (seen.has(v)) return '"[Circular]"';
    seen.add(v);
    if (Array.isArray(v)) return '[' + v.map(walk).join(',') + ']';
    const keys = Object.keys(v).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + walk(v[k])).join(',') + '}';
  };
  return walk(obj);
}

// Tiny FNV-1a 32-bit hash used also by server
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h >>> 0) + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24));
  }
  return (h >>> 0).toString(16);
}

function hashObject(obj: any): string {
  return fnv1a(stableStringify(obj));
}

// Keep current client's syncSettings when applying incoming settings from server
function mergePreserveSyncSettings(incoming: RootState['settings'], clientSyncSettings: any | undefined) {
  // Shallow merge: incoming takes precedence except for syncSettings
  const merged: any = { ...incoming };
  if (clientSyncSettings !== undefined) {
    merged.syncSettings = clientSyncSettings;
  }
  return merged as RootState['settings'];
}

// Remove client-only sync settings before sending to server
export function stripSyncSettings(settings: RootState['settings']) {
  const cloned: any = { ...settings };
  // Ensure the field is not serialized
  delete cloned.syncSettings;
  return cloned as typeof settings;
}

// Build a compact payload from current state
export function buildBackupPayload() {
  const state = store.getState();
  const data = {
    characters: state.characters,
    rooms: state.rooms,
    messages: state.messages,
    settings: state.settings,
  } satisfies BackupFile['data'];
  const payload: BackupFile = {
    app: 'yejingram',
    version: persistConfig.version,
    createdAt: new Date().toISOString(),
    data,
  };
  return payload;
}

export function buildClientSummary(): ClientSummary {
  const state = store.getState();
  const toHashes = (slice: any) => {
    const hashes: HashMap = {};
    for (const id of slice.ids as (string | number)[]) {
      const obj = slice.entities[id as any];
      if (obj) hashes[id] = hashObject(obj);
    }
    return hashes;
  };
  return {
    characters: { hashes: toHashes(state.characters), deleted: [] },
    rooms: { hashes: toHashes(state.rooms), deleted: [] },
    messages: { hashes: toHashes(state.messages), deleted: [] },
    // Hash settings excluding client-only syncSettings to avoid unnecessary deltas
    settings: { hash: hashObject(stripSyncSettings(state.settings)) },
  };
}

// ---------- 백업 ----------
export async function backupStateToFile() {
  const payload = buildBackupPayload();

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `yejingram-backup-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

// ---------- 복원 ----------
export async function restoreStateFromFile(file: File) {
  const text = await file.text();

  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('잘못된 JSON 파일입니다.');
  }

  if (parsed.app !== 'yejingram' || !parsed.data) {
    throw new Error('이 앱의 백업 파일이 아닙니다.');
  }

  await wipeAllState();

  let state = parsed.data;

  for (let v = parsed.version + 1; v <= persistConfig.version; v++) {
    if (migrations[v] == null) continue;
    state = migrations[v](state as unknown as any) as unknown as typeof state;
  }
  const { characters, rooms, messages, settings } = state;

  persistor.persist(); // ← 복원 직전에 persist 재개
  if (characters) store.dispatch(charactersActions.importCharacters(entityStateToArray(characters)));
  if (rooms) store.dispatch(roomsActions.importRooms(entityStateToArray(rooms)));
  if (messages) store.dispatch(messagesActions.importMessages(entityStateToArray(messages)));
  if (settings) store.dispatch(settingsActions.importSettings(settings));
}

// ---- Restore from payload (already parsed) ----
export async function restoreStateFromPayload(payload: BackupFile) {
  if (payload.app !== 'yejingram' || !payload.data) {
    throw new Error('이 앱의 백업 형식이 아닙니다.');
  }
  await wipeAllState();
  let state = payload.data;
  for (let v = payload.version + 1; v <= persistConfig.version; v++) {
    if (migrations[v] == null) continue;
    state = migrations[v](state as unknown as any) as unknown as typeof state;
  }
  const { characters, rooms, messages, settings } = state;
  persistor.persist();
  if (characters) store.dispatch(charactersActions.importCharacters(entityStateToArray(characters)));
  if (rooms) store.dispatch(roomsActions.importRooms(entityStateToArray(rooms)));
  if (messages) store.dispatch(messagesActions.importMessages(entityStateToArray(messages)));
  if (settings) store.dispatch(settingsActions.importSettings(settings));
}

export async function backupStateToServer(clientId: string, baseURL: string) {
  const clientSummary = buildClientSummary();
  // Fetch server summary first (optional, single roundtrip PUT also fine)
  store.dispatch(uiActions.syncStart());
  try {
    try {
      await fetch(`${baseURL}/api/sync/${encodeURIComponent(clientId)}`).then(() => { });
    } catch { }
    const payload: DeltaPayload = {
      clientSummary,
      upserts: {
        characters: entityStateToArray(store.getState().characters),
        rooms: entityStateToArray(store.getState().rooms),
        messages: entityStateToArray(store.getState().messages),
        settings: stripSyncSettings(store.getState().settings),
      },
      deletes: {},
    };
    const res = await sendDeltaToServer(clientId, payload, baseURL);
    return res;
  } finally {
    store.dispatch(uiActions.syncEnd());
  }
}

export async function restoreStateFromServer(clientId: string, baseURL: string) {
  // Force show the full-screen sync modal during manual restore
  store.dispatch(uiActions.forceShowSyncModal());
  store.dispatch(uiActions.syncStart());
  try {
    // Capture current client's syncSettings to preserve after full restore
    const prevSyncSettings = store.getState().settings?.syncSettings;
    const res = await fetch(`${baseURL}/api/sync/${encodeURIComponent(clientId)}`);
    const json = (await res.json()) as { ok: boolean; summary?: any };
    if (!json.ok) throw new Error('failed to get summary');
    // After summary, request full delta by sending empty hashes so server replies with everything
    const emptySummary: ClientSummary = {
      characters: { hashes: {}, deleted: [] },
      rooms: { hashes: {}, deleted: [] },
      messages: { hashes: {}, deleted: [] },
      settings: { hash: undefined },
    };
    const payload: DeltaPayload = { clientSummary: emptySummary, upserts: {}, deletes: {} };
    const put = await fetch(`${baseURL}/api/sync/${encodeURIComponent(clientId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const delta = (await put.json()) as ServerDeltaResponse;
    if (!delta.ok) throw new Error(delta.error || 'restore failed');
    if (delta.delta) {
      store.dispatch({ type: 'sync/applyDeltaStart' });
      const { upserts } = delta.delta;
      await wipeAllState();
      persistor.persist();
      if (upserts.characters?.length) store.dispatch(charactersActions.importCharacters(upserts.characters as any));
      if (upserts.rooms?.length) store.dispatch(roomsActions.importRooms(upserts.rooms as any));
      if (upserts.messages?.length) store.dispatch(messagesActions.importMessages(upserts.messages as any));
      if (upserts.settings) {
        const merged = mergePreserveSyncSettings(upserts.settings as any, prevSyncSettings);
        store.dispatch(settingsActions.importSettings(merged));
      }
      store.dispatch({ type: 'sync/applyDeltaEnd' });
    }
  } finally {
    store.dispatch(uiActions.syncEnd());
    // Clear forced modal after restore completes
    store.dispatch(uiActions.clearForceShowSyncModal());
  }
}

// ---- Low-level: send prebuilt delta payload and apply server delta ----
export async function sendDeltaToServer(clientId: string, payload: DeltaPayload, baseURL: string) {
  const bodyStr = JSON.stringify(payload);
  // Mark upload in-flight during request start until first byte of response arrives
  store.dispatch(uiActions.uploadStart());
  const res = await fetch(`${baseURL}/api/sync/${encodeURIComponent(clientId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: bodyStr,
  });

  // Stream response to track download progress 50% -> 100%
  let parsed: ServerDeltaResponse | null = null;
  let usedDeterminate = false;
  try {
    // Upload considered finished when response stream becomes available
    const reader = res.body?.getReader();
    store.dispatch(uiActions.uploadEnd());
    const contentLength = Number(res.headers.get('Content-Length') || '0');
    if (reader && contentLength > 0) {
      usedDeterminate = true;
      let received = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          const ratio = Math.max(0, Math.min(1, received / contentLength));
          const pct = Math.floor(ratio * 100);
          store.dispatch(uiActions.setSyncProgress(pct));
        }
      }
      const merged = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      const text = new TextDecoder('utf-8').decode(merged);
      parsed = JSON.parse(text) as ServerDeltaResponse;
    } else {
      // Fallback: no streaming or unknown length
      parsed = (await res.json()) as ServerDeltaResponse;
    }
  } finally {
    // Only finalize progress bar when we actually showed determinate progress
    if (usedDeterminate) {
      store.dispatch(uiActions.setSyncProgress(100));
      setTimeout(() => store.dispatch(uiActions.clearSyncProgress()), 300);
    }
  }

  const json = parsed!;
  if (!json.ok) throw new Error(json.error || 'sync failed');
  if (json.delta) {
    store.dispatch({ type: 'sync/applyDeltaStart' });
    const { upserts } = json.delta;
    if (upserts.characters?.length) store.dispatch(charactersActions.importCharacters(upserts.characters as any));
    if (upserts.rooms?.length) store.dispatch(roomsActions.importRooms(upserts.rooms as any));
    if (upserts.messages?.length) store.dispatch(messagesActions.importMessages(upserts.messages as any));
    if (upserts.settings) {
      const clientSyncSettings = store.getState().settings?.syncSettings;
      const merged = mergePreserveSyncSettings(upserts.settings as any, clientSyncSettings);
      store.dispatch(settingsActions.importSettings(merged));
    }
    store.dispatch({ type: 'sync/applyDeltaEnd' });
  }
  return json;
}
