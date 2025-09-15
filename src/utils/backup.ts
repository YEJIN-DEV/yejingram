// src/app/stateBackup.ts
import { store, persistor, resetAll, migrations, persistConfig } from '../app/store';
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
type BackupFile = {
  app: 'yejingram';
  version: number;         // 우리 스키마 버전 (persist 버전과 별개)
  createdAt: string;       // ISO 문자열
  data: Pick<RootState, 'characters' | 'rooms' | 'messages' | 'settings'>;
};

// ---------- 백업 ----------
export async function backupStateToFile() {
  // 1) 현재 Redux 상태에서 whitelist만 추출
  const state = store.getState();
  const data = {
    characters: state.characters,
    rooms: state.rooms,
    messages: state.messages,
    settings: state.settings,
  };

  // 2) 메타와 함께 파일로 저장
  const payload: BackupFile = {
    app: 'yejingram',
    version: 1,
    createdAt: new Date().toISOString(),
    data,
  };

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

  for (let v = parsed.version; v <= persistConfig.version; v++) {
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
