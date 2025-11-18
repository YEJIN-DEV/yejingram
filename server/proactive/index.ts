import fs from 'fs/promises';
import express from 'express';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import sharp from 'sharp';
import { store } from '../../src/app/store';
import { selectAllRooms, selectRoomById } from '../../src/entities/room/selectors';
import { selectMessagesByRoomId } from '../../src/entities/message/selectors';
import type { Message } from '../../src/entities/message/types';
import { buildBackupPayload, restoreStateFromPayload } from '../../src/utils/backup';
import { SendMessage } from '../../src/services/llm/LLMcaller';
import webpush, { type PushSubscription } from 'web-push';
import 'dotenv/config';
import en from '../../src/i18n/locales/en.ts';
import ko from '../../src/i18n/locales/ko.ts';
import ja from '../../src/i18n/locales/ja.ts';
import { selectCharacterById } from '../../src/entities/character/selectors.ts';
import path from 'path';
import { selectLastSaved } from '../../src/entities/lastSaved/selectors.ts';

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

webpush.setVapidDetails(
    'https://github.com/YEJIN-DEV/yejingram',
    process.env.push_public_key!,
    process.env.push_private_key!
);

interface SubscriptionBody extends PushSubscription {
    clientId: string;
}

const SUBSCRIPTION_DIR = path.resolve(process.cwd(), 'data');
async function readSubscriptions(clientId?: string): Promise<PushSubscription | { [key: string]: PushSubscription }> {
    try {
        await fs.mkdir(SUBSCRIPTION_DIR, { recursive: true });
    } catch { }

    if (clientId) {
        const filePath = path.join(SUBSCRIPTION_DIR, `${clientId}.json`);
        const json = await fs.readFile(filePath, 'utf-8');
        const parsed: PushSubscription = JSON.parse(json);
        return parsed;
    } else {
        const entries = await fs.readdir(SUBSCRIPTION_DIR, { withFileTypes: true });
        const subs: { [key: string]: PushSubscription } = {};

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            try {
                const json = await fs.readFile(path.join(SUBSCRIPTION_DIR, entry.name), 'utf-8');
                subs[entry.name.replace('.json', '')] = JSON.parse(json);
            } catch {
                // 개별 파일 오류는 무시하고 나머지 파일만 사용
                continue;
            }
        }
        return subs;
    }
}

export async function saveSubscription(subscription: SubscriptionBody): Promise<void> {
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth || !subscription.clientId) {
        throw new Error('Invalid subscription object');
    }

    const { clientId, ...pure } = subscription;
    const filePath = path.join(SUBSCRIPTION_DIR, `${clientId}.json`);
    await fs.mkdir(SUBSCRIPTION_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(pure, null, 2));
}

function startSubscriptionApi(port: number = Number(process.env.HEADLESS_PORT ?? 4001)) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });

    app.post('/api/push/subscription', async (req, res) => {
        try {
            await saveSubscription(req.body as SubscriptionBody);
            res.json({ ok: true });
        } catch (err: any) {
            console.error('[Subscription API Error]', err);
            res.status(400).json({ error: err?.message ?? 'Invalid subscription' });
        }
    });

    app.get('/api/push/icon/:authorId', async (req, res) => {
        try {
            const authorId = Number(req.params.authorId);
            if (Number.isNaN(authorId)) {
                return res.status(400).json({ error: 'Invalid authorId' });
            }

            const state = store.getState();
            const character = selectCharacterById(state, authorId as number);

            if (!character) {
                return res.status(404).json({ error: 'Character not found' });
            }

            const avatar = character.avatar;

            if (!avatar) {
                return res.status(404).json({ error: 'Avatar not found' });
            }

            const base64Data = avatar.includes(',') ? avatar.split(',')[1] : avatar;
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const resizedPng = await sharp(imageBuffer)
                .resize(192, 192, { fit: 'cover' })
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.end(resizedPng);
        } catch (err: any) {
            console.error('[Icon API Error]', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.listen(port, () => {
        console.log(`[headless] Subscription API server (express) listening on port ${port}`);
    });
}

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

(async () => {
    startSubscriptionApi();

    while (true) {
        const subscription = await readSubscriptions();

        for (const [clientId, push] of Object.entries(subscription)) {
            console.log("백업 복원 시작");

            const backupResponse = await fetch(`${process.env.SYNC_BASE_URL}/api/sync/${clientId}`, {
                method: 'GET',
            });

            if (!backupResponse.ok) {
                console.error("백업 데이터 불러오기 실패:", backupResponse.statusText);
                return;
            }

            const backupPayload = await backupResponse.json();
            await restoreStateFromPayload(backupPayload);
            console.log(`백업 로드 완료`);
            const state = store.getState();

            if (!state.settings.proactiveSettings.proactiveChatEnabled) {
                console.log("Proactive Chat 기능이 설정에서 활성화되어 있지 않습니다.");
                return;
            }

            const allRooms = selectAllRooms(state);
            if (!allRooms || allRooms.length === 0) {
                console.error('방이 하나도 없습니다.');
                return;
            }

            const randomRoom = allRooms[Math.floor(Math.random() * allRooms.length)]

            const beforeMessages = selectMessagesByRoomId(store.getState(), randomRoom.id);
            const beforeIds = new Set(beforeMessages.map(m => m.id));
            printMessages(beforeMessages);

            const pendingAdded = new Map<string, Message>();

            store.subscribe(async () => {
                const allMessages = selectMessagesByRoomId(store.getState(), randomRoom.id);
                const newlyAdded = allMessages.filter(m => !beforeIds.has(m.id) && !pendingAdded.has(m.id))[0];
                if (!newlyAdded) return;

                pendingAdded.set(newlyAdded.id, newlyAdded);
                beforeIds.add(newlyAdded.id);

                const characterName = selectCharacterById(state, newlyAdded.authorId).name;
                printMessages([newlyAdded]);

                webpush.sendNotification(
                    push,
                    JSON.stringify({
                        icon: `${state.settings.proactiveSettings.proactiveServerBaseUrl}/api/push/icon/${newlyAdded.authorId}`,
                        badge: '/yejingram.png',
                        body: characterName + ": " + newlyAdded.content,
                    })
                )
            });

            await SendMessage(
                randomRoom,
                (id) => {
                    if (id) {
                        console.log("Message Generating... id:", id);
                    } else {
                        console.log("Message generation completed.");
                    }
                },
                i18next.t,
                "proactive"
            );

            console.log("동기화중");

            fetch(`${state.settings.syncSettings.syncBaseUrl}/api/sync/${state.settings.syncSettings.syncClientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lastSaved: selectLastSaved(state),
                    backup: buildBackupPayload(),
                })
            }).then((res) => {
                if (res.ok) {
                    console.log("동기화 완료");
                } else {
                    console.error("동기화 실패:", res.statusText);
                }
            })
        }
        await new Promise(resolve => setTimeout(resolve, 6000 * 10));
    }
})();
