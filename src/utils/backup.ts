// src/app/stateBackup.ts
import { store, persistor, resetAll, migrations, persistConfig } from '../app/store';
import type { RootState } from '../app/store';
import { charactersActions } from '../entities/character/slice';
import { roomsActions } from '../entities/room/slice';
import { messagesActions } from '../entities/message/slice';
import { settingsActions } from '../entities/setting/slice';
import { lastSavedActions } from '../entities/lastSaved/slice';
import type { EntityState, EntityId } from '@reduxjs/toolkit';
import { selectLastSaved } from '../entities/lastSaved/selectors';

export function entityStateToArray<T>(
  // Id extends PropertyKey 대신 Id extends EntityId를 사용합니다.
  state: Pick<EntityState<T, EntityId>, 'ids' | 'entities'>
): T[] {
  // undefined 안전 처리 (타입·런타임 모두)
  return state.ids
    .map((id) => state.entities[id as EntityId])
    .filter((v): v is T => v !== undefined);
}

export async function wipeAllState() {
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
  data: Pick<RootState, 'characters' | 'rooms' | 'messages' | 'settings' | 'lastSaved'>;
};

// Build a compact payload from current state
export function buildBackupPayload() {
  const state = store.getState();
  const data = {
    characters: state.characters,
    rooms: state.rooms,
    messages: state.messages,
    settings: state.settings,
    lastSaved: state.lastSaved,
  } satisfies BackupFile['data'];
  const payload: BackupFile = {
    app: 'yejingram',
    version: persistConfig.version,
    createdAt: new Date().toISOString(),
    data,
  };
  return payload;
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

  await restoreStateFromPayload(parsed);
}

export async function restoreStateFromPayload(payload: BackupFile) {
  if (payload.app !== 'yejingram' || !payload.data) {
    throw new Error('이 앱의 백업 형식이 아닙니다.');
  }

  store.dispatch({ type: 'sync/applyDeltaStart' });
  await wipeAllState();
  let state = payload.data;
  for (let v = payload.version + 1; v <= persistConfig.version; v++) {
    if (migrations[v] == null) continue;
    state = migrations[v](state as unknown as any) as unknown as typeof state;
  }

  const { characters, rooms, messages, settings, lastSaved } = state;
  persistor.persist();
  if (characters) store.dispatch(charactersActions.importCharacters(entityStateToArray(characters)));
  if (rooms) store.dispatch(roomsActions.importRooms(entityStateToArray(rooms)));
  if (messages) store.dispatch(messagesActions.importMessages(entityStateToArray(messages)));
  if (settings) store.dispatch(settingsActions.importSettings(settings));
  if (lastSaved) store.dispatch(lastSavedActions.importLastSaved(lastSaved));
  store.dispatch({ type: 'sync/applyDeltaEnd' });
}

// ---------- 서버 동기화 ----------
export async function backupStateToServer(clientId: string, baseURL: string) {
  fetch(`${baseURL}/api/sync/${clientId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lastSaved: selectLastSaved(store.getState()),
      backup: buildBackupPayload(),
    })
  });
}

export async function restoreStateFromServer(clientId: string, baseURL: string) {
  const res = await fetch(`${baseURL}/api/sync/${clientId}`);
  if (res.ok) {
    const data = await res.json();
    if (data) {
      await restoreStateFromPayload(data);
    }
  }
}