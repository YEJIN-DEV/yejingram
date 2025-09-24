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
import { uiActions } from '../entities/ui/slice';

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
export async function restoreStateFromFile(file: File, autoSync?: boolean) {
  const text = await file.text();

  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('잘못된 JSON 파일입니다.');
  }

  await restoreStateFromPayload(parsed, autoSync);
}

export async function restoreStateFromPayload(payload: BackupFile, autoSync = true) {
  if (payload.app !== 'yejingram' || !payload.data) {
    throw new Error('이 앱의 백업 형식이 아닙니다.');
  }

  if (autoSync) store.dispatch({ type: 'sync/applyDeltaStart' });

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

  if (autoSync) store.dispatch({ type: 'sync/applyDeltaEnd' });
}

// ---------- 서버 동기화 ----------
export async function backupStateToServer(clientId: string, baseURL: string) {
  // 업로드 인디케이터 시작
  store.dispatch(uiActions.setUploadProgress(0));
  try {
    const data = JSON.stringify({
      lastSaved: selectLastSaved(store.getState()),
      backup: buildBackupPayload(),
    });

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${baseURL}/api/sync/${clientId}`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.max(0, Math.min(100, Math.floor((event.loaded / event.total) * 100)));
          store.dispatch(uiActions.setUploadProgress(percent));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));

      xhr.send(data);
    });
  } finally {
    // 업로드 인디케이터 종료
    store.dispatch(uiActions.clearUploadProgress());
  }
}

export async function restoreStateFromServer(clientId: string, baseURL: string) {
  // 다운로드 진행률을 바이트 기준으로 표시
  store.dispatch(uiActions.setSyncProgress(0));
  try {
    const res = await fetch(`${baseURL}/api/sync/${clientId}`);
    if (!res.ok) return;

    const totalStr = res.headers.get('content-length');
    const total = totalStr ? parseInt(totalStr, 10) : 0;
    const body = res.body as ReadableStream<Uint8Array> | null;

    let jsonText: string | null = null;

    if (body && typeof (body as any).getReader === 'function' && total > 0) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let received = 0;
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          text += decoder.decode(value, { stream: true });
          const percent = Math.max(0, Math.min(100, Math.floor((received / total) * 100)));
          store.dispatch(uiActions.setSyncProgress(percent));
        }
      }
      // flush
      text += new TextDecoder().decode();
      jsonText = text;
    } else {
      // 총 길이를 알 수 없음
      store.dispatch(uiActions.clearSyncProgress());
      const data = await res.json();
      await restoreStateFromPayload(data);
      return;
    }

    if (jsonText) {
      const data = JSON.parse(jsonText);
      await restoreStateFromPayload(data);
    }
  } finally {
    store.dispatch(uiActions.clearSyncProgress());
  }
}