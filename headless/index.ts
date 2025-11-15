import fs from 'fs/promises';
import arg from 'arg';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { nanoid } from '@reduxjs/toolkit';
import { store } from '../src/app/store';
import { messagesActions } from '../src/entities/message/slice.ts';
import { selectRoomById } from '../src/entities/room/selectors';
import { selectMessagesByRoomId } from '../src/entities/message/selectors';
import { Message } from '../src/entities/message/types';
import { Room } from '../src/entities/room/types.ts';
import { buildBackupPayload, restoreStateFromPayload } from '../src/utils/backup';
import { SendMessage } from '../src/services/llm/LLMcaller';
import en from '../src/i18n/locales/en.ts';
import ko from '../src/i18n/locales/ko.ts';
import ja from '../src/i18n/locales/ja.ts';

const resources = {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja }
};

i18next
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en',
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
    });

function printMessages(messages: Message[]) {
    for (const m of messages) {
        const baseInfo = `- [${m.type}] authorId=${m.authorId} at ${m.createdAt}`;
        if (m.type === 'TEXT') {
            console.log(baseInfo + `\n  ${m.content ?? ''}`);
        } else if (m.type === 'STICKER') {
            console.log(baseInfo + `\n  [Sticker] ${m.sticker?.name ?? m.sticker?.id ?? 'unknown'}`);
        } else if (m.type === 'IMAGE') {
            console.log(baseInfo + `\n  [Image] ${m.file?.name ?? m.file?.mimeType ?? 'image'}`);
        } else {
            console.log(baseInfo);
        }
    }
}

function printRoomInfo(characterId: number) {
    const state = store.getState();
    const rooms = Object.values(state.rooms.entities).filter(r => r && r.memberIds.includes(characterId)) as Room[];

    for (const room of rooms) {
        console.log(`- ${room.name} (ID: ${room.id})`);
        const messages = selectMessagesByRoomId(state, room.id);
        console.log(`  Messages: ${messages.length}`); // 간단한 메시지 통계
        console.log(`  Last Message: ${messages.length > 0 ? messages[messages.length - 1].content : 'No messages'}`);
    }
}

function printCharacters() {
    const state = store.getState();
    const characters = Object.values(state.characters.entities).filter(c => c) as { id: number; name: string }[];
    for (const char of characters) {
        console.log(`Character: ${char.name} (ID: ${char.id})`);
        printRoomInfo(char.id);
        console.log('');
    }
}

(async () => {
    const argv = arg(
        {
            '--printCharacters': Boolean,
            '--printRoomInfo': Number,
            '--room': String,
            '--text': String,
            '--help': Boolean,
            '--file': String,
            '-c': '--printCharacters',
            '-r': '--room',
            '-t': '--text',
            '-h': '--help',
            '-f': '--file',
        },
        { permissive: true, argv: process.argv.slice(2) }
    );

    if (argv['--help']) {
        const usage = `
Usage:
    tsx headless/index.ts [options]
    node dist/headless/index.js [options]

Options:
    --printCharacters, -c            모든 캐릭터와 해당 방 요약 출력
    --printRoomInfo <characterId>    특정 캐릭터가 속한 방 정보 출력 (숫자)
    --room <roomId>, -r <roomId>     메시지를 보낼 방 ID 지정
    --text <message>, -t <message>   전송 전 추가할 텍스트 메시지 지정
    --file <path>, -f <path>         복원할 백업 JSON 경로 (기본: yejingram-backup-1762960265234.json)
    --help, -h                       도움말 표시 후 종료

Examples:
    tsx headless/index.ts -f backup.json --printCharacters
    tsx headless/index.ts -f backup.json --printRoomInfo 0
    tsx headless/index.ts -f backup.json -r 1760380953855-1760380955372 -t "Hello from CLI"
    tsx headless/index.ts -f backup.json -c

Note:
    --room 과 --text 를 함께 제공하면 해당 방에 메시지를 추가하고 응답 생성을 요청합니다.`.trim();
        console.log(usage);
        return;
    }

    console.log("백업 복원 시작");
    const backupFile = argv['--file'];
    if (backupFile) {
        try {
            const raw = await fs.readFile(backupFile, 'utf-8');
            await restoreStateFromPayload(JSON.parse(raw));
            console.log(`백업 로드 완료: ${backupFile}`);
        } catch (e: any) {
            console.error(`백업 파일 읽기 실패: ${backupFile}\n`, e?.message ?? e);
            return;
        }

        if (argv['--printCharacters']) {
            printCharacters();
            return;
        }
    } else {
        console.error('백업 파일 경로를 제공해주세요. --file <path> 옵션을 사용하세요.');
        return;
    }

    const printRoomInfoCharId = argv['--printRoomInfo'];
    if (typeof printRoomInfoCharId === 'number' && !Number.isNaN(printRoomInfoCharId)) {
        printRoomInfo(printRoomInfoCharId);
        return;
    } else if (argv['--printRoomInfo'] !== undefined) {
        console.error('Invalid character id for --printRoomInfo:', argv['--printRoomInfo']);
    }

    const state = store.getState();

    const roomId = argv['--room'];
    if (roomId) {
        if (!argv['--text']) {
            console.error('Please provide text content with --text when sending a message.');
            return;
        }

        const room = selectRoomById(state, roomId);
        if (!room) {
            console.error("Room not found:", roomId);
            return;
        }

        const beforeMessages = selectMessagesByRoomId(store.getState(), roomId);
        const beforeIds = new Set(beforeMessages.map(m => m.id));
        printMessages(beforeMessages);

        store.dispatch(messagesActions.upsertOne({
            id: nanoid(),
            roomId: room.id,
            authorId: 0,
            createdAt: new Date().toISOString(),
            type: 'TEXT',
            content: argv['--text']
        }));

        await SendMessage(
            room,
            (id) => {
                if (id) {
                    console.log("Message Generating... id:", id);
                } else {
                    console.log("Message generation completed.");
                }
            },
            i18next.t,
            "normal"
        );

        const afterMessages = selectMessagesByRoomId(store.getState(), roomId);
        const added = afterMessages.filter(m => !beforeIds.has(m.id));
        printMessages(added);

        console.log("백업 저장중");
        const payload = buildBackupPayload();
        await fs.writeFile(backupFile, JSON.stringify(payload, null, 2))
    }
})();
